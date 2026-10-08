// Routes du chantier C3 (rappels qui arrivent).
//
//   POST /api/notifications/:id/ouvert  { resume? } : le rappel a été touché sur le téléphone
//
// Le service worker l'appelle au toucher (keepalive), avant d'ouvrir l'écran :
// la notification est marquée lue (sauf pour un résumé de plusieurs
// nouveautés) et l'ouverture notée dans envois_push, pour mesurer les taux
// d'ouverture par priorité (tableau de C8). Seulement pour sa propre
// notification : celle d'un autre compte répond 404, comme une inconnue.
import type { Express } from "express";
import { z } from "zod";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { exigerConnexion, moi } from "../auth";
import { route, valider, idParam, introuvable } from "../http";
import { publierUtilisateur } from "../temps-reel";
import { envoisPush, notifications } from "@shared/schema";

const schemaOuvert = z.object({ resume: z.boolean().optional() }).default({});

export function enregistrerEnvois(app: Express) {
  app.post(
    "/api/notifications/:id/ouvert",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const id = idParam(req);
      const { resume } = valider(schemaOuvert, req.body ?? {});
      const [n] = await db
        .select({ id: notifications.id, luLe: notifications.luLe })
        .from(notifications)
        .where(and(eq(notifications.id, id), eq(notifications.utilisateurId, u.id)));
      if (!n) throw introuvable("Notification");
      // Un résumé (« 3 nouveautés ») ouvert ne vaut pas lecture de chacune : elles restent dans la cloche.
      if (!resume && !n.luLe) {
        await db.update(notifications).set({ luLe: sql`coalesce(${notifications.luLe}, now())` }).where(eq(notifications.id, id));
        // Les autres onglets ouverts rafraîchissent leur cloche.
        publierUtilisateur(u.id, "notification", { lues: 1 });
      }
      // Seuls les rappels réellement partis sur le téléphone portent l'ouverture.
      await db
        .update(envoisPush)
        .set({ ouvertLe: new Date() })
        .where(
          and(
            eq(envoisPush.notificationId, id),
            eq(envoisPush.utilisateurId, u.id),
            inArray(envoisPush.statut, ["envoye", "regroupe"]),
            isNull(envoisPush.ouvertLe),
          ),
        );
      res.json({ ok: true });
    }),
  );
}
