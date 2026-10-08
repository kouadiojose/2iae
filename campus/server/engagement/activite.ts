// Activité jour par jour (chantier C8) : une ligne activite_jours par personne
// et par jour local où elle a ouvert le campus, et la plateforme utilisée.
//
// Appelé par chargerUtilisateur (server/auth.ts) à CHAQUE requête connectée :
// tout le travail se fait en mémoire, et l'écriture part sans attente (void …
// .catch), au plus une fois par heure et par personne, en une seule requête qui
// met aussi à jour derniere_connexion. S'y ajoute, au plus trois fois par jour,
// une écriture quand une plateforme plus « téléphone » apparaît dans la journée
// (ordinateur → navigateur du téléphone → appli installée → appli Android) :
// un jour passé en partie sur le téléphone compte comme un jour sur téléphone.
//
// Ce fichier est importé par auth.ts, donc très tôt : il ne doit importer ni
// les routes ni rien de lourd (pas de cycle avec routes/admin.ts).
import type { Request } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { planifier } from "../taches";
import { FUSEAU_PAR_DEFAUT, jourLocal, type Jour } from "@shared/engagement/calendrier";
import { CONSERVATION_ACTIVITE_JOURS, ENTETE_PLATEFORME, RANG_PLATEFORME, estPlateforme, type Plateforme } from "@shared/engagement/indicateurs";
import type { Utilisateur } from "@shared/schema";

const HEURE_MS = 60 * 60_000;
const JOUR_MS = 86_400_000;

/**
 * Plateforme déclarée par le client (en-tête X-Campus-Plateforme, posé par
 * lib/api.ts). Sans en-tête valable (ancienne version de l'appli, flux temps
 * réel, page chargée directement) : une estimation par le navigateur, jamais
 * mieux que « mobile » ; l'appli Android et l'appli installée ne se
 * reconnaissent que par l'en-tête. Sert aux statistiques seulement.
 */
export function plateformeDe(req: Pick<Request, "headers">): Plateforme {
  const declaree = req.headers[ENTETE_PLATEFORME];
  if (estPlateforme(declaree)) return declaree;
  const ua = String(req.headers["user-agent"] ?? "");
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) ? "mobile" : "ordinateur";
}

/** Deux instants tombent-ils le même jour local ? (Abidjan, GMT toute l'année : simple division.) */
export function memeJourLocal(a: Date, b: Date, fuseau: string | null): boolean {
  if (!fuseau || fuseau === FUSEAU_PAR_DEFAUT) return Math.floor(a.getTime() / JOUR_MS) === Math.floor(b.getTime() / JOUR_MS);
  return jourLocal(a, fuseau) === jourLocal(b, fuseau);
}

/** Ce que le serveur a déjà écrit aujourd'hui pour chaque personne (perdu au redémarrage : sans gravité, l'écriture est idempotente). */
const ecrit = new Map<number, { jour: Jour; le: number; rang: number }>();
setInterval(() => {
  const limite = Date.now() - 2 * JOUR_MS;
  for (const [id, e] of ecrit) if (e.le < limite) ecrit.delete(id);
}, HEURE_MS).unref();

/**
 * Note le passage de la personne. Écrit (sans attendre) quand c'est le premier
 * passage connu du jour, quand la dernière écriture date d'au moins une heure,
 * ou quand une plateforme plus « téléphone » apparaît. derniere_connexion est
 * mise à jour dans la même requête. Un écran de salle n'est pas une personne :
 * pour lui, seulement derniere_connexion, au plus une fois par heure, comme avant.
 */
export function noterActivite(u: Utilisateur, plateforme: Plateforme, maintenant = new Date()): void {
  const t = maintenant.getTime();
  if (u.role === "salle") {
    if (t - (u.derniereConnexion?.getTime() ?? 0) < HEURE_MS) return;
    u.derniereConnexion = maintenant;
    void db
      .execute(sql`UPDATE campus.utilisateurs SET derniere_connexion = ${maintenant.toISOString()}::timestamptz WHERE id = ${u.id}`)
      .catch(() => undefined);
    return;
  }
  const deja = ecrit.get(u.id);
  const rang = RANG_PLATEFORME[plateforme];
  const memeJour = Boolean(deja && memeJourLocal(new Date(deja.le), maintenant, u.fuseau));
  if (deja && memeJour && t - deja.le < HEURE_MS) {
    if (rang <= deja.rang) return;
    // Une plateforme plus « téléphone » dans l'heure : « heures » n'augmente pas (garde SQL).
    deja.rang = rang;
    void enregistrer(u, deja.jour, plateforme, maintenant).catch(signaler);
    return;
  }
  const jour = jourLocal(maintenant, u.fuseau);
  ecrit.set(u.id, { jour, le: t, rang: deja && memeJour ? Math.max(deja.rang, rang) : rang });
  u.derniereConnexion = maintenant;
  void enregistrer(u, jour, plateforme, maintenant).catch(signaler);
}

const signaler = (e: unknown) => console.error("[activité]", (e as Error).message);

/**
 * Une seule requête : derniere_connexion, puis la ligne du jour. Rejouée dans
 * la même heure (redémarrage, plateforme qui change), elle n'augmente pas
 * « heures » : la garde est en SQL, sur derniere_le.
 */
async function enregistrer(u: Utilisateur, jour: Jour, plateforme: Plateforme, maintenant: Date): Promise<void> {
  const rang = (col: string) => sql.raw(
    `CASE ${col} WHEN 'android_app' THEN 4 WHEN 'installee' THEN 3 WHEN 'mobile' THEN 2 WHEN 'ordinateur' THEN 1 ELSE 0 END`,
  );
  await db.execute(sql`
    WITH maj AS (UPDATE campus.utilisateurs SET derniere_connexion = ${maintenant.toISOString()}::timestamptz WHERE id = ${u.id})
    INSERT INTO campus.activite_jours AS a (utilisateur_id, jour, premiere_le, derniere_le, heures, plateforme, site_id, classe_id)
    VALUES (${u.id}, ${jour}::date, ${maintenant.toISOString()}::timestamptz, ${maintenant.toISOString()}::timestamptz, 1, ${plateforme}, ${u.siteId ?? null}, ${u.classeId ?? null})
    ON CONFLICT (utilisateur_id, jour) DO UPDATE SET
      heures = CASE WHEN a.derniere_le <= EXCLUDED.derniere_le - interval '1 hour' THEN LEAST(a.heures + 1, 24) ELSE a.heures END,
      derniere_le = CASE WHEN a.derniere_le <= EXCLUDED.derniere_le - interval '1 hour' THEN EXCLUDED.derniere_le ELSE a.derniere_le END,
      plateforme = CASE WHEN ${rang("EXCLUDED.plateforme")} > ${rang("a.plateforme")} THEN EXCLUDED.plateforme ELSE a.plateforme END,
      site_id = COALESCE(EXCLUDED.site_id, a.site_id),
      classe_id = COALESCE(EXCLUDED.classe_id, a.classe_id)`);
}

/** Pour les essais : oublie ce qui a été écrit (simule un redémarrage). */
export function oublierActivite() {
  ecrit.clear();
}

// Conservation : 400 jours d'activité quotidienne, pas davantage.
planifier("activite-jours-purge", 24 * HEURE_MS, async () => {
  await db.execute(sql`DELETE FROM campus.activite_jours WHERE jour < (now() AT TIME ZONE 'Africa/Abidjan')::date - ${CONSERVATION_ACTIVITE_JOURS}::int`);
});
