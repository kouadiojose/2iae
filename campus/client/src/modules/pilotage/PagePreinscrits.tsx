// /pilotage/preinscrits : les personnes qui ont rempli la préinscription (ou
// laissé leurs coordonnées) sur www.2iae.com, rangées par étape du suivi.
// « Inscrire » ouvre le formulaire d'inscription déjà rempli : rien à retaper.
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, Phone, Mail, MapPin, GraduationCap, UserPlus, Globe, FolderOpen, CalendarDays, RefreshCw, X } from "lucide-react";
import type { ListePreinscrits, PreinscritSite } from "@shared/schema";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Badge, Chargement, Erreur, EtatVide } from "@/components/ui/divers";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { cn, pluriel } from "@/lib/utils";
import { SousNav } from "./composants/SousNav";
import { telephoneLisible } from "./outils";
import { jourCourt } from "./outils-crm";

/** Étapes du suivi du site, dans l'ordre où la vie scolaire les traite. */
const ETAPES: { etape: string; titre: string; aide: string }[] = [
  { etape: "preinscrit", titre: "Préinscrits", aide: "Ils ont rempli le formulaire de préinscription." },
  { etape: "visite", titre: "Visite faite", aide: "Ils sont venus voir le campus." },
  { etape: "relance", titre: "Relancés", aide: "Déjà relancés par l'équipe." },
  { etape: "contacte", titre: "Contactés", aide: "Un premier échange a eu lieu." },
  { etape: "nouveau", titre: "Nouveaux contacts", aide: "Ils ont laissé leurs coordonnées sur le site." },
];
const TITRES_AUTRES: Record<string, string> = { inscrit: "Déjà inscrits", perdu: "Perdus de vue" };

const normaliser = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Adresse du formulaire d'inscription prérempli avec ce préinscrit. */
function lienInscription(p: PreinscritSite): string {
  const champs: [string, string | null][] = [
    ["lead", p.id],
    ["nom", p.nom],
    ["telephone", p.telephone],
    ["email", p.email],
    ["campus", p.campus],
    ["filiere", p.filiere],
  ];
  const qs = champs
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join("&");
  return `/pilotage/etudiants/nouveau?${qs}`;
}

export default function PagePreinscrits() {
  const { data, isLoading, error, refetch, isFetching } = useQuery<ListePreinscrits>({ queryKey: ["/api/pilotage/preinscrits"] });
  const [q, setQ] = useState("");

  const groupes = useMemo(() => {
    const t = normaliser(q.trim());
    const chiffres = q.replace(/\D/g, "");
    const liste = (data?.preinscrits ?? []).filter(
      (p) =>
        !t ||
        [p.nom, p.email, p.campus, p.filiere, p.notes].some((x) => normaliser(x).includes(t)) ||
        (chiffres.length >= 3 && (p.telephone ?? "").replace(/\D/g, "").includes(chiffres)),
    );
    // Les plus récents d'abord dans chaque étape.
    const tries = [...liste].sort((a, b) => (b.creeLe ?? "").localeCompare(a.creeLe ?? ""));
    const connues = ETAPES.map((e) => ({ ...e, lignes: tries.filter((p) => p.etape === e.etape) }));
    const autres = [...new Set(tries.map((p) => p.etape).filter((x) => !ETAPES.some((e) => e.etape === x)))].map((etape) => ({
      etape,
      titre: TITRES_AUTRES[etape] ?? etape.charAt(0).toUpperCase() + etape.slice(1).replace(/_/g, " "),
      aide: "",
      lignes: tries.filter((p) => p.etape === etape),
    }));
    return { total: liste.length, groupes: [...connues, ...autres].filter((g) => g.lignes.length) };
  }, [data, q]);

  const aInscrire = (data?.preinscrits ?? []).filter((p) => !p.etudiant).length;

  return (
    <Page>
      <SousNav />
      <Link href="/pilotage/etudiants" className="-mb-2 inline-flex min-h-[44px] items-center gap-1.5 self-start text-sm font-bold text-texte-pale no-underline hover:text-encre">
        <ArrowLeft className="h-4 w-4" /> Étudiants
      </Link>
      <EnTetePage
        etiquette="Pilotage · Étudiants"
        titre="Préinscrits du site 2iae.com"
        sousTitre="Les personnes qui ont rempli la préinscription ou laissé leurs coordonnées sur www.2iae.com. Transformez-les en étudiants du campus en un clic, sans rien retaper."
        actions={
          data?.branche ? (
            <Bouton variante="contour" icone={<RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />} onClick={() => refetch()} disabled={isFetching} className="min-h-[48px]">
              Actualiser
            </Bouton>
          ) : undefined
        }
      />

      {isLoading ? (
        <Chargement lignes={4} />
      ) : error ? (
        <Erreur message={(error as Error).message} reessayer={() => refetch()} />
      ) : !data?.branche ? (
        <section className="flex flex-col gap-4 rounded-[28px] bg-creme p-5 sm:flex-row sm:items-start sm:p-8">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-orange-fonce">
            <Globe className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="flex min-w-0 flex-col gap-3">
            <h2 className="text-xl font-extrabold">La liste du site n'est pas disponible pour l'instant</h2>
            {data?.message && <p className="text-[15px] leading-relaxed text-texte-doux">{data.message}</p>}
            <p className="text-[15px] leading-relaxed text-texte-doux">
              Rien ne bloque pour autant : vous pouvez inscrire un étudiant à la main, avec tout son dossier, dès maintenant.
            </p>
            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap">
              <LienBouton href="/pilotage/etudiants/nouveau" icone={<UserPlus className="h-4 w-4" />} className="min-h-[48px]">
                Inscrire un étudiant
              </LienBouton>
              <Bouton variante="contour" icone={<RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />} onClick={() => refetch()} disabled={isFetching} className="min-h-[48px]">
                Réessayer
              </Bouton>
            </div>
          </div>
        </section>
      ) : !data.preinscrits.length ? (
        <EtatVide
          icone={<Globe className="h-6 w-6" />}
          titre="Aucun préinscrit pour l'instant."
          texte="Dès qu'une personne remplit la préinscription sur www.2iae.com, elle apparaît ici, prête à être inscrite."
          action={
            <LienBouton href="/pilotage/etudiants/nouveau" variante="contour" icone={<UserPlus className="h-4 w-4" />} className="min-h-[48px]">
              Inscrire un étudiant à la main
            </LienBouton>
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-texte-gris" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nom, téléphone, e-mail, campus ou filière"
                aria-label="Rechercher un préinscrit"
                className="min-h-[52px] w-full rounded-xl border border-ligne bg-white pl-12 pr-4 text-base outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
              />
            </div>
            <p className="text-sm text-texte-pale" aria-live="polite">
              {q.trim()
                ? `${pluriel(groupes.total, "résultat")} sur ${data.preinscrits.length}`
                : `${pluriel(data.preinscrits.length, "contact")} du site, dont ${aInscrire} pas encore ${aInscrire > 1 ? "inscrits" : "inscrit"} au campus`}
            </p>
          </div>

          {!groupes.groupes.length ? (
            <EtatVide
              icone={<Search className="h-6 w-6" />}
              titre="Personne ne correspond."
              texte="Essayez une autre orthographe, ou une partie du numéro."
              action={
                <Bouton variante="contour" icone={<X className="h-4 w-4" />} onClick={() => setQ("")} className="min-h-[48px]">
                  Effacer la recherche
                </Bouton>
              }
            />
          ) : (
            groupes.groupes.map((g) => (
              <section key={g.etape} aria-labelledby={`etape-${g.etape}`} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 id={`etape-${g.etape}`} className="text-xl font-extrabold">
                    {g.titre}
                  </h2>
                  <Badge ton="gris">{g.lignes.length}</Badge>
                  {g.aide && <p className="w-full text-sm text-texte-pale sm:w-auto">{g.aide}</p>}
                </div>
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {g.lignes.map((p) => (
                    <CartePreinscrit key={p.id} p={p} />
                  ))}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </Page>
  );
}

function CartePreinscrit({ p }: { p: PreinscritSite }) {
  const [notesOuvertes, setNotesOuvertes] = useState(false);
  const longues = (p.notes ?? "").length > 110 || (p.notes ?? "").includes("\n");
  return (
    <li className={cn("flex flex-col gap-3 rounded-2xl border bg-white p-4", p.etudiant ? "border-ligne-douce" : "border-ligne")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("text-base font-bold leading-snug", !p.nom && "text-texte-gris")}>{p.nom ?? "Nom non renseigné"}</p>
          {p.creeLe && (
            <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-texte-gris">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" /> Le {jourCourt(p.creeLe)}
              {p.source && p.source !== "site" ? ` · ${p.source}` : ""}
            </p>
          )}
        </div>
        {p.etudiant && <Badge ton="succes">Déjà inscrit</Badge>}
      </div>

      <ul className="flex flex-col gap-1 text-[15px]">
        {p.telephone && (
          <li>
            <a href={`tel:${p.telephone.replace(/[^\d+]/g, "")}`} className="inline-flex min-h-[40px] items-center gap-2 font-semibold text-encre no-underline hover:text-orange-fonce">
              <Phone className="h-4 w-4 shrink-0 text-texte-gris" aria-hidden="true" />
              {telephoneLisible(p.telephone)}
            </a>
          </li>
        )}
        {p.email && (
          <li className="min-w-0">
            <a href={`mailto:${p.email}`} className="inline-flex min-h-[40px] max-w-full items-center gap-2 text-texte-doux no-underline hover:text-orange-fonce">
              <Mail className="h-4 w-4 shrink-0 text-texte-gris" aria-hidden="true" />
              <span className="truncate">{p.email}</span>
            </a>
          </li>
        )}
        {(p.campus || p.filiere) && (
          <li className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm text-texte-doux">
            {p.campus && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0 text-texte-gris" aria-hidden="true" />
                {p.campus}
              </span>
            )}
            {p.filiere && (
              <span className="inline-flex items-center gap-1.5">
                <GraduationCap className="h-4 w-4 shrink-0 text-texte-gris" aria-hidden="true" />
                {p.filiere}
              </span>
            )}
          </li>
        )}
      </ul>

      {p.notes && (
        <div className="rounded-xl bg-creme px-3 py-2 text-sm text-texte-doux">
          <p className={cn("whitespace-pre-line", !notesOuvertes && "line-clamp-2")}>{p.notes}</p>
          {longues && (
            <button type="button" onClick={() => setNotesOuvertes((o) => !o)} className="min-h-[36px] text-[13px] font-bold text-orange-fonce hover:text-encre" aria-expanded={notesOuvertes}>
              {notesOuvertes ? "Réduire" : "Lire la note"}
            </button>
          )}
        </div>
      )}

      <div className="mt-auto pt-1">
        {p.etudiant ? (
          <LienBouton href={`/pilotage/etudiants/${p.etudiant.id}`} variante="contour" icone={<FolderOpen className="h-4 w-4" />} className="min-h-[48px] w-full">
            Dossier de {p.etudiant.prenom}
            {p.etudiant.matricule ? ` · ${p.etudiant.matricule}` : ""}
          </LienBouton>
        ) : (
          <LienBouton href={lienInscription(p)} icone={<UserPlus className="h-4 w-4" />} className="min-h-[48px] w-full">
            Inscrire
          </LienBouton>
        )}
      </div>
    </li>
  );
}
