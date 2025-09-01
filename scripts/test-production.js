#!/usr/bin/env node

// Script de test pour vérifier la compatibilité production PostgreSQL
// Simule l'environnement DigitalOcean App Platform

const { Pool } = require('pg');

async function testProductionDatabase() {
  console.log('🧪 Test de connexion PostgreSQL pour production...\n');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL manquant');
    console.log('Définissez DATABASE_URL avec votre chaîne PostgreSQL DigitalOcean');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
      rejectUnauthorized: false
    } : false
  });

  try {
    // Test de connexion
    const client = await pool.connect();
    console.log('✅ Connexion PostgreSQL établie');
    
    // Test de requête simple
    const result = await client.query('SELECT version()');
    console.log('✅ Version PostgreSQL:', result.rows[0].version.split(' ')[0]);
    
    // Test des tables (si elles existent)
    try {
      const tablesResult = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      
      if (tablesResult.rows.length > 0) {
        console.log('✅ Tables trouvées:', tablesResult.rows.map(r => r.table_name).join(', '));
      } else {
        console.log('ℹ️  Aucune table trouvée (base vide)');
      }
    } catch (e) {
      console.log('ℹ️  Impossible de lister les tables (normal pour une base vide)');
    }
    
    client.release();
    console.log('\n🎉 Test PostgreSQL réussi ! Prêt pour la production DigitalOcean');
    
  } catch (error) {
    console.error('\n❌ Erreur de connexion PostgreSQL:');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    
    if (error.code === 'ENOTFOUND') {
      console.log('\n💡 Suggestions:');
      console.log('- Vérifiez que l\'URL de la base est correcte');
      console.log('- Vérifiez que la base PostgreSQL DigitalOcean est active');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testProductionDatabase();