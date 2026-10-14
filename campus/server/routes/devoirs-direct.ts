// Devoir donné en direct depuis le Studio (demande de José du 12 octobre 2026 : « je veux créer le devoir pendant le
// cours, en direct : ils répondent, moi, je vois directement »).
//
//   - POST   /api/seances/:id/devoirs-direct            donner le devoir (un vrai devoir de dépôt, publié)
//   - PATCH  /api/seances/:id/devoirs-direct/:devoirId  « +5 min », « Rouvrir 5 min », « Arrêter les réponses »
//   - DELETE /api/seances/:id/devoirs-direct/:devoirId  erreur de saisie (refusé dès qu'une copie existe)
//
// Rien de parallèle : création par creerDevoir (la même logique que POST /api/devoirs), rendu par
// POST /api/devoirs/:id/rendre (routes/evaluations.ts), correction par le même moteur (server/correction-auto.ts),
// projection par la même route (routes/copies-direct.ts). Droits : ceux de « Devoirs dans le Studio »
// (animateurCopies). Réponses en « no-store ».
import type { Express, Response } from "express";
import { z } from "zod";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "../db";
import { exigerConnexion, moi } from "../auth";
import { route, valider, idParam, ErreurHttp } from "../http";
import { etudiantsDuCours } from "../acces";
import { notifier } from "../notifications";
import { publier, utilisateursSur } from "../temps-reel";
import { CORRIGE_MAX } from "../corriges";
import { echeance, finEcheance } from "../evaluations-outils";
import { dtoPublic, publierDevoirDirect } from "../devoirs-direct";
import * as visio from "../visio";
import { animateurCopies } from "./copies-direct";
import { creerDevoir } from "./evaluations";
import { canal, consigner } from "./live";
import { sessionOuverte } from "./live-groupes";
import { CONSIGNE_DIRECT_MAX, titreDeConsigne } from "@shared/devoir-direct";
import { formaterDate, registreDe } from "@shared/textes";
import { t } from "@shared/textes/devoir-direct";
import { devoirs, devoirsDirect, journal, rappelsDevoirs, rendus, type Seance, type Utilisateur } from "@shared/schema";
import { debutDuCours } from "@shared/ouverture";

const MINUTE = 60_000;
const sansCache = (res: Response) => res.setHeader("Cache-Control", "no-store");
const texte = (u: Pick<Utilisateur, "role">, cle: Parameters<typeof t>[0], v?: Record<string, string | number>) => t(cle, { registre: registreDe(u.role), v });

/** Arrondi à la minute supérieure (secondes et millisecondes à 0) : « à rendre avant 11h31 », jamais 11h30m12s. */
const minuteSuperieure = (ms: number) => Math.ceil(ms / MINUTE) * MINUTE;
/** Minute entamée : la fin du cours se dit comme le chrono du Studio (« Fin prévue 11h44 » pour 11:44:30). */
const minuteInferieure = (ms: number) => Math.floor(ms / MINUTE) * MINUTE;

/** 23:59 du jour d'Abidjan (GMT, sans heure d'été) : « Ce soir ». */
function ceSoir(maintenant: Date): Date {
  return new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate(), 23, 59, 0, 0));
}

/**
 * Échéance calculée par le serveur (l'heure affichée dans le Studio n'est qu'indicative) : fin du cours prévue
 * (début du cours : debutDuCours, plus la durée, à la minute entamée ; moins de 5 minutes devant : dans
 * 10 minutes), dans n minutes, ou ce soir à 23h59. Durées arrondies à la minute supérieure, puis fin d'échéance
 * (« 23h59 » vaut jusqu'à 23:59:59,999).
 */
function echeanceDemandee(s: Pick<Seance, "demarreeLe" | "debutCours" | "debut" | "dureeMinutes">, choix: "fin" | "soir" | number, maintenant: Date): Date {
  const m = maintenant.getTime();
  if (choix === "fin") {
    // Fin prévue à la minute près, comme le chrono du Studio : la pastille, le chrono et la carte disent la même heure.
    // Début du cours : l'heure prévue pour une classe ouverte en avance (debutDuCours), sinon le démarrage réel.
    const fin = minuteInferieure(debutDuCours(s).getTime() + s.dureeMinutes * MINUTE);
    return finEcheance(new Date(fin - m < 5 * MINUTE ? minuteSuperieure(m + 10 * MINUTE) : fin));
  }
  const cible = choix === "soir" ? ceSoir(maintenant).getTime() : m + choix * MINUTE;
  return finEcheance(new Date(minuteSuperieure(cible)));
}

const schemaDonner = z.object({
  consigne: z.string().trim().min(3, "Écrivez la consigne (3 caractères au moins).").max(CONSIGNE_DIRECT_MAX, `${CONSIGNE_DIRECT_MAX} caractères au plus.`),
  titre: z.string().trim().max(200, "200 caractères au plus.").optional(),
  echeance: z.union([z.literal("fin"), z.literal("soir"), z.number().int().min(5).max(240)]),
  enGroupe: z.boolean().default(false),
  /** Réponse attendue : formateur ou direction seulement (creerDevoir refuse celle de la vie scolaire, D-F). */
  corrige: z.string().max(CORRIGE_MAX).optional(),
});

const schemaReglage = z.object({ action: z.enum(["prolonger", "clore"]) });

/** Séance animée par la personne (droits de « Devoirs dans le Studio »), en direct. */
async function seanceEnDirect(u: Utilisateur, seanceId: number): Promise<Seance> {
  const s = await animateurCopies(u, seanceId, texte(u, "erreur.droits"));
  if (s.statut !== "en_direct") throw new ErreurHttp(409, texte(u, "erreur.pasEnDirect"), { code: "pas_en_direct" });
  return s;
}

/** Devoir donné en direct dans cette séance, ou 404. */
async function devoirDeLaSeance(u: Utilisateur, s: Seance, devoirId: number) {
  const [l] = await db
    .select({ dd: devoirsDirect, d: devoirs })
    .from(devoirsDirect)
    .innerJoin(devoirs, eq(devoirs.id, devoirsDirect.devoirId))
    .where(and(eq(devoirsDirect.devoirId, devoirId), eq(devoirsDirect.seanceId, s.id)));
  if (!l) throw new ErreurHttp(404, texte(u, "erreur.introuvable"));
  return l;
}

export function enregistrerDevoirsDirect(app: Express) {
  // ── Donner le devoir ──────────────────────────────────────────────────────
  app.post(
    "/api/seances/:id(\\d+)/devoirs-direct",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const s = await seanceEnDirect(u, idParam(req));
      // Essai de visio (direct immédiat sans prévenir) : la classe n'en sait rien, et l'essai s'efface tout seul. Un
      // devoir donné là deviendrait pourtant un vrai devoir publié, dans « Devoirs » et « Notes » de toute la classe.
      if (await visio.estEssaiDirect(s.id)) throw new ErreurHttp(409, texte(u, "erreur.essai"), { code: "essai" });
      const v = valider(schemaDonner, req.body);
      const maintenant = new Date();
      const dateLimite = echeanceDemandee(s, v.echeance, maintenant);
      if (dateLimite.getTime() - maintenant.getTime() < 2 * MINUTE) throw new ErreurHttp(409, texte(u, "erreur.echeance"), { code: "echeance" });
      // Une réponse par groupe : seulement avec des groupes de travail ouverts ; le devoir garde cette répartition.
      const session = v.enGroupe ? await sessionOuverte(s.id) : null;
      if (v.enGroupe && !session) throw new ErreurHttp(409, texte(u, "erreur.groupesFermes"), { code: "groupes_fermes" });
      const titre = (v.titre && v.titre.length >= 2 ? v.titre : "") || titreDeConsigne(v.consigne) || t("titre.defaut", { v: { jour: formaterDate(maintenant) } });

      // Un vrai devoir de dépôt du campus, publié, sans « Nouveau devoir » à toute la classe (elle le voit en direct).
      const { d, c } = await creerDevoir(
        u,
        {
          coursId: s.coursId,
          type: "depot",
          titre,
          consigne: v.consigne,
          fichierIds: [],
          ouvertureLe: null,
          dateLimite: dateLimite.toISOString(),
          bareme: 20,
          coefficient: 1,
          // Une réponse partie hors ligne pendant le cours et arrivée après la date limite est acceptée, en retard.
          accepteRetard: true,
          dureeMinutes: null,
          tentativesMax: 1,
          correctionVisible: true,
          grille: [],
          publie: true,
        },
        { corrige: v.corrige, annonce: false, journal: { direct: { seanceId: s.id, enGroupe: v.enGroupe } } },
      );
      const [dd] = await db
        .insert(devoirsDirect)
        .values({ devoirId: d.id, seanceId: s.id, enGroupe: v.enGroupe, sessionGroupesId: session?.id ?? null, creeParId: u.id })
        .returning();

      // Inscrits absents de la classe en ce moment : prévenus dans la cloche du campus, sans rappel sur le téléphone.
      // Pas avant l'heure prévue du cours : la classe n'est pas encore attendue (et un direct lancé en avance peut
      // être un essai, remis à venir ensuite : le devoir disparaît alors, rien ne doit en avoir été annoncé).
      // La ligne « ouverture » est réservée pour tous : sans elle, une retouche du devoir dans l'éditeur
      // annoncerait « Nouveau devoir » à toute la classe (annoncerSiOuvert).
      const presents = new Set(utilisateursSur(canal(s.id)).map((x) => x.id));
      const avantLHeure = s.debut.getTime() > maintenant.getTime();
      const absents = avantLHeure ? [] : (await etudiantsDuCours(s.coursId)).filter((e) => !presents.has(e.id)).map((e) => e.id);
      await db.insert(rappelsDevoirs).values({ devoirId: d.id, type: "ouverture", echeance: d.dateLimite, destinataires: absents.length }).onConflictDoNothing();
      if (absents.length) {
        await notifier(absents, {
          type: "devoir",
          titre: t("notif.titre", { registre: "tu", v: { titre: d.titre } }),
          corps: t("notif.corps", { registre: "tu", v: { code: c.code, date: formaterDate(echeance(d), { style: "jourHeure" }) } }),
          lien: `/devoirs/${d.id}`,
          push: false,
        });
      }
      await consigner(s.id, "devoir_direct", { action: "donne", devoirId: d.id, titre: d.titre, enGroupe: v.enGroupe, dateLimite: echeance(d).toISOString(), par: u.id });
      const dto = await dtoPublic(dd, d);
      publier(canal(s.id), "devoir-direct", dto);
      sansCache(res);
      res.status(201).json(dto);
    }),
  );

  // ── Prolonger, arrêter les réponses ───────────────────────────────────────
  app.patch(
    "/api/seances/:id(\\d+)/devoirs-direct/:devoirId(\\d+)",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const s = await seanceEnDirect(u, idParam(req));
      const { dd, d } = await devoirDeLaSeance(u, s, idParam(req, "devoirId"));
      const { action } = valider(schemaReglage, req.body);
      const maintenant = Date.now();
      // « +5 min » et « Rouvrir 5 min » : cinq minutes après la plus tardive de maintenant et de l'échéance actuelle.
      // « Arrêter les réponses » : la date limite passe à maintenant (une copie qui arrive ensuite est en retard).
      const dateLimite =
        action === "prolonger" ? finEcheance(new Date(minuteSuperieure(Math.max(maintenant, echeance(d).getTime()) + 5 * MINUTE))) : new Date(maintenant);
      const [maj] = await db.update(devoirs).set({ dateLimite }).where(eq(devoirs.id, d.id)).returning();
      await db.insert(journal).values({ utilisateurId: u.id, action: "devoir_modifie", details: { devoirId: d.id, champs: ["dateLimite"], direct: true, action } });
      await consigner(s.id, "devoir_direct", { action: action === "prolonger" ? "prolonge" : "clos", devoirId: d.id, titre: d.titre, dateLimite: echeance(maj).toISOString(), par: u.id });
      await publierDevoirDirect(s.id);
      sansCache(res);
      res.json(await dtoPublic(dd, maj));
    }),
  );

  // ── Supprimer (erreur de saisie) ──────────────────────────────────────────
  app.delete(
    "/api/seances/:id(\\d+)/devoirs-direct/:devoirId(\\d+)",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const s = await seanceEnDirect(u, idParam(req));
      const { d } = await devoirDeLaSeance(u, s, idParam(req, "devoirId"));
      // Une copie est une preuve : même règle que DELETE /api/devoirs/:id.
      const [{ n }] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(rendus)
        .where(and(eq(rendus.devoirId, d.id), ne(rendus.statut, "brouillon")));
      if (n > 0) throw new ErreurHttp(409, texte(u, "erreur.reponses"), { code: "reponses" });
      await db.delete(devoirs).where(eq(devoirs.id, d.id));
      await db.insert(journal).values({ utilisateurId: u.id, action: "devoir_supprime", details: { devoirId: d.id, titre: d.titre, coursId: d.coursId, direct: true } });
      await consigner(s.id, "devoir_direct", { action: "supprime", devoirId: d.id, titre: d.titre, par: u.id });
      const devoirDirect = await publierDevoirDirect(s.id);
      sansCache(res);
      res.json({ ok: true, devoirDirect });
    }),
  );
}
