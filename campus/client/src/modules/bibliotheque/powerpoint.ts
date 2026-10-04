// Exposé → PowerPoint, fabriqué dans le navigateur (aucun envoi au serveur) :
// page de titre aux couleurs de 2IAE, une diapositive par partie de l'exposé
// avec ce qu'il faut dire dans les notes de l'orateur, puis la bibliographie.
// La bibliothèque pptxgenjs n'est chargée qu'au moment du téléchargement.
import type { ExposeDto } from "@shared/schema/ext-bibliotheque";

const ENCRE = "141414";
const ORANGE = "E4793A";
const ORANGE_FONCE = "C85F22";
const CREME = "FBF6F2";
const GRIS = "6B6B6B";
const TITRE = "Cambria";
const TEXTE = "Calibri";

/** Logo en base64 (data URL) pour l'insérer dans le fichier. */
async function logo(): Promise<string | null> {
  try {
    const r = await fetch("/marque-2iae-detouree.png");
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise((ok) => {
      const lecteur = new FileReader();
      lecteur.onload = () => ok(String(lecteur.result));
      lecteur.onerror = () => ok(null);
      lecteur.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const nomDeFichier = (sujet: string) =>
  `Exposé - ${sujet}`
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

export async function telechargerPowerPoint(e: ExposeDto): Promise<void> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_16x9"; // 10 × 5,625 pouces
  pres.author = e.auteur;
  pres.title = e.sujet;
  pres.company = "Groupe 2IAE · Campus numérique";
  const image = await logo();
  const diapos = e.diapositives ?? [];

  // ── Page de titre ──
  const titre = pres.addSlide();
  titre.background = { color: ENCRE };
  if (image) titre.addImage({ data: image, x: 0.5, y: 0.4, w: 1.4, h: 0.7 });
  titre.addText("EXPOSÉ", { x: 0.5, y: 1.5, w: 9, h: 0.4, fontFace: TEXTE, fontSize: 14, bold: true, color: ORANGE, charSpacing: 4, margin: 0, isTextBox: true });
  titre.addText(e.sujet, { x: 0.5, y: 1.95, w: 9, h: 1.6, fontFace: TITRE, fontSize: 36, bold: true, color: "FFFFFF", valign: "top", fit: "shrink", margin: 0, isTextBox: true });
  titre.addText(`D'après « ${e.livreTitre} »`, { x: 0.5, y: 3.65, w: 9, h: 0.5, fontFace: TEXTE, fontSize: 16, italic: true, color: "E8DDD4", margin: 0, isTextBox: true });
  titre.addText(e.auteur, { x: 0.5, y: 4.6, w: 6, h: 0.4, fontFace: TEXTE, fontSize: 14, bold: true, color: "FFFFFF", margin: 0, isTextBox: true });
  titre.addText("Campus numérique 2IAE", { x: 6, y: 4.6, w: 3.5, h: 0.4, fontFace: TEXTE, fontSize: 12, color: ORANGE, align: "right", margin: 0, isTextBox: true });

  // ── Une diapositive par partie ──
  diapos.forEach((d, i) => {
    const s = pres.addSlide();
    s.background = { color: "FFFFFF" };
    // Pastille numérotée, motif repris sur chaque diapositive.
    s.addShape(pres.ShapeType.ellipse, { x: 0.5, y: 0.42, w: 0.55, h: 0.55, fill: { color: ORANGE }, line: { color: ORANGE } });
    s.addText(String(i + 1), { x: 0.5, y: 0.42, w: 0.55, h: 0.55, fontFace: TEXTE, fontSize: 16, bold: true, color: ENCRE, align: "center", valign: "middle", margin: 0, isTextBox: true });
    s.addText(d.titre, { x: 1.25, y: 0.3, w: 8.25, h: 0.8, fontFace: TITRE, fontSize: 28, bold: true, color: ENCRE, valign: "middle", fit: "shrink", margin: 0, isTextBox: true });
    if (d.puces.length) {
      s.addShape(pres.ShapeType.roundRect, { x: 0.5, y: 1.35, w: 9, h: 3.55, fill: { color: CREME }, line: { color: CREME }, rectRadius: 0.12 });
      s.addText(
        d.puces.map((p, n) => ({ text: p, options: { bullet: { code: "25CF" }, breakLine: n < d.puces.length - 1, paraSpaceAfter: 10 } })),
        { x: 0.8, y: 1.5, w: 8.4, h: 3.25, fontFace: TEXTE, fontSize: 20, color: ENCRE, valign: "top", fit: "shrink", margin: 0, isTextBox: true },
      );
    }
    s.addText(`${e.sujet}  ·  ${i + 2}`, { x: 0.5, y: 5.1, w: 9, h: 0.3, fontFace: TEXTE, fontSize: 10, color: GRIS, align: "right", margin: 0, isTextBox: true });
    if (d.aDire) s.addNotes(d.aDire);
  });

  // ── Bibliographie ──
  if (e.bibliographie.length) {
    const b = pres.addSlide();
    b.background = { color: ENCRE };
    b.addText("Bibliographie", { x: 0.5, y: 0.4, w: 9, h: 0.8, fontFace: TITRE, fontSize: 30, bold: true, color: "FFFFFF", margin: 0, isTextBox: true });
    b.addText(
      e.bibliographie.map((r, n) => ({ text: r, options: { bullet: { code: "25CF" }, breakLine: n < e.bibliographie.length - 1, paraSpaceAfter: 12 } })),
      { x: 0.5, y: 1.4, w: 9, h: 3.4, fontFace: TEXTE, fontSize: 16, color: "F2E9E2", valign: "top", fit: "shrink", margin: 0, isTextBox: true },
    );
    b.addText("Préparé avec la bibliothèque du Campus numérique 2IAE", { x: 0.5, y: 5.05, w: 9, h: 0.3, fontFace: TEXTE, fontSize: 10, color: ORANGE_FONCE, margin: 0, isTextBox: true });
  }

  // Téléchargement par un lien explicite : le nom du fichier est conservé sur téléphone comme sur ordinateur.
  const blob = (await pres.write({ outputType: "blob" })) as Blob;
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = `${nomDeFichier(e.sujet)}.pptx`;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
