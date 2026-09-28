// Carte d'un devoir dans « Mes devoirs » (maquette « À rendre ») : pastille
// de date, titre, échéance dite avec des mots, et où en est la copie
// (✓ envoyé · ✓✓ vu par le formateur · note).
import { Link } from "wouter";
import { Check, CheckCheck, ChevronRight, CloudUpload, Timer } from "lucide-react";
import { PastilleDate, Badge } from "@/components/ui/divers";
import { pastilleDate, heure, dateCourte } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { DevoirEtudiantResume } from "@shared/schema";
import { echeanceEnMots, noteSur } from "../outils";

/** ✓ envoyé · ✓✓ vu par le formateur, comme sur WhatsApp. */
export function Coches({ vu, className }: { vu: boolean; className?: string }) {
  return vu ? (
    <CheckCheck className={cn("h-4 w-4 text-succes", className)} aria-label="Vu par ton formateur" />
  ) : (
    <Check className={cn("h-4 w-4 text-texte-gris", className)} aria-label="Envoyé" />
  );
}

export function CarteDevoir({ d, maintenant, enAttente }: { d: DevoirEtudiantResume; maintenant: number; enAttente?: boolean }) {
  const { jour, mois } = pastilleDate(d.dateLimite);
  const echeance = echeanceEnMots(d.dateLimite, maintenant);
  const quiz = d.type === "quiz";
  const lien = quiz ? `/quiz/${d.id}` : `/devoirs/${d.id}`;
  const aFaire = d.statut === "a_rendre" || d.statut === "en_retard" || d.statut === "en_cours";
  const alerte = !enAttente && (d.statut === "en_retard" || (d.statut === "a_rendre" && echeance.urgence === "aujourdhui"));

  let etat: React.ReactNode;
  if (enAttente) {
    etat = (
      <Badge ton="orange">
        <CloudUpload className="h-3.5 w-3.5" /> En attente de réseau
      </Badge>
    );
  } else if (d.statut === "corrige") {
    etat = <span className="text-[13px] text-texte-pale">{quiz ? "Interrogation terminée" : "Corrigé"} · {dateCourte(d.dateLimite)}</span>;
  } else if (d.statut === "rendu" || d.statut === "vu") {
    etat = (
      <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-texte-pale">
        <Coches vu={d.statut === "vu"} />
        {d.statut === "vu" ? "Vu par ton formateur" : "Envoyé"}
        {d.renduLe && ` · ${dateCourte(d.renduLe)} ${heure(d.renduLe)}`}
        {d.enRetard && <Badge ton="danger">En retard</Badge>}
      </span>
    );
  } else if (d.statut === "manque") {
    etat = <Badge ton="gris">Non rendu · date dépassée</Badge>;
  } else if (d.statut === "en_retard") {
    etat = <Badge ton="danger">En retard · rends-le vite</Badge>;
  } else if (d.statut === "en_cours") {
    etat = (
      <Badge ton="orange">
        <Timer className="h-3.5 w-3.5" /> Commencée · à reprendre
      </Badge>
    );
  } else {
    etat = (
      <span className={cn("text-[14px] font-semibold", echeance.urgence === "aujourdhui" ? "text-danger" : echeance.urgence === "demain" ? "text-orange-profond" : "text-texte-pale")}>
        {echeance.urgence === "aujourdhui" && <span className="mr-1 font-mono text-[11px] uppercase tracking-wider">Aujourd'hui ·</span>}
        {echeance.texte.replace(/^Aujourd'hui /, "")}
      </span>
    );
  }

  return (
    <Link
      href={lien}
      className={cn(
        "group flex min-h-[76px] items-center gap-3.5 rounded-2xl border bg-white p-3.5 text-encre no-underline transition-colors hover:border-orange hover:text-encre sm:p-4",
        alerte ? "border-danger/40 border-l-[5px] border-l-danger" : "border-ligne",
      )}
    >
      <PastilleDate jour={jour} mois={mois} ton={aFaire && echeance.urgence === "aujourdhui" ? "orange" : "creme"} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2 font-mono text-[11px] font-semibold text-orange-fonce">
          {d.coursCode}
          {quiz && <span className="rounded-full bg-encre px-2 py-0.5 text-[10px] uppercase tracking-wider text-white">Interrogation{d.dureeMinutes ? ` · ${d.dureeMinutes} min` : ""}</span>}
        </span>
        <span className="text-[16px] font-bold leading-snug">{d.titre}</span>
        <div>{etat}</div>
      </div>
      {d.statut === "corrige" && d.note !== null ? (
        <span className="shrink-0 text-right">
          <span className="block text-[22px] font-black leading-none tracking-serre tabular-nums">{noteSur(d.note, d.bareme).split("/")[0]}</span>
          <span className="font-mono text-[11px] text-texte-gris">/{d.bareme}</span>
        </span>
      ) : (
        <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris transition-transform group-hover:translate-x-0.5" />
      )}
    </Link>
  );
}
