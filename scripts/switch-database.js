#!/usr/bin/env node

// Script pour basculer entre les configurations de base de données
// Development: NeonDatabase | Production: PostgreSQL

const fs = require('fs');
const path = require('path');

const configs = {
  development: {
    name: 'NeonDatabase (Développement)',
    content: `// CONFIGURATION DÉVELOPPEMENT - NeonDatabase
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless'; 
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

console.log("🔧 Using NeonDatabase for development");

neonConfig.webSocketConstructor = ws;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });`
  },
  
  production: {
    name: 'PostgreSQL (Production)',
    content: `// CONFIGURATION PRODUCTION - PostgreSQL pour DigitalOcean
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

console.log("🔧 Using PostgreSQL for production");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, { schema });

pool.on('connect', () => {
  console.log('✅ PostgreSQL connection established');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL connection error:', err);
});`
  }
};

function switchConfig(environment) {
  const config = configs[environment];
  if (!config) {
    console.error('❌ Environment invalide. Utilisez: development ou production');
    process.exit(1);
  }

  const dbPath = path.join(__dirname, '../server/db.ts');
  
  try {
    fs.writeFileSync(dbPath, config.content);
    console.log(`✅ Configuration basculée vers: ${config.name}`);
    console.log(`📁 Fichier mis à jour: server/db.ts`);
    
    if (environment === 'production') {
      console.log('\n⚠️  ATTENTION: Configuration PostgreSQL activée');
      console.log('Assurez-vous d\'avoir:');
      console.log('- Le package "pg" installé');
      console.log('- DATABASE_URL pointant vers PostgreSQL');
      console.log('- NODE_ENV=production en production');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'écriture:', error.message);
    process.exit(1);
  }
}

// Arguments de ligne de commande
const env = process.argv[2];

if (!env) {
  console.log('🔧 Sélecteur de Configuration Base de Données\n');
  console.log('Usage:');
  console.log('  node scripts/switch-database.js development  # NeonDatabase');
  console.log('  node scripts/switch-database.js production   # PostgreSQL');
  console.log('\nConfiguration actuelle: Auto-détection basée sur NODE_ENV et DATABASE_URL');
  process.exit(0);
}

switchConfig(env);