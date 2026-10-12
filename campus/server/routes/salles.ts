// Salles de conférence d'un campus (shared/salles.ts, décision de José du 12 octobre 2026) :
// les salles de chaque campus (nom, public L1/L2, écran), leur ajout et leur réglage, puis la
// page « Les salles du jour » : pour chaque campus, les cours de chaque salle et le lien de son
// écran, dans un message prêt à envoyer sur WhatsApp à la vie scolaire du campus.
// Droits : ceux de l'installation des écrans (outils_campus), dans le périmètre de la personne.
// Les réponses qui portent un lien d'écran ne sont jamais mises en cache ; aucun lien au journal.
import type { Express, Request } from "express";
import { z } from "zod";
import { and, asc, eq, gte, inArray, isNull, lt, ne } from "drizzle-orm";
import { db, pool } from "../db";
import { exigerDroit, moi, perimetreSites, hacher, motDePasseProvisoire, jetonAleatoire, oublierUtilisateur, fermerAutresSessions } from "../auth";
import { route, valider, idParam, introuvable, invalide, ErreurHttp } from "../http";
import { publierUtilisateur } from "../temps-reel";
import { intervenantsDesSeances, libelleDate } from "../programme-outils";
import { sallePasEncoreNommee } from "../amorcage";
import { compteEcranSalle, coursDuSite, publicDe, sallesDuSite } from "../salles-outils";
import { assurerCompteSalle1, installationEnPlace } from "./lancement";
import { journaliser, lienWhatsApp, numeroWhatsApp } from "./admin";
import { cours, directsImmediats, reinitialisations, seances, sites, utilisateurs, type Utilisateur } from "@shared/schema";
import {
  PUBLICS_SALLE,
  etiquetteSalle,
  nomDeSalle,
  nomSalleParDefaut,
  type CampusDuJour,
  type SalleCampus,
  type SalleDuJour,
  type SallesDuJour,
  type SallesDuSite,
  type SeanceDeSalle,
} from "@shared/salles";
import { t } from "@shared/textes/salles";

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

/** L'écran d'une salle relit son compte (nom, public) et ses cours aussitôt (PageSalle écoute « salle »). */
function prevenirEcran(compteId: number) {
  oublierUtilisateur(compteId);
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

/** Message WhatsApp d'un campus : une ligne par salle (ses cours), puis le lien de son écran. */
function messageCampus(s: Site, libelle: string, salles: (SalleDuJour & { code: string | null; adresse: string | null })[]): string {
  const lignes = [t("message.entete", { v: { campus: s.nomCourt, date: libelle } })];
  for (const salle of salles) {
    lignes.push("");
    const nom = [salle.public, salle.nom].filter(Boolean).join(" · ");
    const seances = salle.seances.map((x) =>
      x.intervenant
        ? t("message.seance", { v: { heures: x.heures, cours: x.cours, intervenant: x.intervenant } })
        : t("message.seance.sansIntervenant", { v: { heures: x.heures, cours: x.cours } }),
    );
    // Une salle sans cours ce jour-là : une ligne, sans lien (rien à afficher sur son écran).
    if (!seances.length) {
      lignes.push(t("message.aucun", { v: { salle: nom } }));
      continue;
    }
    if (seances.length === 1) lignes.push(t("message.salle", { v: { salle: nom, seance: seances[0] } }));
    else lignes.push(t("message.salle.plusieurs", { v: { salle: nom } }), ...seances);
    if (salle.lien) {
      lignes.push(t("message.ecran", { v: { lien: salle.lien } }));
      if (salle.code && salle.adresse) lignes.push(t("message.code", { v: { adresse: salle.adresse, code: `${salle.code.slice(0, 4)} ${salle.code.slice(4)}` } }));
    } else lignes.push(t("message.ecranAInstaller"));
  }
  return lignes.join("\n");
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
        prevenirEcran(premiere.id);
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
        prevenirEcran(compte.id);
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
      const debutJour = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
      if (jour === "demain") debutJour.setUTCDate(debutJour.getUTCDate() + 1);
      const finJour = new Date(debutJour.getTime() + 86_400_000);
      const date = debutJour.toISOString().slice(0, 10);
      const libelle = libelleDate(date);

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
      const versSeance = (l: (typeof duJour)[number]): SeanceDeSalle => {
        const fin = new Date(l.s.debut.getTime() + l.s.dureeMinutes * 60_000);
        return {
          id: l.s.id,
          debut: l.s.debut.toISOString(),
          fin: fin.toISOString(),
          heures: `${heureCourte(l.s.debut)}-${heureCourte(fin)}`,
          cours: l.titreCours || l.s.titre,
          intervenant: intervenants.get(l.s.id)?.nom ?? (l.formateurId ? (formateurs.get(l.formateurId) ?? null) : null),
          statut: l.s.statut,
        };
      };

      const campus: CampusDuJour[] = [];
      for (const s of await sitesDuPerimetre(req)) {
        const salles = await sallesDuSite(s.id);
        const avecLiens: (SalleDuJour & { code: string | null; adresse: string | null })[] = [];
        for (const { numero, compte } of salles) {
          const pub = publicDe(compte);
          const montres = new Set(await coursDuSite(s.id, pub));
          const inst = compte ? await installationEnPlace(s, compte) : null;
          const nom = nomDeSalle(compte, s);
          avecLiens.push({
            numero,
            nom,
            public: pub,
            etiquette: etiquetteSalle(s.nomCourt, pub, nom),
            ecranInstalle: Boolean(compte && !compte.doitChangerMotDePasse),
            lien: inst?.lien ?? null,
            seances: duJour.filter((l) => montres.has(l.s.coursId)).map(versSeance),
            code: inst?.code ?? null,
            adresse: inst?.adresseCourte ?? null,
          });
        }
        const message = messageCampus(s, libelle, avecLiens);
        campus.push({
          siteId: s.id,
          campus: s.nomCourt,
          whatsapp: numeroWhatsApp(s.whatsappVieScolaire),
          salles: avecLiens.map(({ code: _c, adresse: _a, ...x }) => x),
          message,
          lienWhatsApp: lienWhatsApp(s.whatsappVieScolaire, message),
          publicsAChoisir: salles.length > 1 && salles.some((x) => !publicDe(x.compte)),
        });
      }
      const r: SallesDuJour = { date, libelle, jour, campus };
      res.json(r);
    }),
  );
}
