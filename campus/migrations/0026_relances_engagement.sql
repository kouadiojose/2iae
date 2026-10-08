-- Plan d'engagement, chantier C4 : rappel d'entraînement du jour, e-mail « Ta semaine » et relances des
-- décrocheurs (campus/ENGAGEMENT.md). Numéro attribué : 0032 (ordre de fusion C3, C8, C1, C2, C7, C5, C4) ;
-- numéroté 0026 dans la branche du chantier pour que le garde-fou passe, renuméroté à la fusion (§ 5).
-- Idempotente : tout peut être rejoué. Aucune donnée existante n'est touchée.
CREATE TABLE IF NOT EXISTS "campus"."reglages_engagement" (
	"utilisateur_id" integer PRIMARY KEY NOT NULL,
	"heure_rappel" smallint,
	"rappels_actifs" boolean DEFAULT true NOT NULL,
	"emails_actifs" boolean DEFAULT true NOT NULL,
	"pause_jusqu_au" date,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campus"."relances_engagement" (
	"id" serial PRIMARY KEY NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"jour" date NOT NULL,
	"motif" text NOT NULL,
	"canal" text NOT NULL,
	"palier" smallint DEFAULT 1 NOT NULL,
	"variante" text,
	"statut" text NOT NULL,
	"notification_id" integer,
	"lien" text,
	"site_id" integer,
	"classe_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"ouvert_le" timestamp with time zone,
	"revenu_le" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campus"."reglage_relances" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"mode" text DEFAULT 'essai' NOT NULL,
	"rappels_mode" text DEFAULT 'essai' NOT NULL,
	"emails_mode" text DEFAULT 'essai' NOT NULL,
	"emails_par_jour" smallint DEFAULT 40 NOT NULL,
	"maj_par" integer,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campus"."reglages_engagement" ADD CONSTRAINT "reglages_engagement_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campus"."relances_engagement" ADD CONSTRAINT "relances_engagement_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campus"."relances_engagement" ADD CONSTRAINT "relances_engagement_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "campus"."notifications"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campus"."relances_engagement" ADD CONSTRAINT "relances_engagement_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "campus"."sites"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campus"."relances_engagement" ADD CONSTRAINT "relances_engagement_classe_id_classes_id_fk" FOREIGN KEY ("classe_id") REFERENCES "campus"."classes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campus"."reglage_relances" ADD CONSTRAINT "reglage_relances_maj_par_utilisateurs_id_fk" FOREIGN KEY ("maj_par") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "relances_engagement_unique" ON "campus"."relances_engagement" USING btree ("utilisateur_id","jour","motif","canal");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relances_engagement_utilisateur_idx" ON "campus"."relances_engagement" USING btree ("utilisateur_id","cree_le");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "relances_engagement_jour_idx" ON "campus"."relances_engagement" USING btree ("jour");
