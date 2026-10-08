// Accès à Claude (Anthropic) pour tout le campus : assistant pédagogique,
// résumés de séance, fiches de révision, génération de quiz, aide à la
// correction. Le client est créé à la demande : sans clé, les fonctions IA
// se mettent en veille et le reste du campus fonctionne normalement.
import Anthropic from "@anthropic-ai/sdk";
import { and, eq, gte, sql } from "drizzle-orm";
import { config } from "./config";
import { db } from "./db";
import { notifier } from "./notifications";
import { usageIa, reglagesIa, utilisateurs, prixDuModele, type ReglagesIa, type BudgetMoisIa } from "@shared/schema";
import { demanderLeSoir, iaDuSoir } from "./ia-soir";
import { demanderGratuit, demanderJsonGratuit, fluxGratuit, gratuiteConfiguree, ErreurGratuite } from "./ia-gratuite";

let client: Anthropic | null = null;

/**
 * Panne du compte Anthropic (crédit épuisé, clé révoquée) : inutile d'insister
 * à chaque question. L'assistant se met en pause 15 minutes, l'interface le
 * dit clairement, puis un nouvel essai est tenté.
 */
const DUREE_PANNE_MS = 15 * 60_000;
let panneJusqua = 0;

/**
 * Questions en direct par l'IA gratuite (server/ia-gratuite.ts) : en mode « IA du soir » (pas de crédit d'API
 * Anthropic), quand une clé de service gratuit est renseignée.
 */
export const iaGratuite = (): boolean => iaDuSoir() && gratuiteConfiguree();

/** L'assistant interactif répond-il ? En mode « IA du soir », seulement par l'IA gratuite. */
export function iaDisponible(): boolean {
  if (iaDuSoir()) return gratuiteConfiguree();
  return Boolean(config.ia.cle) && Date.now() >= panneJusqua;
}

/**
 * Le travail de fond (cours complets, dossiers de lecture) peut-il avancer ? Avec l'API, ou en mode « IA du
 * soir », où ses demandes attendent la routine du soir.
 */
export const travailDeFondPossible = (): boolean => iaDuSoir() || iaDisponible();

/** « configuration » : pas de clé ; « panne » : le compte d'IA refuse les appels (ou IA du soir, faute de crédit). */
export const raisonIndisponible = (): "configuration" | "panne" | null =>
  iaDuSoir() ? (gratuiteConfiguree() ? null : "panne") : !config.ia.cle ? "configuration" : Date.now() < panneJusqua ? "panne" : null;

/** Repère les refus qui viennent du compte (et non de la question) avant que le SDK ne lève l'erreur. */
const fetchSurveille: typeof fetch = async (entree, init) => {
  const r = await fetch(entree, init);
  if (r.status === 401 || r.status === 403 || r.status === 400) {
    const texte = await r.clone().text().catch(() => "");
    if (r.status !== 400 || /credit balance|billing/i.test(texte)) {
      if (Date.now() >= panneJusqua) console.error(`[ia] compte Anthropic indisponible (${r.status}) : crédit ou clé à vérifier. Assistant en pause 15 minutes.`);
      panneJusqua = Date.now() + DUREE_PANNE_MS;
    }
  }
  return r;
};

function getClient(): Anthropic {
  if (!config.ia.cle) throw new ErreurIa("L'assistant IA n'est pas configuré (ANTHROPIC_API_KEY manquante).", 503);
  if (!client) client = new Anthropic({ apiKey: config.ia.cle, fetch: fetchSurveille });
  return client;
}

export class ErreurIa extends Error {
  constructor(message: string, public statut = 500) {
    super(message);
  }
}

export type Effort = "low" | "medium" | "high" | "xhigh";

/**
 * Pour qui et pour quoi l'IA travaille, ce qui choisit le modèle (et donc le prix) :
 * - « etudiant » : questions sur le cours, outils de leçon (rapide et économique) ;
 * - « bibliotheque » : recherche de livres, fiches, exposés (plus de culture générale) ;
 * - « personnel » : outils des formateurs et de la direction (le modèle le plus capable).
 */
export type Gamme = "etudiant" | "bibliotheque" | "personnel";

export const modeleDe = (g: Gamme = "personnel") =>
  g === "etudiant" ? config.ia.modeleEtudiant : g === "bibliotheque" ? config.ia.modeleBibliotheque : config.ia.modele;

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
  /** Modèle selon l'usage (par défaut : outils du personnel). */
  gamme?: Gamme;
  /**
   * Travail de fond payé par l'école (étude d'un livre, cours complet tiré d'un
   * enregistrement) : compté dans le budget du mois, jamais dans les questions
   * du jour de la personne.
   */
  sansQuota?: boolean;
};

/**
 * Conversation longue : un point de cache sur la dernière réponse de
 * l'historique. À la question suivante, tout ce qui précède est relu depuis
 * le cache (dix fois moins cher) au lieu d'être facturé plein tarif. La
 * question en cours n'en porte pas : ses précisions (passages du livre…)
 * changent à chaque fois.
 */
function avecCacheHistorique(messages: Anthropic.Beta.BetaMessageParam[]): Anthropic.Beta.BetaMessageParam[] {
  let i = messages.length - 2;
  while (i >= 0 && messages[i].role !== "assistant") i--;
  if (i < 1 || typeof messages[i].content !== "string") return messages;
  const copie = [...messages];
  copie[i] = { ...messages[i], content: [{ type: "text", text: messages[i].content as string, cache_control: { type: "ephemeral" } }] };
  return copie;
}

/** Haiku 4.5 (et avant) ne connaît ni le réglage d'effort ni le repli automatique côté serveur. */
const ancienHaiku = (modele: string) => /haiku-[34]|3-5-haiku|3-haiku/.test(modele);
/** Haiku 5.5 règle son effort (pensée adaptative), sans repli automatique côté serveur. */
const estHaiku = (modele: string) => modele.includes("haiku");

function construireRequete(o: OptionsClaude): Anthropic.Beta.MessageCreateParamsNonStreaming {
  const system: Anthropic.Beta.BetaTextBlockParam[] = [{ type: "text", text: o.systeme }];
  if (o.contexte) system.push({ type: "text", text: o.contexte });
  // Le dernier bloc stable porte le point de cache : consignes + contexte du cours.
  system[system.length - 1] = { ...system[system.length - 1], cache_control: { type: "ephemeral" } };
  const model = modeleDe(o.gamme);
  const base = { model, max_tokens: o.maxTokens ?? 8000, system, messages: avecCacheHistorique(o.messages) };
  if (ancienHaiku(model)) return base;
  if (estHaiku(model)) return { ...base, output_config: { effort: o.effort ?? "medium" } };
  return {
    ...base,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: o.effort ?? "medium" },
  };
}

function texteDe(message: Anthropic.Beta.BetaMessage): string {
  return message.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/** Coût d'une réponse en millionièmes de dollar, au prix du modèle qui a réellement répondu. */
export function coutMicroDe(modele: string, usage: Anthropic.Beta.BetaUsage | undefined): number {
  const p = prixDuModele(modele);
  return Math.round(
    (usage?.input_tokens ?? 0) * p.entree +
      (usage?.cache_read_input_tokens ?? 0) * p.lectureCache +
      (usage?.cache_creation_input_tokens ?? 0) * p.entree * 1.25 +
      (usage?.output_tokens ?? 0) * p.sortie,
  );
}

async function compter(utilisateurId: number | undefined, usage: Anthropic.Beta.BetaUsage | undefined, modele: string, sansQuota = false): Promise<number> {
  const cout = coutMicroDe(modele, usage);
  if (budgetEnCache) budgetEnCache.depenseMicro += cout;
  if (!utilisateurId) return cout;
  if (!sansQuota) liberer(utilisateurId);
  const requetes = sansQuota ? 0 : 1;
  const jour = new Date().toISOString().slice(0, 10);
  const entree = (usage?.input_tokens ?? 0) + (usage?.cache_read_input_tokens ?? 0) + (usage?.cache_creation_input_tokens ?? 0);
  const sortie = usage?.output_tokens ?? 0;
  await db
    .insert(usageIa)
    .values({ utilisateurId, jour, requetes, jetonsEntree: entree, jetonsSortie: sortie, coutMicro: cout })
    .onConflictDoUpdate({
      target: [usageIa.utilisateurId, usageIa.jour],
      set: {
        requetes: sql`${usageIa.requetes} + ${requetes}`,
        jetonsEntree: sql`${usageIa.jetonsEntree} + ${entree}`,
        jetonsSortie: sql`${usageIa.jetonsSortie} + ${sortie}`,
        coutMicro: sql`${usageIa.coutMicro} + ${cout}`,
      },
    })
    .catch((e) => console.error("[ia] comptabilité :", e.message));
  void alerterSiSeuil().catch((e) => console.error("[ia] alerte budget :", (e as Error).message));
  return cout;
}

// ═══ Budget du mois et réglages ════════════════════════════════════════════

const REGLAGES_DEFAUT = { budgetMensuelUsd: 100, quotaEtudiant: 20, quotaPersonnel: 60 };
let reglagesEnCache: { le: number; r: ReglagesIa } | null = null;

/** Réglages de l'IA (relus toutes les 30 s ; la ligne est créée par la migration). */
export async function reglagesIaActuels(): Promise<ReglagesIa> {
  if (reglagesEnCache && Date.now() - reglagesEnCache.le < 30_000) return reglagesEnCache.r;
  let [r] = await db.select().from(reglagesIa).where(eq(reglagesIa.id, 1));
  if (!r) [r] = await db.insert(reglagesIa).values({ id: 1, ...REGLAGES_DEFAUT }).onConflictDoNothing().returning();
  if (!r) [r] = await db.select().from(reglagesIa).where(eq(reglagesIa.id, 1));
  reglagesEnCache = { le: Date.now(), r };
  return r;
}

export function oublierReglagesIa() {
  reglagesEnCache = null;
  budgetEnCache = null;
}

/** Premier jour du mois en cours (UTC), « 2026-10-01 ». */
const debutDuMois = (d = new Date()) => `${d.toISOString().slice(0, 7)}-01`;

let budgetEnCache: { le: number; mois: string; depenseMicro: number } | null = null;

/** Dépense du mois (tout le campus), en millionièmes de dollar. Relue en base toutes les minutes. */
async function depenseDuMoisMicro(): Promise<number> {
  const mois = debutDuMois();
  if (budgetEnCache && budgetEnCache.mois === mois && Date.now() - budgetEnCache.le < 60_000) return budgetEnCache.depenseMicro;
  const [l] = await db
    .select({ n: sql<number>`COALESCE(sum(${usageIa.coutMicro}), 0)::float8` })
    .from(usageIa)
    .where(gte(usageIa.jour, mois));
  budgetEnCache = { le: Date.now(), mois, depenseMicro: Number(l?.n ?? 0) };
  return budgetEnCache.depenseMicro;
}

export async function budgetDuMois(): Promise<BudgetMoisIa> {
  const [r, micro] = await Promise.all([reglagesIaActuels(), depenseDuMoisMicro()]);
  const maintenant = new Date();
  const depenseUsd = micro / 1e6;
  const budgetUsd = r.budgetMensuelUsd;
  const jourDuMois = maintenant.getUTCDate() - 1 + maintenant.getUTCHours() / 24;
  const joursDuMois = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() + 1, 0)).getUTCDate();
  return {
    mois: debutDuMois().slice(0, 7),
    budgetUsd,
    depenseUsd: Math.round(depenseUsd * 100) / 100,
    part: budgetUsd > 0 ? depenseUsd / budgetUsd : 1,
    atteint: depenseUsd >= budgetUsd,
    projectionUsd: Math.round((jourDuMois >= 1 ? (depenseUsd / jourDuMois) * joursDuMois : depenseUsd) * 100) / 100,
  };
}

const SEUILS_ALERTE = [50, 80, 100];

/** Prévient la direction une fois par seuil et par mois (50 %, 80 %, budget atteint). */
async function alerterSiSeuil() {
  const b = await budgetDuMois();
  const pourcent = b.part * 100;
  const seuil = [...SEUILS_ALERTE].reverse().find((s) => pourcent >= s);
  if (!seuil) return;
  const r = await reglagesIaActuels();
  const deja = r.alertes[b.mois] ?? [];
  if (deja.includes(seuil)) return;
  const alertes = { [b.mois]: [...deja, ...SEUILS_ALERTE.filter((s) => s <= seuil && !deja.includes(s))] };
  // Une seule alerte même si plusieurs réponses franchissent le seuil en même temps.
  const maj = await db
    .update(reglagesIa)
    .set({ alertes })
    .where(and(eq(reglagesIa.id, 1), sql`NOT (COALESCE(${reglagesIa.alertes} -> ${b.mois}, '[]'::jsonb) @> ${JSON.stringify([seuil])}::jsonb)`))
    .returning({ id: reglagesIa.id });
  reglagesEnCache = null;
  if (!maj.length) return;
  const direction = await db.select({ id: utilisateurs.id }).from(utilisateurs).where(and(eq(utilisateurs.role, "admin"), eq(utilisateurs.actif, true)));
  const montant = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
  await notifier(
    direction.map((d) => d.id),
    seuil >= 100
      ? {
          type: "systeme",
          titre: "Budget IA du mois atteint : assistant en pause",
          corps: `${montant(b.depenseUsd)} dépensés sur ${montant(b.budgetUsd)}. L'assistant et la bibliothèque sont en pause jusqu'au 1er du mois. Vous pouvez relever le budget dans Pilotage, Budget IA.`,
          lien: "/pilotage/ia",
          push: true,
        }
      : {
          type: "systeme",
          titre: `Budget IA : ${seuil} % du mois consommés`,
          corps: `${montant(b.depenseUsd)} dépensés sur ${montant(b.budgetUsd)} (projection sur le mois : ${montant(b.projectionUsd)}).`,
          lien: "/pilotage/ia",
          push: true,
        },
  );
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

// Requêtes en cours (comptées en base seulement à la fin de la réponse) :
// sans elles, dix questions envoyées en même temps passeraient toutes le quota.
const reservations = new Map<number, symbol[]>();

function reserver(utilisateurId: number) {
  const jeton = Symbol();
  reservations.set(utilisateurId, [...(reservations.get(utilisateurId) ?? []), jeton]);
  // Filet : une requête qui échoue avant d'être comptée libère sa place.
  setTimeout(() => liberer(utilisateurId, jeton), 3 * 60_000).unref();
}

function liberer(utilisateurId: number, jeton?: symbol) {
  const liste = reservations.get(utilisateurId);
  if (!liste?.length) return;
  const reste = jeton ? liste.filter((j) => j !== jeton) : liste.slice(1);
  if (reste.length) reservations.set(utilisateurId, reste);
  else reservations.delete(utilisateurId);
}

type Demandeur = { id: number; role: string };

/** Questions par jour : réglées par la direction, différentes pour les étudiants et le personnel. */
export async function quotaDe(u: Demandeur): Promise<number> {
  const r = await reglagesIaActuels();
  return u.role === "etudiant" ? r.quotaEtudiant : r.quotaPersonnel;
}

/** Budget du mois atteint : plus aucun appel (ErreurIa 503). */
/**
 * Travail de fond (cours complets, études de livres) : il s'arrête à 70 % du
 * budget du mois, pour laisser le reste aux questions des étudiants.
 */
export async function travailDeFondPermis(): Promise<boolean> {
  // IA du soir : le travail ne coûte rien à l'école (la routine du soir le fait), le budget ne compte pas.
  if (iaDuSoir()) return true;
  return (await budgetDuMois()).part < 0.7;
}

export async function verifierBudget(u: Demandeur): Promise<void> {
  if (iaDuSoir()) return;
  const b = await budgetDuMois();
  if (!b.atteint) return;
  throw new ErreurIa(
    u.role === "etudiant"
      ? "L'assistant est en pause jusqu'au début du mois prochain : le budget d'IA de l'école pour ce mois est atteint. Tes conversations et tes fiches restent consultables."
      : "L'assistant est en pause : le budget d'IA du mois est atteint. La direction peut le relever dans Pilotage, Budget IA.",
    503,
  );
}

/**
 * Lève une ErreurIa si le budget du mois ou le quota quotidien est atteint
 * (requêtes en cours comprises), sinon réserve une place.
 */
export async function verifierQuota(u: Demandeur, quota?: number): Promise<void> {
  await verifierBudget(u);
  const limite = quota ?? (await quotaDe(u));
  const enCours = reservations.get(u.id)?.length ?? 0;
  if ((await requetesDuJour(u.id)) + enCours >= limite) {
    throw new ErreurIa(
      u.role === "etudiant"
        ? `Tu as atteint ta limite de ${limite} questions à l'assistant pour aujourd'hui. Elle se renouvelle demain matin.`
        : `Vous avez atteint la limite de ${limite} demandes à l'assistant pour aujourd'hui. Elle se renouvelle demain matin.`,
      429,
    );
  }
  reserver(u.id);
}

const MESSAGE_REFUS =
  "Je ne peux pas t'aider sur ce point. Pose plutôt la question à ton formateur dans la messagerie du cours.";

/** IA gratuite : la question compte dans le quota du jour de la personne (le service gratuit a lui-même un quota). */
async function viaGratuite<T>(o: OptionsClaude, f: () => Promise<T>): Promise<T> {
  try {
    const r = await f();
    await compter(o.utilisateurId, undefined, "ia-gratuite", o.sansQuota);
    return r;
  } catch (e) {
    if (e instanceof ErreurGratuite) throw new ErreurIa(e.message, e.statut);
    throw e;
  }
}

/** Appel simple : renvoie le texte complet. */
export async function demanderClaude(o: OptionsClaude): Promise<string> {
  if (iaGratuite() && !o.sansQuota) return viaGratuite(o, () => demanderGratuit(o));
  const reponse = await getClient().beta.messages.create(construireRequete(o));
  await compter(o.utilisateurId, reponse.usage, reponse.model, o.sansQuota);
  if (reponse.stop_reason === "refusal") return MESSAGE_REFUS;
  return texteDe(reponse);
}

/**
 * Appel en flux : `surTexte` reçoit chaque morceau au fil de l'eau (pour
 * l'afficher pendant que Claude écrit, comme dans une conversation).
 */
export async function fluxClaude(o: OptionsClaude, surTexte: (morceau: string) => void, etat?: { complet?: boolean }): Promise<string> {
  if (iaGratuite() && !o.sansQuota) return viaGratuite(o, () => fluxGratuit(o, surTexte, etat));
  const flux = getClient().beta.messages.stream({ ...construireRequete(o), max_tokens: o.maxTokens ?? 16000 });
  flux.on("text", (morceau) => surTexte(morceau));
  const final = await flux.finalMessage();
  await compter(o.utilisateurId, final.usage, final.model, o.sansQuota);
  // Réponse menée à son terme (ni coupée par la limite, ni refusée) : elle peut être gardée.
  if (etat) etat.complet = final.stop_reason === "end_turn";
  if (final.stop_reason === "refusal") return MESSAGE_REFUS;
  return texteDe(final);
}

/**
 * Demande une réponse JSON conforme à un schéma (quiz générés, grilles…).
 * Le schéma JSON est imposé par l'API (structured outputs).
 */
export async function demanderJson<T>(o: OptionsClaude & { schema: Record<string, unknown> }): Promise<T> {
  return (await demanderJsonCout<T>(o)).resultat;
}

/** Comme demanderJson, avec le coût de l'appel (études : on le garde avec le dossier). */
export async function demanderJsonCout<T>(o: OptionsClaude & { schema: Record<string, unknown> }): Promise<{ resultat: T; coutMicro: number }> {
  // IA du soir : le travail de fond garde sa demande pour la routine du soir (ou relit la réponse qu'elle a donnée).
  if (o.sansQuota && iaDuSoir()) {
    const resultat = await demanderLeSoir<T>({ systeme: o.systeme, contexte: o.contexte, messages: o.messages, schema: o.schema, maxTokens: o.maxTokens, gamme: o.gamme });
    return { resultat, coutMicro: 0 };
  }
  // Question en direct sans crédit d'API : l'IA gratuite.
  if (iaGratuite()) return { resultat: await viaGratuite(o, () => demanderJsonGratuit<T>(o)), coutMicro: 0 };
  const requete = construireRequete(o);
  const reponse = await getClient().beta.messages.create({
    ...requete,
    output_config: { ...requete.output_config, format: { type: "json_schema", schema: o.schema } },
  });
  const coutMicro = await compter(o.utilisateurId, reponse.usage, reponse.model, o.sansQuota);
  if (reponse.stop_reason === "refusal") throw new ErreurIa("L'assistant a refusé cette demande.", 422);
  const texte = texteDe(reponse);
  try {
    return { resultat: JSON.parse(texte) as T, coutMicro };
  } catch {
    throw new ErreurIa(reponse.stop_reason === "max_tokens" ? "Réponse de l'assistant trop longue, coupée." : "Réponse de l'assistant illisible, réessaie.", 502);
  }
}
