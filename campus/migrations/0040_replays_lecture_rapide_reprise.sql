-- Le 3 novembre, ffmpeg ne se lançait pas sur le serveur : les replays marqués « abandonnés » sont repris.
UPDATE "campus"."replays_stockes" SET "lecture_rapide" = NULL WHERE "lecture_rapide" = false;
