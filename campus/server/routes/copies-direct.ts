// Devoirs et copies dans le Studio, et copie montrée à toute la classe pendant le direct (projection-copies.ts).
//
//   - listes et aperçus : réservés à qui anime la séance ET lit les copies (formateur du cours ou co-formateur,
//     direction, vie scolaire avec « programme » et « notes », limitée à son site) ; jamais de note, de
//     commentaire ni de matricule ; ✓✓ jamais posé (GET /api/rendus/:id n'est pas appelé) ;
//   - projection : une page à la fois, seulement en direct (hors Plan B), après confirmation si des étudiants
//     peuvent encore rendre ce devoir ; trace au journal (« copie_montree ») et dans le fil de la séance ;
//   - image projetée : lue par ceux qui voient la séance (salles, inscrits, formateurs, équipe), à une adresse
//     à clé aléatoire valable tant que la page est à l'écran (410 ensuite).
// Toutes les réponses partent en « no-store » : rien ne reste dans un cache, même sur un poste partagé.
import type { Express, Response } from "express";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { exigerConnexion, exigerDroitDe, moi } from "../auth";
import { route, valider, idParam, introuvable, interdit, invalide, ErreurHttp } from "../http";
import { publier } from "../temps-reel";
import { etudiantsDuCours, seanceVisible } from "../acces";
import { genreDe } from "../copies-pages";
import { echeance, peutEncoreRendre } from "../evaluations-outils";
import { seanceAnimee } from "./live";
import { inscritsVisibles, renduEnseigne } from "./evaluations";
import {
  CLE_PAGE,
  contenuDePage,
  contenuProjete,
  copieDe,
  copiesAPublier,
  corrigeDuDevoir,
  corrigeMontrableEnClasse,
  devoirsPubliesDuCours,
  copiesDesDevoirs,
  ecrireSiInchangee,
  enSerie,
  etiquetteCopie,
  generationDe,
  nouvelleCle,
  pageDuPlan,
  planDeCopie,
  planDuCorrige,
  prechauffer,
  retenirContenu,
  sourceDeCopie,
  type ContenuPage,
  type SourcePages,
} from "../projection-copies";
import { t } from "@shared/textes/copies-direct";
import {
  cours,
  devoirs,
  evenementsSeances,
  fichiers,
  journal,
  rendus,
  sites,
  estProjectionCopie,
  ZONES_COPIE,
  type CopieDuDirectDto,
  type CorrigeDuDirectDto,
  type Devoir,
  type DevoirDuDirectDto,
  type ListeCopiesDuDirectDto,
  type ListeDevoirsDuDirectDto,
  type PlanCopieDto,
  type PlanCorrigeDto,
  type ProjectionCopie,
  type ProjectionCopieAnimateurDto,
  type Rendu,
  type Seance,
  type Utilisateur,
} from "@shared/schema";

/** Fabrication d'une page avant de la montrer : au-delà, la classe ne voit rien changer (422). */
const DELAI_FABRICATION_MS = 30_000;

const sansCache = (res: Response) => res.setHeader("Cache-Control", "no-store");

/** Formateur du cours ou co-formateur, direction, vie scolaire qui anime ce cours (programme) et lit les copies (notes). */
async function animateurCopies(u: Utilisateur, seanceId: number): Promise<Seance> {
  if (u.role !== "formateur" && u.role !== "admin" && u.role !== "vie_scolaire") throw interdit(t("erreur.droits"));
  if (u.role === "vie_scolaire") exigerDroitDe(u, "notes");
  try {
    return await seanceAnimee(u, seanceId); // programme pour la vie scolaire, puis coursEnseigne
  } catch (e) {
    if (e instanceof ErreurHttp && e.statut === 403) throw interdit(t("erreur.droits"));
    throw e;
  }
}

function exigerStatut(s: Seance, statuts: Seance["statut"][], message: string) {
  if (!statuts.includes(s.statut)) throw new ErreurHttp(409, message);
}

/** En direct, hors Plan B : la seule situation où la classe voit une copie. */
function exigerDirect(s: Seance) {
  if (s.statut !== "en_direct") throw new ErreurHttp(409, t("erreur.pasEnDirect"));
  if (s.planBLe) throw new ErreurHttp(409, t("erreur.planB"));
}

async function avecDelai<T>(travail: Promise<T>, ms = DELAI_FABRICATION_MS): Promise<T> {
  let minuteur: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([travail, new Promise<never>((_ok, ko) => (minuteur = setTimeout(() => ko(new Error("délai dépassé")), ms)))]);
  } finally {
    if (minuteur) clearTimeout(minuteur);
  }
}

/** Remet une page : image (sans cache, sans deviner le type) ou texte en JSON. */
function envoyerContenu(res: Response, c: ContenuPage) {
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (c.genre === "image") {
    const extension = c.mime.split("/")[1] === "jpeg" ? "jpg" : c.mime.split("/")[1];
    res.setHeader("Content-Type", c.mime);
    res.setHeader("Content-Disposition", `inline; filename="copie.${extension}"`);
    res.send(c.octets);
    return;
  }
  res.json({ texte: c.texte });
}

/** Copie d'un devoir de ce cours, que la personne lit (périmètre de la vie scolaire compris). */
async function copieDuCours(u: Utilisateur, s: Seance, renduId: number) {
  const { r, d, e } = await renduEnseigne(u, renduId, true);
  if (r.statut === "brouillon") throw introuvable("Copie");
  if (d.coursId !== s.coursId) throw invalide(t("erreur.autreCours"));
  if (d.type === "quiz") throw invalide(t("erreur.quiz"));
  return { r, d, e };
}

/** Devoir publié de ce cours, ou 404. */
async function devoirDuCours(s: Seance, devoirId: number): Promise<Devoir> {
  const [d] = await db.select().from(devoirs).where(and(eq(devoirs.id, devoirId), eq(devoirs.coursId, s.coursId), eq(devoirs.publie, true)));
  if (!d) throw introuvable("Devoir");
  return d;
}

/** Étudiants de toute la classe (tous sites) qui peuvent encore rendre ou remplacer leur copie de ce devoir. */
async function peuventEncoreRendre(d: Devoir, maintenant = new Date()): Promise<number> {
  if (d.type !== "depot") return 0;
  const inscrits = await etudiantsDuCours(d.coursId);
  const statuts = new Map((await db.select({ etudiantId: rendus.etudiantId, statut: rendus.statut }).from(rendus).where(eq(rendus.devoirId, d.id))).map((x) => [x.etudiantId, x.statut]));
  return inscrits.filter((e) => peutEncoreRendre(d, statuts.get(e.id), maintenant)).length;
}

async function corrigeDuDirect(d: Devoir): Promise<CorrigeDuDirectDto | null> {
  if (d.type !== "depot") return null;
  const cd = await corrigeDuDevoir(d.id);
  const m = corrigeMontrableEnClasse(d, cd, await copiesAPublier(d.id));
  if (m.montrable) return { montrable: true, pages: cd ? planDuCorrige(d, cd).pages.length : 0 };
  return m;
}

/** Résumé d'un devoir pour le Studio (compteurs dans le périmètre de la personne, « peuvent encore rendre » pour toute la classe). */
async function devoirDuDirect(d: Devoir, inscrits: Utilisateur[], copies: Rendu[], tous: Utilisateur[], maintenant: Date): Promise<DevoirDuDirectDto> {
  const visibles = new Set(inscrits.map((e) => e.id));
  const siennes = copies.filter((r) => r.devoirId === d.id);
  const statuts = new Map(siennes.map((r) => [r.etudiantId, r.statut]));
  const rendues = siennes.filter((r) => visibles.has(r.etudiantId)).length;
  const peuvent = d.type === "depot" ? tous.filter((e) => peutEncoreRendre(d, statuts.get(e.id), maintenant)).length : 0;
  const avant = maintenant.getTime() <= echeance(d).getTime();
  return {
    id: d.id,
    titre: d.titre,
    type: d.type,
    dateLimite: echeance(d).toISOString(),
    accepteRetard: d.accepteRetard,
    copiesRendues: rendues,
    inscrits: inscrits.length,
    peuventEncoreRendre: peuvent,
    etat: d.type === "quiz" ? "quiz" : !rendues ? "vide" : peuvent > 0 ? (avant ? "ouvert" : "retards") : "projetable",
    corrige: await corrigeDuDirect(d),
  };
}

export function enregistrerCopiesDirect(app: Express) {
  // ── Devoirs du cours (Studio) ─────────────────────────────────────────────
  app.get(
    "/api/seances/:id(\\d+)/devoirs",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const s = await animateurCopies(u, idParam(req));
      exigerStatut(s, ["planifiee", "en_direct"], t("erreur.termine"));
      const maintenant = new Date();
      const liste = await devoirsPubliesDuCours(s.coursId);
      const [inscrits, tous, copies] = await Promise.all([inscritsVisibles(u, s.coursId), etudiantsDuCours(s.coursId), copiesDesDevoirs(liste.map((d) => d.id))]);
      const resumes = await Promise.all(liste.map((d) => devoirDuDirect(d, inscrits, copies, tous, maintenant)));
      const passe = (x: DevoirDuDirectDto) => new Date(x.dateLimite).getTime() < maintenant.getTime();
      const groupe = (x: DevoirDuDirectDto) => (x.type === "quiz" ? 3 : !x.copiesRendues ? 2 : passe(x) ? 0 : 1);
      // Dépôts avec copies dont la date limite est passée (la plus récente d'abord), puis encore ouverts (la plus
      // proche d'abord), puis dépôts sans copie, puis interrogations.
      resumes.sort((a, b) => {
        const ga = groupe(a);
        const gb = groupe(b);
        if (ga !== gb) return ga - gb;
        const ta = new Date(a.dateLimite).getTime();
        const tb = new Date(b.dateLimite).getTime();
        return ga === 0 ? tb - ta : ta - tb;
      });
      const p = s.projection;
      const projete = estProjectionCopie(p) && s.statut === "en_direct" ? resumes.find((x) => x.id === p.devoirId) : undefined;
      const avecCopies = resumes.filter((x) => x.type === "depot" && x.copiesRendues > 0);
      const suggestion = projete?.id ?? avecCopies.find(passe)?.id ?? [...avecCopies].sort((a, b) => b.dateLimite.localeCompare(a.dateLimite))[0]?.id ?? null;
      const [c] = await db.select({ code: cours.code }).from(cours).where(eq(cours.id, s.coursId));
      const reponse: ListeDevoirsDuDirectDto = { coursCode: c?.code ?? "", devoirs: resumes, suggestion };
      sansCache(res);
      res.json(reponse);
    }),
  );

  // ── Copies d'un devoir ───────────────────────────────────────────────────
  app.get(
    "/api/seances/:id(\\d+)/devoirs/:devoirId(\\d+)/copies",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const s = await animateurCopies(u, idParam(req));
      exigerStatut(s, ["planifiee", "en_direct"], t("erreur.termine"));
      const d = await devoirDuCours(s, idParam(req, "devoirId"));
      if (d.type === "quiz") throw invalide(t("erreur.quiz"));
      const maintenant = new Date();
      const [inscrits, tous, copies] = await Promise.all([inscritsVisibles(u, s.coursId), etudiantsDuCours(s.coursId), copiesDesDevoirs([d.id])]);
      const parEtudiant = new Map(inscrits.map((e) => [e.id, e]));
      const siennes = copies.filter((r) => parEtudiant.has(r.etudiantId));
      const ids = [...new Set(siennes.flatMap((r) => r.fichierIds))];
      const infos = ids.length ? await db.select({ id: fichiers.id, mime: fichiers.mime, nomOriginal: fichiers.nomOriginal }).from(fichiers).where(inArray(fichiers.id, ids)) : [];
      const genres = new Map(infos.map((f) => [f.id, genreDe(f)]));
      const nomsSites = new Map((await db.select({ id: sites.id, nom: sites.nomCourt }).from(sites)).map((x) => [x.id, x.nom]));
      const liste: CopieDuDirectDto[] = siennes
        .map((r) => {
          const e = parEtudiant.get(r.etudiantId)!;
          const resume = { texte: Boolean(r.texte.trim()), photos: 0, pdf: 0, documents: 0, videos: 0, sons: 0, autres: 0 };
          for (const id of r.fichierIds) {
            const g = genres.get(id);
            if (g === "jpeg" || g === "heic" || g === "image") resume.photos++;
            else if (g === "pdf") resume.pdf++;
            else if (g === "office") resume.documents++;
            else if (g === "video") resume.videos++;
            else if (g === "audio") resume.sons++;
            else if (g === "texte") resume.documents++;
            else resume.autres++;
          }
          return {
            renduId: r.id,
            prenom: e.prenom,
            initiale: e.nom.trim() ? `${e.nom.trim().charAt(0).toUpperCase()}.` : "",
            site: e.siteId ? (nomsSites.get(e.siteId) ?? null) : null,
            renduLe: (r.renduLe ?? r.majLe).toISOString(),
            enRetard: r.enRetard,
            resume,
          };
        })
        .sort((a, b) => a.prenom.localeCompare(b.prenom, "fr") || a.initiale.localeCompare(b.initiale, "fr"));
      const reponse: ListeCopiesDuDirectDto = { devoir: await devoirDuDirect(d, inscrits, copies, tous, maintenant), copies: liste };
      sansCache(res);
      res.json(reponse);
    }),
  );

  // ── Plan d'une copie (pages montrables) ──────────────────────────────────
  app.get(
    "/api/seances/:id(\\d+)/copies/:renduId(\\d+)",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const s = await animateurCopies(u, idParam(req));
      exigerStatut(s, ["planifiee", "en_direct"], t("erreur.termine"));
      const { r, e } = await copieDuCours(u, s, idParam(req, "renduId"));
      const plan: PlanCopieDto = await planDeCopie(r, e);
      sansCache(res);
      res.json(plan);
    }),
  );

  // ── Aperçu d'une page pour l'animateur : la même image que la classe verra ──
  app.get(
    "/api/seances/:id(\\d+)/copies/:renduId(\\d+)/pages/:page([a-z0-9]+)",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const s = await animateurCopies(u, idParam(req));
      exigerStatut(s, ["planifiee", "en_direct"], t("erreur.termine"));
      const { r, e } = await copieDuCours(u, s, idParam(req, "renduId"));
      const page = String(req.params.page);
      if (!CLE_PAGE.test(page)) throw introuvable("Page");
      const plan = await planDeCopie(r, e);
      if (!pageDuPlan(plan, page)) {
        if (plan.enPreparation) {
          res.setHeader("Retry-After", "2");
          throw new ErreurHttp(503, t("erreur.preparation"));
        }
        throw new ErreurHttp(404, t("erreur.page"));
      }
      let contenu: ContenuPage;
      try {
        contenu = await avecDelai(contenuDePage(await sourceDeCopie(r), plan, page, { enteteMasque: req.query.entete === "1" }));
      } catch (err) {
        console.warn(`[copies-direct] aperçu de la copie ${r.id} impossible :`, (err as Error).message.slice(0, 200));
        throw new ErreurHttp(422, t("erreur.echec"));
      }
      envoyerContenu(res, contenu);
    }),
  );

  // ── Corrigé du devoir (lot 5) ─────────────────────────────────────────────
  app.get(
    "/api/seances/:id(\\d+)/devoirs/:devoirId(\\d+)/corrige",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const s = await animateurCopies(u, idParam(req));
      exigerStatut(s, ["planifiee", "en_direct"], t("erreur.termine"));
      const d = await devoirDuCours(s, idParam(req, "devoirId"));
      if (d.type !== "depot") throw invalide(t("erreur.quiz"));
      const cd = await corrigeDuDevoir(d.id);
      const montrable = (await corrigeDuDirect(d))!;
      const plan = cd && cd.contenu.trim() ? planDuCorrige(d, cd) : planDuCorrige(d, { contenu: "", version: cd?.version ?? 0 });
      const reponse: PlanCorrigeDto = { ...plan, montrable };
      sansCache(res);
      res.json(reponse);
    }),
  );

  app.get(
    "/api/seances/:id(\\d+)/devoirs/:devoirId(\\d+)/corrige/pages/:page(c\\d{1,3})",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const s = await animateurCopies(u, idParam(req));
      exigerStatut(s, ["planifiee", "en_direct"], t("erreur.termine"));
      const d = await devoirDuCours(s, idParam(req, "devoirId"));
      const cd = await corrigeDuDevoir(d.id);
      if (!cd || !cd.contenu.trim()) throw introuvable("Corrigé");
      const plan = planDuCorrige(d, cd);
      const page = String(req.params.page);
      if (!pageDuPlan(plan, page)) throw new ErreurHttp(404, t("erreur.page"));
      const contenu = await contenuDePage({ source: "corrige", devoirId: d.id, version: plan.version, contenu: cd.contenu }, plan, page, { enteteMasque: false });
      envoyerContenu(res, contenu);
    }),
  );

  // ── Projeter une page à la classe ────────────────────────────────────────
  const corpsProjection = z.discriminatedUnion("source", [
    z.object({
      source: z.literal("copie"),
      renduId: z.number().int().positive(),
      page: z.string().regex(CLE_PAGE),
      nomVisible: z.boolean().default(false),
      enteteMasque: z.boolean().optional(),
      rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
      confirmerOuvert: z.boolean().default(false),
    }),
    z.object({ source: z.literal("corrige"), devoirId: z.number().int().positive(), page: z.string().regex(/^c\d{1,3}$/) }),
  ]);

  app.post(
    "/api/seances/:id(\\d+)/projection/copie",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const id = idParam(req);
      const corps = valider(corpsProjection, req.body);
      const dto = await enSerie(id, async () => {
        const generation = generationDe(id);
        // 1-2. Séance relue : état frais, en direct, hors Plan B.
        const s = await animateurCopies(u, id);
        exigerDirect(s);
        const maintenant = new Date();
        let src: SourcePages;
        let plan: PlanCopieDto;
        let d: Devoir;
        let etudiant: Pick<Utilisateur, "prenom" | "nom"> | null = null;
        let peuvent = 0;
        // 3. La copie (ou le corrigé) appartient à un devoir de ce cours.
        if (corps.source === "copie") {
          const c = await copieDuCours(u, s, corps.renduId);
          d = c.d;
          etudiant = c.e;
          // 4. La page est dans le plan.
          plan = await planDeCopie(c.r, c.e);
          src = await sourceDeCopie(c.r);
        } else {
          d = await devoirDuCours(s, corps.devoirId);
          if (d.type !== "depot") throw invalide(t("erreur.quiz"));
          const cd = await corrigeDuDevoir(d.id);
          const m = corrigeMontrableEnClasse(d, cd, await copiesAPublier(d.id), maintenant);
          if (!m.montrable || !cd) throw new ErreurHttp(409, t("corrige.nonValide"), { code: "corrige_retenu", raison: m.montrable ? "absent" : m.raison, n: m.montrable ? undefined : m.n });
          plan = planDuCorrige(d, cd);
          src = { source: "corrige", devoirId: d.id, version: plan.version, contenu: cd.contenu };
        }
        const page = pageDuPlan(plan, corps.page);
        if (!page) {
          if (plan.enPreparation) throw new ErreurHttp(503, t("erreur.preparation"));
          throw new ErreurHttp(404, t("erreur.page"));
        }
        // 5. Date limite : avant elle, si des étudiants peuvent encore rendre, le formateur confirme.
        const avantLimite = maintenant.getTime() <= echeance(d).getTime();
        let malgreOuvert = false;
        if (corps.source === "copie") {
          peuvent = await peuventEncoreRendre(d, maintenant);
          if (avantLimite && peuvent > 0) {
            if (!corps.confirmerOuvert) throw new ErreurHttp(409, t("erreur.ouvert"), { code: "devoir_ouvert", peuventRendre: peuvent, dateLimite: echeance(d).toISOString() });
            malgreOuvert = true;
          }
        }
        // 6. L'image est prête avant d'être annoncée : la classe ne voit jamais une page qui n'arrive pas.
        const nomVisible = corps.source === "copie" ? corps.nomVisible : false;
        const enteteMasque = page.enteteDisponible && (corps.source === "copie" && corps.enteteMasque !== undefined ? corps.enteteMasque : page.enteteParDefaut);
        let contenu: ContenuPage;
        try {
          contenu = await avecDelai(contenuDePage(src, plan, page.page, { enteteMasque }));
        } catch (err) {
          console.warn(`[copies-direct] séance ${s.id} : page non préparée :`, (err as Error).message.slice(0, 200));
          throw new ErreurHttp(422, t("erreur.echec"));
        }
        // 7. Nouvel état.
        const avant = s.projection ?? null;
        const ancienneCopie = estProjectionCopie(avant) ? avant : null;
        const memeCopie = ancienneCopie && ancienneCopie.source === corps.source && ancienneCopie.renduId === (corps.source === "copie" ? corps.renduId : null) && ancienneCopie.devoirId === d.id;
        const nouvelle: ProjectionCopie = {
          genre: "copie",
          source: corps.source,
          devoirId: d.id,
          renduId: corps.source === "copie" ? corps.renduId : null,
          version: plan.version,
          page: page.page,
          numero: page.numero,
          total: plan.pages.length,
          contenu: page.contenu,
          cle: nouvelleCle(),
          zone: "page",
          rotation: corps.source === "copie" && corps.rotation !== undefined ? corps.rotation : page.rotation,
          nomVisible,
          enteteMasque,
          enteteDisponible: page.enteteDisponible,
          etiquette: corps.source === "corrige" ? t("classe.corrige") : etiquetteCopie(nomVisible, etudiant!.prenom, etudiant!.nom),
          devoirTitre: d.titre,
          par: u.id,
          depuis: memeCopie ? ancienneCopie.depuis : Date.now(),
          horodatage: Date.now(),
        };
        // 8. Écriture conditionnelle : un « Revenir aux diapos » passé pendant la préparation l'emporte.
        retenirContenu(nouvelle.cle, contenu);
        const maj = await ecrireSiInchangee(s.id, avant, nouvelle, generation);
        if (!maj) throw new ErreurHttp(409, t("erreur.changee"), { code: "projection_changee" });
        // 9-10. Une vidéo projetée s'arrête ; la copie part chez tout le monde.
        if (avant && !estProjectionCopie(avant)) publier(`seance:${s.id}`, "projection", null);
        const dto = copieDe(maj);
        publier(`seance:${s.id}`, "copie", dto);
        // 11. Trace : fil de la séance (bilan, replay) et journal, à chaque nouvelle copie.
        if (!memeCopie) {
          await db.insert(evenementsSeances).values({
            seanceId: s.id,
            type: "copie",
            donnees: { source: nouvelle.source, devoirId: d.id, devoirTitre: d.titre, renduId: nouvelle.renduId, total: nouvelle.total, nomVisible, par: u.id },
          });
          await db.insert(journal).values({
            utilisateurId: u.id,
            action: "copie_montree",
            details: {
              seanceId: s.id,
              devoirId: d.id,
              renduId: nouvelle.renduId,
              source: nouvelle.source,
              page: nouvelle.numero,
              nomVisible,
              enteteMasque,
              malgreOuvert,
              retardsPossibles: corps.source === "copie" && !avantLimite && peuvent > 0,
            },
          });
        }
        // 12. La page suivante se prépare déjà.
        prechauffer(src, plan, page.numero);
        return dto;
      });
      sansCache(res);
      res.json(dto);
    }),
  );

  // ── Tourner les pages, zoom, rotation, prénom, haut caché ────────────────
  const corpsReglage = z
    .object({
      numero: z.number().int().min(1).optional(),
      zone: z.enum(ZONES_COPIE).optional(),
      rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
      nomVisible: z.boolean().optional(),
      enteteMasque: z.boolean().optional(),
    })
    .refine((x) => Object.values(x).some((v) => v !== undefined), "indiquez au moins un réglage");

  app.patch(
    "/api/seances/:id(\\d+)/projection/copie",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const id = idParam(req);
      const corps = valider(corpsReglage, req.body);
      const dto = await enSerie(id, async () => {
        const generation = generationDe(id);
        const s = await animateurCopies(u, id);
        exigerDirect(s);
        const p = s.projection;
        if (!estProjectionCopie(p)) throw new ErreurHttp(409, t("erreur.aucune"));
        let src: SourcePages;
        let plan: PlanCopieDto;
        let etudiant: Pick<Utilisateur, "prenom" | "nom"> | null = null;
        if (p.source === "copie" && p.renduId) {
          const c = await copieDuCours(u, s, p.renduId);
          if ((c.r.renduLe ? c.r.renduLe.toISOString() : "0") !== p.version) throw new ErreurHttp(409, t("erreur.plusMontree"));
          etudiant = c.e;
          plan = await planDeCopie(c.r, c.e);
          src = await sourceDeCopie(c.r);
        } else {
          const cd = await corrigeDuDevoir(p.devoirId);
          if (!cd || String(cd.version) !== p.version) throw new ErreurHttp(409, t("erreur.plusMontree"));
          plan = planDuCorrige({ id: p.devoirId }, cd);
          src = { source: "corrige", devoirId: p.devoirId, version: plan.version, contenu: cd.contenu };
        }
        const numero = corps.numero ?? p.numero;
        if (numero < 1 || numero > plan.pages.length) throw invalide(t("erreur.page"));
        const page = plan.pages[numero - 1];
        const changePage = page.page !== p.page;
        const enteteMasque = page.enteteDisponible && (corps.enteteMasque ?? (changePage ? page.enteteParDefaut : p.enteteMasque));
        const nomVisible = p.source === "copie" ? (corps.nomVisible ?? p.nomVisible) : false;
        const nouvelleImage = changePage || enteteMasque !== p.enteteMasque;
        const nouvelle: ProjectionCopie = {
          ...p,
          page: page.page,
          numero: page.numero,
          total: plan.pages.length,
          contenu: page.contenu,
          cle: nouvelleImage ? nouvelleCle() : p.cle,
          zone: corps.zone ?? (changePage ? "page" : p.zone),
          rotation: corps.rotation ?? (changePage ? page.rotation : p.rotation),
          nomVisible,
          enteteMasque,
          enteteDisponible: page.enteteDisponible,
          etiquette: p.source === "corrige" ? p.etiquette : nomVisible !== p.nomVisible && etudiant ? etiquetteCopie(nomVisible, etudiant.prenom, etudiant.nom) : p.etiquette,
          horodatage: Date.now(),
        };
        if (nouvelleImage) {
          try {
            retenirContenu(nouvelle.cle, await avecDelai(contenuDePage(src, plan, page.page, { enteteMasque })));
          } catch (err) {
            console.warn(`[copies-direct] séance ${s.id} : page ${numero} non préparée :`, (err as Error).message.slice(0, 200));
            throw new ErreurHttp(422, t("erreur.echec"));
          }
        }
        const maj = await ecrireSiInchangee(s.id, p, nouvelle, generation);
        if (!maj) throw new ErreurHttp(409, t("erreur.changee"), { code: "projection_changee" });
        const dto = copieDe(maj);
        publier(`seance:${s.id}`, "copie", dto);
        prechauffer(src, plan, page.numero);
        return dto;
      });
      sansCache(res);
      res.json(dto);
    }),
  );

  // Ce que l'animateur sait en plus de la classe : quelle copie et quelle page sont à l'écran.
  app.get(
    "/api/seances/:id(\\d+)/projection/copie",
    exigerConnexion,
    route(async (req, res) => {
      const s = await animateurCopies(moi(req), idParam(req));
      const p = s.projection;
      const dto: ProjectionCopieAnimateurDto | null =
        estProjectionCopie(p) && copieDe(s) ? { source: p.source, devoirId: p.devoirId, renduId: p.renduId, page: p.page, numero: p.numero, total: p.total, parId: p.par } : null;
      sansCache(res);
      res.json(dto);
    }),
  );

  // ── Image (ou texte) de la page projetée, pour toute la classe ───────────
  app.get(
    "/api/seances/:id(\\d+)/projection/contenu/:cle([0-9a-f]{24})",
    exigerConnexion,
    route(async (req, res) => {
      const s = await seanceVisible(moi(req), idParam(req));
      const p = s.projection;
      const plusMontree = () => {
        res.setHeader("Cache-Control", "private, no-store");
        res.status(410).json({ message: t("erreur.plusMontree") });
      };
      if (!estProjectionCopie(p) || p.cle !== req.params.cle || !copieDe(s)) return plusMontree();
      // Corrigé modifié pendant qu'il est montré : la page n'est plus la bonne, le formateur la reprojette.
      if (p.source === "corrige" && String((await corrigeDuDevoir(p.devoirId))?.version ?? "") !== p.version) return plusMontree();
      let contenu: ContenuPage | null;
      try {
        contenu = await avecDelai(contenuProjete(p));
      } catch {
        res.setHeader("Retry-After", "2");
        res.setHeader("Cache-Control", "private, no-store");
        return res.status(503).json({ message: t("classe.chargement") });
      }
      if (!contenu) return plusMontree();
      envoyerContenu(res, contenu);
    }),
  );
}
