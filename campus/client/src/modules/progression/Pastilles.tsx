// Petits dessins du module progression, en SVG en ligne et icônes lucide :
// aucune image, quelques centaines d'octets (téléphone, bas débit).
import { AlarmClock, BadgeCheck, CalendarCheck, Footprints, Layers, MessageCircleQuestion, Mountain, Radio, Target, TrendingUp, Trophy, Tv, Users, type LucideIcon } from "lucide-react";
import { ajouterJours, type Jour } from "@shared/engagement/calendrier";
import type { CodeBadge, Trophee } from "@shared/engagement/progression";
import { cn } from "@/lib/utils";

/** Anneau de progression (jours actifs sur l'objectif). */
export function Anneau({ valeur, total, taille = 64, epaisseur = 7, className }: { valeur: number; total: number; taille?: number; epaisseur?: number; className?: string }) {
  const r = (taille - epaisseur) / 2;
  const tour = 2 * Math.PI * r;
  const part = total > 0 ? Math.min(1, valeur / total) : 0;
  return (
    <svg width={taille} height={taille} viewBox={`0 0 ${taille} ${taille}`} className={cn("shrink-0 -rotate-90", className)} aria-hidden>
      <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.14} strokeWidth={epaisseur} />
      {part > 0 && (
        <circle
          cx={taille / 2}
          cy={taille / 2}
          r={r}
          fill="none"
          stroke={part >= 1 ? "#1F8A5B" : "#E4793A"}
          strokeWidth={epaisseur}
          strokeLinecap="round"
          strokeDasharray={`${tour * part} ${tour}`}
        />
      )}
    </svg>
  );
}

/** Les 7 jours de la semaine : plein si le jour compte un acte d'apprentissage, cerclé pour aujourd'hui. */
export function JoursSemaine({ lundi, joursActifs, aujourdhui, initiales, libelleAujourdhui }: { lundi: Jour; joursActifs: Jour[]; aujourdhui: Jour; initiales: string; libelleAujourdhui: string }) {
  const actifs = new Set(joursActifs);
  return (
    <ol className="grid grid-cols-7 gap-1.5" aria-label={`${joursActifs.length}/7`}>
      {Array.from({ length: 7 }, (_, i) => {
        const jour = ajouterJours(lundi, i);
        const actif = actifs.has(jour);
        const estAujourdhui = jour === aujourdhui;
        const futur = jour > aujourdhui;
        return (
          <li key={jour} className="flex flex-col items-center gap-1">
            <span
              className={cn(
                "grid h-9 w-9 place-items-center rounded-full text-[13px] font-bold",
                actif ? "bg-orange text-encre" : futur ? "bg-creme text-texte-gris" : "bg-[#F3EAE2] text-texte-pale",
                estAujourdhui && "ring-2 ring-encre ring-offset-2",
              )}
              title={estAujourdhui ? libelleAujourdhui : undefined}
            >
              {initiales[i] ?? ""}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

const ICONES_BADGES: Record<CodeBadge, LucideIcon> = {
  premier_pas: Footprints,
  premiere_revision: Layers,
  defi_classe_5: Users,
  semaines_4: CalendarCheck,
  semaines_12: Mountain,
  directs_5: Radio,
  directs_10: Tv,
  sans_faute: BadgeCheck,
  question_votee: MessageCircleQuestion,
  devoirs_a_l_heure_5: AlarmClock,
  objectif_jour_7: Target,
};

export function IconeBadge({ code, obtenu = true, taille = 48 }: { code: CodeBadge; obtenu?: boolean; taille?: number }) {
  const Icone = ICONES_BADGES[code] ?? BadgeCheck;
  return (
    <span
      style={{ width: taille, height: taille }}
      className={cn("grid shrink-0 place-items-center rounded-full", obtenu ? "bg-orange text-encre" : "border border-dashed border-ligne-forte bg-creme text-texte-gris")}
      aria-hidden
    >
      <Icone style={{ width: taille * 0.46, height: taille * 0.46 }} />
    </span>
  );
}

const ICONES_TROPHEES: Record<Trophee, LucideIcon> = { participation: Trophy, progression: TrendingUp, assiduite: Radio, equipe: Users };

export function IconeTrophee({ trophee, className }: { trophee: Trophee; className?: string }) {
  const Icone = ICONES_TROPHEES[trophee] ?? Trophy;
  return <Icone className={className} aria-hidden />;
}
