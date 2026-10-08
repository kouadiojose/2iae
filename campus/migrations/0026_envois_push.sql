-- Chantier C3 du plan d'engagement (rappels qui arrivent) : trace de chaque décision d'envoi d'un rappel
-- sur le téléphone et de son ouverture, compteur des rappels d'engagement, rappels vérifiés sur chaque
-- appareil, résumé du matin daté dans le fuseau de la personne. Écrite à la main et rejouable.
CREATE TABLE IF NOT EXISTS "campus"."envois_push" (
	"id" serial PRIMARY KEY NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"notification_id" integer,
	"type" text NOT NULL,
	"priorite" text NOT NULL,
	"statut" text NOT NULL,
	"groupe" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"ouvert_le" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campus"."envois_push" ADD CONSTRAINT "envois_push_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campus"."envois_push" ADD CONSTRAINT "envois_push_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "campus"."notifications"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "envois_push_utilisateur_idx" ON "campus"."envois_push" USING btree ("utilisateur_id","cree_le");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "envois_push_notification_idx" ON "campus"."envois_push" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "envois_push_cree_le_idx" ON "campus"."envois_push" USING btree ("cree_le");--> statement-breakpoint
ALTER TABLE "campus"."compteurs_push" ADD COLUMN IF NOT EXISTS "engagements" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "campus"."push_differes" ADD COLUMN IF NOT EXISTS "jour" text;--> statement-breakpoint
ALTER TABLE "campus"."push_differes" ADD COLUMN IF NOT EXISTS "priorite" text;--> statement-breakpoint
ALTER TABLE "campus"."abonnements_push" ADD COLUMN IF NOT EXISTS "plateforme" text;--> statement-breakpoint
ALTER TABLE "campus"."abonnements_push" ADD COLUMN IF NOT EXISTS "marque" text;--> statement-breakpoint
ALTER TABLE "campus"."abonnements_push" ADD COLUMN IF NOT EXISTS "recu" boolean;--> statement-breakpoint
ALTER TABLE "campus"."abonnements_push" ADD COLUMN IF NOT EXISTS "verifie_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campus"."abonnements_push" ADD COLUMN IF NOT EXISTS "derniere_reussite_le" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "abonnements_push_utilisateur_idx" ON "campus"."abonnements_push" USING btree ("utilisateur_id");
