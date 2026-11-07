-- Séances de rattrapage proposées par le formateur (« Proposer un rattrapage », novembre 2026) : une séance comme les
-- autres (même classe en direct, replay, transcription), ouverte à tous les étudiants du cours, mais FACULTATIVE :
-- ne pas y venir n'est jamais une absence (engagement/presence.ts : sqlCaseEtat ; routes/admin.ts : sqlAttendus).
-- Idempotente : jouée à chaque démarrage ; les séances existantes restent des cours.
--   nature        : 'cours' (par défaut) ou 'rattrapage' ;
--   rattrapage_de : la séance qu'elle rattrape, au choix du formateur (vide sinon, ou si elle est supprimée).
ALTER TABLE "campus"."seances" ADD COLUMN IF NOT EXISTS "nature" text DEFAULT 'cours' NOT NULL;
--> statement-breakpoint
ALTER TABLE "campus"."seances" ADD COLUMN IF NOT EXISTS "rattrapage_de" integer;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."seances" ADD CONSTRAINT "seances_rattrapage_de_seances_id_fk" FOREIGN KEY ("rattrapage_de") REFERENCES "campus"."seances"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
