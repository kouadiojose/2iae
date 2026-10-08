// Semaines actives (chantier C5) : plutôt qu'une flamme quotidienne que
// cassent une coupure de forfait ou de courant (Silverman et Barasch, 2023),
// l'étudiant vise un nombre de jours actifs par semaine (2, 3 ou 5).
//
//   - Un jour est actif s'il compte au moins un acte d'apprentissage.
//   - Une semaine est réussie si ses jours actifs atteignent l'objectif.
//   - Une semaine sans aucune séance de ses cours ni devoir dû est neutre :
//     ratée, elle ne casse pas la série (réussie, elle compte).
//   - Un joker par mois s'applique tout seul à une semaine manquée d'un jour,
//     quand il y a une série à protéger.
//   - Le record est gardé.
// Une présence « inconnue » au direct ne coûte jamais rien : seuls les actes
// comptent, jamais les absences.
//
// La première partie est faite de fonctions pures (essais sans base) ; la
// seconde met à jour campus.objectifs_semaine, semaine terminée par semaine
// terminée.
import { sql } from "drizzle-orm";
import { db } from "../db";
import { ajouterJours, jourLocal, lundiDe, semaineIso, FUSEAU_PAR_DEFAUT, type Jour, type SemaineIso } from "@shared/engagement/calendrier";
import { OBJECTIF_PAR_DEFAUT, estObjectifSemaine, type ResultatSemaine } from "@shared/engagement/progression";
import { RENTREE } from "./bareme";

// ── Fonctions pures ────────────────────────────────────────────────────────

export type EtatSerie = {
  serie: number;
  record: number;
  /** Mois (« 2026-10 ») où le joker a servi. */
  jokerMois: string | null;
  /** Dernière semaine terminée déjà comptée. */
  semaineEvaluee: SemaineIso | null;
  dernier: ResultatSemaine | null;
};

export const ETAT_INITIAL: EtatSerie = { serie: 0, record: 0, jokerMois: null, semaineEvaluee: null, dernier: null };

/** Ce qu'il faut savoir d'une semaine terminée pour la juger. */
export type BilanSemaine = { lundi: Jour; joursActifs: number; neutre: boolean };

/** Mois d'une semaine : celui de son lundi (« 2026-10 »). */
export const moisDe = (lundi: Jour) => lundi.slice(0, 7);

/** Le joker du mois de cette semaine est-il encore là ? */
export const jokerDuMoisLibre = (etat: Pick<EtatSerie, "jokerMois">, lundi: Jour) => etat.jokerMois !== moisDe(lundi);

export function evaluerSemaine(b: { joursActifs: number; objectif: number; neutre: boolean; jokerDisponible: boolean }): ResultatSemaine {
  if (b.joursActifs >= b.objectif) return "reussie";
  if (b.neutre) return "neutre";
  if (b.jokerDisponible && b.joursActifs === b.objectif - 1) return "joker";
  return "manquee";
}

/** Fait avancer la série sur des semaines terminées, dans l'ordre. */
export function avancerSerie(etat: EtatSerie, semaines: BilanSemaine[], objectif: number): EtatSerie {
  const e = { ...etat };
  for (const s of [...semaines].sort((a, b) => a.lundi.localeCompare(b.lundi))) {
    // Le joker ne sert qu'à protéger une série en cours.
    const r = evaluerSemaine({ joursActifs: s.joursActifs, objectif, neutre: s.neutre, jokerDisponible: e.serie > 0 && jokerDuMoisLibre(e, s.lundi) });
    if (r === "reussie") e.serie += 1;
    else if (r === "joker") {
      e.serie += 1;
      e.jokerMois = moisDe(s.lundi);
    } else if (r === "manquee") e.serie = 0;
    e.record = Math.max(e.record, e.serie);
    e.semaineEvaluee = semaineIso(s.lundi);
    e.dernier = r;
  }
  return e;
}

/**
 * Lundis des semaines terminées à juger : depuis le premier lundi de
 * l'étudiant, après la dernière semaine déjà comptée, jusqu'à la semaine en
 * cours exclue.
 */
export function lundisAJuger(premierLundi: Jour, semaineEvaluee: SemaineIso | null, lundiCourant: Jour): Jour[] {
  const lundis: Jour[] = [];
  for (let l = lundiDe(premierLundi); l < lundiCourant; l = ajouterJours(l, 7)) {
    if (!semaineEvaluee || semaineIso(l) > semaineEvaluee) lundis.push(l);
  }
  return lundis;
}

// ── Mise à jour en base ────────────────────────────────────────────────────

/**
 * Une semaine n'est jugée qu'à partir du lundi midi qui la suit : les réponses
 * de révision faites hors ligne le dimanche ont le temps d'arriver.
 */
export const DELAI_BILAN_HEURES = 12;

/** Tableau d'entiers PostgreSQL en un seul paramètre. */
const entiers = (ids: number[]) => sql`${`{${ids.map((i) => Math.trunc(i)).join(",")}}`}::int[]`;

/** Semaine dont le bilan est dû : la semaine en cours, décalée du délai de bilan. */
export const lundiCourantPourBilan = (maintenant: Date, fuseau: string | null) =>
  lundiDe(jourLocal(new Date(maintenant.getTime() - DELAI_BILAN_HEURES * 3600_000), fuseau || FUSEAU_PAR_DEFAUT));

/**
 * Juge les semaines terminées de ces étudiants et met à jour leur série.
 * Renvoie l'état à jour de chacun, et ceux dont une semaine vient d'être jugée. Sans ligne objectifs_semaine, l'étudiant a
 * l'objectif par défaut (3 jours) ; la ligne est créée au premier bilan.
 */
export async function mettreAJourSemaines(
  uids: number[],
  maintenant = new Date(),
): Promise<{ etats: Map<number, EtatSerie & { objectif: number }>; juges: number[] }> {
  const ids = [...new Set(uids)].filter((i) => i > 0);
  const etats = new Map<number, EtatSerie & { objectif: number }>();
  if (!ids.length) return { etats, juges: [] };
  const r = await db.execute<{
    uid: number;
    cree_le: Date;
    fuseau: string | null;
    jours: number | null;
    serie: number | null;
    record: number | null;
    joker_mois: string | null;
    semaine_evaluee: string | null;
    dernier_resultat: ResultatSemaine | null;
  }>(sql`
    SELECT u.id AS uid, u.cree_le, u.fuseau, o.jours, o.serie, o.record, o.joker_mois, o.semaine_evaluee, o.dernier_resultat
    FROM campus.utilisateurs u LEFT JOIN campus.objectifs_semaine o ON o.utilisateur_id = u.id
    WHERE u.id = ANY(${entiers(ids)}) AND u.role = 'etudiant'`);

  type AJuger = { uid: number; etat: EtatSerie; objectif: number; lundis: Jour[] };
  const aJuger: AJuger[] = [];
  for (const l of r.rows) {
    const objectif = estObjectifSemaine(l.jours) ? l.jours : OBJECTIF_PAR_DEFAUT;
    const etat: EtatSerie = {
      serie: l.serie ?? 0,
      record: l.record ?? 0,
      jokerMois: l.joker_mois,
      semaineEvaluee: l.semaine_evaluee,
      dernier: l.dernier_resultat,
    };
    etats.set(l.uid, { ...etat, objectif });
    const debutCompte = lundiDe(jourLocal(l.cree_le, l.fuseau || FUSEAU_PAR_DEFAUT));
    const premierLundi = debutCompte > RENTREE ? debutCompte : lundiDe(RENTREE);
    const lundis = lundisAJuger(premierLundi, etat.semaineEvaluee, lundiCourantPourBilan(maintenant, l.fuseau));
    if (lundis.length) aJuger.push({ uid: l.uid, etat, objectif, lundis });
  }
  if (!aJuger.length) return { etats, juges: [] };

  const tous = aJuger.flatMap((a) => a.lundis).sort();
  const debut = tous[0];
  const fin = ajouterJours(tous[tous.length - 1], 7);
  const uidsAJuger = aJuger.map((a) => a.uid);
  const [jours, occupees] = await Promise.all([
    // Jours actifs par semaine.
    db.execute<{ uid: number; semaine: string; n: number }>(sql`
      SELECT utilisateur_id AS uid, semaine, count(DISTINCT jour)::int AS n FROM campus.activites
      WHERE utilisateur_id = ANY(${entiers(uidsAJuger)}) AND jour >= ${debut}::date AND jour < ${fin}::date
      GROUP BY 1, 2`),
    // Semaines qui ne sont PAS neutres : une séance de ses cours (non annulée) ou un devoir dû.
    db.execute<{ uid: number; semaine: string }>(sql`
      WITH cu AS (
        SELECT e.id AS uid, cc.cours_id FROM campus.utilisateurs e JOIN campus.cours_classes cc ON cc.classe_id = e.classe_id WHERE e.id = ANY(${entiers(uidsAJuger)})
        UNION SELECT pc.utilisateur_id, cc.cours_id FROM campus.passages_classes pc JOIN campus.cours_classes cc ON cc.classe_id = pc.classe_id WHERE pc.utilisateur_id = ANY(${entiers(uidsAJuger)})
        UNION SELECT i.utilisateur_id, i.cours_id FROM campus.inscriptions i WHERE i.utilisateur_id = ANY(${entiers(uidsAJuger)})
      )
      SELECT DISTINCT cu.uid, to_char((s.debut AT TIME ZONE ${FUSEAU_PAR_DEFAUT})::date, 'IYYY"-W"IW') AS semaine
      FROM cu JOIN campus.seances s ON s.cours_id = cu.cours_id JOIN campus.cours c ON c.id = s.cours_id
      WHERE s.statut <> 'annulee' AND c.statut <> 'brouillon' AND s.debut >= ${debut}::date AND s.debut < ${fin}::date
      UNION
      SELECT DISTINCT cu.uid, to_char((d.date_limite AT TIME ZONE ${FUSEAU_PAR_DEFAUT})::date, 'IYYY"-W"IW')
      FROM cu JOIN campus.devoirs d ON d.cours_id = cu.cours_id JOIN campus.cours c ON c.id = d.cours_id
      WHERE d.publie AND c.statut <> 'brouillon' AND d.date_limite >= ${debut}::date AND d.date_limite < ${fin}::date`),
  ]);
  const joursDe = new Map(jours.rows.map((l) => [`${l.uid}|${l.semaine}`, l.n]));
  const nonNeutres = new Set(occupees.rows.map((l) => `${l.uid}|${l.semaine}`));

  const lignes: { uid: number; e: EtatSerie }[] = [];
  for (const a of aJuger) {
    const bilans = a.lundis.map((lundi) => {
      const cle = `${a.uid}|${semaineIso(lundi)}`;
      return { lundi, joursActifs: joursDe.get(cle) ?? 0, neutre: !nonNeutres.has(cle) };
    });
    const e = avancerSerie(a.etat, bilans, a.objectif);
    etats.set(a.uid, { ...e, objectif: a.objectif });
    lignes.push({ uid: a.uid, e });
  }
  const champ = (f: (l: (typeof lignes)[number]) => string | number | null) =>
    `{${lignes.map((l) => {
      const v = f(l);
      return v === null ? "NULL" : `"${String(v)}"`;
    }).join(",")}}`;
  await db.execute(sql`
    INSERT INTO campus.objectifs_semaine (utilisateur_id, serie, record, joker_mois, semaine_evaluee, dernier_resultat, maj_le)
    SELECT x.uid, x.serie, x.record, x.joker_mois, x.semaine_evaluee, x.dernier_resultat, now()
    FROM unnest(${champ((l) => l.uid)}::int[], ${champ((l) => l.e.serie)}::smallint[], ${champ((l) => l.e.record)}::smallint[],
      ${champ((l) => l.e.jokerMois)}::text[], ${champ((l) => l.e.semaineEvaluee)}::text[], ${champ((l) => l.e.dernier)}::text[])
      AS x(uid, serie, record, joker_mois, semaine_evaluee, dernier_resultat)
    ON CONFLICT (utilisateur_id) DO UPDATE SET serie = EXCLUDED.serie, record = EXCLUDED.record, joker_mois = EXCLUDED.joker_mois,
      semaine_evaluee = EXCLUDED.semaine_evaluee, dernier_resultat = EXCLUDED.dernier_resultat, maj_le = now()`);
  return { etats, juges: lignes.map((l) => l.uid) };
}
