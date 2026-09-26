// Emploi du temps du campus numérique, tel que la direction des études le
// publie depuis le back-office du campus (GET /api/campus/programme, relu
// par le site à chaque publication). Grille par jour sur ordinateur, liste
// sur téléphone, prochaines séances. Heures d'Abidjan.
import { useQuery } from "@tanstack/react-query";
import type { CreneauCampus, OccurrenceCampus, ReponseProgrammeCampus, SessionCampus } from "@shared/campus";
import { CAMPUS_URL_REPLI } from "@shared/campus";
import { ETIQUETTE, ORANGE_TEXTE, LienCampus, BOUTON_SECONDAIRE } from "@/components/campus-numerique";

const JOURS = ["", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function useProgrammeCampus() {
  const q = useQuery<ReponseProgrammeCampus>({ queryKey: ["/api/campus/programme"], staleTime: 60_000, refetchInterval: 5 * 60_000, retry: 1 });
  const d = q.data;
  return {
    programme: d && !d.indisponible ? d : null,
    campusUrl: d?.campusUrl ?? CAMPUS_URL_REPLI,
    chargement: q.isLoading,
  };
}

/** « 2026-09-28 » → « lundi 28 septembre 2026 » (jour civil, sans fuseau). */
function dateLongue(jour: string, avecAnnee = true): string {
  const [a, m, j] = jour.split("-").map(Number);
  const js = new Date(Date.UTC(a, m - 1, j)).getUTCDay();
  const nomJour = JOURS[js === 0 ? 7 : js].toLowerCase();
  return `${nomJour} ${j === 1 ? "1er" : j} ${MOIS[m - 1]}${avecAnnee ? ` ${a}` : ""}`;
}

const minutes = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const affHeure = (h: string) => h.replace(":", "h");

/** Session à montrer : celle en cours, sinon la prochaine, sinon la dernière. */
export function sessionCourante(sessions: SessionCampus[], aujourdhui: string): SessionCampus | null {
  const triees = [...sessions].sort((a, b) => a.debut.localeCompare(b.debut));
  return triees.find((s) => s.debut <= aujourdhui && aujourdhui <= s.fin) ?? triees.find((s) => s.debut > aujourdhui) ?? triees[triees.length - 1] ?? null;
}

function Intervenant({ c }: { c: CreneauCampus }) {
  if (!c.intervenant) return null;
  const mention = c.mention || c.intervenant.titre;
  return (
    <p className="mt-1 text-sm text-[#3d382f]">
      {c.intervenant.nom}
      {mention ? <span className="block text-xs text-[#6b625b]">{mention}</span> : null}
    </p>
  );
}

function CaseCreneau({ c }: { c: CreneauCampus }) {
  const couleur = c.cours?.couleur ?? "#E8720C";
  return (
    <div className="h-full rounded-2xl border border-[#EADFD5] bg-white p-3" style={{ boxShadow: `inset 4px 0 0 ${couleur}` }}>
      <p className={`${ETIQUETTE} text-[10px] text-[#6b625b]`}>
        {affHeure(c.heureDebut)} – {affHeure(c.heureFin)}
      </p>
      <p className="mt-1 font-semibold leading-snug text-[#1a1815]">{c.libelle}</p>
      <Intervenant c={c} />
    </div>
  );
}

/** Grille « comme le document du service des études » (ordinateur). */
function Grille({ session }: { session: SessionCampus }) {
  const jours = Array.from(new Set(session.creneaux.map((c) => c.jour))).sort((a, b) => a - b);
  const bandes = Array.from(new Map(session.creneaux.map((c) => [`${c.heureDebut}-${c.heureFin}`, c] as const)).values())
    .map((c) => ({ debut: c.heureDebut, fin: c.heureFin }))
    .sort((a, b) => minutes(a.debut) - minutes(b.debut) || minutes(a.fin) - minutes(b.fin));
  // Un créneau qui couvre toutes les plages (séminaire de la journée) s'étire sur toute la hauteur.
  const min = Math.min(...bandes.map((b) => minutes(b.debut)));
  const max = Math.max(...bandes.map((b) => minutes(b.fin)));
  const journee = (c: CreneauCampus) => bandes.length > 1 && minutes(c.heureDebut) <= min && minutes(c.heureFin) >= max;
  const lignes = bandes.filter((b) => !(minutes(b.debut) <= min && minutes(b.fin) >= max && bandes.length > 1));
  const pause = session.pause;
  const rangees: ({ type: "bande"; debut: string; fin: string } | { type: "pause"; debut: string; fin: string })[] = [];
  for (const b of lignes) {
    if (pause && minutes(b.debut) >= minutes(pause.fin) && !rangees.some((r) => r.type === "pause")) rangees.push({ type: "pause", ...pause });
    rangees.push({ type: "bande", ...b });
  }
  if (!lignes.length) return null;

  return (
    <div className="overflow-hidden rounded-3xl border border-[#EADFD5] bg-[#FBF8F4]">
      <div className="grid" style={{ gridTemplateColumns: `7.5rem repeat(${jours.length}, minmax(0, 1fr))` }}>
        <div className="border-b border-[#EADFD5] p-3" />
        {jours.map((j) => (
          <div key={j} className={`${ETIQUETTE} border-b border-l border-[#EADFD5] p-3 text-center text-[#1a1815]`}>
            {JOURS[j]}
          </div>
        ))}
        {rangees.map((r, i) => {
          const rangee = i + 2;
          if (r.type === "pause") {
            // La pause s'étend sur les jours sans créneau de journée entière (le séminaire du samedi la couvre).
            const groupes: { debut: number; longueur: number }[] = [];
            jours.forEach((j, col) => {
              if (session.creneaux.some((c) => c.jour === j && journee(c))) return;
              const dernier = groupes[groupes.length - 1];
              if (dernier && dernier.debut + dernier.longueur === col) dernier.longueur++;
              else groupes.push({ debut: col, longueur: 1 });
            });
            return (
              <div key={`p${i}`} className="contents">
                <div className={`${ETIQUETTE} border-b border-[#EADFD5] p-3 text-[#6b625b]`} style={{ gridRow: rangee }}>
                  {affHeure(r.debut)} – {affHeure(r.fin)}
                </div>
                {groupes.map((g) => (
                  <div
                    key={g.debut}
                    className={`${ETIQUETTE} flex items-center justify-center border-b border-l border-[#EADFD5] p-3 tracking-[0.6em] text-[#6b625b]`}
                    style={{ gridRow: rangee, gridColumn: `${g.debut + 2} / span ${g.longueur}` }}
                  >
                    PAUSE
                  </div>
                ))}
              </div>
            );
          }
          return (
            <div key={`b${i}`} className={`${ETIQUETTE} border-b border-[#EADFD5] p-3 text-[#6b625b]`} style={{ gridRow: rangee }}>
              {affHeure(r.debut)} – {affHeure(r.fin)}
            </div>
          );
        })}
        {jours.map((j, colonne) =>
          rangees.map((r, i) => {
            if (r.type !== "bande") return null;
            const c = session.creneaux.find((x) => x.jour === j && x.heureDebut === r.debut && x.heureFin === r.fin);
            const entier = session.creneaux.find((x) => x.jour === j && journee(x));
            if (entier) {
              if (i !== rangees.findIndex((x) => x.type === "bande")) return null;
              return (
                <div key={`${j}-${i}`} className="border-b border-l border-[#EADFD5] p-2" style={{ gridColumn: colonne + 2, gridRow: `2 / span ${rangees.length}` }}>
                  <div className="flex h-full flex-col justify-center rounded-2xl bg-[#1a1815] p-4 text-center text-white">
                    <p className="break-words font-serif text-lg uppercase tracking-[0.12em] xl:text-xl">{entier.libelle}</p>
                    <p className={`${ETIQUETTE} mt-2 text-[10px] text-white/70`}>
                      {affHeure(entier.heureDebut)} – {affHeure(entier.heureFin)}
                    </p>
                    {entier.intervenant && <p className="mt-2 text-sm text-white/80">{entier.intervenant.nom}</p>}
                  </div>
                </div>
              );
            }
            return (
              <div key={`${j}-${i}`} className="border-b border-l border-[#EADFD5] p-2" style={{ gridColumn: colonne + 2, gridRow: i + 2 }}>
                {c ? <CaseCreneau c={c} /> : null}
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}

/** Liste par jour (téléphone). */
function ListeParJour({ session }: { session: SessionCampus }) {
  const jours = Array.from(new Set(session.creneaux.map((c) => c.jour))).sort((a, b) => a - b);
  return (
    <div className="flex flex-col gap-4">
      {jours.map((j) => (
        <div key={j}>
          <p className={`${ETIQUETTE} mb-2 text-[#1a1815]`}>{JOURS[j]}</p>
          <div className="flex flex-col gap-2">
            {session.creneaux
              .filter((c) => c.jour === j)
              .sort((a, b) => minutes(a.heureDebut) - minutes(b.heureDebut))
              .map((c) => (
                <CaseCreneau key={c.id} c={c} />
              ))}
          </div>
        </div>
      ))}
      {session.pause && (
        <p className="text-sm text-[#6b625b]">
          Pause de {affHeure(session.pause.debut)} à {affHeure(session.pause.fin)}.
        </p>
      )}
    </div>
  );
}

function Prochaines({ occurrences }: { occurrences: OccurrenceCampus[] }) {
  if (!occurrences.length) return null;
  return (
    <div className="rounded-3xl bg-[#1a1815] p-6 text-white">
      <p className={`${ETIQUETTE} text-[#F0A868]`}>Prochaines séances</p>
      <ul className="mt-4 flex flex-col divide-y divide-white/10">
        {occurrences.slice(0, 6).map((o) => (
          <li key={`${o.creneauId}-${o.date}`} className="flex items-baseline justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className={`font-semibold ${o.statut === "annulee" ? "line-through opacity-60" : ""}`}>{o.libelle}</p>
              <p className="text-sm text-white/70">
                {dateLongue(o.date, false)}
                {o.intervenant ? ` · ${o.intervenant}` : ""}
              </p>
            </div>
            <span className={`${ETIQUETTE} shrink-0 text-[11px] ${o.statut === "en_direct" ? "text-[#FF7A45]" : "text-white/70"}`}>
              {o.statut === "en_direct" ? "En direct" : o.statut === "annulee" ? "Annulée" : `${o.debut.slice(11, 16).replace(":", "h")}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Bloc complet pour la page /campus-numerique. Rien ne s'affiche tant qu'aucun emploi du temps n'est publié. */
export function EmploiDuTempsCampus() {
  const { programme, campusUrl } = useProgrammeCampus();
  if (!programme) return null;
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const session = sessionCourante(programme.sessions, aujourdhui);
  if (!session || !session.creneaux.length) return null;
  return (
    <section className="bg-white mobile-no-overflow" aria-labelledby="titre-emploi-du-temps">
      <div className="container mx-auto mobile-padding py-14 lg:py-20">
        <div className="mb-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className={`${ETIQUETTE} ${ORANGE_TEXTE} mb-3`}>
              Année académique {session.anneeAcademique} · {session.titre}
            </p>
            <h2 id="titre-emploi-du-temps" className="font-serif text-4xl leading-tight text-[#1a1815] sm:text-5xl">
              Emploi du temps{session.public ? ` · ${session.public}` : ""}
            </h2>
            <p className="mt-3 text-lg text-[#5e554f]">
              Du {dateLongue(session.debut)} au {dateLongue(session.fin)}. Heures d'Abidjan. Chaque cours est diffusé en direct dans
              les salles de conférence des cinq campus.
            </p>
          </div>
          <LienCampus href={`${campusUrl}/programme`} className={`${BOUTON_SECONDAIRE} shrink-0 whitespace-nowrap`} testId="link-emploi-du-temps-complet">
            Voir et imprimer
          </LienCampus>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <div className="hidden md:block">
            <Grille session={session} />
            {session.note && <p className="mt-4 text-sm text-[#6b625b]">{session.note}</p>}
            <p className={`${ETIQUETTE} mt-4 text-right text-[#6b625b]`}>{session.signataire}</p>
          </div>
          <div className="md:hidden">
            <ListeParJour session={session} />
          </div>
          <Prochaines occurrences={programme.prochaines} />
        </div>
        <div className="md:hidden">
          {session.note && <p className="mt-4 text-sm text-[#6b625b]">{session.note}</p>}
          <p className={`${ETIQUETTE} mt-6 text-[#6b625b]`}>{session.signataire}</p>
        </div>
      </div>
    </section>
  );
}
