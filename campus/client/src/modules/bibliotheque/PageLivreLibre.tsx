// /bibliotheque/libres/:id — un livre des bibliothèques libres : sa notice, le
// lecteur (on le lit ici, en entier), et, si l'étudiant le veut, l'étude avec
// l'IA (fiche, questions, quiz) dans la bibliothèque.
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { post } from "@/lib/api";
import { Page } from "@/components/layout/coquille";
import { Bouton } from "@/components/ui/bouton";
import { Carte } from "@/components/ui/carte";
import { Badge, Chargement, Erreur } from "@/components/ui/divers";
import { toastErreur } from "@/components/ui/toast";
import { Couverture } from "./composants";
import { CarteLivreLibre, LecteurLibre, ligneLibre, nomLangue } from "./libres";
import { LIBELLES_DOMAINES_LIBRES, LIBELLES_SOURCES_LIBRES, type DetailLibreDto } from "@shared/schema/ext-libres";

export default function PageLivreLibre({ id }: { id: string }) {
  // Une page neuve par livre (« Du même auteur » ouvre un autre livre sur la même route).
  return <LivreLibre key={id} id={id} />;
}

function LivreLibre({ id }: { id: string }) {
  const moi = useMoiConnecte();
  const etudiant = moi.role === "etudiant";
  const [, naviguer] = useLocation();
  const { data, error, isLoading, refetch } = useQuery<DetailLibreDto>({ queryKey: [`/api/libres/${id}`] });
  const [etude, setEtude] = useState(false);
  const [description, setDescription] = useState(false);

  const etudier = async () => {
    setEtude(true);
    try {
      const { livreId } = await post<{ livreId: number }>(`/api/libres/${id}/etudier`);
      naviguer(`/bibliotheque/livres/${livreId}`);
    } catch (e) {
      toastErreur(e);
      setEtude(false);
    }
  };

  if (isLoading) {
    return (
      <Page className="max-w-4xl">
        <Chargement lignes={6} />
      </Page>
    );
  }
  if (error || !data) {
    return (
      <Page className="max-w-4xl">
        <Erreur message={(error as Error)?.message ?? "Livre introuvable."} reessayer={() => void refetch()} />
      </Page>
    );
  }
  const l = data.livre;
  const source = LIBELLES_SOURCES_LIBRES[l.source];
  const longue = (l.description?.length ?? 0) > 320;

  return (
    <Page className="max-w-4xl gap-6">
      <Link href="/bibliotheque/libres" className="inline-flex items-center gap-1.5 self-start text-sm font-bold text-texte-pale no-underline hover:text-encre">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Bibliothèques libres
      </Link>

      <header className="flex gap-4 sm:gap-6">
        <Couverture livre={{ titre: l.titre, auteurs: l.auteurs, couvertureUrl: l.couverture }} className="w-24 sm:w-32" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            <Badge ton="orange">{l.lectureIci ? "Lecture libre, ici" : "Libre accès"}</Badge>
            {l.langue && <Badge ton="gris">{nomLangue(l.langue)}</Badge>}
            <Badge ton="gris">{source.nom}</Badge>
          </div>
          <h1 className="text-[24px] font-black leading-tight sm:text-3xl">{l.titre}</h1>
          <p className="text-[15px] text-texte-pale">{ligneLibre(l)}</p>
          {l.domaines.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {l.domaines.map((d) => (
                <Link key={d} href={`/bibliotheque/libres?domaine=${d}`} className="rounded-full border border-ligne px-2.5 py-1 text-xs font-bold text-texte-doux no-underline hover:border-orange">
                  {LIBELLES_DOMAINES_LIBRES[d]}
                </Link>
              ))}
            </div>
          )}
        </div>
      </header>

      {l.description && (
        <div className="text-[15px] leading-relaxed text-texte-doux">
          <p className={description || !longue ? "" : "line-clamp-4"}>{l.description}</p>
          {longue && (
            <button type="button" onClick={() => setDescription((v) => !v)} className="mt-1 text-sm font-bold text-orange-fonce">
              {description ? "Réduire" : "Lire la suite"}
            </button>
          )}
        </div>
      )}

      <LecteurLibre livre={l} etudiant={etudiant} />

      <Carte className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-extrabold">{etudiant ? "Étudier ce livre avec l'IA" : "Étudier ce livre avec l'IA"}</p>
          <p className="text-sm text-texte-pale">
            {etudiant
              ? "Fiche de lecture rédigée d'après le vrai texte, questions au livre, quiz, notes et préparation d'exposé."
              : "Fiche de lecture d'après le vrai texte, questions au livre, quiz, notes et préparation d'exposé."}
          </p>
        </div>
        <Bouton icone={<Sparkles className="h-4 w-4" />} chargement={etude} onClick={() => void etudier()}>
          Étudier ce livre
        </Bouton>
      </Carte>

      <p className="flex flex-wrap items-center gap-x-2 text-sm text-texte-pale">
        {source.nom}
        {l.licence ? ` · ${l.licence}` : ""}
        <a href={l.lien} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold">
          Voir la notice <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </p>

      {data.memeAuteur.length > 0 && <Liste titre="Du même auteur" livres={data.memeAuteur} />}
      {data.memeDomaine.length > 0 && <Liste titre="Dans le même rayon" livres={data.memeDomaine} />}
    </Page>
  );
}

function Liste({ titre, livres }: { titre: string; livres: DetailLibreDto["memeAuteur"] }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-extrabold">{titre}</h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {livres.map((x) => (
          <li key={x.id}>
            <CarteLivreLibre livre={x} compacte />
          </li>
        ))}
      </ul>
    </section>
  );
}
