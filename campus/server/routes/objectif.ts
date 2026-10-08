// Routes du chantier C2 (objectif du jour) : GET /api/objectif-du-jour et POST
// /api/objectif-du-jour/ouvert. Posé vide par le socle commun (C0) et déjà
// branché dans routes/index.ts : C2 le remplit sans toucher à l'index
// (campus/ENGAGEMENT.md).
import type { Express } from "express";

export function enregistrerObjectif(_app: Express) {}
