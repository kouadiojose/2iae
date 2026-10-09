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
// Lien INTERVENANT : même forme, autre signature (un lien invité ne se
// transforme pas en lien intervenant). La même page, mais en vidéo avec micro
// et caméra : un invité qui prend la parole pendant le cours. Il a sa place
// dans la visio même quand les places des étudiants sont prises. Seuls la
// direction, la vie scolaire et le formateur du cours reçoivent ce lien.
//
//   GET  /api/seances/:id/lien-invite       le lien, et le lien intervenant (formateur du cours, direction, vie scolaire)
//   GET  /api/invite/:jeton                 la séance vue par l'invité (titre, statut, diapo)
//   GET  /api/invite/:jeton/diapo/:index    l'image d'une diapo de la séance
//   GET  /api/invite/:jeton/radio/etat      la radio (son du formateur) : en direct ou non
//   GET  /api/invite/:jeton/radio/ecoute    le flux audio
//   POST /api/invite/:jeton/entrer          { nom, mode } : passage noté au fil de la séance
//   POST /api/invite/:jeton/visio           { nom } : jeton Daily, sans micro ni caméra (avec, pour un intervenant)
import crypto from "crypto";
import type { Express, Request } from "express";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { config } from "../config";
import { exigerConnexion, moi, verifierTentatives, noterEchec } from "../auth";
import { route, valider, idParam, ErreurHttp, introuvable, interdit } from "../http";
import { enseigneCours, seanceVisible } from "../acces";
import { remettreFichier } from "../fichiers";
import * as visio from "../visio";
import { etatRadioSeance, ecouteRadioInvite } from "../visio-campus";
import { seances, cours, utilisateurs, fichiers, sousTitres, evenementsSeances, estProjectionCopie, type Seance, type InfoInviteDto, type LienInviteDto, type AccesDaily } from "@shared/schema";

const MINUTE = 60_000;
/** Le lien marche encore 30 minutes après la fin prévue (débordement, retardataires). */
const MARGE_APRES_FIN_MS = 30 * MINUTE;
/** La vidéo ouvre 30 minutes avant le début, comme pour les étudiants. */
const OUVERTURE_VIDEO_MS = 30 * MINUTE;

// En hexadécimal : ni « _ » ni « - » que WhatsApp mettrait en forme ou couperait.
const signature = (seanceId: number, intervenant = false) =>
  crypto
    .createHmac("sha256", config.sessionSecret)
    .update(`${intervenant ? "intervenant" : "invite"}-seance:${seanceId}`)
    .digest("hex")
    .slice(0, 24);
export const jetonInvite = (seanceId: number) => `${seanceId}-${signature(seanceId)}`;
/** Lien intervenant (micro et caméra) : même forme que le lien invité, autre signature. */
export const jetonIntervenant = (seanceId: number) => `${seanceId}-${signature(seanceId, true)}`;

/** La séance d'un jeton bien signé (et s'il s'agit d'un lien intervenant), sinon null. */
function lireJeton(jeton: string): { id: number; intervenant: boolean } | null {
  const m = /^(\d{1,9})-([0-9a-f]{24})$/.exec(jeton);
  if (!m) return null;
  const id = Number(m[1]);
  const recu = Buffer.from(m[2]);
  for (const intervenant of [false, true]) {
    const attendu = Buffer.from(signature(id, intervenant));
    if (recu.length === attendu.length && crypto.timingSafeEqual(recu, attendu)) return { id, intervenant };
  }
  return null;
}

const finPrevue = (s: Pick<Seance, "debut" | "dureeMinutes">) => new Date(s.debut.getTime() + s.dureeMinutes * MINUTE);
const lienValide = (s: Seance) => s.statut !== "annulee" && (s.statut === "en_direct" || Date.now() <= finPrevue(s).getTime() + MARGE_APRES_FIN_MS);

async function seanceDuJeton(req: Request): Promise<{ s: Seance; jeton: string; intervenant: boolean }> {
  const jeton = String(req.params.jeton ?? "");
  const lu = lireJeton(jeton);
  const [s] = lu ? await db.select().from(seances).where(eq(seances.id, lu.id)) : [];
  if (!s || !lu) throw introuvable("Lien");
  return { s, jeton, intervenant: lu.intervenant };
}

function exigerValide(s: Seance) {
  if (s.statut === "annulee") throw new ErreurHttp(410, "Ce cours a été annulé.");
  if (!lienValide(s)) throw new ErreurHttp(410, "Ce cours est terminé : le lien ne marche plus.");
}

/**
 * Un invité interroge la séance toutes les 2 secondes : réponse gardée 1 s par séance ET par sorte de lien
 * (les adresses des diapos portent le jeton : celui d'un intervenant ne doit jamais parvenir à un invité).
 */
const cacheInfos = new Map<string, { exp: number; info: InfoInviteDto }>();

async function infoInvite(s: Seance, jeton: string, intervenant: boolean): Promise<InfoInviteDto> {
  const cle = `${s.id}:${intervenant ? "i" : "v"}`;
  const garde = cacheInfos.get(cle);
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
    intervenant,
    // Une copie d'étudiant projetée reste réservée à la classe : l'invité lit seulement qu'elle est montrée.
    copieMontree: estProjectionCopie(s.projection) && s.statut === "en_direct" && !s.planBLe,
  };
  if (cacheInfos.size > 2000) cacheInfos.clear();
  cacheInfos.set(cle, { exp: Date.now() + 1000, info });
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
      // L'écran d'une salle qui voit la séance peut aussi l'afficher (QR code à scanner dans la salle).
      const permis =
        u.role === "admin" ||
        u.role === "vie_scolaire" ||
        (u.role === "formateur" && (await enseigneCours(u, s.coursId))) ||
        (u.role === "salle" && (await seanceVisible(u, s.id).then(() => true, () => false)));
      if (!permis) throw interdit("Le lien invité est réservé au formateur du cours, aux salles et à l'équipe.");
      const lien: LienInviteDto = {
        url: `${config.urlCampus}/invite/${jetonInvite(s.id)}`,
        valableJusquau: new Date(finPrevue(s).getTime() + MARGE_APRES_FIN_MS).toISOString(),
        // Micro et caméra : jamais remis à l'écran d'une salle (il s'affiche en QR code devant les étudiants).
        ...(u.role !== "salle" ? { urlIntervenant: `${config.urlCampus}/invite/${jetonIntervenant(s.id)}` } : {}),
      };
      res.json(lien);
    }),
  );

  app.get(
    "/api/invite/:jeton",
    route(async (req, res) => {
      const { s, jeton, intervenant } = await seanceDuJeton(req);
      res.setHeader("Cache-Control", "no-store");
      res.json(await infoInvite(s, jeton, intervenant));
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
      const { s, intervenant } = await seanceDuJeton(req);
      exigerValide(s);
      const { nom, mode } = valider(z.object({ nom: NOM, mode: z.enum(["radio", "video"]) }), req.body);
      const cle = `${s.id}|${req.ip}|${nom.toLowerCase()}|${intervenant ? "i" : "v"}`;
      if (!passages.has(cle)) {
        if (passages.size > 20_000) passages.clear();
        passages.add(cle);
        await db.insert(evenementsSeances).values({ seanceId: s.id, type: "invite", donnees: { nom, mode, ...(intervenant ? { intervenant: true } : {}) } });
      }
      res.json({ ok: true });
    }),
  );

  app.post(
    "/api/invite/:jeton/visio",
    route(async (req, res) => {
      const { s, intervenant } = await seanceDuJeton(req);
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
      // Un intervenant a toujours sa place, même quand celles des étudiants sont prises.
      await visio.reserverPlaceDaily({ salle: salle.nom, profil: "etudiant", utilisateurId: idInvite, prioritaire: intervenant });
      const nomAffiche = `${nom} · ${intervenant ? "intervenant" : "invité"}`;
      const jeton = await visio.jetonDaily({
        salle: salle.nom,
        nomAffiche,
        utilisateurId: idInvite,
        profil: "etudiant",
        exp: visio.expirationJetonSeance(s),
        envoi: intervenant ? ["video", "audio"] : false,
        cameraAuDepart: intervenant,
      });
      const acces: AccesDaily = { url: salle.url, jeton, nomAffiche, profil: "etudiant" };
      res.json(acces);
    }),
  );
}
