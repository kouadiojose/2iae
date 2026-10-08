// Routes du chantier C3 (rappels qui arrivent) : POST
// /api/notifications/:id/ouvert. Posé vide par le socle commun (C0) et déjà
// branché dans routes/index.ts : C3 le remplit sans toucher à l'index
// (campus/ENGAGEMENT.md).
import type { Express } from "express";

export function enregistrerEnvois(_app: Express) {}
