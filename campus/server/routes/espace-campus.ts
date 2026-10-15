// Espace du campus (José, 14 octobre 2026 au soir) : un compte par campus (profil « campus », droit
// « espace_campus », shared/schema/ext-profils.ts), pour la personne qui s'occupe des salles. « Pense que ce sont des
// enfants de la maternelle » : un gros carré par cours que suit son campus, puis cinq gros blocs.
//
//   GET  /api/mon-campus                         les carrés (cours publiés suivis par une classe du campus)
//   GET  /api/mon-campus/cours/:id               le cours, son repère du jour, ce qu'on peut y ajouter, les compteurs
//   GET  /api/mon-campus/cours/:id/live          la séance du moment de CE cours (?seance= : celle choisie)
//   POST /api/mon-campus/seances/:id/ouvrir      « Ouvrir la salle » : comme l'ouverture automatique, à toute heure du jour
//   POST /api/mon-campus/seances/:id/diapos      « Ajouter un PowerPoint » (PowerPoint, PDF ou images)
//   POST /api/mon-campus/seances/:id/videos      « Ajouter une vidéo » : un lien YouTube
//   POST /api/mon-campus/seances/:id/videos/fichiers   « Ajouter une vidéo » : un fichier MP4, WebM ou MOV
//   DELETE /api/mon-campus/seances/:id/ressources/:rid  retirer une vidéo que CE compte a ajoutée
//   POST /api/mon-campus/seances/:id/projection  « Montrer dans la salle » (seulement si son campus est le seul du cours)
//   POST /api/mon-campus/seances/:id/fermer-salle « Fermer la salle » : cet ordinateur quitte le cours, les autres continuent
//   POST /api/mon-campus/seances/:id/terminer    « Terminer le cours », seulement quand c'est sans danger (live.ts)
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
// Suite du 15 octobre 2026 à 5 h (José : « les salles n'ont pas besoin d'attendre que le professeur arrive pour ouvrir,
// elles doivent tester le son ») : la salle s'ouvre à toute heure du jour du cours ; le cours commence quand même à son
// heure (debut_cours) et l'avis aux étudiants part à l'heure de l'ouverture automatique (avis différé, live.ts). Le
// chargé du campus ajoute aussi PowerPoint et vidéos à la séance du jour (ou à la prochaine), sans jamais changer ce que
// voit la classe ; il ferme sa salle, et termine le cours quand c'est sans danger. Toutes ces routes sont sous
// /api/mon-campus (le seul préfixe ouvert au compte de campus par campus-filtre.ts, avec la classe qu'il montre) :
// chacune vérifie le cours (suivi par SON campus), la séance (jamais un essai de visio) et journalise.
//
// La direction voit l'espace d'un campus avec ?site= (aperçu) : mêmes écrans, mêmes gestes, journalisés à son nom.
import type { Express, Request, RequestHandler, Response } from "express";
import { z } from "zod";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { exigerConnexion, exigerDroit, moi } from "../auth";
import { route, idParam, introuvable, invalide, valider, ErreurHttp } from "../http";
import { etudiantsDuCours } from "../acces";
import { anneesDesCoursDuSite } from "../salles-outils";
import { classesDesSeances, intervenantsDesSeances } from "../programme-outils";
import { lireReglageOuverture, REPERE_OUVERTURE_AUTO } from "../ouverture-auto";
import { postesSur, publier } from "../temps-reel";
import { televersement, televersementRessource } from "../fichiers";
import { echeance } from "../evaluations-outils";
import * as visio from "../visio";
import {
  ajouterDiapos,
  canal,
  fermerClasseFinie,
  fermerSalleCampus,
  finieSansAnimateur,
  momentAvis,
  ouvrirCommeAuto,
  terminaisonCampus,
  terminerParCampus,
} from "./live";
import { ajouterFichiersRessource, ajouterLien, projeter, ressourceDeLaSeance, ressourcesDe, retirerRessource } from "./ressources-seance";
import { sitesDuCours } from "./participation-direct";
import { notesPubliees } from "./evaluations";
import { debutDuJour, finPrevueMs, refusAjoutCampus, repereDe, seanceCibleCampus, seancePrevueAvant, seancesDuMoment, trierCarres, type MomentCours } from "../espace-campus";
import {
  EVENEMENT_GESTE_CAMPUS,
  capitale,
  heureSimple,
  jourAbidjan,
  jourEnLettres,
  type AjoutsCampusDto,
  type CoursCampusDto,
  type EspaceCampusDto,
  type ExamenCampusDto,
  type GesteCampusDto,
  type LiveCampusDto,
  type NotesCampusDto,
} from "@shared/espace-campus";
import { t as tCampus } from "@shared/textes/campus";
import {
  classes,
  cours,
  coursClasses,
  devoirs,
  journal,
  lecons,
  rappelsLive,
  rendus,
  ressourcesSeances,
  seances,
  sites,
  utilisateurs,
  estEcran,
  estProfilCampus,
  estProjectionCopie,
  type Seance,
  type Site,
  type Utilisateur,
} from "@shared/schema";

const MINUTE = 60_000;
const MOTIF_NON_TENUE = "Séance non tenue";
/** Dépôts du compte de campus en 10 minutes, au plus (tous ses ordinateurs ensemble) : PowerPoint, fichiers vidéo. */
const QUOTA_DIAPOS = 6;
const QUOTA_VIDEOS = 10;
const FENETRE_QUOTA_MS = 10 * MINUTE;
/** « Terminer le cours » refusé : pourquoi (textes du campus). */
const MESSAGES_SINON = {
  pas_commence: tCampus("terminer.sinon.pasCommence"),
  attente_formateur: tCampus("terminer.sinon.attente"),
  autres: tCampus("terminer.sinon.autres"),
} as const;

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

/** Cet ordinateur : « compte|session » (deux ordinateurs du même compte de campus sont deux postes). */
const posteDe = (req: Request) => `${moi(req).id}|${req.sessionID}`;

/**
 * Fenêtre glissante en mémoire : `max` dépôts par compte et par usage en 10 minutes ; 429 au-delà. La place est prise
 * avant de recevoir les fichiers (deux envois simultanés ne la prennent pas deux fois), puis rendue si le dépôt échoue
 * (format refusé, aucun fichier, envoi coupé) : seuls les dépôts réussis comptent (relecture du 15 octobre 2026).
 */
const depots = new Map<string, number[]>();
function reserverDepot(cle: string, max: number, res: Response) {
  const maintenant = Date.now();
  const recents = (depots.get(cle) ?? []).filter((t) => maintenant - t < FENETRE_QUOTA_MS);
  if (recents.length >= max) {
    depots.set(cle, recents);
    throw new ErreurHttp(429, "Trop d'envois. Attendez un peu.");
  }
  recents.push(maintenant);
  depots.set(cle, recents);
  const rendre = () => {
    const liste = depots.get(cle);
    const i = liste ? liste.indexOf(maintenant) : -1;
    if (liste && i >= 0) liste.splice(i, 1);
  };
  let fini = false;
  res.once("finish", () => {
    fini = true;
    if (res.statusCode >= 400) rendre();
  });
  res.once("close", () => {
    if (!fini) rendre();
  });
}
setInterval(() => {
  const maintenant = Date.now();
  for (const [cle, liste] of depots) if (!liste.some((t) => maintenant - t < FENETRE_QUOTA_MS)) depots.delete(cle);
}, FENETRE_QUOTA_MS).unref();

/** Une séance d'un cours suivi par le campus, jamais un essai de visio ; 404 sinon (« Séance introuvable »). */
async function seanceDuCampus(ctx: Contexte, seanceId: number): Promise<{ s: Seance; c: typeof cours.$inferSelect }> {
  const [s] = await db.select().from(seances).where(eq(seances.id, seanceId));
  if (!s) throw introuvable("Séance");
  const c = await coursDuCampus(ctx.site.id, s.coursId);
  if (await visio.estEssaiDirect(s.id)) throw introuvable("Séance");
  return { s, c };
}

type Ajout = { ctx: Contexte; s: Seance; c: typeof cours.$inferSelect };

/**
 * Séance que le chargé du campus peut compléter : celle du jour de ce cours (prévue, pas finie, ou en direct), ou sa
 * prochaine séance prévue (refusAjoutCampus) ; 409 sinon (« Ce cours est fini. », « Ajoutez au cours du jour ou au
 * prochain. »).
 */
async function seanceAjoutCampus(req: Request, res: Response): Promise<Ajout> {
  const ctx = await contexteDe(req, res);
  const { s, c } = await seanceDuCampus(ctx, idParam(req));
  const refus = await refusAjoutCampus(s, Date.now());
  if (refus) throw new ErreurHttp(409, refus, { code: refus === tCampus("ajout.fini") ? "fini" : "pas_cette_seance" });
  return { ctx, s, c };
}

/** Avant de recevoir des fichiers : contrôles et quota d'abord (rien n'est écrit sur le disque en cas de refus). */
const avantDepotCampus =
  (usage: "diapos" | "videos", max: number): RequestHandler =>
  (req, res, next) => {
    seanceAjoutCampus(req, res).then(
      (ajout) => {
        try {
          reserverDepot(`${usage}:${ajout.ctx.u.id}`, max, res);
        } catch (e) {
          return next(e);
        }
        res.locals.ajout = ajout;
        next();
      },
      (e) => next(e),
    );
  };

/** Le Studio du formateur l'affiche (« Yamoussoukro a ajouté un PowerPoint (3 diapos). »). */
const annoncerGeste = (seanceId: number, geste: GesteCampusDto) => publier(canal(seanceId), EVENEMENT_GESTE_CAMPUS, geste);

/** Ce que le chargé du campus complète : la (ou les) séance(s) visée(s), leurs diapos et vidéos déjà là. */
async function ajoutsPour(ctx: Contexte, cibles: Seance[], maintenant: number): Promise<AjoutsCampusDto> {
  if (!cibles.length) return null;
  const s = cibles[0];
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(ressourcesSeances)
    .where(and(eq(ressourcesSeances.seanceId, s.id), inArray(ressourcesSeances.type, ["youtube", "video"])));
  let choix: NonNullable<AjoutsCampusDto>["choix"] = null;
  if (cibles.length >= 2) {
    const noms = await classesPourChoix(cibles, ctx.site.id);
    const details = await detailsPourChoix(cibles, noms);
    choix = cibles.map((x) => ({ seanceId: x.id, libelle: [heureSimple(x.debut), noms.get(x.id), details.get(x.id)].filter(Boolean).join(" · ") }));
  }
  const aujourdhui = s.statut === "en_direct" || debutDuJour(s.debut.getTime()) === debutDuJour(maintenant);
  return { seanceId: s.id, pour: { jour: aujourdhui ? null : jourEnLettres(s.debut), heure: heureSimple(s.debut) }, diapos: s.diapos.length, videos: n ?? 0, choix };
}

/** Le campus est-il le seul à suivre ce cours (une projection se voit dans toutes les salles du cours) ? */
async function seulCampus(coursId: number, siteId: number): Promise<boolean> {
  const liste = await sitesDuCours(coursId);
  return liste.length === 1 && liste[0] === siteId;
}

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

/** L'état du live d'un cours pour l'écran du campus (LiveCampusDto). `poste` : cet ordinateur (« Terminer »). */
async function liveDe(ctx: Contexte, c: typeof cours.$inferSelect, s: Seance | null, choix: Seance[] | null, moment: MomentCours, poste: string): Promise<LiveCampusDto> {
  const maintenant = Date.now();
  const { prochaine, enDirect } = moment;
  const base = {
    campus: campusDto(ctx.site),
    cours: { id: c.id, code: c.code, titre: c.titre, couleur: c.couleur },
    apercu: ctx.apercu,
    prochaine: prochaine ? { debut: prochaine.debut.toISOString(), jour: jourEnLettres(prochaine.debut), heure: heureSimple(prochaine.debut) } : null,
  };
  const sansClasse = { projectionPermise: false, mesAjouts: [] as number[], fermeture: null };
  // Ce que le chargé du campus complète : la séance montrée si elle est du jour (ou en direct), sinon la prochaine.
  const mesAjouts = async (ajouts: AjoutsCampusDto) =>
    ajouts
      ? (
          await db
            .select({ id: ressourcesSeances.id })
            .from(ressourcesSeances)
            .where(and(eq(ressourcesSeances.seanceId, ajouts.seanceId), eq(ressourcesSeances.creePar, ctx.u.id)))
        ).map((r) => r.id)
      : [];
  if (choix && choix.length >= 2) {
    const noms = await classesPourChoix(choix, ctx.site.id);
    const details = await detailsPourChoix(choix, noms);
    const ajouts = await ajoutsPour(ctx, choix, maintenant);
    return {
      ...base,
      ...sansClasse,
      seanceId: null,
      choix: choix.map((x) => ({ seanceId: x.id, heure: heureSimple(x.debut), classes: noms.get(x.id) ?? "", detail: details.get(x.id) ?? null })),
      etat: "a_venir",
      debut: choix[0].debut.toISOString(),
      heure: heureSimple(choix[0].debut),
      peutOuvrir: false,
      ouvertureAutoA: null,
      motif: null,
      apresPrecedente: false,
      passeDabord: null,
      ecransDuCampus: 0,
      essai: false,
      ajouts,
      mesAjouts: await mesAjouts(ajouts),
    };
  }
  if (!s) {
    const ajouts = await ajoutsPour(ctx, await seanceCibleCampus(moment, maintenant), maintenant);
    return {
      ...base,
      ...sansClasse,
      seanceId: null,
      choix: null,
      etat: "aucune",
      debut: null,
      heure: null,
      peutOuvrir: false,
      ouvertureAutoA: null,
      motif: null,
      apresPrecedente: false,
      passeDabord: null,
      ecransDuCampus: 0,
      essai: true,
      ajouts,
      mesAjouts: await mesAjouts(ajouts),
    };
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
  // Une autre séance du même cours en direct empêche d'ouvrir celle-ci, sauf une séance sœur à la même heure (deux
  // sessions du même cours, en parallèle dans deux salles : chacune s'ouvre), et sauf une classe finie que personne
  // n'anime (elle est fermée d'abord : POST …/ouvrir).
  const autres = enDirect.filter((x) => x.id !== s.id && x.debut.getTime() !== s.debut.getTime());
  const bloquantes: Seance[] = [];
  if (s.statut === "planifiee") for (const x of autres) if (!(await finieSansAnimateur(x, maintenant))) bloquantes.push(x);
  // Une séance plus tôt du même cours, ce jour-là, encore prévue : elle passe d'abord (séance choisie par ?seance=).
  const avant = s.statut === "planifiee" ? await seancePrevueAvant(s, maintenant) : null;
  // À toute heure du jour d'Abidjan de la séance, jusqu'à sa fin prévue (José, 15 octobre 2026 à 5 h).
  const peutOuvrir = s.statut === "planifiee" && jourAbidjan(s.debut) === jourAbidjan(maintenant) && maintenant < finPrevueMs(s) && !bloquantes.length && !avant;
  let ouvertureAutoA: string | null = null;
  if (s.statut === "planifiee") {
    const reglage = await lireReglageOuverture();
    const [repere] = await db
      .select({ type: rappelsLive.type })
      .from(rappelsLive)
      .where(and(eq(rappelsLive.seanceId, s.id), eq(rappelsLive.type, REPERE_OUVERTURE_AUTO)))
      .limit(1);
    // L'ouverture automatique n'ouvre que la première de deux séances du même cours à la même heure (un seul rappel
    // aux étudiants du cours) : la seconde s'ouvre à la main (« Ouvrir la salle », le formateur).
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
    if (reglage.actif && c.statut === "publie" && !repere && !premiere && (aVenir || !autres.length)) ouvertureAutoA = heureSimple(s.debut.getTime() - reglage.minutes * MINUTE);
  }
  const duJour = s.statut === "en_direct" || (s.statut === "planifiee" && debutDuJour(s.debut.getTime()) === debutDuJour(maintenant));
  const ajouts = await ajoutsPour(ctx, duJour ? [s] : await seanceCibleCampus(moment, maintenant), maintenant);
  const enLive = s.statut === "en_direct";
  return {
    ...base,
    seanceId: s.id,
    choix: null,
    etat,
    debut: s.debut.toISOString(),
    heure: heureSimple(s.debut),
    peutOuvrir,
    ouvertureAutoA,
    motif: s.statut === "annulee" && s.motifAnnulation !== MOTIF_NON_TENUE ? s.motifAnnulation : null,
    apresPrecedente: s.statut === "planifiee" && bloquantes.some((x) => x.debut.getTime() < s.debut.getTime()),
    passeDabord: avant ? heureSimple(avant.debut) : null,
    ecransDuCampus: s.statut === "en_direct" || s.statut === "planifiee" ? postesSur(canal(s.id), (x) => estEcran(x) && x.siteId === ctx.site.id) : 0,
    essai: s.statut !== "planifiee" && s.statut !== "en_direct",
    ajouts,
    projectionPermise: enLive && (await seulCampus(c.id, ctx.site.id)),
    mesAjouts: await mesAjouts(ajouts),
    fermeture: enLive ? await terminaisonCampus(s, ctx.site.id, poste, maintenant) : null,
  };
}

/** Le live d'un cours, éventuellement pour la séance choisie (?seance=, une séance de CE cours). */
async function liveDuCours(ctx: Contexte, c: typeof cours.$inferSelect, seanceDemandee: number | null, poste: string): Promise<LiveCampusDto> {
  const moment = (await seancesDuMoment([c.id], Date.now(), { finieSansAnimateur })).get(c.id)!;
  if (seanceDemandee !== null) {
    const [x] = await db.select().from(seances).where(and(eq(seances.id, seanceDemandee), eq(seances.coursId, c.id)));
    if (!x) throw introuvable("Séance");
    return liveDe(ctx, c, x, null, moment, poste);
  }
  return liveDe(ctx, c, moment.seance, moment.choix, moment, poste);
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
          debut: moment.seance && (moment.seance.statut === "planifiee" || moment.seance.statut === "en_direct") ? moment.seance.debut.toISOString() : null,
          essai: !moment.seance || (moment.seance.statut !== "planifiee" && moment.seance.statut !== "en_direct"),
        },
        ajouts: await ajoutsPour(ctx, await seanceCibleCampus(moment, maintenant), maintenant),
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
      res.json(await liveDuCours(ctx, c, seanceDeLaRequete(req), posteDe(req)));
    }),
  );

  // ── « Ouvrir la salle » : comme l'ouverture automatique, à toute heure du jour ──
  // José, 15 octobre 2026 à 5 h : « les salles n'ont pas besoin d'attendre que le professeur arrive pour ouvrir, il
  // peut rentrer à n'importe quel moment : elles doivent tester le son ». La classe s'ouvre dans tous les campus du
  // cours (une classe est en direct partout à la fois), mais le cours commence à SON HEURE (debut_cours : retards,
  // chrono, enregistrement, présence, fermeture logique), et elle attend toujours son formateur (le compte de campus
  // n'est jamais animateur) : sans lui, elle finira « Séance non tenue » après sa fin prévue. Ouverte avant l'heure où
  // l'ouverture automatique aurait prévenu, personne n'est prévenu tout de suite (avis différé, live.ts). Deux
  // ordinateurs qui appuient ensemble : une seule ouverture (passerEnDirect est atomique), l'autre reçoit l'état.
  app.post(
    "/api/mon-campus/seances/:id(\\d+)/ouvrir",
    ...garde,
    route(async (req, res) => {
      const ctx = await contexteDe(req, res);
      const { s, c } = await seanceDuCampus(ctx, idParam(req));
      const poste = posteDe(req);
      if (s.statut !== "planifiee") return res.json(await liveDuCours(ctx, c, s.id, poste));
      const maintenant = Date.now();
      if (jourAbidjan(s.debut) !== jourAbidjan(maintenant)) {
        throw new ErreurHttp(409, tCampus("live.pasAujourdhui", { v: { jour: jourEnLettres(s.debut), heure: heureSimple(s.debut) } }), { code: "pas_aujourdhui" });
      }
      if (finPrevueMs(s) <= maintenant) throw new ErreurHttp(409, tCampus("ajout.fini"), { code: "fini" });
      // Le cours de 8h30 encore prévu passe avant celui de 14h00 (jamais deux séances du même cours en direct).
      const avant = await seancePrevueAvant(s, maintenant);
      if (avant) throw new ErreurHttp(409, tCampus("live.passeDabord", { v: { heure: heureSimple(avant.debut) } }), { code: "pas_encore", seanceId: avant.id });
      const autres = await db
        .select()
        .from(seances)
        .where(
          and(
            eq(seances.coursId, s.coursId),
            ne(seances.id, s.id),
            ne(seances.debut, s.debut),
            eq(seances.statut, "en_direct"),
            sql`NOT EXISTS (SELECT 1 FROM campus.directs_immediats dx WHERE dx.seance_id = ${seances.id} AND NOT dx.prevenir)`,
          ),
        );
      // Le cours d'avant traîne (fini, personne ne l'anime : écrans laissés ouverts) : il est fermé d'abord. Encore animé :
      // la salle s'ouvre juste après lui.
      for (const autre of autres) {
        if (!(await fermerClasseFinie(autre, s, ctx.site.id))) throw new ErreurHttp(409, tCampus("live.dejaEnDirect"), { code: "deja_en_direct", seanceId: autre.id });
      }
      const avisDiffere = maintenant < (await momentAvis(s));
      await ouvrirCommeAuto(s, { code: c.code, par: { id: ctx.u.id, siteId: ctx.site.id }, avisDiffere });
      res.json(await liveDuCours(ctx, c, s.id, poste));
    }),
  );

  // ── « Ajouter un PowerPoint » (PowerPoint, PDF ou images) ─────────────────
  // À la fin des diapos de la séance ; si elle n'en avait aucune et que la classe est en direct, la première reste cachée
  // jusqu'au geste du formateur (la classe ne voit rien changer). Six dépôts au plus en 10 minutes par compte.
  app.post(
    "/api/mon-campus/seances/:id(\\d+)/diapos",
    ...garde,
    avantDepotCampus("diapos", QUOTA_DIAPOS),
    televersement.array("fichiers", 10),
    route(async (req, res) => {
      const { ctx, s, c } = res.locals.ajout as Ajout;
      const recus = (req.files as Express.Multer.File[] | undefined) ?? [];
      const { maj, ajoutees } = await ajouterDiapos(ctx.u, s, recus, { masquerSiVide: true });
      annoncerGeste(s.id, { type: "ajout_ppt", site: ctx.site.nomCourt, siteId: ctx.site.id, diapos: ajoutees });
      await db.insert(journal).values({
        utilisateurId: ctx.u.id,
        action: "campus_diapos_ajoutees",
        details: { seanceId: s.id, coursId: c.id, siteId: ctx.site.id, fichiers: recus.length, diapos: ajoutees },
      });
      res.status(201).json({ diapos: ajoutees, total: maj.diapos.length, masquee: maj.diapoCourante < 0 });
    }),
  );

  // ── « Ajouter une vidéo » : un lien YouTube (aucun autre lien) ─────────────
  app.post(
    "/api/mon-campus/seances/:id(\\d+)/videos",
    ...garde,
    route(async (req, res) => {
      const { ctx, s, c } = await seanceAjoutCampus(req, res);
      const d = valider(z.object({ url: z.string().trim().min(4, tCampus("video.pasYoutube")).max(2000, tCampus("video.pasYoutube")) }), req.body);
      const { ressource, ressources } = await ajouterLien(s, ctx.u, d.url, { youtubeSeulement: true });
      const dto = ressources.find((r) => r.id === ressource.id) ?? null;
      annoncerGeste(s.id, { type: "ajout_video", site: ctx.site.nomCourt, siteId: ctx.site.id, titre: dto?.titre ?? ressource.titre });
      await db.insert(journal).values({
        utilisateurId: ctx.u.id,
        action: "campus_video_ajoutee",
        details: { seanceId: s.id, coursId: c.id, siteId: ctx.site.id, type: "youtube", ressourceId: ressource.id },
      });
      res.status(201).json({ ressource: dto });
    }),
  );

  // ── « Ajouter une vidéo » : un fichier MP4, WebM ou MOV (300 Mo au plus) ───
  app.post(
    "/api/mon-campus/seances/:id(\\d+)/videos/fichiers",
    ...garde,
    avantDepotCampus("videos", QUOTA_VIDEOS),
    televersementRessource.array("fichiers", 3),
    route(async (req, res) => {
      const { ctx, s, c } = res.locals.ajout as Ajout;
      const recus = (req.files as Express.Multer.File[] | undefined) ?? [];
      const { ajoutees, ressources } = await ajouterFichiersRessource(s, ctx.u, recus, { videosSeulement: true });
      for (const r of ajoutees) {
        annoncerGeste(s.id, { type: "ajout_video", site: ctx.site.nomCourt, siteId: ctx.site.id, titre: r.titre });
        await db.insert(journal).values({
          utilisateurId: ctx.u.id,
          action: "campus_video_ajoutee",
          details: { seanceId: s.id, coursId: c.id, siteId: ctx.site.id, type: "video", ressourceId: r.id },
        });
      }
      const ids = new Set(ajoutees.map((r) => r.id));
      res.status(201).json({ ressources: ressources.filter((r) => ids.has(r.id)) });
    }),
  );

  // ── Retirer une vidéo que CE compte a ajoutée ─────────────────────────────
  app.delete(
    "/api/mon-campus/seances/:id(\\d+)/ressources/:rid(\\d+)",
    ...garde,
    route(async (req, res) => {
      const { ctx, s, c } = await seanceAjoutCampus(req, res);
      const r = await ressourceDeLaSeance(s.id, idParam(req, "rid"));
      if (r.creePar !== ctx.u.id) throw new ErreurHttp(403, "Seul le formateur peut retirer cette vidéo.");
      await retirerRessource(s, r);
      await db.insert(journal).values({
        utilisateurId: ctx.u.id,
        action: "campus_ressource_retiree",
        details: { seanceId: s.id, coursId: c.id, siteId: ctx.site.id, ressourceId: r.id, type: r.type },
      });
      res.json({ ok: true });
    }),
  );

  // ── « Montrer dans la salle » : seulement si SON campus est le seul du cours ──
  // Une projection se voit dans toutes les salles du cours : sinon, c'est au formateur. Le compte de campus n'anime
  // jamais (pas de noterGesteAnimation) : une classe qui attend son formateur peut toujours finir « pas eu lieu ».
  app.post(
    "/api/mon-campus/seances/:id(\\d+)/projection",
    ...garde,
    route(async (req, res) => {
      const ctx = await contexteDe(req, res);
      const { s, c } = await seanceDuCampus(ctx, idParam(req));
      if (s.statut !== "en_direct") throw new ErreurHttp(409, "Le cours n'est pas en direct.");
      if (!(await seulCampus(c.id, ctx.site.id))) throw new ErreurHttp(403, "Seul le formateur montre une vidéo à tous les campus.");
      const d = valider(
        z.object({
          ressourceId: z.number().int().positive().nullable(),
          lecture: z.boolean().optional(),
          position: z.number().min(0).max(24 * 3600).optional(),
        }),
        req.body,
      );
      // Une copie d'étudiant montrée par le formateur : c'est lui qui la retire.
      if (estProjectionCopie(s.projection)) throw new ErreurHttp(409, "Le formateur montre une copie. Il la retire lui-même.");
      const dto = await projeter(s, d, { geste: null });
      await db.insert(journal).values({
        utilisateurId: ctx.u.id,
        action: "campus_video_projetee",
        details: { seanceId: s.id, coursId: c.id, siteId: ctx.site.id, ressourceId: d.ressourceId, lecture: d.lecture ?? null },
      });
      res.json(dto);
    }),
  );

  // ── « Fermer la salle » : cet ordinateur quitte le cours, les autres continuent ──
  app.post(
    "/api/mon-campus/seances/:id(\\d+)/fermer-salle",
    ...garde,
    route(async (req, res) => {
      const ctx = await contexteDe(req, res);
      const { s, c } = await seanceDuCampus(ctx, idParam(req));
      if (await fermerSalleCampus(s, ctx.u, ctx.site.id, posteDe(req))) {
        annoncerGeste(s.id, { type: "salle_fermee", site: ctx.site.nomCourt, siteId: ctx.site.id });
        await db.insert(journal).values({ utilisateurId: ctx.u.id, action: "campus_salle_fermee", details: { seanceId: s.id, coursId: c.id, siteId: ctx.site.id } });
      }
      res.status(204).end();
    }),
  );

  // ── « Terminer le cours » : seulement quand c'est sans danger ──────────────
  // Règle recalculée à la demande (live.ts : terminaisonCampus) : seul campus du cours, ou fin passée, ou personne
  // d'autre (ni formateur, ni intervenant, ni autre salle) ; jamais avant le début du cours ; une classe qui attend
  // encore son formateur, seulement après sa fin prévue (« Séance non tenue »). Refus : 409 { code: "pas_permis" }.
  app.post(
    "/api/mon-campus/seances/:id(\\d+)/terminer",
    ...garde,
    route(async (req, res) => {
      const ctx = await contexteDe(req, res);
      const { s, c } = await seanceDuCampus(ctx, idParam(req));
      const poste = posteDe(req);
      if (s.statut !== "en_direct") return res.json(await liveDuCours(ctx, c, s.id, poste));
      const { regle } = await terminerParCampus(s, ctx.u, ctx.site.id, poste, MESSAGES_SINON);
      annoncerGeste(s.id, { type: "termine", site: ctx.site.nomCourt, siteId: ctx.site.id });
      await db.insert(journal).values({
        utilisateurId: ctx.u.id,
        action: "campus_cours_termine",
        details: {
          seanceId: s.id,
          coursId: c.id,
          siteId: ctx.site.id,
          raison: regle.terminer,
          formateurPresent: regle.formateurPresent,
          autresSalles: regle.autresSalles,
          nonTenue: regle.terminer === "non_tenu",
        },
      });
      res.json(await liveDuCours(ctx, c, s.id, poste));
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
