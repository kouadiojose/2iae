// Petits composants partagés par les écrans du module live.
import type { ReactNode } from "react";
import { CalendarPlus, PlayCircle, Ban } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { heure, heureDouble, pastilleDate, jourLong } from "@/lib/dates";
import { LienBouton } from "@/components/ui/bouton";
import { Badge, BadgeDirect, PastilleDate } from "@/components/ui/divers";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { chrono, CONSOMMATION, LIBELLES_FOURNISSEUR, LIBELLES_PRESENCE } from "./outils";
import type { EtatDirectDto, ModeSuivi, SeanceDetailDto } from "@shared/schema";
import type { SeanceResume } from "@shared/api";

/** En-tête de la salle live : cours, formateur, direct, compteur de connectés. */
export function EnTeteLive({ seance, etat, mode, actions }: { seance: SeanceDetailDto; etat?: EtatDirectDto; mode?: ModeSuivi; actions?: ReactNode }) {
  const maintenant = useMaintenant(1000);
  const statut = etat?.statut ?? seance.statut;
  const demarree = etat?.demarreeLe ?? seance.demarreeLe;
  const ville = seance.formateur?.localisation?.split(",")[0];
  const connectes = etat ? etat.campus.reduce((a, c) => a + c.emarges, 0) + etat.enLigne : 0;
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-mono text-xs text-nuit-gris">
          {seance.coursCode}
          {seance.formateur ? ` · ${seance.formateur.prenom} ${seance.formateur.nom}` : ""}
          {ville ? ` · depuis ${ville}` : ""}
        </span>
        <h1 className="text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-white sm:text-[26px]">{seance.titre}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {statut === "en_direct" ? (
          <span className="flex items-center gap-2 rounded-full bg-[#2A1510] px-3 py-2 font-mono text-xs text-[#FF8A6B]">
            <span className="point-direct" />
            {seance.fournisseur === "daily" ? "REC · " : "EN DIRECT · "}
            {demarree ? chrono((maintenant - new Date(demarree).getTime()) / 1000) : "00:00:00"}
          </span>
        ) : (
          <span className="rounded-full bg-nuit-carte px-3 py-2 font-mono text-xs text-nuit-doux">{statut === "planifiee" ? `Début ${heure(seance.debut)} Abidjan` : statut === "terminee" ? "Terminée" : "Annulée"}</span>
        )}
        {etat && (
          <span className="rounded-full bg-nuit-carte px-3 py-2 font-mono text-xs text-nuit-doux">
            {connectes} connecté{connectes > 1 ? "s" : ""} · 5 campus
          </span>
        )}
        {mode && <span className="hidden rounded-full bg-nuit-carte px-3 py-2 font-mono text-xs text-nuit-doux sm:inline">{CONSOMMATION[mode].titre}</span>}
        {actions}
      </div>
    </div>
  );
}

/** Séance annulée ou terminée : message clair, présence, replay. */
export function FinDeSeance({ seance }: { seance: Pick<SeanceDetailDto, "id" | "titre" | "statut" | "motifAnnulation" | "maPresence" | "coursCode" | "replayDisponible" | "monRole"> }) {
  const annulee = seance.statut === "annulee";
  return (
    <div className="grid min-h-[calc(100dvh-64px)] place-items-center bg-nuit px-4 pb-28 text-white">
      <div className="flex max-w-lg flex-col items-center gap-4 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-nuit-carte text-orange">{annulee ? <Ban className="h-7 w-7" /> : <PlayCircle className="h-7 w-7" />}</div>
        <span className="etiquette text-orange-peche">{seance.coursCode}</span>
        <h1 className="text-3xl font-black tracking-serre">{annulee ? "Ce live est annulé." : "Ce live est terminé."}</h1>
        {annulee && seance.motifAnnulation && <p className="rounded-2xl bg-nuit-carte px-5 py-3 text-lg font-semibold">{seance.motifAnnulation}</p>}
        {!annulee && seance.maPresence && (
          <p className="text-[15px] text-nuit-doux">
            Ta présence : {seance.maPresence.minutes} min · <strong className="text-white">{LIBELLES_PRESENCE[seance.maPresence.statut]}</strong>
          </p>
        )}
        <p className="text-[15px] text-nuit-doux">
          {annulee ? "Tu seras prévenu dès qu'une nouvelle date est fixée." : "Le replay, la transcription et la fiche de révision arrivent dans le cours."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {!annulee && (
            <LienBouton href={`/replays/${seance.id}`} icone={<PlayCircle className="h-4 w-4" />}>
              Revoir le cours
            </LienBouton>
          )}
          {!annulee && (seance.monRole === "formateur" || seance.monRole === "equipe") && (
            <LienBouton href={`/enseigner/seances/${seance.id}`} variante="nuit">
              Voir le bilan
            </LienBouton>
          )}
          <LienBouton href="/direct" variante="nuit">
            Mes lives
          </LienBouton>
        </div>
      </div>
    </div>
  );
}

/** Saisie du code d'émargement à 4 chiffres : un seul champ, très gros, clavier numérique. */
export function ChampCode({ valeur, onChange, nuit, autoFocus }: { valeur: string; onChange: (v: string) => void; nuit?: boolean; autoFocus?: boolean }) {
  return (
    <input
      value={valeur}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={4}
      autoFocus={autoFocus}
      aria-label="Code d'émargement à 4 chiffres"
      placeholder="• • • •"
      className={cn(
        "w-full rounded-2xl border-2 px-4 py-3 text-center font-mono text-[40px] font-semibold tracking-[0.5em] outline-none transition-colors",
        nuit ? "border-nuit-bord bg-nuit-bulle text-white placeholder:text-nuit-bord focus:border-orange" : "border-ligne bg-white text-encre placeholder:text-ligne focus:border-orange",
      )}
    />
  );
}

/** Lien « Ajouter à mon agenda » (fichier .ics du module agenda). */
export function LienAgenda({ seanceId, className, children = "Ajouter à mon agenda" }: { seanceId: number; className?: string; children?: ReactNode }) {
  return (
    <a href={`/api/agenda/seances/${seanceId}.ics`} className={cn("inline-flex items-center gap-2 font-bold no-underline", className)}>
      <CalendarPlus className="h-4 w-4" />
      {children}
    </a>
  );
}

/** Ligne de séance (listes « À venir » et « Déjà passés »). */
export function LigneSeance({ s, enseignant, lien }: { s: SeanceResume; enseignant?: boolean; lien?: string }) {
  const p = pastilleDate(s.debut);
  const href = lien ?? (s.statut === "terminee" ? `/replays/${s.id}` : enseignant ? `/enseigner/seances/${s.id}` : `/live/${s.id}`);
  const jour = jourLong(s.debut);
  return (
    <Link href={href} className="grid grid-cols-[56px_1fr_auto] items-center gap-3.5 border-b border-ligne py-3 text-encre no-underline hover:text-encre">
      <PastilleDate jour={p.jour} mois={p.mois} ton={s.statut === "en_direct" ? "orange" : "creme"} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[16px] font-bold">{s.titre}</span>
        <span className="truncate text-[13px] text-texte-gris">
          {s.coursCode} · {jour.charAt(0).toUpperCase() + jour.slice(1)} · {enseignant ? heureDouble(s.debut) : `${heure(s.debut)}`} · {s.dureeMinutes} min
        </span>
      </div>
      <span className="flex flex-col items-end gap-1">
        {s.statut === "en_direct" ? (
          <BadgeDirect />
        ) : s.statut === "annulee" ? (
          <Badge ton="danger">Annulée</Badge>
        ) : s.statut === "terminee" ? (
          <Badge ton={s.replayDisponible ? "encre" : "gris"}>{s.replayDisponible ? "Replay" : "Terminée"}</Badge>
        ) : (
          enseignant && <Badge ton="gris">{LIBELLES_FOURNISSEUR[s.fournisseur]}</Badge>
        )}
      </span>
    </Link>
  );
}

