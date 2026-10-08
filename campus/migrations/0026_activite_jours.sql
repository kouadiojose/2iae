-- Chantier C8 du plan d'engagement (campus/ENGAGEMENT.md) : l'activité jour par jour.
-- Une ligne par personne et par jour local où elle a ouvert le campus (écrite par
-- chargerUtilisateur au plus une fois par heure), avec la plateforme la plus « téléphone »
-- de la journée. Numéro attribué : 0027 (après 0026_envois_push de C3) ; posée ici en 0026
-- pour que le garde-fou passe sur la branche seule : l'intégrateur renumérote fichier et tag.
-- Idempotente : rejouée, elle ne change rien. Aucune donnée existante n'est modifiée.
CREATE TABLE IF NOT EXISTS "campus"."activite_jours" (
	"utilisateur_id" integer NOT NULL,
	"jour" date NOT NULL,
	"premiere_le" timestamp with time zone DEFAULT now() NOT NULL,
	"derniere_le" timestamp with time zone DEFAULT now() NOT NULL,
	"heures" smallint DEFAULT 1 NOT NULL,
	"plateforme" text,
	"site_id" integer,
	"classe_id" integer,
	CONSTRAINT "activite_jours_utilisateur_id_jour_pk" PRIMARY KEY("utilisateur_id","jour"),
	CONSTRAINT "activite_jours_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "activite_jours_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "campus"."sites"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "activite_jours_classe_id_classes_id_fk" FOREIGN KEY ("classe_id") REFERENCES "campus"."classes"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activite_jours_jour_idx" ON "campus"."activite_jours" USING btree ("jour");
