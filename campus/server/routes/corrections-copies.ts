// Copies corrigées par le campus (chantier K2 de la correction automatique, décision de José du 8 octobre 2026) :
// relectures demandées par l'étudiant, copies « à revoir » par le formateur, bilan pour la direction.
// Contrat : shared/engagement/corrections.ts. Moteur : server/correction-auto.ts.
//
//   POST /api/rendus/:id/relecture             { motif } l'étudiant demande une relecture de la note du campus
//   GET  /api/enseigner/a-revoir               copies que le campus n'a pas publiées, et relectures ouvertes
//   POST /api/enseigner/relectures/:id         { note?, reponse } le formateur garde ou change la note, et répond
//   GET  /api/pilotage/corrections[?jours=30]  la correction automatique en chiffres (direction, périmètre)
//
// Une relecture traitée fait de la note une note de formateur (origine « formateur », même gardée) : le campus
// ne la reprend plus, même si le corrigé change ensuite. Les listes portent des noms d'étudiants et des notes :
// réponses en « no-store » (postes partagés), comme /api/enseigner/copies.
import type { Express } from "express";
import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { exigerDroit, exigerRole, droitSiEquipe, moi, perimetreSites } from "../auth";
import { route, valider, idParam, introuvable, interdit, invalide, ErreurHttp } from "../http";
import { enseigneCours, formateursDuCours, idsCoursAccessibles } from "../acces";
import { notifier } from "../notifications";
import { publierUtilisateur } from "../temps-reel";
import { copiePriseEnMain, versRelectureEtudiant } from "../correction-auto";
import { cours, demandesRelecture, devoirs, journal, rendus, utilisateurs, type Utilisateur } from "@shared/schema";
import { MOTIF_RELECTURE_MAX, type BilanCorrections, type CopieARevoir, type ListeARevoir, type RaisonARevoir, type ReponseRelecture } from "@shared/engagement/corrections";
import { PERIODES } from "@shared/engagement/indicateurs";

const ENSEIGNANTS = ["formateur", "admin", "vie_scolaire"] as const;
const iso = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString() : null);
const arrondi = (n: number) => Math.round(n * 100) / 100;

/** Littéral SQL d'un tableau d'entiers (identifiants déjà validés). */
const tableauEntiers = (ids: number[]) => sql`${`{${ids.map((i) => Math.trunc(i)).join(",")}}`}::int[]`;

async function tracer(utilisateurId: number, action: string, details: Record<string, unknown>) {
  await db.insert(journal).values({ utilisateurId, action, details });
}

/** Cours dont la personne corrige les copies : les siens (formateur), tous (direction), ceux de son campus (vie scolaire). */
async function coursCorriges(u: Utilisateur): Promise<number[]> {
  const ids = await idsCoursAccessibles(u);
  if (u.role !== "vie_scolaire") return ids;
  const siens: number[] = [];
  for (const id of ids) if (await enseigneCours(u, id)) siens.push(id);
  return siens;
}

// ── Copies à revoir ────────────────────────────────────────────────────────

type LigneARevoir = {
  rendu_id: number;
  devoir_id: number;
  devoir_titre: string;
  cours_code: string;
  bareme: number;
  etudiant_id: number;
  prenom: string;
  nom: string;
  site_id: number | null;
  site: string | null;
  rendu_le: string | null;
  statut: string;
  note: number | null;
  origine_note: string;
  raison: RaisonARevoir | null;
  detail: string | null;
  note_proposee: number | null;
  a_revoir: boolean;
  relecture_id: number | null;
  motif: string | null;
  relecture_le: string | null;
  depuis: string;
};

/**
 * Copies que le campus n'a pas publiées (« à revoir » et encore rendues, sans correction d'un formateur), notes
 * du campus déjà publiées dont la recorrection (corrigé modifié) est retenue « à revoir » (la note publiée reste,
 * le formateur la garde ou la change), et copies dont l'étudiant demande la relecture, les plus anciennes
 * d'abord. Même définition que les compteurs : « à revoir » ET (rendue OU note du campus).
 */
async function copiesARevoir(u: Utilisateur, coursIds: number[]): Promise<ListeARevoir> {
  if (!coursIds.length) return { copies: [] };
  const { rows } = await db.execute<LigneARevoir>(sql`
    SELECT r.id AS rendu_id, d.id AS devoir_id, d.titre AS devoir_titre, c.code AS cours_code, d.bareme,
           e.id AS etudiant_id, e.prenom, e.nom, e.site_id, si.nom_court AS site,
           r.rendu_le, r.statut, r.note, r.origine_note, ca.raison, ca.detail, ca.note_campus AS note_proposee,
           (ca.etat = 'a_revoir' AND (
             (r.statut = 'rendu' AND NOT (r.correcteur_id IS NOT NULL AND r.corrige_le IS NOT NULL AND (r.rendu_le IS NULL OR r.corrige_le >= r.rendu_le)))
             OR (r.statut = 'corrige' AND r.origine_note = 'campus'))) AS a_revoir,
           dr.id AS relecture_id, dr.motif, dr.cree_le AS relecture_le,
           COALESCE(dr.cree_le, ca.maj_le) AS depuis
    FROM campus.rendus r
    JOIN campus.devoirs d ON d.id = r.devoir_id
    JOIN campus.cours c ON c.id = d.cours_id
    JOIN campus.utilisateurs e ON e.id = r.etudiant_id
    LEFT JOIN campus.sites si ON si.id = e.site_id
    LEFT JOIN campus.corrections_auto ca ON ca.rendu_id = r.id
    LEFT JOIN campus.demandes_relecture dr ON dr.rendu_id = r.id AND dr.statut = 'ouverte'
    WHERE d.cours_id = ANY(${tableauEntiers(coursIds)}) AND d.type = 'depot' AND (dr.id IS NOT NULL OR ca.etat = 'a_revoir')
    ORDER BY depuis ASC, r.id ASC
    LIMIT 500`);
  const perimetre = perimetreSites(u);
  const copies: CopieARevoir[] = rows
    .filter((l) => l.relecture_id !== null || l.a_revoir)
    .filter((l) => !perimetre || (l.site_id !== null && perimetre.includes(l.site_id)))
    .map((l) => ({
      renduId: Number(l.rendu_id),
      devoirId: Number(l.devoir_id),
      devoirTitre: l.devoir_titre,
      coursCode: l.cours_code,
      etudiant: { id: Number(l.etudiant_id), prenom: l.prenom, nom: l.nom, site: l.site },
      renduLe: iso(l.rendu_le),
      raison: l.relecture_id !== null ? "relecture" : l.raison ?? "echecs",
      // Raison de la retenue, ou remarque du campus sur la note dont l'étudiant demande la relecture.
      detail: l.a_revoir || l.relecture_id !== null ? l.detail : null,
      // Note publiée (relecture, recorrection retenue) ; sinon la note que le campus proposait (jamais celle d'une
      // aide demandée par le formateur : note_campus).
      note: l.statut === "corrige" ? l.note : l.note_proposee,
      // Note publiée par le campus (relecture, ou recorrection retenue : la note de l'ancien corrigé reste publiée).
      parCampus: l.statut === "corrige" && l.origine_note === "campus",
      bareme: l.bareme,
      relecture: l.relecture_id !== null ? { id: Number(l.relecture_id), motif: l.motif ?? "", creeLe: iso(l.relecture_le)! } : null,
    }));
  return { copies };
}

// ── Bilan pour la direction ────────────────────────────────────────────────

async function bilanCorrections(u: Utilisateur, jours: number): Promise<BilanCorrections> {
  const depuis = new Date(Date.now() - jours * 24 * 3600_000);
  const coursIds = await idsCoursAccessibles(u);
  const vide: BilanCorrections = {
    depuis: depuis.toISOString(),
    corriges: { enPreparation: 0, aValider: 0, valides: 0, tacites: 0 },
    copies: { enFile: 0, notees: 0, aRevoir: 0, erreurs: 0 },
    noteesPeriode: 0,
    relectures: { ouvertes: 0, traitees: 0 },
    changees: { n: 0, ecartMoyen: null },
    parFormateur: [],
  };
  if (!coursIds.length) return vide;
  const ids = tableauEntiers(coursIds);
  const perimetre = perimetreSites(u);
  // Copies, relectures et notes : les étudiants du périmètre (la vie scolaire d'un campus : les siens).
  const site = perimetre ? sql`AND e.site_id = ANY(${tableauEntiers(perimetre)})` : sql``;
  const d0 = depuis.toISOString();
  const n = (v: unknown) => Number(v ?? 0);

  const [corriges, copies, notees, relectures, changees, parCours, parValideur] = await Promise.all([
    db.execute<{ en_preparation: number; a_valider: number; valides: number; tacites: number }>(sql`
      SELECT count(*) FILTER (WHERE cd.statut = 'en_preparation') AS en_preparation,
             count(*) FILTER (WHERE cd.statut = 'propose') AS a_valider,
             count(*) FILTER (WHERE cd.statut = 'valide' AND cd.valide_le >= ${d0}::timestamptz) AS valides,
             count(*) FILTER (WHERE cd.statut = 'tacite' AND cd.valide_le >= ${d0}::timestamptz) AS tacites
      FROM campus.corriges_devoirs cd JOIN campus.devoirs d ON d.id = cd.devoir_id
      WHERE d.publie AND d.cours_id = ANY(${ids})`),
    // « En file » : suivies en file, et copies rendues d'un devoir corrigé par le campus pas encore prises en charge.
    db.execute<{ en_file: number; notees: number; a_revoir: number; erreurs: number }>(sql`
      SELECT count(*) FILTER (WHERE ca.etat = 'en_file' OR (ca.rendu_id IS NULL AND r.statut = 'rendu' AND r.correcteur_id IS NULL)) AS en_file,
             count(*) FILTER (WHERE ca.etat = 'notee') AS notees,
             count(*) FILTER (WHERE ca.etat = 'a_revoir' AND (r.statut = 'rendu' OR (r.statut = 'corrige' AND r.origine_note = 'campus'))) AS a_revoir,
             count(*) FILTER (WHERE ca.etat = 'erreur') AS erreurs
      FROM campus.rendus r
      JOIN campus.devoirs d ON d.id = r.devoir_id
      JOIN campus.corriges_devoirs cd ON cd.devoir_id = d.id
      JOIN campus.utilisateurs e ON e.id = r.etudiant_id
      LEFT JOIN campus.corrections_auto ca ON ca.rendu_id = r.id
      WHERE d.type = 'depot' AND d.publie AND r.statut <> 'brouillon' AND d.cours_id = ANY(${ids}) ${site}`),
    db.execute<{ n: number }>(sql`
      SELECT count(*) AS n FROM campus.journal j
      JOIN campus.devoirs d ON d.id = (j.details ->> 'devoirId')::int
      JOIN campus.utilisateurs e ON e.id = (j.details ->> 'etudiantId')::int
      WHERE j.action = 'note_campus' AND j.cree_le >= ${d0}::timestamptz AND d.cours_id = ANY(${ids}) ${site}`),
    db.execute<{ ouvertes: number; traitees: number }>(sql`
      SELECT count(*) FILTER (WHERE dr.statut = 'ouverte') AS ouvertes,
             count(*) FILTER (WHERE dr.statut = 'traitee' AND dr.traitee_le >= ${d0}::timestamptz) AS traitees
      FROM campus.demandes_relecture dr
      JOIN campus.rendus r ON r.id = dr.rendu_id
      JOIN campus.devoirs d ON d.id = r.devoir_id
      JOIN campus.utilisateurs e ON e.id = dr.etudiant_id
      WHERE d.cours_id = ANY(${ids}) ${site}`),
    // Notes du campus changées ensuite par un formateur : écart moyen ramené sur 20, en valeur absolue.
    db.execute<{ n: number; ecart: number | null }>(sql`
      SELECT count(*) AS n, avg(abs(r.note - ca.note_campus) / NULLIF(d.bareme, 0) * 20) AS ecart
      FROM campus.corrections_auto ca
      JOIN campus.rendus r ON r.id = ca.rendu_id
      JOIN campus.devoirs d ON d.id = r.devoir_id
      JOIN campus.utilisateurs e ON e.id = r.etudiant_id
      WHERE ca.etat = 'notee' AND r.origine_note = 'formateur' AND r.note IS NOT NULL AND ca.note_campus IS NOT NULL
        AND r.note IS DISTINCT FROM ca.note_campus AND r.corrige_le >= ${d0}::timestamptz AND d.cours_id = ANY(${ids}) ${site}`),
    // Par formateur principal du cours : tacites de la période, corrigés encore à valider.
    db.execute<{ id: number; prenom: string; nom: string; tacites: number; a_valider: number }>(sql`
      SELECT f.id, f.prenom, f.nom,
             count(*) FILTER (WHERE cd.statut = 'tacite' AND cd.valide_le >= ${d0}::timestamptz) AS tacites,
             count(*) FILTER (WHERE cd.statut = 'propose') AS a_valider
      FROM campus.corriges_devoirs cd
      JOIN campus.devoirs d ON d.id = cd.devoir_id
      JOIN campus.cours c ON c.id = d.cours_id
      JOIN campus.utilisateurs f ON f.id = c.formateur_id
      WHERE d.publie AND d.cours_id = ANY(${ids})
      GROUP BY f.id, f.prenom, f.nom`),
    // Validés par le formateur lui-même (principal ou co-formateur) pendant la période.
    db.execute<{ id: number; prenom: string; nom: string; valides: number }>(sql`
      SELECT f.id, f.prenom, f.nom, count(*) AS valides
      FROM campus.corriges_devoirs cd
      JOIN campus.devoirs d ON d.id = cd.devoir_id
      JOIN campus.utilisateurs f ON f.id = cd.valide_par_id AND f.role = 'formateur'
      WHERE cd.statut = 'valide' AND cd.valide_le >= ${d0}::timestamptz AND d.cours_id = ANY(${ids})
      GROUP BY f.id, f.prenom, f.nom`),
  ]);

  const formateurs = new Map<number, BilanCorrections["parFormateur"][number]>();
  const fiche = (l: { id: number; prenom: string; nom: string }) => {
    const id = Number(l.id);
    if (!formateurs.has(id)) formateurs.set(id, { id, nom: `${l.prenom} ${l.nom}`.trim(), valides: 0, tacites: 0, aValider: 0 });
    return formateurs.get(id)!;
  };
  for (const l of parCours.rows) Object.assign(fiche(l), { tacites: n(l.tacites), aValider: n(l.a_valider) });
  for (const l of parValideur.rows) fiche(l).valides = n(l.valides);

  const c = corriges.rows[0];
  const k = copies.rows[0];
  const ch = changees.rows[0];
  const rl = relectures.rows[0];
  return {
    depuis: depuis.toISOString(),
    corriges: { enPreparation: n(c?.en_preparation), aValider: n(c?.a_valider), valides: n(c?.valides), tacites: n(c?.tacites) },
    copies: { enFile: n(k?.en_file), notees: n(k?.notees), aRevoir: n(k?.a_revoir), erreurs: n(k?.erreurs) },
    noteesPeriode: n(notees.rows[0]?.n),
    relectures: { ouvertes: n(rl?.ouvertes), traitees: n(rl?.traitees) },
    changees: { n: n(ch?.n), ecartMoyen: ch?.ecart === null || ch?.ecart === undefined ? null : arrondi(Number(ch.ecart)) },
    // Ceux qui laissent le plus de corrigés sans réponse d'abord.
    parFormateur: [...formateurs.values()].filter((f) => f.valides + f.tacites + f.aValider > 0).sort((a, b) => b.aValider - a.aValider || b.tacites - a.tacites || a.nom.localeCompare(b.nom, "fr")),
  };
}

// ── Routes ─────────────────────────────────────────────────────────────────

const schemaRelecture = z.object({
  motif: z.string().trim().min(10, "dis en quelques mots ce qui te semble faux (10 caractères au moins)").max(MOTIF_RELECTURE_MAX, `${MOTIF_RELECTURE_MAX} caractères au plus`),
});

const schemaTraitement = z.object({
  note: z.number().min(0).max(1000).nullable().optional(),
  reponse: z.string().trim().min(2, "écrivez une réponse à l'étudiant").max(MOTIF_RELECTURE_MAX, `${MOTIF_RELECTURE_MAX} caractères au plus`),
});

const schemaBilan = z.object({
  jours: z.coerce
    .number()
    .int()
    .refine((v) => (PERIODES as readonly number[]).includes(v), `période attendue : ${PERIODES.join(", ")} jours`)
    .default(30),
});

export function enregistrerCorrectionsCopies(app: Express) {
  // L'étudiant demande une relecture de la note que le campus a posée sur SA copie (une seule ouverte à la fois).
  app.post(
    "/api/rendus/:id/relecture",
    exigerRole("etudiant"),
    route(async (req, res) => {
      const u = moi(req);
      const { motif } = valider(schemaRelecture, req.body);
      const [l] = await db
        .select({ r: rendus, d: devoirs, c: { code: cours.code } })
        .from(rendus)
        .innerJoin(devoirs, eq(devoirs.id, rendus.devoirId))
        .innerJoin(cours, eq(cours.id, devoirs.coursId))
        .where(eq(rendus.id, idParam(req)));
      if (!l || l.r.etudiantId !== u.id) throw introuvable("Copie");
      if (l.d.type !== "depot" || l.r.statut !== "corrige" || l.r.note === null) throw new ErreurHttp(409, "Ta copie n'est pas encore notée : tu pourras demander une relecture quand ta note sera publiée.");
      if (l.r.origineNote !== "campus") throw new ErreurHttp(409, "Cette note a été posée par ton formateur : écris-lui dans la messagerie du cours si tu as une question.");
      const [cree] = await db.insert(demandesRelecture).values({ renduId: l.r.id, etudiantId: u.id, motif, noteAvant: l.r.note }).onConflictDoNothing().returning();
      if (!cree) throw new ErreurHttp(409, "Ta demande de relecture est déjà envoyée : ton formateur va te répondre.");
      await tracer(u.id, "relecture_demandee", { relectureId: cree.id, renduId: l.r.id, devoirId: l.d.id, note: l.r.note });
      // Les formateurs du cours (à défaut, la direction) : le nom de l'étudiant ne part pas dans la notification.
      let destinataires = (await formateursDuCours(l.d.coursId)).filter((f) => f.actif).map((f) => f.id);
      if (!destinataires.length) destinataires = (await db.select({ id: utilisateurs.id }).from(utilisateurs).where(and(eq(utilisateurs.role, "admin"), eq(utilisateurs.actif, true)))).map((a) => a.id);
      await notifier(destinataires, {
        type: "devoir",
        titre: "Relecture demandée",
        corps: `${l.c.code} · « ${l.d.titre} » : un étudiant demande la relecture de la note du campus.`,
        lien: "/enseigner/a-revoir",
      });
      for (const id of destinataires) publierUtilisateur(id, "relecture-demandee", { renduId: l.r.id, devoirId: l.d.id });
      const reponse: ReponseRelecture = { relecture: versRelectureEtudiant(cree) };
      res.status(201).json(reponse);
    }),
  );

  app.get(
    "/api/enseigner/a-revoir",
    exigerRole(...ENSEIGNANTS),
    droitSiEquipe("notes"),
    route(async (req, res) => {
      const u = moi(req);
      const liste = await copiesARevoir(u, await coursCorriges(u));
      res.setHeader("Cache-Control", "no-store");
      res.json(liste);
    }),
  );

  // Le formateur répond à une demande de relecture : il garde la note (note absente) ou la change.
  app.post(
    "/api/enseigner/relectures/:id",
    exigerRole(...ENSEIGNANTS),
    droitSiEquipe("notes"),
    route(async (req, res) => {
      const u = moi(req);
      const v = valider(schemaTraitement, req.body);
      const [l] = await db
        .select({ dr: demandesRelecture, r: rendus, d: devoirs, e: { id: utilisateurs.id, siteId: utilisateurs.siteId } })
        .from(demandesRelecture)
        .innerJoin(rendus, eq(rendus.id, demandesRelecture.renduId))
        .innerJoin(devoirs, eq(devoirs.id, rendus.devoirId))
        .innerJoin(utilisateurs, eq(utilisateurs.id, rendus.etudiantId))
        .where(eq(demandesRelecture.id, idParam(req)));
      if (!l) throw introuvable("Demande de relecture");
      if (!(await enseigneCours(u, l.d.coursId))) throw interdit("Seul le formateur du cours peut répondre à cette demande.");
      const perimetre = perimetreSites(u);
      if (perimetre && (l.e.siteId === null || !perimetre.includes(l.e.siteId))) throw interdit("Cet étudiant n'est pas rattaché à votre campus.");
      if (l.dr.statut !== "ouverte") throw new ErreurHttp(409, "Cette demande a déjà reçu une réponse.");
      if (l.r.statut !== "corrige") throw new ErreurHttp(409, "Cette copie n'a plus de note publiée.");
      if (v.note !== undefined && v.note !== null && v.note > l.d.bareme) throw invalide(`La note ne peut pas dépasser le barème (${l.d.bareme}).`);
      const avant = l.r.note;
      const note = v.note ?? avant;
      const changee = note !== avant;
      const maintenant = new Date();
      const traitee = await db.transaction(async (tx) => {
        const [dr] = await tx
          .update(demandesRelecture)
          .set({ statut: "traitee", noteApres: note, reponse: v.reponse, traiteeParId: u.id, traiteeLe: maintenant })
          .where(and(eq(demandesRelecture.id, l.dr.id), eq(demandesRelecture.statut, "ouverte")))
          .returning();
        if (!dr) return null;
        // Gardée ou changée, la note est désormais celle du formateur : le campus ne la reprendra plus. Changée
        // (D-E) : le détail critère par critère du campus ne la justifie plus, il est retiré (jamais deux notes
        // qui se contredisent sous les yeux de l'étudiant).
        await tx
          .update(rendus)
          .set({ note, ...(changee ? { noteDetail: null } : {}), origineNote: "formateur", correcteurId: u.id, corrigeLe: maintenant, majLe: maintenant })
          .where(and(eq(rendus.id, l.r.id), eq(rendus.statut, "corrige")));
        return dr;
      });
      if (!traitee) throw new ErreurHttp(409, "Cette demande a déjà reçu une réponse.");
      await copiePriseEnMain(l.r.id);
      const [ca] = await db.execute<{ note_campus: number | null }>(sql`SELECT note_campus FROM campus.corrections_auto WHERE rendu_id = ${l.r.id}`).then((x) => x.rows);
      await tracer(u.id, changee ? "note_modifiee" : "relecture_traitee", {
        relectureId: l.dr.id,
        renduId: l.r.id,
        devoirId: l.d.id,
        etudiantId: l.e.id,
        ancienneNote: avant,
        note,
        ...(ca?.note_campus !== null && ca?.note_campus !== undefined && note !== null ? { noteCampus: ca.note_campus, ecartCampus: arrondi(note - ca.note_campus) } : {}),
      });
      // Jamais la note dans la notification.
      await notifier([l.e.id], {
        type: "note",
        titre: changee ? "Note mise à jour après relecture" : "Ton formateur a répondu à ta demande de relecture",
        corps: `« ${l.d.titre} »`,
        lien: `/devoirs/${l.d.id}`,
      });
      publierUtilisateur(l.e.id, "devoir-corrige", { devoirId: l.d.id });
      res.json({ relecture: versRelectureEtudiant(traitee), note });
    }),
  );

  app.get(
    "/api/pilotage/corrections",
    exigerDroit("notes"),
    route(async (req, res) => {
      const u = moi(req);
      const { jours } = valider(schemaBilan, req.query);
      res.setHeader("Cache-Control", "private, no-store");
      res.json(await bilanCorrections(u, jours));
    }),
  );
}
