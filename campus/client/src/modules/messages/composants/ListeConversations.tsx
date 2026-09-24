// Liste des conversations façon WhatsApp : pastille, nom, extrait, heure,
// non lus. Les salons « Questions du cours » encore silencieux viennent à la fin.
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, Camera, Mic, Paperclip, Check, CheckCheck, BellOff, MessageCircle, X } from "lucide-react";
import { useMoiConnecte } from "@/lib/auth";
import { useTousEvenements } from "@/lib/flux";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { Chargement, EtatVide, Erreur } from "@/components/ui/divers";
import { cn } from "@/lib/utils";
import { AvatarConversation } from "./AvatarConversation";
import { CLE_LISTE, heureListe, rafraichirListe, selonRole } from "../outils";
import type { ConversationResume, DernierMessage, Role } from "@shared/schema";

const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function useConversations() {
  return useQuery<ConversationResume[]>({ queryKey: [CLE_LISTE], refetchInterval: 60_000 });
}

function IconeContenu({ type }: { type: DernierMessage["type"] }) {
  if (type === "photo") return <Camera className="h-4 w-4 shrink-0" aria-hidden="true" />;
  if (type === "audio") return <Mic className="h-4 w-4 shrink-0" aria-hidden="true" />;
  if (type === "fichier") return <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />;
  return null;
}

function Extrait({ c, role }: { c: ConversationResume; role: Role }) {
  const d = c.dernierMessage;
  if (!d) {
    return <span className="truncate italic text-texte-gris">{c.type === "cours" ? "Aucune question pour l'instant" : "Nouvelle conversation"}</span>;
  }
  const prefixe = d.deMoi ? selonRole(role, "Toi : ", "Vous : ") : c.type === "cours" ? `${d.auteurPrenom} : ` : "";
  return (
    <span className={cn("flex min-w-0 items-center gap-1", d.supprime && "italic")}>
      {d.deMoi && d.lu !== null && !d.supprime && (
        d.lu ? (
          <CheckCheck className="h-4 w-4 shrink-0 text-orange-fonce" aria-label="Lu" />
        ) : (
          <Check className="h-4 w-4 shrink-0 text-texte-gris" aria-label="Envoyé" />
        )
      )}
      {!d.supprime && <IconeContenu type={d.type} />}
      <span className="truncate">
        {prefixe}
        {d.extrait}
      </span>
    </span>
  );
}

function LigneConversation({ c, active, maintenant, role }: { c: ConversationResume; active: boolean; maintenant: number; role: Role }) {
  const nonLus = c.nonLus > 0;
  return (
    <Link
      href={`/messages/${c.id}`}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[76px] items-center gap-3 rounded-2xl px-3 py-2.5 text-encre no-underline transition-colors hover:bg-creme hover:text-encre",
        active && "bg-orange-clair hover:bg-orange-clair",
      )}
    >
      <AvatarConversation interlocuteur={c.interlocuteur} cours={c.cours} taille={50} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className={cn("truncate text-base", nonLus ? "font-extrabold" : "font-bold")}>{c.titre}</span>
          <span className={cn("shrink-0 font-mono text-xs", nonLus ? "font-bold text-orange-fonce" : "text-texte-gris")}>
            {c.dernierMessage ? heureListe(c.dernierMessage.creeLe, maintenant) : ""}
          </span>
        </span>
        {c.type === "cours" && (
          <span className="font-mono text-[11px] uppercase tracking-wider text-orange-fonce">{c.cours?.code} · Questions du cours</span>
        )}
        <span className="flex items-center justify-between gap-2">
          <span className={cn("min-w-0 text-[15px]", nonLus ? "font-semibold text-encre" : "text-texte-pale")}>
            <Extrait c={c} role={role} />
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {c.sourdine && <BellOff className="h-4 w-4 text-texte-gris" aria-label="Alertes coupées" />}
            {nonLus && (
              <span
                className="grid h-6 min-w-6 place-items-center rounded-full bg-orange px-1.5 font-mono text-xs font-bold text-encre"
                aria-label={`${c.nonLus} message${c.nonLus > 1 ? "s" : ""} non lu${c.nonLus > 1 ? "s" : ""}`}
              >
                {c.nonLus > 99 ? "99+" : c.nonLus}
              </span>
            )}
          </span>
        </span>
      </span>
    </Link>
  );
}

export function ListeConversations({ actifId, onNouveau, className }: { actifId?: number; onNouveau: () => void; className?: string }) {
  const moi = useMoiConnecte();
  const { data, isLoading, error, refetch } = useConversations();
  const [recherche, setRecherche] = useState("");
  const maintenant = useMaintenant(60_000);

  // Un message arrive (ou un salon bouge) : la liste se remet à jour.
  useTousEvenements((e) => {
    if (e.type === "message" || e.type === "salon") rafraichirListe();
  });

  const filtrees = useMemo(() => {
    const q = normaliser(recherche.trim());
    if (!q) return data ?? [];
    return (data ?? []).filter((c) => normaliser(`${c.titre} ${c.sousTitre} ${c.dernierMessage?.extrait ?? ""}`).includes(q));
  }, [data, recherche]);

  const actives = filtrees.filter((c) => c.dernierMessage);
  const calmes = filtrees.filter((c) => !c.dernierMessage);
  const etudiant = moi.role === "etudiant";

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      {(data?.length ?? 0) > 3 && (
        <label className="relative block">
          <span className="sr-only">Rechercher une conversation</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-texte-gris" aria-hidden="true" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder={selonRole(moi.role, "Chercher un nom, un cours…", "Rechercher un nom, un cours…")}
            className="h-12 w-full rounded-2xl border border-ligne bg-creme pl-12 pr-11 text-base text-encre outline-none placeholder:text-texte-gris focus:border-orange focus:bg-white focus:ring-2 focus:ring-orange/20"
          />
          {recherche && (
            <button
              type="button"
              onClick={() => setRecherche("")}
              className="absolute right-1.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-texte-gris hover:bg-white hover:text-encre"
              aria-label="Effacer la recherche"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
      )}

      {isLoading && <Chargement lignes={5} />}
      {error && <Erreur message={(error as Error).message} reessayer={() => void refetch()} />}

      {data && data.length === 0 && (
        <EtatVide
          icone={<MessageCircle className="h-6 w-6" />}
          titre={etudiant ? "Écris à tes formateurs, comme sur WhatsApp" : "Échangez avec vos étudiants et l'équipe"}
          texte={
            etudiant
              ? "Ici, tu écris à tes formateurs et à la vie scolaire de ton campus. Tes conversations et les questions de tes cours apparaîtront ici."
              : "Vos conversations avec les étudiants de vos cours et avec l'équipe apparaîtront ici, avec les questions posées dans les salons de vos cours."
          }
          action={
            <button onClick={onNouveau} className="mt-1 rounded-xl bg-orange px-5 py-3 text-[15px] font-bold text-encre hover:bg-encre hover:text-white">
              {etudiant ? "Écrire à un formateur" : "Écrire un message"}
            </button>
          }
        />
      )}

      {data && data.length > 0 && filtrees.length === 0 && (
        <p className="px-3 py-6 text-center text-[15px] text-texte-pale">Aucune conversation ne correspond à « {recherche} ».</p>
      )}

      {actives.length > 0 && (
        <nav aria-label="Conversations" className="flex flex-col gap-0.5">
          {actives.map((c) => (
            <LigneConversation key={c.id} c={c} active={c.id === actifId} maintenant={maintenant} role={moi.role} />
          ))}
        </nav>
      )}

      {calmes.length > 0 && (
        <section aria-label="Salons des cours" className="flex flex-col gap-0.5">
          <div className="px-3 pb-1 pt-3">
            <p className="etiquette">Salons de {etudiant ? "tes" : "vos"} cours</p>
            <p className="mt-1 text-sm text-texte-pale">
              {etudiant
                ? "Pose ta question à toute la classe : le formateur répond une fois pour tout le monde."
                : "Les étudiants y posent leurs questions à toute la classe ; vous y répondez une fois pour tous."}
            </p>
          </div>
          {calmes.map((c) => (
            <LigneConversation key={c.id} c={c} active={c.id === actifId} maintenant={maintenant} role={moi.role} />
          ))}
        </section>
      )}
    </div>
  );
}
