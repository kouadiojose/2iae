// Replays dans le bucket Railway des replays.
//
// Après le cours, Daily encode l'enregistrement ; le campus le recopie alors,
// en flux (jamais entier en mémoire ni sur le disque), dans le bucket. Les
// étudiants lisent ensuite la vidéo directement dans le bucket, par un lien
// signé de quelques heures : l'application ne sert aucun octet de vidéo. La
// copie Daily est effacée après un délai de sécurité (REPLAYS_GARDER_DAILY_JOURS).
import { config } from "./config";
import { creerBucket } from "./stockage";

const replays = creerBucket(config.replays, "replays");

/** Le bucket des replays est-il configuré ? */
export const stockageReplaysDisponible = () => replays.disponible();

/** Copie une vidéo (lien de téléchargement Daily) vers le bucket, taille vérifiée. */
export async function copierVersBucket(source: string, cle: string): Promise<{ tailleOctets: number }> {
  return { tailleOctets: await replays.envoyerDepuisUrl(source, cle, "video/mp4") };
}

/** Lien de lecture signé, valable quelques heures (le lecteur le redemande au besoin). */
export const lienReplayBucket = (cle: string, validiteSecondes = 6 * 3600) => replays.lienSigne(cle, { validiteSecondes });

export const supprimerDuBucket = (cle: string) => replays.supprimer(cle);
