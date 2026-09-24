// Lien avec le site vitrine www.2iae.com.
//
// Le site lit la vitrine publique du campus (GET /api/public/vitrine) et la
// met en cache. Quand une publication change (cours annoncé, formateur
// annoncé, live public…), le campus prévient le site par un webhook signé
// (HMAC-SHA256 du corps avec CAMPUS_WEBHOOK_SECRET) pour qu'il se
// rafraîchisse aussitôt, sans attendre l'expiration du cache.
import crypto from "crypto";
import { config } from "./config";

let enAttente: NodeJS.Timeout | null = null;

/** Prévient le site qu'il doit relire la vitrine (regroupé sur 3 s). */
export function prevenirSite(raison: string) {
  if (!config.webhookSite || !config.secretSite) return;
  if (enAttente) clearTimeout(enAttente);
  enAttente = setTimeout(() => {
    enAttente = null;
    void envoyer(raison);
  }, 3000);
}

async function envoyer(raison: string) {
  const corps = JSON.stringify({ evenement: "vitrine.modifiee", raison, horodatage: new Date().toISOString() });
  const signature = crypto.createHmac("sha256", config.secretSite!).update(corps).digest("hex");
  try {
    const r = await fetch(`${config.webhookSite}/api/campus/rafraichir`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Campus-Signature": `sha256=${signature}` },
      body: corps,
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.warn(`[site] webhook refusé (${r.status})`);
  } catch (e) {
    console.warn("[site] webhook injoignable :", (e as Error).message);
  }
}
