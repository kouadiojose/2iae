// Daily « enfin testable » : salle d'essai permanente, présence dans une
// salle, mémoire du dernier essai, carte « Prêt pour votre prochaine classe »,
// fuseau horaire des formateurs, minutes-participant et réglages de la visio.
//
// Enregistré par enregistrerVisioCampus (module visio), avant les routes
// /api/visio/:seanceId/… pour que « essai » ne soit pas lu comme un numéro.
import type { Express } from "express";
import { z } from "zod";
import { and, asc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { db } from "./db";
import { exigerConnexion, exigerRole, moi, oublierUtilisateur, versMoi, estEquipe } from "./auth";
import { route, valider, idParam, interdit, ErreurHttp } from "./http";
import { seanceVisible, enseigneCours, idsCoursAccessibles } from "./acces";
import { planifier } from "./taches";
import * as visio from "./visio";
import { stockageReplaysDisponible } from "./stockage-replays";
import {
  seances,
  replaysStockes,
  cours,
  sites,
  utilisateurs,
  journal,
  FOURNISSEURS_VISIO,
  type Utilisateur,
  type AccesDaily,
  type OptionsVisio,
  type PresenceSalleVisio,
  type PretClasseDto,
  type ReglagesVisioDto,
  type PreferencesUtilisateur,
} from "@shared/schema";

const MINUTE = 60_000;

/** Fuseau IANA valide (« America/Toronto ») : le moteur de dates doit le connaître. */
export function fuseauValide(f: string): boolean {
  if (!/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(f) || f.length > 64) return false;
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: f }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** Nom montré aux autres dans une salle Daily (jamais de nom d'étudiant sur l'écran d'une salle : Daily ne l'affiche qu'aux personnes présentes). */
async function nomDansLaSalle(u: Utilisateur): Promise<string> {
  const [site] = u.siteId ? await db.select().from(sites).where(eq(sites.id, u.siteId)) : [];
  switch (u.role) {
    case "formateur":
      return `${u.prenom} ${u.nom} · formateur`;
    case "admin":
      return `${u.prenom} ${u.nom} · direction`;
    case "vie_scolaire":
      return `${u.prenom} ${u.nom} · vie scolaire`;
    case "salle":
      return `${site?.salleConference ?? "Salle"} · ${site?.nomCourt ?? ""}`.trim();
    default:
      return `${site?.nomCourt ?? "En ligne"} · ${u.prenom} ${u.nom.charAt(0)}.`;
  }
}

// Présence lue chez Daily : 5 s de cache par salle (plusieurs pages l'interrogent à la fois).
const cachePresence = new Map<string, { exp: number; valeur: PresenceSalleVisio }>();
async function presence(nom: string): Promise<PresenceSalleVisio> {
  const c = cachePresence.get(nom);
  if (c && c.exp > Date.now()) return c.valeur;
  let valeur: PresenceSalleVisio;
  try {
    valeur = await visio.presenceSalle(nom);
  } catch {
    valeur = { salle: nom, presents: [], lu: new Date().toISOString(), disponible: false };
  }
  cachePresence.set(nom, { exp: Date.now() + 5000, valeur });
  return valeur;
}

// Garde-fou : une demande de jeton d'essai toutes les 3 s par personne.
const derniersJetons = new Map<number, number>();

const schemaResultat = z.object({
  connexion: z.enum(["ok", "avertissement", "echec", "non_teste"]),
  qualite: z.enum(["bonne", "moyenne", "faible"]).nullable(),
  camera: z.boolean().nullable(),
  micro: z.boolean().nullable(),
  salle: z.boolean(),
});

const schemaReglages = z
  .object({
    fournisseurParDefaut: z.enum(FOURNISSEURS_VISIO),
    videoEtudiantParDefaut: z.boolean(),
    // Le forfait Daily plafonne la salle entière (200 personnes par défaut) : formateur, salles et équipe compris.
    placesDailyEtudiants: z
      .number()
      .int()
      .min(0, "0 au moins")
      .refine((n) => n <= visio.placesDailyEtudiantsMax(), () => ({
        message: `${visio.placesDailyEtudiantsMax()} au plus : le forfait Daily accepte ${visio.placesDailyEtudiantsMax() + visio.PLACES_HORS_ETUDIANTS} personnes par salle, dont ${visio.PLACES_HORS_ETUDIANTS} places gardées pour le formateur, les salles et l'équipe`,
      })),
    prixMinuteUsd: z.number().min(0).max(1, "1 dollar au plus"),
    minutesOffertes: z.number().int().min(0).max(10_000_000),
    tauxFcfa: z.number().int().min(1).max(5000),
  })
  .partial();

async function versReglagesDto(): Promise<ReglagesVisioDto> {
  const r = visio.reglagesCourants();
  const [stock] = await db.select({ nombre: sql<number>`count(*)::int`, octets: sql<number>`coalesce(sum(${replaysStockes.tailleOctets}), 0)::float8` }).from(replaysStockes);
  return {
    fournisseurParDefaut: visio.fournisseurParDefaut(),
    videoEtudiantParDefaut: r.videoEtudiantParDefaut,
    placesDailyEtudiants: Math.min(r.placesDailyEtudiants, visio.placesDailyEtudiantsMax()),
    placesDailyMax: visio.placesDailyEtudiantsMax(),
    placesHorsEtudiants: visio.PLACES_HORS_ETUDIANTS,
    prixMinuteUsd: r.prixMinuteUsd,
    minutesOffertes: r.minutesOffertes,
    tauxFcfa: r.tauxFcfa,
    fournisseurs: visio.fournisseursDisponibles(),
    daily: visio.dailyDisponible(),
    majLe: r.majLe ? new Date(r.majLe).toISOString() : null,
    replays: { bucket: stockageReplaysDisponible(), nombre: stock?.nombre ?? 0, octets: stock?.octets ?? 0 },
  };
}

export function enregistrerVisioDaily(app: Express) {
  void visio.chargerReglagesVisio();
  void visio.decouvrirDomaineDaily();

  // ── Ce que le client doit savoir de la visio ────────────────────────────
  app.get(
    "/api/visio/options",
    exigerConnexion,
    route(async (_req, res) => {
      res.json({
        daily: visio.dailyDisponible(),
        domaineDaily: visio.domaineDailyConnu(),
        fournisseurParDefaut: visio.fournisseurParDefaut(),
        fournisseurs: visio.fournisseursDisponibles(),
        videoEtudiantParDefaut: visio.reglagesCourants().videoEtudiantParDefaut,
      } satisfies OptionsVisio);
    }),
  );

  // ── Salle d'essai permanente ────────────────────────────────────────────
  app.post(
    "/api/visio/essai/rejoindre",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      if (!visio.dailyDisponible()) {
        throw new ErreurHttp(503, "La visio Daily n'est pas configurée sur ce campus : la salle d'essai n'existe pas encore.", { code: "daily_absent" });
      }
      const dernier = derniersJetons.get(u.id) ?? 0;
      if (Date.now() - dernier < 3000) throw new ErreurHttp(429, "Un instant : la salle d'essai s'ouvre déjà.");
      derniersJetons.set(u.id, Date.now());
      const salle = await visio.obtenirSalleEssai();
      const nomAffiche = await nomDansLaSalle(u);
      // Propriétaire : formateur et direction. Salle et vie scolaire : caméra et micro. Étudiant : micro seulement (pas de caméra étudiante).
      const profil = u.role === "formateur" || u.role === "admin" ? "formateur" : u.role === "salle" || u.role === "vie_scolaire" ? "salle" : "etudiant";
      // Quinze étudiants au plus à la fois, un quart d'heure chacun : la salle reste ouverte aux formateurs et aux écrans de salle.
      await visio.reserverPlaceDaily({ salle: salle.nom, profil, utilisateurId: u.id, essai: true });
      const jeton = await visio.jetonDaily({
        salle: salle.nom,
        nomAffiche,
        utilisateurId: u.id,
        profil,
        exp: Math.floor(Date.now() / 1000) + 2 * 3600,
        ejecterApres: profil === "etudiant" ? visio.DUREE_MAX_ESSAI_ETUDIANT_S : visio.DUREE_MAX_ESSAI_S,
        enregistrementPermis: false,
        envoi: profil === "etudiant" ? ["audio"] : undefined,
      });
      res.json({ url: salle.url, jeton, nomAffiche, profil } satisfies AccesDaily);
    }),
  );

  app.get(
    "/api/visio/essai/presence",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      res.setHeader("Cache-Control", "no-store");
      const p = await presence(visio.NOM_SALLE_ESSAI);
      // Un étudiant voit combien de personnes sont là, pas leurs noms.
      if (u.role === "etudiant") return res.json({ ...p, presents: p.presents.map((x) => ({ ...x, nom: "Une personne" })) });
      res.json(p);
    }),
  );

  // Mémorise le dernier essai (préférences du compte) : il alimente la carte « Prêt pour votre prochaine classe ».
  app.post(
    "/api/visio/essai/resultat",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const r = valider(schemaResultat, req.body);
      const reussi = r.salle || ((r.connexion === "ok" || r.connexion === "avertissement") && r.micro !== false);
      const le = new Date().toISOString();
      const precedent = u.preferences?.essaiVisio;
      const essai: NonNullable<PreferencesUtilisateur["essaiVisio"]> = {
        le,
        reussi,
        ...r,
        dernierSucces: reussi ? le : (precedent?.dernierSucces ?? null),
      };
      const [apres] = await db
        .update(utilisateurs)
        .set({ preferences: sql`coalesce(${utilisateurs.preferences}, '{}'::jsonb) || ${JSON.stringify({ essaiVisio: essai })}::jsonb` })
        .where(eq(utilisateurs.id, u.id))
        .returning();
      oublierUtilisateur(u.id);
      res.json(await versMoi(apres));
    }),
  );

  // Qui est dans la salle Daily d'une séance (répétition, accueil des salles) : formateur du cours et équipe.
  app.get(
    "/api/visio/seances/:id/presence",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const s = await seanceVisible(u, idParam(req));
      if (!estEquipe(u) && !(u.role === "formateur" && (await enseigneCours(u, s.coursId)))) {
        throw interdit("Seuls le formateur du cours et l'équipe voient qui est dans la salle.");
      }
      res.setHeader("Cache-Control", "no-store");
      if (s.fournisseur !== "daily") return res.json({ salle: "", presents: [], lu: new Date().toISOString(), disponible: false } satisfies PresenceSalleVisio);
      res.json(await presence(visio.nomSalleVisio(s.id)));
    }),
  );

  // ── Carte « Prêt pour votre prochaine classe » ──────────────────────────
  app.get(
    "/api/visio/pret",
    exigerRole("formateur", "admin", "vie_scolaire"),
    route(async (req, res) => {
      const u = moi(req);
      const ids = await idsCoursAccessibles(u);
      const maintenant = Date.now();
      const [prochaine] = ids.length
        ? await db
            .select({ s: seances, code: cours.code })
            .from(seances)
            .innerJoin(cours, eq(cours.id, seances.coursId))
            .where(
              and(
                inArray(seances.coursId, ids),
                or(eq(seances.statut, "en_direct"), and(eq(seances.statut, "planifiee"), gt(sql`${seances.debut} + (${seances.dureeMinutes} * interval '1 minute')`, new Date(maintenant)))),
              ),
            )
            .orderBy(asc(seances.debut))
            .limit(1)
        : [];
      const essai = u.preferences?.essaiVisio;
      const plan = prochaine?.s.plan ?? [];
      res.json({
        fuseau: u.fuseau,
        essai: essai ? { le: essai.le, reussi: essai.reussi, salle: essai.salle } : null,
        seance: prochaine
          ? {
              id: prochaine.s.id,
              titre: prochaine.s.titre,
              coursCode: prochaine.code,
              debut: prochaine.s.debut.toISOString(),
              dureeMinutes: prochaine.s.dureeMinutes,
              fournisseur: prochaine.s.fournisseur,
              statut: prochaine.s.statut,
              diapos: prochaine.s.diapos.length,
              etapes: plan.length,
              minutesPlan: plan.reduce((t, e) => t + (e.minutes ?? 0), 0),
              planMinute: plan.length > 0 && plan.every((e) => Boolean(e.minutes)),
            }
          : null,
      } satisfies PretClasseDto);
    }),
  );

  // ── Fuseau horaire (formateurs et équipe ; les étudiants restent à l'heure d'Abidjan) ──
  app.put(
    "/api/compte/fuseau",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      if (u.role === "etudiant" || u.role === "salle") throw interdit("Les horaires des étudiants et des salles restent à l'heure d'Abidjan.");
      const { fuseau } = valider(z.object({ fuseau: z.string().trim().min(3).max(64) }), req.body);
      if (!fuseauValide(fuseau)) throw new ErreurHttp(400, "Ce fuseau horaire est inconnu. Choisissez une ville dans la liste.");
      const [apres] = await db.update(utilisateurs).set({ fuseau }).where(eq(utilisateurs.id, u.id)).returning();
      oublierUtilisateur(u.id);
      if (u.fuseau !== fuseau) await db.insert(journal).values({ utilisateurId: u.id, action: "fuseau_choisi", details: { fuseau } });
      res.json(await versMoi(apres));
    }),
  );

  // ── Coût : minutes-participant du mois ──────────────────────────────────
  app.get(
    "/api/visio/usage",
    exigerRole("admin", "vie_scolaire"),
    route(async (req, res) => {
      const demande = String(req.query.mois ?? "");
      const mois = /^\d{4}-(0[1-9]|1[0-2])$/.test(demande) ? demande : new Date().toISOString().slice(0, 7);
      res.setHeader("Cache-Control", "no-store");
      res.json(await visio.usageDaily(mois));
    }),
  );

  app.get(
    "/api/visio/reglages",
    exigerRole("admin", "vie_scolaire"),
    route(async (_req, res) => {
      res.json(await versReglagesDto());
    }),
  );

  app.put(
    "/api/visio/reglages",
    exigerRole("admin"),
    route(async (req, res) => {
      const u = moi(req);
      const d = valider(schemaReglages, req.body);
      if (d.fournisseurParDefaut && (!visio.fournisseursDisponibles().includes(d.fournisseurParDefaut) || d.fournisseurParDefaut === "externe")) {
        throw new ErreurHttp(400, "Ce fournisseur ne peut pas servir par défaut sur ce campus.");
      }
      await visio.enregistrerReglagesVisio(d, u.id);
      visio.oublierUsage();
      await db.insert(journal).values({ utilisateurId: u.id, action: "reglages_visio", details: d });
      res.json(await versReglagesDto());
    }),
  );

  // ── Ménage : les essais de « direct immédiat » qui n'ont servi à personne disparaissent ──
  planifier("visio-essais-direct", 5 * MINUTE, async () => {
    const liste = await visio.essaisAEffacer();
    for (const e of liste) {
      await db.delete(seances).where(eq(seances.id, e.id));
      if (e.salleVisio) await visio.supprimerSalleDaily(e.salleVisio);
      await db.insert(journal).values({ action: "direct_essai_efface", details: { seanceId: e.id } });
    }
    if (liste.length) console.log(`[visio] ${liste.length} essai(s) de direct effacé(s)`);
  });
}
