// Référencement côté serveur. Le site est une application monopage : sans ce
// module, Google, Bing et les moteurs IA (ChatGPT, Perplexity, Gemini…)
// reçoivent le même <head> générique sur toutes les adresses. Ici, chaque
// route connue est servie avec son titre, sa description, son canonical, ses
// balises Open Graph et son JSON-LD propres — articles d'actualité compris,
// avec leurs vraies données lues en base.
import fs from "fs";
import path from "path";
import type { Express } from "express";
import { storage } from "./storage";
import { FAQS } from "@shared/faq";
import { coursParSlug, formateurParSlug, lireVitrine } from "./campus";
import type { VitrineCours, VitrineFormateur, VitrineLive } from "@shared/campus";

const SITE = "https://www.2iae.com";

type MetaPage = {
  titre: string;
  description: string;
  image?: string;
  jsonLd?: unknown[];
};

// Programmes de formation : servis en JSON-LD sur /filieres et /instituts
// pour que les moteurs comprennent précisément l'offre.
const PROGRAMMES = [
  ["Génie civil option Bâtiment (GBAT)", "BTS et Licence professionnelle"],
  ["Agriculture Tropicale option Production Végétale (ATPV)", "BTS et Licence professionnelle"],
  ["Agriculture Tropicale option Production Animale (ATPA)", "BTS et Licence professionnelle"],
  ["Finance Comptabilité", "BTS et Licence professionnelle"],
  ["Marketing, Vente et Gestion Commerciale", "BTS et Licence professionnelle"],
  ["Ressources Humaines et Communication (RHCOM)", "BTS et Licence professionnelle"],
  ["Logistique et Transport", "BTS et Licence professionnelle"],
  ["Sciences de l'Information", "BTS et Licence professionnelle"],
  ["Informatique – Développeur d'Application (IDA)", "BTS"],
].map(([nom, niveau]) => ({
  "@type": "EducationalOccupationalProgram",
  name: nom,
  educationalCredentialAwarded: niveau,
  provider: { "@type": "EducationalOrganization", name: "Groupe Écoles 2IAE International", url: SITE },
}));

function filAriane(nom: string, chemin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: nom, item: SITE + chemin },
    ],
  };
}

// Le reportage du journal de 13 h de la RTI sur la Journée d'Excellence
// BTS 2026 : déclaré aux moteurs pour qu'il soit indexable comme vidéo.
const REPORTAGE_RTI = {
  "@context": "https://schema.org",
  "@type": "VideoObject",
  name: "RTI — Journal de 13 h : des établissements distingués pour leurs résultats au BTS 2026",
  description:
    "Le journal de 13 h de la RTI consacre son reportage à la Journée d'Excellence BTS 2026 : le Groupe Écoles 2IAE International y reçoit 4 distinctions et le trophée Excell'Ados des meilleurs résultats, et son fondateur Séraphin Koua répond au micro de la télévision nationale.",
  thumbnailUrl: [SITE + "/videos/reportage-rti-bts-2026-poster.jpg"],
  contentUrl: SITE + "/videos/reportage-rti-bts-2026.mp4",
  uploadDate: "2026-09-13",
  duration: "PT2M4S",
  inLanguage: "fr",
  isFamilyFriendly: true,
  publisher: {
    "@type": "Organization",
    name: "Groupe Écoles 2IAE International",
    url: SITE,
  },
};

const PAGES: Record<string, MetaPage> = {
  "/": {
    titre: "Groupe 2IAE International — 5e Grande École de Côte d'Ivoire | BTS, Licences, Entrepreneuriat",
    description:
      "5e grande école de Côte d'Ivoire au classement officiel MESRS : 67,38 % d'admis au BTS 2026 (national : 42,48 %), 5 campus avec internat, ferme-école, entrepreneuriat pour tous. Préinscriptions ouvertes.",
  },
  "/filieres": {
    titre: "Filières BTS et Licences en Côte d'Ivoire — Bâtiment, Agriculture, Management, Informatique | 2IAE",
    description:
      "Toutes les filières du Groupe 2IAE : génie civil (GBAT), agriculture (ATPV, ATPA), finance comptabilité, RH-communication, logistique, informatique. BTS, licences professionnelles et certificats, du BAC au Master.",
    jsonLd: [{ "@context": "https://schema.org", "@type": "ItemList", name: "Filières du Groupe 2IAE", itemListElement: PROGRAMMES }, filAriane("Filières", "/filieres")],
  },
  "/instituts": {
    titre: "Nos Instituts : IFGC, IFA, IFM, IFNTIC — objectifs, débouchés, conditions | 2IAE Côte d'Ivoire",
    description:
      "Quatre instituts de formation : génie civil, agriculture (ferme pédagogique, centre piscicole), management et NTIC. Objectifs, débouchés métiers et séries de BAC admises pour chaque filière.",
    jsonLd: [{ "@context": "https://schema.org", "@type": "ItemList", name: "Instituts et programmes 2IAE", itemListElement: PROGRAMMES }, filAriane("Instituts", "/instituts")],
  },
  "/tarifs": {
    titre: "Tarifs Rentrée 2026-2027 — frais officiels du BTS par campus | Groupe 2IAE",
    description:
      "Frais officiels 2026-2027 : 100 000 F d'inscription, 250 000 à 280 000 F au total selon le campus. Fiches PDF, échéancier, paiement sécurisé par virement, chèque, Wave ou Orange Money — aucun paiement en espèces.",
    jsonLd: [filAriane("Tarifs", "/tarifs")],
  },
  "/preinscription": {
    titre: "Préinscription en ligne — Rentrée 2026-2027 | Groupe 2IAE Côte d'Ivoire",
    description:
      "Préinscrivez-vous en 2 minutes, gratuitement et sans engagement : un conseiller vous rappelle pour finaliser votre dossier. Bacheliers orientés par l'État bienvenus. WhatsApp +225 07 47 72 67 29.",
    jsonLd: [filAriane("Préinscription", "/preinscription")],
  },
  "/resultats-bts-2026": {
    titre: "Résultats BTS 2026 : 67,38 % d'admis — 5e grande école de Côte d'Ivoire (MESRS) | 2IAE",
    description:
      "Azaguié 83,54 %, Yamoussoukro 68,18 %, Yopougon 64,13 %, Palmeraie 58,40 % — 67,38 % au global contre 42,48 % au national. 5e du classement officiel MESRS (BTS 2022) et 66 % d'insertion vérifiée par 60 Decibels.",
    image: SITE + "/images/resultats-bts-2026.jpg",
    jsonLd: [filAriane("Résultats BTS 2026", "/resultats-bts-2026"), REPORTAGE_RTI],
  },
  "/actualites": {
    titre: "Actualités du Groupe 2IAE — vie des campus, résultats, événements",
    description:
      "Toute l'actualité du Groupe Écoles 2IAE International : résultats d'examens, vie des campus, visites, partenariats et rendez-vous de la rentrée 2026-2027.",
    jsonLd: [filAriane("Actualités", "/actualites")],
  },
  "/galerie": {
    titre: "Galerie photos et vidéos — la vie des campus 2IAE en images",
    description:
      "Albums photos du Groupe 2IAE : cérémonies, travaux pratiques à la ferme-école et au chantier-école, vie étudiante et événements sur les 5 campus.",
    jsonLd: [filAriane("Galerie", "/galerie")],
  },
  "/videotheque": {
    titre: "Vidéothèque 2IAE — reportages, témoignages et formation en vidéo",
    description:
      "Les vidéos du Groupe 2IAE : spots de rentrée, témoignages d'étudiants, reportages sur la pédagogie par la pratique et passages télévisés du fondateur.",
    jsonLd: [filAriane("Vidéothèque", "/videotheque"), REPORTAGE_RTI],
  },
  "/universite-entrepreneuriat": {
    titre: "Université de l'Entrepreneuriat d'Azaguié — campus agro-pastoral avec internat | 2IAE",
    description:
      "Le campus phare du Groupe 2IAE à Azaguié : 83,54 % d'admis au BTS 2026, ferme pédagogique, centre piscicole, chantier-école et internat. La pédagogie par la pratique au cœur d'un campus verdoyant.",
    jsonLd: [filAriane("Université de l'Entrepreneuriat", "/universite-entrepreneuriat")],
  },
  "/historique": {
    titre: "Notre histoire : 20 ans d'excellence — de 2006 à l'Université de l'Entrepreneuriat | 2IAE",
    description:
      "L'histoire du Groupe 2IAE racontée par son fondateur Séraphin Koua, Prix du Meilleur Fondateur 2026 : de la création en 2006 aux 5 campus et à l'université agro-pastorale d'Azaguié.",
    jsonLd: [filAriane("Historique", "/historique")],
  },
  "/contact": {
    titre: "Contact — Groupe 2IAE Côte d'Ivoire | appels, WhatsApp et formulaire",
    description:
      "Contactez le Groupe 2IAE : +225 05 84 24 90 90, +225 27 22 51 81 75, WhatsApp +225 07 47 72 67 29, ou via le formulaire du site. Un conseiller vous répond rapidement.",
    jsonLd: [filAriane("Contact", "/contact")],
  },
  "/nous-trouver": {
    titre: "Nous trouver — les 5 campus 2IAE : Palmeraie, Yopougon, Azaguié, M'Batto, Yamoussoukro",
    description:
      "Plans d'accès et coordonnées des 5 campus du Groupe 2IAE en Côte d'Ivoire : Abidjan Riviera Palmeraie (siège), Yopougon, Azaguié Ahoua, M'Batto et Yamoussoukro.",
    jsonLd: [filAriane("Nous trouver", "/nous-trouver")],
  },
  "/faq": {
    titre: "Questions fréquentes — tarifs, filières, préinscription, internat | Groupe 2IAE",
    description:
      "Les réponses aux questions des parents et étudiants : frais de scolarité 2026-2027, filières et débouchés, préinscription en ligne, internat d'Azaguié, reconnaissance des diplômes, insertion professionnelle.",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: FAQS.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.r },
        })),
      },
      filAriane("Questions fréquentes", "/faq"),
    ],
  },
  "/centre-incubation": {
    titre: "Centres d'incubation 2IAE — de l'idée à l'entreprise pour chaque étudiant",
    description:
      "4 incubateurs accompagnent les étudiants et diplômés 2IAE dans la création de leur entreprise : bâtiment, agriculture, services. L'école des entrepreneurs forme aussi des employeurs.",
    jsonLd: [filAriane("Centre d'incubation", "/centre-incubation")],
  },
  "/objectifs": {
    titre: "Nos objectifs — former l'élite entrepreneuriale de demain | Groupe 2IAE",
    description:
      "La mission du Groupe 2IAE : former des techniciens et des entrepreneurs capables de transformer l'économie ivoirienne, par une pédagogie ancrée dans la pratique réelle.",
    jsonLd: [filAriane("Objectifs", "/objectifs")],
  },
  "/formations-seminaires": {
    titre: "Formations et séminaires professionnels — Cabinet 2IAE agréé FDFP",
    description:
      "Le Cabinet 2IAE anime des formations courtes et des séminaires pour professionnels et entreprises : création d'entreprise, comptabilité, leadership. Agréé FDFP.",
    jsonLd: [filAriane("Formations et séminaires", "/formations-seminaires")],
  },
  "/mission-cabinet": {
    titre: "Le Cabinet 2IAE — études, conseil et accompagnement des entreprises",
    description:
      "Les missions du Cabinet 2IAE : études, conseil, formation continue et accompagnement de projets pour les entreprises et institutions en Côte d'Ivoire.",
    jsonLd: [filAriane("Cabinet 2IAE", "/mission-cabinet")],
  },
};

// ---------------------------------------------------------------------------

let gabarit: string | null = null;
function chargerGabarit(): string | null {
  if (gabarit) return gabarit;
  const p = path.resolve(import.meta.dirname, "public", "index.html");
  try {
    gabarit = fs.readFileSync(p, "utf-8");
    return gabarit;
  } catch {
    return null;
  }
}

function echapper(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function rendre(meta: MetaPage, chemin: string): string | null {
  const base = chargerGabarit();
  if (!base) return null;
  const url = SITE + chemin;
  const titre = echapper(meta.titre);
  const description = echapper(meta.description);
  let html = base
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${titre}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${titre}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${description}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`);
  if (meta.image) {
    html = /property="og:image"/.test(html)
      ? html.replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${meta.image}$2`)
      : html.replace("</head>", `    <meta property="og:image" content="${meta.image}" />\n  </head>`);
  }
  if (meta.jsonLd?.length) {
    const blocs = meta.jsonLd
      .map((j) => `    <script type="application/ld+json">${JSON.stringify(j)}</script>`)
      .join("\n");
    html = html.replace("</head>", `${blocs}\n  </head>`);
  }
  return html;
}

// ── Campus numérique ────────────────────────────────────────────────────────
// Les pages /campus-numerique… sont servies avec les vraies données de la
// vitrine du campus (en cache) : un lien partagé sur WhatsApp ou Facebook
// affiche le titre du cours, le formateur et une vignette.

/** Visuel de partage par défaut : les cinq campus du réseau. */
const IMAGE_CAMPUS = SITE + "/images/reseau-groupe-2iae.jpg";
const ORGANISATION = { "@type": "EducationalOrganization", name: "Groupe Écoles 2IAE International", url: SITE };

/** Les textes viennent du campus : aucun chevron ne doit pouvoir fermer le <script> du JSON-LD. */
function sansChevrons(t: string): string {
  return t.replace(/[<>]/g, " ");
}

function resume(t: string, max = 300): string {
  const net = t.replace(/[#*_`>]/g, "").replace(/\s+/g, " ").trim();
  return net.length > max ? net.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : net;
}

/** « Docteur en IA » → « docteur en IA » après une virgule ; les sigles (« PDG ») restent intacts. */
function minusculeInitiale(t: string): string {
  return /^[A-ZÀ-ÖØ-Þ][a-zß-öø-ÿ]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

function dateAbidjan(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Abidjan", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
}

function filArianeCampus(nom: string, chemin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Campus numérique", item: SITE + "/campus-numerique" },
      { "@type": "ListItem", position: 3, name: sansChevrons(nom), item: SITE + chemin },
    ],
  };
}

function personne(f: Pick<VitrineFormateur, "prenom" | "nom"> & Partial<VitrineFormateur>) {
  return {
    "@type": "Person",
    name: sansChevrons(`${f.prenom} ${f.nom}`),
    jobTitle: f.titre ? sansChevrons(f.titre) : undefined,
    image: f.photoUrl ?? undefined,
    url: f.slug ? `${SITE}/campus-numerique/formateurs/${f.slug}` : undefined,
  };
}

function schemaCours(c: VitrineCours) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    name: sansChevrons(c.titre),
    description: sansChevrons(resume(c.accroche || c.titre)),
    courseCode: sansChevrons(c.code),
    url: `${SITE}/campus-numerique/cours/${c.slug}`,
    image: c.imageUrl ?? undefined,
    inLanguage: "fr",
    provider: ORGANISATION,
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "Blended",
      startDate: c.dateDebut ?? undefined,
      endDate: c.dateFin ?? undefined,
      instructor: c.formateur ? personne(c.formateur) : undefined,
    },
  };
}

function schemaLive(l: VitrineLive) {
  const debut = new Date(l.debut);
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: sansChevrons(`${l.coursTitre} — ${l.titre}`),
    startDate: debut.toISOString(),
    endDate: new Date(debut.getTime() + l.dureeMinutes * 60_000).toISOString(),
    eventAttendanceMode: "https://schema.org/MixedEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: { "@type": "VirtualLocation", url: l.url },
    organizer: ORGANISATION,
    performer: l.formateur ? personne(l.formateur) : undefined,
  };
}

function enregistrerSeoCampus(app: Express): void {
  app.get("/campus-numerique", async (_req, res, next) => {
    try {
      const v = await lireVitrine();
      // Le prochain live qui n'a pas encore commencé : un « en direct » serait
      // périmé dans la vignette partagée ou l'index du moteur.
      const prochain = v?.lives.find((l) => Date.parse(l.debut) > Date.now());
      const meta: MetaPage = {
        titre: "Campus numérique 2IAE — un cours, cinq campus, en direct | Groupe 2IAE",
        description:
          "Au campus numérique du Groupe 2IAE, un même formateur enseigne en direct aux salles de conférence de Riviera Palmeraie, Yopougon, Yamoussoukro, Azaguié et M'Batto, et aux étudiants connectés depuis leur téléphone." +
          (prochain ? ` Prochain cours en direct : ${prochain.coursTitre}, le ${dateAbidjan(prochain.debut)}.` : " Cours annoncés, formateurs et prochains lives."),
        image: IMAGE_CAMPUS,
        jsonLd: [
          ...(v?.cours.length
            ? [{
                "@context": "https://schema.org",
                "@type": "ItemList",
                name: "Cours annoncés au campus numérique 2IAE",
                itemListElement: v.cours.map((c, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/campus-numerique/cours/${c.slug}`, name: sansChevrons(c.titre) })),
              }]
            : []),
          ...(v?.lives ?? []).slice(0, 10).map(schemaLive),
          filAriane("Campus numérique", "/campus-numerique"),
        ],
      };
      const html = rendre(meta, "/campus-numerique");
      if (!html) return next();
      res.type("html").send(html);
    } catch {
      next();
    }
  });

  app.get("/campus-numerique/cours/:slug", async (req, res, next) => {
    try {
      const c = await coursParSlug(req.params.slug);
      if (!c) return next();
      const chemin = `/campus-numerique/cours/${c.slug}`;
      const par = c.formateur
        ? ` Avec ${c.formateur.prenom} ${c.formateur.nom}${c.formateur.localisation ? `, depuis ${c.formateur.localisation}` : ""}.`
        : "";
      const quand = c.dateDebut && Date.parse(c.dateDebut) > Date.now() ? ` Dès le ${dateAbidjan(c.dateDebut)},` : "";
      const ou = ` en direct dans ${c.nbCampus > 1 ? `nos ${c.nbCampus} campus` : "nos campus"}.`;
      const meta: MetaPage = {
        titre: `${c.titre} — cours en direct au campus numérique | Groupe 2IAE`,
        description: resume(`${c.accroche || c.titre}${par}${quand}${ou}`),
        image: c.imageUrl ?? c.formateur?.photoUrl ?? IMAGE_CAMPUS,
        jsonLd: [schemaCours(c), filArianeCampus(c.titre, chemin)],
      };
      const html = rendre(meta, chemin);
      if (!html) return next();
      res.type("html").send(html);
    } catch {
      next();
    }
  });

  app.get("/campus-numerique/formateurs/:slug", async (req, res, next) => {
    try {
      const f = await formateurParSlug(req.params.slug);
      if (!f) return next();
      const chemin = `/campus-numerique/formateurs/${f.slug}`;
      const nom = `${f.prenom} ${f.nom}`;
      const intro = [f.titre ? minusculeInitiale(f.titre) : null, f.localisation ? `depuis ${f.localisation}` : null]
        .filter(Boolean)
        .join(", ");
      const meta: MetaPage = {
        titre: `${nom} — formateur au campus numérique | Groupe 2IAE`,
        description: resume(
          `${nom}${intro ? `, ${intro}` : ""}, enseigne en direct aux étudiants des 5 campus du Groupe 2IAE.` +
            (f.bio ? ` ${f.bio}` : "") +
            (f.cours.length ? ` Cours : ${f.cours.map((c) => c.titre).join(", ")}.` : ""),
        ),
        image: f.photoUrl ?? IMAGE_CAMPUS,
        jsonLd: [
          {
            "@context": "https://schema.org",
            ...personne(f),
            description: f.bio ? sansChevrons(resume(f.bio)) : undefined,
            affiliation: ORGANISATION,
          },
          filArianeCampus(nom, chemin),
        ],
      };
      const html = rendre(meta, chemin);
      if (!html) return next();
      res.type("html").send(html);
    } catch {
      next();
    }
  });
}

/** Routes HTML avec métadonnées propres — à enregistrer AVANT le statique. */
export function enregistrerRoutesSeo(app: Express): void {
  // Campus numérique : pages alimentées par la vitrine du campus.
  enregistrerSeoCampus(app);

  // Les pages connues.
  for (const [chemin, meta] of Object.entries(PAGES)) {
    app.get(chemin, (_req, res, next) => {
      const html = rendre(meta, chemin);
      if (!html) return next();
      res.type("html").send(html);
    });
  }

  // Les articles d'actualité : titre, résumé et image réels, plus le schéma
  // NewsArticle — c'est ce que Google News et les moteurs IA lisent.
  app.get("/actualites/:slug", async (req, res, next) => {
    try {
      const article = await storage.getNewsBySlug(req.params.slug);
      if (!article || article.isActive === false) return next();
      const chemin = `/actualites/${article.slug}`;
      const meta: MetaPage = {
        titre: `${article.title} | Actualités Groupe 2IAE`,
        description: (article.summary || article.content || article.title).slice(0, 300).replace(/\s+/g, " ").trim(),
        image: article.imageUrl?.startsWith("http") ? article.imageUrl : article.imageUrl ? SITE + article.imageUrl : undefined,
        jsonLd: [
          {
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: article.title,
            description: article.summary || undefined,
            image: article.imageUrl ? [article.imageUrl.startsWith("http") ? article.imageUrl : SITE + article.imageUrl] : undefined,
            datePublished: article.date,
            author: { "@type": "Organization", name: "Groupe Écoles 2IAE International" },
            publisher: { "@type": "Organization", name: "Groupe Écoles 2IAE International", url: SITE },
            mainEntityOfPage: SITE + chemin,
          },
          filAriane(article.title, chemin),
        ],
      };
      const html = rendre(meta, chemin);
      if (!html) return next();
      res.type("html").send(html);
    } catch {
      next();
    }
  });
}
