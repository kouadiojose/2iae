// Outils du module « showreel » : formats d'heure, nombres, téléversement
// des sources (PDF du profil, photo détourée conservée en WebP).
import { api, ErreurApi, type FichierTeleverse } from "@/lib/api";
import type { LienCampusShowreel, PlanShowreel, StatutShowreel } from "@shared/schema";

/** « 08:30 » → « 08h30 ». */
export const heureH = (h: string | null | undefined) => (h ? h.replace(":", "h") : "");

const NOMBRES = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"];
export const enLettres = (n: number) => NOMBRES[n] ?? String(n);

/** « en direct dans les cinq campus » (ou « dans le campus » s'il n'y en a qu'un). */
export function phraseCampus(c: LienCampusShowreel): string {
  const n = c.campus.length;
  if (n <= 1) return "en direct au campus numérique";
  return `en direct dans les ${enLettres(n)} campus`;
}

/** Le rendez-vous du plan de fin : « Lundi 08h30 », ou null sans créneau à venir. */
export function rendezVous(c: LienCampusShowreel): string | null {
  if (!c.jourLibelle || !c.heureDebut || !c.prochaineDate) return null;
  return `${c.jourLibelle} ${heureH(c.heureDebut)}`;
}

/** Texte lisible d'un plan (transcription, annonce aux lecteurs d'écran, version fixe). */
export function texteDuPlan(p: PlanShowreel, c: LienCampusShowreel): string {
  switch (p.type) {
    case "ouverture":
      return [p.surtitre, p.titre, p.texte].filter(Boolean).join(". ");
    case "chiffre":
      return [`${p.valeur} ${p.titre}`.trim(), p.texte].filter(Boolean).join(". ");
    case "parcours":
    case "expertise":
      return [p.surtitre, ...p.elements.map((e) => [e.nom, e.detail].filter(Boolean).join(", "))].filter(Boolean).join(". ");
    case "realisation":
      return [p.surtitre, p.titre, p.texte].filter(Boolean).join(". ");
    case "citation":
      return `« ${p.texte} »${p.titre ? `, ${p.titre}` : ""}`;
    case "campus": {
      if (!c.cours) return `Formateur du campus numérique 2IAE, ${phraseCampus(c)}.`;
      const quand = c.jourLibelle && c.heureDebut ? `, le ${c.jourLibelle.toLowerCase()} de ${heureH(c.heureDebut)} à ${heureH(c.heureFin)}, heure d'Abidjan` : "";
      const local = c.heureDebutLocale && c.ville ? ` (${heureH(c.heureDebutLocale)} à ${c.ville})` : "";
      return `Au campus 2IAE : ${c.cours.titre}${quand}${local}. ${c.public ?? ""}`.trim();
    }
    case "fin": {
      const rdv = rendezVous(c);
      return `${rdv ? `${rdv}, ` : "Bientôt "}${phraseCampus(c)}. Campus numérique 2IAE.`;
    }
  }
}

export const LIBELLES_STATUT: Record<StatutShowreel, string> = {
  brouillon: "Brouillon",
  a_valider: "À valider",
  publie: "En ligne",
};

/** Identifiant court d'un nouveau plan. */
export const idPlan = () => Math.random().toString(36).slice(2, 10);

/**
 * Photo de présentation : réduite à 720 px. Une photo détourée (fond
 * transparent) reste transparente, en WebP ; une photo ordinaire passe en
 * JPEG. Les métadonnées (position GPS…) disparaissent au passage.
 */
export async function preparerPhoto(f: File, cote = 720): Promise<File> {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(f.type)) return f;
  try {
    const image = await createImageBitmap(f);
    const ratio = Math.min(1, cote / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * ratio);
    canvas.height = Math.round(image.height * ratio);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    let transparente = false;
    if (f.type === "image/png" || f.type === "image/webp") {
      const px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < px.length; i += 16) {
        if (px[i] < 250) {
          transparente = true;
          break;
        }
      }
    }
    const type = transparente ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, transparente ? 0.84 : 0.8));
    // Navigateur sans encodeur WebP : il rend un PNG, gardé tel quel (transparence comprise).
    if (!blob) return f;
    const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
    return new File([blob], `${f.name.replace(/\.\w+$/, "")}.${ext}`, { type: blob.type });
  } catch {
    return f;
  }
}

/** Téléverse un PDF de profil ou une photo (usage « source-profil »). */
export async function televerserSource(f: File): Promise<FichierTeleverse> {
  const donnees = new FormData();
  donnees.append("usage", "source-profil");
  donnees.append("fichiers", f, f.name);
  const [recu] = await api<FichierTeleverse[]>("/api/fichiers", { methode: "POST", corps: donnees });
  if (!recu) throw new ErreurApi(500, "Le fichier n'a pas été reçu. Réessayez.");
  return recu;
}

/** Une photo a-t-elle un fond transparent ? (pour proposer la forme « détourée ») */
export async function photoTransparente(f: File): Promise<boolean> {
  if (f.type !== "image/png" && f.type !== "image/webp") return false;
  try {
    const image = await createImageBitmap(f);
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0, 64, 64);
    const px = ctx.getImageData(0, 0, 64, 64).data;
    let transparents = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] < 20) transparents++;
    return transparents > 64 * 64 * 0.12;
  } catch {
    return false;
  }
}
