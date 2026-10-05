// Cours complets tirés des enregistrements : lecture par les étudiants qui ont
// accès au replay (classes du cours, ou médiathèque ouverte), et « Refaire »
// pour le formateur du cours et la direction. La préparation elle-même tourne
// toute seule (etude-cours.ts).
import type { Express } from "express";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { exigerConnexion, moi } from "../auth";
import { route, idParam, interdit } from "../http";
import { enseigneCours } from "../acces";
import { seanceDuReplay } from "./live";
import { etatCoursComplet, refaireCoursComplet } from "../etude-cours";
import { etatTranscription, relancerTranscription } from "../transcription-replays";
import { cours, devoirs, devoirsSeances, utilisateurs, type CoursCompletDto, type Seance, type Utilisateur } from "@shared/schema";

async function versDto(u: Utilisateur, s: Seance): Promise<CoursCompletDto> {
  const [c] = await db.select({ code: cours.code, titre: cours.titre, formateurId: cours.formateurId }).from(cours).where(eq(cours.id, s.coursId));
  const [f] = c?.formateurId ? await db.select({ prenom: utilisateurs.prenom, nom: utilisateurs.nom }).from(utilisateurs).where(eq(utilisateurs.id, c.formateurId)) : [];
  const etat = await etatCoursComplet(s);
  const relancable = u.role !== "etudiant" && (await peutRefaire(u, s));
  // Interrogation notée et devoir pratique (avec son corrigé) : jamais montrés aux étudiants.
  if (etat.dossier && !relancable) {
    const { interrogation: _i, devoirPratique: _p, ...visible } = etat.dossier;
    etat.dossier = visible;
  }
  const [lien] = await db.select({ ids: devoirsSeances.devoirIds }).from(devoirsSeances).where(eq(devoirsSeances.seanceId, s.id));
  const liste = lien?.ids.length
    ? await db
        .select({ id: devoirs.id, type: devoirs.type, titre: devoirs.titre, dateLimite: devoirs.dateLimite, publie: devoirs.publie })
        .from(devoirs)
        .where(inArray(devoirs.id, lien.ids))
    : [];
  return {
    seance: { id: s.id, titre: s.titre, coursId: s.coursId, coursCode: c?.code ?? "", coursTitre: c?.titre ?? "", debut: s.debut.toISOString(), formateur: f ? `${f.prenom} ${f.nom}` : null },
    ...etat,
    relancable,
    devoirs: liste.filter((d) => d.publie || relancable).map((d) => ({ id: d.id, type: d.type, titre: d.titre, dateLimite: d.dateLimite.toISOString() })),
  };
}

const peutRefaire = async (u: Utilisateur, s: Seance) => u.role === "admin" || (await enseigneCours(u, s.coursId));

export function enregistrerCoursComplets(app: Express) {
  app.get(
    "/api/seances/:id(\\d+)/cours-complet",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const s = await seanceDuReplay(u, idParam(req));
      res.setHeader("Cache-Control", "no-store");
      res.json(await versDto(u, s));
    }),
  );

  app.post(
    "/api/seances/:id(\\d+)/cours-complet/refaire",
    exigerConnexion,
    route(async (req, res) => {
      const u = moi(req);
      const s = await seanceDuReplay(u, idParam(req));
      if (!(await peutRefaire(u, s))) throw interdit("Seuls le formateur du cours et la direction peuvent refaire le cours complet.");
      // Transcription en échec : elle est redemandée ; le cours sera refait ensuite.
      if ((await etatTranscription(s.id)) === "erreur") await relancerTranscription(s.id);
      await refaireCoursComplet(s.id);
      res.json(await versDto(u, s));
    }),
  );
}
