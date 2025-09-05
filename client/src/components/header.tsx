import { useState, useEffect } from "react";
import { Menu, X, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Link, useLocation } from "wouter";
import logoImage from "@assets/image_1756310296213.png";

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isActive = (path: string) => {
    if (path === "/" || path === "/accueil") {
      return location === "/" || location === "/accueil";
    }
    return location === path;
  };

  const NavLinks = () => (
    <>
      <Link
        href="/"
        className={`font-medium transition-colors hover:text-primary ${
          isActive("/") ? "text-primary" : "text-foreground"
        }`}
        data-testid="link-accueil"
      >
        Accueil
      </Link>
      <Link
        href="/filieres"
        className={`font-medium transition-colors hover:text-primary ${
          isActive("/filieres") ? "text-primary" : "text-foreground"
        }`}
        data-testid="link-filieres"
      >
        Nos Filières
      </Link>
      <Link
        href="/a-propos"
        className={`font-medium transition-colors hover:text-primary ${
          isActive("/a-propos") ? "text-primary" : "text-foreground"
        }`}
        data-testid="link-a-propos"
      >
        À Propos
      </Link>
      <Link
        href="/actualites"
        className={`font-medium transition-colors hover:text-primary ${
          isActive("/actualites") ? "text-primary" : "text-foreground"
        }`}
        data-testid="link-actualites"
      >
        Actualités
      </Link>
      <Link
        href="/galerie"
        className={`font-medium transition-colors hover:text-primary ${
          isActive("/galerie") ? "text-primary" : "text-foreground"
        }`}
        data-testid="link-galerie"
      >
        Galerie
      </Link>
      <Link
        href="/cabinet"
        className={`font-medium transition-colors hover:text-primary ${
          isActive("/cabinet") ? "text-primary" : "text-foreground"
        }`}
        data-testid="link-cabinet"
      >
        Cabinet 2IAE
      </Link>
      <Link
        href="/contact"
        className={`font-medium transition-colors hover:text-primary ${
          isActive("/contact") ? "text-primary" : "text-foreground"
        }`}
        data-testid="link-contact"
      >
        Contact
      </Link>
    </>
  );

  return (
    <header
      className={`bg-white shadow-lg sticky top-0 z-50 border-b border-border transition-shadow ${isScrolled ? "shadow-xl" : ""}`}
    >
      <div className="container mx-auto px-2 lg:px-4">
        <nav className="flex items-center justify-between py-1 lg:py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center" data-testid="logo">
            <img
              src={logoImage}
              alt="Groupe École 2IAE International"
              className="h-8 lg:h-16 w-auto object-contain"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8">
            <NavLinks />
          </div>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center space-x-4">
            <Link href="/tarifs">
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                data-testid="button-tarifs"
              >
                Nos Tarifs
              </Button>
            </Link>
            <Link href="https://campus.groupe2iae.com" target="_blank">
              <Button
                className="bg-secondary hover:bg-secondary/90 text-secondary-foreground"
                data-testid="button-campus"
              >
                Campus Numérique 2IAE
              </Button>
            </Link>
          </div>

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                className="lg:hidden"
                data-testid="button-mobile-menu"
              >
                <Menu className="h-5 w-5 lg:h-6 lg:w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <div className="flex flex-col space-y-6 mt-8">
                <NavLinks />
                <div className="flex flex-col space-y-4 pt-8 border-t border-border">
                  <Link href="/filieres">
                    <Button
                      className="bg-primary hover:bg-primary/90 text-primary-foreground w-full"
                      data-testid="button-mobile-filieres"
                    >
                      Nos Tarifs
                    </Button>
                  </Link>
                  <Link href="/campus">
                    <Button
                      className="bg-secondary hover:bg-secondary/90 text-secondary-foreground w-full"
                      data-testid="button-mobile-campus"
                    >
                      Campus 2iae
                    </Button>
                  </Link>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </nav>
      </div>
    </header>
  );
}
