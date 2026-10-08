// Routes du chantier C4 (rappel du jour, e-mail de la semaine et relances) :
// réglages des rappels, désabonnement, /api/relances/e/:id,
// /api/pilotage/relances-auto. Posé vide par le socle commun (C0) et déjà
// branché dans routes/index.ts : C4 le remplit sans toucher à l'index
// (campus/ENGAGEMENT.md).
import type { Express } from "express";

export function enregistrerRelancesAuto(_app: Express) {}
