// Visio intégrée au campus (sans compte externe), « radio » du cours et Daily.
// Contrat utilisé par les autres modules : ne pas changer les signatures.
export { SceneVisioCampus, type PropsSceneVisioCampus, type EtatVisio } from "./SceneVisioCampus";
export { EmetteurRadio } from "./EmetteurRadio";
export { LecteurRadio } from "./LecteurRadio";
export { TestMicroCamera } from "./TestMicroCamera";
// Daily : cadre commun (classe, essai, répétition), outils du Studio, préparation du formateur.
export { CadreDaily, type ParticipantCadre, type RoleCadre } from "./CadreDaily";
export { OutilsStudio } from "./OutilsStudio";
export { CartePretClasse } from "./CartePretClasse";
export { ChoixFuseau, ConfirmationFuseau } from "./Fuseau";
export { useOptionsVisio } from "./options";
