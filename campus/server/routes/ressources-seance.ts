// Ressources d'une séance : liens (YouTube ou autres) et fichiers (vidéos de
// l'ordinateur du formateur, PDF, documents) que le formateur dépose dans la
// préparation ou pendant le live. Étudiants et salles les ouvrent ou les
// téléchargent, pendant le cours et dans le replay.
//
// Projection : le formateur projette une vidéo en grand dans les salles, à la
// place de la diapo, et la pilote (lecture, pause, avance). L'état publié est
// une position valable à un instant du serveur : chaque écran avance depuis,
// et se recale quand l'écart dépasse quelques secondes.
//
// Le chargé du campus (compte de campus, routes/espace-campus.ts) ajoute lui aussi des vidéos à la séance du jour de
// ses cours (José, 15 octobre 2026 à 5 h) : mêmes écritures (ajouterLien, ajouterFichiersRessource, projeter), sous
// ses propres routes et ses propres contrôles. Ses ajouts portent « Ajoutée par le campus de … » (ajoutePar).
import type { Express, RequestHandler } from "express";
import fs from "fs";
import { z } from "zod";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { exigerConnexion, moi } from "../auth";
import { route, valider, idParam, introuvable, invalide } from "../http";
import { publier } from "../temps-reel";
import { enregistrerFichier, enregistrerGardienFichier, televersementRessource, urlFichier } from "../fichiers";
import { canal, noterGesteAnimation, seanceAnimee, seanceDuReplay } from "./live";
import { etudiantsDuCours } from "../acces";
import { notifier } from "../notifications";
import { planifier } from "../taches";
import { finDeCopie, remplacerProjection } from "../projection-copies";
import { deCampus } from "@shared/espace-campus";
import {
  cours,
  fichiers,
  ressourcesSeances,
  seances,
  sites,
  utilisateurs,
  estProjectionCopie,
  estProfilCampus,
  type ProjectionDto,
  type ProjectionVideo,
  type RessourceSeance,
  type RessourceSeanceDto,
  type Seance,
  type Utilisateur,
} from "@shared/schema";

/** Au-delà, la liste ne se lit plus : 40 ressources par séance. */
const RESSOURCES_MAX = 40;

/** Les seuls hôtes de YouTube (« exemple-piege.com/youtube.com/watch?v=… » n'en est pas un : relecture du 15 octobre 2026). */
const HOTES_YOUTUBE = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
  "www.youtu.be",
]);
const ID_YOUTUBE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Identifiant d'une vidéo YouTube (watch, youtu.be, shorts, embed, live), lu sur l'adresse analysée : protocole http(s),
 * hôte de YouTube, sans identifiants ni port ; null sinon.
 */
export function idYoutube(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password || u.port) return null;
  const hote = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!HOTES_YOUTUBE.has(hote)) return null;
  if (hote === "youtu.be" || hote === "www.youtu.be") {
    const id = u.pathname.split("/")[1] ?? "";
    return ID_YOUTUBE.test(id) ? id : null;
  }
  if (u.pathname.replace(/\/+$/, "") === "/watch") {
    const v = u.searchParams.get("v") ?? "";
    return ID_YOUTUBE.test(v) ? v : null;
  }
  const m = /^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/.exec(u.pathname);
  return m ? m[1] : null;
}

/** Adresse canonique d'une vidéo YouTube : jamais l'adresse saisie (compte de campus). */
export const adresseYoutube = (id: string) => `https://www.youtube.com/watch?v=${id}`;

export const estVideo = (mime: string) => /^video\/(mp4|webm|quicktime)$/.test(mime);
const projetable = (r: Pick<RessourceSeanceDto, "type">) => r.type === "youtube" || r.type === "video";

/** « cours-marketing-chapitre-2.pdf » → « cours-marketing-chapitre-2 » (le titre se modifie ensuite). */
const titreDuFichier = (nom: string) => nom.replace(/\.[a-z0-9]{1,6}$/i, "").slice(0, 200);

/** Titre d'un lien sans titre : le site et le chemin, lisibles. */
function titreDuLien(url: string): string {
  try {
    const u = new URL(url);
    const chemin = decodeURIComponent(u.pathname).replace(/\/+$/, "");
    return `${u.hostname.replace(/^www\./, "")}${chemin && chemin !== "/" ? chemin : ""}`.slice(0, 200);
  } catch {
    return url.slice(0, 200);
  }
}

/** Titre d'une vidéo YouTube (page oEmbed publique), sinon null : le formateur pourra le saisir. */
async function titreYoutube(url: string): Promise<string | null> {
  try {
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { title?: string };
    return j.title?.trim().slice(0, 200) || null;
  } catch {
    return null;
  }
}

type InfoFichier = { nom: string; mime: string; taille: number } | null;

function versDto(r: RessourceSeance, f: InfoFichier, ajoutePar: string | null = null): RessourceSeanceDto | null {
  if (r.type === "youtube" || r.type === "lien") {
    if (!r.url) return null;
    const youtubeId = r.type === "youtube" ? idYoutube(r.url) : null;
    return { id: r.id, type: r.type, titre: r.titre || (youtubeId ? "Vidéo YouTube" : titreDuLien(r.url)), url: r.url, youtubeId, nom: null, mime: null, taille: null, ajoutePar };
  }
  // Fichier supprimé entre-temps : la ressource disparaît de la liste.
  if (!r.fichierId || !f) return null;
  return { id: r.id, type: r.type, titre: r.titre || titreDuFichier(f.nom), url: urlFichier(r.fichierId), youtubeId: null, nom: f.nom, mime: f.mime, taille: Number(f.taille), ajoutePar };
}

/** Ressources de la séance, dans l'ordre choisi par le formateur (« Campus de Yamoussoukro » : ajoutée par un compte de campus). */
export async function ressourcesDe(seanceId: number): Promise<RessourceSeanceDto[]> {
  const lignes = await db
    .select({
      r: ressourcesSeances,
      f: { nom: fichiers.nomOriginal, mime: fichiers.mime, taille: fichiers.taille },
      auteur: { role: utilisateurs.role, profil: utilisateurs.profil },
      site: sites.nomCourt,
    })
    .from(ressourcesSeances)
    .leftJoin(fichiers, eq(fichiers.id, ressourcesSeances.fichierId))
    .leftJoin(utilisateurs, eq(utilisateurs.id, ressourcesSeances.creePar))
    .leftJoin(sites, eq(sites.id, utilisateurs.siteId))
    .where(eq(ressourcesSeances.seanceId, seanceId))
    .orderBy(asc(ressourcesSeances.ordre), asc(ressourcesSeances.id));
  return lignes.flatMap(({ r, f, auteur, site }) => {
    const parCampus = auteur?.role && estProfilCampus(auteur) && site ? `Campus ${deCampus(site)}` : null;
    const d = versDto(r, f?.nom ? (f as InfoFichier) : null, parCampus);
    return d ? [d] : [];
  });
}

/** Vidéo projetée, avec sa ressource (null si la ressource a disparu). */
export async function projectionDe(s: Pick<Seance, "id" | "projection">): Promise<ProjectionDto | null> {
  const p = s.projection;
  // Une copie d'étudiant projetée n'est pas une vidéo : la classe la reçoit par « copie » (projection-copies.ts).
  if (!p || estProjectionCopie(p)) return null;
  const r = (await ressourcesDe(s.id)).find((x) => x.id === p.ressourceId && projetable(x));
  return r ? { ...p, ressource: r } : null;
}

/** Copie les ressources d'une séance dupliquée (mêmes liens, mêmes fichiers ; déjà connues : pas d'annonce). */
export async function copierRessources(deId: number, versId: number, parId: number): Promise<void> {
  const lignes = await db.select().from(ressourcesSeances).where(eq(ressourcesSeances.seanceId, deId)).orderBy(asc(ressourcesSeances.ordre), asc(ressourcesSeances.id));
  if (!lignes.length) return;
  const annonceeLe = new Date();
  await db.insert(ressourcesSeances).values(lignes.map((r, i) => ({ seanceId: versId, type: r.type, titre: r.titre, url: r.url, fichierId: r.fichierId, ordre: i, creePar: parId, annonceeLe })));
}

async function verifierPlace(seanceId: number, ajout: number) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(ressourcesSeances).where(eq(ressourcesSeances.seanceId, seanceId));
  if (n + ajout > RESSOURCES_MAX) throw invalide(`${RESSOURCES_MAX} ressources au plus par séance : retirez-en avant d'en ajouter.`);
}

async function prochainOrdre(seanceId: number): Promise<number> {
  const [{ m }] = await db.select({ m: sql<number>`coalesce(max(${ressourcesSeances.ordre}), -1)::int` }).from(ressourcesSeances).where(eq(ressourcesSeances.seanceId, seanceId));
  return m + 1;
}

export async function ressourceDeLaSeance(seanceId: number, id: number): Promise<RessourceSeance> {
  const [r] = await db.select().from(ressourcesSeances).where(and(eq(ressourcesSeances.id, id), eq(ressourcesSeances.seanceId, seanceId)));
  if (!r) throw introuvable("Ressource");
  return r;
}

/** Les pages ouvertes relisent la séance (liste des ressources, projection éventuelle). */
const prevenirPages = (seanceId: number) => publier(canal(seanceId), "seance", null);

const LIEN_INVALIDE = "Ce lien n'est pas valide : copiez l'adresse complète (https://…).";
const PAS_YOUTUBE = "Ce lien n'est pas YouTube. Collez un lien YouTube.";
const PAS_VIDEO = "Ce fichier n'est pas une vidéo. Choisissez un MP4.";

/**
 * Ajoute un lien (YouTube ou autre) à la séance : route du formateur, et vidéo YouTube du chargé du campus
 * (`youtubeSeulement` : tout autre lien est refusé). Les pages ouvertes relisent la séance.
 */
export async function ajouterLien(
  s: Pick<Seance, "id">,
  u: Pick<Utilisateur, "id">,
  brut: string,
  { titre, youtubeSeulement = false }: { titre?: string; youtubeSeulement?: boolean } = {},
): Promise<{ ressource: RessourceSeance; ressources: RessourceSeanceDto[] }> {
  const url = /^https?:\/\//i.test(brut) ? brut : `https://${brut}`;
  let adresse: URL;
  try {
    adresse = new URL(url);
  } catch {
    throw invalide(youtubeSeulement ? PAS_YOUTUBE : LIEN_INVALIDE);
  }
  if (!/^https?:$/.test(adresse.protocol) || !adresse.hostname.includes(".")) throw invalide(youtubeSeulement ? PAS_YOUTUBE : LIEN_INVALIDE);
  const youtube = idYoutube(url);
  if (youtubeSeulement && !youtube) throw invalide(PAS_YOUTUBE);
  // Compte de campus : l'adresse canonique de la vidéo, jamais l'adresse saisie.
  const enregistree = youtubeSeulement && youtube ? adresseYoutube(youtube) : url;
  await verifierPlace(s.id, 1);
  const titreFinal = titre || (youtube ? ((await titreYoutube(enregistree)) ?? "") : titreDuLien(url));
  const [ressource] = await db
    .insert(ressourcesSeances)
    .values({ seanceId: s.id, type: youtube ? "youtube" : "lien", titre: titreFinal, url: enregistree, ordre: await prochainOrdre(s.id), creePar: u.id })
    .returning();
  prevenirPages(s.id);
  return { ressource, ressources: await ressourcesDe(s.id) };
}

/**
 * Enregistre des fichiers reçus (multer) comme ressources de la séance : route du formateur (vidéos et documents), et
 * vidéos du chargé du campus (`videosSeulement`). Refus (place, format) : les fichiers reçus sont effacés du disque.
 */
export async function ajouterFichiersRessource(
  s: Pick<Seance, "id">,
  u: Utilisateur,
  recus: Express.Multer.File[],
  { videosSeulement = false }: { videosSeulement?: boolean } = {},
): Promise<{ ajoutees: RessourceSeance[]; ressources: RessourceSeanceDto[] }> {
  const nettoyer = () => Promise.all(recus.map((f) => fs.promises.rm(f.path, { force: true })));
  if (!recus.length) throw invalide(videosSeulement ? PAS_VIDEO : "Choisissez au moins un fichier.");
  if (videosSeulement && recus.some((f) => !estVideo(f.mimetype))) {
    await nettoyer();
    throw invalide(PAS_VIDEO);
  }
  try {
    await verifierPlace(s.id, recus.length);
  } catch (e) {
    await nettoyer();
    throw e;
  }
  let ordre = await prochainOrdre(s.id);
  const ajoutees: RessourceSeance[] = [];
  for (const f of recus) {
    const fichier = await enregistrerFichier(u, f, "ressource");
    const [r] = await db
      .insert(ressourcesSeances)
      .values({ seanceId: s.id, type: estVideo(f.mimetype) ? "video" : "fichier", titre: titreDuFichier(fichier.nomOriginal), fichierId: fichier.id, ordre: ordre++, creePar: u.id })
      .returning();
    ajoutees.push(r);
  }
  prevenirPages(s.id);
  return { ajoutees, ressources: await ressourcesDe(s.id) };
}

export type DemandeProjection = { ressourceId: number | null; lecture?: boolean; position?: number };

/**
 * Projette une vidéo de la séance dans les salles, la pilote, ou arrête (ressourceId null ; arrête aussi une copie
 * d'étudiant projetée). `geste` : la personne qui anime (formateur, régie) : projeter, c'est animer une classe ouverte
 * automatiquement (noterGesteAnimation) ; null pour le compte de campus, qui n'anime jamais.
 */
export async function projeter(s: Seance, d: DemandeProjection, { geste }: { geste: Utilisateur | null }): Promise<ProjectionDto | null> {
  // Projeter une vidéo, c'est animer (classe ouverte automatiquement que personne n'animait : live.ts) ; l'arrêter aussi.
  if (geste && s.statut === "en_direct") noterGesteAnimation(s, geste);
  let projection: ProjectionVideo | null = null;
  if (d.ressourceId !== null) {
    const r = await ressourceDeLaSeance(s.id, d.ressourceId);
    if (r.type !== "youtube" && r.type !== "video") throw invalide("Seules les vidéos (YouTube ou fichier vidéo) se projettent.");
    // Nouvelle vidéo : elle part du début, en pause ; sinon on garde ce qui n'est pas précisé.
    const memeVideo = !estProjectionCopie(s.projection) && s.projection?.ressourceId === r.id;
    const actuelle: ProjectionVideo | null = memeVideo && s.projection && !estProjectionCopie(s.projection) ? s.projection : null;
    const positionActuelle = actuelle ? (actuelle.lecture ? actuelle.position + (Date.now() - actuelle.horodatage) / 1000 : actuelle.position) : 0;
    projection = {
      ressourceId: r.id,
      lecture: d.lecture ?? actuelle?.lecture ?? false,
      position: Math.round((d.position ?? positionActuelle) * 10) / 10,
      horodatage: Date.now(),
    };
  }
  // Une copie en cours de préparation ne s'écrira pas par-dessus ce geste ; la projection d'avant est lue
  // dans la même transaction que l'écriture : une copie écrite juste avant est bien retirée (et annoncée).
  const ancienne = await remplacerProjection(s.id, projection);
  if (estProjectionCopie(ancienne)) await finDeCopie(s.id, ancienne, d.ressourceId === null ? "diapos" : "video");
  const dto = projection ? await projectionDe({ id: s.id, projection }) : null;
  publier(canal(s.id), "projection", dto);
  return dto;
}

/**
 * Retire une ressource de la séance (la projection s'arrête si c'était la vidéo projetée). Renvoie la ressource
 * retirée (pour le journal du compte de campus).
 */
export async function retirerRessource(s: Seance, r: RessourceSeance): Promise<RessourceSeanceDto[]> {
  await db.delete(ressourcesSeances).where(eq(ressourcesSeances.id, r.id));
  if (!estProjectionCopie(s.projection) && s.projection?.ressourceId === r.id) {
    await db.update(seances).set({ projection: null }).where(eq(seances.id, s.id));
    publier(canal(s.id), "projection", null);
  }
  prevenirPages(s.id);
  return ressourcesDe(s.id);
}

/** Avant de recevoir des fichiers : seul celui qui anime la séance dépose (rien n'est écrit sinon). */
const animateurAvantDepot: RequestHandler = (req, _res, next) => {
  seanceAnimee(moi(req), idParam(req)).then(
    () => next(),
    (e) => next(e),
  );
};

// ── Annonce aux étudiants ──────────────────────────────────────────────────

/** Délai après le dernier ajout d'une séance : un dépôt de cinq fichiers part en un seul message. */
const ATTENTE_ANNONCE = 2 * 60_000;

/**
 * Les vidéos et documents ajoutés à une séance partent aux étudiants du cours en une seule
 * notification par séance, deux minutes après le dernier ajout. Avant ou après le cours, elle
 * sonne sur le téléphone (règles du téléphone : plafond du jour, rien la nuit) ; pendant le
 * direct, elle reste dans la cloche, la classe les voit déjà à l'écran.
 */
export async function annoncerRessources(maintenant = Date.now()): Promise<number> {
  const enAttente = await db
    .select({ id: ressourcesSeances.id, seanceId: ressourcesSeances.seanceId, creeLe: ressourcesSeances.creeLe })
    .from(ressourcesSeances)
    .where(isNull(ressourcesSeances.annonceeLe));
  const parSeance = new Map<number, typeof enAttente>();
  for (const r of enAttente) parSeance.set(r.seanceId, [...(parSeance.get(r.seanceId) ?? []), r]);
  let annonces = 0;
  for (const [seanceId, lignes] of parSeance) {
    if (maintenant - Math.max(...lignes.map((l) => l.creeLe.getTime())) < ATTENTE_ANNONCE) continue;
    // Marquées d'abord : deux passages simultanés n'envoient pas deux fois.
    const marquees = await db
      .update(ressourcesSeances)
      .set({ annonceeLe: new Date(maintenant) })
      .where(and(inArray(ressourcesSeances.id, lignes.map((l) => l.id)), isNull(ressourcesSeances.annonceeLe)))
      .returning({ titre: ressourcesSeances.titre, ordre: ressourcesSeances.ordre });
    if (!marquees.length) continue;
    const [s] = await db
      .select({ id: seances.id, titre: seances.titre, statut: seances.statut, coursId: seances.coursId, code: cours.code, statutCours: cours.statut })
      .from(seances)
      .innerJoin(cours, eq(cours.id, seances.coursId))
      .where(eq(seances.id, seanceId));
    if (!s || s.statut === "annulee" || s.statutCours !== "publie") continue;
    const etudiants = (await etudiantsDuCours(s.coursId)).map((e) => e.id);
    if (!etudiants.length) continue;
    const titres = marquees.sort((a, b) => a.ordre - b.ordre).map((r) => `« ${r.titre} »`);
    const liste = titres.join(", ");
    await notifier(etudiants, {
      type: "cours",
      titre: marquees.length === 1 ? `Nouvelle ressource · ${s.code}` : `${marquees.length} nouvelles ressources · ${s.code}`,
      corps: `${s.titre} : ${liste.length > 160 ? `${liste.slice(0, 157)}…` : liste}`,
      lien: s.statut === "terminee" ? `/replays/${s.id}` : `/live/${s.id}`,
      push: s.statut !== "en_direct",
    });
    annonces++;
  }
  return annonces;
}

planifier("ressources-seances-annonces", 60_000, async () => {
  await annoncerRessources();
});

export function enregistrerRessourcesSeance(app: Express) {
  // Fichiers des ressources : lisibles par ceux qui voient la séance ou son replay (salles comprises).
  enregistrerGardienFichier("ressource", async (u, f) => {
    const lignes = await db.select({ seanceId: ressourcesSeances.seanceId }).from(ressourcesSeances).where(eq(ressourcesSeances.fichierId, f.id));
    for (const l of lignes) {
      try {
        await seanceDuReplay(u, l.seanceId);
        return true;
      } catch {
        /* séance suivante */
      }
    }
    return false;
  });

  // Ajouter un lien (YouTube ou autre).
  app.post(
    "/api/seances/:id(\\d+)/ressources",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const s = await seanceAnimee(u, idParam(req));
      const d = valider(z.object({ url: z.string().trim().min(4, "collez le lien").max(2000, "lien trop long"), titre: z.string().trim().max(200).optional() }), req.body);
      const { ressources } = await ajouterLien(s, u, d.url, { titre: d.titre });
      res.status(201).json(ressources);
    }),
  );

  // Déposer des fichiers (vidéos de l'ordinateur, PDF, documents), dix à la fois.
  app.post(
    "/api/seances/:id(\\d+)/ressources/fichiers",
    exigerConnexion,
    animateurAvantDepot,
    televersementRessource.array("fichiers", 10),
    route(async (req, res) => {
      const u = moi(req);
      const s = await seanceAnimee(u, idParam(req));
      const recus = (req.files as Express.Multer.File[] | undefined) ?? [];
      const { ressources } = await ajouterFichiersRessource(s, u, recus);
      res.status(201).json(ressources);
    }),
  );

  // Renommer.
  app.patch(
    "/api/seances/:id(\\d+)/ressources/:rid(\\d+)",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const s = await seanceAnimee(u, idParam(req));
      const r = await ressourceDeLaSeance(s.id, idParam(req, "rid"));
      const d = valider(z.object({ titre: z.string().trim().min(1, "indiquez un titre").max(200, "200 caractères au plus") }), req.body);
      await db.update(ressourcesSeances).set({ titre: d.titre }).where(eq(ressourcesSeances.id, r.id));
      prevenirPages(s.id);
      res.json(await ressourcesDe(s.id));
    }),
  );

  // Retirer (la projection s'arrête si c'était la vidéo projetée).
  app.delete(
    "/api/seances/:id(\\d+)/ressources/:rid(\\d+)",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const s = await seanceAnimee(u, idParam(req));
      const r = await ressourceDeLaSeance(s.id, idParam(req, "rid"));
      res.json(await retirerRessource(s, r));
    }),
  );

  // Changer l'ordre.
  app.put(
    "/api/seances/:id(\\d+)/ressources/ordre",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const s = await seanceAnimee(u, idParam(req));
      const { ordre } = valider(z.object({ ordre: z.array(z.number().int().positive()).max(RESSOURCES_MAX) }), req.body);
      const lignes = ordre.length ? await db.select({ id: ressourcesSeances.id }).from(ressourcesSeances).where(and(eq(ressourcesSeances.seanceId, s.id), inArray(ressourcesSeances.id, ordre))) : [];
      const valides = new Set(lignes.map((l) => l.id));
      let i = 0;
      for (const id of ordre) if (valides.has(id)) await db.update(ressourcesSeances).set({ ordre: i++ }).where(eq(ressourcesSeances.id, id));
      prevenirPages(s.id);
      res.json(await ressourcesDe(s.id));
    }),
  );

  // Projeter une vidéo dans les salles, la piloter, arrêter (ressourceId null). Arrête aussi une copie
  // d'étudiant projetée (« Revenir aux diapos » passe par ici : un seul chemin pour tous les retours).
  app.post(
    "/api/seances/:id(\\d+)/projection",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const s = await seanceAnimee(u, idParam(req));
      const d = valider(
        z.object({
          ressourceId: z.number().int().positive().nullable(),
          lecture: z.boolean().optional(),
          position: z.number().min(0).max(24 * 3600).optional(),
        }),
        req.body,
      );
      res.json(await projeter(s, d, { geste: u }));
    }),
  );
}
