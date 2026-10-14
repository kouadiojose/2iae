// Espace du campus (José, 14 octobre 2026 au soir) : un compte par campus (profil « campus », droit
// « espace_campus », shared/schema/ext-profils.ts), pour la personne qui s'occupe des salles. « Pense que ce sont des
// enfants de la maternelle » : un gros carré par cours que suit son campus, puis cinq gros blocs.
//
//   GET  /api/mon-campus                         les carrés (cours publiés suivis par une classe du campus)
//   GET  /api/mon-campus/cours/:id               le cours, son repère du jour et les compteurs des quatre blocs
//   GET  /api/mon-campus/cours/:id/live          la séance du moment de CE cours (?seance= : celle choisie)
//   POST /api/mon-campus/seances/:id/ouvrir      « Ouvrir le cours » : comme l'ouverture automatique, dès 1 h avant
//   GET  /api/mon-campus/cours/:id/examens       les devoirs publiés, leurs dates, les copies rendues du campus
//   GET  /api/mon-campus/cours/:id/notes         les notes PUBLIÉES des étudiants du campus, sur 20, en lecture
//
// Leçons et résumés : le client lit les routes existantes (GET /api/cours/:id, GET /api/revision/cours/:id), déjà
// permises par le périmètre (le compte est de la vie scolaire, rattachée à son campus : perimetreSites).
//
// « Entrer dans le live » : l'ordinateur devient l'écran de la salle pour le cours choisi par la personne (le cours
// est dans l'adresse), sans aucune attribution automatique. Il entre dans la classe COMME UNE SALLE (estEcran :
// routes/live.ts, roleDans) et compte comme « salle connectée » de son campus. Plusieurs ordinateurs du même compte
// peuvent montrer des cours différents (deux salles) ou le même cours en même temps.
//
// La direction voit l'espace d'un campus avec ?site= (aperçu) : mêmes écrans, mêmes gestes, journalisés à son nom.
import type { Express, Request, Response } from "express";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { exigerConnexion, exigerDroit, moi } from "../auth";
import { route, idParam, introuvable, invalide, ErreurHttp } from "../http";
import { etudiantsDuCours } from "../acces";
import { anneesDesCoursDuSite } from "../salles-outils";
import { classesDesSeances, intervenantsDesSeances } from "../programme-outils";
import { lireReglageOuverture, REPERE_OUVERTURE_AUTO } from "../ouverture-auto";
import { postesSur } from "../temps-reel";
import { echeance } from "../evaluations-outils";
import * as visio from "../visio";
import { canal, finieSansAnimateur, ouvrirCommeAuto } from "./live";
import { notesPubliees } from "./evaluations";
import { debutDuJour, finPrevueMs, repereDe, seancesDuMoment, trierCarres } from "../espace-campus";
import {
  capitale,
  heureSimple,
  jourEnLettres,
  type CoursCampusDto,
  type EspaceCampusDto,
  type ExamenCampusDto,
  type LiveCampusDto,
  type NotesCampusDto,
} from "@shared/espace-campus";
import { AVANCE_MAX_OUVERTURE_MIN } from "@shared/ouverture";
import {
  classes,
  cours,
  coursClasses,
  devoirs,
  lecons,
  rappelsLive,
  rendus,
  seances,
  sites,
  utilisateurs,
  estEcran,
  estProfilCampus,
  type Seance,
  type Site,
  type Utilisateur,
} from "@shared/schema";

const MINUTE = 60_000;
/** « Ouvrir le cours » au plus tôt une heure avant (la même borne que la régie et l'ouverture automatique). */
const AVANCE_OUVERTURE_MS = AVANCE_MAX_OUVERTURE_MIN * MINUTE;
const MOTIF_NON_TENUE = "Séance non tenue";

type Contexte = { u: Utilisateur; site: Site; apercu: boolean };

/**
 * Le campus de la personne : le sien pour le compte de campus (409 sans campus) ; pour la direction (aperçu), celui
 * qu'elle demande (?site=, obligatoire). Les autres comptes n'arrivent pas jusqu'ici (exigerDroit).
 */
async function contexteDe(req: Request, res: Response): Promise<Contexte> {
  const u = moi(req);
  res.setHeader("Cache-Control", "no-store");
  let siteId: number;
  const apercu = !estProfilCampus(u);
  if (!apercu) {
    if (!u.siteId) throw new ErreurHttp(409, "Ce compte n'est rattaché à aucun campus. Appelez la direction.");
    siteId = u.siteId;
  } else {
    const n = Number(req.query.site);
    if (!Number.isInteger(n) || n <= 0) throw invalide("Choisissez un campus.");
    siteId = n;
  }
  const [site] = await db.select().from(sites).where(eq(sites.id, siteId));
  if (!site) throw introuvable("Campus");
  return { u, site, apercu };
}

/** Cours permis : publiés, et suivis par une classe du campus (anneesDesCoursDuSite). */
async function coursPermis(siteId: number): Promise<number[]> {
  return [...(await anneesDesCoursDuSite(siteId)).keys()];
}

/** Le cours, s'il est suivi par le campus ; sinon 404 (« Ce cours n'est pas suivi par votre campus. »). */
async function coursDuCampus(siteId: number, coursId: number) {
  if (!(await coursPermis(siteId)).includes(coursId)) throw new ErreurHttp(404, "Ce cours n'est pas suivi par votre campus.");
  const [c] = await db.select().from(cours).where(eq(cours.id, coursId));
  if (!c) throw new ErreurHttp(404, "Ce cours n'est pas suivi par votre campus.");
  return c;
}

const campusDto = (site: Site) => ({ id: site.id, nomCourt: site.nomCourt });

/** Étudiants actifs du campus inscrits au cours (par leur classe ou individuellement). */
async function etudiantsDuCampus(coursId: number, siteId: number): Promise<Utilisateur[]> {
  return (await etudiantsDuCours(coursId)).filter((e) => e.siteId === siteId);
}

/** Les classes du campus qui suivent chaque cours, par leur niveau (« 1BTS · 2BTS ») : la ligne sous le nom du carré. */
async function niveauxDesCours(coursIds: number[], siteId: number): Promise<Map<number, string>> {
  if (!coursIds.length) return new Map();
  const lignes = await db
    .selectDistinct({ coursId: coursClasses.coursId, nom: classes.nom, niveau: classes.niveau })
    .from(coursClasses)
    .innerJoin(classes, eq(classes.id, coursClasses.classeId))
    .where(and(inArray(coursClasses.coursId, coursIds), eq(classes.siteId, siteId)));
  const parCours = new Map<number, Set<string>>();
  for (const l of lignes) parCours.set(l.coursId, (parCours.get(l.coursId) ?? new Set()).add(l.niveau.trim() || l.nom));
  return new Map([...parCours].map(([id, n]) => [id, [...n].sort((a, b) => a.localeCompare(b, "fr", { numeric: true })).join(" · ")]));
}

/** « 8h30 · 1BTS » : les classes de ce campus pour chaque séance (emploi du temps, sinon les classes du cours). */
async function classesPourChoix(liste: Seance[], siteId: number): Promise<Map<number, string>> {
  const parSeance = await classesDesSeances(liste.map((s) => s.id));
  const duCampus = await db
    .select({ id: classes.id, nom: classes.nom, niveau: classes.niveau, coursId: coursClasses.coursId })
    .from(coursClasses)
    .innerJoin(classes, eq(classes.id, coursClasses.classeId))
    .where(and(inArray(coursClasses.coursId, [...new Set(liste.map((s) => s.coursId))]), eq(classes.siteId, siteId)));
  const nom = (c: { nom: string; niveau: string }) => c.niveau.trim() || c.nom;
  return new Map(
    liste.map((s) => {
      const siennes = parSeance.get(s.id) ?? [];
      const choisies = siennes.length ? duCampus.filter((c) => siennes.includes(c.id)) : duCampus.filter((c) => c.coursId === s.coursId);
      return [s.id, [...new Set(choisies.map(nom))].join(", ")];
    }),
  );
}

/**
 * Ce qui distingue deux séances au même libellé (« 11h00 · 1BTS » deux fois : séances posées hors de l'emploi du temps,
 * avec toutes les classes du cours) : leur titre s'ils diffèrent, sinon leur formateur, sinon « 1er groupe »,
 * « 2e groupe » dans l'ordre de création. Rien quand les libellés sont déjà différents.
 */
async function detailsPourChoix(liste: Seance[], noms: Map<number, string>): Promise<Map<number, string>> {
  const details = new Map<number, string>();
  const libelle = (s: Seance) => `${heureSimple(s.debut)} · ${noms.get(s.id) ?? ""}`;
  const pareils = liste.filter((s) => liste.some((x) => x.id !== s.id && libelle(x) === libelle(s)));
  if (!pareils.length) return details;
  const titres = new Set(pareils.map((s) => s.titre.trim()));
  if (titres.size === pareils.length) {
    for (const s of pareils) details.set(s.id, s.titre.trim());
    return details;
  }
  const intervenants = await intervenantsDesSeances(pareils.map((s) => s.id));
  const formateurs = pareils.map((s) => intervenants.get(s.id)?.nom ?? "");
  if (new Set(formateurs).size === pareils.length && formateurs.every(Boolean)) {
    pareils.forEach((s, i) => details.set(s.id, `avec ${formateurs[i]}`));
    return details;
  }
  [...pareils].sort((a, b) => a.id - b.id).forEach((s, i) => details.set(s.id, i === 0 ? "1er groupe" : `${i + 1}e groupe`));
  return details;
}

/** L'état du live d'un cours pour l'écran du campus (LiveCampusDto). */
async function liveDe(ctx: Contexte, c: typeof cours.$inferSelect, s: Seance | null, choix: Seance[] | null, prochaine: Seance | null, enDirect: Seance[]): Promise<LiveCampusDto> {
  const maintenant = Date.now();
  const base = {
    campus: campusDto(ctx.site),
    cours: { id: c.id, code: c.code, titre: c.titre, couleur: c.couleur },
    apercu: ctx.apercu,
    prochaine: prochaine ? { debut: prochaine.debut.toISOString(), jour: jourEnLettres(prochaine.debut), heure: heureSimple(prochaine.debut) } : null,
  };
  if (choix && choix.length >= 2) {
    const noms = await classesPourChoix(choix, ctx.site.id);
    const details = await detailsPourChoix(choix, noms);
    return {
      ...base,
      seanceId: null,
      choix: choix.map((x) => ({ seanceId: x.id, heure: heureSimple(x.debut), classes: noms.get(x.id) ?? "", detail: details.get(x.id) ?? null })),
      etat: "a_venir",
      debut: choix[0].debut.toISOString(),
      heure: heureSimple(choix[0].debut),
      peutOuvrir: false,
      ouvrableA: null,
      ouvertureAutoA: null,
      motif: null,
      apresPrecedente: false,
      ecransDuCampus: 0,
    };
  }
  if (!s) {
    return { ...base, seanceId: null, choix: null, etat: "aucune", debut: null, heure: null, peutOuvrir: false, ouvrableA: null, ouvertureAutoA: null, motif: null, apresPrecedente: false, ecransDuCampus: 0 };
  }
  const etat: LiveCampusDto["etat"] =
    s.statut === "planifiee"
      ? "a_venir"
      : s.statut === "en_direct"
        ? "ouverte"
        : s.statut === "terminee"
          ? "terminee"
          : s.motifAnnulation === MOTIF_NON_TENUE
            ? "non_tenue"
            : "annulee";
  const ouvreA = s.debut.getTime() - AVANCE_OUVERTURE_MS;
  // Une autre séance du même cours en direct empêche d'ouvrir celle-ci, sauf une séance sœur à la même heure (deux
  // sessions du même cours, en parallèle dans deux salles : chacune s'ouvre).
  const autreEnDirect = enDirect.some((x) => x.id !== s.id && x.debut.getTime() !== s.debut.getTime());
  const peutOuvrir = s.statut === "planifiee" && ouvreA <= maintenant && maintenant < finPrevueMs(s) && !autreEnDirect;
  let ouvertureAutoA: string | null = null;
  if (s.statut === "planifiee") {
    const reglage = await lireReglageOuverture();
    const [repere] = await db
      .select({ type: rappelsLive.type })
      .from(rappelsLive)
      .where(and(eq(rappelsLive.seanceId, s.id), eq(rappelsLive.type, REPERE_OUVERTURE_AUTO)))
      .limit(1);
    // L'ouverture automatique n'ouvre que la première de deux séances du même cours à la même heure (un seul rappel
    // aux étudiants du cours) : la seconde s'ouvre à la main (« Ouvrir le cours », le formateur).
    const [premiere] = await db
      .select({ id: seances.id })
      .from(seances)
      .where(
        and(
          eq(seances.coursId, s.coursId),
          eq(seances.debut, s.debut),
          sql`${seances.id} < ${s.id}`,
          inArray(seances.statut, ["planifiee", "en_direct"]),
          sql`NOT EXISTS (SELECT 1 FROM campus.directs_immediats dx WHERE dx.seance_id = ${seances.id})`,
        ),
      )
      .limit(1);
    const aVenir = s.debut.getTime() - reglage.minutes * MINUTE > maintenant;
    // Une séance précédente du même cours encore en direct : l'ouverture automatique attend qu'elle se ferme.
    if (reglage.actif && c.statut === "publie" && !repere && !premiere && (aVenir || !autreEnDirect)) ouvertureAutoA = heureSimple(s.debut.getTime() - reglage.minutes * MINUTE);
  }
  return {
    ...base,
    seanceId: s.id,
    choix: null,
    etat,
    debut: s.debut.toISOString(),
    heure: heureSimple(s.debut),
    peutOuvrir,
    ouvrableA: s.statut === "planifiee" && ouvreA > maintenant ? heureSimple(ouvreA) : null,
    ouvertureAutoA,
    motif: s.statut === "annulee" && s.motifAnnulation !== MOTIF_NON_TENUE ? s.motifAnnulation : null,
    apresPrecedente: s.statut === "planifiee" && autreEnDirect && enDirect.some((x) => x.debut.getTime() < s.debut.getTime()),
    ecransDuCampus: s.statut === "en_direct" || s.statut === "planifiee" ? postesSur(canal(s.id), (x) => estEcran(x) && x.siteId === ctx.site.id) : 0,
  };
}

/** Le live d'un cours, éventuellement pour la séance choisie (?seance=, une séance de CE cours). */
async function liveDuCours(ctx: Contexte, c: typeof cours.$inferSelect, seanceDemandee: number | null): Promise<LiveCampusDto> {
  const moment = (await seancesDuMoment([c.id], Date.now(), { finieSansAnimateur })).get(c.id)!;
  if (seanceDemandee !== null) {
    const [x] = await db.select().from(seances).where(and(eq(seances.id, seanceDemandee), eq(seances.coursId, c.id)));
    if (!x) throw introuvable("Séance");
    return liveDe(ctx, c, x, null, moment.prochaine, moment.enDirect);
  }
  return liveDe(ctx, c, moment.seance, moment.choix, moment.prochaine, moment.enDirect);
}

const seanceDeLaRequete = (req: Request): number | null => {
  if (req.query.seance === undefined || req.query.seance === "") return null;
  const n = Number(req.query.seance);
  if (!Number.isInteger(n) || n <= 0) throw introuvable("Séance");
  return n;
};

export function enregistrerEspaceCampus(app: Express) {
  const garde = [exigerConnexion, exigerDroit("espace_campus")];

  // ── Accueil : un gros carré par cours ─────────────────────────────────────
  app.get(
    "/api/mon-campus",
    ...garde,
    route(async (req, res) => {
      const ctx = await contexteDe(req, res);
      const maintenant = Date.now();
      const ids = await coursPermis(ctx.site.id);
      const liste = ids.length
        ? await db.select({ id: cours.id, code: cours.code, titre: cours.titre, couleur: cours.couleur }).from(cours).where(inArray(cours.id, ids))
        : [];
      const moments = await seancesDuMoment(ids, maintenant, { finieSansAnimateur });
      const niveaux = await niveauxDesCours(ids, ctx.site.id);
      const carres = liste.map((c) => {
        const s = moments.get(c.id)?.seance ?? null;
        return { coursId: c.id, code: c.code, titre: c.titre, couleur: c.couleur, ...repereDe(s, maintenant), classes: niveaux.get(c.id) ?? "", debutMs: s?.debut.getTime() ?? 0 };
      });
      const dto: EspaceCampusDto = {
        campus: campusDto(ctx.site),
        date: new Date(debutDuJour(maintenant)).toISOString().slice(0, 10),
        libelle: capitale(jourEnLettres(maintenant)),
        apercu: ctx.apercu,
        cours: trierCarres(carres, (c) => c.debutMs).map(({ debutMs: _d, ...c }) => c),
      };
      res.json(dto);
    }),
  );

  // ── Un cours : le repère du jour et les compteurs des blocs ───────────────
  app.get(
    "/api/mon-campus/cours/:id(\\d+)",
    ...garde,
    route(async (req, res) => {
      const ctx = await contexteDe(req, res);
      const c = await coursDuCampus(ctx.site.id, idParam(req));
      const maintenant = Date.now();
      const moment = (await seancesDuMoment([c.id], maintenant, { finieSansAnimateur })).get(c.id)!;
      const etudiants = await etudiantsDuCampus(c.id, ctx.site.id);
      const idsEtudiants = etudiants.map((e) => e.id);
      const [intervenant, principal, [nbLecons], resumes, [nbExamens], notees] = await Promise.all([
        moment.seance ? intervenantsDesSeances([moment.seance.id]).then((m) => m.get(moment.seance!.id) ?? null) : Promise.resolve(null),
        c.formateurId ? db.select({ prenom: utilisateurs.prenom, nom: utilisateurs.nom }).from(utilisateurs).where(eq(utilisateurs.id, c.formateurId)) : Promise.resolve([]),
        db.select({ n: sql<number>`count(*)::int` }).from(lecons).where(and(eq(lecons.coursId, c.id), eq(lecons.publiee, true))),
        db.execute<{ n: number }>(sql`
          SELECT count(*)::int AS n FROM campus.seances s
          JOIN campus.etudes_seances e ON e.seance_id = s.id AND e.statut = 'prete'
          WHERE s.cours_id = ${c.id}`),
        db.select({ n: sql<number>`count(*)::int` }).from(devoirs).where(and(eq(devoirs.coursId, c.id), eq(devoirs.publie, true))),
        idsEtudiants.length
          ? db
              .selectDistinct({ id: rendus.etudiantId })
              .from(rendus)
              .innerJoin(devoirs, eq(devoirs.id, rendus.devoirId))
              .where(and(eq(devoirs.coursId, c.id), eq(devoirs.publie, true), eq(rendus.statut, "corrige"), sql`${rendus.note} IS NOT NULL`, inArray(rendus.etudiantId, idsEtudiants)))
          : Promise.resolve([]),
      ]);
      const p = principal[0];
      const dto: CoursCampusDto = {
        campus: campusDto(ctx.site),
        apercu: ctx.apercu,
        cours: { id: c.id, code: c.code, titre: c.titre, couleur: c.couleur, formateur: intervenant?.nom || (p ? `${p.prenom} ${p.nom}`.trim() : null) },
        live: {
          ...repereDe(moment.seance, maintenant),
          fin:
            moment.seance?.statut === "terminee"
              ? "fini"
              : moment.seance?.statut === "annulee"
                ? moment.seance.motifAnnulation === MOTIF_NON_TENUE
                  ? "non_tenu"
                  : "annule"
                : null,
        },
        compteurs: { lecons: nbLecons?.n ?? 0, resumes: resumes.rows[0]?.n ?? 0, examens: nbExamens?.n ?? 0, notes: notees.length },
      };
      res.json(dto);
    }),
  );

  // ── « Entrer dans le live » : la séance du moment de CE cours ─────────────
  app.get(
    "/api/mon-campus/cours/:id(\\d+)/live",
    ...garde,
    route(async (req, res) => {
      const ctx = await contexteDe(req, res);
      const c = await coursDuCampus(ctx.site.id, idParam(req));
      res.json(await liveDuCours(ctx, c, seanceDeLaRequete(req)));
    }),
  );

  // ── « Ouvrir le cours » : comme l'ouverture automatique, dès 1 h avant ────
  // La classe s'ouvre dans tous les campus du cours (une classe est en direct partout à la fois), le cours commence à
  // son heure, et elle attend toujours son formateur (le compte de campus n'est jamais animateur) : sans lui, elle
  // finira « Séance non tenue ». Un seul rappel aux étudiants ; deux ordinateurs qui appuient ensemble : une seule
  // ouverture (passerEnDirect est atomique), l'autre reçoit l'état « ouverte ».
  app.post(
    "/api/mon-campus/seances/:id(\\d+)/ouvrir",
    ...garde,
    route(async (req, res) => {
      const ctx = await contexteDe(req, res);
      const [s] = await db.select().from(seances).where(eq(seances.id, idParam(req)));
      if (!s) throw introuvable("Séance");
      const c = await coursDuCampus(ctx.site.id, s.coursId);
      if (await visio.estEssaiDirect(s.id)) throw introuvable("Séance");
      if (s.statut !== "planifiee") return res.json(await liveDuCours(ctx, c, s.id));
      const maintenant = Date.now();
      const ouvreA = s.debut.getTime() - AVANCE_OUVERTURE_MS;
      if (ouvreA > maintenant) {
        throw new ErreurHttp(409, `Trop tôt. Vous pourrez ouvrir à ${heureSimple(ouvreA)}.`, { code: "trop_tot", ouvreA: new Date(ouvreA).toISOString() });
      }
      if (finPrevueMs(s) <= maintenant) throw new ErreurHttp(409, "Ce cours est fini.", { code: "fini" });
      const [autre] = await db
        .select({ id: seances.id })
        .from(seances)
        .where(
          and(
            eq(seances.coursId, s.coursId),
            ne(seances.id, s.id),
            ne(seances.debut, s.debut),
            eq(seances.statut, "en_direct"),
            sql`NOT EXISTS (SELECT 1 FROM campus.directs_immediats dx WHERE dx.seance_id = ${seances.id} AND NOT dx.prevenir)`,
          ),
        )
        .limit(1);
      if (autre) throw new ErreurHttp(409, "Ce cours est déjà en direct.", { code: "deja_en_direct", seanceId: autre.id });
      await ouvrirCommeAuto(s, { code: c.code, par: { id: ctx.u.id, siteId: ctx.site.id } });
      res.json(await liveDuCours(ctx, c, s.id));
    }),
  );

  // ── « Les examens » : devoirs publiés, dates, copies rendues du campus ─────
  app.get(
    "/api/mon-campus/cours/:id(\\d+)/examens",
    ...garde,
    route(async (req, res) => {
      const ctx = await contexteDe(req, res);
      const c = await coursDuCampus(ctx.site.id, idParam(req));
      const maintenant = Date.now();
      const liste = await db.select().from(devoirs).where(and(eq(devoirs.coursId, c.id), eq(devoirs.publie, true))).orderBy(asc(devoirs.dateLimite));
      const etudiants = await etudiantsDuCampus(c.id, ctx.site.id);
      const ids = etudiants.map((e) => e.id);
      const comptes =
        liste.length && ids.length
          ? await db
              .select({ devoirId: rendus.devoirId, n: sql<number>`count(DISTINCT ${rendus.etudiantId})::int` })
              .from(rendus)
              .where(and(inArray(rendus.devoirId, liste.map((d) => d.id)), inArray(rendus.etudiantId, ids), ne(rendus.statut, "brouillon")))
              .groupBy(rendus.devoirId)
          : [];
      const rendusDe = new Map(comptes.map((x) => [x.devoirId, x.n]));
      const examens: ExamenCampusDto[] = liste.map((d) => {
        const fin = echeance(d).getTime();
        const etat = d.ouvertureLe && d.ouvertureLe.getTime() > maintenant ? "a_venir" : fin < maintenant ? "fini" : "en_cours";
        return {
          id: d.id,
          titre: d.titre,
          type: d.type === "quiz" ? "quiz" : "depot",
          ouvertureLe: d.ouvertureLe ? d.ouvertureLe.toISOString() : null,
          echeance: new Date(fin).toISOString(),
          etat,
          rendus: rendusDe.get(d.id) ?? 0,
          inscrits: ids.length,
        };
      });
      const rang = (e: ExamenCampusDto["etat"]) => (e === "en_cours" ? 0 : e === "a_venir" ? 1 : 2);
      examens.sort((a, b) => rang(a.etat) - rang(b.etat) || (a.etat === "fini" ? Date.parse(b.echeance) - Date.parse(a.echeance) : Date.parse(a.echeance) - Date.parse(b.echeance)));
      res.json(examens);
    }),
  );

  // ── « Les notes » : notes publiées des étudiants du campus, en lecture ─────
  app.get(
    "/api/mon-campus/cours/:id(\\d+)/notes",
    ...garde,
    route(async (req, res) => {
      const ctx = await contexteDe(req, res);
      const c = await coursDuCampus(ctx.site.id, idParam(req));
      const etudiants = (await etudiantsDuCampus(c.id, ctx.site.id)).sort((a, b) => a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr"));
      const { devoirs: liste, parEtudiant } = await notesPubliees(c.id, etudiants.map((e) => e.id));
      const idsClasses = [...new Set(etudiants.map((e) => e.classeId).filter((x): x is number => x !== null))];
      const nomsClasses = new Map(
        (idsClasses.length ? await db.select({ id: classes.id, nom: classes.nom, niveau: classes.niveau }).from(classes).where(inArray(classes.id, idsClasses)) : []).map((k) => [
          k.id,
          k.niveau.trim() || k.nom,
        ]),
      );
      const dto: NotesCampusDto = {
        campus: campusDto(ctx.site),
        devoirs: liste.map((d) => ({ id: d.id, titre: d.titre, type: d.type === "quiz" ? "quiz" : "depot", bareme: d.bareme })),
        // Ni matricule, ni e-mail, ni téléphone : le prénom, le nom, la classe et les notes publiées.
        etudiants: etudiants.map((e) => {
          const n = parEtudiant.get(e.id);
          return { id: e.id, prenom: e.prenom, nom: e.nom, classe: e.classeId ? (nomsClasses.get(e.classeId) ?? null) : null, moyenne: n?.moyenne ?? null, notes: n?.notes ?? {} };
        }),
      };
      res.json(dto);
    }),
  );
}
