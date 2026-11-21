// Diagnostic temporaire (21 novembre 2026) : ce qui existe pour l'emploi du temps, écrit une fois au démarrage dans le
// journal du serveur (« [edt] »). À retirer une fois l'emploi du temps de la session créé.
import { sql } from "drizzle-orm";
import { db } from "./db";

setTimeout(() => {
  void (async () => {
    const q = async (titre: string, requete: ReturnType<typeof sql>) => {
      const r = await db.execute(requete);
      for (const l of r.rows) console.log(`[edt] ${titre} ${JSON.stringify(l)}`);
    };
    await q("session", sql`select id, titre, public, debut, fin, statut, (select count(*) from campus.creneaux_programme c where c.session_id = s.id) as creneaux, (select count(*) from campus.sessions_classes x where x.session_id = s.id) as classes from campus.sessions_programme s order by id`);
    await q("creneau", sql`select cr.session_id as s, cr.jour, cr.heure_debut as de, cr.heure_fin as a, cr.type, co.code, cr.titre, cr.intervenant_id as iid, cr.intervenant_nom as nom, cr.mention from campus.creneaux_programme cr left join campus.cours co on co.id = cr.cours_id order by 1, 2, 3`);
    await q("seance", sql`select s.id, to_char(s.debut, 'Dy DD/MM HH24:MI') as debut, s.duree_minutes as min, s.statut, co.code, s.titre, (select count(*) from campus.seances_creneaux sc where sc.seance_id = s.id) as prog from campus.seances s join campus.cours co on co.id = s.cours_id where s.debut >= now() - interval '14 days' and s.debut < now() + interval '15 days' order by s.debut`);
    await q("cours", sql`select co.id, co.code, co.titre, co.statut, u.prenom || ' ' || u.nom as formateur, (select string_agg(distinct cl.niveau, ',') from campus.cours_classes cc join campus.classes cl on cl.id = cc.classe_id where cc.cours_id = co.id) as niveaux, (select count(*) from campus.cours_classes cc where cc.cours_id = co.id) as classes from campus.cours co left join campus.utilisateurs u on u.id = co.formateur_id where co.statut <> 'archive' order by co.id`);
    await q("formateur", sql`select id, prenom, nom, actif from campus.utilisateurs where role = 'formateur' order by nom`);
    await q("classes", sql`select cl.niveau, cl.filiere, count(distinct cl.id) as classes, count(distinct cl.site_id) as sites, count(u.id) as etudiants from campus.classes cl left join campus.utilisateurs u on u.classe_id = cl.id and u.role = 'etudiant' and u.actif where cl.annee_scolaire = (select max(annee_scolaire) from campus.classes) group by 1, 2 having count(u.id) > 0 order by 1, 2`);
    await q("site", sql`select id, nom_court from campus.sites order by id`);
  })().catch((e) => console.warn("[edt] diagnostic :", (e as Error).message));
}, 15_000).unref();
