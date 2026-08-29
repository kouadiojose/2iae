// Vidéothèque restaurée depuis l'ancien site 2iae.com (pages/videotheque) :
// les 59 vidéos YouTube publiées par le groupe, avec leurs titres d'origine.
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Play } from "lucide-react";

const VIDEOS: { id: string; titre: string }[] = [
  { id: "TYMsQL97tO4", titre: "Film de présentation du groupe 2IFE/2IAE" },
  { id: "Bi2gxLiGi28", titre: "Présentation du groupe écoles 2IAE" },
  { id: "Rkr82W-cG3c", titre: "Le groupe écoles 2IAE international" },
  { id: "PRfVVo3xFtQ", titre: "Les forces et avantages du Groupe écoles 2IAE international" },
  { id: "HdYP7CxQjIY", titre: "Bienvenue à la meilleure université de l'entrepreneuriat — le Groupe Écoles 2IAE" },
  { id: "hKpt_P694Zw", titre: "À la découverte de l'Université de l'Entrepreneuriat" },
  { id: "D_dTOOHHzvM", titre: "Spot 2IAE" },
  { id: "fyrfiVo5O0U", titre: "Spot 2IAE (TV)" },
  { id: "x12uHO1S-Zc", titre: "Publi-reportage 2IAE" },
  { id: "se9StlmPGrc", titre: "Publireportage Campus numérique 2IAE" },
  { id: "kwf5wdyD-aw", titre: "Le campus numérique du groupe écoles 2IAE" },
  { id: "_84fpNLlprI", titre: "Reportage Digital Learning — 2IAE" },
  { id: "9PqadmFXJFw", titre: "Accéder à ses cours sur la plateforme de cours en ligne : Campus 2IAE (niveau Licence)" },
  { id: "sVRpklA0vjI", titre: "Accéder à son espace étudiant 2IAE" },
  { id: "SxDDNVvSYZc", titre: "Accéder à la classe du Campus Numérique 2IAE" },
  { id: "OaseOLm8en4", titre: "Témoignage étudiants 2IAE — Pratique" },
  { id: "k_nQqttfZJA", titre: "Témoignages 2IAE — Tout le monde a sa place au Groupe 2IAE" },
  { id: "FnnI71-42xQ", titre: "Témoignage des étudiants admissibles au BTS 2022" },
  { id: "pXqdVrjDNDc", titre: "Les étudiants en génie civil reçoivent des équipements didactiques et s'y exercent" },
  { id: "psSgv_und1c", titre: "Les étudiants en génie civil s'exercent avec leurs équipements didactiques" },
  { id: "qzGzpdJKrb0", titre: "La formation en bâtiment à 2IAE" },
  { id: "3-oC6Q6-2rU", titre: "Les filières de Management du groupe 2IAE" },
  { id: "KNED-0cu95w", titre: "Devenez entrepreneurs dans le domaine agricole" },
  { id: "e7_aS2jj0hE", titre: "L'entrepreneuriat dans le milieu agricole" },
  { id: "Mf_URvDNrCU", titre: "2IFE/2IAE et AVA font la promotion du secteur agricole en Côte d'Ivoire" },
  { id: "Nq35VAanh3Q", titre: "Les apprenants produisent et vendent du poulet" },
  { id: "GVOYLYs3Wr8", titre: "Reportage de Business 24 sur l'ouverture de la vente de poisson du groupe 2IAE" },
  { id: "vP1QjLhk2iQ", titre: "Immigration au Canada — le groupe écoles 2IAE et Recrulink Canada formalisent leur partenariat" },
  { id: "vidUnBB6o58", titre: "Le Groupe École 2IAE remet les attestations de travail en présence de Recrulink Canada" },
  { id: "CC4oP9QSkcQ", titre: "Le vice-doyen de l'Université de Sherbrooke à l'Université de l'Entrepreneuriat — 2IAE" },
  { id: "KY_cP1Bb-5Q", titre: "C'midi : Caroline Dasylva parle de la visite de I&P à l'Université de l'Entrepreneuriat" },
  { id: "PVzl9f0G074", titre: "I&P était au Groupe 2IAE — Radio CI" },
  { id: "VpSKGmUuWFk", titre: "Investisseurs & Partenaires effectuent une visite de suivi-évaluation au Groupe Écoles 2IAE" },
  { id: "z2yFuxXwxhs", titre: "Visite d'une délégation de l'Union Européenne sur le site d'Azaguié Ahoua" },
  { id: "V_0zn0FwaW4", titre: "1ère rencontre des anciens 2IAE avec le PDG du Groupe 2IAE" },
  { id: "CR7wwX5q9r4", titre: "Espace Parents" },
  { id: "ZTvwXTJFPDY", titre: "Réhabilitation du site Azaguié M'bromé 2" },
  { id: "D2-U4TtAdxg", titre: "Visite du chantier de l'Université de l'Entrepreneuriat à Azaguié (20/12/2017)" },
  { id: "5nhs7AFesZU", titre: "Visite du chantier de l'Université de l'Entrepreneuriat à Azaguié — suite" },
  { id: "xzGmDC04SMc", titre: "Séminaire sur la Gestion Axée sur les Résultats" },
  { id: "d9SPcQkrcSM", titre: "Le groupe 2IAE vous invite au séminaire sur la Gestion Axée sur les Résultats" },
  { id: "b0Fy6nN949E", titre: "Séminaire de haut niveau — acte II au Canada" },
  { id: "cU_uTxV5s-4", titre: "Séminaire de haut niveau acte II au Canada — suite" },
  { id: "SGrxU9SfYvM", titre: "Séminaire : la gestion des matières résiduelles au Québec et ponts avec la Côte d'Ivoire" },
  { id: "_r876Yz5aCM", titre: "Spot d'annonce du séminaire sur l'environnement" },
  { id: "5hQB0X0Ud9o", titre: "Invitation de M. François Lafortune" },
  { id: "YYJ1KK6-t1s", titre: "Intervention de M. Lafortune sur RTI 1" },
  { id: "xueDrws5rpY", titre: "Lancement de la formation de 150 migrants et membres de la communauté à Azaguié" },
  { id: "AolbCJ7rZDg", titre: "Cérémonie de clôture de la formation de 50 ex-migrants" },
  { id: "MomQHE0zJgI", titre: "Focus sur les ex-migrants" },
  { id: "bvKfU5ybbqE", titre: "Le groupe 2IFE/2IAE participe aux journées des orientations des nouveaux bacheliers" },
  { id: "Q51w7mxicmc", titre: "La journée culturelle 2019 en images" },
  { id: "sFXvxHsw1YY", titre: "Bonne rentrée académique 2019-2020" },
  { id: "0hQ3ZaRBbs8", titre: "Les actions de 2IAE 2018-2019" },
  { id: "XiCFH5Ls-Hg", titre: "Le groupe 2IAE vous souhaite une très bonne année 2020" },
  { id: "gwpBDivHRt4", titre: "Le fondateur du groupe écoles 2IAE International à Matin Bonheur (RTI)" },
  { id: "usPX7F-q6j8", titre: "2ème passage du fondateur du groupe écoles 2IAE International à Matin Bonheur (RTI)" },
  { id: "WiFH-AtXiWs", titre: "3ème et dernier passage du fondateur du groupe écoles 2IAE International à Matin Bonheur" },
  { id: "nS0uWVcrtCI", titre: "Reportage RTI" },
];

function Video({ id, titre }: { id: string; titre: string }) {
  const [lecture, setLecture] = useState(false);
  return (
    <Card className="overflow-hidden professional-shadow border-0">
      <div className="relative aspect-video bg-black">
        {lecture ? (
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${id}?autoplay=1`}
            title={titre}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            onClick={() => setLecture(true)}
            className="absolute inset-0 w-full h-full group"
            aria-label={`Lire : ${titre}`}
            data-testid={`video-${id}`}
          >
            <img
              src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`}
              alt={titre}
              loading="lazy"
              className="w-full h-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
              <span className="bg-primary rounded-full p-4">
                <Play className="h-8 w-8 text-white fill-white" />
              </span>
            </span>
          </button>
        )}
      </div>
      <p className="p-4 font-medium text-gray-900 text-sm leading-snug">
        {titre}
      </p>
    </Card>
  );
}

export default function VideothequePage() {
  return (
    <div className="min-h-screen">
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6" data-testid="text-page-title">
            Vidéothèque
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto">
            {VIDEOS.length} vidéos du Groupe Écoles 2IAE International :
            reportages, témoignages, séminaires et vie des campus
          </p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {VIDEOS.map((v) => (
            <Video key={v.id} {...v} />
          ))}
        </div>
      </section>
    </div>
  );
}
