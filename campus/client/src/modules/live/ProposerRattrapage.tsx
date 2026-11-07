// « Proposer un rattrapage » : le formateur (ou l'équipe qui programme) choisit une date, une heure, une durée
// (60 min par défaut), un sujet et, au besoin, la séance passée qu'il rattrape. Le serveur crée une séance de nature
// 'rattrapage' sur le même cours (POST /api/seances/rattrapage) : même classe en direct, replay et transcription.
// Tous les étudiants du cours sont prévenus ; ceux qui avaient manqué la séance choisie, plus fort. Facultatif pour
// eux : ne pas venir n'est jamais compté comme une absence. Personnel vouvoyé.
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarPlus } from "lucide-react";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { jourLong, heure } from "@/lib/dates";
import { Fenetre } from "@/components/ui/fenetre";
import { Bouton } from "@/components/ui/bouton";
import { Badge } from "@/components/ui/divers";
import { Champ, Selection, ZoneTexte } from "@/components/ui/champs";
import { toast, toastErreur } from "@/components/ui/toast";
import type { SeanceResume } from "@shared/api";
import { DUREE_RATTRAPAGE_DEFAUT } from "@shared/rattrapage";

const DUREES = [30, 45, 60, 75, 90, 120];

type Reponse = { id: number; prevenus: number; absentsPrevenus: number };

/** Demain, à l'heure d'Abidjan (UTC), au format des champs date. */
function demain() {
  return new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
}

export function FenetreRattrapage({ coursId, ouverte, onFermer }: { coursId: number; ouverte: boolean; onFermer: () => void }) {
  const [date, setDate] = useState(demain);
  const [heureDebut, setHeureDebut] = useState("18:00");
  const [duree, setDuree] = useState(DUREE_RATTRAPAGE_DEFAUT);
  const [sujet, setSujet] = useState("");
  const [rattrapageDe, setRattrapageDe] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const { data: passees } = useQuery<SeanceResume[]>({
    queryKey: [`/api/seances?cours=${coursId}&periode=passees&limite=20`],
    enabled: ouverte,
    staleTime: 60_000,
  });
  const choix = (passees ?? []).filter((s) => s.nature !== "rattrapage");

  const valider = async () => {
    if (sujet.trim().length < 3) return toast("Indiquez le sujet du rattrapage (3 caractères au moins).", "erreur");
    if (!date || !heureDebut) return toast("Choisissez la date et l'heure.", "erreur");
    const debut = new Date(`${date}T${heureDebut}:00Z`);
    if (Number.isNaN(debut.getTime())) return toast("Date ou heure invalide.", "erreur");
    if (debut.getTime() < Date.now()) return toast("Choisissez une date et une heure à venir.", "erreur");
    setEnvoi(true);
    try {
      const r = await post<Reponse>("/api/seances/rattrapage", {
        coursId,
        debut: debut.toISOString(),
        dureeMinutes: duree,
        sujet: sujet.trim(),
        rattrapageDe: rattrapageDe ? Number(rattrapageDe) : null,
      });
      await rafraichir("/api/seances", "/api/agenda", "/api/live/en-cours", "/api/accueil");
      toast(
        r.prevenus
          ? `Rattrapage programmé. ${r.prevenus} étudiant${r.prevenus > 1 ? "s" : ""} prévenu${r.prevenus > 1 ? "s" : ""}${r.absentsPrevenus ? `, dont ${r.absentsPrevenus} absent${r.absentsPrevenus > 1 ? "s" : ""} à la séance choisie` : ""}.`
          : "Rattrapage programmé.",
      );
      setSujet("");
      setRattrapageDe("");
      onFermer();
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      titre="Proposer un rattrapage"
      description="Une séance en direct de plus, ouverte à tous les étudiants du cours. Ils sont prévenus tout de suite. Elle est facultative : personne n'est compté absent."
      pied={
        <div className="flex flex-wrap justify-end gap-2">
          <Bouton variante="fantome" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton onClick={() => void valider()} chargement={envoi}>
            Programmer et prévenir
          </Bouton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Champ libelle="Date" type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
          <Champ libelle="Heure" type="time" value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} aide="Heure d'Abidjan" />
        </div>
        <Selection libelle="Durée" value={duree} onChange={(e) => setDuree(Number(e.target.value))}>
          {DUREES.map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </Selection>
        <ZoneTexte
          libelle="Sujet"
          rows={3}
          maxLength={300}
          value={sujet}
          onChange={(e) => setSujet(e.target.value)}
          placeholder="Par exemple : reprise des bilans et exercices corrigés"
        />
        <Selection libelle="Pour la séance du… (facultatif)" value={rattrapageDe} onChange={(e) => setRattrapageDe(e.target.value)} aide="Les étudiants absents à cette séance reçoivent un message plus appuyé.">
          <option value="">Aucune séance en particulier</option>
          {choix.map((s) => (
            <option key={s.id} value={s.id}>
              {jourLong(s.debut)} à {heure(s.debut)} · {s.titre}
            </option>
          ))}
        </Selection>
      </div>
    </Fenetre>
  );
}

/** Bouton « Proposer un rattrapage » et sa fenêtre. */
export function BoutonRattrapage({ coursId, rendu }: { coursId: number; rendu?: (ouvrir: () => void) => ReactNode }) {
  const [ouverte, setOuverte] = useState(false);
  const ouvrir = () => setOuverte(true);
  return (
    <>
      {rendu ? (
        rendu(ouvrir)
      ) : (
        <Bouton variante="contour" icone={<CalendarPlus className="h-4 w-4" />} onClick={ouvrir}>
          Proposer un rattrapage
        </Bouton>
      )}
      <FenetreRattrapage coursId={coursId} ouverte={ouverte} onFermer={() => setOuverte(false)} />
    </>
  );
}

/** Badge « Rattrapage » des listes de séances (accueil, agenda, page du cours, lives). */
export function BadgeRattrapage({ className }: { className?: string }) {
  return (
    <Badge ton="alerte" className={className}>
      Rattrapage
    </Badge>
  );
}
