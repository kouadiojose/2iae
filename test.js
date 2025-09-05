#!/usr/bin/env node

import pg from "pg";

const { Pool } = pg;

// Configuration PostgreSQL pour DigitalOcean
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

const createAlbumsTable = `
-- Table albums
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
`;

const createGalleryItemsTable = `
-- Table gallery_items
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
`;

const insertAlbumsData = `
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
`;

const insertGalleryItemsData = `
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
`;

async function migrateGallery() {
  console.log(
    "Début de la migration des tables galerie (albums + gallery_items)...",
  );

  try {
    // Test de connexion
    console.log("Vérification de la connexion...");
    const client = await pool.connect();
    await client.query("SELECT 1");
    console.log("Connexion réussie !");

    // 1. Création de la table albums
    console.log("1. Création de la table albums...");
    await client.query(createAlbumsTable);
    console.log("Table albums créée avec succès !");

    // 2. Création de la table gallery_items
    console.log("2. Création de la table gallery_items...");
    await client.query(createGalleryItemsTable);
    console.log("Table gallery_items créée avec succès !");

    // 3. Insertion des données albums
    console.log("3. Insertion des données albums...");
    await client.query(insertAlbumsData);
    console.log("Données albums insérées !");

    // 4. Insertion des données gallery_items
    console.log("4. Insertion des données gallery_items...");
    await client.query(insertGalleryItemsData);
    console.log("Données gallery_items insérées !");

    // Vérification des données
    console.log("\nVérification des données...");

    const albumsCount = await client.query(
      "SELECT COUNT(*) as total FROM albums",
    );
    const galleryItemsCount = await client.query(
      "SELECT COUNT(*) as total FROM gallery_items",
    );

    console.log(`Albums créés: ${albumsCount.rows[0].total}`);
    console.log(
      `Éléments de galerie créés: ${galleryItemsCount.rows[0].total}`,
    );

    // Affichage des albums
    const albumsData = await client.query(
      'SELECT title, category, "order" FROM albums ORDER BY "order"',
    );
    console.log("\nAlbums configurés:");
    albumsData.rows.forEach((album) => {
      console.log(`  - ${album.title} (${album.category})`);
    });

    // Affichage des éléments de galerie par album
    const galleryData = await client.query(`
            SELECT gi.title, gi.media_type, a.title as album_title 
            FROM gallery_items gi 
            JOIN albums a ON gi.album_id = a.id 
            ORDER BY a."order", gi."order"
        `);

    console.log("\nÉléments de galerie:");
    galleryData.rows.forEach((item) => {
      console.log(
        `  - ${item.title || "Sans titre"} (${item.media_type}) dans "${item.album_title}"`,
      );
    });

    // Vérification des contraintes
    const constraintsCheck = await client.query(`
            SELECT constraint_name, table_name 
            FROM information_schema.table_constraints 
            WHERE table_name IN ('albums', 'gallery_items') 
            AND constraint_type = 'FOREIGN KEY'
        `);

    console.log("\nContraintes de clés étrangères:");
    constraintsCheck.rows.forEach((constraint) => {
      console.log(
        `  - ${constraint.constraint_name} sur ${constraint.table_name}`,
      );
    });

    client.release();
    await pool.end();

    console.log("\nMigration de la galerie terminée avec succès !");
    console.log(
      "Les tables albums et gallery_items sont prêtes avec les données du partenariat Catalyste+.",
    );
  } catch (error) {
    console.error("Erreur lors de la migration :", error.message);
    console.error("Détails :", error);
    process.exit(1);
  }
}

// Vérification de la variable d'environnement
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL n'est pas définie");
  console.log(
    'Utilisez: DATABASE_URL="your-connection-string" node migrate-gallery.js',
  );
  process.exit(1);
}

// Lancement de la migration
migrateGallery();
