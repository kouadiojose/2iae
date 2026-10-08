// Routes du chantier C7 (côté formateur). Branché par le socle commun (C0)
// dans routes/index.ts. La logique vit dans server/engagement/formateurs.ts.
//
//   GET  /api/enseigner/apres-seance[?seance=]   dernière séance tenue et ce que le campus en a fait
//   GET  /api/enseigner/copies[?devoir=]         copies rendues sans note, les plus anciennes d'abord
//   POST /api/enseigner/rendus/:id/envoyer       envoie à l'étudiant la note posée sur sa copie
//   GET  /api/enseigner/a-relire                 devoirs de l'IA à relire (facultatif)
//   POST /api/enseigner/devoirs-auto/:id/validation   « C'est bon », « à revoir », ou retour à la règle
//   GET  /api/seances/:id/travail-de-groupe      le devoir du travail de groupe (formateur, étudiant)
//   POST /api/seances/:id/travail-de-groupe      l'ouvre en brouillon (formateur du cours, direction)
//
// Un étudiant n'ouvre jamais /api/enseigner/* (403). Modifier ou dépublier un
// devoir passe par les écrans et les routes existants du module évaluations.
import type { Express, Request } from "express";
import { z } from "zod";
import { exigerConnexion, exigerRole, droitSiEquipe, moi } from "../auth";
import { idParam, invalide, route, valider } from "../http";
import { planifier } from "../taches";
import { seanceDuReplay } from "./live";
import {
  copiesEnAttente,
  devoirsARelire,
  envoyerNote,
  envoyerRelancesFormateurs,
  ouvrirTravailDeGroupe,
  resumeEnseigner,
  travailDeGroupe,
  validerDevoirAuto,
} from "../engagement/formateurs";
import { STATUTS_VALIDATION } from "@shared/engagement/enseigner";

/** Formateurs, direction, et l'équipe qui suit les notes (profil). */
const ENSEIGNANTS = ["formateur", "admin", "vie_scolaire"] as const;

/** Paramètre d'URL entier facultatif (?seance=12) ; absent ou vide : undefined. */
function entierFacultatif(req: Request, nom: string): number | undefined {
  const brut = req.query[nom];
  if (brut === undefined || brut === "") return undefined;
  const n = Number(brut);
  if (!Number.isInteger(n) || n <= 0) throw invalide(`Paramètre « ${nom} » invalide.`);
  return n;
}

const schemaValidation = z.object({
  statut: z.enum(STATUTS_VALIDATION).nullable(),
  remarque: z.string().trim().max(1000).nullable().optional(),
});

export function enregistrerEnseignerSuivi(app: Express) {
  app.get(
    "/api/enseigner/apres-seance",
    exigerRole(...ENSEIGNANTS),
    droitSiEquipe("notes"),
    route(async (req, res) => {
      res.json(await resumeEnseigner(moi(req), entierFacultatif(req, "seance")));
    }),
  );

  app.get(
    "/api/enseigner/copies",
    exigerRole(...ENSEIGNANTS),
    droitSiEquipe("notes"),
    route(async (req, res) => {
      res.json(await copiesEnAttente(moi(req), entierFacultatif(req, "devoir")));
    }),
  );

  app.post(
    "/api/enseigner/rendus/:id/envoyer",
    exigerRole(...ENSEIGNANTS),
    droitSiEquipe("notes"),
    route(async (req, res) => {
      res.json(await envoyerNote(moi(req), idParam(req)));
    }),
  );

  app.get(
    "/api/enseigner/a-relire",
    exigerRole("formateur", "admin"),
    route(async (req, res) => {
      res.json(await devoirsARelire(moi(req)));
    }),
  );

  app.post(
    "/api/enseigner/devoirs-auto/:id/validation",
    exigerRole("formateur", "admin"),
    route(async (req, res) => {
      const v = valider(schemaValidation, req.body);
      res.json(await validerDevoirAuto(moi(req), idParam(req), v.statut, v.remarque ?? null));
    }),
  );

  app.get(
    "/api/seances/:id(\\d+)/travail-de-groupe",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      // Mêmes lecteurs que le cours complet de la séance.
      const s = await seanceDuReplay(u, idParam(req));
      res.json(await travailDeGroupe(u, s));
    }),
  );

  app.post(
    "/api/seances/:id(\\d+)/travail-de-groupe",
    exigerRole(...ENSEIGNANTS),
    droitSiEquipe("notes"),
    route(async (req, res) => {
      const u = moi(req);
      const s = await seanceDuReplay(u, idParam(req));
      res.status(201).json(await ouvrirTravailDeGroupe(u, s));
    }),
  );

  // Rappel du matin des formateurs : la tâche passe toutes les 15 minutes, chacun le reçoit à 8 h chez lui.
  planifier("formateurs-rappel-du-matin", 15 * 60_000, async () => {
    const prevenus = await envoyerRelancesFormateurs();
    if (prevenus.length) console.log(`[rappel des formateurs] ${prevenus.length} formateur(s) prévenu(s).`);
  });
}
