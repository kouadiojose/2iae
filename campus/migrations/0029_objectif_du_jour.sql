-- Plan d'engagement, chantier C2 : objectif du jour (campus/ENGAGEMENT.md).
-- Numéro 0029 au plan : l'intégrateur renumérote fichier et tag selon l'ordre de fusion.
-- Idempotente : rejouée, elle ne change rien. Aucune donnée existante n'est modifiée.
CREATE TABLE IF NOT EXISTS "campus"."objectifs_jours" (
	"utilisateur_id" integer NOT NULL,
	"jour" date NOT NULL,
	"elements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"faits" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"valide_le" timestamp with time zone,
	"site_id" integer,
	"classe_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "objectifs_jours_utilisateur_id_jour_pk" PRIMARY KEY("utilisateur_id","jour")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."objectifs_jours" ADD CONSTRAINT "objectifs_jours_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."objectifs_jours" ADD CONSTRAINT "objectifs_jours_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "campus"."sites"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."objectifs_jours" ADD CONSTRAINT "objectifs_jours_classe_id_classes_id_fk" FOREIGN KEY ("classe_id") REFERENCES "campus"."classes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "objectifs_jours_jour_idx" ON "campus"."objectifs_jours" USING btree ("jour");
