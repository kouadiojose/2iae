// Salles de conférence d'un campus (shared/salles.ts, décision de José du 12 octobre 2026) :
// les salles de chaque campus (nom, public L1/L2, écran), leur ajout et leur réglage, puis la
// page « Les salles du jour » : un message WhatsApp par salle et par jour (ses cours, le lien de
// son écran), envoyé d'un toucher au coordinateur des salles, qui le transfère au responsable de
// la salle. Le campus n'a pas accès à l'API WhatsApp : chaque matin à 6 h 30 (Abidjan), la
// direction reçoit un rappel qui ouvre la page (rappelerSallesDuJour), sur ses deux casquettes quand
// elle en a deux. Pour qu'on la trouve (13 octobre 2026), deux comptes légers, sans aucun lien : celui
// du tableau de la direction (carte d'action en haut) et celui de l'accueil d'un formateur dont
// l'autre casquette est la direction (compterSallesDuJour).
// Droits : ceux de l'installation des écrans (outils_campus), dans le périmètre de la personne ;
// le numéro du coordinateur, la direction seule. Réglage gardé dans contenus_site (clés
// « pilotage.salles », « pilotage.salles.rappel » et « pilotage.salles.envois.<jour> », que le site public
// écarte : lireContenus de public.ts ne garde que ses propres clés, pour que la date de mise à jour du site
// n'en dépende pas). Le repère « Envoyé » d'un message est gardé sur le serveur (enregistrerEnvoi) : tous les
// appareils et les deux casquettes savent qu'il est parti, le coordinateur ne le reçoit pas deux fois.
// Les réponses qui portent un lien d'écran ne sont jamais mises en cache ; aucun lien au journal.
import type { Express, Request } from "express";
import { z } from "zod";
import { and, asc, count, eq, gte, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db, pool } from "../db";
import { exigerConnexion, exigerDroit, casquetteDe, moi, perimetreSites, hacher, motDePasseProvisoire, jetonAleatoire, oublierUtilisateur, fermerAutresSessions, utilisateurParId } from "../auth";
import { route, valider, idParam, introuvable, invalide, ErreurHttp } from "../http";
import { planifier } from "../taches";
import { notifier } from "../notifications";
import { actualiserCompteConnecte, publierUtilisateur } from "../temps-reel";
import { intervenantsDesSeances, libelleDate } from "../programme-outils";
import { sallePasEncoreNommee } from "../amorcage";
import { compteEcranSalle, publicDe, repartitionDuSite, sallesDuSite } from "../salles-outils";
import { assurerCompteSalle1, installationEnPlace } from "./lancement";
import { journaliser, lienWhatsApp, numeroWhatsApp } from "./admin";
import { contenusSite, cours, directsImmediats, journal, reinitialisations, seances, sites, utilisateurs, type Utilisateur } from "@shared/schema";
import {
  NUMERO_COORDINATEUR_PAR_DEFAUT,
  PUBLICS_SALLE,
  cleEnvoiSalle,
  estCoursCommun,
  etiquetteSalle,
  niveauDuCours,
  nomDeSalle,
  nomSalleParDefaut,
  jourDuRepere,
  type CampusDuJour,
  type CompteSallesDuJour,
  type CorpsEnvoiSalle,
  type SalleCampus,
  type SalleDuJour,
  type SallesDuJour,
  type SallesDuSite,
  type SeanceDeSalle,
} from "@shared/salles";
import { t } from "@shared/textes/salles";
import { enAttenteAnimateur } from "@shared/ouverture";

const P = "/api/pilotage";
type Site = typeof sites.$inferSelect;
const OUTILS = exigerDroit("outils_campus");

async function siteDuPerimetre(req: Request): Promise<Site> {
  const [s] = await db.select().from(sites).where(eq(sites.id, idParam(req)));
  const p = perimetreSites(moi(req));
  if (!s || (p && !p.includes(s.id))) throw introuvable("Campus");
  return s;
}

async function sitesDuPerimetre(req: Request): Promise<Site[]> {
  const p = perimetreSites(moi(req));
  return db
    .select()
    .from(sites)
    .where(p ? inArray(sites.id, p) : undefined)
    .orderBy(asc(sites.ordre), asc(sites.id));
}

function numeroParam(req: Request): number {
  const n = Number(req.params.numero);
  if (!Number.isInteger(n) || n < 1 || n > 50) throw invalide("Salle inconnue.");
  return n;
}

async function versSalle(s: Site, numero: number, compte: Utilisateur | null): Promise<SalleCampus> {
  return {
    numero,
    nom: nomDeSalle(compte, s),
    public: publicDe(compte),
    compteId: compte?.id ?? null,
    ecranInstalle: Boolean(compte && !compte.doitChangerMotDePasse),
    vuLe: compte?.derniereConnexion?.toISOString() ?? null,
    lienPret: Boolean(compte && (await installationEnPlace(s, compte))),
  };
}

async function sallesPourPilotage(s: Site): Promise<SallesDuSite> {
  const salles = await sallesDuSite(s.id);
  return { siteId: s.id, campus: s.nomCourt, salles: await Promise.all(salles.map((x) => versSalle(s, x.numero, x.compte))) };
}

/**
 * L'écran d'une salle relit son compte (nom, public) et ses cours aussitôt (PageSalle écoute « salle ») ; le
 * compte gardé par ses flux temps réel est remplacé (annonces des directs, nom de salle dans le Studio).
 */
async function prevenirEcran(compteId: number) {
  oublierUtilisateur(compteId);
  const frais = await utilisateurParId(compteId);
  if (frais) actualiserCompteConnecte(frais);
  publierUtilisateur(compteId, "salle", { maj: Date.now() });
}

const corpsSalle = z.object({
  nom: z.string().trim().max(60, "60 caractères au plus").optional(),
  public: z.enum(PUBLICS_SALLE).nullable().optional(),
});

/** « 08:30 » UTC → « 8h30 » ; « 14:00 » → « 14h » (écriture des messages). */
function heureCourte(d: Date): string {
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/**
 * Message WhatsApp d'une salle pour un jour : son étiquette (« Riviera · L1 · Salle de conférence 1 »), une
 * ligne par cours (« Mardi 13 octobre, 8h30-12h30 : Art oratoire, M. Dianda »), puis le lien de son écran.
 * null : pas de cours dans la salle ce jour-là. Jamais le code d'écran.
 */
function messageSalle(salle: Omit<SalleDuJour, "message" | "lienWhatsApp" | "lienAPreparer">, libelle: string): string | null {
  // Pas de cours, ou écran à installer sans lien en place : rien à envoyer (le message ne servirait à rien).
  if (!salle.seances.length || (!salle.lien && !salle.ecranInstalle)) return null;
  const date = libelle.charAt(0).toUpperCase() + libelle.slice(1);
  const lignes = [salle.etiquette];
  for (const x of salle.seances) {
    // Cours commun dans une salle réglée en L1 ou L2 : on précise qu'il est pour les deux niveaux.
    const coursNomme = x.commun && salle.public ? t("message.commun", { v: { cours: x.cours } }) : x.cours;
    lignes.push(
      x.intervenant
        ? t("message.seance", { v: { date, heures: x.heures, cours: coursNomme, intervenant: x.intervenant } })
        : t("message.seance.sansIntervenant", { v: { date, heures: x.heures, cours: coursNomme } }),
    );
  }
  lignes.push(salle.lien ? t("message.ecran", { v: { lien: salle.lien } }) : t("message.ecranInstalle"));
  return lignes.join("\n");
}

// ── Numéro du coordinateur des salles ──────────────────────────────────────

/** Réglage de la page (contenus_site, clé à part des contenus du site public). */
const CLE_REGLAGES = "pilotage.salles";
/** Jour du dernier rappel du matin envoyé (réservation : un seul rappel par jour, même après un redémarrage). */
const CLE_RAPPEL = "pilotage.salles.rappel";
/** Repères « Envoyé » d'un jour : « pilotage.salles.envois.2026-10-13 » → { cles: [cleEnvoiSalle…] } (jamais de message ni de lien). */
const PREFIXE_CLE_ENVOIS = "pilotage.salles.envois.";

/** Le numéro qui reçoit les messages (international, chiffres seuls) : celui réglé par la direction, sinon celui par défaut. */
export async function numeroCoordinateur(): Promise<string> {
  const [l] = await db.select({ valeur: contenusSite.valeur }).from(contenusSite).where(eq(contenusSite.cle, CLE_REGLAGES));
  const regle = l?.valeur?.whatsapp;
  return (typeof regle === "string" && numeroWhatsApp(regle)) || NUMERO_COORDINATEUR_PAR_DEFAUT;
}

const corpsNumero = z.object({ numero: z.string().trim().min(1, t("numero.invalide")).max(30, t("numero.invalide")) });
const corpsEnvoi = z.object({ cle: z.string().max(120) }) satisfies z.ZodType<CorpsEnvoiSalle>;

// ── Repères « Envoyé », gardés sur le serveur ──────────────────────────────

/** Les repères « Envoyé » d'un jour (« 2026-10-13 »), depuis tous les appareils et tous les comptes. */
async function envoisDuJour(date: string): Promise<Set<string>> {
  const [l] = await db.select({ valeur: contenusSite.valeur }).from(contenusSite).where(eq(contenusSite.cle, PREFIXE_CLE_ENVOIS + date));
  const cles = l?.valeur?.cles;
  return new Set(Array.isArray(cles) ? cles.filter((c): c is string => typeof c === "string") : []);
}

/**
 * Note qu'un message est parti (repère cleEnvoiSalle, pour son jour) : ajout atomique (deux touchers au même instant
 * ne s'effacent pas), puis on retire les jours d'avant-hier et plus anciens.
 */
async function enregistrerEnvoi(date: string, cle: string, maintenant = new Date()): Promise<void> {
  await pool.query(
    `INSERT INTO campus.contenus_site (cle, valeur) VALUES ($1, jsonb_build_object('cles', jsonb_build_array($2::text)))
     ON CONFLICT (cle) DO UPDATE SET maj_le = now(), valeur = jsonb_build_object('cles', (
       SELECT coalesce(jsonb_agg(DISTINCT x), '[]'::jsonb)
       FROM jsonb_array_elements_text(coalesce(campus.contenus_site.valeur->'cles', '[]'::jsonb) || jsonb_build_array($2::text)) AS x
     ))`,
    [PREFIXE_CLE_ENVOIS + date, cle],
  );
  const avantHier = new Date(maintenant.getTime() - 2 * 86_400_000).toISOString().slice(0, 10);
  await pool.query(`DELETE FROM campus.contenus_site WHERE cle LIKE $1 AND cle < $2`, [`${PREFIXE_CLE_ENVOIS}%`, PREFIXE_CLE_ENVOIS + avantHier]);
}

// ── « Les salles du jour » ─────────────────────────────────────────────────

/**
 * Les salles du jour (aujourd'hui ou demain, heure d'Abidjan = UTC) des campus donnés : pour chaque salle,
 * ses cours et son message prêt à envoyer au coordinateur. Servi à la page et au rappel du matin.
 */
export async function calculerSallesDuJour(
  listeSites: Site[],
  jour: "aujourdhui" | "demain",
  maintenant = new Date(),
): Promise<Omit<SallesDuJour, "peutRegler">> {
  const debutJour = new Date(`${maintenant.toISOString().slice(0, 10)}T00:00:00Z`);
  if (jour === "demain") debutJour.setUTCDate(debutJour.getUTCDate() + 1);
  const finJour = new Date(debutJour.getTime() + 86_400_000);
  const date = debutJour.toISOString().slice(0, 10);
  const libelle = libelleDate(date);
  const [coordinateur, dejaEnvoyes] = await Promise.all([numeroCoordinateur(), envoisDuJour(date)]);

  // Les séances du jour (hors annulées et hors essais de visio lancés sans prévenir).
  const lignes = await db
    .select({ s: seances, titreCours: cours.titre, formateurId: cours.formateurId })
    .from(seances)
    .innerJoin(cours, eq(cours.id, seances.coursId))
    .where(and(gte(seances.debut, debutJour), lt(seances.debut, finJour), ne(seances.statut, "annulee")))
    .orderBy(asc(seances.debut), asc(seances.id));
  const ids = lignes.map((l) => l.s.id);
  const essais = new Set(
    ids.length
      ? (
          await db
            .select({ id: directsImmediats.seanceId })
            .from(directsImmediats)
            .where(and(inArray(directsImmediats.seanceId, ids), eq(directsImmediats.prevenir, false)))
        ).map((l) => l.id)
      : [],
  );
  const duJour = lignes.filter((l) => !essais.has(l.s.id));
  const intervenants = await intervenantsDesSeances(duJour.map((l) => l.s.id));
  const idsFormateurs = [...new Set(duJour.map((l) => l.formateurId).filter((x): x is number => Boolean(x)))];
  const formateurs = new Map(
    (idsFormateurs.length
      ? await db.select({ id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom }).from(utilisateurs).where(inArray(utilisateurs.id, idsFormateurs))
      : []
    ).map((f) => [f.id, `${f.prenom} ${f.nom}`]),
  );
  const versSeance = (l: (typeof duJour)[number]): Omit<SeanceDeSalle, "commun"> => {
    const fin = new Date(l.s.debut.getTime() + l.s.dureeMinutes * 60_000);
    return {
      id: l.s.id,
      debut: l.s.debut.toISOString(),
      fin: fin.toISOString(),
      heures: `${heureCourte(l.s.debut)}-${heureCourte(fin)}`,
      cours: l.titreCours || l.s.titre,
      intervenant: intervenants.get(l.s.id)?.nom ?? (l.formateurId ? (formateurs.get(l.formateurId) ?? null) : null),
      statut: l.s.statut,
      // Classe ouverte automatiquement, l'heure passée, que personne n'anime encore (shared/ouverture.ts).
      attenteFormateur: enAttenteAnimateur(l.s) && l.s.debut.getTime() <= Date.now(),
    };
  };

  const campus: CampusDuJour[] = [];
  let messages = 0;
  let aPreparer = 0;
  for (const s of listeSites) {
    // Chaque cours du campus se tient dans une seule salle (shared/salles.ts : salleDuCours).
    const { salles, annees, salleDe } = await repartitionDuSite(s.id);
    const duSite = duJour.filter((l) => salleDe.has(l.s.coursId));
    const versSeanceDuSite = (l: (typeof duJour)[number]): SeanceDeSalle => ({ ...versSeance(l), commun: estCoursCommun(annees.get(l.s.coursId) ?? []) });
    const lignesSalles: SalleDuJour[] = [];
    const alertes: string[] = [];
    for (const { numero, compte, public: pub } of salles) {
      const inst = compte ? await installationEnPlace(s, compte) : null;
      const nom = nomDeSalle(compte, s);
      const seancesSalle = duSite.filter((l) => salleDe.get(l.s.coursId) === numero);
      const salle = {
        numero,
        nom,
        public: pub,
        etiquette: etiquetteSalle(s.nomCourt, pub, nom),
        ecranInstalle: Boolean(compte && !compte.doitChangerMotDePasse),
        lien: inst?.lien ?? null,
        seances: seancesSalle.map(versSeanceDuSite),
      };
      const message = messageSalle(salle, libelle);
      // Des cours, mais un écran à installer sans lien en place : la direction prépare d'abord le lien.
      const lienAPreparer = !message && salle.seances.length > 0;
      if (message) messages++;
      if (lienAPreparer) aPreparer++;
      lignesSalles.push({ ...salle, message, lienWhatsApp: message ? lienWhatsApp(coordinateur, message) : null, lienAPreparer });
      // Deux cours à la même heure dans une même salle : son écran n'en montrera qu'un (séances terminées mises à part).
      const aVenir = seancesSalle.filter((l) => l.s.statut !== "terminee");
      for (let i = 0; i < aVenir.length; i++)
        for (let j = i + 1; j < aVenir.length; j++) {
          const a = aVenir[i];
          const b = aVenir[j];
          if (b.s.debut.getTime() < a.s.debut.getTime() + a.s.dureeMinutes * 60_000 && a.s.coursId !== b.s.coursId)
            alertes.push(
              t("alerte.chevauchement", {
                v: { a: a.titreCours || a.s.titre, b: b.titreCours || b.s.titre, heure: heureCourte(b.s.debut), salle: nom },
              }),
            );
        }
    }
    // Un cours du jour qu'aucune salle ne montre (cours de L2 alors que la seule salle est en L1).
    for (const l of duSite.filter((x) => salleDe.get(x.s.coursId) === null && x.s.statut !== "terminee")) {
      const niveau = niveauDuCours(annees.get(l.s.coursId) ?? []);
      const v = { cours: l.titreCours || l.s.titre, niveau: niveau ?? "", heure: heureCourte(l.s.debut) };
      alertes.push(niveau ? t("alerte.sansSalle", { v }) : t("alerte.sansSalle.autre", { v }));
    }
    // Compatibilité avec la page d'avant (un message par campus), restée ouverte dans une application : les
    // messages des salles du campus l'un après l'autre, vers le coordinateur. À retirer après le 20 octobre 2026.
    const messageCompat = lignesSalles.flatMap((x) => (x.message ? [x.message] : [])).join("\n\n");
    campus.push({
      siteId: s.id,
      campus: s.nomCourt,
      salleConference: s.salleConference,
      salles: lignesSalles,
      alertes: [...new Set(alertes)],
      whatsapp: coordinateur,
      message: messageCompat,
      lienWhatsApp: lienWhatsApp(coordinateur, messageCompat),
    });
  }
  // Repères « Envoyé » gardés sur le serveur, réduits aux messages de ce jour tels qu'ils sont maintenant (un message
  // modifié, nouveau lien ou cours ajouté, redevient « à envoyer »).
  const envoyes = campus.flatMap((c) =>
    c.salles.flatMap((x) => {
      const cle = x.message ? cleEnvoiSalle(date, c.siteId, x.numero, x.message) : null;
      return cle && dejaEnvoyes.has(cle) ? [cle] : [];
    }),
  );
  return { date, libelle, jour, coordinateur, messages, aPreparer, envoyes, campus };
}

/** Une salle a encore cours : une séance en direct, ou pas terminée et qui finit après maintenant. */
const aEncoreCours = (salle: SalleDuJour, maintenant: Date) =>
  salle.seances.some((x) => x.statut === "en_direct" || (x.statut !== "terminee" && new Date(x.fin).getTime() > maintenant.getTime()));

/**
 * Ce qu'il reste à faire aujourd'hui (messages à envoyer, écrans à préparer) dans ces campus, sans aucun lien : le
 * calcul de la page, réduit aux salles qui ont encore cours (le soir, tout est fini : plus rien à faire) et, pour les
 * messages, à ceux qui ne sont pas encore partis (repères gardés sur le serveur).
 */
export async function compterSallesDuJour(listeSites: Site[], maintenant = new Date()): Promise<CompteSallesDuJour> {
  const { date, campus, envoyes } = await calculerSallesDuJour(listeSites, "aujourdhui", maintenant);
  const partis = new Set(envoyes);
  let messages = 0;
  let aPreparer = 0;
  const envois: string[] = [];
  for (const c of campus)
    for (const s of c.salles) {
      if (!aEncoreCours(s, maintenant)) continue;
      if (s.lienAPreparer) aPreparer++;
      if (!s.message) continue;
      messages++;
      const cle = cleEnvoiSalle(date, c.siteId, s.numero, s.message);
      if (!partis.has(cle)) envois.push(cle);
    }
  return { date, messages, aPreparer, envois };
}

// ── Rappel du matin de la direction ────────────────────────────────────────

/**
 * Heure du rappel, à Abidjan (GMT toute l'année : heure d'Abidjan = heure UTC) : 6 h 30, juste après les heures
 * calmes (21 h-6 h, HEURES_CALMES) pour que le téléphone sonne. Passé midi, le rappel du jour ne part plus
 * (serveur arrêté toute la matinée) : les cours du matin ont commencé.
 */
export const RAPPEL_SALLES = { debutMinutes: 6 * 60 + 30, finMinutes: 12 * 60 } as const;
let dernierRappel: string | null = null;

/** L'autre compte d'une double casquette (alias de utilisateurs). */
const compteLie = alias(utilisateurs, "compte_lie");

/**
 * Qui reçoit le rappel : chaque compte actif de la direction, et chaque compte formateur (ou vie scolaire) actif dont
 * l'autre casquette est un compte actif de la direction lié en retour (casquetteDe) : la personne voit le rappel
 * quelle que soit la casquette sur laquelle elle est (José travaille surtout en formateur). Un compte une seule
 * fois. Pour la personne, c'est un seul rappel : les deux lignes viennent de la même insertion, et lue sur une
 * casquette, la notification l'est aussi sur l'autre (lireAussiSurLAutreCasquette, server/notifications.ts) ; un
 * téléphone n'a qu'une adresse d'envoi, rattachée au compte qui l'a enregistrée en dernier (abonnements_push.endpoint
 * est unique) : il ne sonne qu'une fois.
 */
export async function destinatairesDuRappel(): Promise<number[]> {
  const lignes = await db
    .select({ id: utilisateurs.id })
    .from(utilisateurs)
    .leftJoin(compteLie, eq(compteLie.id, utilisateurs.compteLieId))
    .where(
      and(
        eq(utilisateurs.actif, true),
        or(
          eq(utilisateurs.role, "admin"),
          and(
            inArray(utilisateurs.role, ["formateur", "vie_scolaire"]),
            eq(compteLie.role, "admin"),
            eq(compteLie.actif, true),
            eq(compteLie.compteLieId, utilisateurs.id),
          ),
        ),
      ),
    )
    .orderBy(asc(utilisateurs.id));
  return [...new Set(lignes.map((l) => l.id))];
}

/**
 * Chaque matin dès 6 h 30 : s'il y a au moins un cours dans une salle aujourd'hui, un rappel à chaque compte de
 * la direction (rôle admin actif) et à l'autre casquette de chacun (destinatairesDuRappel), qui ouvre « Les salles
 * du jour » (messages à envoyer, et salles dont il faut d'abord préparer le lien de l'écran). Une seule fois par jour : le jour est réservé en base avant l'envoi
 * (contenus_site, clé CLE_RAPPEL), même si le serveur redémarre ou si deux passages se croisent ; si l'envoi
 * échoue, le jour est rendu et le passage suivant réessaie. Renvoie ce qui a été envoyé (null : rien à faire).
 * Aucun lien au journal.
 */
export async function rappelerSallesDuJour(maintenant = new Date()): Promise<{ jour: string; messages: number; destinataires: number } | null> {
  const minutes = maintenant.getUTCHours() * 60 + maintenant.getUTCMinutes();
  if (minutes < RAPPEL_SALLES.debutMinutes || minutes >= RAPPEL_SALLES.finMinutes) return null;
  const jour = maintenant.toISOString().slice(0, 10);
  if (dernierRappel === jour) return null;
  // Premier filtre, léger : aucune séance aujourd'hui (week-end), rien à calculer.
  const debut = new Date(`${jour}T00:00:00Z`);
  const [{ n }] = await db
    .select({ n: count() })
    .from(seances)
    .where(and(gte(seances.debut, debut), lt(seances.debut, new Date(debut.getTime() + 86_400_000)), ne(seances.statut, "annulee")));
  if (!n) return null;
  const tous = await db.select().from(sites).orderBy(asc(sites.ordre), asc(sites.id));
  const { messages, aPreparer } = await calculerSallesDuJour(tous, "aujourdhui", maintenant);
  if (!messages && !aPreparer) return null;
  const { rows } = await pool.query(
    `INSERT INTO campus.contenus_site (cle, valeur) VALUES ($1, jsonb_build_object('jour', $2::text))
     ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, maj_le = now()
     WHERE campus.contenus_site.valeur->>'jour' IS DISTINCT FROM $2::text
     RETURNING cle`,
    [CLE_RAPPEL, jour],
  );
  dernierRappel = jour;
  if (!rows.length) return null;
  const ids = await destinatairesDuRappel();
  const corps = [
    messages ? (messages === 1 ? t("rappel.corps.un") : t("rappel.corps", { v: { n: messages } })) : null,
    aPreparer ? (aPreparer === 1 ? t("rappel.aPreparer.un") : t("rappel.aPreparer", { v: { n: aPreparer } })) : null,
  ]
    .filter(Boolean)
    .join(" ");
  try {
    // Une seule insertion (notifier) : elle réussit pour tous ou échoue pour tous ; le push part ensuite, sans l'attendre.
    await notifier(ids, {
      type: "systeme",
      titre: t("rappel.titre"),
      corps,
      lien: "/pilotage/salles",
      priorite: "action",
      // Un rappel retardé (heures calmes d'un fuseau lointain) ne passe pas au lendemain.
      expireLe: new Date(debut.getTime() + 86_400_000),
    });
  } catch (e) {
    // Rappel non parti (erreur passagère de la base) : on rend le jour, le passage suivant réessaie.
    dernierRappel = null;
    await pool.query(`DELETE FROM campus.contenus_site WHERE cle = $1 AND valeur->>'jour' = $2`, [CLE_RAPPEL, jour]).catch(() => undefined);
    throw e;
  }
  await db.insert(journal).values({ utilisateurId: null, action: "salles_du_jour_rappel", details: { jour, messages, aPreparer, destinataires: ids.length } });
  return { jour, messages, destinataires: ids.length };
}

export function enregistrerSalles(app: Express) {
  // Les salles des campus du périmètre (page « Classes et campus », section « Les campus »). Jamais de lien ici.
  app.get(
    `${P}/salles`,
    OUTILS,
    route(async (req, res) => {
      const liste = await sitesDuPerimetre(req);
      const r: SallesDuSite[] = [];
      for (const s of liste) r.push(await sallesPourPilotage(s));
      res.setHeader("Cache-Control", "no-store");
      res.json(r);
    }),
  );

  // Ajouter une salle à un campus : un nouveau compte d'écran, sans identifiant ni code (il s'installe par son lien).
  app.post(
    `${P}/sites/:id(\\d+)/salles`,
    OUTILS,
    route(async (req, res) => {
      const u = moi(req);
      const s = await siteDuPerimetre(req);
      const d = valider(corpsSalle, req.body ?? {});
      // La salle 1 garde son nom ; tant que la salle du campus n'a pas de vrai nom, elle devient « Salle de conférence 1 ».
      const { compte: premiere } = await assurerCompteSalle1(s, u);
      if (!premiere.salleNom && sallePasEncoreNommee(s.salleConference)) {
        await db.update(utilisateurs).set({ salleNom: nomSalleParDefaut(1) }).where(eq(utilisateurs.id, premiere.id));
        await prevenirEcran(premiere.id);
      }
      let cree: Utilisateur | null = null;
      for (let essai = 0; essai < 3 && !cree; essai++) {
        const { rows } = await pool.query<{ n: number }>(
          `SELECT coalesce(max(salle_numero), 1)::int AS n FROM campus.utilisateurs WHERE role = 'salle' AND site_id = $1`,
          [s.id],
        );
        const numero = Math.max(1, rows[0]?.n ?? 1) + 1;
        try {
          [cree] = await db
            .insert(utilisateurs)
            .values({
              role: "salle",
              prenom: "Salle",
              nom: `${s.nomCourt} ${numero}`,
              siteId: s.id,
              salleNumero: numero,
              salleNom: d.nom || nomSalleParDefaut(numero),
              sallePublic: d.public ?? null,
              // Mot de passe tiré au sort et jamais montré : l'écran s'installe par le lien ou le code.
              motDePasseHash: await hacher(`${motDePasseProvisoire()}-${jetonAleatoire(12)}`),
              doitChangerMotDePasse: true,
            })
            .returning();
        } catch (e) {
          // Deux ajouts au même instant : le numéro est pris, on prend le suivant.
          if ((e as { code?: string }).code !== "23505") throw e;
        }
      }
      if (!cree) throw new ErreurHttp(503, "Impossible d'ajouter la salle pour l'instant. Réessayez.");
      await journaliser(u, "salle_ajoutee", { compteId: cree.id, siteId: s.id, salle: cree.salleNumero, public: cree.sallePublic });
      res.status(201).json(await versSalle(s, cree.salleNumero as number, cree));
    }),
  );

  // Régler une salle : son nom, son public. L'écran suit aussitôt.
  app.patch(
    `${P}/sites/:id(\\d+)/salles/:numero(\\d+)`,
    OUTILS,
    route(async (req, res) => {
      const u = moi(req);
      const s = await siteDuPerimetre(req);
      const numero = numeroParam(req);
      const d = valider(corpsSalle, req.body ?? {});
      let compte: Utilisateur | null;
      if (numero === 1) compte = (await assurerCompteSalle1(s, u)).compte;
      else compte = await compteEcranSalle(s.id, numero);
      if (!compte) throw introuvable("Salle");
      const maj: Partial<Pick<Utilisateur, "salleNom" | "sallePublic">> = {};
      if (d.nom !== undefined) {
        // Salle 1 sans nom : elle reprend celui de la salle du campus. Les autres ont toujours un nom.
        if (!d.nom && numero !== 1) throw invalide("Donnez un nom à la salle (par exemple « Salle de conférence 2 »).");
        maj.salleNom = d.nom || null;
      }
      if (d.public !== undefined) maj.sallePublic = d.public;
      if (Object.keys(maj).length) {
        [compte] = await db.update(utilisateurs).set(maj).where(eq(utilisateurs.id, compte.id)).returning();
        await prevenirEcran(compte.id);
        await journaliser(u, "salle_reglee", { compteId: compte.id, siteId: s.id, salle: numero, champs: Object.keys(maj), public: compte.sallePublic });
      }
      res.json(await versSalle(s, numero, compte));
    }),
  );

  // Retirer une salle ajoutée (pas la salle 1) : son écran se déconnecte, son lien ne marche plus.
  app.delete(
    `${P}/sites/:id(\\d+)/salles/:numero(\\d+)`,
    OUTILS,
    route(async (req, res) => {
      const u = moi(req);
      const s = await siteDuPerimetre(req);
      const numero = numeroParam(req);
      if (numero === 1) throw invalide("La salle 1 reste : renommez-la ou changez son public.");
      const compte = await compteEcranSalle(s.id, numero);
      if (!compte) throw introuvable("Salle");
      await db.update(utilisateurs).set({ actif: false, salleNumero: null }).where(eq(utilisateurs.id, compte.id));
      await db
        .update(reinitialisations)
        .set({ utiliseLe: new Date() })
        .where(and(eq(reinitialisations.utilisateurId, compte.id), eq(reinitialisations.type, "activation"), isNull(reinitialisations.utiliseLe)));
      await fermerAutresSessions(compte.id);
      oublierUtilisateur(compte.id);
      // Ses cours reviennent à une autre salle du campus : leurs écrans relisent aussitôt.
      for (const autre of await sallesDuSite(s.id)) if (autre.compte) publierUtilisateur(autre.compte.id, "salle", { maj: Date.now() });
      await journaliser(u, "salle_retiree", { compteId: compte.id, siteId: s.id, salle: numero });
      res.json({ ok: true });
    }),
  );

  // « Les salles du jour » : aujourd'hui ou demain (?jour=demain), heure d'Abidjan (UTC).
  app.get(
    `${P}/salles-du-jour`,
    OUTILS,
    route(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const jour = req.query.jour === "demain" ? "demain" : "aujourdhui";
      const r: SallesDuJour = { ...(await calculerSallesDuJour(await sitesDuPerimetre(req), jour)), peutRegler: moi(req).role === "admin" };
      res.json(r);
    }),
  );

  // « Envoyer sur WhatsApp » touché : le repère du message (jamais le message ni le lien) est gardé pour son jour, pour
  // tous les appareils et les deux casquettes. Seulement un message du jour (ou du lendemain) tel qu'il est maintenant,
  // dans le périmètre de la personne.
  app.post(
    `${P}/salles-du-jour/envoi`,
    OUTILS,
    route(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const { cle } = valider(corpsEnvoi, req.body ?? {});
      const date = jourDuRepere(cle);
      const maintenant = new Date();
      const aujourdhui = maintenant.toISOString().slice(0, 10);
      const demain = new Date(maintenant.getTime() + 86_400_000).toISOString().slice(0, 10);
      if (!date || (date !== aujourdhui && date !== demain)) throw invalide(t("envoi.inconnu"));
      const d = await calculerSallesDuJour(await sitesDuPerimetre(req), date === aujourdhui ? "aujourdhui" : "demain", maintenant);
      const connu = d.campus.some((c) => c.salles.some((x) => x.message && cleEnvoiSalle(d.date, c.siteId, x.numero, x.message) === cle));
      if (!connu) throw new ErreurHttp(409, t("envoi.inconnu"));
      await enregistrerEnvoi(date, cle, maintenant);
      res.json({ ok: true });
    }),
  );

  // Le compte du jour pour le tableau de la direction (carte d'action en haut) : mêmes droits et même périmètre que
  // la page, mais aucun lien ni message (la réponse complète, qui porte les liens, reste sur la page).
  app.get(
    `${P}/salles-du-jour/compte`,
    OUTILS,
    route(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.json(await compterSallesDuJour(await sitesDuPerimetre(req)));
    }),
  );

  // Le même compte pour un formateur (ou une vie scolaire) dont l'autre casquette est la direction : la carte de son
  // accueil ne s'affiche que les jours où il y a des liens à envoyer. Tous les campus (périmètre de la direction).
  // Personne d'autre : la page reste à la direction et aux équipes qui ont le droit des écrans.
  app.get(
    "/api/casquette/salles-du-jour",
    exigerConnexion,
    route(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const u = moi(req);
      const autre = u.role === "formateur" || u.role === "vie_scolaire" ? await casquetteDe(u) : null;
      if (autre?.role !== "admin") throw new ErreurHttp(403, t("casquette.reserve"));
      res.json(await compterSallesDuJour(await db.select().from(sites).orderBy(asc(sites.ordre), asc(sites.id))));
    }),
  );

  // Le numéro WhatsApp qui reçoit les messages (le coordinateur des salles) : la direction seule le change.
  app.put(
    `${P}/salles-du-jour/numero`,
    OUTILS,
    route(async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const u = moi(req);
      if (u.role !== "admin") throw new ErreurHttp(403, t("numero.reserve"));
      const d = valider(corpsNumero, req.body ?? {});
      const numero = numeroWhatsApp(d.numero);
      // Un indicatif ne commence jamais par 0 (« 07 07 72 09 400 », un chiffre de trop, n'est pas international) ;
      // un numéro ivoirien compte 10 chiffres après 225.
      if (!numero || numero.startsWith("0") || (numero.startsWith("225") && !/^225[02]\d{9}$/.test(numero))) throw invalide(t("numero.invalide"));
      const valeur = { whatsapp: numero };
      await db
        .insert(contenusSite)
        .values({ cle: CLE_REGLAGES, valeur, majParId: u.id })
        .onConflictDoUpdate({ target: contenusSite.cle, set: { valeur, majParId: u.id, majLe: new Date() } });
      await journaliser(u, "salles_numero_regle", { numero });
      res.json({ coordinateur: numero });
    }),
  );

  // Rappel du matin de la direction (6 h 30, heure d'Abidjan) : la tâche passe chaque minute, le rappel part une fois par jour.
  planifier("salles-du-jour-rappel", 60_000, async () => {
    const r = await rappelerSallesDuJour();
    if (r) console.log(`[salles du jour] rappel du ${r.jour} : ${r.messages} message(s), ${r.destinataires} compte(s) (direction et autres casquettes).`);
  });
}
