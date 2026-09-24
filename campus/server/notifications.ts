// Notifications : enregistrées en base (cloche du campus), poussées en temps
// réel à l'onglet ouvert, et envoyées en Web Push au téléphone quand la PWA
// est installée et que la personne l'a accepté.
//
// Politique du téléphone (CONCEPTION §9.16) : au-delà de 3 par jour,
// l'étudiant coupe tout et on le perd. Donc :
//   - au plus 3 envois par jour et par personne, hors rappels de live ;
//   - heures calmes de 21 h à 6 h (heure d'Abidjan) : rien ne sonne la nuit,
//     sauf un rappel de live ; un seul rappel groupé part le matin pour ce
//     qui est resté non lu ;
//   - contenu sensible masqué sur l'écran verrouillé (« Nouvelle note
//     disponible », jamais la note).
// La notification en base et le temps réel partent toujours, sans condition.
import webpush from "web-push";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { config } from "./config";
import { publierUtilisateur } from "./temps-reel";
import { planifier } from "./taches";
import { notifications, abonnementsPush, compteursPush, pushDifferes } from "@shared/schema";

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
  /** Masquer titre et texte sur l'écran verrouillé (en plus des notes, toujours masquées). */
  sensible?: boolean;
};

// ── Règles du téléphone ────────────────────────────────────────────────────

/** Envois par jour et par personne, hors rappels de live. */
export const PLAFOND_PUSH_JOUR = 3;
/** Heures calmes, heure d'Abidjan : de 21 h à 6 h. */
export const HEURES_CALMES = { debut: 21, fin: 6 } as const;

// Abidjan vit à l'heure GMT toute l'année (pas d'heure d'été) : l'heure
// d'Abidjan est l'heure UTC.
export const heureAbidjan = (d: Date) => d.getUTCHours();
export const jourAbidjan = (d: Date) => d.toISOString().slice(0, 10);

export function estHeureCalme(d = new Date()): boolean {
  const h = heureAbidjan(d);
  return h >= HEURES_CALMES.debut || h < HEURES_CALMES.fin;
}

/** Ce qui s'affiche sur l'écran verrouillé du téléphone. */
export function contenuPush(n: Pick<NouvelleNotification, "type" | "titre" | "corps" | "sensible">): { titre: string; corps: string } {
  if (n.type === "note") return { titre: "Nouvelle note disponible", corps: "Ouvre le campus pour la découvrir." };
  if (n.sensible) return { titre: "Nouveau sur le campus", corps: "Ouvre le campus pour voir." };
  return { titre: n.titre, corps: n.corps ?? "" };
}

/**
 * Réserve un envoi dans le plafond du jour pour chaque personne ; renvoie
 * celles qui y ont encore droit. Atomique (une seule requête) : deux
 * notifications simultanées ne peuvent pas dépasser le plafond.
 */
export async function reserverEnvois(utilisateurIds: number[], maintenant = new Date()): Promise<number[]> {
  const ids = [...new Set(utilisateurIds)].filter(Boolean);
  if (!ids.length) return [];
  const jour = jourAbidjan(maintenant);
  const accordes = await db
    .insert(compteursPush)
    .values(ids.map((utilisateurId) => ({ utilisateurId, jour, nombre: 1 })))
    .onConflictDoUpdate({
      target: [compteursPush.utilisateurId, compteursPush.jour],
      set: { nombre: sql`${compteursPush.nombre} + 1` },
      setWhere: sql`${compteursPush.nombre} < ${PLAFOND_PUSH_JOUR}`,
    })
    .returning({ utilisateurId: compteursPush.utilisateurId });
  return accordes.map((a) => a.utilisateurId);
}

export type RepartitionPush = { envoyer: number[]; differer: number[]; ignorer: number[] };

/**
 * Décide, pour chaque destinataire abonné, si la notification sonne
 * maintenant, attend le matin (heures calmes) ou reste silencieuse
 * (plafond atteint : elle reste dans la cloche).
 */
export async function repartirPush(utilisateurIds: number[], type: NouvelleNotification["type"], maintenant = new Date()): Promise<RepartitionPush> {
  const ids = [...new Set(utilisateurIds)].filter(Boolean);
  // Le rappel d'un live qui commence ne compte pas et passe toujours.
  if (type === "live") return { envoyer: ids, differer: [], ignorer: [] };
  if (estHeureCalme(maintenant)) return { envoyer: [], differer: ids, ignorer: [] };
  const envoyer = await reserverEnvois(ids, maintenant);
  const accordes = new Set(envoyer);
  return { envoyer, differer: [], ignorer: ids.filter((id) => !accordes.has(id)) };
}

// ── Envoi ──────────────────────────────────────────────────────────────────

/** Notifie une ou plusieurs personnes (enregistrement + temps réel + push). */
export async function notifier(utilisateurIds: number[], n: NouvelleNotification): Promise<void> {
  const ids = [...new Set(utilisateurIds)].filter(Boolean);
  if (!ids.length) return;
  const lignes = await db
    .insert(notifications)
    .values(ids.map((utilisateurId) => ({ utilisateurId, type: n.type, titre: n.titre, corps: n.corps ?? null, lien: n.lien ?? null })))
    .returning();
  for (const l of lignes) publierUtilisateur(l.utilisateurId, "notification", l);
  if (n.push !== false && pushActif) {
    const notificationDe = new Map(lignes.map((l) => [l.utilisateurId, l.id]));
    void envoyerPush(ids, n, notificationDe).catch((e) => console.error("[push]", (e as Error).message));
  }
}

type ChargePush = { titre: string; corps: string; lien: string; type: string };

async function envoyerPush(ids: number[], n: NouvelleNotification, notificationDe: Map<number, number>) {
  const abonnements = await db.select().from(abonnementsPush).where(inArray(abonnementsPush.utilisateurId, ids));
  if (!abonnements.length) return;
  // Seules les personnes qui ont un téléphone abonné entrent dans le plafond.
  const abonnes = [...new Set(abonnements.map((a) => a.utilisateurId))];
  const { envoyer, differer } = await repartirPush(abonnes, n.type);

  if (differer.length) {
    const lignes = differer
      .map((utilisateurId) => ({ utilisateurId, notificationId: notificationDe.get(utilisateurId) }))
      .filter((l): l is { utilisateurId: number; notificationId: number } => Boolean(l.notificationId));
    if (lignes.length) await db.insert(pushDifferes).values(lignes);
  }
  if (!envoyer.length) return;

  const { titre, corps } = contenuPush(n);
  const charge: ChargePush = { titre, corps, lien: n.lien ?? "/accueil", type: n.type };
  const autorises = new Set(envoyer);
  await pousser(
    abonnements.filter((a) => autorises.has(a.utilisateurId)),
    charge,
  );
}

async function pousser(abonnements: (typeof abonnementsPush.$inferSelect)[], charge: ChargePush) {
  const texte = JSON.stringify(charge);
  await Promise.all(
    abonnements.map(async (a) => {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: a.cles }, texte, { TTL: 3600 });
      } catch (e) {
        const statut = (e as { statusCode?: number }).statusCode;
        // Abonnement expiré ou révoqué : on l'oublie.
        if (statut === 404 || statut === 410) await db.delete(abonnementsPush).where(eq(abonnementsPush.id, a.id));
      }
    }),
  );
}

// ── Rappel groupé du matin ─────────────────────────────────────────────────

/**
 * Après les heures calmes : pour chaque personne, un seul envoi qui résume
 * ce qui est arrivé pendant la nuit et n'a pas encore été lu. Compte dans
 * le plafond du jour.
 */
export async function envoyerRappelsDuMatin(maintenant = new Date()): Promise<number> {
  if (estHeureCalme(maintenant)) return 0;
  const enAttente = await db
    .select({
      id: pushDifferes.id,
      utilisateurId: pushDifferes.utilisateurId,
      type: notifications.type,
      titre: notifications.titre,
      corps: notifications.corps,
      lien: notifications.lien,
      luLe: notifications.luLe,
    })
    .from(pushDifferes)
    .innerJoin(notifications, eq(notifications.id, pushDifferes.notificationId));
  if (!enAttente.length) return 0;

  const parPersonne = new Map<number, typeof enAttente>();
  for (const l of enAttente) parPersonne.set(l.utilisateurId, [...(parPersonne.get(l.utilisateurId) ?? []), l]);

  let envois = 0;
  for (const [utilisateurId, lignes] of parPersonne) {
    const nonLues = lignes.filter((l) => !l.luLe);
    if (nonLues.length && pushActif && (await reserverEnvois([utilisateurId], maintenant)).length) {
      const abonnements = await db.select().from(abonnementsPush).where(eq(abonnementsPush.utilisateurId, utilisateurId));
      const seule = nonLues.length === 1 ? nonLues[0] : null;
      const contenu = seule
        ? contenuPush({ type: seule.type as NouvelleNotification["type"], titre: seule.titre, corps: seule.corps ?? undefined })
        : { titre: `${nonLues.length} nouveautés sur le campus`, corps: "Arrivées pendant la nuit. Ouvre le campus pour les voir." };
      await pousser(abonnements, { ...contenu, lien: seule?.lien ?? "/accueil", type: seule?.type ?? "systeme" });
      envois++;
    }
    await db.delete(pushDifferes).where(
      and(
        eq(pushDifferes.utilisateurId, utilisateurId),
        inArray(
          pushDifferes.id,
          lignes.map((l) => l.id),
        ),
      ),
    );
  }
  return envois;
}

/** Nombre de notifications non lues d'une personne (cloche). */
export async function compterNonLues(utilisateurId: number): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.utilisateurId, utilisateurId), isNull(notifications.luLe)));
  return r?.n ?? 0;
}

planifier("push-rappel-du-matin", 10 * 60_000, async () => {
  if (!pushActif) return;
  await envoyerRappelsDuMatin();
});

// Les compteurs de plus de 3 jours ne servent plus à rien.
planifier("push-compteurs-anciens", 6 * 60 * 60_000, async () => {
  const limite = jourAbidjan(new Date(Date.now() - 3 * 86_400_000));
  await db.delete(compteursPush).where(sql`${compteursPush.jour} < ${limite}`);
});
