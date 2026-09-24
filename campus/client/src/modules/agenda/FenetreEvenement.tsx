// Événement de la vie scolaire (examen, réunion, journée portes ouvertes…),
// créé ou modifié par l'équipe dans son périmètre. Les séances et les
// devoirs ont leurs propres écrans : ils n'apparaissent pas ici.
import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, Trash2 } from "lucide-react";
import { post, patch, suppr } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { depuisChampDate, versChampDate } from "@/lib/dates";
import { maintenantServeur } from "@/lib/horloge";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { Champ, ZoneTexte, CaseACocher } from "@/components/ui/champs";
import { Erreur, Squelette } from "@/components/ui/divers";
import { toast } from "@/components/ui/toast";
import type { CiblesAnnonce, ElementAgenda } from "@shared/schema";
import { SelecteurCible, cibleComplete, cibleParDefaut, type CibleSaisie } from "../annonces/SelecteurCible";

const ID_FORMULAIRE = "formulaire-evenement";

/** Prochaine heure pleine (heure d'Abidjan), pour pré-remplir le début. */
function heureRonde(jour?: string | null) {
  const base = jour ? new Date(`${jour}T09:00:00Z`) : new Date(Math.ceil(maintenantServeur() / 3_600_000) * 3_600_000);
  return versChampDate(base);
}

export function FenetreEvenement({
  ouverte,
  onFermer,
  evenement,
  jour,
}: {
  ouverte: boolean;
  onFermer: () => void;
  evenement?: ElementAgenda | null;
  /** Jour proposé par défaut (AAAA-MM-JJ). */
  jour?: string | null;
}) {
  const [envoi, setEnvoi] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function supprimer() {
    if (!evenement) return;
    setSuppression(true);
    try {
      await suppr(`/api/agenda/evenements/${evenement.id}`);
      toast("Événement retiré de l'agenda.");
      await rafraichir("/api/agenda", "/api/accueil");
      onFermer();
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setSuppression(false);
    }
  }

  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      titre={evenement ? "Modifier l'événement" : "Nouvel événement"}
      description={"Examen, réunion, journée particulière\u00a0: il s'affiche dans l'agenda des personnes concernées."}
      pied={
        <>
          {evenement && (
            <Bouton variante="fantome" onClick={() => void supprimer()} chargement={suppression} className="mr-auto min-h-[48px] text-danger hover:text-danger" icone={<Trash2 className="h-4 w-4" />}>
              Retirer
            </Bouton>
          )}
          <Bouton variante="fantome" onClick={onFermer} className="min-h-[48px]">
            Annuler
          </Bouton>
          <Bouton type="submit" form={ID_FORMULAIRE} chargement={envoi} className="min-h-[48px]" icone={<CalendarPlus className="h-4 w-4" />}>
            {evenement ? "Enregistrer" : "Ajouter à l'agenda"}
          </Bouton>
        </>
      }
    >
      {ouverte && <FormulaireEvenement evenement={evenement} jour={jour} onEnvoi={setEnvoi} onTermine={onFermer} erreurExterne={erreur} />}
    </Fenetre>
  );
}

function FormulaireEvenement({
  evenement,
  jour,
  onEnvoi,
  onTermine,
  erreurExterne,
}: {
  evenement?: ElementAgenda | null;
  jour?: string | null;
  onEnvoi: (v: boolean) => void;
  onTermine: () => void;
  erreurExterne: string | null;
}) {
  const { data: cibles, error: erreurCibles } = useQuery<CiblesAnnonce>({ queryKey: ["/api/annonces/cibles"], staleTime: 5 * 60_000 });
  const [titre, setTitre] = useState(evenement?.titre ?? "");
  const [description, setDescription] = useState(evenement?.description ?? "");
  const [debut, setDebut] = useState(evenement ? versChampDate(evenement.debut) : heureRonde(jour));
  const [fin, setFin] = useState(evenement?.fin ? versChampDate(evenement.fin) : "");
  const [lieu, setLieu] = useState(evenement?.lieu ?? "");
  const [cible, setCible] = useState<CibleSaisie | null>(
    evenement?.cible ? { cible: evenement.cible, siteId: evenement.siteId, classeId: evenement.classeId, coursId: evenement.coursId } : null,
  );
  const [prevenir, setPrevenir] = useState(!evenement);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (cibles && !cible) setCible(cibleParDefaut(cibles));
  }, [cibles, cible]);

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    if (titre.trim().length < 3) return setErreur("Donnez un titre d'au moins 3 caractères.");
    const debutIso = depuisChampDate(debut);
    const finIso = depuisChampDate(fin);
    if (!debutIso) return setErreur("Indiquez la date et l'heure de début.");
    if (finIso && finIso < debutIso) return setErreur("La fin doit venir après le début.");
    if (!cible || !cibleComplete(cible)) return setErreur("Choisissez qui est concerné.");
    setErreur(null);
    onEnvoi(true);
    const corps = { titre: titre.trim(), description: description.trim(), debut: debutIso, fin: finIso, lieu: lieu.trim() || null, ...cible, prevenir };
    try {
      if (evenement) await patch(`/api/agenda/evenements/${evenement.id}`, corps);
      else await post("/api/agenda/evenements", corps);
      toast(evenement ? "Événement modifié." : "Événement ajouté à l'agenda.");
      await rafraichir("/api/agenda", "/api/accueil");
      onTermine();
    } catch (err) {
      setErreur((err as Error).message);
    } finally {
      onEnvoi(false);
    }
  }

  if (erreurCibles) return <Erreur message={(erreurCibles as Error).message} />;

  return (
    <form id={ID_FORMULAIRE} onSubmit={envoyer} noValidate className="flex flex-col gap-5 pb-2">
      <Champ libelle="Titre" placeholder="Examen blanc de comptabilité" value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={120} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Champ type="datetime-local" libelle="Début" aide="Heure d'Abidjan" value={debut} onChange={(e) => setDebut(e.target.value)} />
        <Champ type="datetime-local" libelle="Fin (facultatif)" value={fin} min={debut} onChange={(e) => setFin(e.target.value)} />
      </div>
      <Champ libelle="Lieu (facultatif)" placeholder="Salle Kédjénou, campus Yopougon" value={lieu} onChange={(e) => setLieu(e.target.value)} maxLength={160} />
      <ZoneTexte libelle="Précisions (facultatif)" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
      {cibles && cible ? <SelecteurCible cibles={cibles} valeur={cible} onChange={setCible} libelle="Qui est concerné ?" verbe="Concerne" /> : <Squelette className="h-24" />}
      {!evenement && (
        <CaseACocher
          checked={prevenir}
          onChange={setPrevenir}
          libelle="Prévenir les personnes concernées"
          aide="Une notification dans le campus, sans sonnerie sur le téléphone."
        />
      )}
      {(erreur || erreurExterne) && <Erreur message={(erreur || erreurExterne)!} />}
    </form>
  );
}
