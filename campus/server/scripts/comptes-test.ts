// Comptes et données minimales pour le développement et les tests
// (jamais en production). Idempotent.
//
//   DATABASE_URL=postgresql://postgres@localhost:5433/campus_x npx tsx server/scripts/comptes-test.ts
//
// Identifiants créés :
//   direction@2iae.com        Direction-2026        (admin)
//   vs.yopougon@2iae.com      VieScolaire-2026      (vie scolaire, Yopougon)
//   k.diallo@2iae.com         Formateur-2026        (formateur, Lyon)
//   24GC0001 (Aya Koné)       482913                (étudiante, Yopougon)
//   24GC0002 (Koffi Brou)     482913                (étudiant, Azaguié)
//   24GC0003 (Mariam Traoré)  482913                (étudiante, M'Batto)
//   24GC0099 (Awa Nouveau)    739251                (étudiante jamais connectée : code provisoire)
//   salle.yopougon@2iae.com   Salle-Yopougon-2026   (écran de la salle de conférence de Yopougon)
import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { hacher } from "../auth";
import { SITES_2IAE } from "../amorcage";
import { sites, classes, utilisateurs, cours, coursClasses, modules, lecons, type Role } from "@shared/schema";

if (process.env.NODE_ENV === "production") {
  console.error("Refusé : script de test, jamais en production.");
  process.exit(1);
}

async function principal() {
  const existants = await db.select().from(sites);
  if (!existants.length) await db.insert(sites).values(SITES_2IAE);
  const tousSites = await db.select().from(sites).orderBy(sites.ordre);
  const site = (slug: string) => tousSites.find((s) => s.slug === slug)!;
  await db.update(sites).set({ whatsappVieScolaire: "2250747726729" }).where(eq(sites.slug, "yopougon"));

  let listeClasses = await db.select().from(classes);
  if (!listeClasses.length) {
    listeClasses = await db
      .insert(classes)
      .values(
        tousSites.map((s) => ({
          nom: `BTS Gestion commerciale · 1re année · ${s.nomCourt}`,
          siteId: s.id,
          filiere: "Gestion commerciale",
          niveau: "BTS 1",
          anneeScolaire: "2026-2027",
        })),
      )
      .returning();
  }
  const classeDe = (slug: string) => listeClasses.find((c) => c.siteId === site(slug).id)!;

  const comptes: {
    role: Role;
    prenom: string;
    nom: string;
    email?: string;
    matricule?: string;
    telephone?: string;
    code: string;
    site?: string;
    provisoire?: boolean;
    formateur?: boolean;
  }[] = [
    { role: "admin", prenom: "Direction", nom: "2IAE", email: "direction@2iae.com", code: "Direction-2026" },
    { role: "vie_scolaire", prenom: "Mariam", nom: "Konaté", email: "vs.yopougon@2iae.com", code: "VieScolaire-2026", site: "yopougon" },
    { role: "formateur", prenom: "Karim", nom: "Diallo", email: "k.diallo@2iae.com", code: "Formateur-2026", formateur: true },
    { role: "etudiant", prenom: "Aya", nom: "Koné", matricule: "24GC0001", telephone: "0707123456", code: "482913", site: "yopougon" },
    { role: "etudiant", prenom: "Koffi", nom: "Brou", matricule: "24GC0002", telephone: "0505987654", code: "482913", site: "azaguie" },
    { role: "etudiant", prenom: "Mariam", nom: "Traoré", matricule: "24GC0003", code: "482913", site: "mbatto" },
    { role: "etudiant", prenom: "Awa", nom: "Nouveau", matricule: "24GC0099", code: "739251", site: "yopougon", provisoire: true },
    { role: "salle", prenom: "Salle", nom: "Kédjénou", email: "salle.yopougon@2iae.com", code: "Salle-Yopougon-2026", site: "yopougon" },
  ];

  for (const c of comptes) {
    const [deja] = c.matricule
      ? await db.select().from(utilisateurs).where(eq(utilisateurs.matricule, c.matricule))
      : await db.select().from(utilisateurs).where(eq(utilisateurs.email, c.email!));
    if (deja) continue;
    await db.insert(utilisateurs).values({
      role: c.role,
      prenom: c.prenom,
      nom: c.nom,
      email: c.email ?? null,
      matricule: c.matricule ?? null,
      telephone: c.telephone ?? null,
      motDePasseHash: await hacher(c.code),
      doitChangerMotDePasse: Boolean(c.provisoire),
      motDePasseExpireLe: c.provisoire ? new Date(Date.now() + 30 * 86_400_000) : null,
      siteId: c.site ? site(c.site).id : null,
      classeId: c.role === "etudiant" && c.site ? classeDe(c.site).id : null,
      charteAccepteeLe: c.provisoire ? null : new Date(),
      preferences: c.provisoire ? {} : { visiteFaite: true },
      ...(c.formateur
        ? {
            slug: "karim-diallo",
            titre: "Consultant en intelligence artificielle",
            localisation: "Lyon, France",
            bio: "Ingénieur et consultant, Karim Diallo accompagne des PME d'Afrique de l'Ouest dans l'usage concret de l'intelligence artificielle.",
            consentementSite: true,
          }
        : {}),
    });
  }

  const [formateur] = await db.select().from(utilisateurs).where(eq(utilisateurs.email, "k.diallo@2iae.com"));
  const [dejaCours] = await db.select().from(cours).where(eq(cours.code, "IA-101"));
  if (!dejaCours) {
    const mardi = new Date();
    mardi.setUTCDate(mardi.getUTCDate() + ((9 - mardi.getUTCDay()) % 7 || 7));
    mardi.setUTCHours(10, 0, 0, 0);
    const [c] = await db
      .insert(cours)
      .values({
        code: "IA-101",
        slug: "initiation-intelligence-artificielle",
        titre: "Initiation à l'intelligence artificielle",
        description: "Comprendre ce qu'est l'IA, ce qu'elle sait faire et ne pas faire, et l'utiliser dès demain dans une entreprise ivoirienne.",
        objectifs: "Expliquer ce qu'est un modèle de langage\nRédiger une consigne efficace\nVérifier une réponse de l'IA",
        formateurId: formateur.id,
        statut: "publie",
        dateDebut: mardi,
        couleur: "#E4793A",
      })
      .returning();
    await db.insert(coursClasses).values(listeClasses.map((cl) => ({ coursId: c.id, classeId: cl.id })));
    const [m] = await db.insert(modules).values({ coursId: c.id, titre: "Découvrir l'IA", ordre: 1 }).returning();
    await db.insert(lecons).values([
      {
        moduleId: m.id,
        coursId: c.id,
        titre: "Qu'est-ce que l'intelligence artificielle ?",
        ordre: 1,
        dureeMinutes: 10,
        contenu:
          "## Une définition simple\n\nL'**intelligence artificielle** désigne des programmes qui apprennent à partir d'exemples plutôt que de suivre des règles écrites à la main.\n\n- Un tableur applique des formules.\n- Un modèle d'IA a *appris* à partir de millions de textes.\n\n> Exemple : prévoir les ventes d'un maquis selon le jour et la météo.",
      },
      {
        moduleId: m.id,
        coursId: c.id,
        titre: "Les modèles de langage",
        ordre: 2,
        dureeMinutes: 15,
        contenu:
          "## Comment ça marche ?\n\nUn modèle de langage prédit la suite la plus probable d'un texte.\n\n1. Il lit la question.\n2. Il propose une réponse mot après mot.\n3. Il peut se tromper : **vérifie toujours** les chiffres.",
      },
    ]);
  }
  console.log("✓ Comptes et données de test prêts.");
}

principal()
  .then(() => pool.end())
  .catch(async (e) => {
    console.error(e);
    await pool.end();
    process.exit(1);
  });
