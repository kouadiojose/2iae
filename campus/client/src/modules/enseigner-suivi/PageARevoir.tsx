// /enseigner/a-revoir — ce que le campus laisse au formateur (décision de José du 8 octobre 2026) :
//   - les demandes de relecture de ses étudiants : le motif, puis « Garder la note » ou « Changer la note »
//     et un mot pour l'étudiant (tutoyé, phrases rapides), envoyés d'un bouton (POST /api/enseigner/relectures/:id) ;
//   - les copies que le campus n'a pas notées seul (consigne cachée pour l'IA, copie illisible, vidéo seule,
//     fichier non lu, copie vide, échecs techniques), avec la raison en clair : « Ouvrir la copie » mène à
//     l'écran de correction existant (/enseigner/devoirs/:id/copies?etudiant=).
// Lien des cartes de l'accueil. Réponse en « no-store » côté serveur (noms des étudiants, notes).
// Étiquettes justes : « Corrigé par le campus » seulement sur une note publiée du campus (parCampus) ; une
// note proposée ne dit pas qui l'a proposée (le campus, ou l'aide IA demandée par le formateur).
import { useEffect } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, ChevronRight } from "lucide-react";
import { Page } from "@/components/layout/coquille";
import { LienBouton } from "@/components/ui/bouton";
import { Carte, TitreSection } from "@/components/ui/carte";
import { Avatar, Badge, Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { useMoiConnecte } from "@/lib/auth";
import { relatif } from "@/lib/dates";
import { useTextes } from "@/lib/textes";
import { cn } from "@/lib/utils";
import { nombre } from "@/modules/evaluations/outils";
import { BadgeCampus, ICONES_RAISON, RemarqueCampus, TraiterRelecture, libelleRaison, texteRaison } from "@/modules/evaluations/composants/CorrectionCampus";
import { t, type CleCorrections } from "@shared/textes/corrections";
import type { CopieARevoir, ListeARevoir } from "@shared/engagement/corrections";
import type { Traducteur } from "@shared/textes";

type Tx = Traducteur<CleCorrections>;

const lienCopie = (c: CopieARevoir) => `/enseigner/devoirs/${c.devoirId}/copies?etudiant=${c.etudiant.id}`;

export default function PageARevoir() {
  const tx = useTextes(t);
  const moi = useMoiConnecte();
  const { data, isLoading, error, refetch } = useQuery<ListeARevoir>({ queryKey: ["/api/enseigner/a-revoir"] });
  const relectures = data?.copies.filter((c) => c.raison === "relecture" && c.relecture) ?? [];
  const retenues = data?.copies.filter((c) => c.raison !== "relecture") ?? [];

  // Liens « Relectures demandées » / « Copies à revoir » de l'accueil : on descend jusqu'à la bonne section.
  useEffect(() => {
    const ancre = window.location.hash.slice(1);
    if (!data || !["relectures", "copies"].includes(ancre)) return;
    const minuterie = setTimeout(() => document.getElementById(ancre)?.scrollIntoView({ block: "start" }), 120);
    return () => clearTimeout(minuterie);
  }, [data]);

  return (
    <Page className="max-w-2xl gap-6">
      <Link
        href={moi.role === "formateur" ? "/enseigner" : "/corrections"}
        className="-mb-2 inline-flex min-h-[44px] items-center gap-1.5 self-start text-[15px] font-semibold text-texte-pale no-underline hover:text-encre"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> {moi.role === "formateur" ? tx("corriges.retourAccueil") : "Corrections"}
      </Link>
      <header className="flex flex-col gap-1.5">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-orange-fonce">{tx("revoir.etiquette")}</span>
        <h1 className="titre-page">{tx("revoir.titre")}</h1>
        <p className="text-[15px] leading-relaxed text-texte-pale">{tx("revoir.intro")}</p>
      </header>

      {isLoading ? (
        <Chargement lignes={3} />
      ) : error || !data ? (
        <Erreur message={(error as Error)?.message ?? "Erreur"} reessayer={() => void refetch()} />
      ) : !data.copies.length ? (
        <EtatVide icone={<CheckCircle2 className="h-6 w-6" />} titre={tx("revoir.vide.titre")} texte={tx("revoir.vide.texte")} />
      ) : (
        <>
          {relectures.length > 0 && (
            <section id="relectures" aria-labelledby="titre-relectures" className="flex scroll-mt-20 flex-col gap-3">
              <TitreSection
                className="mb-0"
                titre={
                  <span id="titre-relectures" className="flex items-center gap-2">
                    {tx("revoir.relectures")} <Badge ton="orange">{relectures.length}</Badge>
                  </span>
                }
              />
              <ul className="flex flex-col gap-4">
                {relectures.map((c) => (
                  <li key={`r${c.relecture!.id}`}>
                    <CarteRelecture c={c} tx={tx} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {retenues.length > 0 && (
            <section id="copies" aria-labelledby="titre-retenues" className="flex scroll-mt-20 flex-col gap-3">
              <TitreSection
                className="mb-0"
                titre={
                  <span id="titre-retenues" className="flex items-center gap-2">
                    {tx("revoir.copies")} <Badge ton="alerte">{retenues.length}</Badge>
                  </span>
                }
              />
              <ul className="flex flex-col gap-3">
                {retenues.map((c) => (
                  <li key={`c${c.renduId}`}>
                    <CarteRetenue c={c} tx={tx} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </Page>
  );
}

/** L'étudiant, le devoir et quand la copie est arrivée. */
function Entete({ c, tx }: { c: CopieARevoir; tx: Tx }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar prenom={c.etudiant.prenom} nom={c.etudiant.nom} taille={44} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[17px] font-extrabold leading-tight">
          {c.etudiant.prenom} {c.etudiant.nom}
        </span>
        <span className="truncate text-[13px] text-texte-pale">
          <span className="font-mono text-xs font-semibold text-orange-fonce">{c.coursCode}</span> · {c.devoirTitre}
        </span>
        <span className="font-mono text-[11px] leading-snug text-texte-gris">
          {[c.etudiant.site, c.renduLe ? tx("revoir.rendue", { v: { quand: relatif(c.renduLe) } }) : null].filter(Boolean).join(" · ")}
        </span>
      </div>
    </div>
  );
}

function CarteRetenue({ c, tx }: { c: CopieARevoir; tx: Tx }) {
  const raison = c.raison === "relecture" ? "relecture" : c.raison;
  const Icone = ICONES_RAISON[raison];
  return (
    <Carte className="flex flex-col gap-3 p-4 sm:p-5">
      <Entete c={c} tx={tx} />
      <div className="flex flex-col gap-1 rounded-2xl bg-alerte-clair p-3">
        <span className="flex items-center gap-2 text-[15px] font-bold text-alerte">
          <Icone className="h-4 w-4 shrink-0" aria-hidden /> {libelleRaison(tx, raison)}
        </span>
        {/* Note publiée (recorrection retenue) : l'étudiant ne peut plus remplacer sa copie. */}
        {!(c.parCampus && raison === "illisible") && <p className="text-sm leading-snug text-texte-doux">{texteRaison(tx, raison)}</p>}
        {c.detail && <RemarqueCampus texte={c.detail} className="mt-1" />}
      </div>
      {c.note !== null && (
        <p className={cn("text-sm", c.parCampus ? "font-semibold text-encre" : "text-texte-pale")}>
          {tx(c.parCampus ? "revoir.notePubliee.ancienCorrige" : "revoir.noteProposee", { v: { note: nombre(c.note), bareme: nombre(c.bareme) } })}
        </p>
      )}
      {/* Contour : le seul bouton orange de la page reste l'envoi d'une réponse de relecture. */}
      <LienBouton href={lienCopie(c)} variante="contour" className="min-h-[52px] w-full">
        {tx("revoir.ouvrir")} <ChevronRight className="h-5 w-5" aria-hidden />
      </LienBouton>
    </Carte>
  );
}

function CarteRelecture({ c, tx }: { c: CopieARevoir; tx: Tx }) {
  return (
    <Carte className="flex flex-col gap-3 border-orange/60 p-4 sm:p-5">
      <Entete c={c} tx={tx} />
      <div className="flex flex-wrap items-center gap-2">
        {c.note !== null && (
          <span className="text-[15px] font-bold">
            {tx("revoir.notePubliee", { v: { note: nombre(c.note), bareme: nombre(c.bareme) } })}
          </span>
        )}
        {/* Une note retouchée par le formateur (commentaire seul : la relecture reste ouverte) n'est plus celle du campus. */}
        {c.parCampus && <BadgeCampus />}
      </div>
      {c.detail && <RemarqueCampus texte={c.detail} className="bg-creme" />}
      <Link href={lienCopie(c)} className="-my-1 inline-flex min-h-[44px] items-center gap-1 self-start text-[15px] font-bold">
        {tx("revoir.voirCopie")} <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>
      <TraiterRelecture relecture={c.relecture!} prenom={c.etudiant.prenom} note={c.note} bareme={c.bareme} />
    </Carte>
  );
}
