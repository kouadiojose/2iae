// Notifications : enregistrées en base (cloche du campus), poussées en temps
// réel à l'onglet ouvert, et envoyées en Web Push au téléphone quand la PWA
// est installée et que la personne l'a accepté.
import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { config } from "./config";
import { publierUtilisateur } from "./temps-reel";
import { notifications, abonnementsPush } from "@shared/schema";

const pushActif = Boolean(config.push.publique && config.push.privee);
if (pushActif) webpush.setVapidDetails(config.push.contact, config.push.publique!, config.push.privee!);

export const pushDisponible = () => pushActif;

export type NouvelleNotification = {
  type: "live" | "devoir" | "note" | "message" | "annonce" | "cours" | "systeme" | "presence";
  titre: string;
  corps?: string;
  /** Lien interne du campus (ex. /cours/3). */
  lien?: string;
  /** Envoyer aussi en push sur le téléphone. */
  push?: boolean;
};

/** Notifie une ou plusieurs personnes (enregistrement + temps réel + push). */
export async function notifier(utilisateurIds: number[], n: NouvelleNotification): Promise<void> {
  const ids = [...new Set(utilisateurIds)].filter(Boolean);
  if (!ids.length) return;
  const lignes = await db
    .insert(notifications)
    .values(ids.map((utilisateurId) => ({ utilisateurId, type: n.type, titre: n.titre, corps: n.corps ?? null, lien: n.lien ?? null })))
    .returning();
  for (const l of lignes) publierUtilisateur(l.utilisateurId, "notification", l);
  if (n.push !== false && pushActif) void envoyerPush(ids, n).catch((e) => console.error("[push]", e.message));
}

async function envoyerPush(ids: number[], n: NouvelleNotification) {
  const abonnements = await db.select().from(abonnementsPush).where(inArray(abonnementsPush.utilisateurId, ids));
  const charge = JSON.stringify({ titre: n.titre, corps: n.corps ?? "", lien: n.lien ?? "/accueil", type: n.type });
  await Promise.all(
    abonnements.map(async (a) => {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: a.cles }, charge, { TTL: 3600 });
      } catch (e) {
        const statut = (e as { statusCode?: number }).statusCode;
        // Abonnement expiré ou révoqué : on l'oublie.
        if (statut === 404 || statut === 410) await db.delete(abonnementsPush).where(eq(abonnementsPush.id, a.id));
      }
    }),
  );
}
