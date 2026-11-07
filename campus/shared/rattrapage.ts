// Séances de rattrapage proposées par le formateur (« Proposer un rattrapage ») : une séance de nature
// 'rattrapage' sur le même cours (shared/schema/live.ts), donc la même classe en direct, le même replay et la même
// transcription. Ouverte à tous les étudiants du cours, facultative : jamais comptée comme une absence.
// Textes des avis aux étudiants (tutoyés). Heure d'Abidjan (GMT = UTC).

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** Durée proposée par défaut dans le formulaire. */
export const DUREE_RATTRAPAGE_DEFAUT = 60;

/** « jeudi 13 novembre à 18 h 00 » (heure d'Abidjan). */
export function quandRattrapage(debut: Date): string {
  const h = String(debut.getUTCHours()).padStart(2, "0");
  const m = String(debut.getUTCMinutes()).padStart(2, "0");
  return `${JOURS[debut.getUTCDay()]} ${debut.getUTCDate()} ${MOIS[debut.getUTCMonth()]} à ${h} h ${m}`;
}

/** « jeudi 13 novembre » (heure d'Abidjan), pour nommer la séance rattrapée. */
export function jourRattrapage(debut: Date): string {
  return `${JOURS[debut.getUTCDay()]} ${debut.getUTCDate()} ${MOIS[debut.getUTCMonth()]}`;
}

/** Titre de la séance créée : « Rattrapage : {sujet} » (160 caractères au plus). */
export function titreRattrapage(sujet: string): string {
  return `Rattrapage : ${sujet.trim()}`.slice(0, 160);
}

/**
 * Avis aux étudiants du cours. Pour celui qui était absent à la séance rattrapée, un message plus appuyé.
 * Exemple : « Rattrapage avec Awa Koné jeudi 13 novembre à 18 h 00 : les bilans. »
 */
export function avisRattrapage(o: { prof: string | null; debut: Date; sujet: string; absentLe?: Date | null }): { titre: string; corps: string } {
  const sujet = o.sujet.trim().replace(/[.!?\s]+$/, "");
  const avec = o.prof ? ` avec ${o.prof}` : "";
  const phrase = `Rattrapage${avec} ${quandRattrapage(o.debut)} : ${sujet}.`;
  if (o.absentLe) {
    return {
      titre: "Un rattrapage pour toi",
      corps: `Tu as manqué la séance du ${jourRattrapage(o.absentLe)}. ${phrase} Viens, il est fait pour toi : c'est facultatif, mais c'est le moment de rattraper.`,
    };
  }
  return { titre: "Séance de rattrapage", corps: `${phrase} Facultatif, ouvert à tous les étudiants du cours.` };
}
