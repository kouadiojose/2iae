// L'écran du compte de campus (« Entrer dans le live », salle d'essai : modules/espace-campus) montre des briques
// communes à l'écran des salles (live/PageSalle, live/EmargementSalle, live/scene, visio/CadreDaily, la Coupe). Côté
// campus, jamais « visio », « Daily », « émargement », « session » ni « régie » (shared/textes/campus.ts) : ces briques
// lisent ce contexte et prennent alors les mots du campus (« Connexion… », « Présence », « Présents par campus »).
import { createContext, useContext } from "react";

export const EcranDuCampus = createContext(false);

/** Vrai sur l'écran du compte de campus (vocabulaire du campus). */
export const useEcranDuCampus = () => useContext(EcranDuCampus);
