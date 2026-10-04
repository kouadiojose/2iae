// /bibliotheque — la bibliothèque virtuelle : un sujet, et l'IA propose les
// meilleurs livres (vérifiés dans les catalogues publics), puis aide à les
// explorer : fiche de lecture, questions, quiz, notes, exposé.
import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Library, Search, Sparkles, Presentation, History, BookMarked, Users } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { dateCourte } from "@/lib/dates";
import { Page } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { CarteLien } from "@/components/ui/carte";
import { Chargement, Erreur } from "@/components/ui/divers";
import { toastErreur } from "@/components/ui/toast";
import { useEtatIa, blocageDe } from "@/modules/ia/api-ia";
import { BandeauBlocage } from "@/modules/ia/composants";
import { CarteLivreCompacte } from "./composants";
import type { MaBibliothequeDto, RechercheBiblioDto } from "@shared/schema/ext-bibliotheque";

const EXEMPLES = [
  "Calcul des structures en béton armé",
  "Créer et financer une petite entreprise en Côte d'Ivoire",
  "Marketing digital pour une PME",
  "Gestion de projet de construction",
  "Bases de données et SQL",
  "Comptabilité générale SYSCOHADA",
];

export default function PageBibliotheque() {
  const moi = useMoiConnecte();
  const etudiant = moi.role === "etudiant";
  const [, naviguer] = useLocation();
  const { data, error, isLoading, refetch } = useQuery<MaBibliothequeDto>({ queryKey: ["/api/bibliotheque"] });
  const { data: etat } = useEtatIa();
  const blocage = blocageDe(etat);
  const [sujet, setSujet] = useState("");
  const [enCours, setEnCours] = useState(false);

  const chercher = async (e?: FormEvent) => {
    e?.preventDefault();
    const s = sujet.trim();
    if (s.length < 3 || enCours) return;
    setEnCours(true);
    try {
      const r = await post<RechercheBiblioDto>("/api/bibliotheque/recherches", { sujet: s });
      void rafraichir("/api/bibliotheque", "/api/ia/etat");
      naviguer(`/bibliotheque/recherches/${r.id}`);
    } catch (err) {
      toastErreur(err);
      void rafraichir("/api/ia/etat");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Page className="max-w-4xl gap-7">
      <section className="flex flex-col gap-4 rounded-[24px] bg-encre p-5 text-white sm:p-7">
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-orange">
          <Library className="h-4 w-4" aria-hidden /> Bibliothèque virtuelle
        </div>
        <h1 className="text-[28px] font-black leading-tight sm:text-4xl">{etudiant ? "Quel sujet veux-tu explorer ?" : "Quel sujet voulez-vous explorer ?"}</h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-nuit-doux">
          {etudiant
            ? "Donne un sujet de cours ou d'exposé : l'IA te propose les meilleurs livres, vérifiés dans les catalogues des bibliothèques. Ouvre ensuite un livre pour lire sa fiche, lui poser tes questions, te tester et préparer ton exposé."
            : "Un sujet de cours ou d'exposé : l'IA propose les meilleurs livres, vérifiés dans les catalogues des bibliothèques, puis aide à les explorer (fiche, questions, quiz, exposé)."}
        </p>
        <form onSubmit={chercher} className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Sujet de recherche</span>
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-texte-gris" aria-hidden />
            <input
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
              maxLength={300}
              placeholder="Ex. : les fondations d'un bâtiment"
              className="min-h-14 w-full rounded-2xl border-0 bg-white pl-12 pr-4 text-base text-encre outline-none ring-orange focus:ring-2"
              disabled={enCours}
            />
          </label>
          <Bouton type="submit" taille="lg" chargement={enCours} disabled={sujet.trim().length < 3 || Boolean(blocage)} icone={<Sparkles className="h-5 w-5" />} className="min-h-14">
            Trouver des livres
          </Bouton>
        </form>
        {enCours ? (
          <p className="text-sm text-nuit-doux" role="status">
            L'IA choisit les livres, puis chacun est vérifié dans les catalogues de la BnF et d'Open Library. Compte une trentaine de secondes.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {EXEMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => setSujet(ex)} className="min-h-9 rounded-full border border-nuit-ligne px-3 text-sm text-nuit-doux hover:border-orange hover:text-white">
                {ex}
              </button>
            ))}
          </div>
        )}
      </section>

      <BandeauBlocage etat={etat} enseignant={!etudiant} />

      {!etudiant && (
        <CarteLien href="/bibliotheque/activite" className="flex items-center gap-3 px-4 py-3.5">
          <Users className="h-5 w-5 text-orange-fonce" aria-hidden />
          <span className="flex-1">
            <span className="block font-bold">Suivre les recherches des étudiants</span>
            <span className="text-sm text-texte-pale">Sujets, livres trouvés et exposés préparés, pour accompagner l'exercice.</span>
          </span>
        </CarteLien>
      )}

      {isLoading ? (
        <Chargement lignes={3} />
      ) : error || !data ? (
        <Erreur message={(error as Error)?.message ?? "Bibliothèque indisponible."} reessayer={() => void refetch()} />
      ) : (
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-2">
          <Section titre={etudiant ? "Mes recherches" : "Vos recherches"} icone={<History className="h-4 w-4" />}>
            {data.recherches.length ? (
              <ul className="flex flex-col gap-2">
                {data.recherches.map((r) => (
                  <li key={r.id}>
                    <CarteLien href={`/bibliotheque/recherches/${r.id}`} className="flex flex-col px-4 py-3">
                      <span className="font-bold">{r.sujet}</span>
                      <span className="text-sm text-texte-pale">
                        {r.nbLivres} livre{r.nbLivres > 1 ? "s" : ""} · {dateCourte(r.creeLe)}
                      </span>
                    </CarteLien>
                  </li>
                ))}
              </ul>
            ) : (
              <Vide texte={etudiant ? "Tes recherches apparaîtront ici. Commence par un sujet ci-dessus." : "Vos recherches apparaîtront ici."} />
            )}
          </Section>

          <Section titre={etudiant ? "Mes exposés" : "Vos exposés"} icone={<Presentation className="h-4 w-4" />}>
            {data.exposes.length ? (
              <ul className="flex flex-col gap-2">
                {data.exposes.map((e) => (
                  <li key={e.id}>
                    <CarteLien href={`/bibliotheque/exposes/${e.id}`} className="flex flex-col px-4 py-3">
                      <span className="font-bold">{e.sujet}</span>
                      <span className="truncate text-sm text-texte-pale">
                        {e.livreTitre} · {dateCourte(e.creeLe)}
                      </span>
                    </CarteLien>
                  </li>
                ))}
              </ul>
            ) : (
              <Vide texte={etudiant ? "Ouvre un livre puis « Préparer mon exposé » : plan, diapositives et bibliographie." : "Ouvrez un livre puis « Préparer un exposé »."} />
            )}
          </Section>

          {data.livres.length > 0 && (
            <Section titre={etudiant ? "Mes livres" : "Vos livres"} icone={<BookMarked className="h-4 w-4" />}>
              <ul className="flex flex-col gap-2">
                {data.livres.map((l) => (
                  <li key={l.id}>
                    <CarteLivreCompacte livre={l} />
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {data.populaires.length > 0 && (
            <Section titre="Étudiés sur le campus" icone={<Library className="h-4 w-4" />}>
              <ul className="flex flex-col gap-2">
                {data.populaires.map((l) => (
                  <li key={l.id}>
                    <CarteLivreCompacte livre={l} />
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}

      <p className="text-sm text-texte-gris">
        Les fiches et les réponses sont rédigées par l'IA d'après ce qu'elle sait des livres : elles aident à explorer, elles ne remplacent pas la lecture. Vérifie toujours une information importante dans le livre.{" "}
        <LienBouton href="/assistant/charte" variante="fantome" taille="sm" className="inline-flex">
          Charte de l'IA
        </LienBouton>
      </p>
    </Page>
  );
}

function Section({ titre, icone, children }: { titre: string; icone: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">
        {icone}
        {titre}
      </h2>
      {children}
    </section>
  );
}

function Vide({ texte }: { texte: string }) {
  return <p className="rounded-2xl bg-creme p-4 text-[15px] text-texte-pale">{texte}</p>;
}
