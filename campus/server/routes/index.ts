// Enregistrement de toutes les routes de l'API, module par module.
import type { Express } from "express";
import { enregistrerAuth } from "./auth";
import { enregistrerCompte } from "./compte";
import { enregistrerAccueil } from "./accueil";
import { enregistrerCours } from "./cours";
import { enregistrerLive } from "./live";
import { enregistrerEvaluations } from "./evaluations";
import { enregistrerMessages } from "./messages";
import { enregistrerAnnonces } from "./annonces";
import { enregistrerAgenda } from "./agenda";
import { enregistrerAdmin } from "./admin";
import { enregistrerIa } from "./ia";
import { enregistrerPublic } from "./public";
import { enregistrerPush } from "./push";
import { enregistrerProgramme } from "./programme";
import { enregistrerLancement } from "./lancement";
import { enregistrerShowreel } from "./showreel";
import { enregistrerEquipe } from "./equipe";
import { enregistrerAndroid } from "./android";
import { enregistrerInvite } from "./live-invite";
import { enregistrerCrm } from "./crm";
import { enregistrerScolarite } from "./scolarite";
import { enregistrerVisioCampus } from "../visio-campus";

export function enregistrerRoutes(app: Express) {
  enregistrerPublic(app);
  enregistrerAndroid(app);
  enregistrerAuth(app);
  enregistrerCompte(app);
  enregistrerAccueil(app);
  enregistrerCours(app);
  enregistrerLive(app);
  enregistrerInvite(app);
  enregistrerEvaluations(app);
  enregistrerMessages(app);
  enregistrerAnnonces(app);
  enregistrerAgenda(app);
  enregistrerAdmin(app);
  enregistrerCrm(app);
  enregistrerScolarite(app);
  enregistrerIa(app);
  enregistrerPush(app);
  enregistrerProgramme(app);
  enregistrerLancement(app);
  enregistrerShowreel(app);
  enregistrerEquipe(app);
  enregistrerVisioCampus(app);
}
