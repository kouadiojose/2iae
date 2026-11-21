// « Démarrer un cours » sans question, on range après (21 novembre 2026), et réunions de l'équipe.
//
// Le formateur appuie sur « Démarrer un cours » : le cours est deviné (prévu, seul cours, habitude, récent), la séance
// part, marquée « à confirmer » (seances.a_confirmer). À la fin, on lui demande en une phrase si c'était bien ce cours
// (« C'était : Marketing digital, pour BTS 1 ? »). RÈGLE D'OR : tant que la séance est à confirmer, RIEN ne part vers
// les étudiants (replay, cours résumé, devoirs, ressources, fiche de révision) et elle ne compte jamais comme une
// absence. Dans le doute, on n'envoie rien. Les barrages sont dans routes/live.ts (annoncerReplay, tâches
// d'enregistrement, résumé), etude-cours.ts (seancesAPreparer), routes/ressources-seance.ts (annoncerRessources),
// engagement/presence.ts et routes/admin.ts (absences).
//
// Une réunion est une séance de nature « reunion » sur un cours caché sans classe (« Réunions de l'équipe ») : aucun
// étudiant ne la voit, ni le direct ni le replay.
//
// Les règles de devinette sont de simples règles, sans IA.
import { and, desc, eq, gt, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { oublierUtilisateur, perimetreSites } from "./auth";
import { ErreurHttp, interdit, invalide } from "./http";
import { coursEnseigne, formateursDuCours, regieCours } from "./acces";
import { notifier } from "./notifications";
import { planifier, reveiller } from "./taches";
import { slugifier } from "./routes/cours";
import {
  activites,
  cartesRevision,
  classes,
  cours,
  coursClasses,
  devoirs,
  devoirsDirect,
  effectifsSalles,
  evenementsSeances,
  fichesRevision,
  inscriptions,
  journal,
  presences,
  seances,
  seancesCreneaux,
  utilisateurs,
  CODE_COURS_REUNIONS,
  type Cours,
  type Seance,
  type Utilisateur,
} from "@shared/schema";

type Ex = typeof db;

/** Étudiants du cours identifiés (au moins 3) pour confirmer tout seul au matin. */
export const SEUIL_AUTO = 3;
const MINUTES_PRESENCE = 5;

// ── Cours et classes : le bloc de « Faire un cours » ───────────────────────

/** Code d'un cours créé en un écran : les initiales du titre et un numéro libre (« Marketing digital » → « MD-101 »). */
async function codeLibre(titre: string): Promise<string> {
  const mots = titre
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((m) => (m.length > 2 && !["DES", "LES", "UNE", "AUX", "POUR", "AVEC", "DANS", "SUR"].includes(m)) || /^[0-9]+$/.test(m));
  const base = (mots.length > 1 ? mots.map((m) => m[0]).join("") : (mots[0] ?? "COURS").slice(0, 3)).slice(0, 5) || "COURS";
  const pris = new Set((await db.select({ code: cours.code }).from(cours).where(sql`${cours.code} LIKE ${`${base}-%`}`)).map((c) => c.code));
  for (let n = 101; ; n++) if (!pris.has(`${base}-${n}`)) return `${base}-${n}`;
}

/**
 * Le cours (existant ou nouveau) et ses classes, tels que « Faire un cours » les prépare (cours-express). Un cours
 * existant : les classes choisies s'ajoutent, rien n'est retiré ; un cours en brouillon est publié. `sansClasseOk` :
 * un cours existant sans aucune classe est accepté (démarrage sans question : les classes se rangent à la fin).
 */
export async function coursExpress(
  u: Utilisateur,
  d: { coursId?: number; titreCours?: string; classeIds?: number[] },
  { sansClasseOk = false }: { sansClasseOk?: boolean } = {},
): Promise<{ c: Cours; nouveau: boolean }> {
  let c: Cours;
  let nouveau = false;
  if (d.coursId) {
    c = await coursEnseigne(u, d.coursId);
    if (c.statut === "archive") throw invalide("Ce cours est archivé.");
    // Le cours caché des réunions ne se publie jamais (il serait vu dans la médiathèque de tous les étudiants).
    if (c.code === CODE_COURS_REUNIONS) throw invalide("Pour une réunion, utilisez « Réunion ».");
    // « Pour qui ? » sur un cours déjà là : les classes choisies s'ajoutent (rien n'est retiré ici).
    const demandees = [...new Set(d.classeIds ?? [])];
    if (demandees.length) {
      const trouvees = await db.select().from(classes).where(inArray(classes.id, demandees));
      if (trouvees.length !== demandees.length) throw invalide("Une des classes n'existe pas.");
      const perimetre = perimetreSites(u);
      if (perimetre && trouvees.some((cl) => !perimetre.includes(cl.siteId))) throw interdit("Vous ne pouvez choisir que les classes de votre campus.");
      const ajoutees = await db.insert(coursClasses).values(demandees.map((classeId) => ({ coursId: c.id, classeId }))).onConflictDoNothing().returning({ classeId: coursClasses.classeId });
      if (ajoutees.length) await db.insert(journal).values({ utilisateurId: u.id, action: "cours_classes", details: { coursId: c.id, ajoutees: ajoutees.map((a) => a.classeId), express: true } });
    } else if (!sansClasseOk) {
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(coursClasses).where(eq(coursClasses.coursId, c.id));
      if (!n) throw invalide("Ce cours n'a encore aucune classe : choisissez pour qui il est (BTS, Licence…).");
    }
  } else {
    const demandees = [...new Set(d.classeIds ?? [])];
    const trouvees = await db.select().from(classes).where(inArray(classes.id, demandees));
    if (trouvees.length !== demandees.length) throw invalide("Une des classes n'existe pas.");
    const perimetre = perimetreSites(u);
    if (perimetre && trouvees.some((cl) => !perimetre.includes(cl.siteId))) throw interdit("Vous ne pouvez choisir que les classes de votre campus.");
    const titre = d.titreCours!;
    const code = await codeLibre(titre);
    const baseSlug = slugifier(titre);
    const slugsPris = new Set((await db.select({ slug: cours.slug }).from(cours).where(sql`${cours.slug} = ${baseSlug} OR ${cours.slug} LIKE ${`${baseSlug}-%`}`)).map((x) => x.slug));
    let slug = baseSlug;
    for (let i = 2; slugsPris.has(slug); i++) slug = `${baseSlug}-${i}`;
    c = await db.transaction(async (tx) => {
      const [cree] = await tx
        .insert(cours)
        .values({ code, titre, slug, formateurId: u.role === "formateur" ? u.id : null, statut: "publie" })
        .returning();
      await tx.insert(coursClasses).values(demandees.map((classeId) => ({ coursId: cree.id, classeId }))).onConflictDoNothing();
      await tx.insert(journal).values({ utilisateurId: u.id, action: "cours_cree", details: { coursId: cree.id, code, express: true, classes: demandees } });
      return cree;
    });
    nouveau = true;
  }
  if (c.statut === "brouillon") {
    const [publie] = await db.update(cours).set({ statut: "publie", majLe: new Date() }).where(eq(cours.id, c.id)).returning();
    c = publie;
  }
  return { c, nouveau };
}

/** Le cours caché des réunions de l'équipe, créé à la première réunion (jamais de classe, jamais publié). */
export async function coursDesReunions(): Promise<Cours> {
  const lire = async () => (await db.select().from(cours).where(eq(cours.code, CODE_COURS_REUNIONS)))[0];
  const existant = await lire();
  if (existant) return existant;
  await db
    .insert(cours)
    .values({ code: CODE_COURS_REUNIONS, titre: "Réunions de l'équipe", slug: slugifier("reunions-equipe"), formateurId: null, statut: "brouillon" })
    .onConflictDoNothing({ target: cours.code });
  const cree = await lire();
  if (!cree) throw new ErreurHttp(500, "Le cours des réunions n'a pas pu être préparé.");
  return cree;
}

// ── Deviner ce qu'était la séance ──────────────────────────────────────────

export type DevinetteSeance = {
  coursId: number;
  coursTitre: string;
  classes: { id: number; nom: string }[];
  classesAAjouter: { id: number; nom: string }[];
  etudiantsIdentifies: number;
  etudiantsDuCoursPresents: number;
  /**
   * Preuve d'un cours tenu en salle de conférence, même sans aucun étudiant identifié en ligne : un effectif déclaré par
   * une salle, ou l'écran d'une salle d'un campus du cours connecté au moins 10 minutes (« salle_connectee »).
   */
  preuveSalle: boolean;
  dureeMinutes: number;
  suggestion: "cours" | "reunion";
  phrase: string;
};

/** Ce que les présences disent de la séance, par des règles simples (pas d'IA). */
export async function devinerSeance(s: Seance, ex: Ex = db): Promise<DevinetteSeance> {
  const [c] = await ex.select({ id: cours.id, titre: cours.titre }).from(cours).where(eq(cours.id, s.coursId));
  const liees = await ex
    .select({ id: classes.id, nom: classes.nom })
    .from(coursClasses)
    .innerJoin(classes, eq(classes.id, coursClasses.classeId))
    .where(eq(coursClasses.coursId, s.coursId));
  const idsLiees = new Set(liees.map((l) => l.id));
  const presents = await ex
    .select({ id: utilisateurs.id, classeId: utilisateurs.classeId })
    .from(presences)
    .innerJoin(utilisateurs, eq(utilisateurs.id, presences.utilisateurId))
    // En ligne au moins 5 minutes, ou compté en salle (émargement QR, pointé par le responsable de salle).
    .where(and(eq(presences.seanceId, s.id), eq(utilisateurs.role, "etudiant"), sql`(${presences.minutes} >= ${MINUTES_PRESENCE} OR ${presences.mode} = 'salle')`));
  const inscrits = presents.length
    ? new Set(
        (await ex.select({ id: inscriptions.utilisateurId }).from(inscriptions).where(and(eq(inscriptions.coursId, s.coursId), inArray(inscriptions.utilisateurId, presents.map((p) => p.id))))).map((i) => i.id),
      )
    : new Set<number>();
  const duCours = presents.filter((p) => (p.classeId !== null && idsLiees.has(p.classeId)) || inscrits.has(p.id));
  // Classes des présents pas encore rattachées au cours : gardées si au moins 2 de leurs étudiants étaient là.
  const parClasse = new Map<number, number>();
  for (const p of presents) if (p.classeId !== null && !idsLiees.has(p.classeId)) parClasse.set(p.classeId, (parClasse.get(p.classeId) ?? 0) + 1);
  const retenues = [...parClasse].filter(([, n]) => n >= 2).map(([id]) => id);
  const aAjouter = retenues.length ? await ex.select({ id: classes.id, nom: classes.nom }).from(classes).where(inArray(classes.id, retenues)) : [];
  const debut = s.debutCours ?? s.demarreeLe;
  const fin = s.termineeLe ?? new Date();
  const dureeMinutes = debut ? Math.max(0, Math.round((fin.getTime() - debut.getTime()) / 60_000)) : 0;
  const [effectif] = await ex
    .select({ n: sql<number>`count(*)::int` })
    .from(effectifsSalles)
    .where(and(eq(effectifsSalles.seanceId, s.id), sql`${effectifsSalles.nombre} > 0`));
  const [ecran] = await ex
    .select({ n: sql<number>`count(*)::int` })
    .from(evenementsSeances)
    .where(and(eq(evenementsSeances.seanceId, s.id), eq(evenementsSeances.type, "salle_connectee")));
  const preuveSalle = (effectif?.n ?? 0) > 0 || (ecran?.n ?? 0) > 0;
  const suggestion: "cours" | "reunion" = presents.length === 0 && !preuveSalle && (s.participants?.length ?? 0) >= 2 ? "reunion" : "cours";
  const titre = c?.titre ?? s.titre;
  const noms = [...liees, ...aAjouter].map((x) => x.nom);
  return {
    coursId: s.coursId,
    coursTitre: titre,
    classes: liees,
    classesAAjouter: aAjouter,
    etudiantsIdentifies: presents.length,
    etudiantsDuCoursPresents: duCours.length,
    preuveSalle,
    dureeMinutes,
    suggestion,
    phrase: noms.length ? `C'était : ${titre}, pour ${noms.join(", ")} ?` : `C'était : ${titre} ?`,
  };
}

/**
 * Séance douteuse (garde-fou e) : moins de 10 minutes, ou aucune trace d'étudiants (personne d'identifié en ligne ni
 * émargé, aucune salle de conférence qui suivait le cours). Elle reste à confirmer. Une classe suivie seulement dans les
 * salles (écran connecté 10 min, effectif déclaré) n'est pas douteuse : elle part comme avant.
 */
export async function estDouteuse(s: Seance): Promise<boolean> {
  const d = await devinerSeance(s);
  return (d.etudiantsIdentifies === 0 && !d.preuveSalle) || d.dureeMinutes < 10;
}

/** Qui peut dire ce que c'était : celui qui a lancé la séance, la régie du cours, la direction. */
export async function peutRepondre(u: Utilisateur, s: Seance): Promise<boolean> {
  if (u.id === s.lanceParId) return true;
  if (u.role === "admin") return true;
  return regieCours(u, s.coursId);
}

// ── Confirmer ──────────────────────────────────────────────────────────────

export type ChoixConfirmation =
  | { choix: "oui" }
  | { choix: "corriger"; coursId?: number; titreCours?: string; classeIds?: number[] }
  | { choix: "reunion" };

/**
 * Étudiants inscrits au cours deviné par le lien de la salle pendant cette séance (routes/lancement.ts,
 * « inscription_par_salle ») : ils suivent le cours corrigé, et plus le cours deviné (une réunion : plus aucun).
 * Une inscription venue d'une autre séance du même cours reste.
 */
async function deplacerInscriptionsParSalle(tx: Ex, s: Seance, c: Cours, reunion: boolean): Promise<number[]> {
  const lignes = await tx
    .select({ uid: journal.utilisateurId, seanceId: sql<string>`${journal.details}->>'seanceId'` })
    .from(journal)
    .where(and(eq(journal.action, "inscription_par_salle"), sql`${journal.details}->>'coursId' = ${String(s.coursId)}`));
  const autres = new Set(lignes.filter((l) => l.seanceId !== String(s.id)).map((l) => l.uid));
  const uids = [...new Set(lignes.filter((l) => l.seanceId === String(s.id) && l.uid !== null && !autres.has(l.uid)).map((l) => l.uid as number))];
  if (!uids.length) return [];
  await tx.delete(inscriptions).where(and(eq(inscriptions.coursId, s.coursId), inArray(inscriptions.utilisateurId, uids)));
  if (!reunion) await tx.insert(inscriptions).values(uids.map((utilisateurId) => ({ coursId: c.id, utilisateurId }))).onConflictDoNothing();
  await tx.insert(journal).values({ utilisateurId: null, action: "inscriptions_par_salle_deplacees", details: { seanceId: s.id, deCours: s.coursId, versCours: reunion ? null : c.id, etudiants: uids } });
  return uids;
}

/** Déplace la séance et ce qu'elle a produit (devoirs du direct, fiches, cartes, activités) vers un autre cours. */
async function deplacerVers(tx: Ex, s: Seance, c: Cours, { reunion = false }: { reunion?: boolean } = {}): Promise<void> {
  if (s.coursId === c.id) return;
  for (const uid of await deplacerInscriptionsParSalle(tx, s, c, reunion)) oublierUtilisateur(uid);
  const [ancien] = await tx.select({ titre: cours.titre }).from(cours).where(eq(cours.id, s.coursId));
  const devoirsDuDirect = tx.select({ id: devoirsDirect.devoirId }).from(devoirsDirect).where(eq(devoirsDirect.seanceId, s.id));
  await tx.update(devoirs).set({ coursId: c.id }).where(inArray(devoirs.id, devoirsDuDirect));
  await tx.update(fichesRevision).set({ coursId: c.id }).where(eq(fichesRevision.seanceId, s.id));
  await tx.update(cartesRevision).set({ coursId: c.id }).where(eq(cartesRevision.seanceId, s.id));
  await tx.update(activites).set({ coursId: c.id }).where(eq(activites.seanceId, s.id));
  await tx.delete(seancesCreneaux).where(eq(seancesCreneaux.seanceId, s.id));
  await tx
    .update(seances)
    .set({ coursId: c.id, ...(ancien && s.titre === ancien.titre && { titre: c.titre }) })
    .where(eq(seances.id, s.id));
}

/**
 * « Oui », ou la fin d'un « corriger » : les classes des étudiants présents s'ajoutent au cours, la séance est
 * confirmée. Sans aucune classe au cours : 409 « sans_classe » (la transaction est annulée).
 */
async function confirmerLe(tx: Ex, u: Utilisateur | null, s: Seance, action: "seance_confirmee" | "seance_corrigee", extra: Record<string, unknown> = {}): Promise<void> {
  const [courante] = await tx.select().from(seances).where(eq(seances.id, s.id));
  const devinette = await devinerSeance(courante, tx);
  if (devinette.classesAAjouter.length) {
    const ajoutees = await tx
      .insert(coursClasses)
      .values(devinette.classesAAjouter.map((cl) => ({ coursId: courante.coursId, classeId: cl.id })))
      .onConflictDoNothing()
      .returning({ classeId: coursClasses.classeId });
    if (ajoutees.length) await tx.insert(journal).values({ utilisateurId: u?.id ?? null, action: "cours_classes", details: { coursId: courante.coursId, ajoutees: ajoutees.map((a) => a.classeId), confirmation: true } });
  }
  const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(coursClasses).where(eq(coursClasses.coursId, courante.coursId));
  if (!n) throw new ErreurHttp(409, "Ce cours n'a encore aucune classe : choisissez pour qui il était.", { code: "sans_classe" });
  const [maj] = await tx
    .update(seances)
    .set({ aConfirmer: false, confirmeeLe: new Date() })
    .where(and(eq(seances.id, s.id), eq(seances.aConfirmer, true), isNull(seances.confirmeeLe)))
    .returning({ id: seances.id });
  if (!maj) throw new ErreurHttp(409, "Cette séance est déjà confirmée.");
  await tx.insert(journal).values({ utilisateurId: u?.id ?? null, action, details: { seanceId: s.id, coursId: courante.coursId, ...extra } });
}

/**
 * La réponse du formateur. Une seule réponse compte (mise à jour atomique : double clic, deux personnes). Après
 * n'importe laquelle, les enregistrements du replay sont relancés : ils attendaient la confirmation.
 */
export async function confirmer(u: Utilisateur, s: Seance, choix: ChoixConfirmation): Promise<void> {
  if (s.statut !== "terminee") throw new ErreurHttp(409, "Cette séance n'est pas terminée.");
  if (!s.aConfirmer || s.confirmeeLe) throw new ErreurHttp(409, "Cette séance est déjà confirmée.");
  if (choix.choix === "oui") {
    await db.transaction(async (tx) => confirmerLe(tx as unknown as Ex, u, s, "seance_confirmee"));
  } else if (choix.choix === "corriger") {
    const { c } = await coursExpress(u, { coursId: choix.coursId, titreCours: choix.titreCours, classeIds: choix.classeIds }, { sansClasseOk: true });
    await db.transaction(async (tx) => {
      const ex = tx as unknown as Ex;
      await deplacerVers(ex, s, c);
      await confirmerLe(ex, u, s, "seance_corrigee", { deCours: s.coursId });
    });
  } else {
    const c = await coursDesReunions();
    await db.transaction(async (tx) => {
      const ex = tx as unknown as Ex;
      await deplacerVers(ex, s, c, { reunion: true });
      const [maj] = await ex
        .update(seances)
        .set({ nature: "reunion", aConfirmer: false, confirmeeLe: new Date() })
        .where(and(eq(seances.id, s.id), eq(seances.aConfirmer, true), isNull(seances.confirmeeLe)))
        .returning({ id: seances.id });
      if (!maj) throw new ErreurHttp(409, "Cette séance est déjà confirmée.");
      await ex.insert(journal).values({ utilisateurId: u.id, action: "seance_reunion", details: { seanceId: s.id, deCours: s.coursId } });
    });
  }
  reveiller("livekit-enregistrements");
  reveiller("live-enregistrements");
}

// ── Le matin d'après : confirmer tout seul quand c'est évident, sinon rappeler ──

const FENETRE_JOURS = 14;
const dateCourte = (d: Date) => new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "Africa/Abidjan" }).format(d);

/**
 * Une fois par matin (après 6 h, heure d'Abidjan = UTC), les séances finies avant ce matin et toujours à confirmer :
 *  - évidentes (au moins 3 étudiants du cours présents, 20 min ou plus, pas une réunion probable) : confirmées toutes
 *    seules, sans jamais ajouter de classe ;
 *  - les autres : un seul rappel à celui qui doit répondre et aux formateurs du cours. Jamais rien aux étudiants.
 */
export async function traiterSeancesAConfirmer(maintenant = new Date()): Promise<{ confirmees: number; rappels: number }> {
  const limite = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate(), 6, 0, 0));
  if (maintenant.getTime() < limite.getTime()) return { confirmees: 0, rappels: 0 };
  const candidates = await db
    .select()
    .from(seances)
    .where(
      and(
        eq(seances.statut, "terminee"),
        eq(seances.aConfirmer, true),
        isNull(seances.confirmeeLe),
        lt(seances.termineeLe, limite),
        gt(seances.termineeLe, new Date(maintenant.getTime() - FENETRE_JOURS * 86_400_000)),
      ),
    );
  let confirmees = 0;
  let rappels = 0;
  for (const s of candidates) {
    try {
      const d = await devinerSeance(s);
      if (d.etudiantsDuCoursPresents >= SEUIL_AUTO && d.dureeMinutes >= 20 && d.suggestion === "cours") {
        const [maj] = await db
          .update(seances)
          .set({ aConfirmer: false, confirmeeLe: maintenant })
          .where(and(eq(seances.id, s.id), eq(seances.aConfirmer, true), isNull(seances.confirmeeLe)))
          .returning({ id: seances.id });
        if (maj) {
          await db.insert(journal).values({ utilisateurId: null, action: "seance_confirmee_auto", details: { seanceId: s.id, coursId: s.coursId, etudiants: d.etudiantsDuCoursPresents, dureeMinutes: d.dureeMinutes } });
          confirmees++;
        }
        continue;
      }
      if (s.rappelConfirmationLe) continue;
      // Marqué d'abord : deux passages simultanés n'envoient pas deux rappels.
      const [marque] = await db
        .update(seances)
        .set({ rappelConfirmationLe: maintenant })
        .where(and(eq(seances.id, s.id), isNull(seances.rappelConfirmationLe)))
        .returning({ id: seances.id });
      if (!marque) continue;
      const destinataires = new Set<number>((await formateursDuCours(s.coursId)).filter((f) => f.actif).map((f) => f.id));
      if (s.lanceParId) destinataires.add(s.lanceParId);
      await notifier([...destinataires], {
        type: "cours",
        titre: "Un cours attend votre réponse",
        corps: `${s.titre} (${dateCourte(s.debut)}) : rien n'est envoyé aux étudiants tant que vous n'avez pas confirmé.`,
        lien: `/live/${s.id}`,
      });
      rappels++;
    } catch (e) {
      console.error(`[confirmation] séance ${s.id} :`, (e as Error).message);
    }
  }
  if (confirmees) {
    reveiller("livekit-enregistrements");
    reveiller("live-enregistrements");
  }
  return { confirmees, rappels };
}

planifier("seances-a-confirmer", 10 * 60_000, async () => {
  const r = await traiterSeancesAConfirmer();
  if (r.confirmees || r.rappels) console.log(`[confirmation] ${r.confirmees} séance(s) confirmée(s) toute(s) seule(s), ${r.rappels} rappel(s).`);
});

/** Séances terminées à confirmer que la personne peut trancher, les 20 plus récentes (la direction : celles qu'elle a lancées). */
export async function seancesAConfirmerDe(u: Utilisateur): Promise<Seance[]> {
  const lignes = await db
    .select()
    .from(seances)
    .where(and(eq(seances.statut, "terminee"), eq(seances.aConfirmer, true), isNull(seances.confirmeeLe)))
    .orderBy(desc(seances.debut))
    .limit(u.role === "admin" ? 200 : 100);
  const gardees: Seance[] = [];
  for (const s of lignes) {
    const ok = u.role === "admin" ? s.lanceParId === u.id : await peutRepondre(u, s);
    if (ok) gardees.push(s);
    if (gardees.length >= 20) break;
  }
  return gardees;
}
