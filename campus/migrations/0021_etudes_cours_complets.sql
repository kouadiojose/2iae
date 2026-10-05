CREATE TABLE "campus"."devoirs_seances" (
	"seance_id" integer PRIMARY KEY NOT NULL,
	"devoir_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"corriges" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."etudes_livres" (
	"livre_id" integer PRIMARY KEY NOT NULL,
	"statut" text NOT NULL,
	"etape" text,
	"progression" integer DEFAULT 0 NOT NULL,
	"dossier" jsonb,
	"caracteres" integer,
	"cout_micro" integer DEFAULT 0 NOT NULL,
	"demande_par" integer,
	"message" text,
	"debut" timestamp with time zone DEFAULT now() NOT NULL,
	"fin" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "campus"."etudes_seances" (
	"seance_id" integer PRIMARY KEY NOT NULL,
	"statut" text NOT NULL,
	"etape" text,
	"progression" integer DEFAULT 0 NOT NULL,
	"dossier" jsonb,
	"cout_micro" integer DEFAULT 0 NOT NULL,
	"message" text,
	"debut" timestamp with time zone DEFAULT now() NOT NULL,
	"fin" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "campus"."reponses_livres" (
	"id" serial PRIMARY KEY NOT NULL,
	"livre_id" integer NOT NULL,
	"cle" text NOT NULL,
	"question" text NOT NULL,
	"reponse" text NOT NULL,
	"utilisations" integer DEFAULT 0 NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."transcriptions_replays" (
	"enregistrement_id" text PRIMARY KEY NOT NULL,
	"seance_id" integer NOT NULL,
	"numero" integer DEFAULT 1 NOT NULL,
	"decalage_secondes" integer DEFAULT 0 NOT NULL,
	"travail_id" text,
	"statut" text NOT NULL,
	"essais" integer DEFAULT 0 NOT NULL,
	"message" text,
	"debut" timestamp with time zone DEFAULT now() NOT NULL,
	"fin" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "campus"."devoirs_seances" ADD CONSTRAINT "devoirs_seances_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."etudes_livres" ADD CONSTRAINT "etudes_livres_livre_id_livres_id_fk" FOREIGN KEY ("livre_id") REFERENCES "campus"."livres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."etudes_livres" ADD CONSTRAINT "etudes_livres_demande_par_utilisateurs_id_fk" FOREIGN KEY ("demande_par") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."etudes_seances" ADD CONSTRAINT "etudes_seances_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."reponses_livres" ADD CONSTRAINT "reponses_livres_livre_id_livres_id_fk" FOREIGN KEY ("livre_id") REFERENCES "campus"."livres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."transcriptions_replays" ADD CONSTRAINT "transcriptions_replays_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reponses_livres_cle_idx" ON "campus"."reponses_livres" USING btree ("livre_id","cle");--> statement-breakpoint
CREATE INDEX "transcriptions_replays_seance_idx" ON "campus"."transcriptions_replays" USING btree ("seance_id");