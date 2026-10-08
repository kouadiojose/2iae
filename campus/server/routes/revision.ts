// Routes du chantier C1 (révision du jour, campus/ENGAGEMENT.md) : /api/revision/*,
// suivi du cours complet et révision de la classe. Le fichier est branché par
// routes/index.ts (socle commun) ; la logique vit dans server/engagement/revision.ts
// et la banque de cartes (tâche planifiée « revision-cartes ») dans
// server/engagement/cartes.ts.
//
// Étudiants : leur révision (paquet gardé sur le téléphone, réponses envoyées en
// un lot, signalements). Formateur du cours et direction : les chiffres de la
// classe à partir de 5 étudiants, jamais de note ni de nom, et la décision sur
// une question retirée.
import type { Express, Request } from "express";
import { z } from "zod";
import { exigerConnexion, exigerRole, moi } from "../auth";
import { route, idParam, interdit, introuvable, invalide, valider, ErreurHttp } from "../http";
import { coursVisible, enseigneCours, idsCoursMediatheque } from "../acces";
import { seanceDuReplay } from "./live";
import {
  chargerCarte,
  coursCompletsDuCours,
  deciderCarte,
  enregistrerReponses,
  noterSuivi,
  paquetRevision,
  revisionClasse,
  revisionDuJour,
  signalerCarte,
} from "../engagement/revision";
import { ORIGINES_REPONSE, REPONSES_PAR_LOT } from "@shared/engagement/revision";
import type { Utilisateur } from "@shared/schema";

const schemaReponses = z.object({
  reponses: z
    .array(
      z.object({
        carteId: z.number().int().positive(),
        origine: z.enum(ORIGINES_REPONSE),
        choix: z.number().int().min(0).max(20).optional(),
        savait: z.boolean().optional(),
        reponduLe: z.number().finite(),
        cle: z.string().min(6).max(80),
      }),
    )
    .min(1)
    .max(REPONSES_PAR_LOT),
});

const schemaSuivi = z
  .discriminatedUnion("evenement", [
    z.object({ evenement: z.literal("ouverture") }),
    z.object({ evenement: z.literal("fiche"), index: z.number().int().min(0).max(200) }),
    z.object({ evenement: z.literal("exercice"), index: z.number().int().min(0).max(50), etat: z.enum(["fait", "difficile"]) }),
    z.object({ evenement: z.literal("corrige"), index: z.number().int().min(0).max(50) }),
    z.object({ evenement: z.literal("quiz"), score: z.number().int().min(0).max(200), total: z.number().int().min(1).max(200) }),
  ])
  .refine((e) => e.evenement !== "quiz" || e.score <= e.total, { message: "le score dépasse le nombre de questions", path: ["score"] });

/** Lots de réponses acceptés par étudiant sur 10 minutes : bien au-delà d'une vraie révision (la file hors ligne réessaiera). */
const LOTS_MAX = 30;
const FENETRE_LOTS_MS = 10 * 60_000;
const lotsRecents = new Map<number, number[]>();

/** Limite de fréquence des envois de réponses, en mémoire (comme les tentatives de connexion). */
function limiterLots(utilisateurId: number) {
  const maintenant = Date.now();
  const recents = (lotsRecents.get(utilisateurId) ?? []).filter((t) => maintenant - t < FENETRE_LOTS_MS);
  if (recents.length >= LOTS_MAX) throw new ErreurHttp(429, "Trop d'envois de réponses : elles repartiront toutes seules dans quelques minutes.");
  recents.push(maintenant);
  lotsRecents.set(utilisateurId, recents);
}
setInterval(() => {
  const maintenant = Date.now();
  for (const [id, l] of lotsRecents) if (!l.some((t) => maintenant - t < FENETRE_LOTS_MS)) lotsRecents.delete(id);
}, FENETRE_LOTS_MS).unref();

/** Le formateur du cours et la direction (la vie scolaire ne voit pas ces chiffres pédagogiques). */
async function formateurOuDirection(u: Utilisateur, coursId: number): Promise<boolean> {
  if (u.role === "admin") return true;
  return u.role === "formateur" && (await enseigneCours(u, coursId));
}

/** Séance demandée en paramètre « seance » (?seance=12), si présente. */
function seanceDemandee(req: Request): number | null {
  const brut = req.query.seance;
  if (brut === undefined) return null;
  const n = Number(brut);
  if (!Number.isInteger(n) || n <= 0) throw invalide("Paramètre seance invalide.");
  return n;
}

export function enregistrerRevision(app: Express) {
  // Résumé léger (accueil, fin de révision) : quelques centaines d'octets.
  app.get(
    "/api/revision/du-jour",
    exigerRole("etudiant"),
    route(async (req, res) => {
      res.setHeader("Cache-Control", "private, no-cache");
      res.json(await revisionDuJour(moi(req)));
    }),
  );

  // Paquet gardé sur le téléphone (20 Ko au plus) ; « no-cache » : le service worker le garde pour réviser sans réseau.
  app.get(
    "/api/revision/paquet",
    exigerRole("etudiant"),
    route(async (req, res) => {
      const u = moi(req);
      const id = seanceDemandee(req);
      const seance = id ? await seanceDuReplay(u, id) : undefined;
      res.setHeader("Cache-Control", "private, no-cache");
      res.json(await paquetRevision(u, seance));
    }),
  );

  // Réponses envoyées en un lot (40 au plus), idempotent sur (étudiant, clé d'envoi) ; 30 lots par 10 minutes au plus.
  app.post(
    "/api/revision/reponses",
    exigerRole("etudiant"),
    route(async (req, res) => {
      const u = moi(req);
      const { reponses } = valider(schemaReponses, req.body);
      limiterLots(u.id);
      res.json(await enregistrerReponses(u, reponses));
    }),
  );

  // « Signaler une erreur » : un signalement par étudiant ; au 3e d'étudiants du cours (comptes de plus de 7 jours),
  // la carte est retirée et les formateurs prévenus.
  app.post(
    "/api/revision/cartes/:id(\\d+)/signaler",
    exigerRole("etudiant"),
    route(async (req, res) => {
      const u = moi(req);
      const carte = await chargerCarte(idParam(req));
      if (!carte || !(await idsCoursMediatheque(u)).includes(carte.cours_id)) throw introuvable("Question");
      const { motif } = valider(z.object({ motif: z.string().max(300).default("") }), req.body ?? {});
      res.json(await signalerCarte(u, carte, motif));
    }),
  );

  // Décision du formateur du cours (ou de la direction) sur une question retirée.
  app.put(
    "/api/revision/cartes/:id(\\d+)",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const carte = await chargerCarte(idParam(req));
      if (!carte) throw introuvable("Question");
      if (!(await formateurOuDirection(u, carte.cours_id))) throw interdit("Seuls le formateur du cours et la direction peuvent décider d'une question de révision.");
      const { decision } = valider(z.object({ decision: z.enum(["reactiver", "retirer"]) }), req.body);
      await deciderCarte(carte, decision);
      res.json({ ok: true });
    }),
  );

  // Onglet « Réviser » de la page d'un cours : ses cours complets prêts.
  app.get(
    "/api/revision/cours/:id(\\d+)",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const c = await coursVisible(u, idParam(req));
      res.json(await coursCompletsDuCours(u, c.id));
    }),
  );

  // Suivi du cours complet par l'étudiant (sans effet pour le personnel).
  app.post(
    "/api/seances/:id(\\d+)/cours-complet/suivi",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const evenement = valider(schemaSuivi, req.body);
      if (u.role !== "etudiant") return res.status(204).end();
      const s = await seanceDuReplay(u, idParam(req));
      await noterSuivi(u, s.id, evenement);
      res.status(204).end();
    }),
  );

  // Révision de la classe, en tête du cours complet : formateur du cours et direction.
  app.get(
    "/api/seances/:id(\\d+)/revision-classe",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      if (u.role !== "admin" && u.role !== "formateur") throw interdit("Réservé au formateur du cours et à la direction.");
      const s = await seanceDuReplay(u, idParam(req));
      if (!(await formateurOuDirection(u, s.coursId))) throw interdit("Réservé au formateur du cours et à la direction.");
      res.setHeader("Cache-Control", "private, no-cache");
      res.json(await revisionClasse(s));
    }),
  );
}
