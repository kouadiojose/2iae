-- Devoir en direct (demande de José du 12 octobre 2026) : devoir donné pendant le direct depuis le Studio,
-- rendu depuis la classe, une réponse par groupe possible. Idempotente : jouée à chaque démarrage.
CREATE TABLE IF NOT EXISTS "campus"."devoirs_direct" (
	"devoir_id" integer PRIMARY KEY NOT NULL,
	"seance_id" integer NOT NULL,
	"en_groupe" boolean DEFAULT false NOT NULL,
	"session_groupes_id" integer,
	"cree_par_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campus"."rendus" ADD COLUMN IF NOT EXISTS "pour_groupe" jsonb;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."devoirs_direct" ADD CONSTRAINT "devoirs_direct_devoir_id_devoirs_id_fk" FOREIGN KEY ("devoir_id") REFERENCES "campus"."devoirs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."devoirs_direct" ADD CONSTRAINT "devoirs_direct_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."devoirs_direct" ADD CONSTRAINT "devoirs_direct_session_groupes_id_sessions_groupes_id_fk" FOREIGN KEY ("session_groupes_id") REFERENCES "campus"."sessions_groupes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."devoirs_direct" ADD CONSTRAINT "devoirs_direct_cree_par_id_utilisateurs_id_fk" FOREIGN KEY ("cree_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "devoirs_direct_seance_idx" ON "campus"."devoirs_direct" USING btree ("seance_id","cree_le");
