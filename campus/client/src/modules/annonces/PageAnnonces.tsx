// /annonces — les annonces qui me concernent (tout le campus, mon campus, ma
// classe, mes cours) : importantes et épinglées en tête, non lues marquées.
// Les formateurs écrivent ici aux inscrits de leurs cours et suivent qui a lu.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "wouter";
import { ChevronRight, Megaphone, PenLine } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { useTousEvenements } from "@/lib/flux";
import { rafraichir } from "@/lib/queryClient";
import { relatif } from "@/lib/dates";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { TitreSection } from "@/components/ui/carte";
import { BarreProgression, Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { Onglets } from "@/components/ui/onglets";
import type { AnnonceDto, AnnonceGestion } from "@shared/schema";
import { CarteAnnonce, BadgesAnnonce } from "./composants";
import { FenetreAnnonce } from "./FenetreAnnonce";
import { tutoie } from "../accueil/outils";

export default function PageAnnonces() {
  const moi = useMoiConnecte();
  const tu = tutoie(moi);
  const [, naviguer] = useLocation();
  const recherche = new URLSearchParams(useSearch());
  const peutEcrire = moi.role === "formateur" || moi.role === "admin" || moi.role === "vie_scolaire";
  const [redaction, setRedaction] = useState(peutEcrire && recherche.get("nouvelle") === "1");
  const [vue, setVue] = useState<"recues" | "miennes">("recues");

  const { data, isLoading, error, refetch } = useQuery<AnnonceDto[]>({ queryKey: ["/api/annonces"] });
  useTousEvenements((e) => {
    if (e.type === "annonce") void rafraichir("/api/annonces");
  });

  const fermerRedaction = () => {
    setRedaction(false);
    if (recherche.get("nouvelle")) naviguer("/annonces", { replace: true });
  };

  const liste = data ?? [];
  const nonLues = liste.filter((a) => !a.lue).length;
  // En tête : les importantes pas encore lues, puis les épinglées et les importantes déjà lues.
  const enTete = liste
    .filter((a) => a.importante || a.epinglee)
    .sort((x, y) => Number(y.importante && !y.lue) - Number(x.importante && !x.lue));
  const autres = liste.filter((a) => !a.importante && !a.epinglee);

  return (
    <Page>
      <EnTetePage
        etiquette={nonLues ? `${nonLues} non lue${nonLues > 1 ? "s" : ""}` : "Vie scolaire et formateurs"}
        titre="Annonces"
        sousTitre={
          tu
            ? "Les informations de la vie scolaire et de tes formateurs : changements de salle, examens, consignes."
            : moi.role === "formateur"
              ? "Les informations du campus, et vos messages aux inscrits de vos cours."
              : "Les annonces publiées pour le groupe et vos campus."
        }
        actions={
          peutEcrire ? (
            <>
              {moi.role !== "formateur" && (
                <LienBouton href="/pilotage/annonces" variante="contour" className="min-h-[48px]">
                  Suivi des lectures
                </LienBouton>
              )}
              <Bouton onClick={() => setRedaction(true)} className="min-h-[48px]" icone={<PenLine className="h-4 w-4" />}>
                Nouvelle annonce
              </Bouton>
            </>
          ) : undefined
        }
      />

      {moi.role === "formateur" && (
        <Onglets
          valeur={vue}
          onChange={setVue}
          options={[
            { valeur: "recues", libelle: "Toutes les annonces", compteur: nonLues },
            { valeur: "miennes", libelle: "Mes annonces et lectures" },
          ]}
          className="self-start"
        />
      )}

      {vue === "miennes" ? (
        <MesAnnonces onEcrire={() => setRedaction(true)} />
      ) : error && !data ? (
        <Erreur message={(error as Error).message} reessayer={() => void refetch()} />
      ) : isLoading ? (
        <Chargement lignes={4} />
      ) : !liste.length ? (
        <EtatVide
          icone={<Megaphone className="h-5 w-5" />}
          titre="Aucune annonce pour l'instant"
          texte={
            tu
              ? "Quand la vie scolaire ou un formateur publie une information pour ton campus, ta classe ou tes cours, elle apparaît ici et tu reçois une notification."
              : "Les annonces publiées pour vos campus et vos cours apparaîtront ici."
          }
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
          {enTete.length > 0 && (
            <section aria-labelledby="titre-importantes" className="flex flex-col gap-3">
              <TitreSection titre={<span id="titre-importantes">À lire en priorité</span>} className="mb-0" />
              {enTete.map((a) => (
                <CarteAnnonce key={a.id} annonce={a} />
              ))}
            </section>
          )}
          {autres.length > 0 && (
            <section aria-labelledby="titre-autres" className="flex flex-col gap-3">
              <TitreSection titre={<span id="titre-autres">{enTete.length ? "Autres annonces" : "Toutes les annonces"}</span>} className="mb-0" />
              {autres.map((a) => (
                <CarteAnnonce key={a.id} annonce={a} />
              ))}
            </section>
          )}
        </div>
      )}

      {peutEcrire && <FenetreAnnonce ouverte={redaction} onFermer={fermerRedaction} onEnregistree={(id) => naviguer(`/annonces/${id}`)} />}
    </Page>
  );
}

/** Formateur : ses annonces avec le taux de lecture de chacune. */
function MesAnnonces({ onEcrire }: { onEcrire: () => void }) {
  const { data, isLoading, error, refetch } = useQuery<AnnonceGestion[]>({ queryKey: ["/api/annonces/gestion"] });
  if (error && !data) return <Erreur message={(error as Error).message} reessayer={() => void refetch()} />;
  if (isLoading || !data) return <Chargement lignes={3} />;
  if (!data.length) {
    return (
      <EtatVide
        icone={<Megaphone className="h-5 w-5" />}
        titre="Vous n'avez encore rien publié"
        texte="Écrivez aux inscrits d'un de vos cours (matériel à apporter, séance déplacée…). Vous verrez ici qui a lu, campus par campus."
        action={<Bouton onClick={onEcrire}>Nouvelle annonce</Bouton>}
      />
    );
  }
  return (
    <ul className="grid gap-3 lg:grid-cols-2">
      {data.map((a) => {
        const pct = a.total ? Math.round((a.lus / a.total) * 100) : 0;
        return (
          <li key={a.id}>
            <Link href={`/annonces/${a.id}`} className="flex flex-col gap-3 rounded-2xl border border-ligne bg-white p-4 text-encre no-underline hover:border-orange hover:text-encre sm:p-5">
              <BadgesAnnonce annonce={a} gestion />
              <span className="flex items-start justify-between gap-3">
                <span className="text-[17px] font-bold leading-snug">{a.titre}</span>
                <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-texte-gris" aria-hidden />
              </span>
              <span className="font-mono text-xs text-texte-gris">
                {a.cibleLibelle} · {relatif(a.publieeLe)}
                {a.expiree && " · expirée"}
              </span>
              <span className="flex flex-col gap-1.5">
                <span className="flex justify-between text-sm">
                  <span className="font-semibold">
                    Lue par {a.lus} sur {a.total}
                  </span>
                  <span className="font-mono text-texte-pale">{pct} %</span>
                </span>
                <BarreProgression valeur={pct} ton={pct === 100 ? "succes" : "orange"} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
