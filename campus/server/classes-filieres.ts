// Classes des filières du Groupe 2IAE (site 2iae.com), pour l'année scolaire
// en cours :
//  - dans chaque campus, une classe par BTS présenté sur sa fiche et par
//    année (« Logistique 1BTS · Yopougon », « Logistique 2BTS · Yopougon ») ;
//  - dans chaque campus, les licences professionnelles (L1, L2, L3) et les
//    certificats ;
//  - dans chaque campus, une Licence 3 par filière BTS (licence professionnelle
//    après le BTS : « Logistique L3 · Yopougon »).
// Licences et BTS ne se mélangent pas : les classes de licence (L1 à L3)
// suivent leur propre cours d'initiation à l'IA (« IA-LIC », copie du cours des
// BTS, même formateur), et plus le cours des BTS.
// Une classe BTS reçoit aussitôt les cours et les sessions d'emploi du temps
// du « Tronc commun » de même année et de même campus : les cours communs
// (Initiation à l'IA…) arrivent donc à ses étudiants, alertes comprises.
// Relançable sans doublon : une classe qui existe déjà (même campus, filière,
// niveau et année) n'est pas recréée.
import { and, eq, gte, ilike, inArray, lt, ne, or, sql } from "drizzle-orm";
import { db } from "./db";
import { utilisateurs, passagesClasses, classes, cours, coursClasses, classesProgramme, sessionsClasses, journal, LICENCES_PRO, CERTIFICATS, type Utilisateur, type BilanClassesFilieres } from "@shared/schema";
import { lireSitePublic } from "./routes/public";

const TRONC_COMMUN = "Tronc commun";

type Prevue = { siteId: number; campus: string; nom: string; filiere: string; niveau: string; bts: boolean };

export async function creerClassesFilieres(u: Pick<Utilisateur, "id">, simulation: boolean): Promise<BilanClassesFilieres> {
  const [derniere] = await db.select({ annee: sql<string | null>`max(${classes.anneeScolaire})` }).from(classes);
  const annee = derniere?.annee ?? `${new Date().getUTCFullYear()}-${new Date().getUTCFullYear() + 1}`;
  const { campus } = await lireSitePublic();
  const existantes = await db.select().from(classes).where(eq(classes.anneeScolaire, annee));
  const existe = (siteId: number, filiere: string, niveau: string) => existantes.some((c) => c.siteId === siteId && c.filiere === filiere && c.niveau === niveau);

  const prevues: Prevue[] = [];
  for (const c of campus) {
    for (const f of c.filieres) {
      for (const niveau of ["1BTS", "2BTS"]) prevues.push({ siteId: c.id, campus: c.nomCourt, nom: `${f.nom} ${niveau} · ${c.nomCourt}`, filiere: f.nom, niveau, bts: true });
      prevues.push({ siteId: c.id, campus: c.nomCourt, nom: `${f.nom} L3 · ${c.nomCourt}`, filiere: f.nom, niveau: "Licence 3", bts: false });
    }
    for (const l of LICENCES_PRO) {
      for (const n of [1, 2, 3]) prevues.push({ siteId: c.id, campus: c.nomCourt, nom: `${l} L${n} · ${c.nomCourt}`, filiere: l, niveau: `Licence ${n}`, bts: false });
    }
    for (const cert of CERTIFICATS) prevues.push({ siteId: c.id, campus: c.nomCourt, nom: `Certificat ${cert} · ${c.nomCourt}`, filiere: cert, niveau: "Certificat", bts: false });
  }
  const aCreer = prevues.filter((p) => !existe(p.siteId, p.filiere, p.niveau));
  const bilan: BilanClassesFilieres = {
    anneeScolaire: annee,
    creees: aCreer.map((p) => ({ campus: p.campus, nom: p.nom })),
    dejaLa: prevues.length - aCreer.length,
    liensCours: 0,
    liensSessions: 0,
    campusSansBts: campus.filter((c) => !c.filieres.length).map((c) => c.nomCourt),
    simulation,
  };

  const tronc = (siteId: number, niveau: string) => existantes.find((c) => c.siteId === siteId && c.filiere === TRONC_COMMUN && c.niveau === niveau);
  if (simulation) {
    // Ce que la création recopierait depuis les troncs communs.
    for (const p of aCreer.filter((x) => x.bts)) {
      const t = tronc(p.siteId, p.niveau);
      if (!t) continue;
      const [cc] = await db.select({ n: sql<number>`count(*)::int` }).from(coursClasses).where(eq(coursClasses.classeId, t.id));
      const [sc] = await db.select({ n: sql<number>`count(*)::int` }).from(sessionsClasses).where(eq(sessionsClasses.classeId, t.id));
      bilan.liensCours += cc.n;
      bilan.liensSessions += sc.n;
    }
    return bilan;
  }

  await db.transaction(async (tx) => {
    for (const p of aCreer) {
      const [cree] = await tx.insert(classes).values({ nom: p.nom, siteId: p.siteId, filiere: p.filiere, niveau: p.niveau, anneeScolaire: annee }).returning();
      if (!p.bts) continue;
      const t = tronc(p.siteId, p.niveau);
      if (!t) continue;
      // Les cours du tronc commun (et ce que l'emploi du temps en gère), puis ses sessions d'emploi du temps.
      const cours = await tx.select({ coursId: coursClasses.coursId }).from(coursClasses).where(eq(coursClasses.classeId, t.id));
      if (cours.length) {
        const r = await tx
          .insert(coursClasses)
          .values(cours.map((x) => ({ coursId: x.coursId, classeId: cree.id })))
          .onConflictDoNothing()
          .returning();
        bilan.liensCours += r.length;
      }
      const programme = await tx.select({ coursId: classesProgramme.coursId }).from(classesProgramme).where(eq(classesProgramme.classeId, t.id));
      if (programme.length) {
        await tx
          .insert(classesProgramme)
          .values(programme.map((x) => ({ coursId: x.coursId, classeId: cree.id })))
          .onConflictDoNothing();
      }
      const sessions = await tx.select().from(sessionsClasses).where(eq(sessionsClasses.classeId, t.id));
      if (sessions.length) {
        const r = await tx
          .insert(sessionsClasses)
          .values(sessions.map((x) => ({ sessionId: x.sessionId, classeId: cree.id, prevenueLe: x.prevenueLe })))
          .onConflictDoNothing()
          .returning();
        bilan.liensSessions += r.length;
      }
    }
    bilan.liensCours += await separerLicences(tx, annee);
    await tx.insert(journal).values({
      utilisateurId: u.id,
      action: "classes_filieres_creees",
      details: { annee, creees: aCreer.length, dejaLa: bilan.dejaLa, liensCours: bilan.liensCours, liensSessions: bilan.liensSessions },
    });
  });
  return bilan;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const CODE_IA_LICENCE = "IA-LIC";

/**
 * Le cours d'initiation à l'IA des licences (créé au besoin d'après celui des BTS), rattaché aux seules classes de
 * licence de l'année ; les classes de licence quittent le cours des BTS. Renvoie le nombre de rattachements ajoutés.
 */
async function separerLicences(tx: Tx, annee: string): Promise<number> {
  const licences = await tx.select({ id: classes.id }).from(classes).where(and(eq(classes.anneeScolaire, annee), ilike(classes.niveau, "Licence%")));
  if (!licences.length) return 0;
  let [lic] = await tx.select().from(cours).where(eq(cours.code, CODE_IA_LICENCE));
  const [base] = await tx
    .select()
    .from(cours)
    .where(and(ne(cours.code, CODE_IA_LICENCE), or(eq(cours.code, "IA-101"), ilike(cours.titre, "%initiation%intelligence artificielle%"), ilike(cours.titre, "initiation à l'IA%"))))
    .orderBy(cours.id)
    .limit(1);
  if (!lic) {
    if (!base) return 0;
    [lic] = await tx
      .insert(cours)
      .values({
        code: CODE_IA_LICENCE,
        slug: `${base.slug}-licence`,
        titre: `${base.titre} · Licence`,
        description: base.description,
        objectifs: base.objectifs,
        imageUrl: base.imageUrl,
        couleur: base.couleur,
        formateurId: base.formateurId,
        statut: base.statut,
        mediatheque: base.mediatheque,
      })
      .returning();
  }
  const ids = licences.map((l) => l.id);
  if (base) await tx.delete(coursClasses).where(and(eq(coursClasses.coursId, base.id), inArray(coursClasses.classeId, ids)));
  const r = await tx
    .insert(coursClasses)
    .values(ids.map((classeId) => ({ coursId: lic.id, classeId })))
    .onConflictDoNothing()
    .returning();
  return r.length;
}

/** Filière « Tronc commun » : masquée à l'inscription d'un campus qui a ses classes de filières BTS. */
export const estTroncCommun = (c: { filiere: string }) => c.filiere === TRONC_COMMUN;


export type BilanPassageLicence = {
  jour: string;
  deplaces: { nom: string; de: string; vers: string }[];
  sansLicence: { nom: string; classe: string }[];
  simulation: boolean;
};

/**
 * Étudiants inscrits un jour donné (GMT) dans une classe de BTS (ou de tronc commun) alors qu'ils sont en licence :
 * chacun passe dans la Licence 3 de la même filière et du même campus (créée par creerClassesFilieres). Sans Licence 3
 * correspondante (tronc commun, filière sans licence), il reste où il est et figure dans « sansLicence » : il corrige
 * sa classe lui-même (Mon profil › Ma classe) ou la vie scolaire le fait.
 */
export async function passerEnLicence(u: Pick<Utilisateur, "id">, jour: string, simulation: boolean): Promise<BilanPassageLicence> {
  const debut = new Date(`${jour}T00:00:00Z`);
  const fin = new Date(debut.getTime() + 24 * 3600_000);
  const inscrits = await db
    .select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom, classeId: utilisateurs.classeId, creeLe: utilisateurs.creeLe, classe: classes })
    .from(utilisateurs)
    .innerJoin(classes, eq(classes.id, utilisateurs.classeId))
    .where(and(eq(utilisateurs.role, "etudiant"), gte(utilisateurs.creeLe, debut), lt(utilisateurs.creeLe, fin), sql`${classes.niveau} NOT ILIKE 'Licence%'`, sql`${classes.niveau} <> 'Certificat'`));
  const l3 = await db.select().from(classes).where(eq(classes.niveau, "Licence 3"));
  const bilan: BilanPassageLicence = { jour, deplaces: [], sansLicence: [], simulation };
  const mouvements: { id: number; de: number; vers: number; creeLe: Date }[] = [];
  for (const i of inscrits) {
    const cible = l3.find((c) => c.siteId === i.classe.siteId && c.filiere === i.classe.filiere && c.anneeScolaire === i.classe.anneeScolaire);
    const nom = `${i.prenom} ${i.nom}`;
    if (!cible) bilan.sansLicence.push({ nom, classe: i.classe.nom });
    else {
      bilan.deplaces.push({ nom, de: i.classe.nom, vers: cible.nom });
      mouvements.push({ id: i.id, de: i.classe.id, vers: cible.id, creeLe: i.creeLe });
    }
  }
  if (simulation || !mouvements.length) return bilan;
  await db.transaction(async (tx) => {
    for (const m of mouvements) {
      await tx.update(utilisateurs).set({ classeId: m.vers }).where(eq(utilisateurs.id, m.id));
      const [connu] = await tx.select({ id: passagesClasses.id }).from(passagesClasses).where(eq(passagesClasses.utilisateurId, m.id)).limit(1);
      if (!connu) await tx.insert(passagesClasses).values({ utilisateurId: m.id, classeId: m.de, depuis: m.creeLe });
      await tx.insert(passagesClasses).values({ utilisateurId: m.id, classeId: m.vers, depuis: new Date() });
    }
    await tx.insert(journal).values({ utilisateurId: u.id, action: "inscrits_passes_en_licence", details: { jour, deplaces: mouvements.length, sansLicence: bilan.sansLicence.length } });
  });
  return bilan;
}
