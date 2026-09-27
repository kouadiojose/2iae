// Cœur de la purge des données de démonstration, partagé par :
//   - server/scripts/purger-demo.ts (npm run db:purge-demo, en ligne de commande) ;
//   - server/scripts/migrate.ts, au démarrage du service quand CAMPUS_PURGER_DEMO=oui
//     (production sans accès au serveur : poser la variable sur Railway et redéployer).
//
// Ce qui part, et seulement cela :
//   - les comptes de démonstration : ceux que le semis a marqués (preferences.demo = true),
//     jamais un compte de la direction. L'adresse @demo.2iae.com ne suffit PAS : elle se
//     choisit (profil, première connexion), le marqueur non ; aucune saisie ne l'accepte plus ;
//   - les cours de démonstration (notés au registre du semis, ou codes IA-101, ENT-210,
//     INF-230, GES-120, AGR-110 tenus par un formateur de démonstration) qui ne servent à
//     rien de réel, avec tout ce qui en dépend : chapitres, leçons, progressions, séances et
//     replays, présences, questions, sondages, devoirs, copies, interrogations, salons,
//     annonces, événements, fiches ;
//   - ce que les comptes de démonstration ont laissé ailleurs : messages et
//     conversations directes, annonces, événements, notifications, suivis,
//     journal, usage et conversations de l'assistant, abonnements aux rappels,
//     sessions de connexion, fichiers (lignes ET fichiers sur le disque) ;
//   - les classes créées par le semis, si plus rien de réel n'y est rattaché ;
//   - les notifications et lignes du journal de personnes réelles qui ne
//     pointent plus que vers de la démonstration supprimée.
// Ce qui reste : les campus, la direction, et toute donnée réelle.
//
// Cas particuliers, annoncés dès la simulation :
//   - un cours de démonstration qui sert au réel (repris par l'emploi du temps, un vrai
//     formateur principal ou co-formateur, une inscription, une copie ou une présence d'un
//     compte réel, un chapitre, une leçon, un devoir, une séance, une annonce ou un message
//     d'une vraie personne) est GARDÉ. N'en part que ce que le semis y avait mis (noté au
//     registre, ou antérieur au semis, qui antidate tout) : jamais une séance en direct, ni une
//     séance ou un devoir qui porte des présences ou des copies réelles. Sa présentation n'est
//     effacée que si elle est encore celle de la démonstration ; ses classes de démonstration
//     sont ramenées à celles de l'emploi du temps ; son formateur principal de démonstration
//     est remplacé par son premier intervenant réel (à défaut, son premier co-formateur réel) ;
//   - l'écran d'une vraie salle installé sur un compte « salle » de démonstration est gardé :
//     le compte devient réel (plus de marqueur, d'adresse ni de mot de passe de démonstration)
//     et l'écran reste connecté.
//
// Tout se fait dans UNE transaction, sous le même verrou que le semis : en cas
// d'erreur, rien n'est supprimé. Le bilan compte les lignes table par table,
// avant et après : il prouve que rien d'autre n'a bougé.
import fs from "fs";
import path from "path";
import type { PoolClient } from "pg";
import { pool } from "../db";
import { config } from "../config";
import { hacher, jetonAleatoire } from "../auth";
import { ACTION_JOURNAL_DEMO, ACTION_JOURNAL_PURGE, CODES_COURS_DEMO, DOMAINE_DEMO, VERROU_SEMIS, empreintePresentation } from "../demo-constantes";

export type PersonnePurgee = { id: number; nom: string; identifiant: string | null; role: string };

export type BilanPurge = {
  simulation: boolean;
  /** Comptes de démonstration trouvés (et supprimés, hors simulation). */
  comptes: number;
  /** Leurs identifiants (pour fermer aussitôt leurs connexions ouvertes). */
  idsComptes: number[];
  /** Les mêmes, un par un : la direction voit qui part avant de confirmer. */
  personnes: PersonnePurgee[];
  parRole: Record<string, number>;
  /** Récapitulatif lisible : [libellé, nombre]. */
  inventaire: [string, number][];
  /** Lignes supprimées (ou modifiées) par table, mesurées avant/après. Seules les tables touchées figurent. */
  tables: Record<string, number>;
  /** Fichiers effacés du disque. */
  fichiersDisque: number;
  avertissements: string[];
  ms: number;
};

type Q = PoolClient;

/** Ce que le registre du semis a noté (les registres anciens n'ont que la date, les classes et les cours). */
type Registre = {
  le?: string;
  classes?: number[];
  cours?: number[];
  contenu?: Partial<Record<"modules" | "lecons" | "devoirs" | "seances" | "fiches", number[]>>;
  presentations?: Record<string, string>;
};

/** Ce qu'un cours de démonstration a reçu du réel : une seule de ces traces suffit à le garder. */
type TraceReelle = {
  id: number;
  programme: boolean;
  formateur_reel: boolean;
  co_formateurs: number;
  inscriptions: number;
  copies: number;
  presences: number;
  chapitres: number;
  lecons: number;
  devoirs: number;
  seances: number;
  fiches: number;
  annonces: number;
  messages: number;
};

const nombre = async (c: Q, requete: string, params: unknown[] = []): Promise<number> =>
  Number((await c.query<{ n: string }>(requete, params)).rows[0]?.n ?? 0);

const ids = async (c: Q, requete: string, params: unknown[] = []): Promise<number[]> =>
  (await c.query<{ id: number }>(requete, params)).rows.map((r) => Number(r.id));

const pluriel = (n: number, s: string, p = `${s}s`) => `${n} ${n > 1 ? p : s}`;
/** « a, b et c ». */
const liste = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(", ")} et ${l[l.length - 1]}` : (l[0] ?? ""));
/** Morceaux non nuls : [[2, "leçon"], [0, "devoir"]] → ["2 leçons"]. */
const morceaux = (l: [number, string, string?][]) => l.filter(([n]) => n > 0).map(([n, s, p]) => pluriel(n, s, p));

/** Nombre de lignes de chaque table du schéma « campus ». */
async function compterTables(c: Q): Promise<Record<string, number>> {
  const tables = (
    await c.query<{ t: string }>(
      `SELECT table_name AS t FROM information_schema.tables
        WHERE table_schema = 'campus' AND table_type = 'BASE TABLE' AND table_name <> '_migrations'
        ORDER BY table_name`,
    )
  ).rows.map((r) => r.t);
  const resultat: Record<string, number> = {};
  for (const t of tables) resultat[t] = await nombre(c, `SELECT count(*) AS n FROM campus."${t.replace(/"/g, "")}"`);
  return resultat;
}

/** Liens des notifications (« /live/12 », « /devoirs/4 »…) qui mènent vers un objet supprimé. */
function motifNotifications(o: { seances: number[]; devoirs: number[]; cours: number[]; annonces: number[]; conversations: number[]; comptes: number[] }): string | null {
  const alt = (l: number[]) => l.join("|");
  const parties: string[] = [];
  if (o.seances.length) parties.push(`(?:live|replays|enseigner/seances)/(?:${alt(o.seances)})`);
  if (o.devoirs.length) parties.push(`(?:devoirs|quiz|enseigner/devoirs)/(?:${alt(o.devoirs)})`);
  if (o.cours.length) parties.push(`(?:cours|enseigner/cours|messages/cours)/(?:${alt(o.cours)})`);
  if (o.annonces.length) parties.push(`annonces/(?:${alt(o.annonces)})`);
  if (o.conversations.length) parties.push(`messages/(?:${alt(o.conversations)})`);
  if (o.comptes.length) parties.push(`pilotage/etudiants/(?:${alt(o.comptes)})`);
  return parties.length ? `^/(?:${parties.join("|")})(?:[/?#]|$)` : null;
}

/** Une table existe-t-elle ? (le schéma évolue : une purge ne doit pas tomber sur une table d'un autre module) */
async function tableExiste(c: Q, table: string): Promise<boolean> {
  return (await nombre(c, `SELECT count(*) AS n FROM information_schema.tables WHERE table_schema = 'campus' AND table_name = $1`, [table])) > 0;
}

export async function purgerDemonstration(options: { simulation?: boolean; sortie?: (ligne: string) => void } = {}): Promise<BilanPurge> {
  const simulation = Boolean(options.simulation);
  const dire = options.sortie ?? ((l: string) => console.log(l));
  const debut = Date.now();
  const avertissements: string[] = [];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [VERROU_SEMIS]);
    const q = (requete: string, params: unknown[] = []) => client.query(requete, params);

    // ── 1. Inventaire ──────────────────────────────────────────────────────
    const direction = config.admin.identifiant.toLowerCase();
    const marques = (
      await client.query<{ id: number; role: string; prenom: string; nom: string; identifiant: string | null; email: string | null; ecran_installe: boolean }>(
        `SELECT u.id, u.role, u.prenom, u.nom, coalesce(u.email, u.matricule, u.telephone) AS identifiant, u.email,
                (u.role = 'salle' AND EXISTS (SELECT 1 FROM campus.journal j WHERE j.action = 'ecran_installe' AND j.utilisateur_id = u.id)) AS ecran_installe
           FROM campus.utilisateurs u
          WHERE u.preferences->>'demo' = 'true'
          ORDER BY u.role, u.nom, u.prenom`,
      )
    ).rows;
    const proteges = marques.filter((u) => u.role === "admin" || u.email?.toLowerCase() === direction);
    for (const p of proteges) avertissements.push(`${p.prenom} ${p.nom} (${p.identifiant ?? p.id}) ressemble à un compte de démonstration mais appartient à la direction : gardé.`);
    // Un vrai écran de salle installé sur un compte « salle » de démonstration : le supprimer couperait l'écran
    // en plein cours. Il est gardé et devient un compte réel.
    const ecransRepris = marques.filter((u) => !proteges.includes(u) && u.ecran_installe);
    for (const e of ecransRepris) {
      avertissements.push(`L'écran de la salle de ${e.nom} a été installé sur un compte de démonstration : il est gardé et devient un compte réel (sans adresse ni mot de passe de démonstration). L'écran reste connecté.`);
    }
    const comptes = marques.filter((u) => !proteges.includes(u) && !ecransRepris.includes(u));
    const idsComptes = comptes.map((u) => u.id);
    const idsTexte = idsComptes.map(String);
    const parRole: Record<string, number> = {};
    for (const u of comptes) parRole[u.role] = (parRole[u.role] ?? 0) + 1;
    const personnes: PersonnePurgee[] = comptes.map((u) => ({ id: u.id, nom: `${u.prenom} ${u.nom}`.trim(), identifiant: u.identifiant, role: u.role }));

    // Une adresse de démonstration sans le marqueur : un compte réel qui l'a choisie. Il reste, on le signale.
    const adressesDemo = (
      await client.query<{ nom: string; identifiant: string | null }>(
        `SELECT prenom || ' ' || nom AS nom, coalesce(matricule, email) AS identifiant FROM campus.utilisateurs
          WHERE coalesce(preferences->>'demo', 'false') <> 'true' AND lower(coalesce(email, '')) LIKE $1 ORDER BY nom`,
        [`%@${DOMAINE_DEMO}`],
      )
    ).rows;
    if (adressesDemo.length) {
      avertissements.push(
        `${pluriel(adressesDemo.length, "compte réel utilise", "comptes réels utilisent")} une adresse @${DOMAINE_DEMO} (${adressesDemo.map((a) => `${a.nom}, ${a.identifiant}`).join(" ; ")}) : ce ne sont pas des comptes de démonstration, ils restent. Corrigez leur adresse (Pilotage, Comptes).`,
      );
    }

    // Registre du semis : date, classes, cours et contenus créés, empreintes des présentations.
    const registre = (await client.query<{ details: Registre | null }>(`SELECT details FROM campus.journal WHERE action = $1`, [ACTION_JOURNAL_DEMO])).rows.map((r) => r.details ?? {});
    const classesRegistre = [...new Set(registre.flatMap((r) => r.classes ?? []))];
    const coursRegistre = [...new Set(registre.flatMap((r) => r.cours ?? []))];
    const semes = (cle: keyof NonNullable<Registre["contenu"]>) => [...new Set(registre.flatMap((r) => r.contenu?.[cle] ?? []))];
    const presentationsSemees = new Map<number, string>(registre.flatMap((r) => Object.entries(r.presentations ?? {}).map(([id, e]) => [Number(id), e] as [number, string])));
    // Date du semis : il antidate tout ce qu'il crée. Ce qu'un cours de démonstration a reçu APRÈS vient de vraies
    // personnes. Registre perdu : borne prudente (le plus récent des comptes de démonstration, antidatés eux aussi) ;
    // un contenu plus récent est alors traité comme réel, donc gardé.
    const datesSemis = registre.map((r) => (r.le ? new Date(r.le).getTime() : NaN)).filter((t) => !Number.isNaN(t));
    let semeLe: Date | null = datesSemis.length ? new Date(Math.max(...datesSemis)) : null;
    if (!semeLe && idsComptes.length) {
      semeLe = (await client.query<{ le: Date | null }>(`SELECT max(cree_le) AS le FROM campus.utilisateurs WHERE id = ANY($1::int[])`, [idsComptes])).rows[0]?.le ?? null;
    }

    const avecProgramme = await tableExiste(client, "creneaux_programme");
    const avecSessionsClasses = await tableExiste(client, "sessions_classes");
    const avecSeancesCreneaux = await tableExiste(client, "seances_creneaux");
    const horsProgramme = (alias: string) => (avecSeancesCreneaux ? `AND ${alias}.id NOT IN (SELECT seance_id FROM campus.seances_creneaux)` : "");

    // Cours de démonstration : notés au registre du semis (quel que soit leur formateur aujourd'hui), ou, sans
    // registre, un code de démonstration tenu par un formateur de démonstration.
    const codes = [...CODES_COURS_DEMO, ...CODES_COURS_DEMO.map((c) => `${c}-D`)];
    const candidats = (
      await client.query<{ id: number; code: string }>(
        `SELECT id, code FROM campus.cours
          WHERE id = ANY($3::int[]) OR (formateur_id = ANY($1::int[]) AND code = ANY($2::text[]))
          ORDER BY code`,
        [idsComptes, codes, coursRegistre],
      )
    ).rows;
    const candIds = candidats.map((c) => c.id);

    // Ce que le semis a mis dans ces cours : noté au registre, ou antérieur au semis (il antidate tout),
    // ou (devoirs) écrit par un compte de démonstration.
    const leconsSemees = await ids(client, `SELECT id FROM campus.lecons WHERE cours_id = ANY($1::int[]) AND (id = ANY($2::int[]) OR cree_le < $3::timestamptz)`, [candIds, semes("lecons"), semeLe]);
    const seancesSemees = await ids(client, `SELECT id FROM campus.seances WHERE cours_id = ANY($1::int[]) AND (id = ANY($2::int[]) OR cree_le < $3::timestamptz)`, [candIds, semes("seances"), semeLe]);
    const devoirsSemes = await ids(client, `SELECT id FROM campus.devoirs WHERE cours_id = ANY($1::int[]) AND (id = ANY($2::int[]) OR auteur_id = ANY($3::int[]))`, [candIds, semes("devoirs"), idsComptes]);
    const fichesSemees = await ids(
      client,
      `SELECT id FROM campus.fiches_revision WHERE cours_id = ANY($1::int[]) AND (id = ANY($2::int[]) OR cree_le < $3::timestamptz OR lecon_id = ANY($4::int[]))`,
      [candIds, semes("fiches"), semeLe, leconsSemees],
    );
    const modulesSemes = await ids(
      client,
      `SELECT m.id FROM campus.modules m WHERE m.cours_id = ANY($1::int[])
          AND (m.id = ANY($2::int[]) OR EXISTS (SELECT 1 FROM campus.lecons l WHERE l.module_id = m.id AND l.id = ANY($3::int[])))`,
      [candIds, semes("modules"), leconsSemees],
    );

    // Ce que le réel a laissé dans chaque cours de démonstration.
    const traces = new Map<number, TraceReelle>(
      (
        await client.query<TraceReelle>(
          `SELECT c.id,
                  ${
                    avecProgramme
                      ? `(EXISTS (SELECT 1 FROM campus.creneaux_programme cp WHERE cp.cours_id = c.id)
                          ${avecSeancesCreneaux ? "OR EXISTS (SELECT 1 FROM campus.seances s JOIN campus.seances_creneaux sc ON sc.seance_id = s.id WHERE s.cours_id = c.id)" : ""})`
                      : "false"
                  } AS programme,
                  (c.formateur_id IS NOT NULL AND NOT (c.formateur_id = ANY($2::int[]))) AS formateur_reel,
                  (SELECT count(*) FROM campus.cours_formateurs cf WHERE cf.cours_id = c.id AND NOT (cf.formateur_id = ANY($2::int[])))::int AS co_formateurs,
                  (SELECT count(*) FROM campus.inscriptions i WHERE i.cours_id = c.id AND NOT (i.utilisateur_id = ANY($2::int[])))::int AS inscriptions,
                  ((SELECT count(*) FROM campus.rendus r JOIN campus.devoirs d ON d.id = r.devoir_id WHERE d.cours_id = c.id AND NOT (r.etudiant_id = ANY($2::int[])))
                   + (SELECT count(*) FROM campus.tentatives_quiz t JOIN campus.devoirs d ON d.id = t.devoir_id WHERE d.cours_id = c.id AND NOT (t.etudiant_id = ANY($2::int[]))))::int AS copies,
                  (SELECT count(*) FROM campus.presences p JOIN campus.seances s ON s.id = p.seance_id WHERE s.cours_id = c.id AND NOT (p.utilisateur_id = ANY($2::int[])))::int AS presences,
                  (SELECT count(*) FROM campus.modules m WHERE m.cours_id = c.id AND NOT (m.id = ANY($3::int[])))::int AS chapitres,
                  (SELECT count(*) FROM campus.lecons l WHERE l.cours_id = c.id AND NOT (l.id = ANY($4::int[])))::int AS lecons,
                  (SELECT count(*) FROM campus.devoirs d WHERE d.cours_id = c.id AND NOT (d.id = ANY($5::int[])))::int AS devoirs,
                  (SELECT count(*) FROM campus.seances s WHERE s.cours_id = c.id AND NOT (s.id = ANY($6::int[])) ${horsProgramme("s")})::int AS seances,
                  (SELECT count(*) FROM campus.fiches_revision f WHERE f.cours_id = c.id AND NOT (f.id = ANY($7::int[])))::int AS fiches,
                  (SELECT count(*) FROM campus.annonces a WHERE a.cours_id = c.id AND NOT (a.auteur_id = ANY($2::int[])))::int AS annonces,
                  (SELECT count(*) FROM campus.messages me JOIN campus.conversations cv ON cv.id = me.conversation_id
                    WHERE cv.cours_id = c.id AND NOT (me.auteur_id = ANY($2::int[])))::int AS messages
             FROM campus.cours c WHERE c.id = ANY($1::int[])`,
          [candIds, idsComptes, modulesSemes, leconsSemees, devoirsSemes, seancesSemees, fichesSemees],
        )
      ).rows.map((t) => [Number(t.id), t]),
    );
    const sertAuReel = (t: TraceReelle | undefined) =>
      Boolean(t && (t.programme || t.formateur_reel || t.co_formateurs || t.inscriptions || t.copies || t.presences || t.chapitres || t.lecons || t.devoirs || t.seances || t.fiches || t.annonces || t.messages));
    const coursDemo = candidats.filter((c) => !sertAuReel(traces.get(c.id)));
    const coursRepris = candidats.filter((c) => sertAuReel(traces.get(c.id)));
    const coursIds = coursDemo.map((c) => c.id);
    const reprisIds = coursRepris.map((c) => c.id);

    // Dans un cours repris, ne part que ce que le semis y avait mis : ni une séance en direct, ni une séance
    // de l'emploi du temps, ni une séance ou un devoir qui porte des présences ou des copies réelles.
    const seancesRetirees = reprisIds.length
      ? await ids(
          client,
          `SELECT s.id FROM campus.seances s
            WHERE s.cours_id = ANY($1::int[]) AND s.id = ANY($2::int[]) AND s.statut <> 'en_direct' ${horsProgramme("s")}
              AND NOT EXISTS (SELECT 1 FROM campus.presences p WHERE p.seance_id = s.id AND NOT (p.utilisateur_id = ANY($3::int[])))`,
          [reprisIds, seancesSemees, idsComptes],
        )
      : [];
    const devoirsRetires = reprisIds.length
      ? await ids(
          client,
          `SELECT d.id FROM campus.devoirs d
            WHERE d.cours_id = ANY($1::int[]) AND d.id = ANY($2::int[])
              AND NOT EXISTS (SELECT 1 FROM campus.rendus r WHERE r.devoir_id = d.id AND NOT (r.etudiant_id = ANY($3::int[])))
              AND NOT EXISTS (SELECT 1 FROM campus.tentatives_quiz t WHERE t.devoir_id = d.id AND NOT (t.etudiant_id = ANY($3::int[])))`,
          [reprisIds, devoirsSemes, idsComptes],
        )
      : [];
    const leconsRetirees = reprisIds.length ? await ids(client, `SELECT id FROM campus.lecons WHERE cours_id = ANY($1::int[]) AND id = ANY($2::int[])`, [reprisIds, leconsSemees]) : [];
    const fichesRetirees = reprisIds.length ? await ids(client, `SELECT id FROM campus.fiches_revision WHERE cours_id = ANY($1::int[]) AND id = ANY($2::int[])`, [reprisIds, fichesSemees]) : [];
    // Un chapitre du semis où une vraie personne a ajouté une leçon reste (avec cette leçon).
    const modulesRetires = reprisIds.length
      ? await ids(
          client,
          `SELECT m.id FROM campus.modules m
            WHERE m.cours_id = ANY($1::int[]) AND m.id = ANY($2::int[])
              AND NOT EXISTS (SELECT 1 FROM campus.lecons l WHERE l.module_id = m.id AND NOT (l.id = ANY($3::int[])))`,
          [reprisIds, modulesSemes, leconsRetirees],
        )
      : [];

    // Présentation encore celle de la démonstration (empreinte du registre ; registre ancien : jamais modifiée depuis
    // le semis, ou qui nomme un formateur de démonstration) : effacée, et le cours quitte le site jusqu'à sa réécriture.
    const presentations = reprisIds.length
      ? (
          await client.query<{ id: number; description: string; objectifs: string; accroche: string | null; intacte: boolean; nomme_demo: boolean }>(
            `SELECT c.id, c.description, c.objectifs, c.accroche_site AS accroche,
                    ($2::timestamptz IS NOT NULL AND c.maj_le <= $2::timestamptz) AS intacte,
                    EXISTS (SELECT 1 FROM campus.utilisateurs f WHERE f.id = ANY($3::int[]) AND f.role = 'formateur'
                              AND position(lower(f.prenom || ' ' || f.nom) IN lower(c.description || ' ' || coalesce(c.accroche_site, ''))) > 0) AS nomme_demo
               FROM campus.cours c WHERE c.id = ANY($1::int[])`,
            [reprisIds, semeLe, idsComptes],
          )
        ).rows
      : [];
    const presentationDemo = new Set(
      presentations
        .filter((p) => {
          const e = presentationsSemees.get(Number(p.id));
          return e ? e === empreintePresentation(p) : p.intacte || p.nomme_demo;
        })
        .map((p) => Number(p.id)),
    );

    // Classes de démonstration d'un cours repris que l'emploi du temps ne justifie pas : sinon les étudiants réels
    // importés dans ces classes (autres campus) verraient le cours, recevraient ses « En direct » et seraient
    // attendus à ses séances. (Un cours repris hors emploi du temps garde ses classes : signalé plus bas.)
    const reprisAuProgramme = coursRepris.filter((c) => traces.get(c.id)?.programme).map((c) => c.id);
    const detacher = avecProgramme && avecSessionsClasses && reprisAuProgramme.length && classesRegistre.length;
    const conditionDetacher = `cc.cours_id = ANY($1::int[]) AND cc.classe_id = ANY($2::int[])
         AND NOT EXISTS (SELECT 1 FROM campus.creneaux_programme cp JOIN campus.sessions_classes sc ON sc.session_id = cp.session_id
                          WHERE cp.cours_id = cc.cours_id AND sc.classe_id = cc.classe_id)`;
    const aDetacher = detacher
      ? (await client.query<{ cours_id: number; n: number }>(`SELECT cc.cours_id, count(*)::int AS n FROM campus.cours_classes cc WHERE ${conditionDetacher} GROUP BY cc.cours_id`, [reprisAuProgramme, classesRegistre])).rows
      : [];
    const detachees = new Map(aDetacher.map((r) => [Number(r.cours_id), Number(r.n)]));

    // Cours gardés dont le formateur principal est un compte de démonstration : leur premier intervenant réel à
    // l'emploi du temps le remplace (à défaut, leur premier co-formateur réel), sinon personne.
    const remplacants = (
      await client.query<{ id: number; code: string; repris: boolean; nouveau: number | null; par_programme: boolean; nom: string | null }>(
        `SELECT x.id, x.code, x.id = ANY($3::int[]) AS repris, coalesce(x.intervenant, x.co) AS nouveau, x.intervenant IS NOT NULL AS par_programme,
                f.prenom || ' ' || f.nom AS nom
           FROM (SELECT c.id, c.code,
                        ${
                          avecProgramme
                            ? `(SELECT cp.intervenant_id FROM campus.creneaux_programme cp
                                 JOIN campus.sessions_programme sp ON sp.id = cp.session_id
                                 JOIN campus.utilisateurs i ON i.id = cp.intervenant_id
                                WHERE cp.cours_id = c.id AND i.role = 'formateur' AND NOT (i.id = ANY($1::int[]))
                                ORDER BY (sp.statut = 'archivee'), (sp.statut = 'publiee') DESC, sp.debut, cp.jour, cp.heure_debut, cp.ordre, cp.id LIMIT 1)`
                            : "NULL::int"
                        } AS intervenant,
                        (SELECT cf.formateur_id FROM campus.cours_formateurs cf JOIN campus.utilisateurs i ON i.id = cf.formateur_id
                          WHERE cf.cours_id = c.id AND i.role = 'formateur' AND NOT (i.id = ANY($1::int[]))
                          ORDER BY i.actif DESC, cf.formateur_id LIMIT 1) AS co
                   FROM campus.cours c
                  WHERE c.formateur_id = ANY($1::int[]) AND NOT (c.id = ANY($2::int[]))) x
           LEFT JOIN campus.utilisateurs f ON f.id = coalesce(x.intervenant, x.co)
          ORDER BY x.code`,
        [idsComptes, coursIds, reprisIds],
      )
    ).rows;
    const remplacantDe = new Map(remplacants.map((r) => [Number(r.id), r]));

    // Classes du semis (registre) qu'on peut retirer : aucune personne réelle n'y est (ni n'y a été),
    // aucune annonce ni aucun événement écrit par une personne réelle ne les vise. Les liens qu'un cours
    // réel ou l'emploi du temps ont pu leur ajouter (cours_classes, sessions_classes) partent avec elles :
    // une classe fictive n'a rien à faire dans le programme réel.
    const classes = (
      await client.query<{ id: number; nom: string }>(
        `SELECT c.id, c.nom FROM campus.classes c
          WHERE c.id = ANY($1::int[])
            AND NOT EXISTS (SELECT 1 FROM campus.utilisateurs u WHERE u.classe_id = c.id AND NOT (u.id = ANY($2::int[])))
            AND NOT EXISTS (SELECT 1 FROM campus.passages_classes pc WHERE pc.classe_id = c.id AND NOT (pc.utilisateur_id = ANY($2::int[])))
            AND NOT EXISTS (SELECT 1 FROM campus.annonces a WHERE a.classe_id = c.id AND NOT (a.auteur_id = ANY($2::int[])) AND (a.cours_id IS NULL OR NOT (a.cours_id = ANY($3::int[]))))
            AND NOT EXISTS (SELECT 1 FROM campus.evenements e WHERE e.classe_id = c.id AND (e.auteur_id IS NULL OR NOT (e.auteur_id = ANY($2::int[]))) AND (e.cours_id IS NULL OR NOT (e.cours_id = ANY($3::int[]))))
          ORDER BY c.nom`,
        [classesRegistre, idsComptes, coursIds],
      )
    ).rows;
    const classeIds = classes.map((c) => c.id);
    const classesGardees = classesRegistre.length - classes.length;
    if (classesGardees > 0) {
      avertissements.push(`${classesGardees} classe(s) créée(s) par la démonstration gardée(s) : des personnes réelles y sont inscrites, ou des annonces réelles les visent.`);
    }
    if (avecSessionsClasses && classeIds.length) {
      const visees = await nombre(client, `SELECT count(DISTINCT session_id) AS n FROM campus.sessions_classes WHERE classe_id = ANY($1::int[])`, [classeIds]);
      if (visees) avertissements.push(`L'emploi du temps visait aussi des classes de démonstration : elles sont retirées de ses destinataires. Relancez « Mettre à jour les séances » si besoin.`);
    }
    if (avecProgramme) {
      const creneaux = await nombre(client, `SELECT count(*) AS n FROM campus.creneaux_programme WHERE intervenant_id = ANY($1::int[])`, [idsComptes]);
      if (creneaux) avertissements.push(`${creneaux} créneau(x) de l'emploi du temps avaient un intervenant de démonstration : il faudra leur choisir un vrai formateur.`);
    }

    // Ce que la simulation annonce, cours repris par cours repris : pourquoi il reste, ce qui part, ce qui reste.
    const restantesDemo = (coursId: number) =>
      nombre(client, `SELECT count(*) AS n FROM campus.cours_classes WHERE cours_id = $1 AND classe_id = ANY($2::int[]) AND NOT (classe_id = ANY($3::int[]))`, [coursId, classesRegistre, classeIds]);
    const compterDans = async (table: string, colonne: string, liste: number[], coursId: number) =>
      liste.length ? nombre(client, `SELECT count(*) AS n FROM campus.${table} WHERE cours_id = $1 AND ${colonne} = ANY($2::int[])`, [coursId, liste]) : 0;
    for (const c of coursRepris) {
      const t = traces.get(c.id)!;
      const raisons = [
        ...(t.programme ? ["l'emploi du temps"] : []),
        ...(t.formateur_reel ? ["un vrai formateur principal"] : []),
        ...morceaux([
          [t.co_formateurs, "co-formateur réel", "co-formateurs réels"],
          [t.inscriptions, "inscription réelle", "inscriptions réelles"],
          [t.copies, "copie d'un étudiant réel", "copies d'étudiants réels"],
          [t.presences, "présence réelle", "présences réelles"],
        ]),
      ];
      const creeParLeReel = morceaux([
        [t.chapitres, "chapitre"],
        [t.lecons, "leçon"],
        [t.devoirs, "devoir"],
        [t.seances, "séance"],
        [t.fiches, "fiche"],
        [t.annonces, "annonce"],
        [t.messages, "message"],
      ]);
      if (creeParLeReel.length) raisons.push(`${liste(creeParLeReel)} créés par de vraies personnes`);
      const retires = morceaux([
        [await compterDans("lecons", "id", leconsRetirees, c.id), "leçon"],
        [await compterDans("modules", "id", modulesRetires, c.id), "chapitre"],
        [await compterDans("devoirs", "id", devoirsRetires, c.id), "devoir"],
        [await compterDans("seances", "id", seancesRetirees, c.id), "séance"],
        [await compterDans("fiches_revision", "id", fichesRetirees, c.id), "fiche"],
      ]);
      const gardes: [number, string][] = [
        [(await compterDans("devoirs", "id", devoirsSemes, c.id)) - (await compterDans("devoirs", "id", devoirsRetires, c.id)), "devoir"],
        [(await compterDans("seances", "id", seancesSemees, c.id)) - (await compterDans("seances", "id", seancesRetirees, c.id)), "séance"],
        [(await compterDans("modules", "id", modulesSemes, c.id)) - (await compterDans("modules", "id", modulesRetires, c.id)), "chapitre"],
      ];
      const gardesSemes = morceaux(gardes);
      const plusieursGardes = gardes.reduce((a, [n]) => a + n, 0) > 1;
      const lectures = leconsRetirees.length
        ? await nombre(client, `SELECT count(*) AS n FROM campus.progressions WHERE lecon_id = ANY($1::int[]) AND NOT (utilisateur_id = ANY($2::int[])) AND lecon_id IN (SELECT id FROM campus.lecons WHERE cours_id = $3)`, [
            leconsRetirees,
            idsComptes,
            c.id,
          ])
        : 0;
      const r = remplacantDe.get(c.id);
      const classesDemoRestantes = t.programme ? 0 : await restantesDemo(c.id);
      const phrases = [
        `Le cours ${c.code} vient de la démonstration mais sert au réel (${liste(raisons)}) : il est gardé, avec tout ce que de vraies personnes y ont fait.`,
        retires.length ? `N'en part que ce que la démonstration y avait mis : ${liste(retires)}.` : "La démonstration n'y a plus rien à retirer.",
        ...(gardesSemes.length
          ? [`Restent aussi ${liste(gardesSemes)} de la démonstration, qui ${plusieursGardes ? "portent" : "porte"} un direct en cours, des copies, des présences ou des leçons réelles.`]
          : []),
        ...(lectures ? [`${pluriel(lectures, "lecture", "lectures")} de ces leçons de démonstration par des étudiants réels ${lectures > 1 ? "partent" : "part"} avec elles.`] : []),
        ...(r ? [r.nouveau ? `Formateur principal de démonstration remplacé par ${r.nom}.` : "Son formateur principal de démonstration est retiré : choisissez-en un (Pilotage, Cours)."] : []),
        ...(detachees.get(c.id) ? [`Ses classes sont ramenées à celles de l'emploi du temps (${pluriel(detachees.get(c.id)!, "classe de la démonstration retirée", "classes de la démonstration retirées")}).`] : []),
        ...(classesDemoRestantes
          ? [`Il ne figure pas à l'emploi du temps et reste rattaché à ${pluriel(classesDemoRestantes, "classe créée par la démonstration", "classes créées par la démonstration")} où sont inscrits des étudiants réels : vérifiez ses classes (Pilotage, Cours).`]
          : []),
        presentationDemo.has(c.id)
          ? "Sa présentation de démonstration est effacée et il quitte le site vitrine : réécrivez-la (Pilotage, Cours)."
          : "Sa présentation a été modifiée depuis la démonstration : elle est gardée, relisez-la (Pilotage, Cours).",
      ];
      avertissements.push(phrases.join(" "));
    }
    const coursGardes = remplacants.filter((r) => !r.repris);
    if (coursGardes.length) {
      avertissements.push(
        `Cours réels gardés dont le formateur principal était un compte de démonstration : ${coursGardes
          .map((r) => (r.nouveau ? `${r.code} (désormais ${r.nom})` : `${r.code} (sans formateur principal : à choisir dans Pilotage, Cours)`))
          .join(", ")}.`,
      );
    }

    // Objets rattachés (récapitulatif, journal et notifications).
    const seanceIds = [...(await ids(client, `SELECT id FROM campus.seances WHERE cours_id = ANY($1::int[])`, [coursIds])), ...seancesRetirees];
    const devoirIds = [...(await ids(client, `SELECT id FROM campus.devoirs WHERE cours_id = ANY($1::int[])`, [coursIds])), ...devoirsRetires];
    const annonceIds = await ids(client, `SELECT id FROM campus.annonces WHERE auteur_id = ANY($1::int[]) OR cours_id = ANY($2::int[])`, [idsComptes, coursIds]);
    const evenementIds = await ids(client, `SELECT id FROM campus.evenements WHERE auteur_id = ANY($1::int[]) OR cours_id = ANY($2::int[])`, [idsComptes, coursIds]);
    const conversationIds = await ids(
      client,
      `SELECT id FROM campus.conversations
        WHERE cours_id = ANY($2::int[]) OR classe_id = ANY($3::int[])
           OR (type = 'direct' AND id IN (SELECT conversation_id FROM campus.participants WHERE utilisateur_id = ANY($1::int[])))`,
      [idsComptes, coursIds, classeIds],
    );
    const fichiersDemo = (await client.query<{ id: number; cle: string }>(`SELECT id, cle FROM campus.fichiers WHERE proprietaire_id = ANY($1::int[]) OR cle LIKE 'demo/%'`, [idsComptes])).rows;
    const fichierIds = fichiersDemo.map((f) => Number(f.id));

    // Lignes du journal : écrites par la démonstration, ou qui ne parlent que d'elle.
    const texte = (l: number[]) => l.map(String);
    const conditionJournal = `
         utilisateur_id = ANY($1::int[])
      OR details->>'etudiantId' = ANY($2::text[]) OR details->>'compteId' = ANY($2::text[])
      OR details->>'pour' = ANY($2::text[]) OR details->>'auteurId' = ANY($2::text[])
      OR details->>'coursId' = ANY($3::text[]) OR details->>'seanceId' = ANY($4::text[])
      OR details->>'annonceId' = ANY($5::text[]) OR details->>'evenementId' = ANY($6::text[])
      OR details->>'conversationId' = ANY($7::text[]) OR details->>'classeId' = ANY($8::text[])
      OR (action = 'publication_site' AND (
            (details->>'type' = 'cours' AND details->>'id' = ANY($3::text[]))
         OR (details->>'type' = 'formateur' AND details->>'id' = ANY($2::text[]))
         OR (details->>'type' = 'seance' AND details->>'id' = ANY($4::text[]))
         OR (details->>'type' = 'annonce' AND details->>'id' = ANY($5::text[]))))
      OR action = $9`;
    const paramsJournal = [
      idsComptes,
      idsTexte,
      texte(coursIds),
      texte(seanceIds),
      texte(annonceIds),
      texte(evenementIds),
      texte(conversationIds),
      texte(classeIds),
      ACTION_JOURNAL_DEMO,
    ];

    const inventaire: [string, number][] = [
      ["comptes de démonstration", idsComptes.length],
      ["cours de démonstration", coursIds.length],
      ["leçons", (await nombre(client, `SELECT count(*) AS n FROM campus.lecons WHERE cours_id = ANY($1::int[])`, [coursIds])) + leconsRetirees.length],
      ["séances en direct", seanceIds.length],
      ["présences", await nombre(client, `SELECT count(*) AS n FROM campus.presences WHERE seance_id = ANY($1::int[]) OR utilisateur_id = ANY($2::int[])`, [seanceIds, idsComptes])],
      ["devoirs et interrogations", devoirIds.length],
      ["copies rendues", await nombre(client, `SELECT count(*) AS n FROM campus.rendus WHERE devoir_id = ANY($1::int[]) OR etudiant_id = ANY($2::int[])`, [devoirIds, idsComptes])],
      ["conversations et salons", conversationIds.length],
      ["messages", await nombre(client, `SELECT count(*) AS n FROM campus.messages WHERE auteur_id = ANY($1::int[]) OR conversation_id = ANY($2::int[])`, [idsComptes, conversationIds])],
      ["annonces", annonceIds.length],
      ["événements", evenementIds.length],
      ["notifications", await nombre(client, `SELECT count(*) AS n FROM campus.notifications WHERE utilisateur_id = ANY($1::int[])`, [idsComptes])],
      ["conversations avec l'assistant", await nombre(client, `SELECT count(*) AS n FROM campus.conversations_ia WHERE utilisateur_id = ANY($1::int[])`, [idsComptes])],
      ["fichiers", fichierIds.length],
      ["suivis de vie scolaire", await nombre(client, `SELECT count(*) AS n FROM campus.suivis WHERE etudiant_id = ANY($1::int[]) OR auteur_id = ANY($1::int[])`, [idsComptes])],
      ["traces dans le journal", await nombre(client, `SELECT count(*) AS n FROM campus.journal WHERE ${conditionJournal}`, paramsJournal)],
      ["appareils encore connectés", await nombre(client, `SELECT count(*) AS n FROM campus.session WHERE sess->>'utilisateurId' = ANY($1::text[])`, [idsTexte])],
      ["classes de démonstration", classeIds.length],
    ];

    const rien =
      idsComptes.length === 0 &&
      ecransRepris.length === 0 &&
      coursIds.length === 0 &&
      reprisIds.length === 0 &&
      remplacants.length === 0 &&
      classeIds.length === 0 &&
      fichierIds.length === 0 &&
      inventaire.every(([, n]) => n === 0);
    if (rien || simulation) {
      await client.query("ROLLBACK");
      const bilan: BilanPurge = { simulation, comptes: idsComptes.length, idsComptes, personnes, parRole, inventaire, tables: {}, fichiersDisque: 0, avertissements, ms: Date.now() - debut };
      if (rien) {
        dire("✓ Aucune donnée de démonstration à supprimer.");
        // Des fichiers orphelins peuvent rester sur le disque (semis interrompu) : on les retire quand même.
        if (!simulation) bilan.fichiersDisque = nettoyerDossierDemo(new Set());
      } else {
        dire("Simulation : voici ce qui serait supprimé (rien n'a été touché) :");
        for (const [l, n] of inventaire) dire(`  ${String(n).padStart(6)}  ${l}`);
      }
      for (const a of avertissements) dire(`  ⚠️  ${a}`);
      return bilan;
    }

    // ── 2. Suppression ─────────────────────────────────────────────────────
    const avant = await compterTables(client);
    const regex = motifNotifications({ seances: seanceIds, devoirs: devoirIds, cours: coursIds, annonces: annonceIds, conversations: conversationIds, comptes: idsComptes });

    // Écrans de vraies salles installés sur un compte de démonstration : ils deviennent des comptes réels (ni marqueur,
    // ni adresse, ni mot de passe commun de la démonstration) et gardent leur connexion.
    if (ecransRepris.length) {
      // Mot de passe tiré au sort et jamais montré : l'écran se réinstalle par un lien ou un code, comme un écran créé par le pilotage.
      const hashEcranRepris = await hacher(`${jetonAleatoire(18)}-${jetonAleatoire(18)}`);
      await q(
        `UPDATE campus.utilisateurs
            SET preferences = coalesce(preferences, '{}'::jsonb) - 'demo',
                email = CASE WHEN lower(coalesce(email, '')) LIKE $2 THEN NULL ELSE email END,
                mot_de_passe_hash = $3
          WHERE id = ANY($1::int[])`,
        [ecransRepris.map((e) => e.id), `%@${DOMAINE_DEMO}`, hashEcranRepris],
      );
    }
    await q(`DELETE FROM campus.session WHERE sess->>'utilisateurId' = ANY($1::text[])`, [idsTexte]);
    // Le journal d'abord (il ne référence les comptes que par utilisateur_id, sans cascade).
    await q(`DELETE FROM campus.journal WHERE ${conditionJournal}`, paramsJournal);
    // Les cours de démonstration et tout ce qui en dépend (cascade).
    await q(`DELETE FROM campus.cours WHERE id = ANY($1::int[])`, [coursIds]);
    // Cours repris par le réel : gardés, seul ce que le semis y avait mis part.
    if (reprisIds.length) {
      await q(`DELETE FROM campus.seances WHERE id = ANY($1::int[])`, [seancesRetirees]);
      await q(`DELETE FROM campus.devoirs WHERE id = ANY($1::int[])`, [devoirsRetires]);
      await q(`DELETE FROM campus.fiches_revision WHERE id = ANY($1::int[])`, [fichesRetirees]);
      await q(`DELETE FROM campus.lecons WHERE id = ANY($1::int[])`, [leconsRetirees]);
      await q(`DELETE FROM campus.modules WHERE id = ANY($1::int[])`, [modulesRetires]);
      if (detacher) await q(`DELETE FROM campus.cours_classes cc WHERE ${conditionDetacher}`, [reprisAuProgramme, classesRegistre]);
      await q(
        `UPDATE campus.cours SET description = '', objectifs = '', accroche_site = NULL, image_url = NULL, propose_sur_site = false, publier_sur_site = false, maj_le = now()
          WHERE id = ANY($1::int[])`,
        [[...presentationDemo]],
      );
    }
    // Formateur principal de démonstration : remplacé par le premier intervenant réel (qui cesse d'être co-formateur), sinon retiré.
    // Choisi par l'emploi du temps, il y est noté comme tel (formateurs_programme) : si l'emploi du temps change
    // d'intervenant, la publication suivante passe le cours au nouveau, comme pour un principal qu'elle a nommé.
    const avecFormateursProgramme = await tableExiste(client, "formateurs_programme");
    for (const r of remplacants.filter((x) => x.nouveau)) {
      await q(`UPDATE campus.cours SET formateur_id = $2, maj_le = now() WHERE id = $1`, [r.id, r.nouveau]);
      await q(`DELETE FROM campus.cours_formateurs WHERE cours_id = $1 AND formateur_id = $2`, [r.id, r.nouveau]);
      if (avecFormateursProgramme) {
        await q(
          `INSERT INTO campus.formateurs_programme (cours_id, formateur_id, principal)
           SELECT $1, $2, true WHERE $3::boolean OR EXISTS (SELECT 1 FROM campus.formateurs_programme WHERE cours_id = $1 AND formateur_id = $2)
           ON CONFLICT (cours_id, formateur_id) DO UPDATE SET principal = true`,
          [r.id, r.nouveau, r.par_programme],
        );
      }
    }
    await q(`UPDATE campus.cours SET formateur_id = NULL WHERE formateur_id = ANY($1::int[])`, [idsComptes]);
    // Conversations directes avec un compte de démonstration, puis messages écrits ailleurs.
    await q(`DELETE FROM campus.conversations WHERE type = 'direct' AND id IN (SELECT conversation_id FROM campus.participants WHERE utilisateur_id = ANY($1::int[]))`, [idsComptes]);
    await q(`UPDATE campus.messages SET supprime_par_id = NULL WHERE supprime_par_id = ANY($1::int[])`, [idsComptes]);
    await q(`UPDATE campus.messages SET fichier_id = NULL WHERE fichier_id = ANY($1::int[])`, [fichierIds]);
    await q(`DELETE FROM campus.messages WHERE auteur_id = ANY($1::int[])`, [idsComptes]);
    // Annonces, relances et événements publiés par des comptes de démonstration.
    await q(`DELETE FROM campus.relances_annonces WHERE auteur_id = ANY($1::int[])`, [idsComptes]);
    await q(`DELETE FROM campus.annonces WHERE auteur_id = ANY($1::int[])`, [idsComptes]);
    await q(`DELETE FROM campus.evenements WHERE auteur_id = ANY($1::int[])`, [idsComptes]);
    // Traces laissées dans des séances ou des devoirs réels.
    await q(`DELETE FROM campus.questions_live WHERE auteur_id = ANY($1::int[])`, [idsComptes]);
    await q(`UPDATE campus.messages_live SET fichier_id = NULL WHERE fichier_id = ANY($1::int[])`, [fichierIds]);
    await q(`DELETE FROM campus.messages_live WHERE auteur_id = ANY($1::int[])`, [idsComptes]);
    await q(`DELETE FROM campus.mains_levees WHERE utilisateur_id = ANY($1::int[])`, [idsComptes]);
    await q(`UPDATE campus.presences SET pointe_par_id = NULL WHERE pointe_par_id = ANY($1::int[])`, [idsComptes]);
    await q(`UPDATE campus.rendus SET depose_par_id = NULL WHERE depose_par_id = ANY($1::int[])`, [idsComptes]);
    await q(`UPDATE campus.rendus SET correcteur_id = NULL WHERE correcteur_id = ANY($1::int[])`, [idsComptes]);
    await q(`UPDATE campus.rendus SET commentaire_audio_id = NULL WHERE commentaire_audio_id = ANY($1::int[])`, [fichierIds]);
    await q(`UPDATE campus.devoirs SET auteur_id = NULL WHERE auteur_id = ANY($1::int[])`, [idsComptes]);
    await q(`UPDATE campus.lecons SET fichier_id = NULL WHERE fichier_id = ANY($1::int[])`, [fichierIds]);
    // Suivis écrits par la démonstration (ceux qui la concernent partent avec les comptes), fichiers.
    await q(`DELETE FROM campus.suivis WHERE auteur_id = ANY($1::int[])`, [idsComptes]);
    await q(`DELETE FROM campus.fichiers WHERE id = ANY($1::int[])`, [fichierIds]);
    // Les comptes : le reste suit en cascade (notifications, présences, progressions, IA, rappels, jetons…).
    await q(`DELETE FROM campus.utilisateurs WHERE id = ANY($1::int[])`, [idsComptes]);
    await q(`DELETE FROM campus.classes WHERE id = ANY($1::int[])`, [classeIds]);
    // Conversations directes restées sans personne, notifications réelles qui pointaient vers la démonstration.
    await q(`DELETE FROM campus.conversations c WHERE c.type = 'direct' AND NOT EXISTS (SELECT 1 FROM campus.participants p WHERE p.conversation_id = c.id)`);
    if (regex) await q(`DELETE FROM campus.notifications WHERE lien ~ $1`, [regex]);

    const apres = await compterTables(client);
    const tables: Record<string, number> = {};
    for (const [t, n] of Object.entries(avant)) if (n !== (apres[t] ?? 0)) tables[t] = n - (apres[t] ?? 0);
    const restants = await nombre(client, `SELECT count(*) AS n FROM campus.utilisateurs WHERE preferences->>'demo' = 'true' AND role <> 'admin' AND NOT (id = ANY($1::int[]))`, [
      proteges.map((p) => p.id),
    ]);
    if (restants) throw new Error(`${restants} compte(s) de démonstration toujours présents après la purge : annulation.`);

    // Trace de la purge : en production, la démonstration ne pourra plus être semée dans cette base.
    await q(`INSERT INTO campus.journal (utilisateur_id, action, details) VALUES (NULL, $1, $2)`, [
      ACTION_JOURNAL_PURGE,
      JSON.stringify({
        comptes: idsComptes.length,
        parRole,
        tables,
        cours: coursDemo.map((c) => c.code),
        repris: coursRepris.map((c) => c.code),
        ecransRepris: ecransRepris.map((e) => e.id),
        classes: classes.map((c) => c.nom),
      }),
    ]);
    await client.query("COMMIT");

    // ── 3. Fichiers sur le disque (après validation seulement) ─────────────
    let effaces = 0;
    for (const f of fichiersDemo) {
      const chemin = path.resolve(config.dossierFichiers, f.cle);
      if (!chemin.startsWith(config.dossierFichiers + path.sep)) continue;
      try {
        if (fs.existsSync(chemin)) {
          fs.rmSync(chemin, { force: true });
          effaces++;
        }
      } catch (e) {
        avertissements.push(`Fichier non effacé (${f.cle}) : ${(e as Error).message}`);
      }
    }
    effaces += nettoyerDossierDemo(new Set(fichiersDemo.map((f) => f.cle)));

    const bilan: BilanPurge = { simulation, comptes: idsComptes.length, idsComptes, personnes, parRole, inventaire, tables, fichiersDisque: effaces, avertissements, ms: Date.now() - debut };
    dire(`✓ Démonstration supprimée en ${(bilan.ms / 1000).toFixed(1).replace(".", ",")} s : ${idsComptes.length} comptes (${Object.entries(parRole).map(([r, n]) => `${r} ${n}`).join(", ")}), ${coursIds.length} cours, ${classeIds.length} classes, ${effaces} fichier(s) sur le disque.`);
    dire("  Lignes retirées, table par table :");
    for (const [t, n] of Object.entries(tables).sort((a, b) => b[1] - a[1])) dire(`  ${String(n).padStart(7)}  ${t}`);
    const [sitesRestants, direction2] = await Promise.all([
      nombre(client, `SELECT count(*) AS n FROM campus.sites`),
      nombre(client, `SELECT count(*) AS n FROM campus.utilisateurs WHERE role = 'admin'`),
    ]);
    dire(`  Restent : ${sitesRestants} campus, ${direction2} compte(s) de la direction et toutes les données réelles.`);
    for (const a of avertissements) dire(`  ⚠️  ${a}`);
    return bilan;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Le semis n'écrit ses photos que dans UPLOADS_DIR/demo/ (les vrais dépôts
 * vont dans AAAA-MM/) : ce qui y reste sans ligne en base est effacé, puis le
 * dossier s'il est vide. Renvoie le nombre de fichiers effacés.
 */
function nettoyerDossierDemo(dejaTraites: Set<string>): number {
  const dossier = path.join(config.dossierFichiers, "demo");
  let n = 0;
  try {
    if (!fs.existsSync(dossier)) return 0;
    for (const nom of fs.readdirSync(dossier)) {
      if (dejaTraites.has(`demo/${nom}`)) continue;
      const chemin = path.join(dossier, nom);
      if (fs.statSync(chemin).isFile()) {
        fs.rmSync(chemin, { force: true });
        n++;
      }
    }
    if (!fs.readdirSync(dossier).length) fs.rmdirSync(dossier);
  } catch {
    /* dossier partagé ou déjà retiré */
  }
  return n;
}
