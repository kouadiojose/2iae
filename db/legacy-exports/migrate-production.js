import pkg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pkg;

async function runProductionMigration() {
  console.log('🚀 Migration de la base de données 2IAE vers DigitalOcean...');
  
  // URL de connexion DigitalOcean PostgreSQL
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL non définie');
    process.exit(1);
  }
  
  console.log('🔗 Connexion à DigitalOcean PostgreSQL...');
  
  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  try {
    await client.connect();
    console.log('✅ Connexion établie avec succès');
    
    // Lire le fichier SQL d'export
    const sqlFile = path.join(process.cwd(), 'database_export_complete.sql');
    console.log('📄 Lecture du fichier SQL d\'export...');
    
    if (!fs.existsSync(sqlFile)) {
      throw new Error(`Fichier SQL non trouvé : ${sqlFile}`);
    }
    
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    console.log('💾 Exécution de l\'import SQL...');
    
    // Diviser en requêtes individuelles et les exécuter
    const queries = sqlContent
      .split(';')
      .map(q => q.trim())
      .filter(q => q.length > 0 && !q.startsWith('--'));
    
    console.log(`📊 ${queries.length} requêtes à exécuter...`);
    
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      if (query.length > 0) {
        try {
          await client.query(query);
          console.log(`✅ Requête ${i + 1}/${queries.length} exécutée`);
        } catch (error) {
          // Ignorer certaines erreurs non critiques
          if (error.message.includes('already exists') || 
              error.message.includes('does not exist') ||
              error.message.includes('DROP DATABASE')) {
            console.log(`⚠️  Requête ${i + 1} ignorée: ${error.message.split('\n')[0]}`);
            continue;
          }
          throw error;
        }
      }
    }
    
    console.log('🎉 Migration terminée avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration :', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runProductionMigration().catch(console.error);