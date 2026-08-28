-- =====================================================================
-- 2IAE International — schéma PostgreSQL complet
-- =====================================================================
-- Reflet fidèle de shared/schema.ts, qui reste la source de vérité.
-- Entièrement idempotent (CREATE ... IF NOT EXISTS) : ce fichier répare
-- une base partielle aussi bien qu'il en construit une depuis zéro.
--
-- Appliqué automatiquement avant chaque déploiement (voir scripts/migrate.js
-- et le preDeployCommand de railway.json).
-- =====================================================================

BEGIN;

-- Sessions Express (connect-pg-simple) -------------------------------
CREATE TABLE IF NOT EXISTS session (
  sid    VARCHAR PRIMARY KEY,
  sess   JSONB     NOT NULL,
  expire TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON session (expire);

-- Comptes ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id       VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_users (
  id         VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  username   TEXT NOT NULL UNIQUE,
  password   TEXT NOT NULL,
  email      TEXT NOT NULL,
  is_active  BOOLEAN   DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Formulaires et chatbot ---------------------------------------------
CREATE TABLE IF NOT EXISTS contacts (
  id         VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  message    TEXT NOT NULL,
  response   TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Contenus éditoriaux -------------------------------------------------
CREATE TABLE IF NOT EXISTS site_content (
  id         VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  key        TEXT NOT NULL UNIQUE,
  title      TEXT NOT NULL,
  value      TEXT NOT NULL,
  type       TEXT NOT NULL,
  section    TEXT NOT NULL,
  "order"    TEXT DEFAULT '0',
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by VARCHAR REFERENCES admin_users(id)
);

CREATE TABLE IF NOT EXISTS sliders (
  id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  subtitle     TEXT,
  description  TEXT,
  image_url    TEXT,
  button1_text TEXT,
  button1_link TEXT,
  button2_text TEXT,
  button2_link TEXT,
  is_active    BOOLEAN   DEFAULT TRUE,
  "order"      TEXT      DEFAULT '1',
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW(),
  created_by   VARCHAR REFERENCES admin_users(id)
);

CREATE TABLE IF NOT EXISTS founder_message (
  id                   VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title                TEXT NOT NULL,
  quote                TEXT NOT NULL,
  vision               TEXT NOT NULL,
  founder_name         TEXT NOT NULL,
  founder_role         TEXT NOT NULL,
  founder_organization TEXT NOT NULL,
  founder_image_url    TEXT,
  is_active            BOOLEAN   DEFAULT TRUE,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW(),
  updated_by           VARCHAR REFERENCES admin_users(id)
);

CREATE TABLE IF NOT EXISTS institutes (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  link        TEXT      DEFAULT '/filieres',
  button_text TEXT      DEFAULT 'EN SAVOIR PLUS',
  bg_color    TEXT      DEFAULT 'from-gray-800 to-gray-900',
  is_active   BOOLEAN   DEFAULT TRUE,
  "order"     TEXT      DEFAULT '1',
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  created_by  VARCHAR REFERENCES admin_users(id)
);

CREATE TABLE IF NOT EXISTS programs (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  description TEXT,
  image_url   TEXT,
  duration    TEXT,
  level       TEXT,
  is_active   BOOLEAN   DEFAULT TRUE,
  "order"     TEXT      DEFAULT '1',
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  created_by  VARCHAR REFERENCES admin_users(id)
);

CREATE TABLE IF NOT EXISTS news (
  id         VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  summary    TEXT,
  content    TEXT,
  image_url  TEXT,
  date       TEXT NOT NULL,
  category   TEXT NOT NULL,
  author     TEXT NOT NULL,
  featured   BOOLEAN   DEFAULT FALSE,
  is_active  BOOLEAN   DEFAULT TRUE,
  "order"    TEXT      DEFAULT '1',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR REFERENCES admin_users(id)
);

CREATE TABLE IF NOT EXISTS news_images (
  id         VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  news_id    VARCHAR NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  image_url  TEXT NOT NULL,
  caption    TEXT,
  "order"    INTEGER   DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Projets (table absente de la base de production avant cette migration)
CREATE TABLE IF NOT EXISTS projects (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  status      TEXT NOT NULL,
  images      JSONB     DEFAULT '[]',
  videos      JSONB     DEFAULT '[]',
  start_date  TIMESTAMP,
  end_date    TIMESTAMP,
  is_active   BOOLEAN   DEFAULT TRUE,
  "order"     TEXT      DEFAULT '1',
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  created_by  VARCHAR REFERENCES admin_users(id)
);

-- Tarifs (table absente de la base de production avant cette migration)
CREATE TABLE IF NOT EXISTS tariffs (
  id                 VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  site               TEXT NOT NULL,
  location           TEXT NOT NULL,
  phone              TEXT,
  email              TEXT,
  account_info       TEXT,
  program_name       TEXT NOT NULL,
  program_duration   TEXT      DEFAULT '2 ans',
  inscription_fee    INTEGER NOT NULL,
  frais_annexes      INTEGER NOT NULL,
  total_fee          INTEGER NOT NULL,
  first_payment      INTEGER NOT NULL,
  second_payment     INTEGER NOT NULL,
  third_payment      INTEGER NOT NULL,
  required_documents JSONB     DEFAULT '[]',
  uniform_costs      JSONB     DEFAULT '{}',
  supplies           JSONB     DEFAULT '[]',
  description        TEXT,
  is_active          BOOLEAN   DEFAULT TRUE,
  "order"            TEXT      DEFAULT '1',
  created_at         TIMESTAMP DEFAULT NOW(),
  updated_at         TIMESTAMP DEFAULT NOW(),
  created_by         VARCHAR REFERENCES admin_users(id)
);

-- Galerie --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS albums (
  id          VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
  category    TEXT NOT NULL,
  is_active   BOOLEAN   DEFAULT TRUE,
  "order"     TEXT      DEFAULT '1',
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW(),
  created_by  VARCHAR REFERENCES admin_users(id)
);

CREATE TABLE IF NOT EXISTS gallery_items (
  id            VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id      VARCHAR NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  title         TEXT,
  description   TEXT,
  media_url     TEXT NOT NULL,
  media_type    TEXT NOT NULL,
  thumbnail_url TEXT,
  is_active     BOOLEAN   DEFAULT TRUE,
  "order"       TEXT      DEFAULT '1',
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW(),
  created_by    VARCHAR REFERENCES admin_users(id)
);

-- Intégration Facebook -------------------------------------------------
-- Provenance des contenus : distingue la saisie admin de l'import Facebook.
-- ALTER ... IF NOT EXISTS : ces colonnes sont apparues après la première mise
-- en production, le fichier doit donc rattraper une base déjà en service.
ALTER TABLE news   ADD COLUMN IF NOT EXISTS source     TEXT DEFAULT 'manual';
ALTER TABLE news   ADD COLUMN IF NOT EXISTS source_id  TEXT;
ALTER TABLE news   ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS source     TEXT DEFAULT 'manual';
ALTER TABLE albums ADD COLUMN IF NOT EXISTS source_id  TEXT;

-- L'unicité de source_id est ce qui empêche un post d'être importé deux fois
-- quand le webhook et le rattrapage périodique le voient tous les deux.
CREATE UNIQUE INDEX IF NOT EXISTS news_source_id_key   ON news (source_id)   WHERE source_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS albums_source_id_key ON albums (source_id) WHERE source_id IS NOT NULL;

-- Journal d'ingestion : une ligne par publication vue, publiée ou non.
CREATE TABLE IF NOT EXISTS facebook_posts (
  id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      TEXT NOT NULL UNIQUE,
  permalink    TEXT,
  message      TEXT,
  published_at TIMESTAMP,
  status       TEXT NOT NULL DEFAULT 'published',
  reason       TEXT,
  rubrique     TEXT,
  importance   INTEGER,
  news_id      VARCHAR REFERENCES news(id)   ON DELETE SET NULL,
  album_id     VARCHAR REFERENCES albums(id) ON DELETE SET NULL,
  media_count  INTEGER   DEFAULT 0,
  classifier   TEXT,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);
ALTER TABLE facebook_posts ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE facebook_posts ADD COLUMN IF NOT EXISTS slider_id VARCHAR REFERENCES sliders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS facebook_posts_published_at_idx ON facebook_posts (published_at DESC);
CREATE INDEX IF NOT EXISTS facebook_posts_content_hash_idx ON facebook_posts (content_hash);

-- Bannières issues de Facebook : renouvelées automatiquement, les sliders
-- saisis à la main ne sont jamais touchés.
ALTER TABLE sliders ADD COLUMN IF NOT EXISTS source    TEXT DEFAULT 'manual';
ALTER TABLE sliders ADD COLUMN IF NOT EXISTS source_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS sliders_source_id_key ON sliders (source_id) WHERE source_id IS NOT NULL;

COMMIT;
