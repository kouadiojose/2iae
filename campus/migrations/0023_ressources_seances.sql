CREATE TABLE "campus"."ressources_seances" (
	"id" serial PRIMARY KEY NOT NULL,
	"seance_id" integer NOT NULL,
	"type" text NOT NULL,
	"titre" text DEFAULT '' NOT NULL,
	"url" text,
	"fichier_id" integer,
	"ordre" integer DEFAULT 0 NOT NULL,
	"cree_par" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campus"."seances" ADD COLUMN "projection" jsonb;--> statement-breakpoint
ALTER TABLE "campus"."ressources_seances" ADD CONSTRAINT "ressources_seances_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."ressources_seances" ADD CONSTRAINT "ressources_seances_fichier_id_fichiers_id_fk" FOREIGN KEY ("fichier_id") REFERENCES "campus"."fichiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."ressources_seances" ADD CONSTRAINT "ressources_seances_cree_par_utilisateurs_id_fk" FOREIGN KEY ("cree_par") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ressources_seances_seance_idx" ON "campus"."ressources_seances" USING btree ("seance_id");