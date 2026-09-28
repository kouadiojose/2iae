// Calculs de la scolarité, partagés par le CRM, la page Scolarité et
// l'espace de l'étudiant : une seule règle, écrite une fois.
//
// - Les remises s'imputent sur les DERNIÈRES échéances (la fin de l'année
//   s'allège, les premières tranches restent dues).
// - Les versements couvrent les échéances dans l'ordre de leurs dates.
// - Une échéance est en retard quand sa date est passée (la veille ou avant)
//   sans être couverte. Jours à l'heure d'Abidjan (= UTC).
// - Les numéros de reçu suivent l'année civile : REC-2026-00001, sans trou
//   (un reçu annulé garde son numéro).
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import {
  echeancesEtudiants,
  versements,
  fraisClasses,
  utilisateurs,
  type EcheanceEtat,
  type SituationFinanciere,
  type ScolariteEtudiant,
  type VersementCrm,
  type LigneEcheancier,
  type MoyenPaiement,
} from "@shared/schema";

/** Aujourd'hui, AAAA-MM-JJ (Abidjan = UTC). */
export const aujourdhui = () => new Date().toISOString().slice(0, 10);

export type EcheanceCalcul = { id: number; type: "frais" | "remise"; libelle: string; montant: number; dateLimite: string | null };

/** Tri des échéances : par date (sans date à la fin), puis par ordre de saisie. */
function parDate(a: EcheanceCalcul, b: EcheanceCalcul) {
  if (a.dateLimite === b.dateLimite) return a.id - b.id;
  if (!a.dateLimite) return 1;
  if (!b.dateLimite) return -1;
  return a.dateLimite < b.dateLimite ? -1 : 1;
}

/**
 * État de chaque échéance et situation d'ensemble, pour une année scolaire.
 * paye = total des versements valides de cette année.
 */
export function calculerScolarite(
  annee: string,
  lignes: EcheanceCalcul[],
  paye: number,
  jour = aujourdhui(),
): { echeances: EcheanceEtat[]; situation: SituationFinanciere | null } {
  const frais = lignes.filter((l) => l.type === "frais").sort(parDate);
  const remises = lignes.filter((l) => l.type === "remise");
  if (!frais.length && !remises.length) return { echeances: [], situation: null };

  // Remises imputées depuis la dernière échéance.
  let aImputer = remises.reduce((t, r) => t + r.montant, 0);
  const net = new Map<number, number>();
  for (let i = frais.length - 1; i >= 0; i--) {
    const retire = Math.min(frais[i].montant, aImputer);
    aImputer -= retire;
    net.set(frais[i].id, frais[i].montant - retire);
  }

  // Versements imputés dans l'ordre des dates.
  let reste = paye;
  let retard = 0;
  let prochaine: SituationFinanciere["prochaine"] = null;
  const etats: EcheanceEtat[] = frais.map((f) => {
    const n = net.get(f.id) ?? f.montant;
    const couvert = Math.min(n, Math.max(0, reste));
    reste -= couvert;
    const du = n - couvert;
    const echue = f.dateLimite !== null && f.dateLimite < jour;
    let etat: EcheanceEtat["etat"];
    if (du <= 0) etat = "payee";
    else if (echue) {
      etat = "en_retard";
      retard += du;
    } else {
      etat = couvert > 0 ? "partielle" : "a_venir";
      if (!prochaine) prochaine = { libelle: f.libelle, date: f.dateLimite, reste: du };
    }
    return { id: f.id, type: "frais", libelle: f.libelle, montant: f.montant, net: n, dateLimite: f.dateLimite, couvert, etat };
  });
  const lignesRemises: EcheanceEtat[] = remises.map((r) => ({
    id: r.id,
    type: "remise",
    libelle: r.libelle,
    montant: r.montant,
    net: r.montant,
    dateLimite: r.dateLimite,
    couvert: 0,
    etat: "remise",
  }));

  const du = Math.max(0, frais.reduce((t, f) => t + f.montant, 0) - remises.reduce((t, r) => t + r.montant, 0));
  return {
    echeances: [...etats, ...lignesRemises],
    situation: { anneeScolaire: annee, du, paye, reste: Math.max(0, du - paye), retard, prochaine },
  };
}

/** Année retenue pour un étudiant : celle de sa classe si elle a des échéances, sinon la plus récente qui en a. */
export function anneeRetenue(anneeClasse: string | null, anneesAvecEcheances: string[]): string | null {
  if (anneeClasse && anneesAvecEcheances.includes(anneeClasse)) return anneeClasse;
  const triees = [...anneesAvecEcheances].sort();
  return triees.at(-1) ?? anneeClasse;
}

/**
 * Situations de plusieurs étudiants d'un coup (listes, tableaux) : deux requêtes
 * au total. anneeClasse : l'année scolaire de la classe actuelle de chacun.
 */
export async function situationsDe(etudiants: { id: number; anneeClasse: string | null }[], jour = aujourdhui()): Promise<Map<number, SituationFinanciere | null>> {
  const resultat = new Map<number, SituationFinanciere | null>();
  if (!etudiants.length) return resultat;
  const ids = etudiants.map((e) => e.id);
  const lignes: (EcheanceCalcul & { etudiantId: number; annee: string })[] = [];
  const payes = new Map<string, number>();
  // Par paquets : une liste d'identifiants reste raisonnable dans une requête.
  for (let i = 0; i < ids.length; i += 2000) {
    const paquet = ids.slice(i, i + 2000);
    const e = await db
      .select({
        id: echeancesEtudiants.id,
        etudiantId: echeancesEtudiants.etudiantId,
        annee: echeancesEtudiants.anneeScolaire,
        type: echeancesEtudiants.type,
        libelle: echeancesEtudiants.libelle,
        montant: echeancesEtudiants.montant,
        dateLimite: echeancesEtudiants.dateLimite,
      })
      .from(echeancesEtudiants)
      .where(inArray(echeancesEtudiants.etudiantId, paquet));
    lignes.push(...e);
    const v = await db
      .select({ etudiantId: versements.etudiantId, annee: versements.anneeScolaire, total: sql<number>`sum(${versements.montant})::int` })
      .from(versements)
      .where(and(inArray(versements.etudiantId, paquet), isNull(versements.annuleLe)))
      .groupBy(versements.etudiantId, versements.anneeScolaire);
    for (const l of v) payes.set(`${l.etudiantId}|${l.annee}`, l.total);
  }
  const parEtudiant = new Map<number, typeof lignes>();
  for (const l of lignes) parEtudiant.set(l.etudiantId, [...(parEtudiant.get(l.etudiantId) ?? []), l]);
  for (const e of etudiants) {
    const siennes = parEtudiant.get(e.id) ?? [];
    const annee = anneeRetenue(e.anneeClasse, [...new Set(siennes.map((l) => l.annee))]);
    if (!annee || !siennes.length) {
      resultat.set(e.id, null);
      continue;
    }
    const { situation } = calculerScolarite(
      annee,
      siennes.filter((l) => l.annee === annee),
      payes.get(`${e.id}|${annee}`) ?? 0,
      jour,
    );
    resultat.set(e.id, situation);
  }
  return resultat;
}

type VersementAvecAuteurs = typeof versements.$inferSelect & { encaissePar: string | null; annulePar: string | null };

export function versVersementCrm(v: VersementAvecAuteurs, avecAuteurs = true): VersementCrm {
  return {
    id: v.id,
    numero: v.numero,
    montant: v.montant,
    moyen: v.moyen,
    reference: v.reference,
    dateVersement: v.dateVersement,
    note: avecAuteurs ? v.note : null,
    encaissePar: avecAuteurs ? v.encaissePar : null,
    creeLe: v.creeLe.toISOString(),
    annule: v.annuleLe ? { le: v.annuleLe.toISOString(), par: avecAuteurs ? v.annulePar : null, motif: v.motifAnnulation } : null,
  };
}

/** Versements d'un étudiant (les plus récents d'abord), avec le nom de qui les a encaissés ou annulés. */
export async function versementsDe(etudiantId: number): Promise<VersementAvecAuteurs[]> {
  const r = await db.execute<Record<string, unknown>>(sql`
    SELECT v.*, NULLIF(trim(coalesce(e.prenom, '') || ' ' || coalesce(e.nom, '')), '') AS encaisse_par_nom,
      NULLIF(trim(coalesce(a.prenom, '') || ' ' || coalesce(a.nom, '')), '') AS annule_par_nom
    FROM campus.versements v
    LEFT JOIN campus.utilisateurs e ON e.id = v.encaisse_par_id
    LEFT JOIN campus.utilisateurs a ON a.id = v.annule_par_id
    WHERE v.etudiant_id = ${etudiantId}
    ORDER BY v.date_versement DESC, v.id DESC`);
  return r.rows.map((l) => ({
    id: Number(l.id),
    numero: String(l.numero),
    etudiantId: Number(l.etudiant_id),
    anneeScolaire: String(l.annee_scolaire),
    montant: Number(l.montant),
    moyen: l.moyen as MoyenPaiement,
    reference: (l.reference as string | null) ?? null,
    dateVersement: jourDe(l.date_versement),
    note: (l.note as string | null) ?? null,
    encaisseParId: (l.encaisse_par_id as number | null) ?? null,
    creeLe: new Date(l.cree_le as string),
    annuleLe: l.annule_le ? new Date(l.annule_le as string) : null,
    annuleParId: (l.annule_par_id as number | null) ?? null,
    motifAnnulation: (l.motif_annulation as string | null) ?? null,
    encaissePar: (l.encaisse_par_nom as string | null) ?? null,
    annulePar: (l.annule_par_nom as string | null) ?? null,
  }));
}

/** Une colonne « date » lue en SQL brut (chaîne ou Date selon le pilote) → AAAA-MM-JJ. */
export function jourDe(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

/** La scolarité complète d'un étudiant (dossier CRM, espace étudiant). */
export async function scolariteDe(e: { id: number; classeId: number | null }, anneeClasse: string | null, avecAuteurs = true): Promise<ScolariteEtudiant> {
  const lignes = await db
    .select()
    .from(echeancesEtudiants)
    .where(eq(echeancesEtudiants.etudiantId, e.id))
    .orderBy(asc(echeancesEtudiants.dateLimite), asc(echeancesEtudiants.id));
  const tous = await versementsDe(e.id);
  const annee = anneeRetenue(anneeClasse, [...new Set(lignes.map((l) => l.anneeScolaire))]);
  const [modele] = e.classeId ? await db.select({ echeancier: fraisClasses.echeancier }).from(fraisClasses).where(eq(fraisClasses.classeId, e.classeId)) : [];
  const fraisClasse = modele && modele.echeancier.length ? modele.echeancier : null;
  if (!annee) return { anneeScolaire: null, echeances: [], versements: tous.map((v) => versVersementCrm(v, avecAuteurs)), situation: null, fraisClasse };
  const paye = tous.filter((v) => v.anneeScolaire === annee && !v.annuleLe).reduce((t, v) => t + v.montant, 0);
  const { echeances, situation } = calculerScolarite(
    annee,
    lignes.filter((l) => l.anneeScolaire === annee),
    paye,
  );
  return {
    anneeScolaire: annee,
    echeances,
    // Les versements de l'année d'abord, puis ceux des autres années (historique).
    versements: [...tous.filter((v) => v.anneeScolaire === annee), ...tous.filter((v) => v.anneeScolaire !== annee)].map((v) => versVersementCrm(v, avecAuteurs)),
    situation,
    fraisClasse,
  };
}

/** Copie un échéancier modèle à un étudiant (dans une transaction fournie ou non). */
export async function copierEcheancier(
  tx: Pick<typeof db, "insert">,
  etudiantId: number,
  annee: string,
  modele: LigneEcheancier[],
  auteurId: number | null,
) {
  const lignes = modele.filter((l) => l.montant > 0);
  if (!lignes.length) return 0;
  await tx.insert(echeancesEtudiants).values(
    lignes.map((l) => ({ etudiantId, anneeScolaire: annee, type: "frais" as const, libelle: l.libelle, montant: l.montant, dateLimite: l.date, creeParId: auteurId })),
  );
  return lignes.length;
}

/**
 * Prochain numéro de reçu de l'année civile, sous verrou (deux guichets qui
 * encaissent à la même seconde n'obtiennent jamais le même numéro).
 */
export async function prochainNumeroRecu(tx: Pick<typeof db, "execute">, annee = new Date().getUTCFullYear()): Promise<string> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(727001)`);
  const prefixe = `REC-${annee}-`;
  const r = await tx.execute<{ max: string | null }>(sql`SELECT max(numero) AS max FROM campus.versements WHERE numero LIKE ${`${prefixe}%`}`);
  const dernier = r.rows[0]?.max;
  const n = dernier ? Number(dernier.slice(prefixe.length)) + 1 : 1;
  return `${prefixe}${String(n).padStart(5, "0")}`;
}

/** Montant lisible : « 150 000 F CFA ». */
export const fcfa = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n).replace(/ /g, " ")} F CFA`;

// ── Montant en lettres (reçus) ─────────────────────────────────────────────

const UNITES = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"];
const DIZAINES = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante"];

/** 0 à 99. */
function moinsDeCent(n: number): string {
  if (n <= 16) return UNITES[n];
  if (n < 20) return `dix-${UNITES[n - 10]}`;
  if (n < 70) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return DIZAINES[d];
    if (u === 1) return `${DIZAINES[d]} et un`;
    return `${DIZAINES[d]}-${UNITES[u]}`;
  }
  if (n < 80) return n === 71 ? "soixante et onze" : `soixante-${moinsDeCent(n - 60)}`;
  if (n === 80) return "quatre-vingts";
  return `quatre-vingt-${moinsDeCent(n - 80)}`;
}

/** 0 à 999 ; final : le nombre n'est suivi de rien (« deux cents », mais « deux cent mille »). */
function moinsDeMille(n: number, final: boolean): string {
  const c = Math.floor(n / 100);
  const r = n % 100;
  let texte = "";
  if (c === 1) texte = "cent";
  else if (c > 1) texte = `${UNITES[c]} cent${r === 0 && final ? "s" : ""}`;
  if (r) {
    let fin = moinsDeCent(r);
    if (!final && fin === "quatre-vingts") fin = "quatre-vingt";
    texte = texte ? `${texte} ${fin}` : fin;
  }
  return texte;
}

/** « cent cinquante mille » : entier positif en toutes lettres (orthographe traditionnelle). */
export function enLettres(montant: number): string {
  const n = Math.floor(Math.abs(montant));
  if (n === 0) return "zéro";
  const milliards = Math.floor(n / 1e9);
  const millions = Math.floor((n % 1e9) / 1e6);
  const milliers = Math.floor((n % 1e6) / 1e3);
  const reste = n % 1e3;
  const morceaux: string[] = [];
  if (milliards) morceaux.push(`${moinsDeMille(milliards, true)} milliard${milliards > 1 ? "s" : ""}`);
  if (millions) morceaux.push(`${moinsDeMille(millions, true)} million${millions > 1 ? "s" : ""}`);
  if (milliers) morceaux.push(milliers === 1 ? "mille" : `${moinsDeMille(milliers, false)} mille`);
  if (reste) morceaux.push(moinsDeMille(reste, true));
  return morceaux.join(" ");
}

/** Date du dernier versement non annulé de chaque étudiant (listes des retards). */
export async function derniersVersements(ids: number[]): Promise<Map<number, string>> {
  const m = new Map<number, string>();
  if (!ids.length) return m;
  const r = await db
    .select({ etudiantId: versements.etudiantId, dernier: sql<string>`max(${versements.dateVersement})::text` })
    .from(versements)
    .where(and(inArray(versements.etudiantId, ids), isNull(versements.annuleLe)))
    .groupBy(versements.etudiantId);
  for (const l of r) m.set(l.etudiantId, l.dernier);
  return m;
}

/** Nom affichable d'un compte (encaissé par…). */
export async function nomDe(id: number | null): Promise<string | null> {
  if (!id) return null;
  const [u] = await db.select({ prenom: utilisateurs.prenom, nom: utilisateurs.nom }).from(utilisateurs).where(eq(utilisateurs.id, id));
  return u ? `${u.prenom} ${u.nom}` : null;
}

