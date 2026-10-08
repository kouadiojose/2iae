// Routes du chantier C8 (tableau « Engagement et participation ») : GET
// /api/pilotage/engagement et son export CSV. Posé vide par le socle commun
// (C0) et déjà branché dans routes/index.ts : C8 le remplit sans toucher à
// l'index (campus/ENGAGEMENT.md).
import type { Express } from "express";

export function enregistrerPilotageEngagement(_app: Express) {}
