// Replays dans le bucket Railway (compatible S3).
//
// Après le cours, Daily encode l'enregistrement ; le campus le recopie alors,
// en flux (jamais entier en mémoire ni sur le disque), dans le bucket des
// replays. Les étudiants lisent ensuite la vidéo directement dans le bucket,
// par un lien signé de quelques heures : l'application ne sert aucun octet de
// vidéo, et la sortie depuis un bucket Railway est gratuite. La copie Daily
// est effacée après un délai de sécurité (REPLAYS_GARDER_DAILY_JOURS).
import { Readable } from "node:stream";
import { S3Client, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "./config";

let client: S3Client | null = null;

/** Le bucket des replays est-il configuré ? */
export function stockageReplaysDisponible(): boolean {
  const r = config.replays;
  return Boolean(r.bucket && r.endpoint && r.cleId && r.cleSecrete);
}

function s3(): S3Client {
  if (!stockageReplaysDisponible()) throw new Error("Bucket des replays non configuré (REPLAYS_BUCKET, REPLAYS_ENDPOINT, REPLAYS_ACCESS_KEY_ID, REPLAYS_SECRET_ACCESS_KEY).");
  client ??= new S3Client({
    endpoint: config.replays.endpoint,
    region: config.replays.region,
    credentials: { accessKeyId: config.replays.cleId!, secretAccessKey: config.replays.cleSecrete! },
  });
  return client;
}

/**
 * Copie une vidéo depuis une adresse (lien de téléchargement Daily) vers le
 * bucket, en morceaux de 16 Mo (deux à la fois : ≈ 32 Mo de mémoire au plus).
 * Vérifie la taille reçue par le bucket avant de rendre la main.
 */
export async function copierVersBucket(source: string, cle: string): Promise<{ tailleOctets: number }> {
  const r = await fetch(source, { signal: AbortSignal.timeout(3 * 3600_000) });
  if (!r.ok || !r.body) throw new Error(`téléchargement refusé (HTTP ${r.status})`);
  const attendu = Number(r.headers.get("content-length")) || null;
  const envoi = new Upload({
    client: s3(),
    params: {
      Bucket: config.replays.bucket,
      Key: cle,
      Body: Readable.fromWeb(r.body as import("node:stream/web").ReadableStream),
      ContentType: r.headers.get("content-type")?.startsWith("video/") ? r.headers.get("content-type")! : "video/mp4",
    },
    partSize: 16 * 1024 * 1024,
    queueSize: 2,
    leavePartsOnError: false,
  });
  await envoi.done();
  const tete = await s3().send(new HeadObjectCommand({ Bucket: config.replays.bucket, Key: cle }));
  const recu = Number(tete.ContentLength ?? 0);
  if (!recu || (attendu && recu !== attendu)) {
    await supprimerDuBucket(cle).catch(() => undefined);
    throw new Error(`copie incomplète (${recu} octets reçus sur ${attendu ?? "?"})`);
  }
  return { tailleOctets: recu };
}

/** Lien de lecture signé, valable quelques heures (le lecteur le redemande au besoin). */
export async function lienReplayBucket(cle: string, validiteSecondes = 6 * 3600): Promise<{ url: string; expire: string }> {
  const url = await getSignedUrl(s3(), new GetObjectCommand({ Bucket: config.replays.bucket, Key: cle }), { expiresIn: validiteSecondes });
  return { url, expire: new Date(Date.now() + validiteSecondes * 1000).toISOString() };
}

export async function supprimerDuBucket(cle: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: config.replays.bucket, Key: cle }));
}
