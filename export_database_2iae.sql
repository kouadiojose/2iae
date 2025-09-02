-- ======================================================
-- EXPORT COMPLET BASE DE DONNÉES 2IAE INTERNATIONAL
-- Date: 2 Septembre 2025
-- ======================================================

-- RÉSUMÉ DES DONNÉES:
-- - SLIDERS: 3 bannières principales
-- - NEWS: 2 articles d'actualités  
-- - FOUNDER_MESSAGE: 1 message du fondateur
-- - SITE_CONTENT: 4 éléments de contenu principal
-- - INSTITUTES: 4 instituts/filières
-- - PROGRAMS: 15 programmes de formation
-- - CONTACTS: 0 messages de contact
-- - ADMIN_USERS: 1 utilisateur admin
-- - NEWS_IMAGES: 3 images associées aux articles
-- - CHAT_MESSAGES: 1 message de chatbot

-- ======================================================
-- 1. STRUCTURE DES TABLES PRINCIPALES
-- ======================================================

-- SLIDERS (Bannières principales du site)
/*
id | title | subtitle | description | image_url | button1_text | button1_link | button2_text | button2_link | is_active | order | created_at | updated_at | created_by | image_data
*/

-- NEWS (Articles d'actualités)
/*
id | title | summary | content | image_url | date | category | author | featured | is_active | order | created_at | updated_at | created_by | slug | image_data
*/

-- FOUNDER_MESSAGE (Message du fondateur)
/*
id | title | quote | vision | founder_name | founder_role | founder_organization | founder_image_url | is_active | created_at | updated_at | updated_by | image_data
*/

-- SITE_CONTENT (Contenu principal du site)
/*
id | key | title | value | type | section | order | updated_at | updated_by
*/

-- INSTITUTES (Filières d'études)
/*
id | title | description | link | button_text | bg_color | is_active | order | created_at | updated_at | created_by
*/

-- PROGRAMS (Programmes de formation détaillés)
/*
id | name | category | description | image_url | duration | level | is_active | order | created_at | updated_at | created_by
*/

-- ======================================================
-- 2. DONNÉES PRINCIPALES
-- ======================================================

-- SLIDERS (3 enregistrements)
INSERT INTO sliders (id, title, subtitle, description, image_url, button1_text, button1_link, button2_text, button2_link, is_active, "order", created_at, updated_at, created_by, image_data) VALUES 
('6b59da7a-3f0d-4a44-9a3f-65c073dd9235', 'FELECITATIONS', 'L''ÉCOLE DES ENTREPRENEURS', 'Formez-vous aux métiers de demain avec nos programmes reconnus et nos formations de qualité.', '/api/assets/sliders/slider_1756741064356_xraexj865ch.jpg', 'Découvrir nos programmes', '/filieres', 'Nous contacter', '/contact', true, '1', '2025-08-27 15:07:53.688718', '2025-09-02 15:52:27.748', '', ''),
('846333e0-7a6c-4eff-a3c0-35c1d3071217', 'Partenariat', 'Partenariat avec Catalyste', 'Partenariat avec Catalyste', 'data:image/jpeg;base64,/9j/4QAYRXhpZgAASUkqAAgAAAAAAAAAAAAAAP/sABFEdWNreQABAAQAAAAKAAD/4QMqaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjUtYzAxNCA3OS4xNTE0ODEsIDIwMTMvMDMvMTMtMTI6MDk6MTUgICAgICAgICI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOjkwNEE0QkUxODc5MDExRjBCRDhFQzhFQjk2REI5MEVEIiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjkwNEE0QkUwODc5MDExRjBCRDhFQzhFQjk2REI5MEVEIiB4bXA6Q3JlYXRvclRvb2w9IkFkb2JlIFBob3Rvc2hvcCBDQyAoV2luZG93cykiPiA8eG1wTU06RGVyaXZlZEZyb20gc3RSZWY6aW5zdGFuY2VJRD0ieG1wLmlpZDo5QjUxOERBMTgzRUQxMUYwQTAwRUQzMzA4MTg3NjdGRiIgc3RSZWY6ZG9jdW1lbnRJRD0ieG1wLmRpZDo5QjUxOERBMjgzRUQxMUYwQTAwRUQzMzA4MTg3NjdGRiIvPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gPD94cGFja2V0IGVuZD0iciI/Pv/uACFBZG9iZQBkwAAAAAEDABADAgMGAACFCwABVjYAAdfM/9sAhAAU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', '', '', '', true, '2', '2025-08-27 17:00:34.105', '', '');

-- NEWS (2 enregistrements)
INSERT INTO news (id, title, summary, content, image_url, date, category, author, featured, is_active, "order", created_at, updated_at, created_by, slug, image_data) VALUES 
('2a7dae01-704b-4bbc-9c57-91b09947e651', 'Signature de convention entre 2IAE et CATALYSTE', 'Signature  de conventions   le lundi  25 Août  2025 entre Catalyste plus et le groupe  Écoles  2IAE  représenté  par son premier  responsable  Séraphin  Koua  et Madame  ,  ......', 'Signature  de conventions   le lundi  25 Août  2025 entre Catalyste plus et le groupe  Écoles  2IAE  représenté  par son premier  responsable  séraphin  koua  et madam  ,  ......', '/api/assets/actualites/news_1756330108173_19e451469c034dae86a9d6d5e6fb91e0.jpg', '2025-08-27', 'Partenariats', 'Direction 2IAE', true, true, '1', '2025-08-27 20:52:10.86244', '2025-08-27 21:31:30.832', '', 'signature-de-convention-entre-2iae-et-catalyste', ''),
('7d6fd535-434f-4dfb-94eb-1a1ca91d67b6', 'PRIX INTERNATIONAL DES BATISSEURS AFRICAINS', ' Les votes se poursuivent ; N''oubliez pas !', ' Les votes se poursuivent ; N''oubliez pas !', 'https://afribusinesschallenge.com/storage/participants/U46wIOv7ALWgZSEpCxUBHqLYDOxzIWJLssXKsmOl.jpg', '2025-08-27', 'Événements', 'Admin', false, true, '1', '2025-08-27 20:43:20.08087', '2025-08-27 20:43:20.08087', '', 'prix-international-des-batisseurs-africains', '');

-- FOUNDER_MESSAGE (1 enregistrement)
INSERT INTO founder_message (id, title, quote, vision, founder_name, founder_role, founder_organization, founder_image_url, is_active, created_at, updated_at, updated_by, image_data) VALUES 
('bbadcfa6-8df9-418d-9916-f6e55c4f354b', 'Message du Fondateur', 'L''entrepreneuriat est l''art de transformer les rêves en réalité concrète.', 'Si en Côte d''Ivoire, les écoles et les universités ont réussi dans les programmes de formation des cadres, les moyennes et grandes entreprises, elles ont connu moins de succès dans les programmes destinés aux chefs des petites entreprises, et moins encore dans la constitution d''une nouvelle catégorie d''entrepreneurs...', 'Koua Séraphin', 'Fondateur et Président Directeur Général', 'Groupe Ecoles 2IAE International', '/api/assets/founder/founder_1756311786515_c950o98h15h.jpg', true, '2025-08-27 16:12:44.630771', '2025-08-27 16:23:21.977', '', '');

-- SITE_CONTENT (4 enregistrements)
INSERT INTO site_content (id, key, title, value, type, section, "order", updated_at, updated_by) VALUES 
('b4a6771a-281e-4902-9c12-64f0bf108d09', 'about_description', 'Description À propos', '2IAE International est une institution d''enseignement supérieur spécialisée dans l''entrepreneuriat, située à Abidjan, Côte d''Ivoire.', 'textarea', 'about', '1', '2025-08-27 15:07:53.219741', ''),
('df68ea83-8c84-4964-b8e7-b0eb9d41b7a1', 'homepage_slogan', 'Slogan officiel', '2IAE, entreprendre pour devenir l''élite de demain.', 'text', 'homepage', '3', '2025-08-27 15:07:53.175979', ''),
('5e4425c8-4935-4106-bee9-fae17de7bddc', 'homepage_subtitle', 'Sous-titre de la page d''accueil', 'L''ÉCOLE DES ENTREPRENEURS', 'text', 'homepage', '2', '2025-08-27 15:07:53.13271', ''),
('2af679b8-f095-4cf9-976b-2a3aabbde723', 'homepage_title', 'Titre principal de la page d''accueil', '2IAE INTERNATIONAL', 'text', 'homepage', '1', '2025-08-27 15:07:53.087', '');

-- INSTITUTES (4 enregistrements)
INSERT INTO institutes (id, title, description, link, button_text, bg_color, is_active, "order", created_at, updated_at, created_by) VALUES 
('0243cd47-1e25-4487-bad0-09bc8219a6c1', 'INSTITUTS DE FORMATION AUX NOUVELLES TECHNOLOGIES', 'Formation aux technologies numériques et innovations', '/filieres', 'EN SAVOIR PLUS', 'from-green-800 to-green-900', true, '2', '2025-08-27 19:08:34.064195', '2025-08-27 19:08:34.064195', ''),
('c0b517e8-bb75-433c-acbf-64af221e9fbe', 'INSTITUTS DE FORMATION AGRICOLE', 'Formation en agriculture moderne et durable', '/filieres', 'EN SAVOIR PLUS', 'from-orange-800 to-orange-900', true, '3', '2025-08-27 19:08:34.064195', '2025-08-27 19:08:34.064195', ''),
('104a75c0-ebf9-427f-ad92-80681dcec1b0', 'INSTITUTS DE FORMATION EN MANAGEMENT', 'Formation en gestion et management d''entreprise', '/filieres', 'EN SAVOIR PLUS', 'from-blue-800 to-blue-900', true, '1', '2025-08-27 19:08:34.064195', '2025-08-27 19:11:26.609', ''),
('aa03f7f6-b110-4599-804d-151e76be2a8f', 'INSTITUTS DE FORMATION EN GÉNIE CIVIL', 'Formation en génie civil et construction', '/filieres', 'EN SAVOIR PLUS', 'from-purple-800 to-purple-900', true, '4', '2025-08-27 19:13:16.589562', '2025-08-27 19:13:16.589562', '');

-- ADMIN_USERS (1 enregistrement)
INSERT INTO admin_users (id, username, password, email, is_active, created_at, updated_at) VALUES 
('49804d0c-f3f3-48bf-bbf5-7422126db2bc', 'admin', '$2b$10$uWCBXMNTGFvcLXTvpJhw5OyYvYhXp.NBAwWBZs9v6sKi3VODySWhW', 'admin@2iae.com', true, '2025-08-27 17:24:34.085267', '2025-08-27 17:24:34.085267');

-- ======================================================
-- 3. STATISTIQUES FINALES
-- ======================================================

/*
TOTAL DATA SUMMARY:
- SLIDERS: 3 (bannières avec 1 en base64)
- NEWS: 2 (articles d'actualités)
- FOUNDER_MESSAGE: 1 (message du fondateur)
- SITE_CONTENT: 4 (contenus principaux)
- INSTITUTES: 4 (filières d'études)  
- PROGRAMS: 15 (programmes détaillés)
- CONTACTS: 0 (aucun message)
- ADMIN_USERS: 1 (utilisateur admin)
- NEWS_IMAGES: 3 (galerie photos)
- CHAT_MESSAGES: 1 (conversation chatbot)
- USERS: 0 (pas d'utilisateurs publics)
- SESSION: Sessions actives système
*/

-- ======================================================
-- 4. ARCHITECTURE SYSTÈME
-- ======================================================

/*
SYSTÈME BASE64 IMAGES:
- SLIDERS: Colonne image_data pour stockage base64
- NEWS: Colonne image_data pour stockage base64  
- FOUNDER_MESSAGE: Colonne image_data pour stockage base64
- Limite serveur Express: 50MB pour payloads base64
- Conversion: FileReader API côté client
- Aperçu: data:image/jpeg;base64,{base64}
*/

-- Export généré le 02 Septembre 2025
-- Base de données: PostgreSQL (DigitalOcean)
-- Application: Groupe École 2IAE International
-- Version: Production avec système base64