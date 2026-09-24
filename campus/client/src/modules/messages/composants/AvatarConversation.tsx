// Pastille d'une conversation : la photo (ou les initiales) de la personne,
// ou, pour un salon « Questions du cours », un carré à la couleur du cours.
import { Avatar } from "@/components/ui/divers";
import { cn } from "@/lib/utils";
import type { CoursSalon, ContactMessages } from "@shared/schema";

/** Texte lisible sur la couleur d'un cours (encre sur fond clair, blanc sur fond sombre). */
function encreSur(hex: string): string {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!m) return "#141414";
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.36 ? "#141414" : "#FFFFFF";
}

export function PastilleCours({ cours, taille = 48, className }: { cours: CoursSalon; taille?: number; className?: string }) {
  const code = cours.code.split(/[-\s]/)[0].slice(0, 3).toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cn("grid shrink-0 place-items-center rounded-[14px] font-mono font-bold", className)}
      style={{ width: taille, height: taille, background: cours.couleur || "#E4793A", color: encreSur(cours.couleur || "#E4793A"), fontSize: Math.round(taille * 0.3) }}
    >
      {code}
    </span>
  );
}

export function AvatarConversation({
  interlocuteur,
  cours,
  taille = 48,
  className,
}: {
  interlocuteur: Pick<ContactMessages, "prenom" | "nom" | "photoUrl"> | null;
  cours: CoursSalon | null;
  taille?: number;
  className?: string;
}) {
  if (cours && !interlocuteur) return <PastilleCours cours={cours} taille={taille} className={className} />;
  return <Avatar prenom={interlocuteur?.prenom} nom={interlocuteur?.nom} photo={interlocuteur?.photoUrl} taille={taille} className={className} />;
}
