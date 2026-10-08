// Tables du chantier C3 (rappels qui arrivent), migration 0026_envois_push.sql.
// Les nouvelles colonnes des tables existantes vont dans echanges.ts
// (abonnements_push) et ext-accueil.ts (compteurs_push, push_differes).
//
// envois_push garde la trace de chaque décision d'envoi d'un rappel sur le
// téléphone (envoyé, regroupé, différé, bloqué par le plafond, échec, appareil
// oublié, personne sans téléphone abonné) et de son ouverture. Le tableau
// « Engagement et participation » (C8) en tire les étudiants joignables et les
// taux d'ouverture par priorité. Conservée 90 jours. Les colonnes ne changent
// plus de nom une fois fusionnées (campus/ENGAGEMENT.md).
import { serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { campusSchema, utilisateurs } from "./base";
import { notifications } from "./echanges";
import type { Priorite, StatutEnvoi } from "../engagement/envois";

export const envoisPush = campusSchema.table(
  "envois_push",
  {
    id: serial("id").primaryKey(),
    utilisateurId: integer("utilisateur_id").notNull().references(() => utilisateurs.id, { onDelete: "cascade" }),
    /** Notification de la cloche ; pour le résumé du matin, celle qui est mise en tête. */
    notificationId: integer("notification_id").references(() => notifications.id, { onDelete: "set null" }),
    /** Type de la notification (live, devoir, cours…), ou « resume » pour le résumé du matin. */
    type: text("type").notNull(),
    priorite: text("priorite").$type<Priorite>().notNull(),
    statut: text("statut").$type<StatutEnvoi>().notNull(),
    /** Regroupement des nouveautés (« seance:12 », « cours:3 » ou le lien) : même étiquette sur le téléphone. */
    groupe: text("groupe"),
    creeLe: timestamp("cree_le", { withTimezone: true }).notNull().defaultNow(),
    /** Rappel touché sur le téléphone (POST /api/notifications/:id/ouvert). */
    ouvertLe: timestamp("ouvert_le", { withTimezone: true }),
  },
  (t) => [
    index("envois_push_utilisateur_idx").on(t.utilisateurId, t.creeLe),
    index("envois_push_notification_idx").on(t.notificationId),
    index("envois_push_cree_le_idx").on(t.creeLe),
  ],
);

export type EnvoiPush = typeof envoisPush.$inferSelect;
