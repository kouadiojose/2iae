// Tables du chantier C4 (rappel du jour, e-mail de la semaine et relances) :
// reglages_engagement, relances_engagement, reglage_relances (migration
// 0032_relances_engagement.sql, numérotée 0026 dans la branche du chantier).
// Les définitions correspondent exactement au SQL écrit à la main. Types
// d'échange (sans drizzle) : shared/engagement/relances.ts.
//
// relances_engagement est lue par le tableau de C8 (ses colonnes ne changent
// plus de nom) : une ligne par décision d'envoi, même quand rien ne part
// (statut « simulation », « temoin », « plafond »…).
import { serial, integer, smallint, text, boolean, date, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs, sites, classes } from "./base";
import { notifications } from "./echanges";
import type { CanalRelance, ModeEmails, ModeRelances, MotifRelance, StatutRelance } from "../engagement/relances";

/** Choix de chaque étudiant (page « Mes rappels ») ; pas de ligne : les valeurs par défaut. */
export const reglagesEngagement = campusSchema.table("reglages_engagement", {
  utilisateurId: integer("utilisateur_id")
    .primaryKey()
    .references(() => utilisateurs.id, { onDelete: "cascade" }),
  /** Heure du rappel d'entraînement en minutes depuis minuit, heure locale (1140 = 19 h) ; null : automatique. */
  heureRappel: smallint("heure_rappel"),
  rappelsActifs: boolean("rappels_actifs").notNull().default(true),
  /** Faux après « Ne plus recevoir ces e-mails » (lien signé, sans connexion). */
  emailsActifs: boolean("emails_actifs").notNull().default(true),
  /** Pause des rappels d'entraînement jusqu'à ce jour inclus (« AAAA-MM-JJ »). */
  pauseJusquAu: date("pause_jusqu_au", { mode: "string" }),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
});

/** Chaque rappel d'entraînement, relance de décrocheur ou e-mail de la semaine, envoyé ou non. */
export const relancesEngagement = campusSchema.table(
  "relances_engagement",
  {
    id: serial("id").primaryKey(),
    utilisateurId: integer("utilisateur_id")
      .notNull()
      .references(() => utilisateurs.id, { onDelete: "cascade" }),
    /** Jour local de l'étudiant (« AAAA-MM-JJ »). */
    jour: date("jour", { mode: "string" }).notNull(),
    motif: text("motif").$type<MotifRelance>().notNull(),
    canal: text("canal").$type<CanalRelance>().notNull(),
    /** Décrocheurs : 1 rappel, 2 e-mail, 3 vie scolaire. Autres motifs : 1. */
    palier: smallint("palier").notNull().default(1),
    /** Texte retenu (« devoir.quiz.4 », « inactif.2 »…) : la variante la moins récemment envoyée. */
    variante: text("variante"),
    statut: text("statut").$type<StatutRelance>().notNull(),
    notificationId: integer("notification_id").references(() => notifications.id, { onDelete: "set null" }),
    /** Lien interne proposé (« /devoirs/12 »). */
    lien: text("lien"),
    siteId: integer("site_id").references(() => sites.id, { onDelete: "set null" }),
    classeId: integer("classe_id").references(() => classes.id, { onDelete: "set null" }),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
    /** E-mail : bouton touché (/api/relances/e/:id). Rappel : voir notifications.lu_le. */
    ouvertLe: timestamp("ouvert_le", { withTimezone: true }),
    /** Premier acte d'apprentissage dans les 48 h qui suivent. */
    revenuLe: timestamp("revenu_le", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("relances_engagement_unique").on(t.utilisateurId, t.jour, t.motif, t.canal),
    index("relances_engagement_utilisateur_idx").on(t.utilisateurId, t.creeLe),
    index("relances_engagement_jour_idx").on(t.jour),
  ],
);

/** Réglage de la direction, une seule ligne (id = 1) ; pas de ligne : tout en essai, 40 e-mails par jour. */
export const reglageRelances = campusSchema.table("reglage_relances", {
  id: smallint("id").primaryKey().default(1),
  /** Relances des décrocheurs. */
  mode: text("mode").$type<ModeRelances>().notNull().default("essai"),
  /** Rappel d'entraînement du jour. */
  rappelsMode: text("rappels_mode").$type<ModeRelances>().notNull().default("essai"),
  /** E-mails d'engagement (la semaine, les relances). */
  emailsMode: text("emails_mode").$type<ModeEmails>().notNull().default("essai"),
  /** Plafond commun à tous les e-mails d'engagement : le compte Resend est partagé avec le site. */
  emailsParJour: smallint("emails_par_jour").notNull().default(40),
  majPar: integer("maj_par").references(() => utilisateurs.id, { onDelete: "set null" }),
  majLe: timestamp("maj_le", { withTimezone: true }).notNull().defaultNow(),
});

export type RelanceEngagement = typeof relancesEngagement.$inferSelect;
