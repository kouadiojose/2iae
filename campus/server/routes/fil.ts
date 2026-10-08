// « Le travail du campus » : fil des séances et grands chiffres (contrat : shared/engagement/fil.ts ; calculs :
// server/engagement/fil.ts).
//
//   GET /api/fil/seances?cours=&formateur=&site=&avant=&limite=   → FilSeances (de la plus récente à la plus ancienne)
//   GET /api/fil/resume?jours=7|30&site=[&cours=&formateur=]      → ResumeTravail
//
// Accès : formateur (les cours qu'il enseigne, co-formateurs compris) ; direction : tout, avec les filtres ; vie
// scolaire : son campus, avec le droit « notes » ou « presences_voir ». Étudiant et écran de salle : 403. Un campus
// hors du périmètre répond 403 (siteGere), comme le reste du pilotage. Aucune donnée nominative d'étudiant.
// Réponses en « private, no-cache » ; calculs gardés deux minutes par périmètre et par filtre.
import type { Express } from "express";
import { z } from "zod";
import { exigerRole, droitSiEquipe, moi } from "../auth";
import { route, valider } from "../http";
import { siteGere } from "./admin";
import { filSeances, resumeTravail, LIMITE_FIL, LIMITE_FIL_MAX, PERIODES_FIL, type FiltresFil } from "../engagement/fil";
import type { Utilisateur } from "@shared/schema";

/** Paramètre vide (« ?cours= ») : comme absent. */
const facultatif = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => (v === "" ? undefined : v), schema.optional());
const identifiant = facultatif(z.coerce.number().int().positive());

const schemaFiltres = z.object({ cours: identifiant, formateur: identifiant, site: identifiant });

const schemaFil = schemaFiltres.extend({
  // Curseur rendu par la page précédente (date réelle, ISO 8601, jusqu'à la microseconde).
  avant: facultatif(z.string().datetime({ offset: true }).refine((v) => !Number.isNaN(Date.parse(v)), "date invalide")),
  limite: facultatif(z.coerce.number().int().min(1).max(LIMITE_FIL_MAX)),
});

const schemaResume = schemaFiltres.extend({
  jours: facultatif(
    z.coerce
      .number()
      .int()
      .refine((n) => (PERIODES_FIL as readonly number[]).includes(n), `période attendue : ${PERIODES_FIL.join(" ou ")} jours`),
  ),
});

/** Filtres validés : la vie scolaire ne choisit qu'un campus de son périmètre. */
async function filtresDe(u: Utilisateur, f: z.infer<typeof schemaFiltres>): Promise<FiltresFil> {
  if (f.site && u.role !== "formateur") await siteGere(u, f.site);
  return { coursId: f.cours, formateurId: f.formateur, siteId: f.site };
}

export function enregistrerFil(app: Express) {
  app.get(
    "/api/fil/seances",
    exigerRole("formateur", "admin", "vie_scolaire"),
    droitSiEquipe("notes", "presences_voir"),
    route(async (req, res) => {
      const u = moi(req);
      const q = valider(schemaFil, req.query);
      const fil = await filSeances(u, { ...(await filtresDe(u, q)), avant: q.avant, limite: q.limite ?? LIMITE_FIL });
      res.setHeader("Cache-Control", "private, no-cache");
      res.json(fil);
    }),
  );

  app.get(
    "/api/fil/resume",
    exigerRole("formateur", "admin", "vie_scolaire"),
    droitSiEquipe("notes", "presences_voir"),
    route(async (req, res) => {
      const u = moi(req);
      const q = valider(schemaResume, req.query);
      const resume = await resumeTravail(u, { ...(await filtresDe(u, q)), jours: q.jours ?? PERIODES_FIL[0] });
      res.setHeader("Cache-Control", "private, no-cache");
      res.json(resume);
    }),
  );
}
