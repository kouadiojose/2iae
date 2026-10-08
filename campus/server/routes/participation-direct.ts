// Routes du chantier C6 (directs) : GET /api/seances/:id/questions-rappel et
// GET /api/mes-presences. Posé vide par le socle commun (C0) et déjà branché
// dans routes/index.ts : C6 le remplit sans toucher à l'index
// (campus/ENGAGEMENT.md).
import type { Express } from "express";

export function enregistrerParticipationDirect(_app: Express) {}
