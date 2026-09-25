// Fil d'une conversation : en-tête, bulles regroupées par jour, envoi par la
// file d'envoi hors ligne (bulle « En attente de réseau »), temps réel tant
// que l'écran est visible, marquage lu (✓✓ chez l'autre), chargement des plus
// anciens en remontant, modération du salon (retirer, signaler).
//
// Sur téléphone, le fil occupe tout l'écran (comme WhatsApp : la barre
// d'onglets s'efface) et suit la zone visible quand le clavier s'ouvre.
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowLeft, MoreVertical, Bell, BellOff, BookOpen, FolderOpen, UsersRound, ArrowDown, Loader2, WifiOff, X, Download, ShieldCheck } from "lucide-react";
import { get, post, suppr, ErreurApi } from "@/lib/api";
import { useMoiConnecte } from "@/lib/auth";
import { useCanal } from "@/lib/flux";
import { queryClient, rafraichir } from "@/lib/queryClient";
import { envoyerOuMettreEnFile, useFileEnvoi, type ElementFile } from "@/lib/file-envoi";
import { maintenantServeur } from "@/lib/horloge";
import { useMaintenant } from "@/components/ui/compte-a-rebours";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { Chargement, EtatVide, Squelette } from "@/components/ui/divers";
import { Fenetre } from "@/components/ui/fenetre";
import { toast, toastErreur } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { CitationMessage, ConversationDetail, MessageDto, PageMessages } from "@shared/schema";
import { AvatarConversation } from "./AvatarConversation";
import { Bulle, BulleEnAttente, type EnvoiLocal } from "./Bulle";
import { Composeur, type ContenuEnvoi, type PoigneeComposeur } from "./Composeur";
import { libelleJour, majLigneListe, memeJour, nouvelleCle, rafraichirListe, selonRole, useOngletVisible, useZoneVisible } from "../outils";

const DELAI_SUPPRESSION_MS = 10 * 60_000;
const CINQ_MINUTES = 5 * 60_000;

// ── État du fil ────────────────────────────────────────────────────────────

type EtatFil = {
  /** Messages du serveur, du plus ancien au plus récent. */
  messages: MessageDto[];
  plusAnciens: boolean;
  /** Des pages plus anciennes ont été chargées à la main. */
  anciensCharges: boolean;
  luJusquAAutre: string | null;
};

type ActionFil =
  | { type: "page"; page: PageMessages }
  | { type: "anciens"; page: PageMessages }
  | { type: "message"; message: MessageDto }
  | { type: "maj"; id: number; maj: Partial<MessageDto> }
  | { type: "supprime"; id: number; parModeration: boolean }
  | { type: "lu"; luJusquA: string };

function fusionner(liste: MessageDto[], nouveaux: MessageDto[]): MessageDto[] {
  const carte = new Map(liste.map((m) => [m.id, m]));
  for (const m of nouveaux) carte.set(m.id, m);
  return [...carte.values()].sort((a, b) => a.id - b.id);
}

const plusRecent = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

function etatDepuis(page: PageMessages | undefined): EtatFil {
  return { messages: page?.messages ?? [], plusAnciens: page?.plusAnciens ?? false, anciensCharges: false, luJusquAAutre: page?.luJusquAAutre ?? null };
}

function reducteur(s: EtatFil, a: ActionFil): EtatFil {
  switch (a.type) {
    case "page": {
      const dernier = s.messages[s.messages.length - 1];
      const premierRecu = a.page.messages[0];
      // Longue absence : la page reçue ne touche plus ce qu'on avait. On repart d'elle (pas de trou dans le fil).
      if (dernier && premierRecu && a.page.plusAnciens && premierRecu.id > dernier.id) return etatDepuis(a.page);
      return {
        ...s,
        messages: fusionner(s.messages, a.page.messages),
        plusAnciens: s.anciensCharges ? s.plusAnciens : a.page.plusAnciens,
        luJusquAAutre: plusRecent(s.luJusquAAutre, a.page.luJusquAAutre),
      };
    }
    case "anciens":
      return { ...s, messages: fusionner(s.messages, a.page.messages), plusAnciens: a.page.plusAnciens, anciensCharges: true };
    case "message":
      return { ...s, messages: fusionner(s.messages, [a.message]) };
    case "maj":
      return { ...s, messages: s.messages.map((m) => (m.id === a.id ? { ...m, ...a.maj } : m)) };
    case "supprime":
      return {
        ...s,
        messages: s.messages.map((m) =>
          m.id === a.id
            ? { ...m, supprime: true, retireParModeration: a.parModeration, texte: "", contexte: null, fichier: null, reponseA: null, dureeSecondes: null }
            : m.reponseA?.id === a.id
              ? { ...m, reponseA: { ...m.reponseA, supprime: true, extrait: "" } }
              : m,
        ),
      };
    case "lu":
      return { ...s, luJusquAAutre: plusRecent(s.luJusquAAutre, a.luJusquA) };
  }
}

/** Message rangé dans la file d'envoi (après un rechargement de la page, par exemple). */
function depuisFile(el: ElementFile): EnvoiLocal {
  const f = el.fichiers?.[0];
  const corps = el.corps as { texte?: string; contexte?: string | null; dureeSecondes?: number | null };
  return {
    cle: el.cle,
    texte: corps.texte ?? "",
    contexte: corps.contexte ?? null,
    reponseA: null,
    fichier: f ? new File([f.blob], f.nom, { type: f.type }) : null,
    apercuUrl: null,
    dureeSecondes: corps.dureeSecondes ?? null,
    creeLe: el.creeLe,
    etat: "attente",
  };
}

function useEnLigne() {
  const [enLigne, setEnLigne] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const on = () => setEnLigne(true);
    const off = () => setEnLigne(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return enLigne;
}

/** Phrases toutes faites : pas de page blanche pour un étudiant qui n'ose pas écrire. */
function suggestions(d: ConversationDetail): string[] {
  if (d.type !== "direct" || !d.interlocuteur) return [];
  if (d.interlocuteur.role === "formateur") {
    return ["Bonjour, je n'ai pas compris la consigne.", "Je n'arrive pas à ouvrir le fichier.", "Je serai absent(e) au prochain cours.", "Merci pour le cours !"];
  }
  if (d.interlocuteur.role === "vie_scolaire") {
    return ["Bonjour, j'ai oublié mon code secret.", "Je voudrais justifier une absence.", "J'ai un problème avec mon compte."];
  }
  return [];
}

// ── Visionneuse de photo ───────────────────────────────────────────────────

function Visionneuse({ photo, onFermer }: { photo: { url: string; nom: string } | null; onFermer: () => void }) {
  useEffect(() => {
    if (!photo) return;
    const touche = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [photo, onFermer]);
  if (!photo) return null;
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/95 animate-apparait" role="dialog" aria-modal="true" aria-label="Photo">
      <div className="flex items-center justify-end gap-2 p-3">
        <a
          href={`${photo.url}?telecharger=1`}
          download={photo.nom}
          className="flex h-12 items-center gap-2 rounded-full px-4 text-[15px] font-bold text-white no-underline hover:bg-white/10 hover:text-white"
        >
          <Download className="h-5 w-5" aria-hidden="true" />
          Télécharger
        </a>
        <button type="button" onClick={onFermer} className="grid h-12 w-12 place-items-center rounded-full text-white hover:bg-white/10" aria-label="Fermer la photo">
          <X className="h-6 w-6" />
        </button>
      </div>
      <button type="button" onClick={onFermer} className="flex min-h-0 flex-1 items-center justify-center p-4" aria-label="Fermer la photo">
        <img src={photo.url} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
      </button>
    </div>
  );
}

// ── En-tête ────────────────────────────────────────────────────────────────

function EnTeteFil({
  d,
  mobile,
  saisie,
  estEquipe,
  enErreur = false,
}: {
  d: ConversationDetail | undefined;
  mobile: boolean;
  saisie: string | null;
  estEquipe: boolean;
  enErreur?: boolean;
}) {
  const [, naviguer] = useLocation();
  const [sourdine, setSourdine] = useState<boolean | null>(null);
  const muet = sourdine ?? d?.sourdine ?? false;

  async function basculerSourdine() {
    if (!d) return;
    try {
      await post(`/api/conversations/${d.id}/sourdine`, { sourdine: !muet });
      setSourdine(!muet);
      majLigneListe(d.id, { sourdine: !muet });
      toast(!muet ? "Alertes coupées pour cette conversation." : "Alertes réactivées.");
    } catch (e) {
      toastErreur(e);
    }
  }

  const sousTitre = saisie
    ? `${saisie} écrit…`
    : d?.type === "cours"
      ? `Questions du cours${d.nbCampus ? ` · ${d.nbCampus} campus` : ""}`
      : d?.sousTitre;

  return (
    <header className="flex min-h-[64px] shrink-0 items-center gap-2 border-b border-ligne-douce bg-white px-2 py-2 sm:px-4">
      {mobile && (
        <button
          type="button"
          onClick={() => naviguer("/messages")}
          className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-encre hover:bg-creme"
          aria-label="Revenir à mes conversations"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
      )}
      {d ? (
        <>
          <AvatarConversation interlocuteur={d.interlocuteur} cours={d.cours} taille={44} />
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="truncate text-[17px] font-extrabold leading-tight tracking-[-0.01em]">{d.type === "cours" ? d.cours?.titre : d.titre}</h2>
            <p className={cn("truncate text-[13px]", saisie ? "font-semibold text-orange-fonce" : "text-texte-pale")} aria-live="polite">
              {sousTitre}
            </p>
          </div>
          {muet && <BellOff className="h-4 w-4 shrink-0 text-texte-gris" aria-label="Alertes coupées" />}
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger asChild>
              <button type="button" className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-texte-doux hover:bg-creme hover:text-encre" aria-label="Options de la conversation">
                <MoreVertical className="h-5 w-5" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-[240px] rounded-2xl border border-ligne bg-white p-1.5 shadow-carte animate-apparait">
                <DropdownMenu.Item
                  onSelect={() => void basculerSourdine()}
                  className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl px-3 text-[15px] font-semibold outline-none data-[highlighted]:bg-creme"
                >
                  {muet ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                  {muet ? "Réactiver les alertes" : "Couper les alertes"}
                </DropdownMenu.Item>
                {d.cours && (
                  <DropdownMenu.Item
                    onSelect={() => naviguer(`/cours/${d.cours!.id}`)}
                    className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl px-3 text-[15px] font-semibold outline-none data-[highlighted]:bg-creme"
                  >
                    <BookOpen className="h-4 w-4" /> Voir le cours
                  </DropdownMenu.Item>
                )}
                {estEquipe && d.interlocuteur?.role === "etudiant" && (
                  <DropdownMenu.Item
                    onSelect={() => naviguer(`/pilotage/etudiants/${d.interlocuteur!.id}`)}
                    className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl px-3 text-[15px] font-semibold outline-none data-[highlighted]:bg-creme"
                  >
                    <FolderOpen className="h-4 w-4" /> Dossier de l'étudiant
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </>
      ) : enErreur ? (
        <h2 className="flex-1 px-2 text-[17px] font-extrabold">Messages</h2>
      ) : (
        <div className="flex flex-1 items-center gap-3">
          <Squelette className="h-11 w-11 rounded-full" />
          <div className="flex flex-col gap-1.5">
            <Squelette className="h-4 w-40" />
            <Squelette className="h-3 w-24" />
          </div>
        </div>
      )}
    </header>
  );
}

// ── Le fil ─────────────────────────────────────────────────────────────────

export function FilConversation({ id, mobile, contexteInitial }: { id: number; mobile: boolean; contexteInitial: string | null }) {
  const moi = useMoiConnecte();
  const [, naviguer] = useLocation();
  const visible = useOngletVisible();
  const enLigne = useEnLigne();
  const maintenant = useMaintenant(30_000);
  const zoneVisible = useZoneVisible();
  const urlMessages = `/api/conversations/${id}/messages`;

  const detailQ = useQuery<ConversationDetail>({ queryKey: [`/api/conversations/${id}`] });
  const pageQ = useQuery<PageMessages>({ queryKey: [urlMessages] });
  const d = detailQ.data;
  const erreur = (detailQ.error ?? pageQ.error) as Error | null;
  const salon = d?.type === "cours";
  const etudiant = moi.role === "etudiant";
  const estEquipe = moi.role === "admin" || moi.role === "vie_scolaire";

  // Démarre directement sur la dernière page connue (retour dans une conversation : rien ne clignote).
  const [etat, dispatch] = useReducer(reducteur, undefined, () => etatDepuis(queryClient.getQueryData<PageMessages>([urlMessages])));
  useEffect(() => {
    if (pageQ.data) dispatch({ type: "page", page: pageQ.data });
  }, [pageQ.data]);

  const [locaux, setLocaux] = useState<EnvoiLocal[]>([]);
  const file = useFileEnvoi();
  const [reponseA, setReponseA] = useState<CitationMessage | null>(null);
  const [contexte, setContexte] = useState<string | null>(contexteInitial);
  const [saisie, setSaisie] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<MessageDto | null>(null);
  const [aSignaler, setASignaler] = useState<MessageDto | null>(null);
  const [motif, setMotif] = useState("");
  const [action, setAction] = useState(false);
  const [photo, setPhoto] = useState<{ url: string; nom: string } | null>(null);
  const [surligne, setSurligne] = useState<number | null>(null);
  const [nouveaux, setNouveaux] = useState(0);
  const [chargeAnciens, setChargeAnciens] = useState(false);
  const [annonce, setAnnonce] = useState("");

  const zone = useRef<HTMLDivElement>(null);
  const contenu = useRef<HTMLDivElement>(null);
  const sentinelle = useRef<HTMLDivElement>(null);
  const composeur = useRef<PoigneeComposeur>(null);
  const presDuBas = useRef(true);
  const ancrage = useRef<{ hauteur: number; haut: number } | null>(null);
  const premierAffichage = useRef(true);
  const marque = useRef(0);
  const minuterieSaisie = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const apercusFile = useRef(new Map<string, string>());

  // Téléphone : la page derrière le fil ne défile pas.
  useEffect(() => {
    if (!mobile) return;
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = avant;
    };
  }, [mobile]);

  // Libère les aperçus de photos à la sortie.
  useEffect(() => {
    const apercus = apercusFile.current;
    return () => {
      for (const u of apercus.values()) URL.revokeObjectURL(u);
    };
  }, []);

  // ── Bulles en attente : envois en cours + file d'envoi hors ligne ────────
  const majLocal = useCallback((cle: string, maj: Partial<EnvoiLocal>) => setLocaux((l) => l.map((e) => (e.cle === cle ? { ...e, ...maj } : e))), []);
  const retirerLocal = useCallback((cle: string) => {
    setLocaux((l) => {
      const e = l.find((x) => x.cle === cle);
      if (e?.apercuUrl) URL.revokeObjectURL(e.apercuUrl);
      return l.filter((x) => x.cle !== cle);
    });
  }, []);

  const enAttente = useMemo(() => {
    const clesServeur = new Set(etat.messages.map((m) => m.cle).filter(Boolean));
    const liste = [...locaux];
    for (const el of file) {
      if (el.url !== urlMessages || liste.some((l) => l.cle === el.cle)) continue;
      const e = depuisFile(el);
      if (e.fichier?.type.startsWith("image/")) {
        let u = apercusFile.current.get(el.cle);
        if (!u) apercusFile.current.set(el.cle, (u = URL.createObjectURL(e.fichier)));
        e.apercuUrl = u;
      }
      liste.push(e);
    }
    return liste.filter((e) => !clesServeur.has(e.cle)).sort((a, b) => a.creeLe - b.creeLe);
  }, [locaux, file, etat.messages, urlMessages]);

  // La file d'envoi a fini par envoyer (ou a essuyé un refus) pendant que le fil est ouvert.
  useEffect(() => {
    const reussi = (ev: Event) => {
      const { cle, reponse } = (ev as CustomEvent<{ cle: string; reponse: unknown }>).detail;
      const m = reponse as MessageDto | undefined;
      if (m && typeof m === "object" && m.conversationId === id) {
        dispatch({ type: "message", message: m });
        rafraichirListe();
      }
      retirerLocal(cle);
    };
    const refuse = (ev: Event) => {
      const { cle, message } = (ev as CustomEvent<{ cle: string; message: string }>).detail;
      majLocal(cle, { etat: "refuse", erreur: message });
    };
    window.addEventListener("campus:envoi-reussi", reussi);
    window.addEventListener("campus:envoi-refuse", refuse);
    return () => {
      window.removeEventListener("campus:envoi-reussi", reussi);
      window.removeEventListener("campus:envoi-refuse", refuse);
    };
  }, [id, majLocal, retirerLocal]);

  // ── Envoi ────────────────────────────────────────────────────────────────
  const envoyer = useCallback(
    async (c: ContenuEnvoi, repris?: EnvoiLocal) => {
      const cle = nouvelleCle();
      const local: EnvoiLocal = {
        cle,
        texte: c.texte,
        contexte: repris ? repris.contexte : contexte,
        reponseA: repris ? repris.reponseA : reponseA,
        fichier: c.fichier,
        apercuUrl: c.fichier?.type.startsWith("image/") ? URL.createObjectURL(c.fichier) : null,
        dureeSecondes: c.dureeSecondes,
        creeLe: Date.now(),
        etat: "envoi",
      };
      setLocaux((l) => [...l, local]);
      if (!repris) {
        setReponseA(null);
        if (contexte) {
          setContexte(null);
          naviguer(`/messages/${id}`, { replace: true });
        }
      }
      presDuBas.current = true;
      try {
        const r = await envoyerOuMettreEnFile<MessageDto>({
          cle,
          description: d ? (d.type === "cours" ? `Question · ${d.cours?.code ?? "salon"}` : `Message à ${d.titre}`) : "Message",
          url: urlMessages,
          methode: "POST",
          corps: { texte: c.texte, cle, contexte: local.contexte, reponseAId: local.reponseA?.id ?? null, dureeSecondes: c.dureeSecondes },
          fichiers: c.fichier ? [c.fichier] : undefined,
          usageFichiers: "message",
          champFichiers: "fichierId",
        });
        if (r.statut === "envoye") {
          dispatch({ type: "message", message: r.reponse });
          retirerLocal(cle);
          rafraichirListe();
        } else {
          majLocal(cle, { etat: "attente" });
        }
      } catch (e) {
        majLocal(cle, { etat: "refuse", erreur: e instanceof Error ? e.message : String(e) });
      }
    },
    [contexte, reponseA, d, id, urlMessages, naviguer, majLocal, retirerLocal],
  );

  // ── Temps réel (seulement quand l'écran est visible) ─────────────────────
  useCanal(visible && d ? `conv:${id}` : null, (e) => {
    if (e.type === "message") {
      const m = e.data as MessageDto;
      if (m.conversationId !== id) return;
      if (m.auteur.id !== moi.id) {
        if (!presDuBas.current) setNouveaux((n) => n + 1);
        setSaisie(null);
        setAnnonce(`Nouveau message de ${m.auteur.prenom} ${m.auteur.nom} : ${m.texte || (m.type === "audio" ? "note vocale" : m.type === "photo" ? "photo" : "fichier")}`);
      }
      dispatch({ type: "message", message: m });
      if (m.cle) retirerLocal(m.cle);
    } else if (e.type === "supprime") {
      dispatch({ type: "supprime", id: e.data.id, parModeration: e.data.parModeration });
    } else if (e.type === "lu") {
      if (e.data.utilisateurId !== moi.id) dispatch({ type: "lu", luJusquA: e.data.luJusquA });
    } else if (e.type === "saisie") {
      if (e.data.utilisateurId === moi.id) return;
      setSaisie(e.data.prenom);
      clearTimeout(minuterieSaisie.current);
      minuterieSaisie.current = setTimeout(() => setSaisie(null), 4500);
    }
  });
  useEffect(() => () => clearTimeout(minuterieSaisie.current), []);

  // Retour sur l'onglet : on rattrape ce qui s'est passé pendant l'absence.
  const dejaVisible = useRef(visible);
  const { refetch: rechargerPage } = pageQ;
  const { refetch: rechargerDetail } = detailQ;
  useEffect(() => {
    if (visible && !dejaVisible.current) {
      void rechargerPage();
      void rechargerDetail();
    }
    dejaVisible.current = visible;
  }, [visible, rechargerPage, rechargerDetail]);

  // ── Marquer comme lu ─────────────────────────────────────────────────────
  const dernierAutre = useMemo(() => {
    for (let i = etat.messages.length - 1; i >= 0; i--) if (etat.messages[i].auteur.id !== moi.id) return etat.messages[i];
    return undefined;
  }, [etat.messages, moi.id]);

  useEffect(() => {
    if (!visible || !dernierAutre || marque.current >= dernierAutre.id) return;
    marque.current = dernierAutre.id;
    post(`/api/conversations/${id}/lu`, { messageId: dernierAutre.id })
      .then(() => {
        majLigneListe(id, { nonLus: 0 });
        void rafraichir("/api/notifications");
      })
      .catch(() => {
        marque.current = 0;
      });
  }, [visible, dernierAutre, id]);

  // ── Défilement ───────────────────────────────────────────────────────────
  const surDefilement = () => {
    const z = zone.current;
    if (!z) return;
    presDuBas.current = z.scrollHeight - z.scrollTop - z.clientHeight < 150;
    if (presDuBas.current && nouveaux) setNouveaux(0);
  };

  const allerEnBas = useCallback(() => {
    const z = zone.current;
    if (z) z.scrollTop = z.scrollHeight;
    presDuBas.current = true;
    setNouveaux(0);
  }, []);

  useLayoutEffect(() => {
    const z = zone.current;
    if (!z) return;
    if (ancrage.current) {
      // Des messages plus anciens viennent d'être ajoutés en haut : on garde la lecture en place.
      z.scrollTop = z.scrollHeight - ancrage.current.hauteur + ancrage.current.haut;
      ancrage.current = null;
      return;
    }
    if (premierAffichage.current) {
      if (etat.messages.length || enAttente.length) {
        z.scrollTop = z.scrollHeight;
        premierAffichage.current = false;
      }
      return;
    }
    if (presDuBas.current) z.scrollTop = z.scrollHeight;
  }, [etat.messages, enAttente.length, saisie]);

  // La zone change de taille (clavier, zone de saisie qui grandit, photo chargée, en-tête arrivé) :
  // si on lisait le bas du fil, on y reste.
  useEffect(() => {
    const z = zone.current;
    const c = contenu.current;
    if (!z || !c || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (presDuBas.current && !ancrage.current) z.scrollTop = z.scrollHeight;
    });
    ro.observe(z);
    ro.observe(c);
    return () => ro.disconnect();
  }, [erreur === null]);

  const chargerAnciens = useCallback(async () => {
    const premier = etat.messages[0];
    if (chargeAnciens || !etat.plusAnciens || !premier) return;
    setChargeAnciens(true);
    try {
      const page = await get<PageMessages>(`${urlMessages}?avant=${premier.id}`);
      const z = zone.current;
      if (z) ancrage.current = { hauteur: z.scrollHeight, haut: z.scrollTop };
      dispatch({ type: "anciens", page });
    } catch (e) {
      toastErreur(e);
    } finally {
      setChargeAnciens(false);
    }
  }, [chargeAnciens, etat.messages, etat.plusAnciens, urlMessages]);

  // En remontant tout en haut, les messages plus anciens se chargent tout seuls.
  useEffect(() => {
    const s = sentinelle.current;
    if (!s || !etat.plusAnciens) return;
    const io = new IntersectionObserver((entrees) => entrees.some((x) => x.isIntersecting) && void chargerAnciens(), { root: zone.current, rootMargin: "200px 0px 0px 0px" });
    io.observe(s);
    return () => io.disconnect();
  }, [etat.plusAnciens, chargerAnciens, erreur === null]);

  function voirMessage(idCite: number) {
    const el = document.getElementById(`message-${idCite}`);
    if (!el) {
      toast(selonRole(moi.role, "Ce message est plus ancien : remonte le fil pour le retrouver.", "Ce message est plus ancien : remontez le fil pour le retrouver."), "info");
      return;
    }
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setSurligne(idCite);
    setTimeout(() => setSurligne(null), 1600);
  }

  // ── Modération et suppression ────────────────────────────────────────────
  async function confirmerSuppression() {
    if (!aSupprimer) return;
    setAction(true);
    try {
      await suppr(`/api/messages/${aSupprimer.id}`);
      dispatch({ type: "supprime", id: aSupprimer.id, parModeration: aSupprimer.auteur.id !== moi.id });
      toast(aSupprimer.auteur.id === moi.id ? "Message supprimé." : "Message retiré du salon.");
      setASupprimer(null);
      rafraichirListe();
    } catch (e) {
      toastErreur(e);
    } finally {
      setAction(false);
    }
  }

  async function confirmerSignalement() {
    if (!aSignaler) return;
    setAction(true);
    try {
      await post(`/api/messages/${aSignaler.id}/signaler`, { motif: motif.trim() || null });
      dispatch({ type: "maj", id: aSignaler.id, maj: { signaleParMoi: true } });
      toast(salon ? "Merci. Le formateur et la vie scolaire sont prévenus." : "Merci. La vie scolaire est prévenue.");
      setASignaler(null);
      setMotif("");
    } catch (e) {
      toastErreur(e);
    } finally {
      setAction(false);
    }
  }

  // ── Rendu ────────────────────────────────────────────────────────────────
  const vide = !etat.messages.length && !enAttente.length;
  const phrases = d && etudiant ? suggestions(d) : [];

  const conteneur = cn("flex flex-col bg-white", mobile ? "fixed inset-x-0 top-0 z-40" : "h-full min-h-0");
  const style = mobile ? { height: zoneVisible ? `${zoneVisible.hauteur}px` : "100dvh", transform: zoneVisible?.haut ? `translateY(${zoneVisible.haut}px)` : undefined } : undefined;

  if (erreur) {
    const statut = erreur instanceof ErreurApi ? erreur.statut : 0;
    return (
      <div className={conteneur} style={style}>
        <EnTeteFil d={undefined} mobile={mobile} saisie={null} estEquipe={estEquipe} enErreur />
        <div className="flex flex-1 items-center justify-center p-6">
          <EtatVide
            titre={statut === 404 ? "Conversation introuvable" : statut === 403 ? "Conversation réservée" : "Impossible d'ouvrir la conversation"}
            texte={
              statut === 404
                ? selonRole(moi.role, "Elle n'existe pas, ou elle ne te concerne pas.", "Elle n'existe pas, ou elle ne vous concerne pas.")
                : erreur.message
            }
            action={
              statut === 0 || statut >= 500 ? (
                <Bouton onClick={() => (void detailQ.refetch(), void pageQ.refetch())}>Réessayer</Bouton>
              ) : (
                <LienBouton href="/messages">Revenir à mes messages</LienBouton>
              )
            }
          />
        </div>
      </div>
    );
  }

  // Bulles regroupées par jour, puis par auteur (5 minutes).
  const elements: JSX.Element[] = [];
  etat.messages.forEach((m, i) => {
    const precedent = etat.messages[i - 1];
    if (!precedent || !memeJour(precedent.creeLe, m.creeLe)) {
      elements.push(
        <div key={`jour-${m.id}`} className="my-3 flex justify-center">
          <span className="rounded-full bg-white/95 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-texte-pale shadow-sm ring-1 ring-ligne-douce">
            {libelleJour(m.creeLe, maintenant)}
          </span>
        </div>,
      );
    }
    const suite =
      Boolean(precedent) &&
      precedent.auteur.id === m.auteur.id &&
      memeJour(precedent.creeLe, m.creeLe) &&
      new Date(m.creeLe).getTime() - new Date(precedent.creeLe).getTime() < CINQ_MINUTES &&
      !m.contexte;
    const deMoi = m.auteur.id === moi.id;
    elements.push(
      <Bulle
        key={m.id}
        message={m}
        deMoi={deMoi}
        salon={salon}
        lu={!salon && deMoi && Boolean(etat.luJusquAAutre && new Date(etat.luJusquAAutre).getTime() >= new Date(m.creeLe).getTime())}
        suite={suite}
        moderateur={Boolean(d?.peutModerer)}
        peutSupprimer={(deMoi && maintenantServeur() - new Date(m.creeLe).getTime() < DELAI_SUPPRESSION_MS) || (salon && Boolean(d?.peutModerer))}
        donneesReduites={Boolean(moi.preferences?.donneesReduites)}
        surligne={surligne === m.id}
        onRepondre={() => {
          setReponseA({
            id: m.id,
            auteurId: m.auteur.id,
            auteur: deMoi ? selonRole(moi.role, "Toi", "Vous") : `${m.auteur.prenom} ${m.auteur.nom}`,
            type: m.type,
            extrait: m.texte || (m.type === "photo" ? "Photo" : m.type === "audio" ? "Note vocale" : m.fichier?.nom ?? ""),
            supprime: false,
          });
          composeur.current?.focus();
        }}
        onSupprimer={() => setASupprimer(m)}
        onSignaler={() => setASignaler(m)}
        onCitation={voirMessage}
        onVoirPhoto={(url, nom) => setPhoto({ url, nom })}
        moi={{ id: moi.id, libelle: selonRole(moi.role, "Toi", "Vous") }}
        onMediaCharge={() => {
          const z = zone.current;
          if (z && presDuBas.current) z.scrollTop = z.scrollHeight;
        }}
      />,
    );
  });

  return (
    <div className={conteneur} style={style}>
      <EnTeteFil d={d} mobile={mobile} saisie={saisie} estEquipe={estEquipe} />
      {!enLigne && (
        <div className="flex shrink-0 items-center justify-center gap-2 bg-encre px-4 py-2 text-center text-[13px] font-semibold text-white" role="status">
          <WifiOff className="h-4 w-4 shrink-0 text-orange" aria-hidden="true" />
          {selonRole(moi.role, "Pas de réseau : tes messages partiront tout seuls au retour de la connexion.", "Pas de réseau : vos messages partiront tout seuls au retour de la connexion.")}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {/* Lecteurs d'écran : seul le message qui arrive est annoncé, pas tout le fil au chargement. */}
        <p className="sr-only" aria-live="polite">
          {annonce}
        </p>
        <div ref={zone} onScroll={surDefilement} className="defile-fin absolute inset-0 overflow-y-auto overscroll-contain bg-creme px-3 pb-4 sm:px-5">
          {/* Comme sur WhatsApp : peu de messages ? Ils se posent en bas, près de la zone de saisie. */}
          <div ref={contenu} className="flex min-h-full flex-col justify-end">
            <div ref={sentinelle} />
            {etat.plusAnciens && (
              <div className="flex justify-center py-3">
                <button
                  type="button"
                  onClick={() => void chargerAnciens()}
                  disabled={chargeAnciens}
                  className="flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-texte-doux ring-1 ring-ligne hover:text-encre"
                >
                  {chargeAnciens && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Messages plus anciens
                </button>
              </div>
            )}

            {!etat.plusAnciens && d && (
              <div className="mx-auto mb-2 mt-4 max-w-md">
                {salon ? (
                  <div className="rounded-2xl bg-white p-4 text-center ring-1 ring-ligne-douce">
                    <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-orange-clair text-orange-fonce">
                      <UsersRound className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <p className="text-[15px] font-extrabold">Questions du cours · {d.cours?.code}</p>
                    <p className="mt-1 text-sm leading-relaxed text-texte-pale">
                      {etudiant
                        ? "Tous les inscrits voient les questions et les réponses du formateur. Le formateur modère ce salon : reste courtois, une question à la fois."
                        : "Les étudiants y posent leurs questions à toute la classe. Répondez en citant la question (appui long ou menu d'un message) ; vous pouvez retirer un message."}
                    </p>
                    {d.peutModerer && (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-encre px-3 py-1 font-mono text-[11px] text-white">
                        <ShieldCheck className="h-3.5 w-3.5 text-orange" aria-hidden="true" /> Vous modérez ce salon
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-center font-mono text-[11px] uppercase tracking-wider text-texte-gris">
                    Début de la conversation avec {d.interlocuteur ? `${d.interlocuteur.prenom} ${d.interlocuteur.nom}` : d.titre}
                  </p>
                )}
              </div>
            )}

            {pageQ.isLoading && !etat.messages.length && <Chargement lignes={4} className="mt-6" />}

            {!pageQ.isLoading && vide && d && (
              <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-3 text-center">
                <p className="text-lg font-extrabold">
                  {salon
                    ? selonRole(moi.role, "Aucune question pour l'instant", "Aucune question pour l'instant")
                    : selonRole(moi.role, `Écris ton premier message à ${d.interlocuteur?.prenom ?? d.titre}`, `Écrivez votre premier message à ${d.interlocuteur?.prenom ?? d.titre}`)}
                </p>
                <p className="text-[15px] text-texte-pale">
                  {salon
                    ? selonRole(moi.role, "Sois le premier à demander : ta question aide aussi les autres.", "Les questions des étudiants apparaîtront ici.")
                    : selonRole(moi.role, "Comme sur WhatsApp : texte, photo, document ou note vocale (maintiens le micro).", "Texte, photo, document ou note vocale (maintenez le micro).")}
                </p>
                {phrases.length > 0 && (
                  <div className="mt-1 flex flex-wrap justify-center gap-2">
                    {phrases.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => composeur.current?.remplir(t)}
                        className="min-h-[44px] rounded-full bg-white px-4 py-2 text-[15px] font-semibold text-encre ring-1 ring-ligne hover:bg-orange-clair hover:ring-orange"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {elements}

            {enAttente.map((e) => (
              <BulleEnAttente
                key={e.cle}
                e={e}
                onReessayer={() => {
                  retirerLocal(e.cle);
                  void envoyer({ texte: e.texte, fichier: e.fichier, dureeSecondes: e.dureeSecondes }, e);
                }}
                onRetirer={() => retirerLocal(e.cle)}
              />
            ))}

            {saisie && (
              <div className="mt-2 flex">
                <span className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white px-4 py-3 ring-1 ring-ligne-douce" aria-label={`${saisie} écrit`}>
                  <span className="h-2 w-2 animate-direct rounded-full bg-texte-gris" />
                  <span className="h-2 w-2 animate-direct rounded-full bg-texte-gris [animation-delay:0.2s]" />
                  <span className="h-2 w-2 animate-direct rounded-full bg-texte-gris [animation-delay:0.4s]" />
                </span>
              </div>
            )}
          </div>
        </div>

        {nouveaux > 0 && (
          <button
            type="button"
            onClick={allerEnBas}
            className="absolute bottom-3 left-1/2 z-10 flex h-11 -translate-x-1/2 items-center gap-2 rounded-full bg-encre px-4 text-sm font-bold text-white shadow-carte hover:bg-orange hover:text-encre"
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
            {nouveaux === 1 ? "1 nouveau message" : `${nouveaux} nouveaux messages`}
          </button>
        )}
      </div>

      {d && !d.peutEcrire ? (
        <div className="shrink-0 border-t border-ligne-douce bg-creme px-4 py-4 text-center text-[15px] text-texte-pale" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}>
          Ce compte n'est plus actif : la conversation reste lisible mais ne reçoit plus de messages.
        </div>
      ) : (
        <Composeur
          ref={composeur}
          conversationId={id}
          role={moi.role}
          salon={salon}
          contexte={contexte}
          onRetirerContexte={() => {
            setContexte(null);
            naviguer(`/messages/${id}`, { replace: true });
          }}
          reponseA={reponseA}
          onAnnulerReponse={() => setReponseA(null)}
          onEnvoyer={(c) => void envoyer(c)}
          signalerSaisie={d?.type === "direct"}
          entreeEnvoie={!mobile}
        />
      )}

      <Fenetre
        ouverte={Boolean(aSupprimer)}
        onFermer={() => setASupprimer(null)}
        titre={aSupprimer && aSupprimer.auteur.id !== moi.id ? "Retirer ce message ?" : "Supprimer ce message ?"}
        description={
          aSupprimer && aSupprimer.auteur.id !== moi.id
            ? `Le message de ${aSupprimer.auteur.prenom} ${aSupprimer.auteur.nom} sera remplacé par « Message retiré par la modération » pour tout le monde. L'action est enregistrée au journal.`
            : selonRole(moi.role, "Il sera remplacé par « Ce message a été supprimé » chez tout le monde.", "Il sera remplacé par « Ce message a été supprimé » chez tout le monde.")
        }
        pied={
          <>
            <Bouton variante="fantome" onClick={() => setASupprimer(null)}>
              Annuler
            </Bouton>
            <Bouton variante="danger" chargement={action} onClick={() => void confirmerSuppression()}>
              {aSupprimer && aSupprimer.auteur.id !== moi.id ? "Retirer" : "Supprimer"}
            </Bouton>
          </>
        }
      />

      <Fenetre
        ouverte={Boolean(aSignaler)}
        onFermer={() => setASignaler(null)}
        titre="Signaler ce message ?"
        description={
          salon
            ? selonRole(moi.role, "Le formateur du cours et la vie scolaire seront prévenus. L'auteur ne saura pas que c'est toi.", "Les formateurs du cours et la vie scolaire seront prévenus.")
            : selonRole(moi.role, "La vie scolaire de ton campus sera prévenue et pourra t'aider.", "La vie scolaire sera prévenue.")
        }
        pied={
          <>
            <Bouton variante="fantome" onClick={() => setASignaler(null)}>
              Annuler
            </Bouton>
            <Bouton variante="danger" chargement={action} onClick={() => void confirmerSignalement()}>
              Signaler
            </Bouton>
          </>
        }
      >
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-sm font-bold">{selonRole(moi.role, "Pourquoi ? (facultatif)", "Pourquoi ? (facultatif)")}</p>
          <div className="flex flex-wrap gap-2">
            {["Hors sujet", "Propos blessants", "Contenu inapproprié", "Arnaque ou publicité"].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMotif(m)}
                className={cn("min-h-[44px] rounded-full px-4 text-[15px] font-semibold ring-1", motif === m ? "bg-orange text-encre ring-orange" : "bg-white ring-ligne hover:bg-creme")}
              >
                {m}
              </button>
            ))}
          </div>
          <textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value.slice(0, 300))}
            rows={2}
            placeholder={selonRole(moi.role, "Ou explique en quelques mots", "Ou expliquez en quelques mots")}
            className="w-full resize-none rounded-xl border border-ligne bg-white px-4 py-3 text-base outline-none focus:border-orange focus:ring-2 focus:ring-orange/20"
          />
        </div>
      </Fenetre>

      <Visionneuse photo={photo} onFermer={() => setPhoto(null)} />
    </div>
  );
}
