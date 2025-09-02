-- EXPORT COMPLET BASE DE DONNEES 2IAE INTERNATIONAL
-- Date d'export: 2025-09-02
-- Version: Post-migration vers stockage physique des images
-- Contient: Structure complète + données de toutes les tables principales

-- =======================================================
-- 1. TABLE SLIDERS (Carrousel d'images de la page d'accueil)
-- =======================================================

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
    is_active BOOLEAN DEFAULT TRUE,
    "order" TEXT DEFAULT '1',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR
);

INSERT INTO sliders VALUES 
('6b59da7a-3f0d-4a44-9a3f-65c073dd9235', 'FELECITATIONS', 'L''ÉCOLE DES ENTREPRENEURS', 'Formez-vous aux métiers de demain avec nos programmes reconnus et nos formations de qualité.', '/api/assets/sliders/slider_1756741064356_xraexj865ch.jpg', 'Découvrir nos programmes', '/filieres', 'Nous contacter', '/contact', true, '1', '2025-08-27 15:07:53.688718', '2025-09-02 15:52:27.748', ''),
('868125e6-aa58-4186-8e91-4ec2123bc1de', 'Excellence Académique', 'FORMATION DE QUALITÉ', 'Des programmes reconnus et des formations adaptées aux besoins du marché du travail.', '/api/assets/sliders/slider_1756310758893_yf48p14frs.jpg', 'En savoir plus', '/a-propos', 'Contactez-nous', '/contact', true, '2', '2025-08-27 15:07:53.751034', '2025-08-27 17:00:34.105', '');

-- =======================================================
-- 2. TABLE NEWS (Actualités et nouvelles)
-- =======================================================

CREATE TABLE IF NOT EXISTS news (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT,
    image_url TEXT,
    date DATE,
    category TEXT,
    author TEXT,
    featured BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    "order" TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR,
    slug TEXT
);

INSERT INTO news VALUES 
('7d6fd535-434f-4dfb-94eb-1a1ca91d67b6', 'PRIX INTERNATIONAL DES BATISSEURS AFRICAINS', ' Les votes se poursuivent ; N''oubliez pas !
Soutenons notre PDG, M. Séraphin KOUA, candidat aux AfriBusiness Awards 2025 à Dubaï !
Votez ici : https://afribusinesschallenge.com/.../01k22thzarm2h71ejqq...
www.2iae.com
2IAE, l''École des Entrepreneurs', ' Les votes se poursuivent ; N''oubliez pas !
Soutenons notre PDG, M. Séraphin KOUA, candidat aux AfriBusiness Awards 2025 à Dubaï !
Votez ici : https://afribusinesschallenge.com/.../01k22thzarm2h71ejqq...
www.2iae.com
2IAE, l''École des Entrepreneurs', 'https://afribusinesschallenge.com/storage/participants/U46wIOv7ALWgZSEpCxUBHqLYDOxzIWJLssXKsmOl.jpg', '2025-08-27', 'Événements', 'Admin', false, true, '1', '2025-08-27 20:43:20.08087', '2025-08-27 20:43:20.08087', '', 'prix-international-des-batisseurs-africains'),
('2a7dae01-704b-4bbc-9c57-91b09947e651', 'Signature de convention entre 2IAE et CATALYSTE', 'Signature  de conventions   le lundi  25 Août  2025 entre Catalyste plus et le groupe  Écoles  2IAE  représenté  par son premier  responsable  Séraphin  Koua  et Madame  ,  ......
Représentant  Catalyste  plus.', 'Signature  de conventions   le lundi  25 Août  2025 entre Catalyste plus et le groupe  Écoles  2IAE  représenté  par son premier  responsable  séraphin  koua  et madam  ,  ......
Représentant  Catalyste  plus.', '/api/assets/actualites/news_1756330108173_19e451469c034dae86a9d6d5e6fb91e0.jpg', '2025-08-27', 'Partenariats', 'Direction 2IAE', true, true, '1', '2025-08-27 20:52:10.86244', '2025-08-27 21:31:30.832', '', 'signature-de-convention-entre-2iae-et-catalyste');

-- =======================================================
-- 3. TABLE FOUNDER_MESSAGE (Message du fondateur)
-- =======================================================

CREATE TABLE IF NOT EXISTS founder_message (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    quote TEXT,
    vision TEXT,
    founder_name TEXT,
    founder_role TEXT,
    founder_organization TEXT,
    founder_image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by VARCHAR
);

INSERT INTO founder_message VALUES 
('bbadcfa6-8df9-418d-9916-f6e55c4f354b', 'Message du Fondateur', 'L''entrepreneuriat est l''art de transformer les rêves en réalité concrète.', 'Si en Côte d''Ivoire, les écoles et les universités ont réussi dans les programmes de formation des cadres, les moyennes et grandes entreprises, elles ont connu moins de succès dans les programmes destinés aux chefs des petites entreprises, et moins encore dans la constitution d''une nouvelle catégorie d''entrepreneurs. Combien d''Ivoiriens rêvent-ils de créer leur entreprise chaque année ?? Plusieurs milliers peut-être, même plusieurs centaines de milliers! Longtemps restés en arrière-plan de cette formidable aventure de défi personnel, les ivoiriens semblent s''y intéresser de plus en plus. Par manque de formation au niveau entrepreneurial la plupart des entreprises qui se créent, disparaissent en...', 'Koua Séraphin', 'Fondateur et Président Directeur Général', 'Groupe Ecoles 2IAE International', '/api/assets/founder/founder_1756311786515_c950o98h15h.jpg', true, '2025-08-27 16:12:44.630771', '2025-08-27 16:23:21.977', '');

-- =======================================================
-- 4. TABLE INSTITUTES (Instituts de formation)
-- =======================================================

CREATE TABLE IF NOT EXISTS institutes (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    description TEXT,
    link TEXT,
    button_text TEXT,
    bg_color TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    "order" INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR
);

INSERT INTO institutes VALUES 
('104a75c0-ebf9-427f-ad92-80681dcec1b0', 'INSTITUTS DE FORMATION EN MANAGEMENT', 'Formation en gestion et management d''entreprise', '/filieres', 'EN SAVOIR PLUS', 'from-blue-800 to-blue-900', true, 1, '2025-08-27 19:08:34.064195', '2025-08-27 19:11:26.609', ''),
('0243cd47-1e25-4487-bad0-09bc8219a6c1', 'INSTITUTS DE FORMATION AUX NOUVELLES TECHNOLOGIES', 'Formation aux technologies numériques et innovations', '/filieres', 'EN SAVOIR PLUS', 'from-green-800 to-green-900', true, 2, '2025-08-27 19:08:34.064195', '2025-08-27 19:08:34.064195', ''),
('c0b517e8-bb75-433c-acbf-64af221e9fbe', 'INSTITUTS DE FORMATION AGRICOLE', 'Formation en agriculture moderne et durable', '/filieres', 'EN SAVOIR PLUS', 'from-orange-800 to-orange-900', true, 3, '2025-08-27 19:08:34.064195', '2025-08-27 19:08:34.064195', ''),
('aa03f7f6-b110-4599-804d-151e76be2a8f', 'INSTITUTS DE FORMATION EN GÉNIE CIVIL', 'Formation en génie civil et construction', '/filieres', 'EN SAVOIR PLUS', 'from-purple-800 to-purple-900', true, 4, '2025-08-27 19:13:16.589562', '2025-08-27 19:13:16.589562', '');

-- =======================================================
-- 5. TABLE PROGRAMS (Programmes de formation)
-- =======================================================

CREATE TABLE IF NOT EXISTS programs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    category TEXT,
    description TEXT,
    image_url TEXT,
    duration TEXT,
    level TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    "order" INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR
);

INSERT INTO programs VALUES 
('f5ad5015-09b4-4105-b016-e718c8303425', 'FINANCE COMPTABILITÉ & GESTION D''ENTREPRISE', 'BTS TERTIAIRES', 'Formation complète en finance, comptabilité et gestion d''entreprise pour former des experts financiers capables de gérer les ressources d''une organisation.', 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, 1, '2025-08-28 06:30:17.982851', '2025-08-28 06:47:10.145', ''),
('02d6cc6b-b59f-4daf-b9f8-6a16dd6be6f8', 'GESTION COMMERCIALE', 'BTS TERTIAIRES', 'Formation en techniques commerciales, marketing et vente pour développer des compétences en gestion des relations clients et développement commercial.', 'https://images.unsplash.com/photo-1556761175-4b46a572b786?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, 2, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', ''),
('1e8ad5a1-9d61-4d77-a30a-0eb89647d217', 'RESSOURCES HUMAINES & COMMUNICATION', 'BTS TERTIAIRES', 'Formation en gestion des ressources humaines et communication d''entreprise pour devenir un professionnel RH capable de gérer le capital humain.', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, 3, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', ''),
('9601845c-cc1f-4cfa-bb09-b7dbee4e5b6b', 'LOGISTIQUE', 'BTS TERTIAIRES', 'Formation en gestion logistique et chaîne d''approvisionnement pour optimiser les flux de marchandises et la distribution.', 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, 4, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', ''),
('9d445675-fa45-4262-a522-f4bec682a73b', 'SCIENCE DE L''INFORMATION', 'BTS INDUSTRIEL', 'Formation en sciences de l''information et technologies numériques pour maîtriser les systèmes d''information modernes.', 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, 5, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', ''),
('491f3ba2-ebaa-4dd2-aa80-d8ced2597276', 'INFORMATIQUE DÉVELOPPEUR D''APPLICATIONS (IDA)', 'BTS INDUSTRIEL', 'Formation en développement d''applications informatiques pour créer des solutions logicielles innovantes et performantes.', 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, 6, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', ''),
('aec5eae6-f050-47c9-8afd-e101155b0d98', 'GÉNIE CIVIL OPTION BÂTIMENT (GBAT)', 'BTS INDUSTRIEL', 'Formation en génie civil spécialisée dans la construction de bâtiments pour devenir technicien supérieur en construction.', 'https://images.unsplash.com/photo-1541976590-713941681591?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, 7, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', ''),
('add068f0-4269-466b-8ced-999085776f22', 'GÉNIE CIVIL OPTION TRAVAUX PUBLICS', 'BTS INDUSTRIEL', 'Formation en génie civil orientée travaux publics pour participer à la construction d''infrastructures publiques.', 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, 8, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', ''),
('d725a9ba-68a6-4365-a656-f11b0c71a545', 'AGRICULTURE TROPICALE OPTION - PRODUCTION VÉGÉTALE (ATPV)', 'BTS INDUSTRIEL', 'Formation en agriculture tropicale spécialisée en production végétale pour optimiser les rendements agricoles en milieu tropical.', 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, 9, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', ''),
('c5cfa6ec-ddca-49c9-995d-b53874042b5d', 'MANAGEMENT & ENTREPRENEURIAT', 'LICENCE/MASTER', 'Formation complète en management et entrepreneuriat pour développer les compétences de leadership et créer des entreprises innovantes.', 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '3 ans', 'Licence', true, 10, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', ''),
('9c596d84-c5b8-43ee-8ed3-aa382d72f6d3', 'MARKETING DIGITAL & COMMUNICATION', 'LICENCE/MASTER', 'Formation en marketing digital et communication pour maîtriser les stratégies de communication numérique et les réseaux sociaux.', 'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '3 ans', 'Licence', true, 11, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', ''),
('0f884988-c10a-4dd0-9df5-7f923aa8f70b', 'GESTION FINANCIÈRE & CONTRÔLE', 'LICENCE/MASTER', 'Formation avancée en gestion financière et contrôle de gestion pour devenir expert en analyse financière et pilotage d''entreprise.', 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '3 ans', 'Licence', true, 12, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', ''),
('e508269f-ce2d-40d3-ab0a-bc7318ca3e85', 'CRÉATION & GESTION D''ENTREPRISE', 'CERTIFICAT', 'Formation intensive en création et gestion d''entreprise pour accompagner les porteurs de projets dans la concrétisation de leur vision entrepreneuriale.', 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '6 mois', 'Certificat', true, 13, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', ''),
('88943b35-59a9-4bf1-b924-88b5d398dab5', 'COMPTABILITÉ ANALYTIQUE & FISCALITÉ', 'CERTIFICAT', 'Formation spécialisée en comptabilité analytique et fiscalité pour maîtriser les aspects comptables et fiscaux d''une entreprise.', 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '4 mois', 'Certificat', true, 14, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', ''),
('ffd5a4f2-94e0-438b-abfb-04a350d5280d', 'LEADERSHIP & MANAGEMENT D''ÉQUIPE', 'CERTIFICAT', 'Formation en leadership et management d''équipe pour développer les compétences de direction et d''animation d''équipes performantes.', 'https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '3 mois', 'Certificat', true, 15, '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', '');

-- =======================================================
-- TABLES SUPPLÉMENTAIRES (Structure seulement)
-- =======================================================

-- Table des administrateurs
CREATE TABLE IF NOT EXISTS admin_users (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR UNIQUE NOT NULL,
    password_hash VARCHAR NOT NULL,
    email VARCHAR,
    role VARCHAR DEFAULT 'admin',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table des contacts
CREATE TABLE IF NOT EXISTS contacts (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    email VARCHAR NOT NULL,
    phone VARCHAR,
    subject VARCHAR,
    message TEXT NOT NULL,
    status VARCHAR DEFAULT 'new',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table des messages de chat
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user_message TEXT NOT NULL,
    bot_response TEXT NOT NULL,
    session_id VARCHAR,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table du contenu du site
CREATE TABLE IF NOT EXISTS site_content (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    section VARCHAR NOT NULL,
    title VARCHAR,
    content TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table des sessions
CREATE TABLE IF NOT EXISTS session (
    sid VARCHAR PRIMARY KEY,
    sess JSONB NOT NULL,
    expire TIMESTAMP NOT NULL
);

-- Index pour les sessions
CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);

-- =======================================================
-- NOTES DE MIGRATION
-- =======================================================

-- Version: Post-migration vers stockage physique (02/09/2025)
-- Changements majeurs:
-- 1. Migration complète du stockage base64 vers stockage physique de fichiers
-- 2. Les images sont maintenant stockées dans /server/uploads/
-- 3. Les URLs d'images utilisent le format /api/assets/{folder}/{filename}
-- 4. Suppression des colonnes image_data (base64) dans toutes les tables
-- 5. Système de routage prioritaire: stockage local → attached_assets → Object Storage

-- Structure des dossiers d'upload:
-- /server/uploads/sliders/     - Images du carrousel
-- /server/uploads/news/        - Images des actualités  
-- /server/uploads/founder/     - Images du fondateur
-- /server/uploads/programs/    - Images des programmes

-- Routes de service des fichiers:
-- GET /api/assets/{folder}/{filename} - Service principal des fichiers uploadés
-- Upload via multer avec configuration par dossier

-- EOF