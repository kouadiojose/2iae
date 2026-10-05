// Médiathèque des cours : les enregistrements (replays des séances terminées)
// et les documents (PDF et fichiers des leçons publiées) de chaque cours que
// la personne peut consulter.
//
// Qui voit quoi (server/acces.ts, idsCoursMediatheque) :
//   - étudiant : ses cours, et les cours publiés dont la médiathèque est
//     « ouverte à tous » (cours.mediatheque = 'tous', le réglage par défaut) ;
//     un cours « réservé aux classes du cours » n'apparaît qu'à ses étudiants ;
//   - formateur : ses cours, plus les replays de tous les cours (comme la page
//     « Enregistrements ») ;
//   - équipe : les cours de son périmètre.
// La médiathèque n'ouvre rien d'autre : ni devoirs, ni notes, ni direct, ni
// discussion, ni la page du cours. La lecture d'un replay passe par
// routes/live.ts (seanceDuReplay), celle d'un fichier par le gardien « lecon »
// (routes/cours.ts) : les deux appliquent la même règle.
//
// Réglage : la direction et l'équipe qui gère le programme
// (PATCH /api/cours/:id/mediatheque).
import type { Express } from "express";
import { z } from "zod";
import { and, asc, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "../db";
import { exigerDroit, exigerRole, moi } from "../auth";
import { route, valider, idParam, introuvable, interdit } from "../http";
import { idsCoursAccessibles, idsCoursMediatheque, peutReglerMediatheque } from "../acces";
import { intervenantsDesSeances } from "../programme-outils";
import { urlFichier } from "../fichiers";
import {
  cours,
  seances,
  modules,
  lecons,
  fichiers,
  utilisateurs,
  vuesReplay,
  journal,
  ACCES_MEDIATHEQUE,
  TYPES_LECON_MEDIATHEQUE,
  type CoursMediathequeDto,
  type DocumentMediathequeDto,
  type EnregistrementMediathequeDto,
  type MediathequeDto,
  type ReglageMediathequeDto,
} from "@shared/schema";

/** Un replay reste « nouveau » 14 jours, tant que la personne ne l'a pas ouvert (comme /api/replays). */
const NOUVEAU_MS = 14 * 24 * 3600_000;

const schemaReglage = z.object({ mediatheque: z.enum(ACCES_MEDIATHEQUE) });

/** Enregistrements : séances terminées avec une vidéo, jamais un essai de visio (direct immédiat sans prévenir). */
async function enregistrementsDes(u: { id: number }, coursIds: number[] | "tous") {
  if (coursIds !== "tous" && !coursIds.length) return new Map<number, EnregistrementMediathequeDto[]>();
  const lignes = await db
    .select({
      id: seances.id,
      coursId: seances.coursId,
      titre: seances.titre,
      debut: seances.debut,
      termineeLe: seances.termineeLe,
      dureeSecondes: seances.replayDureeSecondes,
      formateurId: cours.formateurId,
      diapos: sql<number>`jsonb_array_length(${seances.diapos})::int`,
    })
    .from(seances)
    .innerJoin(cours, eq(cours.id, seances.coursId))
    .where(
      and(
        eq(seances.statut, "terminee"),
        or(isNotNull(seances.enregistrementId), isNotNull(seances.replayUrl)),
        coursIds === "tous" ? undefined : inArray(seances.coursId, coursIds),
        sql`NOT EXISTS (SELECT 1 FROM campus.directs_immediats di WHERE di.seance_id = ${seances.id} AND NOT di.prevenir)`,
      ),
    )
    .orderBy(desc(seances.debut));
  const resultat = new Map<number, EnregistrementMediathequeDto[]>();
  if (!lignes.length) return resultat;

  const ids = lignes.map((l) => l.id);
  const idsFormateurs = [...new Set(lignes.map((l) => l.formateurId).filter((x): x is number => x !== null))];
  const [intervenants, vus, noms] = await Promise.all([
    intervenantsDesSeances(ids),
    db.select({ seanceId: vuesReplay.seanceId }).from(vuesReplay).where(and(eq(vuesReplay.utilisateurId, u.id), inArray(vuesReplay.seanceId, ids))),
    idsFormateurs.length
      ? db.select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom }).from(utilisateurs).where(inArray(utilisateurs.id, idsFormateurs))
      : Promise.resolve([]),
  ]);
  const dejaVus = new Set(vus.map((v) => v.seanceId));
  const nomDe = new Map(noms.map((n) => [n.id, `${n.prenom} ${n.nom}`]));
  const recent = Date.now() - NOUVEAU_MS;
  for (const l of lignes) {
    const vu = dejaVus.has(l.id);
    const e: EnregistrementMediathequeDto = {
      seanceId: l.id,
      titre: l.titre,
      debut: l.debut.toISOString(),
      dureeSecondes: l.dureeSecondes,
      formateur: intervenants.get(l.id)?.nom ?? (l.formateurId ? (nomDe.get(l.formateurId) ?? null) : null),
      vu,
      nouveau: !vu && (l.termineeLe ?? l.debut).getTime() > recent,
      lien: `/replays/${l.id}`,
      diapos: l.diapos ?? 0,
    };
    resultat.set(l.coursId, [...(resultat.get(l.coursId) ?? []), e]);
  }
  return resultat;
}

/** Documents : fichiers joints aux leçons publiées (PDF, documents), dans l'ordre du programme, numérotés comme sur la page du cours. */
async function documentsDes(coursIds: number[]) {
  const resultat = new Map<number, DocumentMediathequeDto[]>();
  if (!coursIds.length) return resultat;
  const lignes = await db
    .select({
      id: lecons.id,
      coursId: lecons.coursId,
      moduleId: lecons.moduleId,
      titre: lecons.titre,
      type: lecons.type,
      fichierId: lecons.fichierId,
      nom: fichiers.nomOriginal,
      mime: fichiers.mime,
      taille: fichiers.taille,
    })
    .from(lecons)
    .leftJoin(fichiers, eq(fichiers.id, lecons.fichierId))
    .where(
      and(
        inArray(lecons.coursId, coursIds),
        eq(lecons.publiee, true),
        inArray(lecons.type, [...TYPES_LECON_MEDIATHEQUE]),
        isNotNull(lecons.fichierId),
      ),
    );
  if (!lignes.length) return resultat;

  // Numérotation de la page du cours : position du chapitre, puis rang parmi les leçons publiées du chapitre.
  const avecDocuments = [...new Set(lignes.map((l) => l.coursId))];
  const [chapitres, publiees] = await Promise.all([
    db
      .select({ id: modules.id, coursId: modules.coursId, titre: modules.titre })
      .from(modules)
      .where(inArray(modules.coursId, avecDocuments))
      .orderBy(asc(modules.ordre), asc(modules.id)),
    db
      .select({ id: lecons.id, moduleId: lecons.moduleId })
      .from(lecons)
      .where(and(inArray(lecons.coursId, avecDocuments), eq(lecons.publiee, true)))
      .orderBy(asc(lecons.ordre), asc(lecons.id)),
  ]);
  const chapitre = new Map<number, { titre: string; numero: number; rang: number }>();
  const positionDansCours = new Map<number, number>();
  for (const ch of chapitres) {
    const n = (positionDansCours.get(ch.coursId) ?? 0) + 1;
    positionDansCours.set(ch.coursId, n);
    chapitre.set(ch.id, { titre: ch.titre, numero: n, rang: chapitre.size });
  }
  const numeroDe = new Map<number, string>();
  const rangDansChapitre = new Map<number, number>();
  const ordreLecon = new Map<number, number>();
  for (const [i, l] of publiees.entries()) {
    const n = (rangDansChapitre.get(l.moduleId) ?? 0) + 1;
    rangDansChapitre.set(l.moduleId, n);
    const ch = chapitre.get(l.moduleId);
    if (ch) numeroDe.set(l.id, `${ch.numero}.${n}`);
    ordreLecon.set(l.id, i);
  }
  lignes.sort(
    (a, b) => (chapitre.get(a.moduleId)?.rang ?? 0) - (chapitre.get(b.moduleId)?.rang ?? 0) || (ordreLecon.get(a.id) ?? 0) - (ordreLecon.get(b.id) ?? 0),
  );
  for (const l of lignes) {
    const d: DocumentMediathequeDto = {
      leconId: l.id,
      titre: l.titre,
      numero: numeroDe.get(l.id) ?? "",
      chapitre: chapitre.get(l.moduleId)?.titre ?? "",
      type: l.type as DocumentMediathequeDto["type"],
      fichierId: l.fichierId!,
      nom: l.nom,
      mime: l.mime,
      taille: l.taille,
      url: urlFichier(l.fichierId!),
    };
    resultat.set(l.coursId, [...(resultat.get(l.coursId) ?? []), d]);
  }
  return resultat;
}

export function enregistrerMediatheque(app: Express) {
  app.get(
    "/api/mediatheque",
    exigerRole("etudiant", "formateur", "admin", "vie_scolaire"),
    route(async (req, res) => {
      const u = moi(req);
      const [ouverts, siens] = await Promise.all([idsCoursMediatheque(u), idsCoursAccessibles(u)]);
      const mesCours = new Set(siens);
      // Les formateurs revoient les replays de tous les cours ; les documents, seulement ceux de leurs cours.
      const [enregistrements, documents] = await Promise.all([
        enregistrementsDes(u, u.role === "formateur" ? "tous" : ouverts),
        documentsDes(ouverts),
      ]);
      const ids = [...new Set([...enregistrements.keys(), ...documents.keys()])];
      if (!ids.length) {
        const vide: MediathequeDto = { cours: [] };
        return res.json(vide);
      }

      const lignes = await db
        .select({ id: cours.id, code: cours.code, titre: cours.titre, couleur: cours.couleur, mediatheque: cours.mediatheque, formateurId: cours.formateurId })
        .from(cours)
        .where(inArray(cours.id, ids));
      const idsFormateurs = [...new Set(lignes.map((c) => c.formateurId).filter((x): x is number => x !== null))];
      const formateurs = idsFormateurs.length
        ? await db.select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom }).from(utilisateurs).where(inArray(utilisateurs.id, idsFormateurs))
        : [];
      const nomDe = new Map(formateurs.map((f) => [f.id, `${f.prenom} ${f.nom}`]));
      const personnel = u.role !== "etudiant";

      const liste = lignes
        .map(
          (c): CoursMediathequeDto => ({
            id: c.id,
            code: c.code,
            titre: c.titre,
            couleur: c.couleur,
            formateur: c.formateurId ? (nomDe.get(c.formateurId) ?? null) : null,
            deMaClasse: mesCours.has(c.id),
            acces: personnel ? c.mediatheque : null,
            enregistrements: enregistrements.get(c.id) ?? [],
            documents: documents.get(c.id) ?? [],
          }),
        )
        // Mes cours d'abord, puis le cours le plus récemment enregistré.
        .sort(
          (a, b) =>
            Number(b.deMaClasse) - Number(a.deMaClasse) ||
            (b.enregistrements[0]?.debut ?? "").localeCompare(a.enregistrements[0]?.debut ?? "") ||
            a.code.localeCompare(b.code),
        );
      const dto: MediathequeDto = { cours: liste };
      res.setHeader("Cache-Control", "no-store");
      res.json(dto);
    }),
  );

  /** Ouvrir la médiathèque d'un cours à tous les étudiants, ou la réserver aux classes du cours. */
  app.patch(
    "/api/cours/:id(\\d+)/mediatheque",
    exigerDroit("programme"),
    route(async (req, res) => {
      const u = moi(req);
      const [c] = await db.select().from(cours).where(eq(cours.id, idParam(req)));
      if (!c) throw introuvable("Cours");
      if (!(await peutReglerMediatheque(u, c.id))) {
        throw interdit("Ce cours est suivi par d'autres campus : seule la direction peut régler sa médiathèque.");
      }
      const { mediatheque } = valider(schemaReglage, req.body);
      if (mediatheque !== c.mediatheque) {
        await db.update(cours).set({ mediatheque, majLe: new Date() }).where(eq(cours.id, c.id));
        await db.insert(journal).values({ utilisateurId: u.id, action: "cours_mediatheque", details: { coursId: c.id, de: c.mediatheque, vers: mediatheque } });
      }
      const dto: ReglageMediathequeDto = { coursId: c.id, mediatheque, modifiable: true };
      res.json(dto);
    }),
  );
}
