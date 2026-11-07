// Devoirs en groupe, groupes formés par les étudiants (novembre 2026). Feuille sans import de server/routes/* :
// lecture des groupes d'un devoir, groupe d'un étudiant, créer / rejoindre / quitter, discussion du groupe.
//
// Règles :
//   - seul un dépôt (devoirs.type = "depot") coché « Devoir en groupe », et jamais un devoir donné en direct (ses
//     groupes sont ceux du live, server/devoirs-direct.ts) ;
//   - un étudiant est dans un seul groupe par devoir (index unique devoir, étudiant), de n'importe quel campus,
//     pourvu qu'il suive le cours ;
//   - créer, rejoindre, quitter : avant la date limite, et tant que le groupe n'a pas rendu de copie ;
//   - la copie rendue par un membre est écrite pour chaque membre (rendus.pour_groupe, source « devoir ») ;
//   - la discussion du groupe est une conversation de type « groupe » : ses participants sont les membres actuels
//     (ajoutés en entrant, retirés en sortant) ; un groupe vidé disparaît avec sa discussion.
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { inscritsParmi } from "./acces";
import { ErreurHttp } from "./http";
import { publierUtilisateur } from "./temps-reel";
import { echeance } from "./evaluations-outils";
import { devoirDirectDe, enSerieGroupe, DelaiGroupeDepasse } from "./devoirs-direct";
import { t } from "@shared/textes/devoirs-groupe";
import {
  conversations,
  groupesDevoir,
  journal,
  membresGroupeDevoir,
  participants,
  rendus,
  sites,
  utilisateurs,
  type Devoir,
  type GroupeDevoir,
  type GroupesDuDevoirEtudiant,
  type Utilisateur,
} from "@shared/schema";

const refus = (cle: Parameters<typeof t>[0], statut = 409, v?: Record<string, string | number>) => new ErreurHttp(statut, t(cle, { registre: "tu", v }));

/** Clé de la file d'un groupe de devoir (distincte de celle des groupes du live : « d » devant l'identifiant). */
export const cleFileGroupeDevoir = (devoirId: number, groupeId: number) => `${devoirId}:d${groupeId}`;

/** Le devoir se fait en groupes formés par les étudiants. */
export async function estDevoirEnGroupe(d: Pick<Devoir, "id" | "type" | "enGroupe">): Promise<boolean> {
  if (d.type !== "depot" || !d.enGroupe) return false;
  return !(await devoirDirectDe(d.id));
}

/** Les groupes peuvent encore changer : avant la date limite (« avant 23h59 » compris). */
export const groupesModifiables = (d: Pick<Devoir, "dateLimite">, maintenant = new Date()) => maintenant.getTime() <= echeance(d).getTime();

/** Groupes du devoir qui ont une copie rendue (non brouillon) pour eux. */
export async function groupesRendus(devoirId: number): Promise<Set<number>> {
  const { rows } = await db.execute<{ g: string }>(sql`
    SELECT DISTINCT pour_groupe->>'groupeId' AS g FROM campus.rendus
    WHERE devoir_id = ${devoirId} AND statut <> 'brouillon' AND pour_groupe->>'source' = 'devoir'`);
  return new Set(rows.map((r) => Number(r.g)));
}

export async function groupeARendu(devoirId: number, groupeId: number): Promise<boolean> {
  const { rows } = await db.execute<{ x: number }>(sql`
    SELECT 1 AS x FROM campus.rendus
    WHERE devoir_id = ${devoirId} AND statut <> 'brouillon' AND pour_groupe->>'source' = 'devoir'
      AND pour_groupe->>'groupeId' = ${String(groupeId)} LIMIT 1`);
  return rows.length > 0;
}

/** Le groupe de cet étudiant pour ce devoir, ou null. */
export async function groupeDeLEtudiant(devoirId: number, etudiantId: number): Promise<GroupeDevoir | null> {
  const [l] = await db
    .select({ g: groupesDevoir })
    .from(membresGroupeDevoir)
    .innerJoin(groupesDevoir, eq(groupesDevoir.id, membresGroupeDevoir.groupeId))
    .where(and(eq(membresGroupeDevoir.devoirId, devoirId), eq(membresGroupeDevoir.etudiantId, etudiantId)));
  return l?.g ?? null;
}

/**
 * Le groupe de l'étudiant et ses membres qui recevront la copie : étudiants actifs, toujours inscrits au cours,
 * triés par identifiant. Null : devoir pas en groupe, ou étudiant sans groupe.
 */
export async function situationGroupeDevoir(d: Pick<Devoir, "id" | "coursId" | "type" | "enGroupe">, etudiantId: number) {
  if (!(await estDevoirEnGroupe(d))) return null;
  const groupe = await groupeDeLEtudiant(d.id, etudiantId);
  if (!groupe) return null;
  const personnes = await db
    .select({ u: utilisateurs })
    .from(membresGroupeDevoir)
    .innerJoin(utilisateurs, eq(utilisateurs.id, membresGroupeDevoir.etudiantId))
    .where(eq(membresGroupeDevoir.groupeId, groupe.id));
  const inscrits = await inscritsParmi(d.coursId, personnes.map((p) => p.u.id));
  const membres = personnes
    .map((p) => p.u)
    .filter((u) => u.role === "etudiant" && u.actif && inscrits.has(u.id))
    .sort((a, b) => a.id - b.id);
  return { groupe, membres };
}

/** Les groupes du devoir, vus par un étudiant inscrit (noms et campus des membres, jamais le matricule). */
export async function groupesPourEtudiant(u: Pick<Utilisateur, "id">, d: Devoir, maintenant = new Date()): Promise<GroupesDuDevoirEtudiant> {
  const groupes = await db.select().from(groupesDevoir).where(eq(groupesDevoir.devoirId, d.id)).orderBy(asc(groupesDevoir.creeLe), asc(groupesDevoir.id));
  const membres = groupes.length
    ? await db
        .select({ groupeId: membresGroupeDevoir.groupeId, id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom, site: sites.nomCourt })
        .from(membresGroupeDevoir)
        .innerJoin(utilisateurs, eq(utilisateurs.id, membresGroupeDevoir.etudiantId))
        .leftJoin(sites, eq(sites.id, utilisateurs.siteId))
        .where(eq(membresGroupeDevoir.devoirId, d.id))
        .orderBy(asc(membresGroupeDevoir.rejointLe))
    : [];
  const rendus = await groupesRendus(d.id);
  const monGroupeId = membres.find((m) => m.id === u.id)?.groupeId ?? null;
  return {
    tailleMax: d.tailleGroupeMax,
    monGroupeId,
    modifiable: groupesModifiables(d, maintenant),
    groupes: groupes.map((g) => {
      const liste = membres.filter((m) => m.groupeId === g.id);
      const monGroupe = g.id === monGroupeId;
      return {
        id: g.id,
        nom: g.nom,
        membres: liste.map((m) => ({ id: m.id, prenom: m.prenom, nom: m.nom, site: m.site ?? null, moi: m.id === u.id })),
        complet: liste.length >= d.tailleGroupeMax,
        rendu: rendus.has(g.id),
        monGroupe,
        conversationId: monGroupe ? g.conversationId : null,
      };
    }),
  };
}

/** Prévient les membres (et l'étudiant concerné) que les groupes du devoir ont changé : leur page se recharge. */
async function signalerChangement(devoirId: number, ids: number[]) {
  for (const id of new Set(ids)) publierUtilisateur(id, "devoir-groupe", { devoirId });
}

async function idsMembres(groupeId: number): Promise<number[]> {
  return (await db.select({ id: membresGroupeDevoir.etudiantId }).from(membresGroupeDevoir).where(eq(membresGroupeDevoir.groupeId, groupeId))).map((m) => m.id);
}

/** Créer, rejoindre, quitter : refusé si le devoir n'est pas en groupe ou si la date limite est passée. */
async function exigerModifiable(d: Devoir) {
  if (!(await estDevoirEnGroupe(d))) throw refus("erreur.pasEnGroupe", 400);
  if (!groupesModifiables(d)) throw refus("erreur.ferme");
}

/** Erreur d'unicité de la base (un étudiant entré dans deux groupes en même temps). */
const doublon = (e: unknown) => (e as { code?: string; cause?: { code?: string } } | null)?.code === "23505" || (e as { cause?: { code?: string } } | null)?.cause?.code === "23505";

/** Les opérations d'un groupe passent l'une après l'autre (même file que la copie du groupe). */
async function dansLaFile<T>(cle: string, travail: () => Promise<T>): Promise<T> {
  try {
    return await enSerieGroupe(cle, travail);
  } catch (e) {
    if (e instanceof DelaiGroupeDepasse) throw refus("erreur.occupe", 503);
    throw e;
  }
}

/** « Créer un groupe » : l'étudiant en est le premier membre ; la discussion du groupe naît avec lui. */
export async function creerGroupe(u: Utilisateur, d: Devoir, nomDemande: string | null | undefined): Promise<GroupeDevoir> {
  await exigerModifiable(d);
  if (await groupeDeLEtudiant(d.id, u.id)) throw refus("erreur.dejaGroupe");
  const nom = (nomDemande ?? "").trim().slice(0, 60) || t("creer.nom.defaut", { v: { prenom: u.prenom.trim() } });
  let groupe: GroupeDevoir;
  try {
    groupe = await db.transaction(async (tx) => {
      const [g] = await tx.insert(groupesDevoir).values({ devoirId: d.id, nom, creeParId: u.id }).returning();
      await tx.insert(membresGroupeDevoir).values({ groupeId: g.id, devoirId: d.id, etudiantId: u.id });
      const [c] = await tx
        .insert(conversations)
        .values({ type: "groupe", coursId: d.coursId, titre: `${nom} · ${d.titre}`.slice(0, 200), cleUnique: `groupe-devoir:${g.id}` })
        .returning({ id: conversations.id });
      await tx.insert(participants).values({ conversationId: c.id, utilisateurId: u.id, luJusquA: new Date() });
      const [maj] = await tx.update(groupesDevoir).set({ conversationId: c.id }).where(eq(groupesDevoir.id, g.id)).returning();
      return maj;
    });
  } catch (e) {
    if (doublon(e)) throw refus("erreur.dejaGroupe");
    throw e;
  }
  await db.insert(journal).values({ utilisateurId: u.id, action: "groupe_devoir_cree", details: { devoirId: d.id, groupeId: groupe.id, nom } });
  await signalerChangement(d.id, [u.id]);
  return groupe;
}

/** « Rejoindre » : groupe du même devoir, pas complet, sans copie rendue ; l'étudiant n'a pas d'autre groupe. */
export async function rejoindreGroupe(u: Utilisateur, d: Devoir, groupeId: number): Promise<void> {
  await exigerModifiable(d);
  await dansLaFile(cleFileGroupeDevoir(d.id, groupeId), async () => {
    const [g] = await db.select().from(groupesDevoir).where(and(eq(groupesDevoir.id, groupeId), eq(groupesDevoir.devoirId, d.id)));
    if (!g) throw refus("erreur.introuvable", 404);
    const actuel = await groupeDeLEtudiant(d.id, u.id);
    if (actuel?.id === g.id) return;
    if (actuel) throw refus("erreur.dejaGroupe");
    if (await groupeARendu(d.id, g.id)) throw refus("erreur.groupeRendu");
    try {
      await db.transaction(async (tx) => {
        // Le groupe est verrouillé le temps de compter ses membres : deux arrivées simultanées ne le font pas déborder.
        await tx.execute(sql`SELECT id FROM campus.groupes_devoir WHERE id = ${g.id} FOR UPDATE`);
        const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(membresGroupeDevoir).where(eq(membresGroupeDevoir.groupeId, g.id));
        if (n >= d.tailleGroupeMax) throw refus("erreur.complet", 409, { max: d.tailleGroupeMax });
        await tx.insert(membresGroupeDevoir).values({ groupeId: g.id, devoirId: d.id, etudiantId: u.id });
        // Discussion : il y entre, sans 50 « non lus » d'avant son arrivée.
        if (g.conversationId) {
          await tx.insert(participants).values({ conversationId: g.conversationId, utilisateurId: u.id, luJusquA: new Date() }).onConflictDoNothing();
        }
      });
    } catch (e) {
      if (doublon(e)) throw refus("erreur.dejaGroupe");
      throw e;
    }
    await db.insert(journal).values({ utilisateurId: u.id, action: "groupe_devoir_rejoint", details: { devoirId: d.id, groupeId: g.id } });
    await signalerChangement(d.id, [u.id, ...(await idsMembres(g.id))]);
  });
}

/** « Quitter » : avant que le groupe ait rendu. Le dernier qui part emporte le groupe et sa discussion. */
export async function quitterGroupe(u: Utilisateur, d: Devoir): Promise<void> {
  await exigerModifiable(d);
  const g = await groupeDeLEtudiant(d.id, u.id);
  if (!g) throw refus("erreur.sansGroupe");
  await dansLaFile(cleFileGroupeDevoir(d.id, g.id), async () => {
    if (await groupeARendu(d.id, g.id)) throw refus("erreur.groupeRendu");
    const restants = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM campus.groupes_devoir WHERE id = ${g.id} FOR UPDATE`);
      await tx.delete(membresGroupeDevoir).where(and(eq(membresGroupeDevoir.groupeId, g.id), eq(membresGroupeDevoir.etudiantId, u.id)));
      if (g.conversationId) await tx.delete(participants).where(and(eq(participants.conversationId, g.conversationId), eq(participants.utilisateurId, u.id)));
      const reste = await tx.select({ id: membresGroupeDevoir.etudiantId }).from(membresGroupeDevoir).where(eq(membresGroupeDevoir.groupeId, g.id));
      if (!reste.length) {
        await tx.delete(groupesDevoir).where(eq(groupesDevoir.id, g.id));
        if (g.conversationId) await tx.delete(conversations).where(eq(conversations.id, g.conversationId));
      }
      return reste.map((r) => r.id);
    });
    await db.insert(journal).values({ utilisateurId: u.id, action: "groupe_devoir_quitte", details: { devoirId: d.id, groupeId: g.id, supprime: !restants.length } });
    await signalerChangement(d.id, [u.id, ...restants]);
  });
}

/**
 * Pour la liste des copies du formateur : membres de chaque groupe du devoir (prénom, nom, campus), par groupe.
 * Les copies d'un même groupe s'y regroupent en une ligne.
 */
export async function membresParGroupe(devoirId: number, groupeIds: number[]): Promise<Map<number, { id: number; nom: string; site: string | null }[]>> {
  const carte = new Map<number, { id: number; nom: string; site: string | null }[]>();
  if (!groupeIds.length) return carte;
  const lignes = await db
    .select({ groupeId: membresGroupeDevoir.groupeId, id: utilisateurs.id, prenom: utilisateurs.prenom, nom: utilisateurs.nom, site: sites.nomCourt })
    .from(membresGroupeDevoir)
    .innerJoin(utilisateurs, eq(utilisateurs.id, membresGroupeDevoir.etudiantId))
    .leftJoin(sites, eq(sites.id, utilisateurs.siteId))
    .where(and(eq(membresGroupeDevoir.devoirId, devoirId), inArray(membresGroupeDevoir.groupeId, groupeIds)))
    .orderBy(asc(membresGroupeDevoir.rejointLe));
  for (const l of lignes) carte.set(l.groupeId, [...(carte.get(l.groupeId) ?? []), { id: l.id, nom: `${l.prenom} ${l.nom}`, site: l.site ?? null }]);
  return carte;
}

/**
 * Copies du même groupe de devoir que cette copie, portant la même réponse (même groupe, même heure de remise) :
 * la correction du formateur (note, commentaires, vocal, proposition de l'IA, ✓✓) vaut pour chacune.
 */
export async function copiesDuMemeGroupe(r: { id: number; devoirId: number; pourGroupe: unknown; renduLe: Date | null }) {
  const pg = r.pourGroupe as { source?: string; groupeId?: number } | null;
  if (!pg || pg.source !== "devoir" || !r.renduLe) return [];
  return db
    .select()
    .from(rendus)
    .where(
      and(
        eq(rendus.devoirId, r.devoirId),
        ne(rendus.id, r.id),
        ne(rendus.statut, "brouillon"),
        sql`${rendus.pourGroupe}->>'source' = 'devoir'`,
        sql`${rendus.pourGroupe}->>'groupeId' = ${String(pg.groupeId)}`,
        sql`date_trunc('milliseconds', ${rendus.renduLe}) = ${r.renduLe}`,
      ),
    );
}
