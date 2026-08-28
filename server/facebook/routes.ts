// Routes de l'intégration Facebook.
//
//   GET  /api/webhooks/facebook   vérification de l'abonnement par Meta
//   POST /api/webhooks/facebook   notification temps réel d'une publication
//   POST /api/admin/facebook/sync rattrapage manuel depuis l'administration
//   GET  /api/admin/facebook/log  journal des publications vues
//   GET  /api/admin/facebook/etat état de la configuration

import type { Express, Request, Response } from "express";
import express from "express";
import { db } from "../db";
import { facebookPosts } from "@shared/schema";
import { desc } from "drizzle-orm";
import { signatureValide, integrationActive } from "./graph";
import {
  synchroniser,
  synchroniserUne,
  dedupliquerBannieres,
  harmoniserBannieres,
  reviserArticlesPublies,
  creerBannieresManquantes,
  ameliorerImagesBannieres,
} from "./sync";
import { NOMS_RUBRIQUES } from "./classification";

/** Intervalle du rattrapage périodique, en minutes. */
const RATTRAPAGE_MIN = Number(process.env.FACEBOOK_SYNC_INTERVAL_MINUTES || 60);

export function enregistrerRoutesFacebook(
  app: Express,
  requireAdmin: (req: Request, res: Response, next: () => void) => void,
) {
  // --- Vérification de l'abonnement (Meta appelle cette URL une fois) -------
  app.get("/api/webhooks/facebook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.FACEBOOK_VERIFY_TOKEN) {
      console.log("✅ Webhook Facebook vérifié par Meta");
      return res.status(200).send(String(challenge ?? ""));
    }
    console.warn("⚠️  Vérification du webhook Facebook refusée (jeton incorrect)");
    res.sendStatus(403);
  });

  // --- Notification temps réel ---------------------------------------------
  // express.raw est indispensable : la signature HMAC porte sur les octets
  // exacts du corps, qu'un parseur JSON altérerait.
  app.post(
    "/api/webhooks/facebook",
    express.raw({ type: "application/json", limit: "5mb" }),
    async (req: Request, res: Response) => {
      const corps = req.body as Buffer;

      if (!signatureValide(corps, req.header("x-hub-signature-256"))) {
        console.warn("⚠️  Webhook Facebook rejeté : signature invalide");
        return res.sendStatus(403);
      }

      // Meta réessaie si la réponse tarde : on accuse réception tout de suite
      // et on traite ensuite, hors du cycle de la requête.
      res.sendStatus(200);

      try {
        const charge = JSON.parse(corps.toString("utf8"));
        const ids = new Set<string>();

        for (const entree of charge.entry ?? []) {
          for (const chg of entree.changes ?? []) {
            if (chg.field !== "feed") continue;
            const v = chg.value ?? {};
            // On ne traite que l'ajout d'une publication de la page
            if (v.item !== "status" && v.item !== "photo" && v.item !== "video") continue;
            if (v.verb !== "add") continue;
            const id = v.post_id || v.link_id;
            if (id) ids.add(String(id));
          }
        }

        // Array.from plutôt qu'un for..of sur le Set : le projet compile vers
        // ES5, où l'itération directe d'un Set n'est pas disponible.
        for (const id of Array.from(ids)) {
          const r = await synchroniserUne(id);
          if (r.details.length) console.log(`📘 Facebook (webhook) : ${r.details.join(" | ")}`);
        }
      } catch (err) {
        console.error("❌ Traitement du webhook Facebook :", (err as Error).message);
      }
    },
  );

  // --- Rattrapage manuel ----------------------------------------------------
  app.post("/api/admin/facebook/sync", requireAdmin, async (req, res) => {
    try {
      const limite = Math.min(Number(req.body?.limite) || 25, 100);
      const resultat = await synchroniser(limite);
      res.json({ success: true, resultat });
    } catch (err) {
      console.error("❌ Synchronisation Facebook :", (err as Error).message);
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  // --- Journal --------------------------------------------------------------
  app.get("/api/admin/facebook/log", requireAdmin, async (_req, res) => {
    try {
      const lignes = await db
        .select()
        .from(facebookPosts)
        .orderBy(desc(facebookPosts.publishedAt))
        .limit(100);
      res.json({ success: true, posts: lignes });
    } catch (err) {
      res.status(500).json({ success: false, error: (err as Error).message });
    }
  });

  // --- État de la configuration --------------------------------------------
  app.get("/api/admin/facebook/etat", requireAdmin, (_req, res) => {
    res.json({
      success: true,
      etat: {
        configure: integrationActive(),
        pageId: process.env.FACEBOOK_PAGE_ID ?? null,
        webhookPret: Boolean(process.env.FACEBOOK_VERIFY_TOKEN && process.env.FACEBOOK_APP_SECRET),
        classementIA: Boolean(process.env.OPENAI_API_KEY),
        rattrapageMinutes: RATTRAPAGE_MIN,
        rubriques: NOMS_RUBRIQUES,
      },
    });
  });
}

/**
 * Rattrapage périodique.
 *
 * Le webhook seul ne suffit pas : une notification peut se perdre pendant un
 * redéploiement ou une panne réseau, et Meta n'a alors aucun moyen de la
 * rejouer. Ce filet relit la page à intervalle régulier ; l'idempotence de la
 * synchronisation fait que rien n'est publié deux fois.
 */
export function demarrerRattrapage(): void {
  if (!integrationActive()) {
    console.log("ℹ️  Intégration Facebook inactive (FACEBOOK_PAGE_TOKEN absent).");
    return;
  }

  const intervalle = Math.max(15, RATTRAPAGE_MIN) * 60_000;

  const tourner = async () => {
    try {
      // Rattrapage des bannières redondantes créées avant la déduplication.
      const nettoyees = await dedupliquerBannieres();
      if (nettoyees) console.log(`📘 Facebook : ${nettoyees} bannière(s) redondante(s) retirée(s)`);

      // Bannières dont le texte ne dit rien de l'image qu'elles portent.
      const harmonisees = await harmoniserBannieres();
      harmonisees.forEach((t) => console.log(`📘 Facebook : bannière réaccordée — ${t}`));

      // Relecture des articles partis en ligne avant la mise en place du
      // relecteur, par petits lots.
      const relus = await reviserArticlesPublies();
      relus.forEach((t) => console.log(`📘 Facebook : article corrigé — ${t}`));

      // Repêchage des contenus forts restés sans bannière.
      const repechees = await creerBannieresManquantes();
      repechees.forEach((t) => console.log(`📘 Facebook : bannière créée — ${t}`));

      // Bannières dont l'article offre un visuel plus parlant.
      const mieuxIllustrees = await ameliorerImagesBannieres();
      mieuxIllustrees.forEach((t) => console.log(`📘 Facebook : visuel remplacé — ${t}`));

      const r = await synchroniser(25);
      if (r.publiees || r.ecartees || r.echecs) {
        console.log(
          `📘 Facebook : ${r.publiees} publiée(s), ${r.ecartees} écartée(s), ` +
            `${r.ignorees} déjà connue(s), ${r.echecs} échec(s)`,
        );
        r.details.forEach((d) => console.log(`   ${d}`));
      }
    } catch (err) {
      console.error("❌ Rattrapage Facebook :", (err as Error).message);
    }
  };

  // Premier passage différé : laisse l'application finir son démarrage.
  setTimeout(tourner, 30_000);
  setInterval(tourner, intervalle);

  console.log(`✅ Rattrapage Facebook actif (toutes les ${Math.max(15, RATTRAPAGE_MIN)} min)`);
}
