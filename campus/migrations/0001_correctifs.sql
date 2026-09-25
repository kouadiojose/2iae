CREATE TABLE "campus"."comptes_lots_import" (
	"lot_id" text NOT NULL,
	"utilisateur_id" integer NOT NULL,
	CONSTRAINT "comptes_lots_import_lot_id_utilisateur_id_pk" PRIMARY KEY("lot_id","utilisateur_id")
);
--> statement-breakpoint
CREATE TABLE "campus"."lots_import" (
	"id" text PRIMARY KEY NOT NULL,
	"auteur_id" integer NOT NULL,
	"remis_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."passages_classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"classe_id" integer,
	"depuis" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campus"."effectifs_salles" ADD COLUMN "incident_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campus"."effectifs_salles" ADD COLUMN "incident_motif" text;--> statement-breakpoint
ALTER TABLE "campus"."effectifs_salles" ADD COLUMN "incident_resolu_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campus"."mains_levees" ADD COLUMN "pour_salle" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campus"."presences" ADD COLUMN "arrivee_salle_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campus"."presences" ADD COLUMN "hors_campus" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campus"."presences" ADD COLUMN "minutes_vues" integer[] DEFAULT '{}'::integer[] NOT NULL;--> statement-breakpoint
ALTER TABLE "campus"."comptes_lots_import" ADD CONSTRAINT "comptes_lots_import_lot_id_lots_import_id_fk" FOREIGN KEY ("lot_id") REFERENCES "campus"."lots_import"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."comptes_lots_import" ADD CONSTRAINT "comptes_lots_import_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."lots_import" ADD CONSTRAINT "lots_import_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."passages_classes" ADD CONSTRAINT "passages_classes_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."passages_classes" ADD CONSTRAINT "passages_classes_classe_id_classes_id_fk" FOREIGN KEY ("classe_id") REFERENCES "campus"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comptes_lots_import_utilisateur_idx" ON "campus"."comptes_lots_import" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE INDEX "passages_classes_utilisateur_idx" ON "campus"."passages_classes" USING btree ("utilisateur_id","depuis");--> statement-breakpoint
-- Une seule main levée active par personne : les doublons éventuels sont baissés avant l'index unique.
UPDATE "campus"."mains_levees" m SET "baissee_le" = now()
WHERE m."baissee_le" IS NULL AND EXISTS (
  SELECT 1 FROM "campus"."mains_levees" x
  WHERE x."seance_id" = m."seance_id" AND x."utilisateur_id" = m."utilisateur_id" AND x."baissee_le" IS NULL AND x."id" < m."id"
);--> statement-breakpoint
CREATE UNIQUE INDEX "mains_levee_personne_unique" ON "campus"."mains_levees" USING btree ("seance_id","utilisateur_id") WHERE "campus"."mains_levees"."baissee_le" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "mains_levee_salle_unique" ON "campus"."mains_levees" USING btree ("seance_id","site_id") WHERE "campus"."mains_levees"."baissee_le" is null and "campus"."mains_levees"."pour_salle";