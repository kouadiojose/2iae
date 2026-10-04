ALTER TABLE "campus"."conversations_ia" ADD COLUMN "bibliotheque" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campus"."livres" ADD COLUMN "lecture" jsonb;--> statement-breakpoint
ALTER TABLE "campus"."messages_ia" ADD COLUMN "livres" jsonb;