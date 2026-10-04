CREATE TABLE "campus"."blocages" (
	"auteur_id" integer NOT NULL,
	"bloque_id" integer NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocages_auteur_id_bloque_id_pk" PRIMARY KEY("auteur_id","bloque_id")
);
--> statement-breakpoint
ALTER TABLE "campus"."blocages" ADD CONSTRAINT "blocages_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."blocages" ADD CONSTRAINT "blocages_bloque_id_utilisateurs_id_fk" FOREIGN KEY ("bloque_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blocages_bloque_idx" ON "campus"."blocages" USING btree ("bloque_id");