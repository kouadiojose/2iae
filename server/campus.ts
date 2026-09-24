// Campus numérique 2IAE — lien entre le site vitrine et le campus.
//
// Le campus (service Railway à part, dossier campus/) publie sa vitrine sur
// GET <campus>/api/public/vitrine : cours annoncés, formateurs, lives publics,
// annonces, chiffres. Le site la lit, la garde en cache et l'expose à ses
// pages :
//
//   GET  /api/campus/vitrine     la vitrine + l'adresse du campus
//   POST /api/campus/rafraichir  webhook signé du campus : « relis la vitrine »
//
// Règle d'or : le site ne tombe JAMAIS avec le campus. Chaque lecture est
// bornée à 5 s ; une lecture ratée conserve la dernière version connue ; sans
// aucune version, la route répond { indisponible: true } et les pages
// affichent leur présentation fixe au lieu d'une erreur.
//
// Variables d'environnement (toutes facultatives) :
//   CAMPUS_URL             adresse publique du campus (https://campus.2iae.com)
//   CAMPUS_INTERNAL_URL    adresse sur le réseau privé Railway, pour la lecture
//   CAMPUS_WEBHOOK_SECRET  secret HMAC partagé avec le campus (sans lui, le
//                          webhook répond 503 et seul le cache de 5 min joue)

import crypto from "crypto";
import type { Express } from "express";
import { z } from "zod";
import type {
  EvenementCampus,
  ReponseVitrineCampus,
  Vitrine,
  VitrineCours,
  VitrineFormateur,
} from "@shared/campus";

/** Délai maximal d'une lecture de la vitrine. */
const DELAI_LECTURE_MS = 5_000;
/** Durée de vie du cache. */
const DUREE_CACHE_MS = 5 * 60_000;
/** Après un échec, on laisse le campus souffler avant de réessayer. */
const PAUSE_APRES_ECHEC_MS = 30_000;
/** Fenêtre d'acceptation de l'horodatage du webhook (anti-rejeu). */
const FENETRE_WEBHOOK_MS = 5 * 60_000;
/** Taille maximale acceptée pour la vitrine (garde-fou). */
const TAILLE_MAX_VITRINE = 2_000_000;

const ADRESSE_PAR_DEFAUT = "https://campus.2iae.com";

function sansSlashFinal(u: string | undefined): string {
  return (u ?? "").trim().replace(/\/+$/, "");
}

/** Adresse publique du campus : liens, images, bouton « Accéder au campus ». */
export function campusUrl(): string {
  return sansSlashFinal(process.env.CAMPUS_URL) || ADRESSE_PAR_DEFAUT;
}

/** Adresse de lecture : le réseau privé Railway s'il est renseigné. */
function adresseLecture(): string {
  return sansSlashFinal(process.env.CAMPUS_INTERNAL_URL) || campusUrl();
}

// ── Validation de la vitrine reçue ───────────────────────────────────────────
// Le campus est une autre application : on ne lui fait pas une confiance
// aveugle. La forme générale est exigée (sinon on garde la version connue),
// mais un élément mal formé est simplement écarté, sans jeter le reste.

/** Champ texte facultatif : absent, null ou vide → null. */
const texteFacultatif = z
  .string()
  .nullish()
  .catch(null)
  .transform((v) => (v && v.trim() ? v : null));

/** Liste tolérante : chaque élément invalide est écarté. */
function liste<T extends z.ZodTypeAny>(schema: T) {
  return z.array(z.unknown()).transform((elements) =>
    elements.flatMap((e) => {
      const r = schema.safeParse(e);
      return r.success ? [r.data as z.output<T>] : [];
    }),
  );
}

const schemaFormateur = z.object({
  slug: z.string(),
  prenom: z.string(),
  nom: z.string(),
  titre: texteFacultatif,
  localisation: texteFacultatif,
  bio: texteFacultatif,
  photoUrl: texteFacultatif,
  annonceLe: texteFacultatif,
  cours: liste(z.object({ code: z.string(), titre: z.string(), slug: z.string() })).catch([]),
  url: z.string().catch(""),
});

const schemaCours = z.object({
  code: z.string(),
  slug: z.string(),
  titre: z.string(),
  accroche: z.string().catch(""),
  imageUrl: texteFacultatif,
  couleur: z.string().catch(""),
  dateDebut: texteFacultatif,
  dateFin: texteFacultatif,
  formateur: schemaFormateur.nullable().catch(null),
  nbCampus: z.number().catch(0),
  url: z.string().catch(""),
});

const schemaLive = z.object({
  id: z.number(),
  titre: z.string(),
  coursCode: z.string(),
  coursTitre: z.string(),
  debut: z.string(),
  dureeMinutes: z.number().catch(90),
  enDirect: z.boolean().catch(false),
  formateur: z
    .object({ prenom: z.string(), nom: z.string(), localisation: texteFacultatif })
    .nullable()
    .catch(null),
  url: z.string().catch(""),
});

const schemaVitrine = z.object({
  campus: z.object({
    nom: z.string().catch("Campus numérique 2IAE"),
    url: z.string().catch(""),
    sites: liste(z.object({ nom: z.string(), salle: z.string().catch("") })).catch([]),
  }),
  cours: liste(schemaCours),
  formateurs: liste(schemaFormateur),
  lives: liste(schemaLive),
  annonces: liste(
    z.object({ id: z.number(), titre: z.string(), corps: z.string().catch(""), publieeLe: z.string() }),
  ).catch([]),
  chiffres: z
    .object({
      etudiants: z.number().catch(0),
      formateurs: z.number().catch(0),
      cours: z.number().catch(0),
      heuresDeDirect: z.number().catch(0),
    })
    .catch({ etudiants: 0, formateurs: 0, cours: 0, heuresDeDirect: 0 }),
  genereLe: z.string().catch(() => new Date().toISOString()),
});

type VitrineBrute = z.output<typeof schemaVitrine>;

// ── Normalisation ───────────────────────────────────────────────────────────

const MOTIF_SLUG = /^[a-z0-9][a-z0-9-]{0,150}$/;
const MOTIF_COULEUR = /^#[0-9a-fA-F]{3,8}$/;

/**
 * Rend une adresse du campus utilisable par un visiteur du site : les chemins
 * relatifs sont rattachés à l'adresse publique, l'adresse privée Railway est
 * remplacée par la publique, et tout ce qui n'est pas http(s) est refusé
 * (pas de « javascript: » dans un lien du site).
 */
function adresseVisiteur(u: string | null | undefined): string | null {
  if (!u) return null;
  const brute = u.trim();
  const interne = sansSlashFinal(process.env.CAMPUS_INTERNAL_URL);
  if (interne && brute.startsWith(interne)) return campusUrl() + brute.slice(interne.length);
  if (brute.startsWith("/") && !brute.startsWith("//")) return campusUrl() + brute;
  return /^https?:\/\//i.test(brute) ? brute : null;
}

function dateValide(d: string | null): string | null {
  return d && Number.isFinite(Date.parse(d)) ? d : null;
}

function normaliserFormateur(f: VitrineBrute["formateurs"][number]): VitrineFormateur | null {
  if (!MOTIF_SLUG.test(f.slug)) return null;
  return {
    ...f,
    photoUrl: adresseVisiteur(f.photoUrl),
    annonceLe: dateValide(f.annonceLe),
    cours: f.cours.filter((c) => MOTIF_SLUG.test(c.slug)),
    url: adresseVisiteur(f.url) ?? campusUrl(),
  };
}

function normaliser(v: VitrineBrute): Vitrine {
  const cours: VitrineCours[] = v.cours
    .filter((c) => MOTIF_SLUG.test(c.slug))
    .map((c) => ({
      ...c,
      imageUrl: adresseVisiteur(c.imageUrl),
      couleur: MOTIF_COULEUR.test(c.couleur) ? c.couleur : "#E8720C",
      dateDebut: dateValide(c.dateDebut),
      dateFin: dateValide(c.dateFin),
      formateur: c.formateur ? normaliserFormateur(c.formateur) : null,
      nbCampus: Math.max(0, Math.round(c.nbCampus)),
      url: adresseVisiteur(c.url) ?? campusUrl(),
    }))
    // Les cours qui commencent le plus tôt d'abord ; sans date, à la fin.
    .sort((a, b) => (Date.parse(a.dateDebut ?? "") || Infinity) - (Date.parse(b.dateDebut ?? "") || Infinity));

  return {
    campus: {
      nom: v.campus.nom,
      url: adresseVisiteur(v.campus.url) ?? campusUrl(),
      sites: v.campus.sites,
    },
    cours,
    formateurs: v.formateurs.map(normaliserFormateur).filter((f): f is VitrineFormateur => f !== null),
    lives: v.lives
      .filter((l) => dateValide(l.debut))
      .map((l) => ({ ...l, dureeMinutes: Math.max(1, Math.round(l.dureeMinutes)), url: adresseVisiteur(l.url) ?? campusUrl() }))
      .sort((a, b) => Date.parse(a.debut) - Date.parse(b.debut)),
    annonces: v.annonces.filter((a) => dateValide(a.publieeLe)),
    chiffres: v.chiffres,
    genereLe: v.genereLe,
  };
}

// ── Cache ────────────────────────────────────────────────────────────────────

const etat: {
  vitrine: Vitrine | null;
  /** Dernière lecture réussie (ms). */
  luLe: number;
  /** Dernier échec (ms), 0 si la dernière tentative a réussi. */
  echecLe: number;
  erreur: string | null;
  enCours: Promise<void> | null;
} = { vitrine: null, luLe: 0, echecLe: 0, erreur: null, enCours: null };

async function recuperer(): Promise<void> {
  try {
    const r = await fetch(`${adresseLecture()}/api/public/vitrine`, {
      headers: { Accept: "application/json", "User-Agent": "site-2iae/1.0 (+https://www.2iae.com)" },
      signal: AbortSignal.timeout(DELAI_LECTURE_MS),
    });
    if (!r.ok) throw new Error(`le campus répond ${r.status}`);
    const texte = await r.text();
    if (texte.length > TAILLE_MAX_VITRINE) throw new Error("vitrine trop volumineuse");
    let json: unknown;
    try {
      json = JSON.parse(texte);
    } catch {
      throw new Error("la réponse n'est pas du JSON (page d'erreur ou de maintenance ?)");
    }
    const lu = schemaVitrine.safeParse(json);
    if (!lu.success) {
      const probleme = lu.error.issues[0];
      throw new Error(`vitrine illisible (${probleme?.path.join(".") || "racine"} : ${probleme?.message})`);
    }
    etat.vitrine = normaliser(lu.data);
    etat.luLe = Date.now();
    etat.echecLe = 0;
    if (etat.erreur) console.log("🎓 Campus numérique : vitrine de nouveau à jour.");
    etat.erreur = null;
  } catch (err) {
    const e = err as Error & { cause?: { code?: string; message?: string } };
    const message =
      e.name === "TimeoutError" || e.name === "AbortError"
        ? `pas de réponse en ${DELAI_LECTURE_MS / 1000} s`
        : e.cause
          ? `connexion impossible : ${e.cause.code ?? e.cause.message ?? e.message}`
          : e.message;
    etat.echecLe = Date.now();
    // Un seul avertissement par panne : pas de journal inondé toutes les 30 s.
    if (message !== etat.erreur) {
      console.warn(
        `⚠️  Campus numérique injoignable (${message}) — ${
          etat.vitrine ? "dernière version connue conservée" : "aucune version connue, présentation fixe"
        }.`,
      );
    }
    etat.erreur = message;
  }
}

/** Lance une lecture, ou rejoint celle qui est déjà en cours. */
function lancerLecture(): Promise<void> {
  if (!etat.enCours) {
    etat.enCours = recuperer().finally(() => {
      etat.enCours = null;
    });
  }
  return etat.enCours;
}

/**
 * La vitrine à servir. Périmée, elle est relue en arrière-plan et la version
 * connue est servie aussitôt ; on n'attend le campus (5 s au plus) que si
 * aucune version n'est connue. Ne lève jamais d'erreur.
 */
export async function lireVitrine(): Promise<Vitrine | null> {
  const maintenant = Date.now();
  const perimee = !etat.vitrine || maintenant - etat.luLe >= DUREE_CACHE_MS;
  const enPause = etat.echecLe > 0 && maintenant - etat.echecLe < PAUSE_APRES_ECHEC_MS;
  if (perimee && !enPause) {
    const lecture = lancerLecture();
    if (!etat.vitrine) await lecture;
  }
  return etat.vitrine;
}

/** Relecture immédiate (webhook) : attend une éventuelle lecture partie avant la modification. */
async function relireMaintenant(): Promise<void> {
  if (etat.enCours) await etat.enCours;
  await lancerLecture();
}

/** Cours annoncé par son slug (pages et référencement). */
export async function coursParSlug(slug: string): Promise<VitrineCours | null> {
  const v = await lireVitrine();
  return v?.cours.find((c) => c.slug === slug) ?? null;
}

/** Formateur annoncé par son slug (le formateur d'un cours compte aussi). */
export async function formateurParSlug(slug: string): Promise<VitrineFormateur | null> {
  const v = await lireVitrine();
  if (!v) return null;
  return (
    v.formateurs.find((f) => f.slug === slug) ??
    v.cours.map((c) => c.formateur).find((f): f is VitrineFormateur => f?.slug === slug) ??
    null
  );
}

// ── Webhook ──────────────────────────────────────────────────────────────────

/** Compare la signature reçue (« sha256=<hex> ») à celle du corps brut, à temps constant. */
function signatureValide(corps: Buffer, entete: string | undefined, secret: string): boolean {
  const m = /^sha256=([0-9a-f]{64})$/i.exec((entete ?? "").trim());
  if (!m) return false;
  const attendue = crypto.createHmac("sha256", secret).update(corps).digest();
  const recue = Buffer.from(m[1], "hex");
  return recue.length === attendue.length && crypto.timingSafeEqual(recue, attendue);
}

const schemaEvenement = z.object({
  evenement: z.string().min(1).max(100),
  raison: z.string().max(500).optional(),
  horodatage: z.string().min(1).max(40),
});

/** Signatures déjà reçues dans la fenêtre : un message n'est accepté qu'une fois. */
const signaturesVues = new Map<string, number>();

// ── Routes ───────────────────────────────────────────────────────────────────

export function enregistrerCampus(app: Express): void {
  app.get("/api/campus/vitrine", async (_req, res) => {
    const vitrine = await lireVitrine();
    const maintenant = new Date().toISOString();
    // Court cache navigateur : le webhook doit se voir en moins d'une minute.
    res.setHeader("Cache-Control", "public, max-age=30");
    const reponse: ReponseVitrineCampus = vitrine
      ? {
          ...vitrine,
          campusUrl: campusUrl(),
          aJour: etat.erreur === null,
          luLe: new Date(etat.luLe).toISOString(),
          maintenant,
        }
      : { indisponible: true, campusUrl: campusUrl(), maintenant };
    res.json(reponse);
  });

  // Le corps arrive BRUT (Buffer) : server/index.ts pose express.raw sur ce
  // chemin avant le parseur JSON global, car la signature porte sur les
  // octets exacts envoyés par le campus.
  app.post("/api/campus/rafraichir", async (req, res) => {
    const secret = process.env.CAMPUS_WEBHOOK_SECRET;
    if (!secret) {
      return res.status(503).json({ message: "Le lien avec le campus n'est pas configuré sur ce site." });
    }

    const corps: unknown = req.body;
    if (!Buffer.isBuffer(corps) || corps.length === 0) {
      return res.status(400).json({ message: "Message vide." });
    }

    const entete = req.header("x-campus-signature");
    if (!signatureValide(corps, entete, secret)) {
      console.warn("⚠️  Webhook du campus refusé : signature invalide.");
      return res.status(401).json({ message: "Signature invalide." });
    }

    let evenement: EvenementCampus;
    try {
      evenement = schemaEvenement.parse(JSON.parse(corps.toString("utf8")));
    } catch {
      return res.status(400).json({ message: "Message du campus illisible." });
    }

    // Anti-rejeu : un message signé ne vaut que 5 minutes…
    const horodatage = Date.parse(evenement.horodatage);
    const maintenant = Date.now();
    if (!Number.isFinite(horodatage) || Math.abs(maintenant - horodatage) > FENETRE_WEBHOOK_MS) {
      console.warn("⚠️  Webhook du campus refusé : horodatage hors délai.");
      return res.status(401).json({ message: "Message trop ancien ou mal daté." });
    }
    // … et une seule fois dans ces 5 minutes.
    signaturesVues.forEach((expire, sig) => {
      if (expire < maintenant) signaturesVues.delete(sig);
    });
    const empreinte = (entete ?? "").trim().toLowerCase();
    if (signaturesVues.has(empreinte)) {
      return res.status(409).json({ message: "Message déjà reçu." });
    }
    signaturesVues.set(empreinte, horodatage + FENETRE_WEBHOOK_MS);

    await relireMaintenant();
    console.log(
      `🎓 Campus numérique : vitrine relue (${evenement.evenement}${evenement.raison ? ` — ${evenement.raison}` : ""})${
        etat.erreur ? ` — échec : ${etat.erreur}` : ""
      }.`,
    );
    res.json({ ok: true, aJour: etat.erreur === null, genereLe: etat.vitrine?.genereLe ?? null });
  });

  // Première lecture peu après le démarrage : la vitrine est prête pour le
  // premier visiteur, sans retarder le démarrage lui-même.
  setTimeout(() => void lireVitrine(), 2_000).unref();
}
