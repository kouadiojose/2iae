// Textes d'origine restaurés depuis l'ancien site 2iae.com (pages/formation).
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const CATALOGUES: { domaine: string; themes: string[] }[] = [
  {
    domaine: "Gestion des Ressources Humaines",
    themes: [
      "Initiation à la gestion des Ressources Humaines",
      "Mise en place d'un système transparent de rémunération",
      "Mise en place d'un système transparent d'évaluation du personnel",
      "Mise en place d'un plan de carrière du personnel au sein d'une organisation",
      "Concevoir un dispositif de formation au service d'une stratégie de développement",
      "Gestion administrative du personnel",
      "Pratique de la gestion prévisionnelle des emplois et des compétences",
      "Gestion optimale des relations avec les instances représentatives du personnel",
      "Maîtrise des techniques de recrutement",
      "Élaborer le TRR et les fiches fonctions",
    ],
  },
  {
    domaine: "Management",
    themes: [
      "Initiation au management pour les cadres",
      "Maîtriser la dimension humaine du changement dans l'organisation",
      "Construire et développer son leadership",
      "Management stratégique",
      "Management opérationnel",
      "Améliorer ses compétences managériales",
      "Pratique du management par objectif",
      "Le management de la performance",
      "Conception d'un plan de développement stratégique",
      "Top management",
    ],
  },
  {
    domaine: "Organisation",
    themes: [
      "Initiation à l'organisation des entreprises",
      "Maîtriser la rédaction des manuels de procédures de gestion",
      "Maîtriser la rédaction des modes opératoires",
      "Développement d'outils organiques",
      "Restructuration d'une organisation",
      "Structuration d'une nouvelle organisation",
      "Maîtriser les techniques d'organisation",
      "Comment auditer l'organisation de ses services",
      "Organiser le travail de son équipe",
      "Optimiser l'efficacité de son organisation administrative et comptable",
    ],
  },
  {
    domaine: "Ingénierie des Projets",
    themes: [
      "Initiation à la gestion des projets pour cadres",
      "Perfectionnement à la coordination de projets internationaux",
      "Maîtriser les différentes étapes de la vie d'un projet de développement",
      "Pratique des études de faisabilité pour projets de développement internationaux",
      "Pratique des études de faisabilité pour projets d'entreprises",
      "Conception et analyse des projets de développement des PME/PMI",
      "Maîtriser le suivi-évaluation d'un projet",
      "Entrepreneuriat",
      "Gestion financière et comptable des projets",
      "Maîtrise des normes internationales et pratique des bailleurs de fonds des projets de développement",
    ],
  },
  {
    domaine: "Audit et Contrôle de Gestion",
    themes: [
      "Initiation au contrôle de gestion pour cadres",
      "Montage des tableaux de bord de gestion",
      "Montage des budgets",
      "Élaboration du PAA, du plan triennal glissant, du plan quinquennal et du plan décennal",
      "Mise en place d'un système de détermination des normes et des coûts de revient",
      "Initiation à l'audit",
      "Pratique de l'audit organisationnel",
      "Pratique de l'audit opérationnel",
      "Pratique de l'audit financier et comptable",
      "Organisation d'un service et pratique de l'audit interne",
    ],
  },
  {
    domaine: "Droit",
    themes: [
      "Présentation du traité OHADA",
      "Droit du travail (nouveau code du travail de Côte d'Ivoire)",
      "Présentation de la convention collective",
      "Maîtrise des rapports avec les délégués du personnel et les délégués syndicaux",
      "Les obligations légales de l'organisation, de sa création à sa dissolution",
      "Le droit du crédit",
      "Techniques de prévention et gestion des contentieux, procédure simplifiée de recouvrement et voies d'exécution",
      "Droit des sociétés",
      "Les voies de recours juridiques pour les sociétés en difficulté financière",
      "Comment procéder à un licenciement collectif ou à une compression en minimisant les risques juridiques",
    ],
  },
  {
    domaine: "Informatique",
    themes: [
      "Initiation à la micro-informatique",
      "Initiation à Word, Excel, Access, Publisher, PowerPoint",
      "Perfectionnement à Word, Excel, Access, Publisher, PowerPoint",
      "Internet",
      "Gestion d'un parc d'ordinateurs",
      "Sécurité dans un système informatique",
      "Gestion des projets informatiques",
      "Élaborer un schéma directeur",
      "Concevoir un système d'information",
      "Technologie des bases de données",
    ],
  },
  {
    domaine: "Communication",
    themes: [
      "Initiation à la communication d'entreprise",
      "Les techniques de rédaction administrative",
      "Les techniques d'expression orale",
      "Comment préparer et animer tous les types de réunions",
      "Le rapport annuel : règles d'élaboration et meilleures pratiques",
      "La pratique des conseils d'administration et des assemblées générales",
      "Comment promouvoir l'image de marque de l'entreprise par la communication externe",
      "La résolution des conflits et les techniques modernes de négociation",
      "Comment élaborer et exécuter le plan de communication d'une entreprise",
      "Comment évaluer en permanence la satisfaction des clients",
    ],
  },
  {
    domaine: "Secrétariat",
    themes: [
      "Les techniques de base du secrétariat",
      "Les techniques d'accueil et de communication",
      "Les techniques de gestion du courrier, classement et archivage",
      "Perfectionnement de la secrétaire",
      "Organisation du secrétariat et gestion du temps",
      "Rédaction administrative pour la secrétaire ou l'assistante",
      "Comment mieux communiquer avec son environnement",
      "Techniques de prise de notes : rédiger vite et bien",
      "Le téléphone, une arme puissante pour la secrétaire ou l'assistante",
      "Comment intégrer l'approche qualité dans la mission d'une secrétaire ou d'une assistante",
    ],
  },
  {
    domaine: "Entrepreneuriat",
    themes: [
      "Le tri des idées",
      "Démarche de création d'une entreprise",
      "Gérer mieux son entreprise",
      "Administration et protocole",
      "Création, redressement et reprise d'entreprise",
      "Élaboration d'un plan d'affaires ou business plan",
      "Techniques de recherche de financement",
      "Management stratégique de l'activité",
      "Management de projet",
      "Intervention en entreprise",
    ],
  },
  {
    domaine: "Qualité Totale",
    themes: [
      "Initiation à la qualité totale",
      "Politique de qualité totale en entreprise : quels enjeux ?",
      "Pratique de la démarche qualité totale",
      "Mise en place d'une démarche qualité totale en vue de la certification",
      "Management et qualité totale",
      "Système de management intégré : qualité – environnement – sécurité",
      "Organiser la veille réglementaire et normative",
      "Piloter vos processus pour en améliorer l'efficacité et l'efficience",
      "Développer et piloter l'excellence au sein de votre entreprise",
      "Préparer votre accréditation niveaux 1 & 2",
    ],
  },
  {
    domaine: "Génie Civil et Travaux Publics",
    themes: ["Organisation et gestion de chantier", "Application de DAO"],
  },
];

export default function FormationsSeminairesPage() {
  return (
    <div className="min-h-screen">
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6" data-testid="text-page-title">
            Formations & Séminaires
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto">
            Le catalogue des séminaires de formation continue du Cabinet 2IAE —
            environ 100 thèmes dans tous les domaines de la gestion
          </p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-4xl">
          <Accordion type="multiple" className="w-full">
            {CATALOGUES.map((cat) => (
              <AccordionItem key={cat.domaine} value={cat.domaine}>
                <AccordionTrigger className="text-lg font-semibold text-gray-900">
                  Séminaires : {cat.domaine}
                </AccordionTrigger>
                <AccordionContent>
                  <ul className="space-y-2 text-gray-700">
                    {cat.themes.map((t) => (
                      <li key={t} className="flex gap-2">
                        <span className="text-primary font-bold">•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </div>
  );
}
