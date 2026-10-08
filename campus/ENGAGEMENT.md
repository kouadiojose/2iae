# Plan d'engagement : contrat commun des chantiers C0 à C8

À lire par chaque chantier **avant de coder**, avec `../CLAUDE.md` et `CLAUDE.md`.
Le socle commun (C0) est fusionné dans `main` avant tous les autres : il ne change rien à l'écran
et pose ce qui est partagé. Ensuite, C1 à C8 partent ensemble, chacun d'une copie de `main` à jour,
et ne modifient **que leurs propres fichiers**.

| Chantier | Sujet | Migration | Ordre de fusion |
|---|---|---|---|
| C0 | socle commun (ce document) | aucune | 1 |
| C6 | directs : émargement et participation en salle | aucune | 2 |
| C3 | rappels qui arrivent | `0026_envois_push` | 3 |
| C8 | tableau « Engagement et participation » | `0027_activite_jours` | 4 |
| C1 | révision du jour | `0028_revision` | 5 |
| C2 | objectif du jour, rattrapage, progression honnête | `0029_objectif_du_jour` | 6 |
| C7 | côté formateur | `0030_suivi_formateurs` | 7 |
| C5 | progression et Coupe | `0031_progression_coupe` | 8 |
| C4 | rappel du jour, e-mail de la semaine, relances | `0032_relances_engagement` | 9 |

Interdits pour tous : le site (racine du dépôt), les variables Railway, toute mise en ligne
(`railway`, `deployer.sh` : c'est la session principale qui met en ligne, après fusion, hors cours),
tout secret, toute relance payante (ni SMS ni WhatsApp automatique), toute modification de
`server/etude-cours.ts` et `server/devoirs-auto.ts` (session de l'IA du soir).

## 1. Amendement de José (8 octobre 2026) : il prime sur le plan

Les étudiants **assistent** aux cours ensemble, dans la salle de conférence de leur campus, devant
l'écran de la salle. Personne ne les émarge encore (le 7 octobre : 0 émargé à Riviera comme à
Yopougon). Une absence au direct n'est donc **pas** un décrochage : tant que la salle n'a pas été
émargée, la présence est **inconnue**. Les formateurs utilisent peu la plateforme : les devoirs, QCM
et exercices de la routine du soir sont la principale matière de travail et arrivent aux étudiants
sans action du formateur.

### Présence en trois états : `server/engagement/presence.ts`

| État | Règle (dans cet ordre) |
|---|---|
| `inconnu` | séance pas encore tenue (`demarree_le` nul) |
| `absent` | absence justifiée par la vie scolaire (absent connu : jamais de relance pour elle) |
| `present` | émargé en salle (QR ou code, `mode = 'salle'`) ou pointé présent par le responsable de salle |
| `present` | suivi en ligne jusqu'au seuil (70 % de la durée de référence, même calcul que le live) |
| `absent` | pointé absent par le responsable de salle |
| `absent` | sans campus (`site_id` nul) : il ne peut suivre qu'en ligne |
| `inconnu` | incident de la salle de son campus pendant la séance |
| `absent` | la salle de son campus a été émargée (décision D1 : au moins 3 étudiants de ce campus émargés dans sa salle **et** au moins 25 % de ses attendus) |
| `inconnu` | tout le reste : aucun émargement dans sa salle. Quelques minutes en ligne sous le seuil n'y changent rien (il a pu ouvrir le direct depuis la salle). |

- `etatPresence(seanceId, etudiantId)` et `etatsPresence(seanceId, ids)` pour une séance ;
  ``sqlEtatPresence(sql`s.id`, sql`u.id`)`` (colonne text) pour les calculs en masse ;
  `sqlSalleEmargee(seance, site)` pour « cette salle a-t-elle été émargée ? ». La règle n'est écrite
  qu'une fois, en SQL. Savoir si l'étudiant était **attendu** reste l'affaire de l'appelant
  (`sqlAttendus`, `etudiantsAttendusSeance`).
- **`inconnu` ne compte JAMAIS comme une absence** : pas de rattrapage « tu as manqué », pas de relance
  de décrocheur, pas de « à contacter », pas de perte de points ni de série, pas de malus dans la Coupe.
- Le téléphone sert surtout **avant et après** le cours ; pendant, seulement pour émarger et participer
  (mode compagnon), jamais pour regarder la vidéo dans la salle.
- **Aucun travail obligatoire pour le formateur.** `VALIDATION_OBLIGATOIRE` reste `false` : la relecture
  des QCM de l'IA est facultative. Un devoir automatique est proposé sans validation, une fois publié et
  créé depuis 8 h, soit le lendemain matin (`DELAI_DEVOIR_AUTO_HEURES`, voir § 4) ; le formateur peut seulement s'y opposer (C7).

### Décisions de la revue (8 octobre 2026)

- **D1, salle émargée** : au moins 3 étudiants du campus émargés dans sa salle **et** au moins 25 % des
  étudiants de ce campus attendus à la séance (`SALLE_EMARGES_MINIMUM`, `SALLE_PART_MINIMUM` dans
  `presence.ts`). En dessous, les autres restent `inconnu`.
- **D2, exercices automatiques** : leurs copies ne relancent jamais le formateur ; elles sont comptées à
  part pour la direction et leur correction reste facultative.
- **D3, un seul rappel au démarrage du direct** (`rappelerDemarrage`, `participation-direct.ts`) : urgent,
  il remplace « Dans 15 min ». Campus qui suit le cours : « en salle, scanne le QR de l'écran ; sinon,
  rejoins le cours en ligne », vers `/emargement?seance=` ; déjà émargé : « tu es déjà compté présent » ;
  sans campus : « En direct : entre maintenant ». La carte « live » de l'accueil mène aussi à l'émargement
  tant que l'étudiant d'un campus qui suit le cours n'a pas émargé.
- **D4, la révision paie l'effort** : chaque carte revue rapporte des points, juste ou non (une fois par
  carte et par jour, plafond quotidien) ; la justesse ne pilote que les boîtes de répétition.
- **D5, jamais de dernier désigné** : aucun classement, écran ni e-mail ne nomme une dernière place. Dans la
  Coupe, un rang ne s'affiche que dans la moitié haute et jamais à 0 % (`rangVisible`) ; pendant le direct,
  les campus se lisent en taux, sans rang ; l'e-mail « Ta semaine » ne donne aucun rang.

### Conséquences par chantier

- **C6** devient d'abord « émargement et participation en salle » : l'écran de salle prend l'émargement en
  charge seul (QR plein écran au démarrage, puis vers +15 et +45 min pendant environ 60 s, compteur
  « 34 émargés à Riviera » et classement des campus en direct, en taux, sans rang) ; un rappel unique au
  démarrage du direct (décision D3, voir plus bas) ;
  dans le Studio, « Afficher l'émargement » remet le QR sur toutes les salles ; après l'émargement, le
  téléphone passe en mode compagnon sans vidéo (« Tu es compté présent ✓ ») ; un mini-guide d'une page
  pour les chargés de cours (« vous n'avez rien à faire »), sur l'écran de salle avant le cours et dans le
  guide des salles. Le code serveur nouveau va dans `server/routes/participation-direct.ts` (tâche
  `planifier` qui repère les directs qui démarrent, par exemple) plutôt que dans `live.ts`.
- **C2** : « Rattrape le cours manqué » seulement si l'état est `absent` ; sinon « Lis À retenir du dernier cours ».
  Une séance n'est « rattrapée » qu'après un vrai travail (`sqlSeanceRattrapee` : replay suivi, quiz du cours
  complet, quelques fiches ou cartes) ; l'ouvrir ne suffit pas. Le rappel du jour applique la même règle.
  `ObjectifDuJour variante="grande"` remplace aussi, sur l'accueil, la carte d'un devoir non urgent : un seul
  endroit dit quoi faire.
- **C4** : un décrocheur se définit par l'absence d'**actes d'apprentissage** (révision, QCM, devoir, cours
  complet, émargement), jamais par des absences `inconnu`. Le motif `lives_manques` de `calculerAContacter`
  ne compte que des `absent` (après C8, ou filtré par `etatsPresence`).
- **C5** : l'émargement rapporte des points ; la Coupe compte le taux d'émargement des séances et les actes
  d'apprentissage ; une séance sans aucun émargement dans un campus est neutre pour ce campus
  (`sqlSalleEmargee`). La présence ne peut que faire monter le taux d'un campus (le plus haut des deux
  calculs est gardé). La semaine passée reste en clôture 48 h (recalculée, rien n'est annoncé) et n'est
  figée qu'une fois, le mercredi à 1 h ; lundi et mardi, l'e-mail « Ta semaine » dit que les chiffres sont
  provisoires.
- **C7** : simplicité maximale ; « Après la séance » montre ce que la plateforme a fait (cours complet prêt,
  QCM envoyé, combien l'ont fait) au lieu de demander quelque chose.
- **C8** : présence en trois états partout ; « à contacter » ne retient jamais une présence `inconnu` ;
  indicateur « séances émargées par campus » (part des salles qui ont émargé).

## 2. Qui possède quoi

### Fichiers de chaque chantier

Chaque chantier crée ses fichiers ; ceux que C0 a posés vides lui appartiennent aussi.

| Chantier | Serveur | Partagé | Client |
|---|---|---|---|
| C1 | `server/routes/revision.ts`*, `server/engagement/cartes.ts`, `server/engagement/revision.ts` | `shared/schema/revision.ts`*, `shared/engagement/revision.ts`, `shared/textes/revision.ts` | `modules/revision/` (`routes.tsx` : /reviser, `prechargerRevision.ts`*), `modules/mediatheque/RevisionClasse.tsx`, `modules/mediatheque/quiz-outils.ts` |
| C2 | `server/routes/objectif.ts`*, `server/engagement/objectif.ts`, `server/engagement/progression-cours.ts` | `shared/schema/objectif.ts`*, `shared/engagement/objectif.ts`, `shared/textes/objectif.ts` | `modules/objectif/` (`ObjectifDuJour.tsx`*, `JourValide.tsx`) |
| C3 | `server/routes/envois.ts`* | `shared/schema/envois.ts`*, `shared/engagement/envois.ts`, `shared/textes/rappels.ts` | `modules/rappels/` (`CarteRappels.tsx`*, `ProposerRappel.tsx`*, `VerificationRappel.tsx`, `GuideRappelsAndroid.tsx`) |
| C4 | `server/routes/relances-auto.ts`*, `server/engagement/rappel-du-jour.ts`, `decrocheurs.ts`, `email-semaine.ts` | `shared/schema/relances-auto.ts`*, `shared/engagement/relances.ts`, `shared/textes/relances.ts` | `modules/relances/` (/mes-rappels), `modules/pilotage/composants/ReglagesRelances.tsx`, `EtatRelances.tsx` |
| C5 | `server/routes/progression.ts`*, `server/engagement/bareme.ts`, `registre.ts`, `semaines.ts`, `badges.ts`, `coupe.ts` | `shared/schema/progression.ts`*, `shared/engagement/progression.ts`, `shared/textes/progression.ts` | `modules/progression/` (/progression, /coupe ; `PastilleSemaine.tsx`*, `GainDuJour.tsx`*, `BandeauCoupe.tsx`*, `CoupeSalle.tsx`*) |
| C6 | `server/routes/participation-direct.ts`* | `shared/engagement/direct.ts`, `shared/textes/direct.ts` | `modules/live/JaugePresence.tsx`, `SortieDuLive.tsx`, `QuestionsRappel.tsx`, `RappelInteraction.tsx`, `modules/dossier/MesPresences.tsx` |
| C7 | `server/routes/enseigner-suivi.ts`*, `server/engagement/formateurs.ts` | `shared/schema/enseigner-suivi.ts`*, `shared/engagement/enseigner.ts`, `shared/textes/enseigner.ts` | `modules/enseigner-suivi/` (`ApresSeance.tsx`*, `TravailDeGroupeDevoir.tsx`*, `QcmARelire.tsx`) |
| C8 | `server/routes/pilotage-engagement.ts`*, `server/engagement/indicateurs.ts`, `server/engagement/activite.ts` | `shared/schema/activite.ts`*, `shared/engagement/indicateurs.ts`, `shared/textes/engagement.ts` | `modules/pilotage-engagement/` (/pilotage/engagement) |

\* posé vide par C0 et déjà branché : `server/routes/index.ts` appelle déjà chaque `enregistrerX(app)`,
`shared/schema/index.ts` exporte déjà chaque schéma. **Ne touchez pas à ces deux index.**
Un nom exporté par un schéma ne doit pas reprendre un nom déjà exporté par `@shared/schema`.

### Fichiers existants sensibles : un seul propriétaire

| Propriétaire | Fichiers (chemins depuis `campus/`) |
|---|---|
| C1 | `server/routes/cours-complets.ts`, `client/src/modules/mediatheque/PageCoursComplet.tsx` (hors emplacement), `client/src/modules/cours/PageCours.tsx`, `client/src/modules/ia/composants.tsx`, `client/public/manifest.webmanifest`, `client/public/sw.js` (sections « Installation et activation » et « Requêtes ») |
| C2 | `server/routes/accueil.ts`, `server/routes/cours.ts`, `client/src/modules/accueil/PageAccueil.tsx` (hors emplacements), `client/src/modules/cours/composants/CarteCours.tsx`, `client/src/modules/cours/PageMesCours.tsx` |
| C3 | `server/notifications.ts`, `server/routes/push.ts`, `server/routes/evaluations.ts`, `shared/schema/echanges.ts`, `shared/schema/ext-accueil.ts`, `client/src/modules/pwa/ActiverNotifications.tsx`, `client/src/modules/evaluations/composants/ZoneRendu.tsx`, `client/public/sw.js` (section « Rappels (Web Push) »), plus **une ligne** dans `server/routes/messages.ts` et **une ligne** dans `server/routes/live.ts` |
| C4 | `server/mail.ts`, `client/src/modules/pilotage/PageSuivi.tsx`, `client/src/modules/pilotage/composants/LigneAContacter.tsx`, `client/src/modules/compte/PageProfil.tsx` |
| C6 | `client/src/modules/live/SalleEtudiant.tsx`, `ui.tsx`, `panneaux.tsx`, `Studio.tsx`, `PageDirect.tsx`, `PageSalle.tsx` (hors emplacement `CoupeSalle`, amendement), `client/src/modules/dossier/PageMonDossier.tsx` |
| C7 | `server/engagement/proposables.ts` (seul fichier de C0 qu'il modifie) |
| C8 | `server/routes/admin.ts` (corps des requêtes), `server/auth.ts`, `client/src/lib/api.ts`, `client/src/modules/pilotage/PageTableau.tsx` |

Fichiers modifiés par plusieurs chantiers, chacun à son endroit :

- `client/src/navigation.ts` : C1 (icône `Layers` après `Sparkles,` ; « Réviser » juste après la ligne
  `/assistant` de `ETUDIANT`), C5 (icône `Trophy` après `Wallet,` ; « Ma progression » après `/mon-dossier`
  dans `ETUDIANT` ; « Coupe » après `/pilotage/annonces` dans `EQUIPE`), C8 (icône `Activity` après
  `BarChart3,` ; « Engagement » après `/pilotage/presences` dans `EQUIPE`). Les lignes `/pilotage/presences`
  et `/pilotage/annonces` se suivent : l'intégrateur range les deux ajouts à la main si Git hésite.
- `client/public/sw.js` : C1 et C3, chacun dans ses sections.
- `migrations/meta/_journal.json` : une entrée par chantier qui a une migration (§ 5).

### Les fichiers du socle (C0)

Personne ne les modifie, sauf : `server/engagement/proposables.ts` (C7) et la constante
`DEBUT_EXPERIENCE` de `server/engagement/tirage.ts` (C4). Le **placement** des emplacements dans
`PageAccueil.tsx`, `PageSalle.tsx`, `PageEnseigner.tsx` et `PageCoursComplet.tsx` appartient à C0 : ne
les déplacez pas ; seul leur **contenu** (le fichier du module) appartient au chantier qui le remplit.

## 3. Règles de travail en parallèle

- **Aucun import entre chantiers**, sauf les emplacements posés par C0 (et `prechargerRevision` pour C2).
  Les chantiers ne se lisent qu'à travers la base : une table d'un autre chantier se lit en SQL brut après
  `await tableExiste("nom")` (`server/engagement/tables.ts`). Si elle est absente, le bloc est masqué ou
  affiche « pas encore mesuré », jamais 0 %.
- Tables lues par d'autres chantiers : `cartes_revision`, `reponses_revision`, `suivis_cours_complets` (C1) ;
  `objectifs_jours` (C2) ; `envois_push` (C3) ; `relances_engagement` (C4) ; `activites`,
  `classements_semaine` (C5) ; `validations_devoirs_auto` (C7, par `proposables.ts`) ; `activite_jours` (C8).
  Leurs colonnes, une fois fusionnées, ne changent plus de nom.
- **Emplacements** : chacun est enveloppé dans `LimiteSilencieuse`
  (`client/src/components/ui/limite-silencieuse.tsx`) : s'il plante, il disparaît et la page reste.
  Ils rendent `null` (ou le repli donné) tant que leur chantier n'est pas fusionné.

| Emplacement | Où | Rempli par |
|---|---|---|
| `PastilleSemaine` | accueil étudiant, à côté du titre (visible sur téléphone) | C5 |
| `ObjectifDuJour variante="grande" repli={…}` | accueil, à la place de la carte « À jour » (repli : cette carte) | C2 |
| `ObjectifDuJour variante="ligne"` | accueil, sous la carte « À faire maintenant » | C2 |
| `BandeauCoupe` | accueil, en tête de la colonne de droite | C5 |
| `CarteRappels` | accueil, juste avant l'invitation à installer | C3 |
| `CoupeSalle siteId` | écran de salle : sans cours et avant le cours, jamais pendant | C5 |
| `ApresSeance` | accueil du formateur, sous la carte de la prochaine séance et « Prêt pour la classe » | C7 |
| `TravailDeGroupeDevoir seanceId etudiant` | cours complet, onglet « Travail de groupe » | C7 |
| `ProposerRappel moment` (`live`, `rendu`, `revision`) | sans placement : sortie du direct (C6), reçu du devoir (C3), fin de révision (C1) | C3 |
| `GainDuJour moment` (`live`, `objectif`, `revision`, `rendu`) | sans placement : sortie du direct (C6), jour validé (C2), fin de révision (C1) | C5 |
| `prechargerRevision()` | appelé par l'objectif du jour (C2) | C1 |

  Qui place `ProposerRappel` ou `GainDuJour` l'enveloppe lui-même dans une `LimiteSilencieuse`.
  Un chantier qui élargit les props d'un emplacement garde les props existantes.
- **Mots export** disponibles : `server/routes/admin.ts` (`calculerAContacter`, `derniereActivite`,
  `SQL_DERNIERE_ACTIVITE`, `sqlAttendus`, `sqlDevoirsAttendus`, `sqlClasseA`, `COLONNES_RESUME`, `versResume`,
  `SQL_DUREE_REFERENCE`, `SQL_INCIDENT_SALLE`) ; `server/routes/live.ts` (`feuillePresence`).
  `NouvelleNotification` (`server/notifications.ts`) accepte `priorite?: 'urgent' | 'action' | 'contenu' |
  'engagement'`, ignorée tant que C3 n'est pas fusionné.

## 4. Conventions communes

- **Textes** : tout nouveau texte (écran, rappel, e-mail) passe par `creerTextes`
  (`shared/textes/index.ts`), un dictionnaire par chantier dans `shared/textes/<chantier>.ts`. Serveur :
  `t(cle, { registre: registreDe(u.role), v: { n } })` ; client : `const tx = useTextes(t)`
  (`client/src/lib/textes.ts`). Variables `{n}`, repli sur le français, clé affichée si elle manque.
  `formaterDate(d, { fuseau, style })` pour les dates. Étudiants **tutoyés**, personnel **vouvoyé** ; on
  écrit « rappel », jamais « notification push ». L'anglais viendra par les dictionnaires. Les quatre
  fonctions tu/vous existantes (`selonRole`, `selon`) restent en place.
- **Jour et semaine** : uniquement `shared/engagement/calendrier.ts` (`jourLocal`, `heureLocale`,
  `minutesLocales`, `semaineIso`, `lundiDe`, `ajouterJours`, `ecartJours`, `estDimanche`, `estJour`). Le jour
  se calcule dans `utilisateurs.fuseau` (Abidjan par défaut) ; semaine ISO du lundi au dimanche (« 2026-W41 »).
- **Tirage témoin** (`server/engagement/tirage.ts`) : `rappelEntrainementAutorise(utilisateurId, jour)` ;
  un jour sur cinq sans rappel d'entraînement pendant 28 jours à partir de `DEBUT_EXPERIENCE` (nul tant que
  C4 ne l'a pas réglé : toujours vrai). Jamais pour une échéance, un live ni une relance de décrocheur.
  C8 le recalcule pour mesurer l'effet du rappel.
- **Devoir proposable** (`server/engagement/proposables.ts`) : `sqlDevoirProposable("d")` dans le WHERE
  de toute requête qui **pousse** un devoir (objectif du jour, rappels d'engagement). Devoir manuel :
  toujours ; devoir de la routine du soir (dans `devoirs_seances.devoir_ids`) : publié et créé depuis
  `DELAI_DEVOIR_AUTO_HEURES` (24). Ouverture, échéance et rendu restent à vérifier par l'appelant.
- **Présence** : `server/engagement/presence.ts` (§ 1), nulle part ailleurs.
- **Téléphone** : chaque nouvel écran pèse moins de 25 Ko compressés, réponses JSON de quelques Ko,
  icônes lucide, aucune image ; côté client, seulement des `import type` depuis `@shared/schema` ; les
  types d'échange vont dans `shared/engagement/*.ts`, sans drizzle ; zones tactiles d'au moins 44 px.
- **Rythme** : au plus 3 rappels par jour et par personne, heures calmes de 21 h à 6 h (fuseau de la personne).
- **Conservation** : envois de rappels 90 jours, relances 180 jours, activité quotidienne 400 jours.
- **Ouverture future** : `site_id` et `classe_id` facultatifs dans les nouvelles tables ; colonne `langue`
  sur les cartes de révision.
- Le lien de désabonnement est signé avec le secret de session déjà en place : aucun nouveau secret.

## 5. Migrations

### Écrire la sienne

- Une seule par chantier, au numéro du tableau d'en-tête, SQL **écrit à la main** et **idempotent** :
  `CREATE TABLE IF NOT EXISTS`, `CREATE [UNIQUE] INDEX IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, tout dans
  le schéma `"campus"`. Une contrainte ajoutée à part va dans un bloc `DO $$ … EXCEPTION WHEN
  duplicate_object THEN null; END $$`. Instructions séparées par `--> statement-breakpoint`.
  **Aucune mise à jour des données existantes.**
- Les définitions Drizzle vont dans le schéma du chantier (§ 2) et doivent correspondre exactement au SQL.
  Ne lancez **pas** `npm run db:generate` dans un chantier (voir « Après la dernière fusion »).
- Ajoutez l'entrée au journal `migrations/meta/_journal.json`, à la suite :

  ```json
  { "idx": 26, "version": "7", "when": 1791460000000, "tag": "0026_envois_push", "breakpoints": true }
  ```

  `when` = `Date.now()` au moment où vous l'écrivez, supérieur à celui de la dernière entrée.

### Pourquoi c'est délicat

Le migrateur Drizzle (`drizzle-orm/pg-core/dialect.js`) ne joue une entrée que si son `when` est
**strictement supérieur** à celui de la dernière migration appliquée en base : une entrée mal rangée est
**sautée sans un mot** en production. Et une migration qui échoue empêche le campus de redémarrer, puisque
les migrations passent au démarrage, avant le serveur (et le service a un volume : l'ancien campus est
déjà arrêté).

### Garde-fou

`scripts/garde-migrations.mjs`, lancé par `npm run build` juste après `garde-service.mjs` (et seul :
`node scripts/garde-migrations.mjs`), arrête la construction avec un message en français si : les `idx` ne
se suivent pas depuis 0 ; un tag ne commence pas par son numéro sur 4 chiffres (égal à `idx`) ; une entrée
n'a pas son fichier `.sql` ou un `.sql` n'a pas d'entrée ; `when` n'est pas strictement croissant ; à partir
de 0026, un `CREATE TABLE`, `CREATE INDEX` ou `ADD COLUMN` n'a pas `IF NOT EXISTS`. La version en ligne
reste en place.

### Fusion (intégrateur)

1. `git fetch origin main && git merge origin/main` dans la branche du chantier.
2. Ranger les entrées du journal dans l'**ordre de fusion** (C3, C8, C1, C2, C7, C5, C4) : `idx` consécutifs.
3. Si l'ordre a changé, ou si une autre session (IA du soir) a déjà pris un numéro : renuméroter **fichier
   et tag** ensemble (`git mv migrations/0028_revision.sql migrations/0027_revision.sql`, puis le tag).
4. Mettre `when` de l'entrée fusionnée à `Date.now()` au moment de la fusion, donc au-dessus de tout ce que
   contient `main`.
5. `npx tsc --noEmit -p . && npm run build` : le garde-fou doit passer.
6. Jouer la migration deux fois sur une base locale (`npm run db:migrate:dev`, puis une seconde fois) :
   la seconde ne doit rien casser.

### Après la dernière fusion

1. `npm run db:generate` ; ne garder que l'instantané produit, renommé au dernier numéro
   (`migrations/meta/0032_snapshot.json`) ; supprimer le SQL et l'entrée de journal générés.
2. Relancer `npm run db:generate` : il ne doit plus rien produire (Drizzle et SQL concordent).
3. Jouer toutes les migrations deux fois : sur une base vide, puis sur une copie arrêtée à 0025.

## 6. Vérifier son chantier

- `cd campus && npx tsc --noEmit -p . && npm run build` (garde-fous compris).
- Écrans concernés à 360 px de large, étudiant tutoyé et personnel vouvoyé.
- Sans les autres chantiers (tables absentes) : le bloc se masque ou affiche « pas encore mesuré ».
- Un emplacement qui lève une erreur ne fait jamais disparaître la page.
