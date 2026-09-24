import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Le campus est d'abord consulté sur téléphone en 4G : chaque écran est
    // chargé à la demande et les grosses bibliothèques (visio) restent à part.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "wouter", "@tanstack/react-query"],
        },
      },
    },
  },
  server: {
    fs: { strict: true, deny: ["**/.*"] },
  },
});
