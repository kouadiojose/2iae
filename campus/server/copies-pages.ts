// Lecture d'une copie de dépôt en pages (chantier K2 de la correction automatique, décision de José du
// 8 octobre 2026) : ce que l'IA lit d'une copie, pour la correction par le campus (server/correction-auto.ts)
// et pour la proposition demandée par le formateur (POST /api/rendus/:id/proposition-ia).
//
//   - photos JPEG, PNG, WebP, GIF : gardées telles quelles si elles sont déjà légères (le téléphone les réduit
//     à 1600 px avant l'envoi, client/src/lib/api.ts) ; sinon réduites à LARGEUR_PAGE_IA px, JPEG qualité 78
//     (un JPEG est enveloppé dans un PDF d'une page, sans être décodé, puis rendu par pdftoppm : remis droit
//     d'après son orientation EXIF) ; HEIC par heif-convert s'il est installé, sinon « format » ;
//   - PDF : une page JPEG par page, par pdftoppm (comme les diapos, routes/live.ts) ; sans pdftoppm, le PDF
//     part tel quel (l'API et la routine du soir le lisent) ;
//   - Word, Excel, PowerPoint, OpenDocument : LibreOffice en PDF (profil jetable, une conversion à la fois),
//     puis pdftoppm ;
//   - fichiers texte : ajoutés au texte saisi (au-delà de TEXTE_MAX caractères, la coupe est signalée) ;
//   - vidéos et sons : comptés, jamais lus : une copie qui en contient, même avec du texte ou des photos, est
//     relue par le formateur (lectureComplete) ; zip et le reste : « non lus ».
// Au plus PAGES_MAX_PAR_COPIE pages : les suivantes sont comptées (pagesEnTrop). Rien ne lève d'erreur pour
// un fichier : ce qui ne se lit pas (outil absent, fichier abîmé, trop lourd, conversion trop longue, bucket
// qui ne répond pas) est rendu dans « nonLus », et la correction automatique ne publie jamais la note d'une
// copie lue en partie (un fichier momentanément illisible, « indisponible », fait réessayer la copie).
//
// Les outils (LibreOffice, pdftoppm, pdfinfo, heif-convert) lisent des fichiers d'étudiants sans regard humain :
// ils tournent avec un environnement minimal (aucun secret du campus), un dossier personnel et temporaire
// jetables, des délais, et un budget de temps par copie ; aucune ressource liée d'un document piégé n'est
// demandée au réseau (proxy sans issue : pas de requête vers le réseau privé de Railway ni vers Internet).
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { lireContenuFichier } from "./fichiers";
import { LARGEUR_PAGE_IA, PAGES_MAX_PAR_COPIE } from "@shared/engagement/corrections";
import type { Fichier, RaisonNonProjetable, RotationCopie } from "@shared/schema";

const executer = promisify(execFile);

/** Une page lue (image en base64), avec le fichier d'où elle vient (rang dans la copie, à partir de 1). */
export type PageLue = { mime: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; base64: string; fichier: number; nom: string; page: number | null };
/** PDF envoyé tel quel (pdftoppm absent du serveur). */
export type DocumentLu = { base64: string; fichier: number; nom: string };
/**
 * format : jamais lu par le campus ; erreur : fichier abîmé ; taille : trop lourd, ou texte coupé ; delai : budget
 * de conversion de la copie épuisé ; indisponible : le bucket (ou le volume) n'a pas rendu le fichier, la copie
 * sera réessayée (correction-auto.ts).
 */
export type RaisonNonLu = "format" | "erreur" | "taille" | "delai" | "indisponible";
/** « fichier » : rang dans la copie, à partir de 1 ; 0 pour le texte saisi (coupé). */
export type FichierNonLu = { fichier: number; nom: string; genre: string; raison: RaisonNonLu };

export type CopieLue = {
  /** Texte saisi par l'étudiant, puis le contenu de ses fichiers texte. */
  texte: string;
  pages: PageLue[];
  documents: DocumentLu[];
  /** Fichiers que le campus n'a pas pu lire (hors vidéos et sons). */
  nonLus: FichierNonLu[];
  videos: number;
  audios: number;
  /** Pages (ou fichiers entiers) non lues au-delà de PAGES_MAX_PAR_COPIE. */
  pagesEnTrop: number;
};

/** Texte gardé (saisi et fichiers texte) : au-delà, il est coupé, et la coupe est signalée (lecture incomplète). */
export const TEXTE_MAX = 30_000;
/** Photo gardée telle quelle : déjà à la bonne taille, droite, et légère. */
const JPEG_TEL_QUEL_OCTETS = 700 * 1024;
/** PNG, WebP, GIF gardés tels quels jusqu'à ce poids (au-delà : réduits si LibreOffice est là). */
const IMAGE_TELLE_QUELLE_OCTETS = 1200 * 1024;
/** Limite des images de l'API d'Anthropic : au-delà, une image non réduite n'est pas envoyée. */
const IMAGE_MAX_OCTETS = 5 * 1024 * 1024;
/** PDF envoyés tels quels (sans pdftoppm) : deux de 10 Mo au plus, comme avant. */
const DOCUMENTS_MAX = 2;
const DOCUMENT_MAX_OCTETS = 10 * 1024 * 1024;
const QUALITE_JPEG = 78;
/** Conversions d'une copie (LibreOffice, pdftoppm, heif-convert) : au-delà, les fichiers suivants ne sont pas lus. */
const BUDGET_CONVERSIONS_MS = 120_000;
/** Délai d'une conversion LibreOffice d'un fichier d'étudiant. */
const DELAI_OFFICE_MS = 60_000;

/** Proxy sans issue (port « discard », rien n'y répond) : toute requête d'un outil vers le réseau échoue aussitôt. */
const PROXY_MORT = "http://127.0.0.1:9";

/**
 * Environnement des outils : rien de celui du campus (base, clés, jeton de la routine) ; un dossier personnel et
 * un dossier temporaire jetables (effacés avec la copie), en UTF-8 ; et un proxy sans issue, pour qu'aucun lien
 * d'un fichier piégé ne fasse sortir une requête (réseau privé de Railway ou Internet).
 */
const environnementOutil = (dossier: string): NodeJS.ProcessEnv => ({
  PATH: process.env.PATH || "/usr/local/bin:/usr/bin:/bin",
  HOME: dossier,
  TMPDIR: dossier,
  LANG: "C.UTF-8",
  LC_ALL: "C.UTF-8",
  http_proxy: PROXY_MORT,
  https_proxy: PROXY_MORT,
  ftp_proxy: PROXY_MORT,
  all_proxy: PROXY_MORT,
  HTTP_PROXY: PROXY_MORT,
  HTTPS_PROXY: PROXY_MORT,
  ALL_PROXY: PROXY_MORT,
  no_proxy: "",
  NO_PROXY: "",
});

const reglage = (chemin: string, nom: string, valeur: string | number | boolean) =>
  `<item oor:path="${chemin}"><prop oor:name="${nom}" oor:op="fuse"><value>${valeur}</value></prop></item>`;

/**
 * Profil LibreOffice jetable : un document piégé (image « liée » à une adresse du réseau) ne fait sortir aucune
 * requête : proxy manuel sans issue (essai du 8 octobre 2026 : sans lui, une image liée d'un .odp est demandée
 * pendant la conversion ; le seul réglage BlockUntrustedRefererLinks ne l'empêche pas). Aucune macro.
 */
const REGLAGES_LIBREOFFICE = [
  `<?xml version="1.0" encoding="UTF-8"?>`,
  `<oor:items xmlns:oor="http://openoffice.org/2001/registry">`,
  reglage("/org.openoffice.Inet/Settings", "ooInetProxyType", 2),
  ...["HTTP", "HTTPS", "FTP"].flatMap((p) => [reglage("/org.openoffice.Inet/Settings", `ooInet${p}ProxyName`, "127.0.0.1"), reglage("/org.openoffice.Inet/Settings", `ooInet${p}ProxyPort`, 9)]),
  reglage("/org.openoffice.Inet/Settings", "ooInetNoProxy", ""),
  reglage("/org.openoffice.Office.Common/Security/Scripting", "BlockUntrustedRefererLinks", true),
  reglage("/org.openoffice.Office.Common/Security/Scripting", "MacroSecurityLevel", 3),
  reglage("/org.openoffice.Office.Common/Security/Scripting", "DisableMacrosExecution", true),
  `</oor:items>`,
].join("\n");

// ── Outils du serveur ──────────────────────────────────────────────────────

/** L'outil est-il installé ? (ENOENT : absent ; toute autre erreur, par exemple sur --version : présent). */
const detecter = (commande: string, args: string[]) =>
  new Promise<boolean>((fini) =>
    execFile(commande, args, { timeout: 60_000, env: environnementOutil(os.tmpdir()) }, (err) => fini(!err || (err as NodeJS.ErrnoException).code !== "ENOENT")),
  );

let outils: Promise<{ pdf: boolean; office: boolean; heic: boolean; pdfinfo: boolean }> | null = null;
/** Détectés une fois, au premier besoin (LibreOffice met quelques secondes à répondre la première fois). */
export function outilsDeLecture() {
  outils ??= Promise.all([detecter("pdftoppm", ["-v"]), detecter("soffice", ["--version"]), detecter("heif-convert", ["--version"]), detecter("pdfinfo", ["-v"])]).then(
    ([pdf, office, heic, pdfinfo]) => {
      if (!pdf || !office) console.warn(`[copies] ${!pdf ? "pdftoppm" : ""}${!pdf && !office ? " et " : ""}${!office ? "LibreOffice" : ""} absent(s) : certains fichiers des copies ne seront pas lus.`);
      return { pdf, office, heic, pdfinfo };
    },
  );
  return outils;
}

/**
 * Une conversion LibreOffice à la fois : il est gourmand en mémoire. Une tâche du direct (copie montrée à la
 * classe, projection-copies.ts) passe devant celles qui attendent, jamais devant celle qui tourne.
 */
type TacheOffice = { prioritaire: boolean; lancer: () => void };
const attenteOffice: TacheOffice[] = [];
let officeOccupe = false;
function suivanteOffice() {
  if (officeOccupe) return;
  const i = attenteOffice.findIndex((x) => x.prioritaire);
  const [tache] = attenteOffice.splice(i >= 0 ? i : 0, 1);
  if (!tache) return;
  officeOccupe = true;
  tache.lancer();
}
/** Une conversion LibreOffice à la fois ; une tâche du direct passe devant celles qui attendent (jamais devant celle qui tourne). */
export function dansFileOffice<T>(travail: () => Promise<T>, prioritaire = false): Promise<T> {
  return new Promise<T>((ok, ko) => {
    attenteOffice.push({
      prioritaire,
      lancer: () =>
        void travail()
          .then(ok, ko)
          .finally(() => {
            officeOccupe = false;
            suivanteOffice();
          }),
    });
    suivanteOffice();
  });
}

/** Temps restant d'un budget (au moins une seconde, au plus « max ») ; 0 s'il est épuisé. */
type Budget = (max: number) => number;

async function versPdfParLibreOffice(source: string, dossier: string, budget: Budget, o: { prioritaire?: boolean } = {}): Promise<string | null> {
  return dansFileOffice(async () => {
    const delai = budget(DELAI_OFFICE_MS);
    if (!delai) throw new Error("budget de conversion épuisé");
    const sortie = path.join(dossier, "pdf");
    await fs.promises.mkdir(sortie, { recursive: true });
    // Profil LibreOffice jetable (deux conversions ne se marchent pas dessus, rien ne traîne sur le disque),
    // qui ne suit aucun lien extérieur et n'exécute aucune macro.
    const profil = path.join(dossier, "profil");
    await fs.promises.mkdir(path.join(profil, "user"), { recursive: true });
    await fs.promises.writeFile(path.join(profil, "user", "registrymodifications.xcu"), REGLAGES_LIBREOFFICE);
    await executer("soffice", [`-env:UserInstallation=file://${profil}`, "--headless", "--norestore", "--convert-to", "pdf", "--outdir", sortie, source], {
      timeout: delai,
      env: environnementOutil(dossier),
    });
    const pdf = (await fs.promises.readdir(sortie)).find((n) => n.endsWith(".pdf"));
    return pdf ? path.join(sortie, pdf) : null;
  }, o.prioritaire);
}

/** Nombre de pages d'un PDF (pdfinfo), ou null s'il ne le dit pas. */
async function pagesDuPdf(chemin: string, budget: Budget): Promise<number | null> {
  const delai = budget(30_000);
  if (!delai) return null;
  try {
    const { stdout } = await executer("pdfinfo", [chemin], { timeout: delai, env: environnementOutil(path.dirname(chemin)) });
    const n = /^Pages:\s+(\d+)/m.exec(String(stdout));
    return n ? Number(n[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Pages premiere..derniere d'un PDF en JPEG (qualité 78). « reduire » : le plus grand côté ramené à
 * LARGEUR_PAGE_IA px ; sinon 72 points par pouce, soit un pixel par point (photo enveloppée, déjà assez petite).
 * « recadrage » (en pixels de l'image rendue) : seule cette partie de la page est rendue (le haut d'une copie
 * caché à la classe ne quitte jamais le serveur).
 */
async function rendrePages(
  pdf: string,
  dossier: string,
  premiere: number,
  derniere: number,
  budget: Budget,
  reduire = true,
  recadrage?: { y: number; largeur: number; hauteur: number },
): Promise<Buffer[]> {
  const delai = budget(120_000);
  if (!delai) throw new Error("budget de conversion épuisé");
  const sortie = await fs.promises.mkdtemp(path.join(dossier, `pages-${premiere}-`));
  const taille = reduire ? ["-scale-to", String(LARGEUR_PAGE_IA)] : ["-r", "72"];
  const coupe = recadrage ? ["-x", "0", "-y", String(recadrage.y), "-W", String(recadrage.largeur), "-H", String(recadrage.hauteur)] : [];
  await executer("pdftoppm", ["-jpeg", "-jpegopt", `quality=${QUALITE_JPEG}`, ...taille, ...coupe, "-f", String(premiere), "-l", String(derniere), pdf, path.join(sortie, "p")], {
    timeout: delai,
    env: environnementOutil(dossier),
  });
  const noms = (await fs.promises.readdir(sortie)).filter((n) => n.endsWith(".jpg"));
  // pdftoppm numérote p-1.jpg… ou p-01.jpg… selon le nombre de pages : tri par numéro.
  noms.sort((a, b) => Number(/(\d+)\.jpg$/.exec(a)?.[1] ?? 0) - Number(/(\d+)\.jpg$/.exec(b)?.[1] ?? 0));
  return Promise.all(noms.map((n) => fs.promises.readFile(path.join(sortie, n))));
}

// ── Images ─────────────────────────────────────────────────────────────────

type InfosJpeg = { largeur: number; hauteur: number; composantes: number; precision: number; orientation: number; adobe: boolean };

/** Orientation EXIF (1 à 8) lue dans un segment APP1 « Exif » ; 1 si absente ou illisible. */
function orientationExif(b: Buffer, debut: number, fin: number): number {
  const t = debut + 6; // après « Exif\0\0 » : en-tête TIFF
  if (t + 8 > fin) return 1;
  const le = b.toString("ascii", t, t + 2) === "II";
  if (!le && b.toString("ascii", t, t + 2) !== "MM") return 1;
  const u16 = (i: number) => (le ? b.readUInt16LE(i) : b.readUInt16BE(i));
  const u32 = (i: number) => (le ? b.readUInt32LE(i) : b.readUInt32BE(i));
  const ifd = t + u32(t + 4);
  if (ifd + 2 > fin) return 1;
  const n = u16(ifd);
  for (let k = 0; k < n; k++) {
    const e = ifd + 2 + k * 12;
    if (e + 12 > fin) break;
    if (u16(e) === 0x0112) {
      const v = u16(e + 8);
      return v >= 1 && v <= 8 ? v : 1;
    }
  }
  return 1;
}

/** Dimensions, couleurs et orientation d'un JPEG, lues dans ses en-têtes (sans décoder l'image). */
export function infosJpeg(b: Buffer): InfosJpeg | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let orientation = 1;
  let adobe = false;
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const m = b[i + 1];
    if (m === 0xff || m === 0x01 || (m >= 0xd0 && m <= 0xd8)) {
      i += m === 0xff ? 1 : 2;
      continue;
    }
    if (m === 0xd9 || m === 0xda) break;
    const longueur = b.readUInt16BE(i + 2);
    if (longueur < 2 || i + 2 + longueur > b.length) break;
    const debut = i + 4;
    const fin = i + 2 + longueur;
    if (m === 0xe1 && b.toString("ascii", debut, debut + 4) === "Exif") orientation = orientationExif(b, debut, fin);
    if (m === 0xee && b.toString("ascii", debut, debut + 5) === "Adobe") adobe = true;
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc && debut + 6 <= fin) {
      return { precision: b[debut], hauteur: b.readUInt16BE(debut + 1), largeur: b.readUInt16BE(debut + 3), composantes: b[debut + 5], orientation, adobe };
    }
    i = fin;
  }
  return null;
}

/** Largeur et hauteur d'un PNG, GIF ou WebP (en-têtes seulement), ou null. */
export function dimensionsImage(b: Buffer): { largeur: number; hauteur: number } | null {
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) return { largeur: b.readUInt32BE(16), hauteur: b.readUInt32BE(20) };
  if (b.length >= 10 && b.toString("ascii", 0, 3) === "GIF") return { largeur: b.readUInt16LE(6), hauteur: b.readUInt16LE(8) };
  if (b.length >= 30 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const bloc = b.toString("ascii", 12, 16);
    if (bloc === "VP8 ") return { largeur: b.readUInt16LE(26) & 0x3fff, hauteur: b.readUInt16LE(28) & 0x3fff };
    if (bloc === "VP8L") return { largeur: 1 + (((b[22] & 0x3f) << 8) | b[21]), hauteur: 1 + (((b[24] & 0x0f) << 10) | (b[23] << 2) | ((b[22] & 0xc0) >> 6)) };
    if (bloc === "VP8X") return { largeur: 1 + b.readUIntLE(24, 3), hauteur: 1 + b.readUIntLE(27, 3) };
  }
  return null;
}

/**
 * Matrice PDF (a b c d e f) qui pose l'image (l × h pixels) droite sur la page, d'après son orientation EXIF
 * (« la ligne 0 de l'image est le côté droit visible… », valeurs 1 à 8). Pour 5 à 8, la page est h × l.
 */
function matriceOrientation(o: number, l: number, h: number): number[] {
  switch (o) {
    case 2:
      return [-l, 0, 0, h, l, 0];
    case 3:
      return [-l, 0, 0, -h, l, h];
    case 4:
      return [l, 0, 0, -h, 0, h];
    case 5:
      return [0, -l, -h, 0, h, l];
    case 6:
      return [0, -l, h, 0, 0, l];
    case 7:
      return [0, l, h, 0, 0, 0];
    case 8:
      return [0, l, -h, 0, h, 0];
    default:
      return [l, 0, 0, h, 0, 0];
  }
}

/**
 * PDF d'une page qui contient le JPEG tel quel (filtre DCTDecode : rien n'est décodé ici), à un point par
 * pixel : pdftoppm le rend ensuite à la bonne taille et en qualité 78, sans bibliothèque d'images.
 */
export function pdfDuJpeg(jpeg: Buffer, j: InfosJpeg): Buffer {
  const { largeur: l, hauteur: h } = j;
  const [pl, ph] = j.orientation >= 5 ? [h, l] : [l, h];
  const espace = j.composantes === 1 ? "/DeviceGray" : j.composantes === 4 ? "/DeviceCMYK" : "/DeviceRGB";
  // Les JPEG CMJN d'Adobe sont enregistrés inversés.
  const decode = j.composantes === 4 && j.adobe ? " /Decode [1 0 1 0 1 0 1 0]" : "";
  const dessin = `q ${matriceOrientation(j.orientation, l, h).join(" ")} cm /Im0 Do Q`;
  const objets: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pl} ${ph}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
    Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${l} /Height ${h} /ColorSpace ${espace} /BitsPerComponent 8${decode} /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
      jpeg,
      Buffer.from("\nendstream"),
    ]),
    Buffer.from(`<< /Length ${Buffer.byteLength(dessin)} >>\nstream\n${dessin}\nendstream`),
  ];
  const morceaux: Buffer[] = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  let position = morceaux[0].length;
  const positions: number[] = [];
  objets.forEach((o, k) => {
    positions.push(position);
    const bloc = Buffer.concat([Buffer.from(`${k + 1} 0 obj\n`), o, Buffer.from("\nendobj\n")]);
    morceaux.push(bloc);
    position += bloc.length;
  });
  const xref = ["xref", `0 ${objets.length + 1}`, "0000000000 65535 f ", ...positions.map((p) => `${String(p).padStart(10, "0")} 00000 n `)].join("\n");
  morceaux.push(Buffer.from(`${xref}\ntrailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${position}\n%%EOF\n`));
  return Buffer.concat(morceaux);
}

// ── Lecture d'une copie ────────────────────────────────────────────────────

const MIMES_OFFICE = /^application\/(msword|rtf|vnd\.openxmlformats-officedocument\..+|vnd\.ms-excel|vnd\.ms-powerpoint|vnd\.oasis\.opendocument\..+)$/;
const EXTENSIONS_OFFICE = /\.(docx?|xlsx?|pptx?|ppsx?|odt|ods|odp|rtf)$/i;

type Genre = "jpeg" | "image" | "heic" | "pdf" | "office" | "texte" | "video" | "audio" | "autre";

export function genreDe(f: Pick<Fichier, "mime" | "nomOriginal">): Genre {
  const m = f.mime.toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg") return "jpeg";
  if (m === "image/png" || m === "image/webp" || m === "image/gif") return "image";
  if (m === "image/heic" || m === "image/heif" || /\.hei[cf]$/i.test(f.nomOriginal)) return "heic";
  if (m === "application/pdf") return "pdf";
  if (MIMES_OFFICE.test(m) || EXTENSIONS_OFFICE.test(f.nomOriginal)) return "office";
  if (/^text\/(plain|csv|markdown)$/.test(m)) return "texte";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  return "autre";
}

/** Libellé d'un fichier sans son nom (aucun nom de fichier, donc aucun nom d'étudiant, dans la demande à l'IA). */
export const LIBELLES_GENRE: Record<Genre, string> = {
  jpeg: "photo",
  image: "image",
  heic: "photo HEIC",
  pdf: "PDF",
  office: "document",
  texte: "fichier texte",
  video: "vidéo",
  audio: "enregistrement audio",
  autre: "fichier",
};

const contientDuSens = (texte: string) => /[\p{L}\p{N}]/u.test(texte);

/** La copie a-t-elle quelque chose à lire (texte, page ou document) ? */
export const copieLisible = (c: CopieLue) => contientDuSens(c.texte) || c.pages.length > 0 || c.documents.length > 0;
/**
 * Tout ce que l'étudiant a rendu a-t-il été lu ? Une vidéo ou un son joints peuvent porter une partie de la
 * réponse : le campus ne les regarde pas, la copie n'est donc jamais lue en entier (le formateur la note).
 */
export const lectureComplete = (c: CopieLue) => !c.nonLus.length && c.pagesEnTrop === 0 && !c.videos && !c.audios;

const pluriel = (n: number, mot: string, mots = `${mot}s`) => `${n} ${n > 1 ? mots : mot}`;

/** Ce que le campus n'a pas lu, pour le formateur (avec les noms des fichiers) ; null si la copie est lue en entier. */
export function resumeNonLus(c: CopieLue): string | null {
  const morceaux: string[] = [];
  if (c.videos) morceaux.push(`${pluriel(c.videos, "vidéo jointe", "vidéos jointes")}, que le campus ne regarde pas.`);
  if (c.audios) morceaux.push(`${pluriel(c.audios, "enregistrement audio joint", "enregistrements audio joints")}, que le campus n'écoute pas.`);
  const texte = c.nonLus.find((n) => n.fichier === 0);
  if (texte) morceaux.push(`Texte saisi coupé après ${TEXTE_MAX.toLocaleString("fr-FR")} caractères.`);
  const fichiersNonLus = c.nonLus.filter((n) => n.fichier !== 0);
  if (fichiersNonLus.length) {
    const raisons: Record<RaisonNonLu, string> = {
      format: "format non lu",
      taille: "trop lourd ou trop long",
      erreur: "illisible",
      delai: "conversion trop longue",
      indisponible: "momentanément illisible",
    };
    morceaux.push(`Fichiers non lus en entier : ${fichiersNonLus.map((n) => `${n.nom} (${raisons[n.raison]})`).join(", ")}.`);
  }
  if (c.pagesEnTrop) morceaux.push(`${pluriel(c.pagesEnTrop, "page")} au-delà des ${PAGES_MAX_PAR_COPIE} que le campus lit.`);
  return morceaux.length ? morceaux.join(" ") : null;
}

/** Ce que les seules informations des fichiers (type, nom) disent d'une copie, sans la lire. */
export type ApercuCopie = { videos: number; audios: number; jamaisLus: number; texteCoupe: boolean; aLire: boolean };

/**
 * Aperçu d'une copie sans lecture du bucket ni conversion (dès le dépôt, et en dernier contrôle avant de
 * publier) : vidéos, sons, fichiers d'un format que le campus ne lit jamais, texte trop long, et s'il y a
 * quelque chose à lire. Les HEIC et documents ne sont pas jugés ici (cela dépend des outils du serveur).
 */
export function apercuCopie(texte: string, liste: Pick<Fichier, "mime" | "nomOriginal">[]): ApercuCopie {
  const genres = liste.map(genreDe);
  const compte = (g: Genre) => genres.filter((x) => x === g).length;
  return {
    videos: compte("video"),
    audios: compte("audio"),
    jamaisLus: compte("autre"),
    texteCoupe: texte.trim().length > TEXTE_MAX,
    aLire: contientDuSens(texte) || genres.some((g) => g !== "video" && g !== "audio" && g !== "autre"),
  };
}

/** Ce que l'aperçu dit déjà que le campus ne lira pas (pour le formateur), ou null. */
export function resumeApercu(a: ApercuCopie): string | null {
  const morceaux: string[] = [];
  if (a.videos) morceaux.push(`${pluriel(a.videos, "vidéo jointe", "vidéos jointes")}, que le campus ne regarde pas.`);
  if (a.audios) morceaux.push(`${pluriel(a.audios, "enregistrement audio joint", "enregistrements audio joints")}, que le campus n'écoute pas.`);
  if (a.jamaisLus) morceaux.push(`${pluriel(a.jamaisLus, "fichier", "fichiers")} d'un format que le campus ne lit pas.`);
  if (a.texteCoupe) morceaux.push(`Texte saisi de plus de ${TEXTE_MAX.toLocaleString("fr-FR")} caractères.`);
  return morceaux.length ? morceaux.join(" ") : null;
}

/**
 * Lit une copie : texte saisi et fichiers, dans l'ordre de la copie. Les fichiers sont lus dans le bucket
 * (ou sur le volume) puis convertis dans un dossier temporaire, effacé à la fin.
 */
export async function lireCopie(texteSaisi: string, liste: Fichier[]): Promise<CopieLue> {
  const saisi = texteSaisi.trim();
  const copie: CopieLue = { texte: saisi.slice(0, TEXTE_MAX), pages: [], documents: [], nonLus: [], videos: 0, audios: 0, pagesEnTrop: 0 };
  // Texte coupé : la fin n'est pas lue (la note n'est pas publiée, le formateur relit).
  if (saisi.length > TEXTE_MAX) copie.nonLus.push({ fichier: 0, nom: "texte saisi", genre: "texte", raison: "taille" });
  if (!liste.length) return copie;
  const o = await outilsDeLecture();
  const dossier = await fs.promises.mkdtemp(path.join(os.tmpdir(), "copie-"));
  const reste = () => PAGES_MAX_PAR_COPIE - copie.pages.length;
  const limite = Date.now() + BUDGET_CONVERSIONS_MS;
  const budget: Budget = (max) => {
    const restant = limite - Date.now();
    return restant < 1000 ? 0 : Math.min(max, restant);
  };
  try {
    for (const [k, f] of liste.entries()) {
      const rang = k + 1;
      const genre = genreDe(f);
      const nonLu = (raison: RaisonNonLu) => copie.nonLus.push({ fichier: rang, nom: f.nomOriginal, genre: LIBELLES_GENRE[genre], raison });
      const page = (base64: string, mime: PageLue["mime"], numero: number | null) => copie.pages.push({ mime, base64, fichier: rang, nom: f.nomOriginal, page: numero });
      if (genre === "video") {
        copie.videos++;
        continue;
      }
      if (genre === "audio") {
        copie.audios++;
        continue;
      }
      if (genre === "autre") {
        nonLu("format");
        continue;
      }
      if (genre === "heic" && !o.heic) {
        nonLu("format");
        continue;
      }
      if (genre === "office" && !(o.office && o.pdf)) {
        nonLu("format");
        continue;
      }
      // Plus de place : une photo compte pour une page, un document pour au moins une (sans le convertir).
      if (genre !== "texte" && reste() <= 0) {
        if (genre === "pdf" && o.pdf) {
          const tmp = path.join(dossier, `${rang}.pdf`);
          const contenu = await lireContenuFichier(f);
          if (contenu) await fs.promises.writeFile(tmp, contenu);
          copie.pagesEnTrop += (contenu && o.pdfinfo ? await pagesDuPdf(tmp, budget) : null) ?? 1;
        } else copie.pagesEnTrop += 1;
        continue;
      }
      // Budget de la copie épuisé (fichiers lourds ou piégés) : les fichiers suivants ne sont pas lus.
      if (genre !== "texte" && !budget(1000)) {
        nonLu("delai");
        continue;
      }
      const contenu = await lireContenuFichier(f);
      if (!contenu) {
        // Le bucket n'a pas rendu le fichier : panne passagère le plus souvent, la copie sera réessayée.
        nonLu("indisponible");
        continue;
      }
      try {
        if (genre === "texte") {
          const t = contenu.toString("utf8").replace(/\0/g, "");
          const place = TEXTE_MAX - copie.texte.length;
          if (place > 200) {
            copie.texte += `${copie.texte ? "\n\n" : ""}[Contenu du fichier texte ${rang}]\n${t.slice(0, place - 40)}`;
            if (t.length > place - 40) nonLu("taille");
          } else nonLu("taille");
        } else if (genre === "jpeg" || genre === "heic") {
          let jpeg = contenu;
          if (genre === "heic") {
            const source = path.join(dossier, `${rang}.heic`);
            const cible = path.join(dossier, `${rang}-heic.jpg`);
            await fs.promises.writeFile(source, contenu);
            const delai = budget(60_000);
            if (!delai) throw new Error("budget de conversion épuisé");
            await executer("heif-convert", ["-q", String(QUALITE_JPEG), source, cible], { timeout: delai, env: environnementOutil(dossier) });
            jpeg = await fs.promises.readFile(cible);
          }
          const j = infosJpeg(jpeg);
          const droit = !j || j.orientation === 1;
          const petite = j ? Math.max(j.largeur, j.hauteur) <= LARGEUR_PAGE_IA : false;
          if (j && droit && petite && jpeg.length <= JPEG_TEL_QUEL_OCTETS) page(jpeg.toString("base64"), "image/jpeg", null);
          else if (j && o.pdf && j.precision === 8 && [1, 3, 4].includes(j.composantes)) {
            const pdf = path.join(dossier, `${rang}-photo.pdf`);
            await fs.promises.writeFile(pdf, pdfDuJpeg(jpeg, j));
            const [rendue] = await rendrePages(pdf, dossier, 1, 1, budget, !petite);
            if (rendue) page(rendue.toString("base64"), "image/jpeg", null);
            else nonLu("erreur");
          } else if (j && jpeg.length <= IMAGE_MAX_OCTETS) page(jpeg.toString("base64"), "image/jpeg", null);
          else nonLu(j ? "taille" : "erreur");
        } else if (genre === "image") {
          const mime = f.mime.toLowerCase() as PageLue["mime"];
          const dims = dimensionsImage(contenu);
          if (!dims) nonLu("erreur");
          else if (contenu.length <= IMAGE_TELLE_QUELLE_OCTETS) page(contenu.toString("base64"), mime, null);
          else if (o.office && o.pdf) {
            // Image lourde (capture d'écran géante) : LibreOffice la pose sur une page, pdftoppm la rend en JPEG.
            const source = path.join(dossier, `${rang}${path.extname(f.nomOriginal) || "." + mime.split("/")[1]}`);
            await fs.promises.writeFile(source, contenu);
            const pdf = await versPdfParLibreOffice(source, path.join(dossier, `lo-${rang}`), budget).catch(() => null);
            const [rendue] = pdf ? await rendrePages(pdf, dossier, 1, 1, budget) : [];
            if (rendue) page(rendue.toString("base64"), "image/jpeg", null);
            else if (contenu.length <= IMAGE_MAX_OCTETS) page(contenu.toString("base64"), mime, null);
            else nonLu("taille");
          } else if (contenu.length <= IMAGE_MAX_OCTETS) page(contenu.toString("base64"), mime, null);
          else nonLu("taille");
        } else {
          // PDF ou document : en PDF d'abord (LibreOffice pour un document), puis une image par page.
          let pdf: string | null = path.join(dossier, `${rang}.pdf`);
          if (genre === "office") {
            const source = path.join(dossier, `${rang}${path.extname(f.nomOriginal).toLowerCase() || ".docx"}`);
            await fs.promises.writeFile(source, contenu);
            // Échec de LibreOffice (module Writer ou Calc absent du serveur, fichier abîmé) : « format non lu ».
            let horsDelai = false;
            pdf = await versPdfParLibreOffice(source, path.join(dossier, `lo-${rang}`), budget).catch((e) => {
              horsDelai = Boolean((e as { killed?: boolean }).killed) || !budget(1000);
              console.warn(`[copies] fichier ${f.id} : LibreOffice n'a pas pu le convertir :`, (e as Error).message.slice(0, 200));
              return null;
            });
            if (!pdf && horsDelai) {
              nonLu("delai");
              continue;
            }
          } else await fs.promises.writeFile(pdf, contenu);
          if (!pdf) nonLu(genre === "office" ? "format" : "erreur");
          else if (!o.pdf) {
            // Sans pdftoppm, le PDF part tel quel (l'API et la routine du soir savent le lire).
            if (copie.documents.length < DOCUMENTS_MAX && contenu.length <= DOCUMENT_MAX_OCTETS) copie.documents.push({ base64: contenu.toString("base64"), fichier: rang, nom: f.nomOriginal });
            else nonLu(contenu.length > DOCUMENT_MAX_OCTETS ? "taille" : "format");
          } else {
            const total = o.pdfinfo ? await pagesDuPdf(pdf, budget) : null;
            const lues = Math.min(reste(), total ?? reste());
            // Nombre de pages inconnu : une page de plus que la place dit s'il en reste.
            const images = await rendrePages(pdf, dossier, 1, total === null ? lues + 1 : lues, budget);
            if (!images.length) nonLu("erreur");
            images.slice(0, lues).forEach((img, n) => page(img.toString("base64"), "image/jpeg", n + 1));
            copie.pagesEnTrop += total !== null ? Math.max(0, total - lues) : images.length > lues ? 1 : 0;
          }
        }
      } catch (e) {
        console.warn(`[copies] fichier ${f.id} (${genre}) non lu :`, (e as Error).message.slice(0, 300));
        // Délai dépassé (processus arrêté) ou budget épuisé : « conversion trop longue », pas un fichier abîmé.
        nonLu((e as { killed?: boolean }).killed || !budget(1000) ? "delai" : "erreur");
      }
    }
    return copie;
  } finally {
    await fs.promises.rm(dossier, { recursive: true, force: true });
  }
}

// ── Copie montrée en direct (projection-copies.ts) ─────────────────────────
//
// Pendant le direct, le formateur montre UNE page d'une copie à toute la classe. Le serveur fabrique l'image de
// cette seule page (sans métadonnées, remise droite, le haut caché si demandé) et la garde en mémoire
// (projection-copies.ts). Ici : les outils. Rien n'est écrit dans le bucket ni en base : seulement un cache
// disque jetable des PDF (fichier PDF lu dans le bucket, ou document converti par LibreOffice), vidé au
// démarrage et toutes les 30 minutes (fichiers de plus de 3 h).

/** Photo, PNG, WebP ou GIF servis sans pdftoppm : au-delà, « trop lourd ». */
export const IMAGE_DIRECT_MAX_OCTETS = 3 * 1024 * 1024;
/** Part de la hauteur cachée en haut de la première page d'un fichier (l'étudiant y écrit son nom). */
export const PART_ENTETE = 0.12;
/** Délai d'un rendu du direct (pdftoppm, heif-convert, pdfinfo). */
const DELAI_RENDU_DIRECT_MS = 30_000;
/** Échec d'une préparation : on ne la relance pas avant 10 minutes. */
const DUREE_ECHEC_MS = 10 * 60_000;
/** Fichier momentanément illisible (bucket muet) : nouvel essai possible après 15 s. */
const DUREE_INDISPONIBLE_MS = 15_000;
const CACHE_DISQUE_MAX_MS = 3 * 3600_000;

const DOSSIER_DIRECT = path.join(os.tmpdir(), "copies-direct");
try {
  fs.rmSync(DOSSIER_DIRECT, { recursive: true, force: true });
  fs.mkdirSync(DOSSIER_DIRECT, { recursive: true });
} catch (e) {
  console.warn("[copies] dossier du direct impossible à préparer :", (e as Error).message);
}
setInterval(() => {
  void (async () => {
    const limite = Date.now() - CACHE_DISQUE_MAX_MS;
    for (const nom of await fs.promises.readdir(DOSSIER_DIRECT).catch(() => [] as string[])) {
      const chemin = path.join(DOSSIER_DIRECT, nom);
      const st = await fs.promises.stat(chemin).catch(() => null);
      if (st && st.mtimeMs < limite) await fs.promises.rm(chemin, { recursive: true, force: true }).catch(() => undefined);
    }
  })();
}, 30 * 60_000).unref();

/** Budget simple d'un rendu du direct. */
const budgetDe = (ms: number): Budget => {
  const limite = Date.now() + ms;
  return (max) => {
    const restant = limite - Date.now();
    return restant < 1000 ? 0 : Math.min(max, restant);
  };
};

/** Au plus deux rendus du direct à la fois (pdftoppm, heif-convert) : le serveur sert aussi le reste du campus. */
const RENDUS_SIMULTANES = 2;
let rendusEnCours = 0;
const attenteRendus: (() => void)[] = [];
async function avecRendu<T>(travail: () => Promise<T>): Promise<T> {
  if (rendusEnCours >= RENDUS_SIMULTANES) await new Promise<void>((ok) => attenteRendus.push(ok));
  rendusEnCours++;
  try {
    return await travail();
  } finally {
    rendusEnCours--;
    attenteRendus.shift()?.();
  }
}

/** Dossier de travail jetable d'un rendu (effacé ensuite). */
async function dansDossierJetable<T>(travail: (dossier: string) => Promise<T>): Promise<T> {
  const dossier = await fs.promises.mkdtemp(path.join(os.tmpdir(), "copie-direct-"));
  try {
    return await travail(dossier);
  } finally {
    await fs.promises.rm(dossier, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Orientation EXIF → rotation à appliquer à l'affichage (sens horaire). */
export const rotationExif = (o: number): RotationCopie => (o === 3 ? 180 : o === 6 ? 90 : o === 8 ? 270 : 0);

/**
 * JPEG sans ses métadonnées : garde SOI, APP0 (JFIF), APP14 (Adobe), les tables et l'image ; retire APP1 à
 * APP13, APP15 et les commentaires (EXIF, position GPS, XMP, appareil). Rend le tampon d'origine s'il ne se lit pas.
 */
export function jpegSansMetadonnees(b: Buffer): Buffer {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return b;
  const morceaux: Buffer[] = [b.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return b;
    const m = b[i + 1];
    if (m === 0xff) {
      i++;
      continue;
    }
    // Marqueurs sans longueur (TEM, RST) : recopiés.
    if (m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
      morceaux.push(b.subarray(i, i + 2));
      i += 2;
      continue;
    }
    if (m === 0xd9) {
      morceaux.push(b.subarray(i));
      return Buffer.concat(morceaux);
    }
    // Début de l'image : tout le reste est recopié tel quel.
    if (m === 0xda) {
      morceaux.push(b.subarray(i));
      return Buffer.concat(morceaux);
    }
    const longueur = b.readUInt16BE(i + 2);
    if (longueur < 2 || i + 2 + longueur > b.length) return b;
    const fin = i + 2 + longueur;
    const metadonnee = (m >= 0xe1 && m <= 0xed) || m === 0xef || m === 0xfe;
    if (!metadonnee) morceaux.push(b.subarray(i, fin));
    i = fin;
  }
  return b;
}

/** PNG sans ses blocs de texte, d'EXIF ni de date (tEXt, zTXt, iTXt, eXIf, tIME) ; les autres blocs restent entiers. */
export function pngSansMetadonnees(b: Buffer): Buffer {
  if (b.length < 8 || b.readUInt32BE(0) !== 0x89504e47) return b;
  const retires = new Set(["tEXt", "zTXt", "iTXt", "eXIf", "tIME"]);
  const morceaux: Buffer[] = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const longueur = b.readUInt32BE(i);
    const type = b.toString("latin1", i + 4, i + 8);
    const fin = i + 12 + longueur;
    if (fin > b.length) return b;
    if (!retires.has(type)) morceaux.push(b.subarray(i, fin));
    i = fin;
    if (type === "IEND") return Buffer.concat(morceaux);
  }
  return b;
}

/**
 * Coupe un texte en pages d'au plus « max » caractères : aux paragraphes (lignes vides), puis aux fins de
 * phrase, puis au dernier espace ; jamais au milieu d'un mot (sauf un « mot » plus long qu'une page).
 */
export function decouperTexte(texte: string, max = 700): string[] {
  const propre = texte.replace(/\r\n?/g, "\n").replace(/\0/g, "").trim();
  if (!propre) return [];
  const pages: string[] = [];
  let courante = "";
  const pousser = () => {
    if (courante.trim()) pages.push(courante.trim());
    courante = "";
  };
  /** Coupe un morceau trop long : fin de phrase, puis espace, sinon coupe dure. */
  const couperLong = (bloc: string): string[] => {
    const sortie: string[] = [];
    let reste = bloc;
    while (reste.length > max) {
      const fenetre = reste.slice(0, max + 1);
      let coupe = -1;
      const phrases = [...fenetre.matchAll(/[.!?…;:](?=\s)/g)];
      if (phrases.length) coupe = (phrases[phrases.length - 1].index ?? -1) + 1;
      if (coupe < max * 0.4) {
        const espace = fenetre.lastIndexOf(" ");
        const ligne = fenetre.lastIndexOf("\n");
        coupe = Math.max(espace, ligne, coupe);
      }
      // Un « mot » plus long qu'une page (adresse, suite de caractères) : coupe dure, la page se remplit.
      const motSuivant = /^\S*/.exec(reste.slice(Math.max(coupe, 0)).trimStart())?.[0].length ?? 0;
      if (coupe <= 0 || (coupe < max * 0.4 && motSuivant > max)) coupe = max;
      sortie.push(reste.slice(0, coupe).trim());
      reste = reste.slice(coupe).trimStart();
    }
    if (reste.trim()) sortie.push(reste.trim());
    return sortie;
  };
  for (const paragraphe of propre.split(/\n\s*\n/)) {
    const p = paragraphe.trim();
    if (!p) continue;
    const ajout = courante ? `${courante}\n\n${p}` : p;
    if (ajout.length <= max) {
      courante = ajout;
      continue;
    }
    pousser();
    if (p.length <= max) courante = p;
    else {
      const morceaux = couperLong(p);
      for (const m of morceaux.slice(0, -1)) pages.push(m);
      courante = morceaux[morceaux.length - 1] ?? "";
    }
  }
  pousser();
  return pages;
}

// Cache des PDF (fichier PDF d'une copie, ou document Office converti) : une préparation à la fois par fichier.
const pdfsPrets = new Map<number, string>();
const preparationsPdf = new Map<number, Promise<string | null>>();
const echecsPdf = new Map<number, { le: number; raison: "erreur" | "indisponible" }>();
const pagesPdf = new Map<number, number>();

/** Le PDF de ce fichier est déjà sur le disque. */
export function pdfPret(fichierId: number): boolean {
  const chemin = pdfsPrets.get(fichierId);
  if (chemin && fs.existsSync(chemin)) return true;
  if (chemin) pdfsPrets.delete(fichierId);
  return false;
}

/** Raison d'un échec récent de préparation (10 min pour un fichier abîmé, 15 s pour un bucket muet), sinon null. */
export function raisonEchecPdf(fichierId: number): "erreur" | "indisponible" | null {
  const e = echecsPdf.get(fichierId);
  if (!e) return null;
  if (Date.now() - e.le > (e.raison === "erreur" ? DUREE_ECHEC_MS : DUREE_INDISPONIBLE_MS)) {
    echecsPdf.delete(fichierId);
    return null;
  }
  return e.raison;
}
/** Échec de moins de 10 minutes : on ne relance pas. */
export const pdfEnEchec = (fichierId: number) => raisonEchecPdf(fichierId) === "erreur";

/** PDF d'un fichier PDF ou Office, sur le disque (une seule préparation à la fois par fichier). null : outil absent ou échec. */
export async function pdfDuFichier(f: Fichier, o: { prioritaire?: boolean } = {}): Promise<string | null> {
  if (pdfPret(f.id)) return pdfsPrets.get(f.id)!;
  if (raisonEchecPdf(f.id)) return null;
  const enCours = preparationsPdf.get(f.id);
  if (enCours) return enCours;
  const genre = genreDe(f);
  const preparation = (async (): Promise<string | null> => {
    const cible = path.join(DOSSIER_DIRECT, `${f.id}.pdf`);
    const contenu = await lireContenuFichier(f);
    if (!contenu) {
      echecsPdf.set(f.id, { le: Date.now(), raison: "indisponible" });
      return null;
    }
    try {
      if (genre === "pdf") {
        await fs.promises.writeFile(cible, contenu);
      } else if (genre === "office") {
        const outilsServeur = await outilsDeLecture();
        if (!outilsServeur.office) throw new Error("LibreOffice absent");
        await dansDossierJetable(async (dossier) => {
          const source = path.join(dossier, `copie${path.extname(f.nomOriginal).toLowerCase() || ".docx"}`);
          await fs.promises.writeFile(source, contenu);
          const pdf = await versPdfParLibreOffice(source, dossier, budgetDe(DELAI_OFFICE_MS + 5_000), { prioritaire: o.prioritaire });
          if (!pdf) throw new Error("aucun PDF produit");
          await fs.promises.copyFile(pdf, cible);
        });
      } else throw new Error("ni PDF ni document");
      pdfsPrets.set(f.id, cible);
      return cible;
    } catch (e) {
      console.warn(`[copies] fichier ${f.id} : préparation pour le direct impossible :`, (e as Error).message.slice(0, 200));
      echecsPdf.set(f.id, { le: Date.now(), raison: "erreur" });
      return null;
    }
  })().finally(() => preparationsPdf.delete(f.id));
  preparationsPdf.set(f.id, preparation);
  return preparation;
}

/** Nombre de pages du PDF d'un fichier (pdfinfo), gardé en mémoire ; null si inconnu. */
export async function pagesDuFichierPdf(f: Fichier): Promise<number | null> {
  const connu = pagesPdf.get(f.id);
  if (connu && pdfPret(f.id)) return connu;
  const chemin = await pdfDuFichier(f);
  if (!chemin) return null;
  const n = await pagesDuPdf(chemin, budgetDe(DELAI_RENDU_DIRECT_MS));
  if (n) pagesPdf.set(f.id, n);
  return n;
}

// Contenus de photos lus pour l'inventaire (orientation), gardés 10 minutes : le rendu les reprend.
const contenusLus = new Map<number, { le: number; octets: Buffer }>();
async function contenuGarde(f: Fichier): Promise<Buffer | null> {
  const g = contenusLus.get(f.id);
  if (g && Date.now() - g.le < 10 * 60_000) return g.octets;
  const octets = await lireContenuFichier(f);
  if (octets && octets.length <= IMAGE_DIRECT_MAX_OCTETS) {
    if (contenusLus.size > 60) contenusLus.clear();
    contenusLus.set(f.id, { le: Date.now(), octets });
  }
  return octets;
}

/** Le JPEG passe-t-il par pdfDuJpeg (8 bits, gris, RVB ou CMJN) ? Sinon, il est servi tel quel, sans métadonnées. */
const jpegRendable = (j: InfosJpeg | null): j is InfosJpeg => Boolean(j && j.precision === 8 && [1, 3, 4].includes(j.composantes));

/** JPEG d'une photo HEIC (heif-convert), gardé sur le disque. */
async function jpegDuHeic(f: Fichier): Promise<Buffer | null> {
  const cible = path.join(DOSSIER_DIRECT, `${f.id}.jpg`);
  if (fs.existsSync(cible)) return fs.promises.readFile(cible);
  const contenu = await lireContenuFichier(f);
  if (!contenu) return null;
  await avecRendu(() =>
    dansDossierJetable(async (dossier) => {
      const source = path.join(dossier, "photo.heic");
      const sortie = path.join(dossier, "photo.jpg");
      await fs.promises.writeFile(source, contenu);
      await executer("heif-convert", ["-q", String(QUALITE_JPEG), source, sortie], { timeout: DELAI_RENDU_DIRECT_MS, env: environnementOutil(dossier) });
      await fs.promises.copyFile(sortie, cible);
    }),
  );
  return fs.promises.readFile(cible);
}

export type InventaireFichier =
  | { fichierId: number; genre: "jpeg" | "heic" | "image"; pages: 1; rotation: RotationCopie; enteteDisponible: boolean }
  | { fichierId: number; genre: "pdf" | "office"; pages: number; enteteDisponible: boolean }
  | { fichierId: number; genre: "texte"; morceaux: string[] }
  | { fichierId: number; genre: "office"; preparation: true }
  | { fichierId: number; nonProjetable: RaisonNonProjetable };

/**
 * Ce qu'un fichier de copie donne en direct, vite : rien n'est converti, sauf la préparation d'un document
 * Office lancée en arrière-plan (tâche prioritaire de LibreOffice).
 */
export async function inventaireFichier(f: Fichier): Promise<InventaireFichier> {
  const o = await outilsDeLecture();
  const genre = genreDe(f);
  const non = (raison: RaisonNonProjetable): InventaireFichier => ({ fichierId: f.id, nonProjetable: raison });
  if (genre === "video") return non("video");
  if (genre === "audio") return non("audio");
  if (genre === "autre") return non(/zip|compressed|x-7z|x-rar|x-tar|gzip/i.test(f.mime) || /\.(zip|rar|7z|tar|gz)$/i.test(f.nomOriginal) ? "zip" : "format");
  if (genre === "heic" && !o.heic) return non("heic");
  if (genre === "jpeg" || genre === "heic") {
    // Photo : remise droite et ré-encodée par pdftoppm (le haut peut alors être caché) ; sinon servie sans
    // ses métadonnées, son orientation EXIF devient la rotation diffusée.
    if (genre === "jpeg" && !o.pdf && f.taille > IMAGE_DIRECT_MAX_OCTETS) return non("taille");
    let jpeg: Buffer | null;
    try {
      jpeg = genre === "heic" ? await jpegDuHeic(f) : await contenuGarde(f);
    } catch {
      return non("erreur");
    }
    if (!jpeg) return non("indisponible");
    const j = infosJpeg(jpeg);
    if (!j) return non("erreur");
    if (o.pdf && jpegRendable(j)) return { fichierId: f.id, genre, pages: 1, rotation: 0, enteteDisponible: true };
    if (jpeg.length > IMAGE_DIRECT_MAX_OCTETS) return non("taille");
    return { fichierId: f.id, genre, pages: 1, rotation: rotationExif(j.orientation), enteteDisponible: false };
  }
  if (genre === "image") {
    if (f.taille > IMAGE_DIRECT_MAX_OCTETS) return non("taille");
    return { fichierId: f.id, genre: "image", pages: 1, rotation: 0, enteteDisponible: false };
  }
  if (genre === "texte") {
    const contenu = await lireContenuFichier(f);
    if (!contenu) return non("indisponible");
    return { fichierId: f.id, genre: "texte", morceaux: decouperTexte(contenu.toString("utf8"), 700) };
  }
  if (genre === "pdf") {
    if (!o.pdf || !o.pdfinfo) return non("pdf");
    const n = await pagesDuFichierPdf(f);
    if (!n) return non(raisonEchecPdf(f.id) === "indisponible" ? "indisponible" : "erreur");
    return { fichierId: f.id, genre: "pdf", pages: n, enteteDisponible: true };
  }
  // Document Office : converti en PDF une fois, en tâche prioritaire, puis comme un PDF.
  if (!o.office || !o.pdf || !o.pdfinfo) return non("document");
  if (pdfEnEchec(f.id)) return non("erreur");
  if (pdfPret(f.id)) {
    const n = await pagesDuFichierPdf(f);
    return n ? { fichierId: f.id, genre: "office", pages: n, enteteDisponible: true } : non("erreur");
  }
  if (raisonEchecPdf(f.id) === "indisponible") return non("indisponible");
  void pdfDuFichier(f, { prioritaire: true });
  return { fichierId: f.id, genre: "office", preparation: true };
}

export type ImagePage = { mime: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; octets: Buffer; rotation: RotationCopie };

/** Rend une page d'un PDF (1600 px), entière ou sans son haut. */
async function rendrePagePdf(pdf: string, page: number, sansEntete: boolean, reduire = true): Promise<Buffer> {
  return avecRendu(() =>
    dansDossierJetable(async (dossier) => {
      const budget = budgetDe(DELAI_RENDU_DIRECT_MS);
      const [entiere] = await rendrePages(pdf, dossier, page, page, budget, reduire);
      if (!entiere) throw new Error("page non rendue");
      if (!sansEntete) return entiere;
      const j = infosJpeg(entiere);
      if (!j) throw new Error("page rendue illisible");
      const y = Math.round(j.hauteur * PART_ENTETE);
      const [coupee] = await rendrePages(pdf, dossier, page, page, budget, reduire, { y, largeur: j.largeur, hauteur: j.hauteur - y });
      if (!coupee) throw new Error("page recadrée non rendue");
      return coupee;
    }),
  );
}

/**
 * Image d'une page prête à montrer à la classe (sans métadonnées), recadrée sans le haut si demandé et possible.
 * « page » : numéro de page d'un PDF ou d'un document ; null pour une photo. Lève une erreur si le fichier ne se montre pas.
 */
export async function imageDePage(f: Fichier, page: number | null, o: { sansEntete: boolean }): Promise<ImagePage> {
  const outilsServeur = await outilsDeLecture();
  const genre = genreDe(f);
  if (genre === "jpeg" || genre === "heic") {
    const jpeg = genre === "heic" ? await jpegDuHeic(f) : await contenuGarde(f);
    if (!jpeg) throw new Error("fichier indisponible");
    const j = infosJpeg(jpeg);
    if (!j) throw new Error("photo illisible");
    if (outilsServeur.pdf && jpegRendable(j)) {
      // Enveloppée dans un PDF d'une page, sans être décodée, puis rendue droite et ré-encodée par pdftoppm.
      const petite = Math.max(j.largeur, j.hauteur) <= LARGEUR_PAGE_IA;
      const octets = await dansDossierJetable(async (dossier) => {
        const pdf = path.join(dossier, "photo.pdf");
        await fs.promises.writeFile(pdf, pdfDuJpeg(jpeg, j));
        return rendrePagePdf(pdf, 1, o.sansEntete, !petite);
      });
      return { mime: "image/jpeg", octets, rotation: 0 };
    }
    if (jpeg.length > IMAGE_DIRECT_MAX_OCTETS) throw new Error("photo trop lourde");
    const propre = jpegSansMetadonnees(jpeg);
    // Tampon rendu tel quel : JPEG illisible, ses métadonnées ne peuvent pas être retirées.
    if (propre === jpeg) throw new Error("photo illisible");
    return { mime: "image/jpeg", octets: propre, rotation: rotationExif(j.orientation) };
  }
  if (genre === "image") {
    const contenu = await contenuGarde(f);
    if (!contenu) throw new Error("fichier indisponible");
    if (contenu.length > IMAGE_DIRECT_MAX_OCTETS) throw new Error("image trop lourde");
    if (!dimensionsImage(contenu)) throw new Error("image illisible");
    const mime = f.mime.toLowerCase() as ImagePage["mime"];
    return { mime, octets: mime === "image/png" ? pngSansMetadonnees(contenu) : contenu, rotation: 0 };
  }
  if (genre === "pdf" || genre === "office") {
    if (!outilsServeur.pdf) throw new Error("pdftoppm absent");
    const pdf = await pdfDuFichier(f, { prioritaire: true });
    if (!pdf) throw new Error("PDF indisponible");
    return { mime: "image/jpeg", octets: await rendrePagePdf(pdf, page ?? 1, o.sansEntete), rotation: 0 };
  }
  throw new Error("fichier qui ne se projette pas");
}
