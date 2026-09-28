// Buckets Railway (compatibles S3) du campus : un pour les fichiers déposés
// (cours, devoirs, copies, examens, diapos, photos), un pour les replays.
//
// Rien n'est jamais public : chaque lecture passe par le contrôle d'accès du
// campus, qui rend un lien signé de courte durée vers le bucket. Les octets
// vont du bucket au navigateur sans traverser l'application, et la sortie
// depuis un bucket Railway est gratuite.
import fs from "node:fs";
import { Readable } from "node:stream";
import { S3Client, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type ConfigBucket = { bucket?: string; endpoint?: string; region: string; cleId?: string; cleSecrete?: string };

export type Bucket = ReturnType<typeof creerBucket>;

export function creerBucket(conf: ConfigBucket, nom: string) {
  let client: S3Client | null = null;
  const disponible = () => Boolean(conf.bucket && conf.endpoint && conf.cleId && conf.cleSecrete);
  const s3 = () => {
    if (!disponible()) throw new Error(`Bucket « ${nom} » non configuré.`);
    client ??= new S3Client({ endpoint: conf.endpoint, region: conf.region, credentials: { accessKeyId: conf.cleId!, secretAccessKey: conf.cleSecrete! } });
    return client;
  };

  /** Taille de l'objet dans le bucket (null s'il n'y est pas). */
  async function taille(cle: string): Promise<number | null> {
    try {
      const t = await s3().send(new HeadObjectCommand({ Bucket: conf.bucket, Key: cle }));
      return Number(t.ContentLength ?? 0);
    } catch (e) {
      if ((e as { name?: string }).name === "NotFound" || (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
      throw e;
    }
  }

  /**
   * Envoie un flux vers le bucket en morceaux de 16 Mo (deux à la fois : ≈ 32 Mo
   * de mémoire au plus), puis vérifie la taille reçue. Une copie incomplète est
   * effacée et signalée.
   */
  async function envoyer(cle: string, corps: Readable | Buffer, type: string, attendu: number | null): Promise<number> {
    await new Upload({ client: s3(), params: { Bucket: conf.bucket, Key: cle, Body: corps, ContentType: type }, partSize: 16 * 1024 * 1024, queueSize: 2, leavePartsOnError: false }).done();
    const recu = await taille(cle);
    if (!recu || (attendu !== null && recu !== attendu)) {
      await supprimer(cle).catch(() => undefined);
      throw new Error(`copie incomplète dans « ${nom} » (${recu ?? 0} octets reçus sur ${attendu ?? "?"})`);
    }
    return recu;
  }

  /** Copie un fichier du disque vers le bucket (taille vérifiée). */
  async function envoyerFichierLocal(chemin: string, cle: string, type: string): Promise<number> {
    const { size } = await fs.promises.stat(chemin);
    return envoyer(cle, fs.createReadStream(chemin), type, size);
  }

  /** Copie une adresse (lien de téléchargement Daily) vers le bucket, en flux. */
  async function envoyerDepuisUrl(source: string, cle: string, typeParDefaut: string): Promise<number> {
    const r = await fetch(source, { signal: AbortSignal.timeout(3 * 3600_000) });
    if (!r.ok || !r.body) throw new Error(`téléchargement refusé (HTTP ${r.status})`);
    const type = r.headers.get("content-type") || typeParDefaut;
    return envoyer(cle, Readable.fromWeb(r.body as import("node:stream/web").ReadableStream), type, Number(r.headers.get("content-length")) || null);
  }

  /**
   * Lien de lecture signé. Type et nom de fichier sont gravés dans le lien : le
   * navigateur affiche le PDF ou propose « Cours n°1.pdf » au téléchargement.
   */
  async function lienSigne(cle: string, o: { validiteSecondes?: number; type?: string; nomFichier?: string; telecharger?: boolean } = {}): Promise<{ url: string; expire: string }> {
    const validite = o.validiteSecondes ?? 3600;
    const commande = new GetObjectCommand({
      Bucket: conf.bucket,
      Key: cle,
      ...(o.type && { ResponseContentType: o.type }),
      ...(o.nomFichier && { ResponseContentDisposition: `${o.telecharger ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(o.nomFichier)}` }),
    });
    const url = await getSignedUrl(s3(), commande, { expiresIn: validite });
    return { url, expire: new Date(Date.now() + validite * 1000).toISOString() };
  }

  /** Contenu entier (fichiers de taille raisonnable : correction par l'IA, PDF d'un profil). */
  async function lire(cle: string): Promise<Buffer> {
    const r = await s3().send(new GetObjectCommand({ Bucket: conf.bucket, Key: cle }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }

  async function supprimer(cle: string): Promise<void> {
    await s3().send(new DeleteObjectCommand({ Bucket: conf.bucket, Key: cle }));
  }

  /** Lecture directe par le navigateur (service worker hors ligne, lecteurs vidéo) : GET et HEAD depuis n'importe quelle page, les liens restant signés. */
  async function autoriserLectureNavigateur(): Promise<void> {
    await s3().send(
      new PutBucketCorsCommand({
        Bucket: conf.bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: ["*"],
              AllowedMethods: ["GET", "HEAD"],
              AllowedHeaders: ["*"],
              ExposeHeaders: ["Content-Length", "Content-Range", "Content-Type", "Content-Disposition", "Accept-Ranges"],
              MaxAgeSeconds: 86400,
            },
          ],
        },
      }),
    );
  }

  return { nom, disponible, taille, envoyerFichierLocal, envoyerDepuisUrl, lienSigne, lire, supprimer, autoriserLectureNavigateur };
}
