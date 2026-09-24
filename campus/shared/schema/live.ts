// Classes en direct : un formateur (en France ou ailleurs) enseigne aux cinq
// salles de conférence et aux étudiants connectés, en même temps.
import { serial, text, integer, boolean, timestamp, jsonb, primaryKey, index, uniqueIndex } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs, sites } from "./base";
import { cours } from "./cours";

export const STATUTS_SEANCE = ["planifiee", "en_direct", "terminee", "annulee"] as const;
export type StatutSeance = (typeof STATUTS_SEANCE)[number];

/** daily : visio intégrée Daily.co · jitsi : serveur Jitsi · externe : lien Zoom/Meet/Teams · demo : sans visio (scène simulée). */
export const FOURNISSEURS_VISIO = ["daily", "jitsi", "externe", "demo"] as const;
export type FournisseurVisio = (typeof FOURNISSEURS_VISIO)[number];

export type EtapePlan = { titre: string; minutes?: number };

export const seances = campusSchema.table(
  "seances",
  {
    id: serial("id").primaryKey(),
    coursId: integer("cours_id").notNull().references(() => cours.id, { onDelete: "cascade" }),
    titre: text("titre").notNull(),
    description: text("description").notNull().default(""),
    debut: timestamp("debut", { withTimezone: true }).notNull(),
    dureeMinutes: integer("duree_minutes").notNull().default(90),
    statut: text("statut").$type<StatutSeance>().notNull().default("planifiee"),
    fournisseur: text("fournisseur").$type<FournisseurVisio>().notNull().default("daily"),
    /** Nom de la salle chez le fournisseur (créée à la demande). */
    salleVisio: text("salle_visio"),
    lienExterne: text("lien_externe"),
    /** Déroulé prévu, affiché dans le studio du formateur. */
    plan: jsonb("plan").$type<EtapePlan[]>().notNull().default([]),
    demarreeLe: timestamp("demarree_le", { withTimezone: true }),
    termineeLe: timestamp("terminee_le", { withTimezone: true }),
    replayUrl: text("replay_url"),
    replayDureeSecondes: integer("replay_duree_secondes"),
    /** Identifiant d'enregistrement chez le fournisseur (lien de lecture renouvelé à la demande). */
    enregistrementId: text("enregistrement_id"),
    /** Transcription assemblée à partir des sous-titres en direct. */
    transcription: text("transcription").notNull().default(""),
    /** Résumé rédigé par l'assistant IA (Markdown), mis à jour pendant et après la séance. */
    resumeIa: text("resume_ia"),
    resumeIaLe: timestamp("resume_ia_le", { withTimezone: true }),
    /** Le formateur a relu et publié le résumé (fiche de révision) aux étudiants. */
    resumeValide: boolean("resume_valide").notNull().default(false),
    /** Diapositives (images légères) diffusées en synchronisation : identifiants de fichiers. */
    diapos: jsonb("diapos").$type<number[]>().notNull().default([]),
    diapoCourante: integer("diapo_courante").notNull().default(0),
    proposeSurSite: boolean("propose_sur_site").notNull().default(false),
    publierSurSite: boolean("publier_sur_site").notNull().default(false),
    /** Motif d'annulation ou de report (« Le formateur a un empêchement »), affiché partout. */
    motifAnnulation: text("motif_annulation"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("seances_cours_idx").on(t.coursId), index("seances_debut_idx").on(t.debut)],
);

/** Questions posées pendant le live, votées par les étudiants de tous les campus. */
export const questionsLive = campusSchema.table(
  "questions_live",
  {
    id: serial("id").primaryKey(),
    seanceId: integer("seance_id").notNull().references(() => seances.id, { onDelete: "cascade" }),
    auteurId: integer("auteur_id").notNull().references(() => utilisateurs.id),
    siteId: integer("site_id").references(() => sites.id),
    texte: text("texte").notNull(),
    votes: integer("votes").notNull().default(1),
    anonyme: boolean("anonyme").notNull().default(false),
    repondue: boolean("repondue").notNull().default(false),
    epinglee: boolean("epinglee").notNull().default(false),
    masquee: boolean("masquee").notNull().default(false),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("questions_live_seance_idx").on(t.seanceId)],
);

export const votesQuestions = campusSchema.table(
  "votes_questions",
  {
    questionId: integer("question_id").notNull().references(() => questionsLive.id, { onDelete: "cascade" }),
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.questionId, t.utilisateurId] })],
);

/** Mains levées (d'un étudiant ou d'une salle de campus entière). */
export const mainsLevees = campusSchema.table(
  "mains_levees",
  {
    id: serial("id").primaryKey(),
    seanceId: integer("seance_id").notNull().references(() => seances.id, { onDelete: "cascade" }),
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id),
    siteId: integer("site_id").references(() => sites.id),
    leveeLe: timestamp("levee_le", { withTimezone: true }).notNull().defaultNow(),
    /** Le formateur a donné la parole. */
    paroleDonneeLe: timestamp("parole_donnee_le", { withTimezone: true }),
    baisseeLe: timestamp("baissee_le", { withTimezone: true }),
  },
  (t) => [index("mains_seance_idx").on(t.seanceId)],
);

export const MODES_PRESENCE = ["salle", "en_ligne"] as const;
export type ModePresence = (typeof MODES_PRESENCE)[number];

/** Présence à une séance : alimentée par le live (battements) et l'émargement QR en salle. */
export const presences = campusSchema.table(
  "presences",
  {
    id: serial("id").primaryKey(),
    seanceId: integer("seance_id").notNull().references(() => seances.id, { onDelete: "cascade" }),
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    siteId: integer("site_id").references(() => sites.id),
    mode: text("mode").$type<ModePresence>().notNull().default("en_ligne"),
    emargeQr: boolean("emarge_qr").notNull().default(false),
    arriveeLe: timestamp("arrivee_le", { withTimezone: true }).notNull().defaultNow(),
    derniereActivite: timestamp("derniere_activite", { withTimezone: true }).notNull().defaultNow(),
    minutes: integer("minutes").notNull().default(0),
    /** Absence justifiée par la vie scolaire (ligne créée pour l'absent). */
    justification: text("justification"),
    /** Pointé à la main par le responsable de salle (fait foi en cas d'écart). */
    pointeParId: integer("pointe_par_id"),
  },
  (t) => [uniqueIndex("presences_unique").on(t.seanceId, t.utilisateurId)],
);

/** Effectif déclaré par le responsable de chaque salle de conférence. */
export const effectifsSalles = campusSchema.table(
  "effectifs_salles",
  {
    seanceId: integer("seance_id").notNull().references(() => seances.id, { onDelete: "cascade" }),
    siteId: integer("site_id").notNull().references(() => sites.id),
    nombre: integer("nombre").notNull().default(0),
    /** La salle a vérifié écran, son et caméra avant le live. */
    prete: boolean("prete").notNull().default(false),
    /** Incident signalé (coupure de courant, réseau…) : personne n'est compté absent. */
    incident: text("incident"),
    majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.seanceId, t.siteId] })],
);

/** Sondages éclair lancés par le formateur pendant le live. */
export const sondages = campusSchema.table(
  "sondages",
  {
    id: serial("id").primaryKey(),
    seanceId: integer("seance_id").notNull().references(() => seances.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    /** Index de la bonne réponse quand le sondage sert de question de cours. */
    bonneReponse: integer("bonne_reponse"),
    ouvert: boolean("ouvert").notNull().default(true),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sondages_seance_idx").on(t.seanceId)],
);

export const reponsesSondages = campusSchema.table(
  "reponses_sondages",
  {
    sondageId: integer("sondage_id").notNull().references(() => sondages.id, { onDelete: "cascade" }),
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    choix: integer("choix").notNull(),
    siteId: integer("site_id").references(() => sites.id),
  },
  (t) => [primaryKey({ columns: [t.sondageId, t.utilisateurId] })],
);

/** Sous-titres en direct (reconnaissance vocale du navigateur du formateur). */
export const sousTitres = campusSchema.table(
  "sous_titres",
  {
    id: serial("id").primaryKey(),
    seanceId: integer("seance_id").notNull().references(() => seances.id, { onDelete: "cascade" }),
    /** Secondes écoulées depuis le début de la séance. */
    t: integer("t").notNull(),
    texte: text("texte").notNull(),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sous_titres_seance_idx").on(t.seanceId)],
);

/** Thermomètre de compréhension : « je suis », « je suis perdu », « plus lentement ». */
export const RESSENTIS = ["compris", "perdu", "lent", "bravo"] as const;
export type Ressenti = (typeof RESSENTIS)[number];

/** Baromètre : chaque clic « perdu / compris / plus lentement / bravo » est horodaté, par campus. */
export const ressentis = campusSchema.table(
  "ressentis",
  {
    id: serial("id").primaryKey(),
    seanceId: integer("seance_id").notNull().references(() => seances.id, { onDelete: "cascade" }),
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    siteId: integer("site_id").references(() => sites.id),
    ressenti: text("ressenti").$type<Ressenti>().notNull(),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ressentis_seance_idx").on(t.seanceId, t.creeLe)],
);

export type Seance = typeof seances.$inferSelect;
export type QuestionLive = typeof questionsLive.$inferSelect;
export type Presence = typeof presences.$inferSelect;
export type Sondage = typeof sondages.$inferSelect;
