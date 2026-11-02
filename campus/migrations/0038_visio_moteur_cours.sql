-- Moteur de la visio des cours : null ou « daily » (Daily), « livekit » (serveur du campus, visio.2iae.com).
ALTER TABLE "campus"."reglages_visio" ADD COLUMN IF NOT EXISTS "moteur_cours" text;
