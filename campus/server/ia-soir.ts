// IA du soir : le travail de fond sans crédit d'API.
//
// Avec CAMPUS_IA_SOIR=oui, une demande de fond (cours complet tiré d'un enregistrement, dossier de lecture
// d'un livre) n'appelle pas l'API : elle est gardée dans demandes_ia avec ses consignes et le schéma de la
// réponse, et le travail s'arrête là (IaDuSoir). Le soir, la routine (campus/TRAVAUX-IA.md) répond à chaque
// demande par /api/travaux-ia ; le campus vérifie la réponse contre le schéma, puis relance le travail, qui
// relit ces réponses (même demande, même empreinte) et avance jusqu'à la demande suivante ou jusqu'au bout.
import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { and, asc, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { config } from "./config";
import { db } from "./db";
import { planifier } from "./taches";
import { demandesIa, type RequeteIaDuSoir } from "@shared/schema";

export const iaDuSoir = () => config.ia.soir;

/** Le travail attend la routine du soir : ce n'est pas une erreur. */
export class IaDuSoir extends Error {
  constructor() {
    super("Travail d'IA prévu ce soir.");
    this.name = "IaDuSoir";
  }
}
export const estIaDuSoir = (e: unknown): e is IaDuSoir => e instanceof IaDuSoir;

// Le travail en cours (« cours-complet:17 ») suit chaque demande sans passer par tous les appels.
const origines = new AsyncLocalStorage<string>();
export const avecOrigine = <T>(origine: string, f: () => Promise<T>): Promise<T> => origines.run(origine, f);

const empreinte = (r: RequeteIaDuSoir) => crypto.createHash("sha256").update(JSON.stringify(r)).digest("hex");

/** Réponse déjà donnée par la routine, sinon la demande est gardée et le travail s'arrête (IaDuSoir). */
export async function demanderLeSoir<T>(r: RequeteIaDuSoir): Promise<T> {
  const cle = empreinte(r);
  const [d] = await db.select({ reponse: demandesIa.reponse, reponduLe: demandesIa.reponduLe }).from(demandesIa).where(eq(demandesIa.cle, cle));
  if (d?.reponduLe) return d.reponse as T;
  if (!d) await db.insert(demandesIa).values({ cle, origine: origines.getStore() ?? "inconnue", requete: r }).onConflictDoNothing();
  throw new IaDuSoir();
}

// ── Pour la routine ────────────────────────────────────────────────────────

export type DemandeEnAttente = { id: number; origine: string; creeLe: string; taille: number; images: number };

export async function demandesEnAttente(): Promise<DemandeEnAttente[]> {
  const lignes = await db
    .select({
      id: demandesIa.id,
      origine: demandesIa.origine,
      creeLe: demandesIa.creeLe,
      taille: sql<number>`length(${demandesIa.requete}::text)`,
      images: sql<number>`(select count(*) from jsonb_path_query(${demandesIa.requete}, 'lax $.messages[*].content[*] ? (@.type == "image")'))::int`,
    })
    .from(demandesIa)
    .where(isNull(demandesIa.reponduLe))
    .orderBy(asc(demandesIa.id));
  return lignes.map((l) => ({ ...l, creeLe: l.creeLe.toISOString() }));
}

export async function demande(id: number) {
  const [d] = await db.select().from(demandesIa).where(eq(demandesIa.id, id));
  return d ?? null;
}

/** Garde la réponse de la routine si elle respecte le schéma de la demande ; sinon, la liste des écarts. */
export async function repondre(id: number, reponse: unknown): Promise<{ ok: true } | { ok: false; ecarts: string[] }> {
  const d = await demande(id);
  if (!d) return { ok: false, ecarts: ["demande introuvable"] };
  if (d.reponduLe) return { ok: true };
  const ecarts = verifier(d.requete.schema, reponse, "réponse");
  if (ecarts.length) return { ok: false, ecarts: ecarts.slice(0, 30) };
  await db
    .update(demandesIa)
    .set({ reponse: reponse as never, reponduLe: new Date() })
    .where(and(eq(demandesIa.id, id), isNull(demandesIa.reponduLe)));
  return { ok: true };
}

/**
 * Contrôle d'une réponse contre le schéma JSON des sorties structurées (le sous-ensemble utilisé par le campus :
 * objets aux propriétés toutes requises, listes, chaînes, énumérations, entiers, nombres, booléens).
 */
export function verifier(schema: Record<string, unknown>, valeur: unknown, chemin: string): string[] {
  const type = schema.type;
  if (Array.isArray(schema.enum) && !schema.enum.includes(valeur)) return [`${chemin} : une valeur parmi ${schema.enum.map((v) => JSON.stringify(v)).join(", ")}`];
  switch (type) {
    case "object": {
      if (!valeur || typeof valeur !== "object" || Array.isArray(valeur)) return [`${chemin} : un objet est attendu`];
      const objet = valeur as Record<string, unknown>;
      const proprietes = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
      const ecarts: string[] = [];
      for (const cle of (schema.required as string[] | undefined) ?? []) if (!(cle in objet)) ecarts.push(`${chemin}.${cle} : manquant`);
      if (schema.additionalProperties === false) for (const cle of Object.keys(objet)) if (!(cle in proprietes)) ecarts.push(`${chemin}.${cle} : propriété inconnue`);
      for (const [cle, sous] of Object.entries(proprietes)) if (cle in objet) ecarts.push(...verifier(sous, objet[cle], `${chemin}.${cle}`));
      return ecarts;
    }
    case "array": {
      if (!Array.isArray(valeur)) return [`${chemin} : une liste est attendue`];
      const items = schema.items as Record<string, unknown> | undefined;
      return items ? valeur.flatMap((v, i) => verifier(items, v, `${chemin}[${i}]`)) : [];
    }
    case "string":
      return typeof valeur === "string" ? [] : [`${chemin} : un texte est attendu`];
    case "integer":
      return Number.isInteger(valeur) ? [] : [`${chemin} : un nombre entier est attendu`];
    case "number":
      return typeof valeur === "number" && Number.isFinite(valeur) ? [] : [`${chemin} : un nombre est attendu`];
    case "boolean":
      return typeof valeur === "boolean" ? [] : [`${chemin} : vrai ou faux est attendu`];
    default:
      return [];
  }
}

/** Ménage : les demandes répondues depuis plus de 30 jours (leur travail est fini depuis longtemps). */
planifier("ia-soir-menage", 24 * 3600_000, async () => {
  await db.delete(demandesIa).where(and(isNotNull(demandesIa.reponduLe), lt(demandesIa.reponduLe, new Date(Date.now() - 30 * 24 * 3600_000))));
});
