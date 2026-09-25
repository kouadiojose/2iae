// Supprime les données de démonstration du campus.
//
//   npm run db:purge-demo                 développement (lit .env)
//   npm run db:purge-demo:prod            production (après « npm run build »)
//   npm run db:purge-demo -- --simulation affiche seulement ce qui serait supprimé
//
// Ce qui part :
//   - les comptes marqués preferences.demo = true (jamais la direction ni un
//     compte administrateur, même marqué par erreur) ;
//   - les cours de démonstration (IA-101, ENT-210, INF-230, GES-120, AGR-110,
//     tenus par un formateur de démonstration) et tout ce qui en dépend :
//     chapitres, leçons, progressions, séances et replays, devoirs, copies,
//     interrogations, salons, annonces et événements du cours, fiches ;
//   - ce que les comptes de démonstration ont produit ailleurs : messages et
//     conversations directes, annonces, événements, notifications, fichiers
//     (lignes et fichiers sur le disque), suivis, journal, usage de l'IA ;
//   - les classes créées par le semis, si plus personne de réel n'y est rattaché.
// Ce qui reste : les sites, la direction, les autres comptes et leurs données.
//
// Tout se fait dans une transaction : en cas d'erreur, rien n'est supprimé.
import fs from "fs";
import path from "path";
import type { PoolClient } from "pg";
import { pool } from "../db";
import { config } from "../config";
import { prevenirSite } from "../site";
import { ACTION_JOURNAL_DEMO, CODES_COURS_DEMO, DOMAINE_DEMO } from "../demo";

const simulation = process.argv.includes("--simulation") || process.argv.includes("--dry-run");
const sansAttente = process.argv.includes("--oui") || !process.stdout.isTTY;

type Client = PoolClient;

const nombre = async (client: Client, requete: string, params: unknown[] = []): Promise<number> =>
  Number((await client.query<{ n: string }>(requete, params)).rows[0]?.n ?? 0);

function pause(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function principal() {
  const client = await pool.connect();
  try {
    // ── 1. Inventaire ──────────────────────────────────────────────────────
    const marques = (
      await client.query<{ id: number; role: string; prenom: string; nom: string; identifiant: string | null }>(
        `SELECT id, role, prenom, nom, coalesce(email, matricule) AS identifiant
           FROM campus.utilisateurs
          WHERE preferences->>'demo' = 'true'
          ORDER BY role, nom, prenom`,
      )
    ).rows;
    const direction = config.admin.identifiant.toLowerCase();
    const proteges = marques.filter((u) => u.role === "admin" || u.identifiant?.toLowerCase() === direction);
    const comptes = marques.filter((u) => !proteges.includes(u));
    const ids = comptes.map((u) => u.id);
    const idsTexte = ids.map(String);

    for (const p of proteges) {
      console.warn(`⚠️  ${p.prenom} ${p.nom} (${p.identifiant ?? p.id}, ${p.role}) est marqué « démonstration » mais ne sera PAS supprimé (compte de direction).`);
    }
    if (!ids.length) {
      console.log("Aucune donnée de démonstration à supprimer.");
      return;
    }
    const horsDomaine = comptes.filter((u) => u.identifiant?.includes("@") && !u.identifiant.endsWith(`@${DOMAINE_DEMO}`));
    if (horsDomaine.length) {
      console.warn(`⚠️  ${horsDomaine.length} compte(s) marqué(s) « démonstration » hors du domaine ${DOMAINE_DEMO} : ${horsDomaine.map((u) => u.identifiant).join(", ")}.`);
    }

    // Registre du semis (classes et cours créés).
    const registre = (await client.query<{ id: number; details: { classes?: number[]; cours?: number[] } | null }>(`SELECT id, details FROM campus.journal WHERE action = $1`, [ACTION_JOURNAL_DEMO])).rows;
    const classesRegistre = [...new Set(registre.flatMap((r) => r.details?.classes ?? []))];
    const coursRegistre = [...new Set(registre.flatMap((r) => r.details?.cours ?? []))];

    // Cours de démonstration : un code de démonstration (ou noté au registre) ET un formateur de démonstration.
    const codes = [...CODES_COURS_DEMO, ...CODES_COURS_DEMO.map((c) => `${c}-D`)];
    const coursDemo = (
      await client.query<{ id: number; code: string; titre: string }>(
        `SELECT id, code, titre FROM campus.cours
          WHERE formateur_id = ANY($1::int[]) AND (code = ANY($2::text[]) OR id = ANY($3::int[]))
          ORDER BY code`,
        [ids, codes, coursRegistre],
      )
    ).rows;
    const coursIds = coursDemo.map((c) => c.id);
    const coursGardes = (
      await client.query<{ id: number; code: string }>(`SELECT id, code FROM campus.cours WHERE formateur_id = ANY($1::int[]) AND NOT (id = ANY($2::int[]))`, [ids, coursIds])
    ).rows;

    // Classes du semis qu'on peut retirer sans toucher à du réel.
    const classes = (
      await client.query<{ id: number; nom: string }>(
        `SELECT c.id, c.nom FROM campus.classes c
          WHERE c.id = ANY($1::int[])
            AND NOT EXISTS (SELECT 1 FROM campus.utilisateurs u WHERE u.classe_id = c.id AND NOT (u.id = ANY($2::int[])))
            AND NOT EXISTS (SELECT 1 FROM campus.cours_classes cc WHERE cc.classe_id = c.id AND NOT (cc.cours_id = ANY($3::int[])))
            AND NOT EXISTS (SELECT 1 FROM campus.annonces a WHERE a.classe_id = c.id AND NOT (a.auteur_id = ANY($2::int[])) AND (a.cours_id IS NULL OR NOT (a.cours_id = ANY($3::int[]))))
            AND NOT EXISTS (SELECT 1 FROM campus.evenements e WHERE e.classe_id = c.id AND (e.auteur_id IS NULL OR NOT (e.auteur_id = ANY($2::int[]))) AND (e.cours_id IS NULL OR NOT (e.cours_id = ANY($3::int[]))))
          ORDER BY c.nom`,
        [classesRegistre, ids, coursIds],
      )
    ).rows;
    const classesGardees = classesRegistre.length - classes.length;

    // Objets rattachés (pour le récapitulatif et le nettoyage des notifications).
    const seanceIds = (await client.query<{ id: number }>(`SELECT id FROM campus.seances WHERE cours_id = ANY($1::int[])`, [coursIds])).rows.map((r) => r.id);
    const devoirIds = (await client.query<{ id: number }>(`SELECT id FROM campus.devoirs WHERE cours_id = ANY($1::int[])`, [coursIds])).rows.map((r) => r.id);
    const annonceIds = (
      await client.query<{ id: number }>(`SELECT id FROM campus.annonces WHERE auteur_id = ANY($1::int[]) OR cours_id = ANY($2::int[])`, [ids, coursIds])
    ).rows.map((r) => r.id);
    const conversationIds = (
      await client.query<{ id: number }>(
        `SELECT id FROM campus.conversations
          WHERE cours_id = ANY($2::int[])
             OR (type = 'direct' AND id IN (SELECT conversation_id FROM campus.participants WHERE utilisateur_id = ANY($1::int[])))`,
        [ids, coursIds],
      )
    ).rows.map((r) => r.id);
    const fichiersDemo = (
      await client.query<{ id: number; cle: string }>(`SELECT id, cle FROM campus.fichiers WHERE proprietaire_id = ANY($1::int[])`, [ids])
    ).rows;
    const fichierIds = fichiersDemo.map((f) => f.id);

    const recap: [string, number][] = [
      ["comptes de démonstration", ids.length],
      ["cours de démonstration", coursIds.length],
      ["leçons", await nombre(client, `SELECT count(*) AS n FROM campus.lecons WHERE cours_id = ANY($1::int[])`, [coursIds])],
      ["séances en direct", seanceIds.length],
      ["devoirs et interrogations", devoirIds.length],
      [
        "copies rendues",
        await nombre(client, `SELECT count(*) AS n FROM campus.rendus WHERE devoir_id = ANY($1::int[]) OR etudiant_id = ANY($2::int[])`, [devoirIds, ids]),
      ],
      ["conversations", conversationIds.length],
      [
        "messages",
        await nombre(client, `SELECT count(*) AS n FROM campus.messages WHERE auteur_id = ANY($1::int[]) OR conversation_id = ANY($2::int[])`, [ids, conversationIds]),
      ],
      ["annonces", annonceIds.length],
      [
        "événements",
        await nombre(client, `SELECT count(*) AS n FROM campus.evenements WHERE auteur_id = ANY($1::int[]) OR cours_id = ANY($2::int[])`, [ids, coursIds]),
      ],
      ["notifications", await nombre(client, `SELECT count(*) AS n FROM campus.notifications WHERE utilisateur_id = ANY($1::int[])`, [ids])],
      ["fichiers", fichierIds.length],
      ["suivis de vie scolaire", await nombre(client, `SELECT count(*) AS n FROM campus.suivis WHERE etudiant_id = ANY($1::int[]) OR auteur_id = ANY($1::int[])`, [ids])],
      [
        "lignes du journal",
        await nombre(
          client,
          `SELECT count(*) AS n FROM campus.journal
            WHERE utilisateur_id = ANY($1::int[]) OR details->>'etudiantId' = ANY($2::text[]) OR details->>'compteId' = ANY($2::text[]) OR action = $3`,
          [ids, idsTexte, ACTION_JOURNAL_DEMO],
        ),
      ],
      ["jours d'usage de l'IA", await nombre(client, `SELECT count(*) AS n FROM campus.usage_ia WHERE utilisateur_id = ANY($1::int[])`, [ids])],
      ["sessions ouvertes", await nombre(client, `SELECT count(*) AS n FROM campus.session WHERE sess->>'utilisateurId' = ANY($1::text[])`, [idsTexte])],
      ["classes créées par le semis", classes.length],
    ];

    console.log(`${simulation ? "Simulation : voici" : "Voici"} ce qui va être supprimé :`);
    const parRole = new Map<string, number>();
    for (const u of comptes) parRole.set(u.role, (parRole.get(u.role) ?? 0) + 1);
    for (const [libelle, n] of recap) console.log(`  ${String(n).padStart(5)}  ${libelle}`);
    console.log(`  Comptes par rôle : ${[...parRole.entries()].map(([r, n]) => `${r} ${n}`).join(", ")}`);
    if (coursDemo.length) console.log(`  Cours : ${coursDemo.map((c) => c.code).join(", ")}`);
    if (classes.length) console.log(`  Classes : ${classes.map((c) => c.nom).join(" ; ")}`);
    if (classesGardees > 0) console.log(`  ${classesGardees} classe(s) du semis gardée(s) : des comptes, cours ou annonces réels y sont rattachés.`);
    if (coursGardes.length) console.log(`  Cours réels gardés (leur formateur de démonstration sera simplement retiré) : ${coursGardes.map((c) => c.code).join(", ")}`);
    console.log("  Jamais touchés : les sites, la direction et les données réelles.");

    if (simulation) {
      console.log("Simulation terminée : rien n'a été supprimé.");
      return;
    }
    if (!sansAttente) {
      console.log("Suppression dans 5 secondes… (Ctrl+C pour annuler)");
      await pause(5000);
    }

    // ── 2. Suppression, dans une transaction ───────────────────────────────
    const regexNotifications = motifNotifications({ seances: seanceIds, devoirs: devoirIds, cours: coursIds, annonces: annonceIds, conversations: conversationIds });
    await client.query("BEGIN");
    const q = (requete: string, params: unknown[] = []) => client.query(requete, params);
    await q(`DELETE FROM campus.session WHERE sess->>'utilisateurId' = ANY($1::text[])`, [idsTexte]);
    // Les cours de démonstration et tout ce qui en dépend (cascade).
    await q(`DELETE FROM campus.cours WHERE id = ANY($1::int[])`, [coursIds]);
    await q(`UPDATE campus.cours SET formateur_id = NULL WHERE formateur_id = ANY($1::int[])`, [ids]);
    // Conversations directes avec un compte de démonstration, puis messages écrits ailleurs.
    await q(`DELETE FROM campus.conversations WHERE type = 'direct' AND id IN (SELECT conversation_id FROM campus.participants WHERE utilisateur_id = ANY($1::int[]))`, [ids]);
    await q(`UPDATE campus.messages SET supprime_par_id = NULL WHERE supprime_par_id = ANY($1::int[])`, [ids]);
    await q(`UPDATE campus.messages SET fichier_id = NULL WHERE fichier_id = ANY($1::int[])`, [fichierIds]);
    await q(`DELETE FROM campus.messages WHERE auteur_id = ANY($1::int[])`, [ids]);
    // Annonces, relances et événements publiés par des comptes de démonstration.
    await q(`DELETE FROM campus.relances_annonces WHERE auteur_id = ANY($1::int[])`, [ids]);
    await q(`DELETE FROM campus.annonces WHERE auteur_id = ANY($1::int[])`, [ids]);
    await q(`DELETE FROM campus.evenements WHERE auteur_id = ANY($1::int[])`, [ids]);
    // Traces laissées dans des séances ou des devoirs réels.
    await q(`DELETE FROM campus.questions_live WHERE auteur_id = ANY($1::int[])`, [ids]);
    await q(`DELETE FROM campus.mains_levees WHERE utilisateur_id = ANY($1::int[])`, [ids]);
    await q(`UPDATE campus.presences SET pointe_par_id = NULL WHERE pointe_par_id = ANY($1::int[])`, [ids]);
    await q(`UPDATE campus.rendus SET depose_par_id = NULL WHERE depose_par_id = ANY($1::int[])`, [ids]);
    await q(`UPDATE campus.rendus SET correcteur_id = NULL WHERE correcteur_id = ANY($1::int[])`, [ids]);
    await q(`UPDATE campus.rendus SET commentaire_audio_id = NULL WHERE commentaire_audio_id = ANY($1::int[])`, [fichierIds]);
    await q(`UPDATE campus.devoirs SET auteur_id = NULL WHERE auteur_id = ANY($1::int[])`, [ids]);
    await q(`UPDATE campus.lecons SET fichier_id = NULL WHERE fichier_id = ANY($1::int[])`, [fichierIds]);
    // Suivis, journal, fichiers.
    await q(`DELETE FROM campus.suivis WHERE auteur_id = ANY($1::int[])`, [ids]);
    await q(
      `DELETE FROM campus.journal
        WHERE utilisateur_id = ANY($1::int[]) OR details->>'etudiantId' = ANY($2::text[]) OR details->>'compteId' = ANY($2::text[]) OR action = $3`,
      [ids, idsTexte, ACTION_JOURNAL_DEMO],
    );
    await q(`DELETE FROM campus.fichiers WHERE id = ANY($1::int[])`, [fichierIds]);
    // Les comptes : tout le reste suit en cascade (notifications, présences, progressions, usage de l'IA…).
    const supprimes = await q(`DELETE FROM campus.utilisateurs WHERE id = ANY($1::int[])`, [ids]);
    await q(`DELETE FROM campus.classes WHERE id = ANY($1::int[])`, [classes.map((c) => c.id)]);
    // Conversations directes restées sans personne, notifications réelles qui pointaient vers la démonstration.
    await q(`DELETE FROM campus.conversations c WHERE c.type = 'direct' AND NOT EXISTS (SELECT 1 FROM campus.participants p WHERE p.conversation_id = c.id)`);
    const notifs = regexNotifications ? await q(`DELETE FROM campus.notifications WHERE lien ~ $1`, [regexNotifications]) : { rowCount: 0 };
    await q("COMMIT");

    // ── 3. Fichiers sur le disque (après la validation) ────────────────────
    let effaces = 0;
    for (const f of fichiersDemo) {
      const chemin = path.resolve(config.dossierFichiers, f.cle);
      if (!chemin.startsWith(config.dossierFichiers + path.sep)) continue;
      try {
        fs.rmSync(chemin, { force: true });
        effaces++;
      } catch (e) {
        console.warn(`  Fichier non effacé (${f.cle}) : ${(e as Error).message}`);
      }
    }
    const dossierDemo = path.join(config.dossierFichiers, "demo");
    try {
      if (fs.existsSync(dossierDemo) && !fs.readdirSync(dossierDemo).length) fs.rmdirSync(dossierDemo);
    } catch {
      /* dossier partagé ou déjà retiré */
    }

    // ── 4. Vérification ────────────────────────────────────────────────────
    const restants = await nombre(client, `SELECT count(*) AS n FROM campus.utilisateurs WHERE preferences->>'demo' = 'true' AND role <> 'admin'`);
    const sitesRestants = await nombre(client, `SELECT count(*) AS n FROM campus.sites`);
    console.log(
      `✓ Démonstration supprimée : ${supprimes.rowCount ?? 0} comptes, ${coursIds.length} cours, ${classes.length} classes, ${effaces} fichier(s) sur le disque` +
        `${notifs.rowCount ? `, ${notifs.rowCount} notification(s) réelle(s) qui pointaient vers la démonstration` : ""}.`,
    );
    console.log(`  Restent : ${sitesRestants} sites, la direction et les données réelles. Comptes de démonstration restants : ${restants}.`);
    if (config.demo) {
      console.warn("⚠️  CAMPUS_DEMO=true : le prochain déploiement (ou « npm run db:migrate ») sèmera de nouveau la démonstration. Passez CAMPUS_DEMO à false pour l'éviter.");
    }
    prevenirSite("données de démonstration supprimées");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

/** Liens des notifications (« /live/12 », « /devoirs/4 »…) qui mènent vers un objet supprimé. */
function motifNotifications(o: { seances: number[]; devoirs: number[]; cours: number[]; annonces: number[]; conversations: number[] }): string | null {
  const alt = (ids: number[]) => ids.join("|");
  const parties: string[] = [];
  if (o.seances.length) parties.push(`(?:live|replays|enseigner/seances)/(?:${alt(o.seances)})`);
  if (o.devoirs.length) parties.push(`(?:devoirs|quiz|enseigner/devoirs)/(?:${alt(o.devoirs)})`);
  if (o.cours.length) parties.push(`(?:cours|enseigner/cours|messages/cours)/(?:${alt(o.cours)})`);
  if (o.annonces.length) parties.push(`annonces/(?:${alt(o.annonces)})`);
  if (o.conversations.length) parties.push(`messages/(?:${alt(o.conversations)})`);
  return parties.length ? `^/(?:${parties.join("|")})(?:[/?#]|$)` : null;
}

// Le webhook du site (regroupé sur 3 s) part avant que le processus ne s'arrête.
principal()
  .then(() => pool.end())
  .catch(async (e) => {
    console.error("✗ Purge échouée (rien n'a été supprimé) :", e);
    await pool.end();
    process.exit(1);
  });
