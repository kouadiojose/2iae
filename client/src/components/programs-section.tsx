import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const programs = [
  {
    image: "https://images.unsplash.com/photo-1497486751825-1233686d5d80?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&h=300",
    category: "Entrepreneuriat",
    duration: "3 ans",
    title: "Management et Entrepreneuriat",
    description: "Formation complète en gestion d'entreprise, innovation et développement entrepreneurial.",
    color: "primary"
  },
  {
    image: "https://images.unsplash.com/photo-1556761175-b413da4baf72?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&h=300",
    category: "Digital",
    duration: "2 ans",
    title: "Marketing Digital",
    description: "Maîtrisez les outils digitaux et les stratégies marketing pour l'ère numérique.",
    color: "secondary"
  },
  {
    image: "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&h=300",
    category: "Business",
    duration: "3 ans",
    title: "Gestion des Entreprises",
    description: "Développez vos compétences en gestion, finance et stratégie d'entreprise.",
    color: "primary"
  }
];

export default function ProgramsSection() {
  return (
    <section id="filieres" className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4 text-foreground" data-testid="text-programs-title">
            Nos Filières
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto" data-testid="text-programs-subtitle">
            Découvrez nos programmes de formation conçus pour former les entrepreneurs de demain
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {programs.map((program, index) => (
            <Card key={index} className="group overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300" data-testid={`card-program-${index}`}>
              <div className="relative overflow-hidden">
                <img 
                  src={program.image}
                  alt={program.title}
                  className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
                  data-testid={`img-program-${index}`}
                />
              </div>
              <CardContent className="p-8">
                <div className="flex items-center justify-between mb-4">
                  <Badge 
                    variant={program.color === "primary" ? "default" : "secondary"}
                    className={program.color === "primary" ? "bg-primary/10 text-primary" : "bg-secondary/10 text-secondary"}
                    data-testid={`badge-program-category-${index}`}
                  >
                    {program.category}
                  </Badge>
                  <span className="text-muted-foreground text-sm" data-testid={`text-program-duration-${index}`}>
                    {program.duration}
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-card-foreground" data-testid={`text-program-title-${index}`}>
                  {program.title}
                </h3>
                <p className="text-muted-foreground mb-6" data-testid={`text-program-description-${index}`}>
                  {program.description}
                </p>
                <Button 
                  className={`w-full ${program.color === "primary" ? "bg-primary hover:bg-primary/90 text-primary-foreground" : "bg-secondary hover:bg-secondary/90 text-secondary-foreground"}`}
                  data-testid={`button-program-learn-more-${index}`}
                >
                  En savoir plus
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
