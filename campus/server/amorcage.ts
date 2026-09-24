// Données indispensables au premier démarrage : les cinq sites du groupe et
// le compte de la direction. Idempotent : ne touche à rien d'existant.
import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { config } from "./config";
import { hacher, motDePasseProvisoire } from "./auth";
import { sites, utilisateurs } from "@shared/schema";

export const SITES_2IAE = [
  { slug: "riviera", nom: "Abidjan · Riviera Palmeraie", nomCourt: "Riviera", ville: "Abidjan", salleConference: "Salle Palmeraie", ordre: 1 },
  { slug: "yopougon", nom: "Abidjan · Yopougon", nomCourt: "Yopougon", ville: "Abidjan", salleConference: "Salle Kédjénou", ordre: 2 },
  { slug: "yamoussoukro", nom: "Yamoussoukro", nomCourt: "Yamoussoukro", ville: "Yamoussoukro", salleConference: "Salle Baoulé", ordre: 3 },
  { slug: "azaguie", nom: "Azaguié · Université de l'Entrepreneuriat", nomCourt: "Azaguié", ville: "Azaguié", salleConference: "Salle Agro-pastorale", ordre: 4 },
  { slug: "mbatto", nom: "M'Batto", nomCourt: "M'Batto", ville: "M'Batto", salleConference: "Salle Akwaba", ordre: 5 },
];

export async function amorcer(): Promise<void> {
  const [{ n: nbSites }] = await db.select({ n: sql<number>`count(*)::int` }).from(sites);
  if (nbSites === 0) {
    await db.insert(sites).values(SITES_2IAE);
    console.log("✓ Les cinq sites 2IAE ont été créés.");
  }

  const [admin] = await db.select({ id: utilisateurs.id }).from(utilisateurs).where(eq(utilisateurs.role, "admin")).limit(1);
  if (!admin) {
    const motDePasse = config.admin.motDePasse || motDePasseProvisoire();
    await db.insert(utilisateurs).values({
      role: "admin",
      prenom: config.admin.prenom,
      nom: config.admin.nom,
      email: config.admin.identifiant.toLowerCase(),
      motDePasseHash: await hacher(motDePasse),
      doitChangerMotDePasse: !config.admin.motDePasse,
    });
    console.log(`✓ Compte de la direction créé : ${config.admin.identifiant}`);
    if (!config.admin.motDePasse) console.log(`  Mot de passe provisoire : ${motDePasse} (à changer à la première connexion)`);
  }
}
