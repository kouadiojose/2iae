// Textes de la correction automatique côté étudiant (chantier K4, décision de José du 8 octobre 2026) :
// la copie corrigée par le campus après la date limite (sa note arrive le soir qui suit ; une copie rendue
// en retard est corrigée tout de suite), la note « Corrigé par le campus » critère par critère, la demande
// de relecture et sa réponse, le corrigé après la date limite, le conseil de la zone de dépôt (des photos
// nettes ou un PDF : une vidéo, un son ou un fichier que le campus ne lit pas fait relire la copie par le
// formateur).
// Étudiants tutoyés : ces écrans ne s'adressent qu'à eux. Couche commune : shared/textes/index.ts ;
// règles et types : shared/engagement/corrections.ts.
import { creerTextes, type Dictionnaire } from "./index";

const FR = {
  // ── Après le dépôt : où en est la correction par le campus ─────────────────
  // Copie rendue avant la date limite : le campus la corrige après (le soir qui suit, attendueLe du serveur).
  "campus.apresLimite": "Le campus corrige ta copie après la date limite : ta note arrive {quand}.",
  "campus.apresLimite.bientot": "Le campus corrige ta copie après la date limite : ta note arrive le soir qui suit.",
  // Copie rendue après la date limite (retard accepté), ou date limite passée : elle est corrigée tout de suite.
  "campus.enFile": "Le campus corrige ta copie : ta note arrive {quand}.",
  "campus.enFile.bientot": "Le campus corrige ta copie : ta note arrive bientôt.",
  "campus.enFile.detail": "Tu auras ta note critère par critère, avec des conseils pour progresser.",
  "campus.remplacer": "Tu peux remplacer ta copie jusqu'à la date limite.",
  "campus.illisible.titre": "Ta copie est difficile à lire",
  "campus.illisible.texte": "Remplace-la par une photo nette : une page par photo, à plat, bien éclairée, sans ombre.",
  "campus.illisible.bouton": "Envoyer une photo nette",
  "campus.video": "Ta vidéo sera regardée par ton formateur.",
  "campus.son": "Ton enregistrement sera écouté par ton formateur.",
  "campus.formateur": "Ton formateur va regarder ta copie.",
  "campus.formateur.detail": "Ta note arrivera ici dès qu'il l'aura corrigée.",

  // ── « ce soir », « demain soir »… (heure d'Abidjan) ────────────────────────
  "quand.bientot": "très bientôt",
  "quand.ceSoir": "ce soir",
  "quand.aujourdhui": "aujourd'hui",
  "quand.demainSoir": "demain soir",
  "quand.demain": "demain",
  "quand.jourSoir": "{jour} soir",
  "quand.jour": "{jour}",
  "quand.date": "le {date}",
  "quand.dateSoir": "le {date} au soir",

  // ── La note du campus ──────────────────────────────────────────────────────
  "note.parCampus": "Corrigé par le campus",
  "note.parCampus.detail": "Noté avec le corrigé du devoir. Ta note compte comme les autres.",
  "note.criteres": "Critère par critère",
  "note.recorrection": "Le corrigé du devoir a été précisé : le campus relit ta copie et met ta note à jour {quand}.",

  // ── Demande de relecture ───────────────────────────────────────────────────
  "relecture.question": "Tu penses qu'une erreur s'est glissée dans ta note ?",
  "relecture.bouton": "Demander une relecture",
  "relecture.titre": "Demander une relecture",
  "relecture.description": "Ton formateur relira ta copie et te répondra ici. Dis-lui précisément ce qui te semble faux.",
  "relecture.libelle": "Ce qui te semble faux",
  "relecture.placeholder": "Exemple : ma réponse sur la démarche est en page 3, elle n'a pas été comptée.",
  "relecture.pourCommencer": "Pour commencer :",
  "relecture.suggestion.page": "Une page n'a pas été lue",
  "relecture.suggestion.page.texte": "Une page de ma copie n'a pas été lue : ",
  "relecture.trop.court": "Encore {n} caractères au moins.",
  "relecture.compteur": "{n}/{max}",
  "relecture.envoyer": "Envoyer ma demande",
  "relecture.annuler": "Annuler",
  "relecture.envoyee": "Demande envoyée : ton formateur va relire ta copie.",
  "relecture.ouverte.titre": "Relecture demandée",
  "relecture.ouverte.texte": "Ton formateur va relire ta copie. Sa réponse s'affichera ici.",
  "relecture.ouverte.le": "Demandée {quand}",
  "relecture.tonMotif": "Ta demande",
  "relecture.traitee.titre": "Ton formateur a relu ta copie",
  "relecture.noteChangee": "Ta note passe de {avant} à {apres}/{bareme}.",
  "relecture.noteGardee": "Ta note reste {note}/{bareme}.",

  // ── Le corrigé, après la date limite ───────────────────────────────────────
  "corrige.titre": "Le corrigé",
  "corrige.texte": "Compare-le avec ta copie : c'est la meilleure façon de progresser.",
  "corrige.voir": "Voir le corrigé",
  "corrige.cacher": "Cacher le corrigé",

  // ── Zone de dépôt ──────────────────────────────────────────────────────────
  // Devoir corrigé par le campus : il lit les photos et les PDF ; le reste (vidéo, son, Word…) va au formateur.
  "depot.intro.campus": "Photographie ton cahier page par page, ajoute un PDF ou écris ta réponse.",
  "conseil.depot": "Le campus corrige ta copie après la date limite, avec le corrigé de ton formateur. Pour qu'il la lise bien : des photos nettes (une page par photo) ou un PDF.",
  "conseil.depot.formateur": "Une vidéo, un son ou un autre fichier (Word, Excel…) : c'est ton formateur qui corrigera ta copie, et ta note arrivera plus tard.",
  "conseil.depot.joint": "Ta copie contient une vidéo, un son ou un fichier que le campus ne lit pas : c'est ton formateur qui la corrigera. Pour une note plus rapide, envoie des photos nettes ou un PDF.",

  // ── Listes ───────────────────────────────────────────────────────────
  "notes.campus": "corrigé par le campus",
  "notes.sousTitre": "Moyennes sur 20, pondérées par les coefficients. Seules les notes publiées comptent.",
  "notes.fausse": "Une note te semble fausse ? Ouvre le devoir : tu peux demander une relecture ou écrire à ton formateur.",
  "devoirs.corriges.vide": "Quand une note est publiée, tu la retrouves ici avec son commentaire.",
} satisfies Dictionnaire;

export const t = creerTextes(FR);
export type CleCorrectionsEtudiant = keyof typeof FR;
