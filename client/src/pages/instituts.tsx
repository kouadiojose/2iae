// Textes d'origine restaurés depuis l'ancien site 2iae.com
// (pages/filieres, pages/formation-genie-civil, pages/formation-management).
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Filiere = {
  nom: string;
  niveau: string;
  objectif: string;
  debouches?: string[];
  conditions: string;
};

type Institut = {
  sigle: string;
  nom: string;
  presentation?: string[];
  filieres: Filiere[];
  certificats?: string[];
};

const INSTITUTS: Institut[] = [
  {
    sigle: "IFGC",
    nom: "Institut de Formation en Génie Civil",
    presentation: [
      "Par définition, le génie civil c'est l'art de concevoir et de réaliser des ouvrages d'infrastructures. Il inclut également les bâtiments lorsque ceux-ci, par leur conception structurelle ou leur architecture, sont exceptionnels. Également, il constitue pour un pays un véritable patrimoine.",
      "De plus, avec une population à croissance galopante s'impose le besoin de maîtriser les techniques du génie civil, d'où le choix de la discipline du GÉNIE CIVIL option BÂTIMENT (GBAT) avec l'Institut de Formation en Génie Civil (IFGC) du groupe écoles 2IFE/2IAE.",
      "En outre, cette discipline permettra aux étudiants d'être financièrement indépendants. Aussi cette discipline tend-elle de plus en plus vers une industrialisation poussée, qui permettra dans le futur d'allier meilleur prix et meilleure qualité, au grand bonheur du développement d'une nation.",
    ],
    filieres: [
      {
        nom: "Génie civil option Bâtiment (GBAT)",
        niveau: "BTS et Licence professionnelle",
        objectif:
          "Former les techniciens supérieurs et les titulaires de Licence professionnelle en bâtiment capables de maîtriser les techniques du métier du bâtiment (les différentes parties d'un ouvrage, matériaux de construction, profondeur optimale d'enfouissement d'un ouvrage, métrés et prix, lecture d'un plan, suivi d'un ouvrage).",
        debouches: [
          "Responsable des études techniques et financières dans un cabinet d'architecte, un bureau d'étude technique, l'administration, les collectivités locales ou une entreprise BTP",
          "Conducteur de travaux bâtiment en entreprise BTP ou sur chantier",
          "Bureau de contrôle technique de travaux bâtiment",
          "Unité de préfabrication d'ouvrages élémentaires de génie civil",
          "Chef d'entreprise",
          "Gestionnaire d'une PME",
        ],
        conditions:
          "Être titulaire du BAC série C, D, E, F4 ou diplôme équivalent",
      },
    ],
    certificats: [
      "Conducteur de Travaux Bâtiment (CTB) — niveau minimum 3ème : à l'issue de cette formation, le technicien sera capable de gérer et diriger des chantiers",
      "Maçonnerie (niveau minimum CM2)",
      "Menuiserie (niveau minimum CM2)",
      "Électricité (niveau minimum CM2)",
      "Plomberie (niveau minimum CM2)",
      "Carrelage (niveau minimum CM2)",
    ],
  },
  {
    sigle: "IFA",
    nom: "Institut de Formation Agricole",
    presentation: [
      "L'IFA forme sur le réel : la ferme pédagogique d'Azaguié Ahoua (bovins, ovins, lapins, volailles avec des poulaillers de 3 000 sujets), le centre piscicole et ses bassins de tilapias, les champs-écoles de 10 hectares à Azaguié M'bromé et de 5 hectares à Bingerville, et des serres de pépinières (banane, cacao, palmier à huile). Cette pédagogie par la pratique a fait ses preuves : dès la session 2015, la filière ATPA réalisait 100 % d'admis au BTS.",
    ],
    filieres: [
      {
        nom: "Agriculture Tropicale option Production Végétale (ATPV)",
        niveau: "BTS et Licence professionnelle",
        objectif:
          "Former des spécialistes capables de maîtriser les techniques culturales, diagnostiquer les maladies des plantes et proposer des méthodes de lutte, encadrer les populations rurales et gérer une exploitation agricole (faire une analyse technique et économique nécessaire dans les organisations économiques situées en amont et en aval de l'exploitation agricole).",
        debouches: [
          "Chef d'exploitation agricole",
          "Responsable de production",
          "Agrochimiste",
          "Agent technico-commercial (proposer des traitements)",
          "Conseiller agricole",
        ],
        conditions:
          "Être titulaire du BAC série C, D, E, F7 ou diplôme équivalent",
      },
      {
        nom: "Agriculture Tropicale option Production Animale (ATPA)",
        niveau: "BTS et Licence professionnelle",
        objectif:
          "Former des spécialistes des techniques d'élevage et de la gestion d'une exploitation animale : conduite des troupeaux et des poulaillers, alimentation, suivi sanitaire, production et commercialisation. Les apprenants produisent et vendent réellement (volailles, poissons) sur la ferme et le centre piscicole du groupe.",
        debouches: [
          "Chef d'exploitation animale",
          "Responsable d'élevage (volailles, ovins, bovins)",
          "Responsable de production en ferme piscicole",
          "Technico-commercial en intrants et équipements d'élevage",
          "Conseiller en production animale",
          "Créateur de sa propre exploitation",
        ],
        conditions:
          "Être titulaire du BAC série A1, A2, C, D, E, F7 ou diplôme équivalent",
      },
      {
        nom: "Agriculture Tropicale — Certificat de compétences",
        niveau: "Certificat de compétences",
        objectif:
          "Former des agents d'exécution ayant des compétences en techniques culturales dans le domaine des cultures vivrières et maraîchères comme des cultures industrielles. À l'issue de la formation, le technicien sera capable de mettre en place n'importe laquelle des cultures, suivre les traitements des plantations, encadrer les populations rurales, diagnostiquer les maladies des plantes et les traiter.",
        conditions: "Avoir au moins le niveau CM2",
      },
    ],
  },
  {
    sigle: "IFM",
    nom: "Institut de Formation en Management",
    presentation: [
      "Par définition, le management est la mise en œuvre des moyens humains et matériels d'une entreprise pour l'atteinte de ses objectifs.",
      "Si le management consiste à la fois à fixer des objectifs, à choisir les moyens, mettre en œuvre ces moyens, contrôler leur mise en œuvre et les résultats et assurer une régulation, alors chacun de nous pratique quotidiennement du management, mais combien en ont conscience ? En professionnalisant ces méthodes, l'étudiant est à même de mettre sur pied son entreprise et de vivre pleinement de ses compétences, d'où la création de l'Institut de Formation en Management du groupe écoles 2IFE/2IAE.",
    ],
    filieres: [
      {
        nom: "Finance Comptabilité",
        niveau: "BTS et Licence professionnelle",
        objectif:
          "Former les techniciens supérieurs et les titulaires de Licence professionnelle en finance comptabilité ayant des connaissances approfondies dans les domaines des sciences comptables, du droit des affaires, du management, de la finance et du contrôle de gestion.",
        debouches: [
          "Assistant ou Chef Comptable",
          "Analyste Financier",
          "Responsable Financier",
          "Responsable Reporting",
          "Assistant ou Chef Trésorier",
          "Agent de Crédit",
          "Chef d'entreprise",
          "Gestionnaire d'une PME",
        ],
        conditions:
          "Être titulaire du BAC série C, D, E, B, A1, G2 ou diplôme équivalent",
      },
      {
        nom: "Marketing, Vente et Gestion Commerciale",
        niveau: "BTS et Licence professionnelle",
        objectif:
          "Former les techniciens supérieurs et les titulaires de Licence professionnelle en marketing-vente ayant des connaissances approfondies dans les domaines du marketing, de la distribution, de la vente et de la négociation commerciale, des techniques de communication et de promotion des ventes, du management de la force de vente.",
        debouches: [
          "Vendeur, Technico-commercial",
          "Promoteur des ventes",
          "Merchandiseur",
          "Chef de secteur",
          "Chef de vente",
          "Responsable de vente ou commercial",
          "Assistant chef produit / Chef produit",
          "Assistant marketing / Responsable marketing",
          "Chargé ou Responsable d'études marketing",
          "Chargé de communication et/ou de relations publiques",
          "Chef d'entreprise",
          "Gestionnaire d'une PME",
        ],
        conditions:
          "Être titulaire du BAC série A1, A2, B, C, D, G1, G2 ou équivalent",
      },
      {
        nom: "Ressources Humaines et Communication",
        niveau: "BTS et Licence professionnelle",
        objectif:
          "Former les techniciens supérieurs et les titulaires de Licence professionnelle en ressources humaines et communication capables de concevoir un projet média, prendre des décisions stratégiques en communication, connaître les moyens de communication, organiser et animer un service de communication et gérer un système d'information.",
        debouches: [
          "Chargé de la communication",
          "Chargé des relations publiques et/ou presse",
          "Responsable d'études",
          "Responsable de la publicité ou de la promotion",
          "Assistant commercial",
          "Assistant du Directeur des Ressources Humaines",
          "Gestionnaire de la paie",
          "Chargé de la formation",
        ],
        conditions:
          "Être titulaire du BAC série A1, A2, G1, G2, B, D, C ou équivalent",
      },
      {
        nom: "Logistique et Transport",
        niveau: "BTS et Licence professionnelle",
        objectif:
          "Former les techniciens supérieurs et les titulaires de Licence professionnelle capables d'accéder à l'ensemble des métiers relatifs à la logistique, que ce soit au niveau des approvisionnements, de l'entreposage, de la distribution ou de la gestion du transport.",
        debouches: [
          "Approvisionneur",
          "Responsable transport",
          "Pilote de flux",
          "Responsable d'entrepôt / de plate-forme",
          "Technicien en logistique",
          "Chargé de transit / douane",
          "Responsable du service logistique",
          "Responsable du service achat / Acheteur leader",
          "Assistant contentieux",
          "Gestionnaire de parc et lignes",
          "Gestionnaire d'une PME",
        ],
        conditions:
          "Être titulaire du BAC série G1, G2, B, A1, C, D ou équivalent",
      },
      {
        nom: "Sciences de l'Information (SI)",
        niveau: "BTS et Licence professionnelle",
        objectif:
          "Former les techniciens supérieurs et les titulaires de Licence professionnelle capables d'accéder à l'ensemble des métiers des sciences de l'information, que ce soit au niveau de l'archivistique, de la documentation ou de la bibliothéconomie.",
        debouches: [
          "Documentaliste",
          "Gestionnaire d'un CDI",
          "Cybertaliste",
          "Technicien de communication",
          "Archiviste",
          "Bibliothécaire",
          "Médiathécaire",
        ],
        conditions:
          "Être titulaire du BAC série A1, A2, B, C, D, G1, G2, H1, H2, H3 ou équivalent",
      },
    ],
  },
  {
    sigle: "IFNTIC",
    nom: "Institut de Formation aux Nouvelles Technologies de l'Information et de la Communication",
    filieres: [
      {
        nom: "Informatique – Développeur d'Application (IDA)",
        niveau: "BTS et Licence professionnelle",
        objectif:
          "Former les techniciens supérieurs et les titulaires de Licence professionnelle en informatique capables de mettre en œuvre des systèmes d'exploitation, d'administrer des réseaux locaux d'entreprise, de concevoir des plans directeurs sur les équipements Internet, électroniques, informatiques et réseautiques.",
        debouches: [
          "Chef ou responsable d'équipe de production informatique ou électronique",
          "Technicien réseaux",
          "Administrateur de site Web",
          "Analyste programmeur",
          "Développeur d'application",
        ],
        conditions:
          "Être titulaire du BAC série C, D, E, F1, F2, F3, F4 ou diplôme équivalent",
      },
    ],
    certificats: ["Maintenance informatique"],
  },
];

export default function InstitutsPage() {
  return (
    <div className="min-h-screen">
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6" data-testid="text-page-title">
            Nos Instituts
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto">
            Quatre instituts de formation, leurs filières, leurs objectifs et
            leurs débouchés. Depuis 2006, chaque étudiant du groupe — quelle
            que soit sa filière — reçoit des cours d'entrepreneuriat : c'est
            la marque de l'École des Entrepreneurs.
          </p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-5xl space-y-16">
          {INSTITUTS.map((inst) => (
            <div key={inst.sigle}>
              <div className="flex items-center gap-3 mb-4">
                <Badge className="bg-primary text-primary-foreground text-base px-3 py-1">
                  {inst.sigle}
                </Badge>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
                  {inst.nom}
                </h2>
              </div>
              {inst.presentation?.map((p) => (
                <p key={p.slice(0, 40)} className="text-gray-700 leading-relaxed mb-3">
                  {p}
                </p>
              ))}

              <div className="grid gap-6 mt-6">
                {inst.filieres.map((f) => (
                  <Card key={f.nom} className="professional-shadow border-0">
                    <CardContent className="p-6 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-bold text-gray-900">
                          {f.nom}
                        </h3>
                        <Badge variant="secondary">{f.niveau}</Badge>
                      </div>
                      <p className="text-gray-700">
                        <span className="font-semibold">Objectif : </span>
                        {f.objectif}
                      </p>
                      {f.debouches && (
                        <div>
                          <p className="font-semibold text-gray-900 mb-1">
                            Les débouchés :
                          </p>
                          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-gray-700">
                            {f.debouches.map((d) => (
                              <li key={d} className="flex gap-2">
                                <span className="text-primary font-bold">•</span>
                                <span>{d}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="text-gray-700">
                        <span className="font-semibold">
                          Conditions d'entrée :{" "}
                        </span>
                        {f.conditions}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {inst.certificats && (
                <div className="mt-6 bg-gray-50 rounded-lg p-6">
                  <p className="font-semibold text-gray-900 mb-2">
                    Formations et certificats également délivrés :
                  </p>
                  <ul className="space-y-1 text-gray-700">
                    {inst.certificats.map((c) => (
                      <li key={c} className="flex gap-2">
                        <span className="text-primary font-bold">•</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Licences professionnelles */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-3 text-center">
            Licences professionnelles
          </h2>
          <p className="text-gray-700 text-center max-w-3xl mx-auto mb-10">
            Après le BTS ou le BAC, poursuivez en licence professionnelle
            (3 ans) pour approfondir vos compétences et accéder aux fonctions
            d'encadrement — ou préparer la création de votre entreprise avec
            l'appui des centres d'incubation du groupe.
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                nom: "Management & Entrepreneuriat",
                texte:
                  "Le cœur de l'ADN de 2IAE : mobiliser les moyens humains et matériels, piloter les résultats et bâtir un projet bancable, pour créer et diriger des PME et PMI à forte valeur ajoutée.",
              },
              {
                nom: "Marketing Digital & Communication",
                texte:
                  "Les fondamentaux du marketing associés aux outils numériques : réseaux sociaux, création de contenu, image de marque — pour devenir chargé de communication digitale, responsable marketing ou consultant.",
              },
              {
                nom: "Gestion Financière & Contrôle",
                texte:
                  "Tableaux de bord, budgets, coûts de revient, audit : une licence exigeante vers les fonctions de contrôleur de gestion, analyste financier ou auditeur interne.",
              },
            ].map((l) => (
              <Card key={l.nom} className="professional-shadow border-0">
                <CardContent className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    {l.nom}
                  </h3>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {l.texte}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Certificats */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-5xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-3 text-center">
            Certificats professionnels
          </h2>
          <p className="text-gray-700 text-center max-w-3xl mx-auto mb-10">
            Des formations courtes et intensives, animées dans l'esprit des
            séminaires du Cabinet 2IAE (agréé FDFP), pour monter en compétence
            rapidement.
          </p>
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                nom: "Création & Gestion d'Entreprise",
                duree: "6 mois",
                texte:
                  "De l'idée au lancement : business plan, recherche de financement, gestion quotidienne — pour présenter un projet réellement bancable.",
              },
              {
                nom: "Comptabilité Analytique & Fiscalité",
                duree: "4 mois",
                texte:
                  "Coûts de revient, budgets et obligations fiscales dans le cadre ivoirien et l'espace OHADA, pour sécuriser la gestion de votre structure.",
              },
              {
                nom: "Leadership & Management d'Équipe",
                duree: "3 mois",
                texte:
                  "Construire son leadership, manager par objectifs, animer une équipe performante — pour cadres, chefs d'équipe et entrepreneurs.",
              },
            ].map((c) => (
              <Card key={c.nom} className="professional-shadow border-0">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{c.nom}</h3>
                    <Badge variant="secondary">{c.duree}</Badge>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {c.texte}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
