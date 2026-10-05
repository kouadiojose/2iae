CREATE TABLE "campus"."catalogue_libre" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"ident" text NOT NULL,
	"titre" text NOT NULL,
	"auteurs" text DEFAULT '' NOT NULL,
	"annee" integer,
	"langue" text,
	"sujets" text DEFAULT '' NOT NULL,
	"domaines" text[] DEFAULT '{}'::text[] NOT NULL,
	"description" text,
	"couverture" text,
	"format" text NOT NULL,
	"lien" text NOT NULL,
	"pdf" text,
	"texte" text,
	"licence" text,
	"popularite" integer DEFAULT 0 NOT NULL,
	"lectures" integer DEFAULT 0 NOT NULL,
	"recherche" text NOT NULL,
	"vu_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."moissons_libres" (
	"source" text PRIMARY KEY NOT NULL,
	"statut" text NOT NULL,
	"nombre" integer DEFAULT 0 NOT NULL,
	"debut" timestamp with time zone DEFAULT now() NOT NULL,
	"fin" timestamp with time zone,
	"message" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "catalogue_libre_source_ident_idx" ON "campus"."catalogue_libre" USING btree ("source","ident");--> statement-breakpoint
CREATE INDEX "catalogue_libre_recherche_idx" ON "campus"."catalogue_libre" USING gin (to_tsvector('simple', "recherche"));--> statement-breakpoint
CREATE INDEX "catalogue_libre_domaines_idx" ON "campus"."catalogue_libre" USING gin ("domaines");--> statement-breakpoint
CREATE INDEX "catalogue_libre_popularite_idx" ON "campus"."catalogue_libre" USING btree ("popularite");