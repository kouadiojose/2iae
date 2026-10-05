// Réglage de la médiathèque sur la page d'un cours (direction et équipe qui
// gère le programme) : enregistrements et PDF du cours ouverts à tous les
// étudiants du campus, ou réservés aux classes qui suivent le cours.
import { useEffect, useState } from "react";
import { MonitorPlay, Lock, Users } from "lucide-react";
import { patch } from "@/lib/api";
import { queryClient, rafraichir } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { toast, toastErreur } from "@/components/ui/toast";
import type { AccesMediatheque, CoursDetail, ReglageMediathequeDto } from "@shared/schema";

const CHOIX: { valeur: AccesMediatheque; libelle: string; icone: typeof Users }[] = [
  { valeur: "tous", libelle: "Ouverte à tous", icone: Users },
  { valeur: "classes", libelle: "Réservée aux classes", icone: Lock },
];

export function ReglageMediatheque({ cours, className }: { cours: Pick<CoursDetail, "id" | "mediatheque" | "peutReglerMediatheque">; className?: string }) {
  const [valeur, setValeur] = useState<AccesMediatheque>(cours.mediatheque);
  const [envoi, setEnvoi] = useState(false);
  useEffect(() => setValeur(cours.mediatheque), [cours.mediatheque]);

  if (!cours.peutReglerMediatheque) return null;

  const choisir = async (v: AccesMediatheque) => {
    if (v === valeur || envoi) return;
    setEnvoi(true);
    try {
      const r = await patch<ReglageMediathequeDto>(`/api/cours/${cours.id}/mediatheque`, { mediatheque: v });
      setValeur(r.mediatheque);
      queryClient.setQueryData<CoursDetail>(["/api/cours", cours.id], (avant) => (avant ? { ...avant, mediatheque: r.mediatheque } : avant));
      void rafraichir("/api/mediatheque", `/api/cours/${cours.id}`);
      toast(r.mediatheque === "tous" ? "Médiathèque ouverte à tous les étudiants." : "Médiathèque réservée aux classes du cours.");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-2xl border border-ligne bg-white px-4 py-3", className)}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-creme text-orange-fonce">
        <MonitorPlay className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-[200px] flex-1">
        <p className="font-bold">Médiathèque : {valeur === "tous" ? "ouverte à tous les étudiants" : "réservée aux classes du cours"}</p>
        <p className="text-sm text-texte-pale">
          {valeur === "tous"
            ? "Tout étudiant du campus peut revoir les enregistrements et ouvrir les PDF de ce cours. Devoirs, notes et direct restent réservés aux classes du cours."
            : "Seuls les étudiants des classes du cours (et les inscrits individuels) voient ses enregistrements et ses PDF dans la médiathèque."}
        </p>
      </div>
      <div role="radiogroup" aria-label="Accès à la médiathèque du cours" className="flex w-full gap-1 rounded-xl bg-creme p-1 sm:w-auto">
        {CHOIX.map((c) => {
          const actif = c.valeur === valeur;
          const Icone = c.icone;
          return (
            <button
              key={c.valeur}
              type="button"
              role="radio"
              aria-checked={actif}
              disabled={envoi}
              onClick={() => void choisir(c.valeur)}
              className={cn(
                "flex min-h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-bold transition-colors disabled:opacity-60 sm:flex-none",
                actif ? "bg-white text-encre shadow-sm" : "text-texte-pale hover:text-encre",
              )}
            >
              <Icone className="h-4 w-4" aria-hidden />
              {c.libelle}
            </button>
          );
        })}
      </div>
    </div>
  );
}
