-- Plusieurs salles de conférence par campus (décision de José du 12 octobre 2026) : chaque salle a son écran
-- (un compte « salle »), son nom et un public facultatif (L1 : classes de 1re année, L2 : de 2e année).
-- L'écran existant de chaque campus devient la salle 1 sans rien changer : colonnes vides, il garde le nom de
-- la salle du campus et montre tous les cours, comme avant. Idempotente : jouée à chaque démarrage, elle ne
-- recrée rien et ne modifie aucune donnée.
ALTER TABLE "campus"."utilisateurs" ADD COLUMN IF NOT EXISTS "salle_nom" text;
--> statement-breakpoint
ALTER TABLE "campus"."utilisateurs" ADD COLUMN IF NOT EXISTS "salle_public" text;
--> statement-breakpoint
ALTER TABLE "campus"."utilisateurs" ADD COLUMN IF NOT EXISTS "salle_numero" integer;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "utilisateurs_salle_numero_unique" ON "campus"."utilisateurs" USING btree ("site_id","salle_numero") WHERE "salle_numero" IS NOT NULL;
