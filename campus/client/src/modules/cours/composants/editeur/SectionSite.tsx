// Éditeur · Site 2iae.com : accroche, case « Proposer sur 2iae.com » (ou
// « Publier » pour la direction), état de la publication et aperçu de la
// carte telle qu'elle apparaîtra sur le site.
import { useState } from "react";
import { Globe, Sparkles, CheckCircle2, Clock, CircleSlash } from "lucide-react";
import { Carte } from "@/components/ui/carte";
import { Bouton } from "@/components/ui/bouton";
import { ZoneTexte, CaseACocher } from "@/components/ui/champs";
import { Badge } from "@/components/ui/divers";
import { toastErreur } from "@/components/ui/toast";
import { post } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ApercuCarteSite, type DonneesCarteSite } from "../../ApercuCarteSite";
import { TitreSectionEditeur } from "./SectionInformations";
import type { FormulaireCours } from "./formulaire";
import type { CoursDetail, OptionsEditionCours } from "@shared/schema";

export function SectionSite({
  cours,
  form,
  modifier,
  options,
  erreur,
}: {
  cours: CoursDetail;
  form: FormulaireCours;
  modifier: (maj: Partial<FormulaireCours>) => void;
  options: OptionsEditionCours | undefined;
  erreur?: string;
}) {
  const direction = Boolean(options?.peutPublierSurSite);
  const [iaEnCours, setIaEnCours] = useState(false);
  const [proposeParIa, setProposeParIa] = useState(false);

  async function accrocheIa() {
    setIaEnCours(true);
    try {
      const r = await post<{ accroche: string }>(`/api/cours/${cours.id}/accroche-ia`);
      modifier({ accrocheSite: r.accroche });
      setProposeParIa(true);
    } catch (e) {
      toastErreur(e);
    } finally {
      setIaEnCours(false);
    }
  }

  // Formateur affiché sur la carte : celui choisi dans le formulaire (équipe) ou celui du cours.
  const choisi = options?.formateurs?.find((f) => String(f.id) === form.formateurId);
  const formateur = choisi ?? cours.formateur;
  const sitesCoches = new Set(options?.sites.filter((s) => s.classes.some((c) => form.classeIds.includes(c.id))).map((s) => s.id));
  const donnees: DonneesCarteSite = {
    code: cours.code,
    titre: form.titre,
    accroche: form.accrocheSite || null,
    description: form.description,
    imageUrl: form.imageUrl || null,
    couleur: form.couleur,
    dateDebut: form.dateDebut ? `${form.dateDebut}T00:00:00.000Z` : null,
    dateFin: form.dateFin ? `${form.dateFin}T00:00:00.000Z` : null,
    formateur: formateur ? { prenom: formateur.prenom, nom: formateur.nom, localisation: formateur.localisation } : null,
    nbCampus: options ? sitesCoches.size : cours.sites.length,
  };

  // État enregistré (pas celui du formulaire en cours).
  const etat = cours.publierSurSite
    ? { ton: "succes" as const, icone: CheckCircle2, texte: "Publié sur 2iae.com par la direction" }
    : cours.proposeSurSite
      ? { ton: "alerte" as const, icone: Clock, texte: "Proposé · en attente de la direction" }
      : { ton: "gris" as const, icone: CircleSlash, texte: "Pas sur le site" };

  return (
    <Carte id="site" className="scroll-mt-24 border-orange/60 p-5 sm:p-7">
      <TitreSectionEditeur
        numero="04"
        titre="Site 2iae.com"
        texte={
          direction
            ? "Publiez le cours sur le site de l'école : le site est prévenu aussitôt."
            : "Proposez le cours sur le site de l'école : la direction relit et publie."
        }
      />
      <div className="flex flex-col gap-5">
        <Badge ton={etat.ton} className="self-start px-3 py-1.5 text-[13px]">
          <etat.icone className="h-4 w-4" /> {etat.texte}
        </Badge>

        <div className="flex flex-col gap-2">
          <ZoneTexte
            libelle="Accroche"
            value={form.accrocheSite}
            onChange={(e) => {
              modifier({ accrocheSite: e.target.value });
              setProposeParIa(false);
            }}
            rows={3}
            maxLength={180}
            placeholder="De l'idée au premier client : trois mois pour lancer votre activité, en direct dans nos cinq campus."
            erreur={erreur}
            className="[&_textarea]:text-base"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={cn("font-mono text-[12px]", form.accrocheSite.length > 160 ? "text-alerte" : "text-texte-gris")}>{form.accrocheSite.length}/180</span>
            {proposeParIa && <Badge ton="orange">Proposé par l'IA · relisez avant d'enregistrer</Badge>}
          </div>
          <Bouton
            variante="doux"
            icone={<Sparkles className="h-4 w-4" />}
            chargement={iaEnCours}
            disabled={!options?.iaDisponible}
            onClick={() => void accrocheIa()}
            className="min-h-[48px] self-start"
          >
            Proposer une accroche avec l'IA
          </Bouton>
          {options && !options.iaDisponible && <p className="text-[13px] text-texte-gris">L'assistant IA n'est pas disponible pour le moment : rédigez l'accroche vous-même.</p>}
        </div>

        <div className="rounded-2xl bg-creme p-4">
          {direction ? (
            <CaseACocher
              checked={form.publierSurSite}
              onChange={(v) => modifier({ publierSurSite: v })}
              libelle="Publier sur 2iae.com"
              aide={cours.proposeSurSite && !cours.publierSurSite ? "Le formateur a proposé ce cours : cochez pour le valider." : "La carte apparaît sur le site dès l'enregistrement."}
            />
          ) : (
            <CaseACocher
              checked={form.proposeSurSite}
              onChange={(v) => modifier({ proposeSurSite: v })}
              libelle="Proposer sur 2iae.com"
              aide={
                cours.publierSurSite
                  ? "Décocher retire aussi le cours du site."
                  : "La direction reçoit la proposition et publie la carte ci-dessous."
              }
            />
          )}
        </div>

        <ApercuCarteSite cours={donnees} />
        <p className="inline-flex items-start gap-2 text-[13px] text-texte-gris">
          <Globe className="mt-0.5 h-4 w-4 shrink-0" />
          Seuls le titre, l'accroche, l'image, les dates, le formateur et le nombre de campus partent vers le site. Aucune donnée d'étudiant.
        </p>
      </div>
    </Carte>
  );
}
