import { defineConfig } from "drizzle-kit";

// Toutes les tables du campus vivent dans le schéma PostgreSQL « campus » :
// la base peut être dédiée ou partagée avec le site sans aucun risque de
// collision avec ses tables (session, users, news…).
export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema/index.ts",
  dialect: "postgresql",
  schemaFilter: ["campus"],
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgresql://localhost:5432/campus",
  },
});
