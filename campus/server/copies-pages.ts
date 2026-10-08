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
//   - fichiers texte : ajoutés au texte saisi ;
//   - vidéos et sons : comptés, jamais lus (le formateur les regarde) ; zip et le reste : « non lus ».
// Au plus PAGES_MAX_PAR_COPIE pages : les suivantes sont comptées (pagesEnTrop). Rien ne lève d'erreur pour
// un fichier : ce qui ne se lit pas (outil absent, fichier abîmé, trop lourd) est rendu dans « nonLus », et
// la correction automatique ne publie jamais la note d'une copie lue en partie.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { lireContenuFichier } from "./fichiers";
import { LARGEUR_PAGE_IA, PAGES_MAX_PAR_COPIE } from "@shared/engagement/corrections";
import type { Fichier } from "@shared/schema";

const executer = promisify(execFile);

/** Une page lue (image en base64), avec le fichier d'où elle vient (rang dans la copie, à partir de 1). */
export type PageLue = { mime: "image/jpeg" | "image/png" | "image/webp" | "image/gif"; base64: string; fichier: number; nom: string; page: number | null };
/** PDF envoyé tel quel (pdftoppm absent du serveur). */
export type DocumentLu = { base64: string; fichier: number; nom: string };
export type RaisonNonLu = "format" | "erreur" | "taille";
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

/** Texte gardé (saisi et fichiers texte) : au-delà, il est coupé. */
const TEXTE_MAX = 30_000;
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

// ── Outils du serveur ──────────────────────────────────────────────────────

/** L'outil est-il installé ? (ENOENT : absent ; toute autre erreur, par exemple sur --version : présent). */
const detecter = (commande: string, args: string[]) =>
  new Promise<boolean>((fini) => execFile(commande, args, { timeout: 60_000 }, (err) => fini(!err || (err as NodeJS.ErrnoException).code !== "ENOENT")));

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

/** Une conversion LibreOffice à la fois : il est gourmand en mémoire. */
let fileOffice: Promise<unknown> = Promise.resolve();

async function versPdfParLibreOffice(source: string, dossier: string): Promise<string | null> {
  const tache = fileOffice.then(async () => {
    const sortie = path.join(dossier, "pdf");
    await fs.promises.mkdir(sortie, { recursive: true });
    // Profil LibreOffice jetable : deux conversions ne se marchent pas dessus, rien ne traîne sur le disque.
    await executer(
      "soffice",
      [`-env:UserInstallation=file://${path.join(dossier, "profil")}`, "--headless", "--norestore", "--convert-to", "pdf", "--outdir", sortie, source],
      { timeout: 180_000 },
    );
    const pdf = (await fs.promises.readdir(sortie)).find((n) => n.endsWith(".pdf"));
    return pdf ? path.join(sortie, pdf) : null;
  });
  fileOffice = tache.catch(() => undefined);
  return tache;
}

/** Nombre de pages d'un PDF (pdfinfo), ou null s'il ne le dit pas. */
async function pagesDuPdf(chemin: string): Promise<number | null> {
  try {
    const { stdout } = await executer("pdfinfo", [chemin], { timeout: 30_000 });
    const n = /^Pages:\s+(\d+)/m.exec(String(stdout));
    return n ? Number(n[1]) : null;
  } catch {
    return null;
  }
}

/**
 * Pages premiere..derniere d'un PDF en JPEG (qualité 78). « reduire » : le plus grand côté ramené à
 * LARGEUR_PAGE_IA px ; sinon 72 points par pouce, soit un pixel par point (photo enveloppée, déjà assez petite).
 */
async function rendrePages(pdf: string, dossier: string, premiere: number, derniere: number, reduire = true): Promise<Buffer[]> {
  const sortie = path.join(dossier, `pages-${premiere}`);
  await fs.promises.mkdir(sortie, { recursive: true });
  const taille = reduire ? ["-scale-to", String(LARGEUR_PAGE_IA)] : ["-r", "72"];
  await executer("pdftoppm", ["-jpeg", "-jpegopt", `quality=${QUALITE_JPEG}`, ...taille, "-f", String(premiere), "-l", String(derniere), pdf, path.join(sortie, "p")], {
    timeout: 120_000,
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
/** Tout ce que l'étudiant a rendu a-t-il été lu (vidéos et sons mis à part) ? */
export const lectureComplete = (c: CopieLue) => !c.nonLus.length && c.pagesEnTrop === 0;

/** Ce que le campus n'a pas lu, pour le formateur (avec les noms des fichiers). */
export function resumeNonLus(c: CopieLue): string | null {
  const morceaux: string[] = [];
  if (c.nonLus.length) {
    const raison = (r: RaisonNonLu) => (r === "format" ? "format non lu" : r === "taille" ? "trop lourd" : "illisible");
    morceaux.push(`Fichiers non lus : ${c.nonLus.map((n) => `${n.nom} (${raison(n.raison)})`).join(", ")}.`);
  }
  if (c.pagesEnTrop) morceaux.push(`${c.pagesEnTrop} page${c.pagesEnTrop > 1 ? "s" : ""} au-delà des ${PAGES_MAX_PAR_COPIE} que le campus lit.`);
  return morceaux.length ? morceaux.join(" ") : null;
}

/**
 * Lit une copie : texte saisi et fichiers, dans l'ordre de la copie. Les fichiers sont lus dans le bucket
 * (ou sur le volume) puis convertis dans un dossier temporaire, effacé à la fin.
 */
export async function lireCopie(texteSaisi: string, liste: Fichier[]): Promise<CopieLue> {
  const copie: CopieLue = { texte: texteSaisi.trim().slice(0, TEXTE_MAX), pages: [], documents: [], nonLus: [], videos: 0, audios: 0, pagesEnTrop: 0 };
  if (!liste.length) return copie;
  const o = await outilsDeLecture();
  const dossier = await fs.promises.mkdtemp(path.join(os.tmpdir(), "copie-"));
  const reste = () => PAGES_MAX_PAR_COPIE - copie.pages.length;
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
          copie.pagesEnTrop += (contenu && o.pdfinfo ? await pagesDuPdf(tmp) : null) ?? 1;
        } else copie.pagesEnTrop += 1;
        continue;
      }
      const contenu = await lireContenuFichier(f);
      if (!contenu) {
        nonLu("erreur");
        continue;
      }
      try {
        if (genre === "texte") {
          const place = TEXTE_MAX - copie.texte.length;
          if (place > 200) copie.texte += `${copie.texte ? "\n\n" : ""}[Contenu du fichier texte ${rang}]\n${contenu.toString("utf8").replace(/\0/g, "").slice(0, place - 40)}`;
          else nonLu("taille");
        } else if (genre === "jpeg" || genre === "heic") {
          let jpeg = contenu;
          if (genre === "heic") {
            const source = path.join(dossier, `${rang}.heic`);
            const cible = path.join(dossier, `${rang}-heic.jpg`);
            await fs.promises.writeFile(source, contenu);
            await executer("heif-convert", ["-q", String(QUALITE_JPEG), source, cible], { timeout: 60_000 });
            jpeg = await fs.promises.readFile(cible);
          }
          const j = infosJpeg(jpeg);
          const droit = !j || j.orientation === 1;
          const petite = j ? Math.max(j.largeur, j.hauteur) <= LARGEUR_PAGE_IA : false;
          if (j && droit && petite && jpeg.length <= JPEG_TEL_QUEL_OCTETS) page(jpeg.toString("base64"), "image/jpeg", null);
          else if (j && o.pdf && j.precision === 8 && [1, 3, 4].includes(j.composantes)) {
            const pdf = path.join(dossier, `${rang}-photo.pdf`);
            await fs.promises.writeFile(pdf, pdfDuJpeg(jpeg, j));
            const [rendue] = await rendrePages(pdf, dossier, 1, 1, !petite);
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
            const pdf = await versPdfParLibreOffice(source, path.join(dossier, `lo-${rang}`));
            const [rendue] = pdf ? await rendrePages(pdf, dossier, 1, 1) : [];
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
            pdf = await versPdfParLibreOffice(source, path.join(dossier, `lo-${rang}`)).catch((e) => {
              console.warn(`[copies] fichier ${f.id} : LibreOffice n'a pas pu le convertir :`, (e as Error).message.slice(0, 200));
              return null;
            });
          } else await fs.promises.writeFile(pdf, contenu);
          if (!pdf) nonLu(genre === "office" ? "format" : "erreur");
          else if (!o.pdf) {
            // Sans pdftoppm, le PDF part tel quel (l'API et la routine du soir savent le lire).
            if (copie.documents.length < DOCUMENTS_MAX && contenu.length <= DOCUMENT_MAX_OCTETS) copie.documents.push({ base64: contenu.toString("base64"), fichier: rang, nom: f.nomOriginal });
            else nonLu(contenu.length > DOCUMENT_MAX_OCTETS ? "taille" : "format");
          } else {
            const total = o.pdfinfo ? await pagesDuPdf(pdf) : null;
            const lues = Math.min(reste(), total ?? reste());
            // Nombre de pages inconnu : une page de plus que la place dit s'il en reste.
            const images = await rendrePages(pdf, dossier, 1, total === null ? lues + 1 : lues);
            if (!images.length) nonLu("erreur");
            images.slice(0, lues).forEach((img, n) => page(img.toString("base64"), "image/jpeg", n + 1));
            copie.pagesEnTrop += total !== null ? Math.max(0, total - lues) : images.length > lues ? 1 : 0;
          }
        }
      } catch (e) {
        console.warn(`[copies] fichier ${f.id} (${genre}) non lu :`, (e as Error).message.slice(0, 300));
        nonLu("erreur");
      }
    }
    return copie;
  } finally {
    await fs.promises.rm(dossier, { recursive: true, force: true });
  }
}
