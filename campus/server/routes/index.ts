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

export function enregistrerRoutes(app: Express) {
  enregistrerPublic(app);
  enregistrerAuth(app);
  enregistrerCompte(app);
  enregistrerAccueil(app);
  enregistrerCours(app);
  enregistrerLive(app);
  enregistrerEvaluations(app);
  enregistrerMessages(app);
  enregistrerAnnonces(app);
  enregistrerAgenda(app);
  enregistrerAdmin(app);
  enregistrerIa(app);
  enregistrerPush(app);
}
