-- Correction automatique des copies (décision de José du 8 octobre 2026) : corrigés validés par le formateur
-- (ou tenus pour bons au bout de 24 h), correction des copies par le campus, demandes de relecture.
-- Idempotente : jouée à chaque démarrage, elle ne recrée rien et ne remplace aucune donnée.
CREATE TABLE IF NOT EXISTS "campus"."corriges_devoirs" (
	"devoir_id" integer PRIMARY KEY NOT NULL,
	"contenu" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'campus' NOT NULL,
	"statut" text DEFAULT 'en_preparation' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"propose_le" timestamp with time zone,
	"echeance_le" timestamp with time zone,
	"valide_le" timestamp with time zone,
	"valide_par_id" integer,
	"message_envoye_le" timestamp with time zone,
	"rappel_envoye_le" timestamp with time zone,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campus"."corrections_auto" (
	"rendu_id" integer PRIMARY KEY NOT NULL,
	"devoir_id" integer NOT NULL,
	"etat" text NOT NULL,
	"raison" text,
	"detail" text,
	"rendu_le" timestamp with time zone,
	"version_corrige" integer,
	"demande_id" integer,
	"tentatives" integer DEFAULT 0 NOT NULL,
	"note_campus" real,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campus"."demandes_relecture" (
	"id" serial PRIMARY KEY NOT NULL,
	"rendu_id" integer NOT NULL,
	"etudiant_id" integer NOT NULL,
	"motif" text NOT NULL,
	"statut" text DEFAULT 'ouverte' NOT NULL,
	"note_avant" real,
	"note_apres" real,
	"reponse" text,
	"traitee_par_id" integer,
	"traitee_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campus"."rendus" ADD COLUMN IF NOT EXISTS "origine_note" text DEFAULT 'formateur' NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."corriges_devoirs" ADD CONSTRAINT "corriges_devoirs_devoir_id_devoirs_id_fk" FOREIGN KEY ("devoir_id") REFERENCES "campus"."devoirs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."corriges_devoirs" ADD CONSTRAINT "corriges_devoirs_valide_par_id_utilisateurs_id_fk" FOREIGN KEY ("valide_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."corrections_auto" ADD CONSTRAINT "corrections_auto_rendu_id_rendus_id_fk" FOREIGN KEY ("rendu_id") REFERENCES "campus"."rendus"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."corrections_auto" ADD CONSTRAINT "corrections_auto_devoir_id_devoirs_id_fk" FOREIGN KEY ("devoir_id") REFERENCES "campus"."devoirs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."demandes_relecture" ADD CONSTRAINT "demandes_relecture_rendu_id_rendus_id_fk" FOREIGN KEY ("rendu_id") REFERENCES "campus"."rendus"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."demandes_relecture" ADD CONSTRAINT "demandes_relecture_etudiant_id_utilisateurs_id_fk" FOREIGN KEY ("etudiant_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "campus"."demandes_relecture" ADD CONSTRAINT "demandes_relecture_traitee_par_id_utilisateurs_id_fk" FOREIGN KEY ("traitee_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "corriges_devoirs_statut_idx" ON "campus"."corriges_devoirs" USING btree ("statut","echeance_le");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "corrections_auto_etat_idx" ON "campus"."corrections_auto" USING btree ("etat","devoir_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "demandes_relecture_ouverte_idx" ON "campus"."demandes_relecture" USING btree ("rendu_id") WHERE statut = 'ouverte';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "demandes_relecture_etudiant_idx" ON "campus"."demandes_relecture" USING btree ("etudiant_id");
--> statement-breakpoint
-- Les notes d'interrogation sont posées par le campus depuis toujours (terminerTentative, sans correcteur).
UPDATE "campus"."rendus" r SET "origine_note" = 'campus'
FROM "campus"."devoirs" d
WHERE d."id" = r."devoir_id" AND d."type" = 'quiz' AND r."correcteur_id" IS NULL AND r."origine_note" = 'formateur';
--> statement-breakpoint
-- Devoirs déjà ouverts (ou fermés depuis moins de 30 jours) : ils entrent dans le circuit.
-- Exercices et QCM de la routine du soir : corrigé du campus (devoirs_seances.corriges) à proposer au formateur
-- (propose_le nul : le message du jour le fixera, avec l'échéance).
INSERT INTO "campus"."corriges_devoirs" ("devoir_id", "contenu", "source", "statut")
SELECT d."id", COALESCE(ds."corriges" ->> d."id"::text, ''), 'campus', 'propose'
FROM "campus"."devoirs_seances" ds
CROSS JOIN LATERAL jsonb_array_elements_text(ds."devoir_ids") AS x(id)
JOIN "campus"."devoirs" d ON d."id" = x.id::int
WHERE d."publie" AND d."date_limite" > now() - interval '30 days'
  AND (d."type" = 'quiz' OR COALESCE(ds."corriges" ->> d."id"::text, '') <> '')
ON CONFLICT ("devoir_id") DO NOTHING;
--> statement-breakpoint
-- Autres devoirs à dépôt (écrits par un formateur, travaux de groupe) : le campus rédige leur corrigé.
INSERT INTO "campus"."corriges_devoirs" ("devoir_id", "source", "statut")
SELECT d."id", 'campus', 'en_preparation'
FROM "campus"."devoirs" d
WHERE d."type" = 'depot' AND d."publie" AND d."date_limite" > now() - interval '30 days'
ON CONFLICT ("devoir_id") DO NOTHING;
