// Cœur de la purge des données de démonstration, partagé par :
//   - server/scripts/purger-demo.ts (npm run db:purge-demo, en ligne de commande) ;
//   - server/scripts/migrate.ts, au démarrage du service quand CAMPUS_PURGER_DEMO=oui
//     (production sans accès au serveur : poser la variable sur Railway et redéployer).
//
// Ce qui part, et seulement cela :
//   - les comptes de démonstration : preferences.demo = true ou adresse
//     @demo.2iae.com (jamais un compte de la direction, même marqué par erreur) ;
//   - les cours de démonstration (codes IA-101, ENT-210, INF-230, GES-120,
//     AGR-110 ou notés au registre du semis, ET tenus par un formateur de
//     démonstration) avec tout ce qui en dépend : chapitres, leçons,
//     progressions, séances et replays, présences, questions, sondages,
//     devoirs, copies, interrogations, salons, annonces, événements, fiches ;
//   - ce que les comptes de démonstration ont laissé ailleurs : messages et
//     conversations directes, annonces, événements, notifications, suivis,
//     journal, usage et conversations de l'assistant, abonnements aux rappels,
//     sessions de connexion, fichiers (lignes ET fichiers sur le disque) ;
//   - les classes créées par le semis, si plus rien de réel n'y est rattaché ;
//   - les notifications et lignes du journal de personnes réelles qui ne
//     pointent plus que vers de la démonstration supprimée.
// Ce qui reste : les campus, la direction, et toute donnée réelle.
// Cas particulier : un cours de démonstration que l'emploi du temps réel a
// repris (même code, « IA-101 ») n'est pas supprimé, pour ne pas casser le
// programme et ses séances ; il est VIDÉ de tout ce que la démonstration y
// avait mis (chapitres, leçons, séances hors programme, devoirs, fiches,
// textes de présentation, annonce sur le site) et un avertissement le signale.
//
// Tout se fait dans UNE transaction, sous le même verrou que le semis : en cas
// d'erreur, rien n'est supprimé. Le bilan compte les lignes table par table,
// avant et après : il prouve que rien d'autre n'a bougé.
import fs from "fs";
import path from "path";
import type { PoolClient } from "pg";
import { pool } from "../db";
import { config } from "../config";
import { ACTION_JOURNAL_DEMO, ACTION_JOURNAL_PURGE, CODES_COURS_DEMO, DOMAINE_DEMO, VERROU_SEMIS } from "../demo-constantes";


export type BilanPurge = {
  simulation: boolean;
  /** Comptes de démonstration trouvés (et supprimés, hors simulation). */
  comptes: number;
  /** Leurs identifiants (pour fermer aussitôt leurs connexions ouvertes). */
  idsComptes: number[];
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

const nombre = async (c: Q, requete: string, params: unknown[] = []): Promise<number> =>
  Number((await c.query<{ n: string }>(requete, params)).rows[0]?.n ?? 0);

const ids = async (c: Q, requete: string, params: unknown[] = []): Promise<number[]> =>
  (await c.query<{ id: number }>(requete, params)).rows.map((r) => Number(r.id));

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

/** Une colonne existe-t-elle ? (le schéma évolue : une purge ne doit pas tomber sur une table d'un autre module) */
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
      await client.query<{ id: number; role: string; prenom: string; nom: string; identifiant: string | null; email: string | null }>(
        `SELECT id, role, prenom, nom, coalesce(email, matricule) AS identifiant, email
           FROM campus.utilisateurs
          WHERE preferences->>'demo' = 'true' OR lower(coalesce(email, '')) LIKE $1
          ORDER BY role, nom, prenom`,
        [`%@${DOMAINE_DEMO}`],
      )
    ).rows;
    const proteges = marques.filter((u) => u.role === "admin" || u.email?.toLowerCase() === direction);
    for (const p of proteges) avertissements.push(`${p.prenom} ${p.nom} (${p.identifiant ?? p.id}) ressemble à un compte de démonstration mais appartient à la direction : gardé.`);
    const comptes = marques.filter((u) => !proteges.includes(u));
    const idsComptes = comptes.map((u) => u.id);
    const idsTexte = idsComptes.map(String);
    const parRole: Record<string, number> = {};
    for (const u of comptes) parRole[u.role] = (parRole[u.role] ?? 0) + 1;

    // Registre du semis (classes et cours créés).
    const registre = (await client.query<{ details: { classes?: number[]; cours?: number[] } | null }>(`SELECT details FROM campus.journal WHERE action = $1`, [ACTION_JOURNAL_DEMO])).rows;
    const classesRegistre = [...new Set(registre.flatMap((r) => r.details?.classes ?? []))];
    const coursRegistre = [...new Set(registre.flatMap((r) => r.details?.cours ?? []))];

    const avecProgramme = await tableExiste(client, "creneaux_programme");
    const avecSessionsClasses = await tableExiste(client, "sessions_classes");

    // Cours de démonstration : code de démonstration (ou registre) ET formateur de démonstration.
    const codes = [...CODES_COURS_DEMO, ...CODES_COURS_DEMO.map((c) => `${c}-D`)];
    const candidats = (
      await client.query<{ id: number; code: string }>(
        `SELECT id, code FROM campus.cours
          WHERE formateur_id = ANY($1::int[]) AND (code = ANY($2::text[]) OR id = ANY($3::int[]))
          ORDER BY code`,
        [idsComptes, codes, coursRegistre],
      )
    ).rows;
    // …sauf s'il sert à l'emploi du temps réel : le supprimer casserait le programme publié.
    const utilises = avecProgramme
      ? new Set(
          await ids(
            client,
            `SELECT DISTINCT cours_id AS id FROM campus.creneaux_programme WHERE cours_id = ANY($1::int[])
             UNION SELECT DISTINCT s.cours_id FROM campus.seances s JOIN campus.seances_creneaux sc ON sc.seance_id = s.id WHERE s.cours_id = ANY($1::int[])`,
            [candidats.map((c) => c.id)],
          ),
        )
      : new Set<number>();
    const coursDemo = candidats.filter((c) => !utilises.has(c.id));
    const coursRepris = candidats.filter((x) => utilises.has(x.id));
    for (const c of coursRepris) {
      avertissements.push(`Le cours ${c.code} vient de la démonstration mais l'emploi du temps l'utilise : il est gardé, vidé de son contenu de démonstration. Vérifiez son titre et sa présentation (Pilotage, Cours).`);
    }
    const coursIds = coursDemo.map((c) => c.id);
    const reprisIds = coursRepris.map((c) => c.id);
    const coursGardes = (
      await client.query<{ code: string }>(`SELECT code FROM campus.cours WHERE formateur_id = ANY($1::int[]) AND NOT (id = ANY($2::int[])) AND NOT (id = ANY($3::int[]))`, [idsComptes, coursIds, reprisIds])
    ).rows;
    if (coursGardes.length) avertissements.push(`Cours réels gardés, dont le formateur de démonstration est simplement retiré : ${coursGardes.map((c) => c.code).join(", ")}.`);

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

    // Objets rattachés (récapitulatif, journal et notifications).
    const seancesReprises = reprisIds.length
      ? await ids(client, `SELECT id FROM campus.seances WHERE cours_id = ANY($1::int[]) AND id NOT IN (SELECT seance_id FROM campus.seances_creneaux)`, [reprisIds])
      : [];
    const seanceIds = [...(await ids(client, `SELECT id FROM campus.seances WHERE cours_id = ANY($1::int[])`, [coursIds])), ...seancesReprises];
    const devoirIds = await ids(client, `SELECT id FROM campus.devoirs WHERE cours_id = ANY($1::int[]) OR cours_id = ANY($2::int[])`, [coursIds, reprisIds]);
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
      ["leçons", await nombre(client, `SELECT count(*) AS n FROM campus.lecons WHERE cours_id = ANY($1::int[]) OR cours_id = ANY($2::int[])`, [coursIds, reprisIds])],
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

    const rien = idsComptes.length === 0 && coursIds.length === 0 && reprisIds.length === 0 && classeIds.length === 0 && fichierIds.length === 0 && inventaire.every(([, n]) => n === 0);
    if (rien || simulation) {
      await client.query("ROLLBACK");
      const bilan: BilanPurge = { simulation, comptes: idsComptes.length, idsComptes, parRole, inventaire, tables: {}, fichiersDisque: 0, avertissements, ms: Date.now() - debut };
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

    await q(`DELETE FROM campus.session WHERE sess->>'utilisateurId' = ANY($1::text[])`, [idsTexte]);
    // Le journal d'abord (il ne référence les comptes que par utilisateur_id, sans cascade).
    await q(`DELETE FROM campus.journal WHERE ${conditionJournal}`, paramsJournal);
    // Les cours de démonstration et tout ce qui en dépend (cascade), puis les formateurs retirés des cours réels.
    await q(`DELETE FROM campus.cours WHERE id = ANY($1::int[])`, [coursIds]);
    // Cours repris par l'emploi du temps : gardés, mais vidés de la démonstration.
    if (reprisIds.length) {
      await q(`DELETE FROM campus.seances WHERE id = ANY($1::int[])`, [seancesReprises]);
      await q(`DELETE FROM campus.devoirs WHERE cours_id = ANY($1::int[])`, [reprisIds]);
      await q(`DELETE FROM campus.fiches_revision WHERE cours_id = ANY($1::int[])`, [reprisIds]);
      await q(`DELETE FROM campus.modules WHERE cours_id = ANY($1::int[])`, [reprisIds]);
      await q(`DELETE FROM campus.lecons WHERE cours_id = ANY($1::int[])`, [reprisIds]);
      await q(
        `UPDATE campus.cours SET description = '', objectifs = '', accroche_site = NULL, image_url = NULL, propose_sur_site = false, publier_sur_site = false, maj_le = now()
          WHERE id = ANY($1::int[])`,
        [reprisIds],
      );
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
    const restants = await nombre(client, `SELECT count(*) AS n FROM campus.utilisateurs WHERE (preferences->>'demo' = 'true' OR lower(coalesce(email, '')) LIKE $1) AND role <> 'admin'`, [`%@${DOMAINE_DEMO}`]);
    if (restants) throw new Error(`${restants} compte(s) de démonstration toujours présents après la purge : annulation.`);

    // Trace de la purge : en production, la démonstration ne pourra plus être semée dans cette base.
    await q(`INSERT INTO campus.journal (utilisateur_id, action, details) VALUES (NULL, $1, $2)`, [
      ACTION_JOURNAL_PURGE,
      JSON.stringify({ comptes: idsComptes.length, parRole, tables, cours: coursDemo.map((c) => c.code), classes: classes.map((c) => c.nom) }),
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

    const bilan: BilanPurge = { simulation, comptes: idsComptes.length, idsComptes, parRole, inventaire, tables, fichiersDisque: effaces, avertissements, ms: Date.now() - debut };
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
