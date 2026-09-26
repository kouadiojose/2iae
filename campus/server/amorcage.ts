// Données indispensables au démarrage : les cinq campus du groupe et le
// compte de la direction. Idempotent : ne crée que ce qui manque et ne
// corrige que des valeurs par défaut connues (jamais une saisie de l'école).
import { and, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { config } from "./config";
import { hacher, motDePasseProvisoire } from "./auth";
import { sites, utilisateurs } from "@shared/schema";

/** Nom affiché tant que la direction n'a pas saisi le vrai nom de la salle (Pilotage → Classes et campus). */
export const SALLE_PAR_DEFAUT = "Salle de conférence";

/**
 * Noms de salles inventés pour la démonstration : ils ne correspondent à
 * aucune salle réelle. Encore en base au démarrage, ils redeviennent
 * « Salle de conférence ».
 */
export const SALLES_INVENTEES = ["Salle Palmeraie", "Salle Kédjénou", "Salle Baoulé", "Salle Agro-pastorale", "Salle Akwaba"] as const;

/** Numéro WhatsApp officiel du groupe (2iae.com) : donné aux campus créés, en attendant celui de leur vie scolaire. */
export const WHATSAPP_GROUPE = "2250747726729";

/** Les cinq campus, dans l'ordre officiel du groupe (www.2iae.com). */
export const SITES_2IAE = [
  { slug: "riviera", nom: "Abidjan · Riviera Palmeraie", nomCourt: "Riviera", ville: "Abidjan", salleConference: SALLE_PAR_DEFAUT, ordre: 1 },
  { slug: "yopougon", nom: "Abidjan · Yopougon", nomCourt: "Yopougon", ville: "Abidjan", salleConference: SALLE_PAR_DEFAUT, ordre: 2 },
  { slug: "yamoussoukro", nom: "Yamoussoukro", nomCourt: "Yamoussoukro", ville: "Yamoussoukro", salleConference: SALLE_PAR_DEFAUT, ordre: 3 },
  { slug: "azaguie", nom: "Azaguié Ahoua · Université de l'Entrepreneuriat", nomCourt: "Azaguié", ville: "Azaguié", salleConference: SALLE_PAR_DEFAUT, ordre: 4 },
  { slug: "mbatto", nom: "M'Batto", nomCourt: "M'Batto", ville: "M'Batto", salleConference: SALLE_PAR_DEFAUT, ordre: 5 },
];

/** Anciens noms par défaut, remplacés par les vrais seulement s'ils n'ont pas été modifiés depuis. */
const ANCIENS_NOMS: Record<string, string> = {
  azaguie: "Azaguié · Université de l'Entrepreneuriat",
};

/** Le nom de salle est-il encore un nom provisoire (par défaut ou inventé) ? */
export const sallePasEncoreNommee = (nom: string | null | undefined) =>
  !nom?.trim() || nom.trim() === SALLE_PAR_DEFAUT || (SALLES_INVENTEES as readonly string[]).includes(nom.trim());

export async function amorcer(): Promise<void> {
  // 1. Les cinq campus : ceux qui manquent sont créés.
  const existants = await db.select({ slug: sites.slug }).from(sites);
  const manquants = SITES_2IAE.filter((s) => !existants.some((e) => e.slug === s.slug));
  if (manquants.length) {
    await db.insert(sites).values(manquants.map((s) => ({ ...s, whatsappVieScolaire: WHATSAPP_GROUPE })));
    console.log(manquants.length === SITES_2IAE.length ? "✓ Les cinq campus 2IAE ont été créés." : `✓ Campus ajouté(s) : ${manquants.map((s) => s.nomCourt).join(", ")}.`);
  }

  // 2. Noms de salles inventés pour la démonstration → « Salle de conférence ».
  const salles = await db
    .update(sites)
    .set({ salleConference: SALLE_PAR_DEFAUT })
    .where(inArray(sites.salleConference, [...SALLES_INVENTEES]))
    .returning({ nomCourt: sites.nomCourt });
  if (salles.length) {
    console.log(`✓ Noms de salles de démonstration retirés (${salles.map((s) => s.nomCourt).join(", ")}) : « ${SALLE_PAR_DEFAUT} » en attendant le vrai nom.`);
  }

  // 3. Vrais noms des campus, là où l'ancien nom par défaut n'a pas été retouché.
  for (const [slug, ancien] of Object.entries(ANCIENS_NOMS)) {
    const vrai = SITES_2IAE.find((s) => s.slug === slug)!.nom;
    const maj = await db.update(sites).set({ nom: vrai }).where(and(eq(sites.slug, slug), eq(sites.nom, ancien))).returning({ id: sites.id });
    if (maj.length) console.log(`✓ Nom du campus mis à jour : ${vrai}.`);
  }

  // 4. Le compte de la direction.
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
