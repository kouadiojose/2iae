// Accueil « Aujourd'hui ».
//
// Étudiant : LA chose à faire maintenant, choisie par le serveur selon une
// priorité fixe (CONCEPTION §6) : live en cours → devoir dû sous 24 h non
// rendu → live dans moins de 2 h → message non lu d'un formateur → devoir en
// retard encore accepté → prochain devoir → « Tu es à jour ». Puis trois
// lignes « Ensuite », ses cours avec leur progression et l'annonce importante.
//
// Formateur : prochaine séance (studio, préparation), copies à corriger,
// questions restées sans réponse au dernier live, ses cours, ses messages.
import type { Express } from "express";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { db } from "../db";
import { exigerRole, moi } from "../auth";
import { route } from "../http";
import { idsCoursAccessibles, etudiantsDuCours } from "../acces";
import { compterMessagesNonLus } from "../messages-outils";
import { annoncesPour, extrait } from "./annonces";
import { elementsAgenda, debutSemaine, numeroSemaine, jourFr, heureFr } from "./agenda";
import {
  cours,
  coursClasses,
  classes,
  lecons,
  progressions,
  seances,
  devoirs,
  rendus,
  tentativesQuiz,
  messages,
  conversations,
  participants,
  questionsLive,
  sites,
  utilisateurs,
  type Utilisateur,
  type Seance,
  type ElementAFaire,
  type AccueilEtudiant,
  type AccueilFormateur,
  type CoursAccueil,
  type SeanceFormateur,
  type AnnonceResume,
} from "@shared/schema";

const MINUTE = 60_000;
const HEURE = 60 * MINUTE;
const JOUR = 24 * HEURE;

/** Salutation selon l'heure d'Abidjan (= heure UTC). */
const salutationPour = (d: Date) => {
  const h = d.getUTCHours();
  return h < 5 || h >= 18 ? "Bonsoir" : "Bonjour";
};

const formatJourSemaine = new Intl.DateTimeFormat("fr-FR", { weekday: "long", timeZone: "Africa/Abidjan" });

/** « aujourd'hui », « demain », « jeudi », « jeudi 9 octobre » (jours à Abidjan). */
function quand(d: Date, maintenant: Date): string {
  const ecart = Math.floor(d.getTime() / JOUR) - Math.floor(maintenant.getTime() / JOUR);
  if (ecart === 0) return "aujourd'hui";
  if (ecart === 1) return "demain";
  if (ecart === -1) return "hier";
  if (ecart > 1 && ecart < 7) return formatJourSemaine.format(d);
  return jourFr(d);
}

/** « Lyon, France » → « Lyon ». */
const ville = (localisation: string | null) => localisation?.split(",")[0]?.trim() || null;

/** Nom de classe sans le campus en suffixe (« BTS … · 1re année · Yopougon » → « BTS … · 1re année »). */
function classeSansSite(nomClasse: string, nomSite: string | null) {
  if (!nomSite) return nomClasse;
  return nomClasse.replace(new RegExp(`\\s*·\\s*${nomSite.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`), "");
}

/** Ordre de priorité de la carte « À faire maintenant ». */
// Un live dans plus de 2 h n'est jamais « à faire maintenant » (le bandeau du
// prochain live s'en charge) : il ne sert qu'aux lignes « Ensuite ».
const RANGS: Record<ElementAFaire["type"], number> = {
  live: 1,
  devoir_urgent: 2,
  live_bientot: 3,
  message: 4,
  devoir_retard: 5,
  devoir: 6,
  live_prevu: 7,
  a_jour: 9,
};

type Candidat = ElementAFaire & { rang: number; t: number };

const A_JOUR: ElementAFaire = {
  type: "a_jour",
  titre: "Tu es à jour.",
  detail: "Aucun devoir à rendre et aucun live en ce moment. Profite de ce calme pour avancer dans une leçon.",
  lien: "/cours",
  bouton: "Continuer mes cours",
  urgence: "aucune",
};

/** Devoirs publiés et ouverts des cours de l'étudiant, avec ce qu'il en a fait (SES rendus seulement). */
async function devoirsDeLEtudiant(u: Utilisateur, coursIds: number[], maintenant: Date) {
  if (!coursIds.length) return [];
  const liste = await db
    .select({ d: devoirs, code: cours.code, couleur: cours.couleur })
    .from(devoirs)
    .innerJoin(cours, eq(cours.id, devoirs.coursId))
    .where(
      and(
        inArray(devoirs.coursId, coursIds),
        eq(devoirs.publie, true),
        or(isNull(devoirs.ouvertureLe), lte(devoirs.ouvertureLe, maintenant)),
        gte(devoirs.dateLimite, new Date(maintenant.getTime() - 7 * JOUR)),
      ),
    )
    .orderBy(asc(devoirs.dateLimite));
  if (!liste.length) return [];
  const ids = liste.map((l) => l.d.id);
  const faits = new Set<number>();
  const mesRendus = await db
    .select({ devoirId: rendus.devoirId, statut: rendus.statut })
    .from(rendus)
    .where(and(eq(rendus.etudiantId, u.id), inArray(rendus.devoirId, ids)));
  for (const r of mesRendus) if (r.statut !== "brouillon") faits.add(r.devoirId);
  const mesQuiz = await db
    .select({ devoirId: tentativesQuiz.devoirId })
    .from(tentativesQuiz)
    .where(and(eq(tentativesQuiz.etudiantId, u.id), inArray(tentativesQuiz.devoirId, ids), isNotNull(tentativesQuiz.finLe)));
  for (const q of mesQuiz) faits.add(q.devoirId);
  return liste.map((l) => ({ ...l, fait: faits.has(l.d.id) }));
}

/** Messages non lus écrits par un formateur dans les conversations de l'étudiant. */
async function messagesDeFormateurs(u: Utilisateur) {
  return db
    .select({
      id: messages.id,
      texte: messages.texte,
      fichierId: messages.fichierId,
      creeLe: messages.creeLe,
      conversationId: messages.conversationId,
      prenom: utilisateurs.prenom,
      nom: utilisateurs.nom,
    })
    .from(messages)
    .innerJoin(participants, and(eq(participants.conversationId, messages.conversationId), eq(participants.utilisateurId, u.id)))
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .innerJoin(utilisateurs, eq(utilisateurs.id, messages.auteurId))
    .where(
      and(
        eq(utilisateurs.role, "formateur"),
        ne(messages.auteurId, u.id),
        eq(messages.supprime, false),
        eq(participants.sourdine, false),
        or(isNull(participants.luJusquA), sql`${messages.creeLe} > ${participants.luJusquA}`),
      ),
    )
    .orderBy(desc(messages.creeLe))
    .limit(20);
}

export function enregistrerAccueil(app: Express) {
  // ── Étudiant ─────────────────────────────────────────────────────────────
  app.get(
    "/api/accueil",
    exigerRole("etudiant"),
    route(async (req, res) => {
      const u = moi(req);
      const maintenant = new Date();
      const t0 = maintenant.getTime();
      const coursIds = await idsCoursAccessibles(u);

      // Contexte : « Campus Yopougon · BTS Gestion commerciale · 1re année ».
      const [site] = u.siteId ? await db.select({ nom: sites.nomCourt }).from(sites).where(eq(sites.id, u.siteId)) : [];
      const [classe] = u.classeId ? await db.select({ nom: classes.nom }).from(classes).where(eq(classes.id, u.classeId)) : [];
      const contexte = [site ? `Campus ${site.nom}` : null, classe ? classeSansSite(classe.nom, site?.nom ?? null) : null].filter(Boolean).join(" · ");

      // Séances : en direct, ou planifiées de « il y a 30 min » (formateur en retard) à dans 14 jours.
      const lives = coursIds.length
        ? await db
            .select({
              s: seances,
              code: cours.code,
              couleur: cours.couleur,
              prenom: utilisateurs.prenom,
              nom: utilisateurs.nom,
              localisation: utilisateurs.localisation,
            })
            .from(seances)
            .innerJoin(cours, eq(cours.id, seances.coursId))
            .leftJoin(utilisateurs, eq(utilisateurs.id, cours.formateurId))
            .where(
              and(
                inArray(seances.coursId, coursIds),
                or(
                  eq(seances.statut, "en_direct"),
                  and(eq(seances.statut, "planifiee"), gte(seances.debut, new Date(t0 - 30 * MINUTE)), lte(seances.debut, new Date(t0 + 14 * JOUR))),
                ),
              ),
            )
            .orderBy(asc(seances.debut))
        : [];

      const [listeDevoirs, messagesProfs] = await Promise.all([devoirsDeLEtudiant(u, coursIds, maintenant), messagesDeFormateurs(u)]);

      const candidats: Candidat[] = [];
      const ajouter = (e: ElementAFaire, t: number) => candidats.push({ ...e, rang: RANGS[e.type], t });

      for (const { s, code, couleur, prenom, nom, localisation } of lives) {
        const formateur = prenom ? `${prenom} ${nom}${ville(localisation) ? ` depuis ${ville(localisation)}` : ""}` : null;
        if (s.statut === "en_direct") {
          ajouter(
            {
              type: "live",
              titre: s.titre,
              detail: formateur ? `La classe est ouverte, avec ${formateur}.` : "La classe est ouverte.",
              lien: `/live/${s.id}`,
              bouton: "Rejoindre le live",
              urgence: "haute",
              quand: (s.demarreeLe ?? s.debut).toISOString(),
              coursCode: code,
              couleur,
            },
            s.debut.getTime(),
          );
          continue;
        }
        const dans = s.debut.getTime() - t0;
        const bientot = dans < 2 * HEURE;
        ajouter(
          {
            type: bientot ? "live_bientot" : "live_prevu",
            titre: s.titre,
            detail:
              dans <= 0
                ? "Le formateur ouvre la classe dans un instant."
                : `En direct ${quand(s.debut, maintenant)} à ${heureFr(s.debut)}${formateur ? ` avec ${formateur}` : ""}.`,
            lien: `/live/${s.id}`,
            bouton: bientot ? "Entrer dans la classe" : "Voir le live",
            urgence: bientot ? "moyenne" : "basse",
            quand: s.debut.toISOString(),
            coursCode: code,
            couleur,
          },
          s.debut.getTime(),
        );
      }

      for (const { d, code, couleur, fait } of listeDevoirs) {
        if (fait) continue;
        const reste = d.dateLimite.getTime() - t0;
        if (reste < 0 && !d.accepteRetard) continue;
        const estQuiz = d.type === "quiz";
        const lien = estQuiz ? `/quiz/${d.id}` : `/devoirs/${d.id}`;
        const echeance = `${quand(d.dateLimite, maintenant)} avant ${heureFr(d.dateLimite)}`;
        if (reste < 0) {
          ajouter(
            {
              type: "devoir_retard",
              titre: d.titre,
              detail: `Date limite dépassée (${echeance}). Tu peux encore le rendre, en retard.`,
              lien,
              bouton: estQuiz ? "Faire l'interrogation" : "Rendre mon devoir",
              urgence: "moyenne",
              quand: d.dateLimite.toISOString(),
              coursCode: code,
              couleur,
            },
            d.dateLimite.getTime(),
          );
        } else {
          const urgent = reste <= JOUR;
          ajouter(
            {
              type: urgent ? "devoir_urgent" : "devoir",
              titre: d.titre,
              detail: `${estQuiz ? "Interrogation à faire" : "À rendre"} ${echeance}.`,
              lien,
              bouton: urgent ? (estQuiz ? "Commencer l'interrogation" : "Rendre mon devoir") : "Voir le devoir",
              urgence: urgent ? "haute" : "basse",
              quand: d.dateLimite.toISOString(),
              coursCode: code,
              couleur,
            },
            d.dateLimite.getTime(),
          );
        }
      }

      if (messagesProfs.length) {
        const dernier = messagesProfs[0];
        const auteurs = new Set(messagesProfs.map((m) => `${m.prenom} ${m.nom}`));
        const apercu = dernier.texte.trim() ? extrait(dernier.texte, 90) : "Photo ou fichier joint";
        ajouter(
          {
            type: "message",
            titre: messagesProfs.length === 1 ? `Message de ${dernier.prenom} ${dernier.nom}` : `${messagesProfs.length} messages de ${auteurs.size > 1 ? "tes formateurs" : `${dernier.prenom} ${dernier.nom}`}`,
            detail: messagesProfs.length === 1 ? apercu : `${dernier.prenom} ${dernier.nom} : ${apercu}`,
            lien: auteurs.size > 1 ? "/messages" : `/messages/${dernier.conversationId}`,
            bouton: messagesProfs.length === 1 ? "Lire le message" : "Lire les messages",
            urgence: "moyenne",
            quand: dernier.creeLe.toISOString(),
          },
          dernier.creeLe.getTime(),
        );
      }

      // Priorité d'abord, puis le plus proche dans le temps.
      candidats.sort((a, b) => a.rang - b.rang || a.t - b.t);
      const premier = candidats.find((c) => c.rang <= RANGS.devoir);
      // À jour : on dit tout de même quand est le prochain rendez-vous (« Prochain live : lundi à 09h00 »).
      const prochainLive = candidats.find((c) => c.type === "live_prevu");
      const aFaire: ElementAFaire = premier
        ? sansRang(premier)
        : prochainLive?.quand
          ? {
              ...A_JOUR,
              detail: `Prochain rendez-vous : ${prochainLive.coursCode} en direct ${quand(new Date(prochainLive.quand), maintenant)} à ${heureFr(new Date(prochainLive.quand))}. D'ici là, avance dans une leçon.`,
            }
          : A_JOUR;
      // « Ensuite » : l'urgent restant, puis ce qui vient, dans l'ordre du temps.
      const suite = candidats
        .filter((c) => c !== premier)
        .sort((a, b) => Math.min(a.rang, 6) - Math.min(b.rang, 6) || a.t - b.t)
        .slice(0, 3)
        .map(sansRang);

      // Mes cours et ma progression.
      const listeCours = coursIds.length
        ? await db
            .select({ id: cours.id, code: cours.code, titre: cours.titre, couleur: cours.couleur, prenom: utilisateurs.prenom, nom: utilisateurs.nom })
            .from(cours)
            .leftJoin(utilisateurs, eq(utilisateurs.id, cours.formateurId))
            .where(inArray(cours.id, coursIds))
            .orderBy(asc(cours.code))
        : [];
      const totaux = coursIds.length
        ? await db
            .select({ coursId: lecons.coursId, n: sql<number>`count(*)::int` })
            .from(lecons)
            .where(and(inArray(lecons.coursId, coursIds), eq(lecons.publiee, true)))
            .groupBy(lecons.coursId)
        : [];
      const terminees = coursIds.length
        ? await db
            .select({ coursId: lecons.coursId, n: sql<number>`count(*)::int` })
            .from(progressions)
            .innerJoin(lecons, eq(lecons.id, progressions.leconId))
            .where(and(eq(progressions.utilisateurId, u.id), inArray(lecons.coursId, coursIds), eq(lecons.publiee, true)))
            .groupBy(lecons.coursId)
        : [];
      const totalDe = new Map(totaux.map((t) => [t.coursId, t.n]));
      const faitDe = new Map(terminees.map((t) => [t.coursId, t.n]));
      const prochaineDe = new Map<number, Seance>();
      for (const { s } of lives) if (!prochaineDe.has(s.coursId)) prochaineDe.set(s.coursId, s);
      const mesCours: CoursAccueil[] = listeCours.map((c) => {
        const total = totalDe.get(c.id) ?? 0;
        const fait = faitDe.get(c.id) ?? 0;
        const p = prochaineDe.get(c.id);
        return {
          id: c.id,
          code: c.code,
          titre: c.titre,
          couleur: c.couleur,
          progression: total ? Math.round((fait / total) * 100) : 0,
          leconsTerminees: fait,
          leconsTotal: total,
          formateur: c.prenom ? `${c.prenom} ${c.nom}` : null,
          prochaineSeance: p ? { id: p.id, titre: p.titre, debut: p.debut.toISOString(), statut: p.statut } : null,
        };
      });

      // Annonce importante : la première importante non lue, sinon la dernière épinglée.
      const annoncesEnLigne = await annoncesPour(u);
      const nonLue = (l: (typeof annoncesEnLigne)[number]) => !l.luLe && l.annonce.auteurId !== u.id;
      const choisie = annoncesEnLigne.find((l) => l.annonce.importante && nonLue(l)) ?? annoncesEnLigne.find((l) => l.annonce.epinglee);
      const annonceImportante: AnnonceResume | null = choisie
        ? {
            id: choisie.annonce.id,
            titre: choisie.annonce.titre,
            extrait: extrait(choisie.annonce.corps, 140),
            importante: choisie.annonce.importante,
            epinglee: choisie.annonce.epinglee,
            lue: Boolean(choisie.luLe),
            publieeLe: choisie.annonce.publieeLe.toISOString(),
            auteur: `${choisie.auteur.prenom} ${choisie.auteur.nom}`,
          }
        : null;

      // Ma semaine en chiffres (lundi → dimanche).
      const lundi = debutSemaine(maintenant).getTime();
      const dansLaSemaine = (d: Date) => d.getTime() >= lundi && d.getTime() < lundi + 7 * JOUR;
      const livesSemaine = coursIds.length
        ? await db
            .select({ n: sql<number>`count(*)::int` })
            .from(seances)
            .where(
              and(
                inArray(seances.coursId, coursIds),
                ne(seances.statut, "annulee"),
                gte(seances.debut, new Date(lundi)),
                lt(seances.debut, new Date(lundi + 7 * JOUR)),
              ),
            )
        : [{ n: 0 }];

      const reponse: AccueilEtudiant = {
        salutation: salutationPour(maintenant),
        prenom: u.prenom,
        contexte,
        aFaire,
        prochains: suite,
        cours: mesCours,
        annonceImportante,
        annoncesNonLues: annoncesEnLigne.filter(nonLue).length,
        semaine: {
          numero: numeroSemaine(maintenant),
          lives: livesSemaine[0]?.n ?? 0,
          devoirs: listeDevoirs.filter((l) => !l.fait && dansLaSemaine(l.d.dateLimite)).length,
        },
      };
      res.json(reponse);
    }),
  );

  // ── Formateur ────────────────────────────────────────────────────────────
  app.get(
    "/api/accueil/formateur",
    exigerRole("formateur"),
    route(async (req, res) => {
      const u = moi(req);
      const maintenant = new Date();
      const t0 = maintenant.getTime();
      const coursIds = await idsCoursAccessibles(u);

      const versSeance = (s: Seance, code: string, titreCours: string): SeanceFormateur => ({
        id: s.id,
        titre: s.titre,
        coursId: s.coursId,
        coursCode: code,
        coursTitre: titreCours,
        debut: s.debut.toISOString(),
        dureeMinutes: s.dureeMinutes,
        statut: s.statut,
        lienStudio: `/live/${s.id}`,
        lienPreparation: `/enseigner/seances/${s.id}`,
        lienAgenda: `/api/agenda/seances/${s.id}.ics`,
        preparation: { plan: s.plan.length, diapos: s.diapos.length, description: Boolean(s.description.trim()) },
      });

      const seancesUtiles = coursIds.length
        ? await db
            .select({ s: seances, code: cours.code, titre: cours.titre })
            .from(seances)
            .innerJoin(cours, eq(cours.id, seances.coursId))
            .where(
              and(
                inArray(seances.coursId, coursIds),
                or(eq(seances.statut, "en_direct"), and(eq(seances.statut, "planifiee"), gte(seances.debut, new Date(t0 - HEURE)))),
              ),
            )
            .orderBy(asc(seances.debut))
        : [];
      const direct = seancesUtiles.find((l) => l.s.statut === "en_direct");
      const prochaine = seancesUtiles.find((l) => l.s.statut === "planifiee");

      // Copies rendues pas encore publiées, regroupées par devoir (les plus anciennes d'abord) :
      // à corriger (sans note) et à publier (note posée, même règle que le module évaluations).
      const copies = coursIds.length
        ? await db
            .select({
              devoirId: devoirs.id,
              titre: devoirs.titre,
              coursCode: cours.code,
              nombre: sql<number>`count(*) filter (where ${rendus.note} is null)::int`,
              enRetard: sql<number>`count(*) filter (where ${rendus.note} is null and ${rendus.enRetard})::int`,
              aPublier: sql<number>`count(*) filter (where ${rendus.note} is not null)::int`,
              plusAncienne: sql<string | null>`min(${rendus.renduLe}) filter (where ${rendus.note} is null)`,
            })
            .from(rendus)
            .innerJoin(devoirs, eq(devoirs.id, rendus.devoirId))
            .innerJoin(cours, eq(cours.id, devoirs.coursId))
            .where(and(inArray(devoirs.coursId, coursIds), eq(rendus.statut, "rendu")))
            .groupBy(devoirs.id, devoirs.titre, cours.code)
            .orderBy(sql`min(${rendus.renduLe}) filter (where ${rendus.note} is null) asc nulls last`)
        : [];

      // Questions du dernier live terminé, restées sans réponse (signées par campus, jamais par un nom).
      const [dernier] = coursIds.length
        ? await db
            .select({ s: seances, code: cours.code })
            .from(seances)
            .innerJoin(cours, eq(cours.id, seances.coursId))
            .where(and(inArray(seances.coursId, coursIds), eq(seances.statut, "terminee")))
            .orderBy(desc(sql`coalesce(${seances.termineeLe}, ${seances.debut})`))
            .limit(1)
        : [];
      let questions: AccueilFormateur["questions"] = null;
      if (dernier) {
        const enSuspens = and(eq(questionsLive.seanceId, dernier.s.id), eq(questionsLive.repondue, false), eq(questionsLive.masquee, false));
        const liste = await db
          .select({ id: questionsLive.id, texte: questionsLive.texte, votes: questionsLive.votes, site: sites.nomCourt })
          .from(questionsLive)
          .leftJoin(sites, eq(sites.id, questionsLive.siteId))
          .where(enSuspens)
          .orderBy(desc(questionsLive.votes), asc(questionsLive.creeLe))
          .limit(5);
        const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(questionsLive).where(enSuspens);
        questions = {
          seanceId: dernier.s.id,
          seanceTitre: dernier.s.titre,
          coursCode: dernier.code,
          termineeLe: (dernier.s.termineeLe ?? dernier.s.debut).toISOString(),
          lien: `/enseigner/seances/${dernier.s.id}`,
          liste: liste.map((q) => ({ id: q.id, texte: q.texte, votes: q.votes, site: q.site })),
          total: n,
        };
      }

      // Mes cours : effectif, campus, prochaine séance.
      const listeCours = coursIds.length
        ? await db
            .select({ id: cours.id, code: cours.code, titre: cours.titre, couleur: cours.couleur, statut: cours.statut })
            .from(cours)
            .where(inArray(cours.id, coursIds))
            .orderBy(asc(cours.code))
        : [];
      const campusDe = coursIds.length
        ? await db
            .select({ coursId: coursClasses.coursId, n: sql<number>`count(distinct ${classes.siteId})::int` })
            .from(coursClasses)
            .innerJoin(classes, eq(classes.id, coursClasses.classeId))
            .where(inArray(coursClasses.coursId, coursIds))
            .groupBy(coursClasses.coursId)
        : [];
      const nbCampus = new Map(campusDe.map((c) => [c.coursId, c.n]));
      const mesCours = await Promise.all(
        listeCours.map(async (c) => {
          const p = seancesUtiles.find((l) => l.s.coursId === c.id);
          return {
            ...c,
            etudiants: (await etudiantsDuCours(c.id)).length,
            campus: nbCampus.get(c.id) ?? 0,
            prochaineSeance: p ? { id: p.s.id, debut: p.s.debut.toISOString(), statut: p.s.statut } : null,
          };
        }),
      );

      const [messagesNonLus, semaine, annoncesEnLigne] = await Promise.all([
        compterMessagesNonLus(u).catch(() => 0),
        elementsAgenda(u, maintenant, new Date(t0 + 7 * JOUR)),
        annoncesPour(u),
      ]);

      const reponse: AccueilFormateur = {
        salutation: salutationPour(maintenant),
        prenom: u.prenom,
        localisation: u.localisation,
        enDirect: direct ? versSeance(direct.s, direct.code, direct.titre) : null,
        prochaineSeance: prochaine ? versSeance(prochaine.s, prochaine.code, prochaine.titre) : null,
        copies: copies.map((c) => ({
          ...c,
          plusAncienne: c.plusAncienne ? new Date(c.plusAncienne).toISOString() : null,
          lien: `/enseigner/devoirs/${c.devoirId}/copies`,
        })),
        totalCopies: copies.reduce((s, c) => s + c.nombre, 0),
        totalAPublier: copies.reduce((s, c) => s + c.aPublier, 0),
        questions,
        cours: mesCours,
        messagesNonLus,
        annoncesNonLues: annoncesEnLigne.filter((l) => !l.luLe && l.annonce.auteurId !== u.id).length,
        semaine: semaine.filter((e) => e.statut !== "annulee").slice(0, 8),
      };
      res.json(reponse);
    }),
  );
}

function sansRang({ rang: _r, t: _t, ...e }: Candidat): ElementAFaire {
  return e;
}
