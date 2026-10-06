// Ressources d'une séance : liens (YouTube ou autres) et fichiers (vidéos de
// l'ordinateur du formateur, PDF, documents) que le formateur dépose dans la
// préparation ou pendant le live. Étudiants et salles les ouvrent ou les
// téléchargent, pendant le cours et dans le replay.
//
// Projection : le formateur projette une vidéo en grand dans les salles, à la
// place de la diapo, et la pilote (lecture, pause, avance). L'état publié est
// une position valable à un instant du serveur : chaque écran avance depuis,
// et se recale quand l'écart dépasse quelques secondes.
import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { exigerConnexion, moi } from "../auth";
import { route, valider, idParam, introuvable, invalide } from "../http";
import { publier } from "../temps-reel";
import { enregistrerFichier, enregistrerGardienFichier, televersementRessource, urlFichier } from "../fichiers";
import { canal, seanceAnimee, seanceDuReplay } from "./live";
import { fichiers, ressourcesSeances, seances, type ProjectionDto, type ProjectionVideo, type RessourceSeance, type RessourceSeanceDto, type Seance } from "@shared/schema";

/** Au-delà, la liste ne se lit plus : 40 ressources par séance. */
const RESSOURCES_MAX = 40;

/** Identifiant d'une vidéo YouTube (watch, youtu.be, shorts, embed, live). */
export function idYoutube(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(url);
  return m ? m[1] : null;
}

const estVideo = (mime: string) => /^video\/(mp4|webm|quicktime)$/.test(mime);
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

function versDto(r: RessourceSeance, f: InfoFichier): RessourceSeanceDto | null {
  if (r.type === "youtube" || r.type === "lien") {
    if (!r.url) return null;
    const youtubeId = r.type === "youtube" ? idYoutube(r.url) : null;
    return { id: r.id, type: r.type, titre: r.titre || (youtubeId ? "Vidéo YouTube" : titreDuLien(r.url)), url: r.url, youtubeId, nom: null, mime: null, taille: null };
  }
  // Fichier supprimé entre-temps : la ressource disparaît de la liste.
  if (!r.fichierId || !f) return null;
  return { id: r.id, type: r.type, titre: r.titre || titreDuFichier(f.nom), url: urlFichier(r.fichierId), youtubeId: null, nom: f.nom, mime: f.mime, taille: Number(f.taille) };
}

/** Ressources de la séance, dans l'ordre choisi par le formateur. */
export async function ressourcesDe(seanceId: number): Promise<RessourceSeanceDto[]> {
  const lignes = await db
    .select({ r: ressourcesSeances, f: { nom: fichiers.nomOriginal, mime: fichiers.mime, taille: fichiers.taille } })
    .from(ressourcesSeances)
    .leftJoin(fichiers, eq(fichiers.id, ressourcesSeances.fichierId))
    .where(eq(ressourcesSeances.seanceId, seanceId))
    .orderBy(asc(ressourcesSeances.ordre), asc(ressourcesSeances.id));
  return lignes.flatMap(({ r, f }) => {
    const d = versDto(r, f?.nom ? (f as InfoFichier) : null);
    return d ? [d] : [];
  });
}

/** Vidéo projetée, avec sa ressource (null si la ressource a disparu). */
export async function projectionDe(s: Pick<Seance, "id" | "projection">): Promise<ProjectionDto | null> {
  const p = s.projection;
  if (!p) return null;
  const r = (await ressourcesDe(s.id)).find((x) => x.id === p.ressourceId && projetable(x));
  return r ? { ...p, ressource: r } : null;
}

/** Copie les ressources d'une séance dupliquée (mêmes liens, mêmes fichiers). */
export async function copierRessources(deId: number, versId: number, parId: number): Promise<void> {
  const lignes = await db.select().from(ressourcesSeances).where(eq(ressourcesSeances.seanceId, deId)).orderBy(asc(ressourcesSeances.ordre), asc(ressourcesSeances.id));
  if (!lignes.length) return;
  await db.insert(ressourcesSeances).values(lignes.map((r, i) => ({ seanceId: versId, type: r.type, titre: r.titre, url: r.url, fichierId: r.fichierId, ordre: i, creePar: parId })));
}

async function verifierPlace(seanceId: number, ajout: number) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(ressourcesSeances).where(eq(ressourcesSeances.seanceId, seanceId));
  if (n + ajout > RESSOURCES_MAX) throw invalide(`${RESSOURCES_MAX} ressources au plus par séance : retirez-en avant d'en ajouter.`);
}

async function prochainOrdre(seanceId: number): Promise<number> {
  const [{ m }] = await db.select({ m: sql<number>`coalesce(max(${ressourcesSeances.ordre}), -1)::int` }).from(ressourcesSeances).where(eq(ressourcesSeances.seanceId, seanceId));
  return m + 1;
}

async function ressourceDeLaSeance(seanceId: number, id: number): Promise<RessourceSeance> {
  const [r] = await db.select().from(ressourcesSeances).where(and(eq(ressourcesSeances.id, id), eq(ressourcesSeances.seanceId, seanceId)));
  if (!r) throw introuvable("Ressource");
  return r;
}

/** Les pages ouvertes relisent la séance (liste des ressources, projection éventuelle). */
const prevenirPages = (seanceId: number) => publier(canal(seanceId), "seance", null);

/** Avant de recevoir des fichiers : seul celui qui anime la séance dépose (rien n'est écrit sinon). */
const animateurAvantDepot: RequestHandler = (req, _res, next) => {
  seanceAnimee(moi(req), idParam(req)).then(
    () => next(),
    (e) => next(e),
  );
};

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
      const url = /^https?:\/\//i.test(d.url) ? d.url : `https://${d.url}`;
      let adresse: URL;
      try {
        adresse = new URL(url);
      } catch {
        throw invalide("Ce lien n'est pas valide : copiez l'adresse complète (https://…).");
      }
      if (!/^https?:$/.test(adresse.protocol) || !adresse.hostname.includes(".")) throw invalide("Ce lien n'est pas valide : copiez l'adresse complète (https://…).");
      await verifierPlace(s.id, 1);
      const youtube = idYoutube(url);
      const titre = d.titre || (youtube ? ((await titreYoutube(url)) ?? "") : titreDuLien(url));
      await db.insert(ressourcesSeances).values({ seanceId: s.id, type: youtube ? "youtube" : "lien", titre, url, ordre: await prochainOrdre(s.id), creePar: u.id });
      prevenirPages(s.id);
      res.status(201).json(await ressourcesDe(s.id));
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
      if (!recus.length) throw invalide("Choisissez au moins un fichier.");
      await verifierPlace(s.id, recus.length);
      let ordre = await prochainOrdre(s.id);
      for (const f of recus) {
        const fichier = await enregistrerFichier(u, f, "ressource");
        await db.insert(ressourcesSeances).values({
          seanceId: s.id,
          type: estVideo(f.mimetype) ? "video" : "fichier",
          titre: titreDuFichier(fichier.nomOriginal),
          fichierId: fichier.id,
          ordre: ordre++,
          creePar: u.id,
        });
      }
      prevenirPages(s.id);
      res.status(201).json(await ressourcesDe(s.id));
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
      await db.delete(ressourcesSeances).where(eq(ressourcesSeances.id, r.id));
      if (s.projection?.ressourceId === r.id) {
        await db.update(seances).set({ projection: null }).where(eq(seances.id, s.id));
        publier(canal(s.id), "projection", null);
      }
      prevenirPages(s.id);
      res.json(await ressourcesDe(s.id));
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

  // Projeter une vidéo dans les salles, la piloter, arrêter (ressourceId null).
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
      let projection: ProjectionVideo | null = null;
      if (d.ressourceId !== null) {
        const r = await ressourceDeLaSeance(s.id, d.ressourceId);
        if (r.type !== "youtube" && r.type !== "video") throw invalide("Seules les vidéos (YouTube ou fichier vidéo) se projettent.");
        // Nouvelle vidéo : elle part du début, en pause ; sinon on garde ce qui n'est pas précisé.
        const memeVideo = s.projection?.ressourceId === r.id;
        const actuelle = memeVideo && s.projection ? s.projection : null;
        const positionActuelle = actuelle ? (actuelle.lecture ? actuelle.position + (Date.now() - actuelle.horodatage) / 1000 : actuelle.position) : 0;
        projection = {
          ressourceId: r.id,
          lecture: d.lecture ?? actuelle?.lecture ?? false,
          position: Math.round((d.position ?? positionActuelle) * 10) / 10,
          horodatage: Date.now(),
        };
      }
      await db.update(seances).set({ projection }).where(eq(seances.id, s.id));
      const dto = projection ? await projectionDe({ id: s.id, projection }) : null;
      publier(canal(s.id), "projection", dto);
      res.json(dto);
    }),
  );
}
