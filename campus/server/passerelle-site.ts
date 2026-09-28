// Passerelle avec le pipeline des préinscrits du site 2iae.com.
//
// Le campus interroge le site sur son réseau privé (SITE_WEBHOOK_URL), avec
// le secret partagé CAMPUS_WEBHOOK_SECRET : chaque message est signé
// (HMAC-SHA256 du corps), daté et unique (nonce), comme le webhook
// « vitrine.modifiee ». Deux appels :
//
//   POST <site>/api/campus/preinscrits          { action: "lister" }  → les contacts en cours
//   POST <site>/api/campus/preinscrits/inscrit  { action: "inscrit", leadId, matricule, nom, classe, par }
//
// Le campus ne tombe jamais avec le site : lecture bornée à 8 s, et une
// réponse « pas branché » explique quoi faire au lieu d'une erreur.
import crypto from "crypto";
import { config } from "./config";
import type { PreinscritSite } from "@shared/schema";

const DELAI_MS = 8000;

type Lecture = { branche: boolean; message: string | null; preinscrits: Omit<PreinscritSite, "etudiant">[] };

async function appeler(chemin: string, corps: Record<string, unknown>): Promise<Response> {
  const texte = JSON.stringify({ ...corps, horodatage: new Date().toISOString(), nonce: crypto.randomBytes(12).toString("hex") });
  const signature = crypto.createHmac("sha256", config.secretSite!).update(texte).digest("hex");
  return fetch(`${config.webhookSite}${chemin}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Campus-Signature": `sha256=${signature}` },
    body: texte,
    signal: AbortSignal.timeout(DELAI_MS),
  });
}

const chaine = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function lirePreinscritsSite(): Promise<Lecture> {
  if (!config.webhookSite || !config.secretSite) {
    return { branche: false, message: "La passerelle avec 2iae.com n'est pas configurée (adresse du site ou secret partagé manquant).", preinscrits: [] };
  }
  try {
    const r = await appeler("/api/campus/preinscrits", { action: "lister" });
    if (r.status === 404 || (r.headers.get("content-type") ?? "").includes("text/html")) {
      return { branche: false, message: "Le site 2iae.com n'a pas encore la passerelle : elle arrive avec la prochaine mise à jour du site.", preinscrits: [] };
    }
    if (!r.ok) return { branche: false, message: `Le site 2iae.com a refusé la demande (${r.status}).`, preinscrits: [] };
    const j = (await r.json()) as { preinscrits?: Record<string, unknown>[] };
    const preinscrits = (j.preinscrits ?? [])
      .filter((l) => typeof l.id === "string")
      .map((l) => ({
        id: String(l.id),
        nom: chaine(l.nom),
        telephone: chaine(l.telephone),
        email: chaine(l.email),
        campus: chaine(l.campus),
        filiere: chaine(l.filiere),
        etape: chaine(l.etape) ?? "nouveau",
        source: chaine(l.source) ?? "site",
        notes: chaine(l.notes),
        creeLe: chaine(l.creeLe),
      }));
    return { branche: true, message: null, preinscrits };
  } catch (e) {
    return { branche: false, message: `Le site 2iae.com ne répond pas pour l'instant (${(e as Error).message}).`, preinscrits: [] };
  }
}

/** Le préinscrit devient « inscrit » dans le pipeline du site. Sans effet (journal serveur) si le site ne répond pas. */
export async function signalerInscritSite(leadId: string, infos: { matricule: string; nom: string; classe: string; par: string }): Promise<boolean> {
  if (!config.webhookSite || !config.secretSite) return false;
  try {
    const r = await appeler("/api/campus/preinscrits/inscrit", { action: "inscrit", leadId, ...infos });
    if (!r.ok) console.warn(`[passerelle] le site n'a pas noté l'inscription du préinscrit ${leadId} (${r.status})`);
    return r.ok;
  } catch (e) {
    console.warn(`[passerelle] site injoignable pour le préinscrit ${leadId} :`, (e as Error).message);
    return false;
  }
}
