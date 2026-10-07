ALTER TABLE "campus"."ressources_seances" ADD COLUMN IF NOT EXISTS "annoncee_le" timestamp with time zone;--> statement-breakpoint
-- Vidéos et documents déjà en ligne : rien à annoncer, la notification vaut pour les prochains.
UPDATE "campus"."ressources_seances" SET "annoncee_le" = "cree_le" WHERE "annoncee_le" IS NULL;--> statement-breakpoint
-- Séances des 12 prochaines heures à la mise en ligne : leurs étudiants sont déjà prévenus ;
-- le rappel du jour (séance créée trop tard pour celui de la veille) vaut pour les suivantes.
INSERT INTO "campus"."rappels_live" ("seance_id", "type")
SELECT "id", 'jour' FROM "campus"."seances" WHERE "statut" = 'planifiee' AND "debut" < now() + interval '12 hours'
ON CONFLICT DO NOTHING;
