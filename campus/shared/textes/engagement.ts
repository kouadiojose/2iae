// Textes du chantier C8 : tableau « Engagement et participation »
// (/pilotage/engagement), chiffres corrigés du tableau de pilotage et export
// CSV. Pages du personnel : vouvoiement. Chaque chiffre a sa phrase de lecture
// (« … · lecture ») qui dit exactement ce qu'il compte.
import { creerTextes, type OptionsTexte, type Traducteur } from "./index";

export const t = creerTextes({
  // ── En-tête et filtres ──
  "page.etiquette": "Pilotage · Engagement et participation",
  "page.titre": "Engagement et participation",
  "page.sousTitre":
    "Ce que font vraiment les étudiants : apprendre sur leur téléphone, suivre les directs, travailler entre les cours. Chaque chiffre dit ce qu'il compte.",
  "page.export": "Exporter par classe (CSV)",
  "page.recalculer": "Recalculer",
  "page.calculeLe": "Calculé à {heure}, gardé 10 minutes",
  "filtre.periode": "Période",
  "filtre.jours": "{n} jours",
  "filtre.campus": "Campus",
  "filtre.tousCampus": "Tous les campus",
  "filtre.classe": "Classe",
  "filtre.toutesClasses": "Toutes les classes",
  "page.effectif": "{n} étudiants dans ce groupe",
  "page.tropPetit.titre": "Moins de 5 étudiants dans ce groupe.",
  "page.tropPetit.texte":
    "Aucun chiffre n'est affiché sous 5 étudiants : un taux désignerait des personnes. Choisissez un groupe plus large (le campus, ou toutes les classes).",
  "page.mesureDepuis":
    "L'ouverture du campus est enregistrée jour par jour depuis le {date}. Avant cette date, seules les actions d'apprentissage sont connues : les chiffres d'ouverture plus anciens sont des minimums.",
  "page.mesureAucune":
    "L'ouverture du campus n'est pas encore enregistrée jour par jour (elle commence à la mise en ligne de ce tableau) : pour l'instant, seules les actions d'apprentissage sont connues.",
  "commun.pasEncoreMesure": "Pas encore mesuré",
  "commun.pasEncoreMesure.texte": "Ces chiffres apparaîtront dès que les fonctions correspondantes seront en ligne : rien n'est compté à zéro en attendant.",
  "commun.effectifPetit": "moins de 5 : pas de taux",
  "commun.surN": "{n} sur {sur}",
  "commun.aucun": "Rien à mesurer sur la période.",
  "commun.voirChiffres": "Voir les chiffres",

  // ── 1. Indicateur principal ──
  "principal.titre": "Jours d'apprentissage par étudiant et par semaine",
  "principal.detail": "médiane de la semaine du {date} · cible : 3 jours",
  "principal.lecture":
    "Un jour compte quand l'étudiant fait au moins une action d'apprentissage : présence suivie à un direct, copie rendue, interrogation, leçon terminée, replay, question ou vote pendant un direct, et, dès qu'elles seront en ligne, révision, cours résumé et objectif du jour. Ouvrir le campus ne suffit jamais. Semaines entières, du lundi au dimanche, pour les étudiants inscrits avant le lundi ; la semaine en cours est provisoire.",
  "principal.auMoins3": "Au moins 3 jours",
  "principal.auMoins1": "Au moins 1 jour",
  "principal.enCours": "en cours",
  "principal.cible": "cible 3",
  "principal.graphique": "Médiane des jours d'apprentissage, semaine par semaine",

  // ── 2. Téléphone et régularité ──
  "regularite.titre": "Téléphone et régularité",
  "actifs.aujourdhui": "Aujourd'hui",
  "actifs.j7": "7 jours",
  "actifs.j30": "30 jours",
  "actifs.appris": "ont appris",
  "actifs.venus": "{n} venus en tout",
  "actifs.lecture":
    "Grand chiffre : étudiants qui ont fait au moins une action d'apprentissage. « Venus » : ceux qui ont ouvert le campus, avec ou sans action. Comptés en jours réels (heure d'Abidjan), une seule fois chacun.",
  "sansCours.titre": "Jours sans cours",
  "sansCours.lecture":
    "Part des journées d'étudiants SANS direct de leurs cours où ils ont fait une action d'apprentissage (jours complets de la période). C'est le chiffre de l'habitude : cible 30 % après 4 semaines, 50 % après 8.",
  "avecCours.titre": "Jours de cours",
  "avecCours.lecture": "Même calcul les jours où l'un de leurs cours avait un direct. À lire à part : la présence au direct y compte déjà.",
  "courbe.titre": "Étudiants actifs jour par jour",
  "courbe.lecture":
    "Hauteur totale : étudiants qui ont ouvert le campus ce jour-là (enregistré jour par jour depuis la mise en ligne). Bleu : action d'apprentissage un jour de cours pour eux ; orange : action un jour sans cours ; gris : ouverture sans action. Touchez un jour pour son détail.",
  "courbe.cours": "Action, jour de cours",
  "courbe.sansCours": "Action, jour sans cours",
  "courbe.ouvertSeul": "Ouverture sans action",
  "courbe.detail": "{jour} : {ac} un jour de cours, {asc} un jour sans cours, {o} en tout",
  "courbe.detailSansOuverture": "{jour} : {ac} un jour de cours, {asc} un jour sans cours (ouverture non mesurée)",
  "courbe.actions.un": "{n} action",
  "courbe.actions.n": "{n} actions",
  "courbe.ouvertures.un": "{n} ouverture",
  "courbe.ouvertures.n": "{n} ouvertures",
  "courbe.colonneJour": "Jour",
  "courbe.colonneOuverts": "Ouvertures",
  "courbe.colonneInscrits": "Inscrits",
  "courbe.colonneAvecCours": "Avec un direct",
  "plateformes.titre": "Sur quel appareil ?",
  "plateformes.lecture":
    "Journées d'étudiants passées sur le campus, selon l'appareil. Un jour passé en partie sur le téléphone compte comme un jour sur téléphone. « Inconnu » : ancienne version de l'application, sans l'information.",
  "plateformes.android_app": "Appli Android",
  "plateformes.installee": "Appli installée",
  "plateformes.mobile": "Navigateur du téléphone",
  "plateformes.ordinateur": "Ordinateur",
  "plateformes.inconnue": "Inconnu",
  "plateformes.telephone": "{n} % des journées sur téléphone",
  "plateformes.vide": "Aucune journée enregistrée sur la période pour l'instant.",
  "retour.titre": "Retour après le premier jour",
  "retour.lecture":
    "Par semaine de création du compte : part des étudiants revenus le lendemain de leur premier jour (J1), puis entre le 7e et le 13e jour (J7). « Revenu » : une ouverture du campus ou une action d'apprentissage. ≈ : premier jour antérieur à l'enregistrement jour par jour, le chiffre est un minimum.",
  "retour.semaine": "Inscrits la semaine du",
  "retour.inscrits": "Comptes",
  "retour.venus": "Venus",
  "retour.j1": "J1",
  "retour.j7": "J7",
  "revenus.titre": "Revenus après leur premier jour",
  "revenus.lecture": "Étudiants vus sur le campus au moins deux jours différents (ouverture ou action), depuis leur inscription.",

  // ── 3. Directs ──
  "directs.titre": "Directs : présence et participation",
  "presence.titre": "Présence aux directs, en trois états",
  "presence.lecture":
    "Chaque étudiant attendu à chaque séance tenue de la période. Présent : émargé en salle (QR ou code) ou suivi en ligne jusqu'au seuil de 70 %. Absent : sa salle a été émargée sans lui (au moins 3 émargés de son campus et un quart des attendus), ou il ne peut suivre qu'en ligne. Inconnu : la salle de son campus n'a pas été émargée ; ce n'est jamais compté comme une absence.",
  "presence.presents": "Présents",
  "presence.absents": "Absents",
  "presence.inconnus": "Inconnus",
  "presence.tauxConnu": "{n} % de présents là où la présence est connue",
  "presence.partInconnue": "{n} % de présence inconnue : faites émarger les salles",
  "emargement.titre": "Séances émargées par campus",
  "emargement.lecture":
    "Une salle est émargée quand au moins 3 étudiants de son campus y ont été émargés (QR de l'écran, code, ou pointés présents par le responsable), et au moins un quart de ceux qui étaient attendus. Sinon, la présence de tout le campus reste inconnue, jamais absente : les campus en tête de liste doivent faire émarger.",
  "emargement.seances": "{e} séances émargées sur {n}",
  "emargement.incidents": "dont {n} avec un incident de salle",
  "emargement.emarges": "{n} % des étudiants attendus émargés",
  "suivi.titre": "Ont suivi au moins un direct",
  "suivi.lecture":
    "Étudiants émargés en salle, ou qui ont suivi en ligne au moins 30 minutes (ou la moitié d'une séance plus courte), sur ceux dont la présence est connue (au moins une salle émargée, ou un direct suivi en ligne). Un étudiant dont la salle n'a jamais été émargée n'est pas compté comme n'ayant rien suivi : sa part est donnée à part.",
  "suivi.inconnue": "{n} % des étudiants attendus : présence encore inconnue (salle non émargée)",
  "entonnoir.titre": "Entonnoir, séance par séance",
  "entonnoir.lecture":
    "Attendus → venus (en salle ou en ligne) → ont suivi (30 minutes ou la moitié) → au seuil officiel de 70 % en ligne → ont participé (question, vote, sondage, message, main levée). Les campus et les classes de moins de 5 attendus ne sont pas détaillés. Mêmes règles que le bilan de séance.",
  "entonnoir.attendus": "Attendus",
  "entonnoir.enSalle": "Émargés en salle",
  "entonnoir.enLigne": "Venus en ligne",
  "entonnoir.ontSuivi": "Ont suivi",
  "entonnoir.auSeuil": "Au seuil en ligne",
  "entonnoir.ontParticipe": "Ont participé",
  "entonnoir.presence": "{p} présents · {a} absents · {i} inconnus",
  "entonnoir.prevueLe": "prévue le {date}",
  "entonnoir.tenueLe": "tenue le {date}",
  "entonnoir.sondages": "{n} sondage(s)",
  "entonnoir.aucunSondage": "aucun sondage",
  "entonnoir.parCampus": "Par campus",
  "entonnoir.parClasse": "Par classe (5 attendus ou plus)",
  "entonnoir.salleEmargee": "salle émargée",
  "entonnoir.salleNonEmargee": "salle non émargée",
  "entonnoir.aucune": "Aucun direct tenu sur la période.",
  "entonnoir.detail": "Détail",
  "entonnoir.toutes": "Voir les {n} séances",

  // ── 4. Travail entre les cours ──
  "travail.titre": "Travail entre les cours",
  "travail.lecture":
    "Copies et interrogations « à ce jour » : un devoir compte dès sa publication, même s'il n'est pas encore échu ; le taux monte jusqu'à l'échéance. Un étudiant n'est attendu qu'aux devoirs de ses cours publiés après son arrivée.",
  "travail.copies": "Copies des devoirs des formateurs",
  "travail.interrogations": "Interrogations des formateurs",
  "travail.qcm_auto": "QCM automatiques (routine du soir)",
  "travail.exercices_auto": "Exercices automatiques (routine du soir)",
  "travail.rendus": "{n} rendus sur {sur} attendus",
  "travail.commences": "{n} commencés",
  "travail.ouverts": "{n} devoir(s) encore ouvert(s) : « à ce jour »",
  "travail.aucunDevoir": "Aucun devoir sur la période.",
  "replays.absents": "Replays ouverts par les absents",
  "replays.absents.lecture": "Absents connus à un direct (salle émargée sans eux) qui ont ouvert son replay.",
  "replays.inconnus": "Replays ouverts quand la présence est inconnue",
  "replays.inconnus.lecture": "À titre d'information : la plupart de ces étudiants étaient probablement en salle.",
  "revision.titre": "Révision du jour",
  "revision.reviseurs": "ont révisé ces 7 derniers jours",
  "revision.reponses": "{n} réponses par étudiant qui révise",
  "revision.boite3": "{n} % des cartes en boîte 3 ou plus (la mémoire tient)",
  "coursComplets.titre": "Cours résumés ouverts",
  "coursComplets.lecture": "Étudiants qui ont ouvert au moins un cours résumé sur la période.",
  "objectifs.titre": "Objectif du jour validé",
  "objectifs.lecture": "Objectifs validés sur l'ensemble des journées ouvrées complètes des inscrits (cible 30 %).",
  "semainesActives.titre": "Semaines actives",
  "semainesActives.lecture": "Étudiants dont la dernière semaine complète a atteint leur objectif de jours actifs (3 par défaut).",
  "coupe.titre": "Coupe des campus, 8 semaines",
  "coupe.lecture": "Taux de participation de chaque campus (au moins deux types d'actes dans la semaine), semaine par semaine.",

  // ── 5. Rappels ──
  "rappels.titre": "Rappels et étudiants joignables",
  "joignables.abonnes": "Téléphone abonné aux rappels",
  "joignables.abonnes.lecture": "Étudiants dont au moins un téléphone ou navigateur reçoit les rappels du campus (cible 70 %).",
  "joignables.essai": "Essai de rappel reçu",
  "joignables.essai.lecture": "Le rappel d'essai est arrivé et l'étudiant l'a confirmé sur son téléphone.",
  "joignables.email": "Adresse e-mail",
  "joignables.email.lecture": "Étudiants qui ont une adresse e-mail sur leur compte.",
  "joignables.parCampus": "Par campus",
  "joignables.parMarque": "Par marque de téléphone",
  "envois.titre": "Rappels envoyés",
  "envois.lecture":
    "Chaque décision d'envoi de la période : envoyé, différé au résumé suivant, bloqué par le plafond de 3 par jour, ou en échec. Ouverts : touchés dans les 24 h. Repères : au moins 30 % pour les échéances et les directs, 10 % pour l'engagement.",
  "envois.parPriorite": "Par priorité",
  "envois.parType": "Par type",
  "envois.cle": "Rappel",
  "envois.total": "Décisions",
  "envois.envoyes": "Envoyés",
  "envois.differes": "Différés",
  "envois.bloques": "Bloqués",
  "envois.echecs": "Échecs",
  "envois.ouverts": "Ouverts sous 24 h",
  "effet.titre": "Effet du rappel d'entraînement",
  "effet.lecture":
    "Part des jours suivis d'une action d'apprentissage dans les 24 h : jours avec rappel, comparés aux jours tirés au sort sans rappel (un sur cinq pendant 4 semaines), seulement pour les étudiants dont le téléphone recevait déjà les rappels. On garde le rappel s'il apporte au moins 5 points.",
  "effet.avec": "Avec rappel",
  "effet.sans": "Sans rappel (tirés au sort)",
  "effet.ecart": "{n} points d'écart",
  "relances.titre": "Relances des décrocheurs",
  "relances.lecture": "Relances envoyées sur la période ; revenus : une activité dans les 48 h. « À appeler » : deux relances sans effet.",
  "relances.envoyees": "{n} relances envoyées",
  "relances.revenus": "revenus sous 48 h",
  "relances.aAppeler": "{n} étudiant(s) à appeler",
  "relances.lien": "Voir « À contacter »",

  // ── 6. Copies, séances mal datées, questions ratées ──
  "copies.titre": "Copies en attente de correction, par formateur",
  "copies.lecture":
    "Copies rendues par les étudiants du groupe sur les devoirs que les formateurs ont eux-mêmes donnés, pas encore notées. Délai médian : entre la remise et la note, pour les copies corrigées sur la période (cible : moins de 72 h). Les exercices automatiques de la routine du soir n'y sont jamais : le campus les corrige (voir « Correction automatique »).",
  "copies.auto.titre": "Exercices automatiques (routine du soir) : corrigés par le campus",
  "copies.auto.attente.un": "{n} copie rendue pas encore notée",
  "copies.auto.attente.n": "{n} copies rendues pas encore notées",
  "copies.auto.corrigees.un": "{n} notée sur la période",
  "copies.auto.corrigees.n": "{n} notées sur la période",
  "copies.auto.lecture":
    "Comptées à part : aucun rappel au formateur, aucun retard. Le campus les note d'après le corrigé du devoir ; le formateur peut changer toute note.",

  // ── 6 bis. Correction automatique (décision du 8 octobre 2026, GET /api/pilotage/corrections) ──
  "corrections.titre": "Correction automatique",
  "corrections.lecture":
    "Le campus note les copies de dépôt d'après le corrigé du devoir, validé par le formateur ou tenu pour bon sans réponse au bout de 24 h. Chiffres de votre périmètre, tous cours confondus (les filtres de campus et de classe ne s'y appliquent pas) ; « sur la période » : depuis le {date}.",
  "corrections.corriges": "Corrigés",
  "corrections.corriges.enPreparation": "En préparation",
  "corrections.corriges.aValider": "À valider",
  "corrections.corriges.valides": "Validés",
  "corrections.corriges.tacites": "Tenus pour bons",
  "corrections.corriges.lecture":
    "En préparation : le campus rédige le corrigé (devoir donné sans corrigé). À valider : envoyé au formateur, en attente de sa réponse. Validés : par le formateur ou la direction, tels quels ou modifiés. Tenus pour bons : sans réponse au bout de 24 h. Seuls les deux derniers servent de barème.",
  "corrections.copies": "Copies",
  "corrections.copies.enFile": "En attente",
  "corrections.copies.notees": "Notées",
  "corrections.copies.aRevoir": "À revoir",
  "corrections.copies.erreurs": "En erreur",
  "corrections.copies.periode.un": "{n} copie notée par le campus sur la période",
  "corrections.copies.periode.n": "{n} copies notées par le campus sur la période",
  "corrections.copies.lecture":
    "En attente : notées au prochain passage (la routine du soir). À revoir : le campus n'a pas publié de note (consigne cachée pour l'IA, pages illisibles, vidéo seule, fichier illisible, copie vide, échecs répétés), le formateur décide. En erreur : échec technique, nouvel essai automatique.",
  "corrections.relectures": "Relectures demandées",
  "corrections.relectures.detail": "{o} en attente · {t} traitées",
  "corrections.relectures.lecture": "Demandes des étudiants qui contestent une note du campus ; le formateur garde la note ou la change, et leur répond.",
  "corrections.changees": "Notes changées par un formateur",
  "corrections.changees.ecart": "écart moyen : {n} point(s) sur 20",
  "corrections.changees.sansEcart": "aucune sur la période",
  "corrections.changees.lecture":
    "Notes du campus qu'un formateur a ensuite modifiées sur la période (après une relecture, ou de lui-même). Un écart moyen faible : le campus note comme les formateurs.",
  "corrections.formateurs": "Qui répond au corrigé du jour",
  "corrections.formateurs.ligne": "{v} validés · {t} sans réponse · {a} à valider",
  "corrections.formateurs.repond": "{n} % validés",
  "corrections.formateurs.lecture":
    "Par formateur : corrigés qu'il a validés ou modifiés lui-même, corrigés tenus pour bons sans réponse de sa part, corrigés qui attendent encore sa réponse. Le pourcentage : part des corrigés validés parmi ceux qui ont servi de barème.",
  "corrections.formateurs.aucun": "Aucun corrigé n'a encore été envoyé aux formateurs.",
  "corrections.erreur": "Le bilan de la correction automatique n'a pas pu être chargé.",
  "copies.formateur": "Formateur",
  "copies.enAttente": "En attente",
  "copies.plusAncienne": "Plus ancienne",
  "copies.auDela72h": "Plus de 72 h",
  "copies.delai": "Délai médian",
  "copies.joursAge": "{n} j",
  "copies.heures": "{n} h",
  "copies.aucune": "Aucune copie en attente : bravo aux formateurs.",
  "anomalies.titre": "À vérifier",
  "malDatees.titre": "Séances démarrées à une autre date que prévue",
  "malDatees.lecture":
    "Comptées partout à leur date réelle (présences, « à contacter », ce tableau). Redatez-les dans le planning si la date prévue est fausse.",
  "malDatees.ligne": "prévue le {prevue}, tenue le {tenue}",
  "malDatees.aucune": "Aucune séance mal datée sur la période.",
  "ratees.titre": "Questions les plus ratées",
  "ratees.lecture":
    "Questions des interrogations liées aux séances (et cartes de révision dès qu'elles seront en ligne), au moins 5 réponses et plus d'une sur trois fausse. Au-delà de 70 % d'erreurs, la question est peut-être mal posée : faites-la relire.",
  "ratees.erreurs": "{n} % d'erreurs sur {sur} réponses",
  "ratees.revision": "carte de révision",
  "ratees.aucune": "Aucune question ratée par plus d'un étudiant sur trois.",

  // ── Tableau de pilotage (/pilotage) ──
  "tableau.lienEngagement": "Engagement et participation",
  "tableau.lienEngagement.texte": "Jour par jour, téléphone, directs, rappels",
  "tableau.actifsAujourdhui": "Actifs aujourd'hui",
  "tableau.actifsAujourdhui.detail.un": "{n} a fait une action d'apprentissage",
  "tableau.actifsAujourdhui.detail.n": "{n} ont fait une action d'apprentissage",
  "tableau.revenus": "Revenus après le 1er jour",
  "tableau.revenus.detail": "vus au moins deux jours différents",
  "tableau.ontSuivi": "Ont suivi un direct",
  "tableau.ontSuivi.detail": "là où la présence est connue · émargés, ou 30 min en ligne, en 30 jours",
  "tableau.ontSuivi.detailInconnue": "là où la présence est connue · {n} % inconnue",
  "tableau.presence": "Présence aux directs",
  "tableau.presence.detail": "là où elle est connue · {n} % inconnue",
  "tableau.presence.detailConnue": "là où elle est connue",
  "tableau.copies": "Copies rendues à ce jour",
  "tableau.copies.detail": "{n} sur {sur}, devoirs ouverts compris",
  "tableau.emargement": "Salles émargées : {e} séances sur {n}",
  "tableau.copiesCourt": "Copies à ce jour",
  "tableau.actifsCourt.un": "actif aujourd'hui",
  "tableau.actifsCourt.n": "actifs aujourd'hui",
  "tableau.sousTitre": "Où en sont nos étudiants ? Chiffres des 30 derniers jours, recalculés toutes les 2 minutes.",
  "tableau.aContacter.vide":
    "Un étudiant apparaîtra ici s'il n'a pas activé son compte après 7 jours, n'a eu aucune activité en ligne depuis 7 jours, a été absent aux deux derniers lives alors que sa salle a émargé (une présence non mesurée ne compte jamais comme une absence) ou n'a pas rendu un devoir.",

  // ── Présences (/pilotage/presences, dossier de l'étudiant) ──
  "presences.nonMesures.un": "{n} non mesuré",
  "presences.nonMesures.n": "{n} non mesurés",
  "presences.nonMesurees.un": "{n} non mesurée",
  "presences.nonMesurees.n": "{n} non mesurées",
  "presences.filtreNonMesures": "Non mesurés",
  "presences.tauxNonMesure": "non mesurée",
  "presences.regle":
    "Présent en ligne à partir de {seuil} % de {duree} min, soit {minutes} min. Les absences justifiées, les incidents de salle et les présences non mesurées ne comptent pas dans le taux : une salle n'est émargée qu'avec au moins 3 émargés de son campus et un quart des attendus ; sinon, les autres étudiants de ce campus sont « non mesurés », jamais absents.",
  "presences.sousTitre":
    "Émargement en salle, pointage du responsable et présence en ligne (70 % de la durée au moins), réunis sur une seule feuille par séance. Une salle non émargée laisse la présence non mesurée, jamais absente.",
  "presences.comptees": "de présence (présences / séances mesurées : {p} / {m})",
  "presences.legendeNonMesure": "Non mesurée",

  // ── Relevé des parents (/releve/:jeton, page publique) ──
  "releve.presence.titre": "Présence aux cours en direct",
  "releve.presence.nonMesuree": "Non mesurée",
  "releve.presence.aucunCours": "Aucun cours en direct pour l'instant.",
  "releve.presence.presents.un": "Présent à {n} séance",
  "releve.presence.presents.n": "Présent à {n} séances",
  "releve.presence.mesurees.un": "sur {n} séance mesurée",
  "releve.presence.mesurees.n": "sur {n} séances mesurées",
  "releve.presence.justifiees.un": "{n} absence justifiée non comptée",
  "releve.presence.justifiees.n": "{n} absences justifiées non comptées",
  "releve.presence.nonMesurees.un":
    "{n} séance non mesurée : les étudiants suivent les cours ensemble dans la salle de leur campus, et la présence n'y a pas été relevée. Ce n'est jamais compté comme une absence.",
  "releve.presence.nonMesurees.n":
    "{n} séances non mesurées : les étudiants suivent les cours ensemble dans la salle de leur campus, et la présence n'y a pas été relevée. Ce n'est jamais compté comme une absence.",
  "releve.presence.rien":
    "Les étudiants suivent les cours ensemble dans la salle de leur campus, et la présence n'y a pas encore été relevée : elle n'est pas encore mesurée. Ce n'est jamais compté comme une absence.",

  // ── Export CSV ──
  "csv.campus": "Campus",
  "csv.classe": "Classe",
  "csv.inscrits": "Inscrits",
  "csv.ouverts7j": "Ont ouvert le campus (7 j)",
  "csv.apprenants7j": "Ont fait une action d'apprentissage (7 j)",
  "csv.mediane": "Jours d'apprentissage (médiane, semaine dernière)",
  "csv.presents": "Présents aux directs ({n} j)",
  "csv.absents": "Absents",
  "csv.inconnus": "Présence inconnue",
  "csv.presenceConnue": "Présence connue (%)",
  "csv.copies": "Copies rendues à ce jour (%)",
  "csv.qcmAuto": "QCM automatiques terminés (%)",
});

export type CleEngagement = Parameters<typeof t>[0];

/**
 * Texte au singulier ou au pluriel : « base.un » jusqu'à 1 (0 et 1 au singulier,
 * en français), « base.n » au-delà. {n} reçoit le nombre.
 */
export function selonNombre(tx: Traducteur<CleEngagement>, base: string, n: number, options: OptionsTexte = {}): string {
  return tx(`${base}.${n <= 1 ? "un" : "n"}` as CleEngagement, { ...options, v: { n, ...options.v } });
}
