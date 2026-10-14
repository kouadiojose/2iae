// Régie des cours en direct : « Mon espace » du chargé de cours (profil « charge_cours », droit « animer » :
// shared/schema/ext-profils.ts), lien intervenant prêt pour WhatsApp, garde de l'ouverture et journal.
//
// Le chargé de cours fait, pour tous les cours de son périmètre (tout le groupe, ou un campus), le travail de
// régie que faisait la direction : ouvrir la classe, ajouter le PowerPoint et les vidéos avant et pendant le cours,
// les projeter, envoyer le lien intervenant au formateur, donner la parole. Les routes de la classe elles-mêmes
// sont celles du formateur (routes/live.ts : seanceAnimee, roleDans ; acces.ts : regieCours).
//
// Pourquoi la garde et le journal vivent ici, en intergiciels déclarés AVANT routes/live.ts (routes/index.ts) :
// la route « démarrer » est réécrite par l'ouverture automatique des cours (autre chantier) ; on n'y touche pas.
//
//   GET  /api/regie                          « Mon espace » : les cours du jour et de la semaine (aucun lien dedans)
//   GET  /api/seances/:id/lien-intervenant   le lien micro + caméra, le message et les liens WhatsApp (journalisé)
//   + intergiciels sur démarrer, terminer, Plan B, diapos, ressources : garde « pas plus d'une heure avant » et
//     « terminer et Plan B seulement sur une classe ouverte » pour la régie seule (sans « programme »), et journal
//     (direction et équipe, jamais le formateur du cours).
import type { Express, Request, RequestHandler } from "express";
import { and, asc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { config } from "../config";
import { exigerConnexion, exigerDroit, moi, peut, perimetreSites } from "../auth";
import { route, idParam, ErreurHttp } from "../http";
import { coursEnRegie, regieCours } from "../acces";
import { intervenantsDesSeances, libelleDate } from "../programme-outils";
import { utilisateursSur } from "../temps-reel";
import { repartitionDuSite } from "../salles-outils";
import { numeroWhatsApp } from "./admin";
import { canal, seanceAnimee } from "./live";
import { finDesLiens, jetonIntervenant, lienValide } from "./live-invite";
import { nomDeSalle } from "@shared/salles";
import { t } from "@shared/textes/regie";
import { AVANCE_MAX_OUVERTURE_REGIE_MIN, type CoursRegieDto, type EspaceRegieDto, type EtatRegie, type LienIntervenantDto } from "@shared/regie";
import {
  cours,
  coursFormateurs,
  directsImmediats,
  journal,
  ressourcesSeances,
  seances,
  sites,
  sondages,
  utilisateurs,
  type Seance,
  type Utilisateur,
} from "@shared/schema";

const MINUTE = 60_000;
const JOUR = 86_400_000;
/** Au plus tôt, la régie seule ouvre la classe une heure avant le cours (rappel « le cours commence » aux étudiants). */
const AVANCE_MAX_MS = AVANCE_MAX_OUVERTURE_REGIE_MIN * MINUTE;

const finPrevue = (s: Pick<Seance, "debut" | "dureeMinutes">) => new Date(s.debut.getTime() + s.dureeMinutes * MINUTE);

/** « 08:30 » UTC (heure d'Abidjan) → « 8h30 » ; « 14:00 » → « 14h ». */
function heureCourte(d: Date): string {
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** Régie sans « programme » (Chargé de cours) : elle ouvre au plus tôt une heure avant ; la direction et les profils « programme » ne changent pas. */
const regieSeule = (u: Pick<Utilisateur, "role" | "profil">) => u.role === "vie_scolaire" && !peut(u, "programme");

async function chargerSeance(id: number): Promise<Seance | undefined> {
  const [s] = await db.select().from(seances).where(eq(seances.id, id));
  return s;
}

// ── Intergiciels : garde de l'ouverture, journal ───────────────────────────

/**
 * Démarrer : la régie seule ne peut pas ouvrir une classe plus d'une heure avant le cours (un clic de trop sur le
 * cours de la semaine prochaine enverrait à toute la classe « le cours commence »). La reprise d'une séance
 * terminée, la direction, le formateur et les profils « programme » ne changent pas. Une personne qui ne fait pas
 * la régie de ce cours passe : routes/live.ts lui répond (403 ou 404), comme avant.
 */
const gardeOuverture: RequestHandler = (req, res, next) => {
  const u = req.utilisateur;
  if (!u || !regieSeule(u)) return next();
  void (async () => {
    const id = Number(req.params.id);
    const s = Number.isInteger(id) && id > 0 ? await chargerSeance(id) : undefined;
    // Premier démarrage : séance à venir, ou « terminée » sans avoir jamais démarré (live.ts la démarrerait comme
    // la première fois, rappel « le cours commence » compris). Une vraie reprise (déjà démarrée) passe.
    const premier = s && (s.statut === "planifiee" || (s.statut === "terminee" && !s.demarreeLe));
    if (!s || !premier || s.debut.getTime() - Date.now() <= AVANCE_MAX_MS) return next();
    if (!(await regieCours(u, s.coursId))) return next();
    const ouvre = new Date(s.debut.getTime() - AVANCE_MAX_MS);
    res.status(409).json({ message: t("erreur.tropTot", { v: { heure: heureCourte(ouvre) } }), code: "trop_tot", ouvreA: ouvre.toISOString() });
  })().catch(next);
};

/**
 * Terminer, Plan B : la régie seule n'agit que sur une classe OUVERTE. « Terminer » une séance à venir l'annulerait
 * sans motif (l'annulation relève de l'emploi du temps) et contournerait la garde d'ouverture ; un Plan B posé sur le
 * cours de la semaine prochaine resterait jusqu'au cours. Les autres statuts, les autres personnes et celles qui ne
 * font pas la régie de ce cours passent : routes/live.ts leur répond comme avant.
 */
const gardeClasseOuverte: RequestHandler = (req, res, next) => {
  const u = req.utilisateur;
  if (!u || !regieSeule(u)) return next();
  void (async () => {
    const id = Number(req.params.id);
    const s = Number.isInteger(id) && id > 0 ? await chargerSeance(id) : undefined;
    if (!s || s.statut !== "planifiee" || !(await regieCours(u, s.coursId))) return next();
    res.status(409).json({ message: t("erreur.pasOuverte"), code: "pas_ouverte" });
  })().catch(next);
};

type Journalise = { action: string; details?: (req: Request) => Record<string, unknown>; siDemarrage?: boolean };

/**
 * Journal des actions importantes de la régie (« comme pour la direction ») : direction et équipe seulement, jamais
 * le formateur du cours ; écrit après une réponse 2xx ; ne bloque jamais la route et ne lève jamais d'erreur.
 * « siDemarrage » : seulement si la séance n'était pas déjà en direct (un 2e « Démarrer » ne compte pas).
 */
function journaliser({ action, details, siDemarrage }: Journalise): RequestHandler {
  return (req, res, next) => {
    const u = req.utilisateur;
    if (!u || (u.role !== "admin" && u.role !== "vie_scolaire")) return next();
    const seanceId = Number(req.params.id);
    const ecouter = (dejaEnDirect: boolean) => {
      res.on("finish", () => {
        if (res.statusCode < 200 || res.statusCode >= 300 || dejaEnDirect) return;
        db.insert(journal)
          .values({ utilisateurId: u.id, action, details: { seanceId, regie: true, ...(details?.(req) ?? {}) } })
          .catch((e: Error) => console.error(`[regie] journal ${action} :`, e.message));
      });
      next();
    };
    // L'état d'avant se lit AVANT que la route ne démarre la séance.
    if (!siDemarrage || !Number.isInteger(seanceId)) return ecouter(false);
    chargerSeance(seanceId).then(
      (s) => ecouter(s?.statut === "en_direct"),
      () => ecouter(false),
    );
  };
}

const nombreFichiers = (req: Request) => ({ fichiers: Array.isArray(req.files) ? req.files.length : 0 });

// ── « Mon espace » ──────────────────────────────────────────────────────────

/** Les séances (hors essais de visio) des cours dont la personne fait la régie, sur [depuis, jusqua[, et ce qu'il faut pour leurs cartes. */
async function coursDeRegie(u: Utilisateur, depuis: Date, jusqua: Date, maintenant: Date): Promise<CoursRegieDto[]> {
  const lignes = await db
    .select({ s: seances, code: cours.code, titreCours: cours.titre, couleur: cours.couleur, formateurId: cours.formateurId })
    .from(seances)
    .innerJoin(cours, eq(cours.id, seances.coursId))
    .where(and(gte(seances.debut, depuis), lt(seances.debut, jusqua)))
    .orderBy(asc(seances.debut), asc(seances.id));
  if (!lignes.length) return [];
  const permis = await coursEnRegie(u, lignes.map((l) => l.s.coursId));
  const ids = lignes.filter((l) => permis.has(l.s.coursId)).map((l) => l.s.id);
  // Un essai de visio (direct immédiat lancé sans prévenir les étudiants) ne concerne pas la régie.
  const essais = new Set(
    ids.length
      ? (await db.select({ id: directsImmediats.seanceId }).from(directsImmediats).where(and(inArray(directsImmediats.seanceId, ids), eq(directsImmediats.prevenir, false)))).map(
          (l) => l.id,
        )
      : [],
  );
  const retenues = lignes.filter((l) => permis.has(l.s.coursId) && !essais.has(l.s.id));
  if (!retenues.length) return [];
  const seanceIds = retenues.map((l) => l.s.id);
  const coursIds = [...new Set(retenues.map((l) => l.s.coursId))];

  const [intervenants, coFormateurs, nbRessources, nbSondages, listeSites] = await Promise.all([
    intervenantsDesSeances(seanceIds),
    db.select({ coursId: coursFormateurs.coursId, formateurId: coursFormateurs.formateurId }).from(coursFormateurs).where(inArray(coursFormateurs.coursId, coursIds)),
    db
      .select({ seanceId: ressourcesSeances.seanceId, n: sql<number>`count(*)::int` })
      .from(ressourcesSeances)
      .where(inArray(ressourcesSeances.seanceId, seanceIds))
      .groupBy(ressourcesSeances.seanceId),
    db.select({ seanceId: sondages.seanceId, n: sql<number>`count(*)::int` }).from(sondages).where(inArray(sondages.seanceId, seanceIds)).groupBy(sondages.seanceId),
    db.select().from(sites).orderBy(asc(sites.ordre)),
  ]);
  const idsPrincipaux = [...new Set(retenues.map((l) => l.formateurId).filter((x): x is number => Boolean(x)))];
  const principaux = new Map(
    (idsPrincipaux.length
      ? await db.select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom }).from(utilisateurs).where(inArray(utilisateurs.id, idsPrincipaux))
      : []
    ).map((f) => [f.id, `${f.prenom} ${f.nom}`.trim()]),
  );
  const formateursDe = new Map<number, Set<number>>();
  for (const l of retenues) if (l.formateurId) formateursDe.set(l.s.coursId, new Set([...(formateursDe.get(l.s.coursId) ?? []), l.formateurId]));
  for (const c of coFormateurs) formateursDe.set(c.coursId, new Set([...(formateursDe.get(c.coursId) ?? []), c.formateurId]));
  const ressourcesDe = new Map(nbRessources.map((r) => [r.seanceId, Number(r.n)]));
  const sondagesDe = new Map(nbSondages.map((r) => [r.seanceId, Number(r.n)]));

  // Salle de chaque cours dans chaque campus (shared/salles.ts : un cours se tient dans UNE salle du campus).
  const repartitions = await Promise.all(listeSites.map(async (site) => ({ site, ...(await repartitionDuSite(site.id)) })));
  const avecProgramme = !regieSeule(u);
  const t0 = maintenant.getTime();

  return retenues.map(({ s, code, titreCours, couleur, formateurId }): CoursRegieDto => {
    const fin = finPrevue(s);
    const connectes = s.statut === "en_direct" ? utilisateursSur(canal(s.id)) : [];
    const intervenant = intervenants.get(s.id);
    const nomFormateur = intervenant?.nom ?? (formateurId ? (principaux.get(formateurId) ?? null) : null);
    const formateursDuCours = new Set([...(formateursDe.get(s.coursId) ?? []), ...(intervenant?.id ? [intervenant.id] : [])]);
    const campus = repartitions.flatMap(({ site, salles, salleDe }) => {
      if (!salleDe.has(s.coursId)) return [];
      const salle = salles.find((x) => x.numero === salleDe.get(s.coursId));
      return [
        {
          siteId: site.id,
          nomCourt: site.nomCourt,
          salle: salle ? nomDeSalle(salle.compte, site) : site.salleConference,
          connectee: connectes.some((c) => c.role === "salle" && c.siteId === site.id),
        },
      ];
    });
    const etat: EtatRegie =
      s.statut === "annulee"
        ? "annulee"
        : s.statut === "terminee"
          ? "terminee"
          : s.statut === "en_direct"
            ? s.debut.getTime() > t0
              ? "ouverte_avance"
              : "en_direct"
            : fin.getTime() <= t0
              ? "non_ouverte"
              : s.debut.getTime() <= t0
                ? "en_retard"
                : "a_venir";
    const ouvre = s.debut.getTime() - AVANCE_MAX_MS;
    const dansLaFenetre = avecProgramme || ouvre <= t0;
    return {
      seanceId: s.id,
      titre: s.titre,
      cours: { id: s.coursId, code, titre: titreCours, couleur },
      debut: s.debut.toISOString(),
      fin: fin.toISOString(),
      dureeMinutes: s.dureeMinutes,
      heures: `${heureCourte(s.debut)}-${heureCourte(fin)}`,
      etat,
      motifAnnulation: s.statut === "annulee" ? s.motifAnnulation : null,
      formateur: nomFormateur ? { nom: nomFormateur } : null,
      formateurConnecte: connectes.some((c) => c.role === "formateur" && formateursDuCours.has(c.id)),
      campus,
      sallesConnectees: campus.filter((c) => c.connectee).length,
      sallesAttendues: campus.length,
      diapos: s.diapos.length,
      ressources: ressourcesDe.get(s.id) ?? 0,
      sondages: sondagesDe.get(s.id) ?? 0,
      peutOuvrir: etat === "en_retard" || (etat === "a_venir" && dansLaFenetre),
      ouvreA: etat === "a_venir" && !dansLaFenetre ? new Date(ouvre).toISOString() : null,
    };
  });
}

/**
 * Ordre de la journée : d'abord ce qui demande d'agir (classes ouvertes, cours commencé que personne n'a ouvert),
 * puis les cours à venir, enfin ce qui est passé (terminé, annulé, pas ouvert du tout) ; par heure dans chaque groupe.
 * Sur téléphone, le premier écran montre ainsi le cours à ouvrir, pas un cours fini sans bouton.
 */
const rangEtat = (e: EtatRegie) => (e === "en_direct" || e === "ouverte_avance" || e === "en_retard" ? 0 : e === "a_venir" ? 1 : 2);

export function enregistrerRegie(app: Express) {
  // Intergiciels d'abord (routes/index.ts les déclare avant routes/live.ts et routes/ressources-seance.ts).
  app.post("/api/seances/:id/demarrer", exigerConnexion, gardeOuverture, journaliser({ action: "live_demarre", siDemarrage: true }));
  app.post("/api/seances/:id/terminer", exigerConnexion, gardeClasseOuverte, journaliser({ action: "live_termine" }));
  app.post("/api/seances/:id/plan-b", exigerConnexion, gardeClasseOuverte, journaliser({ action: "live_plan_b" }));
  app.post("/api/seances/:id/diapos", exigerConnexion, journaliser({ action: "diapos_deposees", details: nombreFichiers }));
  app.post("/api/seances/:id(\\d+)/ressources", exigerConnexion, journaliser({ action: "ressources_ajoutees", details: () => ({ fichiers: 0, lien: true }) }));
  app.post("/api/seances/:id(\\d+)/ressources/fichiers", exigerConnexion, journaliser({ action: "ressources_ajoutees", details: nombreFichiers }));
  app.delete("/api/seances/:id(\\d+)/ressources/:rid(\\d+)", exigerConnexion, journaliser({ action: "ressource_retiree", details: (req) => ({ ressourceId: Number(req.params.rid) }) }));

  app.get(
    "/api/regie",
    exigerDroit("animer", "programme"),
    route(async (req, res) => {
      const u = moi(req);
      res.setHeader("Cache-Control", "no-store");
      const jours = Math.min(7, Math.max(1, Number(req.query.jours) || 7));
      const maintenant = new Date();
      // Journée d'Abidjan (UTC) : de minuit à minuit, comme la liste des séances du jour (routes/live.ts).
      const debutJour = new Date(`${maintenant.toISOString().slice(0, 10)}T00:00:00Z`);
      const tous = await coursDeRegie(u, debutJour, new Date(debutJour.getTime() + jours * JOUR), maintenant);
      const date = debutJour.toISOString().slice(0, 10);
      const parJour = new Map<string, CoursRegieDto[]>();
      for (const c of tous) {
        const j = c.debut.slice(0, 10);
        parJour.set(j, [...(parJour.get(j) ?? []), c]);
      }
      const aujourdhui = (parJour.get(date) ?? []).sort((a, b) => rangEtat(a.etat) - rangEtat(b.etat) || a.debut.localeCompare(b.debut));
      const suivants = [...parJour.entries()]
        .filter(([j]) => j !== date)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([j, liste]) => ({ date: j, libelle: libelleDate(j), cours: liste }));
      const perimetre = perimetreSites(u);
      const [site] = perimetre ? await db.select({ nomCourt: sites.nomCourt }).from(sites).where(eq(sites.id, perimetre[0])) : [];
      const espace: EspaceRegieDto = {
        date,
        libelle: libelleDate(date),
        perimetre: { toutLeGroupe: !perimetre, campus: site?.nomCourt ?? null },
        aujourdhui,
        suivants,
      };
      res.json(espace);
    }),
  );

  app.get(
    "/api/seances/:id/lien-intervenant",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      // Formateur du cours, direction, régie (« programme » ou « animer ») : ceux qui donnent la parole.
      const s = await seanceAnimee(u, idParam(req));
      res.setHeader("Cache-Control", "no-store");
      if (s.statut === "annulee") throw new ErreurHttp(410, t("intervenant.annule"));
      if (!lienValide(s)) throw new ErreurHttp(410, t("intervenant.expire"));
      const [c] = await db.select({ formateurId: cours.formateurId }).from(cours).where(eq(cours.id, s.coursId));
      const intervenant = (await intervenantsDesSeances([s.id])).get(s.id);
      // L'animateur du créneau (emploi du temps), sinon le formateur principal ; son téléphone, s'il a un compte.
      const animateurId = intervenant ? intervenant.id : (c?.formateurId ?? null);
      const [f] = animateurId
        ? await db.select({ prenom: utilisateurs.prenom, nom: utilisateurs.nom, telephone: utilisateurs.telephone }).from(utilisateurs).where(eq(utilisateurs.id, animateurId))
        : [];
      const nom = intervenant?.nom ?? (f ? `${f.prenom} ${f.nom}`.trim() : null);
      const url = `${config.urlCampus}/invite/${jetonIntervenant(s.id)}`;
      const v = { nom: nom ?? "", titre: s.titre, jour: libelleDate(s.debut.toISOString().slice(0, 10)), heure: heureCourte(s.debut), lien: url };
      const message = t(nom ? "intervenant.message" : "intervenant.message.sansNom", { v });
      const numero = numeroWhatsApp(f?.telephone);
      const lien: LienIntervenantDto = {
        url,
        valableJusquau: finDesLiens(s).toISOString(),
        message,
        whatsapp: `https://wa.me/?text=${encodeURIComponent(message)}`,
        whatsappFormateur: numero ? `https://wa.me/${numero}?text=${encodeURIComponent(message)}` : null,
        formateur: nom,
      };
      // Qui a reçu le lien qui parle aux cinq salles : la direction et l'équipe (jamais le formateur du cours).
      if (u.role !== "formateur") {
        await db.insert(journal).values({ utilisateurId: u.id, action: "lien_intervenant_remis", details: { seanceId: s.id, regie: true } });
      }
      res.json(lien);
    }),
  );
}
