// Bibliothèque virtuelle : l'étudiant donne un sujet, l'IA propose des livres
// (chacun vérifié dans les catalogues de la BnF et d'Open Library avant d'être
// montré), rédige une fiche de lecture partagée par tous, répond aux questions
// sur le livre (conversation de l'assistant, en flux), fait réviser, garde les
// notes de l'étudiant et l'aide à préparer son exposé.
//
// Tout passe par les mêmes garde-fous que l'assistant : pause d'un formateur
// (devoir, examen), budget du mois, questions par jour.
import type { Express } from "express";
import { z } from "zod";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "../db";
import { exigerRole, moi, perimetreSites } from "../auth";
import { route, valider, idParam, introuvable } from "../http";
import { demanderJson, demanderClaude, ErreurIa } from "../ia";
import { verifierLivre, normaliser } from "../catalogues";
import { SYSTEME_BIBLIOTHEQUE, contexteLivre, adresse, neutraliserBiblio } from "../bibliotheque-outils";
import { idsCoursAccessibles, etudiantsDuCours } from "../acces";
import { avantAppel, appelIa, SCHEMA_REVISION, questionsValides } from "./ia";
import {
  livres,
  recherchesBiblio,
  notesBiblio,
  exposesBiblio,
  conversationsIa,
  utilisateurs,
  classes,
  sites,
  journal,
  type Livre,
  type FicheLivre,
  type LivrePropose,
  type Utilisateur,
  type LivreDto,
  type LivreProposeDto,
  type RechercheBiblioDto,
  type LivreDetailDto,
  type MaBibliothequeDto,
  type ExposeDto,
  type QuizLivreDto,
  type ActiviteBiblioDto,
  type SourceLivre,
} from "@shared/schema";

const ROLES_BIBLIOTHEQUE = ["etudiant", "formateur", "vie_scolaire", "admin"] as const;
const ROLES_SUIVI = ["formateur", "vie_scolaire", "admin"] as const;

/** Livres proposés par recherche (après vérification). */
const LIVRES_MAX = 8;

// ── Conversions ────────────────────────────────────────────────────────────

const versLivreDto = (l: Livre): LivreDto => ({
  id: l.id,
  titre: l.titre,
  auteurs: l.auteurs,
  annee: l.annee,
  editeur: l.editeur,
  isbn: l.isbn,
  langue: l.langue,
  pages: l.pages,
  couvertureUrl: l.couvertureUrl,
  lienCatalogue: l.lienCatalogue,
  source: (l.source as SourceLivre | null) ?? null,
  ficheDisponible: Boolean(l.fiche),
});

async function livresParId(ids: number[]): Promise<Map<number, Livre>> {
  if (!ids.length) return new Map();
  const lignes = await db.select().from(livres).where(inArray(livres.id, [...new Set(ids)]));
  return new Map(lignes.map((l) => [l.id, l]));
}

async function versRechercheDto(r: typeof recherchesBiblio.$inferSelect): Promise<RechercheBiblioDto> {
  const parId = await livresParId(r.resultats.map((x) => x.livreId));
  const proposes: LivreProposeDto[] = r.resultats.flatMap((x) => {
    const l = parId.get(x.livreId);
    return l ? [{ ...versLivreDto(l), pourquoi: x.pourquoi, niveau: x.niveau, verifie: x.verifie }] : [];
  });
  return { id: r.id, sujet: r.sujet, conseil: r.conseil, livres: proposes, creeLe: r.creeLe.toISOString() };
}

const estPersonnel = (u: Utilisateur) => u.role !== "etudiant";

async function livreDe(id: number): Promise<Livre> {
  const [l] = await db.select().from(livres).where(eq(livres.id, id));
  if (!l) throw introuvable("Livre");
  return l;
}

// ── Schémas imposés à l'IA ─────────────────────────────────────────────────

const SCHEMA_RECHERCHE = {
  type: "object",
  properties: {
    conseil: { type: "string", description: "2 ou 3 phrases pour aborder le sujet : par quoi commencer, quoi chercher." },
    livres: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titre: { type: "string", description: "Titre exact du livre, sans sous-titre inventé." },
          auteurs: { type: "string", description: "Auteur(s) exact(s), « Prénom Nom », séparés par des virgules." },
          editeur: { type: "string" },
          annee: { type: "integer", description: "Année de la dernière édition connue, 0 si inconnue." },
          langue: { type: "string", enum: ["fr", "en", "autre"] },
          niveau: { type: "string", enum: ["debutant", "intermediaire", "avance"] },
          pourquoi: { type: "string", description: "1 ou 2 phrases : ce que ce livre apporte sur le sujet." },
          certitude: { type: "string", enum: ["certaine", "probable"], description: "« certaine » seulement si tu es sûr que ce livre existe sous ce titre et cet auteur." },
        },
        required: ["titre", "auteurs", "editeur", "annee", "langue", "niveau", "pourquoi", "certitude"],
        additionalProperties: false,
      },
    },
  },
  required: ["conseil", "livres"],
  additionalProperties: false,
};

type PropositionIa = {
  titre: string;
  auteurs: string;
  editeur: string;
  annee: number;
  langue: string;
  niveau: LivrePropose["niveau"];
  pourquoi: string;
  certitude: "certaine" | "probable";
};

const SCHEMA_FICHE = {
  type: "object",
  properties: {
    resume: { type: "string", description: "Résumé du livre en 6 à 10 phrases simples." },
    ideesCles: {
      type: "array",
      description: "5 à 7 idées clés du livre.",
      items: {
        type: "object",
        properties: { titre: { type: "string" }, texte: { type: "string", description: "2 à 4 phrases, avec un exemple concret si possible." } },
        required: ["titre", "texte"],
        additionalProperties: false,
      },
    },
    plan: {
      type: "array",
      description: "Grandes parties du livre, dans l'ordre (seulement si tu les connais ; sinon les grands thèmes abordés).",
      items: {
        type: "object",
        properties: { partie: { type: "string" }, contenu: { type: "string" } },
        required: ["partie", "contenu"],
        additionalProperties: false,
      },
    },
    pourQui: { type: "string", description: "Pour quel étudiant et pour quel usage ce livre est utile, et ses limites." },
    aRetenir: { type: "string", description: "Une seule phrase à retenir." },
    connaissance: { type: "string", enum: ["bonne", "partielle", "faible"], description: "Ce que tu sais réellement de CE livre." },
  },
  required: ["resume", "ideesCles", "plan", "pourQui", "aRetenir", "connaissance"],
  additionalProperties: false,
};

const ficheValide = (b: unknown): FicheLivre | null => {
  const r = z
    .object({
      resume: z.string().min(20),
      ideesCles: z.array(z.object({ titre: z.string(), texte: z.string() })).min(1),
      plan: z.array(z.object({ partie: z.string(), contenu: z.string() })),
      pourQui: z.string(),
      aRetenir: z.string(),
      connaissance: z.enum(["bonne", "partielle", "faible"]),
    })
    .safeParse(b);
  return r.success ? r.data : null;
};

/** Fiches en cours de rédaction : deux étudiants qui ouvrent le même livre ne déclenchent qu'un appel. */
const fichesEnCours = new Map<number, Promise<FicheLivre>>();

/** Clé d'un livre non retrouvé dans les catalogues : titre et nom d'auteur normalisés. */
const cleNonVerifiee = (titre: string, auteurs: string) => `ia:${normaliser(titre).slice(0, 120)}|${normaliser(auteurs.split(",")[0] ?? "").slice(0, 60)}`;

// ═══ Routes ════════════════════════════════════════════════════════════════

export function enregistrerBibliotheque(app: Express) {
  const lecteur = exigerRole(...ROLES_BIBLIOTHEQUE);

  // ── Mon espace : recherches, exposés, livres récents, livres populaires ──
  app.get(
    "/api/bibliotheque",
    lecteur,
    route(async (req, res) => {
      const u = moi(req);
      const [recherches, exposes, convs, notes, populaires] = await Promise.all([
        db.select().from(recherchesBiblio).where(eq(recherchesBiblio.utilisateurId, u.id)).orderBy(desc(recherchesBiblio.id)).limit(20),
        db
          .select({ e: exposesBiblio, titre: livres.titre })
          .from(exposesBiblio)
          .innerJoin(livres, eq(livres.id, exposesBiblio.livreId))
          .where(eq(exposesBiblio.utilisateurId, u.id))
          .orderBy(desc(exposesBiblio.id))
          .limit(20),
        db
          .select({ livreId: conversationsIa.livreId })
          .from(conversationsIa)
          .where(and(eq(conversationsIa.utilisateurId, u.id), isNotNull(conversationsIa.livreId)))
          .orderBy(desc(conversationsIa.majLe))
          .limit(12),
        db.select({ livreId: notesBiblio.livreId }).from(notesBiblio).where(eq(notesBiblio.utilisateurId, u.id)).orderBy(desc(notesBiblio.id)).limit(12),
        db.select().from(livres).where(isNotNull(livres.fiche)).orderBy(desc(livres.ficheLe)).limit(8),
      ]);
      const recents = [...new Set([...convs.map((c) => c.livreId!), ...notes.map((n) => n.livreId)])].slice(0, 8);
      const parId = await livresParId(recents);
      const dto: MaBibliothequeDto = {
        recherches: recherches.map((r) => ({ id: r.id, sujet: r.sujet, nbLivres: r.resultats.length, creeLe: r.creeLe.toISOString() })),
        exposes: exposes.map(({ e, titre }) => ({ id: e.id, livreId: e.livreId, livreTitre: titre, sujet: e.sujet, creeLe: e.creeLe.toISOString() })),
        livres: recents.flatMap((id) => (parId.get(id) ? [versLivreDto(parId.get(id)!)] : [])),
        populaires: populaires.map(versLivreDto),
      };
      res.json(dto);
    }),
  );

  // ── Recherche guidée : un sujet → des livres vérifiés ─────────────────────
  app.post(
    "/api/bibliotheque/recherches",
    lecteur,
    route(async (req, res) => {
      const u = moi(req);
      const { sujet } = valider(
        z.object({
          sujet: z
            .string({ required_error: "écris ton sujet", invalid_type_error: "écris ton sujet" })
            .trim()
            .min(3, "précise un peu ton sujet")
            .max(300, "300 caractères au maximum"),
        }),
        req.body,
      );
      await avantAppel(u);
      const brut = await appelIa(() =>
        demanderJson<{ conseil: string; livres: PropositionIa[] }>({
          systeme: SYSTEME_BIBLIOTHEQUE,
          messages: [
            {
              role: "user",
              content: `${adresse(u)}\n\nSujet de recherche :\n<sujet>\n${neutraliserBiblio(sujet)}\n</sujet>\n\nPropose les 8 meilleurs livres pour travailler ce sujet, du plus accessible au plus pointu : des ouvrages de référence qui existent réellement, en français de préférence (2 livres en anglais au plus, seulement s'ils sont incontournables). Mélange manuels, ouvrages de synthèse et livres pratiques. Pour chaque livre : titre et auteur(s) exacts, éditeur, année de la dernière édition que tu connais, niveau, et en une ou deux phrases ce qu'il apporte sur ce sujet précis. Si tu n'es pas certain qu'un livre existe exactement sous ce titre, marque-le « probable ». Le conseil dit par quoi commencer.`,
            },
          ],
          schema: SCHEMA_RECHERCHE,
          gamme: "bibliotheque",
          effort: "medium",
          maxTokens: 8000,
          utilisateurId: u.id,
        }),
      );
      const propositions = (Array.isArray(brut?.livres) ? brut.livres : []).filter((p) => p?.titre?.trim() && p?.auteurs?.trim()).slice(0, 10);

      // Vérification dans les catalogues, en parallèle (7 s au plus par catalogue).
      const verifies = await Promise.all(
        propositions.map(async (p) => ({ p, notice: await verifierLivre(p.titre, p.auteurs, p.langue === "en" ? "en" : "fr").catch(() => null) })),
      );
      // Retrouvés d'abord ; un livre introuvable n'est gardé que si l'IA en est certaine (signalé « à vérifier »).
      const retenus = [...verifies.filter((v) => v.notice), ...verifies.filter((v) => !v.notice && v.p.certitude === "certaine")];

      const resultats: LivrePropose[] = [];
      const vus = new Set<number>();
      for (const { p, notice } of retenus) {
        if (resultats.length >= LIVRES_MAX) break;
        const valeurs = notice
          ? {
              cle: notice.cle,
              titre: notice.titre,
              auteurs: notice.auteurs,
              annee: notice.annee,
              editeur: notice.editeur,
              isbn: notice.isbn,
              langue: notice.langue,
              pages: notice.pages,
              couvertureUrl: notice.couvertureUrl,
              lienCatalogue: notice.lienCatalogue,
              description: notice.description,
              source: notice.source,
            }
          : {
              cle: cleNonVerifiee(p.titre, p.auteurs),
              titre: p.titre.trim().slice(0, 300),
              auteurs: p.auteurs.trim().slice(0, 300),
              annee: p.annee > 1500 && p.annee <= new Date().getFullYear() + 1 ? p.annee : null,
              editeur: p.editeur?.trim().slice(0, 120) || null,
              isbn: null,
              langue: p.langue === "autre" ? null : p.langue,
              pages: null,
              couvertureUrl: null,
              lienCatalogue: null,
              description: null,
              source: null,
            };
        const [l] = await db
          .insert(livres)
          .values(valeurs)
          .onConflictDoUpdate({ target: livres.cle, set: { cle: sql`excluded.cle` } })
          .returning({ id: livres.id });
        if (vus.has(l.id)) continue;
        vus.add(l.id);
        resultats.push({ livreId: l.id, pourquoi: p.pourquoi.trim().slice(0, 600), niveau: p.niveau, verifie: Boolean(notice) });
      }
      const [r] = await db
        .insert(recherchesBiblio)
        .values({ utilisateurId: u.id, sujet, conseil: (brut?.conseil ?? "").trim().slice(0, 1500), resultats })
        .returning();
      res.status(201).json(await versRechercheDto(r));
    }),
  );

  app.get(
    "/api/bibliotheque/recherches/:id(\\d+)",
    lecteur,
    route(async (req, res) => {
      const u = moi(req);
      const [r] = await db.select().from(recherchesBiblio).where(eq(recherchesBiblio.id, idParam(req)));
      if (!r || (r.utilisateurId !== u.id && !estPersonnel(u))) throw introuvable("Recherche");
      res.json(await versRechercheDto(r));
    }),
  );

  // ── Un livre : notice, fiche, mes notes, ma conversation, mes exposés ─────
  app.get(
    "/api/bibliotheque/livres/:id(\\d+)",
    lecteur,
    route(async (req, res) => {
      const u = moi(req);
      const l = await livreDe(idParam(req));
      const [notes, [conv], exposes] = await Promise.all([
        db.select().from(notesBiblio).where(and(eq(notesBiblio.utilisateurId, u.id), eq(notesBiblio.livreId, l.id))).orderBy(desc(notesBiblio.id)),
        db
          .select({ id: conversationsIa.id })
          .from(conversationsIa)
          .where(and(eq(conversationsIa.utilisateurId, u.id), eq(conversationsIa.livreId, l.id)))
          .orderBy(desc(conversationsIa.majLe))
          .limit(1),
        db.select().from(exposesBiblio).where(and(eq(exposesBiblio.utilisateurId, u.id), eq(exposesBiblio.livreId, l.id))).orderBy(desc(exposesBiblio.id)),
      ]);
      const dto: LivreDetailDto = {
        livre: versLivreDto(l),
        fiche: l.fiche ?? null,
        notes: notes.map((n) => ({ id: n.id, contenu: n.contenu, creeLe: n.creeLe.toISOString() })),
        conversationId: conv?.id ?? null,
        exposes: exposes.map((e) => ({ id: e.id, livreId: l.id, livreTitre: l.titre, sujet: e.sujet, creeLe: e.creeLe.toISOString() })),
      };
      res.json(dto);
    }),
  );

  /** Fiche de lecture : rédigée une seule fois, puis partagée (aucune question décomptée ensuite). */
  app.post(
    "/api/bibliotheque/livres/:id(\\d+)/fiche",
    lecteur,
    route(async (req, res) => {
      const u = moi(req);
      const l = await livreDe(idParam(req));
      if (l.fiche) return res.json({ fiche: l.fiche, depuisCache: true });
      let enCours = fichesEnCours.get(l.id);
      if (!enCours) {
        await avantAppel(u);
        enCours = (async () => {
          const brut = await appelIa(() =>
            demanderJson<unknown>({
              systeme: SYSTEME_BIBLIOTHEQUE,
              contexte: contexteLivre(l),
              messages: [
                {
                  role: "user",
                  content:
                    "Rédige la fiche de lecture de ce livre pour des étudiants qui veulent en saisir l'essentiel sans tout lire. Tutoie le lecteur. Reste fidèle à ce que tu sais réellement du livre : si tu le connais mal, dis-le dans « connaissance », reste général et prudent, et n'invente ni chapitres ni chiffres. Donne des exemples concrets, ivoiriens quand c'est pertinent.",
                },
              ],
              schema: SCHEMA_FICHE,
              gamme: "bibliotheque",
              effort: "medium",
              maxTokens: 8000,
              utilisateurId: u.id,
            }),
          );
          const fiche = ficheValide(brut);
          if (!fiche) throw new ErreurIa("La fiche n'a pas pu être rédigée. Nouvel essai possible dans un instant.", 502);
          await db.update(livres).set({ fiche, ficheLe: new Date() }).where(eq(livres.id, l.id));
          return fiche;
        })().finally(() => fichesEnCours.delete(l.id));
        fichesEnCours.set(l.id, enCours);
      }
      res.json({ fiche: await enCours, depuisCache: false });
    }),
  );

  /** « Interroger le livre » : la conversation de l'assistant liée à ce livre (créée au besoin). */
  app.post(
    "/api/bibliotheque/livres/:id(\\d+)/conversation",
    lecteur,
    route(async (req, res) => {
      const u = moi(req);
      const l = await livreDe(idParam(req));
      const { nouvelle } = valider(z.object({ nouvelle: z.boolean().optional() }), req.body ?? {});
      if (!nouvelle) {
        const [existante] = await db
          .select({ id: conversationsIa.id })
          .from(conversationsIa)
          .where(and(eq(conversationsIa.utilisateurId, u.id), eq(conversationsIa.livreId, l.id)))
          .orderBy(desc(conversationsIa.majLe))
          .limit(1);
        if (existante) return res.json({ id: existante.id });
      }
      const [c] = await db
        .insert(conversationsIa)
        .values({ utilisateurId: u.id, livreId: l.id, titre: `Livre : ${l.titre}`.slice(0, 120) })
        .returning({ id: conversationsIa.id });
      res.status(201).json({ id: c.id });
    }),
  );

  /** « Me tester » : 5 questions sur les idées du livre. */
  app.post(
    "/api/bibliotheque/livres/:id(\\d+)/quiz",
    lecteur,
    route(async (req, res) => {
      const u = moi(req);
      const l = await livreDe(idParam(req));
      await avantAppel(u);
      const brut = await appelIa(() =>
        demanderJson<{ questions: unknown[] }>({
          systeme: SYSTEME_BIBLIOTHEQUE,
          contexte: contexteLivre(l),
          messages: [
            {
              role: "user",
              content: `${adresse(u)}\n\nPrépare exactement 5 questions à choix multiple (4 options, une seule bonne) pour vérifier qu'on a compris les idées principales de ce livre : notions clés, raisonnements, application à un cas concret (ivoirien si possible). Pas de question de mémoire pure (dates, numéros de chapitre). Reste sur ce que tu sais avec certitude du livre et de son sujet. L'explication dit pourquoi la bonne réponse est juste, en deux phrases au plus.`,
            },
          ],
          schema: SCHEMA_REVISION,
          gamme: "bibliotheque",
          effort: "low",
          maxTokens: 6000,
          utilisateurId: u.id,
        }),
      );
      const questions = questionsValides(Array.isArray(brut?.questions) ? brut.questions : [], 5);
      if (!questions.length) throw new ErreurIa("Les questions n'ont pas pu être préparées. Nouvel essai possible dans un instant.", 502);
      const dto: QuizLivreDto = { questions };
      res.json(dto);
    }),
  );

  // ── Mes notes de lecture ──────────────────────────────────────────────────
  app.post(
    "/api/bibliotheque/livres/:id(\\d+)/notes",
    lecteur,
    route(async (req, res) => {
      const u = moi(req);
      const l = await livreDe(idParam(req));
      const { contenu } = valider(
        z.object({ contenu: z.string({ required_error: "écris ta note" }).trim().min(1, "écris ta note").max(6000, "6 000 caractères au maximum") }),
        req.body,
      );
      const [n] = await db.insert(notesBiblio).values({ utilisateurId: u.id, livreId: l.id, contenu }).returning();
      res.status(201).json({ id: n.id, contenu: n.contenu, creeLe: n.creeLe.toISOString() });
    }),
  );

  app.delete(
    "/api/bibliotheque/notes/:id(\\d+)",
    lecteur,
    route(async (req, res) => {
      const u = moi(req);
      const suppr = await db
        .delete(notesBiblio)
        .where(and(eq(notesBiblio.id, idParam(req)), eq(notesBiblio.utilisateurId, u.id)))
        .returning({ id: notesBiblio.id });
      if (!suppr.length) throw introuvable("Note");
      res.json({ ok: true });
    }),
  );

  // ── Préparer mon exposé ────────────────────────────────────────────────────
  app.post(
    "/api/bibliotheque/livres/:id(\\d+)/expose",
    lecteur,
    route(async (req, res) => {
      const u = moi(req);
      const l = await livreDe(idParam(req));
      const d = valider(
        z.object({
          sujet: z.string({ required_error: "précise le sujet de ton exposé" }).trim().min(3, "précise le sujet de ton exposé").max(300, "300 caractères au maximum"),
          minutes: z.number().int().min(3).max(45).optional(),
        }),
        req.body,
      );
      await avantAppel(u);
      const notes = await db
        .select({ contenu: notesBiblio.contenu })
        .from(notesBiblio)
        .where(and(eq(notesBiblio.utilisateurId, u.id), eq(notesBiblio.livreId, l.id)))
        .orderBy(notesBiblio.id)
        .limit(40);
      const minutes = d.minutes ?? 10;
      const bibliographie = `${l.auteurs || "Auteur inconnu"}${l.annee ? ` (${l.annee})` : ""}. ${l.titre}.${l.editeur ? ` ${l.editeur}.` : ""}${l.isbn ? ` ISBN ${l.isbn}.` : ""}`;
      const contenu = await appelIa(() =>
        demanderClaude({
          systeme: SYSTEME_BIBLIOTHEQUE,
          contexte: contexteLivre(l),
          messages: [
            {
              role: "user",
              content: `${adresse(u)}\n\nAide à préparer un exposé oral de ${minutes} minutes à partir de ce livre.\n\nSujet de l'exposé :\n<sujet>\n${neutraliserBiblio(d.sujet)}\n</sujet>\n\nNotes de lecture personnelles (à intégrer en priorité, ce sont ses propres trouvailles) :\n<notes>\n${notes.map((n) => `- ${neutraliserBiblio(n.contenu)}`).join("\n").slice(0, 12_000) || "(aucune note pour l'instant)"}\n</notes>\n\nRédige en Markdown, dans cet ordre :\n## Problématique\nune question claire qui guide l'exposé.\n## Plan\nintroduction (accroche), 2 ou 3 parties, conclusion, avec la durée de chaque partie (total ${minutes} minutes).\n## Diapositives\n8 à 12 diapositives : pour chacune, un titre en gras, 3 puces courtes au plus, et une ligne « À dire : » pour l'orateur.\n## Questions du public\n4 questions probables avec une piste de réponse.\n## Esprit critique\nlimites du livre, ce qu'il faut vérifier ou compléter avec d'autres sources.\n## Bibliographie\ncommence par : ${bibliographie}\nAjoute au plus 2 autres références seulement si tu es certain qu'elles existent.\n\nNe prétends jamais citer le livre mot pour mot. Signale « (à vérifier dans le livre) » pour les points dont tu n'es pas sûr.`,
            },
          ],
          gamme: "bibliotheque",
          effort: "medium",
          maxTokens: 9000,
          utilisateurId: u.id,
        }),
      );
      if (!contenu.trim()) throw new ErreurIa("L'exposé n'a pas pu être préparé. Nouvel essai possible dans un instant.", 502);
      const [e] = await db.insert(exposesBiblio).values({ utilisateurId: u.id, livreId: l.id, sujet: d.sujet, contenu }).returning();
      await db.insert(journal).values({ utilisateurId: u.id, action: "bibliotheque.expose", details: { livreId: l.id, exposeId: e.id } });
      const dto: ExposeDto = { id: e.id, livreId: l.id, livreTitre: l.titre, sujet: e.sujet, creeLe: e.creeLe.toISOString(), contenu: e.contenu };
      res.status(201).json(dto);
    }),
  );

  app.get(
    "/api/bibliotheque/exposes/:id(\\d+)",
    lecteur,
    route(async (req, res) => {
      const u = moi(req);
      const [ligne] = await db
        .select({ e: exposesBiblio, titre: livres.titre })
        .from(exposesBiblio)
        .innerJoin(livres, eq(livres.id, exposesBiblio.livreId))
        .where(eq(exposesBiblio.id, idParam(req)));
      if (!ligne || (ligne.e.utilisateurId !== u.id && !estPersonnel(u))) throw introuvable("Exposé");
      const { e, titre } = ligne;
      const dto: ExposeDto = { id: e.id, livreId: e.livreId, livreTitre: titre, sujet: e.sujet, creeLe: e.creeLe.toISOString(), contenu: e.contenu };
      res.json(dto);
    }),
  );

  app.delete(
    "/api/bibliotheque/exposes/:id(\\d+)",
    lecteur,
    route(async (req, res) => {
      const u = moi(req);
      const suppr = await db
        .delete(exposesBiblio)
        .where(and(eq(exposesBiblio.id, idParam(req)), eq(exposesBiblio.utilisateurId, u.id)))
        .returning({ id: exposesBiblio.id });
      if (!suppr.length) throw introuvable("Exposé");
      res.json({ ok: true });
    }),
  );

  // ── Suivi (formateurs, équipe) : ce que les étudiants cherchent et préparent ──
  app.get(
    "/api/bibliotheque/activite",
    exigerRole(...ROLES_SUIVI),
    route(async (req, res) => {
      const u = moi(req);
      // Périmètre : la direction voit tout, la vie scolaire son campus, le formateur les étudiants de ses cours.
      let filtre: ReturnType<typeof inArray> | undefined;
      if (u.role === "formateur") {
        const ids = new Set<number>();
        for (const coursId of await idsCoursAccessibles(u)) for (const e of await etudiantsDuCours(coursId)) ids.add(e.id);
        if (!ids.size) return res.json({ lignes: [] } satisfies ActiviteBiblioDto);
        filtre = inArray(utilisateurs.id, [...ids]);
      } else {
        const p = perimetreSites(u);
        if (p) filtre = inArray(utilisateurs.siteId, p);
      }
      const qui = {
        etudiantId: utilisateurs.id,
        prenom: utilisateurs.prenom,
        nom: utilisateurs.nom,
        classe: classes.nom,
        site: sites.nomCourt,
      };
      const [recherches, exposes] = await Promise.all([
        db
          .select({ r: recherchesBiblio, ...qui })
          .from(recherchesBiblio)
          .innerJoin(utilisateurs, eq(utilisateurs.id, recherchesBiblio.utilisateurId))
          .leftJoin(classes, eq(classes.id, utilisateurs.classeId))
          .leftJoin(sites, eq(sites.id, utilisateurs.siteId))
          .where(and(eq(utilisateurs.role, "etudiant"), filtre))
          .orderBy(desc(recherchesBiblio.id))
          .limit(150),
        db
          .select({ e: { id: exposesBiblio.id, sujet: exposesBiblio.sujet, creeLe: exposesBiblio.creeLe }, livre: livres.titre, ...qui })
          .from(exposesBiblio)
          .innerJoin(livres, eq(livres.id, exposesBiblio.livreId))
          .innerJoin(utilisateurs, eq(utilisateurs.id, exposesBiblio.utilisateurId))
          .leftJoin(classes, eq(classes.id, utilisateurs.classeId))
          .leftJoin(sites, eq(sites.id, utilisateurs.siteId))
          .where(and(eq(utilisateurs.role, "etudiant"), filtre))
          .orderBy(desc(exposesBiblio.id))
          .limit(150),
      ]);
      const parId = await livresParId(recherches.flatMap((l) => l.r.resultats.map((x) => x.livreId)));
      const lignes: ActiviteBiblioDto["lignes"] = [
        ...recherches.map((l) => ({
          type: "recherche" as const,
          id: l.r.id,
          le: l.r.creeLe.toISOString(),
          etudiant: { id: l.etudiantId, prenom: l.prenom, nom: l.nom, classe: l.classe, site: l.site },
          sujet: l.r.sujet,
          livres: l.r.resultats.flatMap((x) => (parId.get(x.livreId) ? [parId.get(x.livreId)!.titre] : [])),
        })),
        ...exposes.map((l) => ({
          type: "expose" as const,
          id: l.e.id,
          le: l.e.creeLe.toISOString(),
          etudiant: { id: l.etudiantId, prenom: l.prenom, nom: l.nom, classe: l.classe, site: l.site },
          sujet: l.e.sujet,
          livres: [l.livre],
        })),
      ].sort((a, b) => b.le.localeCompare(a.le));
      res.json({ lignes } satisfies ActiviteBiblioDto);
    }),
  );
}
