// /visio/repetition/:seanceId — répéter dans la vraie salle Daily d'une
// séance planifiée, à tout moment (formateur du cours et direction). Les
// écrans de salle peuvent y entrer 90 minutes avant le début. La séance ne
// passe pas « en direct » : les étudiants ne sont ni prévenus ni admis
// (30 minutes avant, comme toujours), et rien n'est enregistré.
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, FlaskConical } from "lucide-react";
import { post } from "@/lib/api";
import { useMoiConnecte } from "@/lib/auth";
import { dateEtHeure } from "@/lib/dates";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { LienBouton } from "@/components/ui/bouton";
import { Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import type { RejoindreVisioDto, SeanceDetailDto } from "@shared/schema";
import { SalleVisio } from "./SalleVisio";
import { roleCadreDuCompte } from "./SectionVisioClasse";

export default function PageRepetition({ seanceId }: { seanceId: string }) {
  const id = Number(seanceId);
  const moi = useMoiConnecte();
  const tu = moi.role === "etudiant";
  const { data: seance, error, isLoading, refetch } = useQuery<SeanceDetailDto>({ queryKey: [`/api/seances/${id}`] });

  if (isLoading) return <Page className="max-w-4xl"><Chargement lignes={3} /></Page>;
  if (error || !seance) return <Page className="max-w-4xl"><Erreur message={(error as Error)?.message ?? "Séance introuvable."} reessayer={() => void refetch()} /></Page>;

  const animateur = seance.monRole === "formateur" || moi.role === "admin";
  const retour = animateur ? `/enseigner/seances/${seance.id}` : "/direct";

  if (moi.role === "etudiant") {
    return (
      <Page className="max-w-3xl">
        <EtatVide titre="La classe ouvre 30 minutes avant le début." texte="En attendant, tu peux tester ton micro et la visio dans la salle d'essai." action={<LienBouton href="/visio/essai">Tester ma visio</LienBouton>} />
      </Page>
    );
  }
  if (seance.statut === "terminee" || seance.statut === "annulee") {
    return (
      <Page className="max-w-3xl">
        <EtatVide titre={seance.statut === "terminee" ? "Cette séance est terminée." : "Cette séance est annulée."} texte="La salle d'essai reste ouverte à tout moment pour vos tests." action={<LienBouton href="/visio/essai#salle-essai">Aller à la salle d'essai</LienBouton>} />
      </Page>
    );
  }
  if (seance.fournisseur !== "daily") {
    return (
      <Page className="max-w-3xl">
        <EnTetePage etiquette={`Répétition · ${seance.coursCode}`} titre={seance.titre} sousTitre={dateEtHeure(seance.debut)} />
        <EtatVide
          icone={<FlaskConical className="h-6 w-6" />}
          titre="Cette séance n'utilise pas la visio Daily."
          texte="La répétition dans la salle d'une séance se fait avec Daily. Choisissez Daily dans la préparation de la séance, ou testez votre installation dans la salle d'essai."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {animateur && <LienBouton href={`/enseigner/seances/${seance.id}`}>Préparer la séance</LienBouton>}
              <LienBouton href="/visio/essai#salle-essai" variante="contour">
                Salle d'essai
              </LienBouton>
            </div>
          }
        />
      </Page>
    );
  }

  const enDirect = seance.statut === "en_direct";
  const lien = `${window.location.origin}/visio/repetition/${seance.id}`;
  return (
    <Page className="max-w-4xl">
      <EnTetePage
        etiquette={`${enDirect ? "En direct" : "Répétition"} · ${seance.coursCode}`}
        titre={seance.titre}
        sousTitre={`${dateEtHeure(seance.debut)} · ${seance.dureeMinutes} min`}
        actions={
          <LienBouton href={`/live/${seance.id}`} variante={enDirect ? "principal" : "contour"} icone={<ArrowRight className="h-4 w-4" />}>
            Ouvrir le studio
          </LienBouton>
        }
      />
      <div className="flex items-start gap-3 rounded-2xl bg-creme px-4 py-3.5 text-[15px] leading-snug text-texte-doux">
        <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-orange-fonce" aria-hidden />
        {enDirect ? (
          <span>La séance est en direct : ceci est la vraie salle, avec les étudiants et l'enregistrement du replay. Pour animer, ouvrez le studio.</span>
        ) : (
          <span>
            Vous êtes dans la vraie salle de la séance, mais <strong>la séance n'est pas en direct</strong> : les étudiants ne sont pas prévenus et n'entrent que 30 minutes avant le début. Rien n'est enregistré.
            {animateur ? " Les écrans de salle peuvent vous rejoindre 90 minutes avant le début ; avant, invitez-les dans la salle d'essai." : ""}
          </span>
        )}
      </div>
      <SalleVisio
        nomSalle={enDirect ? "Salle de la séance" : "Salle de la séance · répétition"}
        titreBouton={enDirect ? "Entrer dans la salle" : "Entrer dans la salle de cette séance"}
        tu={tu}
        role={animateur ? "formateur" : roleCadreDuCompte(moi.role)}
        obtenirAcces={() => post<RejoindreVisioDto>(`/api/seances/${seance.id}/rejoindre`, { mode: "video", repetition: true })}
        urlPresence={animateur || moi.role === "vie_scolaire" ? `/api/visio/seances/${seance.id}/presence` : null}
        lienPartage={lien}
        messagePartage={`Répétition de la visio du cours « ${seance.titre} » sur le campus 2IAE. Ouvrez ce lien avec votre compte du campus :`}
        aideInvitation="Envoyez ce lien à l'écran d'une salle de campus (ouvert avec le compte de la salle, 90 minutes avant le début au plus tôt), à un collègue ou à la direction."
        bandeau={enDirect ? undefined : "Répétition : la séance n'est pas en direct. Vous sortez seul de la salle au bout de 90 minutes."}
        secours={
          <LienBouton href="/visio/essai" variante="nuit-actif">
            Faire les vérifications du réseau
          </LienBouton>
        }
      />
      <LienBouton href={retour} variante="fantome" className="self-start">
        Revenir à la préparation
      </LienBouton>
    </Page>
  );
}
