CREATE TABLE "campus"."messages_live" (
	"id" serial PRIMARY KEY NOT NULL,
	"seance_id" integer NOT NULL,
	"auteur_id" integer NOT NULL,
	"site_id" integer,
	"texte" text DEFAULT '' NOT NULL,
	"fichier_id" integer,
	"masque" boolean DEFAULT false NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campus"."messages_live" ADD CONSTRAINT "messages_live_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."messages_live" ADD CONSTRAINT "messages_live_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."messages_live" ADD CONSTRAINT "messages_live_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "campus"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."messages_live" ADD CONSTRAINT "messages_live_fichier_id_fichiers_id_fk" FOREIGN KEY ("fichier_id") REFERENCES "campus"."fichiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_live_seance_idx" ON "campus"."messages_live" USING btree ("seance_id","id");--> statement-breakpoint
CREATE INDEX "messages_live_fichier_idx" ON "campus"."messages_live" USING btree ("fichier_id");