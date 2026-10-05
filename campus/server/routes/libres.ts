// Portail des bibliothèques libres : chercher dans l'index (sans IA, donc sans
// rien consommer), lire le livre sur le campus (texte en pages, pages
// scannées, PDF), et, si l'étudiant le souhaite, l'étudier avec l'IA (fiche,
// questions, quiz) dans la bibliothèque.
import type { Express } from "express";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { exigerRole, moi, peut } from "../auth";
import { route, valider, idParam, introuvable, ErreurHttp } from "../http";
import { pageDuTexte } from "../lecture";
import { enregistrerLivre } from "../bibliotheque-outils";
import {
  catalogueLibre,
  moissonsLibres,
  DOMAINES_LIBRES,
  SOURCES_LIBRES,
  type AccueilLibresDto,
  type DetailLibreDto,
  type DomaineLibre,
  type EtatMoissonDto,
  type PageTexteLibreDto,
  type RechercheLibresDto,
  type SourceLibre,
  type Utilisateur,
} from "@shared/schema";
import { chercherLibres, selectionAccueil, completerLiens, compterLecture, lectureDepuisIndex, livreLibre, texteDuLibre, versLivreLibreDto, voisins } from "../libres/index-libre";
import { lancerMoisson, moissonEnCours, toutesLesSources } from "../libres/moisson";

const ROLES = ["etudiant", "formateur", "vie_scolaire", "admin"] as const;
/** Taille au-delà de laquelle un PDF ne passe plus par le campus (lien direct à la place). */
const PDF_MAX_OCTETS = 80 * 1024 * 1024;

const gereIndex = (u: Utilisateur) => u.role === "admin" || ((u.role === "vie_scolaire") && peut(u, "outils_campus"));

async function etatsMoissons(): Promise<EtatMoissonDto[]> {
  const lignes = await db.select().from(moissonsLibres);
  const enCours = moissonEnCours();
  return lignes.map((m) => ({
    source: m.source,
    statut: m.statut === "en_cours" && enCours !== m.source ? "erreur" : m.statut,
    nombre: m.nombre,
    debut: m.debut.toISOString(),
    fin: m.fin?.toISOString() ?? null,
    message: m.statut === "en_cours" && enCours !== m.source ? "Moisson interrompue (redémarrage) : elle reprendra d'elle-même." : m.message,
  }));
}

/** Chiffres de l'accueil du portail, recalculés au plus toutes les 10 minutes (ou dès que l'index grossit pendant une moisson). */
let chiffres: { le: number; valeur: Omit<AccueilLibresDto, "moissons"> } | null = null;

async function chiffresAccueil(): Promise<Omit<AccueilLibresDto, "moissons">> {
  const duree = moissonEnCours() ? 60_000 : 10 * 60_000;
  if (chiffres && Date.now() - chiffres.le < duree) return chiffres.valeur;
  const [[{ total }], domaines, sources, plusLus] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int` }).from(catalogueLibre),
    db.execute<{ domaine: DomaineLibre; nombre: number }>(sql`select d as domaine, count(*)::int as nombre from ${catalogueLibre}, unnest(${catalogueLibre.domaines}) as d group by d`),
    db
      .select({ source: catalogueLibre.source, nombre: sql<number>`count(*)::int` })
      .from(catalogueLibre)
      .groupBy(catalogueLibre.source),
    selectionAccueil(12),
  ]);
  const valeur = {
    total,
    parDomaine: DOMAINES_LIBRES.map((d) => ({ domaine: d, nombre: domaines.rows.find((x) => x.domaine === d)?.nombre ?? 0 })).filter((d) => d.nombre > 0),
    parSource: SOURCES_LIBRES.map((s) => ({ source: s, nombre: sources.find((x) => x.source === s)?.nombre ?? 0 })).filter((s) => s.nombre > 0),
    plusLus: plusLus.map(versLivreLibreDto),
  };
  chiffres = { le: Date.now(), valeur };
  return valeur;
}

const filtres = z.object({
  q: z.string().max(200).optional(),
  domaine: z.enum(DOMAINES_LIBRES).optional(),
  langue: z
    .string()
    .regex(/^[a-z]{2}$/)
    .optional(),
  source: z.enum(SOURCES_LIBRES).optional(),
  page: z.coerce.number().int().min(1).max(200).optional(),
});

export function enregistrerLibres(app: Express) {
  const lecteur = exigerRole(...ROLES);

  // Accueil du portail : rayons, bibliothèques, les plus lus.
  app.get(
    "/api/libres/accueil",
    lecteur,
    route(async (req, res) => {
      const u = moi(req);
      const dto: AccueilLibresDto = { ...(await chiffresAccueil()), moissons: gereIndex(u) ? await etatsMoissons() : null };
      res.json(dto);
    }),
  );

  app.get(
    "/api/libres",
    lecteur,
    route(async (req, res) => {
      const f = valider(filtres, req.query);
      const parPage = 24;
      const { resultats, total } = await chercherLibres({ ...f, parPage });
      const dto: RechercheLibresDto = { resultats: resultats.map(versLivreLibreDto), total, page: f.page ?? 1, parPage };
      res.json(dto);
    }),
  );

  app.get(
    "/api/libres/:id(\\d+)",
    lecteur,
    route(async (req, res) => {
      const trouve = await livreLibre(idParam(req));
      if (!trouve) throw introuvable("Livre");
      const l = await completerLiens(trouve);
      const { memeAuteur, memeDomaine } = await voisins(l);
      void compterLecture(l.id).catch(() => {});
      const dto: DetailLibreDto = {
        livre: {
          ...versLivreLibreDto(l),
          description: l.description,
          sujets: l.sujets,
          licence: l.licence,
          lien: l.lien,
          texte: l.source === "gutenberg" || l.source === "archive" || (l.source === "banque_mondiale" && Boolean(l.texte)),
          pdf: (l.source === "banque_mondiale" || l.source === "openstax") && Boolean(l.pdf),
          web: l.source === "openstax" ? l.texte : l.source === "gutenberg" ? `https://www.gutenberg.org/cache/epub/${l.ident}/pg${l.ident}-images.html` : null,
          pdfExterne: l.source === "oapen" ? l.pdf : null,
          lectures: l.lectures + 1,
        },
        memeAuteur: memeAuteur.map(versLivreLibreDto),
        memeDomaine: memeDomaine.map(versLivreLibreDto),
      };
      res.json(dto);
    }),
  );

  // Texte intégral en pages (léger sur un petit forfait).
  app.get(
    "/api/libres/:id(\\d+)/texte",
    lecteur,
    route(async (req, res) => {
      const l = await livreLibre(idParam(req));
      if (!l) throw introuvable("Livre");
      const texte = await texteDuLibre(l);
      if (!texte) throw new ErreurHttp(404, "Le texte de ce livre n'est pas disponible pour le moment. Essaie l'autre mode de lecture, ou réessaie dans un instant.");
      const dto: PageTexteLibreDto = pageDuTexte(texte, Math.max(1, Number(req.query.page) || 1));
      res.json(dto);
    }),
  );

  // PDF affiché dans le campus (la Banque mondiale interdit l'affichage de ses PDF dans une autre page : il passe par ici).
  app.get(
    "/api/libres/:id(\\d+)/pdf",
    lecteur,
    route(async (req, res) => {
      const trouve = await livreLibre(idParam(req));
      if (!trouve) throw introuvable("Livre");
      const l = await completerLiens(trouve);
      if (!l.pdf || (l.source !== "banque_mondiale" && l.source !== "openstax")) throw introuvable("PDF");
      if (l.source === "openstax") return res.redirect(l.pdf);
      const r = await fetch(l.pdf, { signal: AbortSignal.timeout(60_000), headers: { "User-Agent": "Campus2IAE/1.0 (campus.2iae.com)" } });
      const taille = Number(r.headers.get("content-length")) || 0;
      if (!r.ok || !r.body || taille > PDF_MAX_OCTETS) {
        await r.body?.cancel().catch(() => {});
        return res.redirect(l.pdf);
      }
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="livre-${l.id}.pdf"`);
      res.setHeader("Cache-Control", "private, max-age=86400");
      if (taille) res.setHeader("Content-Length", String(taille));
      const lecteurFlux = r.body.getReader();
      res.on("close", () => void lecteurFlux.cancel().catch(() => {}));
      for (;;) {
        const { done, value } = await lecteurFlux.read();
        if (done) break;
        if (!res.write(Buffer.from(value))) await new Promise((ok) => res.once("drain", ok));
      }
      res.end();
    }),
  );

  // Étudier ce livre avec l'IA : il entre dans la bibliothèque (fiche, questions, quiz, notes, exposé).
  app.post(
    "/api/libres/:id(\\d+)/etudier",
    lecteur,
    route(async (req, res) => {
      const l = await livreLibre(idParam(req));
      if (!l) throw introuvable("Livre");
      const { id } = await enregistrerLivre(
        { titre: l.titre, auteurs: l.auteurs, annee: l.annee, editeur: null, langue: l.langue },
        {
          cle: `libre:${l.source}:${l.ident}`,
          titre: l.titre,
          auteurs: l.auteurs,
          annee: l.annee,
          editeur: null,
          isbn: null,
          langue: l.langue,
          pages: null,
          couvertureUrl: l.couverture,
          lienCatalogue: l.lien,
          description: l.description,
          source: l.source === "archive" ? "archive" : "index",
        },
        null,
        lectureDepuisIndex(l),
      );
      res.json({ livreId: id });
    }),
  );

  // Direction : relancer la moisson (toutes les bibliothèques, ou une seule).
  app.post(
    "/api/libres/moisson",
    lecteur,
    route(async (req, res) => {
      const u = moi(req);
      if (!gereIndex(u)) throw new ErreurHttp(403, "Seule la direction met à jour l'index des bibliothèques.");
      const { source } = valider(z.object({ source: z.enum(SOURCES_LIBRES).optional() }), req.body ?? {});
      lancerMoisson(source ? [source as SourceLibre] : toutesLesSources());
      res.json({ moissons: await etatsMoissons() });
    }),
  );
}
