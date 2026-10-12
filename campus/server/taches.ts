// Tâches de fond (rappels avant les lives, passage des séances en « terminée »…).
// Chaque module ajoute ses tâches ici via planifier().
type Tache = { nom: string; toutesLesMs: number; fn: () => Promise<void> };
const taches: Tache[] = [];
/** Réveil de chaque tâche démarrée (reveiller), par son nom. */
const reveils = new Map<string, () => void>();

export function planifier(nom: string, toutesLesMs: number, fn: () => Promise<void>) {
  taches.push({ nom, toutesLesMs, fn });
}

/**
 * Lance tout de suite un passage de la tâche (par exemple « correction-copies » quand la direction remet des
 * copies en correction), sans attendre son intervalle. Un passage en cours n'est pas doublé : un nouveau passage
 * part dès qu'il finit. Sans effet avant demarrerTaches (scripts, essais). Vrai si la tâche est démarrée.
 */
export function reveiller(nom: string): boolean {
  const reveil = reveils.get(nom);
  reveil?.();
  return Boolean(reveil);
}

export function demarrerTaches() {
  for (const t of taches) {
    // Un passage plus long que l'intervalle n'en lance pas un second en même temps.
    let enCours = false;
    let encore = false;
    const lancer = () => {
      if (enCours) return;
      enCours = true;
      t.fn()
        .catch((e) => console.error(`[tâche ${t.nom}]`, (e as Error).message))
        .finally(() => {
          enCours = false;
          // Réveillée pendant le passage : un nouveau passage, pour ce qui est arrivé entre-temps.
          if (encore) {
            encore = false;
            lancer();
          }
        });
    };
    reveils.set(t.nom, () => {
      if (enCours) encore = true;
      else lancer();
    });
    setTimeout(lancer, 5_000).unref();
    setInterval(lancer, t.toutesLesMs).unref();
  }
}
