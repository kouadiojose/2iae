// Aperçu de la carte d'un cours telle qu'elle apparaîtra sur www.2iae.com,
// dans le style du site vitrine (crème #f0ede8, encre, orange #E8720C,
// titre en serif). Réutilisable ailleurs (pilotage « Site 2iae.com »).
import { cn } from "@/lib/utils";
import { dateCourte } from "@/lib/dates";

export type DonneesCarteSite = {
  code: string;
  titre: string;
  /** Accroche du site ; à défaut, le début de la description. */
  accroche: string | null;
  description?: string;
  imageUrl: string | null;
  couleur: string;
  dateDebut: string | null;
  dateFin: string | null;
  formateur: { prenom: string; nom: string; localisation: string | null } | null;
  /** Nombre de campus qui suivent le cours. */
  nbCampus: number;
};

const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";

function extrait(texte: string, max = 150) {
  const propre = texte.replace(/[#*_>`[\]()-]/g, "").replace(/\s+/g, " ").trim();
  return propre.length > max ? `${propre.slice(0, max - 1).trimEnd()}…` : propre;
}

export function ApercuCarteSite({ cours, className, cadre = true }: { cours: DonneesCarteSite; className?: string; cadre?: boolean }) {
  const accroche = cours.accroche?.trim() || (cours.description ? extrait(cours.description) : "");
  const ville = cours.formateur?.localisation?.split(",")[0]?.trim();
  const quand = cours.dateDebut ? `Dès le ${dateCourte(cours.dateDebut)}` : cours.dateFin ? `Jusqu'au ${dateCourte(cours.dateFin)}` : "Bientôt";
  const carte = (
    <article className="overflow-hidden rounded-xl bg-white text-left shadow-[0_10px_30px_-12px_rgba(26,24,21,.25)]" aria-label={`Aperçu de la carte « ${cours.titre} » sur 2iae.com`}>
      <div className="relative h-40 overflow-hidden" style={{ backgroundColor: cours.couleur }}>
        {cours.imageUrl ? (
          <img src={cours.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full items-end p-5">
            <span className="font-mono text-3xl font-bold tracking-tight text-white/90 [text-shadow:0_1px_12px_rgba(0,0,0,.25)]">{cours.code}</span>
          </div>
        )}
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a1815]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#E8720C]" /> Campus numérique
        </span>
      </div>
      <div className="flex flex-col gap-2 p-5">
        <p className="text-[11px] uppercase tracking-[0.25em] text-[#E8720C]">
          {cours.code} · {quand}
        </p>
        <h3 className="text-[26px] font-semibold leading-[1.1] text-[#1a1815]" style={{ fontFamily: SERIF, letterSpacing: 0 }}>
          {cours.titre || "Titre du cours"}
        </h3>
        {accroche ? (
          <p className="text-sm leading-relaxed text-[#5f5a52]">{accroche}</p>
        ) : (
          <p className="text-sm italic text-[#9a948a]">Ajoutez une accroche : c'est la phrase qui donne envie de suivre le cours.</p>
        )}
        <div className="mt-1 flex flex-col gap-0.5 text-[13px] text-[#5f5a52]">
          {cours.formateur && (
            <span>
              Avec <strong className="font-semibold text-[#1a1815]">{cours.formateur.prenom} {cours.formateur.nom}</strong>
              {ville ? `, depuis ${ville}` : ""}
            </span>
          )}
          <span>{cours.nbCampus > 1 ? `En direct dans nos ${cours.nbCampus} campus` : cours.nbCampus === 1 ? "En direct dans un campus" : "En direct au campus numérique"}</span>
        </div>
        <span className="mt-2 text-sm font-bold text-[#E8720C]">Découvrir le cours →</span>
      </div>
    </article>
  );
  if (!cadre) return <div className={className}>{carte}</div>;
  return (
    <div className={cn("rounded-2xl bg-[#f0ede8] p-4 sm:p-5", className)}>
      <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-[#8a8378]">Aperçu · www.2iae.com</p>
      {carte}
    </div>
  );
}

export default ApercuCarteSite;
