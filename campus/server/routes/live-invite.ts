// Lien invité d'une séance : suivre CE cours sans compte ni identifiant.
//
// Pour les étudiants qui n'arrivent pas à se connecter (code perdu, compte pas
// encore activé) et pour les invités d'un cours. Le lien est signé par le
// serveur (HMAC de l'identifiant de la séance) : il ne vaut que pour sa séance,
// jusqu'à 30 minutes après la fin prévue (ou tant qu'elle déborde en direct).
// L'invité donne seulement son nom ; il suit en son + diapos (léger) ou en
// vidéo (visio Daily, sans micro ni caméra). Il ne pose pas de question, ne
// vote pas, n'émarge pas : son passage est noté au fil de la séance (bilan).
//
//   GET  /api/seances/:id/lien-invite       le lien (formateur du cours, direction, vie scolaire)
//   GET  /api/invite/:jeton                 la séance vue par l'invité (titre, statut, diapo)
//   GET  /api/invite/:jeton/diapo/:index    l'image d'une diapo de la séance
//   GET  /api/invite/:jeton/radio/etat      la radio (son du formateur) : en direct ou non
//   GET  /api/invite/:jeton/radio/ecoute    le flux audio
//   POST /api/invite/:jeton/entrer          { nom, mode } : passage noté au fil de la séance
//   POST /api/invite/:jeton/visio           { nom } : jeton Daily, sans micro ni caméra
import crypto from "crypto";
import type { Express, Request } from "express";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { config } from "../config";
import { exigerConnexion, moi, verifierTentatives, noterEchec } from "../auth";
import { route, valider, idParam, ErreurHttp, introuvable, interdit } from "../http";
import { enseigneCours } from "../acces";
import { remettreFichier } from "../fichiers";
import * as visio from "../visio";
import { etatRadioSeance, ecouteRadioInvite } from "../visio-campus";
import { seances, cours, utilisateurs, fichiers, sousTitres, evenementsSeances, type Seance, type InfoInviteDto, type LienInviteDto, type AccesDaily } from "@shared/schema";

const MINUTE = 60_000;
/** Le lien marche encore 30 minutes après la fin prévue (débordement, retardataires). */
const MARGE_APRES_FIN_MS = 30 * MINUTE;
/** La vidéo ouvre 30 minutes avant le début, comme pour les étudiants. */
const OUVERTURE_VIDEO_MS = 30 * MINUTE;

const signature = (seanceId: number) => crypto.createHmac("sha256", config.sessionSecret).update(`invite-seance:${seanceId}`).digest("base64url").slice(0, 22);
export const jetonInvite = (seanceId: number) => `${seanceId}-${signature(seanceId)}`;

/** L'identifiant de séance d'un jeton bien signé, sinon null. */
function lireJeton(jeton: string): number | null {
  const m = /^(\d{1,9})-([A-Za-z0-9_-]{22})$/.exec(jeton);
  if (!m) return null;
  const id = Number(m[1]);
  const attendu = Buffer.from(signature(id));
  const recu = Buffer.from(m[2]);
  return recu.length === attendu.length && crypto.timingSafeEqual(recu, attendu) ? id : null;
}

const finPrevue = (s: Pick<Seance, "debut" | "dureeMinutes">) => new Date(s.debut.getTime() + s.dureeMinutes * MINUTE);
const lienValide = (s: Seance) => s.statut !== "annulee" && (s.statut === "en_direct" || Date.now() <= finPrevue(s).getTime() + MARGE_APRES_FIN_MS);

async function seanceDuJeton(req: Request): Promise<{ s: Seance; jeton: string }> {
  const jeton = String(req.params.jeton ?? "");
  const id = lireJeton(jeton);
  const [s] = id ? await db.select().from(seances).where(eq(seances.id, id)) : [];
  if (!s) throw introuvable("Lien");
  return { s, jeton };
}

function exigerValide(s: Seance) {
  if (s.statut === "annulee") throw new ErreurHttp(410, "Ce cours a été annulé.");
  if (!lienValide(s)) throw new ErreurHttp(410, "Ce cours est terminé : le lien ne marche plus.");
}

/** Un invité interroge la séance toutes les quelques secondes : réponse gardée 2 s par séance. */
const cacheInfos = new Map<number, { exp: number; info: InfoInviteDto }>();

async function infoInvite(s: Seance, jeton: string): Promise<InfoInviteDto> {
  const garde = cacheInfos.get(s.id);
  if (garde && garde.exp > Date.now()) return garde.info;
  const [c] = await db.select({ titre: cours.titre, code: cours.code, formateurId: cours.formateurId }).from(cours).where(eq(cours.id, s.coursId));
  const [f] = c?.formateurId ? await db.select({ prenom: utilisateurs.prenom, nom: utilisateurs.nom }).from(utilisateurs).where(eq(utilisateurs.id, c.formateurId)) : [];
  const [st] = s.statut === "en_direct" ? await db.select({ texte: sousTitres.texte }).from(sousTitres).where(eq(sousTitres.seanceId, s.id)).orderBy(desc(sousTitres.id)).limit(1) : [];
  const total = s.diapos.length;
  const masquee = s.diapoCourante < 0;
  const brut = masquee ? -s.diapoCourante - 1 : s.diapoCourante;
  const index = total ? Math.min(Math.max(0, brut), total - 1) : 0;
  const info: InfoInviteDto = {
    seanceId: s.id,
    titre: s.titre,
    cours: c ? `${c.code} · ${c.titre}` : "",
    formateur: f ? `${f.prenom} ${f.nom}` : null,
    debut: s.debut.toISOString(),
    fin: finPrevue(s).toISOString(),
    statut: s.statut,
    valide: lienValide(s),
    video: s.fournisseur === "daily",
    diapo: { index, total, masquee, url: total && !masquee ? `/api/invite/${jeton}/diapo/${index}` : null },
    sousTitre: st?.texte ?? null,
  };
  cacheInfos.set(s.id, { exp: Date.now() + 2000, info });
  return info;
}

const NOM = z.string().trim().min(2, "Indiquez votre nom.").max(60);
/** Passages déjà notés (séance, réseau, nom) : un rechargement de page ne compte pas deux fois. */
const passages = new Set<string>();

export function enregistrerInvite(app: Express) {
  app.get(
    "/api/seances/:id/lien-invite",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const [s] = await db.select().from(seances).where(eq(seances.id, idParam(req)));
      if (!s) throw introuvable("Séance");
      const permis = u.role === "admin" || u.role === "vie_scolaire" || (u.role === "formateur" && (await enseigneCours(u, s.coursId)));
      if (!permis) throw interdit("Le lien invité est réservé au formateur du cours et à l'équipe.");
      const lien: LienInviteDto = {
        url: `${config.urlCampus}/invite/${jetonInvite(s.id)}`,
        valableJusquau: new Date(finPrevue(s).getTime() + MARGE_APRES_FIN_MS).toISOString(),
      };
      res.json(lien);
    }),
  );

  app.get(
    "/api/invite/:jeton",
    route(async (req, res) => {
      const { s, jeton } = await seanceDuJeton(req);
      res.setHeader("Cache-Control", "no-store");
      res.json(await infoInvite(s, jeton));
    }),
  );

  app.get(
    "/api/invite/:jeton/diapo/:index",
    route(async (req, res) => {
      const { s } = await seanceDuJeton(req);
      exigerValide(s);
      const id = s.diapos[Number(req.params.index)];
      const [f] = Number.isInteger(id) ? await db.select().from(fichiers).where(eq(fichiers.id, id)) : [];
      if (!f) throw introuvable("Diapo");
      await remettreFichier(res, f);
    }),
  );

  app.get(
    "/api/invite/:jeton/radio/etat",
    route(async (req, res) => {
      const { s } = await seanceDuJeton(req);
      exigerValide(s);
      res.setHeader("Cache-Control", "no-store");
      res.json(etatRadioSeance(s.id));
    }),
  );

  app.get(
    "/api/invite/:jeton/radio/ecoute",
    route(async (req, res) => {
      const { s } = await seanceDuJeton(req);
      exigerValide(s);
      ecouteRadioInvite(s.id, req, res);
    }),
  );

  app.post(
    "/api/invite/:jeton/entrer",
    route(async (req, res) => {
      const { s } = await seanceDuJeton(req);
      exigerValide(s);
      const { nom, mode } = valider(z.object({ nom: NOM, mode: z.enum(["radio", "video"]) }), req.body);
      const cle = `${s.id}|${req.ip}|${nom.toLowerCase()}`;
      if (!passages.has(cle)) {
        if (passages.size > 20_000) passages.clear();
        passages.add(cle);
        await db.insert(evenementsSeances).values({ seanceId: s.id, type: "invite", donnees: { nom, mode } });
      }
      res.json({ ok: true });
    }),
  );

  app.post(
    "/api/invite/:jeton/visio",
    route(async (req, res) => {
      const { s } = await seanceDuJeton(req);
      exigerValide(s);
      const { nom } = valider(z.object({ nom: NOM }), req.body);
      if (s.fournisseur !== "daily") throw new ErreurHttp(409, "Pas de vidéo pour ce cours : suivez-le en son + diapos.");
      if (s.statut === "terminee") throw new ErreurHttp(409, "Ce cours est terminé.");
      if (s.statut === "planifiee" && s.debut.getTime() - Date.now() > OUVERTURE_VIDEO_MS) throw new ErreurHttp(409, "La classe ouvre 30 minutes avant le début.");
      const cleIp = `invite-visio|${req.ip}`;
      verifierTentatives(cleIp, 20);
      noterEchec(cleIp); // chaque jeton compte : 20 par quart d'heure et par adresse
      const salle = await visio.obtenirSalleDaily(s);
      // Un identifiant négatif : jamais confondu avec un compte, ni compté parmi les comptes présents.
      const idInvite = -crypto.randomInt(1, 2_000_000_000);
      await visio.reserverPlaceDaily({ salle: salle.nom, profil: "etudiant", utilisateurId: idInvite });
      const nomAffiche = `${nom} · invité`;
      const jeton = await visio.jetonDaily({
        salle: salle.nom,
        nomAffiche,
        utilisateurId: idInvite,
        profil: "etudiant",
        exp: visio.expirationJetonSeance(s),
        envoi: false,
      });
      const acces: AccesDaily = { url: salle.url, jeton, nomAffiche, profil: "etudiant" };
      res.json(acces);
    }),
  );
}
