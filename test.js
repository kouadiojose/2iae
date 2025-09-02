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

const migrationScript = `
-- ==================================================================
-- MIGRATION 2IAE INTERNATIONAL - VERSION MISE À JOUR
-- Date: 01 Septembre 2025
-- ==================================================================

-- Table session (pour persistance sessions)
CREATE TABLE IF NOT EXISTS session (
    sid VARCHAR PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMP NOT NULL
);

-- Table users
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
);

-- Table contacts
CREATE TABLE IF NOT EXISTS contacts (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    message TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table admin_users
CREATE TABLE IF NOT EXISTS admin_users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    email TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table site_content
CREATE TABLE IF NOT EXISTS site_content (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    value TEXT NOT NULL,
    type TEXT NOT NULL,
    section TEXT NOT NULL,
    "order" TEXT DEFAULT '0',
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR REFERENCES admin_users(id)
);

-- Table sliders
CREATE TABLE IF NOT EXISTS sliders (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    image_url TEXT,
    button1_text TEXT,
    button1_link TEXT,
    button2_text TEXT,
    button2_link TEXT,
    is_active BOOLEAN DEFAULT true,
    "order" TEXT DEFAULT '0',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR,
    image_data TEXT
);

-- Table founder_message
CREATE TABLE IF NOT EXISTS founder_message (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    quote TEXT,
    vision TEXT,
    founder_name TEXT,
    founder_role TEXT,
    founder_organization TEXT,
    founder_image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR,
    image_data TEXT
);

-- Table institutes
CREATE TABLE IF NOT EXISTS institutes (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    link TEXT,
    button_text TEXT,
    bg_color TEXT,
    is_active BOOLEAN DEFAULT true,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR
);

-- Table news
CREATE TABLE IF NOT EXISTS news (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    image_url TEXT,
    date DATE,
    category TEXT,
    author TEXT,
    featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR,
    slug TEXT,
    image_data TEXT
);

-- Table news_images
CREATE TABLE IF NOT EXISTS news_images (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    news_id VARCHAR REFERENCES news(id),
    image_url TEXT,
    caption TEXT,
    "order" INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table programs
CREATE TABLE IF NOT EXISTS programs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT,
    description TEXT,
    image_url TEXT,
    duration TEXT,
    level TEXT,
    is_active BOOLEAN DEFAULT true,
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR
);
`;

const dataScript = `
-- ==================================================================
-- INSERTION DES DONNÉES
-- ==================================================================

-- Nettoyage avant insertion
TRUNCATE TABLE news_images, chat_messages, contacts, programs, news, institutes, founder_message, sliders, site_content, admin_users, users CASCADE;

-- Admin Users
INSERT INTO admin_users (id, username, password, email, is_active, created_at, updated_at) VALUES
('49804d0c-f3f3-48bf-bbf5-7422126db2bc', 'admin', '$2b$10$uWCBXMNTGFvcLXTvpJhw5OyYvYhXp.NBAwWBZs9v6sKi3VODySWhW', 'admin@2iae.com', true, '2025-08-27 17:24:34.085267', '2025-08-27 17:24:34.085267');

-- Site Content
INSERT INTO site_content (id, key, title, value, type, section, "order", updated_at, updated_by) VALUES
('2af679b8-f095-4cf9-976b-2a3aabbde723', 'homepage_title', 'Titre principal de la page d''accueil', '2IAE INTERNATIONAL', 'text', 'homepage', '1', '2025-08-27 15:07:53.087', NULL),
('5e4425c8-4935-4106-bee9-fae17de7bddc', 'homepage_subtitle', 'Sous-titre de la page d''accueil', 'L''ÉCOLE DES ENTREPRENEURS', 'text', 'homepage', '2', '2025-08-27 15:07:53.13271', NULL),
('df68ea83-8c84-4964-b8e7-b0eb9d41b7a1', 'homepage_slogan', 'Slogan officiel', '2IAE, entreprendre pour devenir l''élite de demain.', 'text', 'homepage', '3', '2025-08-27 15:07:53.175979', NULL),
('b4a6771a-281e-4902-9c12-64f0bf108d09', 'about_description', 'Description À propos', '2IAE International est une institution d''enseignement supérieur spécialisée dans l''entrepreneuriat, située à Abidjan, Côte d''Ivoire.', 'textarea', 'about', '1', '2025-08-27 15:07:53.219741', NULL);

-- Sliders
INSERT INTO sliders (id, title, subtitle, description, image_url, button1_text, button1_link, button2_text, button2_link, is_active, "order", created_at, updated_at, created_by) VALUES
('6b59da7a-3f0d-4a44-9a3f-65c073dd9235', 'Bienvenue à 2IAE International', 'L''ÉCOLE DES ENTREPRENEURS', 'Formez-vous aux métiers de demain avec nos programmes reconnus et nos formations de qualité.', '/api/assets/sliders/slider_1756741064356_xraexj865ch.jpg', 'Découvrir nos programmes', '/filieres', 'Nous contacter', '/contact', true, '1', '2025-08-27 15:07:53.688718', '2025-09-01 15:42:53.553', NULL),
('868125e6-aa58-4186-8e91-4ec2123bc1de', 'Excellence Académique', 'FORMATION DE QUALITÉ', 'Des programmes reconnus et des formations adaptées aux besoins du marché du travail.', '/api/assets/sliders/slider_1756310758893_yf48p14frs.jpg', 'En savoir plus', '/a-propos', 'Contactez-nous', '/contact', true, '2', '2025-08-27 15:07:53.751034', '2025-08-27 17:00:34.105', NULL);

-- Founder Message
INSERT INTO founder_message (id, title, quote, vision, founder_name, founder_role, founder_organization, founder_image_url, is_active, created_at, updated_at, updated_by) VALUES
('bbadcfa6-8df9-418d-9916-f6e55c4f354b', 'Message du Fondateur', 'L''entrepreneuriat est l''art de transformer les rêves en réalité concrète.', 'Si en Côte d''Ivoire, les écoles et les universités ont réussi dans les programmes de formation des cadres, les moyennes et grandes entreprises, elles ont connu moins de succès dans les programmes destinés aux chefs des petites entreprises, et moins encore dans la constitution d''une nouvelle catégorie d''entrepreneurs. Combien d''Ivoiriens rêvent-ils de créer leur entreprise chaque année ?? Plusieurs milliers peut-être, même plusieurs centaines de milliers! Longtemps restés en arrière-plan de cette formidable aventure de défi personnel, les ivoiriens semblent s''y intéresser de plus en plus. Par manque de formation au niveau entrepreneurial la plupart des entreprises qui se créent, disparaissent en...', 'Koua Séraphin', 'Fondateur et Président Directeur Général', 'Groupe Ecoles 2IAE International', '/api/assets/founder/founder_1756311786515_c950o98h15h.jpg', true, '2025-08-27 16:12:44.630771', '2025-08-27 16:23:21.977', NULL);

-- Institutes
INSERT INTO institutes (id, title, description, link, button_text, bg_color, is_active, "order", created_at, updated_at, created_by) VALUES
('104a75c0-ebf9-427f-ad92-80681dcec1b0', 'INSTITUTS DE FORMATION EN MANAGEMENT', 'Formation en gestion et management d''entreprise', '/filieres', 'EN SAVOIR PLUS', 'from-blue-800 to-blue-900', true, 1, '2025-08-27 19:08:34.064195', '2025-08-27 19:11:26.609', NULL),
('0243cd47-1e25-4487-bad0-09bc8219a6c1', 'INSTITUTS DE FORMATION AUX NOUVELLES TECHNOLOGIES', 'Formation aux technologies numériques et innovations', '/filieres', 'EN SAVOIR PLUS', 'from-green-800 to-green-900', true, 2, '2025-08-27 19:08:34.064195', '2025-08-27 19:08:34.064195', NULL),
('c0b517e8-bb75-433c-acbf-64af221e9fbe', 'INSTITUTS DE FORMATION AGRICOLE', 'Formation en agriculture moderne et durable', '/filieres', 'EN SAVOIR PLUS', 'from-orange-800 to-orange-900', true, 3, '2025-08-27 19:08:34.064195', '2025-08-27 19:08:34.064195', NULL),
('aa03f7f6-b110-4599-804d-151e76be2a8f', 'INSTITUTS DE FORMATION EN GÉNIE CIVIL', 'Formation en génie civil et construction', '/filieres', 'EN SAVOIR PLUS', 'from-purple-800 to-purple-900', true, 4, '2025-08-27 19:13:16.589562', '2025-08-27 19:13:16.589562', NULL);

-- News
INSERT INTO news (id, title, summary, content, image_url, date, category, author, featured, is_active, "order", created_at, updated_at, created_by, slug) VALUES
('7d6fd535-434f-4dfb-94eb-1a1ca91d67b6', 'PRIX INTERNATIONAL DES BATISSEURS AFRICAINS', ' Les votes se poursuivent ; N''oubliez pas !
Soutenons notre PDG, M. Séraphin KOUA, candidat aux AfriBusiness Awards 2025 à Dubaï !', ' Les votes se poursuivent ; N''oubliez pas !
Soutenons notre PDG, M. Séraphin KOUA, candidat aux AfriBusiness Awards 2025 à Dubaï !', 'https://afribusinesschallenge.com/storage/participants/U46wIOv7ALWgZSEpCxUBHqLYDOxzIWJLssXKsmOl.jpg', '2025-08-27', 'Événements', 'Admin', false, true, 1, '2025-08-27 20:43:20.08087', '2025-08-27 20:43:20.08087', NULL, 'prix-international-des-batisseurs-africains'),
('2a7dae01-704b-4bbc-9c57-91b09947e651', 'Signature de convention entre 2IAE et CATALYSTE', 'Signature de conventions le lundi 25 Août 2025 entre Catalyste plus et le groupe Écoles 2IAE', 'Signature de conventions le lundi 25 Août 2025 entre Catalyste plus et le groupe Écoles 2IAE représenté par son premier responsable séraphin koua', '/api/assets/actualites/news_1756330108173_19e451469c034dae86a9d6d5e6fb91e0.jpg', '2025-08-27', 'Partenariats', 'Direction 2IAE', true, true, 1, '2025-08-27 20:52:10.86244', '2025-08-27 21:31:30.832', NULL, 'signature-de-convention-entre-2iae-et-catalyste');

-- News Images
INSERT INTO news_images (id, news_id, image_url, caption, "order", created_at) VALUES
('fcd1fdaa-3dcf-4c2f-b444-57e3fbc37595', '2a7dae01-704b-4bbc-9c57-91b09947e651', '/api/assets/actualites/news_1756330264179_ca17bf40b7604bb1b17c1750535513ca.jpg', NULL, 1, '2025-08-27 21:31:04.19815'),
('c9493c22-a041-44e3-adbb-5a13e4305218', '2a7dae01-704b-4bbc-9c57-91b09947e651', '/api/assets/actualites/news_1756330273305_3cd28406848c473fab30f2ede3bf3e50.jpg', NULL, 2, '2025-08-27 21:31:13.323859'),
('c8688fd1-8812-4565-9af9-1648b0e3f914', '2a7dae01-704b-4bbc-9c57-91b09947e651', '/api/assets/actualites/news_1756330286672_b8886653cb7c4a158aa31a2f0ab55ad3.jpg', NULL, 3, '2025-08-27 21:31:26.692633');
`;

const programsScript = `
-- Programs (partie 1)
INSERT INTO programs (id, name, category, description, image_url, duration, level, is_active, "order", created_at, updated_at, created_by) VALUES
('f5ad5015-09b4-4105-b016-e718c8303425', 'FINANCE COMPTABILITÉ & GESTION D''ENTREPRISE', 'BTS TERTIAIRES', 'Formation complète en finance, comptabilité et gestion d''entreprise', 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, 1, '2025-08-28 06:30:17.982851', '2025-08-28 06:47:10.145', NULL),
('02d6cc6b-b59f-4daf-b9f8-6a16dd6be6f8', 'GESTION COMMERCIALE', 'BTS TERTIAIRES', 'Formation en techniques commerciales, marketing et vente', 'https://images.unsplash.com/photo-1556761175-4b46a572b786', '2 ans', 'BTS', true, 2, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
('1e8ad5a1-9d61-4d77-a30a-0eb89647d217', 'RESSOURCES HUMAINES & COMMUNICATION', 'BTS TERTIAIRES', 'Formation en gestion des ressources humaines et communication', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2', '2 ans', 'BTS', true, 3, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
('9601845c-cc1f-4cfa-bb09-b7dbee4e5b6b', 'LOGISTIQUE', 'BTS TERTIAIRES', 'Formation en gestion logistique et chaîne d''approvisionnement', 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d', '2 ans', 'BTS', true, 4, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
('9d445675-fa45-4262-a522-f4bec682a73b', 'SCIENCE DE L''INFORMATION', 'BTS INDUSTRIEL', 'Formation en sciences de l''information et technologies numériques', 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b', '2 ans', 'BTS', true, 5, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
('491f3ba2-ebaa-4dd2-aa80-d8ced2597276', 'INFORMATIQUE DÉVELOPPEUR D''APPLICATIONS (IDA)', 'BTS INDUSTRIEL', 'Formation en développement d''applications informatiques', 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6', '2 ans', 'BTS', true, 6, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
('aec5eae6-f050-47c9-8afd-e101155b0d98', 'GÉNIE CIVIL OPTION BÂTIMENT (GBAT)', 'BTS INDUSTRIEL', 'Formation en génie civil spécialisée dans la construction', 'https://images.unsplash.com/photo-1541976590-713941681591', '2 ans', 'BTS', true, 7, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
('add068f0-4269-466b-8ced-999085776f22', 'GÉNIE CIVIL OPTION TRAVAUX PUBLICS', 'BTS INDUSTRIEL', 'Formation en génie civil orientée travaux publics', 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789', '2 ans', 'BTS', true, 8, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
('d725a9ba-68a6-4365-a656-f11b0c71a545', 'AGRICULTURE TROPICALE OPTION - PRODUCTION VÉGÉTALE (ATPV)', 'BTS INDUSTRIEL', 'Formation en agriculture tropicale spécialisée en production végétale', 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b', '2 ans', 'BTS', true, 9, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
('c5cfa6ec-ddca-49c9-995d-b53874042b5d', 'MANAGEMENT & ENTREPRENEURIAT', 'LICENCE/MASTER', 'Formation complète en management et entrepreneuriat', 'https://images.unsplash.com/photo-1497486751825-1233686d5d80', '3 ans', 'Licence', true, 10, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
('9c596d84-c5b8-43ee-8ed3-aa382d72f6d3', 'MARKETING DIGITAL & COMMUNICATION', 'LICENCE/MASTER', 'Formation en marketing digital et communication', 'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a', '3 ans', 'Licence', true, 11, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
('0f884988-c10a-4dd0-9df5-7f923aa8f70b', 'GESTION FINANCIÈRE & CONTRÔLE', 'LICENCE/MASTER', 'Formation avancée en gestion financière et contrôle', 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f', '3 ans', 'Licence', true, 12, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
('e508269f-ce2d-40d3-ab0a-bc7318ca3e85', 'CRÉATION & GESTION D''ENTREPRISE', 'CERTIFICAT', 'Formation intensive en création et gestion d''entreprise', 'https://images.unsplash.com/photo-1559136555-9303baea8ebd', '6 mois', 'Certificat', true, 13, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
('88943b35-59a9-4bf1-b924-88b5d398dab5', 'COMPTABILITÉ ANALYTIQUE & FISCALITÉ', 'CERTIFICAT', 'Formation spécialisée en comptabilité analytique et fiscalité', 'https://images.unsplash.com/photo-1554224155-6726b3ff858f', '4 mois', 'Certificat', true, 14, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
('ffd5a4f2-94e0-438b-abfb-04a350d5280d', 'LEADERSHIP & MANAGEMENT D''ÉQUIPE', 'CERTIFICAT', 'Formation en leadership et management d''équipe', 'https://images.unsplash.com/photo-1600880292089-90a7e086ee0c', '3 mois', 'Certificat', true, 15, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL);

-- Chat Messages
INSERT INTO chat_messages (id, session_id, message, response, created_at) VALUES
('69538328-fa2e-4ad3-bc6b-6ba60def7b7c', 'session-1756313698774-0.8672108162504497', 'Tu es la ?', 'Oui, je suis là pour vous aider ! Comment puis-je vous assister aujourd''hui concernant le Groupe Écoles 2IAE International ?', '2025-08-27 17:16:34.960181');
`;

async function runMigration() {
  console.log(
    "Début de la migration 2IAE International (Version mise à jour)...",
  );

  try {
    // Test de connexion
    console.log("Vérification de la connexion...");
    const client = await pool.connect();
    await client.query("SELECT 1");
    console.log("Connexion réussie !");

    // Création des tables
    console.log("Création des tables...");
    await client.query(migrationScript);
    console.log("Tables créées !");

    // Insertion des données principales
    console.log("Insertion des données...");
    await client.query(dataScript);
    console.log("Données principales insérées !");

    // Insertion des programmes
    console.log("Insertion des programmes...");
    await client.query(programsScript);
    console.log("Programmes insérés !");

    // Vérification finale
    console.log("Vérification des données...");
    const statsResult = await client.query(`
            SELECT 'admin_users' as table_name, COUNT(*) as records FROM admin_users
            UNION ALL
            SELECT 'site_content', COUNT(*) FROM site_content
            UNION ALL  
            SELECT 'sliders', COUNT(*) FROM sliders
            UNION ALL
            SELECT 'founder_message', COUNT(*) FROM founder_message
            UNION ALL
            SELECT 'institutes', COUNT(*) FROM institutes
            UNION ALL
            SELECT 'news', COUNT(*) FROM news
            UNION ALL
            SELECT 'news_images', COUNT(*) FROM news_images
            UNION ALL
            SELECT 'programs', COUNT(*) FROM programs
            UNION ALL
            SELECT 'chat_messages', COUNT(*) FROM chat_messages
            UNION ALL
            SELECT 'contacts', COUNT(*) FROM contacts
            UNION ALL
            SELECT 'users', COUNT(*) FROM users
            UNION ALL
            SELECT 'session', COUNT(*) FROM session;
        `);

    console.log("");
    console.log("=== RÉSULTATS DE LA MIGRATION ===");
    statsResult.rows.forEach((row) => {
      console.log(`${row.table_name}: ${row.records} enregistrements`);
    });

    client.release();
    await pool.end();

    console.log("");
    console.log("Migration 2IAE complétée avec succès !");
    console.log(
      "✅ Table session créée pour la persistance des connexions admin",
    );
    console.log("✅ Données complètes importées");
    console.log("✅ Structure mise à jour avec les dernières modifications");
  } catch (error) {
    console.error("Erreur lors de la migration:", error.message);
    console.error("Détails:", error);
    process.exit(1);
  }
}

// Vérification de la variable d'environnement
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL n'est pas définie");
  console.log(
    'Utilisez: DATABASE_URL="your-connection-string" node migrate.js',
  );
  process.exit(1);
}

// Lancement de la migration
runMigration();
