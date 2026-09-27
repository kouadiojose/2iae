// Scène du live : la visio du fournisseur (Daily, visio du campus, Jitsi,
// lien externe, démonstration), ou la « radio » (son + diapo) et le mode
// compagnon qui ne rejoignent aucune visio. Les bandeaux (parole, diapo,
// Plan B) se superposent quel que soit le fournisseur.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ExternalLink, Loader2, Radio, WifiOff, Presentation, Mic, RotateCcw } from "lucide-react";
import type { DailyCall, DailyEventObjectParticipant } from "@daily-co/daily-js";
import { patch, post } from "@/lib/api";
import { rafraichir } from "@/lib/queryClient";
import { cn, initiales } from "@/lib/utils";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { toast, toastErreur } from "@/components/ui/toast";
import { SceneVisioCampus, LecteurRadio, CadreDaily, type EtatVisio, type RoleCadre } from "@/modules/visio";
import type { EtatDirectDto, SeanceDetailDto, RejoindreDto, RejoindreVisioDto, ModeSuivi, RoleSeance } from "@shared/schema";

export type PropsScene = {
  seance: SeanceDetailDto;
  etat: EtatDirectDto;
  role: RoleSeance;
  /** Étudiant : façon de suivre choisie à l'entrée. */
  mode?: ModeSuivi;
  /** Micro ouvert (formateur, salle ou étudiant qui a reçu la parole). */
  micro?: boolean;
  camera?: boolean;
  /** Octets reçus mesurés par la visio (total cumulé). */
  onConsommationVisio?: (octets: number) => void;
  /** Octets reçus par la radio (total cumulé). */
  onConsommationRadio?: (octets: number) => void;
  /** Formateur : flux micro local (sert à la radio). */
  onFluxLocal?: (flux: MediaStream | null) => void;
  /** Formateur (Daily) : micro coupé ou rouvert depuis l'interface de Daily elle-même. */
  onMicroDaily?: (ouvert: boolean) => void;
  onEtatVisio?: (etat: EtatVisio) => void;
  /** Écran de salle : très grands bandeaux. */
  grand?: boolean;
  className?: string;
};

export function Scene(p: PropsScene) {
  const { seance, etat, role, mode } = p;
  const planB = etat.planB ?? seance.planB;
  // Bascule locale quand Daily échoue deux fois (ou que la visio est complète) : on écoute la radio sans quitter la page.
  const [secoursRadio, setSecoursRadio] = useState<RaisonSecours | null>(null);
  useEffect(() => setSecoursRadio(null), [seance.fournisseur]);
  let contenu: ReactNode;
  if (planB) contenu = <ScenePlanB lien={planB} grand={p.grand} />;
  else if (role === "etudiant" && mode === "radio") contenu = <SceneRadio {...p} />;
  else if (role === "etudiant" && mode === "compagnon") contenu = <SceneCompagnon {...p} />;
  else if (seance.fournisseur === "daily" && secoursRadio) contenu = <SceneRadio {...p} raisonSecours={secoursRadio} retourVisio={() => setSecoursRadio(null)} />;
  else if (seance.fournisseur === "daily") contenu = <SceneDaily {...p} onSecoursRadio={(raison) => setSecoursRadio(raison)} />;
  else if (seance.fournisseur === "campus") contenu = <SceneCampus {...p} />;
  else if (seance.fournisseur === "jitsi") contenu = <SceneJitsi {...p} />;
  else if (seance.fournisseur === "externe") contenu = <SceneExterne {...p} />;
  else contenu = <SceneDemo {...p} />;

  const parole = etat.parole;
  // Radio et compagnon : la diapo garde son format 16/9 et le reste s'empile dessous.
  // Visio du campus côté formateur : la grille des cinq salles prend la hauteur dont elle a
  // besoin (sur téléphone, 2 colonnes × 3 rangées ne tiennent pas dans un cadre 16/9).
  const libre = !planB && ((role === "etudiant" && (mode === "radio" || mode === "compagnon")) || (role === "formateur" && seance.fournisseur === "campus") || (seance.fournisseur === "daily" && secoursRadio));
  // Diapo en grand pour tous ceux qui suivent en vidéo (écrans de salle, étudiants, équipe), l'intervenant
  // en vignette : c'est la diapo que la salle doit lire. Le formateur garde sa visio plein cadre (sa bande
  // de diapos est sous la scène). La vignette reste le MÊME élément : la visio ne se recharge jamais.
  const visio = seance.fournisseur === "daily" || seance.fournisseur === "campus";
  const diapoEnGrand = visio && !planB && !libre && role !== "formateur" && Boolean(etat.diapo.url);
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[22px] border-2 bg-nuit-carte",
        parole ? "border-orange" : "border-nuit-ligne",
        p.grand ? "h-full min-h-[40vh]" : libre ? "" : "aspect-video",
        p.className,
      )}
    >
      {diapoEnGrand && <DiapoCourante etat={etat} className="absolute inset-0" />}
      <div
        className={
          diapoEnGrand
            ? cn(
                "absolute z-10 aspect-video overflow-hidden rounded-xl border-2 border-nuit-ligne bg-nuit-carte shadow-2xl",
                p.grand ? "bottom-4 right-4 w-[30%] min-w-[260px]" : "bottom-2 right-2 w-[38%] min-w-[140px]",
              )
            : "contents"
        }
      >
        {contenu}
      </div>
      {parole && (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center gap-3 bg-orange text-center font-black uppercase tracking-serre text-encre",
            p.grand ? "px-6 py-5 text-[clamp(28px,4vw,64px)]" : "px-4 py-2 text-base sm:text-lg",
          )}
          role="status"
          aria-live="polite"
        >
          <Mic className={p.grand ? "h-12 w-12" : "h-5 w-5"} />
          {parole.type === "salle" ? `${parole.site ?? "La salle"} a la parole` : `${parole.libelle} a la parole`}
        </div>
      )}
    </div>
  );
}

// ── Diapo courante (image légère, mise en cache par le navigateur) ─────────

export function DiapoCourante({ etat, className, vide }: { etat: EtatDirectDto; className?: string; vide?: ReactNode }) {
  const { diapo } = etat;
  if (!diapo.url) return <>{vide ?? null}</>;
  return (
    <div className={cn("relative h-full w-full bg-black", className)}>
      <img src={diapo.url} alt={`Diapo ${diapo.index + 1} sur ${diapo.total}`} className="h-full w-full object-contain" />
      <span className="absolute right-3 top-3 rounded-lg bg-black/70 px-2.5 py-1 font-mono text-xs text-orange-peche">
        Diapo {diapo.index + 1} / {diapo.total}
      </span>
    </div>
  );
}

function PortraitFormateur({ seance, sousTitre }: { seance: SeanceDetailDto; sousTitre?: ReactNode }) {
  const f = seance.formateur;
  const ville = f?.localisation?.split(",")[0] ?? "à distance";
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="grid aspect-square w-[clamp(72px,16%,128px)] place-items-center rounded-full bg-orange text-[clamp(24px,3vw,44px)] font-black text-encre">
        {f?.photoUrl ? <img src={f.photoUrl} alt="" className="h-full w-full rounded-full object-cover" /> : initiales(f?.prenom, f?.nom)}
      </div>
      <div>
        <div className="text-lg font-extrabold text-white">{f ? `${f.prenom} ${f.nom}` : "Formateur"}</div>
        <div className="font-mono text-xs text-nuit-gris">Formateur · depuis {ville}</div>
      </div>
      {sousTitre}
    </div>
  );
}

// ── Radio : son du formateur + diapo + sous-titres (≈ 12 à 15 Mo/h) ────────

/** Pourquoi on écoute la radio au lieu de la visio Daily. */
type RaisonSecours = "echec" | "pleine";

function SceneRadio({ seance, etat, role, onConsommationRadio, retourVisio, raisonSecours }: PropsScene & { retourVisio?: () => void; raisonSecours?: RaisonSecours }) {
  const dernier = etat.sousTitres[etat.sousTitres.length - 1];
  const tu = role === "etudiant";
  return (
    <div className="flex flex-col">
      {retourVisio && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-orange px-4 py-2 text-sm font-bold text-encre">
          <span>
            {raisonSecours === "pleine"
              ? tu
                ? "La visio est complète : tu suis en son + diapos, tu entends tout."
                : "La visio est complète : le son du cours arrive par la radio."
              : "La visio ne passe pas : le son du cours arrive par la radio."}
          </span>
          <button type="button" onClick={retourVisio} className="inline-flex items-center gap-1.5 rounded-lg bg-encre px-3 py-1.5 text-white">
            <RotateCcw className="h-3.5 w-3.5" /> Réessayer la visio
          </button>
        </div>
      )}
      <div className="relative aspect-video">
        <DiapoCourante
          etat={etat}
          vide={
            <PortraitFormateur
              seance={seance}
              sousTitre={
                <span className="flex items-center gap-2 rounded-full bg-nuit-ligne px-3 py-1.5 font-mono text-xs text-orange-peche">
                  <Radio className="h-3.5 w-3.5" /> Son seul · les diapos s'afficheront ici
                </span>
              }
            />
          }
        />
      </div>
      {dernier && (
        <p className="border-t border-nuit-ligne px-4 py-3 text-center text-[15px] font-semibold leading-snug text-white" aria-live="polite">
          {dernier.texte}
        </p>
      )}
      <div className="border-t border-nuit-ligne bg-nuit-panneau px-3 py-2">
        {seance.fournisseur === "demo" ? (
          <p className="text-center text-[13px] text-nuit-doux">Pas de son pour cette séance : diapos et sous-titres arrivent en direct.</p>
        ) : (
          <LecteurRadio seanceId={seance.id} nuit onConsommation={onConsommationRadio} />
        )}
      </div>
    </div>
  );
}

function SceneCompagnon({ seance, etat }: PropsScene) {
  return (
    <div className="flex flex-col">
      <div className="bg-orange px-4 py-2 text-center text-sm font-bold text-encre">
        En salle{seance.monSite ? ` à ${seance.monSite.nomCourt}` : ""} · son coupé, suis sur l'écran de la salle
      </div>
      <div className="relative aspect-video">
        <DiapoCourante etat={etat} vide={<PortraitFormateur seance={seance} />} />
      </div>
    </div>
  );
}

function ScenePlanB({ lien, grand }: { lien: string; grand?: boolean }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 p-4 text-center sm:gap-4 sm:p-6">
      <span className="etiquette text-orange-peche">Plan B</span>
      <p className={cn("max-w-xl font-black leading-tight tracking-serre text-white", grand ? "text-[clamp(28px,4vw,56px)]" : "text-xl sm:text-2xl")}>
        Le cours continue sur le lien de secours.
      </p>
      <p className="hidden max-w-md text-[15px] text-nuit-doux sm:block">Les questions, les sondages et l'émargement continuent ici, sur le campus.</p>
      <LienBouton href={lien} externe taille={grand ? "lg" : "md"} icone={<ExternalLink className="h-5 w-5" />}>
        Ouvrir le lien de secours
      </LienBouton>
    </div>
  );
}

function SceneDemo({ seance, etat }: PropsScene) {
  return (
    <div className="relative h-full">
      <DiapoCourante
        etat={etat}
        vide={
          <PortraitFormateur
            seance={seance}
            sousTitre={
              <span className="flex items-center gap-2 rounded-full bg-nuit-ligne px-3 py-1.5 font-mono text-xs text-nuit-doux">
                <Presentation className="h-3.5 w-3.5" /> Pas de visio pour cette séance · diapos et questions en direct
              </span>
            }
          />
        }
      />
    </div>
  );
}

function SceneExterne({ seance, etat }: PropsScene) {
  return (
    <div className="relative h-full">
      <DiapoCourante
        etat={etat}
        vide={
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="max-w-md text-lg font-extrabold text-white">La visio de ce cours se passe sur un lien externe.</p>
            {seance.lienExterne && (
              <LienBouton href={seance.lienExterne} externe icone={<ExternalLink className="h-4 w-4" />}>
                Ouvrir la visio
              </LienBouton>
            )}
            <p className="max-w-sm text-sm text-nuit-doux">Garde cette page ouverte : questions, sondages et émargement restent ici.</p>
          </div>
        }
      />
    </div>
  );
}

function SceneJitsi({ seance }: PropsScene) {
  const [infos, setInfos] = useState<RejoindreDto | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    post<RejoindreDto>(`/api/seances/${seance.id}/rejoindre`, { mode: "video" })
      .then(setInfos)
      .catch((e: Error) => setErreur(e.message));
  }, [seance.id]);
  if (erreur || infos?.message) return <MessageScene icone={<WifiOff className="h-6 w-6" />} texte={erreur ?? infos?.message ?? ""} />;
  if (!infos?.url) return <MessageScene icone={<Loader2 className="h-6 w-6 animate-spin" />} texte="Connexion à la visio…" />;
  return <iframe src={infos.url} title="Visio du cours" allow="camera; microphone; fullscreen; display-capture; autoplay" className="h-full w-full border-0" />;
}

function MessageScene({ icone, texte, action }: { icone: ReactNode; texte: string; action?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-nuit-ligne text-orange">{icone}</div>
      <p className="max-w-md text-[15px] font-semibold text-nuit-texte">{texte}</p>
      {action}
    </div>
  );
}

// ── Visio du campus (WebRTC en étoile, module visio) ───────────────────────

function SceneCampus({ seance, etat, role, micro, camera, onFluxLocal, onEtatVisio }: PropsScene) {
  const [nomAffiche, setNomAffiche] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    post<RejoindreDto>(`/api/seances/${seance.id}/rejoindre`, { mode: "video" })
      .then((r) => setNomAffiche(r.nomAffiche))
      .catch((e: Error) => setErreur(e.message));
  }, [seance.id]);
  if (erreur) return <MessageScene icone={<WifiOff className="h-6 w-6" />} texte={erreur} />;
  if (!nomAffiche) return <MessageScene icone={<Loader2 className="h-6 w-6 animate-spin" />} texte="Connexion à la visio du campus…" />;
  const roleVisio = role === "formateur" ? "formateur" : role === "salle" ? "salle" : "etudiant";
  return (
    <SceneVisioCampus
      seanceId={seance.id}
      role={roleVisio}
      siteId={seance.monSite?.id ?? null}
      nomAffiche={nomAffiche}
      micro={Boolean(micro)}
      camera={Boolean(camera)}
      audioSeul={false}
      siteALaParole={etat.parole?.type === "salle" ? etat.parole.siteId : null}
      utilisateurALaParole={etat.parole?.type === "etudiant" ? etat.parole.utilisateurId : null}
      enDirect={etat.statut === "en_direct"}
      onEtat={onEtatVisio}
      onFluxLocal={onFluxLocal}
      className="h-full w-full"
    />
  );
}

// ── Daily.co (chargé à la demande : rien n'est téléchargé en mode radio) ───
//
// Le cadre (iframe, thème, erreurs traduites, jeton redemandé, bascule) est
// celui du module visio (CadreDaily), partagé avec la salle d'essai. Ici :
// ce qui tient à la classe. Le formateur (propriétaire) ouvre le micro de
// l'étudiant qui reçoit la parole et le referme ensuite ; il lance
// l'enregistrement du replay quand la séance passe en direct (jamais en
// répétition ni pendant un essai).

const roleCadre = (r: RoleSeance): RoleCadre => (r === "equipe" ? "observateur" : r);

const peutEnvoyerSon = (p: DailyEventObjectParticipant["participant"]) => {
  const cs = p.permissions?.canSend;
  return cs === true || (cs instanceof Set && cs.has("audio"));
};

/** Relances du replay après une erreur d'enregistrement Daily : trois au plus, espacées. */
const RELANCES_ENREGISTREMENT = 3;

function SceneDaily({ seance, etat, role, micro, camera, onConsommationVisio, onEtatVisio, onSecoursRadio, onMicroDaily }: PropsScene & { onSecoursRadio: (raison: RaisonSecours) => void }) {
  const [call, setCall] = useState<DailyCall | null>(null);
  const [connecte, setConnecte] = useState(false);
  const infos = useRef<RejoindreVisioDto | null>(null);
  const enregistre = useRef(false);
  const microVoulu = useRef(micro);
  microVoulu.current = micro;
  const [bascule, setBascule] = useState(false);

  // Enregistrement en cours ? (lancé par le jeton si la séance était déjà en direct)
  const [relanceEnregistrement, setRelanceEnregistrement] = useState(0);
  const relancesEnregistrement = useRef(0);
  useEffect(() => {
    if (!call) return;
    enregistre.current = false;
    const debut = () => (enregistre.current = true);
    const fin = () => (enregistre.current = false);
    // Enregistrement tombé en erreur en plein cours : on le relance (le replay garde tous les morceaux).
    const erreur = () => {
      enregistre.current = false;
      if (relancesEnregistrement.current >= RELANCES_ENREGISTREMENT) return;
      relancesEnregistrement.current += 1;
      setTimeout(() => setRelanceEnregistrement((n) => n + 1), 10_000);
    };
    call.on("recording-started", debut);
    call.on("recording-stopped", fin);
    call.on("recording-error", erreur);
    return () => {
      call.off("recording-started", debut);
      call.off("recording-stopped", fin);
      call.off("recording-error", erreur);
    };
  }, [call]);

  // Replay : le formateur lance l'enregistrement dès que la séance passe en direct, pour toute la durée du
  // cours et son débordement (sans durée, Daily coupe l'enregistrement au bout de 3 h).
  useEffect(() => {
    if (!call || !connecte || role !== "formateur" || etat.statut !== "en_direct" || !infos.current?.enregistrement) return;
    const maxDuration = infos.current.enregistrementMaxS ?? seance.dureeMinutes * 60 + 2 * 3600;
    const id = setTimeout(() => {
      if (enregistre.current) return;
      try {
        call.startRecording({ maxDuration });
      } catch {
        /* enregistrement indisponible : le cours continue */
      }
    }, 4000);
    return () => clearTimeout(id);
  }, [call, connecte, role, etat.statut, relanceEnregistrement]);

  // Formateur : micro coupé (ou rouvert) depuis l'interface de Daily elle-même. Le studio suit, et la radio avec lui.
  // Seuls les changements comptent (on part de l'état actuel du micro dans Daily) : un ancien événement ne défait pas un choix du studio.
  useEffect(() => {
    if (!call || !connecte || role !== "formateur" || !onMicroDaily) return;
    const microOuvert = (x: DailyEventObjectParticipant["participant"] | undefined): boolean | null => {
      const audio = x?.tracks?.audio;
      if (audio?.state === "playable" || audio?.state === "sendable" || audio?.state === "loading") return true;
      return audio?.state === "off" && audio.off?.byUser ? false : null;
    };
    let dernier = microOuvert(call.participants().local);
    const maj = (ev?: DailyEventObjectParticipant) => {
      const x = ev?.participant;
      if (!x?.local) return;
      const ouvert = microOuvert(x);
      if (ouvert === null || ouvert === dernier) return;
      dernier = ouvert;
      onMicroDaily(ouvert);
    };
    call.on("participant-updated", maj);
    return () => {
      call.off("participant-updated", maj);
    };
  }, [call, connecte, role, onMicroDaily]);

  // Parole à un étudiant en ligne : le formateur lui ouvre le droit d'envoyer son micro, et le retire après.
  const cibleParole = etat.parole?.type === "etudiant" ? String(etat.parole.utilisateurId) : null;
  const accorde = useRef<string | null>(null);
  useEffect(() => {
    if (!call || !connecte || role !== "formateur") return;
    const appliquer = () => {
      const participants = Object.values(call.participants());
      if (accorde.current && accorde.current !== cibleParole) {
        for (const x of participants) if (!x.local && x.user_id === accorde.current) call.updateParticipant(x.session_id, { setAudio: false, updatePermissions: { canSend: false } });
      }
      if (cibleParole) for (const x of participants) if (!x.local && x.user_id === cibleParole) call.updateParticipant(x.session_id, { updatePermissions: { canSend: ["audio"] } });
      accorde.current = cibleParole;
    };
    appliquer();
    const arrivee = (ev?: DailyEventObjectParticipant) => {
      if (cibleParole && ev?.participant.user_id === cibleParole) appliquer();
    };
    call.on("participant-joined", arrivee);
    return () => {
      call.off("participant-joined", arrivee);
    };
  }, [call, connecte, role, cibleParole]);

  // Étudiant : le droit de parler arrive un instant après la parole ; on ouvre alors le micro.
  useEffect(() => {
    if (!call || role !== "etudiant") return;
    const maj = (ev?: DailyEventObjectParticipant) => {
      const x = ev?.participant;
      if (!x?.local) return;
      if (microVoulu.current && peutEnvoyerSon(x) && x.tracks?.audio?.state === "off") call.setLocalAudio(true);
    };
    call.on("participant-updated", maj);
    return () => {
      call.off("participant-updated", maj);
    };
  }, [call, role]);

  const basculerCampus = async () => {
    setBascule(true);
    try {
      await patch(`/api/seances/${seance.id}`, { fournisseur: "campus" });
      await rafraichir(`/api/seances/${seance.id}`);
      toast("La classe passe sur la visio du campus : les salles et les étudiants suivent.");
    } catch (e) {
      toastErreur(e);
    } finally {
      setBascule(false);
    }
  };

  const tu = role === "etudiant";
  const secours =
    role === "formateur" && seance.peutModifier ? (
      <>
        <Bouton variante="nuit-actif" chargement={bascule} onClick={() => void basculerCampus()}>
          Passer la classe sur la visio du campus
        </Bouton>
        <p className="text-[13px] text-nuit-gris">Les salles et les étudiants basculent avec vous. La radio, les diapos et les questions continuent.</p>
      </>
    ) : (
      <Bouton variante="nuit-actif" icone={<Radio className="h-4 w-4" />} onClick={() => onSecoursRadio("echec")}>
        {tu ? "Écouter en son + diapos" : "Écouter le cours à la radio"}
      </Bouton>
    );

  return (
    <CadreDaily
      role={roleCadre(role)}
      tu={tu}
      micro={micro}
      camera={camera}
      relanceAuto
      obtenirAcces={async () => {
        const r = await post<RejoindreVisioDto>(`/api/seances/${seance.id}/rejoindre`, { mode: "video" });
        infos.current = r;
        return r;
      }}
      onAppel={(c) => {
        setCall(c);
        if (!c) setConnecte(false);
      }}
      onRejoint={() => setConnecte(true)}
      onEtat={onEtatVisio}
      onConsommation={onConsommationVisio}
      // Étudiant : visio complète (places vidéo prises) : il passe tout de suite en son + diapos.
      onEchecs={(_n, probleme) => {
        if (role === "etudiant" && probleme?.genre === "pleine") onSecoursRadio("pleine");
      }}
      secours={secours}
    />
  );
}
