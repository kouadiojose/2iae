// Carte « Ton campus en 3 minutes » de l'accueil étudiant (demande de José, 9 octobre 2026) : le film d'animation
// « Une semaine avec Amenan » (devoirs, note du campus, relecture). La vidéo ne se charge qu'au toucher (petits
// forfaits) ; l'étudiant peut masquer la carte, le choix reste sur ce téléphone.
import { useState } from "react";
import { Play, X } from "lucide-react";

const VIDEO = "/videos/campus-etudiants.mp4";
const AFFICHE = "/videos/campus-etudiants.jpg";
const CLE = "video-campus-etudiants-masquee";

function lireMasquee() {
  try {
    return localStorage.getItem(CLE) === "1";
  } catch {
    return false;
  }
}

export function CarteVideoCampus() {
  const [masquee, setMasquee] = useState(lireMasquee);
  const [lecture, setLecture] = useState(false);
  if (masquee) return null;
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
            Ton campus en 3 minutes
          </h2>
          <p className="text-sm text-texte-pale">Une semaine avec Amenan : rendre ton devoir au téléphone, recevoir ta note, demander une relecture.</p>
        </div>
        <button type="button" onClick={masquer} className="-m-1.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-texte-gris hover:bg-creme hover:text-encre" aria-label="Masquer la vidéo">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-xl bg-encre" style={{ aspectRatio: "9 / 16" }}>
        {lecture ? (
          <video src={VIDEO} poster={AFFICHE} controls autoPlay playsInline preload="none" className="h-full w-full" />
        ) : (
          <button type="button" onClick={() => setLecture(true)} className="group relative block h-full w-full" aria-label="Lire la vidéo Ton campus en 3 minutes">
            <img src={AFFICHE} alt="" className="h-full w-full object-cover" loading="lazy" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-orange text-white shadow-lg transition-transform group-hover:scale-105">
                <Play className="ml-1 h-7 w-7" aria-hidden />
              </span>
            </span>
          </button>
        )}
      </div>
      <p className="text-center text-xs text-texte-gris">Avec le son · 2 min 51 · 14 Mo : en Wi-Fi si ton forfait est petit.</p>
    </section>
  );
}
