// Tâches de fond (rappels avant les lives, passage des séances en « terminée »…).
// Chaque module ajoute ses tâches ici via planifier().
type Tache = { nom: string; toutesLesMs: number; fn: () => Promise<void> };
const taches: Tache[] = [];

export function planifier(nom: string, toutesLesMs: number, fn: () => Promise<void>) {
  taches.push({ nom, toutesLesMs, fn });
}

export function demarrerTaches() {
  for (const t of taches) {
    // Un passage plus long que l'intervalle n'en lance pas un second en même temps.
    let enCours = false;
    const lancer = () => {
      if (enCours) return;
      enCours = true;
      t.fn()
        .catch((e) => console.error(`[tâche ${t.nom}]`, (e as Error).message))
        .finally(() => (enCours = false));
    };
    setTimeout(lancer, 5_000).unref();
    setInterval(lancer, t.toutesLesMs).unref();
  }
}
