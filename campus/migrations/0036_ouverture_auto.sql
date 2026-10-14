-- Ouverture automatique des classes (demande de José du 14 octobre 2026 : « Par défaut ouvre automatiquement
-- tous les cours 30 mn avant ») : ce que la séance garde de son ouverture, pour que le cours commence à son heure
-- et que la classe sache si quelqu'un l'anime (routes/live.ts, shared/ouverture.ts). Idempotente : jouée à chaque
-- démarrage ; trois colonnes vides par défaut, rien à reprendre sur les séances existantes.
--   ouverture_auto : ce démarrage est l'ouverture automatique (pas un « Démarrer » à la main) ;
--   animateur_le   : classe ouverte automatiquement, arrivée du premier animateur (formateur du cours, ou direction
--                    qui « prend la classe ») ; vide tant que personne ne l'anime ;
--   debut_cours    : début du cours quand il n'est pas le démarrage (demarree_le) : l'heure prévue d'une classe
--                    ouverte en avance, ou l'instant où l'animateur a commencé (« Commencer le cours maintenant »,
--                    ou arrivée après l'heure). Vide : le cours commence au démarrage, comme avant.
ALTER TABLE "campus"."seances" ADD COLUMN IF NOT EXISTS "ouverture_auto" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "campus"."seances" ADD COLUMN IF NOT EXISTS "animateur_le" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "campus"."seances" ADD COLUMN IF NOT EXISTS "debut_cours" timestamp with time zone;
