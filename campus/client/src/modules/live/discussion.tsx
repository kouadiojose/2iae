// Discussion écrite du live, comme le chat de Zoom ou de Meet : étudiants,
// salles, formateur et équipe écrivent à toute la classe, avec un fichier
// joint au besoin (photo, PDF, présentation…). Le formateur et l'équipe
// masquent un message ; chacun peut retirer le sien. Sur l'écran d'une salle,
// le nom d'un étudiant n'apparaît jamais (« Un étudiant »).
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, EyeOff, FileText, Loader2, Paperclip, Send, Trash2, X } from "lucide-react";
import { post, suppr, televerser, type FichierTeleverse } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useCanal, useFluxConnecte } from "@/lib/flux";
import { cn } from "@/lib/utils";
import { heure } from "@/lib/dates";
import { toastErreur } from "@/components/ui/toast";
import type { MessageLiveDto, RoleSeance } from "@shared/schema";

const cleDiscussion = (seanceId: number) => [`/api/seances/${seanceId}/chat`];

/** Types de fichiers proposés au sélecteur (le serveur garde le dernier mot). */
const TYPES_JOINTS = "image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.csv,audio/*";

/** Messages de la discussion : un appel, puis le temps réel (« chat », « chat:retire », « chat:masque »). */
export function useDiscussion(seanceId: number, privilegie: boolean) {
  const cle = cleDiscussion(seanceId);
  const requete = useQuery<MessageLiveDto[]>({ queryKey: cle, staleTime: 10_000 });
  useCanal(`seance:${seanceId}`, (e) => {
    if (e.type === "chat") {
      const m = e.data as MessageLiveDto;
      queryClient.setQueryData<MessageLiveDto[]>(cle, (liste) => (liste && !liste.some((x) => x.id === m.id) ? [...liste, m].slice(-300) : liste));
    } else if (e.type === "chat:retire" || (e.type === "chat:masque" && !privilegie)) {
      const { id } = e.data as { id: number };
      queryClient.setQueryData<MessageLiveDto[]>(cle, (liste) => liste?.filter((x) => x.id !== id));
    } else if (e.type === "chat:masque") {
      const { id } = e.data as { id: number };
      queryClient.setQueryData<MessageLiveDto[]>(cle, (liste) => liste?.map((x) => (x.id === id ? { ...x, masque: true } : x)));
    }
  });
  // Retour du réseau : on relit tout (rien n'est perdu pendant une coupure).
  const connecte = useFluxConnecte();
  const etaitConnecte = useRef(connecte);
  useEffect(() => {
    if (connecte && !etaitConnecte.current) void queryClient.invalidateQueries({ queryKey: cle });
    etaitConnecte.current = connecte;
  }, [connecte]);
  return requete;
}

/**
 * Messages non lus tant que la discussion est fermée. L'historique présent à l'arrivée
 * ne compte pas ; ses propres messages non plus.
 */
export function useNonLusDiscussion(seanceId: number, privilegie: boolean, moiId: number, ouverte: boolean): number {
  const { data: messages } = useDiscussion(seanceId, privilegie);
  const [vuJusqua, setVuJusqua] = useState<number | null>(null);
  const dernier = messages?.length ? messages[messages.length - 1].id : 0;
  useEffect(() => {
    if (!messages) return;
    if (vuJusqua === null || ouverte) setVuJusqua(dernier);
  }, [messages, ouverte, dernier, vuJusqua]);
  if (!messages || vuJusqua === null) return 0;
  return messages.filter((m) => m.id > vuJusqua && m.auteurId !== moiId && !m.masque).length;
}

type PropsDiscussion = {
  seanceId: number;
  /** Rôle de la personne qui lit (l'écran de salle ne montre aucun nom d'étudiant). */
  role: RoleSeance;
  moiId: number;
  /** Le live accepte encore des messages (à venir ou en direct). */
  ouverte: boolean;
  className?: string;
};

export function PanneauDiscussion({ seanceId, role, moiId, ouverte, className }: PropsDiscussion) {
  const privilegie = role === "formateur" || role === "equipe";
  const { data: messages, isLoading } = useDiscussion(seanceId, privilegie);
  const liste = useRef<HTMLDivElement>(null);
  const [enBas, setEnBas] = useState(true);
  const nb = messages?.length ?? 0;

  // Nouveau message : on descend si l'on était en bas ; sinon un bouton propose d'y aller.
  useEffect(() => {
    const el = liste.current;
    if (el && enBas) el.scrollTop = el.scrollHeight;
  }, [nb, enBas]);
  const surDefilement = () => {
    const el = liste.current;
    if (el) setEnBas(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  };
  const descendre = () => {
    const el = liste.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setEnBas(true);
  };

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
      <div ref={liste} onScroll={surDefilement} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-3" aria-live="polite" aria-label="Messages de la discussion">
        {isLoading ? (
          <p className="m-auto text-[14px] text-nuit-gris">Chargement…</p>
        ) : !nb ? (
          <p className="m-auto max-w-[260px] text-center text-[14px] leading-relaxed text-nuit-doux">
            {role === "etudiant"
              ? "Écris à toute la classe : le formateur, les salles et les autres étudiants lisent ici. Tu peux joindre une photo ou un document."
              : "Écrivez à toute la classe : les étudiants, les salles et le formateur lisent ici. Un document se joint avec le trombone."}
          </p>
        ) : (
          messages!.map((m) => <Message key={m.id} m={m} seanceId={seanceId} lecteurSalle={role === "salle"} privilegie={privilegie} mien={m.auteurId === moiId} />)
        )}
      </div>
      {!enBas && nb > 0 && (
        <button
          onClick={descendre}
          className="absolute bottom-[76px] left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-orange px-3 py-1.5 text-[13px] font-bold text-encre shadow-lg"
        >
          <ArrowDown className="h-4 w-4" /> Derniers messages
        </button>
      )}
      {ouverte ? (
        <Redaction seanceId={seanceId} role={role} onEnvoye={() => setEnBas(true)} />
      ) : (
        <p className="border-t border-nuit-ligne px-4 py-3 text-center text-[13px] text-nuit-gris">Le live est fini : la discussion est fermée. Écrivez au formateur dans la messagerie du cours.</p>
      )}
    </div>
  );
}

function Message({ m, seanceId, lecteurSalle, privilegie, mien }: { m: MessageLiveDto; seanceId: number; lecteurSalle: boolean; privilegie: boolean; mien: boolean }) {
  const [action, setAction] = useState(false);
  const nom = lecteurSalle && m.role === "etudiant" ? "Un étudiant" : m.auteur;
  const couleur = m.role === "formateur" ? "text-orange" : m.role === "salle" ? "text-orange-peche" : m.role === "equipe" ? "text-[#8EC5FF]" : "text-white";
  const retirer = async () => {
    setAction(true);
    try {
      await suppr(`/api/seances/${seanceId}/chat/${m.id}`);
    } catch (e) {
      toastErreur(e);
    } finally {
      setAction(false);
    }
  };
  return (
    <div className={cn("group rounded-2xl px-3 py-2", mien ? "bg-nuit-ligne" : "bg-nuit-carte", m.masque && "opacity-50")}>
      <div className="flex items-baseline gap-2 text-[12px]">
        <span className={cn("truncate font-extrabold", couleur)}>
          {nom}
          {m.role === "formateur" && <span className="ml-1 font-mono font-normal text-nuit-gris">· formateur</span>}
        </span>
        {m.site && m.role !== "salle" && <span className="shrink-0 font-mono text-nuit-gris">{m.site}</span>}
        <span className="ml-auto shrink-0 font-mono text-nuit-gris">{heure(m.creeLe)}</span>
      </div>
      {m.masque && <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-nuit-gris">Masqué pour la classe</p>}
      {m.texte && <p className="mt-0.5 whitespace-pre-wrap break-words text-[14.5px] leading-snug text-white">{avecLiens(m.texte)}</p>}
      {m.fichier && <FichierJoint f={m.fichier} />}
      {(mien || (privilegie && !m.masque)) && (
        <div className="mt-1 flex justify-end opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
          <button
            onClick={() => void retirer()}
            disabled={action}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-bold text-nuit-gris hover:bg-nuit-panneau hover:text-white"
          >
            {mien ? <Trash2 className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {mien ? "Retirer" : "Masquer"}
          </button>
        </div>
      )}
    </div>
  );
}

/** Liens cliquables dans le texte (http, https). */
function avecLiens(texte: string) {
  const morceaux = texte.split(/(https?:\/\/[^\s<>"]+)/g);
  return morceaux.map((x, i) =>
    /^https?:\/\//.test(x) ? (
      <a key={i} href={x} target="_blank" rel="noopener noreferrer" className="break-all font-semibold text-orange-peche underline underline-offset-2">
        {x}
      </a>
    ) : (
      x
    ),
  );
}

function taille(octets: number) {
  if (octets < 1024 * 1024) return `${Math.max(1, Math.round(octets / 1024))} Ko`;
  return `${(octets / (1024 * 1024)).toFixed(octets < 10 * 1024 * 1024 ? 1 : 0).replace(".", ",")} Mo`;
}

function FichierJoint({ f }: { f: NonNullable<MessageLiveDto["fichier"]> }) {
  if (/^image\//.test(f.mime)) {
    return (
      <a href={f.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 block">
        <img src={f.url} alt={f.nom} loading="lazy" className="max-h-56 max-w-full rounded-xl border border-nuit-ligne object-contain" />
      </a>
    );
  }
  return (
    <a
      href={`${f.url}?telecharger=1`}
      className="mt-1.5 flex items-center gap-3 rounded-xl border border-nuit-ligne bg-nuit-panneau px-3 py-2.5 no-underline hover:border-nuit-bord"
      download={f.nom}
    >
      <FileText className="h-6 w-6 shrink-0 text-orange" />
      <span className="min-w-0">
        <span className="block truncate text-[14px] font-bold text-white">{f.nom}</span>
        <span className="font-mono text-[11px] text-nuit-gris">{taille(f.taille)} · télécharger</span>
      </span>
    </a>
  );
}

function Redaction({ seanceId, role, onEnvoye }: { seanceId: number; role: RoleSeance; onEnvoye: () => void }) {
  const [texte, setTexte] = useState("");
  const [joint, setJoint] = useState<FichierTeleverse | null>(null);
  const [depot, setDepot] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const champ = useRef<HTMLTextAreaElement>(null);
  const selecteur = useRef<HTMLInputElement>(null);
  const tu = role === "etudiant";
  const pret = !envoi && !depot && (texte.trim().length > 0 || joint !== null);

  // La zone grandit avec le texte (4 lignes au plus).
  useEffect(() => {
    const el = champ.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [texte]);

  const deposer = async (f: File | undefined) => {
    if (!f) return;
    setDepot(f.name);
    try {
      const [recu] = await televerser([f], "chat");
      setJoint(recu ?? null);
    } catch (e) {
      toastErreur(e);
    } finally {
      setDepot(null);
      if (selecteur.current) selecteur.current.value = "";
    }
  };

  const envoyer = async () => {
    if (!pret) return;
    setEnvoi(true);
    try {
      await post(`/api/seances/${seanceId}/chat`, { texte: texte.trim(), ...(joint && { fichierId: joint.id }) });
      setTexte("");
      setJoint(null);
      onEnvoye();
      champ.current?.focus({ preventScroll: true });
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  const libelleJoint = useMemo(() => depot ?? joint?.nom ?? null, [depot, joint]);

  return (
    <div className="border-t border-nuit-ligne p-2.5">
      {libelleJoint && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-nuit-carte px-3 py-2 text-[13px]">
          {depot ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-orange" /> : <Paperclip className="h-4 w-4 shrink-0 text-orange" />}
          <span className="min-w-0 flex-1 truncate font-semibold text-white">{libelleJoint}</span>
          {!depot && (
            <button onClick={() => setJoint(null)} className="rounded-lg p-1 text-nuit-gris hover:text-white" aria-label="Retirer le fichier joint">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      <div className="flex items-end gap-2">
        <button
          onClick={() => selecteur.current?.click()}
          disabled={Boolean(depot)}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-nuit-carte text-nuit-doux hover:text-white disabled:opacity-50"
          aria-label={tu ? "Joindre une photo ou un document" : "Joindre un fichier"}
          title={tu ? "Joindre une photo ou un document" : "Joindre un fichier"}
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <input ref={selecteur} type="file" accept={TYPES_JOINTS} className="hidden" onChange={(e) => void deposer(e.target.files?.[0])} />
        <textarea
          ref={champ}
          value={texte}
          onChange={(e) => setTexte(e.target.value.slice(0, 1000))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void envoyer();
            }
          }}
          rows={1}
          placeholder={tu ? "Écris à la classe…" : "Écrire à la classe…"}
          aria-label="Message à la classe"
          className="min-h-11 flex-1 resize-none rounded-xl border border-nuit-bord bg-nuit-bulle px-3 py-2.5 text-[15px] text-white outline-none placeholder:text-nuit-gris focus:border-orange"
        />
        <button
          onClick={() => void envoyer()}
          disabled={!pret}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange text-encre hover:bg-orange-peche disabled:opacity-40"
          aria-label="Envoyer"
        >
          {envoi ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}
