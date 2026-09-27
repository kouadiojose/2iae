CREATE TABLE "campus"."groupes_travail" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"numero" integer NOT NULL,
	"nom" text NOT NULL,
	"salle_visio" text,
	"aide_demandee_le" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "campus"."membres_groupes" (
	"session_id" integer NOT NULL,
	"groupe_id" integer NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"ajoute_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membres_groupes_session_id_utilisateur_id_pk" PRIMARY KEY("session_id","utilisateur_id")
);
--> statement-breakpoint
CREATE TABLE "campus"."reactions_messages_live" (
	"message_id" integer NOT NULL,
	"utilisateur_id" integer NOT NULL,
	"emoji" text NOT NULL,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reactions_messages_live_message_id_utilisateur_id_emoji_pk" PRIMARY KEY("message_id","utilisateur_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "campus"."sessions_groupes" (
	"id" serial PRIMARY KEY NOT NULL,
	"seance_id" integer NOT NULL,
	"consigne" text DEFAULT '' NOT NULL,
	"fin_prevue_le" timestamp with time zone,
	"fermeture_le" timestamp with time zone,
	"fermee_le" timestamp with time zone,
	"retour_libre" boolean DEFAULT true NOT NULL,
	"choix_libre" boolean DEFAULT false NOT NULL,
	"annonce" text,
	"annonce_le" timestamp with time zone,
	"cree_par_id" integer,
	"cree_le" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campus"."messages_live" ADD COLUMN "destinataire_id" integer;--> statement-breakpoint
ALTER TABLE "campus"."messages_live" ADD COLUMN "groupe_id" integer;--> statement-breakpoint
ALTER TABLE "campus"."messages_live" ADD COLUMN "epingle" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "campus"."seances" ADD COLUMN "chat_mode" text DEFAULT 'tous' NOT NULL;--> statement-breakpoint
ALTER TABLE "campus"."groupes_travail" ADD CONSTRAINT "groupes_travail_session_id_sessions_groupes_id_fk" FOREIGN KEY ("session_id") REFERENCES "campus"."sessions_groupes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."membres_groupes" ADD CONSTRAINT "membres_groupes_session_id_sessions_groupes_id_fk" FOREIGN KEY ("session_id") REFERENCES "campus"."sessions_groupes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."membres_groupes" ADD CONSTRAINT "membres_groupes_groupe_id_groupes_travail_id_fk" FOREIGN KEY ("groupe_id") REFERENCES "campus"."groupes_travail"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."membres_groupes" ADD CONSTRAINT "membres_groupes_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."reactions_messages_live" ADD CONSTRAINT "reactions_messages_live_message_id_messages_live_id_fk" FOREIGN KEY ("message_id") REFERENCES "campus"."messages_live"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."reactions_messages_live" ADD CONSTRAINT "reactions_messages_live_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."sessions_groupes" ADD CONSTRAINT "sessions_groupes_seance_id_seances_id_fk" FOREIGN KEY ("seance_id") REFERENCES "campus"."seances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."sessions_groupes" ADD CONSTRAINT "sessions_groupes_cree_par_id_utilisateurs_id_fk" FOREIGN KEY ("cree_par_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "groupes_travail_session_idx" ON "campus"."groupes_travail" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "membres_groupes_groupe_idx" ON "campus"."membres_groupes" USING btree ("groupe_id");--> statement-breakpoint
CREATE INDEX "sessions_groupes_seance_idx" ON "campus"."sessions_groupes" USING btree ("seance_id");--> statement-breakpoint
ALTER TABLE "campus"."messages_live" ADD CONSTRAINT "messages_live_destinataire_id_utilisateurs_id_fk" FOREIGN KEY ("destinataire_id") REFERENCES "campus"."utilisateurs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campus"."messages_live" ADD CONSTRAINT "messages_live_groupe_id_groupes_travail_id_fk" FOREIGN KEY ("groupe_id") REFERENCES "campus"."groupes_travail"("id") ON DELETE cascade ON UPDATE no action;