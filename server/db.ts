// PRODUCTION-READY DATABASE CONFIGURATION  
// Development: Neon Database | Production: PostgreSQL

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless'; 
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// For now, keep using NeonDatabase for both environments
// Production deployment will be handled by environment variables
console.log("🔧 Using NeonDatabase (compatible with both environments)");

neonConfig.webSocketConstructor = ws;

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });