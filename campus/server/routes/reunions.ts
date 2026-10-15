// Salle de réunion de l'administration (demande de José du 13 octobre 2026, réglages dans CONCEPTION.md §11) :
// un lien permanent, à partager à tous les participants de la réunion, qui marche sans compte et à tout moment.
//
//   Pilotage (direction, et équipe avec le droit « outils_campus », celui des écrans et de la visio) :
//   GET    /api/pilotage/reunions                  les salles, leur lien, leur message WhatsApp, qui est dedans
//   POST   /api/pilotage/reunions/:id/etat         { ouverte } : ouvrir, ou fermer (personne n'entre plus, les présents sortent)
//   POST   /api/pilotage/reunions/:id/nouveau-lien  un nouveau lien ; l'ancien ne marche plus, les présents sortent
//   POST   /api/pilotage/reunions                  { nom } : une autre salle (direction seule, 5 salles au plus)
//   DELETE /api/pilotage/reunions/:id              retirer une autre salle (direction seule ; jamais la principale)
//
//   Lien public (sans compte ; le compte de campus passe aussi : campus-filtre.ts) :
//   GET    /api/reunion/:jeton                     { etat: "ouverte", nom, personnel } ou { etat: "fermee" } (rien d'autre)
//   POST   /api/reunion/:jeton/entrer              { nom } : jeton Daily (micro, caméra, partage d'écran), jamais si fermée
//
// Réglages : contenus_site, une ligne par salle (« pilotage.reunion.<id> » : nom, jeton, ouverte, numéro de série),
// comme les autres réglages du pilotage (« pilotage.ouverture-auto ») : pas de migration ; le site public ne lit que sa
// liste blanche de clés (routes/public.ts). Le jeton : 32 caractères hexadécimaux tirés au hasard (128 bits).
// La salle Daily (« reunion-2iae-<id>-<série> », visio.ts) est distincte des salles de cours ; son numéro de série
// change à chaque fermeture et à chaque nouveau lien : un ancien jeton Daily n'entre jamais dans la nouvelle salle.
// Journal : reunion_ouverte, reunion_fermee, reunion_nouveau_lien, reunion_entree, reunion_creee, reunion_supprimee
// (jamais le jeton ni le lien).
import crypto from "crypto";
import type { Express, Request } from "express";
import { z } from "zod";
import { eq, inArray, like } from "drizzle-orm";
import { db, pool } from "../db";
import { config } from "../config";
import { exigerDroit, exigerRole, moi, peut } from "../auth";
import { route, valider, ErreurHttp } from "../http";
import * as visio from "../visio";
import { t } from "@shared/textes/reunion";
import {
  FORMAT_JETON_REUNION,
  ID_REUNION_PRINCIPALE,
  NOM_REUNION_MAX,
  NOM_REUNION_PRINCIPALE,
  PREFIXE_CLE_REUNION,
  REUNIONS_MAX,
  type PresentReunionDto,
  type ReunionDto,
  type ReunionPubliqueDto,
  type ReunionsDto,
} from "@shared/reunion";
import { contenusSite, journal, utilisateurs, estProfilCampus, type AccesDaily, type Utilisateur } from "@shared/schema";

const MINUTE = 60_000;
/** Un jeton Daily sert à entrer pendant 2 h (la page en redemande un tout seul s'il a expiré). */
const VALIDITE_JETON_S = 2 * 3600;
/** Une personne restée dans la réunion sort d'elle-même au bout de 5 h : un onglet oublié ne coûte pas une nuit. */
const SORTIE_AUTO_S = 5 * 3600;

// ── Réglages d'une salle (contenus_site) ────────────────────────────────────

const schemaValeur = z.object({
  nom: z.string().min(1).max(NOM_REUNION_MAX),
  principale: z.boolean().default(false),
  ouverte: z.boolean(),
  jeton: z.string().regex(FORMAT_JETON_REUNION),
  serie: z.number().int().min(0),
  creeLe: z.string(),
});
type Valeur = z.infer<typeof schemaValeur>;
type Reunion = Valeur & { id: string; majLe: Date; majParId: number | null };

const nouveauJeton = () => crypto.randomBytes(16).toString("hex");
const cleDe = (id: string) => `${PREFIXE_CLE_REUNION}${id}`;
const lienDe = (r: Pick<Reunion, "jeton">) => `${config.urlCampus}/reunion/${r.jeton}`;
const salleDailyDe = (r: Pick<Reunion, "id" | "serie">) => visio.nomSalleReunion(r.id, r.serie);
/** Identifiant de salle reçu dans l'adresse : « administration » ou 8 caractères hexadécimaux. */
const ID_VALIDE = /^[a-z0-9]{1,20}$/;

function versReunion(l: { cle: string; valeur: unknown; majLe: Date; majParId: number | null }): Reunion | null {
  if (!l.cle.startsWith(PREFIXE_CLE_REUNION)) return null;
  const v = schemaValeur.safeParse(l.valeur);
  if (!v.success) return null;
  return { ...v.data, id: l.cle.slice(PREFIXE_CLE_REUNION.length), majLe: l.majLe, majParId: l.majParId };
}

/** Toutes les salles, la principale d'abord, puis dans l'ordre de création. Lu en base à chaque fois (table minuscule). */
async function lireReunions(): Promise<Reunion[]> {
  const lignes = await db
    .select({ cle: contenusSite.cle, valeur: contenusSite.valeur, majLe: contenusSite.majLe, majParId: contenusSite.majParId })
    .from(contenusSite)
    .where(like(contenusSite.cle, `${PREFIXE_CLE_REUNION}%`));
  return lignes
    .map(versReunion)
    .filter((r): r is Reunion => r !== null)
    .sort((a, b) => Number(b.principale) - Number(a.principale) || a.creeLe.localeCompare(b.creeLe));
}

/** La salle principale existe dès la première visite de la page (ouverte : « à tout moment ils peuvent entrer »). */
async function assurerPrincipale(): Promise<void> {
  const valeur: Valeur = { nom: NOM_REUNION_PRINCIPALE, principale: true, ouverte: true, jeton: nouveauJeton(), serie: 0, creeLe: new Date().toISOString() };
  await db.insert(contenusSite).values({ cle: cleDe(ID_REUNION_PRINCIPALE), valeur }).onConflictDoNothing();
}

async function reunionParId(id: string): Promise<Reunion> {
  if (!ID_VALIDE.test(id)) throw new ErreurHttp(404, t("serveur.introuvable"));
  const [l] = await db
    .select({ cle: contenusSite.cle, valeur: contenusSite.valeur, majLe: contenusSite.majLe, majParId: contenusSite.majParId })
    .from(contenusSite)
    .where(eq(contenusSite.cle, cleDe(id)));
  const r = l ? versReunion(l) : null;
  if (!r) throw new ErreurHttp(404, t("serveur.introuvable"));
  return r;
}

/**
 * Change une salle d'un coup, en base (deux gestes au même instant ne s'effacent pas) : `quand` est la condition SQL
 * sur l'état actuel (fermer une salle déjà fermée ne fait rien), `serieSuivante` passe au numéro suivant. Renvoie la
 * salle d'AVANT et celle d'APRÈS, ou null si rien n'a changé.
 */
async function changer(
  id: string,
  maj: { ouverte?: boolean; jeton?: string; serieSuivante?: boolean },
  parId: number,
  quand: "toujours" | "ouverte" | "fermee" = "toujours",
): Promise<{ avant: Reunion; apres: Reunion } | null> {
  const avant = await reunionParId(id);
  const champs: Record<string, unknown> = {};
  if (maj.ouverte !== undefined) champs.ouverte = maj.ouverte;
  if (maj.jeton !== undefined) champs.jeton = maj.jeton;
  const condition = quand === "ouverte" ? "AND (valeur->>'ouverte')::boolean = true" : quand === "fermee" ? "AND (valeur->>'ouverte')::boolean = false" : "";
  const r = await pool.query<{ valeur: unknown; maj_le: Date; maj_par_id: number | null }>(
    `UPDATE campus.contenus_site
        SET valeur = valeur || $2::jsonb || (CASE WHEN $3::boolean THEN jsonb_build_object('serie', COALESCE((valeur->>'serie')::int, 0) + 1) ELSE '{}'::jsonb END),
            maj_le = now(), maj_par_id = $4
      WHERE cle = $1 ${condition}
      RETURNING valeur, maj_le, maj_par_id`,
    [cleDe(id), JSON.stringify(champs), Boolean(maj.serieSuivante), parId],
  );
  const l = r.rows[0];
  if (!l) return null;
  const apres = versReunion({ cle: cleDe(id), valeur: l.valeur, majLe: l.maj_le, majParId: l.maj_par_id });
  if (!apres) return null;
  // La salle Daily à vider est celle du numéro d'avant la mise à jour (le numéro est changé en base, d'un coup).
  return { avant: { ...avant, serie: maj.serieSuivante ? apres.serie - 1 : apres.serie }, apres };
}

// ── Présence (lue chez Daily, 5 s de cache par salle) ──────────────────────

const cachePresence = new Map<string, { exp: number; presents: PresentReunionDto[]; lue: boolean }>();
async function presenceDe(r: Reunion): Promise<{ presents: PresentReunionDto[]; lue: boolean }> {
  if (!r.ouverte || !visio.dailyDisponible()) return { presents: [], lue: visio.dailyDisponible() };
  const nom = salleDailyDe(r);
  const c = cachePresence.get(nom);
  if (c && c.exp > Date.now()) return c;
  let valeur: { presents: PresentReunionDto[]; lue: boolean };
  try {
    const p = await visio.presenceSalle(nom);
    valeur = { presents: p.presents, lue: p.disponible };
  } catch {
    valeur = { presents: [], lue: false };
  }
  if (cachePresence.size > 200) cachePresence.clear();
  cachePresence.set(nom, { exp: Date.now() + 5000, ...valeur });
  return valeur;
}

async function versDto(liste: Reunion[], u: Utilisateur): Promise<ReunionsDto> {
  const ids = [...new Set(liste.map((r) => r.majParId).filter((x): x is number => x !== null))];
  const noms = new Map(
    ids.length ? (await db.select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom }).from(utilisateurs).where(inArray(utilisateurs.id, ids))).map((p) => [p.id, `${p.prenom} ${p.nom}`.trim()]) : [],
  );
  const reunions: ReunionDto[] = await Promise.all(
    liste.map(async (r) => {
      const lien = lienDe(r);
      const message = t("message", { v: { nom: r.nom, lien } });
      const p = await presenceDe(r);
      return {
        id: r.id,
        nom: r.nom,
        principale: r.principale,
        ouverte: r.ouverte,
        lien,
        message,
        whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`,
        // Une salle jamais touchée depuis sa création n'a pas d'auteur à montrer.
        majLe: r.majParId !== null ? r.majLe.toISOString() : null,
        majPar: r.majParId !== null ? (noms.get(r.majParId) ?? null) : null,
        presents: p.presents,
        presenceLue: p.lue,
      };
    }),
  );
  return { reunions, daily: visio.dailyDisponible(), peutGerer: u.role === "admin", max: REUNIONS_MAX };
}

async function reponseEquipe(u: Utilisateur): Promise<ReunionsDto> {
  let liste = await lireReunions();
  if (!liste.some((r) => r.principale)) {
    await assurerPrincipale();
    liste = await lireReunions();
  }
  return versDto(liste, u);
}

/**
 * Vide la salle Daily d'une réunion fermée, retirée ou dont le lien change, puis le note au journal (avec le nombre de
 * personnes sorties). La réponse à la direction n'attend pas plus de 4 s : Daily lent, la sortie se termine en arrière-plan
 * (la réunion est déjà fermée en base, aucun jeton n'est plus remis).
 */
async function viderSalle(nomSalle: string, u: Utilisateur, action: string, details: Record<string, unknown>): Promise<void> {
  const travail = visio
    .fermerSalleReunion(nomSalle)
    .then(async ({ sortis }) => {
      cachePresence.clear();
      await db.insert(journal).values({ utilisateurId: u.id, action, details: { ...details, sortis } });
    })
    .catch((e) => console.warn(`[reunion] ${action} : ${(e as Error).message}`));
  await Promise.race([travail, new Promise((ok) => setTimeout(ok, 4000))]);
}

// ── Limites de demandes (anti-abus du lien public) ─────────────────────────

/** Au plus `max` demandes par `fenetre` et par clé (compteur en mémoire). Renvoie faux quand la limite est dépassée. */
function limiteur(max: number, fenetre: number) {
  const compteurs = new Map<string, { n: number; jusqua: number }>();
  return {
    compter(cle: string): boolean {
      const maintenant = Date.now();
      const c = compteurs.get(cle);
      if (!c || c.jusqua < maintenant) {
        if (compteurs.size > 5000) for (const [k, v] of compteurs) if (v.jusqua < maintenant) compteurs.delete(k);
        compteurs.set(cle, { n: 1, jusqua: maintenant + fenetre });
        return true;
      }
      return ++c.n <= max;
    },
    depasse(cle: string): boolean {
      const c = compteurs.get(cle);
      return Boolean(c && c.jusqua >= Date.now() && c.n >= max);
    },
  };
}
/** Lecture de l'état : la page relit toutes les 10 s ; 300 par minute laissent passer tout un bureau derrière une même adresse. */
const lectures = limiteur(300, MINUTE);
/**
 * Mauvais liens : au-delà de 20 par quart d'heure et par adresse, « trop de demandes » au lieu de « ce lien ne marche
 * pas » (un lien de 128 bits ne se devine pas ; le bon lien, lui, marche toujours : un bureau derrière une même adresse
 * n'est pas bloqué par l'onglet resté ouvert sur un ancien lien).
 */
const mauvaisLiens = limiteur(20, 15 * MINUTE);
/** Entrées (chaque jeton Daily) : 30 par quart d'heure et par adresse, 200 par quart d'heure et par salle. */
const entreesParAdresse = limiteur(30, 15 * MINUTE);
const entreesParSalle = limiteur(200, 15 * MINUTE);

const trop = () => new ErreurHttp(429, t("serveur.trop"));
const lienMort = () => new ErreurHttp(404, t("serveur.lienMort"));
const adresse = (req: Request) => String(req.ip ?? "");

/** La salle d'un lien. Mauvais lien (inconnu, ancien, mal formé) : 404, sans dire pourquoi ; trop d'essais : 429. */
async function reunionDuJeton(req: Request): Promise<Reunion> {
  const ip = adresse(req);
  const jeton = String(req.params.jeton ?? "");
  const recu = FORMAT_JETON_REUNION.test(jeton) ? Buffer.from(jeton) : null;
  let trouvee: Reunion | null = null;
  if (recu) {
    // Comparaison à temps constant avec chaque salle (cinq au plus).
    for (const r of await lireReunions()) {
      const attendu = Buffer.from(r.jeton);
      if (attendu.length === recu.length && crypto.timingSafeEqual(attendu, recu)) trouvee = r;
    }
  }
  if (!trouvee) {
    if (mauvaisLiens.depasse(ip)) throw trop();
    mauvaisLiens.compter(ip);
    throw lienMort();
  }
  return trouvee;
}

/** Membre du personnel connecté : il entre sous son nom (le compte de campus, écran partagé des salles, tape un nom). */
function personnel(u: Utilisateur | undefined): u is Utilisateur {
  return Boolean(u && u.actif && (u.role === "admin" || u.role === "formateur" || (u.role === "vie_scolaire" && !estProfilCampus(u))));
}

const NOM = z
  .string({ required_error: t("lien.nom.court"), invalid_type_error: t("lien.nom.court") })
  .transform((s) => s.replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim())
  .pipe(z.string().min(2, t("lien.nom.court")).max(60));

/** Entrées déjà notées au journal (salle, série, adresse, nom) : une page rechargée ne compte pas deux fois. */
const entreesNotees = new Map<string, number>();
async function noterEntree(r: Reunion, nomAffiche: string, utilisateurId: number | null, ip: string) {
  const cle = `${r.id}|${r.serie}|${ip}|${nomAffiche.toLowerCase()}`;
  const deja = entreesNotees.get(cle);
  if (deja && Date.now() - deja < 30 * MINUTE) return;
  if (entreesNotees.size > 5000) entreesNotees.clear();
  entreesNotees.set(cle, Date.now());
  await db.insert(journal).values({ utilisateurId, action: "reunion_entree", details: { reunion: r.id, salle: r.nom, personne: nomAffiche, compte: utilisateurId !== null } });
}

export function enregistrerReunions(app: Express) {
  // ── Pilotage ─────────────────────────────────────────────────────────────
  app.get(
    "/api/pilotage/reunions",
    exigerDroit("outils_campus"),
    route(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await reponseEquipe(moi(req)));
    }),
  );

  app.post(
    "/api/pilotage/reunions/:id/etat",
    exigerDroit("outils_campus"),
    route(async (req, res) => {
      const u = moi(req);
      const { ouverte } = valider(z.object({ ouverte: z.boolean() }), req.body);
      const id = String(req.params.id);
      if (ouverte) {
        const c = await changer(id, { ouverte: true }, u.id, "fermee");
        if (c) await db.insert(journal).values({ utilisateurId: u.id, action: "reunion_ouverte", details: { reunion: id, salle: c.apres.nom } });
      } else {
        // Fermer : plus aucun jeton (état en base), salle Daily suivante (numéro), présents sortis de l'ancienne.
        const c = await changer(id, { ouverte: false, serieSuivante: true }, u.id, "ouverte");
        if (c) await viderSalle(salleDailyDe(c.avant), u, "reunion_fermee", { reunion: id, salle: c.apres.nom });
      }
      res.json(await reponseEquipe(u));
    }),
  );

  app.post(
    "/api/pilotage/reunions/:id/nouveau-lien",
    exigerDroit("outils_campus"),
    route(async (req, res) => {
      const u = moi(req);
      const id = String(req.params.id);
      const c = await changer(id, { jeton: nouveauJeton(), serieSuivante: true }, u.id);
      if (!c) throw new ErreurHttp(404, t("serveur.introuvable"));
      await viderSalle(salleDailyDe(c.avant), u, "reunion_nouveau_lien", { reunion: id, salle: c.apres.nom });
      res.json(await reponseEquipe(u));
    }),
  );

  app.post(
    "/api/pilotage/reunions",
    exigerRole("admin"),
    route(async (req, res) => {
      const u = moi(req);
      const { nom } = valider(z.object({ nom: z.string().trim().min(2, "Indiquez le nom de la salle.").max(NOM_REUNION_MAX) }), req.body);
      await assurerPrincipale();
      if ((await lireReunions()).length >= REUNIONS_MAX) throw new ErreurHttp(409, t("serveur.max", { v: { max: REUNIONS_MAX } }));
      const id = crypto.randomBytes(4).toString("hex");
      const valeur: Valeur = { nom, principale: false, ouverte: true, jeton: nouveauJeton(), serie: 0, creeLe: new Date().toISOString() };
      await db.insert(contenusSite).values({ cle: cleDe(id), valeur, majParId: u.id });
      await db.insert(journal).values({ utilisateurId: u.id, action: "reunion_creee", details: { reunion: id, salle: nom } });
      res.status(201).json(await reponseEquipe(u));
    }),
  );

  app.delete(
    "/api/pilotage/reunions/:id",
    exigerRole("admin"),
    route(async (req, res) => {
      const u = moi(req);
      const r = await reunionParId(String(req.params.id));
      if (r.principale) throw new ErreurHttp(409, t("serveur.principale"));
      const suppr = await db.delete(contenusSite).where(eq(contenusSite.cle, cleDe(r.id))).returning({ cle: contenusSite.cle });
      if (suppr.length) await viderSalle(salleDailyDe(r), u, "reunion_supprimee", { reunion: r.id, salle: r.nom });
      res.json(await reponseEquipe(u));
    }),
  );

  // ── Lien public ──────────────────────────────────────────────────────────
  app.get(
    "/api/reunion/:jeton",
    route(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Robots-Tag", "noindex");
      if (!lectures.compter(adresse(req))) throw trop();
      const r = await reunionDuJeton(req);
      // Fermée : rien d'autre (ni le nom de la réunion, ni qui est dedans).
      if (!r.ouverte) return res.json({ etat: "fermee" } satisfies ReunionPubliqueDto);
      const u = req.utilisateur;
      res.json({ etat: "ouverte", nom: r.nom, personnel: personnel(u) ? { nom: `${u.prenom} ${u.nom}`.trim() } : null } satisfies ReunionPubliqueDto);
    }),
  );

  app.post(
    "/api/reunion/:jeton/entrer",
    route(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const ip = adresse(req);
      if (!entreesParAdresse.compter(ip)) throw trop();
      const r = await reunionDuJeton(req);
      if (!r.ouverte) throw new ErreurHttp(409, t("serveur.fermee"), { code: "reunion_fermee" });
      if (!entreesParSalle.compter(r.id)) throw trop();
      if (!visio.dailyDisponible()) throw new ErreurHttp(503, t("serveur.sansDaily"), { code: "daily_absent" });
      const u = req.utilisateur;
      const membre = personnel(u);
      let nomAffiche: string;
      if (membre) nomAffiche = `${u.prenom} ${u.nom}`.trim();
      else nomAffiche = `${valider(z.object({ nom: NOM }), req.body ?? {}).nom} · invité`;
      // Qui gère la réunion (direction, équipe des écrans et de la visio) en est propriétaire dans la visio :
      // il coupe un micro ou sort quelqu'un. Les autres : micro, caméra et partage d'écran, comme tout le monde.
      const proprietaire = membre && peut(u, "outils_campus");
      const salle = await visio.obtenirSalleReunion(salleDailyDe(r));
      // Un identifiant négatif pour un invité : jamais confondu avec un compte.
      const utilisateurId = membre ? u.id : -crypto.randomInt(1, 2_000_000_000);
      const jeton = await visio.jetonDaily({
        salle: salle.nom,
        nomAffiche,
        utilisateurId,
        profil: proprietaire ? "formateur" : "etudiant",
        exp: Math.floor(Date.now() / 1000) + VALIDITE_JETON_S,
        ejecterApres: SORTIE_AUTO_S,
        // Jamais d'enregistrement : ni lancé, ni permis au propriétaire.
        enregistrementPermis: false,
        envoi: ["video", "audio"],
        partageEcran: true,
        // Caméra ouverte, micro coupé en entrant (on l'ouvre pour parler).
        silencieux: true,
        cameraAuDepart: true,
      });
      await noterEntree(r, nomAffiche, membre ? u.id : null, ip);
      res.json({ url: salle.url, jeton, nomAffiche, profil: proprietaire ? "formateur" : "etudiant" } satisfies AccesDaily);
    }),
  );
}
