// Routes du chantier C5 (progression et Coupe), branchées par routes/index.ts :
//   GET  /api/progression/moi        étudiant : ses semaines, ses points, ses badges (visible de lui seul)
//   PUT  /api/progression/objectif   étudiant : objectif de la semaine (2, 3 ou 5 jours)
//   POST /api/progression/badges/vus étudiant : les nouveaux badges ont été vus
//   GET  /api/coupe[?vue=bandeau]    tout compte sauf l'écran de salle : la Coupe de la semaine
//   GET  /api/coupe/salle[?site=]    écran de salle (et équipe) : la Coupe des campus, en grand
// Réponses « private, no-cache », sans aucune donnée nominative dans la Coupe :
// des taux de campus et de classes, jamais un étudiant. Un étudiant ne voit le
// rang que dans la moitié haute ; les autres voient leur progression, par
// ordre alphabétique. L'équipe (vouvoyée) voit tous les chiffres de son
// périmètre (perimetreSites), 8 semaines d'historique et le détail des actes.
// Les classements lus sont gardés 5 minutes en mémoire.
import type { Express, Response } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { exigerRole, moi, perimetreSites, estEquipe } from "../auth";
import { route, valider } from "../http";
import { rafraichirPersonne, rattrapageTermine } from "../engagement/registre";
import { mettreAJourSemaines, jokerDuMoisLibre } from "../engagement/semaines";
import { attribuerBadges, badgesDisponibles, compteursBadges, prochainBadge } from "../engagement/badges";
import { estClassee, lireClassement, lundiEnCours, passerCoupe, type ClassementLu, type LigneCoupe } from "../engagement/coupe";
import { COUPE, PLAFONDS, POINTS } from "../engagement/bareme";
import { ajouterJours, jourLocal, lundiDe, semaineIso, FUSEAU_PAR_DEFAUT, type SemaineIso } from "@shared/engagement/calendrier";
import {
  FAMILLE_DU_TYPE,
  LIGUES,
  OBJECTIFS_SEMAINE,
  ligueDuNiveau,
  type BadgeObtenu,
  type BandeauCoupeDto,
  type CodeBadge,
  type CoupeDto,
  type CoupeSalleDto,
  type EntreeCoupe,
  type Famille,
  type LignePoints,
  type Ligue,
  type ListeCoupe,
  type ProgressionMoi,
  type TypeActivite,
} from "@shared/engagement/progression";
import type { Utilisateur } from "@shared/schema";

const ETUDIANT = exigerRole("etudiant");
const prive = (res: Response) => res.setHeader("Cache-Control", "private, no-cache");
const numeroDe = (s: SemaineIso) => Number(s.slice(-2));

// ── Ma progression ─────────────────────────────────────────────────────────

async function progressionDe(u: Utilisateur): Promise<ProgressionMoi> {
  await rafraichirPersonne(u.id);
  const { etats, juges } = await mettreAJourSemaines([u.id]);
  if (juges.length) await attribuerBadges(juges);
  const etat = etats.get(u.id);
  const fuseau = u.fuseau || FUSEAU_PAR_DEFAUT;
  const aujourdhui = jourLocal(new Date(), fuseau);
  const lundi = lundiDe(aujourdhui);
  const [semaine, total, badges, compteurs, disponibles, classe] = await Promise.all([
    db.execute<{ type: TypeActivite; jour: string; cours: string | null; actes: number; points: number }>(sql`
      SELECT a.type, a.jour::text AS jour, c.titre AS cours, count(*)::int AS actes, sum(a.points)::int AS points
      FROM campus.activites a LEFT JOIN campus.cours c ON c.id = a.cours_id
      WHERE a.utilisateur_id = ${u.id} AND a.jour >= ${lundi}::date AND a.jour < ${ajouterJours(lundi, 7)}::date
      GROUP BY 1, 2, 3`),
    db.execute<{ n: number }>(sql`SELECT COALESCE(sum(points), 0)::int AS n FROM campus.activites WHERE utilisateur_id = ${u.id}`),
    db.execute<{ badge: CodeBadge; obtenu_le: Date; vu_le: Date | null }>(
      sql`SELECT badge, obtenu_le, vu_le FROM campus.badges_etudiants WHERE utilisateur_id = ${u.id} ORDER BY obtenu_le, badge`,
    ),
    compteursBadges([u.id]),
    badgesDisponibles(),
    u.classeId ? db.execute<{ nom: string }>(sql`SELECT nom FROM campus.classes WHERE id = ${u.classeId}`) : null,
  ]);

  const joursActifs = new Set<string>();
  const familles = new Set<Famille>();
  const lignes = new Map<string, LignePoints>();
  let pointsSemaine = 0;
  let pointsJour = 0;
  for (const l of semaine.rows) {
    joursActifs.add(l.jour);
    const famille = FAMILLE_DU_TYPE[l.type] ?? "direct";
    familles.add(famille);
    pointsSemaine += l.points;
    if (l.jour === aujourdhui) pointsJour += l.points;
    const k = `${famille}|${l.cours ?? ""}`;
    const ligne = lignes.get(k) ?? { famille, cours: l.cours, actes: 0, points: 0 };
    ligne.points += l.points;
    // Un bonus (seuil de présence, question soutenue…) n'est pas un acte de plus.
    if (!["presence_seuil", "quiz_reussi", "question_votee"].includes(l.type)) ligne.actes += l.actes;
    lignes.set(k, ligne);
  }
  const obtenus: BadgeObtenu[] = badges.rows.map((b) => ({ code: b.badge, obtenuLe: new Date(b.obtenu_le).toISOString(), nouveau: !b.vu_le }));
  const objectif = (etat?.objectif ?? 3) as ProgressionMoi["semaine"]["objectif"];
  return {
    semaine: { iso: semaineIso(lundi), numero: numeroDe(semaineIso(lundi)), lundi, aujourdhui, joursActifs: [...joursActifs].sort(), objectif },
    serie: {
      actuelle: etat?.serie ?? 0,
      record: etat?.record ?? 0,
      jokerDisponible: jokerDuMoisLibre({ jokerMois: etat?.jokerMois ?? null }, lundi),
      derniere: etat?.dernier ?? null,
    },
    points: {
      semaine: pointsSemaine,
      aujourdhui: pointsJour,
      total: total.rows[0]?.n ?? 0,
      detail: [...lignes.values()].sort((a, b) => b.points - a.points).slice(0, 10),
    },
    badges: {
      obtenus,
      // compteursBadges renvoie une ligne (à zéro au besoin) pour chaque étudiant demandé.
      prochain: prochainBadge(compteurs.get(u.id)!, new Set(obtenus.map((b) => b.code)), disponibles),
      disponibles,
    },
    contribution: { familles: familles.size, compte: familles.size >= COUPE.famillesParticipation, classe: classe?.rows[0]?.nom ?? null },
    bareme: { points: POINTS, plafonds: PLAFONDS },
  };
}

// ── Coupe : lecture gardée 5 minutes ───────────────────────────────────────

const GARDE_MS = 5 * 60_000;
const memoire = new Map<SemaineIso, { lu: ClassementLu | null; le: number }>();
let calculEnCours: Promise<unknown> | null = null;

async function classement(semaine: SemaineIso): Promise<ClassementLu | null> {
  const connu = memoire.get(semaine);
  if (connu && Date.now() - connu.le < GARDE_MS) return connu.lu;
  let lu = await lireClassement(semaine);
  // Semaine en cours pas encore calculée (lundi 0 h, premier démarrage) : un passage tout de suite, une seule fois à la fois.
  if (!lu && semaine === semaineIso(lundiEnCours()) && rattrapageTermine()) {
    calculEnCours ??= passerCoupe().finally(() => (calculEnCours = null));
    await calculEnCours;
    lu = await lireClassement(semaine);
  }
  // Une semaine pas encore calculée n'est pas gardée : elle s'affiche dès le prochain passage.
  if (lu) memoire.set(semaine, { lu, le: Date.now() });
  return lu;
}

/** Arrondi d'affichage : un taux entier, une progression au point près. */
const entier = (n: number | null) => (n === null ? null : Math.round(n));

function entree(l: LigneCoupe, personnel: boolean, moiCible: number | null): EntreeCoupe {
  return {
    id: l.cibleId,
    nom: l.nom,
    score: entier(l.score),
    participation: entier(l.tauxParticipation),
    presence: entier(l.presenceDirect),
    progression: entier(l.progression),
    rang: l.rang,
    trophees: l.trophees,
    ...(moiCible === l.cibleId && { moi: true }),
    ...(personnel && {
      detail: {
        inscrits: l.inscrits,
        participants: l.participants,
        assidus: l.assidus,
        pointsMoyens: Math.round(l.pointsMoyens),
        seances: l.seancesEmargees,
        classee: estClassee(l),
      },
    }),
  };
}

/**
 * Une liste de la Coupe. Vue étudiante : la moitié haute avec rang et taux ;
 * les autres par ordre alphabétique, avec leur progression seulement si elle
 * est positive (jamais de liste des derniers). Équipe : tout, hors classement compris.
 */
function liste(lignes: LigneCoupe[], personnel: boolean, moiCible: number | null): ListeCoupe {
  const classees = lignes.filter(estClassee).sort((a, b) => (a.rang ?? 999) - (b.rang ?? 999) || a.nom.localeCompare(b.nom, "fr"));
  if (personnel) {
    return {
      haut: classees.map((l) => entree(l, true, moiCible)),
      autres: lignes.filter((l) => !estClassee(l) && l.inscrits > 0).sort((a, b) => a.nom.localeCompare(b.nom, "fr")).map((l) => entree(l, true, moiCible)),
    };
  }
  const moitie = Math.ceil(classees.length / 2);
  const haut = classees.filter((l) => (l.rang ?? 999) <= moitie);
  const autres = classees.filter((l) => (l.rang ?? 999) > moitie).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  return {
    haut: haut.map((l) => entree(l, false, moiCible)),
    autres: autres.map((l) => {
      const e = entree(l, false, moiCible);
      return { ...e, score: null, participation: null, presence: null, rang: null, progression: e.progression !== null && e.progression > 0 ? e.progression : null };
    }),
  };
}

const rangVisible = (lignes: LigneCoupe[], l: LigneCoupe | undefined) => {
  if (!l?.rang || !estClassee(l)) return null;
  const n = lignes.filter((x) => x.ligue === l.ligue && estClassee(x)).length;
  return l.rang <= Math.ceil(n / 2) ? l.rang : null;
};

/** Le campus en tête (s'il a déjà un taux), sinon personne : une semaine qui commence n'a pas de meneur. */
const meneurDe = (campus: LigneCoupe[]) => campus.find((l) => l.rang === 1 && l.score > 0)?.nom ?? null;

async function coupeDe(u: Utilisateur): Promise<CoupeDto> {
  const lundi = lundiEnCours();
  const semaine = semaineIso(lundi);
  const precedenteIso = semaineIso(ajouterJours(lundi, -7));
  const [lu, avant] = await Promise.all([classement(semaine), classement(precedenteIso)]);
  const personnel = estEquipe(u);
  const perimetre = personnel ? perimetreSites(u) : null;
  const dansPerimetre = (l: LigneCoupe) => l.portee === "campus" || !perimetre || (l.siteId !== null && l.siteId !== undefined && perimetre.includes(l.siteId));
  const lignes = (lu?.lignes ?? []).filter(dansPerimetre);
  const campus = lignes.filter((l) => l.portee === "campus");
  const classes = lignes.filter((l) => l.portee === "classe");
  const maLigneClasse = u.role === "etudiant" && u.classeId ? classes.find((l) => l.cibleId === u.classeId) : undefined;
  let maLigue: Ligue | null = maLigneClasse ? (maLigneClasse.ligue as Ligue) : null;
  if (u.role === "etudiant" && u.classeId && !maLigue) {
    const r = await db.execute<{ niveau: string }>(sql`SELECT niveau FROM campus.classes WHERE id = ${u.classeId}`);
    if (r.rows[0]) maLigue = ligueDuNiveau(r.rows[0].niveau);
  }
  const liguesMontrees = u.role === "etudiant" ? (maLigue ? [maLigue] : []) : [...LIGUES];
  const monCampus = u.role === "etudiant" ? u.siteId : null;

  const precedente =
    avant && avant.figee
      ? {
          numero: numeroDe(precedenteIso),
          essai: avant.essai,
          laureats: avant.lignes
            .filter(dansPerimetre)
            .filter((l) => l.portee === "campus" || u.role !== "etudiant" || l.ligue === maLigue)
            .flatMap((l) => l.trophees.map((trophee) => ({ trophee, portee: l.portee, nom: l.nom }))),
        }
      : null;

  const dto: CoupeDto = {
    semaine: { iso: semaine, numero: numeroDe(semaine), lundi, essai: lu?.essai ?? false, figee: lu?.figee ?? false, majLe: lu?.majLe ? new Date(lu.majLe).toISOString() : null },
    personnel,
    campus: { ...liste(campus, personnel, monCampus), bientot: campus.filter((l) => l.inscrits === 0).map((l) => l.nom) },
    ligues: liguesMontrees.map((ligue) => ({ ligue, ...liste(classes.filter((l) => l.ligue === ligue), personnel, maLigneClasse?.cibleId ?? null) })),
    maClasse: maLigneClasse
      ? {
          nom: maLigneClasse.nom,
          inscrits: maLigneClasse.inscrits,
          participants: maLigneClasse.participants,
          objectifEquipe: Math.ceil((maLigneClasse.inscrits * COUPE.seuilEquipe) / 100),
          classee: estClassee(maLigneClasse),
          ligue: maLigneClasse.ligue as Ligue,
        }
      : null,
    precedente,
  };
  if (personnel) {
    const semaines = Array.from({ length: COUPE.semainesHistorique }, (_, i) => semaineIso(ajouterJours(lundi, -7 * (COUPE.semainesHistorique - 1 - i))));
    const r = await db.execute<{ semaine: string; portee: "campus" | "classe"; cible_id: number; score: number; nom: string; site_id: number | null }>(sql`
      SELECT cs.semaine, cs.portee, cs.cible_id, cs.score, COALESCE(si.nom_court, cl.nom) AS nom, COALESCE(si.id, cl.site_id) AS site_id
      FROM campus.classements_semaine cs
      LEFT JOIN campus.sites si ON cs.portee = 'campus' AND si.id = cs.cible_id
      LEFT JOIN campus.classes cl ON cs.portee = 'classe' AND cl.id = cs.cible_id
      WHERE cs.semaine = ANY(${`{${semaines.join(",")}}`}::text[]) AND (cs.portee = 'campus' AND cs.inscrits > 0 OR cs.inscrits >= ${COUPE.tailleMinClasse})`);
    const parCible = new Map<string, { portee: "campus" | "classe"; id: number; nom: string; scores: (number | null)[] }>();
    for (const l of r.rows) {
      if (l.portee === "classe" && perimetre && (l.site_id === null || !perimetre.includes(l.site_id))) continue;
      const k = `${l.portee}:${l.cible_id}`;
      const ligne = parCible.get(k) ?? { portee: l.portee, id: l.cible_id, nom: l.nom ?? "", scores: semaines.map(() => null) };
      ligne.scores[semaines.indexOf(l.semaine)] = Math.round(l.score);
      parCible.set(k, ligne);
    }
    dto.historique = {
      semaines: semaines.map((iso) => ({ iso, numero: numeroDe(iso) })),
      lignes: [...parCible.values()].sort((a, b) => a.portee.localeCompare(b.portee) || a.nom.localeCompare(b.nom, "fr")),
    };
    dto.actes = campus.filter((l) => l.inscrits > 0).map((l) => ({ id: l.cibleId, nom: l.nom, actes: l.actes }));
  }
  return dto;
}

async function bandeauDe(u: Utilisateur): Promise<BandeauCoupeDto> {
  const semaine = semaineIso(lundiEnCours());
  const lu = await classement(semaine);
  const lignes = lu?.lignes ?? [];
  const campus = lignes.filter((l) => l.portee === "campus");
  const monCampus = campus.find((l) => l.cibleId === u.siteId && l.inscrits > 0);
  const maClasse = lignes.find((l) => l.portee === "classe" && l.cibleId === u.classeId);
  return {
    numero: numeroDe(semaine),
    essai: lu?.essai ?? false,
    meneur: meneurDe(campus),
    monCampus: monCampus ? { nom: monCampus.nom, rang: rangVisible(lignes, monCampus) } : null,
    maClasse: maClasse && estClassee(maClasse) ? { progression: entier(maClasse.progression) } : null,
  };
}

async function salleDe(siteId: number | null): Promise<CoupeSalleDto> {
  const semaine = semaineIso(lundiEnCours());
  const lu = await classement(semaine);
  const campus = (lu?.lignes ?? []).filter((l) => l.portee === "campus");
  const classes = campus.filter(estClassee);
  const moitie = Math.ceil(classes.length / 2);
  const ici = siteId ? campus.find((l) => l.cibleId === siteId) : undefined;
  let nomIci = ici?.nom ?? null;
  if (siteId && !nomIci) {
    const r = await db.execute<{ nom: string }>(sql`SELECT nom_court AS nom FROM campus.sites WHERE id = ${siteId}`);
    nomIci = r.rows[0]?.nom ?? null;
  }
  return {
    numero: numeroDe(semaine),
    essai: lu?.essai ?? false,
    meneur: meneurDe(campus),
    campus: nomIci
      ? {
          nom: nomIci,
          rang: rangVisible(campus, ici),
          progression: ici && ici.progression !== null && ici.progression > 0 ? Math.round(ici.progression) : null,
          bientot: !ici || ici.inscrits === 0,
        }
      : null,
    // Le dernier n'est jamais montré : seulement la moitié haute, et seulement des campus qui ont déjà un taux.
    podium: classes.filter((l) => (l.rang ?? 999) <= moitie && l.score > 0).map((l) => ({ nom: l.nom, rang: l.rang! })),
  };
}

// ── Routes ─────────────────────────────────────────────────────────────────

export function enregistrerProgression(app: Express) {
  app.get(
    "/api/progression/moi",
    ETUDIANT,
    route(async (req, res) => {
      prive(res);
      res.json(await progressionDe(moi(req)));
    }),
  );

  app.put(
    "/api/progression/objectif",
    ETUDIANT,
    route(async (req, res) => {
      const u = moi(req);
      const { jours } = valider(
        z.object({ jours: z.number().int().refine((n) => (OBJECTIFS_SEMAINE as readonly number[]).includes(n), "2, 3 ou 5 jours") }),
        req.body,
      );
      // Les semaines terminées sont jugées avec l'ancien objectif ; le nouveau vaut dès cette semaine.
      await mettreAJourSemaines([u.id]);
      await db.execute(sql`
        INSERT INTO campus.objectifs_semaine (utilisateur_id, jours, maj_le) VALUES (${u.id}, ${jours}, now())
        ON CONFLICT (utilisateur_id) DO UPDATE SET jours = EXCLUDED.jours, maj_le = now()`);
      prive(res);
      res.json({ jours });
    }),
  );

  app.post(
    "/api/progression/badges/vus",
    ETUDIANT,
    route(async (req, res) => {
      const u = moi(req);
      await db.execute(sql`UPDATE campus.badges_etudiants SET vu_le = now() WHERE utilisateur_id = ${u.id} AND vu_le IS NULL`);
      res.json({ ok: true });
    }),
  );

  app.get(
    "/api/coupe",
    exigerRole("etudiant", "formateur", "admin", "vie_scolaire"),
    route(async (req, res) => {
      const u = moi(req);
      prive(res);
      if (req.query.vue === "bandeau") return res.json(await bandeauDe(u));
      res.json(await coupeDe(u));
    }),
  );

  app.get(
    "/api/coupe/salle",
    exigerRole("salle", "admin", "vie_scolaire"),
    route(async (req, res) => {
      const u = moi(req);
      // L'écran d'une salle et la vie scolaire d'un campus : leur campus, toujours ; la direction choisit.
      const demande = Number(req.query.site);
      const siteId = u.role === "salle" || (u.role === "vie_scolaire" && u.siteId) ? u.siteId : Number.isInteger(demande) && demande > 0 ? demande : null;
      prive(res);
      res.json(await salleDe(siteId));
    }),
  );
}
