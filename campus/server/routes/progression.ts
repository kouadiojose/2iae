// Routes du chantier C5 (progression et Coupe) : /api/progression/* et
// /api/coupe. Posé vide par le socle commun (C0) et déjà branché dans
// routes/index.ts : C5 le remplit sans toucher à l'index
// (campus/ENGAGEMENT.md).
import type { Express } from "express";

export function enregistrerProgression(_app: Express) {}
