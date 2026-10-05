// /bibliotheque/libres — le portail des bibliothèques libres : l'index que le
// campus tient de Project Gutenberg, Internet Archive, OpenStax, la Banque
// mondiale et OAPEN. On cherche un titre, un auteur ou un sujet, on parcourt
// les rayons, et on lit le livre ici. Aucune IA : rien n'est décompté.
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpenText, ChevronLeft, ChevronRight, Library, RefreshCw, Search, Sparkles } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { dateCourte } from "@/lib/dates";
import { Page } from "@/components/layout/coquille";
import { Bouton } from "@/components/ui/bouton";
import { Carte, CarteLien } from "@/components/ui/carte";
import { Badge, Chargement, Erreur } from "@/components/ui/divers";
import { toast, toastErreur } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { CarteLivreLibre } from "./libres";
import {
  DOMAINES_LIBRES,
  LIBELLES_DOMAINES_LIBRES,
  LIBELLES_SOURCES_LIBRES,
  SOURCES_LIBRES,
  type AccueilLibresDto,
  type DomaineLibre,
  type RechercheLibresDto,
  type SourceLibre,
} from "@shared/schema/ext-libres";

const LANGUES = [
  { valeur: "", libelle: "Toutes les langues" },
  { valeur: "fr", libelle: "Français" },
  { valeur: "en", libelle: "Anglais" },
];

const nombre = (n: number) => n.toLocaleString("fr-FR");

export default function PagePortailLibres() {
  const moi = useMoiConnecte();
  const etudiant = moi.role === "etudiant";
  const recherche = useSearch();
  const [chemin, naviguer] = useLocation();
  const params = new URLSearchParams(recherche);
  const q = params.get("q") ?? "";
  const domaine = (DOMAINES_LIBRES as readonly string[]).includes(params.get("domaine") ?? "") ? (params.get("domaine") as DomaineLibre) : "";
  const langue = ["fr", "en"].includes(params.get("langue") ?? "") ? params.get("langue")! : "";
  const source = (SOURCES_LIBRES as readonly string[]).includes(params.get("source") ?? "") ? (params.get("source") as SourceLibre) : "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [saisie, setSaisie] = useState(q);
  useEffect(() => setSaisie(q), [q]);

  const changer = (maj: Record<string, string | number | null>) => {
    const p = new URLSearchParams(recherche);
    for (const [k, v] of Object.entries(maj)) {
      if (v === null || v === "" || (k === "page" && v === 1)) p.delete(k);
      else p.set(k, String(v));
    }
    if (!("page" in maj)) p.delete("page");
    const s = p.toString();
    naviguer(s ? `${chemin}?${s}` : chemin);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const { data: accueil, error: erreurAccueil, refetch: recharger } = useQuery<AccueilLibresDto>({
    queryKey: ["/api/libres/accueil"],
    staleTime: 5 * 60_000,
    // Direction : la progression de la moisson se suit en direct.
    refetchInterval: (requete) => (requete.state.data?.moissons?.some((m) => m.statut === "en_cours") ? 15_000 : false),
  });
  const cherche = Boolean(q || domaine || langue || source);
  const cle = `/api/libres?${new URLSearchParams(Object.entries({ q, domaine, langue, source, page: page > 1 ? String(page) : "" }).filter(([, v]) => v)).toString()}`;
  const { data, error, isLoading, refetch } = useQuery<RechercheLibresDto>({ queryKey: [cle], enabled: cherche, staleTime: 5 * 60_000 });

  const envoyer = (e: FormEvent) => {
    e.preventDefault();
    changer({ q: saisie.trim() || null });
  };

  return (
    <Page className="max-w-4xl gap-6">
      <Link href="/bibliotheque" className="inline-flex items-center gap-1.5 self-start text-sm font-bold text-texte-pale no-underline hover:text-encre">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Bibliothèque
      </Link>

      <section className="flex flex-col gap-4 rounded-[24px] bg-encre p-5 text-white sm:p-7">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-orange">
          <Library className="h-4 w-4" aria-hidden /> Bibliothèques libres
        </div>
        <h1 className="text-[28px] font-black leading-tight sm:text-4xl">{etudiant ? "Lis gratuitement, ici, en entier" : "Lire gratuitement, ici, en entier"}</h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-nuit-doux">
          {accueil?.total ? `${nombre(accueil.total)} livres` : "Des milliers de livres"} libres de droits et en libre accès : Project Gutenberg, Internet Archive, manuels OpenStax, Banque mondiale, OAPEN.{" "}
          {etudiant ? "Cherche un titre, un auteur ou un sujet, puis lis le livre sans quitter le campus." : "Cherchez un titre, un auteur ou un sujet, puis lisez le livre sans quitter le campus."}
        </p>
        <form onSubmit={envoyer} className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Titre, auteur ou sujet</span>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-texte-gris" aria-hidden />
            <input
              type="search"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              maxLength={200}
              placeholder="Ex. : comptabilité, Victor Hugo, agriculture tropicale, entrepreneuriat…"
              className="min-h-14 w-full rounded-2xl border-0 bg-white py-3.5 pl-12 pr-4 text-base text-encre outline-none ring-orange focus:ring-2"
            />
          </label>
          <Bouton type="submit" taille="lg" icone={<Search className="h-5 w-5" />} className="min-h-14">
            Chercher
          </Bouton>
        </form>
        <div className="flex flex-wrap gap-2">
          {LANGUES.map((l) => (
            <button
              key={l.valeur}
              type="button"
              onClick={() => changer({ langue: l.valeur || null })}
              className={cn("min-h-9 rounded-full border px-3 py-1.5 text-sm", langue === l.valeur ? "border-orange bg-orange text-encre" : "border-nuit-ligne text-nuit-doux hover:border-orange hover:text-white")}
            >
              {l.libelle}
            </button>
          ))}
        </div>
      </section>

      {accueil && accueil.parDomaine.length > 0 && (
        <nav aria-label="Rayons" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {accueil.parDomaine.map((d) => (
            <button
              key={d.domaine}
              type="button"
              onClick={() => changer({ domaine: domaine === d.domaine ? null : d.domaine })}
              className={cn(
                "min-h-10 shrink-0 rounded-full border px-3.5 py-2 text-sm font-bold",
                domaine === d.domaine ? "border-encre bg-encre text-white" : "border-ligne bg-white text-encre hover:border-orange",
              )}
            >
              {LIBELLES_DOMAINES_LIBRES[d.domaine]} <span className="font-mono text-xs font-normal opacity-70">{nombre(d.nombre)}</span>
            </button>
          ))}
        </nav>
      )}

      {cherche ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold">
              {isLoading ? "Recherche…" : data ? `${data.total >= 5000 ? "Plus de 5 000" : nombre(data.total)} livre${data.total > 1 ? "s" : ""}` : "Résultats"}
              {domaine ? ` · ${LIBELLES_DOMAINES_LIBRES[domaine]}` : ""}
              {source ? ` · ${LIBELLES_SOURCES_LIBRES[source].nom}` : ""}
            </h2>
            <button type="button" onClick={() => changer({ q: null, domaine: null, langue: null, source: null })} className="text-sm font-bold text-texte-pale underline">
              Tout effacer
            </button>
          </div>
          {isLoading ? (
            <Chargement lignes={4} />
          ) : error || !data ? (
            <Erreur message={(error as Error)?.message ?? "Recherche indisponible."} reessayer={() => void refetch()} />
          ) : data.resultats.length ? (
            <>
              <ul className="flex flex-col gap-2.5">
                {data.resultats.map((l) => (
                  <li key={l.id}>
                    <CarteLivreLibre livre={l} />
                  </li>
                ))}
              </ul>
              {(page > 1 || data.page * data.parPage < data.total) && (
                <div className="flex items-center justify-between gap-2">
                  <Bouton variante="contour" icone={<ChevronLeft className="h-4 w-4" />} disabled={page <= 1} onClick={() => changer({ page: page - 1 })}>
                    Précédents
                  </Bouton>
                  <span className="font-mono text-sm text-texte-gris">Page {page}</span>
                  <Bouton variante="contour" icone={<ChevronRight className="h-4 w-4" />} disabled={data.page * data.parPage >= data.total} onClick={() => changer({ page: page + 1 })}>
                    Suivants
                  </Bouton>
                </div>
              )}
            </>
          ) : (
            <Carte className="flex flex-col items-start gap-3">
              <p className="font-bold">{etudiant ? "Aucun livre libre ne correspond. Essaie d'autres mots, en français ou en anglais." : "Aucun livre libre ne correspond. Essayez d'autres mots, en français ou en anglais."}</p>
              <p className="text-[15px] text-texte-pale">
                {etudiant
                  ? "Les livres récents sont rarement libres. Le bibliothécaire peut te conseiller les meilleurs livres du monde sur ton sujet, libres ou non."
                  : "Les livres récents sont rarement libres. Le bibliothécaire conseille les meilleurs livres du monde sur un sujet, libres ou non."}
              </p>
              <LienBibliothecaire etudiant={etudiant} />
            </Carte>
          )}
        </section>
      ) : erreurAccueil ? (
        <Erreur message={(erreurAccueil as Error).message} reessayer={() => void recharger()} />
      ) : !accueil ? (
        <Chargement lignes={4} />
      ) : (
        <>
          {accueil.total === 0 && (
            <Carte className="flex flex-col gap-2">
              <p className="font-bold">L'index des bibliothèques libres se remplit.</p>
              <p className="text-[15px] text-texte-pale">Le campus rassemble en ce moment les catalogues des bibliothèques : les premiers livres arrivent dans quelques minutes.</p>
            </Carte>
          )}
          {accueil.plusLus.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-lg font-extrabold">
                <BookOpenText className="h-5 w-5 text-orange-fonce" aria-hidden /> À lire en premier
              </h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {accueil.plusLus.map((l) => (
                  <li key={l.id}>
                    <CarteLivreLibre livre={l} compacte />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {accueil.parSource.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-extrabold">Les bibliothèques</h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {accueil.parSource.map((s) => (
                  <li key={s.source}>
                    <button type="button" onClick={() => changer({ source: s.source })} className="flex h-full w-full flex-col items-start gap-1 rounded-2xl border border-ligne bg-white px-4 py-3.5 text-left hover:border-orange">
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="font-extrabold">{LIBELLES_SOURCES_LIBRES[s.source].nom}</span>
                        <Badge ton="gris">{nombre(s.nombre)}</Badge>
                      </span>
                      <span className="text-sm text-texte-pale">{LIBELLES_SOURCES_LIBRES[s.source].description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <LienBibliothecaire etudiant={etudiant} />
          {accueil.moissons && <EtatIndex accueil={accueil} />}
        </>
      )}
    </Page>
  );
}

function LienBibliothecaire({ etudiant }: { etudiant: boolean }) {
  return (
    <CarteLien href="/bibliotheque" className="flex items-center gap-3 px-4 py-3.5">
      <Sparkles className="h-5 w-5 text-orange-fonce" aria-hidden />
      <span className="flex-1">
        <span className="block font-bold">{etudiant ? "Demander conseil au bibliothécaire" : "Demander conseil au bibliothécaire"}</span>
        <span className="text-sm text-texte-pale">
          {etudiant ? "Dis-lui ce que tu étudies : il te recommande les meilleurs livres et te dit lesquels se lisent ici." : "Il recommande les meilleurs livres d'un sujet et signale ceux qui se lisent ici."}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 text-texte-gris" aria-hidden />
    </CarteLien>
  );
}

/** Direction : état de l'index et mise à jour (la moisson tourne sur le serveur). */
function EtatIndex({ accueil }: { accueil: AccueilLibresDto }) {
  const [enCours, setEnCours] = useState(false);
  const moissons = accueil.moissons ?? [];
  const actif = moissons.some((m) => m.statut === "en_cours");
  const relancer = async () => {
    setEnCours(true);
    try {
      await post("/api/libres/moisson");
      toast("Mise à jour lancée : les bibliothèques sont moissonnées l'une après l'autre.");
      await rafraichir("/api/libres/accueil");
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnCours(false);
    }
  };
  return (
    <Carte className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-extrabold">Index des bibliothèques (direction)</p>
          <p className="text-sm text-texte-pale">Le serveur du campus recopie les catalogues une fois par mois. Les étudiants y cherchent sans IA.</p>
        </div>
        <Bouton variante="contour" taille="sm" icone={<RefreshCw className="h-4 w-4" />} chargement={enCours} disabled={actif} onClick={() => void relancer()}>
          Mettre à jour l'index
        </Bouton>
      </div>
      <ul className="flex flex-col divide-y divide-ligne">
        {SOURCES_LIBRES.map((s) => {
          const m = moissons.find((x) => x.source === s);
          return (
            <li key={s} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="font-bold">{LIBELLES_SOURCES_LIBRES[s].nom}</span>
              <span className="text-texte-pale">
                {!m
                  ? "En attente"
                  : m.statut === "en_cours"
                    ? `En cours : ${nombre(m.nombre)} livres`
                    : m.statut === "erreur"
                      ? `Erreur${m.message ? ` : ${m.message}` : ""} (${nombre(m.nombre)} livres)`
                      : `${nombre(m.nombre)} livres · ${dateCourte(m.fin ?? m.debut)}`}
              </span>
            </li>
          );
        })}
      </ul>
    </Carte>
  );
}
