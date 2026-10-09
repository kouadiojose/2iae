// Carte « Ton campus en vidéo » de l'accueil étudiant (demandes de José, 9 octobre 2026) : les films d'animation
// « Une semaine avec Amenan » (devoirs, note du campus, relecture) et « Amenan révise » (cours résumé, quiz, fiches,
// révision du jour, bibliothécaire, assistant). Une vidéo ne se charge qu'au toucher (petits forfaits) ; l'étudiant
// peut masquer la carte, le choix reste sur ce téléphone (et revient quand une nouvelle vidéo arrive).
import { useState } from "react";
import { Play, X } from "lucide-react";
import { cn } from "@/lib/utils";

const VIDEOS = [
  { id: "semaine", titre: "Une semaine avec Amenan", sujet: "Rendre ton devoir au téléphone, recevoir ta note, demander une relecture.", duree: "2 min 51", poids: "14 Mo", src: "/videos/campus-etudiants.mp4", affiche: "/videos/campus-etudiants.jpg" },
  { id: "revise", titre: "Amenan révise", sujet: "Le cours résumé, les quiz et fiches mémo, la révision du jour, le bibliothécaire et l'assistant.", duree: "2 min 35", poids: "13 Mo", src: "/videos/campus-etudiants-2.mp4", affiche: "/videos/campus-etudiants-2.jpg" },
];
/** Changer de clé fait revenir la carte chez ceux qui l'avaient masquée (nouvelle vidéo). */
const CLE = "video-campus-etudiants-masquee-2";

function lireMasquee() {
  try {
    return localStorage.getItem(CLE) === "1";
  } catch {
    return false;
  }
}

export function CarteVideoCampus() {
  const [masquee, setMasquee] = useState(lireMasquee);
  const [choix, setChoix] = useState(VIDEOS[VIDEOS.length - 1].id);
  const [lecture, setLecture] = useState(false);
  if (masquee) return null;
  const video = VIDEOS.find((v) => v.id === choix) ?? VIDEOS[0];
  const masquer = () => {
    try {
      localStorage.setItem(CLE, "1");
    } catch {
      /* navigation privée : la carte reviendra, sans gêner */
    }
    setMasquee(true);
  };
  return (
    <section aria-labelledby="titre-video-campus" className="flex flex-col gap-3 rounded-2xl border border-ligne bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id="titre-video-campus" className="text-[17px] font-extrabold leading-snug">
            Ton campus en vidéo
          </h2>
          <p className="text-sm text-texte-pale">Deux films de 3 minutes, avec le son.</p>
        </div>
        <button type="button" onClick={masquer} className="-m-1.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-texte-gris hover:bg-creme hover:text-encre" aria-label="Masquer les vidéos">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Choisir une vidéo">
        {VIDEOS.map((v, i) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={v.id === choix}
            onClick={() => {
              setChoix(v.id);
              setLecture(false);
            }}
            className={cn("flex min-h-[56px] flex-col items-start rounded-xl border px-3 py-2 text-left", v.id === choix ? "border-orange bg-orange-pale" : "border-ligne bg-white hover:border-orange")}
          >
            <span className="font-mono text-[11px] font-semibold text-orange-fonce">Vidéo {i + 1} · {v.duree}</span>
            <span className="text-sm font-bold leading-snug">{v.titre}</span>
          </button>
        ))}
      </div>
      <p className="text-sm text-texte-doux">{video.sujet}</p>
      <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-xl bg-encre" style={{ aspectRatio: "9 / 16" }}>
        {lecture ? (
          <video key={video.id} src={video.src} poster={video.affiche} controls autoPlay playsInline preload="none" className="h-full w-full" />
        ) : (
          <button type="button" onClick={() => setLecture(true)} className="group relative block h-full w-full" aria-label={`Lire la vidéo ${video.titre}`}>
            <img src={video.affiche} alt="" className="h-full w-full object-cover" loading="lazy" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-orange text-white shadow-lg transition-transform group-hover:scale-105">
                <Play className="ml-1 h-7 w-7" aria-hidden />
              </span>
            </span>
          </button>
        )}
      </div>
      <p className="text-center text-xs text-texte-gris">Avec le son · {video.duree} · {video.poids} : en Wi-Fi si ton forfait est petit.</p>
    </section>
  );
}
