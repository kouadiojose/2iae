CREATE TABLE "campus"."replays_stockes" (
	"enregistrement_id" text PRIMARY KEY NOT NULL,
	"seance_id" integer NOT NULL,
	"cle" text NOT NULL,
	"taille_octets" bigint NOT NULL,
	"archive_le" timestamp with time zone DEFAULT now() NOT NULL,
	"daily_supprime_le" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "campus"."replays_stockes" ADD CONSTRAINT "replays_stockes_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "replays_stockes_seance_idx" ON "campus"."replays_stockes" USING btree ("seance_id");