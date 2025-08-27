import { Button } from "@/components/ui/button";

export default function HeroSection() {
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section id="accueil" className="gradient-bg py-20 text-white relative overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in-up">
            <div className="inline-block bg-white/20 glass-effect px-4 py-2 rounded-full text-sm font-medium mb-6">
              Bienvenue Au Groupe École 2iae
            </div>
            <h1 className="text-5xl lg:text-6xl font-bold mb-6 leading-tight" data-testid="text-hero-title">
              L'École Des
              <span className="text-white/90"> Entrepreneurs</span>
            </h1>
            <p className="text-xl mb-8 text-white/90 leading-relaxed font-medium" data-testid="text-hero-subtitle">
              2IAE, entreprendre pour devenir l'élite de demain.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                onClick={() => scrollToSection("filieres")}
                className="bg-white text-primary hover:bg-white/90 px-8 py-4 text-lg h-auto"
                data-testid="button-visit-programs"
              >
                Visiter Nos Filières
              </Button>
              <Button 
                onClick={() => scrollToSection("groupe")}
                variant="outline"
                className="border-2 border-white text-white hover:bg-white hover:text-primary px-8 py-4 text-lg h-auto"
                data-testid="button-learn-more"
              >
                En Savoir Plus
              </Button>
            </div>
          </div>
          <div className="animate-fade-in-up">
            <img 
              src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=600" 
              alt="Étudiants collaborant dans un environnement moderne" 
              className="rounded-2xl shadow-2xl w-full h-auto"
              data-testid="img-hero"
            />
          </div>
        </div>
      </div>
      
      {/* Background Elements */}
      <div className="absolute top-20 right-20 w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
      <div className="absolute bottom-20 left-20 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
    </section>
  );
}
