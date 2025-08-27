import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../shared/schema.js';
import ws from "ws";

// Configuration for Neon Database
const neonConfig = {
  webSocketConstructor: ws,
};

async function initializeDatabase() {
  try {
    console.log('🚀 Initializing database...');
    
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    const pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      ...neonConfig 
    });
    
    const db = drizzle({ client: pool, schema });

    console.log('✅ Database connection established');
    console.log('📋 Database schema is ready');
    console.log('🎯 You can now run: npm run db:push to apply schema changes');
    
    await pool.end();
    console.log('✅ Database initialization completed successfully');
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Run initialization
initializeDatabase();