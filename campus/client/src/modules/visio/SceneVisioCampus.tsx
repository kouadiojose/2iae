// Scène de visio intégrée (WebRTC pair-à-pair en étoile autour du formateur).
//
// Sans compte chez un fournisseur : le formateur appelle chaque salle de
// conférence (image et son dans les deux sens) et chaque étudiant en ligne
// (réception seule, micro ouvert quand il a la parole). Le serveur du campus
// ne sert qu'à se présenter et à relayer la négociation (voir
// server/visio-campus.ts). Mode nuit, comme la salle live de la maquette.
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mic, MicOff, Radio, VideoOff, Volume2, WifiOff, Users, RotateCcw } from "lucide-react";
import { useMoi } from "@/lib/auth";
import { useCanal, useFluxConnecte } from "@/lib/flux";
import { cn } from "@/lib/utils";
import { Bouton } from "@/components/ui/bouton";
import type { EvenementVisio, PairsVisio } from "@shared/schema";
import { CentreVisio, PeripherieVisio, type VueCentre, type VuePeripherie, type EntreeCentre } from "./moteur/etoile";
import { webrtcDisponible } from "./moteur/medias";
import { Video, Son, Pastille, Etiquette, relancerSons, type TonPastille } from "./composants";
import { LecteurRadio } from "./LecteurRadio";

export type EtatVisio = "connexion" | "connecte" | "reconnexion" | "echec" | "ferme";

export type PropsSceneVisioCampus = {
  seanceId: number;
  /** formateur : centre de l'étoile · salle : écran d'une salle de conférence · etudiant : en ligne (audio seul pour recevoir la parole). */
  role: "formateur" | "salle" | "etudiant";
  /** Site de la salle (rôle salle) ou de l'étudiant. */
  siteId?: number | null;
  nomAffiche: string;
  micro: boolean;
  camera: boolean;
  /** Ne recevoir que le son (économie de données). */
  audioSeul?: boolean;
  /** Formateur : site qui a la parole (son relayé aux autres salles). */
  siteALaParole?: number | null;
  /** Utilisateur (étudiant en ligne) qui a la parole en audio. */
  utilisateurALaParole?: number | null;
  onEtat?: (etat: EtatVisio) => void;
  /** Formateur : flux micro/caméra local, pour la radio et l'aperçu. */
  onFluxLocal?: (flux: MediaStream | null) => void;
  className?: string;
};

export function SceneVisioCampus(props: PropsSceneVisioCampus) {
  const { moi } = useMoi();
  if (!moi) return null;
  if (!webrtcDisponible()) return <SceneIndisponible role={props.role} seanceId={props.seanceId} className={props.className} />;
  return props.role === "formateur" ? <SceneFormateur {...props} moiId={moi.id} /> : <ScenePeripherie {...props} role={props.role} moiId={moi.id} />;
}

// ── Aides communes ─────────────────────────────────────────────────────────

function pastilleDe(etat: EtatVisio, attente: boolean): { ton: TonPastille; texte: string } {
  if (etat === "connecte") return { ton: "direct", texte: "En direct" };
  if (etat === "reconnexion") return { ton: "alerte", texte: "Reconnexion…" };
  if (etat === "echec") return { ton: "alerte", texte: "Connexion impossible" };
  if (etat === "ferme") return { ton: "neutre", texte: "Visio fermée" };
  return { ton: "attente", texte: attente ? "En attente du formateur" : "Connexion…" };
}

/** Écoute les événements « visio » du canal personnel et suit le temps réel du campus. */
function useBrancherMoteur(moiId: number, seanceId: number, moteur: { current: CentreVisio | PeripherieVisio | null }) {
  useCanal(`u:${moiId}`, (e) => {
    const d = e.data as EvenementVisio | null;
    if (e.type === "visio" && d && d.seanceId === seanceId) moteur.current?.recevoir(d);
  });
  const connecte = useFluxConnecte();
  useEffect(() => {
    moteur.current?.fluxConnecte(connecte);
  }, [connecte, seanceId, moteur]);
}

function BoutonActiverSon({ onClick, tu }: { onClick: () => void; tu: boolean }) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-black/55 p-4">
      <Bouton taille="lg" icone={<Volume2 className="h-5 w-5" />} onClick={onClick} className="min-h-[56px]">
        {tu ? "Activer le son" : "Activer le son de la classe"}
      </Bouton>
    </div>
  );
}

function SceneIndisponible({ role, seanceId, className }: { role: PropsSceneVisioCampus["role"]; seanceId: number; className?: string }) {
  const tu = role === "etudiant";
  return (
    <div className={cn("flex w-full flex-col items-center justify-center gap-4 rounded-[22px] bg-nuit p-6 text-center text-white", className)}>
      <WifiOff className="h-8 w-8 text-orange" />
      <p className="max-w-md text-base text-nuit-doux">
        {tu
          ? "Ce navigateur ne permet pas la visio. Ouvre le campus avec Chrome. En attendant, tu peux écouter le cours à la radio."
          : "Ce navigateur ne permet pas la visio. Ouvrez le campus avec Chrome ou Edge à jour."}
      </p>
      {tu && <LecteurRadio seanceId={seanceId} nuit />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Formateur : grille des salles + son aperçu
// ════════════════════════════════════════════════════════════════════════════

function SceneFormateur(p: PropsSceneVisioCampus & { moiId: number }) {
  const moteur = useRef<CentreVisio | null>(null);
  const racine = useRef<HTMLDivElement>(null);
  const rappels = useRef(p);
  rappels.current = p;
  const [vue, setVue] = useState<VueCentre | null>(null);
  const [sonBloque, setSonBloque] = useState(false);

  useEffect(() => {
    const m = new CentreVisio(p.seanceId, {
      maj: () => setVue(m.vue()),
      surEtat: (etat) => rappels.current.onEtat?.(etat),
      surFluxLocal: (flux) => rappels.current.onFluxLocal?.(flux),
    });
    moteur.current = m;
    setVue(m.vue());
    rappels.current.onEtat?.("connexion");
    return () => {
      moteur.current = null;
      m.arreter();
    };
  }, [p.seanceId]);

  useBrancherMoteur(p.moiId, p.seanceId, moteur);

  useEffect(() => {
    moteur.current?.definirMedias(p.micro, p.camera);
  }, [p.micro, p.camera, p.seanceId]);

  useEffect(() => {
    moteur.current?.definirParole(p.siteALaParole ?? null, p.utilisateurALaParole ?? null);
  }, [p.siteALaParole, p.utilisateurALaParole, p.seanceId]);

  // Liste des salles du groupe (pour montrer aussi celles qui ne sont pas encore là) et places vidéo.
  const { data: pairs } = useQuery<PairsVisio>({ queryKey: ["/api/visio", p.seanceId, "pairs"], refetchInterval: 15_000 });

  if (!vue) return null;
  const pastille = pastilleDe(vue.etat, false);
  const sites = pairs?.sites ?? [];
  const sallesConnues = new Set(sites.map((s) => s.id));
  // Une salle par site (la plus récente) + les salles d'un site inconnu de la liste.
  const tuiles: { cle: string; nom: string; siteId: number | null; entree: EntreeCentre | null }[] = sites.map((s) => ({
    cle: `site-${s.id}`,
    nom: s.nomCourt,
    siteId: s.id,
    entree: vue.salles.filter((e) => e.info.siteId === s.id).sort((a, b) => b.info.rejointLe.localeCompare(a.info.rejointLe))[0] ?? null,
  }));
  for (const e of vue.salles) if (e.info.siteId == null || !sallesConnues.has(e.info.siteId)) tuiles.push({ cle: e.info.pairId, nom: e.info.nom, siteId: e.info.siteId, entree: e });
  const sallesConnectees = vue.salles.filter((e) => e.etat === "connecte").length;
  const enVideo = vue.etudiants.filter((e) => e.info.video).length;

  return (
    <div ref={racine} className={cn("relative flex w-full flex-col gap-3 overflow-hidden rounded-[22px] bg-nuit p-2.5 text-white sm:p-3", p.className)}>
      {vue.sons.map((s) => (
        <Son key={s.id} piste={s.piste} onBloque={() => setSonBloque(true)} />
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Pastille ton={pastille.ton}>{pastille.texte}</Pastille>
        <span className="rounded-full bg-nuit-carte px-3 py-1.5 font-mono text-xs text-nuit-doux">
          {sallesConnectees}/{Math.max(sites.length, vue.salles.length) || 5} salles
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-nuit-carte px-3 py-1.5 font-mono text-xs text-nuit-doux">
          <Users className="h-3.5 w-3.5" />
          {vue.etudiants.length} en ligne{vue.etudiants.length ? ` · ${enVideo} en vidéo` : ""}
        </span>
      </div>

      {(vue.message || vue.erreurMedia) && (
        <p className="rounded-xl bg-nuit-carte px-3 py-2 text-sm text-nuit-texte" role="alert">
          {vue.erreurMedia ?? vue.message}
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {/* Aperçu du formateur */}
        <div className="relative aspect-video overflow-hidden rounded-[14px] border-2 border-nuit-ligne bg-nuit-carte">
          {vue.local.video ? (
            <Video piste={vue.local.video} miroir libelle="Votre aperçu" />
          ) : (
            <div className="grid h-full place-items-center text-nuit-gris">
              <VideoOff className="h-6 w-6" aria-label="Caméra coupée" />
            </div>
          )}
          <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2">
            <Etiquette>Vous{p.nomAffiche ? ` · ${p.nomAffiche.split(" ")[0]}` : ""}</Etiquette>
            {!vue.local.micro && (
              <span className="grid h-7 w-7 place-items-center rounded-full bg-direct" aria-label="Micro coupé">
                <MicOff className="h-4 w-4" />
              </span>
            )}
          </div>
        </div>

        {tuiles.map((t) => (
          <TuileSalle key={t.cle} nom={t.nom} entree={t.entree} parole={Boolean(vue.paroleSalle && t.entree && vue.paroleSalle === t.entree) || (p.siteALaParole != null && p.siteALaParole === t.siteId)} />
        ))}
      </div>

      {(p.utilisateurALaParole != null || vue.paroleEtudiant) && (
        <div className="flex items-center gap-2 rounded-xl bg-nuit-carte px-3 py-2.5 text-[15px]">
          <Mic className="h-4 w-4 text-orange" />
          {vue.paroleEtudiant ? (
            <span>
              <strong>{vue.paroleEtudiant.info.nom}</strong> a la parole{vue.paroleEtudiant.audio ? "" : " (connexion du micro…)"}
            </span>
          ) : (
            <span className="text-nuit-doux">L'étudiant qui a la parole n'est pas connecté en visio.</span>
          )}
        </div>
      )}

      {vue.etat === "echec" && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/75 p-6 text-center">
          <p className="max-w-md text-base">{vue.message ?? "La visio n'a pas pu démarrer."}</p>
          <Bouton icone={<RotateCcw className="h-4 w-4" />} onClick={() => moteur.current?.reprendre()} className="min-h-[48px]">
            Reprendre la classe ici
          </Bouton>
        </div>
      )}
      {sonBloque && vue.etat !== "echec" && (
        <BoutonActiverSon
          tu={false}
          onClick={() => {
            relancerSons(racine.current);
            setSonBloque(false);
          }}
        />
      )}
    </div>
  );
}

function TuileSalle({ nom, entree, parole }: { nom: string; entree: EntreeCentre | null; parole: boolean }) {
  const etat = entree?.etat ?? null;
  const video = entree && entree.medias.camera ? entree.video : null;
  return (
    <div className={cn("relative aspect-video overflow-hidden rounded-[14px] border-2 bg-nuit-carte", parole ? "border-orange" : "border-nuit-ligne")}>
      {video && etat !== "ferme" ? (
        <Video piste={video} libelle={`Salle de ${nom}`} />
      ) : (
        <div className="grid h-full place-items-center px-2 text-center font-mono text-xs text-nuit-gris">
          {!entree ? "Pas encore connectée" : etat === "connecte" ? "Caméra coupée" : "Connexion…"}
        </div>
      )}
      {entree && etat === "reconnexion" && (
        <div className="absolute inset-0 grid place-items-center bg-black/60 font-mono text-xs text-white">Reconnexion…</div>
      )}
      <div className="absolute inset-x-2 top-2 flex justify-end gap-1">
        {entree?.reseauFaible && etat === "connecte" && (
          <span className="flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-orange-peche">
            <WifiOff className="h-3 w-3" /> réseau faible
          </span>
        )}
      </div>
      <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2">
        <Etiquette className={cn(!entree && "text-nuit-gris")}>{nom}</Etiquette>
        {parole && <span className="rounded-md bg-orange px-1.5 py-1 text-[11px] font-extrabold text-encre">A la parole</span>}
        {entree && !entree.medias.micro && etat === "connecte" && !parole && <MicOff className="h-4 w-4 text-nuit-gris" aria-label="Micro de la salle coupé" />}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Salle de conférence et étudiant : grande image du formateur
// ════════════════════════════════════════════════════════════════════════════

function ScenePeripherie(p: PropsSceneVisioCampus & { role: "salle" | "etudiant"; moiId: number }) {
  const tu = p.role === "etudiant";
  const moteur = useRef<PeripherieVisio | null>(null);
  const racine = useRef<HTMLDivElement>(null);
  const rappels = useRef(p);
  rappels.current = p;
  const [vue, setVue] = useState<VuePeripherie | null>(null);
  const [sonBloque, setSonBloque] = useState(false);
  const [radio, setRadio] = useState(false);

  useEffect(() => {
    const m = new PeripherieVisio(p.seanceId, p.role, {
      maj: () => setVue(m.vue()),
      surEtat: (etat) => rappels.current.onEtat?.(etat),
    });
    moteur.current = m;
    setVue(m.vue());
    rappels.current.onEtat?.("connexion");
    return () => {
      moteur.current = null;
      m.arreter();
    };
  }, [p.seanceId, p.role]);

  useBrancherMoteur(p.moiId, p.seanceId, moteur);

  // Étudiant : le micro ne part que s'il a la parole.
  const aLaParole = p.role === "salle" || p.utilisateurALaParole == null || p.utilisateurALaParole === p.moiId;
  useEffect(() => {
    moteur.current?.definirMedias(p.micro, p.camera, aLaParole);
  }, [p.micro, p.camera, aLaParole, p.seanceId, p.role]);

  useEffect(() => {
    moteur.current?.definirAudioSeul(Boolean(p.audioSeul));
  }, [p.audioSeul, p.seanceId, p.role]);

  if (!vue) return null;

  // Plus de place en visio, ou connexion impossible et l'étudiant a choisi la radio.
  if (tu && (vue.complet || radio)) {
    return (
      <div className={cn("flex w-full flex-col items-center justify-center gap-4 rounded-[22px] bg-nuit p-5 text-center text-white", p.className)}>
        <p className="max-w-md text-[15px] text-nuit-doux">
          {vue.complet ? "La classe en visio est complète : tu écoutes le cours à la radio, avec le même son." : "Tu écoutes le cours à la radio."}
        </p>
        <LecteurRadio seanceId={p.seanceId} nuit />
        {!vue.complet && (
          <button className="min-h-[48px] px-4 text-sm font-bold text-orange underline underline-offset-4" onClick={() => setRadio(false)}>
            Revenir à la visio
          </button>
        )}
      </div>
    );
  }

  const pastille = pastilleDe(vue.etat, vue.attenteFormateur);
  const video = vue.formateur.camera ? vue.formateur.video : null;
  const texteSansImage = vue.attenteFormateur
    ? tu
      ? "Le cours commence dès que le formateur arrive."
      : "La classe commence dès que le formateur arrive."
    : vue.etat !== "connecte"
      ? "Connexion au formateur…"
      : !vue.videoAccordee && tu
        ? "Toutes les places vidéo sont prises : tu reçois le son du formateur."
        : p.audioSeul && tu
          ? "Son seul : tu économises tes données."
          : "Le formateur a coupé sa caméra.";

  const relaisVisible = Boolean(vue.relaisVideoSalle && vue.parole.salle);
  let bandeau: string | null = null;
  if (vue.parole.vous) bandeau = tu ? "Tu as la parole : parle, le formateur t'entend." : "Vous avez la parole : parlez près du micro.";
  // L'image relayée porte déjà « M'Batto a la parole » : pas de doublon.
  else if (vue.parole.salle && !relaisVisible) bandeau = `${vue.parole.salle} a la parole`;
  else if (vue.parole.etudiant) bandeau = "Un étudiant en ligne a la parole";

  return (
    <div ref={racine} className={cn("relative aspect-video w-full overflow-hidden rounded-[22px] bg-nuit text-white", p.className)}>
      {vue.sons.map((s) => (
        <Son key={s.id} piste={s.piste} onBloque={() => setSonBloque(true)} />
      ))}

      {video ? (
        <Video piste={video} ajuster="contain" libelle="Image du formateur" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-orange text-encre sm:h-20 sm:w-20">
            <Radio className="h-8 w-8" />
          </span>
          <p className="max-w-sm text-[15px] text-nuit-doux sm:text-base">{texteSansImage}</p>
        </div>
      )}

      <div className="absolute left-2.5 top-2.5 flex flex-wrap items-center gap-2 sm:left-4 sm:top-4">
        <Pastille ton={pastille.ton}>{pastille.texte}</Pastille>
        {vue.local.micro && (
          <span className="flex items-center gap-1 rounded-full bg-orange px-2.5 py-1.5 font-mono text-xs font-bold text-encre">
            <Mic className="h-3.5 w-3.5" /> micro ouvert
          </span>
        )}
      </div>

      {/* La salle se voit en petit : elle sait ce que le formateur voit. */}
      {p.role === "salle" && vue.local.video && (
        <div className="absolute right-2.5 top-2.5 aspect-video w-24 overflow-hidden rounded-xl border-2 border-nuit-ligne sm:right-4 sm:top-4 sm:w-44">
          <Video piste={vue.local.video} miroir libelle="Image de votre salle" />
        </div>
      )}

      {/* Relais : la salle qui a la parole, visible des autres salles. */}
      {relaisVisible && vue.relaisVideoSalle && (
        <div className="absolute bottom-2.5 right-2.5 aspect-video w-32 overflow-hidden rounded-xl border-2 border-orange sm:bottom-4 sm:right-4 sm:w-64">
          <Video piste={vue.relaisVideoSalle} libelle={`Salle de ${vue.parole.salle}`} />
          <span className="absolute inset-x-0 bottom-0 bg-orange px-2 py-1 text-center text-[11px] font-extrabold uppercase tracking-wide text-encre sm:text-xs">
            {vue.parole.salle} a la parole
          </span>
        </div>
      )}

      {(bandeau || vue.message || vue.erreurMedia) && vue.etat !== "echec" && (
        <div className="absolute bottom-2.5 left-2.5 max-w-[60%] sm:bottom-4 sm:left-4">
          {bandeau ? (
            <span className={cn("block rounded-xl px-3 py-2 text-sm font-bold sm:text-base", vue.parole.vous ? "bg-orange text-encre" : "bg-black/70 text-white")}>{bandeau}</span>
          ) : (
            <span className="block rounded-xl bg-black/70 px-3 py-2 text-sm text-nuit-texte">{vue.erreurMedia ?? vue.message}</span>
          )}
        </div>
      )}

      {vue.etat === "echec" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/75 p-5 text-center">
          <p className="max-w-md text-[15px] sm:text-base">{vue.message ?? "La connexion n'aboutit pas."}</p>
          {tu && (
            <Bouton icone={<Radio className="h-4 w-4" />} onClick={() => setRadio(true)} className="min-h-[48px]">
              Écouter à la radio
            </Bouton>
          )}
        </div>
      )}

      {sonBloque && (
        <BoutonActiverSon
          tu={tu}
          onClick={() => {
            relancerSons(racine.current);
            setSonBloque(false);
          }}
        />
      )}
    </div>
  );
}
