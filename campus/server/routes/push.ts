// Rappels sur le téléphone (Web Push de la PWA installée).
//
//   GET    /api/push/cle            → { cle } : clé publique VAPID, ou null si les rappels ne sont pas configurés
//   POST   /api/push/abonnement     { endpoint, keys: { p256dh, auth }, plateforme?, marque? } : enregistre ce téléphone
//   DELETE /api/push/abonnement     { endpoint } : oublie ce téléphone
//   POST   /api/push/test           : envoie un rappel d'essai à soi-même (via notifier(), hors plafond du jour)
//   POST   /api/push/verification   { endpoint, recu, marque? } : réponse à « L'as-tu reçu ? » (chantier C3)
//   GET    /api/push/etat?endpoint= → EtatRappels : ce que le campus sait de cet appareil (chantier C3)
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
import { notifier, pushDisponible, estHeureCalme, PLAFOND_PUSH_JOUR } from "../notifications";
import { abonnementsPush, compteursPush, utilisateurs, type ClePush, type ResultatEssaiPush } from "@shared/schema";
import { jourLocal, FUSEAU_PAR_DEFAUT } from "@shared/engagement/calendrier";
import { MARQUES, PLATEFORMES, type EtatRappels } from "@shared/engagement/envois";
import { registreDe } from "@shared/textes";
import { t } from "@shared/textes/rappels";

const schemaEndpoint = z
  .string()
  .url()
  .max(2048)
  .refine((u) => u.startsWith("https://"), "adresse d'envoi non sécurisée");

const schemaAbonnement = z.object({
  endpoint: schemaEndpoint,
  keys: z.object({
    p256dh: z.string().min(16).max(256),
    auth: z.string().min(8).max(128),
  }),
  // Facultatifs et bornés : un ancien téléphone (ou le service worker) n'envoie que l'abonnement.
  plateforme: z.enum(PLATEFORMES).optional().catch(undefined),
  marque: z.enum(MARQUES).optional().catch(undefined),
});

const schemaDesabonnement = z.object({ endpoint: z.string().url().max(2048) });

const schemaVerification = z.object({
  endpoint: z.string().url().max(2048),
  recu: z.boolean(),
  marque: z.enum(MARQUES).optional(),
});

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

/** Rappels déjà reçus aujourd'hui, dans le jour local de la personne (plafond de 3 par jour, hors rappels urgents). */
async function envoisDuJour(utilisateurId: number, fuseau: string | null): Promise<number> {
  const [r] = await db
    .select({ n: compteursPush.nombre })
    .from(compteursPush)
    .where(and(eq(compteursPush.utilisateurId, utilisateurId), eq(compteursPush.jour, jourLocal(new Date(), fuseau || FUSEAU_PAR_DEFAUT))));
  return r?.n ?? 0;
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

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
      const { endpoint, keys, plateforme, marque } = valider(schemaAbonnement, req.body);
      const cles = { p256dh: keys.p256dh, auth: keys.auth };
      // Un téléphone partagé change de propriétaire : l'adresse d'envoi suit le compte connecté,
      // et la vérification (« L'as-tu reçu ? ») repart de zéro pour la nouvelle personne.
      const memePersonne = sql`${abonnementsPush.utilisateurId} = excluded.utilisateur_id`;
      await db
        .insert(abonnementsPush)
        .values({ utilisateurId: u.id, endpoint, cles, plateforme: plateforme ?? null, marque: marque ?? null })
        .onConflictDoUpdate({
          target: abonnementsPush.endpoint,
          set: {
            utilisateurId: u.id,
            cles,
            plateforme: sql`coalesce(excluded.plateforme, ${abonnementsPush.plateforme})`,
            marque: sql`coalesce(excluded.marque, CASE WHEN ${memePersonne} THEN ${abonnementsPush.marque} END)`,
            recu: sql`CASE WHEN ${memePersonne} THEN ${abonnementsPush.recu} END`,
            verifieLe: sql`CASE WHEN ${memePersonne} THEN ${abonnementsPush.verifieLe} END`,
          },
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
      else if (estHeureCalme(new Date(), u.fuseau)) raison = "heures_calmes";

      // L'essai ne prend pas de place dans les 3 rappels du jour (un essai par minute au plus) : sinon trois
      // essais d'un téléphone récalcitrant repousseraient au lendemain le rappel d'une échéance.
      // Heures calmes : l'essai part quand même dans la cloche (et le matin sur le téléphone).
      if (raison !== "indisponible" && raison !== "aucun_appareil") {
        derniersEssais.set(u.id, Date.now());
        const etudiant = u.role === "etudiant";
        await notifier([u.id], {
          type: "systeme",
          titre: "Les rappels fonctionnent",
          corps: etudiant ? "Tu seras prévenu ici avant chaque cours en direct." : "Vous serez prévenu ici avant chaque cours en direct.",
          lien: "/profil",
          push: true,
          horsPlafond: true,
        });
      }
      const reponse: ResultatEssaiPush = { envoye: raison === null, appareils, raison };
      res.json(reponse);
    }),
  );

  // « L'as-tu reçu ? » après le rappel d'essai : vérifié sur chaque téléphone, et la marque choisie dans le guide.
  app.post(
    "/api/push/verification",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const { endpoint, recu, marque } = valider(schemaVerification, req.body);
      const [a] = await db
        .update(abonnementsPush)
        .set({ recu, verifieLe: new Date(), ...(marque ? { marque } : {}) })
        .where(and(eq(abonnementsPush.endpoint, endpoint), eq(abonnementsPush.utilisateurId, u.id)))
        .returning({ id: abonnementsPush.id });
      if (!a) throw new ErreurHttp(404, t("erreur.inconnu", { registre: registreDe(u.role) }));
      res.json({ ok: true, recu });
    }),
  );

  // Ce que le campus sait des rappels de la personne et de cet appareil (carte de l'accueil, vérification).
  app.get(
    "/api/push/etat",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const endpoint = typeof req.query.endpoint === "string" ? req.query.endpoint.slice(0, 2048) : "";
      const [appareils, envois, [ici]] = await Promise.all([
        nombreAppareils(u.id),
        envoisDuJour(u.id, u.fuseau),
        endpoint
          ? db
              .select()
              .from(abonnementsPush)
              .where(and(eq(abonnementsPush.endpoint, endpoint), eq(abonnementsPush.utilisateurId, u.id)))
          : Promise.resolve([]),
      ]);
      const reponse: EtatRappels = {
        disponible: pushDisponible(),
        appareils,
        cetAppareil: ici
          ? {
              plateforme: ici.plateforme,
              marque: ici.marque,
              recu: ici.recu,
              verifieLe: iso(ici.verifieLe),
              derniereReussiteLe: iso(ici.derniereReussiteLe),
            }
          : null,
        heuresCalmes: estHeureCalme(new Date(), u.fuseau),
        envoisDuJour: envois,
        plafond: PLAFOND_PUSH_JOUR,
      };
      res.set("Cache-Control", "no-store").json(reponse);
    }),
  );
}
