import { Target, Eye, Award, Users2, MapPin, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import schoolBrochureImage from "@assets/image_1756295342176.png";

const values = [
  {
    icon: Target,
    title: "Excellence",
    description: "Nous visons l'excellence dans toutes nos formations et accompagnements pédagogiques."
  },
  {
    icon: Eye,
    title: "Vision Entrepreneuriale",
    description: "Développer l'esprit entrepreneurial et l'innovation chez nos étudiants."
  },
  {
    icon: Award,
    title: "Qualité",
    description: "Standards internationaux avec reconnaissance des diplômes."
  },
  {
    icon: Users2,
    title: "Communauté",
    description: "Créer un réseau solide d'anciens étudiants et partenaires."
  }
];

const milestones = [
  {
    year: "2010",
    title: "Création de 2IAE",
    description: "Fondation de l'école avec une vision d'excellence entrepreneuriale"
  },
  {
    year: "2015",
    title: "Partenariat International",
    description: "Signature du partenariat avec l'Université de Sherbrooke, Canada"
  },
  {
    year: "2018",
    title: "Homologation des Diplômes",
    description: "Reconnaissance officielle de nos programmes Post-BTS"
  },
  {
    year: "2020",
    title: "Campus Moderne",
    description: "Inauguration de notre nouveau campus à Abidjan"
  },
  {
    year: "2023",
    title: "Centre d'Incubation",
    description: "Ouverture du centre d'incubation opérationnel"
  }
];

const stats = [
  {
    number: "1000+",
    label: "Diplômés",
    description: "Anciens étudiants réussissent dans leurs carrières"
  },
  {
    number: "95%",
    label: "Taux de Placement",
    description: "Nos diplômés trouvent un emploi dans les 6 mois"
  },
  {
    number: "50+",
    label: "Entreprises Partenaires",
    description: "Réseau solide pour stages et emplois"
  },
  {
    number: "13+",
    label: "Années d'Excellence",
    description: "D'expérience dans la formation entrepreneuriale"
  }
];

export default function AProposPage() {
  return (
    <div className="min-h-screen pt-20">
      {/* Header Section */}
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6" data-testid="text-page-title">
            À Propos de 2IAE International
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto" data-testid="text-page-subtitle">
            L'École où l'apprentissage prend vie, formant l'élite entrepreneuriale de demain
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="bg-primary/10 text-primary mb-6" data-testid="badge-mission">
                Notre Mission
              </Badge>
              <h2 className="text-4xl font-bold mb-6 text-foreground" data-testid="text-mission-title">
                Former les Entrepreneurs de Demain
              </h2>
              <div className="space-y-6 text-lg text-muted-foreground">
                <p data-testid="text-mission-paragraph-1">
                  <strong className="text-foreground">2IAE International</strong> est né d'une vision claire : combler le vide dans la formation entrepreneuriale en Côte d'Ivoire. Contrairement aux formations traditionnelles axées sur les grandes entreprises, nous nous concentrons sur la création d'entrepreneurs capables de transformer l'économie africaine.
                </p>
                <p data-testid="text-mission-paragraph-2">
                  Notre approche pédagogique moderne combine théorie et pratique, avec des outils digitaux de pointe et un accompagnement personnalisé. Nous formons des leaders capables de créer de la valeur et des emplois.
                </p>
                <p data-testid="text-mission-paragraph-3">
                  Avec notre partenariat international et nos programmes homologués, nous offrons une formation d'excellence reconnue à l'international tout en restant ancrés dans la réalité économique africaine.
                </p>
              </div>
            </div>
            <div className="relative">
              <img 
                src={schoolBrochureImage}
                alt="Groupe Écoles 2IAE International"
                className="rounded-2xl professional-shadow w-full h-auto"
                data-testid="img-mission"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" data-testid="text-values-title">
              Nos Valeurs
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto" data-testid="text-values-subtitle">
              Les principes qui guident notre approche pédagogique et notre engagement envers l'excellence
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => {
              const IconComponent = value.icon;
              return (
                <Card key={index} className="text-center hover-lift professional-shadow border-0" data-testid={`card-value-${index}`}>
                  <CardContent className="p-8">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                      <IconComponent className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold mb-4" data-testid={`text-value-title-${index}`}>
                      {value.title}
                    </h3>
                    <p className="text-muted-foreground" data-testid={`text-value-description-${index}`}>
                      {value.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" data-testid="text-timeline-title">
              Notre Histoire
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto" data-testid="text-timeline-subtitle">
              Plus de 13 années d'innovation et d'excellence dans l'enseignement entrepreneurial
            </p>
          </div>
          
          <div className="relative">
            <div className="absolute left-1/2 transform -translate-x-1/2 w-1 bg-primary/20 h-full"></div>
            
            <div className="space-y-12">
              {milestones.map((milestone, index) => (
                <div key={index} className={`flex items-center ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`} data-testid={`milestone-${index}`}>
                  <div className={`w-1/2 ${index % 2 === 0 ? 'pr-8 text-right' : 'pl-8 text-left'}`}>
                    <Card className="hover-lift professional-shadow">
                      <CardContent className="p-6">
                        <Badge className="bg-primary text-primary-foreground mb-4" data-testid={`badge-milestone-year-${index}`}>
                          {milestone.year}
                        </Badge>
                        <h3 className="text-xl font-bold mb-2" data-testid={`text-milestone-title-${index}`}>
                          {milestone.title}
                        </h3>
                        <p className="text-muted-foreground" data-testid={`text-milestone-description-${index}`}>
                          {milestone.description}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="w-6 h-6 bg-primary rounded-full border-4 border-background relative z-10"></div>
                  
                  <div className="w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 gradient-bg text-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4" data-testid="text-stats-title">
              2IAE en Chiffres
            </h2>
            <p className="text-xl text-white/90 max-w-3xl mx-auto" data-testid="text-stats-subtitle">
              Des résultats qui témoignent de notre engagement envers l'excellence
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center" data-testid={`stat-${index}`}>
                <div className="text-5xl font-bold mb-2" data-testid={`text-stat-number-${index}`}>
                  {stat.number}
                </div>
                <div className="text-2xl font-semibold mb-2" data-testid={`text-stat-label-${index}`}>
                  {stat.label}
                </div>
                <div className="text-white/80" data-testid={`text-stat-description-${index}`}>
                  {stat.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Leadership Section */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <Badge className="bg-secondary/10 text-secondary mb-6" data-testid="badge-leadership">
                Leadership
              </Badge>
              <h2 className="text-4xl font-bold mb-6 text-foreground" data-testid="text-leadership-title">
                Message du Fondateur
              </h2>
              <blockquote className="text-lg text-muted-foreground mb-6 italic border-l-4 border-primary pl-6" data-testid="text-founder-quote">
                "Si en Côte D'Ivoire, les Écoles et les Universités ont réussi dans les programmes de formation des cadres, les moyennes et grandes entreprises, elles ont connu moins de succès dans les programmes destinés aux cadres des petites entreprises, et moins encore dans la formation d'entrepreneurs."
              </blockquote>
              <p className="text-lg text-muted-foreground mb-8" data-testid="text-founder-vision">
                Cette vision a donné naissance à 2IAE International, une institution dédiée à combler ce vide et à former une nouvelle génération d'entrepreneurs africains.
              </p>
              <div className="flex items-center space-x-4" data-testid="founder-info">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-lg">PDG</span>
                </div>
                <div>
                  <p className="font-semibold text-foreground" data-testid="text-founder-role">
                    Directeur Général & Fondateur
                  </p>
                  <p className="text-muted-foreground" data-testid="text-founder-org">
                    2IAE International
                  </p>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <img 
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=700"
                alt="Fondateur 2IAE International"
                className="rounded-2xl professional-shadow w-full h-auto"
                data-testid="img-founder"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-20 bg-muted">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6" data-testid="text-cta-title">
            Rejoignez Notre Communauté
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto" data-testid="text-cta-subtitle">
            Découvrez comment 2IAE International peut transformer votre avenir professionnel
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button 
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg h-auto"
                data-testid="button-cta-contact"
              >
                Nous Contacter
              </Button>
            </Link>
            <Link href="/filieres">
              <Button 
                variant="outline"
                className="px-8 py-4 text-lg h-auto"
                data-testid="button-cta-programs"
              >
                Voir nos Filières
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}