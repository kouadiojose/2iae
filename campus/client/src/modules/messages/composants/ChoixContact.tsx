// « Nouveau message » : à qui écrire, par groupes (mes formateurs, vie
// scolaire de mon campus, mes étudiants…), et les salons des cours pour une
// question à toute la classe.
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronRight, Loader2, UsersRound } from "lucide-react";
import { Fenetre } from "@/components/ui/fenetre";
import { Avatar, Chargement, Erreur } from "@/components/ui/divers";
import { toastErreur } from "@/components/ui/toast";
import { post } from "@/lib/api";
import { useMoiConnecte } from "@/lib/auth";
import { PastilleCours } from "./AvatarConversation";
import { selonRole } from "../outils";
import type { ContactsMessages, ConversationOuverte } from "@shared/schema";

function useDiffere<T>(valeur: T, ms = 300): T {
  const [v, setV] = useState(valeur);
  useEffect(() => {
    const t = setTimeout(() => setV(valeur), ms);
    return () => clearTimeout(t);
  }, [valeur, ms]);
  return v;
}

export function ChoixContact({ ouverte, onFermer }: { ouverte: boolean; onFermer: () => void }) {
  const moi = useMoiConnecte();
  const [, naviguer] = useLocation();
  const [recherche, setRecherche] = useState("");
  const q = useDiffere(recherche.trim());
  const [ouvertureDe, setOuvertureDe] = useState<number | null>(null);
  const etudiant = moi.role === "etudiant";

  const { data, isLoading, error, refetch, isFetching } = useQuery<ContactsMessages>({
    queryKey: [`/api/conversations/contacts${q ? `?q=${encodeURIComponent(q)}` : ""}`],
    enabled: ouverte,
    placeholderData: (precedent) => precedent,
  });

  useEffect(() => {
    if (!ouverte) setRecherche("");
  }, [ouverte]);

  async function ecrireA(id: number) {
    setOuvertureDe(id);
    try {
      const c = await post<ConversationOuverte>("/api/conversations/directe", { destinataireId: id });
      onFermer();
      naviguer(c.lien);
    } catch (e) {
      toastErreur(e);
    } finally {
      setOuvertureDe(null);
    }
  }

  const personnes = data?.groupes.reduce((n, g) => n + g.personnes.length, 0) ?? 0;
  const salons = (data?.salons ?? []).filter((s) => !q || `${s.code} ${s.titre}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <Fenetre
      ouverte={ouverte}
      onFermer={onFermer}
      titre="Nouveau message"
      description={
        etudiant
          ? "Tu peux écrire aux formateurs de tes cours et à la vie scolaire de ton campus."
          : "Choisissez la personne à qui écrire."
      }
    >
      <div className="flex flex-col gap-4 pb-3">
        <label className="relative block">
          <span className="sr-only">Rechercher une personne</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-texte-gris" aria-hidden="true" />
          <input
            type="search"
            autoFocus={false}
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={etudiant ? "Chercher un nom" : "Nom, prénom ou matricule"}
            className="h-12 w-full rounded-2xl border border-ligne bg-creme pl-12 pr-10 text-base outline-none placeholder:text-texte-gris focus:border-orange focus:bg-white focus:ring-2 focus:ring-orange/20"
          />
          {isFetching && !isLoading && <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-texte-gris" aria-hidden="true" />}
        </label>

        {isLoading && <Chargement lignes={4} />}
        {error && <Erreur message={(error as Error).message} reessayer={() => void refetch()} />}

        {data && salons.length > 0 && (
          <section className="flex flex-col gap-1">
            <h3 className="etiquette px-1">{selonRole(moi.role, "Question à toute la classe", "Salons de vos cours")}</h3>
            {salons.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onFermer();
                  naviguer(`/messages/cours/${s.id}`);
                }}
                className="flex min-h-[60px] items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-creme"
              >
                <PastilleCours cours={s} taille={44} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-base font-bold">{s.titre}</span>
                  <span className="font-mono text-xs text-texte-gris">{s.code} · Questions du cours</span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden="true" />
              </button>
            ))}
          </section>
        )}

        {data?.groupes.map((g) => (
          <section key={g.cle} className="flex flex-col gap-1">
            <h3 className="etiquette px-1">{g.titre}</h3>
            {g.personnes.length === 0 ? (
              <p className="px-1 py-2 text-[15px] text-texte-pale">
                {q ? "Personne ne correspond à cette recherche." : g.cle === "formateurs" && etudiant ? "Tes cours n'ont pas encore de formateur." : "Personne pour le moment."}
              </p>
            ) : (
              g.personnes.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={ouvertureDe !== null}
                  onClick={() => void ecrireA(p.id)}
                  className="flex min-h-[60px] items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-creme disabled:opacity-60"
                >
                  <Avatar prenom={p.prenom} nom={p.nom} photo={p.photoUrl} taille={44} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-base font-bold">
                      {p.prenom} {p.nom}
                    </span>
                    <span className="truncate text-sm text-texte-pale">{p.detail}</span>
                  </span>
                  {ouvertureDe === p.id ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-orange-fonce" aria-label="Ouverture…" />
                  ) : (
                    <ChevronRight className="h-5 w-5 shrink-0 text-texte-gris" aria-hidden="true" />
                  )}
                </button>
              ))
            )}
            {g.tronque && (
              <p className="px-1 pt-1 text-sm text-texte-gris">
                {selonRole(moi.role, "Liste coupée : tape un nom pour trouver la bonne personne.", "Liste coupée : tapez un nom ou un matricule pour affiner.")}
              </p>
            )}
          </section>
        ))}

        {data && personnes === 0 && salons.length === 0 && !q && (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-creme px-5 py-6 text-center">
            <UsersRound className="h-6 w-6 text-orange-fonce" aria-hidden="true" />
            <p className="text-[15px] text-texte-pale">
              {etudiant
                ? "Tu pourras écrire à tes formateurs dès que tu seras inscrit à un cours. En attendant, la vie scolaire de ton campus peut t'aider."
                : "Personne à qui écrire pour le moment."}
            </p>
          </div>
        )}
      </div>
    </Fenetre>
  );
}
