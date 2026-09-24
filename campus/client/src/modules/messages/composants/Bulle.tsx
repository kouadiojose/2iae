// Bulles du fil : moi à droite (orange pâle), les autres à gauche. Citation,
// contexte (« À propos du devoir… »), photo allégée, fichier avec son poids,
// note vocale, coches ✓ envoyé / ✓✓ lu, et menu (répondre, copier,
// supprimer, signaler) au survol ou par un appui long.
import { useRef, useState, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  Reply,
  Copy,
  Trash2,
  Flag,
  Ban,
  FileText,
  Download,
  ImageIcon,
  Link2,
  Camera,
  Mic,
  Paperclip,
  AlertTriangle,
  RotateCcw,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/divers";
import { heure } from "@/lib/dates";
import { cn, taille as poids } from "@/lib/utils";
import { LIBELLES_ROLES } from "@shared/schema";
import type { CitationMessage, MessageDto } from "@shared/schema";
import { LecteurVocal } from "./NoteVocale";
import { dureeCourte } from "../outils";

// ── Texte avec liens cliquables (jamais de HTML injecté) ───────────────────

const URL_RE = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]])/g;

function TexteMessage({ texte }: { texte: string }) {
  const morceaux = texte.split(URL_RE);
  return (
    <p className="whitespace-pre-wrap break-words text-base leading-[1.45] text-encre [overflow-wrap:anywhere]">
      {morceaux.map((m, i) =>
        i % 2 === 1 ? (
          <a key={i} href={m} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {m}
          </a>
        ) : (
          m
        ),
      )}
    </p>
  );
}

function IconeType({ type, className }: { type: CitationMessage["type"]; className?: string }) {
  if (type === "photo") return <Camera className={className} aria-hidden="true" />;
  if (type === "audio") return <Mic className={className} aria-hidden="true" />;
  if (type === "fichier") return <Paperclip className={className} aria-hidden="true" />;
  return null;
}

/** Bloc « réponse à… » dans une bulle ou au-dessus de la zone de saisie. */
export function Citation({ c, onClick, className, moi }: { c: CitationMessage; onClick?: () => void; className?: string; moi?: { id: number; libelle: string } }) {
  const contenu = (
    <>
      <span className="block truncate text-[13px] font-bold text-orange-fonce">{moi && c.auteurId === moi.id ? moi.libelle : c.auteur}</span>
      <span className="flex items-center gap-1 text-sm text-texte-doux">
        <IconeType type={c.type} className="h-3.5 w-3.5 shrink-0" />
        <span className="line-clamp-2 break-words">{c.supprime ? "Message supprimé" : c.extrait}</span>
      </span>
    </>
  );
  const classes = cn("block w-full rounded-lg border-l-4 border-orange-fonce bg-encre/[0.05] px-3 py-1.5 text-left", className);
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(classes, "hover:bg-encre/[0.08]")}>
      {contenu}
    </button>
  ) : (
    <div className={classes}>{contenu}</div>
  );
}

function Contexte({ texte }: { texte: string }) {
  return (
    <div className="mb-1.5 flex items-start gap-1.5 rounded-lg bg-white/80 px-2.5 py-1.5 text-[13px] font-semibold leading-snug text-orange-profond ring-1 ring-orange-peche">
      <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="break-words">{texte}</span>
    </div>
  );
}

function Photo({
  url,
  nom,
  octets,
  donneesReduites,
  onVoir,
  onChargee,
}: {
  url: string;
  nom: string;
  octets: number;
  donneesReduites: boolean;
  onVoir: () => void;
  onChargee?: () => void;
}) {
  const [afficher, setAfficher] = useState(!donneesReduites);
  if (!afficher) {
    return (
      <button
        type="button"
        onClick={() => setAfficher(true)}
        className="flex h-32 w-56 max-w-full flex-col items-center justify-center gap-1.5 rounded-xl bg-encre/[0.06] text-texte-doux hover:bg-encre/10"
      >
        <ImageIcon className="h-6 w-6" aria-hidden="true" />
        <span className="text-sm font-bold">Afficher la photo</span>
        <span className="font-mono text-xs">{poids(octets)}</span>
      </button>
    );
  }
  return (
    <button type="button" onClick={onVoir} className="block overflow-hidden rounded-xl" aria-label={`Agrandir la photo ${nom}`}>
      <img src={url} alt="" loading="lazy" onLoad={onChargee} className="max-h-80 min-h-24 w-auto min-w-32 max-w-full bg-encre/[0.06] object-cover" />
    </button>
  );
}

function PieceJointe({ url, nom, mime, octets }: { url: string; nom: string; mime: string; octets: number }) {
  const ext = (nom.split(".").pop() || mime.split("/").pop() || "").toUpperCase().slice(0, 5);
  return (
    <a
      href={`${url}?telecharger=1`}
      download={nom}
      className="flex min-h-[56px] min-w-[220px] max-w-full items-center gap-3 rounded-xl bg-encre/[0.05] px-3 py-2.5 text-encre no-underline hover:bg-encre/10 hover:text-encre"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-orange-fonce">
        <FileText className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-bold">{nom}</span>
        <span className="font-mono text-xs text-texte-pale">
          {ext} · {poids(octets)}
        </span>
      </span>
      <Download className="h-5 w-5 shrink-0 text-texte-pale" aria-label="Télécharger" />
    </a>
  );
}

// ── Menu d'actions ─────────────────────────────────────────────────────────

type Action = { libelle: string; icone: ReactNode; onSelect: () => void; danger?: boolean };

function MenuBulle({ actions, ouvert, setOuvert, deMoi }: { actions: Action[]; ouvert: boolean; setOuvert: (o: boolean) => void; deMoi: boolean }) {
  if (!actions.length) return null;
  return (
    <DropdownMenu.Root open={ouvert} onOpenChange={setOuvert} modal={false}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Actions sur le message"
          className={cn(
            // Souris : apparaît au survol. Téléphone : invisible (l'appui long ouvre le menu), mais
            // garde sa place pour que le menu s'ancre au bon endroit.
            "pointer-events-none absolute right-1 top-1 z-10 grid h-8 w-8 place-items-center rounded-full text-texte-pale opacity-0 transition-opacity hover:text-encre",
            "[@media(hover:hover)]:group-hover:pointer-events-auto [@media(hover:hover)]:group-hover:opacity-100",
            "focus-visible:pointer-events-auto focus-visible:opacity-100 data-[state=open]:opacity-100",
            deMoi ? "bg-orange-clair/90" : "bg-white/90",
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align={deMoi ? "end" : "start"}
          sideOffset={6}
          className="z-50 min-w-[210px] rounded-2xl border border-ligne bg-white p-1.5 shadow-carte animate-apparait"
        >
          {actions.map((a) => (
            <DropdownMenu.Item
              key={a.libelle}
              onSelect={a.onSelect}
              className={cn(
                "flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl px-3 text-[15px] font-semibold outline-none data-[highlighted]:bg-creme",
                a.danger ? "text-danger" : "text-encre",
              )}
            >
              {a.icone}
              {a.libelle}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/** Appui long (téléphone) : ouvre le menu d'actions, comme sur WhatsApp. */
function useAppuiLong(surAppui: () => void) {
  const minuterie = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const depart = useRef<{ x: number; y: number } | null>(null);
  const stop = () => {
    clearTimeout(minuterie.current);
    depart.current = null;
  };
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse") return;
      if ((e.target as HTMLElement).closest("a,button,audio,[role=slider]")) return;
      depart.current = { x: e.clientX, y: e.clientY };
      minuterie.current = setTimeout(() => {
        navigator.vibrate?.(15);
        surAppui();
      }, 480);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (depart.current && Math.hypot(e.clientX - depart.current.x, e.clientY - depart.current.y) > 10) stop();
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onContextMenu: (e: React.MouseEvent) => {
      // Le menu du navigateur (sélection) laisse place au nôtre, qui propose « Copier ».
      if (!(e.target as HTMLElement).closest("a,img")) e.preventDefault();
    },
  };
}

// ── Bulle d'un message du serveur ──────────────────────────────────────────

export type PropsBulle = {
  message: MessageDto;
  deMoi: boolean;
  salon: boolean;
  /** Conversation directe : l'autre a lu ce message (✓✓). */
  lu: boolean;
  /** Même auteur que le message précédent, à moins de 5 minutes : bulle compacte. */
  suite: boolean;
  moderateur: boolean;
  peutSupprimer: boolean;
  donneesReduites: boolean;
  surligne: boolean;
  onRepondre: () => void;
  onSupprimer: () => void;
  onSignaler: () => void;
  onCitation: (id: number) => void;
  onVoirPhoto: (url: string, nom: string) => void;
  onMediaCharge: () => void;
  /** Pour écrire « Toi » (ou « Vous ») dans une citation de mon propre message. */
  moi: { id: number; libelle: string };
};

function EtiquetteAuteur({ m }: { m: MessageDto }) {
  const a = m.auteur;
  return (
    <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 pr-7">
      <span className={cn("text-sm font-extrabold", a.role === "formateur" ? "text-orange-profond" : "text-encre")}>
        {a.prenom} {a.nom}
      </span>
      {a.role === "etudiant" ? (
        a.site && <span className="font-mono text-[11px] text-texte-gris">{a.site}</span>
      ) : (
        <span
          className={cn(
            "rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider",
            a.role === "formateur" ? "bg-encre text-white" : "bg-creme text-texte-doux",
          )}
        >
          {LIBELLES_ROLES[a.role]}
        </span>
      )}
    </div>
  );
}

export function Bulle(p: PropsBulle) {
  const { message: m, deMoi, salon } = p;
  const [menu, setMenu] = useState(false);
  const appuiLong = useAppuiLong(() => setMenu(true));
  const formateurEnSalon = salon && !deMoi && m.auteur.role === "formateur";

  const actions: Action[] = [];
  if (!m.supprime) {
    actions.push({ libelle: "Répondre", icone: <Reply className="h-4 w-4" />, onSelect: p.onRepondre });
    if (m.texte) {
      actions.push({
        libelle: "Copier le texte",
        icone: <Copy className="h-4 w-4" />,
        onSelect: () => void navigator.clipboard?.writeText(m.texte).catch(() => undefined),
      });
    }
    if (p.peutSupprimer) {
      actions.push({
        libelle: deMoi ? "Supprimer pour tous" : "Retirer du salon",
        icone: <Trash2 className="h-4 w-4" />,
        onSelect: p.onSupprimer,
        danger: true,
      });
    }
    if (!deMoi && !m.signaleParMoi) actions.push({ libelle: "Signaler", icone: <Flag className="h-4 w-4" />, onSelect: p.onSignaler, danger: true });
  }

  return (
    <div id={`message-${m.id}`} className={cn("flex items-end gap-2", deMoi ? "justify-end" : "justify-start", p.suite ? "mt-1" : "mt-3")}>
      {salon && !deMoi && (
        <div className="w-8 shrink-0">{!p.suite && <Avatar prenom={m.auteur.prenom} nom={m.auteur.nom} photo={m.auteur.photoUrl} taille={32} />}</div>
      )}
      <div
        {...appuiLong}
        className={cn(
          "group relative max-w-[85%] rounded-2xl px-3.5 pb-1.5 pt-2 shadow-[0_1px_1px_rgba(20,20,20,0.04)] transition-shadow sm:max-w-[72%] lg:max-w-[560px]",
          deMoi ? "rounded-br-md border border-[#F4D3BC] bg-orange-clair" : "rounded-bl-md border border-ligne-douce bg-white",
          p.suite && (deMoi ? "rounded-br-2xl" : "rounded-bl-2xl"),
          formateurEnSalon && "border-l-4 border-l-orange",
          p.surligne && "ring-4 ring-orange/40",
          m.supprime && "bg-white/70",
        )}
      >
        {!m.supprime && <MenuBulle actions={actions} ouvert={menu} setOuvert={setMenu} deMoi={deMoi} />}
        {salon && !deMoi && !p.suite && <EtiquetteAuteur m={m} />}

        {m.supprime ? (
          <p className="flex items-center gap-2 py-0.5 text-[15px] italic text-texte-gris">
            <Ban className="h-4 w-4 shrink-0" aria-hidden="true" />
            {m.retireParModeration ? "Message retiré par la modération" : deMoi ? "Tu as supprimé ce message" : "Ce message a été supprimé"}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {m.contexte && <Contexte texte={m.contexte} />}
            {m.reponseA && <Citation c={m.reponseA} moi={p.moi} onClick={() => p.onCitation(m.reponseA!.id)} />}
            {m.fichier && m.type === "photo" && (
              <Photo
                url={m.fichier.url}
                nom={m.fichier.nom}
                octets={m.fichier.taille}
                donneesReduites={p.donneesReduites}
                onVoir={() => p.onVoirPhoto(m.fichier!.url, m.fichier!.nom)}
                onChargee={p.onMediaCharge}
              />
            )}
            {m.fichier && m.type === "audio" && <LecteurVocal url={m.fichier.url} duree={m.dureeSecondes} deMoi={deMoi} />}
            {m.fichier && m.type === "fichier" && <PieceJointe url={m.fichier.url} nom={m.fichier.nom} mime={m.fichier.mime} octets={m.fichier.taille} />}
            {m.texte && <TexteMessage texte={m.texte} />}
          </div>
        )}

        <div className="mt-0.5 flex items-center justify-end gap-1.5">
          {p.moderateur && m.signalements > 0 && !m.supprime && (
            <span className="mr-auto flex items-center gap-1 rounded-full bg-danger-clair px-2 py-0.5 font-mono text-[10px] font-bold text-danger">
              <Flag className="h-3 w-3" aria-hidden="true" />
              Signalé {m.signalements > 1 ? `${m.signalements} fois` : ""}
            </span>
          )}
          {m.signaleParMoi && !m.supprime && <span className="mr-auto font-mono text-[10px] text-texte-gris">Signalé</span>}
          <time dateTime={m.creeLe} className="font-mono text-[11px] text-texte-gris">
            {heure(m.creeLe)}
          </time>
          {deMoi &&
            !m.supprime &&
            (p.lu ? (
              <CheckCheck className="h-4 w-4 text-orange-fonce" aria-label="Lu" />
            ) : (
              <Check className="h-4 w-4 text-texte-gris" aria-label="Envoyé" />
            ))}
        </div>
      </div>
    </div>
  );
}

// ── Bulle d'un envoi pas encore confirmé (réseau coupé, envoi en cours) ─────

export type EnvoiLocal = {
  cle: string;
  texte: string;
  contexte: string | null;
  reponseA: CitationMessage | null;
  fichier: File | null;
  apercuUrl: string | null;
  dureeSecondes: number | null;
  creeLe: number;
  etat: "envoi" | "attente" | "refuse";
  erreur?: string;
};

export function BulleEnAttente({ e, onReessayer, onRetirer }: { e: EnvoiLocal; onReessayer: () => void; onRetirer: () => void }) {
  const type = e.fichier ? (e.fichier.type.startsWith("image/") ? "photo" : e.fichier.type.startsWith("audio/") ? "audio" : "fichier") : "texte";
  return (
    <div className="mt-1 flex justify-end">
      <div
        className={cn(
          "relative max-w-[85%] rounded-2xl rounded-br-md border px-3.5 pb-1.5 pt-2 sm:max-w-[72%] lg:max-w-[560px]",
          e.etat === "refuse" ? "border-danger/40 bg-danger-clair" : "border-[#F4D3BC] bg-orange-clair/70",
        )}
      >
        <div className="flex flex-col gap-1.5">
          {e.contexte && <Contexte texte={e.contexte} />}
          {e.reponseA && <Citation c={e.reponseA} />}
          {type === "photo" && e.apercuUrl && <img src={e.apercuUrl} alt="" className="max-h-60 w-auto max-w-full rounded-xl opacity-80" />}
          {type === "audio" && (
            <div className="flex items-center gap-2 py-1 text-[15px] font-semibold text-texte-doux">
              <Mic className="h-5 w-5 text-orange-fonce" aria-hidden="true" />
              Note vocale {e.dureeSecondes ? `· ${dureeCourte(e.dureeSecondes)}` : ""}
            </div>
          )}
          {type === "fichier" && e.fichier && (
            <div className="flex items-center gap-2 py-1 text-[15px] font-semibold text-texte-doux">
              <FileText className="h-5 w-5 text-orange-fonce" aria-hidden="true" />
              <span className="truncate">{e.fichier.name}</span>
              <span className="font-mono text-xs">{poids(e.fichier.size)}</span>
            </div>
          )}
          {e.texte && <TexteMessage texte={e.texte} />}
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
          {e.etat === "refuse" ? (
            <>
              <span className="mr-auto flex items-center gap-1 text-[13px] font-semibold text-danger">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                Non envoyé{e.erreur ? ` : ${e.erreur}` : ""}
              </span>
              <button type="button" onClick={onReessayer} className="flex h-9 items-center gap-1 rounded-lg bg-white px-3 text-[13px] font-bold text-encre hover:bg-encre hover:text-white">
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Réessayer
              </button>
              <button type="button" onClick={onRetirer} className="grid h-9 w-9 place-items-center rounded-lg text-danger hover:bg-white" aria-label="Retirer ce message">
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <span className="flex items-center gap-1 font-mono text-[11px] text-texte-pale" role="status">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              {e.etat === "attente" ? "En attente de réseau" : "Envoi…"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
