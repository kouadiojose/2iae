// Agenda : « ma semaine en liste » (lives, échéances de devoirs, événements
// de la vie scolaire), événements ciblés gérés par l'équipe, abonnement
// personnel au format iCalendar (.ics) et « Ajouter à mon agenda » pour une
// séance. Les alarmes de l'agenda du téléphone sonnent même sans réseau :
// c'est le rappel le plus fiable qu'on puisse offrir.
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { and, asc, eq, gte, inArray, lt, lte, or, isNull, sql, isNotNull } from "drizzle-orm";
import { db } from "../db";
import { config, estProduction } from "../config";
import { exigerConnexion, exigerRole, moi, estEquipe, perimetreSites, jetonAleatoire, oublierUtilisateur } from "../auth";
import { route, valider, idParam, introuvable, invalide } from "../http";
import { idsCoursAccessibles, seanceVisible } from "../acces";
import { notifier } from "../notifications";
import { publier, publierUtilisateur } from "../temps-reel";
import {
  conditionCiblesPour,
  coursDesSites,
  verifierCible,
  cibleDansPerimetre,
  destinatairesCible,
  canalCible,
  schemaCible,
  type CibleStockee,
} from "./annonces";
import {
  seances,
  devoirs,
  rendus,
  tentativesQuiz,
  evenements,
  cours,
  utilisateurs,
  journal,
  type Utilisateur,
  type ElementAgenda,
  type Agenda,
  type Evenement,
} from "@shared/schema";

const JOUR_MS = 86_400_000;

// ── Dates (Abidjan = GMT toute l'année : l'heure d'Abidjan est l'heure UTC) ─

/** Lundi 00 h 00 (Abidjan) de la semaine qui contient cette date. */
export function debutSemaine(d: Date): Date {
  const jour = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  return new Date(jour.getTime() - ((jour.getUTCDay() + 6) % 7) * JOUR_MS);
}

/** Numéro de semaine ISO 8601 (« Semaine 40 »). */
export function numeroSemaine(d: Date): number {
  const jeudi = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  jeudi.setUTCDate(jeudi.getUTCDate() + 3 - ((jeudi.getUTCDay() + 6) % 7));
  const premierJeudi = new Date(Date.UTC(jeudi.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((jeudi.getTime() - premierJeudi.getTime()) / JOUR_MS - 3 + ((premierJeudi.getUTCDay() + 6) % 7)) / 7);
}

const formatJour = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Abidjan" });
const formatHeure = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Abidjan" });
export const jourFr = (d: Date) => formatJour.format(d);
export const heureFr = (d: Date) => formatHeure.format(d).replace(":", "h");

/** Adresse publique du campus pour les liens (production : configurée ; développement : l'hôte appelé). */
export function urlPublique(req: Request): string {
  return estProduction ? config.urlCampus : `${req.protocol}://${req.get("host")}`;
}

// ── Contenu de l'agenda d'une personne ─────────────────────────────────────

/** Cours dont la personne voit les séances et les échéances. */
async function coursDeLAgenda(u: Utilisateur): Promise<number[]> {
  if (u.role === "vie_scolaire") {
    const perimetre = perimetreSites(u);
    if (perimetre) return coursDesSites(perimetre);
  }
  return idsCoursAccessibles(u);
}

/** Lives, échéances et événements de la personne entre deux dates, dans l'ordre. */
export async function elementsAgenda(u: Utilisateur, debut: Date, fin: Date): Promise<ElementAgenda[]> {
  const maintenant = new Date();
  const coursIds = await coursDeLAgenda(u);
  const estEtudiant = u.role === "etudiant";
  const elements: ElementAgenda[] = [];

  if (coursIds.length) {
    const lives = await db
      .select({ s: seances, code: cours.code, couleur: cours.couleur })
      .from(seances)
      .innerJoin(cours, eq(cours.id, seances.coursId))
      .where(and(inArray(seances.coursId, coursIds), gte(seances.debut, debut), lt(seances.debut, fin)))
      .orderBy(asc(seances.debut));
    for (const { s, code, couleur } of lives) {
      elements.push({
        cle: `seance-${s.id}`,
        id: s.id,
        type: "live",
        titre: s.titre,
        debut: s.debut.toISOString(),
        fin: new Date(s.debut.getTime() + s.dureeMinutes * 60_000).toISOString(),
        coursId: s.coursId,
        coursCode: code,
        couleur,
        lieu: null,
        // Séance terminée : la page du replay (fiche de révision, transcription, vidéo s'il y en a une).
        lien: s.statut === "terminee" ? `/replays/${s.id}` : `/live/${s.id}`,
        description: s.description,
        statut: s.statut,
        motifAnnulation: s.motifAnnulation,
        cible: null,
        siteId: null,
        classeId: null,
        modifiable: false,
      });
    }

    const conditionsDevoirs = [inArray(devoirs.coursId, coursIds), gte(devoirs.dateLimite, debut), lt(devoirs.dateLimite, fin)];
    if (u.role !== "formateur") conditionsDevoirs.push(eq(devoirs.publie, true));
    // Un devoir à ouverture différée (interrogation surprise) reste caché aux étudiants jusqu'à son ouverture.
    if (u.role === "etudiant") conditionsDevoirs.push(or(isNull(devoirs.ouvertureLe), lte(devoirs.ouvertureLe, new Date()))!);
    const echeances = await db
      .select({ d: devoirs, code: cours.code, couleur: cours.couleur })
      .from(devoirs)
      .innerJoin(cours, eq(cours.id, devoirs.coursId))
      .where(and(...conditionsDevoirs))
      .orderBy(asc(devoirs.dateLimite));

    // Étudiant : où en est-il de chaque devoir ? (uniquement SES rendus)
    const statutDe = new Map<number, string>();
    if (estEtudiant && echeances.length) {
      const ids = echeances.map((e) => e.d.id);
      const mesRendus = await db
        .select({ devoirId: rendus.devoirId, statut: rendus.statut })
        .from(rendus)
        .where(and(eq(rendus.etudiantId, u.id), inArray(rendus.devoirId, ids)));
      for (const r of mesRendus) if (r.statut !== "brouillon") statutDe.set(r.devoirId, r.statut === "corrige" ? "corrige" : "rendu");
      const mesQuiz = await db
        .select({ devoirId: tentativesQuiz.devoirId })
        .from(tentativesQuiz)
        .where(and(eq(tentativesQuiz.etudiantId, u.id), inArray(tentativesQuiz.devoirId, ids), isNotNull(tentativesQuiz.finLe)));
      for (const q of mesQuiz) if (!statutDe.has(q.devoirId)) statutDe.set(q.devoirId, "rendu");
    }

    for (const { d, code, couleur } of echeances) {
      const statut = estEtudiant
        ? (statutDe.get(d.id) ?? (d.dateLimite < maintenant ? "en_retard" : "a_rendre"))
        : d.publie
          ? "publie"
          : "brouillon";
      elements.push({
        cle: `devoir-${d.id}`,
        id: d.id,
        type: "devoir",
        titre: d.titre,
        debut: d.dateLimite.toISOString(),
        fin: null,
        coursId: d.coursId,
        coursCode: code,
        couleur,
        lieu: null,
        lien: estEtudiant ? (d.type === "quiz" ? `/quiz/${d.id}` : `/devoirs/${d.id}`) : `/enseigner/devoirs/${d.id}`,
        description: d.type === "quiz" ? "Interrogation en ligne" : "Devoir à rendre",
        statut,
        motifAnnulation: null,
        cible: null,
        siteId: null,
        classeId: null,
        modifiable: false,
      });
    }
  }

  const cibles = await conditionCiblesPour(u, evenements);
  const evts = await db
    .select()
    .from(evenements)
    .where(and(cibles, lt(evenements.debut, fin), sql`coalesce(${evenements.fin}, ${evenements.debut}) >= ${debut.toISOString()}`))
    .orderBy(asc(evenements.debut));
  for (const e of evts) {
    elements.push({
      cle: `evenement-${e.id}`,
      id: e.id,
      type: "evenement",
      titre: e.titre,
      debut: e.debut.toISOString(),
      fin: e.fin?.toISOString() ?? null,
      coursId: e.coursId,
      coursCode: null,
      couleur: null,
      lieu: e.lieu,
      lien: null,
      description: e.description,
      statut: null,
      motifAnnulation: null,
      cible: e.cible,
      siteId: e.siteId,
      classeId: e.classeId,
      modifiable: await peutGererEvenement(u, e),
    });
  }

  return elements.sort((a, b) => a.debut.localeCompare(b.debut));
}

/** Seule l'équipe gère les événements, dans son périmètre (la vie scolaire d'un site : son site). */
async function peutGererEvenement(u: Utilisateur, e: Evenement): Promise<boolean> {
  if (!estEquipe(u)) return false;
  return cibleDansPerimetre(u, e);
}

// ── iCalendar (RFC 5545) ───────────────────────────────────────────────────

const DOMAINE_UID = "campus.2iae.com";

/** 20260929T100000Z */
const dateIcs = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Échappe une valeur texte (§3.3.11). */
const texteIcs = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Plie une ligne à 75 octets (§3.1) sans couper un caractère accentué en deux. */
export function plierIcs(ligne: string): string {
  if (Buffer.byteLength(ligne, "utf8") <= 75) return ligne;
  const morceaux: string[] = [];
  let courant = "";
  let taille = 0;
  let limite = 75;
  for (const car of ligne) {
    const t = Buffer.byteLength(car, "utf8");
    if (taille + t > limite) {
      morceaux.push(courant);
      courant = "";
      taille = 0;
      limite = 74; // la ligne de continuation commence par une espace
    }
    courant += car;
    taille += t;
  }
  morceaux.push(courant);
  return morceaux.join("\r\n ");
}

type EvenementIcs = {
  uid: string;
  debut: Date;
  fin: Date;
  titre: string;
  description: string;
  lieu?: string | null;
  url?: string | null;
  annule?: boolean;
  transparent?: boolean;
  categorie: string;
  /** Rappel avant le début, en durée ISO (« PT15M »). */
  rappel?: { avant: string; texte: string };
};

function veventIcs(e: EvenementIcs, horodatage: Date): string[] {
  const lignes = [
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${dateIcs(horodatage)}`,
    `DTSTART:${dateIcs(e.debut)}`,
    `DTEND:${dateIcs(e.fin)}`,
    `SUMMARY:${texteIcs(e.titre)}`,
  ];
  if (e.description) lignes.push(`DESCRIPTION:${texteIcs(e.description)}`);
  if (e.lieu) lignes.push(`LOCATION:${texteIcs(e.lieu)}`);
  if (e.url) lignes.push(`URL:${e.url}`);
  lignes.push(`CATEGORIES:${texteIcs(e.categorie)}`);
  lignes.push(`STATUS:${e.annule ? "CANCELLED" : "CONFIRMED"}`);
  lignes.push(`TRANSP:${e.transparent ? "TRANSPARENT" : "OPAQUE"}`);
  if (e.rappel && !e.annule) {
    lignes.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${texteIcs(e.rappel.texte)}`, `TRIGGER:-${e.rappel.avant}`, "END:VALARM");
  }
  lignes.push("END:VEVENT");
  return lignes;
}

function calendrierIcs(nom: string, evts: EvenementIcs[]): string {
  const horodatage = new Date();
  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Groupe 2IAE International//Campus numerique//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${texteIcs(nom)}`,
    "X-WR-CALDESC:Lives\\, devoirs et événements du campus numérique 2IAE",
    "X-WR-TIMEZONE:Africa/Abidjan",
    "REFRESH-INTERVAL;VALUE=DURATION:PT4H",
    "X-PUBLISHED-TTL:PT4H",
    ...evts.flatMap((e) => veventIcs(e, horodatage)),
    "END:VCALENDAR",
  ];
  return lignes.map(plierIcs).join("\r\n") + "\r\n";
}

/** Traduit les éléments de l'agenda en événements iCalendar. */
function versIcs(elements: ElementAgenda[], base: string, u: Utilisateur): EvenementIcs[] {
  return elements.map((e) => {
    const debut = new Date(e.debut);
    const lien = e.lien ? `${base}${e.lien}` : `${base}/agenda`;
    if (e.type === "live") {
      const annule = e.statut === "annulee";
      const preparation = u.role === "formateur" ? `\nPréparer la séance : ${base}/enseigner/seances/${e.id}` : "";
      return {
        uid: `seance-${e.id}@${DOMAINE_UID}`,
        debut,
        fin: e.fin ? new Date(e.fin) : new Date(debut.getTime() + 90 * 60_000),
        titre: `${annule ? "Annulé · " : ""}${e.coursCode} · En direct : ${e.titre}`,
        description: [
          annule && e.motifAnnulation ? `Séance annulée : ${e.motifAnnulation}` : "",
          e.description,
          `Rejoindre la classe en direct : ${lien}${preparation}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
        lieu: "Campus numérique 2IAE (en ligne et salles de conférence)",
        url: lien,
        annule,
        categorie: "Live",
        rappel: { avant: "PT15M", texte: `Le live ${e.coursCode} commence dans 15 minutes` },
      };
    }
    if (e.type === "devoir") {
      const fait = e.statut === "rendu" || e.statut === "corrige";
      return {
        uid: `devoir-${e.id}@${DOMAINE_UID}`,
        // Un créneau de 30 min qui se termine à l'heure limite : lisible dans toutes les applications d'agenda.
        debut: new Date(debut.getTime() - 30 * 60_000),
        fin: debut,
        titre: `${fait ? "Rendu · " : ""}${e.coursCode} · À rendre : ${e.titre}`,
        description: `À rendre avant ${heureFr(debut)} (heure d'Abidjan).\n\n${u.role === "etudiant" ? "Rendre mon devoir" : "Voir le devoir"} : ${lien}`,
        url: lien,
        transparent: true,
        categorie: "Devoir",
        rappel: fait ? undefined : { avant: "P1D", texte: `À rendre demain : ${e.titre}` },
      };
    }
    return {
      uid: `evenement-${e.id}@${DOMAINE_UID}`,
      debut,
      fin: e.fin ? new Date(e.fin) : new Date(debut.getTime() + 60 * 60_000),
      titre: e.titre,
      description: [e.description, `Sur le campus : ${lien}`].filter(Boolean).join("\n\n"),
      lieu: e.lieu,
      url: lien,
      categorie: "Vie scolaire",
    };
  });
}

function envoyerIcs(res: Response, contenu: string, fichier: string, telechargement: boolean) {
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", `${telechargement ? "attachment" : "inline"}; filename="${fichier}"`);
  res.setHeader("Cache-Control", "private, max-age=900");
  res.send(contenu);
}

// ── Validation ─────────────────────────────────────────────────────────────

const schemaEvenement = schemaCible.extend({
  titre: z.string().trim().min(3, "le titre est trop court").max(120, "120 caractères au plus"),
  description: z.string().trim().max(2000, "2 000 caractères au plus").default(""),
  debut: z.string().datetime({ offset: true }),
  fin: z.string().datetime({ offset: true }).nullish(),
  lieu: z.string().trim().max(160).nullish(),
  /** Prévenir les personnes concernées (cloche, sans sonnerie sur le téléphone). */
  prevenir: z.boolean().default(true),
});

const schemaModificationEvenement = schemaEvenement.partial().extend({ cible: schemaCible.shape.cible.optional() });

function bornesEvenement(debut: Date, fin: Date | null) {
  if (Number.isNaN(debut.getTime())) throw invalide("Date de début invalide.");
  if (fin && fin < debut) throw invalide("La fin doit venir après le début.");
}

function lienSemaine(d: Date) {
  return `/agenda?semaine=${debutSemaine(d).toISOString().slice(0, 10)}`;
}

export function enregistrerAgenda(app: Express) {
  // Ma semaine (ou n'importe quelle période de 62 jours au plus).
  app.get(
    "/api/agenda",
    exigerRole("etudiant", "formateur", "vie_scolaire", "admin"),
    route(async (req, res) => {
      const u = moi(req);
      const date = (v: unknown) => {
        if (typeof v !== "string" || !v) return null;
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) throw invalide("Date invalide.");
        return d;
      };
      const debut = date(req.query.debut) ?? debutSemaine(new Date());
      const fin = date(req.query.fin) ?? new Date(debut.getTime() + 7 * JOUR_MS);
      if (fin <= debut) throw invalide("La fin doit venir après le début.");
      if (fin.getTime() - debut.getTime() > 62 * JOUR_MS) throw invalide("Période trop longue (62 jours au plus).");
      const reponse: Agenda = {
        debut: debut.toISOString(),
        fin: fin.toISOString(),
        elements: await elementsAgenda(u, debut, fin),
        peutAjouter: estEquipe(u),
      };
      res.json(reponse);
    }),
  );

  // ── Événements de la vie scolaire (équipe, dans son périmètre) ───────────
  app.post(
    "/api/agenda/evenements",
    exigerRole("admin", "vie_scolaire"),
    route(async (req, res) => {
      const u = moi(req);
      const d = valider(schemaEvenement, req.body);
      const cible: CibleStockee = await verifierCible(u, d, { formateurAutorise: false });
      const debut = new Date(d.debut);
      const fin = d.fin ? new Date(d.fin) : null;
      bornesEvenement(debut, fin);
      const [e] = await db
        .insert(evenements)
        .values({ titre: d.titre, description: d.description, debut, fin, lieu: d.lieu || null, ...cible, auteurId: u.id })
        .returning();
      if (d.prevenir) {
        const ids = (await destinatairesCible(cible)).map((p) => p.id).filter((id) => id !== u.id);
        const quand = `${jourFr(debut).replace(/^./, (c) => c.toUpperCase())} · ${heureFr(debut)}${e.lieu ? ` · ${e.lieu}` : ""}`;
        await notifier(ids, { type: "systeme", titre: `Nouvel événement : ${e.titre}`, corps: quand, lien: lienSemaine(debut), push: false });
      }
      const canal = canalCible(cible);
      if (canal) publier(canal, "agenda", { id: e.id });
      else publierUtilisateur(u.id, "agenda", { id: e.id });
      await db.insert(journal).values({ utilisateurId: u.id, action: "evenement.cree", details: { evenementId: e.id, cible: e.cible } });
      res.status(201).json({ id: e.id });
    }),
  );

  app.patch(
    "/api/agenda/evenements/:id",
    exigerRole("admin", "vie_scolaire"),
    route(async (req, res) => {
      const u = moi(req);
      const [e] = await db.select().from(evenements).where(eq(evenements.id, idParam(req)));
      if (!e || !(await peutGererEvenement(u, e))) throw introuvable("Événement");
      const d = valider(schemaModificationEvenement, req.body);
      const cible = d.cible
        ? await verifierCible(u, { cible: d.cible, siteId: d.siteId, classeId: d.classeId, coursId: d.coursId }, { formateurAutorise: false })
        : {};
      const debut = d.debut ? new Date(d.debut) : e.debut;
      const fin = d.fin !== undefined ? (d.fin ? new Date(d.fin) : null) : e.fin;
      bornesEvenement(debut, fin);
      const [maj] = await db
        .update(evenements)
        .set({
          ...(d.titre !== undefined && { titre: d.titre }),
          ...(d.description !== undefined && { description: d.description }),
          ...(d.lieu !== undefined && { lieu: d.lieu || null }),
          debut,
          fin,
          ...cible,
        })
        .where(eq(evenements.id, e.id))
        .returning();
      const canal = canalCible(maj);
      if (canal) publier(canal, "agenda", { id: maj.id });
      res.json({ ok: true });
    }),
  );

  app.delete(
    "/api/agenda/evenements/:id",
    exigerRole("admin", "vie_scolaire"),
    route(async (req, res) => {
      const u = moi(req);
      const [e] = await db.select().from(evenements).where(eq(evenements.id, idParam(req)));
      if (!e || !(await peutGererEvenement(u, e))) throw introuvable("Événement");
      await db.delete(evenements).where(eq(evenements.id, e.id));
      await db.insert(journal).values({ utilisateurId: u.id, action: "evenement.supprime", details: { evenementId: e.id, titre: e.titre } });
      const canal = canalCible(e);
      if (canal) publier(canal, "agenda", { id: e.id, supprime: true });
      res.json({ ok: true });
    }),
  );

  // ── Abonnement .ics personnel ────────────────────────────────────────────
  const reponseAbonnement = (req: Request, jeton: string) => {
    const url = `${urlPublique(req)}/api/agenda/ics/${jeton}.ics`;
    const webcal = url.replace(/^https?:/, "webcal:");
    return { url, webcal, google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}` };
  };

  app.get(
    "/api/agenda/abonnement",
    exigerRole("etudiant", "formateur", "vie_scolaire", "admin"),
    route(async (req, res) => {
      const u = moi(req);
      let jeton = u.jetonAgenda;
      if (!jeton) {
        jeton = jetonAleatoire(24);
        await db.update(utilisateurs).set({ jetonAgenda: jeton }).where(eq(utilisateurs.id, u.id));
        oublierUtilisateur(u.id);
      }
      res.json(reponseAbonnement(req, jeton));
    }),
  );

  // Nouveau lien : l'ancien cesse de fonctionner (lien partagé par erreur, téléphone perdu).
  app.post(
    "/api/agenda/abonnement/renouveler",
    exigerRole("etudiant", "formateur", "vie_scolaire", "admin"),
    route(async (req, res) => {
      const u = moi(req);
      const jeton = jetonAleatoire(24);
      await db.update(utilisateurs).set({ jetonAgenda: jeton }).where(eq(utilisateurs.id, u.id));
      oublierUtilisateur(u.id);
      await db.insert(journal).values({ utilisateurId: u.id, action: "agenda.lien_renouvele" });
      res.json(reponseAbonnement(req, jeton));
    }),
  );

  // Flux public (lu par Google Agenda, Apple Calendrier…) : le jeton fait office de clé.
  app.get(
    "/api/agenda/ics/:jeton",
    route(async (req, res) => {
      const jeton = req.params.jeton.replace(/\.ics$/i, "");
      if (!/^[\w-]{20,64}$/.test(jeton)) throw introuvable("Agenda");
      const [u] = await db.select().from(utilisateurs).where(eq(utilisateurs.jetonAgenda, jeton));
      if (!u || !u.actif || u.role === "salle") throw introuvable("Agenda");
      const maintenant = Date.now();
      const elements = await elementsAgenda(u, new Date(maintenant - 30 * JOUR_MS), new Date(maintenant + 180 * JOUR_MS));
      envoyerIcs(res, calendrierIcs("Campus 2IAE", versIcs(elements, urlPublique(req), u)), "campus-2iae.ics", false);
    }),
  );

  // Une séance, pour « Ajouter à mon agenda ».
  app.get(
    "/api/agenda/seances/:id.ics",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const s = await seanceVisible(u, idParam(req));
      const [c] = await db.select({ code: cours.code, couleur: cours.couleur }).from(cours).where(eq(cours.id, s.coursId));
      const element: ElementAgenda = {
        cle: `seance-${s.id}`,
        id: s.id,
        type: "live",
        titre: s.titre,
        debut: s.debut.toISOString(),
        fin: new Date(s.debut.getTime() + s.dureeMinutes * 60_000).toISOString(),
        coursId: s.coursId,
        coursCode: c?.code ?? "",
        couleur: c?.couleur ?? null,
        lieu: null,
        lien: `/live/${s.id}`,
        description: s.description,
        statut: s.statut,
        motifAnnulation: s.motifAnnulation,
        cible: null,
        siteId: null,
        classeId: null,
        modifiable: false,
      };
      const jour = s.debut.toISOString().slice(0, 10);
      envoyerIcs(res, calendrierIcs("Campus 2IAE", versIcs([element], urlPublique(req), u)), `${c?.code ?? "live"}-${jour}.ics`, true);
    }),
  );
}

