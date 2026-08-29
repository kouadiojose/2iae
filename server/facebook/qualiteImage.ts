// Rejet des visuels qui ne montrent rien.
//
// Une publication vidéo de la page arrive dans le Graph API avec, pour
// illustration, la première image du film. Quand cette image est un fondu au
// noir, le site affiche un rectangle entièrement noir à la place de
// l'actualité — c'est arrivé sur « Choisir une école d'excellence après le
// bac », dont la vignette mesurait 720 × 405 pour 2,3 Ko et n'avait ni un
// pixel clair ni la moindre variation.
//
// Aucune bibliothèque d'images n'est installée, et en ajouter une pour ce seul
// contrôle serait disproportionné. On s'appuie donc sur une propriété du JPEG
// lui-même : le format ne code que les écarts entre pixels voisins, si bien
// qu'une image uniforme se comprime jusqu'à disparaître. La densité en octets
// par pixel sépare donc nettement une photographie d'une image vide.
//
// Mesures relevées sur les 28 visuels du site :
//   vignette noire      0,0080 octet/pixel
//   plus faible photo   0,0684 octet/pixel
// Le seuil est posé à 0,02 : plus de trois fois au-dessus du cas fautif, plus
// de trois fois en dessous du visuel le plus léger. Aucune image légitime du
// fonds n'en approche.

/** En deçà de cette densité, l'image ne porte aucune information visible. */
const DENSITE_MINIMALE = 0.02;

/** Taille en deçà de laquelle un fichier est vide quoi qu'il contienne. */
const OCTETS_MINIMAUX = 1024;

/**
 * Dimensions d'une image, lues dans son en-tête.
 *
 * Retourne null si le format n'est pas reconnu : mieux vaut laisser passer une
 * image qu'on n'a pas su mesurer que d'en écarter une bonne.
 */
export function dimensions(donnees: Buffer): { largeur: number; hauteur: number } | null {
  // PNG : la taille figure dans le bloc IHDR, toujours en tête du fichier.
  if (donnees.length > 24 && donnees.readUInt32BE(0) === 0x89504e47) {
    return { largeur: donnees.readUInt32BE(16), hauteur: donnees.readUInt32BE(20) };
  }

  // WebP : l'en-tête RIFF précède un bloc VP8, VP8L ou VP8X selon l'encodage.
  if (
    donnees.length > 30 &&
    donnees.toString("ascii", 0, 4) === "RIFF" &&
    donnees.toString("ascii", 8, 12) === "WEBP"
  ) {
    const bloc = donnees.toString("ascii", 12, 16);
    if (bloc === "VP8X") {
      return {
        largeur: 1 + (donnees.readUIntLE(24, 3) & 0xffffff),
        hauteur: 1 + (donnees.readUIntLE(27, 3) & 0xffffff),
      };
    }
    if (bloc === "VP8 ") {
      return {
        largeur: donnees.readUInt16LE(26) & 0x3fff,
        hauteur: donnees.readUInt16LE(28) & 0x3fff,
      };
    }
    if (bloc === "VP8L") {
      const bits = donnees.readUInt32LE(21);
      return { largeur: 1 + (bits & 0x3fff), hauteur: 1 + ((bits >> 14) & 0x3fff) };
    }
    return null;
  }

  // JPEG : parcours des segments jusqu'au marqueur de trame (SOFn), qui porte
  // la taille. Les marqueurs 0xC4, 0xC8 et 0xCC portent d'autres tables et ne
  // doivent pas être confondus avec eux.
  if (donnees.length > 4 && donnees.readUInt16BE(0) === 0xffd8) {
    let i = 2;
    while (i + 9 < donnees.length) {
      if (donnees[i] !== 0xff) {
        i++;
        continue;
      }
      const marqueur = donnees[i + 1];
      if (marqueur === 0xd8 || marqueur === 0x01 || (marqueur >= 0xd0 && marqueur <= 0xd7)) {
        i += 2;
        continue;
      }
      const longueur = donnees.readUInt16BE(i + 2);
      const estTrame =
        marqueur >= 0xc0 && marqueur <= 0xcf && marqueur !== 0xc4 && marqueur !== 0xc8 && marqueur !== 0xcc;
      if (estTrame) {
        return { largeur: donnees.readUInt16BE(i + 7), hauteur: donnees.readUInt16BE(i + 5) };
      }
      if (longueur < 2) return null;
      i += 2 + longueur;
    }
  }

  return null;
}

/**
 * L'image est-elle vide de tout contenu visible ?
 *
 * Un fichier dont on ne sait pas lire les dimensions n'est écarté que s'il est
 * manifestement trop petit pour contenir une image : le doute profite au
 * visuel.
 */
export function imageSansInformation(donnees: Buffer): boolean {
  if (donnees.length < OCTETS_MINIMAUX) return true;

  const taille = dimensions(donnees);
  if (!taille || taille.largeur < 1 || taille.hauteur < 1) return false;

  return donnees.length / (taille.largeur * taille.hauteur) < DENSITE_MINIMALE;
}
