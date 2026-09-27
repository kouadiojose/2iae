// Module « programme » : l'emploi du temps officiel (sessions, créneaux,
// génération des séances live, publication). Contrats : shared/schema/ext-programme.ts.
//
//   Public (sans compte, lu aussi par 2iae.com)
//     GET  /api/public/programme                 → ProgrammePublicDto (cache 60 s, vidé à chaque publication)
//     GET  /api/public/programme/:id             → SessionDetailDto (session publiée)
//   Connecté (étudiant, formateur, équipe)
//     GET  /api/programme                        → MonProgrammeDto (ses sessions publiées)
//     GET  /api/programme/:id                    → SessionDetailDto
//   Back-office (direction et vie scolaire ; la vie scolaire d'un campus ne
//   modifie que les sessions dont toutes les classes sont dans son campus)
//     GET  /api/pilotage/programme/options
//     GET  /api/pilotage/programme/sessions        POST (nouvelle session)
//     GET  /api/pilotage/programme/sessions/:id    PATCH (réglages) · DELETE (brouillon jamais publié)
//     GET  /api/pilotage/programme/sessions/:id/occurrences
//     POST /api/pilotage/programme/sessions/:id/{publier,retirer,archiver,desarchiver,dupliquer}
//     POST /api/pilotage/programme/sessions/:id/creneaux · PATCH/DELETE /api/pilotage/programme/creneaux/:id
//     POST /api/pilotage/programme/sessions/:id/exceptions · DELETE /api/pilotage/programme/exceptions/:id
//
// La publication engendre les séances live (une par créneau « cours » et par
// date, heure d'Abidjan = UTC) et se relance sans risque après chaque
// modification (« Mettre à jour les séances ») : voir synchroniserSession().
import type { Express } from "express";
import { z } from "zod";
import { and, asc, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "../db";
import { exigerConnexion, exigerRole, moi, estEquipe, perimetreSites } from "../auth";
import { route, valider, idParam, introuvable, interdit, invalide, ErreurHttp } from "../http";
import { idsCoursAccessibles } from "../acces";
import { notifier } from "../notifications";
import { prevenirSite, surChangementPublication } from "../site";
import { publier } from "../temps-reel";
import { enregistrerMetaPage } from "../vite";
import { config } from "../config";
import * as visio from "../visio";
import {
  sessionsProgramme,
  sessionsClasses,
  creneauxProgramme,
  seancesCreneaux,
  exceptionsProgramme,
  classes,
  sites,
  cours,
  seances,
  utilisateurs,
  journal,
  TYPES_CRENEAU,
  FOURNISSEURS_VISIO,
  type SessionProgramme,
  type CreneauProgramme,
  type Utilisateur,
  type ProgrammePublicDto,
  type MonProgrammeDto,
  type SessionDetailDto,
  type SessionResumeDto,
  type SessionEditionDto,
  type OptionsProgrammeDto,
  type ChevauchementDto,
  type BilanPublication,
  type ApercuPublicationDto,
  type OccurrenceDto,
} from "@shared/schema";
import {
  NOMS_JOURS,
  aujourdhuiAbidjan,
  ajouterJours,
  chevauchent,
  creneauxEdition,
  dateValide,
  ecartJours,
  estTroncCommun,
  heureLisible,
  instant,
  jourIsoDe,
  libelleDate,
  minutes,
  normaliserHeure,
  occurrencesDe,
  prochainesOccurrences,
  seancesAVenirDeSession,
  semaineAMontrer,
  sessionsVersDto,
  synchroniserSession,
  visibiliteSeances,
  coursHorsPerimetre,
  avertissementsClassesHorsSession,
  MOTIF_ARCHIVAGE,
  type ResultatSynchro,
} from "../programme-outils";

const P = "/api/pilotage/programme";
const EQUIPE = exigerRole("admin", "vie_scolaire");

// ── Cache public (60 s, vidé à chaque changement publié) ───────────────────

const DUREE_CACHE_MS = 60_000;
let cachePublic: { expire: number; donnees: ProgrammePublicDto } | null = null;
const oublierCache = () => {
  cachePublic = null;
};
surChangementPublication(oublierCache);

// ── Petits outils ──────────────────────────────────────────────────────────

const majuscule = (t: string) => (t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}` : t);
const libelleCreneau = (c: Pick<CreneauProgramme, "jour" | "heureDebut" | "heureFin">) =>
  `${majuscule(NOMS_JOURS[c.jour])} ${heureLisible(c.heureDebut)}–${heureLisible(c.heureFin)}`;

/** Sessions à montrer : en cours et à venir (par date), puis la dernière terminée. */
function choisirSessions(liste: SessionProgramme[], aujourdhui: string): SessionProgramme[] {
  const actives = liste.filter((s) => s.fin >= aujourdhui).sort((a, b) => a.debut.localeCompare(b.debut) || a.id - b.id);
  const terminee = liste.filter((s) => s.fin < aujourdhui).sort((a, b) => b.fin.localeCompare(a.fin))[0];
  return terminee ? [...actives, terminee] : actives;
}

async function construireProgramme(liste: SessionProgramme[], publique: boolean): Promise<ProgrammePublicDto> {
  const maintenant = new Date();
  const aujourdhui = aujourdhuiAbidjan(maintenant);
  const sessions = await sessionsVersDto(choisirSessions(liste, aujourdhui), publique);
  const courantes = sessions.filter((s) => s.fin >= aujourdhui);
  return {
    sessions,
    prochaines: await prochainesOccurrences(courantes, 10, maintenant),
    genereLe: maintenant.toISOString(),
    aujourdhui,
    semaine: await semaineAMontrer(courantes, maintenant),
  };
}

const sessionsPubliees = () => db.select().from(sessionsProgramme).where(eq(sessionsProgramme.statut, "publiee"));

async function lireProgrammePublic(): Promise<ProgrammePublicDto> {
  if (cachePublic && cachePublic.expire > Date.now()) return cachePublic.donnees;
  const donnees = await construireProgramme(await sessionsPubliees(), true);
  cachePublic = { expire: Date.now() + DUREE_CACHE_MS, donnees };
  return donnees;
}

async function detailSession(s: SessionProgramme, publique: boolean): Promise<SessionDetailDto> {
  const [session] = await sessionsVersDto([s], publique);
  const maintenant = new Date();
  return { session, occurrences: await occurrencesDe([session], { maintenant }), aujourdhui: aujourdhuiAbidjan(maintenant) };
}

/** Sites des classes d'une session. */
async function sitesDeSession(sessionId: number): Promise<number[]> {
  const lignes = await db
    .select({ siteId: classes.siteId })
    .from(sessionsClasses)
    .innerJoin(classes, eq(classes.id, sessionsClasses.classeId))
    .where(eq(sessionsClasses.sessionId, sessionId));
  return [...new Set(lignes.map((l) => l.siteId))];
}

/**
 * La vie scolaire d'un campus voit les sessions qui touchent son campus (ou
 * sans classe) ; elle ne modifie que celles qui ont des classes, toutes dans
 * son campus. Une session sans classe (la « Première session » saisie avant
 * le choix des classes) reste à la direction.
 */
async function droitsSession(u: Utilisateur, sessionId: number): Promise<{ visible: boolean; modifiable: boolean }> {
  const p = perimetreSites(u);
  if (!p) return { visible: true, modifiable: true };
  const s = await sitesDeSession(sessionId);
  return { visible: !s.length || s.some((x) => p.includes(x)), modifiable: s.length > 0 && s.every((x) => p.includes(x)) };
}

/**
 * La vie scolaire d'un campus ne programme que les cours suivis uniquement
 * par son campus, ou par aucune classe (même règle qu'enseigneCours) : la
 * publication y crée des séances, y rattache des classes et des formateurs.
 */
async function verifierCoursProgrammables(u: Utilisateur, coursIds: number[]) {
  const hors = await coursHorsPerimetre(coursIds, perimetreSites(u));
  if (!hors.length) return;
  const codes = (await db.select({ code: cours.code }).from(cours).where(inArray(cours.id, hors))).map((c) => c.code);
  throw interdit(
    hors.length > 1
      ? `Les cours ${enumerer(codes)} concernent d'autres campus : seule la direction peut les programmer.`
      : `Le cours ${codes[0] ?? ""} concerne d'autres campus : seule la direction peut le programmer.`,
  );
}

/** Avant « Publier » : un cours a pu être partagé avec un autre campus depuis la saisie du créneau. */
async function verifierCoursDeSession(u: Utilisateur, sessionId: number) {
  if (!perimetreSites(u)) return;
  const lignes = await db.select({ coursId: creneauxProgramme.coursId }).from(creneauxProgramme).where(eq(creneauxProgramme.sessionId, sessionId));
  await verifierCoursProgrammables(u, lignes.map((l) => l.coursId).filter((x): x is number => x !== null));
}

async function sessionEquipe(u: Utilisateur, id: number, modifier = false): Promise<SessionProgramme> {
  const [s] = await db.select().from(sessionsProgramme).where(eq(sessionsProgramme.id, id));
  if (!s) throw introuvable("Emploi du temps");
  const d = await droitsSession(u, id);
  if (!d.visible) throw introuvable("Emploi du temps");
  if (modifier && !d.modifiable) throw interdit("Cet emploi du temps concerne d'autres campus : seule la direction peut le modifier.");
  return s;
}

async function creneauEquipe(u: Utilisateur, id: number): Promise<{ c: CreneauProgramme; s: SessionProgramme }> {
  const [c] = await db.select().from(creneauxProgramme).where(eq(creneauxProgramme.id, id));
  if (!c) throw introuvable("Créneau");
  return { c, s: await sessionEquipe(u, c.sessionId, true) };
}

/** Marque la session modifiée ; « repercuter » : le changement touche les séances (bouton « Mettre à jour les séances »). */
async function toucher(s: SessionProgramme, repercuter: boolean) {
  if (repercuter) await db.update(sessionsProgramme).set({ majLe: new Date() }).where(eq(sessionsProgramme.id, s.id));
  if (s.statut === "publiee") {
    oublierCache();
    prevenirSite("programme modifié");
  }
}

const aRepercuter = (s: SessionProgramme) => s.statut === "publiee" && (!s.synchroniseeLe || s.synchroniseeLe.getTime() < s.majLe.getTime());

/** Points à vérifier avant de publier. */
function avertissementsSession(s: SessionProgramme, dto: SessionEditionDto): string[] {
  const liste: string[] = [];
  const jours = new Set<number>();
  for (let d = s.debut, i = 0; d <= s.fin && i < 7; d = ajouterJours(d, 1), i++) jours.add(jourIsoDe(d));
  for (const c of dto.creneaux) {
    const l = libelleCreneau(c);
    if (!jours.has(c.jour)) liste.push(`${l} : ce jour ne tombe pas dans la période de la session.`);
    if (c.type === "cours" && !c.cours) liste.push(`${l} : aucun cours choisi, aucune séance ne sera créée.`);
    if (c.cours && !c.intervenant) {
      liste.push(c.intervenantNom ? `${l} : ${c.intervenantNom} n'a pas de compte sur le campus, il ne pourra pas ouvrir sa classe.` : `${l} : aucun intervenant choisi.`);
    }
    if (dto.pause && chevauchent(c, { heureDebut: dto.pause.debut, heureFin: dto.pause.fin })) {
      const englobe = minutes(c.heureDebut) <= minutes(dto.pause.debut) && minutes(c.heureFin) >= minutes(dto.pause.fin);
      if (!englobe) liste.push(`La pause (${heureLisible(dto.pause.debut)}–${heureLisible(dto.pause.fin)}) déborde sur le créneau ${l.toLowerCase()} : vérifiez les heures.`);
    }
  }
  const parJour = new Map<number, typeof dto.creneaux>();
  for (const c of dto.creneaux) parJour.set(c.jour, [...(parJour.get(c.jour) ?? []), c]);
  for (const [jour, liste2] of parJour) {
    for (let i = 0; i < liste2.length; i++) {
      for (let j = i + 1; j < liste2.length; j++) {
        if (chevauchent(liste2[i], liste2[j])) liste.push(`${majuscule(NOMS_JOURS[jour])} : « ${liste2[i].libelle} » et « ${liste2[j].libelle} » se chevauchent.`);
      }
    }
  }
  if (!dto.classes.length) liste.push("Aucune classe destinataire : choisissez-les dans les réglages, sinon aucun étudiant ne sera prévenu.");
  return liste;
}

async function editionSession(u: Utilisateur, s: SessionProgramme): Promise<SessionEditionDto> {
  const { session, creneaux, nbSeances } = await creneauxEdition(s);
  const d = await droitsSession(u, s.id);
  const dto: SessionEditionDto = {
    ...session,
    creneaux,
    synchroniseeLe: s.synchroniseeLe?.toISOString() ?? null,
    majLe: s.majLe.toISOString(),
    aRepercuter: aRepercuter(s),
    modifiable: d.modifiable,
    nbSeances,
    nbSeancesAVenir: (await seancesAVenirDeSession(s.id)).length,
    avertissements: [],
  };
  // Intervenants qui n'ont pas encore activé leur compte (code provisoire jamais remplacé).
  const ids = [...new Set(creneaux.map((c) => c.intervenant?.id).filter((x): x is number => Boolean(x)))];
  const inactifs = ids.length
    ? await db
        .select({ prenom: utilisateurs.prenom, nom: utilisateurs.nom })
        .from(utilisateurs)
        .where(and(inArray(utilisateurs.id, ids), or(eq(utilisateurs.doitChangerMotDePasse, true), eq(utilisateurs.actif, false))))
    : [];
  dto.avertissements = [
    ...avertissementsSession(s, dto),
    ...inactifs.map((p) => `${p.prenom} ${p.nom} n'a pas encore activé son compte : envoyez-lui son lien d'invitation (Pilotage → Rentrée).`),
    ...(await avertissementsClassesHorsSession(s.id)),
  ];
  if (d.modifiable && s.statut !== "archivee") {
    const hors = await coursHorsPerimetre(creneaux.map((c) => c.cours?.id).filter((x): x is number => Boolean(x)), perimetreSites(u));
    for (const c of creneaux.filter((x) => x.cours && hors.includes(x.cours.id))) {
      dto.avertissements.push(`${libelleCreneau(c)} : le cours ${c.cours!.code} est maintenant suivi par d'autres campus, seule la direction peut le programmer. Choisissez un autre cours ou demandez-lui de publier.`);
    }
  }
  return dto;
}

async function rechargerSession(id: number): Promise<SessionProgramme> {
  const [s] = await db.select().from(sessionsProgramme).where(eq(sessionsProgramme.id, id));
  if (!s) throw introuvable("Emploi du temps");
  return s;
}

/** Étudiants actifs de ces classes. */
async function etudiantsDesClasses(classeIds: number[]): Promise<number[]> {
  if (!classeIds.length) return [];
  const lignes = await db
    .select({ id: utilisateurs.id })
    .from(utilisateurs)
    .where(and(eq(utilisateurs.role, "etudiant"), eq(utilisateurs.actif, true), inArray(utilisateurs.classeId, classeIds)));
  return lignes.map((l) => l.id);
}

/**
 * Classes de la session qui n'ont pas encore reçu « L'emploi du temps … est
 * en ligne » (toutes avant la première publication). « reclamer » les marque
 * prévenues dans la même requête : deux « Publier » simultanés ne préviennent
 * jamais deux fois la même classe.
 */
async function classesAPrevenir(sessionId: number, reclamer: boolean): Promise<number[]> {
  const condition = and(eq(sessionsClasses.sessionId, sessionId), isNull(sessionsClasses.prevenueLe));
  const lignes = reclamer
    ? await db.update(sessionsClasses).set({ prevenueLe: new Date() }).where(condition).returning({ id: sessionsClasses.classeId })
    : await db.select({ id: sessionsClasses.classeId }).from(sessionsClasses).where(condition);
  return lignes.map((l) => l.id);
}

/** Étudiants concernés : ceux des classes destinataires. */
async function etudiantsDeSession(sessionId: number): Promise<number[]> {
  const lignes = await db
    .select({ id: utilisateurs.id })
    .from(utilisateurs)
    .where(
      and(
        eq(utilisateurs.role, "etudiant"),
        eq(utilisateurs.actif, true),
        inArray(utilisateurs.classeId, db.select({ id: sessionsClasses.classeId }).from(sessionsClasses).where(eq(sessionsClasses.sessionId, sessionId))),
      ),
    );
  return lignes.map((l) => l.id);
}

/** Les pages ouvertes des séances touchées se rafraîchissent (studio, salle live, écran de salle). */
function diffuserChangements(r: Pick<ResultatSynchro, "changements">) {
  for (const ch of r.changements) {
    if (ch.nature === "annulee") publier(`seance:${ch.seanceId}`, "statut", { statut: "annulee", demarreeLe: null, termineeLe: null, motif: ch.motif ?? null });
    else if (ch.nature === "retablie") publier(`seance:${ch.seanceId}`, "statut", { statut: "planifiee", demarreeLe: null, termineeLe: null, motif: null });
    else publier(`seance:${ch.seanceId}`, "seance", null);
  }
}

/** « lundi 28 septembre et lundi 5 octobre » */
const enumerer = (items: string[]) => (items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`);

/**
 * Étudiants à prévenir par une publication : les classes pas encore prévenues
 * reçoivent « est en ligne » (toutes à la première publication, puis celles
 * ajoutées depuis), les autres « a changé » s'il y a des changements.
 */
async function etudiantsAPrevenir(s: SessionProgramme, r: Pick<ResultatSynchro, "premiere" | "changements">, reclamer: boolean): Promise<{ nouveaux: number[]; autres: number[] }> {
  const aPrevenir = await classesAPrevenir(s.id, reclamer);
  const nouveaux = await etudiantsDesClasses(aPrevenir);
  const dejaVus = new Set(nouveaux);
  const autres = !r.premiere && r.changements.length ? (await etudiantsDeSession(s.id)).filter((id) => !dejaVus.has(id)) : [];
  return { nouveaux, autres };
}

/** Une notification par personne après une publication ou une mise à jour. */
async function prevenirApresPublication(s: SessionProgramme, r: ResultatSynchro): Promise<{ etudiants: number; intervenants: number }> {
  const [dto] = await sessionsVersDto([s], false);
  const occurrences = (await occurrencesDe([dto])).filter((o) => o.statut !== "annulee");
  const periode = `Du ${libelleDate(s.debut)} au ${libelleDate(s.fin)}`;
  const { nouveaux, autres } = await etudiantsAPrevenir(s, r, true);
  let intervenants: number[] = [];

  if (nouveaux.length) {
    const premier = occurrences.find((o) => new Date(o.fin).getTime() > Date.now() && o.type === "cours") ?? occurrences[0];
    await notifier(nouveaux, {
      type: "cours",
      titre: `L'emploi du temps de la ${s.titre} est en ligne`,
      corps: `${periode}.${premier ? ` Premier cours : ${premier.libelle}, ${libelleDate(premier.date)} à ${heureLisible(premier.debut.slice(11, 16))}.` : ""}`,
      lien: "/emploi-du-temps",
    });
  }
  if (r.premiere) {
    intervenants = [...new Set(dto.creneaux.map((c) => c.intervenant?.id).filter((x): x is number => Boolean(x)))];
  } else if (r.changements.length) {
    const n = (nature: string) => r.changements.filter((c) => c.nature === nature).length;
    // « 1 séance ajoutée, 2 modifiées et 1 annulée » : le nom seulement devant le premier nombre.
    const morceaux = (
      [
        [n("creee"), "ajoutée"],
        [n("modifiee"), "modifiée"],
        [n("annulee"), "annulée"],
        [n("retablie"), "rétablie"],
      ] as [number, string][]
    )
      .filter(([k]) => k > 0)
      .map(([k, participe], i) => `${k}${i === 0 ? ` séance${k > 1 ? "s" : ""}` : ""} ${participe}${k > 1 ? "s" : ""}`);
    await notifier(autres, {
      type: "cours",
      titre: `L'emploi du temps de la ${s.titre} a changé`,
      corps: `${majuscule(enumerer(morceaux))}. Regarde ta semaine.`,
      lien: "/emploi-du-temps",
    });
    intervenants = r.intervenantsTouches;
  }

  // Intervenants : leurs dates, à l'heure d'Abidjan.
  let intervenantsPrevenus = 0;
  for (const id of intervenants) {
    const miennes = occurrences.filter((o) => o.intervenantId === id);
    if (!miennes.length) {
      // Remplacé (ou son créneau retiré) : il sait qu'il n'est plus attendu.
      if (!r.premiere) {
        await notifier([id], {
          type: "cours",
          titre: `Emploi du temps modifié : ${s.titre}`,
          corps: `Vous n'avez plus de séance dans cet emploi du temps (${s.titre} ${s.anneeAcademique}).`,
          lien: "/emploi-du-temps",
        });
        intervenantsPrevenus++;
      }
      continue;
    }
    intervenantsPrevenus++;
    const parLibelle = new Map<string, OccurrenceDto[]>();
    for (const o of miennes) parLibelle.set(`${o.libelle}|${o.debut.slice(11, 16)}|${o.fin.slice(11, 16)}`, [...(parLibelle.get(`${o.libelle}|${o.debut.slice(11, 16)}|${o.fin.slice(11, 16)}`) ?? []), o]);
    const lignes = [...parLibelle.entries()].map(([cle, os]) => {
      const [libelle, d, f] = cle.split("|");
      return `${libelle} : ${enumerer(os.map((o) => libelleDate(o.date)))}, de ${heureLisible(d)} à ${heureLisible(f)}`;
    });
    await notifier([id], {
      type: "cours",
      titre: r.premiere ? `Vos séances du ${libelleDate(miennes[0].date).replace(/^\S+ /, "")} au ${libelleDate(miennes[miennes.length - 1].date).replace(/^\S+ /, "")}` : `Emploi du temps modifié : ${s.titre}`,
      corps: `${lignes.join(" · ")} (heure d'Abidjan). ${s.titre} ${s.anneeAcademique}.`,
      lien: "/emploi-du-temps",
    });
  }
  return { etudiants: nouveaux.length + autres.length, intervenants: intervenantsPrevenus };
}

// ── Validation ─────────────────────────────────────────────────────────────

const heure = z.preprocess(
  (v) => (typeof v === "string" ? (normaliserHeure(v) ?? v) : v),
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "l'heure s'écrit comme « 08:30 »"),
);
const heureOuNulle = z.preprocess((v) => (v === "" ? null : v), heure.nullable());
const jourCivil = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "la date s'écrit comme « 2026-09-28 »")
  .refine(dateValide, "cette date n'existe pas");

const champsSession = {
  anneeAcademique: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, "l'année s'écrit comme « 2026-2027 »")
    .refine((a) => Number(a.slice(5)) === Number(a.slice(0, 4)) + 1, "les deux années doivent se suivre (« 2026-2027 »)"),
  titre: z.string().trim().min(2, "donnez un titre à la session").max(120, "titre trop long"),
  public: z.string().trim().max(160, "texte trop long"),
  debut: jourCivil,
  fin: jourCivil,
  pauseDebut: heureOuNulle,
  pauseFin: heureOuNulle,
  note: z.string().trim().max(1000, "note trop longue"),
  signataire: z.string().trim().min(2, "indiquez le signataire").max(120, "texte trop long"),
  classeIds: z.array(z.number().int().positive()).max(400),
};
const schemaSession = z.object({
  ...champsSession,
  public: champsSession.public.default(""),
  pauseDebut: champsSession.pauseDebut.optional(),
  pauseFin: champsSession.pauseFin.optional(),
  note: champsSession.note.default(""),
  signataire: champsSession.signataire.default("Le service des études"),
  classeIds: champsSession.classeIds.default([]),
});
const schemaReglages = z.object(champsSession).partial();

function verifierCoherence(d: { debut: string; fin: string; pauseDebut: string | null; pauseFin: string | null }) {
  if (d.fin < d.debut) throw invalide("La date de fin doit venir après la date de début.");
  if (ecartJours(d.debut, d.fin) > 366) throw invalide("Une session dure au plus un an.");
  if ((d.pauseDebut && !d.pauseFin) || (!d.pauseDebut && d.pauseFin)) throw invalide("Indiquez le début et la fin de la pause, ou aucune des deux.");
  if (d.pauseDebut && d.pauseFin && minutes(d.pauseFin) <= minutes(d.pauseDebut)) throw invalide("La pause doit finir après avoir commencé.");
}

async function verifierClasses(u: Utilisateur, ids: number[]) {
  const uniques = [...new Set(ids)];
  const p = perimetreSites(u);
  // Sans classe, la session n'appartiendrait à aucun campus : elle est réservée à la direction.
  if (p && !uniques.length) throw invalide("Choisissez au moins une classe de votre campus : une session sans classe est réservée à la direction.");
  if (!uniques.length) return uniques;
  const trouvees = await db.select({ id: classes.id, siteId: classes.siteId }).from(classes).where(inArray(classes.id, uniques));
  if (trouvees.length !== uniques.length) throw invalide("Une des classes choisies n'existe plus.");
  if (p && trouvees.some((c) => !p.includes(c.siteId))) throw interdit("Vous ne pouvez choisir que les classes de votre campus.");
  return uniques;
}

const schemaCreneau = z.object({
  jour: z.number().int().min(1, "jour invalide").max(7, "jour invalide"),
  heureDebut: heure,
  heureFin: heure,
  type: z.enum(TYPES_CRENEAU),
  coursId: z.number().int().positive().nullable().default(null),
  titre: z.string().trim().max(120, "titre trop long").default(""),
  intervenantId: z.number().int().positive().nullable().default(null),
  intervenantNom: z.string().trim().max(120, "nom trop long").default(""),
  mention: z.string().trim().max(120, "mention trop longue").default(""),
  fournisseur: z.enum(FOURNISSEURS_VISIO).nullable().default(null),
  /** Chevauchement accepté par la personne après l'avertissement. */
  confirmer: z.boolean().optional(),
});
type CreneauSaisi = z.infer<typeof schemaCreneau>;

/**
 * « coursChange » : le cours est nouveau ou change. Au PATCH d'un créneau, le
 * périmètre d'un cours déjà choisi ne se revérifie pas (l'édition reste
 * possible) : c'est la publication qui refuse un cours partagé depuis.
 */
async function verifierCreneau(u: Utilisateur, s: SessionProgramme, d: Omit<CreneauSaisi, "confirmer">, confirmer: boolean | undefined, saufId?: number, coursChange = true) {
  if (minutes(d.heureFin) <= minutes(d.heureDebut)) throw invalide("L'heure de fin doit venir après l'heure de début.");
  if (d.coursId) {
    const [c] = await db.select({ id: cours.id, statut: cours.statut }).from(cours).where(eq(cours.id, d.coursId));
    if (!c) throw invalide("Ce cours n'existe plus.");
    if (c.statut === "archive") throw invalide("Ce cours est archivé : choisissez-en un autre ou désarchivez-le.");
    if (coursChange) await verifierCoursProgrammables(u, [c.id]);
  }
  if (d.intervenantId) {
    const [p] = await db.select({ role: utilisateurs.role, actif: utilisateurs.actif }).from(utilisateurs).where(eq(utilisateurs.id, d.intervenantId));
    if (!p || !p.actif || !["formateur", "admin"].includes(p.role)) throw invalide("L'intervenant doit être un formateur (ou un membre de la direction) dont le compte est actif.");
  }
  if (d.type !== "cours" && !d.coursId && !d.titre) throw invalide("Donnez un titre au créneau (par exemple « Séminaire »).");
  const memeJour = await db
    .select()
    .from(creneauxProgramme)
    .where(and(eq(creneauxProgramme.sessionId, s.id), eq(creneauxProgramme.jour, d.jour), saufId ? ne(creneauxProgramme.id, saufId) : sql`true`));
  const conflits = memeJour.filter((c) => chevauchent(c, d));
  if (conflits.length && !confirmer) {
    const coursIds = conflits.map((c) => c.coursId).filter((x): x is number => x !== null);
    const titres = new Map((coursIds.length ? await db.select({ id: cours.id, titre: cours.titre }).from(cours).where(inArray(cours.id, coursIds)) : []).map((c) => [c.id, c.titre]));
    const details: ChevauchementDto[] = conflits.map((c) => ({
      id: c.id,
      jour: c.jour,
      heureDebut: c.heureDebut,
      heureFin: c.heureFin,
      libelle: (c.coursId && titres.get(c.coursId)) || c.titre || "Créneau",
    }));
    throw new ErreurHttp(
      409,
      `Ce créneau chevauche ${details.map((x) => `« ${x.libelle} » (${heureLisible(x.heureDebut)}–${heureLisible(x.heureFin)})`).join(" et ")} le ${NOMS_JOURS[d.jour]}. Confirmez pour l'enregistrer quand même.`,
      { chevauchements: details },
    );
  }
}

// ── Pages publiques : titre et aperçu WhatsApp ─────────────────────────────

const echapper = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function metaProgramme(url: string): Promise<string | null> {
  const chemin = decodeURIComponent(url.split(/[?#]/)[0]).replace(/\/+$/, "");
  const m = /^\/programme(?:\/(\d+))?(\/imprimer)?$/.exec(chemin);
  if (!m) return null;
  const programme = await lireProgrammePublic();
  const s = m[1] ? programme.sessions.find((x) => x.id === Number(m[1])) ?? (await sessionPubliee(Number(m[1])).then((x) => (x ? sessionsVersDto([x], true).then((l) => l[0]) : null))) : programme.sessions[0];
  const titre = s ? `Emploi du temps · ${s.titre} ${s.anneeAcademique} · Campus numérique 2IAE` : "Emploi du temps · Campus numérique 2IAE";
  const matieres = s ? [...new Set(s.creneaux.map((c) => c.libelle))] : [];
  const description = s
    ? `${s.public ? `${s.public}. ` : ""}Du ${libelleDate(s.debut, true)} au ${libelleDate(s.fin, true)}${matieres.length ? ` : ${enumerer(matieres)}` : ""}. Cours en direct dans les cinq campus 2IAE et sur téléphone.`
    : "L'emploi du temps officiel des cours en direct du campus numérique 2IAE.";
  const adresse = `${config.urlCampus}${chemin || "/programme"}`;
  return [
    `<title>${echapper(titre)}</title>`,
    `<meta name="description" content="${echapper(description)}" />`,
    `<link rel="canonical" href="${echapper(adresse)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="Campus numérique 2IAE" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta property="og:title" content="${echapper(titre)}" />`,
    `<meta property="og:description" content="${echapper(description)}" />`,
    `<meta property="og:url" content="${echapper(adresse)}" />`,
    `<meta property="og:image" content="${echapper(`${config.urlCampus}/logo-2iae-hd.png`)}" />`,
  ].join("\n");
}

async function sessionPubliee(id: number): Promise<SessionProgramme | null> {
  const [s] = await db
    .select()
    .from(sessionsProgramme)
    .where(and(eq(sessionsProgramme.id, id), eq(sessionsProgramme.statut, "publiee")));
  return s ?? null;
}

// ── Routes ─────────────────────────────────────────────────────────────────

export function enregistrerProgramme(app: Express) {
  enregistrerMetaPage(metaProgramme);

  // ── Public ───────────────────────────────────────────────────────────────

  app.get(
    "/api/public/programme",
    route(async (_req, res) => {
      res.setHeader("Cache-Control", "public, max-age=60");
      res.json(await lireProgrammePublic());
    }),
  );

  app.get(
    "/api/public/programme/:id(\\d+)",
    route(async (req, res) => {
      const s = await sessionPubliee(idParam(req));
      if (!s) throw introuvable("Emploi du temps");
      res.setHeader("Cache-Control", "public, max-age=60");
      res.json(await detailSession(s, true));
    }),
  );

  // ── Connecté ─────────────────────────────────────────────────────────────

  /** Sessions publiées qui concernent la personne : sa classe (étudiant), ses créneaux ou ses cours (formateur), son périmètre (équipe). */
  async function sessionsDe(u: Utilisateur): Promise<SessionProgramme[]> {
    const publiees = await sessionsPubliees();
    if (!publiees.length) return [];
    const ids = publiees.map((s) => s.id);
    if (estEquipe(u)) {
      const p = perimetreSites(u);
      if (!p) return publiees;
      const gardees: SessionProgramme[] = [];
      for (const s of publiees) if ((await droitsSession(u, s.id)).visible) gardees.push(s);
      return gardees;
    }
    if (u.role === "etudiant") {
      if (!u.classeId) return [];
      const lignes = await db
        .select({ id: sessionsClasses.sessionId })
        .from(sessionsClasses)
        .where(and(eq(sessionsClasses.classeId, u.classeId), inArray(sessionsClasses.sessionId, ids)));
      const garder = new Set(lignes.map((l) => l.id));
      return publiees.filter((s) => garder.has(s.id));
    }
    if (u.role === "formateur") {
      const mesCours = await idsCoursAccessibles(u);
      const lignes = await db
        .select({ id: creneauxProgramme.sessionId })
        .from(creneauxProgramme)
        .where(
          and(
            inArray(creneauxProgramme.sessionId, ids),
            mesCours.length ? or(eq(creneauxProgramme.intervenantId, u.id), inArray(creneauxProgramme.coursId, mesCours)) : eq(creneauxProgramme.intervenantId, u.id),
          ),
        );
      const garder = new Set(lignes.map((l) => l.id));
      return publiees.filter((s) => garder.has(s.id));
    }
    return [];
  }

  app.get(
    "/api/programme",
    exigerConnexion,
    route(async (req, res) => {
      const reponse: MonProgrammeDto = await construireProgramme(await sessionsDe(moi(req)), false);
      res.json(reponse);
    }),
  );

  app.get(
    "/api/programme/:id(\\d+)",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const id = idParam(req);
      const s = estEquipe(u) ? await sessionEquipe(u, id) : await sessionPubliee(id);
      if (!s) throw introuvable("Emploi du temps");
      res.json(await detailSession(s, false));
    }),
  );

  // ── Back-office : options de l'éditeur ───────────────────────────────────

  app.get(
    `${P}/options`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const p = perimetreSites(u);
      // Vie scolaire d'un campus : seulement les cours qu'elle peut programmer (suivis par son seul campus, ou sans classe).
      const accessibles = await idsCoursAccessibles(u);
      const horsPerimetre = new Set(await coursHorsPerimetre(accessibles, p));
      const ids = accessibles.filter((id) => !horsPerimetre.has(id));
      const listeCours = ids.length
        ? await db
            .select({ c: cours, prenom: utilisateurs.prenom, nom: utilisateurs.nom })
            .from(cours)
            .leftJoin(utilisateurs, eq(utilisateurs.id, cours.formateurId))
            .where(and(inArray(cours.id, ids), ne(cours.statut, "archive")))
            .orderBy(asc(cours.titre))
        : [];
      const personnes = await db
        .select()
        .from(utilisateurs)
        .where(and(inArray(utilisateurs.role, ["formateur", "admin"]), eq(utilisateurs.actif, true)))
        .orderBy(sql`case ${utilisateurs.role} when 'formateur' then 0 else 1 end`, asc(utilisateurs.nom), asc(utilisateurs.prenom));
      const listeSites = await db.select().from(sites).orderBy(asc(sites.ordre), asc(sites.id));
      const listeClasses = await db.select().from(classes).orderBy(asc(classes.nom));
      const effectifs = await db
        .select({ classeId: utilisateurs.classeId, n: sql<number>`count(*)::int` })
        .from(utilisateurs)
        .where(and(eq(utilisateurs.role, "etudiant"), eq(utilisateurs.actif, true)))
        .groupBy(utilisateurs.classeId);
      const effectifDe = new Map(effectifs.map((e) => [e.classeId, e.n]));
      const options: OptionsProgrammeDto = {
        cours: listeCours.map((l) => ({
          id: l.c.id,
          code: l.c.code,
          titre: l.c.titre,
          couleur: l.c.couleur,
          statut: l.c.statut,
          formateurId: l.c.formateurId,
          formateur: l.prenom ? `${l.prenom} ${l.nom}` : null,
        })),
        formateurs: personnes.map((f) => ({
          id: f.id,
          prenom: f.prenom,
          nom: f.nom,
          titre: f.role === "admin" ? f.titre || "Direction" : f.titre,
          localisation: f.localisation,
          active: !f.doitChangerMotDePasse,
        })),
        sites: listeSites
          .filter((s) => !p || p.includes(s.id))
          .map((s) => ({
            id: s.id,
            nom: s.nom,
            nomCourt: s.nomCourt,
            modifiable: !p || p.includes(s.id),
            classes: listeClasses
              .filter((c) => c.siteId === s.id)
              .map((c) => ({
                id: c.id,
                nom: c.nom,
                niveau: c.niveau,
                filiere: c.filiere,
                anneeScolaire: c.anneeScolaire,
                effectif: effectifDe.get(c.id) ?? 0,
                troncCommun: estTroncCommun(c),
              })),
          })),
        fournisseurs: visio.fournisseursDisponibles(),
        fournisseurParDefaut: visio.fournisseurParDefaut(),
        peutCreerFormateur: !p,
        toutLeGroupe: !p,
      };
      res.json(options);
    }),
  );

  // ── Back-office : sessions ───────────────────────────────────────────────

  app.get(
    `${P}/sessions`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const toutes = await db.select().from(sessionsProgramme).orderBy(desc(sessionsProgramme.debut));
      const visibles: { s: SessionProgramme; modifiable: boolean }[] = [];
      for (const s of toutes) {
        const d = await droitsSession(u, s.id);
        if (d.visible) visibles.push({ s, modifiable: d.modifiable });
      }
      const ids = visibles.map((v) => v.s.id);
      const dtos = await sessionsVersDto(
        visibles.map((v) => v.s),
        false,
      );
      const nbSeances = new Map<number, number>();
      if (ids.length) {
        const lignes = await db
          .select({ sessionId: creneauxProgramme.sessionId, n: sql<number>`count(*) filter (where ${seances.statut} <> 'annulee')::int` })
          .from(seancesCreneaux)
          .innerJoin(creneauxProgramme, eq(creneauxProgramme.id, seancesCreneaux.creneauId))
          .innerJoin(seances, eq(seances.id, seancesCreneaux.seanceId))
          .where(inArray(creneauxProgramme.sessionId, ids))
          .groupBy(creneauxProgramme.sessionId);
        for (const l of lignes) nbSeances.set(l.sessionId, l.n);
      }
      const maintenant = new Date();
      const aujourdhui = aujourdhuiAbidjan(maintenant);
      const resumes: SessionResumeDto[] = [];
      for (const [i, v] of visibles.entries()) {
        const dto = dtos[i];
        const prochaine = v.s.statut === "archivee" ? null : ((await prochainesOccurrences([dto], 1, maintenant))[0] ?? null);
        resumes.push({
          id: v.s.id,
          anneeAcademique: v.s.anneeAcademique,
          titre: v.s.titre,
          public: v.s.public,
          debut: v.s.debut,
          fin: v.s.fin,
          statut: v.s.statut,
          publieeLe: v.s.publieeLe?.toISOString() ?? null,
          nbCreneaux: dto.creneaux.length,
          nbClasses: dto.classes.length,
          nbSeances: nbSeances.get(v.s.id) ?? 0,
          prochaine,
          aRepercuter: aRepercuter(v.s),
          modifiable: v.modifiable,
        });
      }
      // En cours et à venir d'abord (par date), puis les terminées, puis les archivées.
      const rang = (r: SessionResumeDto) => (r.statut === "archivee" ? 2 : r.fin < aujourdhui ? 1 : 0);
      resumes.sort((a, b) => rang(a) - rang(b) || (rang(a) === 0 ? a.debut.localeCompare(b.debut) : b.debut.localeCompare(a.debut)));
      res.json(resumes);
    }),
  );

  app.post(
    `${P}/sessions`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const d = valider(schemaSession, req.body);
      const pause = { pauseDebut: d.pauseDebut ?? null, pauseFin: d.pauseFin ?? null };
      verifierCoherence({ debut: d.debut, fin: d.fin, ...pause });
      const classeIds = await verifierClasses(u, d.classeIds);
      const s = await db.transaction(async (tx) => {
        const [cree] = await tx
          .insert(sessionsProgramme)
          .values({
            anneeAcademique: d.anneeAcademique,
            titre: d.titre,
            public: d.public,
            debut: d.debut,
            fin: d.fin,
            ...pause,
            note: d.note,
            signataire: d.signataire,
            creeParId: u.id,
          })
          .returning();
        if (classeIds.length) await tx.insert(sessionsClasses).values(classeIds.map((classeId) => ({ sessionId: cree.id, classeId })));
        return cree;
      });
      await db.insert(journal).values({ utilisateurId: u.id, action: "programme_session_creee", details: { sessionId: s.id, titre: s.titre } });
      res.status(201).json(await editionSession(u, s));
    }),
  );

  app.get(
    `${P}/sessions/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      res.json(await editionSession(u, await sessionEquipe(u, idParam(req))));
    }),
  );

  app.patch(
    `${P}/sessions/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const avant = await sessionEquipe(u, idParam(req), true);
      if (avant.statut === "archivee") throw new ErreurHttp(409, "Cet emploi du temps est archivé : désarchivez-le pour le modifier.");
      const d = valider(schemaReglages, req.body);
      const fusion = {
        debut: d.debut ?? avant.debut,
        fin: d.fin ?? avant.fin,
        pauseDebut: d.pauseDebut !== undefined ? d.pauseDebut : avant.pauseDebut,
        pauseFin: d.pauseFin !== undefined ? d.pauseFin : avant.pauseFin,
      };
      verifierCoherence(fusion);
      const maj: Partial<typeof sessionsProgramme.$inferInsert> = {};
      for (const k of ["anneeAcademique", "titre", "public", "note", "signataire"] as const) if (d[k] !== undefined && d[k] !== avant[k]) maj[k] = d[k];
      if (fusion.debut !== avant.debut) maj.debut = fusion.debut;
      if (fusion.fin !== avant.fin) maj.fin = fusion.fin;
      if (fusion.pauseDebut !== avant.pauseDebut) maj.pauseDebut = fusion.pauseDebut;
      if (fusion.pauseFin !== avant.pauseFin) maj.pauseFin = fusion.pauseFin;
      let classesChangees = false;
      if (d.classeIds !== undefined) {
        const voulues = await verifierClasses(u, d.classeIds);
        const actuelles = (await db.select({ id: sessionsClasses.classeId }).from(sessionsClasses).where(eq(sessionsClasses.sessionId, avant.id))).map((l) => l.id);
        const a = new Set(actuelles);
        const ajoutees = voulues.filter((id) => !a.has(id));
        const retirees = actuelles.filter((id) => !voulues.includes(id));
        if (ajoutees.length || retirees.length) {
          classesChangees = true;
          await db.transaction(async (tx) => {
            if (retirees.length) await tx.delete(sessionsClasses).where(and(eq(sessionsClasses.sessionId, avant.id), inArray(sessionsClasses.classeId, retirees)));
            if (ajoutees.length) await tx.insert(sessionsClasses).values(ajoutees.map((classeId) => ({ sessionId: avant.id, classeId }))).onConflictDoNothing();
          });
        }
      }
      if (Object.keys(maj).length) await db.update(sessionsProgramme).set(maj).where(eq(sessionsProgramme.id, avant.id));
      if (Object.keys(maj).length || classesChangees) {
        // Les dates et les classes touchent les séances ; le titre, la pause ou la signature seulement l'affichage.
        await toucher(await rechargerSession(avant.id), maj.debut !== undefined || maj.fin !== undefined || classesChangees);
        await db.insert(journal).values({ utilisateurId: u.id, action: "programme_session_modifiee", details: { sessionId: avant.id, champs: [...Object.keys(maj), ...(classesChangees ? ["classes"] : [])] } });
      }
      res.json(await editionSession(u, await rechargerSession(avant.id)));
    }),
  );

  app.delete(
    `${P}/sessions/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const s = await sessionEquipe(u, idParam(req), true);
      const [lien] = await db
        .select({ id: seancesCreneaux.seanceId })
        .from(seancesCreneaux)
        .innerJoin(creneauxProgramme, eq(creneauxProgramme.id, seancesCreneaux.creneauId))
        .where(eq(creneauxProgramme.sessionId, s.id))
        .limit(1);
      if (s.statut === "publiee" || lien) throw new ErreurHttp(409, "Cet emploi du temps a déjà été publié : archivez-le plutôt que de le supprimer.");
      await db.delete(sessionsProgramme).where(eq(sessionsProgramme.id, s.id));
      await db.insert(journal).values({ utilisateurId: u.id, action: "programme_session_supprimee", details: { sessionId: s.id, titre: s.titre } });
      res.json({ ok: true });
    }),
  );

  app.get(
    `${P}/sessions/:id(\\d+)/occurrences`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const s = await sessionEquipe(u, idParam(req));
      const [dto] = await sessionsVersDto([s], false);
      res.json(await occurrencesDe([dto]));
    }),
  );

  // « Dupliquer » : mêmes créneaux, mêmes classes, nouvelles dates.
  app.post(
    `${P}/sessions/:id(\\d+)/dupliquer`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const source = await sessionEquipe(u, idParam(req));
      const d = valider(z.object({ titre: champsSession.titre, debut: jourCivil, fin: jourCivil, anneeAcademique: champsSession.anneeAcademique.optional() }), req.body);
      verifierCoherence({ debut: d.debut, fin: d.fin, pauseDebut: source.pauseDebut, pauseFin: source.pauseFin });
      const creneaux = await db.select().from(creneauxProgramme).where(eq(creneauxProgramme.sessionId, source.id));
      const classeIds = await verifierClasses(
        u,
        (await db.select({ id: sessionsClasses.classeId }).from(sessionsClasses).where(eq(sessionsClasses.sessionId, source.id))).map((l) => l.id),
      );
      const copie = await db.transaction(async (tx) => {
        const [s] = await tx
          .insert(sessionsProgramme)
          .values({
            anneeAcademique: d.anneeAcademique ?? source.anneeAcademique,
            titre: d.titre,
            public: source.public,
            debut: d.debut,
            fin: d.fin,
            pauseDebut: source.pauseDebut,
            pauseFin: source.pauseFin,
            note: source.note,
            signataire: source.signataire,
            creeParId: u.id,
          })
          .returning();
        if (classeIds.length) await tx.insert(sessionsClasses).values(classeIds.map((classeId) => ({ sessionId: s.id, classeId })));
        if (creneaux.length) {
          await tx.insert(creneauxProgramme).values(
            creneaux.map((c) => ({
              sessionId: s.id,
              jour: c.jour,
              heureDebut: c.heureDebut,
              heureFin: c.heureFin,
              type: c.type,
              coursId: c.coursId,
              titre: c.titre,
              intervenantId: c.intervenantId,
              intervenantNom: c.intervenantNom,
              mention: c.mention,
              fournisseur: c.fournisseur,
              ordre: c.ordre,
            })),
          );
        }
        return s;
      });
      await db.insert(journal).values({ utilisateurId: u.id, action: "programme_session_dupliquee", details: { depuis: source.id, sessionId: copie.id } });
      res.status(201).json(await editionSession(u, copie));
    }),
  );

  // « Publier » / « Mettre à jour les séances » : idempotent.
  app.post(
    `${P}/sessions/:id(\\d+)/publier`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const s = await sessionEquipe(u, idParam(req), true);
      if (s.statut === "archivee") throw new ErreurHttp(409, "Cet emploi du temps est archivé : désarchivez-le avant de le publier.");
      const nbCreneaux = await db.select({ n: sql<number>`count(*)::int` }).from(creneauxProgramme).where(eq(creneauxProgramme.sessionId, s.id));
      if (!nbCreneaux[0]?.n) throw invalide("Ajoutez au moins un créneau avant de publier.");
      await verifierCoursDeSession(u, s.id);
      // Les séances annulées par un archivage sont rétablies (« Désarchiver » puis « Publier »).
      const r = await synchroniserSession(s.id, { complete: true, publier: true, auteurId: u.id, ranimerMotif: MOTIF_ARCHIVAGE, perimetre: perimetreSites(u) });
      // Les séances déjà créées (et gardées) redeviennent publiques si la session l'était moins.
      await visibiliteSeances(s.id, true);
      const apres = await rechargerSession(s.id);
      diffuserChangements(r);
      const prevenus = await prevenirApresPublication(apres, r);
      oublierCache();
      prevenirSite("programme publié");
      const bilan: BilanPublication = {
        seancesCreees: r.seancesCreees,
        seancesMisesAJour: r.seancesMisesAJour,
        seancesAnnulees: r.seancesAnnulees,
        creneauxIgnores: r.creneauxIgnores,
        avertissements: r.avertissements,
        seancesInchangees: r.seancesInchangees,
        premiere: r.premiere,
        etudiantsPrevenus: prevenus.etudiants,
        intervenantsPrevenus: prevenus.intervenants,
      };
      res.json(bilan);
    }),
  );

  // Aperçu exact de la publication : même calcul, transaction annulée, personne n'est prévenu.
  app.get(
    `${P}/sessions/:id(\\d+)/apercu`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const s = await sessionEquipe(u, idParam(req), true);
      if (s.statut === "archivee") throw new ErreurHttp(409, "Cet emploi du temps est archivé : désarchivez-le avant de le publier.");
      await verifierCoursDeSession(u, s.id);
      const r = await synchroniserSession(s.id, { complete: true, publier: true, essai: true, auteurId: u.id, ranimerMotif: MOTIF_ARCHIVAGE, perimetre: perimetreSites(u) });
      const [dto] = await sessionsVersDto([s], false);
      const libelleDe = new Map(dto.creneaux.map((c) => [c.id, c.libelle]));
      const aPrevenir = await etudiantsAPrevenir(s, r, false);
      const etudiants = aPrevenir.nouveaux.length + aPrevenir.autres.length;
      const intervenants = r.premiere
        ? new Set(dto.creneaux.map((c) => c.intervenant?.id).filter(Boolean)).size
        : r.changements.length
          ? r.intervenantsTouches.length
          : 0;
      const apercu: ApercuPublicationDto = {
        seancesCreees: r.seancesCreees,
        seancesMisesAJour: r.seancesMisesAJour,
        seancesAnnulees: r.seancesAnnulees,
        creneauxIgnores: r.creneauxIgnores,
        avertissements: r.avertissements,
        seancesInchangees: r.seancesInchangees,
        premiere: r.premiere,
        etudiants,
        intervenants,
        changements: r.changements
          .map((c) => ({ date: c.date, libelle: libelleDe.get(c.creneauId) ?? "Séance", nature: c.nature, motif: c.motif ?? null }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
      res.json(apercu);
    }),
  );

  // Retirer de la publication : la session repasse en brouillon, ses séances restent prévues mais ne sont plus annoncées.
  app.post(
    `${P}/sessions/:id(\\d+)/retirer`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const s = await sessionEquipe(u, idParam(req), true);
      if (s.statut !== "publiee") throw new ErreurHttp(409, "Cet emploi du temps n'est pas publié.");
      await db.update(sessionsProgramme).set({ statut: "brouillon" }).where(eq(sessionsProgramme.id, s.id));
      await visibiliteSeances(s.id, false);
      await db.insert(journal).values({ utilisateurId: u.id, action: "programme_retire", details: { sessionId: s.id } });
      oublierCache();
      prevenirSite("programme retiré");
      res.json(await editionSession(u, await rechargerSession(s.id)));
    }),
  );

  // Archiver : la session disparaît de partout ; ses séances à venir sont annulées.
  app.post(
    `${P}/sessions/:id(\\d+)/archiver`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const s = await sessionEquipe(u, idParam(req), true);
      if (s.statut === "archivee") return res.json(await editionSession(u, s));
      const aVenir = await seancesAVenirDeSession(s.id);
      const motif = MOTIF_ARCHIVAGE;
      if (aVenir.length) {
        await db
          .update(seances)
          .set({ statut: "annulee", motifAnnulation: motif })
          .where(and(inArray(seances.id, aVenir.map((l) => l.seance.id)), eq(seances.statut, "planifiee")));
      }
      await visibiliteSeances(s.id, false);
      await db.update(sessionsProgramme).set({ statut: "archivee" }).where(eq(sessionsProgramme.id, s.id));
      await db.insert(journal).values({ utilisateurId: u.id, action: "programme_archive", details: { sessionId: s.id, seancesAnnulees: aVenir.length } });
      diffuserChangements({ changements: aVenir.map((l) => ({ seanceId: l.seance.id, coursId: l.seance.coursId, creneauId: l.creneauId, date: l.date, nature: "annulee" as const, motif })) });
      // Les étudiants ont connu ces séances si la session a été publiée un jour (même retirée depuis : ses séances restaient prévues).
      if (aVenir.length && s.publieeLe) {
        await notifier(await etudiantsDeSession(s.id), {
          type: "cours",
          titre: `L'emploi du temps de la ${s.titre} est retiré`,
          corps: `${aVenir.length} séance${aVenir.length > 1 ? "s" : ""} à venir ${aVenir.length > 1 ? "sont annulées" : "est annulée"}. La vie scolaire te précisera la suite.`,
          lien: "/emploi-du-temps",
        });
      }
      // Chaque intervenant apprend lesquelles de ses séances sont annulées.
      if (aVenir.length) {
        const creneauxSession = await db.select().from(creneauxProgramme).where(eq(creneauxProgramme.sessionId, s.id));
        const intervenantDe = new Map(creneauxSession.map((c) => [c.id, c.intervenantId]));
        const parIntervenant = new Map<number, string[]>();
        for (const l of aVenir) {
          const id = intervenantDe.get(l.creneauId);
          if (id) parIntervenant.set(id, [...(parIntervenant.get(id) ?? []), l.date]);
        }
        for (const [id, dates] of parIntervenant) {
          const triees = [...new Set(dates)].sort();
          await notifier([id], {
            type: "cours",
            titre: `Emploi du temps retiré : ${s.titre}`,
            corps: `${triees.length} séance${triees.length > 1 ? "s" : ""} annulée${triees.length > 1 ? "s" : ""} (${enumerer(triees.slice(0, 6).map((d) => libelleDate(d)))}${triees.length > 6 ? "…" : ""}).`,
            lien: "/emploi-du-temps",
          });
        }
      }
      oublierCache();
      prevenirSite("programme archivé");
      res.json(await editionSession(u, await rechargerSession(s.id)));
    }),
  );

  app.post(
    `${P}/sessions/:id(\\d+)/desarchiver`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const s = await sessionEquipe(u, idParam(req), true);
      if (s.statut !== "archivee") throw new ErreurHttp(409, "Cet emploi du temps n'est pas archivé.");
      await db.update(sessionsProgramme).set({ statut: "brouillon" }).where(eq(sessionsProgramme.id, s.id));
      await db.insert(journal).values({ utilisateurId: u.id, action: "programme_desarchive", details: { sessionId: s.id } });
      res.json(await editionSession(u, await rechargerSession(s.id)));
    }),
  );

  // ── Back-office : créneaux ───────────────────────────────────────────────

  app.post(
    `${P}/sessions/:id(\\d+)/creneaux`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const s = await sessionEquipe(u, idParam(req), true);
      if (s.statut === "archivee") throw new ErreurHttp(409, "Cet emploi du temps est archivé : désarchivez-le pour le modifier.");
      const { confirmer, ...d } = valider(schemaCreneau, req.body);
      await verifierCreneau(u, s, d, confirmer);
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(creneauxProgramme).where(eq(creneauxProgramme.sessionId, s.id));
      if (n >= 60) throw invalide("Une session compte au plus 60 créneaux.");
      await db.insert(creneauxProgramme).values({ sessionId: s.id, ...d, ordre: n });
      await toucher(s, true);
      res.status(201).json(await editionSession(u, await rechargerSession(s.id)));
    }),
  );

  app.patch(
    `${P}/creneaux/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const { c, s } = await creneauEquipe(u, idParam(req));
      if (s.statut === "archivee") throw new ErreurHttp(409, "Cet emploi du temps est archivé : désarchivez-le pour le modifier.");
      const { confirmer, ...d } = valider(schemaCreneau.partial(), req.body);
      const fusion: Omit<CreneauSaisi, "confirmer"> = {
        jour: d.jour ?? c.jour,
        heureDebut: d.heureDebut ?? c.heureDebut,
        heureFin: d.heureFin ?? c.heureFin,
        type: d.type ?? c.type,
        coursId: d.coursId !== undefined ? d.coursId : c.coursId,
        titre: d.titre ?? c.titre,
        intervenantId: d.intervenantId !== undefined ? d.intervenantId : c.intervenantId,
        intervenantNom: d.intervenantNom ?? c.intervenantNom,
        mention: d.mention ?? c.mention,
        fournisseur: d.fournisseur !== undefined ? d.fournisseur : c.fournisseur,
      };
      await verifierCreneau(u, s, fusion, confirmer, c.id, fusion.coursId !== c.coursId);
      await db.update(creneauxProgramme).set(fusion).where(eq(creneauxProgramme.id, c.id));
      const repercuter = (["jour", "heureDebut", "heureFin", "type", "coursId", "intervenantId", "fournisseur"] as const).some((k) => fusion[k] !== c[k]);
      await toucher(s, repercuter);
      res.json(await editionSession(u, await rechargerSession(s.id)));
    }),
  );

  // Retirer un créneau : ses séances encore à venir sont annulées tout de suite (la personne l'a confirmé).
  app.delete(
    `${P}/creneaux/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const { c, s } = await creneauEquipe(u, idParam(req));
      if (s.statut === "archivee") throw new ErreurHttp(409, "Cet emploi du temps est archivé : désarchivez-le pour le modifier.");
      const motif = "Créneau retiré de l'emploi du temps";
      const annulees = await db.transaction(async (tx) => {
        const liees = await tx
          .select({ seance: seances, date: seancesCreneaux.date })
          .from(seancesCreneaux)
          .innerJoin(seances, eq(seances.id, seancesCreneaux.seanceId))
          .where(and(eq(seancesCreneaux.creneauId, c.id), eq(seances.statut, "planifiee"), sql`${seances.debut} > now()`));
        if (liees.length) {
          await tx
            .update(seances)
            .set({ statut: "annulee", motifAnnulation: motif, publierSurSite: false })
            .where(inArray(seances.id, liees.map((l) => l.seance.id)));
        }
        await tx.delete(creneauxProgramme).where(eq(creneauxProgramme.id, c.id));
        return liees;
      });
      await toucher(s, false);
      if (annulees.length) {
        diffuserChangements({ changements: annulees.map((l) => ({ seanceId: l.seance.id, coursId: l.seance.coursId, creneauId: c.id, date: l.date, nature: "annulee" as const, motif })) });
        const [co] = c.coursId ? await db.select({ titre: cours.titre }).from(cours).where(eq(cours.id, c.coursId)) : [];
        const quoi = `${co?.titre ?? (c.titre || "Le cours")} du ${NOMS_JOURS[c.jour]}`;
        const texte = `${annulees.length} séance${annulees.length > 1 ? "s" : ""} annulée${annulees.length > 1 ? "s" : ""} (${enumerer(annulees.map((l) => libelleDate(l.date)))}).`;
        if (s.statut === "publiee") {
          await notifier(await etudiantsDeSession(s.id), { type: "cours", titre: `Emploi du temps modifié : ${quoi} est retiré`, corps: texte, lien: "/emploi-du-temps" });
        }
        if (c.intervenantId) await notifier([c.intervenantId], { type: "cours", titre: `Emploi du temps modifié : ${quoi} est retiré`, corps: texte, lien: "/emploi-du-temps" });
      }
      await db.insert(journal).values({ utilisateurId: u.id, action: "programme_creneau_retire", details: { sessionId: s.id, creneauId: c.id, seancesAnnulees: annulees.length } });
      res.json(await editionSession(u, await rechargerSession(s.id)));
    }),
  );

  // ── Back-office : exceptions (« Pas de cours ce jour-là ») ───────────────

  /**
   * Prévient des seuls créneaux vraiment touchés : une séance annulée (jour
   * posé) ou rétablie ou recréée (jour levé), ou un créneau sans séance
   * (séminaire) encore à venir. Rien n'est envoyé si rien n'a changé (séance
   * déjà annulée par son formateur, par exemple).
   */
  async function prevenirException(s: SessionProgramme, r: ResultatSynchro, date: string, retablie: boolean, motif: string, creneauxVises: CreneauProgramme[]) {
    diffuserChangements(r);
    const [dto] = await sessionsVersDto([s], false);
    const natures = retablie ? ["retablie", "creee"] : ["annulee"];
    const vises = dto.creneaux.filter(
      (c) =>
        creneauxVises.some((x) => x.id === c.id) &&
        (c.cours
          ? r.changements.some((ch) => ch.creneauId === c.id && ch.date === date && natures.includes(ch.nature))
          : instant(date, c.heureFin).getTime() > Date.now()),
    );
    if (!vises.length) return;
    const quoi = enumerer(vises.map((c) => `${c.libelle} (${heureLisible(c.heureDebut)}–${heureLisible(c.heureFin)})`));
    const jour = libelleDate(date);
    const etudiants = s.statut === "publiee" ? await etudiantsDeSession(s.id) : [];
    const intervenants = [...new Set(vises.map((c) => c.intervenant?.id).filter((x): x is number => Boolean(x)))];
    const titre = retablie ? `Cours rétabli le ${jour}` : `Pas de cours le ${jour}`;
    await notifier(etudiants, { type: "cours", titre, corps: retablie ? `${quoi} a bien lieu. Regarde ta semaine.` : `${quoi} : ${motif}.`, lien: "/emploi-du-temps" });
    await notifier(intervenants, { type: "cours", titre, corps: retablie ? `${quoi} a bien lieu (heure d'Abidjan).` : `${quoi} : ${motif}.`, lien: "/emploi-du-temps" });
  }

  app.post(
    `${P}/sessions/:id(\\d+)/exceptions`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const s = await sessionEquipe(u, idParam(req), true);
      if (s.statut === "archivee") throw new ErreurHttp(409, "Cet emploi du temps est archivé.");
      const d = valider(
        z.object({
          date: jourCivil,
          creneauId: z.number().int().positive().nullable(),
          motif: z.string().trim().min(3, "indiquez un motif (férié, empêchement…)").max(200, "motif trop long"),
        }),
        req.body,
      );
      if (d.date < s.debut || d.date > s.fin) throw invalide("Cette date est en dehors de la session.");
      const creneaux = await db.select().from(creneauxProgramme).where(eq(creneauxProgramme.sessionId, s.id));
      const vises = d.creneauId ? creneaux.filter((c) => c.id === d.creneauId) : creneaux.filter((c) => c.jour === jourIsoDe(d.date));
      if (d.creneauId && !vises.length) throw invalide("Ce créneau n'appartient pas à cet emploi du temps.");
      if (d.creneauId && vises[0].jour !== jourIsoDe(d.date)) throw invalide(`Ce créneau a lieu le ${NOMS_JOURS[vises[0].jour]}, pas le ${NOMS_JOURS[jourIsoDe(d.date)]}.`);
      const existantes = await db.select().from(exceptionsProgramme).where(and(eq(exceptionsProgramme.sessionId, s.id), eq(exceptionsProgramme.date, d.date)));
      if (existantes.some((e) => e.creneauId === null || e.creneauId === d.creneauId)) throw new ErreurHttp(409, "Ce jour est déjà marqué sans cours.");
      await db.insert(exceptionsProgramme).values({ sessionId: s.id, date: d.date, creneauId: d.creneauId, motif: d.motif, creeParId: u.id });
      let r: ResultatSynchro | null = null;
      if (s.statut === "publiee") {
        const ids = new Set(vises.map((c) => c.id));
        r = await synchroniserSession(s.id, { complete: false, auteurId: u.id, perimetre: perimetreSites(u), filtre: (creneauId, date) => date === d.date && ids.has(creneauId) });
      }
      await db.insert(journal).values({ utilisateurId: u.id, action: "programme_exception", details: { sessionId: s.id, date: d.date, creneauId: d.creneauId, motif: d.motif } });
      if (s.statut === "publiee" && vises.length) await prevenirException(s, r!, d.date, false, d.motif, vises);
      if (s.statut === "publiee") {
        oublierCache();
        prevenirSite("programme : pas de cours");
      }
      res.status(201).json({ seancesAnnulees: r?.seancesAnnulees ?? 0 });
    }),
  );

  app.delete(
    `${P}/exceptions/:id(\\d+)`,
    EQUIPE,
    route(async (req, res) => {
      const u = moi(req);
      const [e] = await db.select().from(exceptionsProgramme).where(eq(exceptionsProgramme.id, idParam(req)));
      if (!e) throw introuvable("Jour sans cours");
      const s = await sessionEquipe(u, e.sessionId, true);
      await db.delete(exceptionsProgramme).where(eq(exceptionsProgramme.id, e.id));
      const creneaux = await db.select().from(creneauxProgramme).where(eq(creneauxProgramme.sessionId, s.id));
      const vises = e.creneauId ? creneaux.filter((c) => c.id === e.creneauId) : creneaux.filter((c) => c.jour === jourIsoDe(e.date));
      let r: ResultatSynchro | null = null;
      if (s.statut === "publiee") {
        const ids = new Set(vises.map((c) => c.id));
        r = await synchroniserSession(s.id, {
          complete: false,
          auteurId: u.id,
          perimetre: perimetreSites(u),
          ranimerMotif: e.motif || "Pas de cours ce jour-là",
          filtre: (creneauId, date) => date === e.date && ids.has(creneauId),
        });
      }
      await db.insert(journal).values({ utilisateurId: u.id, action: "programme_exception_levee", details: { sessionId: s.id, date: e.date, creneauId: e.creneauId } });
      if (s.statut === "publiee" && vises.length && r) await prevenirException(s, r, e.date, true, e.motif, vises);
      if (s.statut === "publiee") {
        oublierCache();
        prevenirSite("programme : cours rétabli");
      }
      res.json({ seancesRetablies: r?.changements.filter((c) => c.nature === "retablie").length ?? 0, seancesCreees: r?.seancesCreees ?? 0 });
    }),
  );
}
