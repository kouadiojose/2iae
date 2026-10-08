// Notifications : enregistrées en base (cloche du campus), poussées en temps
// réel à l'onglet ouvert, et envoyées en Web Push au téléphone quand la PWA
// est installée et que la personne l'a accepté.
//
// Politique du téléphone (CONCEPTION §9.16, chantier C3 du plan d'engagement ;
// constantes dans shared/engagement/envois.ts) : au-delà de 3 par jour,
// l'étudiant coupe tout et on le perd. Donc :
//   - chaque notification a une priorité : urgent (le live commence), action
//     (échéance, message d'un formateur…), contenu (nouveautés d'un cours,
//     annonces), engagement (rappel d'entraînement, relance) ;
//   - au plus 3 envois par jour et par personne, comptés dans SON jour local,
//     hors urgences ; un contenu ou un engagement ne prend que les 2 premières
//     places (la 3e reste à une action) et un seul engagement part par jour ;
//   - heures calmes de 21 h à 6 h dans le fuseau de la personne : rien ne
//     sonne la nuit, sauf une urgence ;
//   - ce qui ne peut pas sonner n'est jamais perdu : une action ou un contenu
//     part dans le résumé du matin (le matin même pour la nuit, le lendemain
//     pour le plafond), un engagement reste dans la cloche ;
//   - deux nouveautés de la même séance (ou du même lien) à moins de 3 h : la
//     seconde remplace la première sur le téléphone, sans prendre de place ;
//   - contenu sensible masqué sur l'écran verrouillé (« Nouvelle note
//     disponible », jamais la note ; un message jamais en clair).
// Chaque décision laisse une ligne dans envois_push (lue par le tableau de C8).
// La notification en base et le temps réel partent toujours, sans condition.
import { createHash } from "crypto";
import webpush from "web-push";
import { and, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "./db";
import { config } from "./config";
import { publierUtilisateur } from "./temps-reel";
import { planifier } from "./taches";
import { sqlDevoirProposable } from "./engagement/proposables";
import { notifications, abonnementsPush, compteursPush, pushDifferes, envoisPush, utilisateurs } from "@shared/schema";
import { ajouterJours, heureLocale, jourLocal, FUSEAU_PAR_DEFAUT } from "@shared/engagement/calendrier";
import {
  CONSERVATION_ENVOIS_JOURS,
  DELAI_REGROUPEMENT_MS,
  DUREE_VIE_S,
  HEURES_CALMES as CALMES,
  PLACES_CONTENU,
  PLACES_ENGAGEMENT,
  PLAFOND_JOUR,
  TYPE_RESUME,
  type Priorite,
  type StatutEnvoi,
} from "@shared/engagement/envois";
import { formaterDate, registreDe, type Registre } from "@shared/textes";
import { t } from "@shared/textes/rappels";

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
  /** Masquer titre et texte sur l'écran verrouillé (en plus des notes et des messages, toujours masqués). */
  sensible?: boolean;
  /**
   * Sonne tout de suite, même en heures calmes, et hors plafond du jour. Réservé
   * à ce qui n'attend pas : le rappel 15 min avant un live et « En direct ».
   * Les autres notifications de live (rappel de la veille, live déplacé ou
   * annulé) suivent les règles normales.
   */
  urgent?: boolean;
  /**
   * Priorité d'envoi (voir prioriteDe) : « engagement » pour un rappel
   * d'entraînement ou une relance, « action » ou « contenu » pour préciser un
   * cas que le type ne dit pas (message d'un formateur, d'un camarade).
   */
  priorite?: Priorite;
};

// ── Règles du téléphone ────────────────────────────────────────────────────

/** Envois par jour et par personne, hors notifications urgentes. */
export const PLAFOND_PUSH_JOUR = PLAFOND_JOUR;
/** Heures calmes, dans le fuseau de la personne (Abidjan par défaut) : de 21 h à 6 h. */
export const HEURES_CALMES = CALMES;

// Abidjan vit à l'heure GMT toute l'année (pas d'heure d'été) : l'heure
// d'Abidjan est l'heure UTC. Gardées pour les appelants existants.
export const heureAbidjan = (d: Date) => d.getUTCHours();
export const jourAbidjan = (d: Date) => d.toISOString().slice(0, 10);

/** Jour local de la personne (un fuseau mal saisi retombe sur Abidjan, voir calendrier.ts). */
const jourDe = (d: Date, fuseau: string | null | undefined) => jourLocal(d, fuseau || FUSEAU_PAR_DEFAUT);

/** Heures calmes chez la personne (Abidjan si son fuseau est inconnu). */
export function estHeureCalme(d = new Date(), fuseau?: string | null): boolean {
  const h = heureLocale(d, fuseau || FUSEAU_PAR_DEFAUT);
  return h >= HEURES_CALMES.debut || h < HEURES_CALMES.fin;
}

/** Jour du résumé du matin qui emporte une notification de la nuit : demain avant minuit, aujourd'hui après. */
function jourDuResume(d: Date, fuseau: string | null): string {
  const jour = jourDe(d, fuseau);
  return heureLocale(d, fuseau || FUSEAU_PAR_DEFAUT) >= HEURES_CALMES.debut ? ajouterJours(jour, 1) : jour;
}

/**
 * Priorité d'envoi : celle demandée, sinon « urgent » pour une notification
 * urgente, « contenu » pour un cours ou une annonce, « action » pour le reste
 * (devoir, note, live déplacé, message, emploi du temps, compte…).
 */
export function prioriteDe(n: Pick<NouvelleNotification, "type" | "urgent" | "priorite">): Priorite {
  if (n.priorite) return n.priorite;
  if (n.urgent) return "urgent";
  return n.type === "cours" || n.type === "annonce" ? "contenu" : "action";
}

/**
 * Groupe d'une notification, d'après son lien : les nouveautés d'une même
 * séance (replay, fiche, ressources, cours complet) partagent « seance:12 »,
 * celles d'un cours (nouvelle leçon) « cours:3 » ; sinon le lien lui-même.
 * Même groupe, même étiquette sur le téléphone : la plus récente remplace l'autre.
 */
export function groupeDe(lien: string | null | undefined): string {
  const l = lien || "/accueil";
  const seance = /^\/(?:replays|live|mediatheque\/cours)\/(\d+)(?:[/?#]|$)/.exec(l);
  if (seance) return `seance:${seance[1]}`;
  const unCours = /^\/cours\/(\d+)(?:[/?#]|$)/.exec(l);
  if (unCours) return `cours:${unCours[1]}`;
  return l.slice(0, 200);
}

/** Étiquette sur le téléphone : un seul rappel de live à la fois, une seule nouveauté par séance, un rappel par lien. */
function etiquetteDe(type: string, priorite: Priorite, groupe: string): string {
  if (type === "live") return "live";
  if (priorite === "contenu") return `contenu:${groupe}`;
  return `${type}:${groupe}`;
}

/** En-tête Topic (32 caractères base64url au plus) : le service d'envoi remplace un rappel pas encore livré du même sujet. */
function sujetDe(etiquette: string): string {
  return createHash("sha256").update(etiquette).digest("base64url").slice(0, 24);
}

/** Ce qui s'affiche sur l'écran verrouillé du téléphone. Un message n'apparaît jamais en clair. */
export function contenuPush(
  n: Pick<NouvelleNotification, "type" | "titre" | "corps" | "sensible">,
  registre: Registre = "tu",
): { titre: string; corps: string } {
  if (n.type === "note") return { titre: t("push.note.titre", { registre }), corps: t("push.note.corps", { registre }) };
  if (n.sensible || n.type === "message") return { titre: t("push.masque.titre", { registre }), corps: t("push.masque.corps", { registre }) };
  return { titre: n.titre, corps: n.corps ?? "" };
}

/** Boutons du rappel : « Rejoindre » quand le live commence, « Rendre mon devoir » pour un devoir. */
function boutonsDe(type: string, priorite: Priorite, lien: string, registre: Registre): ActionPush[] {
  if (type === "live" && priorite === "urgent" && /^\/live\/\d+/.test(lien)) return [{ action: "rejoindre", titre: t("action.rejoindre", { registre }), lien }];
  if (type === "devoir" && /^\/devoirs\/\d+/.test(lien)) return [{ action: "rendre", titre: t("action.rendre", { registre }), lien }];
  if (type === "devoir" && /^\/quiz\/\d+/.test(lien)) return [{ action: "quiz", titre: t("action.quiz", { registre }), lien }];
  return [];
}

type Destinataire = { id: number; fuseau: string | null; role: string };
type Abonnement = typeof abonnementsPush.$inferSelect;
type LigneEnvoi = typeof envoisPush.$inferInsert;
type ActionPush = { action: string; titre: string; lien: string };

/**
 * Charge du rappel, lue par le service worker (section « Rappels »). Les
 * anciens services workers n'en lisent que titre, corps, lien et type.
 */
type ChargePush = {
  /** Notification de la cloche : le toucher la marque comme lue et ouverte. */
  id: number | null;
  titre: string;
  corps: string;
  lien: string;
  type: string;
  tag: string;
  /** Faire sonner de nouveau quand le rappel en remplace un autre de même étiquette. */
  renotify: boolean;
  actions: ActionPush[];
  /** Résumé de plusieurs nouveautés : le toucher compte l'ouverture sans marquer la notification lue. */
  resume?: boolean;
};

async function destinatairesDe(ids: number[]): Promise<Destinataire[]> {
  if (!ids.length) return [];
  return db.select({ id: utilisateurs.id, fuseau: utilisateurs.fuseau, role: utilisateurs.role }).from(utilisateurs).where(inArray(utilisateurs.id, ids));
}

/**
 * Réserve une place dans le plafond du jour (local) de chaque personne, selon
 * la priorité ; renvoie celles qui y ont encore droit. Atomique (une seule
 * requête) : deux notifications simultanées ne peuvent pas dépasser le plafond.
 *   action : moins de 3 envois ce jour-là ;
 *   contenu : moins de 2, pour garder une place à une action ;
 *   engagement : moins de 2, et aucun rappel d'engagement ce jour-là.
 */
async function reserver(dests: Destinataire[], priorite: Exclude<Priorite, "urgent">, maintenant: Date): Promise<Set<number>> {
  if (!dests.length) return new Set();
  const engagement = priorite === "engagement";
  const limite = priorite === "action" ? PLAFOND_JOUR : priorite === "contenu" ? PLACES_CONTENU : PLACES_ENGAGEMENT;
  const accordes = await db
    .insert(compteursPush)
    .values(dests.map((d) => ({ utilisateurId: d.id, jour: jourDe(maintenant, d.fuseau), nombre: 1, engagements: engagement ? 1 : 0 })))
    .onConflictDoUpdate({
      target: [compteursPush.utilisateurId, compteursPush.jour],
      set: { nombre: sql`${compteursPush.nombre} + 1`, engagements: sql`${compteursPush.engagements} + excluded.engagements` },
      setWhere: engagement
        ? sql`${compteursPush.nombre} < ${limite} AND ${compteursPush.engagements} = 0`
        : sql`${compteursPush.nombre} < ${limite}`,
    })
    .returning({ utilisateurId: compteursPush.utilisateurId });
  return new Set(accordes.map((a) => a.utilisateurId));
}

/** Rend la place réservée quand aucun appareil n'a accepté le rappel. */
async function rendrePlace(d: Destinataire, priorite: Priorite, maintenant: Date) {
  await db
    .update(compteursPush)
    .set({
      nombre: sql`greatest(${compteursPush.nombre} - 1, 0)`,
      ...(priorite === "engagement" ? { engagements: sql`greatest(${compteursPush.engagements} - 1, 0)` } : {}),
    })
    .where(and(eq(compteursPush.utilisateurId, d.id), eq(compteursPush.jour, jourDe(maintenant, d.fuseau))));
}

/**
 * Réserve un envoi « action » dans le plafond du jour de chaque personne ;
 * renvoie celles qui y ont encore droit (signature d'avant les priorités).
 */
export async function reserverEnvois(utilisateurIds: number[], maintenant = new Date()): Promise<number[]> {
  const ids = [...new Set(utilisateurIds)].filter(Boolean);
  return [...(await reserver(await destinatairesDe(ids), "action", maintenant))];
}

export type RepartitionPush = { envoyer: number[]; differer: number[]; ignorer: number[] };

/**
 * Décide, pour chaque destinataire, si la notification sonne maintenant,
 * attend le matin (heures calmes) ou ne sonne pas aujourd'hui (plafond). Sans
 * le regroupement des nouveautés : c'est envoyerPush qui l'applique.
 */
export async function repartirPush(
  utilisateurIds: number[],
  options: Pick<NouvelleNotification, "urgent" | "priorite"> = {},
  maintenant = new Date(),
): Promise<RepartitionPush> {
  const ids = [...new Set(utilisateurIds)].filter(Boolean);
  const priorite = prioriteDe({ type: "systeme", ...options });
  // Urgent (le live commence) : ne compte pas et passe toujours.
  if (priorite === "urgent") return { envoyer: ids, differer: [], ignorer: [] };
  const dests = await destinatairesDe(ids);
  const calmes = dests.filter((d) => estHeureCalme(maintenant, d.fuseau));
  const deJour = dests.filter((d) => !estHeureCalme(maintenant, d.fuseau));
  const accordes = await reserver(deJour, priorite, maintenant);
  return {
    envoyer: deJour.filter((d) => accordes.has(d.id)).map((d) => d.id),
    differer: calmes.map((d) => d.id),
    ignorer: deJour.filter((d) => !accordes.has(d.id)).map((d) => d.id),
  };
}

/** Personnes qui ont reçu une nouveauté du même groupe il y a moins de 3 h. */
async function regroupables(ids: number[], groupe: string, maintenant: Date): Promise<Set<number>> {
  if (!ids.length) return new Set();
  const lignes = await db
    .selectDistinct({ id: envoisPush.utilisateurId })
    .from(envoisPush)
    .where(
      and(
        inArray(envoisPush.utilisateurId, ids),
        gt(envoisPush.creeLe, new Date(maintenant.getTime() - DELAI_REGROUPEMENT_MS)),
        eq(envoisPush.groupe, groupe),
        eq(envoisPush.priorite, "contenu"),
        inArray(envoisPush.statut, ["envoye", "regroupe"]),
      ),
    );
  return new Set(lignes.map((l) => l.id));
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

/**
 * Décide et envoie le rappel de chaque destinataire, puis note chaque décision
 * dans envois_push. Appelée par notifier() sans l'attendre ; exportée pour les
 * essais (heure simulée) et renvoie la décision prise pour chacun.
 */
export async function envoyerPush(
  utilisateurIds: number[],
  n: NouvelleNotification,
  notificationDe: Map<number, number>,
  maintenant = new Date(),
): Promise<Map<number, StatutEnvoi>> {
  const ids = [...new Set(utilisateurIds)].filter(Boolean);
  const statuts = new Map<number, StatutEnvoi>();
  if (!ids.length) return statuts;
  const priorite = prioriteDe(n);
  const groupe = groupeDe(n.lien);
  const [dests, abonnements] = await Promise.all([destinatairesDe(ids), db.select().from(abonnementsPush).where(inArray(abonnementsPush.utilisateurId, ids))]);
  const appareils = new Map<number, Abonnement[]>();
  for (const a of abonnements) appareils.set(a.utilisateurId, [...(appareils.get(a.utilisateurId) ?? []), a]);

  const aEnvoyer: Destinataire[] = [];
  const comptes = new Set<number>();
  const aDifferer: { utilisateurId: number; jour: string }[] = [];
  const abonnes: Destinataire[] = [];
  for (const d of dests) {
    if (appareils.has(d.id)) abonnes.push(d);
    else statuts.set(d.id, "sans_abonnement");
  }

  if (priorite === "urgent") {
    for (const d of abonnes) {
      statuts.set(d.id, "envoye");
      aEnvoyer.push(d);
    }
  } else {
    const deJour: Destinataire[] = [];
    for (const d of abonnes) {
      if (!estHeureCalme(maintenant, d.fuseau)) deJour.push(d);
      else {
        // La nuit : action et contenu partent dans le résumé du matin ; un engagement reste dans la cloche.
        statuts.set(d.id, "differe");
        if (priorite !== "engagement") aDifferer.push({ utilisateurId: d.id, jour: jourDuResume(maintenant, d.fuseau) });
      }
    }
    let candidats = deJour;
    if (priorite === "contenu" && deJour.length) {
      const recents = await regroupables(
        deJour.map((d) => d.id),
        groupe,
        maintenant,
      );
      for (const d of deJour) {
        if (!recents.has(d.id)) continue;
        statuts.set(d.id, "regroupe");
        aEnvoyer.push(d);
      }
      candidats = deJour.filter((d) => !recents.has(d.id));
    }
    const accordes = await reserver(candidats, priorite, maintenant);
    for (const d of candidats) {
      if (accordes.has(d.id)) {
        statuts.set(d.id, "envoye");
        comptes.add(d.id);
        aEnvoyer.push(d);
      } else {
        // Plus de place aujourd'hui : action et contenu partent dans le résumé de demain matin.
        statuts.set(d.id, "plafond");
        if (priorite !== "engagement") aDifferer.push({ utilisateurId: d.id, jour: ajouterJours(jourDe(maintenant, d.fuseau), 1) });
      }
    }
  }

  const differees = aDifferer.flatMap(({ utilisateurId, jour }) => {
    const notificationId = notificationDe.get(utilisateurId);
    return notificationId ? [{ utilisateurId, notificationId, jour, priorite, creeLe: maintenant }] : [];
  });
  if (differees.length) await db.insert(pushDifferes).values(differees);

  const expires: number[] = [];
  if (aEnvoyer.length) {
    const lien = n.lien ?? "/accueil";
    const tag = etiquetteDe(n.type, priorite, groupe);
    const options = optionsEnvoi(priorite, tag);
    const cibles = aEnvoyer.flatMap((d) => {
      const registre = registreDe(d.role);
      const charge: ChargePush = {
        id: notificationDe.get(d.id) ?? null,
        ...contenuPush(n, registre),
        lien,
        type: n.type,
        tag,
        // Une nouveauté qui en remplace une autre ne fait pas sonner de nouveau.
        renotify: priorite !== "contenu" && priorite !== "engagement",
        actions: boutonsDe(n.type, priorite, lien, registre),
      };
      return (appareils.get(d.id) ?? []).map((a) => ({ a, charge }));
    });
    const resultats = await pousser(cibles, options);
    expires.push(...resultats.expires.values());
    for (const d of aEnvoyer) {
      if (resultats.reussis.has(d.id)) continue;
      statuts.set(d.id, "echec");
      if (comptes.has(d.id)) await rendrePlace(d, priorite, maintenant);
    }
  }

  const lignes: LigneEnvoi[] = [...statuts].map(([utilisateurId, statut]) => ({
    utilisateurId,
    notificationId: notificationDe.get(utilisateurId) ?? null,
    type: n.type,
    priorite,
    statut,
    groupe,
    creeLe: maintenant,
  }));
  for (const utilisateurId of expires) lignes.push({ utilisateurId, notificationId: null, type: n.type, priorite, statut: "expire", groupe, creeLe: maintenant });
  await noterEnvois(lignes);
  return statuts;
}

/** Durée de vie, urgence et sujet du rappel chez le service d'envoi. */
function optionsEnvoi(priorite: Priorite, tag: string): webpush.RequestOptions {
  return {
    TTL: priorite === "urgent" ? DUREE_VIE_S.urgent : DUREE_VIE_S.autre,
    urgency: priorite === "urgent" ? "high" : "normal",
    topic: sujetDe(tag),
    // Un service d'envoi qui ne répond pas ne retient pas les autres rappels.
    timeout: 20_000,
  };
}

async function noterEnvois(lignes: LigneEnvoi[]) {
  // Par paquets : une notification à toute une promotion reste une seule requête raisonnable.
  for (let i = 0; i < lignes.length; i += 500) await db.insert(envoisPush).values(lignes.slice(i, i + 500));
}

type ResultatsEnvoi = {
  /** Personnes dont au moins un appareil a accepté le rappel. */
  reussis: Set<number>;
  /** Appareils oubliés (404 ou 410) : identifiant de l'abonnement → personne. */
  expires: Map<number, number>;
};

/** Envoie la charge à chaque appareil ; oublie ceux que le service d'envoi ne connaît plus. */
async function pousser(cibles: { a: Abonnement; charge: ChargePush }[], options: webpush.RequestOptions): Promise<ResultatsEnvoi> {
  const reussis = new Set<number>();
  const expires = new Map<number, number>();
  const appareilsReussis: number[] = [];
  await Promise.all(
    cibles.map(async ({ a, charge }) => {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: a.cles }, JSON.stringify(charge), options);
        reussis.add(a.utilisateurId);
        appareilsReussis.push(a.id);
      } catch (e) {
        const statut = (e as { statusCode?: number }).statusCode;
        // Abonnement expiré ou révoqué : on l'oublie.
        if (statut === 404 || statut === 410) {
          await db.delete(abonnementsPush).where(eq(abonnementsPush.id, a.id));
          expires.set(a.id, a.utilisateurId);
        }
      }
    }),
  );
  // Dernière réussite de chaque appareil (joignables, tableau de C8) : une écriture par jour au plus.
  if (appareilsReussis.length) {
    await db
      .update(abonnementsPush)
      .set({ derniereReussiteLe: new Date() })
      .where(
        and(
          inArray(abonnementsPush.id, appareilsReussis),
          or(isNull(abonnementsPush.derniereReussiteLe), lt(abonnementsPush.derniereReussiteLe, sql`now() - interval '1 day'`)),
        ),
      );
  }
  return { reussis, expires };
}

// ── Résumé du matin ────────────────────────────────────────────────────────

type EnAttente = {
  id: number;
  utilisateurId: number;
  jour: string | null;
  priorite: Priorite | null;
  notificationId: number;
  type: string;
  titre: string;
  corps: string | null;
  lien: string | null;
  luLe: Date | null;
  creeLe: Date;
  fuseau: string | null;
  role: string;
};

type EcheanceDuJour = { id: number; titre: string; type: string; dateLimite: Date };

/**
 * Devoirs proposables dus aujourd'hui (jour local de l'étudiant), ouverts et
 * pas encore rendus : l'échéance du jour passe en tête du résumé du matin.
 */
async function echeancesDuJour(dests: Destinataire[], maintenant: Date): Promise<Map<number, EcheanceDuJour>> {
  const etudiants = dests.filter((d) => d.role === "etudiant");
  const resultat = new Map<number, EcheanceDuJour>();
  if (!etudiants.length) return resultat;
  const ids = sql.join(
    etudiants.map((d) => sql`${d.id}`),
    sql`, `,
  );
  const fin = new Date(maintenant.getTime() + 24 * 60 * 60_000);
  const { rows } = await db.execute<{ utilisateurId: number; id: number; titre: string; type: string; dateLimite: string | Date }>(sql`
    SELECT u.id AS "utilisateurId", d.id, d.titre, d.type, d.date_limite AS "dateLimite"
    FROM campus.utilisateurs u
    JOIN campus.devoirs d ON (
      d.cours_id IN (SELECT cc.cours_id FROM campus.cours_classes cc WHERE cc.classe_id = u.classe_id)
      OR d.cours_id IN (SELECT i.cours_id FROM campus.inscriptions i WHERE i.utilisateur_id = u.id)
    )
    WHERE u.id IN (${ids})
      AND d.publie
      AND (d.ouverture_le IS NULL OR d.ouverture_le <= ${maintenant.toISOString()}::timestamptz)
      AND d.date_limite > ${maintenant.toISOString()}::timestamptz
      AND d.date_limite <= ${fin.toISOString()}::timestamptz
      AND ${sqlDevoirProposable("d")}
      AND NOT EXISTS (SELECT 1 FROM campus.rendus r WHERE r.devoir_id = d.id AND r.etudiant_id = u.id AND r.statut <> 'brouillon')
    ORDER BY d.date_limite`);
  const fuseauDe = new Map(etudiants.map((d) => [d.id, d.fuseau]));
  for (const r of rows) {
    if (resultat.has(r.utilisateurId)) continue;
    const dateLimite = new Date(r.dateLimite);
    const fuseau = fuseauDe.get(r.utilisateurId) ?? null;
    if (jourDe(dateLimite, fuseau) === jourDe(maintenant, fuseau)) resultat.set(r.utilisateurId, { id: r.id, titre: r.titre, type: r.type, dateLimite });
  }
  return resultat;
}

const idDevoirDuLien = (lien: string | null) => {
  const m = /^\/(?:devoirs|quiz)\/(\d+)(?:[/?#]|$)/.exec(lien ?? "");
  return m ? Number(m[1]) : null;
};

/**
 * Compose le résumé : l'échéance du jour en tête s'il y en a une ; sinon la
 * seule nouveauté, ou la première action, suivie du nombre des autres ; un
 * message n'apparaît jamais en clair.
 */
function composerResume(nonLues: EnAttente[], echeance: EcheanceDuJour | undefined, d: Destinataire): ChargePush {
  const registre = registreDe(d.role);
  const autres = (n: number) => (n === 1 ? t("resume.plus.un", { registre }) : t("resume.plus.n", { registre, v: { n } }));
  const base = { renotify: false, tag: TYPE_RESUME, type: TYPE_RESUME };
  if (echeance) {
    const liee = nonLues.find((l) => idDevoirDuLien(l.lien) === echeance.id);
    const reste = nonLues.length - (liee ? 1 : 0);
    const lien = echeance.type === "quiz" ? `/quiz/${echeance.id}` : `/devoirs/${echeance.id}`;
    return {
      ...base,
      id: (liee ?? nonLues[0]).notificationId,
      titre: t(echeance.type === "quiz" ? "resume.echeance.quiz" : "resume.echeance.depot", {
        registre,
        v: { titre: echeance.titre, heure: formaterDate(echeance.dateLimite, { fuseau: d.fuseau, style: "heure" }) },
      }),
      corps: reste ? autres(reste) : t("resume.echeance.corps", { registre }),
      lien,
      type: "devoir",
      actions: boutonsDe("devoir", "action", lien, registre),
      resume: !liee || reste > 0,
    };
  }
  if (nonLues.length === 1) {
    const seule = nonLues[0];
    const lien = seule.lien ?? "/accueil";
    const priorite = seule.priorite ?? prioriteDe({ type: seule.type as NouvelleNotification["type"] });
    return {
      ...base,
      id: seule.notificationId,
      ...contenuPush({ type: seule.type as NouvelleNotification["type"], titre: seule.titre, corps: seule.corps ?? undefined }, registre),
      lien,
      type: seule.type,
      actions: boutonsDe(seule.type, priorite, lien, registre),
    };
  }
  const action = nonLues.find((l) => l.priorite === "action" && l.type !== "message");
  if (action) {
    return {
      ...base,
      id: action.notificationId,
      titre: contenuPush({ type: action.type as NouvelleNotification["type"], titre: action.titre }, registre).titre,
      corps: autres(nonLues.length - 1),
      lien: action.lien ?? "/accueil",
      actions: [],
      resume: true,
    };
  }
  return {
    ...base,
    id: nonLues[0].notificationId,
    titre: t("resume.titre", { registre, v: { n: nonLues.length } }),
    corps: t("resume.corps", { registre }),
    lien: "/accueil",
    actions: [],
    resume: true,
  };
}

/**
 * Hors heures calmes (dans le fuseau de chacun) : pour chaque personne, un
 * seul envoi qui résume ce qui n'a pas pu sonner et n'a pas encore été lu.
 * Compte dans le plafond du jour, comme une action.
 */
export async function envoyerRappelsDuMatin(maintenant = new Date()): Promise<number> {
  const enAttente: EnAttente[] = await db
    .select({
      id: pushDifferes.id,
      utilisateurId: pushDifferes.utilisateurId,
      jour: pushDifferes.jour,
      priorite: pushDifferes.priorite,
      notificationId: notifications.id,
      type: notifications.type,
      titre: notifications.titre,
      corps: notifications.corps,
      lien: notifications.lien,
      luLe: notifications.luLe,
      creeLe: notifications.creeLe,
      fuseau: utilisateurs.fuseau,
      role: utilisateurs.role,
    })
    .from(pushDifferes)
    .innerJoin(notifications, eq(notifications.id, pushDifferes.notificationId))
    .innerJoin(utilisateurs, eq(utilisateurs.id, pushDifferes.utilisateurId));
  if (!enAttente.length) return 0;

  // Ce qui est dû maintenant : hors heures calmes chez la personne, et le jour de son résumé arrivé.
  const parPersonne = new Map<number, EnAttente[]>();
  for (const l of enAttente) {
    if (estHeureCalme(maintenant, l.fuseau)) continue;
    if (l.jour && l.jour > jourDe(maintenant, l.fuseau)) continue;
    parPersonne.set(l.utilisateurId, [...(parPersonne.get(l.utilisateurId) ?? []), l]);
  }
  if (!parPersonne.size) return 0;
  const dests = new Map([...parPersonne].map(([id, lignes]) => [id, { id, fuseau: lignes[0].fuseau, role: lignes[0].role } as Destinataire]));
  const echeances = await echeancesDuJour([...dests.values()], maintenant);

  let envois = 0;
  for (const [utilisateurId, lignes] of parPersonne) {
    const d = dests.get(utilisateurId)!;
    const nonLues = lignes.filter((l) => !l.luLe).sort((a, b) => a.creeLe.getTime() - b.creeLe.getTime() || a.id - b.id);
    if (nonLues.length && pushActif) {
      const charge = composerResume(nonLues, echeances.get(utilisateurId), d);
      const ligne: LigneEnvoi = { utilisateurId, notificationId: charge.id, type: TYPE_RESUME, priorite: "action", statut: "envoye", groupe: TYPE_RESUME, creeLe: maintenant };
      const appareils = await db.select().from(abonnementsPush).where(eq(abonnementsPush.utilisateurId, utilisateurId));
      const expires: number[] = [];
      if (!appareils.length) ligne.statut = "sans_abonnement";
      else if (!(await reserver([d], "action", maintenant)).has(utilisateurId)) ligne.statut = "plafond";
      else {
        const resultats = await pousser(
          appareils.map((a) => ({ a, charge })),
          optionsEnvoi("action", TYPE_RESUME),
        );
        expires.push(...resultats.expires.values());
        if (resultats.reussis.has(utilisateurId)) envois++;
        else {
          ligne.statut = "echec";
          await rendrePlace(d, "action", maintenant);
        }
      }
      await noterEnvois([ligne, ...expires.map((id) => ({ ...ligne, utilisateurId: id, notificationId: null, statut: "expire" as const }))]);
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

// Décisions d'envoi gardées 90 jours ; un résumé resté une semaine sans partir n'a plus de sens.
planifier("envois-push-purge", 24 * 60 * 60_000, async () => {
  await db.delete(envoisPush).where(sql`${envoisPush.creeLe} < now() - make_interval(days => ${sql.raw(String(CONSERVATION_ENVOIS_JOURS))})`);
  await db.delete(pushDifferes).where(sql`${pushDifferes.creeLe} < now() - interval '7 days'`);
});
