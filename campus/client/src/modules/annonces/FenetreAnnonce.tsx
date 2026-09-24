// Rédaction et modification d'une annonce, dans une fenêtre (feuille du bas
// sur téléphone). Formulaire à gauche, aperçu tel que l'étudiant le verra à
// droite (en dessous sur téléphone), compteur de destinataires en direct.
import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe, Megaphone, Pin } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { post, patch } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { depuisChampDate, versChampDate } from "@/lib/dates";
import { maintenantServeur } from "@/lib/horloge";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { Champ, ZoneTexte, CaseACocher } from "@/components/ui/champs";
import { Badge, Erreur, Squelette } from "@/components/ui/divers";
import { toast } from "@/components/ui/toast";
import type { AnnonceDto, CiblesAnnonce } from "@shared/schema";
import { SelecteurCible, cibleComplete, cibleParDefaut, type CibleSaisie } from "./SelecteurCible";
import { extrait } from "../accueil/outils";

const ID_FORMULAIRE = "formulaire-annonce";
const MAX_CORPS = 2000;

export function FenetreAnnonce({
  ouverte,
  onFermer,
  annonce,
  coursParDefaut,
  onEnregistree,
}: {
  ouverte: boolean;
  onFermer: () => void;
  /** Annonce à modifier (sinon : nouvelle annonce). */
  annonce?: AnnonceDto;
  coursParDefaut?: number | null;
  onEnregistree?: (id: number) => void;
}) {
  const [envoi, setEnvoi] = useState(false);
  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      large
      titre={annonce ? "Modifier l'annonce" : "Nouvelle annonce"}
      description={annonce ? "Les personnes déjà prévenues ne reçoivent pas de nouveau rappel." : "Elle apparaît aussitôt dans le campus des personnes concernées."}
      pied={
        <>
          <Bouton variante="fantome" onClick={onFermer} className="min-h-[48px]">
            Annuler
          </Bouton>
          <Bouton type="submit" form={ID_FORMULAIRE} chargement={envoi} className="min-h-[48px]" icone={<Megaphone className="h-4 w-4" />}>
            {annonce ? "Enregistrer" : "Publier l'annonce"}
          </Bouton>
        </>
      }
    >
      {ouverte && (
        <FormulaireAnnonce
          annonce={annonce}
          coursParDefaut={coursParDefaut}
          onEnvoi={setEnvoi}
          onTermine={(id) => {
            // Fermer d'abord : la page peut ensuite naviguer vers l'annonce publiée.
            onFermer();
            onEnregistree?.(id);
          }}
        />
      )}
    </Fenetre>
  );
}

function FormulaireAnnonce({
  annonce,
  coursParDefaut,
  onEnvoi,
  onTermine,
}: {
  annonce?: AnnonceDto;
  coursParDefaut?: number | null;
  onEnvoi: (v: boolean) => void;
  onTermine: (id: number) => void;
}) {
  const moi = useMoiConnecte();
  const { data: cibles, error: erreurCibles } = useQuery<CiblesAnnonce>({ queryKey: ["/api/annonces/cibles"], staleTime: 5 * 60_000 });

  const [titre, setTitre] = useState(annonce?.titre ?? "");
  const [corps, setCorps] = useState(annonce?.corps ?? "");
  const [cible, setCible] = useState<CibleSaisie | null>(
    annonce ? { cible: annonce.cible, siteId: annonce.siteId, classeId: annonce.classeId, coursId: annonce.coursId } : null,
  );
  const [importante, setImportante] = useState(annonce?.importante ?? false);
  const [epinglee, setEpinglee] = useState(annonce?.epinglee ?? false);
  const [expire, setExpire] = useState(versChampDate(annonce?.expireLe));
  const [surSite, setSurSite] = useState(annonce ? annonce.publierSurSite || annonce.proposeSurSite : false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Cible par défaut dès que l'on sait ce que la personne peut viser.
  useEffect(() => {
    if (cibles && !cible) setCible(cibleParDefaut(cibles, coursParDefaut));
  }, [cibles, cible, coursParDefaut]);

  const direction = moi.role === "admin";

  async function envoyer(e: FormEvent) {
    e.preventDefault();
    if (titre.trim().length < 3) return setErreur("Donnez un titre d'au moins 3 caractères.");
    if (!corps.trim()) return setErreur("Écrivez le message de l'annonce.");
    if (!cible || !cibleComplete(cible)) return setErreur("Choisissez qui doit recevoir l'annonce.");
    const expireLe = depuisChampDate(expire);
    if (expireLe && new Date(expireLe).getTime() <= maintenantServeur()) return setErreur("La date de retrait doit être dans le futur.");
    setErreur(null);
    onEnvoi(true);
    const corpsRequete = { titre: titre.trim(), corps: corps.trim(), ...cible, importante, epinglee, expireLe, surSite };
    try {
      if (annonce) {
        await patch(`/api/annonces/${annonce.id}`, corpsRequete);
        toast("Annonce modifiée.");
        await rafraichir("/api/annonces", "/api/accueil");
        onTermine(annonce.id);
      } else {
        const r = await post<{ id: number; destinataires: number }>("/api/annonces", corpsRequete);
        toast(r.destinataires ? `Annonce publiée : ${r.destinataires} personne${r.destinataires > 1 ? "s" : ""} prévenue${r.destinataires > 1 ? "s" : ""}.` : "Annonce publiée.");
        await rafraichir("/api/annonces", "/api/accueil");
        onTermine(r.id);
      }
    } catch (err) {
      setErreur((err as Error).message);
    } finally {
      onEnvoi(false);
    }
  }

  if (erreurCibles) return <Erreur message={(erreurCibles as Error).message} />;

  return (
    <form id={ID_FORMULAIRE} onSubmit={envoyer} noValidate className="grid gap-6 pb-2 md:grid-cols-[minmax(0,1fr)_260px]">
      <div className="flex min-w-0 flex-col gap-5">
        <Champ libelle="Titre" placeholder="Changement de salle jeudi" value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={120} required />
        <ZoneTexte
          libelle="Message"
          placeholder="Le live de jeudi aura lieu en salle Kédjénou. Pensez à venir 10 minutes avant."
          value={corps}
          onChange={(e) => setCorps(e.target.value)}
          maxLength={MAX_CORPS}
          rows={6}
          aide={`${corps.length} / ${MAX_CORPS} caractères · **gras** et listes avec « - » acceptés.`}
          required
        />
        {cibles && cible ? <SelecteurCible cibles={cibles} valeur={cible} onChange={setCible} /> : <Squelette className="h-24" />}
        <div className="flex flex-col gap-4 rounded-2xl border border-ligne p-4">
          <CaseACocher
            checked={importante}
            onChange={setImportante}
            libelle="Importante"
            aide="Un rappel sonne sur le téléphone (3 par jour au plus, jamais entre 21 h et 6 h) et l'annonce reste en haut de l'accueil jusqu'à sa lecture."
          />
          <CaseACocher checked={epinglee} onChange={setEpinglee} libelle="Épingler en haut des annonces" aide="Pour une information qui doit rester visible (règlement, calendrier)." />
          <Champ
            type="datetime-local"
            libelle="Retirer automatiquement le (facultatif)"
            aide="Heure d'Abidjan. Après cette date, l'annonce n'est plus affichée."
            value={expire}
            min={versChampDate(maintenantServeur())}
            onChange={(e) => setExpire(e.target.value)}
          />
          <CaseACocher
            checked={surSite}
            onChange={setSurSite}
            libelle={direction ? "Publier aussi sur 2iae.com" : "Proposer pour 2iae.com"}
            aide={
              direction
                ? "L'annonce apparaît sur le site du groupe dans les minutes qui suivent."
                : "La direction relit et valide avant la mise en ligne sur le site du groupe."
            }
          />
        </div>
        {erreur && <Erreur message={erreur} />}
      </div>
      <Apercu titre={titre} corps={corps} importante={importante} epinglee={epinglee} surSite={surSite} auteur={`${moi.prenom} ${moi.nom}`} />
    </form>
  );
}

/** Aperçu de la carte telle qu'elle s'affiche sur le téléphone de l'étudiant (et sur 2iae.com si coché). */
function Apercu({ titre, corps, importante, epinglee, surSite, auteur }: { titre: string; corps: string; importante: boolean; epinglee: boolean; surSite: boolean; auteur: string }) {
  return (
    <aside className="flex flex-col gap-4 md:sticky md:top-0 md:self-start" aria-label="Aperçu">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-texte-gris">Aperçu sur le téléphone</span>
        <div className="rounded-[22px] bg-encre p-2">
          <div className="flex flex-col gap-2 rounded-[16px] border border-orange bg-orange-pale p-4">
            <span className="flex flex-wrap gap-1.5">
              {importante && <Badge ton="danger">Important</Badge>}
              {epinglee && (
                <Badge ton="gris">
                  <Pin className="h-3 w-3" aria-hidden /> Épinglée
                </Badge>
              )}
              <Badge ton="orange">Nouveau</Badge>
            </span>
            <span className="text-base font-extrabold leading-snug text-encre">{titre.trim() || "Titre de l'annonce"}</span>
            <span className="line-clamp-4 text-sm leading-relaxed text-texte-doux">{extrait(corps, 180) || "Le début du message s'affiche ici."}</span>
            <span className="font-mono text-[11px] text-texte-gris">{auteur} · à l'instant</span>
          </div>
        </div>
      </div>
      {surSite && (
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-texte-gris">
            <Globe className="h-3.5 w-3.5" aria-hidden /> Sur 2iae.com
          </span>
          <div className="rounded-2xl border border-ligne bg-white p-4 shadow-carte">
            <span className="etiquette">Au campus numérique</span>
            <p className="mt-1.5 text-[15px] font-extrabold leading-snug">{titre.trim() || "Titre de l'annonce"}</p>
            <p className="mt-1 line-clamp-3 text-[13px] text-texte-pale">{extrait(corps, 140) || "Le début du message."}</p>
          </div>
        </div>
      )}
    </aside>
  );
}
