CREATE TABLE "campus"."dossiers_etudiants" (
	"etudiant_id" integer PRIMARY KEY NOT NULL,
	"sexe" text,
	"date_naissance" date,
	"lieu_naissance" text,
	"nationalite" text,
	"adresse" text,
	"whatsapp" text,
	"statut" text DEFAULT 'inscrit' NOT NULL,
	"statut_le" timestamp with time zone,
	"date_inscription" date,
	"responsables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"origine" text DEFAULT 'saisie' NOT NULL,
	"lead_id" text,
	"remarques" text,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dossiers_etudiants_lead_id_unique" UNIQUE("lead_id")
);
--> statement-breakpoint
CREATE TABLE "campus"."echeances_etudiants" (
	"id" serial PRIMARY KEY NOT NULL,
	"etudiant_id" integer NOT NULL,
	"annee_scolaire" text NOT NULL,
	"type" text DEFAULT 'frais' NOT NULL,
	"libelle" text NOT NULL,
	"montant" integer NOT NULL,
	"date_limite" date,
	"cree_par_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."frais_classes" (
	"classe_id" integer PRIMARY KEY NOT NULL,
	"echeancier" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"modifie_le" timestamp with time zone DEFAULT now() NOT NULL,
	"modifie_par_id" integer
);
--> statement-breakpoint
CREATE TABLE "campus"."pieces_dossier" (
	"id" serial PRIMARY KEY NOT NULL,
	"etudiant_id" integer NOT NULL,
	"type" text NOT NULL,
	"libelle" text,
	"fichier_id" integer,
	"statut" text DEFAULT 'recue' NOT NULL,
	"note" text,
	"ajoutee_par_id" integer,
	"verifiee_par_id" integer,
	"verifiee_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."taches_suivi" (
	"id" serial PRIMARY KEY NOT NULL,
	"etudiant_id" integer NOT NULL,
	"titre" text NOT NULL,
	"echeance" date NOT NULL,
	"responsable_id" integer,
	"cree_par_id" integer,
	"faite_le" timestamp with time zone,
	"faite_par_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."versements" (
	"id" serial PRIMARY KEY NOT NULL,
	"numero" text NOT NULL,
	"etudiant_id" integer NOT NULL,
	"annee_scolaire" text NOT NULL,
	"montant" integer NOT NULL,
	"moyen" text NOT NULL,
	"reference" text,
	"date_versement" date NOT NULL,
	"note" text,
	"encaisse_par_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"annule_le" timestamp with time zone,
	"annule_par_id" integer,
	"motif_annulation" text
);
--> statement-breakpoint
ALTER TABLE "campus"."suivis" ADD COLUMN "type" text DEFAULT 'note' NOT NULL;--> statement-breakpoint
ALTER TABLE "campus"."utilisateurs" ADD COLUMN "compte_lie_id" integer;--> statement-breakpoint
ALTER TABLE "campus"."dossiers_etudiants" ADD CONSTRAINT "dossiers_etudiants_etudiant_id_utilisateurs_id_fk" FOREIGN KEY ("etudiant_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."echeances_etudiants" ADD CONSTRAINT "echeances_etudiants_etudiant_id_utilisateurs_id_fk" FOREIGN KEY ("etudiant_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."echeances_etudiants" ADD CONSTRAINT "echeances_etudiants_cree_par_id_utilisateurs_id_fk" FOREIGN KEY ("cree_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."frais_classes" ADD CONSTRAINT "frais_classes_classe_id_classes_id_fk" FOREIGN KEY ("classe_id") REFERENCES "campus"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."frais_classes" ADD CONSTRAINT "frais_classes_modifie_par_id_utilisateurs_id_fk" FOREIGN KEY ("modifie_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."pieces_dossier" ADD CONSTRAINT "pieces_dossier_etudiant_id_utilisateurs_id_fk" FOREIGN KEY ("etudiant_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."pieces_dossier" ADD CONSTRAINT "pieces_dossier_fichier_id_fichiers_id_fk" FOREIGN KEY ("fichier_id") REFERENCES "campus"."fichiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."pieces_dossier" ADD CONSTRAINT "pieces_dossier_ajoutee_par_id_utilisateurs_id_fk" FOREIGN KEY ("ajoutee_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."pieces_dossier" ADD CONSTRAINT "pieces_dossier_verifiee_par_id_utilisateurs_id_fk" FOREIGN KEY ("verifiee_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."taches_suivi" ADD CONSTRAINT "taches_suivi_etudiant_id_utilisateurs_id_fk" FOREIGN KEY ("etudiant_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."taches_suivi" ADD CONSTRAINT "taches_suivi_responsable_id_utilisateurs_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."taches_suivi" ADD CONSTRAINT "taches_suivi_cree_par_id_utilisateurs_id_fk" FOREIGN KEY ("cree_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."taches_suivi" ADD CONSTRAINT "taches_suivi_faite_par_id_utilisateurs_id_fk" FOREIGN KEY ("faite_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."versements" ADD CONSTRAINT "versements_etudiant_id_utilisateurs_id_fk" FOREIGN KEY ("etudiant_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."versements" ADD CONSTRAINT "versements_encaisse_par_id_utilisateurs_id_fk" FOREIGN KEY ("encaisse_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."versements" ADD CONSTRAINT "versements_annule_par_id_utilisateurs_id_fk" FOREIGN KEY ("annule_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dossiers_etudiants_statut_idx" ON "campus"."dossiers_etudiants" USING btree ("statut");--> statement-breakpoint
CREATE INDEX "echeances_etudiants_etudiant_idx" ON "campus"."echeances_etudiants" USING btree ("etudiant_id","annee_scolaire");--> statement-breakpoint
CREATE INDEX "pieces_dossier_etudiant_idx" ON "campus"."pieces_dossier" USING btree ("etudiant_id");--> statement-breakpoint
CREATE INDEX "pieces_dossier_statut_idx" ON "campus"."pieces_dossier" USING btree ("statut");--> statement-breakpoint
CREATE INDEX "taches_suivi_etudiant_idx" ON "campus"."taches_suivi" USING btree ("etudiant_id");--> statement-breakpoint
CREATE INDEX "taches_suivi_ouvertes_idx" ON "campus"."taches_suivi" USING btree ("faite_le","echeance");--> statement-breakpoint
CREATE UNIQUE INDEX "versements_numero_unique" ON "campus"."versements" USING btree ("numero");--> statement-breakpoint
CREATE INDEX "versements_etudiant_idx" ON "campus"."versements" USING btree ("etudiant_id");--> statement-breakpoint
CREATE INDEX "versements_date_idx" ON "campus"."versements" USING btree ("date_versement");--> statement-breakpoint
ALTER TABLE "campus"."utilisateurs" ADD CONSTRAINT "utilisateurs_compte_lie_id_utilisateurs_id_fk" FOREIGN KEY ("compte_lie_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;