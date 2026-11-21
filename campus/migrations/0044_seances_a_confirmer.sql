-- Démarrer sans question, ranger après ; réunions de l'équipe (21 novembre 2026).
ALTER TABLE "campus"."seances" ADD COLUMN IF NOT EXISTS "a_confirmer" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "campus"."seances" ADD COLUMN IF NOT EXISTS "confirmee_le" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "campus"."seances" ADD COLUMN IF NOT EXISTS "rappel_confirmation_le" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "campus"."seances" ADD COLUMN IF NOT EXISTS "lance_par_id" integer;
--> statement-breakpoint
ALTER TABLE "campus"."seances" ADD COLUMN IF NOT EXISTS "participants" integer[] DEFAULT '{}'::integer[] NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "campus"."seances" ADD CONSTRAINT "seances_lance_par_id_utilisateurs_id_fk" FOREIGN KEY ("lance_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "seances_a_confirmer_idx" ON "campus"."seances" ("a_confirmer") WHERE "a_confirmer";
