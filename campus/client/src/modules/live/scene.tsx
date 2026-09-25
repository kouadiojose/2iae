// Scène du live : la visio du fournisseur (Daily, visio du campus, Jitsi,
// lien externe, démonstration), ou la « radio » (son + diapo) et le mode
// compagnon qui ne rejoignent aucune visio. Les bandeaux (parole, diapo,
// Plan B) se superposent quel que soit le fournisseur.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ExternalLink, Loader2, Radio, WifiOff, Presentation, Mic } from "lucide-react";
import type { DailyCall } from "@daily-co/daily-js";
import { post } from "@/lib/api";
import { cn, initiales } from "@/lib/utils";
import { Bouton, LienBouton } from "@/components/ui/bouton";
import { SceneVisioCampus, LecteurRadio, type EtatVisio } from "@/modules/visio";
import type { EtatDirectDto, SeanceDetailDto, RejoindreDto, ModeSuivi, RoleSeance } from "@shared/schema";

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
  onEtatVisio?: (etat: EtatVisio) => void;
  /** Écran de salle : très grands bandeaux. */
  grand?: boolean;
  className?: string;
};

export function Scene(p: PropsScene) {
  const { seance, etat, role, mode } = p;
  const planB = etat.planB ?? seance.planB;
  let contenu: ReactNode;
  if (planB) contenu = <ScenePlanB lien={planB} grand={p.grand} />;
  else if (role === "etudiant" && mode === "radio") contenu = <SceneRadio {...p} />;
  else if (role === "etudiant" && mode === "compagnon") contenu = <SceneCompagnon {...p} />;
  else if (seance.fournisseur === "daily") contenu = <SceneDaily {...p} />;
  else if (seance.fournisseur === "campus") contenu = <SceneCampus {...p} />;
  else if (seance.fournisseur === "jitsi") contenu = <SceneJitsi {...p} />;
  else if (seance.fournisseur === "externe") contenu = <SceneExterne {...p} />;
  else contenu = <SceneDemo {...p} />;

  const parole = etat.parole;
  // Radio et compagnon : la diapo garde son format 16/9 et le reste s'empile dessous.
  const libre = !planB && role === "etudiant" && (mode === "radio" || mode === "compagnon");
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[22px] border-2 bg-nuit-carte",
        parole ? "border-orange" : "border-nuit-ligne",
        p.grand ? "min-h-[50vh]" : libre ? "" : "aspect-video",
        p.className,
      )}
    >
      {contenu}
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

// ── Radio : son du formateur + diapo + sous-titres (≈ 15 à 20 Mo/h) ────────

function SceneRadio({ seance, etat, onConsommationRadio }: PropsScene) {
  const dernier = etat.sousTitres[etat.sousTitres.length - 1];
  return (
    <div className="flex flex-col">
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
          <p className="text-center text-[13px] text-nuit-doux">Démonstration : pas de son pour cette séance. Diapos et sous-titres arrivent en direct.</p>
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
                <Presentation className="h-3.5 w-3.5" /> Scène de démonstration · sans visio
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
      onEtat={onEtatVisio}
      onFluxLocal={onFluxLocal}
      className="h-full w-full"
    />
  );
}

// ── Daily.co (chargé à la demande : rien n'est téléchargé en mode radio) ───

let destructionDaily: Promise<void> = Promise.resolve();

function SceneDaily({ seance, role, micro, camera, onConsommationVisio, onEtatVisio }: PropsScene) {
  const conteneur = useRef<HTMLDivElement>(null);
  const appel = useRef<DailyCall | null>(null);
  const [etat, setEtat] = useState<"connexion" | "connecte" | "erreur">("connexion");
  const [message, setMessage] = useState("");
  const [essai, setEssai] = useState(0);
  const recu = useRef(0);

  useEffect(() => {
    let annule = false;
    setEtat("connexion");
    onEtatVisio?.("connexion");
    (async () => {
      try {
        const infos = await post<RejoindreDto>(`/api/seances/${seance.id}/rejoindre`, { mode: "video" });
        if (!infos.url || !infos.jeton) throw new Error(infos.message ?? "La visio n'est pas disponible pour le moment.");
        const { default: DailyIframe } = await import("@daily-co/daily-js");
        await destructionDaily;
        if (annule || !conteneur.current) return;
        const call = DailyIframe.createFrame(conteneur.current, {
          iframeStyle: { width: "100%", height: "100%", border: "0", borderRadius: "20px", background: "#1E1C1A" },
          showLeaveButton: false,
          showFullscreenButton: true,
          lang: "fr",
          theme: {
            colors: {
              accent: "#E4793A",
              accentText: "#141414",
              background: "#1E1C1A",
              backgroundAccent: "#2A2624",
              baseText: "#FFFFFF",
              border: "#3A3431",
              mainAreaBg: "#0F0E0D",
              mainAreaBgAccent: "#1E1C1A",
              mainAreaText: "#FFFFFF",
              supportiveText: "#A89E95",
            },
          },
        });
        appel.current = call;
        call.on("joined-meeting", () => {
          setEtat("connecte");
          onEtatVisio?.("connecte");
        });
        call.on("network-connection", (ev) => {
          if (ev?.event === "interrupted") onEtatVisio?.("reconnexion");
          if (ev?.event === "connected") onEtatVisio?.("connecte");
        });
        call.on("error", (ev) => {
          setEtat("erreur");
          setMessage(ev?.errorMsg ? `La visio a été interrompue (${ev.errorMsg}).` : "La visio a été interrompue.");
          onEtatVisio?.("echec");
        });
        const emetteur = role === "formateur" || role === "salle";
        await call.join({ url: infos.url, token: infos.jeton, startVideoOff: !emetteur, startAudioOff: !(role === "formateur") });
      } catch (e) {
        if (annule) return;
        setEtat("erreur");
        setMessage((e as Error).message);
        onEtatVisio?.("echec");
      }
    })();
    return () => {
      annule = true;
      const c = appel.current;
      appel.current = null;
      if (c) destructionDaily = c.destroy().catch(() => undefined);
      onEtatVisio?.("ferme");
    };
  }, [seance.id, role, essai]);

  // Micro : le formateur le garde ; la salle et l'étudiant ne l'ouvrent qu'avec la parole.
  useEffect(() => {
    if (etat === "connecte" && micro !== undefined) appel.current?.setLocalAudio(micro);
  }, [micro, etat]);
  useEffect(() => {
    if (etat === "connecte" && camera !== undefined && (role === "formateur" || role === "salle")) appel.current?.setLocalVideo(camera);
  }, [camera, etat, role]);

  // Consommation mesurée par Daily (débit reçu), cumulée toutes les 5 s.
  useEffect(() => {
    if (etat !== "connecte" || !onConsommationVisio) return;
    const id = setInterval(async () => {
      try {
        const stats = await appel.current?.getNetworkStats();
        const latest = stats && "latest" in stats.stats ? stats.stats.latest : null;
        if (latest?.recvBitsPerSecond) {
          recu.current += (latest.recvBitsPerSecond / 8) * 5;
          onConsommationVisio(recu.current);
        }
      } catch {
        /* statistiques indisponibles */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [etat, onConsommationVisio]);

  return (
    <div className="relative h-full w-full">
      <div ref={conteneur} className="h-full w-full" />
      {etat !== "connecte" && (
        <div className="absolute inset-0">
          {etat === "connexion" ? (
            <MessageScene icone={<Loader2 className="h-6 w-6 animate-spin" />} texte="Connexion à la visio…" />
          ) : (
            <MessageScene
              icone={<WifiOff className="h-6 w-6" />}
              texte={message || "La visio ne répond pas."}
              action={
                <Bouton variante="nuit-actif" onClick={() => setEssai((n) => n + 1)}>
                  Réessayer
                </Bouton>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
