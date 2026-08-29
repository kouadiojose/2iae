import { useState, useEffect } from "react";
import { Menu, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "wouter";
import logoImage from "@assets/image_1756310296213.png";

const GROUPE_LINKS = [
  { href: "/a-propos", label: "À Propos" },
  { href: "/historique", label: "Historique" },
  { href: "/objectifs", label: "Objectifs & Missions" },
  { href: "/instituts", label: "Nos Instituts" },
  { href: "/universite-entrepreneuriat", label: "Université de l'Entrepreneuriat" },
  { href: "/nous-trouver", label: "Où nous trouver ?" },
];

const GALERIE_LINKS = [
  { href: "/galerie", label: "Galerie Photos" },
  { href: "/videotheque", label: "Vidéothèque" },
];

const CABINET_LINKS = [
  { href: "/cabinet", label: "Nos Projets" },
  { href: "/mission-cabinet", label: "Mission du Cabinet" },
  { href: "/centre-incubation", label: "Centre d'Incubation" },
  { href: "/formations-seminaires", label: "Formations & Séminaires" },
];

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

  const linkClass = (path: string) =>
    `font-medium transition-colors hover:text-primary ${
      isActive(path) ? "text-primary" : "text-foreground"
    }`;

  const groupClass = (links: { href: string }[]) =>
    `font-medium transition-colors hover:text-primary flex items-center gap-1 ${
      links.some((l) => isActive(l.href)) ? "text-primary" : "text-foreground"
    }`;

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
          <div className="hidden lg:flex items-center space-x-6">
            <Link href="/" className={linkClass("/")} data-testid="link-accueil">
              Accueil
            </Link>
            <Link
              href="/filieres"
              className={linkClass("/filieres")}
              data-testid="link-filieres"
            >
              Nos Filières
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger
                className={groupClass(GROUPE_LINKS)}
                data-testid="menu-groupe"
              >
                Le Groupe <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {GROUPE_LINKS.map((l) => (
                  <DropdownMenuItem key={l.href} asChild>
                    <Link href={l.href} className="w-full cursor-pointer">
                      {l.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Link
              href="/actualites"
              className={linkClass("/actualites")}
              data-testid="link-actualites"
            >
              Actualités
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={groupClass(GALERIE_LINKS)}
                data-testid="menu-galerie"
              >
                Galerie <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {GALERIE_LINKS.map((l) => (
                  <DropdownMenuItem key={l.href} asChild>
                    <Link href={l.href} className="w-full cursor-pointer">
                      {l.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger
                className={groupClass(CABINET_LINKS)}
                data-testid="menu-cabinet"
              >
                Cabinet 2IAE <ChevronDown className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {CABINET_LINKS.map((l) => (
                  <DropdownMenuItem key={l.href} asChild>
                    <Link href={l.href} className="w-full cursor-pointer">
                      {l.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Link
              href="/contact"
              className={linkClass("/contact")}
              data-testid="link-contact"
            >
              Contact
            </Link>
          </div>

          {/* CTA Buttons */}
          <div className="hidden lg:flex items-center space-x-3">
            <Link href="/preinscription">
              <Button
                className="bg-orange-500 hover:bg-orange-600 text-white font-bold"
                data-testid="button-preinscription"
              >
                Préinscription
              </Button>
            </Link>
            <Link href="/tarifs">
              <Button
                variant="outline"
                className="border-primary text-primary hover:bg-primary/5"
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
                Campus Numérique
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
            <SheetContent side="right" className="w-[300px] sm:w-[400px] overflow-y-auto">
              <div className="flex flex-col space-y-4 mt-8">
                <Link href="/" className={linkClass("/")}>
                  Accueil
                </Link>
                <Link href="/filieres" className={linkClass("/filieres")}>
                  Nos Filières
                </Link>
                <p className="text-sm font-semibold text-muted-foreground uppercase pt-2">
                  Le Groupe
                </p>
                {GROUPE_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`pl-4 ${linkClass(l.href)}`}
                  >
                    {l.label}
                  </Link>
                ))}
                <Link href="/actualites" className={linkClass("/actualites")}>
                  Actualités
                </Link>
                <Link href="/galerie" className={linkClass("/galerie")}>
                  Galerie Photos
                </Link>
                <Link href="/videotheque" className={linkClass("/videotheque")}>
                  Vidéothèque
                </Link>
                <p className="text-sm font-semibold text-muted-foreground uppercase pt-2">
                  Cabinet 2IAE
                </p>
                {CABINET_LINKS.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className={`pl-4 ${linkClass(l.href)}`}
                  >
                    {l.label}
                  </Link>
                ))}
                <Link href="/contact" className={linkClass("/contact")}>
                  Contact
                </Link>
                <div className="flex flex-col space-y-4 pt-6 border-t border-border">
                  <Link href="/preinscription">
                    <Button
                      className="bg-orange-500 hover:bg-orange-600 text-white font-bold w-full"
                      data-testid="button-mobile-preinscription"
                    >
                      Préinscription
                    </Button>
                  </Link>
                  <Link href="/tarifs">
                    <Button
                      className="bg-primary hover:bg-primary/90 text-primary-foreground w-full"
                      data-testid="button-mobile-tarifs"
                    >
                      Nos Tarifs
                    </Button>
                  </Link>
                  <Link href="https://campus.groupe2iae.com" target="_blank">
                    <Button
                      className="bg-secondary hover:bg-secondary/90 text-secondary-foreground w-full"
                      data-testid="button-mobile-campus"
                    >
                      Campus Numérique 2IAE
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
