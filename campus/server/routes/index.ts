// Enregistrement de toutes les routes de l'API, module par module.
import type { Express } from "express";
import { enregistrerAuth } from "./auth";
import { enregistrerCompte } from "./compte";
import { enregistrerAccueil } from "./accueil";
import { enregistrerCours } from "./cours";
import { enregistrerMediatheque } from "./mediatheque";
import { enregistrerLive } from "./live";
import { enregistrerRessourcesSeance } from "./ressources-seance";
import { enregistrerEvaluations } from "./evaluations";
import { enregistrerMessages } from "./messages";
import { enregistrerAnnonces } from "./annonces";
import { enregistrerAgenda } from "./agenda";
import { enregistrerAdmin } from "./admin";
import { enregistrerIa } from "./ia";
import { enregistrerBibliotheque } from "./bibliotheque";
import { enregistrerLibres } from "./libres";
import { enregistrerCoursComplets } from "./cours-complets";
// Plan d'engagement (campus/ENGAGEMENT.md) : fichiers posés vides par le socle commun (C0), un par chantier.
import { enregistrerEnvois } from "./envois";
import { enregistrerPilotageEngagement } from "./pilotage-engagement";
import { enregistrerRevision } from "./revision";
import { enregistrerObjectif } from "./objectif";
import { enregistrerEnseignerSuivi } from "./enseigner-suivi";
import { enregistrerProgression } from "./progression";
import { enregistrerRelancesAuto } from "./relances-auto";
import { enregistrerParticipationDirect } from "./participation-direct";
import { enregistrerPublic } from "./public";
import { enregistrerPush } from "./push";
import { enregistrerProgramme } from "./programme";
import { enregistrerLancement } from "./lancement";
import { enregistrerShowreel } from "./showreel";
import { enregistrerEquipe } from "./equipe";
import { enregistrerInscriptionEtudiants } from "./inscription-etudiants";
import { enregistrerFormateurs } from "./formateurs";
import { enregistrerAndroid } from "./android";
import { enregistrerInvite } from "./live-invite";
import { enregistrerCrm } from "./crm";
import { enregistrerScolarite } from "./scolarite";
import { enregistrerVisioCampus } from "../visio-campus";
import { enregistrerTravauxIa } from "./travaux-ia";

export function enregistrerRoutes(app: Express) {
  enregistrerPublic(app);
  enregistrerAndroid(app);
  enregistrerAuth(app);
  enregistrerTravauxIa(app);
  enregistrerCompte(app);
  enregistrerAccueil(app);
  enregistrerCours(app);
  enregistrerMediatheque(app);
  enregistrerLive(app);
  enregistrerRessourcesSeance(app);
  enregistrerInvite(app);
  enregistrerEvaluations(app);
  enregistrerMessages(app);
  enregistrerAnnonces(app);
  enregistrerAgenda(app);
  enregistrerAdmin(app);
  enregistrerCrm(app);
  enregistrerScolarite(app);
  enregistrerIa(app);
  enregistrerBibliotheque(app);
  enregistrerLibres(app);
  enregistrerCoursComplets(app);
  // Plan d'engagement : chaque chantier remplit son fichier, l'index ne change plus.
  enregistrerEnvois(app); // C3
  enregistrerPilotageEngagement(app); // C8
  enregistrerRevision(app); // C1
  enregistrerObjectif(app); // C2
  enregistrerEnseignerSuivi(app); // C7
  enregistrerProgression(app); // C5
  enregistrerRelancesAuto(app); // C4
  enregistrerParticipationDirect(app); // C6
  enregistrerPush(app);
  enregistrerProgramme(app);
  enregistrerLancement(app);
  enregistrerShowreel(app);
  enregistrerEquipe(app);
  enregistrerInscriptionEtudiants(app);
  enregistrerFormateurs(app);
  enregistrerVisioCampus(app);
}
