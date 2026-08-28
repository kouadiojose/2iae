-- =====================================================================
-- 2IAE International — seed de contenu consolidé
-- =====================================================================
-- GÉNÉRÉ automatiquement par scripts/build-seed.py à partir des exports
-- historiques du dépôt. Ne pas éditer à la main : régénérer.
--
-- Prérequis : le schéma doit déjà exister (`npm run db:push`), qui fait
-- foi via shared/schema.ts. Ce fichier n'insère QUE des données.
--
-- Idempotent : ON CONFLICT (id) DO NOTHING — rejouable sans risque.
--
-- Corrections appliquées par rapport aux exports d'origine :
--   1. Colonnes nommées explicitement. Les exports utilisaient des INSERT
--      positionnels alors que l'ordre des colonnes de `news` diffère entre
--      les exports et shared/schema.ts (`slug` en dernier vs en 3e) — un
--      INSERT positionnel écrivait le slug dans `summary`.
--   2. created_by / updated_by : '' remplacé par NULL. Ces colonnes sont des
--      clés étrangères vers admin_users(id) ; la chaîne vide violait la
--      contrainte et faisait échouer tout l'import.
--   3. "order" : valeurs entières converties en texte ('1' au lieu de 1),
--      la colonne étant TEXT dans shared/schema.ts.
--
-- Non seedé volontairement :
--   admin_users  -> créé au démarrage par ensureAdminExists() depuis
--                   ADMIN_USERNAME / ADMIN_PASSWORD (server/auth.ts)
--   session, users, contacts, chat_messages -> données d'exécution
--   projects     -> aucune donnée dans aucun export du dépôt
-- =====================================================================

BEGIN;

-- sliders : 2 ligne(s)  [source: export_database_2iae_updated.sql — images locales]
INSERT INTO sliders (id, title, subtitle, description, image_url, button1_text, button1_link, button2_text, button2_link, is_active, "order", created_at, updated_at, created_by) VALUES
  ('6b59da7a-3f0d-4a44-9a3f-65c073dd9235', 'FELECITATIONS', 'L''ÉCOLE DES ENTREPRENEURS', 'Formez-vous aux métiers de demain avec nos programmes reconnus et nos formations de qualité.', '/api/assets/sliders/slider_1756741064356_xraexj865ch.jpg', 'Découvrir nos programmes', '/filieres', 'Nous contacter', '/contact', true, '1', '2025-08-27 15:07:53.688718', '2025-09-02 15:52:27.748', NULL),
  ('868125e6-aa58-4186-8e91-4ec2123bc1de', 'Excellence Académique', 'FORMATION DE QUALITÉ', 'Des programmes reconnus et des formations adaptées aux besoins du marché du travail.', '/api/assets/sliders/slider_1756310758893_yf48p14frs.jpg', 'En savoir plus', '/a-propos', 'Contactez-nous', '/contact', true, '2', '2025-08-27 15:07:53.751034', '2025-08-27 17:00:34.105', NULL)
ON CONFLICT (id) DO NOTHING;

-- institutes : 4 ligne(s)  [source: export_database_2iae_updated.sql]
INSERT INTO institutes (id, title, description, link, button_text, bg_color, is_active, "order", created_at, updated_at, created_by) VALUES
  ('104a75c0-ebf9-427f-ad92-80681dcec1b0', 'INSTITUTS DE FORMATION EN MANAGEMENT', 'Formation en gestion et management d''entreprise', '/filieres', 'EN SAVOIR PLUS', 'from-blue-800 to-blue-900', true, '1', '2025-08-27 19:08:34.064195', '2025-08-27 19:11:26.609', NULL),
  ('0243cd47-1e25-4487-bad0-09bc8219a6c1', 'INSTITUTS DE FORMATION AUX NOUVELLES TECHNOLOGIES', 'Formation aux technologies numériques et innovations', '/filieres', 'EN SAVOIR PLUS', 'from-green-800 to-green-900', true, '2', '2025-08-27 19:08:34.064195', '2025-08-27 19:08:34.064195', NULL),
  ('c0b517e8-bb75-433c-acbf-64af221e9fbe', 'INSTITUTS DE FORMATION AGRICOLE', 'Formation en agriculture moderne et durable', '/filieres', 'EN SAVOIR PLUS', 'from-orange-800 to-orange-900', true, '3', '2025-08-27 19:08:34.064195', '2025-08-27 19:08:34.064195', NULL),
  ('aa03f7f6-b110-4599-804d-151e76be2a8f', 'INSTITUTS DE FORMATION EN GÉNIE CIVIL', 'Formation en génie civil et construction', '/filieres', 'EN SAVOIR PLUS', 'from-purple-800 to-purple-900', true, '4', '2025-08-27 19:13:16.589562', '2025-08-27 19:13:16.589562', NULL)
ON CONFLICT (id) DO NOTHING;

-- programs : 15 ligne(s)  [source: export_database_2iae_updated.sql]
INSERT INTO programs (id, name, category, description, image_url, duration, level, is_active, "order", created_at, updated_at, created_by) VALUES
  ('f5ad5015-09b4-4105-b016-e718c8303425', 'FINANCE COMPTABILITÉ & GESTION D''ENTREPRISE', 'BTS TERTIAIRES', 'Formation complète en finance, comptabilité et gestion d''entreprise pour former des experts financiers capables de gérer les ressources d''une organisation.', 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, '1', '2025-08-28 06:30:17.982851', '2025-08-28 06:47:10.145', NULL),
  ('02d6cc6b-b59f-4daf-b9f8-6a16dd6be6f8', 'GESTION COMMERCIALE', 'BTS TERTIAIRES', 'Formation en techniques commerciales, marketing et vente pour développer des compétences en gestion des relations clients et développement commercial.', 'https://images.unsplash.com/photo-1556761175-4b46a572b786?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, '2', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
  ('1e8ad5a1-9d61-4d77-a30a-0eb89647d217', 'RESSOURCES HUMAINES & COMMUNICATION', 'BTS TERTIAIRES', 'Formation en gestion des ressources humaines et communication d''entreprise pour devenir un professionnel RH capable de gérer le capital humain.', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, '3', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
  ('9601845c-cc1f-4cfa-bb09-b7dbee4e5b6b', 'LOGISTIQUE', 'BTS TERTIAIRES', 'Formation en gestion logistique et chaîne d''approvisionnement pour optimiser les flux de marchandises et la distribution.', 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, '4', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
  ('9d445675-fa45-4262-a522-f4bec682a73b', 'SCIENCE DE L''INFORMATION', 'BTS INDUSTRIEL', 'Formation en sciences de l''information et technologies numériques pour maîtriser les systèmes d''information modernes.', 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, '5', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
  ('491f3ba2-ebaa-4dd2-aa80-d8ced2597276', 'INFORMATIQUE DÉVELOPPEUR D''APPLICATIONS (IDA)', 'BTS INDUSTRIEL', 'Formation en développement d''applications informatiques pour créer des solutions logicielles innovantes et performantes.', 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, '6', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
  ('aec5eae6-f050-47c9-8afd-e101155b0d98', 'GÉNIE CIVIL OPTION BÂTIMENT (GBAT)', 'BTS INDUSTRIEL', 'Formation en génie civil spécialisée dans la construction de bâtiments pour devenir technicien supérieur en construction.', 'https://images.unsplash.com/photo-1541976590-713941681591?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, '7', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
  ('add068f0-4269-466b-8ced-999085776f22', 'GÉNIE CIVIL OPTION TRAVAUX PUBLICS', 'BTS INDUSTRIEL', 'Formation en génie civil orientée travaux publics pour participer à la construction d''infrastructures publiques.', 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, '8', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
  ('d725a9ba-68a6-4365-a656-f11b0c71a545', 'AGRICULTURE TROPICALE OPTION - PRODUCTION VÉGÉTALE (ATPV)', 'BTS INDUSTRIEL', 'Formation en agriculture tropicale spécialisée en production végétale pour optimiser les rendements agricoles en milieu tropical.', 'https://images.unsplash.com/photo-1574323347407-f5e1ad6d020b?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '2 ans', 'BTS', true, '9', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
  ('c5cfa6ec-ddca-49c9-995d-b53874042b5d', 'MANAGEMENT & ENTREPRENEURIAT', 'LICENCE/MASTER', 'Formation complète en management et entrepreneuriat pour développer les compétences de leadership et créer des entreprises innovantes.', 'https://images.unsplash.com/photo-1497486751825-1233686d5d80?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '3 ans', 'Licence', true, '10', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
  ('9c596d84-c5b8-43ee-8ed3-aa382d72f6d3', 'MARKETING DIGITAL & COMMUNICATION', 'LICENCE/MASTER', 'Formation en marketing digital et communication pour maîtriser les stratégies de communication numérique et les réseaux sociaux.', 'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '3 ans', 'Licence', true, '11', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
  ('0f884988-c10a-4dd0-9df5-7f923aa8f70b', 'GESTION FINANCIÈRE & CONTRÔLE', 'LICENCE/MASTER', 'Formation avancée en gestion financière et contrôle de gestion pour devenir expert en analyse financière et pilotage d''entreprise.', 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '3 ans', 'Licence', true, '12', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
  ('e508269f-ce2d-40d3-ab0a-bc7318ca3e85', 'CRÉATION & GESTION D''ENTREPRISE', 'CERTIFICAT', 'Formation intensive en création et gestion d''entreprise pour accompagner les porteurs de projets dans la concrétisation de leur vision entrepreneuriale.', 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '6 mois', 'Certificat', true, '13', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
  ('88943b35-59a9-4bf1-b924-88b5d398dab5', 'COMPTABILITÉ ANALYTIQUE & FISCALITÉ', 'CERTIFICAT', 'Formation spécialisée en comptabilité analytique et fiscalité pour maîtriser les aspects comptables et fiscaux d''une entreprise.', 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '4 mois', 'Certificat', true, '14', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL),
  ('ffd5a4f2-94e0-438b-abfb-04a350d5280d', 'LEADERSHIP & MANAGEMENT D''ÉQUIPE', 'CERTIFICAT', 'Formation en leadership et management d''équipe pour développer les compétences de direction et d''animation d''équipes performantes.', 'https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=500', '3 mois', 'Certificat', true, '15', '2025-08-28 06:30:17.982851', '2025-08-28 06:30:17.982851', NULL)
ON CONFLICT (id) DO NOTHING;

-- founder_message : 1 ligne(s)  [source: export_database_2iae_updated.sql]
INSERT INTO founder_message (id, title, quote, vision, founder_name, founder_role, founder_organization, founder_image_url, is_active, created_at, updated_at, updated_by) VALUES
  ('bbadcfa6-8df9-418d-9916-f6e55c4f354b', 'Message du Fondateur', 'L''entrepreneuriat est l''art de transformer les rêves en réalité concrète.', 'Si en Côte d''Ivoire, les écoles et les universités ont réussi dans les programmes de formation des cadres, les moyennes et grandes entreprises, elles ont connu moins de succès dans les programmes destinés aux chefs des petites entreprises, et moins encore dans la constitution d''une nouvelle catégorie d''entrepreneurs. Combien d''Ivoiriens rêvent-ils de créer leur entreprise chaque année ?? Plusieurs milliers peut-être, même plusieurs centaines de milliers! Longtemps restés en arrière-plan de cette formidable aventure de défi personnel, les ivoiriens semblent s''y intéresser de plus en plus. Par manque de formation au niveau entrepreneurial la plupart des entreprises qui se créent, disparaissent en...', 'Koua Séraphin', 'Fondateur et Président Directeur Général', 'Groupe Ecoles 2IAE International', '/api/assets/founder/founder_1756311786515_c950o98h15h.jpg', true, '2025-08-27 16:12:44.630771', '2025-08-27 16:23:21.977', NULL)
ON CONFLICT (id) DO NOTHING;

-- news : 2 ligne(s)  [source: export_database_2iae_updated.sql]
INSERT INTO news (id, title, summary, content, image_url, date, category, author, featured, is_active, "order", created_at, updated_at, created_by, slug) VALUES
  ('7d6fd535-434f-4dfb-94eb-1a1ca91d67b6', 'PRIX INTERNATIONAL DES BATISSEURS AFRICAINS', ' Les votes se poursuivent ; N''oubliez pas !
Soutenons notre PDG, M. Séraphin KOUA, candidat aux AfriBusiness Awards 2025 à Dubaï !
Votez ici : https://afribusinesschallenge.com/.../01k22thzarm2h71ejqq...
www.2iae.com
2IAE, l''École des Entrepreneurs', ' Les votes se poursuivent ; N''oubliez pas !
Soutenons notre PDG, M. Séraphin KOUA, candidat aux AfriBusiness Awards 2025 à Dubaï !
Votez ici : https://afribusinesschallenge.com/.../01k22thzarm2h71ejqq...
www.2iae.com
2IAE, l''École des Entrepreneurs', 'https://afribusinesschallenge.com/storage/participants/U46wIOv7ALWgZSEpCxUBHqLYDOxzIWJLssXKsmOl.jpg', '2025-08-27', 'Événements', 'Admin', false, true, '1', '2025-08-27 20:43:20.08087', '2025-08-27 20:43:20.08087', NULL, 'prix-international-des-batisseurs-africains'),
  ('2a7dae01-704b-4bbc-9c57-91b09947e651', 'Signature de convention entre 2IAE et CATALYSTE', 'Signature  de conventions   le lundi  25 Août  2025 entre Catalyste plus et le groupe  Écoles  2IAE  représenté  par son premier  responsable  Séraphin  Koua  et Madame  ,  ......
Représentant  Catalyste  plus.', 'Signature  de conventions   le lundi  25 Août  2025 entre Catalyste plus et le groupe  Écoles  2IAE  représenté  par son premier  responsable  séraphin  koua  et madam  ,  ......
Représentant  Catalyste  plus.', '/api/assets/actualites/news_1756330108173_19e451469c034dae86a9d6d5e6fb91e0.jpg', '2025-08-27', 'Partenariats', 'Direction 2IAE', true, true, '1', '2025-08-27 20:52:10.86244', '2025-08-27 21:31:30.832', NULL, 'signature-de-convention-entre-2iae-et-catalyste')
ON CONFLICT (id) DO NOTHING;

-- site_content : 4 ligne(s)  [source: database_export_complete.sql]
INSERT INTO site_content (id, key, title, value, type, section, "order", updated_at, updated_by) VALUES
  ('2af679b8-f095-4cf9-976b-2a3aabbde723', 'homepage_title', 'Titre principal de la page d''accueil', '2IAE INTERNATIONAL', 'text', 'homepage', '1', '2025-08-27 15:07:53.087', NULL),
  ('5e4425c8-4935-4106-bee9-fae17de7bddc', 'homepage_subtitle', 'Sous-titre de la page d''accueil', 'L''ÉCOLE DES ENTREPRENEURS', 'text', 'homepage', '2', '2025-08-27 15:07:53.13271', NULL),
  ('df68ea83-8c84-4964-b8e7-b0eb9d41b7a1', 'homepage_slogan', 'Slogan officiel', '2IAE, entreprendre pour devenir l''élite de demain.', 'text', 'homepage', '3', '2025-08-27 15:07:53.175979', NULL),
  ('b4a6771a-281e-4902-9c12-64f0bf108d09', 'about_description', 'Description À propos', '2IAE International est une institution d''enseignement supérieur spécialisée dans l''entrepreneuriat, située à Abidjan, Côte d''Ivoire.', 'textarea', 'about', '1', '2025-08-27 15:07:53.219741', NULL)
ON CONFLICT (id) DO NOTHING;

-- news_images : 3 ligne(s)  [source: database_export_complete.sql — après news, FK]
INSERT INTO news_images (id, news_id, image_url, caption, "order", created_at) VALUES
  ('fcd1fdaa-3dcf-4c2f-b444-57e3fbc37595', '2a7dae01-704b-4bbc-9c57-91b09947e651', '/api/assets/actualites/news_1756330264179_ca17bf40b7604bb1b17c1750535513ca.jpg', NULL, '1', '2025-08-27 21:31:04.19815'),
  ('c9493c22-a041-44e3-adbb-5a13e4305218', '2a7dae01-704b-4bbc-9c57-91b09947e651', '/api/assets/actualites/news_1756330273305_3cd28406848c473fab30f2ede3bf3e50.jpg', NULL, '2', '2025-08-27 21:31:13.323859'),
  ('c8688fd1-8812-4565-9af9-1648b0e3f914', '2a7dae01-704b-4bbc-9c57-91b09947e651', '/api/assets/actualites/news_1756330286672_b8886653cb7c4a158aa31a2f0ab55ad3.jpg', NULL, '3', '2025-08-27 21:31:26.692633')
ON CONFLICT (id) DO NOTHING;

-- tariffs : 4 ligne(s)  [source: tariffs_export.sql — 4 sites]
INSERT INTO tariffs (id, site, location, phone, email, account_info, program_name, program_duration, inscription_fee, frais_annexes, total_fee, first_payment, second_payment, third_payment, required_documents, uniform_costs, supplies, description, is_active, "order", created_at, updated_at, created_by) VALUES
  ('978b2ead-6950-4343-af11-e636120f4326', '2IAE PALMERAIE', 'Abidjan - Riviera Palmeraie', '+225  07 07 57 82 82', 'contacts@2iae.com', 'N° COMPTE AFG BANK-CI : 01201 013457690001 04', 'BTS - Orientés 1ère Année', '2 ans', 85000, 165000, 250000, 85000, 90000, 75000, '["2 Extraits de naissance Originaux", "Photocopie du dernier bulletin de notes de la terminale", "2 photos d''identité de même tirage", "2 Copies légalisées de l''attestation de réussite du bac ou relevé de notes du bac", "Photocopie de la CNI ou attestation d''identité en cours de validité"]', '{"tissu": "25 000 F CFA (Achat obligatoire à 2IAE)", "blouse": "10 000 F CFA (OBLIGATOIRE pour les filières industrielles et SI)", "cravate": "5 000 F CFA"}', '["1 Paquet de Marker non permanent pour tableau (Schneider - Memo - Bic STA)", "1 Paquet de papier Rame", "1 Chemise à Rabat pour les nouveaux étudiants"]', 'Formation BTS (Rentrée académique 2025-2026). Droit d''inscription: 85 000 F + Frais annexes: 165 000 F.', true, '1', '2025-09-05 02:48:32.812237', '2025-09-05 11:38:28.379', NULL),
  ('9fe23f2e-4a4e-4aa2-aee6-0d2a74bcb6be', '2IAE YAMOUSSOUKRO', 'Yamoussoukro Centre', '+225 XX XX XX XX', 'yamoussoukro@2iae.ci', NULL, 'BTS - Orientés 1ère Année', '2 ans', 85000, 140000, 225000, 85000, 85000, 55000, '["2 Extraits de naissance Originaux", "Photocopie du dernier bulletin de notes de la terminale", "2 photos d''identité de même tirage", "2 Copies légalisées de l''attestation de réussite du bac ou relevé de notes du bac", "Photocopie de la CNI ou attestation d''identité en cours de validité"]', NULL, '["1 Paquet de Marker non permanent pour tableau (Schneider - Memo - Bic STA)", "1 Paquet de papier Rame", "1 Chemise à Rabat pour les nouveaux étudiants"]', 'Formation BTS (Rentrée académique 2025-2026). Droit d''inscription: 85 000 F + Frais annexes: 140 000 F.', true, '2', '2025-09-05 02:48:32.812237', '2025-09-05 02:48:32.812237', NULL),
  ('6e21bce0-d0eb-4b5d-a8f7-f0462881f07a', '2IAE AZAGUIÉ', 'Azaguié Centre', '+225 XX XX XX XX', 'azaguie@2iae.ci', NULL, 'BTS - Orientés 1ère Année', '2 ans', 85000, 145000, 230000, 85000, 85000, 60000, '["2 Extraits de naissance Originaux", "Photocopie du dernier bulletin de notes de la terminale", "2 photos d''identité de même tirage", "2 Copies légalisées de l''attestation de réussite du bac ou relevé de notes du bac", "Photocopie de la CNI ou attestation d''identité en cours de validité"]', '{"tissu": "25 000 F CFA (Achat obligatoire à 2IAE)", "blouse": "10 000 F CFA (OBLIGATOIRE pour les filières industrielles et SI)", "cravate": "5 000 F CFA"}', '["1 Paquet de Marker non permanent pour tableau (Schneider - Memo - Bic STA)", "1 Paquet de papier Rame", "1 Chemise à Rabat pour les nouveaux étudiants"]', 'Formation BTS (Rentrée académique 2025-2026). Droit d''inscription: 85 000 F + Frais annexes: 145 000 F.', true, '3', '2025-09-05 02:48:32.812237', '2025-09-05 02:48:32.812237', NULL),
  ('3278d5fb-19c1-44a6-925c-cb82b2613b67', '2IAE YOPOUGON', 'Yopougon Centre', '+225 XX XX XX XX', 'yopougon@2iae.ci', 'N° COMPTE AFG BANK-CI : 01201 013457690001 04', 'BTS - Orientés 1ère Année', '2 ans', 85000, 140000, 225000, 85000, 85000, 55000, '["2 Extraits de naissance Originaux", "Photocopie du dernier bulletin de notes de la terminale", "2 photos d''identité de même tirage", "2 Copies légalisées de l''attestation de réussite du bac ou relevé de notes du bac", "Photocopie de la CNI ou attestation d''identité en cours de validité"]', NULL, '["1 Paquet de Marker non permanent pour tableau (Schneider - Memo - Bic STA)", "1 Paquet de papier Rame", "1 Chemise à Rabat pour les nouveaux étudiants"]', 'Formation BTS (Rentrée académique 2025-2026). Droit d''inscription: 85 000 F + Frais annexes: 140 000 F.', true, '4', '2025-09-05 02:48:32.812237', '2025-09-05 02:48:32.812237', NULL)
ON CONFLICT (id) DO NOTHING;

-- albums : 1 ligne(s)  [source: export-gallery-complete.sql]
INSERT INTO albums (id, title, description, cover_image, category, is_active, "order", created_at, updated_at, created_by) VALUES
  ('be91af32-2af7-4feb-8e80-b7b01f5c179f', 'Partenariat avec Catalyste+', 'Un Partenariat avec Catalyste+ avec la présence du PDG du groupe Ecoles 2IAE Séraphin Koua et Madame', 'https://2iae-images.nyc3.digitaloceanspaces.com/gallery//gallery_1757082268095_09aw5xq47vcl.jpg', 'Activités', true, '1', '2025-09-05 14:24:34.084644', '2025-09-05 14:24:34.084644', NULL)
ON CONFLICT (id) DO NOTHING;

-- gallery_items : 2 ligne(s)  [source: export-gallery-complete.sql — après albums, FK]
INSERT INTO gallery_items (id, album_id, title, description, media_url, media_type, thumbnail_url, is_active, "order", created_at, updated_at, created_by) VALUES
  ('ce00ddfc-09e8-47dd-8762-c4b326445e53', 'be91af32-2af7-4feb-8e80-b7b01f5c179f', '', '', 'https://2iae-images.nyc3.digitaloceanspaces.com/gallery//gallery_1757082309066_wp85zohshc.jpg', 'image', '', true, '1', '2025-09-05 14:25:32.843396', '2025-09-05 14:25:32.843396', NULL),
  ('3c95521e-6018-4c8d-a314-b30d9f5f3b61', 'be91af32-2af7-4feb-8e80-b7b01f5c179f', 'Etape de signature', 'Etape de signature', 'https://2iae-images.nyc3.digitaloceanspaces.com/gallery//gallery_1757082364298_yckwkfxbtw.jpg', 'image', '', true, '1', '2025-09-05 14:26:24.703458', '2025-09-05 14:26:24.703458', NULL)
ON CONFLICT (id) DO NOTHING;

COMMIT;
