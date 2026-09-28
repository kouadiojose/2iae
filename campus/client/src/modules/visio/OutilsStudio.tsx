// Deux raccourcis du Studio (/direct) pour le formateur et la direction :
// « Tester ma visio » (salle d'essai, ouverte à tout moment) et « Lancer un
// direct maintenant » (séance créée à l'instant, avec Daily, pour un essai
// grandeur nature avec les salles de campus ou un cours imprévu).
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical, Zap, ChevronRight } from "lucide-react";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { useMoiConnecte } from "@/lib/auth";
import { Bouton } from "@/components/ui/bouton";
import { CarteLien } from "@/components/ui/carte";
import { Selection, Champ, CaseACocher } from "@/components/ui/champs";
import { Fenetre } from "@/components/ui/fenetre";
import { toast, toastErreur } from "@/components/ui/toast";
import type { OptionsVisio, PresenceSalleVisio, SeanceDetailDto } from "@shared/schema";

type CoursResume = { id: number; code: string; titre: string; enseignant?: boolean };

const DUREES = [
  { v: 30, l: "30 minutes (essai)" },
  { v: 60, l: "1 heure" },
  { v: 90, l: "1 h 30" },
  { v: 120, l: "2 heures" },
  { v: 240, l: "4 heures (une matinée)" },
];

export function OutilsStudio() {
  const moi = useMoiConnecte();
  const [ouverte, setOuverte] = useState(false);
  const { data: presence } = useQuery<PresenceSalleVisio>({ queryKey: ["/api/visio/essai/presence"], refetchInterval: 30_000, retry: false });
  const { data: options } = useQuery<OptionsVisio>({ queryKey: ["/api/visio/options"] });
  const peutLancer = moi.role === "formateur" || moi.role === "admin";
  const n = presence?.presents.length ?? 0;
  return (
    <section aria-label="Outils de la visio" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <CarteLien href="/visio/essai#salle-essai" className="flex items-center gap-4 px-5 py-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-creme text-orange-fonce">
          <FlaskConical className="h-5 w-5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[17px] font-extrabold">Tester ma visio</span>
          <span className="text-sm text-texte-pale">
            {n > 0 ? `Salle d'essai · ${n === 1 ? "une personne" : `${n} personnes`} en ce moment` : "Salle d'essai ouverte à tout moment, avec l'écran d'une salle si vous voulez."}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
      </CarteLien>
      {peutLancer && (
        <button
          type="button"
          onClick={() => setOuverte(true)}
          className="flex items-center gap-4 rounded-2xl border border-ligne bg-white px-5 py-4 text-left text-encre transition-colors hover:border-orange focus-visible:border-orange"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-orange text-encre">
            <Zap className="h-5 w-5" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[17px] font-extrabold">Lancer un direct maintenant</span>
            <span className="text-sm text-texte-pale">{options?.daily ? "Une classe ouverte tout de suite, avec les cinq salles de campus." : "Une classe ouverte tout de suite, sans attendre l'horaire."}</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
        </button>
      )}
      {peutLancer && <FenetreDirectImmediat ouverte={ouverte} onFermer={() => setOuverte(false)} />}
    </section>
  );
}

function FenetreDirectImmediat({ ouverte, onFermer }: { ouverte: boolean; onFermer: () => void }) {
  const [, naviguer] = useLocation();
  const { data: liste } = useQuery<CoursResume[]>({ queryKey: ["/api/cours"], enabled: ouverte, retry: false });
  const cours = (Array.isArray(liste) ? liste : []).filter((c) => c?.id && c.enseignant !== false);
  const [coursId, setCoursId] = useState("");
  const [duree, setDuree] = useState(30);
  const [prevenir, setPrevenir] = useState(false);
  const [titre, setTitre] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const choisi = coursId || (cours.length === 1 ? String(cours[0].id) : "");

  const lancer = async () => {
    if (!choisi) return;
    setEnvoi(true);
    try {
      const s = await post<SeanceDetailDto & { existant?: boolean }>("/api/seances/direct-immediat", {
        coursId: Number(choisi),
        dureeMinutes: duree,
        prevenir,
        ...(titre.trim().length >= 3 && { titre: titre.trim() }),
      });
      await rafraichir("/api/seances", "/api/live");
      toast(s.existant ? "Un direct est déjà ouvert pour ce cours : vous y entrez." : prevenir ? "Vous êtes en direct : les étudiants sont prévenus." : "Direct d'essai ouvert : les étudiants ne sont pas prévenus.");
      onFermer();
      naviguer(`/live/${s.id}`);
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
      titre="Lancer un direct maintenant"
      description="La classe s'ouvre tout de suite. Les écrans des salles de campus qui suivent ce cours la rejoignent d'eux-mêmes."
      pied={
        <>
          <Bouton variante="fantome" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton icone={<Zap className="h-4 w-4" />} disabled={!choisi} chargement={envoi} onClick={() => void lancer()}>
            Ouvrir le direct
          </Bouton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {cours.length ? (
          <Selection libelle="Cours" value={choisi} onChange={(e) => setCoursId(e.target.value)}>
            <option value="">Choisir un cours…</option>
            {cours.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {c.titre}
              </option>
            ))}
          </Selection>
        ) : (
          <p className="rounded-xl bg-creme px-4 py-3 text-[15px] text-texte-pale">{liste ? "Aucun cours à votre nom pour le moment." : "Chargement des cours…"}</p>
        )}
        <Selection libelle="Durée" value={String(duree)} onChange={(e) => setDuree(Number(e.target.value))}>
          {DUREES.map((d) => (
            <option key={d.v} value={d.v}>
              {d.l}
            </option>
          ))}
        </Selection>
        <Champ libelle="Titre (facultatif)" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder={prevenir ? "Titre du cours" : "Essai de visio · titre du cours"} maxLength={160} />
        <CaseACocher
          checked={prevenir}
          onChange={setPrevenir}
          libelle="Prévenir les étudiants"
          aide={
            prevenir
              ? "Les étudiants du cours reçoivent « En direct » sur leur téléphone. Le replay est enregistré."
              : "Pour un essai : personne n'est prévenu, rien n'est enregistré, et la séance s'efface d'elle-même si aucun étudiant ne l'a suivie."
          }
        />
      </div>
    </Fenetre>
  );
}
