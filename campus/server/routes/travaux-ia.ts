// Routine du soir (IA du soir) : elle fait le travail d'IA de fond sans crédit d'API.
//
//   POST /api/travaux-ia/tour                    fait avancer les travaux en attente (cours complets, lectures),
//                                                puis liste les demandes gardées sans réponse
//   GET  /api/travaux-ia/demandes                ces demandes (sans leur contenu)
//   GET  /api/travaux-ia/demandes/:id            une demande complète : consignes, messages, schéma
//   POST /api/travaux-ia/demandes/:id/reponse    { reponse } : gardée si elle respecte le schéma, sinon les écarts
//
// Accès : en-tête « Authorization: Bearer <TRAVAUX_IA_JETON> » (variable Railway du service campus). Cette clé
// ne permet que cela : lire les demandes gardées et y répondre. Sans la variable, ces routes n'existent pas.
import crypto from "node:crypto";
import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { config } from "../config";
import { route, valider, idParam, introuvable, ErreurHttp } from "../http";
import { iaDuSoir, demandesEnAttente, demande, repondre } from "../ia-soir";
import { etudierSeance, seancesAPreparer } from "../etude-cours";
import { livresAEtudier, reprendreLecture } from "../etude-livre";

const exigerJeton: RequestHandler = (req, _res, next) => {
  const attendu = config.ia.jetonSoir;
  if (!attendu) return next(new ErreurHttp(404, "Introuvable."));
  const recu = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(recu);
  const b = Buffer.from(attendu);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return next(new ErreurHttp(401, "Clé de la routine du soir invalide."));
  next();
};

/** Un seul tour à la fois (deux routines lancées ensemble ne prépareraient pas deux fois le même cours). */
let tourEnCours = false;

export function enregistrerTravauxIa(app: Express) {
  app.post(
    "/api/travaux-ia/tour",
    exigerJeton,
    route(async (_req, res) => {
      if (!iaDuSoir()) throw new ErreurHttp(409, "Le campus appelle l'API d'IA directement (CAMPUS_IA_SOIR n'est pas à « oui ») : rien à faire ce soir.");
      if (tourEnCours) throw new ErreurHttp(409, "Un tour est déjà en cours.");
      tourEnCours = true;
      const bilan: { travail: string; issue: string }[] = [];
      try {
        // Chaque travail avance jusqu'à sa prochaine demande sans réponse, ou jusqu'au bout (les étudiants sont alors prévenus).
        for (const id of await seancesAPreparer(20, true)) bilan.push({ travail: `cours-complet:${id}`, issue: await etudierSeance(id) });
        for (const id of await livresAEtudier(10)) bilan.push({ travail: `livre:${id}`, issue: await reprendreLecture(id) });
      } finally {
        tourEnCours = false;
      }
      res.json({ bilan, demandes: await demandesEnAttente() });
    }),
  );

  app.get(
    "/api/travaux-ia/demandes",
    exigerJeton,
    route(async (_req, res) => {
      res.json(await demandesEnAttente());
    }),
  );

  app.get(
    "/api/travaux-ia/demandes/:id",
    exigerJeton,
    route(async (req, res) => {
      const d = await demande(idParam(req));
      if (!d) throw introuvable("Demande");
      res.json({ id: d.id, origine: d.origine, creeLe: d.creeLe.toISOString(), repondue: Boolean(d.reponduLe), requete: d.requete });
    }),
  );

  app.post(
    "/api/travaux-ia/demandes/:id/reponse",
    exigerJeton,
    route(async (req, res) => {
      const { reponse } = valider(z.object({ reponse: z.unknown() }), req.body);
      const r = await repondre(idParam(req), reponse);
      if (!r.ok) return res.status(422).json({ message: "La réponse ne respecte pas le schéma demandé.", ecarts: r.ecarts });
      res.json({ ok: true });
    }),
  );
}
