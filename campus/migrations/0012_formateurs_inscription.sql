CREATE TABLE "campus"."liens_formateurs" (
	"id" serial PRIMARY KEY NOT NULL,
	"jeton" text NOT NULL,
	"prenom" text DEFAULT '' NOT NULL,
	"nom" text DEFAULT '' NOT NULL,
	"compte_id" integer,
	"cree_par_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"revoque_le" timestamp with time zone,
	"utilise_le" timestamp with time zone,
	"compte_cree_id" integer,
	CONSTRAINT "liens_formateurs_jeton_unique" UNIQUE("jeton")
);
--> statement-breakpoint
ALTER TABLE "campus"."liens_formateurs" ADD CONSTRAINT "liens_formateurs_compte_id_utilisateurs_id_fk" FOREIGN KEY ("compte_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."liens_formateurs" ADD CONSTRAINT "liens_formateurs_cree_par_id_utilisateurs_id_fk" FOREIGN KEY ("cree_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."liens_formateurs" ADD CONSTRAINT "liens_formateurs_compte_cree_id_utilisateurs_id_fk" FOREIGN KEY ("compte_cree_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "liens_formateurs_cree_idx" ON "campus"."liens_formateurs" USING btree ("cree_le");