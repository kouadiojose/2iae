// Sème les données de démonstration à la demande (npm run db:seed).
import { pool } from "../db";
import { amorcer } from "../amorcage";
import { semerDemo } from "../demo";

amorcer()
  .then(() => semerDemo())
  .then(() => pool.end())
  .catch(async (e) => {
    console.error(e);
    await pool.end();
    process.exit(1);
  });
