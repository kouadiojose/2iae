// Routes du chantier C2 (objectif du jour), réservées aux étudiants. Branché
// dans routes/index.ts par le socle commun (C0) ; le moteur est dans
// server/engagement/objectif.ts.
//
//   GET  /api/objectif-du-jour          l'objectif du jour (choisi et figé au premier passage)
//   POST /api/objectif-du-jour/ouvert   { cle } : « À retenir » lu sur l'accueil (seule ligne qui se coche
//                                       à l'ouverture ; un rattrapage demande un vrai travail)
import type { Express } from "express";
import { z } from "zod";
import { exigerRole, moi } from "../auth";
import { route, valider, ErreurHttp } from "../http";
import { noterOuverture, objectifDuJour } from "../engagement/objectif";
import { CLE_OUVERTURE } from "@shared/engagement/objectif";

const schemaOuverture = z.object({ cle: z.string().regex(CLE_OUVERTURE, "clé d'élément invalide") });

export function enregistrerObjectif(app: Express) {
  app.get(
    "/api/objectif-du-jour",
    exigerRole("etudiant"),
    route(async (req, res) => {
      res.setHeader("Cache-Control", "private, no-cache");
      res.json(await objectifDuJour(moi(req)));
    }),
  );

  app.post(
    "/api/objectif-du-jour/ouvert",
    exigerRole("etudiant"),
    route(async (req, res) => {
      const u = moi(req);
      const { cle } = valider(schemaOuverture, req.body);
      if (!(await noterOuverture(u, cle))) throw new ErreurHttp(404, "Cette ligne ne fait pas partie de ton objectif du jour.");
      res.json(await objectifDuJour(u));
    }),
  );
}
