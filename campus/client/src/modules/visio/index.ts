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
export { LieuDuCours } from "./Lieu";
export { useOptionsVisio } from "./options";
// Radio de toute la classe : le micro du formateur mélangé au son de la visio Daily.
export { useRadioClasse } from "./radio-classe";
