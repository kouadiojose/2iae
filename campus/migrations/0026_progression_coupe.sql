-- Chantier C5 du plan d'engagement (campus/ENGAGEMENT.md) : progression et Coupe.
-- activites : registre des points (un acte d'apprentissage = une ligne, clé unique anti-doublon) ;
-- objectifs_semaine : objectif de jours actifs, série de semaines réussies, joker du mois ;
-- badges_etudiants : badges obtenus ; classements_semaine : Coupe des campus et des classes, en taux.
-- Idempotente (IF NOT EXISTS partout, contraintes dans des blocs DO), aucune donnée existante modifiée.
CREATE TABLE IF NOT EXISTS "campus"."activites" (
	"id" serial PRIMARY KEY NOT NULL,
	"cle" text NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"type" text NOT NULL,
	"points" integer NOT NULL,
	"jour" date NOT NULL,
	"semaine" text NOT NULL,
	"site_id" integer,
	"classe_id" integer,
	"cours_id" integer,
	"seance_id" integer,
	"objet_id" integer,
	"fait_le" timestamp with time zone NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campus"."objectifs_semaine" (
	"utilisateur_id" integer PRIMARY KEY NOT NULL,
	"jours" smallint DEFAULT 3 NOT NULL,
	"joker_mois" text,
	"serie" smallint DEFAULT 0 NOT NULL,
	"record" smallint DEFAULT 0 NOT NULL,
	"semaine_evaluee" text,
	"dernier_resultat" text,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campus"."badges_etudiants" (
	"utilisateur_id" integer NOT NULL,
	"badge" text NOT NULL,
	"obtenu_le" timestamp with time zone DEFAULT now() NOT NULL,
	"vu_le" timestamp with time zone,
	CONSTRAINT "badges_etudiants_utilisateur_id_badge_pk" PRIMARY KEY("utilisateur_id","badge")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campus"."classements_semaine" (
	"semaine" text NOT NULL,
	"portee" text NOT NULL,
	"cible_id" integer NOT NULL,
	"ligue" text NOT NULL,
	"inscrits" integer DEFAULT 0 NOT NULL,
	"participants" integer DEFAULT 0 NOT NULL,
	"taux_participation" real DEFAULT 0 NOT NULL,
	"points_moyens" real DEFAULT 0 NOT NULL,
	"part_assidus" real DEFAULT 0 NOT NULL,
	"progression" real,
	"presence_direct" real,
	"seances_emargees" integer DEFAULT 0 NOT NULL,
	"score" real DEFAULT 0 NOT NULL,
	"rang" integer,
	"trophees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"actes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"essai" boolean DEFAULT false NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	"fige_le" timestamp with time zone,
	CONSTRAINT "classements_semaine_semaine_portee_cible_id_pk" PRIMARY KEY("semaine","portee","cible_id")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."activites" ADD CONSTRAINT "activites_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."activites" ADD CONSTRAINT "activites_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "campus"."sites"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."activites" ADD CONSTRAINT "activites_classe_id_classes_id_fk" FOREIGN KEY ("classe_id") REFERENCES "campus"."classes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."objectifs_semaine" ADD CONSTRAINT "objectifs_semaine_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."badges_etudiants" ADD CONSTRAINT "badges_etudiants_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "activites_cle_unique" ON "campus"."activites" USING btree ("cle");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activites_utilisateur_jour_idx" ON "campus"."activites" USING btree ("utilisateur_id","jour");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activites_semaine_site_idx" ON "campus"."activites" USING btree ("semaine","site_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activites_semaine_classe_idx" ON "campus"."activites" USING btree ("semaine","classe_id");
