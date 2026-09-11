// Annonce temporaire : passage du Groupe 2IAE au JT de Business 24 Africa
// (Journée d'Excellence BTS 2026 — 4 distinctions), diffusé le jeudi
// 10 septembre 2026 à 21 h et 23 h GMT, rediffusions le vendredi 11 jusqu'à
// 14 h GMT. Le bandeau et la section disparaissent automatiquement après la
// dernière rediffusion — aucun retrait manuel.
const FIN_ANNONCE = new Date("2026-09-11T15:30:00Z"); // 15 h 30, heure d'Abidjan

export function annonceRtiActive(): boolean {
  return Date.now() < FIN_ANNONCE.getTime();
}

/** Bandeau site entier, au-dessus de l'en-tête. */
export function BandeauRTI() {
  if (!annonceRtiActive()) return null;
  return (
    <div className="bg-[#0d2c54] text-white text-center px-4 py-2.5 text-sm font-semibold">
      📺 <span className="text-[#F0A868]">2IAE au JT de Business 24 Africa</span> —
      4 distinctions à la Journée d'Excellence BTS 2026 ! Rediffusions
      aujourd'hui à 12 h et 14 h GMT (canal 259 · TV d'Orange 30 ·
      business24tv.com).
    </div>
  );
}

/** Annonce sur la page d'accueil, juste sous le héros. */
export function AfficheRTI() {
  if (!annonceRtiActive()) return null;
  return (
    <section className="py-10 bg-[#0d2c54]">
      <div className="container mx-auto px-4 grid md:grid-cols-2 gap-8 items-center max-w-5xl">
        <img
          src="/images/prix-meilleur-fondateur-presse.jpg"
          alt="Le fondateur du Groupe 2IAE interviewé par la presse, dont Business 24 Africa, lors de la Journée d'Excellence BTS 2026"
          className="w-full rounded-xl shadow-2xl"
          data-testid="img-affiche-rti"
        />
        <div className="text-white text-center md:text-left">
          <p className="text-xs tracking-[0.25em] uppercase text-[#F0A868] mb-3">
            Vu au JT · Business 24 Africa · Canal 259
          </p>
          <h2 className="font-serif text-3xl md:text-4xl leading-tight mb-4">
            Journée d'Excellence BTS 2026 : 2IAE s'illustre avec 4 distinctions.
          </h2>
          <p className="text-white/85 leading-relaxed mb-4">
            Le Groupe 2IAE était au journal télévisé de Business 24 Africa ce
            jeudi 10 septembre à 21 h. Vous l'avez manqué ? Rediffusions
            aujourd'hui à <strong>12 h</strong> et <strong>14 h GMT</strong> sur
            Business 24 Africa — canal 259, TV d'Orange 30, et en ligne sur
            business24tv.com.
          </p>
          <p className="text-white/70 text-sm">
            Quand la télévision économique nationale parle d'excellence BTS,
            c'est de 2IAE qu'elle parle. Invitez vos proches à regarder !
          </p>
        </div>
      </div>
    </section>
  );
}
