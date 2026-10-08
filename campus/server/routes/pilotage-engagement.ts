// Routes du chantier C8 (tableau « Engagement et participation ») :
//   GET /api/pilotage/engagement?jours=30&site=&classe=[&frais=1]
//   GET /api/pilotage/engagement/export?jours=30&site=&classe=   (CSV par classe)
// Réservées à la direction et à la vie scolaire qui a le droit « presences_voir »
// (exigerDroit : un étudiant, un formateur ou un écran de salle reçoit 403),
// toujours limitées au périmètre de la personne (perimetreSites) : la vie
// scolaire de Yopougon ne voit que Yopougon. Aucune donnée nominative
// d'étudiant. Calculs : server/engagement/indicateurs.ts (gardés 10 minutes).
// Posé vide par le socle commun (C0) et déjà branché dans routes/index.ts.
import type { Express } from "express";
import { z } from "zod";
import { asc } from "drizzle-orm";
import { db } from "../db";
import { exigerDroit, moi, perimetreSites } from "../auth";
import { route, valider } from "../http";
import { classeGeree, journaliser, siteGere } from "./admin";
import { exportParClasse, indicateursEngagement, type FiltreEngagement } from "../engagement/indicateurs";
import { PERIODES, PERIODE_PAR_DEFAUT } from "@shared/engagement/indicateurs";
import { jourLocal } from "@shared/engagement/calendrier";
import { t } from "@shared/textes/engagement";
import { sites, type Utilisateur } from "@shared/schema";

const schemaFiltre = z.object({
  jours: z.coerce
    .number()
    .int()
    .refine((n) => (PERIODES as readonly number[]).includes(n), `période attendue : ${PERIODES.join(", ")} jours`)
    .default(PERIODE_PAR_DEFAUT),
  site: z.coerce.number().int().positive().optional(),
  classe: z.coerce.number().int().positive().optional(),
  frais: z.enum(["1"]).optional(),
});

/** Filtre validé : un campus ou une classe hors du périmètre répond 403 ou 404, comme le reste du pilotage. */
async function filtreDe(u: Utilisateur, requete: unknown): Promise<FiltreEngagement & { frais: boolean }> {
  const f = valider(schemaFiltre, requete);
  if (f.site) await siteGere(u, f.site);
  if (f.classe) await classeGeree(u, f.classe);
  return { jours: f.jours, siteId: f.site ?? null, classeId: f.classe ?? null, frais: f.frais === "1" };
}

async function perimetreDe(u: Utilisateur) {
  const p = perimetreSites(u);
  if (!p) return { tout: true, site: null };
  const liste = await db.select({ id: sites.id, nomCourt: sites.nomCourt }).from(sites).orderBy(asc(sites.ordre));
  const mien = liste.filter((s) => p.includes(s.id));
  return { tout: false, site: mien.length === 1 ? mien[0].nomCourt : null };
}

/** Cellule CSV (séparateur « ; », comme l'export des présences). */
const cellule = (v: string | number | null) => {
  const x = v === null ? "" : String(v);
  return /[;"\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x;
};

export function enregistrerPilotageEngagement(app: Express) {
  app.get(
    "/api/pilotage/engagement",
    exigerDroit("presences_voir"),
    route(async (req, res) => {
      const u = moi(req);
      const f = await filtreDe(u, req.query);
      const resultat = await indicateursEngagement(perimetreSites(u), await perimetreDe(u), f, f.frais);
      res.setHeader("Cache-Control", "private, no-cache");
      res.json(resultat);
    }),
  );

  app.get(
    "/api/pilotage/engagement/export",
    exigerDroit("presences_voir"),
    route(async (req, res) => {
      const u = moi(req);
      const f = await filtreDe(u, req.query);
      const lignes = await exportParClasse(perimetreSites(u), f);
      const contenu = [
        [
          t("csv.campus"),
          t("csv.classe"),
          t("csv.inscrits"),
          t("csv.ouverts7j"),
          t("csv.apprenants7j"),
          t("csv.mediane"),
          t("csv.presents", { v: { n: f.jours } }),
          t("csv.absents"),
          t("csv.inconnus"),
          t("csv.presenceConnue"),
          t("csv.copies"),
          t("csv.qcmAuto"),
        ].join(";"),
        ...lignes.map((l) =>
          [
            l.site,
            l.classe,
            l.inscrits,
            l.ouverts7j,
            l.apprenants7j,
            l.medianeSemaine === null ? null : String(l.medianeSemaine).replace(".", ","),
            l.presents,
            l.absents,
            l.inconnus,
            l.presenceConnue,
            l.copiesALaDate,
            l.qcmAutoTermines,
          ]
            .map(cellule)
            .join(";"),
        ),
      ].join("\r\n");
      await journaliser(u, "export_engagement", { jours: f.jours, siteId: f.siteId, classeId: f.classeId, lignes: lignes.length });
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="engagement-par-classe-${jourLocal(new Date())}.csv"`);
      res.setHeader("Cache-Control", "no-store");
      // BOM : Excel reconnaît l'UTF-8 et affiche correctement les accents.
      res.send(`﻿${contenu}`);
    }),
  );
}
