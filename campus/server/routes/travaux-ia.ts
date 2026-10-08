// Routine du soir (IA du soir) : elle fait le travail d'IA de fond sans crédit d'API.
//
//   POST /api/travaux-ia/tour                    applique les réponses déjà données, fait avancer les travaux en
//                                                attente (corrigés à rédiger, cours complets, lectures, copies à
//                                                corriger), puis liste les demandes gardées sans réponse et le
//                                                nombre de copies encore à préparer (aSuivre)
//   GET  /api/travaux-ia/demandes                ces demandes (sans leur contenu)
//   GET  /api/travaux-ia/demandes/:id            une demande complète : consignes, messages, schéma
//   POST /api/travaux-ia/demandes/:id/reponse    { reponse } : gardée si elle respecte le schéma (et, pour une
//                                                copie, sa référence, la grille et le barème), sinon les écarts
//
// Un tour prépare les copies pendant BUDGET_TOUR_MS au plus (lecture du bucket, conversions), en plus de la
// limite COPIES_PAR_TOUR : il répond bien avant que l'outil de la routine abandonne ; les copies restantes vont
// au tour suivant, que la routine relance tant qu'il reste des demandes ou des copies à préparer.
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
import { corrigesAPreparer, preparerCorrige } from "../corriges";
import { appliquerReponsesCopies, copiesACorriger, copiesAPreparer, corrigerCopie, ecartsReponseCopie } from "../correction-auto";
import { COPIES_PAR_TOUR } from "@shared/engagement/corrections";

/** Temps de préparation d'un tour (depuis son début) : au-delà, plus aucune copie n'est préparée ce tour-ci. */
const BUDGET_TOUR_MS = 90_000;

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
      // Un autre tour travaille encore (l'outil a abandonné l'attente, ou deux routines) : l'outil réessaie plus tard.
      if (tourEnCours) throw new ErreurHttp(409, "Un tour est déjà en cours.", { code: "tour_en_cours" });
      tourEnCours = true;
      const debut = Date.now();
      const bilan: { travail: string; issue: string }[] = [];
      try {
        // Les réponses déjà données d'abord (notes publiées ou copies à revoir) : les places du tour vont à de
        // nouvelles copies, et une réponse rejetée est redemandée ce soir même.
        for (const { id, issue } of await appliquerReponsesCopies()) bilan.push({ travail: `copie:${id}`, issue });
        // Chaque travail avance jusqu'à sa prochaine demande sans réponse, ou jusqu'au bout (les étudiants sont alors prévenus).
        // Corrigés d'abord (ceux des devoirs écrits par les formateurs), puis les cours complets (qui créent les devoirs
        // automatiques et leurs corrigés), les lectures, et enfin les copies dont le corrigé sert déjà de barème.
        for (const id of await corrigesAPreparer(30)) bilan.push({ travail: `corrige:${id}`, issue: await preparerCorrige(id) });
        for (const id of await seancesAPreparer(20, true)) bilan.push({ travail: `cours-complet:${id}`, issue: await etudierSeance(id) });
        for (const id of await livresAEtudier(10)) bilan.push({ travail: `livre:${id}`, issue: await reprendreLecture(id) });
        for (const id of await copiesACorriger(COPIES_PAR_TOUR)) {
          // Budget du tour épuisé (copies lourdes à convertir) : les suivantes attendent le tour suivant.
          if (Date.now() - debut > BUDGET_TOUR_MS) break;
          bilan.push({ travail: `copie:${id}`, issue: await corrigerCopie(id) });
        }
      } finally {
        tourEnCours = false;
      }
      res.json({ bilan, demandes: await demandesEnAttente(), aSuivre: await copiesAPreparer() });
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
      // Copie : la réponse recopie la référence de SA copie, note chaque critère de la grille par son nom, dans le
      // barème. Refusée tout de suite sinon (la routine la refait ce soir, sans perdre d'essai).
      const r = await repondre(idParam(req), reponse, (d) => ecartsReponseCopie(d.origine, d.requete.contexte, reponse));
      if (!r.ok) return res.status(422).json({ message: "La réponse ne respecte pas le schéma demandé.", ecarts: r.ecarts });
      res.json({ ok: true });
    }),
  );
}
