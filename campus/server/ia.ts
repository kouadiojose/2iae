// Accès à Claude (Anthropic) pour tout le campus : assistant pédagogique,
// résumés de séance, fiches de révision, génération de quiz, aide à la
// correction. Le client est créé à la demande : sans clé, les fonctions IA
// se mettent en veille et le reste du campus fonctionne normalement.
import Anthropic from "@anthropic-ai/sdk";
import { and, eq, sql } from "drizzle-orm";
import { config } from "./config";
import { db } from "./db";
import { usageIa } from "@shared/schema";

let client: Anthropic | null = null;

export function iaDisponible(): boolean {
  return Boolean(config.ia.cle);
}

function getClient(): Anthropic {
  if (!config.ia.cle) throw new ErreurIa("L'assistant IA n'est pas configuré (ANTHROPIC_API_KEY manquante).", 503);
  if (!client) client = new Anthropic({ apiKey: config.ia.cle });
  return client;
}

export class ErreurIa extends Error {
  constructor(message: string, public statut = 500) {
    super(message);
  }
}

export type Effort = "low" | "medium" | "high" | "xhigh";

export type OptionsClaude = {
  /** Consignes stables (mises en cache côté API). */
  systeme: string;
  /** Contexte volumineux et stable d'un appel à l'autre (contenu du cours…), mis en cache lui aussi. */
  contexte?: string;
  messages: Anthropic.Beta.BetaMessageParam[];
  effort?: Effort;
  maxTokens?: number;
  /** Pour la comptabilité et le quota quotidien. */
  utilisateurId?: number;
};

function construireRequete(o: OptionsClaude): Anthropic.Beta.MessageCreateParamsNonStreaming {
  const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: o.systeme }];
  if (o.contexte) system.push({ type: "text", text: o.contexte });
  // Le dernier bloc stable porte le point de cache : consignes + contexte du cours.
  system[system.length - 1] = { ...system[system.length - 1], cache_control: { type: "ephemeral" } };
  return {
    model: config.ia.modele,
    max_tokens: o.maxTokens ?? 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    output_config: { effort: o.effort ?? "medium" },
    messages: o.messages,
  };
}

function texteDe(message: Anthropic.Beta.BetaMessage): string {
  return message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

async function compter(utilisateurId: number | undefined, usage: Anthropic.Beta.BetaUsage | undefined) {
  if (!utilisateurId) return;
  const jour = new Date().toISOString().slice(0, 10);
  const entree = (usage?.input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0);
  const sortie = usage?.output_tokens ?? 0;
  await db
    .insert(usageIa)
    .values({ utilisateurId, jour, requetes: 1, jetonsEntree: entree, jetonsSortie: sortie })
    .onConflictDoUpdate({
      target: [usageIa.utilisateurId, usageIa.jour],
      set: {
        requetes: sql`${usageIa.requetes} + 1`,
        jetonsEntree: sql`${usageIa.jetonsEntree} + ${entree}`,
        jetonsSortie: sql`${usageIa.jetonsSortie} + ${sortie}`,
      },
    })
    .catch((e) => console.error("[ia] comptabilité :", e.message));
}

/** Requêtes déjà consommées aujourd'hui par cette personne. */
export async function requetesDuJour(utilisateurId: number): Promise<number> {
  const jour = new Date().toISOString().slice(0, 10);
  const [ligne] = await db
    .select({ n: usageIa.requetes })
    .from(usageIa)
    .where(and(eq(usageIa.utilisateurId, utilisateurId), eq(usageIa.jour, jour)));
  return ligne?.n ?? 0;
}

/** Lève une ErreurIa 429 si le quota quotidien est atteint. */
export async function verifierQuota(utilisateurId: number, quota = config.ia.quotaJour): Promise<void> {
  if ((await requetesDuJour(utilisateurId)) >= quota) {
    throw new ErreurIa(`Tu as atteint ta limite de ${quota} questions à l'assistant pour aujourd'hui. Elle se renouvelle demain matin.`, 429);
  }
}

const MESSAGE_REFUS =
  "Je ne peux pas t'aider sur ce point. Pose plutôt la question à ton formateur dans la messagerie du cours.";

/** Appel simple : renvoie le texte complet. */
export async function demanderClaude(o: OptionsClaude): Promise<string> {
  const reponse = await getClient().beta.messages.create(construireRequete(o));
  await compter(o.utilisateurId, reponse.usage);
  if (reponse.stop_reason === "refusal") return MESSAGE_REFUS;
  return texteDe(reponse);
}

/**
 * Appel en flux : `surTexte` reçoit chaque morceau au fil de l'eau (pour
 * l'afficher pendant que Claude écrit, comme dans une conversation).
 */
export async function fluxClaude(o: OptionsClaude, surTexte: (morceau: string) => void): Promise<string> {
  const flux = getClient().beta.messages.stream({ ...construireRequete(o), max_tokens: o.maxTokens ?? 16000 });
  flux.on("text", (morceau) => surTexte(morceau));
  const final = await flux.finalMessage();
  await compter(o.utilisateurId, final.usage);
  if (final.stop_reason === "refusal") return MESSAGE_REFUS;
  return texteDe(final);
}

/**
 * Demande une réponse JSON conforme à un schéma (quiz générés, grilles…).
 * Le schéma JSON est imposé par l'API (structured outputs).
 */
export async function demanderJson<T>(o: OptionsClaude & { schema: Record<string, unknown> }): Promise<T> {
  const requete = construireRequete(o);
  const reponse = await getClient().beta.messages.create({
    ...requete,
    output_config: { ...requete.output_config, format: { type: "json_schema", schema: o.schema } },
  });
  await compter(o.utilisateurId, reponse.usage);
  if (reponse.stop_reason === "refusal") throw new ErreurIa("L'assistant a refusé cette demande.", 422);
  const texte = texteDe(reponse);
  try {
    return JSON.parse(texte) as T;
  } catch {
    throw new ErreurIa("Réponse de l'assistant illisible, réessaie.", 502);
  }
}
