CREATE SCHEMA IF NOT EXISTS "campus";
--> statement-breakpoint
CREATE TABLE "campus"."classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nom" text NOT NULL,
	"site_id" integer NOT NULL,
	"filiere" text NOT NULL,
	"niveau" text NOT NULL,
	"annee_scolaire" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."fichiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"proprietaire_id" integer NOT NULL,
	"nom_original" text NOT NULL,
	"mime" text NOT NULL,
	"taille" integer NOT NULL,
	"cle" text NOT NULL,
	"usage" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fichiers_cle_unique" UNIQUE("cle")
);
--> statement-breakpoint
CREATE TABLE "campus"."journal" (
	"id" serial PRIMARY KEY NOT NULL,
	"utilisateur_id" integer,
	"action" text NOT NULL,
	"details" jsonb,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."reinitialisations" (
	"id" serial PRIMARY KEY NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"jeton_hash" text NOT NULL,
	"type" text DEFAULT 'reinitialisation' NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"utilise_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reinitialisations_jeton_hash_unique" UNIQUE("jeton_hash")
);
--> statement-breakpoint
CREATE TABLE "campus"."session" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."sites" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"nom" text NOT NULL,
	"nom_court" text NOT NULL,
	"ville" text NOT NULL,
	"salle_conference" text NOT NULL,
	"whatsapp_vie_scolaire" text,
	"ordre" integer DEFAULT 0 NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sites_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "campus"."suivis" (
	"id" serial PRIMARY KEY NOT NULL,
	"etudiant_id" integer NOT NULL,
	"auteur_id" integer NOT NULL,
	"texte" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."utilisateurs" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"prenom" text NOT NULL,
	"nom" text NOT NULL,
	"matricule" text,
	"email" text,
	"telephone" text,
	"mot_de_passe_hash" text NOT NULL,
	"doit_changer_mot_de_passe" boolean DEFAULT true NOT NULL,
	"mot_de_passe_expire_le" timestamp with time zone,
	"site_id" integer,
	"classe_id" integer,
	"photo_url" text,
	"slug" text,
	"titre" text,
	"bio" text,
	"localisation" text,
	"consentement_site" boolean DEFAULT false NOT NULL,
	"propose_sur_site" boolean DEFAULT false NOT NULL,
	"publier_sur_site" boolean DEFAULT false NOT NULL,
	"annonce_le" timestamp with time zone,
	"charte_acceptee_le" timestamp with time zone,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"jeton_agenda" text,
	"jeton_releve" text,
	"actif" boolean DEFAULT true NOT NULL,
	"derniere_connexion" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "utilisateurs_matricule_unique" UNIQUE("matricule"),
	CONSTRAINT "utilisateurs_email_unique" UNIQUE("email"),
	CONSTRAINT "utilisateurs_slug_unique" UNIQUE("slug"),
	CONSTRAINT "utilisateurs_jeton_agenda_unique" UNIQUE("jeton_agenda"),
	CONSTRAINT "utilisateurs_jeton_releve_unique" UNIQUE("jeton_releve")
);
--> statement-breakpoint
CREATE TABLE "campus"."cours" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"slug" text NOT NULL,
	"titre" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"objectifs" text DEFAULT '' NOT NULL,
	"image_url" text,
	"couleur" text DEFAULT '#E4793A' NOT NULL,
	"formateur_id" integer,
	"statut" text DEFAULT 'brouillon' NOT NULL,
	"date_debut" timestamp with time zone,
	"date_fin" timestamp with time zone,
	"propose_sur_site" boolean DEFAULT false NOT NULL,
	"publier_sur_site" boolean DEFAULT false NOT NULL,
	"accroche_site" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cours_code_unique" UNIQUE("code"),
	CONSTRAINT "cours_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "campus"."cours_classes" (
	"cours_id" integer NOT NULL,
	"classe_id" integer NOT NULL,
	CONSTRAINT "cours_classes_cours_id_classe_id_pk" PRIMARY KEY("cours_id","classe_id")
);
--> statement-breakpoint
CREATE TABLE "campus"."cours_formateurs" (
	"cours_id" integer NOT NULL,
	"formateur_id" integer NOT NULL,
	CONSTRAINT "cours_formateurs_cours_id_formateur_id_pk" PRIMARY KEY("cours_id","formateur_id")
);
--> statement-breakpoint
CREATE TABLE "campus"."inscriptions" (
	"cours_id" integer NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inscriptions_cours_id_utilisateur_id_pk" PRIMARY KEY("cours_id","utilisateur_id")
);
--> statement-breakpoint
CREATE TABLE "campus"."lecons" (
	"id" serial PRIMARY KEY NOT NULL,
	"module_id" integer NOT NULL,
	"cours_id" integer NOT NULL,
	"titre" text NOT NULL,
	"type" text DEFAULT 'texte' NOT NULL,
	"contenu" text DEFAULT '' NOT NULL,
	"url" text,
	"fichier_id" integer,
	"duree_minutes" integer,
	"ordre" integer DEFAULT 0 NOT NULL,
	"publiee" boolean DEFAULT true NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"cours_id" integer NOT NULL,
	"titre" text NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."progressions" (
	"utilisateur_id" integer NOT NULL,
	"lecon_id" integer NOT NULL,
	"terminee_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "progressions_utilisateur_id_lecon_id_pk" PRIMARY KEY("utilisateur_id","lecon_id")
);
--> statement-breakpoint
CREATE TABLE "campus"."effectifs_salles" (
	"seance_id" integer NOT NULL,
	"site_id" integer NOT NULL,
	"nombre" integer DEFAULT 0 NOT NULL,
	"prete" boolean DEFAULT false NOT NULL,
	"incident" text,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "effectifs_salles_seance_id_site_id_pk" PRIMARY KEY("seance_id","site_id")
);
--> statement-breakpoint
CREATE TABLE "campus"."mains_levees" (
	"id" serial PRIMARY KEY NOT NULL,
	"seance_id" integer NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"site_id" integer,
	"levee_le" timestamp with time zone DEFAULT now() NOT NULL,
	"parole_donnee_le" timestamp with time zone,
	"baissee_le" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "campus"."presences" (
	"id" serial PRIMARY KEY NOT NULL,
	"seance_id" integer NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"site_id" integer,
	"mode" text DEFAULT 'en_ligne' NOT NULL,
	"emarge_qr" boolean DEFAULT false NOT NULL,
	"arrivee_le" timestamp with time zone DEFAULT now() NOT NULL,
	"derniere_activite" timestamp with time zone DEFAULT now() NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"justification" text,
	"pointe_par_id" integer
);
--> statement-breakpoint
CREATE TABLE "campus"."questions_live" (
	"id" serial PRIMARY KEY NOT NULL,
	"seance_id" integer NOT NULL,
	"auteur_id" integer NOT NULL,
	"site_id" integer,
	"texte" text NOT NULL,
	"votes" integer DEFAULT 1 NOT NULL,
	"anonyme" boolean DEFAULT false NOT NULL,
	"repondue" boolean DEFAULT false NOT NULL,
	"epinglee" boolean DEFAULT false NOT NULL,
	"masquee" boolean DEFAULT false NOT NULL,
	"repondu_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."reponses_sondages" (
	"sondage_id" integer NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"choix" integer NOT NULL,
	"site_id" integer,
	CONSTRAINT "reponses_sondages_sondage_id_utilisateur_id_pk" PRIMARY KEY("sondage_id","utilisateur_id")
);
--> statement-breakpoint
CREATE TABLE "campus"."ressentis" (
	"id" serial PRIMARY KEY NOT NULL,
	"seance_id" integer NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"site_id" integer,
	"ressenti" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."seances" (
	"id" serial PRIMARY KEY NOT NULL,
	"cours_id" integer NOT NULL,
	"titre" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"debut" timestamp with time zone NOT NULL,
	"duree_minutes" integer DEFAULT 90 NOT NULL,
	"statut" text DEFAULT 'planifiee' NOT NULL,
	"fournisseur" text DEFAULT 'campus' NOT NULL,
	"salle_visio" text,
	"lien_externe" text,
	"plan" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"demarree_le" timestamp with time zone,
	"terminee_le" timestamp with time zone,
	"replay_url" text,
	"replay_duree_secondes" integer,
	"enregistrement_id" text,
	"transcription" text DEFAULT '' NOT NULL,
	"resume_ia" text,
	"resume_ia_le" timestamp with time zone,
	"resume_valide" boolean DEFAULT false NOT NULL,
	"diapos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"diapo_courante" integer DEFAULT 0 NOT NULL,
	"propose_sur_site" boolean DEFAULT false NOT NULL,
	"publier_sur_site" boolean DEFAULT false NOT NULL,
	"motif_annulation" text,
	"lien_secours" text,
	"plan_b_le" timestamp with time zone,
	"resume_par_ia" boolean DEFAULT false NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."sondages" (
	"id" serial PRIMARY KEY NOT NULL,
	"seance_id" integer NOT NULL,
	"question" text NOT NULL,
	"options" jsonb NOT NULL,
	"bonne_reponse" integer,
	"explication" text,
	"ouvert" boolean DEFAULT true NOT NULL,
	"ouvert_le" timestamp with time zone,
	"ferme_le" timestamp with time zone,
	"par_ia" boolean DEFAULT false NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."sous_titres" (
	"id" serial PRIMARY KEY NOT NULL,
	"seance_id" integer NOT NULL,
	"t" integer NOT NULL,
	"texte" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."votes_questions" (
	"question_id" integer NOT NULL,
	"utilisateur_id" integer NOT NULL,
	CONSTRAINT "votes_questions_question_id_utilisateur_id_pk" PRIMARY KEY("question_id","utilisateur_id")
);
--> statement-breakpoint
CREATE TABLE "campus"."devoirs" (
	"id" serial PRIMARY KEY NOT NULL,
	"cours_id" integer NOT NULL,
	"auteur_id" integer,
	"type" text DEFAULT 'depot' NOT NULL,
	"titre" text NOT NULL,
	"consigne" text DEFAULT '' NOT NULL,
	"fichier_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ouverture_le" timestamp with time zone,
	"date_limite" timestamp with time zone NOT NULL,
	"bareme" real DEFAULT 20 NOT NULL,
	"coefficient" real DEFAULT 1 NOT NULL,
	"accepte_retard" boolean DEFAULT true NOT NULL,
	"duree_minutes" integer,
	"tentatives_max" integer DEFAULT 1 NOT NULL,
	"correction_visible" boolean DEFAULT true NOT NULL,
	"grille" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"publie" boolean DEFAULT true NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."questions_quiz" (
	"id" serial PRIMARY KEY NOT NULL,
	"devoir_id" integer NOT NULL,
	"type" text DEFAULT 'qcm' NOT NULL,
	"enonce" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bonnes_reponses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"explication" text,
	"points" real DEFAULT 1 NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."rendus" (
	"id" serial PRIMARY KEY NOT NULL,
	"devoir_id" integer NOT NULL,
	"etudiant_id" integer NOT NULL,
	"texte" text DEFAULT '' NOT NULL,
	"fichier_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"statut" text DEFAULT 'brouillon' NOT NULL,
	"rendu_le" timestamp with time zone,
	"prepare_le" timestamp with time zone,
	"depose_par_id" integer,
	"en_retard" boolean DEFAULT false NOT NULL,
	"note" real,
	"note_detail" jsonb,
	"commentaire" text,
	"recu" text,
	"vu_le" timestamp with time zone,
	"commentaire_audio_id" integer,
	"proposition_ia" jsonb,
	"correcteur_id" integer,
	"corrige_le" timestamp with time zone,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."tentatives_quiz" (
	"id" serial PRIMARY KEY NOT NULL,
	"devoir_id" integer NOT NULL,
	"etudiant_id" integer NOT NULL,
	"debut_le" timestamp with time zone DEFAULT now() NOT NULL,
	"fin_prevue_le" timestamp with time zone,
	"fin_le" timestamp with time zone,
	"reponses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score" real,
	"note" real
);
--> statement-breakpoint
CREATE TABLE "campus"."abonnements_push" (
	"id" serial PRIMARY KEY NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"cles" jsonb NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "abonnements_push_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "campus"."annonces" (
	"id" serial PRIMARY KEY NOT NULL,
	"auteur_id" integer NOT NULL,
	"titre" text NOT NULL,
	"corps" text NOT NULL,
	"cible" text DEFAULT 'tous' NOT NULL,
	"site_id" integer,
	"classe_id" integer,
	"cours_id" integer,
	"importante" boolean DEFAULT false NOT NULL,
	"epinglee" boolean DEFAULT false NOT NULL,
	"propose_sur_site" boolean DEFAULT false NOT NULL,
	"publier_sur_site" boolean DEFAULT false NOT NULL,
	"publiee_le" timestamp with time zone DEFAULT now() NOT NULL,
	"expire_le" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "campus"."conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"cours_id" integer,
	"classe_id" integer,
	"titre" text,
	"cle_unique" text,
	"dernier_message_le" timestamp with time zone DEFAULT now() NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_cle_unique_unique" UNIQUE("cle_unique")
);
--> statement-breakpoint
CREATE TABLE "campus"."evenements" (
	"id" serial PRIMARY KEY NOT NULL,
	"titre" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"debut" timestamp with time zone NOT NULL,
	"fin" timestamp with time zone,
	"lieu" text,
	"cible" text DEFAULT 'tous' NOT NULL,
	"site_id" integer,
	"classe_id" integer,
	"cours_id" integer,
	"auteur_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."lectures_annonces" (
	"annonce_id" integer NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"lu_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lectures_annonces_annonce_id_utilisateur_id_pk" PRIMARY KEY("annonce_id","utilisateur_id")
);
--> statement-breakpoint
CREATE TABLE "campus"."messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"auteur_id" integer NOT NULL,
	"texte" text DEFAULT '' NOT NULL,
	"fichier_id" integer,
	"reponse_a_id" integer,
	"contexte" text,
	"duree_secondes" integer,
	"cle_envoi" text,
	"supprime" boolean DEFAULT false NOT NULL,
	"supprime_le" timestamp with time zone,
	"supprime_par_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"type" text NOT NULL,
	"titre" text NOT NULL,
	"corps" text,
	"lien" text,
	"lu_le" timestamp with time zone,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."participants" (
	"conversation_id" integer NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"lu_jusqu_a" timestamp with time zone,
	"sourdine" boolean DEFAULT false NOT NULL,
	CONSTRAINT "participants_conversation_id_utilisateur_id_pk" PRIMARY KEY("conversation_id","utilisateur_id")
);
--> statement-breakpoint
CREATE TABLE "campus"."conversations_ia" (
	"id" serial PRIMARY KEY NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"cours_id" integer,
	"lecon_id" integer,
	"devoir_id" integer,
	"titre" text DEFAULT 'Nouvelle conversation' NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	"maj_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."fiches_revision" (
	"id" serial PRIMARY KEY NOT NULL,
	"cours_id" integer NOT NULL,
	"lecon_id" integer,
	"seance_id" integer,
	"titre" text NOT NULL,
	"contenu" text NOT NULL,
	"validee" boolean DEFAULT false NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."messages_ia" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"contenu" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."usage_ia" (
	"utilisateur_id" integer NOT NULL,
	"jour" date NOT NULL,
	"requetes" integer DEFAULT 0 NOT NULL,
	"jetons_entree" integer DEFAULT 0 NOT NULL,
	"jetons_sortie" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_ia_utilisateur_id_jour_pk" PRIMARY KEY("utilisateur_id","jour")
);
--> statement-breakpoint
CREATE TABLE "campus"."essais_depot" (
	"id" serial PRIMARY KEY NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"recu" text NOT NULL,
	"fichier_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "essais_depot_recu_unique" UNIQUE("recu")
);
--> statement-breakpoint
CREATE TABLE "campus"."compteurs_push" (
	"utilisateur_id" integer NOT NULL,
	"jour" text NOT NULL,
	"nombre" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "compteurs_push_utilisateur_id_jour_pk" PRIMARY KEY("utilisateur_id","jour")
);
--> statement-breakpoint
CREATE TABLE "campus"."push_differes" (
	"id" serial PRIMARY KEY NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"notification_id" integer NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."relances_annonces" (
	"id" serial PRIMARY KEY NOT NULL,
	"annonce_id" integer NOT NULL,
	"auteur_id" integer NOT NULL,
	"destinataires" integer DEFAULT 0 NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."lectures_cours" (
	"utilisateur_id" integer NOT NULL,
	"cours_id" integer NOT NULL,
	"lecon_id" integer NOT NULL,
	"lue_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lectures_cours_utilisateur_id_cours_id_pk" PRIMARY KEY("utilisateur_id","cours_id")
);
--> statement-breakpoint
CREATE TABLE "campus"."evenements_seances" (
	"id" serial PRIMARY KEY NOT NULL,
	"seance_id" integer NOT NULL,
	"type" text NOT NULL,
	"donnees" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus"."rappels_live" (
	"seance_id" integer NOT NULL,
	"type" text NOT NULL,
	"envoye_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rappels_live_seance_id_type_pk" PRIMARY KEY("seance_id","type")
);
--> statement-breakpoint
CREATE TABLE "campus"."signalements_questions" (
	"question_id" integer NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signalements_questions_question_id_utilisateur_id_pk" PRIMARY KEY("question_id","utilisateur_id")
);
--> statement-breakpoint
CREATE TABLE "campus"."vues_replay" (
	"seance_id" integer NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"premiere_vue" timestamp with time zone DEFAULT now() NOT NULL,
	"derniere_vue" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vues_replay_seance_id_utilisateur_id_pk" PRIMARY KEY("seance_id","utilisateur_id")
);
--> statement-breakpoint
CREATE TABLE "campus"."rappels_devoirs" (
	"devoir_id" integer NOT NULL,
	"type" text NOT NULL,
	"echeance" timestamp with time zone NOT NULL,
	"destinataires" integer DEFAULT 0 NOT NULL,
	"envoye_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rappels_devoirs_devoir_id_type_pk" PRIMARY KEY("devoir_id","type")
);
--> statement-breakpoint
CREATE TABLE "campus"."signalements_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"auteur_id" integer NOT NULL,
	"motif" text,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campus"."classes" ADD CONSTRAINT "classes_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "campus"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."fichiers" ADD CONSTRAINT "fichiers_proprietaire_id_utilisateurs_id_fk" FOREIGN KEY ("proprietaire_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."journal" ADD CONSTRAINT "journal_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."reinitialisations" ADD CONSTRAINT "reinitialisations_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."suivis" ADD CONSTRAINT "suivis_etudiant_id_utilisateurs_id_fk" FOREIGN KEY ("etudiant_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."suivis" ADD CONSTRAINT "suivis_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."utilisateurs" ADD CONSTRAINT "utilisateurs_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "campus"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."utilisateurs" ADD CONSTRAINT "utilisateurs_classe_id_classes_id_fk" FOREIGN KEY ("classe_id") REFERENCES "campus"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."cours" ADD CONSTRAINT "cours_formateur_id_utilisateurs_id_fk" FOREIGN KEY ("formateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."cours_classes" ADD CONSTRAINT "cours_classes_cours_id_cours_id_fk" FOREIGN KEY ("cours_id") REFERENCES "campus"."cours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."cours_classes" ADD CONSTRAINT "cours_classes_classe_id_classes_id_fk" FOREIGN KEY ("classe_id") REFERENCES "campus"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."cours_formateurs" ADD CONSTRAINT "cours_formateurs_cours_id_cours_id_fk" FOREIGN KEY ("cours_id") REFERENCES "campus"."cours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."cours_formateurs" ADD CONSTRAINT "cours_formateurs_formateur_id_utilisateurs_id_fk" FOREIGN KEY ("formateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."inscriptions" ADD CONSTRAINT "inscriptions_cours_id_cours_id_fk" FOREIGN KEY ("cours_id") REFERENCES "campus"."cours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."inscriptions" ADD CONSTRAINT "inscriptions_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."lecons" ADD CONSTRAINT "lecons_module_id_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "campus"."modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."lecons" ADD CONSTRAINT "lecons_cours_id_cours_id_fk" FOREIGN KEY ("cours_id") REFERENCES "campus"."cours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."lecons" ADD CONSTRAINT "lecons_fichier_id_fichiers_id_fk" FOREIGN KEY ("fichier_id") REFERENCES "campus"."fichiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."modules" ADD CONSTRAINT "modules_cours_id_cours_id_fk" FOREIGN KEY ("cours_id") REFERENCES "campus"."cours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."progressions" ADD CONSTRAINT "progressions_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."progressions" ADD CONSTRAINT "progressions_lecon_id_lecons_id_fk" FOREIGN KEY ("lecon_id") REFERENCES "campus"."lecons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."effectifs_salles" ADD CONSTRAINT "effectifs_salles_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."effectifs_salles" ADD CONSTRAINT "effectifs_salles_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "campus"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."mains_levees" ADD CONSTRAINT "mains_levees_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."mains_levees" ADD CONSTRAINT "mains_levees_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."mains_levees" ADD CONSTRAINT "mains_levees_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "campus"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."presences" ADD CONSTRAINT "presences_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."presences" ADD CONSTRAINT "presences_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."presences" ADD CONSTRAINT "presences_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "campus"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."questions_live" ADD CONSTRAINT "questions_live_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."questions_live" ADD CONSTRAINT "questions_live_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."questions_live" ADD CONSTRAINT "questions_live_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "campus"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."reponses_sondages" ADD CONSTRAINT "reponses_sondages_sondage_id_sondages_id_fk" FOREIGN KEY ("sondage_id") REFERENCES "campus"."sondages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."reponses_sondages" ADD CONSTRAINT "reponses_sondages_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."reponses_sondages" ADD CONSTRAINT "reponses_sondages_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "campus"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."ressentis" ADD CONSTRAINT "ressentis_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."ressentis" ADD CONSTRAINT "ressentis_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."ressentis" ADD CONSTRAINT "ressentis_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "campus"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."seances" ADD CONSTRAINT "seances_cours_id_cours_id_fk" FOREIGN KEY ("cours_id") REFERENCES "campus"."cours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."sondages" ADD CONSTRAINT "sondages_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."sous_titres" ADD CONSTRAINT "sous_titres_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."votes_questions" ADD CONSTRAINT "votes_questions_question_id_questions_live_id_fk" FOREIGN KEY ("question_id") REFERENCES "campus"."questions_live"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."votes_questions" ADD CONSTRAINT "votes_questions_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."devoirs" ADD CONSTRAINT "devoirs_cours_id_cours_id_fk" FOREIGN KEY ("cours_id") REFERENCES "campus"."cours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."devoirs" ADD CONSTRAINT "devoirs_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."questions_quiz" ADD CONSTRAINT "questions_quiz_devoir_id_devoirs_id_fk" FOREIGN KEY ("devoir_id") REFERENCES "campus"."devoirs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."rendus" ADD CONSTRAINT "rendus_devoir_id_devoirs_id_fk" FOREIGN KEY ("devoir_id") REFERENCES "campus"."devoirs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."rendus" ADD CONSTRAINT "rendus_etudiant_id_utilisateurs_id_fk" FOREIGN KEY ("etudiant_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."rendus" ADD CONSTRAINT "rendus_depose_par_id_utilisateurs_id_fk" FOREIGN KEY ("depose_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."rendus" ADD CONSTRAINT "rendus_correcteur_id_utilisateurs_id_fk" FOREIGN KEY ("correcteur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."tentatives_quiz" ADD CONSTRAINT "tentatives_quiz_devoir_id_devoirs_id_fk" FOREIGN KEY ("devoir_id") REFERENCES "campus"."devoirs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."tentatives_quiz" ADD CONSTRAINT "tentatives_quiz_etudiant_id_utilisateurs_id_fk" FOREIGN KEY ("etudiant_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."abonnements_push" ADD CONSTRAINT "abonnements_push_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."annonces" ADD CONSTRAINT "annonces_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."annonces" ADD CONSTRAINT "annonces_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "campus"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."annonces" ADD CONSTRAINT "annonces_classe_id_classes_id_fk" FOREIGN KEY ("classe_id") REFERENCES "campus"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."annonces" ADD CONSTRAINT "annonces_cours_id_cours_id_fk" FOREIGN KEY ("cours_id") REFERENCES "campus"."cours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."conversations" ADD CONSTRAINT "conversations_cours_id_cours_id_fk" FOREIGN KEY ("cours_id") REFERENCES "campus"."cours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."conversations" ADD CONSTRAINT "conversations_classe_id_classes_id_fk" FOREIGN KEY ("classe_id") REFERENCES "campus"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."evenements" ADD CONSTRAINT "evenements_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "campus"."sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."evenements" ADD CONSTRAINT "evenements_classe_id_classes_id_fk" FOREIGN KEY ("classe_id") REFERENCES "campus"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."evenements" ADD CONSTRAINT "evenements_cours_id_cours_id_fk" FOREIGN KEY ("cours_id") REFERENCES "campus"."cours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."evenements" ADD CONSTRAINT "evenements_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."lectures_annonces" ADD CONSTRAINT "lectures_annonces_annonce_id_annonces_id_fk" FOREIGN KEY ("annonce_id") REFERENCES "campus"."annonces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."lectures_annonces" ADD CONSTRAINT "lectures_annonces_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "campus"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."messages" ADD CONSTRAINT "messages_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."messages" ADD CONSTRAINT "messages_fichier_id_fichiers_id_fk" FOREIGN KEY ("fichier_id") REFERENCES "campus"."fichiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."messages" ADD CONSTRAINT "messages_supprime_par_id_utilisateurs_id_fk" FOREIGN KEY ("supprime_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."notifications" ADD CONSTRAINT "notifications_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."participants" ADD CONSTRAINT "participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "campus"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."participants" ADD CONSTRAINT "participants_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."conversations_ia" ADD CONSTRAINT "conversations_ia_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."conversations_ia" ADD CONSTRAINT "conversations_ia_cours_id_cours_id_fk" FOREIGN KEY ("cours_id") REFERENCES "campus"."cours"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."conversations_ia" ADD CONSTRAINT "conversations_ia_lecon_id_lecons_id_fk" FOREIGN KEY ("lecon_id") REFERENCES "campus"."lecons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."conversations_ia" ADD CONSTRAINT "conversations_ia_devoir_id_devoirs_id_fk" FOREIGN KEY ("devoir_id") REFERENCES "campus"."devoirs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."fiches_revision" ADD CONSTRAINT "fiches_revision_cours_id_cours_id_fk" FOREIGN KEY ("cours_id") REFERENCES "campus"."cours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."messages_ia" ADD CONSTRAINT "messages_ia_conversation_id_conversations_ia_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "campus"."conversations_ia"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."usage_ia" ADD CONSTRAINT "usage_ia_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."essais_depot" ADD CONSTRAINT "essais_depot_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."compteurs_push" ADD CONSTRAINT "compteurs_push_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."push_differes" ADD CONSTRAINT "push_differes_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."push_differes" ADD CONSTRAINT "push_differes_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "campus"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."relances_annonces" ADD CONSTRAINT "relances_annonces_annonce_id_annonces_id_fk" FOREIGN KEY ("annonce_id") REFERENCES "campus"."annonces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."relances_annonces" ADD CONSTRAINT "relances_annonces_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."lectures_cours" ADD CONSTRAINT "lectures_cours_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."lectures_cours" ADD CONSTRAINT "lectures_cours_cours_id_cours_id_fk" FOREIGN KEY ("cours_id") REFERENCES "campus"."cours"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."lectures_cours" ADD CONSTRAINT "lectures_cours_lecon_id_lecons_id_fk" FOREIGN KEY ("lecon_id") REFERENCES "campus"."lecons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."evenements_seances" ADD CONSTRAINT "evenements_seances_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."rappels_live" ADD CONSTRAINT "rappels_live_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."signalements_questions" ADD CONSTRAINT "signalements_questions_question_id_questions_live_id_fk" FOREIGN KEY ("question_id") REFERENCES "campus"."questions_live"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."signalements_questions" ADD CONSTRAINT "signalements_questions_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."vues_replay" ADD CONSTRAINT "vues_replay_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."vues_replay" ADD CONSTRAINT "vues_replay_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."rappels_devoirs" ADD CONSTRAINT "rappels_devoirs_devoir_id_devoirs_id_fk" FOREIGN KEY ("devoir_id") REFERENCES "campus"."devoirs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."signalements_messages" ADD CONSTRAINT "signalements_messages_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "campus"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."signalements_messages" ADD CONSTRAINT "signalements_messages_auteur_id_utilisateurs_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "classes_site_idx" ON "campus"."classes" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "journal_date_idx" ON "campus"."journal" USING btree ("cree_le");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "campus"."session" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "suivis_etudiant_idx" ON "campus"."suivis" USING btree ("etudiant_id");--> statement-breakpoint
CREATE INDEX "utilisateurs_classe_idx" ON "campus"."utilisateurs" USING btree ("classe_id");--> statement-breakpoint
CREATE INDEX "utilisateurs_role_idx" ON "campus"."utilisateurs" USING btree ("role");--> statement-breakpoint
CREATE INDEX "utilisateurs_telephone_idx" ON "campus"."utilisateurs" USING btree ("telephone");--> statement-breakpoint
CREATE INDEX "cours_formateur_idx" ON "campus"."cours" USING btree ("formateur_id");--> statement-breakpoint
CREATE INDEX "lecons_module_idx" ON "campus"."lecons" USING btree ("module_id");--> statement-breakpoint
CREATE INDEX "lecons_cours_idx" ON "campus"."lecons" USING btree ("cours_id");--> statement-breakpoint
CREATE INDEX "modules_cours_idx" ON "campus"."modules" USING btree ("cours_id");--> statement-breakpoint
CREATE INDEX "mains_seance_idx" ON "campus"."mains_levees" USING btree ("seance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "presences_unique" ON "campus"."presences" USING btree ("seance_id","utilisateur_id");--> statement-breakpoint
CREATE INDEX "questions_live_seance_idx" ON "campus"."questions_live" USING btree ("seance_id");--> statement-breakpoint
CREATE INDEX "ressentis_seance_idx" ON "campus"."ressentis" USING btree ("seance_id","cree_le");--> statement-breakpoint
CREATE INDEX "seances_cours_idx" ON "campus"."seances" USING btree ("cours_id");--> statement-breakpoint
CREATE INDEX "seances_debut_idx" ON "campus"."seances" USING btree ("debut");--> statement-breakpoint
CREATE INDEX "sondages_seance_idx" ON "campus"."sondages" USING btree ("seance_id");--> statement-breakpoint
CREATE INDEX "sous_titres_seance_idx" ON "campus"."sous_titres" USING btree ("seance_id");--> statement-breakpoint
CREATE INDEX "devoirs_cours_idx" ON "campus"."devoirs" USING btree ("cours_id");--> statement-breakpoint
CREATE INDEX "devoirs_limite_idx" ON "campus"."devoirs" USING btree ("date_limite");--> statement-breakpoint
CREATE INDEX "questions_quiz_devoir_idx" ON "campus"."questions_quiz" USING btree ("devoir_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rendus_unique" ON "campus"."rendus" USING btree ("devoir_id","etudiant_id");--> statement-breakpoint
CREATE INDEX "tentatives_devoir_etudiant_idx" ON "campus"."tentatives_quiz" USING btree ("devoir_id","etudiant_id");--> statement-breakpoint
CREATE INDEX "annonces_date_idx" ON "campus"."annonces" USING btree ("publiee_le");--> statement-breakpoint
CREATE INDEX "conversations_cours_idx" ON "campus"."conversations" USING btree ("cours_id");--> statement-breakpoint
CREATE INDEX "conversations_classe_idx" ON "campus"."conversations" USING btree ("classe_id");--> statement-breakpoint
CREATE INDEX "evenements_debut_idx" ON "campus"."evenements" USING btree ("debut");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "campus"."messages" USING btree ("conversation_id","cree_le");--> statement-breakpoint
CREATE INDEX "messages_fichier_idx" ON "campus"."messages" USING btree ("fichier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_cle_envoi_idx" ON "campus"."messages" USING btree ("auteur_id","cle_envoi");--> statement-breakpoint
CREATE INDEX "notifications_utilisateur_idx" ON "campus"."notifications" USING btree ("utilisateur_id","cree_le");--> statement-breakpoint
CREATE INDEX "participants_utilisateur_idx" ON "campus"."participants" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE INDEX "conversations_ia_utilisateur_idx" ON "campus"."conversations_ia" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE INDEX "fiches_cours_idx" ON "campus"."fiches_revision" USING btree ("cours_id");--> statement-breakpoint
CREATE INDEX "messages_ia_conversation_idx" ON "campus"."messages_ia" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "essais_depot_utilisateur_idx" ON "campus"."essais_depot" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE INDEX "push_differes_utilisateur_idx" ON "campus"."push_differes" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE INDEX "relances_annonce_idx" ON "campus"."relances_annonces" USING btree ("annonce_id");--> statement-breakpoint
CREATE INDEX "lectures_cours_lecon_idx" ON "campus"."lectures_cours" USING btree ("lecon_id");--> statement-breakpoint
CREATE INDEX "evenements_seances_idx" ON "campus"."evenements_seances" USING btree ("seance_id","cree_le");--> statement-breakpoint
CREATE UNIQUE INDEX "signalements_message_auteur_idx" ON "campus"."signalements_messages" USING btree ("message_id","auteur_id");--> statement-breakpoint
CREATE INDEX "signalements_message_idx" ON "campus"."signalements_messages" USING btree ("message_id");