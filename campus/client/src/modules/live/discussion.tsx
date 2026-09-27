// Discussion écrite du live, comme le chat de Zoom ou de Meet : étudiants,
// salles, formateur et équipe écrivent à toute la classe ou en privé, avec un
// fichier joint au besoin (photo, PDF, présentation…), des réactions emoji et
// un message épinglé. Le formateur règle qui peut écrire (tout le monde,
// seulement en privé avec lui, personne) et masque un message ; chacun peut
// retirer le sien. Un groupe de travail a sa propre discussion (groupeId).
// Sur l'écran d'une salle, le nom d'un étudiant n'apparaît jamais.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, EyeOff, FileText, Loader2, Lock, MessageCircle, Paperclip, Pin, PinOff, Send, Smile, SmilePlus, Trash2, X } from "lucide-react";
import { post, put, suppr, televerser, type FichierTeleverse } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useCanal, useFluxConnecte, useTousEvenements } from "@/lib/flux";
import { cn } from "@/lib/utils";
import { heure } from "@/lib/dates";
import { toastErreur } from "@/components/ui/toast";
import { REACTIONS_CHAT, type MessageLiveDto, type ModeChat, type ParticipantGroupeDto, type RoleSeance } from "@shared/schema";

const cleDiscussion = (seanceId: number, groupeId?: number | null) => [groupeId ? `/api/seances/${seanceId}/chat?groupe=${groupeId}` : `/api/seances/${seanceId}/chat`];

/** Types de fichiers proposés au sélecteur (le serveur garde le dernier mot). */
const TYPES_JOINTS = "image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.csv,audio/*";

/** Emojis proposés au clavier de la discussion. */
const EMOJIS = ["😀", "😂", "😊", "😍", "🤔", "😮", "😅", "😢", "👍", "👎", "👏", "🙏", "🙌", "💪", "🎉", "🔥", "💯", "✅", "❌", "❓", "💡", "📌", "📚", "✍️", "❤️", "👋", "🇨🇮", "☕"];

const PRIVE = "text-[#C9A8FF]";

type EvenementChat = { type: string; data: any };

/** Applique un événement de la discussion à la liste en cache. */
function appliquer(cle: unknown[], privilegie: boolean, e: EvenementChat) {
  const d = e.data;
  const maj = (fn: (liste: MessageLiveDto[]) => MessageLiveDto[]) => queryClient.setQueryData<MessageLiveDto[]>(cle, (liste) => (liste ? fn(liste) : liste));
  switch (e.type) {
    case "chat":
      return maj((liste) => (liste.some((x) => x.id === d.id) ? liste : [...liste, d as MessageLiveDto].slice(-300)));
    case "chat:retire":
      return maj((liste) => liste.filter((x) => x.id !== d.id));
    case "chat:masque":
      return maj((liste) => (privilegie ? liste.map((x) => (x.id === d.id ? { ...x, masque: true, epingle: false } : x)) : liste.filter((x) => x.id !== d.id)));
    case "chat:reactions":
      return maj((liste) => liste.map((x) => (x.id === d.id ? { ...x, reactions: d.reactions } : x)));
    case "chat:epingle":
      return maj((liste) => liste.map((x) => (x.destinataireId ? x : { ...x, epingle: x.id === d.id })));
  }
}

/**
 * Messages d'une discussion : un appel, puis le temps réel. Classe : canal de la séance, plus
 * les messages privés sur le canal personnel (« live:chat… »). Groupe : canal du groupe.
 */
export function useDiscussion(seanceId: number, privilegie: boolean, groupeId?: number | null) {
  const cle = cleDiscussion(seanceId, groupeId);
  const requete = useQuery<MessageLiveDto[]>({ queryKey: cle, staleTime: 10_000 });
  useCanal(groupeId ? `groupe:${groupeId}` : `seance:${seanceId}`, (e) => {
    if (e.type.startsWith("chat")) appliquer(cle, privilegie, e);
  });
  useTousEvenements((e) => {
    if (groupeId || !e.type.startsWith("live:chat") || e.data?.seanceId !== seanceId) return;
    appliquer(cle, privilegie, { type: e.type.slice(5), data: e.data });
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
export function useNonLusDiscussion(seanceId: number, privilegie: boolean, moiId: number, ouverte: boolean, groupeId?: number | null): number {
  const { data: messages } = useDiscussion(seanceId, privilegie, groupeId);
  const [vuJusqua, setVuJusqua] = useState<number | null>(null);
  const dernier = messages?.length ? messages[messages.length - 1].id : 0;
  useEffect(() => {
    if (!messages) return;
    if (vuJusqua === null || ouverte) setVuJusqua(dernier);
  }, [messages, ouverte, dernier, vuJusqua]);
  if (!messages || vuJusqua === null) return 0;
  return messages.filter((m) => m.id > vuJusqua && m.auteurId !== moiId && !m.masque).length;
}

type Destinataire = { id: number; nom: string } | null;

type PropsDiscussion = {
  seanceId: number;
  /** Rôle de la personne qui lit (l'écran de salle ne montre aucun nom d'étudiant). */
  role: RoleSeance;
  moiId: number;
  /** Le live accepte encore des messages (à venir ou en direct). */
  ouverte: boolean;
  /** Discussion d'un groupe de travail ; sinon, celle de la classe et les messages privés. */
  groupeId?: number | null;
  /** Qui peut écrire à la classe (réglage du formateur). */
  mode?: ModeChat;
  /** Formateur de la séance : les étudiants et les salles lui écrivent en privé. */
  formateur?: { id: number; prenom: string; nom: string } | null;
  className?: string;
};

export function PanneauDiscussion({ seanceId, role, moiId, ouverte, groupeId = null, mode = "tous", formateur = null, className }: PropsDiscussion) {
  const privilegie = role === "formateur" || role === "equipe";
  const { data: messages, isLoading } = useDiscussion(seanceId, privilegie, groupeId);
  const liste = useRef<HTMLDivElement>(null);
  const [enBas, setEnBas] = useState(true);
  const [destinataire, setDestinataire] = useState<Destinataire>(null);
  const nb = messages?.length ?? 0;
  const epingle = messages?.find((m) => m.epingle && !m.masque) ?? null;
  const tu = role === "etudiant";
  const auFormateur: Destinataire = formateur && formateur.id !== moiId ? { id: formateur.id, nom: `${formateur.prenom} ${formateur.nom}` } : null;

  // Discussion limitée par le formateur : les messages des étudiants et des salles lui vont en privé.
  const limite = !privilegie && !groupeId && mode === "prives";
  const fermee = !privilegie && !groupeId && mode === "ferme";
  useEffect(() => {
    if (limite && auFormateur && destinataire?.id !== auFormateur.id) setDestinataire(auFormateur);
  }, [limite, auFormateur?.id]);

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
  const allerAuMessage = (id: number) => {
    const el = liste.current?.querySelector<HTMLElement>(`[data-message="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const repondreEnPrive = (m: MessageLiveDto) => {
    const autre = m.auteurId === moiId ? m.destinataireId : m.auteurId;
    if (!autre) return;
    const nom = m.auteurId === moiId ? (m.destinataire ?? "") : m.auteur;
    setDestinataire({ id: autre, nom: role === "salle" && m.role === "etudiant" && m.auteurId !== moiId ? "Un étudiant" : nom });
  };

  const vide = groupeId
    ? tu
      ? "La discussion de ton groupe : seuls ses membres, le formateur et l'équipe la lisent. Partage ici tes idées, liens et documents."
      : "La discussion du groupe : seuls ses membres, le formateur et l'équipe la lisent."
    : tu
      ? "Écris à toute la classe, ou en privé au formateur. Tu peux joindre une photo ou un document, et réagir avec un emoji."
      : privilegie
        ? "Écrivez à toute la classe, ou en privé à un étudiant ou une salle. Un message important s'épingle en haut."
        : "Écrivez à toute la classe, ou en privé au formateur. Un document se joint avec le trombone.";

  return (
    <div className={cn("relative flex min-h-0 flex-1 flex-col", className)}>
      {privilegie && !groupeId && ouverte && <ReglageMode seanceId={seanceId} mode={mode} />}
      {epingle && <BandeauEpingle m={epingle} seanceId={seanceId} lecteurSalle={role === "salle"} privilegie={privilegie} onVoir={() => allerAuMessage(epingle.id)} />}
      <div ref={liste} onScroll={surDefilement} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-3" aria-live="polite" aria-label="Messages de la discussion">
        {isLoading ? (
          <p className="m-auto text-[14px] text-nuit-gris">Chargement…</p>
        ) : !nb ? (
          <p className="m-auto max-w-[270px] text-center text-[14px] leading-relaxed text-nuit-doux">{vide}</p>
        ) : (
          messages!.map((m) => (
            <Message
              key={m.id}
              m={m}
              seanceId={seanceId}
              role={role}
              moiId={moiId}
              ouverte={ouverte}
              onRepondrePrive={
                // Le formateur et l'équipe répondent en privé à qui ils veulent ; les autres, à un message privé reçu.
                !groupeId && ouverte && m.auteurId !== moiId && ((privilegie && (m.role === "etudiant" || m.role === "salle")) || m.destinataireId === moiId) ? () => repondreEnPrive(m) : undefined
              }
            />
          ))
        )}
      </div>
      {!enBas && nb > 0 && (
        <button
          onClick={descendre}
          className="absolute bottom-[92px] left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-orange px-3 py-1.5 text-[13px] font-bold text-encre shadow-lg"
        >
          <ArrowDown className="h-4 w-4" /> Derniers messages
        </button>
      )}
      {!ouverte ? (
        <p className="border-t border-nuit-ligne px-4 py-3 text-center text-[13px] text-nuit-gris">Le live est fini : la discussion est fermée. Écrivez au formateur dans la messagerie du cours.</p>
      ) : fermee ? (
        <p className="border-t border-nuit-ligne px-4 py-3 text-center text-[13px] font-semibold text-nuit-doux">
          <Lock className="mr-1.5 inline h-3.5 w-3.5" />
          Le formateur a fermé la discussion pour le moment.
        </p>
      ) : (
        <Redaction
          seanceId={seanceId}
          role={role}
          groupeId={groupeId}
          destinataire={destinataire}
          onDestinataire={setDestinataire}
          auFormateur={auFormateur}
          limite={limite}
          messages={messages ?? []}
          moiId={moiId}
          onEnvoye={() => setEnBas(true)}
        />
      )}
    </div>
  );
}

/** Formateur : qui peut écrire à la classe. */
function ReglageMode({ seanceId, mode }: { seanceId: number; mode: ModeChat }) {
  const [envoi, setEnvoi] = useState<ModeChat | null>(null);
  const choisir = async (m: ModeChat) => {
    if (m === mode) return;
    setEnvoi(m);
    try {
      await put(`/api/seances/${seanceId}/chat/mode`, { mode: m });
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(null);
    }
  };
  const options: { m: ModeChat; libelle: string; titre: string }[] = [
    { m: "tous", libelle: "Tous", titre: "Chacun écrit à toute la classe et en privé au formateur" },
    { m: "prives", libelle: "En privé", titre: "Les étudiants et les salles n'écrivent qu'à vous, en privé" },
    { m: "ferme", libelle: "Personne", titre: "La discussion est en lecture seule pour les étudiants et les salles" },
  ];
  return (
    <div className="flex items-center gap-2 border-b border-nuit-ligne px-3 py-2">
      <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-nuit-gris">Qui écrit</span>
      <div className="flex flex-1 gap-1 rounded-xl bg-nuit-carte p-1" role="radiogroup" aria-label="Qui peut écrire à la classe">
        {options.map((o) => (
          <button
            key={o.m}
            role="radio"
            aria-checked={mode === o.m}
            title={o.titre}
            onClick={() => void choisir(o.m)}
            className={cn(
              "flex min-h-8 flex-1 items-center justify-center gap-1 rounded-lg px-1.5 text-[12px] font-bold transition-colors",
              mode === o.m ? "bg-orange text-encre" : "text-nuit-doux hover:text-white",
            )}
          >
            {envoi === o.m && <Loader2 className="h-3 w-3 animate-spin" />}
            {o.libelle}
          </button>
        ))}
      </div>
    </div>
  );
}

function BandeauEpingle({ m, seanceId, lecteurSalle, privilegie, onVoir }: { m: MessageLiveDto; seanceId: number; lecteurSalle: boolean; privilegie: boolean; onVoir: () => void }) {
  const detacher = async () => {
    try {
      await post(`/api/seances/${seanceId}/chat/${m.id}/epingle`, { epingle: false });
    } catch (e) {
      toastErreur(e);
    }
  };
  const nom = lecteurSalle && m.role === "etudiant" ? "Un étudiant" : m.auteur;
  return (
    <div className="flex items-start gap-2 border-b border-nuit-ligne bg-nuit-carte px-3 py-2">
      <Pin className="mt-0.5 h-4 w-4 shrink-0 text-orange" />
      <button onClick={onVoir} className="min-w-0 flex-1 text-left">
        <span className="block font-mono text-[11px] uppercase tracking-wider text-orange-peche">Épinglé · {nom}</span>
        <span className="line-clamp-2 text-[13.5px] leading-snug text-white">{m.texte || m.fichier?.nom}</span>
      </button>
      {privilegie && (
        <button onClick={() => void detacher()} className="rounded-lg p-1.5 text-nuit-gris hover:bg-nuit-panneau hover:text-white" aria-label="Détacher le message" title="Détacher">
          <PinOff className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function Message({ m, seanceId, role, moiId, ouverte, onRepondrePrive }: { m: MessageLiveDto; seanceId: number; role: RoleSeance; moiId: number; ouverte: boolean; onRepondrePrive?: () => void }) {
  const [action, setAction] = useState(false);
  const [palette, setPalette] = useState(false);
  const privilegie = role === "formateur" || role === "equipe";
  const lecteurSalle = role === "salle";
  const mien = m.auteurId === moiId;
  const nom = lecteurSalle && m.role === "etudiant" && !mien ? "Un étudiant" : m.auteur;
  const couleur = m.role === "formateur" ? "text-orange" : m.role === "salle" ? "text-orange-peche" : m.role === "equipe" ? "text-[#8EC5FF]" : "text-white";
  const prive = m.destinataireId !== null;

  const agir = async (fn: () => Promise<unknown>) => {
    setAction(true);
    try {
      await fn();
    } catch (e) {
      toastErreur(e);
    } finally {
      setAction(false);
    }
  };
  const retirer = () => agir(() => suppr(`/api/seances/${seanceId}/chat/${m.id}`));
  const epingler = () => agir(() => post(`/api/seances/${seanceId}/chat/${m.id}/epingle`, { epingle: !m.epingle }));
  const reagir = async (emoji: string) => {
    setPalette(false);
    try {
      const r = await post<{ id: number; reactions: MessageLiveDto["reactions"]; mesReactions: string[] }>(`/api/seances/${seanceId}/chat/${m.id}/reactions`, { emoji });
      queryClient.setQueryData<MessageLiveDto[]>(cleDiscussion(seanceId, m.groupeId), (liste) =>
        liste?.map((x) => (x.id === r.id ? { ...x, reactions: r.reactions, mesReactions: r.mesReactions } : x)),
      );
    } catch (e) {
      toastErreur(e);
    }
  };

  const peutMasquer = privilegie && !mien && !m.masque && !prive;
  const peutEpingler = privilegie && !m.masque && !prive && ouverte;
  const peutReagir = ouverte && !m.masque;

  return (
    <div
      data-message={m.id}
      className={cn(
        "group relative rounded-2xl px-3 py-2",
        mien ? "bg-nuit-ligne" : "bg-nuit-carte",
        prive && "ring-1 ring-[#8F6BFF]/60",
        m.epingle && "ring-1 ring-orange/60",
        m.masque && "opacity-50",
      )}
    >
      {prive && (
        <p className={cn("mb-0.5 flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider", PRIVE)}>
          <Lock className="h-3 w-3" /> {mien ? `Privé · à ${m.destinataire ?? ""}` : "Privé · pour vous"}
        </p>
      )}
      <div className="flex items-baseline gap-2 text-[12px]">
        <span className={cn("truncate font-extrabold", couleur)}>
          {nom}
          {m.role === "formateur" && <span className="ml-1 font-mono font-normal text-nuit-gris">· formateur</span>}
        </span>
        {m.site && m.role !== "salle" && <span className="shrink-0 font-mono text-nuit-gris">{m.site}</span>}
        {m.epingle && <Pin className="h-3 w-3 shrink-0 text-orange" aria-label="Épinglé" />}
        <span className="ml-auto shrink-0 font-mono text-nuit-gris">{heure(m.creeLe)}</span>
      </div>
      {m.masque && <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wider text-nuit-gris">Masqué pour la classe</p>}
      {m.texte && <p className="mt-0.5 whitespace-pre-wrap break-words text-[14.5px] leading-snug text-white">{avecLiens(m.texte)}</p>}
      {m.fichier && <FichierJoint f={m.fichier} />}

      {(m.reactions.length > 0 || peutReagir || mien || peutMasquer || peutEpingler || onRepondrePrive) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {m.reactions.map((r) => {
            const miennes = m.mesReactions.includes(r.emoji);
            return (
              <button
                key={r.emoji}
                onClick={() => peutReagir && void reagir(r.emoji)}
                disabled={!peutReagir}
                aria-pressed={miennes}
                aria-label={`${r.emoji} ${r.n}${miennes ? ", dont la vôtre" : ""}`}
                className={cn(
                  "flex h-7 items-center gap-1 rounded-full border px-2 text-[13px] transition-colors",
                  miennes ? "border-orange bg-orange/15 text-white" : "border-nuit-ligne bg-nuit-panneau text-nuit-doux hover:border-nuit-bord",
                )}
              >
                <span>{r.emoji}</span>
                <span className="font-mono text-[11px]">{r.n}</span>
              </button>
            );
          })}
          {peutReagir && (
            <div className="relative">
              <button
                onClick={() => setPalette((p) => !p)}
                className={cn(
                  "grid h-7 w-8 place-items-center rounded-full text-nuit-gris hover:bg-nuit-panneau hover:text-white",
                  !palette && m.reactions.length === 0 && "sm:opacity-0 sm:focus:opacity-100 sm:group-hover:opacity-100",
                )}
                aria-label="Réagir avec un emoji"
                aria-expanded={palette}
                title="Réagir"
              >
                <SmilePlus className="h-4 w-4" />
              </button>
              {palette && (
                <div className="absolute bottom-full left-0 z-20 mb-1 flex gap-0.5 rounded-2xl border border-nuit-bord bg-nuit-panneau p-1 shadow-xl" role="menu">
                  {REACTIONS_CHAT.map((e) => (
                    <button key={e} role="menuitem" onClick={() => void reagir(e)} className="grid h-9 w-9 place-items-center rounded-xl text-[20px] hover:bg-nuit-ligne" aria-label={`Réagir ${e}`}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {(mien || peutMasquer || peutEpingler || onRepondrePrive) && (
            <div className="ml-auto flex flex-wrap justify-end gap-0.5 opacity-100 sm:opacity-0 sm:transition-opacity sm:focus-within:opacity-100 sm:group-hover:opacity-100">
              {onRepondrePrive && (
                <BoutonMessage onClick={onRepondrePrive} disabled={action} icone={<MessageCircle className="h-3.5 w-3.5" />}>
                  Répondre en privé
                </BoutonMessage>
              )}
              {peutEpingler && (
                <BoutonMessage onClick={() => void epingler()} disabled={action} icone={m.epingle ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}>
                  {m.epingle ? "Détacher" : "Épingler"}
                </BoutonMessage>
              )}
              {(mien || peutMasquer) && (
                <BoutonMessage onClick={() => void retirer()} disabled={action} icone={mien ? <Trash2 className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}>
                  {mien ? "Retirer" : "Masquer"}
                </BoutonMessage>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BoutonMessage({ onClick, disabled, icone, children }: { onClick: () => void; disabled?: boolean; icone: ReactNode; children: ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-bold text-nuit-gris hover:bg-nuit-panneau hover:text-white disabled:opacity-50">
      {icone}
      {children}
    </button>
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

type PropsRedaction = {
  seanceId: number;
  role: RoleSeance;
  groupeId: number | null;
  destinataire: Destinataire;
  onDestinataire: (d: Destinataire) => void;
  auFormateur: Destinataire;
  /** Discussion limitée par le formateur : seulement en privé avec lui. */
  limite: boolean;
  messages: MessageLiveDto[];
  moiId: number;
  onEnvoye: () => void;
};

function Redaction({ seanceId, role, groupeId, destinataire, onDestinataire, auFormateur, limite, messages, moiId, onEnvoye }: PropsRedaction) {
  const [texte, setTexte] = useState("");
  const [joint, setJoint] = useState<FichierTeleverse | null>(null);
  const [depot, setDepot] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [emojis, setEmojis] = useState(false);
  const champ = useRef<HTMLTextAreaElement>(null);
  const selecteur = useRef<HTMLInputElement>(null);
  const tu = role === "etudiant";
  const privilegie = role === "formateur" || role === "equipe";
  const pret = !envoi && !depot && (texte.trim().length > 0 || joint !== null) && (!limite || destinataire !== null);

  // La zone grandit avec le texte (4 lignes au plus).
  useEffect(() => {
    const el = champ.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [texte]);

  // Formateur : les présents (étudiants, salles) pour écrire en privé, plus ceux qui ont écrit.
  const { data: presents, refetch: relirePresents } = useQuery<ParticipantGroupeDto[]>({
    queryKey: [`/api/seances/${seanceId}/participants`],
    enabled: privilegie && !groupeId,
    staleTime: 20_000,
  });
  const choix = useMemo(() => {
    if (!privilegie) return [];
    const parId = new Map<number, string>();
    for (const p of presents ?? []) parId.set(p.id, p.role === "salle" ? p.nom : `${p.nom}${p.site ? ` · ${p.site}` : ""}`);
    for (const m of messages) if (m.auteurId !== moiId && (m.role === "etudiant" || m.role === "salle") && !parId.has(m.auteurId)) parId.set(m.auteurId, m.auteur);
    if (destinataire && !parId.has(destinataire.id)) parId.set(destinataire.id, destinataire.nom);
    return [...parId.entries()].map(([id, nom]) => ({ id, nom })).sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  }, [privilegie, presents, messages, moiId, destinataire]);

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

  const insererEmoji = (e: string) => {
    const el = champ.current;
    const debut = el?.selectionStart ?? texte.length;
    const fin = el?.selectionEnd ?? texte.length;
    setTexte((texte.slice(0, debut) + e + texte.slice(fin)).slice(0, 1000));
    requestAnimationFrame(() => {
      el?.focus({ preventScroll: true });
      el?.setSelectionRange(debut + e.length, debut + e.length);
    });
  };

  const envoyer = async () => {
    if (!pret) return;
    setEnvoi(true);
    try {
      const m = await post<MessageLiveDto>(`/api/seances/${seanceId}/chat`, {
        texte: texte.trim(),
        ...(joint && { fichierId: joint.id }),
        ...(destinataire && !groupeId && { destinataireId: destinataire.id }),
        ...(groupeId && { groupeId }),
      });
      // Affiché tout de suite (le temps réel le confirme ensuite sans doublon).
      queryClient.setQueryData<MessageLiveDto[]>(cleDiscussion(seanceId, groupeId), (liste) => (liste && !liste.some((x) => x.id === m.id) ? [...liste, m].slice(-300) : liste));
      setTexte("");
      setJoint(null);
      setEmojis(false);
      onEnvoye();
      champ.current?.focus({ preventScroll: true });
    } catch (e) {
      toastErreur(e);
    } finally {
      setEnvoi(false);
    }
  };

  const libelleJoint = useMemo(() => depot ?? joint?.nom ?? null, [depot, joint]);
  const placeholder = groupeId ? (tu ? "Écris à ton groupe…" : "Écrire au groupe…") : destinataire ? `En privé à ${destinataire.nom}…` : tu ? "Écris à la classe…" : "Écrire à la classe…";

  return (
    <div className="border-t border-nuit-ligne p-2.5">
      {!groupeId && (privilegie || auFormateur) && (
        <div className="mb-2 flex items-center gap-2 text-[13px]">
          <span className="shrink-0 font-bold text-nuit-gris">À</span>
          {privilegie ? (
            <select
              value={destinataire?.id ?? ""}
              onFocus={() => void relirePresents()}
              onChange={(e) => {
                const id = Number(e.target.value);
                onDestinataire(id ? { id, nom: choix.find((c) => c.id === id)?.nom ?? "" } : null);
              }}
              className={cn(
                "min-h-9 min-w-0 flex-1 rounded-lg border bg-nuit-bulle px-2 text-[13px] font-semibold outline-none focus:border-orange",
                destinataire ? cn("border-[#8F6BFF]/70", PRIVE) : "border-nuit-bord text-white",
              )}
              aria-label="Destinataire du message"
            >
              <option value="">Toute la classe</option>
              {choix.length > 0 && (
                <optgroup label="En privé">
                  {choix.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          ) : (
            <div className="flex flex-1 gap-1 rounded-lg bg-nuit-carte p-0.5" role="radiogroup" aria-label="Destinataire du message">
              {!limite && (
                <button
                  role="radio"
                  aria-checked={!destinataire}
                  onClick={() => onDestinataire(null)}
                  className={cn("min-h-8 flex-1 rounded-md px-2 text-[12.5px] font-bold", !destinataire ? "bg-orange text-encre" : "text-nuit-doux hover:text-white")}
                >
                  Toute la classe
                </button>
              )}
              <button
                role="radio"
                aria-checked={Boolean(destinataire)}
                onClick={() => onDestinataire(destinataire ?? auFormateur)}
                className={cn(
                  "flex min-h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-md px-2 text-[12.5px] font-bold",
                  destinataire ? "bg-[#8F6BFF] text-white" : "text-nuit-doux hover:text-white",
                )}
              >
                <Lock className="h-3 w-3 shrink-0" /> <span className="truncate">{destinataire && destinataire.id !== auFormateur?.id ? destinataire.nom : "Au formateur, en privé"}</span>
              </button>
            </div>
          )}
          {destinataire && !limite && (
            <button onClick={() => onDestinataire(null)} className="rounded-lg p-1 text-nuit-gris hover:text-white" aria-label="Écrire à toute la classe">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      {limite && <p className="mb-2 text-[12.5px] leading-snug text-nuit-doux">Le formateur a limité la discussion : {tu ? "tes messages lui arrivent" : "vos messages lui arrivent"} en privé.</p>}
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
      {emojis && (
        <div className="mb-2 grid grid-cols-7 gap-0.5 rounded-xl bg-nuit-carte p-1.5 sm:grid-cols-10" role="menu" aria-label="Emojis">
          {EMOJIS.map((e) => (
            <button key={e} role="menuitem" onClick={() => insererEmoji(e)} className="grid h-9 place-items-center rounded-lg text-[20px] hover:bg-nuit-ligne" aria-label={`Insérer ${e}`}>
              {e}
            </button>
          ))}
        </div>
      )}
      <div className="flex items-end gap-1.5">
        <button
          onClick={() => selecteur.current?.click()}
          disabled={Boolean(depot)}
          className="grid h-11 w-10 shrink-0 place-items-center rounded-xl bg-nuit-carte text-nuit-doux hover:text-white disabled:opacity-50"
          aria-label={tu ? "Joindre une photo ou un document" : "Joindre un fichier"}
          title={tu ? "Joindre une photo ou un document" : "Joindre un fichier"}
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <button
          onClick={() => setEmojis((x) => !x)}
          className={cn("grid h-11 w-10 shrink-0 place-items-center rounded-xl bg-nuit-carte hover:text-white", emojis ? "text-orange" : "text-nuit-doux")}
          aria-label="Emojis"
          aria-expanded={emojis}
          title="Emojis"
        >
          <Smile className="h-5 w-5" />
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
          placeholder={placeholder}
          aria-label={destinataire && !groupeId ? "Message privé" : groupeId ? "Message au groupe" : "Message à la classe"}
          className={cn(
            "min-h-11 min-w-0 flex-1 resize-none rounded-xl border bg-nuit-bulle px-3 py-2.5 text-[15px] text-white outline-none placeholder:text-nuit-gris focus:border-orange",
            destinataire && !groupeId ? "border-[#8F6BFF]/70" : "border-nuit-bord",
          )}
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
