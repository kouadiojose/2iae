import { GraduationCap, Tag, Laptop, HandHeart, Building, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const advantages = [
  {
    icon: GraduationCap,
    title: "Partenariat Université de Sherbrooke",
    description: "Notre partenariat avec l'Université de Sherbrooke au Canada offre une reconnaissance internationale.",
    color: "primary"
  },
  {
    icon: Tag,
    title: "Homologation des diplômes Post-BTS",
    description: "Nos diplômes sont reconnus et homologués selon les standards internationaux.",
    color: "secondary"
  },
  {
    icon: Laptop,
    title: "Digitalisation des formations",
    description: "Formations modernes intégrant les dernières technologies éducatives.",
    color: "primary"
  },
  {
    icon: HandHeart,
    title: "Supports pédagogiques",
    description: "Accompagnement personnalisé avec des supports pédagogiques adaptés.",
    color: "secondary"
  },
  {
    icon: Building,
    title: "Visites d'entreprises",
    description: "Immersion professionnelle avec des visites d'entreprises partenaires.",
    color: "primary"
  },
  {
    icon: Users,
    title: "Stages garantis",
    description: "Programme de stages garantis dans des entreprises de renom.",
    color: "secondary"
  }
];

export default function AdvantagesSection() {
  return (
    <section className="py-20 bg-muted">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4 text-foreground" data-testid="text-advantages-title">
            Nos Avantages
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto" data-testid="text-advantages-subtitle">
            Découvrez pourquoi 2IAE International est le choix privilégié des futurs entrepreneurs
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {advantages.map((advantage, index) => {
            const IconComponent = advantage.icon;
            return (
              <Card key={index} className="hover:shadow-xl transition-shadow" data-testid={`card-advantage-${index}`}>
                <CardContent className="p-8">
                  <div className={`w-16 h-16 bg-${advantage.color}/10 rounded-xl flex items-center justify-center mb-6`}>
                    <IconComponent className={`text-${advantage.color} text-2xl h-8 w-8`} />
                  </div>
                  <h3 className="text-xl font-bold mb-4 text-card-foreground" data-testid={`text-advantage-title-${index}`}>
                    {advantage.title}
                  </h3>
                  <p className="text-muted-foreground" data-testid={`text-advantage-description-${index}`}>
                    {advantage.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
