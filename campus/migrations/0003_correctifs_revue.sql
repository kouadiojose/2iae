CREATE TABLE "campus"."morceaux_replay" (
	"seance_id" integer NOT NULL,
	"numero" integer NOT NULL,
	"enregistrement_id" text NOT NULL,
	"debut" timestamp with time zone NOT NULL,
	"duree_secondes" integer NOT NULL,
	CONSTRAINT "morceaux_replay_seance_id_numero_pk" PRIMARY KEY("seance_id","numero")
);
--> statement-breakpoint
CREATE TABLE "campus"."classes_programme" (
	"cours_id" integer NOT NULL,
	"classe_id" integer NOT NULL,
	CONSTRAINT "classes_programme_cours_id_classe_id_pk" PRIMARY KEY("cours_id","classe_id")
);
--> statement-breakpoint
CREATE TABLE "campus"."formateurs_programme" (
	"cours_id" integer NOT NULL,
	"formateur_id" integer NOT NULL,
	"principal" boolean DEFAULT false NOT NULL,
	CONSTRAINT "formateurs_programme_cours_id_formateur_id_pk" PRIMARY KEY("cours_id","formateur_id")
);
--> statement-breakpoint
ALTER TABLE "campus"."seances_creneaux" ADD COLUMN "retouches" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "campus"."seances_creneaux" ADD COLUMN "intervenant_id" integer;--> statement-breakpoint
ALTER TABLE "campus"."sessions_classes" ADD COLUMN "prevenue_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "campus"."morceaux_replay" ADD CONSTRAINT "morceaux_replay_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."classes_programme" ADD CONSTRAINT "classes_programme_cours_classes_fk" FOREIGN KEY ("cours_id","classe_id") REFERENCES "campus"."cours_classes"("cours_id","classe_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."formateurs_programme" ADD CONSTRAINT "formateurs_programme_cours_id_cours_id_fk" FOREIGN KEY ("cours_id") REFERENCES "campus"."cours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."formateurs_programme" ADD CONSTRAINT "formateurs_programme_formateur_id_utilisateurs_id_fk" FOREIGN KEY ("formateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."seances_creneaux" ADD CONSTRAINT "seances_creneaux_intervenant_id_utilisateurs_id_fk" FOREIGN KEY ("intervenant_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Reprise : les séances déjà engendrées retiennent l'intervenant de leur créneau (sinon la prochaine mise à jour le prendrait pour un changement et préviendrait tout le monde).
UPDATE "campus"."seances_creneaux" sc SET "intervenant_id" = cp."intervenant_id" FROM "campus"."creneaux_programme" cp WHERE cp."id" = sc."creneau_id" AND sc."intervenant_id" IS NULL;--> statement-breakpoint
-- Reprise : rattachements cours/classes posés par les publications déjà faites.
INSERT INTO "campus"."classes_programme" ("cours_id", "classe_id")
SELECT DISTINCT cp."cours_id", sc."classe_id" FROM "campus"."creneaux_programme" cp
JOIN "campus"."sessions_programme" s ON s."id" = cp."session_id" AND s."publiee_le" IS NOT NULL
JOIN "campus"."sessions_classes" sc ON sc."session_id" = cp."session_id"
JOIN "campus"."cours_classes" cc ON cc."cours_id" = cp."cours_id" AND cc."classe_id" = sc."classe_id"
WHERE cp."cours_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Reprise : co-formateurs ajoutés par les publications déjà faites (intervenant qui n'est pas le formateur principal du cours).
INSERT INTO "campus"."formateurs_programme" ("cours_id", "formateur_id", "principal")
SELECT DISTINCT cp."cours_id", cp."intervenant_id", false FROM "campus"."creneaux_programme" cp
JOIN "campus"."sessions_programme" s ON s."id" = cp."session_id" AND s."publiee_le" IS NOT NULL
JOIN "campus"."cours_formateurs" cf ON cf."cours_id" = cp."cours_id" AND cf."formateur_id" = cp."intervenant_id"
WHERE cp."cours_id" IS NOT NULL AND cp."intervenant_id" IS NOT NULL
ON CONFLICT DO NOTHING;
