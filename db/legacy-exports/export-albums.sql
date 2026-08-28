-- Export des données de la table albums
-- Utilisé pour importer les albums en production

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