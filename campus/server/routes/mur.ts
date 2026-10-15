// Le mur du cours (José, 15 octobre 2026 : « un blog pour poster mes liens, mes fichiers ») : routes. Droits et
// lectures : server/mur.ts. Contrats : shared/mur.ts.
//
//   GET    /api/cours/:id/mur?avant=<id>          lire (étudiants du cours, professeurs, équipe du périmètre, direction)
//   POST   /api/cours/:id/mur                     écrire (professeurs du cours, direction) : texte, liens, 5 fichiers
//   DELETE /api/cours/:id/mur/:pid                supprimer (l'auteur, la direction, l'équipe « annonces » du périmètre)
//   POST   /api/cours/:id/mur/vu                  l'étudiant a ouvert le mur : ses notifications du mur passent lues
//   GET    /api/mon-campus/cours/:id/mur          l'espace du campus lit le mur (cours suivis par son campus), sans rien changer
//
// Notifications légères : une ligne dans la cloche de chaque étudiant du cours publié ; le téléphone suit la priorité
// « contenu » (plafond du jour, heures calmes, regroupement par cours). Aucune page donnée par l'utilisateur n'est lue
// par le serveur (seul le titre public d'une vidéo YouTube, comme pour les ressources de séance).
import type { Express, Request } from "express";
import { z } from "zod";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db";
import { exigerConnexion, exigerDroit, exigerRole, moi } from "../auth";
import { route, valider, idParam, ErreurHttp, introuvable, interdit, invalide } from "../http";
import { coursVisible, etudiantsDuCours, formateursDuCours } from "../acces";
import { enregistrerGardienFichier } from "../fichiers";
import { notifier } from "../notifications";
import { enregistrerGardien, publier, publierUtilisateur } from "../temps-reel";
import { anneesDesCoursDuSite } from "../salles-outils";
import { idYoutube, titreDuLien, titreYoutube } from "./ressources-seance";
import {
  coursDuMur,
  lienMurEtudiant,
  lienMurProfesseur,
  murDuCours,
  peutLireMur,
  peutPublierMur,
  peutSupprimerPublication,
} from "../mur";
import { MUR_FICHIERS_MAX, MUR_LIENS_MAX, MUR_PAR_HEURE, MUR_TEXTE_MAX, extraireLiens } from "@shared/mur";
import { t } from "@shared/textes/mur";
import { estProfilCampus, fichiers, fichiersPublications, journal, notifications, publicationsCours, sites, type LienPublication } from "@shared/schema";

const HEURE_MS = 3_600_000;
const vous = { registre: "vous" as const };
const tu = { registre: "tu" as const };

/** Messages récents de chaque auteur (mémoire) : 20 par heure au plus. */
const envoisRecents = new Map<number, number[]>();
setInterval(() => {
  const limite = Date.now() - HEURE_MS;
  for (const [id, liste] of envoisRecents) {
    const restants = liste.filter((t) => t > limite);
    if (restants.length) envoisRecents.set(id, restants);
    else envoisRecents.delete(id);
  }
}, 10 * 60_000).unref();

function verifierCadence(auteurId: number) {
  const limite = Date.now() - HEURE_MS;
  const liste = (envoisRecents.get(auteurId) ?? []).filter((x) => x > limite);
  if (liste.length >= MUR_PAR_HEURE) throw new ErreurHttp(429, t("erreur.trop", vous));
  liste.push(Date.now());
  envoisRecents.set(auteurId, liste);
}

/** Texte nettoyé : fins de ligne unifiées, au plus deux lignes vides de suite. */
const nettoyer = (s: string) =>
  s
    .replace(/\r\n?/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();

const avantParam = (req: Request): number | null => {
  const n = Number(req.query.avant);
  return Number.isInteger(n) && n > 0 ? n : null;
};

const schemaPublication = z.object({
  texte: z.string().max(MUR_TEXTE_MAX * 2).default(""),
  fichierIds: z.array(z.number().int().positive()).max(MUR_FICHIERS_MAX + 5).default([]),
  cle: z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,64}$/)
    .optional(),
});

/** Extrait de 120 caractères pour la notification. */
const extrait = (s: string, n = 120) => {
  const plat = s.replace(/\s+/g, " ").trim();
  return plat.length > n ? `${plat.slice(0, n - 1).trimEnd()}…` : plat;
};

export function enregistrerMur(app: Express) {
  // Temps réel : le canal mur:<coursId> est réservé à ceux qui lisent le mur.
  enregistrerGardien("mur", (u, cle) => peutLireMur(u, Number(cle)));

  // Fichiers du mur : lisibles par ceux qui lisent le mur du cours de leur message.
  enregistrerGardienFichier("mur", async (u, f) => {
    const [l] = await db
      .select({ coursId: publicationsCours.coursId })
      .from(fichiersPublications)
      .innerJoin(publicationsCours, eq(publicationsCours.id, fichiersPublications.publicationId))
      .where(eq(fichiersPublications.fichierId, f.id));
    return l ? peutLireMur(u, l.coursId) : false;
  });

  // ── Lire ─────────────────────────────────────────────────────────────────
  app.get(
    "/api/cours/:id(\\d+)/mur",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const c = await coursVisible(u, idParam(req));
      if (!(await peutLireMur(u, c.id))) throw interdit(t("erreur.lire", u.role === "etudiant" ? tu : vous));
      res.setHeader("Cache-Control", "private, no-store");
      res.json(await murDuCours(u, c, { avant: avantParam(req) }));
    }),
  );

  // ── Écrire ───────────────────────────────────────────────────────────────
  app.post(
    "/api/cours/:id(\\d+)/mur",
    exigerRole("formateur", "admin"),
    route(async (req, res) => {
      const u = moi(req);
      const c = await coursDuMur(idParam(req));
      if (!c) throw introuvable("Cours");
      if (c.statut === "archive") throw new ErreurHttp(409, t("erreur.archive", vous));
      if (!(await peutPublierMur(u, c))) throw interdit(t("erreur.droit", vous));
      const d = valider(schemaPublication, req.body ?? {});
      const texte = nettoyer(d.texte);
      const ids = [...new Set(d.fichierIds)];
      if (!texte && !ids.length) throw invalide(t("erreur.vide", vous));
      if (texte.length > MUR_TEXTE_MAX) throw invalide(t("erreur.long", vous));
      if (ids.length > MUR_FICHIERS_MAX) throw invalide(t("fichier.max", vous));

      // Même envoi rejoué (file hors ligne, double toucher) : la même publication, rien d'autre.
      if (d.cle) {
        const [deja] = await db.select({ id: publicationsCours.id }).from(publicationsCours).where(and(eq(publicationsCours.auteurId, u.id), eq(publicationsCours.cleEnvoi, d.cle)));
        if (deja) {
          const mur = await murDuCours(u, c);
          return res.status(200).json(mur.publications.find((p) => p.id === deja.id) ?? null);
        }
      }
      verifierCadence(u.id);

      // Fichiers : téléversés par l'auteur avec l'usage « mur », jamais déjà joints ailleurs.
      if (ids.length) {
        const trouves = await db.select({ id: fichiers.id, proprietaireId: fichiers.proprietaireId, usage: fichiers.usage }).from(fichiers).where(inArray(fichiers.id, ids));
        const joints = await db.select({ id: fichiersPublications.fichierId }).from(fichiersPublications).where(inArray(fichiersPublications.fichierId, ids));
        const ok = trouves.length === ids.length && trouves.every((f) => f.proprietaireId === u.id && f.usage === "mur") && !joints.length;
        if (!ok) throw invalide(t("erreur.fichier", vous));
      }

      // Liens : 5 au plus, titre lisible (YouTube : titre public, 4 s au plus ; sinon le site et le chemin).
      const adresses = extraireLiens(texte).slice(0, MUR_LIENS_MAX);
      const liens: LienPublication[] = await Promise.all(
        adresses.map(async (url) => {
          const youtubeId = idYoutube(url);
          const titre = youtubeId ? ((await titreYoutube(url)) ?? t("lien.youtube", vous)) : titreDuLien(url);
          return { url, titre, youtubeId };
        }),
      );

      let publicationId: number;
      try {
        publicationId = await db.transaction(async (tx) => {
          const [p] = await tx.insert(publicationsCours).values({ coursId: c.id, auteurId: u.id, texte, liens, cleEnvoi: d.cle ?? null }).returning({ id: publicationsCours.id });
          if (ids.length) await tx.insert(fichiersPublications).values(ids.map((fichierId, ordre) => ({ publicationId: p.id, fichierId, ordre })));
          return p.id;
        });
      } catch (e) {
        // Deux envois simultanés de la même clé : l'index unique a refusé le second.
        if (d.cle && /publications_cours_cle_idx|fichiers_publications/.test(String((e as Error).message))) throw new ErreurHttp(409, t("erreur.fichier", vous));
        throw e;
      }
      await db.insert(journal).values({ utilisateurId: u.id, action: "mur_publie", details: { coursId: c.id, publicationId, fichiers: ids.length, liens: liens.length } });
      publier(`mur:${c.id}`, "publication", { id: publicationId, coursId: c.id });

      const mur = await murDuCours(u, c);
      res.status(201).json(mur.publications.find((p) => p.id === publicationId) ?? null);

      // Notifications après la réponse : 300 étudiants ne ralentissent pas le bouton.
      if (c.statut === "publie") {
        const nomAuteur = `${u.prenom} ${u.nom}`.trim();
        const nomsFichiers = ids.length ? (await db.select({ nom: fichiers.nomOriginal }).from(fichiers).where(inArray(fichiers.id, ids))).map((f) => f.nom) : [];
        const corps = texte
          ? t("notif.corps", { ...vous, v: { nom: nomAuteur, extrait: extrait(texte) } })
          : nomsFichiers.length === 1
            ? t("notif.fichier.un", { ...vous, v: { nom: nomAuteur, fichier: nomsFichiers[0] } })
            : t("notif.fichier.n", { ...vous, v: { nom: nomAuteur, n: nomsFichiers.length } });
        const titre = t("notif.titre", { ...vous, v: { code: c.code } });
        void (async () => {
          const etudiants = (await etudiantsDuCours(c.id)).map((e) => e.id);
          await notifier(etudiants, { type: "cours", titre, corps, lien: lienMurEtudiant(c.id), push: true });
          const collegues = (await formateursDuCours(c.id)).filter((f) => f.actif && f.id !== u.id).map((f) => f.id);
          await notifier(collegues, { type: "cours", titre, corps, lien: lienMurProfesseur(c.id), push: false });
        })().catch((e) => console.error("[mur] notifications :", (e as Error).message));
      }
    }),
  );

  // ── Supprimer ────────────────────────────────────────────────────────────
  app.delete(
    "/api/cours/:id(\\d+)/mur/:pid(\\d+)",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const coursId = idParam(req);
      const [p] = await db.select().from(publicationsCours).where(and(eq(publicationsCours.id, idParam(req, "pid")), eq(publicationsCours.coursId, coursId)));
      if (!p) throw introuvable("Message");
      if (!(await peutSupprimerPublication(u, p))) throw interdit(t("erreur.supprimer", vous));
      await db.delete(publicationsCours).where(eq(publicationsCours.id, p.id));
      await db.insert(journal).values({ utilisateurId: u.id, action: "mur_supprime", details: { coursId, publicationId: p.id, auteurId: p.auteurId, extrait: extrait(p.texte, 80) } });
      publier(`mur:${coursId}`, "suppression", { id: p.id, coursId });
      res.json({ ok: true });
    }),
  );

  // ── L'étudiant a ouvert le mur ───────────────────────────────────────────
  app.post(
    "/api/cours/:id(\\d+)/mur/vu",
    exigerRole("etudiant"),
    route(async (req, res) => {
      const u = moi(req);
      const c = await coursVisible(u, idParam(req));
      const lues = await db
        .update(notifications)
        .set({ luLe: new Date() })
        .where(and(eq(notifications.utilisateurId, u.id), eq(notifications.lien, lienMurEtudiant(c.id)), isNull(notifications.luLe)))
        .returning({ id: notifications.id });
      if (lues.length) publierUtilisateur(u.id, "notification", { lues: lues.length });
      res.status(204).end();
    }),
  );

  // ── Espace du campus : lecture seule ─────────────────────────────────────
  app.get(
    "/api/mon-campus/cours/:id(\\d+)/mur",
    exigerConnexion,
    exigerDroit("espace_campus"),
    route(async (req, res) => {
      const u = moi(req);
      res.setHeader("Cache-Control", "no-store");
      let siteId: number;
      if (estProfilCampus(u)) {
        if (!u.siteId) throw new ErreurHttp(409, "Ce compte n'est rattaché à aucun campus. Appelez la direction.");
        siteId = u.siteId;
      } else {
        // Aperçu de la direction (?site=).
        const n = Number(req.query.site);
        if (!Number.isInteger(n) || n <= 0) throw invalide("Choisissez un campus.");
        const [s] = await db.select({ id: sites.id }).from(sites).where(eq(sites.id, n));
        if (!s) throw introuvable("Campus");
        siteId = s.id;
      }
      const coursId = idParam(req);
      if (!(await anneesDesCoursDuSite(siteId, coursId)).has(coursId)) throw new ErreurHttp(404, "Ce cours n'est pas suivi par votre campus.");
      const c = await coursDuMur(coursId);
      if (!c) throw new ErreurHttp(404, "Ce cours n'est pas suivi par votre campus.");
      res.json(await murDuCours(u, c, { avant: avantParam(req), lectureSeule: true }));
    }),
  );
}
