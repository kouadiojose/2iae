// Badges de l'étudiant (chantier C5) : chacun récompense un acte
// d'apprentissage répété ou réussi (« Assidu » : 5 directs ; « Ponctuel » :
// 5 copies à l'heure…), jamais une simple ouverture. Les compteurs se lisent
// dans le registre des points (campus.activites), dans les interrogations
// (sans faute) et, s'ils existent, dans les tables de la révision (C1). Un
// badge obtenu le reste ; vu_le dit si l'étudiant l'a déjà vu s'afficher.
import { sql } from "drizzle-orm";
import { db } from "../db";
import { tableExiste } from "./tables";
import { BADGES, type CodeBadge, type CompteurBadge } from "@shared/engagement/progression";

export type Compteurs = Record<CompteurBadge, number>;

const vides = (): Compteurs => ({ actes: 0, reponsesRevision: 0, defis: 0, record: 0, directs: 0, sansFaute: 0, questionsVotees: 0, devoirsALHeure: 0, objectifs: 0 });

/** Tableau d'entiers PostgreSQL en un seul paramètre. */
const entiers = (ids: number[]) => sql`${`{${ids.map((i) => Math.trunc(i)).join(",")}}`}::int[]`;

/** Une colonne existe-t-elle dans une table du schéma campus ? */
async function colonneExiste(table: string, colonne: string): Promise<boolean> {
  const r = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'campus' AND table_name = ${table} AND column_name = ${colonne}`,
  );
  return (r.rows[0]?.n ?? 0) > 0;
}

/** Badges qui peuvent s'obtenir aujourd'hui : ceux dont la table source existe. */
export async function badgesDisponibles(): Promise<CodeBadge[]> {
  const codes: CodeBadge[] = [];
  for (const b of BADGES) if (!("source" in b) || (await tableExiste(b.source))) codes.push(b.code);
  return codes;
}

/** Compteurs des badges pour ces étudiants. */
export async function compteursBadges(uids: number[]): Promise<Map<number, Compteurs>> {
  const ids = [...new Set(uids)].filter((i) => i > 0);
  const resultat = new Map<number, Compteurs>(ids.map((id) => [id, vides()]));
  if (!ids.length) return resultat;
  const [actes, sansFaute, records] = await Promise.all([
    db.execute<{ uid: number; type: string; n: number }>(sql`
      SELECT utilisateur_id AS uid, type, count(*)::int AS n FROM campus.activites
      WHERE utilisateur_id = ANY(${entiers(ids)}) GROUP BY 1, 2`),
    db.execute<{ uid: number; n: number }>(sql`
      SELECT t.etudiant_id AS uid, count(DISTINCT t.devoir_id)::int AS n
      FROM campus.tentatives_quiz t JOIN campus.devoirs d ON d.id = t.devoir_id
      WHERE t.etudiant_id = ANY(${entiers(ids)}) AND t.fin_le IS NOT NULL AND d.type = 'quiz' AND d.bareme > 0 AND t.note IS NOT NULL AND t.note >= d.bareme
      GROUP BY 1`),
    db.execute<{ uid: number; record: number }>(sql`
      SELECT utilisateur_id AS uid, record::int AS record FROM campus.objectifs_semaine WHERE utilisateur_id = ANY(${entiers(ids)})`),
  ]);
  for (const l of actes.rows) {
    const c = resultat.get(l.uid);
    if (!c) continue;
    c.actes += l.n;
    if (l.type === "presence") c.directs = l.n;
    else if (l.type === "devoir") c.devoirsALHeure = l.n;
    else if (l.type === "question_votee") c.questionsVotees = l.n;
    else if (l.type === "objectif") c.objectifs = l.n;
  }
  for (const l of sansFaute.rows) {
    const c = resultat.get(l.uid);
    if (c) c.sansFaute = l.n;
  }
  for (const l of records.rows) {
    const c = resultat.get(l.uid);
    if (c) c.record = l.record;
  }
  // Révision du jour (C1) : toute réponse compte pour la première révision ; le défi de la classe se compte en jours.
  if ((await tableExiste("reponses_revision")) && (await colonneExiste("reponses_revision", "utilisateur_id"))) {
    const avecDefi = (await colonneExiste("reponses_revision", "origine")) && (await colonneExiste("reponses_revision", "jour"));
    const r = await db.execute<{ uid: number; n: number; defis: number }>(sql`
      SELECT utilisateur_id AS uid, count(*)::int AS n,
        ${avecDefi ? sql`count(DISTINCT jour) FILTER (WHERE origine = 'defi')::int` : sql`0`} AS defis
      FROM campus.reponses_revision WHERE utilisateur_id = ANY(${entiers(ids)}) GROUP BY 1`);
    for (const l of r.rows) {
      const c = resultat.get(l.uid);
      if (!c) continue;
      c.reponsesRevision = l.n;
      c.defis = l.defis;
    }
  }
  return resultat;
}

/** Badges atteints d'après les compteurs, dans l'ordre d'affichage. */
export function badgesAtteints(c: Compteurs, disponibles: CodeBadge[]): CodeBadge[] {
  return BADGES.filter((b) => disponibles.includes(b.code) && c[b.compteur] >= b.seuil).map((b) => b.code);
}

/** Le badge pas encore obtenu le plus proche (part du seuil déjà faite la plus grande). */
export function prochainBadge(c: Compteurs, obtenus: Set<string>, disponibles: CodeBadge[]): { code: CodeBadge; compteur: number; seuil: number } | null {
  let meilleur: { code: CodeBadge; compteur: number; seuil: number; part: number } | null = null;
  for (const b of BADGES) {
    if (obtenus.has(b.code) || !disponibles.includes(b.code)) continue;
    const compteur = Math.min(c[b.compteur], b.seuil);
    const part = compteur / b.seuil;
    if (!meilleur || part > meilleur.part) meilleur = { code: b.code, compteur, seuil: b.seuil, part };
  }
  return meilleur && { code: meilleur.code, compteur: meilleur.compteur, seuil: meilleur.seuil };
}

/** Attribue les badges atteints (une fois chacun) ; renvoie le nombre de badges nouveaux. */
export async function attribuerBadges(uids: number[]): Promise<number> {
  const compteurs = await compteursBadges(uids);
  const disponibles = await badgesDisponibles();
  const lignes: { uid: number; badge: CodeBadge }[] = [];
  for (const [uid, c] of compteurs) for (const badge of badgesAtteints(c, disponibles)) lignes.push({ uid, badge });
  if (!lignes.length) return 0;
  const r = await db.execute(sql`
    INSERT INTO campus.badges_etudiants (utilisateur_id, badge)
    SELECT x.uid, x.badge FROM unnest(${entiers(lignes.map((l) => l.uid))}, ${`{${lignes.map((l) => l.badge).join(",")}}`}::text[]) AS x(uid, badge)
    JOIN campus.utilisateurs u ON u.id = x.uid AND u.role = 'etudiant'
    ON CONFLICT (utilisateur_id, badge) DO NOTHING`);
  return r.rowCount ?? 0;
}
