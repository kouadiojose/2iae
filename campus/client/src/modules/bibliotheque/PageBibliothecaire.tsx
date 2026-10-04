// /bibliotheque/conversations/:id — la conversation avec le bibliothécaire de
// la bibliothèque mondiale. L'étudiant dit ce qu'il étudie ; le bibliothécaire
// recommande les meilleurs livres du monde entier (cartes vérifiées dans les
// catalogues, sous sa réponse), propose un résumé, approfondit. « Résumé »
// continue la conversation sur un livre ; « Lire » ouvre la liseuse.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Library, Plus } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { post } from "@/lib/api";
import { Page } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Chargement, EtatVide } from "@/components/ui/divers";
import { toastErreur } from "@/components/ui/toast";
import { useEtatIa, blocageDe, prendreEnAttente, mettreEnAttente } from "@/modules/ia/api-ia";
import { useConversationIa } from "@/modules/ia/useConversationIa";
import { BandeauBlocage, LigneQuota, ZoneQuestion, PucesSuggestions, FilConversation, BulleQuestion, ReponseAssistant } from "@/modules/ia/composants";
import { CarteLivreCite } from "./composants";
import type { LivreDto } from "@shared/schema/ext-bibliotheque";

const SUITES = ["Fais-moi le résumé du premier livre", "Lequel est le plus pratique pour débuter ?", "Lesquels puis-je lire gratuitement ?", "Propose-moi d'autres livres, d'autres pays"];

export const demandeResume = (l: Pick<LivreDto, "titre" | "auteurs">) =>
  `Fais-moi le résumé du livre « ${l.titre} »${l.auteurs ? ` de ${l.auteurs.split(",")[0]}` : ""} : les points principaux, puis propose-moi d'approfondir.`;

export default function PageBibliothecaire({ id }: { id: string }) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) {
    return (
      <Page>
        <EtatVide titre="Conversation introuvable" texte="Le lien est incomplet." action={<LienBouton href="/bibliotheque">Revenir à la bibliothèque</LienBouton>} />
      </Page>
    );
  }
  return <Conversation key={n} id={n} />;
}

function Conversation({ id }: { id: number }) {
  const moi = useMoiConnecte();
  const etudiant = moi.role === "etudiant";
  const [, naviguer] = useLocation();
  const conv = useConversationIa({ id });
  const { data: etat } = useEtatIa();
  const blocage = blocageDe(etat);
  const [question, setQuestion] = useState("");
  const [nouvelle, setNouvelle] = useState(false);
  const bas = useRef<HTMLDivElement>(null);

  // Question posée depuis l'accueil de la bibliothèque : envoyée dès l'ouverture.
  useEffect(() => {
    const enAttente = prendreEnAttente(id);
    if (enAttente) void conv.envoyer(enAttente);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useLayoutEffect(() => {
    if (conv.echange) bas.current?.scrollIntoView({ block: "end" });
  }, [conv.echange?.reponse, conv.echange?.statut, conv.messages.length]);

  const envoyer = (texte: string) => {
    if (!texte.trim() || blocage || conv.occupe) return;
    setQuestion("");
    void conv.envoyer(texte);
  };

  const recommencer = async () => {
    setNouvelle(true);
    try {
      const c = await post<{ id: number }>("/api/bibliotheque/conversations");
      naviguer(`/bibliotheque/conversations/${c.id}`);
    } catch (e) {
      toastErreur(e);
    } finally {
      setNouvelle(false);
    }
  };

  const messages = conv.messages;
  const dernier = messages[messages.length - 1];
  return (
    <Page className="max-w-3xl gap-5">
      <div className="-mb-2 flex items-center justify-between gap-2">
        <LienBouton href="/bibliotheque" variante="fantome" taille="sm" icone={<ArrowLeft className="h-4 w-4" />} className="-ml-2">
          Bibliothèque
        </LienBouton>
        <Bouton variante="fantome" taille="sm" icone={<Plus className="h-4 w-4" />} chargement={nouvelle} onClick={() => void recommencer()}>
          Nouvelle conversation
        </Bouton>
      </div>
      <header className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-encre text-orange">
          <Library className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-black leading-tight">Le bibliothécaire</h1>
          <p className="text-sm text-texte-pale">Tous les livres du monde, vérifiés dans les catalogues des bibliothèques.</p>
        </div>
      </header>

      <BandeauBlocage etat={etat} enseignant={!etudiant} />
      {conv.detail.isLoading && <Chargement lignes={2} />}

      <div className="flex flex-col gap-5">
        {messages.map((m) =>
          m.role === "user" ? (
            <BulleQuestion key={m.id} texte={m.contenu} />
          ) : (
            <div key={m.id} className="flex flex-col gap-3">
              <ReponseAssistant cle={`b${m.id}`} contenu={m.contenu} enseignant={!etudiant} />
              {m.livres && m.livres.length > 0 && (
                <div className="flex flex-col gap-2 sm:pl-9">
                  <p className="font-mono text-xs uppercase tracking-[0.12em] text-texte-gris">
                    {m.livres.length > 1 ? `Les ${m.livres.length} livres de cette réponse` : "Le livre de cette réponse"}
                  </p>
                  <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {m.livres.map((l) => (
                      <li key={l.id}>
                        <CarteLivreCite livre={l} etudiant={etudiant} onResume={() => envoyer(demandeResume(l))} desactive={Boolean(blocage) || conv.occupe} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ),
        )}
        <FilConversation messages={[]} echange={conv.echange} enseignant={!etudiant} onReessayer={envoyer} onRecharger={() => void conv.recharger()} onOublier={conv.oublierErreur} />
        {conv.echange?.statut === "flux" && (
          <p className="text-sm text-texte-gris sm:pl-9" role="status">
            Les livres cités seront vérifiés dans les catalogues des bibliothèques à la fin de la réponse.
          </p>
        )}
      </div>

      <div ref={bas} className="flex flex-col gap-2">
        {dernier?.role === "assistant" && !conv.echange && <PucesSuggestions suggestions={SUITES} onChoisir={envoyer} desactive={Boolean(blocage) || conv.occupe} />}
        <ZoneQuestion
          valeur={question}
          onChange={setQuestion}
          onEnvoyer={() => envoyer(question)}
          desactive={Boolean(blocage)}
          occupe={conv.occupe}
          enseignant={!etudiant}
          placeholder={etudiant ? "Écris au bibliothécaire…" : "Écrivez au bibliothécaire…"}
        />
        <LigneQuota etat={etat} enseignant={!etudiant} />
      </div>
    </Page>
  );
}

/** Ouvre une conversation avec le bibliothécaire et y envoie la première question. */
export async function demarrerConversation(question: string, naviguer: (chemin: string) => void) {
  const c = await post<{ id: number }>("/api/bibliotheque/conversations");
  mettreEnAttente(c.id, question.trim());
  naviguer(`/bibliotheque/conversations/${c.id}`);
}
