CREATE TABLE "campus"."demandes_acces" (
	"id" serial PRIMARY KEY NOT NULL,
	"lien_id" integer,
	"prenom" text NOT NULL,
	"nom" text NOT NULL,
	"email" text NOT NULL,
	"telephone" text,
	"fonction" text DEFAULT '' NOT NULL,
	"site_id" integer,
	"mot_de_passe_hash" text NOT NULL,
	"statut" text DEFAULT 'en_attente' NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"traite_le" timestamp with time zone,
	"traite_par_id" integer,
	"compte_id" integer,
	"motif" text
);
--> statement-breakpoint
CREATE TABLE "campus"."liens_inscription" (
	"id" serial PRIMARY KEY NOT NULL,
	"jeton" text NOT NULL,
	"libelle" text DEFAULT 'Équipe administrative' NOT NULL,
	"cree_par_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"revoque_le" timestamp with time zone,
	CONSTRAINT "liens_inscription_jeton_unique" UNIQUE("jeton")
);
--> statement-breakpoint
ALTER TABLE "campus"."demandes_acces" ADD CONSTRAINT "demandes_acces_lien_id_liens_inscription_id_fk" FOREIGN KEY ("lien_id") REFERENCES "campus"."liens_inscription"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."demandes_acces" ADD CONSTRAINT "demandes_acces_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "campus"."sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."demandes_acces" ADD CONSTRAINT "demandes_acces_traite_par_id_utilisateurs_id_fk" FOREIGN KEY ("traite_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."demandes_acces" ADD CONSTRAINT "demandes_acces_compte_id_utilisateurs_id_fk" FOREIGN KEY ("compte_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."liens_inscription" ADD CONSTRAINT "liens_inscription_cree_par_id_utilisateurs_id_fk" FOREIGN KEY ("cree_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "demandes_acces_statut_idx" ON "campus"."demandes_acces" USING btree ("statut","cree_le");