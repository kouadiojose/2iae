CREATE TABLE "campus"."contenus_site" (
	"cle" text PRIMARY KEY NOT NULL,
	"valeur" jsonb NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_par_id" integer
);
--> statement-breakpoint
CREATE TABLE "campus"."directs_immediats" (
	"seance_id" integer PRIMARY KEY NOT NULL,
	"cree_par_id" integer NOT NULL,
	"prevenir" boolean DEFAULT false NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."reglages_visio" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"fournisseur_par_defaut" text,
	"video_etudiant_par_defaut" boolean DEFAULT false NOT NULL,
	"places_daily_etudiants" integer DEFAULT 30 NOT NULL,
	"prix_minute_usd" real DEFAULT 0.004 NOT NULL,
	"minutes_offertes" integer DEFAULT 10000 NOT NULL,
	"taux_fcfa" integer DEFAULT 600 NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_par_id" integer
);
--> statement-breakpoint
CREATE TABLE "campus"."creneaux_programme" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"jour" integer NOT NULL,
	"heure_debut" text NOT NULL,
	"heure_fin" text NOT NULL,
	"type" text DEFAULT 'cours' NOT NULL,
	"cours_id" integer,
	"titre" text DEFAULT '' NOT NULL,
	"intervenant_id" integer,
	"intervenant_nom" text DEFAULT '' NOT NULL,
	"mention" text DEFAULT '' NOT NULL,
	"fournisseur" text,
	"ordre" integer DEFAULT 0 NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."exceptions_programme" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"date" date NOT NULL,
	"creneau_id" integer,
	"motif" text DEFAULT '' NOT NULL,
	"cree_par_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."seances_creneaux" (
	"seance_id" integer PRIMARY KEY NOT NULL,
	"creneau_id" integer NOT NULL,
	"date" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."sessions_classes" (
	"session_id" integer NOT NULL,
	"classe_id" integer NOT NULL,
	CONSTRAINT "sessions_classes_session_id_classe_id_pk" PRIMARY KEY("session_id","classe_id")
);
--> statement-breakpoint
CREATE TABLE "campus"."sessions_programme" (
	"id" serial PRIMARY KEY NOT NULL,
	"annee_academique" text NOT NULL,
	"titre" text NOT NULL,
	"public" text DEFAULT '' NOT NULL,
	"debut" date NOT NULL,
	"fin" date NOT NULL,
	"pause_debut" text,
	"pause_fin" text,
	"note" text DEFAULT '' NOT NULL,
	"signataire" text DEFAULT 'Le service des études' NOT NULL,
	"statut" text DEFAULT 'brouillon' NOT NULL,
	"publiee_le" timestamp with time zone,
	"synchronisee_le" timestamp with time zone,
	"cree_par_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."showreels" (
	"id" serial PRIMARY KEY NOT NULL,
	"formateur_id" integer NOT NULL,
	"statut" text DEFAULT 'brouillon' NOT NULL,
	"plans" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"extraits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"photo_fichier_id" integer,
	"photo_forme" text DEFAULT 'rond' NOT NULL,
	"image_partage_fichier_id" integer,
	"fuseau" text,
	"composition" text,
	"compose_le" timestamp with time zone,
	"compose_par_id" integer,
	"retouche" boolean DEFAULT false NOT NULL,
	"soumis_le" timestamp with time zone,
	"valide_le" timestamp with time zone,
	"version_publiee" jsonb,
	"publie_le" timestamp with time zone,
	"publie_par_id" integer,
	"accord_direction" boolean DEFAULT false NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_par_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "showreels_formateur_id_unique" UNIQUE("formateur_id")
);
--> statement-breakpoint
ALTER TABLE "campus"."utilisateurs" ADD COLUMN "fuseau" text;--> statement-breakpoint
ALTER TABLE "campus"."contenus_site" ADD CONSTRAINT "contenus_site_maj_par_id_utilisateurs_id_fk" FOREIGN KEY ("maj_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."directs_immediats" ADD CONSTRAINT "directs_immediats_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."directs_immediats" ADD CONSTRAINT "directs_immediats_cree_par_id_utilisateurs_id_fk" FOREIGN KEY ("cree_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."reglages_visio" ADD CONSTRAINT "reglages_visio_maj_par_id_utilisateurs_id_fk" FOREIGN KEY ("maj_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."creneaux_programme" ADD CONSTRAINT "creneaux_programme_session_id_sessions_programme_id_fk" FOREIGN KEY ("session_id") REFERENCES "campus"."sessions_programme"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."creneaux_programme" ADD CONSTRAINT "creneaux_programme_cours_id_cours_id_fk" FOREIGN KEY ("cours_id") REFERENCES "campus"."cours"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."creneaux_programme" ADD CONSTRAINT "creneaux_programme_intervenant_id_utilisateurs_id_fk" FOREIGN KEY ("intervenant_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."exceptions_programme" ADD CONSTRAINT "exceptions_programme_session_id_sessions_programme_id_fk" FOREIGN KEY ("session_id") REFERENCES "campus"."sessions_programme"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."exceptions_programme" ADD CONSTRAINT "exceptions_programme_creneau_id_creneaux_programme_id_fk" FOREIGN KEY ("creneau_id") REFERENCES "campus"."creneaux_programme"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."exceptions_programme" ADD CONSTRAINT "exceptions_programme_cree_par_id_utilisateurs_id_fk" FOREIGN KEY ("cree_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."seances_creneaux" ADD CONSTRAINT "seances_creneaux_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."seances_creneaux" ADD CONSTRAINT "seances_creneaux_creneau_id_creneaux_programme_id_fk" FOREIGN KEY ("creneau_id") REFERENCES "campus"."creneaux_programme"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."sessions_classes" ADD CONSTRAINT "sessions_classes_session_id_sessions_programme_id_fk" FOREIGN KEY ("session_id") REFERENCES "campus"."sessions_programme"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."sessions_classes" ADD CONSTRAINT "sessions_classes_classe_id_classes_id_fk" FOREIGN KEY ("classe_id") REFERENCES "campus"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."sessions_programme" ADD CONSTRAINT "sessions_programme_cree_par_id_utilisateurs_id_fk" FOREIGN KEY ("cree_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."showreels" ADD CONSTRAINT "showreels_formateur_id_utilisateurs_id_fk" FOREIGN KEY ("formateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."showreels" ADD CONSTRAINT "showreels_photo_fichier_id_fichiers_id_fk" FOREIGN KEY ("photo_fichier_id") REFERENCES "campus"."fichiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."showreels" ADD CONSTRAINT "showreels_image_partage_fichier_id_fichiers_id_fk" FOREIGN KEY ("image_partage_fichier_id") REFERENCES "campus"."fichiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."showreels" ADD CONSTRAINT "showreels_compose_par_id_utilisateurs_id_fk" FOREIGN KEY ("compose_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."showreels" ADD CONSTRAINT "showreels_publie_par_id_utilisateurs_id_fk" FOREIGN KEY ("publie_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."showreels" ADD CONSTRAINT "showreels_maj_par_id_utilisateurs_id_fk" FOREIGN KEY ("maj_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creneaux_programme_session_idx" ON "campus"."creneaux_programme" USING btree ("session_id","jour");--> statement-breakpoint
CREATE INDEX "exceptions_programme_session_idx" ON "campus"."exceptions_programme" USING btree ("session_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "seances_creneaux_unique" ON "campus"."seances_creneaux" USING btree ("creneau_id","date");--> statement-breakpoint
CREATE INDEX "showreels_statut_idx" ON "campus"."showreels" USING btree ("statut");