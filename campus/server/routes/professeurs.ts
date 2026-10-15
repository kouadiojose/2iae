// Professeurs (José, 15 octobre 2026 : « depuis la direction, créer des professeurs et les attacher à une classe ; un
// cours peut avoir plusieurs professeurs ») : la page « Professeurs » du pilotage. Un professeur est un compte
// « formateur » ; le principal d'un cours est cours.formateur_id, les autres sont dans cours_formateurs (déjà lus par
// tous les droits : enseigneCours, idsCoursAccessibles, formateursDuCours). Contrats : shared/professeurs.ts.
//
//   GET    /api/pilotage/professeurs                         les professeurs, leurs cours, leur état (droit « programme »)
//   GET    /api/pilotage/professeurs/cours                   les cours qu'on peut leur attacher (droit « programme »)
//   POST   /api/pilotage/professeurs                         créer un professeur (+ cours) et son lien d'invitation
//   POST   /api/pilotage/professeurs/verifier                téléphone et e-mail libres ? (dès l'étape 1 de la création)
//   GET    /api/pilotage/cours/:id/professeurs               les professeurs d'un cours (et s'ils sont gérables)
//   POST   /api/pilotage/cours/:id/professeurs               attacher { formateurId } (le premier devient principal)
//   PUT    /api/pilotage/cours/:id/professeurs/principal     nommer principal { formateurId } (l'ancien reste professeur)
//   DELETE /api/pilotage/cours/:id/professeurs/:formateurId  retirer (le suivant devient principal)
//
// Règles : créer et inviter, comme dans « Comptes » (direction, ou équipe de tout le groupe avec « comptes du
// personnel ») ; attacher et retirer : droit « programme », et pour une vie scolaire de campus seulement les cours
// dont toutes les classes sont de son campus (comme modifier un cours). Chaque action va au journal. Coordonnées
// (téléphone, e-mail, invitation, dernière connexion) : seulement avec « comptes du personnel » (comme « Comptes »).
// Emploi du temps : ce qu'il a ajouté est noté dans formateurs_programme ; changer le principal ou retirer met cette
// note à jour pour que la publication suivante défasse encore ce qu'elle a fait (et jamais ce qu'a fait la direction).
import type { Express } from "express";
import { z } from "zod";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { exigerDroit, hacher, moi, motDePasseProvisoire, peut, perimetreSites, DUREE_CODE_PROVISOIRE_MS } from "../auth";
import { coursVisible } from "../acces";
import { route, valider, idParam, ErreurHttp, introuvable, interdit } from "../http";
import { notifier } from "../notifications";
import { prevenirSite } from "../site";
import { connectesSur } from "../temps-reel";
import { espaces, journaliser, schemaEmailCompte, telephoneSaisi, texteCourt, verifierUnicite, optionnel } from "./admin";
import { creerInvitation } from "./lancement";
import { t } from "@shared/textes/professeurs";
import {
  classes,
  cours,
  coursClasses,
  coursFormateurs,
  formateursProgramme,
  seances,
  sites,
  utilisateurs,
  type Cours,
  type Utilisateur,
} from "@shared/schema";
import type {
  CoursAAttacherDto,
  CoursDuProfesseurDto,
  EtatProfesseur,
  ProfesseurCreeDto,
  ProfesseurDto,
  ProfesseurDuCoursDto,
  ProfesseursDto,
  ProfesseursDuCoursDto,
  ReponseProfesseursCours,
  VerificationProfesseurDto,
} from "@shared/professeurs";

const vous = { registre: "vous" as const };
const JOURS = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/** Créer et inviter : direction, ou équipe de tout le groupe avec « comptes du personnel ». */
const peutCreer = (u: Utilisateur) => peut(u, "comptes_personnel") && peut(u, "comptes_gerer") && perimetreSites(u) === null;
const peutAttacher = (u: Utilisateur) => peut(u, "programme");

type Libelle = { court: string; long: string; niveaux: string[]; sansClasse: boolean };

/** Les classes de chaque cours en mots : court « 1BTS · 2BTS · 5 campus », long « 1BTS Riviera · 2BTS Yopougon ». */
async function classesLibelle(coursIds: number[]): Promise<Map<number, Libelle & { sites: number[] }>> {
  const carte = new Map<number, Libelle & { sites: number[] }>();
  if (!coursIds.length) return carte;
  const lignes = await db
    .select({ coursId: coursClasses.coursId, nom: classes.nom, niveau: classes.niveau, siteId: classes.siteId, site: sites.nomCourt })
    .from(coursClasses)
    .innerJoin(classes, eq(classes.id, coursClasses.classeId))
    .innerJoin(sites, eq(sites.id, classes.siteId))
    .where(inArray(coursClasses.coursId, coursIds))
    .orderBy(asc(classes.nom));
  const parCours = new Map<number, typeof lignes>();
  for (const l of lignes) parCours.set(l.coursId, [...(parCours.get(l.coursId) ?? []), l]);
  for (const id of coursIds) {
    const liste = parCours.get(id) ?? [];
    if (!liste.length) {
      carte.set(id, { court: "", long: "", niveaux: [], sansClasse: true, sites: [] });
      continue;
    }
    const niveaux = [...new Set(liste.map((l) => l.niveau || l.nom))].sort((a, b) => a.localeCompare(b, "fr"));
    const sitesIds = [...new Set(liste.map((l) => l.siteId))];
    const lieu = sitesIds.length === 1 ? liste[0].site : `${sitesIds.length} campus`;
    const court = [...niveaux, lieu].join(" · ");
    const long = liste.length <= 3 ? liste.map((l) => (l.nom.includes(l.site) ? l.nom : `${l.nom} ${l.site}`)).join(" · ") : court;
    carte.set(id, { court, long, niveaux, sansClasse: false, sites: sitesIds });
  }
  return carte;
}

/** La personne peut-elle choisir les professeurs de ce cours (toutes ses classes dans son périmètre) ? */
function gerableAvec(u: Utilisateur, sitesDuCours: number[]): boolean {
  if (u.role === "admin") return true;
  if (u.role !== "vie_scolaire" || !peut(u, "programme")) return false;
  const p = perimetreSites(u);
  return !p || sitesDuCours.every((s) => p.includes(s));
}

/** Le cours, si la personne peut en choisir les professeurs ; sinon 404 ou 403. */
async function coursGerable(u: Utilisateur, coursId: number): Promise<Cours> {
  const [c] = await db.select().from(cours).where(eq(cours.id, coursId));
  if (!c) throw introuvable("Cours");
  const sitesDuCours = (await classesLibelle([c.id])).get(c.id)?.sites ?? [];
  if (!gerableAvec(u, sitesDuCours)) throw interdit(t("erreur.coursPartage", vous));
  return c;
}

/** État de chaque professeur : désactivé, connecté (compte activé), invité (lien envoyé), lien à envoyer. */
async function invitationsDe(ids: number[]): Promise<Map<number, Date>> {
  const carte = new Map<number, Date>();
  if (!ids.length) return carte;
  const { rows } = await db.execute<{ compte: number; le: Date | string }>(sql`
    SELECT (details->>'compteId')::int AS compte, max(cree_le) AS le FROM campus.journal
    WHERE action IN ('invitation', 'invitation_email') AND details->>'compteId' = ANY(${`{${ids.join(",")}}`}::text[])
    GROUP BY 1`);
  for (const r of rows) carte.set(Number(r.compte), new Date(r.le));
  return carte;
}

function etatDe(f: Pick<Utilisateur, "actif" | "doitChangerMotDePasse">, inviteLe: Date | undefined): EtatProfesseur {
  if (!f.actif) return "desactive";
  if (!f.doitChangerMotDePasse) return "connecte";
  return inviteLe ? "invite" : "a_inviter";
}

/** « le lundi à 8h30 » : le premier créneau publié (session non archivée) de ce cours où il intervient, sinon null. */
async function intervientAuProgramme(coursId: number, formateurId: number): Promise<string | null> {
  const { rows } = await db.execute<{ jour: number; heure: string }>(sql`
    SELECT cr.jour, cr.heure_debut AS heure FROM campus.creneaux_programme cr
    JOIN campus.sessions_programme s ON s.id = cr.session_id
    WHERE cr.cours_id = ${coursId} AND cr.intervenant_id = ${formateurId} AND s.publiee_le IS NOT NULL AND s.statut <> 'archivee'
    ORDER BY cr.jour, cr.heure_debut LIMIT 1`);
  const r = rows[0];
  return r ? `le ${JOURS[Number(r.jour)] ?? ""} à ${String(r.heure).slice(0, 5).replace(":", "h")}` : null;
}

/** « coursId:formateurId » → « le lundi à 8h30 » pour tous les créneaux publiés (une requête). */
async function programmesDe(): Promise<Map<string, string>> {
  const { rows } = await db.execute<{ cours_id: number; intervenant_id: number; jour: number; heure: string }>(sql`
    SELECT DISTINCT ON (cr.cours_id, cr.intervenant_id) cr.cours_id, cr.intervenant_id, cr.jour, cr.heure_debut AS heure
    FROM campus.creneaux_programme cr
    JOIN campus.sessions_programme s ON s.id = cr.session_id
    WHERE cr.cours_id IS NOT NULL AND cr.intervenant_id IS NOT NULL AND s.publiee_le IS NOT NULL AND s.statut <> 'archivee'
    ORDER BY cr.cours_id, cr.intervenant_id, cr.jour, cr.heure_debut`);
  return new Map(rows.map((r) => [`${r.cours_id}:${r.intervenant_id}`, `le ${JOURS[Number(r.jour)] ?? ""} à ${String(r.heure).slice(0, 5).replace(":", "h")}`]));
}

/** Rattachements (principal ∪ autres) de ces cours. */
async function rattachements(coursIds?: number[]): Promise<{ coursId: number; formateurId: number; principal: boolean }[]> {
  const principaux = await db
    .select({ coursId: cours.id, formateurId: cours.formateurId })
    .from(cours)
    .where(coursIds ? inArray(cours.id, coursIds.length ? coursIds : [0]) : undefined);
  const autres = await db
    .select({ coursId: coursFormateurs.coursId, formateurId: coursFormateurs.formateurId })
    .from(coursFormateurs)
    .where(coursIds ? inArray(coursFormateurs.coursId, coursIds.length ? coursIds : [0]) : undefined);
  const liste: { coursId: number; formateurId: number; principal: boolean }[] = [];
  for (const p of principaux) if (p.formateurId) liste.push({ coursId: p.coursId, formateurId: p.formateurId, principal: true });
  for (const a of autres) if (!liste.some((l) => l.coursId === a.coursId && l.formateurId === a.formateurId)) liste.push({ ...a, principal: false });
  return liste;
}

/** Les professeurs d'un cours, principal d'abord. */
async function professeursDuCours(coursId: number): Promise<ProfesseurDuCoursDto[]> {
  const liens = await rattachements([coursId]);
  if (!liens.length) return [];
  const comptes = await db.select().from(utilisateurs).where(inArray(utilisateurs.id, liens.map((l) => l.formateurId)));
  const invites = await invitationsDe(comptes.map((c) => c.id));
  const liste: ProfesseurDuCoursDto[] = [];
  for (const l of liens) {
    const f = comptes.find((c) => c.id === l.formateurId);
    if (!f) continue;
    liste.push({
      id: f.id,
      prenom: f.prenom,
      nom: f.nom,
      photoUrl: f.photoUrl,
      principal: l.principal,
      etat: etatDe(f, invites.get(f.id)),
      programme: await intervientAuProgramme(coursId, f.id),
    });
  }
  return liste.sort((a, b) => Number(b.principal) - Number(a.principal) || a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr"));
}

async function compteProfesseurActif(formateurId: number): Promise<Utilisateur> {
  const [f] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, formateurId));
  if (!f || f.role !== "formateur" || !f.actif) throw new ErreurHttp(409, t("erreur.inactif", vous));
  return f;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Attache un professeur : principal si le cours n'en a pas, sinon « autre professeur ». Rien si déjà attaché. */
async function attacher(tx: Tx, c: Pick<Cours, "id" | "formateurId">, formateurId: number): Promise<{ deja: boolean; principal: boolean }> {
  const [actuel] = await tx.select({ formateurId: cours.formateurId }).from(cours).where(eq(cours.id, c.id)).for("update");
  if (actuel?.formateurId === formateurId) return { deja: true, principal: true };
  const [autre] = await tx
    .select({ x: sql`1` })
    .from(coursFormateurs)
    .where(and(eq(coursFormateurs.coursId, c.id), eq(coursFormateurs.formateurId, formateurId)));
  if (autre) return { deja: true, principal: false };
  if (!actuel?.formateurId) {
    await tx.update(cours).set({ formateurId, majLe: new Date() }).where(eq(cours.id, c.id));
    return { deja: false, principal: true };
  }
  await tx.insert(coursFormateurs).values({ coursId: c.id, formateurId }).onConflictDoNothing();
  return { deja: false, principal: false };
}

/** Prévient le professeur attaché (sans sonner : il n'a peut-être pas encore activé son compte). */
async function prevenirAttache(c: Pick<Cours, "id" | "code" | "titre">, formateurId: number, principal: boolean) {
  await notifier([formateurId], {
    type: "cours",
    titre: principal ? `Un cours vous est confié : ${c.code}` : t("notif.attache.titre", { ...vous, v: { code: c.code } }),
    corps: t("notif.attache.corps", { ...vous, v: { titre: c.titre } }),
    lien: `/enseigner/mon-cours/${c.id}`,
    push: false,
  });
}

const schemaCreation = z.object({
  prenom: texteCourt(80),
  nom: texteCourt(80),
  telephone: optionnel(z.string().trim().max(30)),
  email: optionnel(schemaEmailCompte),
  coursIds: z.array(z.number().int().positive()).max(30).default([]),
});

export function enregistrerProfesseurs(app: Express) {
  // ── La liste ─────────────────────────────────────────────────────────────
  app.get(
    "/api/pilotage/professeurs",
    exigerDroit("programme", "comptes_personnel"),
    route(async (req, res) => {
      const u = moi(req);
      res.setHeader("Cache-Control", "no-store");
      const comptes = await db
        .select()
        .from(utilisateurs)
        .where(eq(utilisateurs.role, "formateur"))
        .orderBy(desc(utilisateurs.actif), asc(utilisateurs.nom), asc(utilisateurs.prenom));
      const liens = await rattachements();
      const coursIds = [...new Set(liens.map((l) => l.coursId))];
      const lesCours = coursIds.length ? await db.select().from(cours).where(inArray(cours.id, coursIds)) : [];
      const libelles = await classesLibelle(coursIds);
      const invites = await invitationsDe(comptes.map((c) => c.id));
      const programmes = await programmesDe();
      const perimetre = perimetreSites(u);
      // Coordonnées et dates : réservées à « comptes du personnel » (« Comptes » ne montre pas ces comptes aux autres).
      const coordonnees = peut(u, "comptes_personnel");
      const professeurs: ProfesseurDto[] = [];
      for (const f of comptes) {
        const siens: CoursDuProfesseurDto[] = [];
        for (const l of liens.filter((x) => x.formateurId === f.id)) {
          const c = lesCours.find((x) => x.id === l.coursId);
          if (!c || c.statut === "archive") continue;
          const lib = libelles.get(c.id)!;
          // Vie scolaire d'un campus : seulement les cours que suit son campus (ou sans classe).
          if (perimetre && !lib.sansClasse && !lib.sites.some((s) => perimetre.includes(s))) continue;
          siens.push({
            coursId: c.id,
            code: c.code,
            titre: c.titre,
            couleur: c.couleur,
            statut: c.statut,
            principal: l.principal,
            classes: lib.court,
            classesDetail: lib.long,
            sansClasse: lib.sansClasse,
            gerable: gerableAvec(u, lib.sites),
            programme: programmes.get(`${c.id}:${f.id}`) ?? null,
          });
        }
        siens.sort((a, b) => Number(b.principal) - Number(a.principal) || a.titre.localeCompare(b.titre, "fr"));
        professeurs.push({
          id: f.id,
          prenom: f.prenom,
          nom: f.nom,
          titre: f.titre,
          photoUrl: f.photoUrl,
          telephone: coordonnees ? f.telephone : null,
          email: coordonnees ? f.email : null,
          etat: etatDe(f, invites.get(f.id)),
          inviteLe: coordonnees ? (invites.get(f.id)?.toISOString() ?? null) : null,
          vuLe: coordonnees ? (f.derniereConnexion?.toISOString() ?? null) : null,
          cours: siens,
        });
      }
      const dto: ProfesseursDto = { professeurs, peutCreer: peutCreer(u), peutInviter: peutCreer(u), peutAttacher: peutAttacher(u) };
      res.json(dto);
    }),
  );

  // ── Les cours qu'on peut attacher ────────────────────────────────────────
  app.get(
    "/api/pilotage/professeurs/cours",
    exigerDroit("programme", "comptes_personnel"),
    route(async (req, res) => {
      const u = moi(req);
      res.setHeader("Cache-Control", "no-store");
      const lesCours = await db.select().from(cours).where(sql`${cours.statut} <> 'archive'`).orderBy(asc(cours.titre));
      const libelles = await classesLibelle(lesCours.map((c) => c.id));
      const liens = await rattachements(lesCours.map((c) => c.id));
      const ids = [...new Set(liens.map((l) => l.formateurId))];
      const noms = ids.length ? await db.select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom }).from(utilisateurs).where(inArray(utilisateurs.id, ids)) : [];
      const liste: CoursAAttacherDto[] = lesCours
        .filter((c) => gerableAvec(u, libelles.get(c.id)?.sites ?? []))
        .map((c) => {
          const lib = libelles.get(c.id)!;
          return {
            id: c.id,
            code: c.code,
            titre: c.titre,
            couleur: c.couleur,
            statut: c.statut,
            classes: lib.court,
            niveaux: lib.niveaux,
            sansClasse: lib.sansClasse,
            professeurs: liens
              .filter((l) => l.coursId === c.id)
              .map((l) => {
                const n = noms.find((x) => x.id === l.formateurId);
                return { id: l.formateurId, nom: n ? `${n.prenom} ${n.nom}`.trim() : "", principal: l.principal };
              })
              .sort((a, b) => Number(b.principal) - Number(a.principal)),
          };
        });
      res.json(liste);
    }),
  );

  // ── Créer un professeur (et ses cours, et son lien) ──────────────────────
  app.post(
    "/api/pilotage/professeurs",
    exigerDroit("comptes_personnel"),
    route(async (req, res) => {
      const u = moi(req);
      if (!peutCreer(u)) throw interdit(t("erreur.perimetre", vous));
      const d = valider(schemaCreation, req.body ?? {});
      const coursIds = [...new Set(d.coursIds)];
      if (coursIds.length && !peutAttacher(u)) throw interdit(t("erreur.coursNonGerable", { ...vous, v: { titre: "" } }));
      // Tous les cours d'abord : rien n'est écrit si l'un d'eux ne va pas.
      const lesCours: Cours[] = [];
      for (const id of coursIds) {
        const c = await coursGerable(u, id).catch((e) => {
          if (e instanceof ErreurHttp && e.statut === 403) throw interdit(t("erreur.coursNonGerable", { ...vous, v: { titre: String(id) } }));
          throw e;
        });
        if (c.statut === "archive") throw new ErreurHttp(409, t("erreur.archive", vous));
        lesCours.push(c);
      }
      const telephone = telephoneSaisi(d.telephone);
      await verifierUnicite({ email: d.email ?? null });
      // Sans e-mail, son téléphone devient son identifiant : il ne doit mener qu'à lui.
      if (!d.email && telephone) {
        const [pris] = await db.select({ id: utilisateurs.id }).from(utilisateurs).where(eq(utilisateurs.telephone, telephone)).limit(1);
        if (pris) throw new ErreurHttp(409, t("erreur.telephonePris", vous));
      }
      const { compte, attaches } = await db.transaction(async (tx) => {
        const [cree] = await tx
          .insert(utilisateurs)
          .values({
            role: "formateur",
            prenom: espaces(d.prenom),
            nom: espaces(d.nom),
            email: d.email ?? null,
            telephone,
            // Code provisoire jamais montré : le professeur choisit son mot de passe en ouvrant son lien.
            motDePasseHash: await hacher(motDePasseProvisoire()),
            doitChangerMotDePasse: true,
            motDePasseExpireLe: new Date(Date.now() + DUREE_CODE_PROVISOIRE_MS),
          })
          .returning();
        const faits: { c: Cours; principal: boolean }[] = [];
        for (const c of lesCours) {
          const r = await attacher(tx, c, cree.id);
          faits.push({ c, principal: r.principal });
        }
        return { compte: cree, attaches: faits };
      });
      await journaliser(u, "compte_cree", { compteId: compte.id, role: "formateur", via: "professeurs" });
      for (const a of attaches) {
        await journaliser(u, "cours_professeur_ajoute", { coursId: a.c.id, formateurId: compte.id, principal: a.principal });
        await prevenirAttache(a.c, compte.id, a.principal);
      }
      if (attaches.some((a) => a.c.publierSurSite)) prevenirSite("cours");
      let invitation: ProfesseurCreeDto["invitation"] = null;
      try {
        invitation = await creerInvitation(u, compte);
      } catch (e) {
        console.error("[professeurs] invitation :", (e as Error).message);
      }
      const liste = await db.select().from(utilisateurs).where(eq(utilisateurs.id, compte.id));
      const libelles = await classesLibelle(attaches.map((a) => a.c.id));
      const professeur: ProfesseurDto = {
        id: compte.id,
        prenom: compte.prenom,
        nom: compte.nom,
        titre: compte.titre,
        photoUrl: compte.photoUrl,
        telephone: compte.telephone,
        email: compte.email,
        etat: invitation ? "invite" : "a_inviter",
        inviteLe: invitation ? new Date().toISOString() : null,
        vuLe: liste[0]?.derniereConnexion?.toISOString() ?? null,
        cours: attaches.map((a) => {
          const lib = libelles.get(a.c.id)!;
          return {
            coursId: a.c.id,
            code: a.c.code,
            titre: a.c.titre,
            couleur: a.c.couleur,
            statut: a.c.statut,
            principal: a.principal,
            classes: lib.court,
            classesDetail: lib.long,
            sansClasse: lib.sansClasse,
            gerable: true,
            programme: null,
          };
        }),
      };
      const dto: ProfesseurCreeDto = { professeur, attaches: attaches.map((a) => a.c.id), invitation };
      res.setHeader("Cache-Control", "no-store");
      res.status(201).json(dto);
    }),
  );

  // ── Téléphone et e-mail libres ? (étape 1 de « Nouveau professeur ») ─────
  app.post(
    "/api/pilotage/professeurs/verifier",
    exigerDroit("comptes_personnel"),
    route(async (req, res) => {
      const u = moi(req);
      if (!peutCreer(u)) throw interdit(t("erreur.perimetre", vous));
      const d = valider(z.object({ telephone: optionnel(z.string().trim().max(30)), email: optionnel(schemaEmailCompte) }), req.body ?? {});
      const dto: VerificationProfesseurDto = { telephone: null, email: null };
      if (d.email) {
        const [x] = await db.select({ id: utilisateurs.id }).from(utilisateurs).where(eq(utilisateurs.email, d.email)).limit(1);
        if (x) dto.email = t("erreur.emailPris", vous);
      }
      const telephone = telephoneSaisi(d.telephone);
      if (!d.email && telephone) {
        const [x] = await db.select({ id: utilisateurs.id }).from(utilisateurs).where(eq(utilisateurs.telephone, telephone)).limit(1);
        if (x) dto.telephone = t("erreur.telephonePris", vous);
      }
      res.setHeader("Cache-Control", "no-store");
      res.json(dto);
    }),
  );

  // ── Les professeurs d'un cours ───────────────────────────────────────────
  app.get(
    "/api/pilotage/cours/:id(\\d+)/professeurs",
    exigerDroit("programme"),
    route(async (req, res) => {
      const u = moi(req);
      // Lecture : un cours que la personne voit (une vie scolaire de campus : un cours que suit son campus) ; elle ne
      // change ses professeurs que s'il est gérable (toutes ses classes dans son campus).
      const c = await coursVisible(u, idParam(req));
      const sitesDuCours = (await classesLibelle([c.id])).get(c.id)?.sites ?? [];
      const dto: ProfesseursDuCoursDto = { professeurs: await professeursDuCours(c.id), gerable: gerableAvec(u, sitesDuCours) };
      res.json(dto);
    }),
  );

  // ── Attacher ─────────────────────────────────────────────────────────────
  app.post(
    "/api/pilotage/cours/:id(\\d+)/professeurs",
    exigerDroit("programme"),
    route(async (req, res) => {
      const u = moi(req);
      const c = await coursGerable(u, idParam(req));
      if (c.statut === "archive") throw new ErreurHttp(409, t("erreur.archive", vous));
      const { formateurId } = valider(z.object({ formateurId: z.number().int().positive() }), req.body ?? {});
      await compteProfesseurActif(formateurId);
      const r = await db.transaction((tx) => attacher(tx, c, formateurId));
      if (!r.deja) {
        await journaliser(u, "cours_professeur_ajoute", { coursId: c.id, formateurId, principal: r.principal });
        await prevenirAttache(c, formateurId, r.principal);
        if (c.publierSurSite) prevenirSite("cours");
      }
      const dto: ReponseProfesseursCours = { professeurs: await professeursDuCours(c.id), deja: r.deja, principal: r.principal };
      res.json(dto);
    }),
  );

  // ── Nommer principal (l'ancien reste professeur du cours) ────────────────
  app.put(
    "/api/pilotage/cours/:id(\\d+)/professeurs/principal",
    exigerDroit("programme"),
    route(async (req, res) => {
      const u = moi(req);
      const c = await coursGerable(u, idParam(req));
      const { formateurId } = valider(z.object({ formateurId: z.number().int().positive() }), req.body ?? {});
      const f = await compteProfesseurActif(formateurId);
      if (c.formateurId === formateurId) return res.json({ professeurs: await professeursDuCours(c.id), deja: true } satisfies ReponseProfesseursCours);
      const [attache] = await db
        .select({ x: sql`1` })
        .from(coursFormateurs)
        .where(and(eq(coursFormateurs.coursId, c.id), eq(coursFormateurs.formateurId, formateurId)));
      if (!attache) throw new ErreurHttp(409, t("erreur.pasAttache", vous));
      await db.transaction(async (tx) => {
        await tx.update(cours).set({ formateurId, majLe: new Date() }).where(eq(cours.id, c.id));
        await tx.delete(coursFormateurs).where(and(eq(coursFormateurs.coursId, c.id), eq(coursFormateurs.formateurId, formateurId)));
        // Le nouveau principal est un choix de la direction : l'emploi du temps ne le défera pas.
        await tx.delete(formateursProgramme).where(and(eq(formateursProgramme.coursId, c.id), eq(formateursProgramme.formateurId, formateurId)));
        if (c.formateurId) {
          await tx.insert(coursFormateurs).values({ coursId: c.id, formateurId: c.formateurId }).onConflictDoNothing();
          // L'ancien principal, s'il venait de l'emploi du temps, y redevient un professeur comme les autres : la
          // publication suivante le retire quand il n'intervient plus dans ce cours.
          await tx
            .update(formateursProgramme)
            .set({ principal: false })
            .where(and(eq(formateursProgramme.coursId, c.id), eq(formateursProgramme.formateurId, c.formateurId)));
        }
      });
      await journaliser(u, "cours_formateur", { coursId: c.id, de: c.formateurId, vers: formateurId, via: "professeurs" });
      await notifier([f.id], { type: "cours", titre: `Un cours vous est confié : ${c.code}`, corps: c.titre, lien: `/enseigner/mon-cours/${c.id}`, push: false });
      if (c.publierSurSite) prevenirSite("cours");
      res.json({ professeurs: await professeursDuCours(c.id) } satisfies ReponseProfesseursCours);
    }),
  );

  // ── Retirer ──────────────────────────────────────────────────────────────
  app.delete(
    "/api/pilotage/cours/:id(\\d+)/professeurs/:formateurId(\\d+)",
    exigerDroit("programme"),
    route(async (req, res) => {
      const u = moi(req);
      const c = await coursGerable(u, idParam(req));
      const formateurId = idParam(req, "formateurId");
      const [f] = await db.select().from(utilisateurs).where(eq(utilisateurs.id, formateurId));
      if (!f) throw introuvable("Professeur");
      const principal = c.formateurId === formateurId;
      const [autre] = await db
        .select({ x: sql`1` })
        .from(coursFormateurs)
        .where(and(eq(coursFormateurs.coursId, c.id), eq(coursFormateurs.formateurId, formateurId)));
      if (!principal && !autre) return res.json({ professeurs: await professeursDuCours(c.id), deja: true } satisfies ReponseProfesseursCours);
      // Il fait cours en direct en ce moment dans ce cours : après le cours.
      const enDirect = await db.select({ id: seances.id }).from(seances).where(and(eq(seances.coursId, c.id), eq(seances.statut, "en_direct")));
      if (enDirect.some((s) => connectesSur(`seance:${s.id}`).has(formateurId))) {
        throw new ErreurHttp(409, t("erreur.enDirect", { ...vous, v: { nom: `${f.prenom} ${f.nom}`.trim() } }));
      }
      const programme = await intervientAuProgramme(c.id, formateurId);
      let nouveauPrincipal: string | null = null;
      await db.transaction(async (tx) => {
        if (principal) {
          // Le suivant : le premier des autres professeurs ACTIFS, par nom puis prénom ; aucun : le cours n'a plus de
          // principal (le prochain professeur attaché le devient).
          const [suivant] = await tx
            .select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom })
            .from(coursFormateurs)
            .innerJoin(utilisateurs, eq(utilisateurs.id, coursFormateurs.formateurId))
            .where(and(eq(coursFormateurs.coursId, c.id), eq(utilisateurs.actif, true), eq(utilisateurs.role, "formateur")))
            .orderBy(asc(utilisateurs.nom), asc(utilisateurs.prenom))
            .limit(1);
          await tx.update(cours).set({ formateurId: suivant?.id ?? null, majLe: new Date() }).where(eq(cours.id, c.id));
          if (suivant) {
            await tx.delete(coursFormateurs).where(and(eq(coursFormateurs.coursId, c.id), eq(coursFormateurs.formateurId, suivant.id)));
            // Promu d'office : s'il venait de l'emploi du temps, celui-ci le tient pour son principal et le remplacera
            // par l'intervenant du moment quand il n'interviendra plus.
            await tx
              .update(formateursProgramme)
              .set({ principal: true })
              .where(and(eq(formateursProgramme.coursId, c.id), eq(formateursProgramme.formateurId, suivant.id)));
            nouveauPrincipal = `${suivant.prenom} ${suivant.nom}`.trim();
          }
        } else {
          await tx.delete(coursFormateurs).where(and(eq(coursFormateurs.coursId, c.id), eq(coursFormateurs.formateurId, formateurId)));
        }
        // L'emploi du temps ne le compte plus comme « son » professeur (il le remettra s'il intervient encore).
        await tx.delete(formateursProgramme).where(and(eq(formateursProgramme.coursId, c.id), eq(formateursProgramme.formateurId, formateurId)));
      });
      await journaliser(u, "cours_professeur_retire", { coursId: c.id, formateurId, etaitPrincipal: principal, nouveauPrincipal, programme: Boolean(programme) });
      if (c.publierSurSite) prevenirSite("cours");
      const dto: ReponseProfesseursCours = {
        professeurs: await professeursDuCours(c.id),
        nouveauPrincipal,
        avertissement: programme ? t("retirer.programme", { ...vous, v: { nom: `${f.prenom} ${f.nom}`.trim(), quand: programme } }) : null,
      };
      res.json(dto);
    }),
  );
}
