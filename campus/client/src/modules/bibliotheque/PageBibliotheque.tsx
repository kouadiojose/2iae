// /bibliotheque — la bibliothèque mondiale : l'étudiant parle au
// bibliothécaire (ce qu'il étudie, ce qu'il veut apprendre), qui recommande
// les meilleurs livres du monde entier, vérifiés dans les catalogues, à lire
// en ligne quand ils sont libres, puis aide à les explorer.
import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Library, Sparkles, Presentation, History, BookMarked, Users, MessagesSquare } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
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
import { demarrerConversation } from "./PageBibliothecaire";
import type { MaBibliothequeDto } from "@shared/schema/ext-bibliotheque";

const EXEMPLES = [
  "Je fais un BTS agriculture : comment cultiver la tomate en climat tropical ?",
  "Je suis en BTS bâtiment : les meilleurs livres sur le béton armé",
  "Je veux créer et financer mon entreprise en Côte d'Ivoire",
  "Je débute en programmation : par quel livre commencer ?",
  "Les saisons et le calendrier agricole en Afrique de l'Ouest",
  "Comptabilité SYSCOHADA pour débutant",
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
      await demarrerConversation(s, naviguer);
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
          <Library className="h-4 w-4" aria-hidden /> Bibliothèque mondiale
        </div>
        <h1 className="text-[28px] font-black leading-tight sm:text-4xl">{etudiant ? "Que veux-tu apprendre ?" : "Que voulez-vous apprendre ?"}</h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-nuit-doux">
          {etudiant
            ? "Parle au bibliothécaire comme à une personne : ce que tu étudies, ce que tu cherches. Il te recommande les meilleurs livres du monde entier, te les résume, répond à tes questions, et tu peux lire en ligne ceux qui sont libres."
            : "Parlez au bibliothécaire comme à une personne : il recommande les meilleurs livres du monde entier, les résume, répond aux questions, et ouvre en lecture ceux qui sont libres."}
        </p>
        <form onSubmit={chercher} className="flex flex-col gap-2">
          <label className="relative">
            <span className="sr-only">{etudiant ? "Ton message au bibliothécaire" : "Votre message au bibliothécaire"}</span>
            <textarea
              value={sujet}
              onChange={(e) => setSujet(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !window.matchMedia("(pointer: coarse)").matches) {
                  e.preventDefault();
                  void chercher();
                }
              }}
              maxLength={1500}
              rows={3}
              placeholder={etudiant ? "Ex. : Je fais un BTS agriculture. Comment planter des tomates en climat tropical, et quelles sont les saisons ?" : "Ex. : les meilleurs livres pour enseigner la gestion de projet"}
              className="w-full resize-none rounded-2xl border-0 bg-white px-4 py-3.5 text-base text-encre outline-none ring-orange focus:ring-2"
              disabled={enCours}
            />
          </label>
          <Bouton type="submit" taille="lg" chargement={enCours} disabled={sujet.trim().length < 3 || Boolean(blocage)} icone={<Sparkles className="h-5 w-5" />} className="min-h-14 sm:self-end">
            Parler au bibliothécaire
          </Bouton>
        </form>
        <div className="flex flex-wrap gap-2">
          {EXEMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => setSujet(ex)} className="min-h-9 rounded-full border border-nuit-ligne px-3 py-1.5 text-left text-sm text-nuit-doux hover:border-orange hover:text-white">
              {ex}
            </button>
          ))}
        </div>
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
          <Section titre={etudiant ? "Mes conversations" : "Vos conversations"} icone={<MessagesSquare className="h-4 w-4" />}>
            {data.conversations.length ? (
              <ul className="flex flex-col gap-2">
                {data.conversations.map((c) => (
                  <li key={c.id}>
                    <CarteLien href={`/bibliotheque/conversations/${c.id}`} className="flex flex-col px-4 py-3">
                      <span className="line-clamp-2 font-bold">{c.titre}</span>
                      <span className="text-sm text-texte-pale">
                        {c.nbMessages} message{c.nbMessages > 1 ? "s" : ""} · {dateCourte(c.majLe)}
                      </span>
                    </CarteLien>
                  </li>
                ))}
              </ul>
            ) : (
              <Vide texte={etudiant ? "Tes conversations avec le bibliothécaire apparaîtront ici." : "Vos conversations avec le bibliothécaire apparaîtront ici."} />
            )}
          </Section>

          {data.recherches.length > 0 && (
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
          )}

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
