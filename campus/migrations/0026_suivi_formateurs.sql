-- Côté formateur (plan d'engagement, chantier C7) : 0030_suivi_formateurs dans
-- l'ordre de fusion (campus/ENGAGEMENT.md). Idempotente, aucune donnée modifiée.
CREATE TABLE IF NOT EXISTS "campus"."validations_devoirs_auto" (
	"devoir_id" integer PRIMARY KEY NOT NULL,
	"statut" text NOT NULL,
	"par_id" integer,
	"le" timestamp with time zone DEFAULT now() NOT NULL,
	"remarque" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campus"."travaux_groupe_devoirs" (
	"seance_id" integer PRIMARY KEY NOT NULL,
	"devoir_id" integer NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."validations_devoirs_auto" ADD CONSTRAINT "validations_devoirs_auto_devoir_id_devoirs_id_fk" FOREIGN KEY ("devoir_id") REFERENCES "campus"."devoirs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."validations_devoirs_auto" ADD CONSTRAINT "validations_devoirs_auto_par_id_utilisateurs_id_fk" FOREIGN KEY ("par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."travaux_groupe_devoirs" ADD CONSTRAINT "travaux_groupe_devoirs_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."travaux_groupe_devoirs" ADD CONSTRAINT "travaux_groupe_devoirs_devoir_id_devoirs_id_fk" FOREIGN KEY ("devoir_id") REFERENCES "campus"."devoirs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "travaux_groupe_devoirs_devoir_idx" ON "campus"."travaux_groupe_devoirs" USING btree ("devoir_id");
