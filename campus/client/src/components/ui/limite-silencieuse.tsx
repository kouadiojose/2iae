// Limite d'erreur silencieuse autour de chaque emplacement du plan
// d'engagement (accueil, écran de salle, accueil du formateur, cours complet) :
// si le composant d'un chantier plante, il disparaît (ou laisse place au repli
// donné) et la page reste affichée. L'erreur ne part que dans la console.
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Nom de l'emplacement, pour la console. */
  nom: string;
  /** Ce qui s'affiche à la place en cas d'erreur (rien par défaut). */
  repli?: ReactNode;
};

export class LimiteSilencieuse extends Component<Props, { erreur: boolean }> {
  state = { erreur: false };

  static getDerivedStateFromError() {
    return { erreur: true };
  }

  componentDidCatch(erreur: Error, info: ErrorInfo) {
    console.error(`[emplacement ${this.props.nom}]`, erreur, info.componentStack);
  }

  render() {
    return this.state.erreur ? (this.props.repli ?? null) : this.props.children;
  }
}
