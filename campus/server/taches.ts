// Tâches de fond (rappels avant les lives, passage des séances en « terminée »…).
// Chaque module ajoute ses tâches ici via planifier().
type Tache = { nom: string; toutesLesMs: number; fn: () => Promise<void> };
const taches: Tache[] = [];

export function planifier(nom: string, toutesLesMs: number, fn: () => Promise<void>) {
  taches.push({ nom, toutesLesMs, fn });
}

export function demarrerTaches() {
  for (const t of taches) {
    const lancer = () =>
      t.fn().catch((e) => console.error(`[tâche ${t.nom}]`, (e as Error).message));
    setTimeout(lancer, 5_000).unref();
    setInterval(lancer, t.toutesLesMs).unref();
  }
}
