// Annonce temporaire : diffusion de l'émission du fondateur (RDV de la 1)
// le 3 septembre 2026 à 14 h GMT sur RTI 1. Le bandeau et la section
// disparaissent automatiquement après la diffusion — aucun retrait manuel.
const FIN_ANNONCE = new Date("2026-09-03T15:30:00Z"); // 15 h 30, heure d'Abidjan

export function annonceRtiActive(): boolean {
  return Date.now() < FIN_ANNONCE.getTime();
}

/** Bandeau site entier, au-dessus de l'en-tête. */
export function BandeauRTI() {
  if (!annonceRtiActive()) return null;
  return (
    <div className="bg-[#0d2c54] text-white text-center px-4 py-2.5 text-sm font-semibold">
      📺 <span className="text-[#F0A868]">AUJOURD'HUI à 14 h sur RTI 1</span> —
      diffusion de l'émission avec le fondateur du Groupe 2IAE : un message
      important pour les nouveaux bacheliers 2026. Soyez devant votre écran !
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
          src="/images/rti-interview-plateau.jpg"
          alt="Le fondateur du Groupe 2IAE en interview sur le plateau du RDV de la 1 (RTI)"
          className="w-full rounded-xl shadow-2xl"
          data-testid="img-affiche-rti"
        />
        <div className="text-white text-center md:text-left">
          <p className="text-xs tracking-[0.25em] uppercase text-[#F0A868] mb-3">
            Ne pas manquer · Aujourd'hui à 14 h · RTI 1
          </p>
          <h2 className="font-serif text-3xl md:text-4xl leading-tight mb-4">
            Le fondateur du Groupe 2IAE au RDV de la 1.
          </h2>
          <p className="text-white/85 leading-relaxed">
            Nouveaux bacheliers 2026 : le fondateur a une information
            importante à vous passer — nos écoles, nos filières, les
            opportunités de formation et sa vision pour votre avenir.
            Rendez-vous sur RTI 1 à 14 h, et invitez vos amis à regarder !
          </p>
        </div>
      </div>
    </section>
  );
}
