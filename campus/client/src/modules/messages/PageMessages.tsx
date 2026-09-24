// /messages et /messages/:id — sur téléphone, deux écrans (la liste, puis le
// fil en plein écran) ; sur ordinateur, la liste et le fil côte à côte.
import { useState } from "react";
import { useSearch } from "wouter";
import { PenSquare, MessageCircle } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { Page, EnTetePage } from "@/components/layout/coquille";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { EtatVide } from "@/components/ui/divers";
import { ListeConversations } from "./composants/ListeConversations";
import { FilConversation } from "./composants/FilConversation";
import { ChoixContact } from "./composants/ChoixContact";
import { selonRole, useEstOrdinateur } from "./outils";

export default function PageMessages({ id }: { id?: string }) {
  const moi = useMoiConnecte();
  const ordinateur = useEstOrdinateur();
  const recherche = new URLSearchParams(useSearch());
  const contexte = recherche.get("contexte")?.slice(0, 200) || null;
  const [choix, setChoix] = useState(recherche.get("nouveau") === "1");
  const etudiant = moi.role === "etudiant";

  const idNum = id === undefined ? null : Number(id);
  if (idNum !== null && !(Number.isInteger(idNum) && idNum > 0)) {
    return (
      <Page>
        <EtatVide titre="Conversation introuvable" texte="Le lien est peut-être incomplet." action={<LienBouton href="/messages">Revenir à mes messages</LienBouton>} />
      </Page>
    );
  }

  const choixContact = <ChoixContact ouverte={choix} onFermer={() => setChoix(false)} />;

  if (ordinateur) {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-7 pb-6 pt-6">
        <div className="grid h-[calc(100dvh-65px-48px)] min-h-[560px] grid-cols-[380px_minmax(0,1fr)] overflow-hidden rounded-[28px] border border-ligne bg-white shadow-carte">
          <aside className="flex min-h-0 flex-col border-r border-ligne-douce">
            <div className="flex items-end justify-between gap-3 px-5 pb-3 pt-5">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-xs text-texte-gris">Comme sur WhatsApp</span>
                <h1 className="text-[32px] font-black leading-none tracking-serre">Messages</h1>
              </div>
              <Bouton taille="sm" icone={<PenSquare className="h-4 w-4" />} onClick={() => setChoix(true)}>
                Nouveau
              </Bouton>
            </div>
            <div className="defile-fin min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              <ListeConversations actifId={idNum ?? undefined} onNouveau={() => setChoix(true)} className="px-1" />
            </div>
          </aside>
          <section className="flex min-h-0 flex-col" aria-label="Conversation">
            {idNum ? (
              <FilConversation key={idNum} id={idNum} mobile={false} contexteInitial={contexte} />
            ) : (
              <div className="flex flex-1 items-center justify-center bg-creme p-10">
                <EtatVide
                  className="max-w-md bg-white"
                  icone={<MessageCircle className="h-6 w-6" />}
                  titre={selonRole(moi.role, "Choisis une conversation", "Choisissez une conversation")}
                  texte={
                    etudiant
                      ? "Écris à tes formateurs, à la vie scolaire de ton campus, ou pose ta question à toute la classe dans le salon d'un cours."
                      : "Répondez à vos étudiants, à l'équipe, ou aux questions posées dans les salons de vos cours."
                  }
                  action={
                    <Bouton icone={<PenSquare className="h-4 w-4" />} onClick={() => setChoix(true)}>
                      Nouveau message
                    </Bouton>
                  }
                />
              </div>
            )}
          </section>
        </div>
        {choixContact}
      </div>
    );
  }

  if (idNum) {
    return (
      <>
        <FilConversation key={idNum} id={idNum} mobile contexteInitial={contexte} />
        {choixContact}
      </>
    );
  }

  return (
    <Page className="gap-4 pb-44">
      <EnTetePage
        etiquette="Comme sur WhatsApp"
        titre="Messages"
        sousTitre={etudiant ? "Tes formateurs, la vie scolaire de ton campus et les questions de tes cours." : "Vos étudiants, l'équipe et les questions de vos cours."}
      />
      <ListeConversations onNouveau={() => setChoix(true)} className="-mx-2" />
      {/* Bouton principal de l'écran, au pouce, au-dessus de la barre d'onglets. */}
      <button
        type="button"
        onClick={() => setChoix(true)}
        className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] right-4 z-20 flex h-14 items-center gap-2 rounded-full bg-orange pl-5 pr-6 text-base font-extrabold text-encre shadow-telephone transition-colors hover:bg-encre hover:text-white"
      >
        <PenSquare className="h-5 w-5" aria-hidden="true" />
        Nouveau message
      </button>
      {choixContact}
    </Page>
  );
}
