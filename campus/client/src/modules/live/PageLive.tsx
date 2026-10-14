// /live/:id — la salle live. Chaque rôle y trouve son écran : l'étudiant
// suit le cours, le formateur ouvre son studio, l'équipe observe, l'écran
// de salle est renvoyé vers /salle.
import { Redirect } from "wouter";
import { Radio } from "lucide-react";
import { LienBouton } from "@/components/ui/bouton";
import { EtatVide } from "@/components/ui/divers";
import { ErreurApi } from "@/lib/api";
import { useMoi } from "@/lib/auth";
import { estProfilCampus, estProfilRegie } from "@shared/schema";
import { useSeance } from "./outils";
import SalleEtudiant from "./SalleEtudiant";
import Studio from "./Studio";

export default function PageLive({ id }: { id: string }) {
  const seanceId = Number(id);
  const { data: seance, error, isLoading } = useSeance(seanceId);
  const { moi } = useMoi();
  // Chargé de cours : ses classes sont dans « Mon espace », pas dans « Mes lives ».
  const regie = estProfilRegie(moi);

  if (isLoading) {
    return (
      <div className="grid min-h-[calc(100dvh-64px)] place-items-center bg-nuit" aria-busy="true">
        <span className="flex items-center gap-3 font-mono text-sm text-nuit-gris">
          <span className="point-direct" /> Ouverture de la classe…
        </span>
      </div>
    );
  }
  if (error || !seance) {
    const statut = error instanceof ErreurApi ? error.statut : 0;
    return (
      <div className="min-h-[calc(100dvh-64px)] bg-nuit px-4 py-16">
        <EtatVide
          nuit
          icone={<Radio className="h-6 w-6" />}
          titre={statut === 403 ? "Ce live n'est pas pour ton compte." : statut === 404 ? "Ce live n'existe pas (ou plus)." : "Impossible d'ouvrir la classe."}
          texte={error instanceof Error ? error.message : "Vérifie ta connexion et réessaie."}
          action={regie ? <LienBouton href="/regie">Revenir à mon espace</LienBouton> : <LienBouton href="/direct">Voir mes lives</LienBouton>}
          className="mx-auto max-w-lg"
        />
      </div>
    );
  }
  // Chargé du campus : l'écran d'une salle s'ouvre depuis le carré du cours (« Entrer dans le live »), jamais par /salle.
  if (seance.monRole === "salle") return <Redirect to={estProfilCampus(moi) ? `/mon-campus/cours/${seance.coursId}` : "/salle"} replace />;
  if (seance.monRole === "formateur") return <Studio seance={seance} />;
  if (seance.monRole === "equipe") return <Studio seance={seance} observation />;
  return <SalleEtudiant seance={seance} />;
}
