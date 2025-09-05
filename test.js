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

const createTariffsTable = `
-- Table tariffs
CREATE TABLE IF NOT EXISTS tariffs (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    site TEXT NOT NULL,
    location TEXT,
    phone TEXT,
    email TEXT,
    account_info TEXT,
    program_name TEXT NOT NULL,
    program_duration TEXT,
    inscription_fee INTEGER,
    frais_annexes INTEGER,
    total_fee INTEGER,
    first_payment INTEGER,
    second_payment INTEGER,
    third_payment INTEGER,
    required_documents JSONB DEFAULT '[]',
    uniform_costs JSONB,
    supplies JSONB DEFAULT '[]',
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    "order" TEXT DEFAULT '1',
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    created_by VARCHAR REFERENCES admin_users(id)
);
`;

const insertTariffsData = `
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
)
ON CONFLICT (id) DO NOTHING;
`;

async function migrateTariffs() {
  console.log("Début de la migration de la table tariffs...");

  try {
    // Test de connexion
    console.log("Vérification de la connexion...");
    const client = await pool.connect();
    await client.query("SELECT 1");
    console.log("Connexion réussie !");

    // Création de la table tariffs
    console.log("Création de la table tariffs...");
    await client.query(createTariffsTable);
    console.log("Table tariffs créée avec succès !");

    // Insertion des données
    console.log("Insertion des données tarifs...");
    await client.query(insertTariffsData);
    console.log("Données insérées avec succès !");

    // Vérification des données
    console.log("Vérification des données...");
    const countResult = await client.query(
      "SELECT COUNT(*) as total_tariffs FROM tariffs",
    );
    const dataResult = await client.query(
      'SELECT site, total_fee FROM tariffs ORDER BY "order"',
    );

    console.log(
      `\nNombre total de tarifs: ${countResult.rows[0].total_tariffs}`,
    );
    console.log("\nTarifs par site:");
    dataResult.rows.forEach((row) => {
      console.log(`  ${row.site}: ${row.total_fee.toLocaleString()} F CFA`);
    });

    // Vérification de la structure
    const structureResult = await client.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'tariffs' 
            ORDER BY ordinal_position;
        `);

    console.log("\nStructure de la table tariffs:");
    structureResult.rows.forEach((col) => {
      console.log(
        `  ${col.column_name} (${col.data_type}) - ${col.is_nullable === "YES" ? "NULL" : "NOT NULL"}`,
      );
    });

    client.release();
    await pool.end();

    console.log("\nMigration de la table tariffs terminée avec succès !");
    console.log(
      "Les 4 sites 2IAE sont configurés avec leurs tarifs respectifs.",
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
    'Utilisez: DATABASE_URL="your-connection-string" node migrate-tariffs.js',
  );
  process.exit(1);
}

// Lancement de la migration
migrateTariffs();
