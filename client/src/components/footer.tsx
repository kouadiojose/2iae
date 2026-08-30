import { Facebook, Twitter, Linkedin, Instagram } from "lucide-react";
import { Link } from "wouter";
import logoImage from "@assets/image_1756310296213.png";

export default function Footer() {
  return (
    <footer className="bg-foreground text-white py-16">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <div className="mb-6" data-testid="footer-logo">
              <img
                src={logoImage}
                alt="Groupe École 2IAE International"
                className="h-16 w-auto object-contain"
              />
            </div>
            <p
              className="text-white/70 mb-6"
              data-testid="text-footer-description"
            >
              L'école où l'apprentissage prend vie. Former l'élite
              entrepreneuriale de demain.
            </p>
            <div className="flex space-x-4" data-testid="footer-social-links">
              <a
                href="#"
                className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-primary transition-colors"
                data-testid="link-facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-primary transition-colors"
                data-testid="link-twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-primary transition-colors"
                data-testid="link-linkedin"
              >
                <Linkedin className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center hover:bg-primary transition-colors"
                data-testid="link-instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3
              className="text-lg font-semibold mb-6"
              data-testid="text-footer-quick-links-title"
            >
              Liens Rapides
            </h3>
            <ul className="space-y-3 text-white/70">
              <li>
                <Link
                  href="/"
                  className="hover:text-primary transition-colors"
                  data-testid="link-footer-accueil"
                >
                  Accueil
                </Link>
              </li>
              <li>
                <Link
                  href="/filieres"
                  className="hover:text-primary transition-colors"
                  data-testid="link-footer-filieres"
                >
                  Nos Filières
                </Link>
              </li>
              <li>
                <Link
                  href="/actualites"
                  className="hover:text-primary transition-colors"
                  data-testid="link-footer-actualites"
                >
                  Actualités
                </Link>
              </li>
              <li>
                <Link
                  href="/a-propos"
                  className="hover:text-primary transition-colors"
                  data-testid="link-footer-a-propos"
                >
                  À Propos
                </Link>
              </li>
              <li>
                <Link
                  href="/campus"
                  className="hover:text-primary transition-colors"
                  data-testid="link-footer-campus"
                >
                  Campus
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3
              className="text-lg font-semibold mb-6"
              data-testid="text-footer-services-title"
            >
              Services
            </h3>
            <ul className="space-y-3 text-white/70">
              <li>
                <a
                  href="#"
                  className="hover:text-primary transition-colors"
                  data-testid="link-footer-cabinet"
                >
                  Cabinet 2iae
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="hover:text-primary transition-colors"
                  data-testid="link-footer-formations"
                >
                  Formations
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="hover:text-primary transition-colors"
                  data-testid="link-footer-incubation"
                >
                  Incubation
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="hover:text-primary transition-colors"
                  data-testid="link-footer-placement"
                >
                  Placement
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="hover:text-primary transition-colors"
                  data-testid="link-footer-residences"
                >
                  Résidences
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3
              className="text-lg font-semibold mb-6"
              data-testid="text-footer-contact-title"
            >
              Contact
            </h3>
            <div className="space-y-4 text-white/70">
              <div
                className="flex items-start space-x-3"
                data-testid="footer-contact-address"
              >
                <div className="w-5 h-5 text-primary mt-1 flex-shrink-0">
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <p>Riviera Palmeraie, rue ministère, Abidjan</p>
              </div>
              <div
                className="flex items-center space-x-3"
                data-testid="footer-contact-phone"
              >
                <div className="w-5 h-5 text-primary flex-shrink-0">
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                </div>
                <p>+225 05 84 24 90 90 / +225 27 22 51 81 75</p>
              </div>
              <div
                className="flex items-center space-x-3"
                data-testid="footer-contact-email"
              >
                <div className="w-5 h-5 text-primary flex-shrink-0">
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                  </svg>
                </div>
                <p>contacts@2iae.com</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/20 mt-12 pt-8 text-center text-white/70">
          <p data-testid="text-footer-copyright">
            &copy; 2025 Groupe Écoles 2IAE International by{" "}
            <a href="https://markel-tech.com" target="_blank">
              Markel Technology
            </a>
            . Tous droits réservés.
          </p>
        </div>
      </div>
    </footer>
  );
}
