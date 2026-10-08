// « Mes présences » (chantier C6), dans « Mon dossier » : les 20 dernières
// séances tenues de l'étudiant, par cours, en TROIS états (présent, absent,
// non relevée). « Non relevée » n'est jamais une absence : sa salle n'a pas
// été émargée ce jour-là. Une séance manquée mène à son replay (« rattraper »)
// et au cours complet quand il est prêt. La pastille sert aussi à « Déjà
// passés » de l'onglet Live.
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BookOpenCheck, PlayCircle } from "lucide-react";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { dateCourte } from "@/lib/dates";
import { TitreSection } from "@/components/ui/carte";
import { Badge } from "@/components/ui/divers";
import { t } from "@shared/textes/direct";
import type { EtatPresenceDirect, LignePresenceDirectDto, MesPresencesDto } from "@shared/engagement/direct";

export const CLE_MES_PRESENCES = ["/api/mes-presences"];

/** Les présences de l'étudiant, gardées 5 min (elles ne changent qu'après un cours). */
export function useMesPresences(actif = true) {
  return useQuery<MesPresencesDto>({ queryKey: CLE_MES_PRESENCES, staleTime: 5 * 60_000, enabled: actif });
}

/** « Présent ✓ », « Absent : rattraper » ou « Présence non relevée ». */
export function PastillePresence({ etat, court, nuit }: { etat: EtatPresenceDirect; court?: boolean; nuit?: boolean }) {
  const tx = useTextes(t);
  if (etat === "present") return <Badge ton="succes">{tx("presences.present")}</Badge>;
  if (etat === "absent") return <Badge ton="danger">{court ? tx("presences.absent.court") : tx("presences.absent")}</Badge>;
  return <Badge ton={nuit ? "nuit" : "gris"}>{tx("presences.inconnu")}</Badge>;
}

export function MesPresences() {
  const tx = useTextes(t);
  const { data, isLoading, error } = useMesPresences();
  // Une erreur (ancien serveur, réseau) masque le bloc : le dossier reste lisible.
  if (error) return null;
  const parCours = new Map<number, { titre: string; code: string; lignes: LignePresenceDirectDto[] }>();
  for (const l of data?.seances ?? []) {
    const c = parCours.get(l.coursId) ?? { titre: l.coursTitre, code: l.coursCode, lignes: [] };
    c.lignes.push(l);
    parCours.set(l.coursId, c);
  }
  const inconnues = (data?.seances ?? []).some((l) => l.etat === "inconnu");
  return (
    <section aria-labelledby="titre-presences" className="flex flex-col gap-4">
      <TitreSection titre={<span id="titre-presences">{tx("presences.titre")}</span>} className="mb-0" />
      <p className="-mt-2 text-[14px] text-texte-pale">{tx("presences.intro")}</p>
      {isLoading ? (
        <p className="rounded-2xl bg-creme px-5 py-4 text-[15px] text-texte-pale">{tx("presences.chargement")}</p>
      ) : !parCours.size ? (
        <p className="rounded-2xl border border-dashed border-ligne px-5 py-6 text-center text-[15px] text-texte-pale">{tx("presences.vide")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {[...parCours.entries()].map(([coursId, c]) => (
            <div key={coursId} className="flex flex-col rounded-2xl border border-ligne bg-white px-4">
              <p className="border-b border-ligne py-3 text-[15px] font-extrabold">
                <span className="mr-2 font-mono text-xs font-normal text-texte-gris">{c.code}</span>
                {c.titre}
              </p>
              <ul className="flex flex-col">
                {c.lignes.map((l) => (
                  <LignePresence key={l.seanceId} l={l} />
                ))}
              </ul>
            </div>
          ))}
          {inconnues && <p className="rounded-2xl bg-creme px-4 py-3 text-[14px] text-texte-doux">{tx("presences.inconnu.aide")}</p>}
        </div>
      )}
    </section>
  );
}

function LignePresence({ l }: { l: LignePresenceDirectDto }) {
  const tx = useTextes(t);
  const detail = l.enSalle ? tx("presences.enSalle") : l.minutes > 0 ? tx("presences.enLigne", { v: { n: l.minutes } }) : null;
  return (
    <li className="flex flex-col gap-2 border-b border-ligne py-3 last:border-b-0">
      <div className="flex min-w-0 flex-col items-start gap-1">
        <span className="line-clamp-2 text-[15px] font-bold">{l.titre}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-texte-gris">
          <PastillePresence etat={l.etat} />
          <span>
            {dateCourte(l.debut)}
            {detail ? ` · ${detail}` : ""}
          </span>
        </span>
      </div>
      {(l.replay || l.coursComplet) && (
        <div className="flex flex-wrap gap-2">
          {l.replay && (
            <Link
              href={`/replays/${l.seanceId}`}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[14px] font-bold no-underline",
                l.etat === "absent" ? "bg-orange text-encre hover:bg-encre hover:text-white" : "bg-creme text-encre hover:bg-orange-clair",
              )}
            >
              <PlayCircle className="h-4 w-4" /> {tx("presences.replay")}
            </Link>
          )}
          {l.coursComplet === "prete" && (
            <Link href={`/mediatheque/cours/${l.seanceId}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-creme px-3 text-[14px] font-bold text-encre no-underline hover:bg-orange-clair">
              <BookOpenCheck className="h-4 w-4" /> {tx("presences.coursComplet")}
            </Link>
          )}
          {l.coursComplet === "en_cours" && <span className="inline-flex min-h-11 items-center px-1 text-[13px] text-texte-gris">{tx("presences.coursComplet.attente")}</span>}
        </div>
      )}
    </li>
  );
}
