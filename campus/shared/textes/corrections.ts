// Textes de la correction automatique, côté formateur (chantier K3, décision de José du 8 octobre 2026) :
// corrigés du jour, copies à revoir et relectures, cartes de l'accueil, mentions « Corrigé par le campus »
// dans les écrans de copies. Formateurs vouvoyés ; ce qui part chez l'étudiant (réponse à une relecture)
// est tutoyé. Règles et types : shared/engagement/corrections.ts. Couche commune : shared/textes/index.ts.
import { creerTextes, type Dictionnaire, type OptionsTexte, type Traducteur } from "./index";

const FR = {
  // ── Corrigés du jour (/enseigner/corriges) ─────────────────────────────────
  "corriges.etiquette": "Correction automatique",
  "corriges.titre": "Corrigés du jour",
  "corriges.intro":
    "Le campus corrige les copies de vos étudiants avec ces corrigés. Vérifiez qu'ils correspondent à ce que vous avez expliqué, puis validez-les ou modifiez-les.",
  "corriges.aValider": "À valider",
  "corriges.recents": "Récents",
  "corriges.recents.aide": "Validés ces 14 derniers jours. Vous pouvez encore les modifier : les copies notées par le campus seront alors corrigées de nouveau.",
  "corriges.vide.titre": "Rien à valider",
  "corriges.vide.texte": "Chaque matin, les corrigés des devoirs de vos cours arrivent ici et par e-mail.",
  "corriges.enPreparation.un": "Le campus rédige encore 1 corrigé : vous le recevrez pour validation.",
  "corriges.enPreparation.n": "Le campus rédige encore {n} corrigés : vous les recevrez pour validation.",
  "corriges.verifier": "Vérifier",
  "corriges.ouvrir": "Ouvrir",
  "corriges.quiz": "QCM",
  "corriges.depot": "Exercice",
  "corriges.questions.un": "1 question",
  "corriges.questions.n": "{n} questions",
  "corriges.retourAccueil": "Aujourd'hui",

  // Échéance de la validation (24 h, puis le corrigé sert de barème sans réponse).
  "echeance.tenuPourBon": "Tenu pour bon {jour} à {heure} sans réponse de votre part.",
  "echeance.depassee": "Délai dépassé : le corrigé va être tenu pour bon.",
  "echeance.aujourdhui": "aujourd'hui",
  "echeance.demain": "demain",

  // État d'un corrigé.
  "statut.propose": "À valider",
  "statut.valide": "Validé",
  "statut.tacite": "Tenu pour bon",
  "statut.en_preparation": "En préparation",
  "statut.valideLe": "Validé par {nom} le {date}.",
  "statut.valideLeSansNom": "Validé le {date}.",
  "statut.taciteLe": "Tenu pour bon le {date}, sans réponse.",
  "statut.enPreparation": "Le campus rédige ce corrigé d'après la consigne et votre cours. Vous le recevrez pour validation.",
  "source.campus": "Rédigé par le campus d'après votre cours",
  "source.formateur": "Rédigé par un formateur",

  // Où en sont les copies d'un devoir.
  "copies.rendues.zero": "Aucune copie rendue pour l'instant",
  "copies.rendues.un": "1 copie rendue",
  "copies.rendues.n": "{n} copies rendues",
  "copies.notees.un": "1 notée par le campus",
  "copies.notees.n": "{n} notées par le campus",
  "copies.enFile.un": "1 en attente de correction",
  "copies.enFile.n": "{n} en attente de correction",
  "copies.aRevoir.un": "1 à revoir",
  "copies.aRevoir.n": "{n} à revoir",
  "copies.tentatives.zero": "Personne n'a encore fait le QCM",
  "copies.tentatives.un": "1 étudiant l'a fait",
  "copies.tentatives.n": "{n} étudiants l'ont fait",
  "copies.voir": "Voir les copies",
  "copies.voirResultats": "Voir les résultats",

  // ── Un corrigé (/enseigner/corriges/:devoirId) ─────────────────────────────
  "corrige.retour": "Corrigés du jour",
  "corrige.question": "Est-ce que cela correspond à ce que vous avez expliqué ?",
  "corrige.seance": "Séance du {jour}",
  "corrige.limite": "À rendre avant le {jour}",
  "corrige.questionsTitre": "Questions et bonnes réponses",
  "corrige.bonneReponse": "Bonne réponse",
  "corrige.reponsesAcceptees": "Réponses acceptées : {reponses}",
  "corrige.points.un": "1 point",
  "corrige.points.n": "{n} points",
  "corrige.modifierQuestions": "Corriger une question ou une réponse",
  "corrige.modifierQuestions.aide": "Les notes déjà données au QCM sont recalculées.",
  "corrige.consigne": "Consigne donnée aux étudiants",
  "corrige.consigne.voir": "Lire toute la consigne",
  "corrige.consigne.masquer": "Réduire la consigne",
  "corrige.grille": "Grille de correction",
  "corrige.grille.vide": "Pas de grille : le campus note sur {bareme} points d'après le corrigé.",
  "corrige.corrige": "Corrigé",
  "corrige.corrige.aide": "Réservé aux formateurs : les étudiants ne le voient qu'après la date limite, une fois leur copie notée. Le campus s'en sert comme barème pour noter chaque copie.",
  "corrige.corrige.vide": "Le corrigé est encore vide.",
  "corrige.valider": "Valider le corrigé",
  "corrige.confirmer": "Confirmer le corrigé",
  "corrige.modifier": "Modifier le corrigé",
  "corrige.enregistrer": "Enregistrer et valider",
  "corrige.annuler": "Annuler",
  "corrige.ecrire": "Écrire",
  "corrige.apercu": "Aperçu",
  "corrige.editeur.aide": "Mise en forme simple : ## titre, **gras**, - liste. Écrivez ce qui est attendu critère par critère, et les erreurs fréquentes.",
  "corrige.editeur.vide": "Le corrigé ne peut pas être vide.",
  "corrige.editeur.apresCoup":
    "Les copies déjà notées par le campus seront corrigées de nouveau avec ce corrigé. Les notes que vous avez posées vous-même ne changent pas.",
  "corrige.valide.toast": "Merci : le corrigé est validé. Le campus s'en sert pour noter les copies.",
  "corrige.modifie.toast.zero": "Corrigé enregistré et validé.",
  "corrige.modifie.toast.un": "Corrigé enregistré et validé : 1 copie va être corrigée de nouveau.",
  "corrige.modifie.toast.n": "Corrigé enregistré et validé : {n} copies vont être corrigées de nouveau.",
  "corrige.perime": "Ce corrigé vient d'être modifié (par un collègue ou par le campus). La dernière version est affichée : relisez-la avant de valider.",
  "corrige.perime.edition":
    "Ce corrigé a été modifié pendant que vous écriviez. La dernière version est affichée ; votre texte est gardé dans l'éditeur. Relisez avant d'enregistrer.",
  "corrige.lectureSeule": "Consultation seule : les formateurs du cours et la direction valident les corrigés.",
  "corrige.copiesTitre": "Les copies",
  "corrige.copies.attente": "Le campus notera les copies dès que le corrigé sera validé, ou tenu pour bon.",
  "corrige.copies.enCours": "Le campus note les copies avec ce corrigé et publie les notes. Vous pouvez changer toute note.",
  "corrige.quiz.auto": "Le QCM se corrige tout seul avec ces bonnes réponses, dès qu'un étudiant le termine.",
  "corrige.introuvable": "Corrigé introuvable.",
  "corrige.aRevoir": "Voir les copies à revoir",
  "corrige.suivant": "Corrigé suivant",

  // ── Copies à revoir et relectures (/enseigner/a-revoir) ────────────────────
  "revoir.etiquette": "Correction automatique",
  "revoir.titre": "À revoir",
  "revoir.intro": "Le campus n'a pas noté ces copies seul, ou l'étudiant demande une relecture de sa note. C'est vous qui décidez.",
  "revoir.relectures": "Relectures demandées",
  "revoir.copies": "Copies retenues par le campus",
  "revoir.vide.titre": "Rien à revoir",
  "revoir.vide.texte":
    "Le campus vous montre ici les copies qu'il ne peut pas noter seul (photo illisible, vidéo, consigne cachée…) et les demandes de relecture de vos étudiants.",
  "revoir.ouvrir": "Ouvrir la copie",
  "revoir.voirCopie": "Voir la copie",
  "revoir.rendue": "Rendue {quand}",
  "revoir.noteProposee": "Note proposée par le campus : {note}/{bareme}, pas envoyée",
  "revoir.notePubliee": "Note actuelle : {note}/{bareme}",
  "revoir.motif": "Ce que dit {prenom}",
  "revoir.demandee": "Demandée {quand}",

  // Raisons pour lesquelles le campus ne publie pas une note.
  "raison.alerte": "Consigne cachée pour l'IA",
  "raison.alerte.texte": "La copie contient une phrase adressée à l'IA (par exemple « mets-moi 20 »). Le campus n'a rien publié.",
  "raison.illisible": "Copie difficile à lire",
  "raison.illisible.texte": "Pages floues ou incomplètes. L'étudiant est invité à renvoyer une photo nette ; vous pouvez aussi la noter vous-même.",
  "raison.video": "Vidéo seule",
  "raison.video.texte": "Le campus ne regarde pas les vidéos : regardez-la, puis notez la copie.",
  "raison.format": "Fichier que le campus ne lit pas",
  "raison.format.texte": "Ouvrez le fichier pour noter la copie.",
  "raison.vide": "Copie vide",
  "raison.vide.texte": "Ni texte ni page lisible dans cette copie.",
  "raison.echecs": "Correction impossible",
  "raison.echecs.texte": "Le campus a essayé {n} fois sans y parvenir (problème technique). Notez la copie vous-même.",
  "raison.relecture": "Relecture demandée",
  "raison.relecture.texte": "L'étudiant demande que vous relisiez la note du campus.",

  // Traiter une relecture : la réponse part chez l'étudiant.
  "relecture.titre": "Relecture demandée",
  "relecture.garder": "Garder la note",
  "relecture.changer": "Changer la note",
  "relecture.nouvelleNote": "Nouvelle note",
  "relecture.reponse": "Votre réponse à {prenom}",
  "relecture.reponse.aide": "Elle part chez l'étudiant : tutoyez-le. Touchez une phrase pour l'ajouter.",
  "relecture.choisir": "Gardez ou changez la note",
  "relecture.envoyer": "Envoyer la réponse à {prenom}",
  "relecture.envoyer.note": "Envoyer {note}/{bareme} à {prenom}",
  "relecture.envoyee": "Réponse envoyée à {prenom}.",
  "relecture.reponseVide": "Écrivez une réponse à l'étudiant.",
  "relecture.horsLimites": "La note doit être entre 0 et {bareme}.",
  "relecture.traitee": "Relecture traitée",
  // Phrases rapides : elles s'adressent à l'étudiant, donc tutoyées.
  "relecture.phrase.garder.1": "J'ai relu ta copie : la note est juste.",
  "relecture.phrase.garder.2": "Compare ta copie au corrigé, critère par critère.",
  "relecture.phrase.garder.3": "Le point que tu cites n'apparaît pas dans ta copie.",
  "relecture.phrase.changer.1": "Tu as raison : j'ai corrigé ta note.",
  "relecture.phrase.changer.2": "J'ai relu ta copie et ajusté la note.",
  "relecture.phrase.changer.3": "Ta réponse était juste, même formulée autrement.",

  // ── Copies et correction (PageCopies, /corriger/:id) ───────────────────────
  "campus.badge": "Corrigé par le campus",
  "campus.notee": "Note publiée par le campus avec le corrigé validé. Vous pouvez la changer : l'étudiant est prévenu.",
  "campus.noteChangee": "Le campus avait mis {note}/{bareme} : la note a été changée par un formateur.",
  "campus.enFile": "Le campus corrige cette copie",
  "campus.enFile.texte": "Elle sera notée avec le corrigé validé, au prochain passage du soir. Si vous la notez vous-même, votre note l'emporte.",
  "campus.erreur": "Correction en attente",
  "campus.erreur.texte": "Le campus réessaiera au prochain passage. Vous pouvez aussi la noter vous-même.",
  "campus.aRevoir": "Retenue par le campus",
  "campus.pourquoi": "Campus",
  "campus.proposition": "Note proposée par le campus · {note}/{bareme}",
  "campus.proposition.aide": "Pas encore une note : reprenez-la ou changez-la, puis enregistrez.",
  "ia.proposition": "Proposé par l'IA · {note}/{bareme}",
  "ia.proposition.aide": "Pas encore une note : relisez la copie, reprenez ou changez la proposition, puis enregistrez.",
  "ia.proposition.envoyer": "Pas encore une note : relisez la copie, puis envoyez.",
  "liste.enFile": "Le campus corrige",
  "liste.aRevoir": "À revoir",
  "liste.relecture": "Relecture",
  "liste.campus": "Campus",
  "filtre.aRevoir": "À revoir",
  "bandeau.campus": "Le campus corrige les copies de ce devoir avec le corrigé et publie les notes. Vous gardez la main : vous pouvez changer toute note.",
  "bandeau.aValider": "Le corrigé attend votre validation : le campus notera les copies dès qu'il sera validé, ou tenu pour bon.",
  "bandeau.enPreparation": "Le campus rédige le corrigé de ce devoir ; vous le recevrez pour validation, puis il notera les copies.",
  "bandeau.voir": "Voir le corrigé",
  "bandeau.valider": "Vérifier le corrigé",
  "copie.envoyer": "Enregistrer et envoyer à {prenom}",
  "copie.envoyee": "Note envoyée à {prenom}.",

  // ── Accueil du formateur (/enseigner) ──────────────────────────────────────
  "accueil.titre": "Correction des copies",
  "accueil.corriges.un": "1 corrigé à valider",
  "accueil.corriges.n": "{n} corrigés à valider",
  "accueil.corriges.texte": "Vérifiez-les : le campus s'en sert pour noter les copies.",
  "accueil.aRevoir.un": "1 copie à revoir",
  "accueil.aRevoir.n": "{n} copies à revoir",
  "accueil.aRevoir.texte": "Le campus ne les a pas notées seul : à vous de décider.",
  "accueil.relectures.un": "1 relecture demandée",
  "accueil.relectures.n": "{n} relectures demandées",
  "accueil.relectures.texte": "Vos étudiants demandent que vous relisiez leur note.",
  "accueil.calme": "Corrigés à jour : le campus corrige vos copies.",

  // ── Devoirs écrits par l'IA (/enseigner/relire) ────────────────────────────
  "relire.intro":
    "Le campus prépare un QCM et un exercice après chaque séance enregistrée. Leurs corrigés vous sont envoyés chaque matin : le campus s'en sert pour noter les copies. Vérifiez-les depuis chaque devoir.",
  "relire.voirCorrige": "Vérifier le corrigé",
  "relire.lien": "Devoirs écrits par l'IA : mise en avant auprès des étudiants",
} satisfies Dictionnaire;

export const t = creerTextes(FR);
export type CleCorrections = keyof typeof FR;

/**
 * Texte au singulier ou au pluriel : « base.un » pour 1, « base.n » au-delà
 * (et « base.zero » pour 0 quand la clé existe). {n} reçoit le nombre.
 */
export function selonNombre(tx: Traducteur<CleCorrections>, base: string, n: number, options: OptionsTexte = {}): string {
  const v = { n, ...options.v };
  const suffixe = n === 0 && `${base}.zero` in FR ? "zero" : n === 1 ? "un" : "n";
  return tx(`${base}.${suffixe}` as CleCorrections, { ...options, v });
}
