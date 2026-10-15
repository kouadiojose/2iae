// Le mur du cours (José, 15 octobre 2026 : « un blog pour poster mes liens, mes fichiers ») : contrats partagés entre
// server/routes/mur.ts et le client (modules/mur). Texte brut (ni Markdown ni HTML) : les liens collés deviennent
// cliquables par le même découpage au serveur et au client (decouperTexte).

export const MUR_TEXTE_MAX = 2000;
export const MUR_FICHIERS_MAX = 5;
export const MUR_LIENS_MAX = 5;
export const MUR_PAR_HEURE = 20;
/** Poids maximal d'un fichier joint (Mo) ; au-delà, « Mes documents » (300 Mo). */
export const MUR_FICHIER_MO = 25;

/** Un lien dans un texte : http(s)://… ou www.… (jamais javascript:, data:…). */
export const MOTIF_LIEN = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
/** Ponctuation de fin de phrase qui ne fait pas partie du lien. */
const FIN_LIEN = /[).,;:!?»”'"\]]+$/;

export type MorceauTexte = { type: "texte"; valeur: string } | { type: "lien"; url: string; affiche: string };

/** L'adresse ouvrable d'un lien trouvé dans le texte (« www.… » → « https://www.… »), ou null s'il n'est pas sûr. */
export function adresseDuLien(brut: string): string | null {
  const url = /^https?:\/\//i.test(brut) ? brut : `https://${brut}`;
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Le texte en morceaux (texte, lien), pour l'afficher sans HTML. */
export function decouperTexte(texte: string): MorceauTexte[] {
  const morceaux: MorceauTexte[] = [];
  let depuis = 0;
  for (const m of texte.matchAll(new RegExp(MOTIF_LIEN.source, "gi"))) {
    const debut = m.index ?? 0;
    let brut = m[0];
    const fin = FIN_LIEN.exec(brut);
    if (fin) brut = brut.slice(0, brut.length - fin[0].length);
    const url = brut ? adresseDuLien(brut) : null;
    if (!url) continue;
    if (debut > depuis) morceaux.push({ type: "texte", valeur: texte.slice(depuis, debut) });
    morceaux.push({ type: "lien", url, affiche: brut });
    depuis = debut + brut.length;
  }
  if (depuis < texte.length) morceaux.push({ type: "texte", valeur: texte.slice(depuis) });
  return morceaux;
}

/** Les liens d'un texte (adresses ouvrables, sans doublon, dans l'ordre). */
export function extraireLiens(texte: string): string[] {
  const vus: string[] = [];
  for (const m of decouperTexte(texte)) if (m.type === "lien" && !vus.includes(m.url)) vus.push(m.url);
  return vus;
}

export type LienPublicationDto = { url: string; titre: string; site: string; youtubeId: string | null };
export type FichierPublicationDto = { id: number; nom: string; mime: string; taille: number; url: string; image: boolean };
export type PublicationDto = {
  id: number;
  auteur: { id: number; nom: string; photoUrl: string | null; etiquette: "professeur" | "direction" };
  texte: string;
  liens: LienPublicationDto[];
  fichiers: FichierPublicationDto[];
  creeLe: string;
  peutSupprimer: boolean;
};

/** GET /api/cours/:id/mur, GET /api/mon-campus/cours/:id/mur */
export type MurDto = {
  cours: { id: number; code: string; titre: string; couleur: string; statut: "brouillon" | "publie" | "archive" };
  peutPublier: boolean;
  /** Qui lit : « 1BTS Riviera · 2BTS Yopougon » (ou « 6 classes · 5 campus ») ; "" : aucune classe. */
  lecteurs: string;
  /** Nombre total de messages du mur, et date du dernier (ISO). */
  total: number;
  dernierLe: string | null;
  publications: PublicationDto[];
  /** Curseur des messages plus anciens (id du dernier), null s'il n'y en a pas. */
  suite: number | null;
};

/** Ce que la page du cours dit du mur (CoursDetail.mur). */
export type ResumeMurCours = { total: number; nonLus: number };
