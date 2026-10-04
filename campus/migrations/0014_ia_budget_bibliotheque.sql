CREATE TABLE "campus"."exposes_biblio" (
	"id" serial PRIMARY KEY NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"livre_id" integer NOT NULL,
	"sujet" text NOT NULL,
	"contenu" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."livres" (
	"id" serial PRIMARY KEY NOT NULL,
	"cle" text NOT NULL,
	"titre" text NOT NULL,
	"auteurs" text DEFAULT '' NOT NULL,
	"annee" integer,
	"editeur" text,
	"isbn" text,
	"langue" text,
	"pages" integer,
	"couverture_url" text,
	"lien_catalogue" text,
	"description" text,
	"source" text,
	"fiche" jsonb,
	"fiche_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."notes_biblio" (
	"id" serial PRIMARY KEY NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"livre_id" integer NOT NULL,
	"contenu" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."recherches_biblio" (
	"id" serial PRIMARY KEY NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"sujet" text NOT NULL,
	"conseil" text DEFAULT '' NOT NULL,
	"resultats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."reglages_ia" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"budget_mensuel_usd" real DEFAULT 100 NOT NULL,
	"quota_etudiant" integer DEFAULT 20 NOT NULL,
	"quota_personnel" integer DEFAULT 60 NOT NULL,
	"alertes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_par_id" integer
);
--> statement-breakpoint
ALTER TABLE "campus"."cours" ADD COLUMN "ia_pause_jusqua" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campus"."cours" ADD COLUMN "ia_pause_motif" text;--> statement-breakpoint
ALTER TABLE "campus"."conversations_ia" ADD COLUMN "livre_id" integer;--> statement-breakpoint
ALTER TABLE "campus"."usage_ia" ADD COLUMN "cout_micro" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campus"."exposes_biblio" ADD CONSTRAINT "exposes_biblio_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."exposes_biblio" ADD CONSTRAINT "exposes_biblio_livre_id_livres_id_fk" FOREIGN KEY ("livre_id") REFERENCES "campus"."livres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."notes_biblio" ADD CONSTRAINT "notes_biblio_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."notes_biblio" ADD CONSTRAINT "notes_biblio_livre_id_livres_id_fk" FOREIGN KEY ("livre_id") REFERENCES "campus"."livres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."recherches_biblio" ADD CONSTRAINT "recherches_biblio_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."reglages_ia" ADD CONSTRAINT "reglages_ia_maj_par_id_utilisateurs_id_fk" FOREIGN KEY ("maj_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exposes_biblio_utilisateur_idx" ON "campus"."exposes_biblio" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE UNIQUE INDEX "livres_cle_idx" ON "campus"."livres" USING btree ("cle");--> statement-breakpoint
CREATE INDEX "notes_biblio_utilisateur_idx" ON "campus"."notes_biblio" USING btree ("utilisateur_id","livre_id");--> statement-breakpoint
CREATE INDEX "recherches_biblio_utilisateur_idx" ON "campus"."recherches_biblio" USING btree ("utilisateur_id");--> statement-breakpoint
ALTER TABLE "campus"."conversations_ia" ADD CONSTRAINT "conversations_ia_livre_id_livres_id_fk" FOREIGN KEY ("livre_id") REFERENCES "campus"."livres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
UPDATE "campus"."usage_ia" SET "cout_micro" = LEAST(2000000000, "jetons_entree"::bigint * 5 + "jetons_sortie"::bigint * 25)::int WHERE "cout_micro" = 0;--> statement-breakpoint
INSERT INTO "campus"."reglages_ia" ("id") VALUES (1) ON CONFLICT DO NOTHING;
