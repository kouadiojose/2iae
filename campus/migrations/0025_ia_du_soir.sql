CREATE TABLE IF NOT EXISTS "campus"."demandes_ia" (
	"id" serial PRIMARY KEY NOT NULL,
	"cle" text NOT NULL,
	"origine" text NOT NULL,
	"requete" jsonb NOT NULL,
	"reponse" jsonb,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"repondu_le" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "demandes_ia_cle_idx" ON "campus"."demandes_ia" USING btree ("cle");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "demandes_ia_origine_idx" ON "campus"."demandes_ia" USING btree ("origine");--> statement-breakpoint
-- Visio Daily pour toutes les séances (décision de la direction) : les séances encore à venir passent sur Daily,
-- sans lien externe. Les séances commencées ou passées gardent leur visio.
UPDATE "campus"."seances" SET "fournisseur" = 'daily', "lien_externe" = NULL WHERE "statut" = 'planifiee' AND "fournisseur" <> 'daily';
