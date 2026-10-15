-- Le mur du cours (demande de José du 15 octobre 2026 : « un blog pour poster mes liens, mes fichiers ») : messages des
-- professeurs d'un cours (texte, liens, fichiers), lus par les étudiants du cours et l'espace du campus. Idempotente :
-- jouée à chaque démarrage ; deux tables neuves, aucune donnée reprise. Numéro : le suivant du journal à l'écriture
-- (campus-simple-v2 n'ajoute pas de migration) ; si une autre branche prend 0037 avant la fusion, renuméroter.
CREATE TABLE IF NOT EXISTS "campus"."publications_cours" (
	"id" serial PRIMARY KEY NOT NULL,
	"cours_id" integer NOT NULL,
	"auteur_id" integer NOT NULL,
	"texte" text DEFAULT '' NOT NULL,
	"liens" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cle_envoi" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campus"."fichiers_publications" (
	"publication_id" integer NOT NULL,
	"fichier_id" integer NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "fichiers_publications_publication_id_fichier_id_pk" PRIMARY KEY("publication_id","fichier_id")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."publications_cours" ADD CONSTRAINT "publications_cours_cours_id_cours_id_fk" FOREIGN KEY ("cours_id") REFERENCES "campus"."cours"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."publications_cours" ADD CONSTRAINT "publications_cours_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."fichiers_publications" ADD CONSTRAINT "fichiers_publications_publication_id_publications_cours_id_fk" FOREIGN KEY ("publication_id") REFERENCES "campus"."publications_cours"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."fichiers_publications" ADD CONSTRAINT "fichiers_publications_fichier_id_fichiers_id_fk" FOREIGN KEY ("fichier_id") REFERENCES "campus"."fichiers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "publications_cours_cours_idx" ON "campus"."publications_cours" USING btree ("cours_id","id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "publications_cours_cle_idx" ON "campus"."publications_cours" USING btree ("auteur_id","cle_envoi");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fichiers_publications_fichier_idx" ON "campus"."fichiers_publications" USING btree ("fichier_id");
