// Préchargement de la révision du jour (chantier C1), appelé par l'objectif du
// jour (C2) quand il propose la révision, et par le campus au démarrage chez un
// étudiant qui révise déjà : l'écran et le paquet de cartes du jour sont déjà
// sur le téléphone quand il touche « Révision du jour », même si le réseau
// tombe entre-temps. Au plus un téléchargement du paquet par jour ; les
// réponses restées en attente partent au passage. Rien ne se charge ici tant
// qu'on ne l'appelle pas : l'accueil reste léger.
export function prechargerRevision(): void {
  void import("./paquet")
    .then(async ({ moiCourant, lirePaquet, jourDuTelephone, telechargerPaquet, envoyerReponses }) => {
      const moi = moiCourant();
      if (!moi || moi.role !== "etudiant") return;
      void import("./PageReviser").catch(() => undefined);
      if (!navigator.onLine) return;
      await envoyerReponses();
      const local = lirePaquet(moi.id);
      if (!local || local.jour !== jourDuTelephone(moi.fuseau)) await telechargerPaquet(moi.id);
    })
    .catch(() => undefined);
}
