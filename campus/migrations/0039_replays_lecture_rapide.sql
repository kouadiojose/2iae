-- Replays réécrits pour démarrer tout de suite (index en tête du fichier) : null = pas encore vérifié.
ALTER TABLE "campus"."replays_stockes" ADD COLUMN IF NOT EXISTS "lecture_rapide" boolean;
