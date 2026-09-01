// Annonce temporaire : passage du fondateur sur la RTI le 1er septembre 2026
// à 11 h 30. Le bandeau et l'affiche disparaissent automatiquement après
// l'émission — aucun retrait manuel à prévoir.
const FIN_ANNONCE = new Date("2026-09-01T13:00:00Z"); // 13 h, heure d'Abidjan

export function annonceRtiActive(): boolean {
  return Date.now() < FIN_ANNONCE.getTime();
}

/** Bandeau site entier, au-dessus de l'en-tête. */
export function BandeauRTI() {
  if (!annonceRtiActive()) return null;
  return (
    <div className="bg-[#0d2c54] text-white text-center px-4 py-2.5 text-sm font-semibold">
      📺 <span className="text-[#F0A868]">AUJOURD'HUI à 11 h 30</span> — le
      fondateur du Groupe 2IAE est l'invité de la RTI : toutes les infos sur
      nos écoles, nos filières et la rentrée. Soyez au rendez-vous !
    </div>
  );
}

/** Affiche officielle sur la page d'accueil, juste sous le héros. */
export function AfficheRTI() {
  if (!annonceRtiActive()) return null;
  return (
    <section className="py-10 bg-[#0d2c54]">
      <div className="container mx-auto px-4 grid md:grid-cols-2 gap-8 items-center max-w-5xl">
        <img
          src="/images/affiche-rti-fondateur.jpg"
          alt="Info urgente : le fondateur du Groupe 2IAE passe aujourd'hui à 11 h 30 sur la RTI"
          className="w-full max-w-sm mx-auto rounded-xl shadow-2xl"
          data-testid="img-affiche-rti"
        />
        <div className="text-white text-center md:text-left">
          <p className="text-xs tracking-[0.25em] uppercase text-[#F0A868] mb-3">
            Ne pas manquer · Aujourd'hui à 11 h 30
          </p>
          <h2 className="font-serif text-3xl md:text-4xl leading-tight mb-4">
            Le fondateur du Groupe 2IAE en direct sur la RTI.
          </h2>
          <p className="text-white/85 leading-relaxed">
            Une intervention exceptionnelle pour découvrir nos écoles, nos
            filières, les opportunités de formation et les ambitions du groupe
            pour votre avenir. Rendez-vous devant la RTI à 11 h 30 — et pour
            toute question après l'émission, notre équipe vous répond ici même.
          </p>
        </div>
      </div>
    </section>
  );
}
