// Ouverture automatique des classes : le réglage de la direction et le début du cours en SQL.
//
// Le réglage vit dans contenus_site, clé « pilotage.ouverture-auto » ({ actif, minutes }) : le site public ne
// sert que sa liste blanche de clés (lireContenus, routes/public.ts), jamais « pilotage.* ». Sans ligne en base,
// c'est le défaut : actif, 30 minutes avant (shared/ouverture.ts). La tâche qui ouvre les classes est dans
// routes/live.ts (« live-ouverture-auto »), la page de réglage dans « Pilotage · visio ».
import { eq, sql, type SQL } from "drizzle-orm";
import { db } from "./db";
import { contenusSite } from "@shared/schema";
import { AVANCE_MAX_OUVERTURE_MIN, CLE_OUVERTURE_AUTO, OUVERTURE_AUTO_PAR_DEFAUT, reglageOuvertureValide, type ReglageOuvertureAuto, type ReglageOuvertureAutoDto } from "@shared/ouverture";

/**
 * Repère posé dans rappels_live (seance_id, type) : « cette séance ne s'ouvre plus d'elle-même à cet horaire ».
 * Posé par l'ouverture automatique (une seule fois par séance et par horaire) et par « C'était un essai » dans
 * l'heure qui précède le cours ; effacé avec les autres rappels quand la séance change d'horaire.
 */
export const REPERE_OUVERTURE_AUTO = "ouverture-auto";

let cache: { reglage: ReglageOuvertureAuto; majLe: Date | null } | null = null;

/** Le réglage courant (gardé en mémoire : une seule instance, vidé à chaque modification). */
export async function lireReglageOuverture(): Promise<ReglageOuvertureAuto & { majLe: Date | null }> {
  if (!cache) {
    const [l] = await db.select({ valeur: contenusSite.valeur, majLe: contenusSite.majLe }).from(contenusSite).where(eq(contenusSite.cle, CLE_OUVERTURE_AUTO));
    cache = l ? { reglage: reglageOuvertureValide(l.valeur), majLe: l.majLe } : { reglage: { ...OUVERTURE_AUTO_PAR_DEFAUT }, majLe: null };
  }
  return { ...cache.reglage, majLe: cache.majLe };
}

export async function reglageOuvertureDto(): Promise<ReglageOuvertureAutoDto> {
  const r = await lireReglageOuverture();
  return { actif: r.actif, minutes: r.minutes, majLe: r.majLe ? r.majLe.toISOString() : null };
}

export async function enregistrerReglageOuverture(r: ReglageOuvertureAuto, parId: number): Promise<ReglageOuvertureAutoDto> {
  const valeur = { actif: r.actif, minutes: r.minutes };
  await db
    .insert(contenusSite)
    .values({ cle: CLE_OUVERTURE_AUTO, valeur, majParId: parId })
    .onConflictDoUpdate({ target: contenusSite.cle, set: { valeur, majParId: parId, majLe: new Date() } });
  cache = null;
  return reglageOuvertureDto();
}

/** Pour les essais : oublie le réglage gardé en mémoire. */
export function oublierReglageOuverture() {
  cache = null;
}

/**
 * Début du cours en SQL, même règle que debutDuCours (shared/ouverture.ts), pour une séance d'alias `a`
 * (campus.seances) : l'heure prévue si la séance a été ouverte au plus une heure avant elle, sinon le démarrage
 * réel, sinon l'heure prévue. Jamais NULL.
 */
export function sqlDebutCours(a = "s"): SQL {
  const s = sql.raw(a);
  return sql`(CASE WHEN ${s}.demarree_le < ${s}.debut AND ${s}.demarree_le >= ${s}.debut - make_interval(mins => ${sql.raw(String(AVANCE_MAX_OUVERTURE_MIN))})
    THEN ${s}.debut ELSE COALESCE(${s}.demarree_le, ${s}.debut) END)`;
}
