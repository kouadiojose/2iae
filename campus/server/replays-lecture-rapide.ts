// Replays à lecture immédiate.
//
// Les enregistrements de Daily sont des MP4 « fragmentés » : des milliers de petits morceaux, sans index en tête.
// Pour un cours de 4 h (9 Go), le lecteur du navigateur doit parcourir une grande partie du fichier avant d'afficher
// l'image : la vidéo « charge mais n'affiche rien » pendant plusieurs minutes. Cette tâche réécrit chaque replay du
// bucket avec l'index en tête (ffmpeg, -c copy : ni l'image ni le son ne sont réencodés, rien n'est perdu), un fichier
// à la fois, la nuit et jamais pendant un cours en direct.
//
// Sûreté : la version réécrite part sous une nouvelle clé ; elle n'est branchée sur le replay (replays_stockes.cle)
// qu'une fois vérifiée (taille, durée, index en tête), puis l'ancien fichier est effacé. Un échec laisse l'original.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db } from "./db";
import { planifier } from "./taches";
import { envoyerReplayLocal, lireDebutReplay, telechargerReplay, stockageReplaysDisponible, supprimerDuBucket } from "./stockage-replays";
import { replaysStockes, seances } from "@shared/schema";

/** Chemin du binaire ffmpeg (paquet ffmpeg-static), ou null s'il manque. */
function cheminFfmpeg(): string | null {
  try {
    const p = createRequire(import.meta.url)("ffmpeg-static") as string | null;
    return p && fs.existsSync(p) ? p : null;
  } catch {
    return null;
  }
}

const DOSSIER = process.env.RAILWAY_VOLUME_MOUNT_PATH ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, "lecture-rapide") : path.join(os.tmpdir(), "campus-lecture-rapide");
/** La tâche démarre un fichier quand aucun cours n'est en direct ni prévu dans les deux heures (sinon elle attend). */
const MARGE_AVANT_COURS_MS = 2 * 3600_000;
const echecs = new Map<string, number>();
let ffmpegVerifie = false;
let enCours = false;

/** Boîtes MP4 de premier niveau au début du fichier (« ftyp », « moov », « moof »…). */
export function boitesDeTete(tete: Buffer): string[] {
  const boites: string[] = [];
  let i = 0;
  while (i + 8 <= tete.length && boites.length < 8) {
    let taille = tete.readUInt32BE(i);
    boites.push(tete.toString("latin1", i + 4, i + 8));
    if (taille === 1 && i + 16 <= tete.length) taille = Number(tete.readBigUInt64BE(i + 8));
    if (taille < 8) break;
    i += taille;
  }
  return boites;
}

/** Lecture immédiate : l'index (« moov ») vient avant les données, sans fragments. */
export const lectureImmediate = (boites: string[]) => {
  const moov = boites.indexOf("moov");
  const mdat = boites.indexOf("mdat");
  return moov >= 0 && (mdat < 0 || moov < mdat) && !boites.includes("moof") && !boites.includes("styp");
};

/** ffmpeg ne se lance pas du tout sur ce serveur (binaire absent ou illisible) : la tâche s'arrête jusqu'au redémarrage. */
let ffmpegHorsService: string | null = null;

function lancer(ffmpeg: string, args: string[], delaiMs: number): Promise<{ code: number | null; sortie: string; lancement?: string }> {
  return new Promise((ok) => {
    let lancement: string | undefined;
    const p = spawn(ffmpeg, args, { stdio: ["ignore", "ignore", "pipe"] });
    p.on("error", (e) => (lancement = `${(e as NodeJS.ErrnoException).code ?? ""} ${e.message}`.trim()));
    try {
      if (p.pid) os.setPriority(p.pid, 15);
    } catch {
      /* priorité inchangée */
    }
    let sortie = "";
    p.stderr.on("data", (d: Buffer) => (sortie = (sortie + d.toString()).slice(-20_000)));
    const minuteur = setTimeout(() => p.kill("SIGKILL"), delaiMs);
    p.on("close", (code, signal) => {
      clearTimeout(minuteur);
      ok({ code, sortie: signal && !sortie ? `arrêté (${signal})` : sortie, lancement });
    });
  });
}

/** Durée (secondes) lue par ffmpeg dans un fichier local, ou null. */
async function duree(ffmpeg: string, fichier: string): Promise<number | null> {
  const { sortie } = await lancer(ffmpeg, ["-hide_banner", "-nostdin", "-i", fichier], 120_000);
  const m = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(sortie);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null;
}

const marquer = (id: string, valeurs: Partial<typeof replaysStockes.$inferInsert>) => db.update(replaysStockes).set(valeurs).where(eq(replaysStockes.enregistrementId, id));

/** Un passage : vérifie ou réécrit un replay. Renvoie un compte rendu pour le journal. */
export async function traiterUnReplay(o: { forcer?: boolean } = {}): Promise<string | null> {
  if (enCours || !stockageReplaysDisponible()) return null;
  const ffmpeg = cheminFfmpeg();
  if (!ffmpeg || ffmpegHorsService) return null;
  // Une fois par démarrage : ffmpeg se lance-t-il vraiment ici ?
  if (ffmpegHorsService === null && !ffmpegVerifie) {
    try {
      await fs.promises.chmod(ffmpeg, 0o755).catch(() => undefined);
    } catch {
      /* lecture seule */
    }
    const v = await lancer(ffmpeg, ["-hide_banner", "-version"], 30_000);
    if (v.code !== 0) {
      ffmpegHorsService = v.lancement ?? `code ${v.code} ${v.sortie.slice(0, 200)}`;
      return `ffmpeg ne se lance pas sur ce serveur (${ffmpegHorsService}) : réécriture des replays arrêtée`;
    }
    ffmpegVerifie = true;
    console.log(`[replays] ${v.sortie.split("\n")[0] || "ffmpeg prêt"} (réécriture des replays)`);
  }
  if (!o.forcer) {
    const [direct] = await db
      .select({ id: seances.id })
      .from(seances)
      .where(or(eq(seances.statut, "en_direct"), and(eq(seances.statut, "planifiee"), gte(seances.debut, new Date(Date.now() - 3600_000)), lte(seances.debut, new Date(Date.now() + MARGE_AVANT_COURS_MS)))))
      .limit(1);
    if (direct) return null;
  }
  // Les plus récents d'abord : ce sont les plus regardés.
  const candidats = await db.select().from(replaysStockes).where(isNull(replaysStockes.lectureRapide)).orderBy(desc(replaysStockes.archiveLe)).limit(20);
  const r = candidats.find((c) => (echecs.get(c.enregistrementId) ?? 0) < 3);
  if (!r) return null;
  enCours = true;
  const local = path.join(DOSSIER, `${randomUUID()}.mp4`);
  let sourceLocale: string | null = null;
  try {
    const tete = await lireDebutReplay(r.cle, 256 * 1024).catch(() => null);
    if (!tete) {
      echecs.set(r.enregistrementId, (echecs.get(r.enregistrementId) ?? 0) + 1);
      return `${r.cle} : illisible dans le bucket`;
    }
    if (tete.length === 0 || lectureImmediate(boitesDeTete(tete))) {
      await marquer(r.enregistrementId, { lectureRapide: true });
      return `${r.cle} : déjà en lecture immédiate`;
    }
    await fs.promises.mkdir(DOSSIER, { recursive: true });
    const libre = await fs.promises.statfs(DOSSIER).then((s) => s.bavail * s.bsize).catch(() => Infinity);
    if (libre < r.tailleOctets * 2.2 + 2e9) return `${r.cle} : pas assez de place sur le disque (${Math.round(libre / 1e9)} Go libres)`;

    // La vidéo est d'abord téléchargée sur le disque (en flux), puis réécrite sur place : ffmpeg ne lit rien par le réseau.
    const debut = Date.now();
    const source = path.join(DOSSIER, `${randomUUID()}-source.mp4`);
    sourceLocale = source;
    const recuSource = await telechargerReplay(r.cle, source);
    if (recuSource !== r.tailleOctets) throw new Error(`téléchargement incomplet (${recuSource} octets sur ${r.tailleOctets})`);
    const res = await lancer(
      ffmpeg,
      ["-hide_banner", "-nostdin", "-loglevel", "error", "-y", "-i", source, "-map", "0:v?", "-map", "0:a?", "-c", "copy", "-movflags", "+faststart", local],
      4 * 3600_000,
    );
    if (res.lancement) throw new Error(`ffmpeg ne se lance pas : ${res.lancement}`);
    if (res.code !== 0) throw new Error(`ffmpeg (code ${res.code}) : ${res.sortie.slice(-300)}`);
    const { size } = await fs.promises.stat(local);
    const d = await duree(ffmpeg, local);
    const teteLocale = Buffer.alloc(256 * 1024);
    const fd = await fs.promises.open(local, "r");
    const { bytesRead } = await fd.read(teteLocale, 0, teteLocale.length, 0);
    await fd.close();
    // Même contenu, rangé autrement : la taille bouge à peine (index regroupé, fragments supprimés).
    if (size < r.tailleOctets * 0.9 || size > r.tailleOctets * 1.05) throw new Error(`taille inattendue (${size} octets pour ${r.tailleOctets})`);
    if (!d || d < 1) throw new Error("durée illisible après réécriture");
    if (!lectureImmediate(boitesDeTete(teteLocale.subarray(0, bytesRead)))) throw new Error("index toujours absent du début du fichier");

    const nouvelleCle = r.cle.replace(/(\.mp4)?$/i, "-lr.mp4");
    const recu = await envoyerReplayLocal(local, nouvelleCle);
    await marquer(r.enregistrementId, { cle: nouvelleCle, tailleOctets: recu, lectureRapide: true });
    await supprimerDuBucket(r.cle).catch((e) => console.warn(`[replays] ancien fichier ${r.cle} non effacé :`, (e as Error).message));
    echecs.delete(r.enregistrementId);
    return `${r.cle} → lecture immédiate (${(size / 1e9).toFixed(2)} Go, ${Math.round(d / 60)} min de vidéo, ${Math.round((Date.now() - debut) / 60_000)} min de travail)`;
  } catch (e) {
    const n = (echecs.get(r.enregistrementId) ?? 0) + 1;
    echecs.set(r.enregistrementId, n);
    if (n >= 3) await marquer(r.enregistrementId, { lectureRapide: false }).catch(() => undefined);
    return `${r.cle} : échec ${n}/3 : ${(e as Error).message}`;
  } finally {
    await fs.promises.rm(local, { force: true }).catch(() => undefined);
    if (sourceLocale) await fs.promises.rm(sourceLocale, { force: true }).catch(() => undefined);
    enCours = false;
  }
}

// Au démarrage : les fichiers d'un travail interrompu (redémarrage du campus en pleine réécriture) sont effacés.
void fs.promises.rm(DOSSIER, { recursive: true, force: true }).catch(() => undefined);

// Toutes les 10 minutes : les fichiers un par un (un cours de 4 h prend quelques minutes de travail).
if (process.env.REPLAYS_LECTURE_RAPIDE !== "non") {
  planifier("replays-lecture-rapide", 10 * 60_000, async () => {
    // Un fichier après l'autre tant que l'heure le permet (chaque fichier revérifie l'heure et les cours en direct).
    for (let i = 0; i < 300; i++) {
      const compteRendu = await traiterUnReplay();
      if (!compteRendu) return;
      console.log(`[replays] ${compteRendu}`);
    }
  });
}
