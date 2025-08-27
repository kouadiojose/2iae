import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const NavLinks = () => (
    <>
      <button 
        onClick={() => scrollToSection("accueil")}
        className="text-foreground hover:text-primary font-medium transition-colors"
        data-testid="link-accueil"
      >
        Accueil
      </button>
      <button 
        onClick={() => scrollToSection("filieres")}
        className="text-foreground hover:text-primary font-medium transition-colors"
        data-testid="link-filieres"
      >
        Nos Filières
      </button>
      <button 
        onClick={() => scrollToSection("actualites")}
        className="text-foreground hover:text-primary font-medium transition-colors"
        data-testid="link-actualites"
      >
        Actualités
      </button>
      <button 
        onClick={() => scrollToSection("cabinet")}
        className="text-foreground hover:text-primary font-medium transition-colors"
        data-testid="link-cabinet"
      >
        Cabinet 2iae
      </button>
      <button 
        onClick={() => scrollToSection("groupe")}
        className="text-foreground hover:text-primary font-medium transition-colors"
        data-testid="link-groupe"
      >
        Le Groupe
      </button>
      <button 
        onClick={() => scrollToSection("espaces")}
        className="text-foreground hover:text-primary font-medium transition-colors"
        data-testid="link-espaces"
      >
        Espaces
      </button>
      <button 
        onClick={() => scrollToSection("contact")}
        className="text-foreground hover:text-primary font-medium transition-colors"
        data-testid="link-contact"
      >
        Contact
      </button>
    </>
  );

  return (
    <header className={`bg-white shadow-lg sticky top-0 z-50 border-b border-border transition-shadow ${isScrolled ? 'shadow-xl' : ''}`}>
      <div className="container mx-auto px-4">
        <nav className="flex items-center justify-between py-4">
          {/* Logo */}
          <div className="flex items-center space-x-3" data-testid="logo">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">2IAE</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg text-foreground">Groupe Écoles</span>
              <span className="text-sm text-muted-foreground">2IAE International</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            <NavLinks />
          </div>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center space-x-4">
            <Button 
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              data-testid="button-tarifs"
            >
              Nos Tarifs
            </Button>
            <Button 
              className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
              data-testid="button-campus"
            >
              Campus 2iae
            </Button>
          </div>

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" className="lg:hidden" data-testid="button-mobile-menu">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <div className="flex flex-col space-y-6 mt-8">
                <NavLinks />
                <div className="flex flex-col space-y-4 pt-8 border-t border-border">
                  <Button 
                    className="bg-primary hover:bg-primary/90 text-primary-foreground w-full"
                    data-testid="button-mobile-tarifs"
                  >
                    Nos Tarifs
                  </Button>
                  <Button 
                    className="bg-secondary hover:bg-secondary/90 text-secondary-foreground w-full"
                    data-testid="button-mobile-campus"
                  >
                    Campus 2iae
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </nav>
      </div>
    </header>
  );
}
