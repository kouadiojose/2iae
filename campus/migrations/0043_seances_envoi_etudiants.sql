-- Micro et caméra des étudiants, réglés pour toute la classe par le formateur (21 novembre 2026) : dès la création du
-- cours (« Faire un cours ») ou pendant le direct (« Tous les étudiants »). Par défaut fermés : une salle de
-- conférence pleine de téléphones ferait un écho. Les réglages par étudiant passent par-dessus (routes/live.ts).
ALTER TABLE "campus"."seances" ADD COLUMN IF NOT EXISTS "envoi_etudiants" jsonb NOT NULL DEFAULT '{"micro":false,"camera":false}'::jsonb;
