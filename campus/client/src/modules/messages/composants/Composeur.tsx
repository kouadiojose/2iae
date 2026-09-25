// Zone de saisie façon WhatsApp : texte (brouillon gardé sur le téléphone),
// photo ou document, note vocale (maintenir le micro, ou le toucher puis
// « Envoyer »), réponse citée et contexte (« À propos du devoir… »).
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Paperclip, Camera, FileText, Mic, SendHorizontal, Trash2, X, Link2, ChevronLeft } from "lucide-react";
import { post } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { cn, taille as poids } from "@/lib/utils";
import type { CitationMessage, Role } from "@shared/schema";
import { Citation } from "./Bulle";
import { useEnregistreur, enregistrementPossible, DUREE_MAX_VOCAL } from "./NoteVocale";
import { dureeCourte, ecrireBrouillon, lireBrouillon, selonRole } from "../outils";

/** Limite du serveur (UPLOAD_MAX_MB, 25 Mo par défaut). */
const POIDS_MAX = 25 * 1024 * 1024;
const TYPES_DOCUMENTS = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.txt,.csv,.zip";

export type ContenuEnvoi = { texte: string; fichier: File | null; dureeSecondes: number | null };

export type PoigneeComposeur = { focus: () => void; remplir: (texte: string) => void };

type Props = {
  conversationId: number;
  role: Role;
  salon: boolean;
  contexte: string | null;
  onRetirerContexte: () => void;
  reponseA: CitationMessage | null;
  onAnnulerReponse: () => void;
  onEnvoyer: (c: ContenuEnvoi) => void;
  /** Envoie « en train d'écrire… » à l'autre personne (conversations directes). */
  signalerSaisie: boolean;
  /** Entrée envoie le message (ordinateur) ; sur téléphone, Entrée va à la ligne. */
  entreeEnvoie: boolean;
};

function ApercuFichier({ fichier, onRetirer }: { fichier: File; onRetirer: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const image = fichier.type.startsWith("image/");
  useEffect(() => {
    if (!image) return;
    const u = URL.createObjectURL(fichier);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [fichier, image]);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-creme p-2 pr-1">
      {image && url ? (
        <img src={url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
      ) : (
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-white text-orange-fonce">
          <FileText className="h-6 w-6" aria-hidden="true" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-bold">{image ? "Photo" : fichier.name}</span>
        <span className="font-mono text-xs text-texte-pale">
          {image ? "Allégée avant l'envoi" : poids(fichier.size)}
        </span>
      </span>
      <button type="button" onClick={onRetirer} className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-texte-pale hover:bg-white hover:text-encre" aria-label="Retirer la pièce jointe">
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

export const Composeur = forwardRef<PoigneeComposeur, Props>(function Composeur(p, ref) {
  const [texte, setTexte] = useState(() => lireBrouillon(p.conversationId));
  const [fichier, setFichier] = useState<File | null>(null);
  const zone = useRef<HTMLTextAreaElement>(null);
  const entreePhoto = useRef<HTMLInputElement>(null);
  const entreeDocument = useRef<HTMLInputElement>(null);
  const derniereSaisie = useRef(0);
  const etudiant = p.role === "etudiant";

  useImperativeHandle(ref, () => ({
    focus: () => zone.current?.focus(),
    remplir: (t: string) => {
      setTexte(t);
      requestAnimationFrame(() => {
        zone.current?.focus();
        zone.current?.setSelectionRange(t.length, t.length);
      });
    },
  }));

  // Brouillon : écrit sur le téléphone à chaque frappe (léger), relu à l'ouverture.
  useEffect(() => {
    const t = setTimeout(() => ecrireBrouillon(p.conversationId, texte), 250);
    return () => clearTimeout(t);
  }, [texte, p.conversationId]);

  // Hauteur automatique (jusqu'à ~5 lignes).
  useEffect(() => {
    const z = zone.current;
    if (!z) return;
    z.style.height = "auto";
    z.style.height = `${Math.min(z.scrollHeight, 150)}px`;
  }, [texte]);

  function choisir(f: File | undefined) {
    if (!f) return;
    if (f.size > POIDS_MAX) {
      toast("Fichier trop lourd : 25 Mo au plus.", "erreur");
      return;
    }
    setFichier(f);
    zone.current?.focus();
  }

  function envoyer() {
    const t = texte.trim();
    if (!t && !fichier) return;
    p.onEnvoyer({ texte: t, fichier, dureeSecondes: null });
    setTexte("");
    setFichier(null);
    ecrireBrouillon(p.conversationId, "");
    zone.current?.focus();
  }

  function surFrappe(v: string) {
    setTexte(v);
    if (p.signalerSaisie && v.trim() && Date.now() - derniereSaisie.current > 3000) {
      derniereSaisie.current = Date.now();
      post(`/api/conversations/${p.conversationId}/saisie`).catch(() => undefined);
    }
  }

  // ── Note vocale ──────────────────────────────────────────────────────────
  const [mode, setMode] = useState<null | "maintien" | "verrouille">(null);
  const appuiDebut = useRef(0);
  const departX = useRef(0);
  const [glisse, setGlisse] = useState(0);
  const enFin = useRef(false);
  const enreg = useEnregistreur(() => void finirVocal(true));
  const vocalPossible = enregistrementPossible();

  async function finirVocal(limite = false) {
    if (enFin.current) return;
    enFin.current = true;
    try {
      const note = await enreg.terminer();
      setMode(null);
      if (!note) {
        toast(selonRole(p.role, "Maintiens le micro un peu plus longtemps pour enregistrer.", "Maintenez le micro un peu plus longtemps pour enregistrer."), "info");
        return;
      }
      if (limite) toast(`${DUREE_MAX_VOCAL / 60} minutes au maximum : la note vocale est partie.`, "info");
      p.onEnvoyer({ texte: "", fichier: note.fichier, dureeSecondes: note.dureeSecondes });
    } finally {
      enFin.current = false;
    }
  }

  function annulerVocal() {
    enreg.annuler();
    setMode(null);
    setGlisse(0);
  }

  async function commencerVocal(nouveauMode: "maintien" | "verrouille") {
    setMode(nouveauMode);
    try {
      await enreg.demarrer();
      navigator.vibrate?.(20);
    } catch {
      setMode(null);
      toast(
        selonRole(
          p.role,
          "Autorise le micro pour enregistrer une note vocale (réglages du navigateur).",
          "Autorisez le micro pour enregistrer une note vocale (réglages du navigateur).",
        ),
        "erreur",
      );
    }
  }

  const enregistre = mode !== null;
  const aEnvoyer = Boolean(texte.trim() || fichier);
  const placeholder = p.salon
    ? selonRole(p.role, "Pose ta question", "Répondre à la classe")
    : selonRole(p.role, "Écris ton message", "Écrivez votre message");

  return (
    <div className="border-t border-ligne-douce bg-white px-3 pt-2.5 sm:px-4" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 10px)" }}>
      {(p.contexte || p.reponseA || fichier) && (
        <div className="mb-2 flex flex-col gap-2">
          {p.contexte && (
            <div className="flex items-center gap-2 rounded-2xl bg-orange-clair py-1 pl-3 pr-1 text-[14px] font-semibold text-orange-profond">
              <Link2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{p.contexte}</span>
              <button type="button" onClick={p.onRetirerContexte} className="grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-white" aria-label="Retirer le contexte">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {p.reponseA && (
            <div className="flex items-center gap-1">
              <Citation c={p.reponseA} className="min-w-0 flex-1" />
              <button type="button" onClick={p.onAnnulerReponse} className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-texte-pale hover:bg-creme hover:text-encre" aria-label="Ne plus répondre à ce message">
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
          {fichier && <ApercuFichier fichier={fichier} onRetirer={() => setFichier(null)} />}
        </div>
      )}

      <div className="flex items-end gap-2">
        {enregistre ? (
          <div className="flex min-h-[48px] flex-1 items-center gap-3 rounded-3xl bg-creme px-4" aria-live="polite">
            <span className="h-3 w-3 shrink-0 animate-direct rounded-full bg-direct" aria-hidden="true" />
            <span className="font-mono text-base font-bold tabular-nums">{enreg.etat === "demande" ? "Micro…" : dureeCourte(enreg.secondes)}</span>
            {mode === "maintien" ? (
              <span className="ml-auto flex items-center gap-1 text-sm text-texte-pale" style={{ transform: `translateX(${glisse / 2}px)` }}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                {selonRole(p.role, "Glisse pour annuler", "Glissez pour annuler")}
              </span>
            ) : (
              <button type="button" onClick={annulerVocal} className="ml-auto flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-danger hover:bg-white">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Annuler
              </button>
            )}
          </div>
        ) : (
          <>
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger asChild>
                <button type="button" className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-texte-doux hover:bg-creme hover:text-encre" aria-label="Joindre une photo ou un document">
                  <Paperclip className="h-6 w-6" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content side="top" align="start" sideOffset={8} className="z-50 min-w-[230px] rounded-2xl border border-ligne bg-white p-1.5 shadow-carte animate-apparait">
                  <DropdownMenu.Item
                    onSelect={() => entreePhoto.current?.click()}
                    className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl px-3 text-[15px] font-semibold outline-none data-[highlighted]:bg-creme"
                  >
                    <Camera className="h-5 w-5 text-orange-fonce" /> Photo
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    onSelect={() => entreeDocument.current?.click()}
                    className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl px-3 text-[15px] font-semibold outline-none data-[highlighted]:bg-creme"
                  >
                    <FileText className="h-5 w-5 text-orange-fonce" /> Document (PDF, Word…)
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <input ref={entreePhoto} type="file" accept="image/*" className="hidden" onChange={(e) => (choisir(e.target.files?.[0]), (e.target.value = ""))} />
            <input ref={entreeDocument} type="file" accept={TYPES_DOCUMENTS} className="hidden" onChange={(e) => (choisir(e.target.files?.[0]), (e.target.value = ""))} />
            <label className="flex min-h-[48px] flex-1 items-center rounded-3xl border border-ligne bg-creme px-4 focus-within:border-orange focus-within:bg-white focus-within:ring-2 focus-within:ring-orange/20">
              <span className="sr-only">{placeholder}</span>
              <textarea
                ref={zone}
                value={texte}
                rows={1}
                maxLength={4000}
                onChange={(e) => surFrappe(e.target.value)}
                onKeyDown={(e) => {
                  if (p.entreeEnvoie && e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    envoyer();
                  }
                }}
                placeholder={fichier ? selonRole(p.role, "Ajoute une légende (facultatif)", "Ajoutez une légende (facultatif)") : placeholder}
                className="max-h-[150px] w-full resize-none bg-transparent py-3 text-base leading-snug text-encre outline-none placeholder:text-texte-gris focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </label>
          </>
        )}

        {aEnvoyer || !vocalPossible || mode === "verrouille" ? (
          <button
            type="button"
            onClick={() => (mode === "verrouille" ? void finirVocal() : envoyer())}
            disabled={!aEnvoyer && mode !== "verrouille"}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-orange text-encre transition-colors hover:bg-encre hover:text-white disabled:opacity-40"
            aria-label={mode === "verrouille" ? "Envoyer la note vocale" : "Envoyer"}
          >
            <SendHorizontal className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            className={cn(
              "grid h-12 w-12 shrink-0 touch-none select-none place-items-center rounded-full transition-all",
              mode === "maintien" ? "scale-125 bg-direct text-white" : "bg-orange text-encre hover:bg-encre hover:text-white",
            )}
            aria-label={selonRole(p.role, "Note vocale : maintiens pour parler, ou touche pour enregistrer", "Note vocale : maintenez pour parler, ou touchez pour enregistrer")}
            onPointerDown={(e) => {
              if (e.pointerType === "mouse" && e.button !== 0) return;
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              appuiDebut.current = Date.now();
              departX.current = e.clientX;
              setGlisse(0);
              void commencerVocal("maintien");
            }}
            onPointerMove={(e) => {
              if (mode !== "maintien") return;
              const dx = e.clientX - departX.current;
              setGlisse(Math.min(0, dx));
              if (dx < -90) {
                annulerVocal();
                toast("Note vocale annulée.", "info");
              }
            }}
            onPointerUp={() => {
              if (mode !== "maintien") return;
              // Simple toucher (ou autorisation du micro en cours) : l'enregistrement continue,
              // on enverra avec le bouton « Envoyer ».
              if (Date.now() - appuiDebut.current < 450 || enreg.etat === "demande") setMode("verrouille");
              else void finirVocal();
            }}
            onPointerCancel={() => mode === "maintien" && setMode("verrouille")}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !mode) {
                e.preventDefault();
                void commencerVocal("verrouille");
              }
            }}
          >
            <Mic className="h-6 w-6" />
          </button>
        )}
      </div>
      {!enregistre && !texte && !fichier && etudiant && p.salon && (
        <p className="mt-1.5 px-1 text-[13px] text-texte-gris">Ta question et ton nom sont visibles par tous les inscrits du cours.</p>
      )}
    </div>
  );
});
