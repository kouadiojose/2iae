// Routes du chantier C7 (côté formateur) : /api/enseigner/apres-seance,
// /api/enseigner/a-relire, validation des devoirs automatiques, travail de
// groupe. Posé vide par le socle commun (C0) et déjà branché dans
// routes/index.ts : C7 le remplit sans toucher à l'index
// (campus/ENGAGEMENT.md).
import type { Express } from "express";

export function enregistrerEnseignerSuivi(_app: Express) {}
