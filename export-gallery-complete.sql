-- Export complet de la galerie photos/vidéos
-- Script d'importation pour la production
-- Exécuter dans l'ordre : 1) albums, 2) gallery_items

-- ===================== ALBUMS =====================

-- Créer la table albums si elle n'existe pas déjà
CREATE TABLE IF NOT EXISTS albums (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR NOT NULL,
  description TEXT,
  cover_image VARCHAR,
  category VARCHAR NOT NULL,
  is_active BOOLEAN DEFAULT true,
  "order" INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR
);

-- Insérer les données des albums
INSERT INTO albums (id, title, description, cover_image, category, is_active, "order", created_at, updated_at, created_by) VALUES 
('be91af32-2af7-4feb-8e80-b7b01f5c179f', 'Partenariat avec Catalyste+', 'Un Partenariat avec Catalyste+ avec la présence du PDG du groupe Ecoles 2IAE Séraphin Koua et Madame', 'https://2iae-images.nyc3.digitaloceanspaces.com/gallery//gallery_1757082268095_09aw5xq47vcl.jpg', 'Activités', true, 1, '2025-09-05 14:24:34.084644', '2025-09-05 14:24:34.084644', '')
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  cover_image = EXCLUDED.cover_image,
  category = EXCLUDED.category,
  is_active = EXCLUDED.is_active,
  "order" = EXCLUDED."order",
  updated_at = NOW();

-- ===================== GALLERY_ITEMS =====================

-- Créer la table gallery_items si elle n'existe pas déjà
CREATE TABLE IF NOT EXISTS gallery_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  album_id VARCHAR NOT NULL,
  title VARCHAR,
  description TEXT,
  media_url VARCHAR NOT NULL,
  media_type VARCHAR NOT NULL DEFAULT 'image',
  thumbnail_url VARCHAR,
  is_active BOOLEAN DEFAULT true,
  "order" INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR,
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

-- Insérer les données des éléments de galerie
INSERT INTO gallery_items (id, album_id, title, description, media_url, media_type, thumbnail_url, is_active, "order", created_at, updated_at, created_by) VALUES 
('ce00ddfc-09e8-47dd-8762-c4b326445e53', 'be91af32-2af7-4feb-8e80-b7b01f5c179f', '', '', 'https://2iae-images.nyc3.digitaloceanspaces.com/gallery//gallery_1757082309066_wp85zohshc.jpg', 'image', '', true, 1, '2025-09-05 14:25:32.843396', '2025-09-05 14:25:32.843396', ''),
('3c95521e-6018-4c8d-a314-b30d9f5f3b61', 'be91af32-2af7-4feb-8e80-b7b01f5c179f', 'Etape de signature', 'Etape de signature', 'https://2iae-images.nyc3.digitaloceanspaces.com/gallery//gallery_1757082364298_yckwkfxbtw.jpg', 'image', '', true, 1, '2025-09-05 14:26:24.703458', '2025-09-05 14:26:24.703458', '')
ON CONFLICT (id) DO UPDATE SET
  album_id = EXCLUDED.album_id,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  media_url = EXCLUDED.media_url,
  media_type = EXCLUDED.media_type,
  thumbnail_url = EXCLUDED.thumbnail_url,
  is_active = EXCLUDED.is_active,
  "order" = EXCLUDED."order",
  updated_at = NOW();

-- Message de confirmation
SELECT 'Export de galerie terminé!' as status;