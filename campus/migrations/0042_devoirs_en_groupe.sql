-- Devoirs en groupe (novembre 2026) : le formateur coche « Devoir en groupe » et fixe la taille maximale (2 à 6) ;
-- les étudiants forment eux-mêmes leurs groupes (tous campus, mêmes inscrits du cours), un membre rend la copie pour
-- tout le groupe (rendus.pour_groupe avec "source": "devoir"). Chaque groupe a sa discussion (conversation de type
-- « groupe »). Idempotente : jouée à chaque démarrage ; aucune donnée reprise.
ALTER TABLE "campus"."devoirs" ADD COLUMN IF NOT EXISTS "en_groupe" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "campus"."devoirs" ADD COLUMN IF NOT EXISTS "taille_groupe_max" integer DEFAULT 3 NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campus"."groupes_devoir" (
	"id" serial PRIMARY KEY NOT NULL,
	"devoir_id" integer NOT NULL,
	"nom" text NOT NULL,
	"cree_par_id" integer,
	"conversation_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campus"."membres_groupe_devoir" (
	"groupe_id" integer NOT NULL,
	"devoir_id" integer NOT NULL,
	"etudiant_id" integer NOT NULL,
	"rejoint_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membres_groupe_devoir_groupe_id_etudiant_id_pk" PRIMARY KEY("groupe_id","etudiant_id")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."groupes_devoir" ADD CONSTRAINT "groupes_devoir_devoir_id_devoirs_id_fk" FOREIGN KEY ("devoir_id") REFERENCES "campus"."devoirs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."groupes_devoir" ADD CONSTRAINT "groupes_devoir_cree_par_id_utilisateurs_id_fk" FOREIGN KEY ("cree_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."groupes_devoir" ADD CONSTRAINT "groupes_devoir_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "campus"."conversations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."membres_groupe_devoir" ADD CONSTRAINT "membres_groupe_devoir_groupe_id_groupes_devoir_id_fk" FOREIGN KEY ("groupe_id") REFERENCES "campus"."groupes_devoir"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."membres_groupe_devoir" ADD CONSTRAINT "membres_groupe_devoir_devoir_id_devoirs_id_fk" FOREIGN KEY ("devoir_id") REFERENCES "campus"."devoirs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."membres_groupe_devoir" ADD CONSTRAINT "membres_groupe_devoir_etudiant_id_utilisateurs_id_fk" FOREIGN KEY ("etudiant_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "groupes_devoir_devoir_idx" ON "campus"."groupes_devoir" USING btree ("devoir_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "membres_groupe_devoir_unique" ON "campus"."membres_groupe_devoir" USING btree ("devoir_id","etudiant_id");
