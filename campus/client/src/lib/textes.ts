// Textes côté client (couche commune : shared/textes/index.ts). useTextes(t)
// lie le traducteur d'un dictionnaire au registre de la personne connectée
// (étudiant tutoyé, personnel vouvoyé) et à la langue du campus.
import { useCallback } from "react";
import { LANGUE_PAR_DEFAUT, registreDe, type OptionsTexte, type Traducteur } from "@shared/textes";
import { useMoi } from "./auth";

export function useTextes<C extends string>(t: Traducteur<C>): Traducteur<C> {
  const { moi } = useMoi();
  const registre = registreDe(moi?.role);
  return useCallback((cle: C, options?: OptionsTexte) => t(cle, { registre, langue: LANGUE_PAR_DEFAUT, ...options }), [t, registre]);
}
