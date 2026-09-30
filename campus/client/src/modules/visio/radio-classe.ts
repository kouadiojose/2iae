// Radio de TOUTE la classe (visio Daily) : les étudiants qui suivent en
// « son + diapos » entendent aussi les salles, les intervenants et les
// discussions, pas seulement le formateur.
//
// Dans le navigateur de celui qui anime, un second appel Daily, INVISIBLE
// (ni vu ni compté par les autres, il n'envoie rien), s'abonne au son de
// chaque participant, sauf celui du formateur lui-même (son micro est déjà
// branché, sans le retard de la visio). Le mélangeur réunit tout en une
// piste : c'est elle que la radio diffuse.
//
// Prudence : tant que l'écoute n'est pas prête (ou si elle échoue, ou si le
// son du navigateur attend un clic), la radio garde le micro seul, comme
// avant. Jamais de radio muette à cause du mélange.
import { useEffect, useRef, useState } from "react";
import type { DailyCall, DailyParticipant } from "@daily-co/daily-js";
import { post } from "@/lib/api";
import type { AccesDaily } from "@shared/schema";
import { chargerDaily } from "./daily";
import { MelangeurClasse } from "./moteur/melange";

export function useRadioClasse(o: {
  seanceId: number;
  /** Visio Daily en cours (sinon, rien à écouter : le micro seul). */
  actif: boolean;
  /** Micro du formateur pour la radio. */
  micro: MediaStream | null;
  /** Compte qui anime : sa propre voix vient de son micro, pas de la visio. */
  moiId: number;
}): { flux: MediaStream | null; classe: boolean } {
  const [pret, setPret] = useState(false);
  const melangeur = useRef<MelangeurClasse | null>(null);
  const pisteMicro = o.micro?.getAudioTracks()[0] ?? null;
  const possible = o.actif && typeof AudioContext !== "undefined";

  useEffect(() => {
    if (!possible) return;
    let fini = false;
    let call: DailyCall | null = null;
    let rejoint = false;
    const m = new MelangeurClasse();
    melangeur.current = m;
    m.brancherMicro(pisteMicro);
    const exclu = String(o.moiId);
    const verifier = () => {
      if (!fini) setPret(rejoint && m.enMarche);
    };
    m.surChangement(verifier);
    // Page rechargée en plein cours : le son du navigateur démarre au premier clic ou à la première touche.
    const reveil = () => void m.reprendre().then(verifier);
    window.addEventListener("pointerdown", reveil);
    window.addEventListener("keydown", reveil);
    void m.reprendre().then(verifier);

    const suivre = (p: DailyParticipant | null | undefined) => {
      if (!p || p.local || p.user_id === exclu || !call) return;
      if (p.tracks.audio.subscribed !== true) {
        call.updateParticipant(p.session_id, { setSubscribedTracks: { audio: true, video: false, screenVideo: false, screenAudio: false } });
      }
      const piste = p.tracks.audio.persistentTrack;
      if (piste && p.tracks.audio.state === "playable") m.ajouter(p.session_id, piste);
    };

    void (async () => {
      try {
        const acces = await post<AccesDaily>(`/api/seances/${o.seanceId}/radio-visio`);
        const Daily = await chargerDaily();
        if (fini) return;
        call = Daily.createCallObject({ allowMultipleCallInstances: true, subscribeToTracksAutomatically: false, audioSource: false, videoSource: false });
        call.on("participant-joined", (ev) => suivre(ev?.participant));
        call.on("participant-updated", (ev) => suivre(ev?.participant));
        call.on("participant-left", (ev) => ev && m.retirer(ev.participant.session_id));
        call.on("track-started", (ev) => {
          const p = ev?.participant;
          if (p && !p.local && p.user_id !== exclu && ev.track.kind === "audio") m.ajouter(p.session_id, ev.track);
        });
        call.on("track-stopped", (ev) => {
          if (ev?.participant && ev.track.kind === "audio") m.retirer(ev.participant.session_id);
        });
        await call.join({ url: acces.url, token: acces.jeton, startAudioOff: true, startVideoOff: true });
        if (fini) return;
        rejoint = true;
        Object.values(call.participants()).forEach(suivre);
        verifier();
      } catch {
        /* écoute impossible : la radio garde le micro seul */
      }
    })();

    return () => {
      fini = true;
      window.removeEventListener("pointerdown", reveil);
      window.removeEventListener("keydown", reveil);
      setPret(false);
      if (melangeur.current === m) melangeur.current = null;
      const c = call;
      call = null;
      if (c) void c.leave().catch(() => undefined).finally(() => void c.destroy().catch(() => undefined));
      m.fermer();
    };
    // Le micro se rebranche à part (effet suivant) : changer de micro ne relance pas l'écoute de la classe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [possible, o.seanceId, o.moiId]);

  useEffect(() => {
    melangeur.current?.brancherMicro(pisteMicro);
  }, [pisteMicro]);

  if (possible && pret && melangeur.current) return { flux: melangeur.current.flux, classe: true };
  return { flux: o.micro, classe: false };
}
