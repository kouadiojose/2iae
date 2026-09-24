// Module PWA : installation, rappels sur le téléphone, mode hors ligne.
// Point d'entrée pour les autres modules (les chemins directs restent valables).
export { ActiverNotifications } from "./ActiverNotifications";
export { InviteInstallation } from "./InviteInstallation";
export { AvertissementNavigateur, navigateurLimite } from "./AvertissementNavigateur";
export { enregistrerServiceWorker, obtenirEnregistrement } from "./service-worker";
export { useInstallation, installer } from "./installation";
