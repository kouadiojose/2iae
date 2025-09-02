// list-tables.js - Lister toutes les tables INCUB-AGRI
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false, require: true },
});

async function listTables() {
  console.log("🔍 INVENTAIRE DES TABLES - INCUB-AGRI");
  console.log(
    "📅 Date:",
    new Date().toLocaleString("fr-FR", { timeZone: "Africa/Abidjan" }),
  );

  const client = await pool.connect();

  try {
    // ========================================
    // LISTER TOUTES LES TABLES
    // ========================================
    console.log("\n📋 === TABLES DISPONIBLES ===");

    const tablesQuery = `
      SELECT 
        table_name,
        table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;

    const tables = await client.query(tablesQuery);

    console.log(`\n📊 Total: ${tables.rows.length} tables trouvées\n`);

    tables.rows.forEach((table, index) => {
      console.log(`${index + 1}.  📋 ${table.table_name}`);
    });

    // ========================================
    // COMPTER LES ENREGISTREMENTS
    // ========================================
    console.log("\n📊 === NOMBRE D'ENREGISTREMENTS PAR TABLE ===\n");

    for (const table of tables.rows) {
      try {
        const countQuery = `SELECT COUNT(*) as count FROM ${table.table_name}`;
        const result = await client.query(countQuery);
        const count = result.rows[0].count;

        console.log(
          `   📋 ${table.table_name.padEnd(20)} : ${count} enregistrements`,
        );
      } catch (error) {
        console.log(`   ❌ ${table.table_name.padEnd(20)} : Erreur de lecture`);
      }
    }

    // ========================================
    // VÉRIFIER LES TABLES IMPORTANTES
    // ========================================
    console.log("\n✅ === VÉRIFICATION DES TABLES ESSENTIELLES ===");

    const essentialTables = [
      "users",
      "vendors",
      "products",
      "orders",
      "order_items",
      "reviews",
      "phases",
      "albums",
      "album_media",
    ];

    const existingTables = tables.rows.map((t) => t.table_name);

    essentialTables.forEach((tableName) => {
      if (existingTables.includes(tableName)) {
        console.log(`   ✅ ${tableName} - Présente`);
      } else {
        console.log(`   ❌ ${tableName} - MANQUANTE`);
      }
    });

    // ========================================
    // RÉSUMÉ
    // ========================================
    console.log("\n🏁 === RÉSUMÉ ===");

    const missingTables = essentialTables.filter(
      (t) => !existingTables.includes(t),
    );
    const extraTables = existingTables.filter(
      (t) => !essentialTables.includes(t),
    );

    if (missingTables.length === 0) {
      console.log("✅ Toutes les tables essentielles sont présentes");
    } else {
      console.log(`❌ Tables manquantes: ${missingTables.join(", ")}`);
    }

    if (extraTables.length > 0) {
      console.log(`ℹ️  Tables supplémentaires: ${extraTables.join(", ")}`);
    }

    // ========================================
    // TAILLE DE LA BASE
    // ========================================
    console.log("\n📏 === TAILLE DE LA BASE ===");

    try {
      const sizeQuery = `
        SELECT 
          pg_size_pretty(pg_database_size(current_database())) as db_size,
          current_database() as db_name
      `;
      const sizeResult = await client.query(sizeQuery);
      const { db_size, db_name } = sizeResult.rows[0];

      console.log(`   📊 Base de données: ${db_name}`);
      console.log(`   💾 Taille totale: ${db_size}`);
    } catch (error) {
      console.log("   ⚠️ Impossible de calculer la taille");
    }

    console.log("\n🎯 === CONSULTATION TERMINÉE ===");
  } catch (error) {
    console.error("❌ Erreur lors de la consultation:", error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

listTables().catch(console.error);
