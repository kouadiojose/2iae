// Rappels sur le téléphone (Web Push de la PWA installée).
//
//   GET    /api/push/cle          → { cle } : clé publique VAPID, ou null si les rappels ne sont pas configurés
//   POST   /api/push/abonnement   { endpoint, keys: { p256dh, auth } } : enregistre ce téléphone
//   DELETE /api/push/abonnement   { endpoint } : oublie ce téléphone
//   POST   /api/push/test         : envoie un rappel d'essai à soi-même (via notifier())
//
// L'envoi lui-même, le plafond de 3 par jour et les heures calmes vivent dans
// server/notifications.ts : ici on ne gère que les appareils.
import type { Express } from "express";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { config } from "../config";
import { exigerConnexion, moi, oublierUtilisateur } from "../auth";
import { route, valider, ErreurHttp } from "../http";
import { notifier, pushDisponible, estHeureCalme, jourAbidjan, PLAFOND_PUSH_JOUR } from "../notifications";
import { abonnementsPush, compteursPush, utilisateurs, type ClePush, type ResultatEssaiPush } from "@shared/schema";

const schemaAbonnement = z.object({
  endpoint: z
    .string()
    .url()
    .max(2048)
    .refine((u) => u.startsWith("https://"), "adresse d'envoi non sécurisée"),
  keys: z.object({
    p256dh: z.string().min(16).max(256),
    auth: z.string().min(8).max(128),
  }),
});

const schemaDesabonnement = z.object({ endpoint: z.string().url().max(2048) });

/** Un essai par minute et par personne : la cloche ne doit pas se remplir d'essais. */
const derniersEssais = new Map<number, number>();
const INTERVALLE_ESSAI_MS = 60_000;

/** Retient dans les préférences que la personne reçoit (ou non) des rappels sur un téléphone. */
async function noterPreferencePush(utilisateurId: number, actif: boolean) {
  await db
    .update(utilisateurs)
    .set({ preferences: sql`${utilisateurs.preferences} || ${JSON.stringify({ push: actif })}::jsonb` })
    .where(eq(utilisateurs.id, utilisateurId));
  oublierUtilisateur(utilisateurId);
}

async function nombreAppareils(utilisateurId: number): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(abonnementsPush)
    .where(eq(abonnementsPush.utilisateurId, utilisateurId));
  return r?.n ?? 0;
}

/** Rappels déjà reçus aujourd'hui (plafond de 3 par jour, hors rappels de live). */
async function envoisDuJour(utilisateurId: number): Promise<number> {
  const [r] = await db
    .select({ n: compteursPush.nombre })
    .from(compteursPush)
    .where(and(eq(compteursPush.utilisateurId, utilisateurId), eq(compteursPush.jour, jourAbidjan(new Date()))));
  return r?.n ?? 0;
}

export function enregistrerPush(app: Express) {
  // La clé publique n'a rien de secret ; null quand l'envoi n'est pas configuré
  // (le client masque alors la carte « Recevoir les rappels »).
  app.get(
    "/api/push/cle",
    route(async (_req, res) => {
      const reponse: ClePush = { cle: pushDisponible() ? (config.push.publique ?? null) : null };
      res.json(reponse);
    }),
  );

  app.post(
    "/api/push/abonnement",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const { endpoint, keys } = valider(schemaAbonnement, req.body);
      // Un téléphone partagé change de propriétaire : l'adresse d'envoi suit le compte connecté.
      await db
        .insert(abonnementsPush)
        .values({ utilisateurId: u.id, endpoint, cles: { p256dh: keys.p256dh, auth: keys.auth } })
        .onConflictDoUpdate({
          target: abonnementsPush.endpoint,
          set: { utilisateurId: u.id, cles: { p256dh: keys.p256dh, auth: keys.auth } },
        });
      if (!u.preferences?.push) await noterPreferencePush(u.id, true);
      res.status(201).json({ ok: true, appareils: await nombreAppareils(u.id) });
    }),
  );

  app.delete(
    "/api/push/abonnement",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const { endpoint } = valider(schemaDesabonnement, req.body && Object.keys(req.body).length ? req.body : req.query);
      // On ne retire que l'appareil de la personne connectée.
      await db.delete(abonnementsPush).where(and(eq(abonnementsPush.endpoint, endpoint), eq(abonnementsPush.utilisateurId, u.id)));
      const restants = await nombreAppareils(u.id);
      if (!restants && u.preferences?.push) await noterPreferencePush(u.id, false);
      res.json({ ok: true, appareils: restants });
    }),
  );

  app.post(
    "/api/push/test",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const dernier = derniersEssais.get(u.id);
      if (dernier && Date.now() - dernier < INTERVALLE_ESSAI_MS) {
        throw new ErreurHttp(429, "Un essai vient d'être envoyé. Patiente une minute avant d'en demander un autre.");
      }
      const appareils = await nombreAppareils(u.id);
      let raison: ResultatEssaiPush["raison"] = null;
      if (!pushDisponible()) raison = "indisponible";
      else if (!appareils) raison = "aucun_appareil";
      else if (estHeureCalme()) raison = "heures_calmes";
      else if ((await envoisDuJour(u.id)) >= PLAFOND_PUSH_JOUR) raison = "plafond";

      // Heures calmes ou plafond : l'essai part quand même dans la cloche (et le matin sur le téléphone).
      if (raison !== "indisponible" && raison !== "aucun_appareil") {
        derniersEssais.set(u.id, Date.now());
        const etudiant = u.role === "etudiant";
        await notifier([u.id], {
          type: "systeme",
          titre: "Les rappels fonctionnent",
          corps: etudiant
            ? "Tu seras prévenu ici avant chaque cours en direct."
            : "Vous serez prévenu ici avant chaque cours en direct.",
          lien: "/profil",
          push: true,
        });
      }
      const reponse: ResultatEssaiPush = { envoye: raison === null, appareils, raison };
      res.json(reponse);
    }),
  );
}
