import { Badge } from "@/components/ui/badge";

export default function FounderSection() {
  return (
    <section id="groupe" className="py-20 bg-gradient-to-r from-primary/5 to-secondary/5">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1">
            <Badge className="bg-primary/10 text-primary mb-6" data-testid="badge-founder-message">
              Message du Fondateur
            </Badge>
            <h2 className="text-4xl font-bold mb-6 text-foreground" data-testid="text-founder-title">
              Mot Du PDG - Fondateur
            </h2>
            <p className="text-lg text-muted-foreground mb-6 leading-relaxed" data-testid="text-founder-quote">
              "Si En Côte D'Ivoire, Les Écoles Et Les Universités Ont Réussi Dans Les Programmes De Formation Des Cadres, Les Moyennes Et Grandes Entreprises, Elles Ont Connu Moins De Succès Dans Les Programmes Destinés Aux Cadres Des Petites Entreprises, Et Moins Encore Dans La Formation D'Entrepreneurs."
            </p>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed" data-testid="text-founder-mission">
              Notre mission est de combler ce vide en formant une nouvelle génération d'entrepreneurs capables de transformer l'économie africaine.
            </p>
            <div className="flex items-center space-x-4" data-testid="founder-info">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">PDG</span>
              </div>
              <div>
                <p className="font-semibold text-foreground" data-testid="text-founder-role">
                  Directeur Général
                </p>
                <p className="text-muted-foreground" data-testid="text-founder-title-org">
                  Fondateur 2IAE International
                </p>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <img 
              src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=600&h=700"
              alt="Dirigeant d'entreprise africain professionnel"
              className="rounded-2xl shadow-2xl w-full h-auto"
              data-testid="img-founder"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
