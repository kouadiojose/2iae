// IA gratuite : l'assistant et le bibliothécaire répondent tout de suite, sans crédit d'API Anthropic,
// grâce à l'offre gratuite d'un autre service (Google Gemini par défaut, ou Mistral), sans carte bancaire.
//
// Utilisée seulement en mode « IA du soir » (CAMPUS_IA_SOIR=oui) et si IA_GRATUITE_CLE est renseignée : les
// questions en direct passent par ce service ; le travail lourd (cours complets, dossiers de lecture) reste à la
// routine du soir. Sans carte bancaire sur le compte du service, rien n'est jamais facturé : au-delà du quota
// gratuit du jour, le service refuse (429) et le campus le dit.
//
// Format « compatible OpenAI » (chat/completions), que proposent Gemini et Mistral :
//   IA_GRATUITE_URL     https://generativelanguage.googleapis.com/v1beta/openai (défaut, Gemini)
//                       ou https://api.mistral.ai/v1 (Mistral)
//   IA_GRATUITE_MODELE  gemini-flash-latest (défaut : le dernier Gemini Flash) ; mistral-small-latest pour Mistral.
//                       Une liste séparée par des virgules est permise : un modèle saturé (429) passe la main au
//                       suivant ; chez Mistral, des modèles de secours suivent toujours la liste.
//   IA_GRATUITE_CLE     la clé du service (Google AI Studio, ou console Mistral)
import { config } from "./config";
import { verifier } from "./ia-soir";

/** Les mêmes options que pour Claude (seules celles-ci comptent ici). */
type Options = {
  systeme: string;
  contexte?: string;
  messages: { role: string; content: unknown }[];
  maxTokens?: number;
};

export class ErreurGratuite extends Error {
  constructor(
    message: string,
    public statut = 503,
    /** Quota gratuit atteint (par minute ou pour la journée). */
    public quota = false,
  ) {
    super(message);
  }
}

export const gratuiteConfiguree = () => Boolean(config.ia.gratuite.cle);

type MessageOpenAi = { role: "system" | "user" | "assistant"; content: string | { type: string; [k: string]: unknown }[] };

/** Messages au format de l'API Anthropic → format OpenAI (texte ; images en data URI). */
function convertir(o: Options): MessageOpenAi[] {
  const systeme = o.contexte ? `${o.systeme}\n\n${o.contexte}` : o.systeme;
  const messages: MessageOpenAi[] = [{ role: "system", content: systeme }];
  for (const m of o.messages) {
    const role = m.role === "assistant" ? "assistant" : "user";
    if (typeof m.content === "string") {
      messages.push({ role, content: m.content });
      continue;
    }
    const blocs = Array.isArray(m.content) ? (m.content as { type: string; text?: string; source?: { type: string; media_type?: string; data?: string } }[]) : [];
    type Partie = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
    const parties: Partie[] = blocs.flatMap((b): Partie[] => {
      if (b.type === "text" && b.text) return [{ type: "text", text: b.text }];
      if (b.type === "image" && b.source?.type === "base64") return [{ type: "image_url", image_url: { url: `data:${b.source.media_type};base64,${b.source.data}` } }];
      return [];
    });
    const textes = parties.filter((p): p is { type: "text"; text: string } => p.type === "text");
    messages.push({ role, content: textes.length === parties.length ? textes.map((p) => p.text).join("\n\n") : parties });
  }
  return messages;
}

// Modèles de secours chez Mistral : sur l'offre gratuite, un modèle saturé répond 429 (« capacity exceeded »)
// pendant que les autres répondent encore.
const SECOURS_MISTRAL = ["mistral-medium-latest", "open-mistral-nemo", "ministral-8b-latest"];

/** Le modèle de secours qui vient de répondre passe en tête quelques minutes, puis le modèle choisi reprend. */
let prefere: { modele: string; jusqua: number } | null = null;

/** Modèles essayés dans l'ordre : IA_GRATUITE_MODELE (une liste séparée par des virgules est permise), puis les secours. */
function modeles(): string[] {
  const { url, modele } = config.ia.gratuite;
  const liste = modele.split(",").map((m) => m.trim()).filter(Boolean);
  if (/mistral\.ai/.test(url)) for (const m of SECOURS_MISTRAL) if (!liste.includes(m)) liste.push(m);
  if (prefere && prefere.jusqua > Date.now() && liste.includes(prefere.modele)) return [prefere.modele, ...liste.filter((m) => m !== prefere!.modele)];
  return liste;
}

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function appeler(corps: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  const { url, cle } = config.ia.gratuite;
  if (!cle) throw new ErreurGratuite("Aucun service d'IA gratuit n'est configuré (IA_GRATUITE_CLE).");
  const liste = modeles();
  const principal = config.ia.gratuite.modele.split(",")[0].trim();
  let quota = false;
  let statut = 503;
  for (const modele of liste) {
    for (let essai = 0; essai < 2; essai++) {
      let r: Response;
      try {
        r = await fetch(`${url.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: modele, ...corps }),
          signal,
        });
      } catch {
        throw new ErreurGratuite("Le service d'IA ne répond pas. Réessaie dans un instant.");
      }
      if (r.ok) {
        if (modele === principal) prefere = null;
        else if (!prefere || prefere.modele !== modele || prefere.jusqua <= Date.now()) prefere = { modele, jusqua: Date.now() + 10 * 60_000 };
        return r;
      }
      const texte = await r.text().catch(() => "");
      console.error(`[ia gratuite] ${modele} : ${r.status} : ${texte.slice(0, 300)}`);
      if (r.status === 401 || r.status === 403) throw new ErreurGratuite("L'assistant est en pause : la clé du service d'IA gratuit est refusée (à vérifier par la direction).");
      if (r.status === 429) {
        quota = true;
        // Limite par seconde : un nouvel essai un peu plus tard. Modèle saturé : le suivant.
        if (essai === 0 && !/capacity/i.test(texte)) {
          await attendre(1500);
          continue;
        }
      } else if (r.status === 400 || r.status === 404 || r.status === 422) statut = 422;
      break;
    }
  }
  if (quota) throw new ErreurGratuite("L'assistant reçoit beaucoup de questions en ce moment : réessaie dans une minute (ou demain si la journée est chargée).", 503, true);
  throw new ErreurGratuite("L'assistant n'a pas pu répondre. Réessaie dans un instant.", statut);
}

/** Réponse complète (texte). */
export async function demanderGratuit(o: Options): Promise<string> {
  const r = await appeler({ messages: convertir(o), max_tokens: o.maxTokens ?? 8000 }, AbortSignal.timeout(90_000));
  const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
  return j.choices?.[0]?.message?.content?.trim() ?? "";
}

/** Réponse en flux : `surTexte` reçoit chaque morceau (comme pour Claude). */
export async function fluxGratuit(o: Options, surTexte: (morceau: string) => void, etat?: { complet?: boolean }): Promise<string> {
  const r = await appeler({ messages: convertir(o), max_tokens: o.maxTokens ?? 8000, stream: true });
  if (!r.body) throw new ErreurGratuite("L'assistant n'a pas pu répondre. Réessaie dans un instant.");
  const lecteur = r.body.getReader();
  const decodeur = new TextDecoder();
  let tampon = "";
  let tout = "";
  let fin: string | null = null;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    tampon += decodeur.decode(value, { stream: true });
    let i: number;
    while ((i = tampon.indexOf("\n")) >= 0) {
      const ligne = tampon.slice(0, i).trim();
      tampon = tampon.slice(i + 1);
      if (!ligne.startsWith("data:")) continue;
      const donnees = ligne.slice(5).trim();
      if (donnees === "[DONE]") continue;
      try {
        const j = JSON.parse(donnees) as { choices?: { delta?: { content?: string }; finish_reason?: string | null }[] };
        const morceau = j.choices?.[0]?.delta?.content ?? "";
        if (morceau) {
          tout += morceau;
          surTexte(morceau);
        }
        fin = j.choices?.[0]?.finish_reason ?? fin;
      } catch {
        /* ligne incomplète ou de service : ignorée */
      }
    }
  }
  if (etat) etat.complet = fin === "stop";
  return tout;
}

/**
 * Réponse JSON conforme à un schéma. Le schéma est demandé au service (sorties structurées), puis vérifié ici :
 * une réponse non conforme est redemandée une fois.
 */
export async function demanderJsonGratuit<T>(o: Options & { schema: Record<string, unknown> }): Promise<T> {
  const consigne = `\n\nRéponds uniquement par un objet JSON conforme à ce schéma (toutes les propriétés sont requises, aucune autre) :\n${JSON.stringify(o.schema)}`;
  const base = { ...o, systeme: o.systeme + consigne };
  let dernier: string[] = [];
  for (let essai = 0; essai < 2; essai++) {
    let r: Response;
    try {
      r = await appeler(
        { messages: convertir(base), max_tokens: o.maxTokens ?? 8000, response_format: { type: "json_schema", json_schema: { name: "reponse", schema: o.schema, strict: true } } },
        AbortSignal.timeout(120_000),
      );
    } catch (e) {
      // Service qui ne connaît pas les schémas : le simple mode JSON, le schéma restant dans les consignes.
      if (!(e instanceof ErreurGratuite) || e.statut !== 422) throw e;
      r = await appeler({ messages: convertir(base), max_tokens: o.maxTokens ?? 8000, response_format: { type: "json_object" } }, AbortSignal.timeout(120_000));
    }
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    const texte = (j.choices?.[0]?.message?.content ?? "").replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    try {
      const valeur = JSON.parse(texte) as T;
      dernier = verifier(o.schema, valeur, "réponse");
      if (!dernier.length) return valeur;
    } catch {
      dernier = ["réponse illisible"];
    }
  }
  console.warn(`[ia gratuite] réponse JSON non conforme : ${dernier.slice(0, 5).join(" ; ")}`);
  throw new ErreurGratuite("L'assistant a mal formé sa réponse. Réessaie dans un instant.", 502);
}
