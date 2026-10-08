-- Révision du jour (chantier C1 du plan d'engagement, campus/ENGAGEMENT.md : numéro 0028 dans l'ordre
-- de fusion, l'intégrateur renumérote fichier et tag). Banque de cartes tirée des cours complets et des
-- sondages corrigés, boîte de chaque étudiant, réponses, suivi du cours complet, signalements.
-- Écrite à la main, idempotente (rejouée, elle ne casse rien) ; aucune donnée existante n'est modifiée.
CREATE TABLE IF NOT EXISTS "campus"."cartes_revision" (
	"id" serial PRIMARY KEY NOT NULL,
	"cle" text NOT NULL,
	"cours_id" integer NOT NULL,
	"seance_id" integer NOT NULL,
	"source" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"genre" text NOT NULL,
	"contenu" jsonb NOT NULL,
	"langue" text DEFAULT 'fr' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"a_relire" boolean DEFAULT false NOT NULL,
	"signalements" integer DEFAULT 0 NOT NULL,
	"relue_le" timestamp with time zone,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campus"."reponses_revision" (
	"id" serial PRIMARY KEY NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"carte_id" integer NOT NULL,
	"juste" boolean NOT NULL,
	"origine" text NOT NULL,
	"jour" date NOT NULL,
	"repondu_le" timestamp with time zone NOT NULL,
	"recu_le" timestamp with time zone DEFAULT now() NOT NULL,
	"cle_envoi" text NOT NULL,
	"classe_id" integer,
	"site_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campus"."revisions_etudiants" (
	"utilisateur_id" integer NOT NULL,
	"carte_id" integer NOT NULL,
	"boite" smallint DEFAULT 1 NOT NULL,
	"prochaine_le" date NOT NULL,
	"bonnes" integer DEFAULT 0 NOT NULL,
	"erreurs" integer DEFAULT 0 NOT NULL,
	"derniere_le" timestamp with time zone NOT NULL,
	CONSTRAINT "revisions_etudiants_utilisateur_id_carte_id_pk" PRIMARY KEY("utilisateur_id","carte_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campus"."signalements_cartes" (
	"carte_id" integer NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"motif" text DEFAULT '' NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signalements_cartes_carte_id_utilisateur_id_pk" PRIMARY KEY("carte_id","utilisateur_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campus"."suivis_cours_complets" (
	"utilisateur_id" integer NOT NULL,
	"seance_id" integer NOT NULL,
	"ouvert_le" timestamp with time zone DEFAULT now() NOT NULL,
	"revu_le" timestamp with time zone DEFAULT now() NOT NULL,
	"quiz_meilleur" smallint,
	"quiz_total" smallint,
	"fiches_vues" integer DEFAULT 0 NOT NULL,
	"exercices_faits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "suivis_cours_complets_utilisateur_id_seance_id_pk" PRIMARY KEY("utilisateur_id","seance_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campus"."cartes_revision" ADD CONSTRAINT "cartes_revision_cours_id_cours_id_fk" FOREIGN KEY ("cours_id") REFERENCES "campus"."cours"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campus"."cartes_revision" ADD CONSTRAINT "cartes_revision_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campus"."reponses_revision" ADD CONSTRAINT "reponses_revision_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campus"."reponses_revision" ADD CONSTRAINT "reponses_revision_carte_id_cartes_revision_id_fk" FOREIGN KEY ("carte_id") REFERENCES "campus"."cartes_revision"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campus"."reponses_revision" ADD CONSTRAINT "reponses_revision_classe_id_classes_id_fk" FOREIGN KEY ("classe_id") REFERENCES "campus"."classes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campus"."reponses_revision" ADD CONSTRAINT "reponses_revision_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "campus"."sites"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campus"."revisions_etudiants" ADD CONSTRAINT "revisions_etudiants_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campus"."revisions_etudiants" ADD CONSTRAINT "revisions_etudiants_carte_id_cartes_revision_id_fk" FOREIGN KEY ("carte_id") REFERENCES "campus"."cartes_revision"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campus"."signalements_cartes" ADD CONSTRAINT "signalements_cartes_carte_id_cartes_revision_id_fk" FOREIGN KEY ("carte_id") REFERENCES "campus"."cartes_revision"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campus"."signalements_cartes" ADD CONSTRAINT "signalements_cartes_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campus"."suivis_cours_complets" ADD CONSTRAINT "suivis_cours_complets_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campus"."suivis_cours_complets" ADD CONSTRAINT "suivis_cours_complets_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cartes_revision_cle_idx" ON "campus"."cartes_revision" USING btree ("cle");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cartes_revision_cours_idx" ON "campus"."cartes_revision" USING btree ("cours_id","active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cartes_revision_seance_idx" ON "campus"."cartes_revision" USING btree ("seance_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reponses_revision_envoi_idx" ON "campus"."reponses_revision" USING btree ("utilisateur_id","cle_envoi");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reponses_revision_jour_idx" ON "campus"."reponses_revision" USING btree ("utilisateur_id","jour");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reponses_revision_carte_idx" ON "campus"."reponses_revision" USING btree ("carte_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reponses_revision_jour_seul_idx" ON "campus"."reponses_revision" USING btree ("jour");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "revisions_etudiants_prochaine_idx" ON "campus"."revisions_etudiants" USING btree ("utilisateur_id","prochaine_le");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suivis_cours_complets_seance_idx" ON "campus"."suivis_cours_complets" USING btree ("seance_id");
