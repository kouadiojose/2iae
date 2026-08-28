-- Export de la table tariffs pour la production
-- Date d'export: 2025-01-05

-- Nettoyage (optionnel - décommentez si vous voulez vider la table avant import)
-- DELETE FROM tariffs;

-- Insertion des données de tarifs pour les 4 sites 2IAE
INSERT INTO tariffs (
  id, site, location, phone, email, account_info, program_name, program_duration,
  inscription_fee, frais_annexes, total_fee, first_payment, second_payment, third_payment,
  required_documents, uniform_costs, supplies, description, is_active, "order", 
  created_at, updated_at, created_by
) VALUES 

-- 2IAE PALMERAIE
(
  '978b2ead-6950-4343-af11-e636120f4326',
  '2IAE PALMERAIE',
  'Abidjan - Riviera Palmeraie',
  '+225  07 07 57 82 82',
  'contacts@2iae.com',
  'N° COMPTE AFG BANK-CI : 01201 013457690001 04',
  'BTS - Orientés 1ère Année',
  '2 ans',
  85000,
  165000,
  250000,
  85000,
  90000,
  75000,
  '["2 Extraits de naissance Originaux", "Photocopie du dernier bulletin de notes de la terminale", "2 photos d''identité de même tirage", "2 Copies légalisées de l''attestation de réussite du bac ou relevé de notes du bac", "Photocopie de la CNI ou attestation d''identité en cours de validité"]',
  '{"tissu": "25 000 F CFA (Achat obligatoire à 2IAE)", "blouse": "10 000 F CFA (OBLIGATOIRE pour les filières industrielles et SI)", "cravate": "5 000 F CFA"}',
  '["1 Paquet de Marker non permanent pour tableau (Schneider - Memo - Bic STA)", "1 Paquet de papier Rame", "1 Chemise à Rabat pour les nouveaux étudiants"]',
  'Formation BTS (Rentrée académique 2025-2026). Droit d''inscription: 85 000 F + Frais annexes: 165 000 F.',
  true,
  '1',
  '2025-09-05 02:48:32.812237',
  '2025-09-05 11:38:28.379',
  NULL
),

-- 2IAE YAMOUSSOUKRO
(
  '9fe23f2e-4a4e-4aa2-aee6-0d2a74bcb6be',
  '2IAE YAMOUSSOUKRO',
  'Yamoussoukro Centre',
  '+225 XX XX XX XX',
  'yamoussoukro@2iae.ci',
  NULL,
  'BTS - Orientés 1ère Année',
  '2 ans',
  85000,
  140000,
  225000,
  85000,
  85000,
  55000,
  '["2 Extraits de naissance Originaux", "Photocopie du dernier bulletin de notes de la terminale", "2 photos d''identité de même tirage", "2 Copies légalisées de l''attestation de réussite du bac ou relevé de notes du bac", "Photocopie de la CNI ou attestation d''identité en cours de validité"]',
  NULL,
  '["1 Paquet de Marker non permanent pour tableau (Schneider - Memo - Bic STA)", "1 Paquet de papier Rame", "1 Chemise à Rabat pour les nouveaux étudiants"]',
  'Formation BTS (Rentrée académique 2025-2026). Droit d''inscription: 85 000 F + Frais annexes: 140 000 F.',
  true,
  '2',
  '2025-09-05 02:48:32.812237',
  '2025-09-05 02:48:32.812237',
  NULL
),

-- 2IAE AZAGUIÉ
(
  '6e21bce0-d0eb-4b5d-a8f7-f0462881f07a',
  '2IAE AZAGUIÉ',
  'Azaguié Centre',
  '+225 XX XX XX XX',
  'azaguie@2iae.ci',
  NULL,
  'BTS - Orientés 1ère Année',
  '2 ans',
  85000,
  145000,
  230000,
  85000,
  85000,
  60000,
  '["2 Extraits de naissance Originaux", "Photocopie du dernier bulletin de notes de la terminale", "2 photos d''identité de même tirage", "2 Copies légalisées de l''attestation de réussite du bac ou relevé de notes du bac", "Photocopie de la CNI ou attestation d''identité en cours de validité"]',
  '{"tissu": "25 000 F CFA (Achat obligatoire à 2IAE)", "blouse": "10 000 F CFA (OBLIGATOIRE pour les filières industrielles et SI)", "cravate": "5 000 F CFA"}',
  '["1 Paquet de Marker non permanent pour tableau (Schneider - Memo - Bic STA)", "1 Paquet de papier Rame", "1 Chemise à Rabat pour les nouveaux étudiants"]',
  'Formation BTS (Rentrée académique 2025-2026). Droit d''inscription: 85 000 F + Frais annexes: 145 000 F.',
  true,
  '3',
  '2025-09-05 02:48:32.812237',
  '2025-09-05 02:48:32.812237',
  NULL
),

-- 2IAE YOPOUGON
(
  '3278d5fb-19c1-44a6-925c-cb82b2613b67',
  '2IAE YOPOUGON',
  'Yopougon Centre',
  '+225 XX XX XX XX',
  'yopougon@2iae.ci',
  'N° COMPTE AFG BANK-CI : 01201 013457690001 04',
  'BTS - Orientés 1ère Année',
  '2 ans',
  85000,
  140000,
  225000,
  85000,
  85000,
  55000,
  '["2 Extraits de naissance Originaux", "Photocopie du dernier bulletin de notes de la terminale", "2 photos d''identité de même tirage", "2 Copies légalisées de l''attestation de réussite du bac ou relevé de notes du bac", "Photocopie de la CNI ou attestation d''identité en cours de validité"]',
  NULL,
  '["1 Paquet de Marker non permanent pour tableau (Schneider - Memo - Bic STA)", "1 Paquet de papier Rame", "1 Chemise à Rabat pour les nouveaux étudiants"]',
  'Formation BTS (Rentrée académique 2025-2026). Droit d''inscription: 85 000 F + Frais annexes: 140 000 F.',
  true,
  '4',
  '2025-09-05 02:48:32.812237',
  '2025-09-05 02:48:32.812237',
  NULL
);

-- Vérification de l'import
SELECT COUNT(*) as total_tariffs FROM tariffs;
SELECT site, total_fee FROM tariffs ORDER BY "order";