// Scène de visio intégrée (WebRTC pair-à-pair en étoile autour du formateur).
export type EtatVisio = "connexion" | "connecte" | "reconnexion" | "echec" | "ferme";

export type PropsSceneVisioCampus = {
  seanceId: number;
  /** formateur : centre de l'étoile · salle : écran d'une salle de conférence · etudiant : en ligne (audio seul pour recevoir la parole). */
  role: "formateur" | "salle" | "etudiant";
  /** Site de la salle (rôle salle) ou de l'étudiant. */
  siteId?: number | null;
  nomAffiche: string;
  micro: boolean;
  camera: boolean;
  /** Ne recevoir que le son (économie de données). */
  audioSeul?: boolean;
  /** Formateur : site qui a la parole (son relayé aux autres salles). */
  siteALaParole?: number | null;
  /** Utilisateur (étudiant en ligne) qui a la parole en audio. */
  utilisateurALaParole?: number | null;
  onEtat?: (etat: EtatVisio) => void;
  /** Formateur : flux micro/caméra local, pour la radio et l'aperçu. */
  onFluxLocal?: (flux: MediaStream | null) => void;
  className?: string;
};

export function SceneVisioCampus(_props: PropsSceneVisioCampus) {
  return null; // Implémenté par le module visio.
}
