// Carte de la Côte d'Ivoire dessinée à la main (SVG simplifié, quelques
// centaines d'octets) : les cinq campus s'allument à mesure que leur écran
// de salle se connecte, un arc les relie à la ville du formateur.
import { cn } from "@/lib/utils";
import type { CampusDirectDto } from "@shared/schema";

// Contour simplifié (projection équirectangulaire : x = (lon + 8,8) × 60, y = (10,9 − lat) × 60).
const CONTOUR =
  "M76 392 L108 387 L132 371 L163 357 L198 351 L228 346 L258 342 L288 339 L318 345 L342 348 L351 318 L336 276 L348 234 L363 180 L372 144 L366 96 L360 78 L312 60 L270 78 L240 48 L198 30 L156 39 L120 21 L78 30 L48 42 L36 84 L54 120 L30 156 L48 198 L24 210 L30 234 L72 276 L75 318 L84 360 Z";

/** Position des campus sur la carte (les trois sites d'Abidjan et environs sont légèrement écartés pour rester lisibles). */
const POSITIONS: Record<string, { x: number; y: number; ancre: "start" | "end"; dx: number; dy: number }> = {
  riviera: { x: 300, y: 330, ancre: "start", dx: 14, dy: 16 },
  yopougon: { x: 268, y: 340, ancre: "end", dx: -14, dy: 18 },
  azaguie: { x: 292, y: 304, ancre: "start", dx: 14, dy: -4 },
  mbatto: { x: 266, y: 262, ancre: "start", dx: 14, dy: 4 },
  yamoussoukro: { x: 211, y: 245, ancre: "end", dx: -14, dy: 4 },
};

function cleSite(nomCourt: string): string {
  return nomCourt
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

export function CarteCoteIvoire({ campus, villeFormateur, className, enDirect }: { campus: CampusDirectDto[]; villeFormateur?: string | null; className?: string; enDirect?: boolean }) {
  const allumes = campus.filter((c) => c.salleConnectee).length;
  return (
    <svg viewBox="-20 -110 460 540" className={cn("h-auto w-full", className)} role="img" aria-label={`Carte des campus : ${allumes} salle${allumes > 1 ? "s" : ""} connectée${allumes > 1 ? "s" : ""} sur ${campus.length}`}>
      <defs>
        <radialGradient id="halo-campus">
          <stop offset="0%" stopColor="#E4793A" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#E4793A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d={CONTOUR} fill="#1E1C1A" stroke="#3A3431" strokeWidth="2.5" strokeLinejoin="round" />
      {/* Arc depuis la ville du formateur (hors carte, au nord) jusqu'à Abidjan */}
      <circle cx="400" cy="-80" r="7" fill="#FFD2B3" />
      <text x="388" y="-94" textAnchor="end" fill="#FFD2B3" fontFamily="IBM Plex Mono, monospace" fontSize="15">
        {villeFormateur ?? "Formateur"}
      </text>
      <path d="M400 -80 Q 470 150 292 322" fill="none" stroke="#E4793A" strokeWidth="2.5" strokeDasharray="7 7" className={cn(enDirect && "arc-direct")}>
        {enDirect && <animate attributeName="stroke-dashoffset" from="28" to="0" dur="1.2s" repeatCount="indefinite" />}
      </path>
      {campus.map((c) => {
        const p = POSITIONS[cleSite(c.nomCourt)];
        if (!p) return null;
        const r = c.salleConnectee ? Math.min(20, 8 + Math.sqrt(c.emarges + c.enLigne) * 1.6) : 6;
        return (
          <g key={c.siteId}>
            {c.salleConnectee && <circle cx={p.x} cy={p.y} r={r * 2.6} fill="url(#halo-campus)" />}
            {c.salleConnectee && (
              <circle cx={p.x} cy={p.y} r={r} fill="none" stroke="#E4793A" strokeWidth="2">
                <animate attributeName="r" from={String(r)} to={String(r * 2.4)} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.9" to="0" dur="2s" repeatCount="indefinite" />
              </circle>
            )}
            <circle cx={p.x} cy={p.y} r={r} fill={c.salleConnectee ? "#E4793A" : "#3A3431"} stroke={c.salleConnectee ? "#FFD2B3" : "#5E554F"} strokeWidth="2" />
            <text x={p.x + p.dx} y={p.y + p.dy} textAnchor={p.ancre} fill={c.salleConnectee ? "#FFFFFF" : "#8A7F76"} fontFamily="Archivo, sans-serif" fontWeight="800" fontSize="17">
              {c.nomCourt}
            </text>
            {c.salleConnectee && (
              <text x={p.x + p.dx} y={p.y + p.dy + 17} textAnchor={p.ancre} fill="#FFD2B3" fontFamily="IBM Plex Mono, monospace" fontSize="12">
                {c.emarges} en salle
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
