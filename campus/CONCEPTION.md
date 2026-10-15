# Campus numérique 2IAE — Conception

> « À 2IAE, on n'apprend pas seulement assis en classe comme dans le passé :
> on apprend avec les nouvelles méthodologies, notamment l'intelligence
> artificielle. » — le fondateur

Le campus numérique est une **entité à part** du site vitrine www.2iae.com :
c'est là que se passe la vie scolaire. Un formateur, en France ou ailleurs,
enseigne **en même temps** aux cinq salles de conférence du groupe (Riviera
Palmeraie, Yopougon, Yamoussoukro, Azaguié, M'Batto) et aux étudiants
connectés depuis leur téléphone ou leur ordinateur. Les étudiants y
retrouvent leurs cours, leurs devoirs, leurs interrogations, leurs notes,
leurs replays, et échangent avec leurs formateurs.

Ambition : **une simplicité déroutante**. Un étudiant qui n'a jamais utilisé
de campus numérique doit s'y retrouver tout de suite, sur un Android d'entrée
de gamme en 4G prépayée.

---

## 1. Principes directeurs

1. **Une page, une action évidente.** Chaque écran porte UN bouton principal
   orange qui dit la chose à faire (« Rejoindre le live », « Rendre mon
   devoir »). Pas de carrousel, pas de statistiques décoratives.
2. **Le téléphone d'abord.** Conçu pour un Android 2 Go de RAM en 3G/4G ;
   l'ordinateur est une version élargie. Texte courant ≥ 16 px, zones
   tactiles ≥ 48 px, barre d'onglets du bas à 5 entrées maximum.
3. **Chaque méga compte.** Écrans chargés à la demande ; aucune vidéo ne
   démarre seule ; le poids est affiché avant un téléchargement ; mode
   « données réduites » (live en audio + diapos) ; photos allégées avant
   l'envoi (`alleger()` dans `lib/api.ts`).
4. **Le réseau coupe, le campus continue.** Tout envoi important (devoir,
   message) passe par la file d'envoi hors ligne (`lib/file-envoi.ts`) et
   part tout seul au retour du réseau. Brouillons gardés sur le téléphone.
   Après une coupure en plein live : « Voici ce que tu as raté ».
5. **Prouver et rassurer.** Chaque dépôt donne un reçu numéroté et horodaté
   (« ✓ Rendu · reçu n° 2IAE-4F7K · 22 h 41 »). Deux coches comme sur
   WhatsApp : envoyé ✓, vu par le formateur ✓✓.
6. **Des mots de tous les jours** (lexique ci-dessous), tutoiement pour les
   étudiants, vouvoiement pour les formateurs et l'équipe.
7. **Aucun écran vide muet.** Chaque état vide dit ce qui apparaîtra ici,
   quand, et propose une action (`<EtatVide>`).
8. **Un humain à un toucher.** « Besoin d'aide ? » ouvre WhatsApp vers la
   vie scolaire du campus, message pré-rempli (`lienAide()` dans la coquille).
9. **La salle de conférence est un participant à part entière** : écran de
   salle en plein écran sans clic, code d'émargement tournant, main levée de
   salle, effectif déclaré, bouton « Incident ».
10. **L'IA propose, l'humain décide.** Tout ce que l'IA produit pour publier
    ou annoncer reste un brouillon marqué « Proposé par l'IA » tant qu'un
    humain ne l'a pas validé. **Exception décidée par José le 8 octobre 2026 :
    la correction des copies.** Les formateurs n'ont pas le temps de corriger
    des centaines de copies : le campus note seul les dépôts, à partir d'un
    corrigé que le formateur valide (message du jour) ou qui est tenu pour bon
    au bout de 24 h. La note compte comme une note de formateur, l'étudiant
    voit « Corrigé par le campus » et peut demander une relecture, le
    formateur peut changer toute note ; une copie douteuse (consigne cachée,
    pages illisibles, vidéo seule) n'est jamais notée seule (voir
    `shared/engagement/corrections.ts`).
    L'assistant fait apprendre (tuteur socratique sur les devoirs), se met
    en pause pendant les interrogations, cite ses sources (« Leçon 2.3 »),
    prend ses exemples en Côte d'Ivoire (FCFA, maquis d'Adjamé, cacao).
    Chaque fonction IA a un quota et un repli sans IA.
11. **Deux horloges, une vérité.** Tout est stocké en UTC ; affichage à
    l'heure d'Abidjan (GMT) ; le formateur voit aussi Paris
    (`heureDouble()` dans `lib/dates.ts`).
12. **Le collectif avant l'individu.** On compare les campus (Coupe des
    campus), jamais les étudiants publiquement.
13. **Campus et site avancent ensemble.** Cours, formateurs, lives et
    annonces portent une case « Annoncer sur 2iae.com » avec l'aperçu de la
    carte ; le site est prévenu aussitôt par webhook signé (`prevenirSite()`).
14. **Tout ce qui est sensible est tracé** dans la table `journal`
    (connexions, imports, notes modifiées, relevés partagés, publications).

### Lexique

| On dit | On ne dit jamais |
|---|---|
| Rendre, Envoyer, Revoir, En direct, Rappel, Code secret, Vie scolaire, Interrogation, Émargement, Salle de conférence, Replay, Salon du cours | upload, soumettre, session, login, notification push, synchroniser, streaming, dashboard, cohorte, LMS |

---

## 2. Identité visuelle (maquette Claude Design)

- Fond blanc, encre `#141414`, orange 2IAE `#E4793A` (surfaces et boutons, **texte encre dessus**, jamais blanc), orange foncé `#C85F22` pour les liens et étiquettes, crème `#FBF6F2` pour les panneaux, lignes `#EADFD5`.
- La salle live passe en **mode nuit** (`bg-nuit`, `nuit-panneau`, `nuit-carte`…), point rouge pulsant `#FF5A36` pour le direct.
- Titres Archivo 800–900 lettrage serré (`tracking-serre`), étiquettes IBM Plex Mono (`.etiquette`, `font-mono`).
- Composants communs dans `client/src/components/ui/` : `Bouton`, `LienBouton`, `Carte`, `CarteLien`, `Panneau`, `TitreSection`, `Champ`, `ZoneTexte`, `Selection`, `CaseACocher`, `Interrupteur`, `Badge`, `BadgeDirect`, `Avatar`, `BarreProgression`, `Squelette`, `Chargement`, `EtatVide`, `PastilleDate`, `Erreur`, `Chiffre`, `Fenetre` (feuille du bas sur téléphone), `Onglets`, `Menu`, `toast()`, `Markdown`, `CompteARebours`, `DecompteCourt`, `useMaintenant`.
- Mise en page : `Page`, `EnTetePage` (dans `components/layout/coquille.tsx`).

---

## 3. Architecture

```
campus/                     application indépendante (service Railway « campus »)
├─ shared/schema/*.ts       schéma Drizzle, tout dans le schéma PostgreSQL « campus »
├─ shared/api.ts            contrats d'API partagés (SeanceResume, EnCours, Vitrine…)
├─ server/
│  ├─ index.ts              Express : HTTPS, compression, session, SSE, routes
│  ├─ config.ts             variables d'environnement (toutes facultatives en dev)
│  ├─ db.ts auth.ts acces.ts http.ts fichiers.ts temps-reel.ts notifications.ts
│  ├─ ia.ts mail.ts site.ts taches.ts amorcage.ts demo.ts vite.ts
│  ├─ routes/<module>.ts    une fonction enregistrer<Module>(app) par module
│  └─ scripts/migrate.ts seed.ts
├─ client/src/
│  ├─ App.tsx               rassemble modules/*/routes.tsx (import.meta.glob)
│  ├─ lib/                  api, queryClient, auth, flux (SSE), dates, utils, file-envoi
│  ├─ components/ui|layout  design system et coquille
│  └─ modules/<module>/     pages et composants du module + routes.tsx
└─ migrations/              SQL généré par drizzle-kit
```

### Règles communes (serveur)

- Toute route passe par `route(async (req, res) => …)` et valide son corps avec `valider(schemaZod, req.body)`.
- Utilisateur courant : `moi(req)` après `exigerConnexion` ou `exigerRole(...)`.
- **Contrôle d'accès obligatoire** via `server/acces.ts` : `coursVisible`, `coursEnseigne`, `seanceVisible`, `devoirVisible`, `idsCoursAccessibles`, `etudiantsDuCours`, `formateursDuCours`. Un étudiant ne lit jamais la copie, la note ou le message d'un autre.
- Temps réel : `publier(canal, type, data)`, `publierUtilisateur(id, type, data)`, gardiens par préfixe (`enregistrerGardien("seance", async (u, cle) => …)`).
- Notifications : `notifier(ids, { type, titre, corps, lien })` (en base + temps réel + push).
- Fichiers : `POST /api/fichiers` (usage), lecture contrôlée `GET /api/fichiers/:id` ; chaque module enregistre son gardien (`enregistrerGardienFichier("rendu", …)`).
- IA : `demanderClaude`, `fluxClaude`, `demanderJson`, `verifierQuota`, `iaDisponible()` dans `server/ia.ts`. Toujours prévoir le repli quand `iaDisponible()` est faux.
- Tâches périodiques : `planifier(nom, ms, fn)` dans `server/taches.ts`.
- Site vitrine : `prevenirSite(raison)` dès qu'une publication change.
- Journal : `db.insert(journal).values({ utilisateurId, action, details })` pour les actions sensibles.
- Dates : colonnes `timestamp with time zone`, sérialisées en ISO.

### Règles communes (client)

- Données : TanStack Query avec l'URL comme clé (`useQuery({ queryKey: ["/api/cours", id] })` → GET `/api/cours/<id>`), mutations via `post/patch/put/suppr` puis `rafraichir("/api/…")`.
- Connecté : `useMoiConnecte()` ; rôles : `moi.role`.
- Temps réel : `useCanal("seance:12", (e) => …)`.
- Routes : chaque module exporte `routes: DefRoute[]` dans `modules/<module>/routes.tsx` avec `lazy(() => import("./PageX"))`. Motifs précis avant motifs génériques.
- Pages : `<Page><EnTetePage … /> … </Page>` ; `coquille: "plein-ecran"` pour le live, `"aucune"` pour les pages nues (connexion, écran de salle, fiches imprimables, relevé parent).
- Accessibilité : libellés sur les boutons-icônes, `aria-live` pour le direct, contraste AA.

---

## 4. Rôles

| Rôle | Qui | Accueil |
|---|---|---|
| `etudiant` | Étudiant d'une classe d'un site | `/accueil` |
| `formateur` | Formateur (souvent à distance) | `/enseigner` |
| `vie_scolaire` | Vie scolaire d'un site (surveillant, responsable de salle) | `/pilotage` |
| `admin` | Direction des études, direction générale | `/pilotage` |
| `salle` | Ordinateur branché à l'écran d'une salle de conférence | `/salle` |

**Profils de l'équipe** (rôle `vie_scolaire`) : Scolarité, Vie scolaire, Secrétariat / accueil, Responsable pédagogique, Chargé de cours, Chargé du campus. Chaque profil donne des droits ; la matrice unique est dans `shared/schema/ext-profils.ts` (`DROITS_PROFILS`), appliquée par le serveur (`peut`, `exigerDroit`, `droitSiEquipe`) et reprise par les menus. Le périmètre (un campus ou tout le groupe) s'ajoute partout (`perimetreSites`).

**Chargé du campus** (José, 14 octobre 2026 au soir : « chaque campus aura son propre accès ») : un compte par campus, pour la personne qui s'occupe des salles. Profil `campus`, droit unique `espace_campus`, un campus obligatoire (jamais « Tous les campus »). Accueil `/mon-campus` : un gros carré par cours, puis cinq gros blocs, puis l'écran de la salle du cours choisi. Code secret permanent, le même sur tous les ordinateurs du campus ; ni messagerie, ni cloche, ni pilotage, ni lien invité. Voir « Campus simple » (§11).

**Chargé de cours** (José, 14 octobre 2026) : la régie des cours en direct, à la place de la direction, pour tous les cours de son périmètre (tout le groupe par défaut, ou un campus choisi par la direction : alors les cours que suit ce campus, même partagés). Profil `charge_cours`, droit `animer`, créé par la direction dans Comptes (lien d'invitation comme les autres). Accueil « Mon espace » (`/regie`) : les cours du jour de tous les campus (heure, cours, formateur connecté ou non, campus et salles connectées, PowerPoint et vidéos prêts), un gros bouton « Ouvrir la classe » ou « Entrer dans le Studio », puis « Préparer » et « Lien intervenant » ; les jours suivants de la semaine dessous. Navigation : Mon espace, Emploi du temps, Messages. Dans le Studio du formateur (le même), repère « Vous faites la régie de ce cours · formateur : … », micro et caméra coupés en entrant : ouvrir et fermer la classe, diapos et vidéos avant et pendant le cours, projection (diapos, vidéos, copies sans note), parole et mains levées, sondages, discussion, groupes, Plan B, lien intervenant (copier, WhatsApp, au formateur directement quand son compte a un téléphone). Le formateur, s'il est là, garde toute la main ; les deux peuvent agir (le dernier geste l'emporte). Jamais : l'emploi du temps et la programmation d'une séance (horaire, titre, publication, Empêchement, Dupliquer, Supprimer, « C'était un essai », fiche de révision : `seanceProgrammee`), le devoir en direct, les notes, les dossiers, les paiements, les comptes, les présences nominatives et le bilan ; pas de messagerie avec les étudiants (ni annuaire, ni salons, ni signalements). Ouverture au plus tôt une heure avant le cours ; « Terminer » et Plan B seulement sur une classe ouverte (terminer un cours à venir reviendrait à l'annuler), « Terminer » pas avant le début du cours (« Rouvrir la classe » rattrape une fin par erreur) ; les copies seulement en direct (le corrigé seulement s'il est montrable en classe). Ni le suivi de la bibliothèque des étudiants, ni les pièces jointes hors de la classe (les fichiers passent par les gardiens de chaque usage). Dans « Mon espace », un cours commencé que personne n'a ouvert passe en tête, en rouge (« Pas encore ouverte »). Démarrage, fin, Plan B, diapos et vidéos déposées ou retirées, lien intervenant remis : au journal (`routes/regie.ts`, aussi pour la direction). Côté serveur, une seule règle : `regieCours` (`server/acces.ts`), utilisée par `seanceAnimee` et `roleDans` (`routes/live.ts`) ; le droit « programme » garde la régie comme avant. Le lien intervenant n'est remis qu'à qui fait la régie du cours (`GET /api/seances/:id/lien-intervenant`, journalisé ; le lien invité, sans micro, reste à l'équipe du périmètre) ; la radio des téléphones part d'un seul poste à la fois : un second poste attend sans couper le premier, sauf le formateur du cours, qui la reprend à une régie (la régie n'émet que si le son de la classe arrive sur son poste). Sur la visio du campus (secours), la régie n'entre pas dans la visio : message neutre, elle garde diapos, vidéos, parole et sondages. Dans la visio, elle apparaît « · régie ».

---

## 5. Modules et responsabilités

Chaque module possède ses fichiers ; il ne modifie pas ceux des autres.

| Module | Serveur | Client | Pages |
|---|---|---|---|
| **compte** | `routes/compte.ts` (+ `routes/auth.ts`) | `modules/compte` | `/connexion`, `/activer/:jeton`, `/mot-de-passe-oublie`, `/reinitialiser/:jeton`, `/bienvenue`, `/profil` |
| **accueil / agenda / annonces** | `routes/accueil.ts`, `routes/agenda.ts`, `routes/annonces.ts` | `modules/accueil`, `modules/agenda`, `modules/annonces` | `/accueil`, `/enseigner` (trois gros blocs), `/enseigner/mon-cours/:coursId`, `/enseigner/plus`, `/agenda`, `/annonces` |
| **cours** | `routes/cours.ts` | `modules/cours` | `/cours`, `/cours/:id`, `/cours/:id/lecons/:leconId`, `/enseigner/cours/:id` |
| **live** | `routes/live.ts` (+ `server/visio.ts`) | `modules/live` | `/direct`, `/live/:id`, `/replays/:id`, `/salle`, `/emargement/:code`, `/enseigner/seances/:id` |
| **évaluations** | `routes/evaluations.ts` | `modules/evaluations` | `/devoirs`, `/devoirs/:id`, `/quiz/:id`, `/notes`, `/corrections`, `/enseigner/devoirs/:id`, `/enseigner/devoirs/:id/copies` |
| **messages** | `routes/messages.ts` | `modules/messages` | `/messages`, `/messages/:id`, `/messages/cours/:coursId` |
| **pilotage** | `routes/admin.ts` | `modules/pilotage` | `/pilotage`, `/pilotage/comptes`, `/pilotage/comptes/import`, `/pilotage/fiches`, `/pilotage/classes`, `/pilotage/cours`, `/pilotage/planning`, `/pilotage/presences`, `/pilotage/annonces`, `/pilotage/site`, `/pilotage/suivi`, `/pilotage/etudiants/:id`, `/pilotage/ia`, `/releve/:jeton` |
| **ia** | `routes/ia.ts` | `modules/ia` | `/assistant`, `/assistant/:id` |
| **regie** | `routes/regie.ts` (+ `acces.ts` : `regieCours`) | `modules/regie` | `/regie` (« Mon espace » du Chargé de cours, « Régie des cours » de la direction) |
| **espace du campus** | `routes/espace-campus.ts` (+ `server/espace-campus.ts`) | `modules/espace-campus` | `/mon-campus`, `/mon-campus/cours/:coursId`, `…/live`, `…/lecons`, `…/resumes`, `…/examens`, `…/notes` (compte du campus ; la direction les ouvre avec `?site=`) |
| **vitrine / pwa** | `routes/public.ts`, `routes/push.ts` | `modules/vitrine`, `modules/pwa` | `/`, `/cours-ouverts/:slug`, `/formateurs/:slug`, `/hors-ligne` |

### Composants partagés entre modules (contrats fixes)

| Composant | Fichier | Propriétaire | Utilisé par |
|---|---|---|---|
| `SeancesDuCours({ coursId, enseignant })` | `modules/live/SeancesDuCours.tsx` | live | cours |
| `BandeauProchainLive()` | `modules/live/BandeauProchainLive.tsx` | live | accueil |
| `DevoirsDuCours({ coursId, enseignant })` | `modules/evaluations/DevoirsDuCours.tsx` | évaluations | cours |
| `BoutonAssistant({ coursId?, leconId?, devoirId?, variante? })` | `modules/ia/BoutonAssistant.tsx` | ia | cours, évaluations |
| `ActiverNotifications({ compact? })` | `modules/pwa/ActiverNotifications.tsx` | pwa | compte |
| `InviteInstallation()` | `modules/pwa/InviteInstallation.tsx` | pwa | compte, accueil |
| `enregistrerServiceWorker()` | `modules/pwa/service-worker.ts` | pwa | main.tsx |

### Contrats d'API entre modules

- `GET /api/live/en-cours` → `EnCours` (live) — utilisé par la coquille et l'accueil.
- `GET /api/notifications`, `GET /api/notifications/compteur` → `CompteurNotifications`, `POST /api/notifications/tout-lu`, `POST /api/notifications/:id/lu` (annonces) — utilisés par la coquille.
- `GET /api/seances?cours=:id` → `SeanceResume[]` (live).
- `GET /api/devoirs?cours=:id` (évaluations).
- `GET /api/public/vitrine` → `Vitrine` (vitrine) — lu par le site www.2iae.com.
- Salon d'un cours : `/messages/cours/:coursId` (messages) crée ou ouvre la conversation de type `cours`.

---

## 6. Fonctionnalités de la v1

### Compte et première connexion
- Connexion par **matricule, téléphone ou e-mail** + **code secret** (6 caractères minimum ; l'interface suggère « 6 chiffres comme pour Mobile Money »).
- **Fiche de connexion imprimée avec QR** : le QR ouvre `/activer/:jeton` (jeton d'activation à usage unique, table `reinitialisations`, type `activation`), connecte l'étudiant sans rien taper et l'emmène choisir son code secret.
- **Bienvenue en 3 étapes** : code secret → « Comment suis-tu les cours ? » (salle / téléphone / ordinateur, données réduites) → visite guidée (prochain cours, rendre un devoir, écrire à un prof) → **devoir d'essai** : photographier n'importe quelle feuille et recevoir le reçu vert « Bravo, tu sais rendre un devoir ». Puis rappels sur le téléphone et installation de l'appli.
- Code oublié : lien par e-mail si l'étudiant en a un ; sinon la vie scolaire de son site est prévenue et le bouton WhatsApp s'affiche.
- Profil : photo, téléphone, e-mail, préférences (données réduites, mode de suivi), rappels push, lien d'abonnement agenda, charte IA, changer son code.

### Accueil « Aujourd'hui »
- Étudiant : salutation, **une grande carte « À faire maintenant »** (live en cours → devoir dû sous 24 h → live dans moins de 2 h → message d'un formateur non lu → prochain devoir), puis 3 lignes au maximum, bandeau du prochain live, mes cours avec progression, annonce importante épinglée.
- Formateur (`/enseigner`, depuis le 15 octobre 2026) : **trois gros blocs** « Le cours », « Entrer dans le live », « Préparer le cours » pour le cours du jour (plusieurs cours : d'abord un gros carré par cours) ; « Plus » (`/enseigner/plus`) garde l'accueil détaillé d'avant : prochaine séance (préparer / ouvrir le studio), copies à corriger, questions restées sans réponse au dernier live, mes cours, messages.
- Agenda : « ma semaine en liste » (lives, échéances, événements), abonnement `.ics` personnel, « Ajouter à mon agenda » pour une séance, partager ma semaine sur WhatsApp.
- Annonces ciblées (tous / site / classe / cours), importantes, épinglées, accusés de lecture, partage WhatsApp.

### Cours
- Mes cours (progression), page du cours : Leçons · Séances & replays · Devoirs · Salon · À propos (formateur, objectifs).
- Leçon : Markdown, vidéo en « cliquer pour charger » avec poids estimé, fichiers avec taille, « J'ai terminé », leçon suivante, assistant.
- Éditeur formateur : informations, couleur, dates, image, **« Annoncer sur 2iae.com »** avec aperçu de la carte du site, classes et campus concernés, chapitres et leçons (ordre, publication), dépôt de fichiers.

### Classe en direct (le cœur)
- **Salle live** (mode nuit, maquette) : scène du formateur (Daily.co intégré ; repli Jitsi, lien externe ou scène de démonstration), vignettes des 5 salles, panneaux Questions votées · Campus · Assistant IA (sous-titres + résumé en direct), contrôles micro · caméra · main · ressenti · quitter.
- **Trois façons de suivre** : vidéo, **audio + diapos** (économie de données, diapos synchronisées ultra-légères), **mode compagnon** (étudiant présent en salle : pas de son, il vote, pose ses questions, répond aux sondages).
- **Studio du formateur** : file des mains levées par campus (signale les salles qui n'ont pas encore parlé), questions votées (répondue, épinglée, masquée), **sondage éclair** avec résultats par campus, **baromètre de compréhension** par campus, présences par salle, chrono et plan de séance, sous-titres par reconnaissance vocale du navigateur, **question éclair générée par l'IA** à partir des dix dernières minutes, **Plan B** en un clic (bascule vers un lien de secours).
- **Écran de salle** (`/salle`, kiosque) : avant le cours, compte à rebours géant et **carte des 5 campus qui s'allument** à mesure qu'ils se connectent ; **code d'émargement à 4 chiffres + QR qui changent chaque minute** et compteur d'émargés par campus ; pendant le cours, la visio en grand, « M'BATTO A LA PAROLE », résultats des sondages par campus ; contrôles du responsable : main levée de la salle, effectif, salle prête, **Incident**.
- **Écran du campus** (`/mon-campus/cours/:coursId/live`, compte du campus, 15 octobre 2026) : la personne choisit le cours, l'ordinateur devient l'écran de la salle pour ce cours (sans console ; deux boutons, « Ajouter » : PowerPoint et vidéos, et « Fermer » : fermer la salle, terminer le cours quand c'est sans danger) ; elle ouvre la salle à toute heure du jour du cours pour tester le son (le cours commence quand même à son heure) ; sans cours ce jour-là, la salle d'essai ; plusieurs ordinateurs du même compte font plusieurs salles (§11, « Campus simple » et « Campus simple, suite »).
- **Émargement** : QR (`/emargement/:code`) ou code tapé dans la salle live → « ✓ Présent · Yopougon ». Présence en ligne automatique par battements (tolérante aux coupures). Statuts : en salle, en ligne, partiel, absent, justifié, incident de salle.
- **Rattrapage après coupure** : « Voici ce que tu as raté » (sous-titres et questions de la période, résumé IA à la demande).
- Rappels automatiques 24 h et 15 min avant (notification + push) ; quand la classe s'ouvre d'elle-même (ouverture automatique, §11), l'avis d'ouverture remplace « Dans 15 min » : un seul rappel par étudiant.
- **Ouverture automatique** : chaque cours passe en direct tout seul 30 min avant son heure (réglable, §11) ; le cours, lui, commence à son heure (ou plus tôt sur « Commencer le cours maintenant »), et une classe que personne n'anime finit « Séance non tenue ».
- **Replay** : vidéo, fiche de révision (résumé IA validé par le formateur), transcription horodatée, questions posées, recherche dans la transcription (« Où a-t-il parlé de la TVA ? » → saut au bon moment), poids affiché.
- **Bilan de séance** pour le formateur : présences par campus, questions non traitées, baromètre, sondages ; « Générer la fiche de révision » → validation → envoi aux étudiants.
- À la sortie d'un live : « Ce cours t'a coûté environ 18 Mo » (estimation selon le mode).

### Devoirs, interrogations, notes
- Devoirs : À rendre / Rendus / Corrigés. Rendre en **photo** (appareil photo du téléphone), texte ou fichier ; brouillon local ; **file d'envoi hors ligne** ; **reçu de dépôt** ; remplacer sa copie avant l'échéance ; retard accepté ou non ; ✓✓ quand le formateur a ouvert la copie.
- Interrogations : une question par écran, gros boutons, chrono côté serveur, chaque réponse enregistrée aussitôt (reprise après coupure), correction automatique (QCM, choix multiple, vrai/faux, réponse courte), correction détaillée après l'échéance. **L'assistant IA est en pause pendant une interrogation.**
- Formateur : création de devoirs et d'interrogations, **génération de questions par l'IA** (brouillon), grille de correction, copies à corriger (rendus / en retard / non rendus), correction par critère, **commentaire vocal**, **corrigé du jour** à valider (sans réponse, tenu pour bon au bout de 24 h), **correction automatique des dépôts par le campus** d'après ce corrigé (décision du 8 octobre 2026, §1.10), copies « à revoir » et demandes de relecture, publication des notes.
- Carnet de notes : moyenne pondérée par cours pour l'étudiant ; vue par classe pour le formateur et l'équipe.

### Messages
- Comme WhatsApp : liste des conversations, bulles, ✓ envoyé / ✓✓ lu, photos, fichiers, **notes vocales**, temps réel, file d'envoi hors ligne.
- Conversations directes (étudiant ↔ formateurs de ses cours, ↔ vie scolaire de son site, ↔ direction, ↔ tout autre étudiant), **salon de chaque cours**, salon de classe. Contexte automatique quand on écrit depuis un devoir ou une leçon.

### Pilotage (vie scolaire et direction)
- Tableau de bord multi-campus : comptes activés, présence aux lives, devoirs rendus, **« Qui décroche ? »** (aucune connexion depuis 7 jours, absences répétées, devoirs non rendus) avec actions (WhatsApp, dossier, note de suivi).
- Comptes : liste, recherche, création, **import en collant depuis Excel ou CSV** (aperçu et erreurs), réinitialisation du code (partage WhatsApp), désactivation ; profils formateurs (« Annoncer sur 2iae.com »).
- **Fiches de connexion imprimables** avec QR d'activation.
- Classes, cours (formateur, classes), **planning** des lives de la semaine avec conflits de salle, présences par séance et par étudiant (justifier, export CSV), annonces ciblées avec accusés de lecture.
- **Site 2iae.com** : ce qui est publié en ce moment (cours, formateurs, lives, annonces), aperçu des cartes, interrupteurs, « Prévenir le site maintenant ».
- **Dossier étudiant** sur une page (présences, devoirs, notes, suivis) et **relevé partageable aux parents** par lien (`/releve/:jeton`, révocable).
- Budget IA : consommation par jour et par personne.

### Assistant IA
- `/assistant` : conversation en flux, choix du cours, réponses ancrées sur les leçons et les séances du cours avec citations, exemples ivoiriens, **tuteur socratique** sur les devoirs, pause pendant les interrogations, quota quotidien, dictée vocale, « Écouter » la réponse.
- Sur une leçon : « L'essentiel en 5 points », « Explique autrement », « Me faire réviser » (5 questions).
- Formateur : préparation de séance (plan, sondages, QCM de sortie), accroche pour le site.
- Charte IA visible (ce que fait l'assistant, ce qu'il ne fait pas, confidentialité).

### Vitrine et application
- Accueil public du campus (maquette : « Un cours. Cinq campus. En direct. », prochain live avec compte à rebours, les 5 salles, suivre depuis le téléphone / l'ordinateur / la salle, formateurs, cours à venir).
- Pages publiques cours et formateur (aperçus WhatsApp via balises Open Graph injectées côté serveur).
- `GET /api/public/vitrine` pour le site.
- PWA installable : manifeste, icônes, service worker (coquille hors ligne, dernières données consultées, notifications push, synchronisation de la file d'envoi).

---

## 7. Lien avec le site www.2iae.com

- Le campus expose `GET /api/public/vitrine` (type `Vitrine` dans `shared/api.ts`) : cours annoncés, formateurs annoncés, lives publics à venir (et celui en cours), annonces publiques, chiffres.
- Tout est piloté par des cases à cocher côté campus : `cours.publierSurSite`, `utilisateurs.publierSurSite` (formateurs), `seances.publierSurSite`, `annonces.publierSurSite`.
- À chaque changement, le campus appelle `POST <SITE_WEBHOOK_URL>/api/campus/rafraichir` signé HMAC-SHA256 (`X-Campus-Signature: sha256=<hex>`, secret `CAMPUS_WEBHOOK_SECRET` partagé).
- Le site garde la vitrine en cache (5 min, et la dernière version connue si le campus est injoignable), et affiche : bandeau « ● En direct sur le campus numérique » ou « Bientôt », section d'accueil « Au campus numérique », page `/campus-numerique` avec cours, formateurs et lives, fiches cours et formateur, lien « Campus numérique » de l'en-tête vers l'adresse du campus.

---

## 8. Déploiement (Railway, même projet « Groupe 2iae »)

- Service `campus` créé dans le projet existant, **Root Directory `/campus`** (dépôt monorepo), `railway.json` du dossier : build `npm run build`, pré-déploiement `npm run db:migrate`, santé `/api/health`.
- Base : un PostgreSQL dédié au campus dans le même projet (isolation des données scolaires) ; le schéma « campus » permet aussi de partager la base du site sans collision.
- Volume monté sur `/data` et `UPLOADS_DIR=/data/uploads` pour les devoirs rendus et les ressources.
- Variables : voir `.env.example`.

---

## 9. Décisions tranchées après la revue critique

1. **Onglets** : Aujourd'hui · Cours · Live · Devoirs · Messages (étudiant). Les replays vivent dans Cours et dans « Déjà passés » du Live ; le profil est dans l'avatar.
2. **Identité** : le **matricule** est l'identifiant unique ; le téléphone n'est pas unique (téléphones partagés). Connexion par téléphone seulement s'il ne correspond qu'à un compte, sinon on demande le matricule.
3. **Activation** : fiche imprimée avec **QR (jeton à usage unique) et code provisoire à 6 chiffres**, valables 30 jours (`motDePasseExpireLe`). Codes triviaux refusés (`codeSecretAcceptable`). Code secret ≥ 6 caractères pour les étudiants, ≥ 10 pour le personnel.
4. **Sessions** : 90 jours glissants pour les étudiants et les écrans de salle, 30 jours pour le personnel ; case « Téléphone partagé » = session effacée à la fermeture du navigateur. Changer son code ferme les autres sessions. Verrouillage par compte (5 essais / 15 min), par adresse IP et limite globale.
5. **Périmètres** : la direction (`admin`) voit tout le groupe ; la vie scolaire rattachée à un site ne voit et n'agit que sur son site (`perimetreSites(u)` dans `server/auth.ts`, à appliquer dans toutes les requêtes du pilotage) ; le formateur voit ses cours ; l'écran de salle n'affiche aucune donnée nominative (questions signées « Yopougon », jamais par un nom).
6. **Code d'émargement** : 4 chiffres par salle, renouvelés toutes les 60 s (la fenêtre précédente reste acceptée), affichés en très grand avec un QR contenant le même code. Refusé hors connexion. Le pointage du responsable de salle fait foi ; l'écart avec l'effectif déclaré est signalé.
7. **Présence en ligne** : présent à partir de **70 %** de la durée (réglable). Statuts : présent en salle, présent en ligne, retard, partiel, absent, absent justifié, incident de salle. « Revu en replay » est suivi à part et ne vaut jamais présence.
8. **Étudiant en ligne** : peut recevoir la parole en **audio seulement** ; pas de caméra étudiante en v1.
9. **Planification** : la vie scolaire réserve les salles ; le formateur est autonome sur le contenu et le live et peut créer/proposer un créneau ; les conflits de salle sont signalés.
10. **Publication sur le site** : ce que coche un formateur passe en **« proposé »** (`proposeSurSite`) ; la direction valide en un clic (`publierSurSite`) ; la fiche d'un formateur n'est publiée qu'avec son **consentement** (`consentementSite`, révocable) ; les lives passés disparaissent seuls.
11. **Messagerie** : conversations directes étudiant ↔ formateurs de ses cours, ↔ vie scolaire de son site, ↔ direction, et **étudiant ↔ étudiant** (tous les étudiants actifs, tous campus : décision de la direction, octobre 2026 ; recherche par nom à partir de deux lettres, qui n'affiche que le nom, la photo, le campus et la classe, jamais le matricule, l'e-mail ni le téléphone). Garde-fous : « Bloquer » entre étudiants (plus aucun message dans un sens ni dans l'autre, l'autre n'est pas prévenu), « Signaler » un message (vie scolaire du campus prévenue), 20 nouvelles conversations entre étudiants par heure au plus. Jamais d'écriture vers un écran de salle ni un compte désactivé. **« Questions du cours »** (salon modéré par le formateur, bouton « Signaler », masquage) ; annonces.
12. **Retards** : l'heure de réception par le serveur fait foi ; l'heure « préparé hors ligne » est affichée à titre indicatif ; le formateur décide (retard accepté ou non par devoir). Chrono des interrogations tenu par le serveur.
13. **Horloge** : toute logique horaire côté client utilise l'heure du serveur (`maintenantServeur()` dans `lib/horloge.ts`, déjà branché dans `useMaintenant`).
14. **Consommation affichée honnêtement** : mode compagnon (en salle) < 5 Mo/h ; son + diapos (radio du cours, §10) ≈ 12 à 15 Mo/h ; vidéo 150 à 250 Mo/h. Afficher la consommation **mesurée** quand c'est possible (`getNetworkStats()` de Daily), jamais une promesse.
15. **IA** : aucun nom d'étudiant dans les prompts ; supports et copies traités comme des données non fiables (injection de prompt) ; le modèle n'a aucun outil qui écrit en base ; tout résultat IA qui touche une publication ou une annonce est un brouillon à valider ; les notes des dépôts suivent la règle du §1.10 (corrigé validé ou tacite, copie douteuse jamais notée seule). Sous-titres par la reconnaissance vocale du navigateur du formateur (option « bêta »), résumé à la demande et en fin de séance (pas en continu).
16. **Push** : 3 par jour au maximum hors rappels de live, heures calmes 21 h–6 h (Abidjan), contenu sensible masqué (« Nouvelle note disponible », jamais la note).
17. **Données personnelles** : charte acceptée à l'activation (`charteAccepteeLe`), mention d'enregistrement affichée en salle, seuls des agrégats et des contenus validés partent vers le site. Déclaration ARTCI et accords de sous-traitance (hébergement, IA, visio hors Côte d'Ivoire) à engager par l'école.
18. **Hors v1** (données captées dès maintenant, écrans en v1.1) : WhatsApp Business / SMS automatiques, replays audio compressés hors ligne, transcription serveur, pré-correction IA des copies manuscrites, carte de la semaine en image, TOTP, relevé d'heures des formateurs, bascule d'année scolaire.

---

## 10. La classe en direct : trois couches de diffusion

La visio doit marcher **dès le premier jour, même sans compte chez un
fournisseur**, et rester supportable en 3G/4G. Trois couches coexistent :

| Couche | Pour qui | Technique | Consommation | Configuration |
|---|---|---|---|---|
| **Daily.co** (fournisseur principal) | formateur ↔ 5 salles, étudiants en vidéo | visio SFU hébergée (`@daily-co/daily-js`, salles privées `campus-2iae-<id>`, jetons par rôle, enregistrement cloud → replay) | vidéo 150–250 Mo/h | `DAILY_API_KEY` |
| **Visio intégrée « campus »** (repli / Plan B) | formateur ↔ 5 salles (+ quelques étudiants) | WebRTC pair-à-pair en étoile autour du formateur, signalisation par le temps réel du campus, relais de la parole par le navigateur du formateur | idem vidéo ; son seul ≈ 20 Mo/h | aucune ; `TURN_URLS`/`TURN_USERNAME`/`TURN_CREDENTIAL` recommandés pour les réseaux mobiles |
| **Radio du cours** (tous fournisseurs) | étudiants en ligne en 3G/4G, jusqu'à des centaines | son du formateur (WebM/Opus 24 kbit/s) envoyé au serveur par tranches d'une seconde et rediffusé en flux HTTP, + diapos synchronisées + sous-titres | ≈ 12 à 15 Mo/h (affiché partout ainsi) | aucune |

Le mode compagnon (étudiant présent en salle) ne consomme presque rien
(< 5 Mo/h) : ni son ni image, seulement questions, votes, sondages et
ressenti. L'écran de la salle de conférence rejoint la visio comme un
participant « Salle … » avec la caméra et le micro de la salle.

## 11. Passage au réel (26 septembre 2026)

La première session réelle commence le lundi 28 septembre 2026 (tronc commun 1BTS / 2BTS : Initiation à l'IA le lundi et le vendredi, Marketing digital le mercredi, séminaire le samedi). Décisions :

- **Plus de démonstration** : CAMPUS_DEMO faux par défaut ; purge unique en production par CAMPUS_PURGER_DEMO=oui ; aucun écran ne cite de personne inventée.
- **Le vrai logo** du Groupe écoles 2IAE partout (marque-2iae.png, marque-2iae-detouree.png pour les fonds sombres, logo-2iae.png pour les documents).
- **Emploi du temps** (module programme) : une session, des créneaux hebdomadaires, la publication engendre les séances live ; il se voit sur le site public (/programme), dans l'espace étudiant et formateur (/emploi-du-temps), à l'impression (fac-similé du document du service des études) et sur 2iae.com.
- **Un vrai site public** multi-pages (programme, cours, formateurs, campus, le direct, questions, à propos, contact, confidentialité), éditable depuis « Site public » du back-office, avec du contenu réel par défaut.
- **Visio** : Daily par défaut, salle d'essai permanente, répétition dans la salle d'une séance, direct immédiat, pré-tests réseau, fuseau horaire du formateur (« 08:30 Abidjan · 04:30 chez vous »).
- **Rentrée** : une liste de contrôle en direct pour la direction (campus, écrans de salle, formateurs activés, programme publié, étudiants importés, essais visio).
- **Présentations des formateurs (module showreel)** : 30 secondes animées dans le navigateur (léger pour la 3G), en tête de la fiche publique /formateurs/:slug et en plein écran sur /formateurs/:slug/presentation. Le formateur colle ses liens ou dépose le PDF de son profil LinkedIn (LinkedIn ne se laisse pas lire automatiquement), l'IA compose uniquement à partir de ces sources (chaque plan garde son extrait), le formateur relit et valide (consentement), la direction publie ; la version en ligne reste figée jusqu'à la publication suivante. Sans IA, un compositeur de secours part du profil et de l'emploi du temps.
- **Salles parallèles (12 octobre 2026)** : un campus peut avoir plusieurs salles de conférence, chacune avec son écran (un compte « salle »), son lien d'installation, son nom et un public facultatif, L1 (classes 1BTS) ou L2 (classes 2BTS) ; chaque cours se tient dans UNE salle du campus : un cours de L1 dans la salle L1, de L2 dans la salle L2, un cours commun dans la salle sans public, sinon la salle 1 (`shared/salles.ts` : salleDuCours, `server/salles-outils.ts`). Un seul écran par campus et par séance : parole, effectif, émargement et groupes, rangés par campus, restent justes. Réglage dans « Classes et campus » ou directement dans « Les salles du jour », qui signale un cours sans salle ou deux cours à la même heure dans une salle ; chaque jour, « Les salles du jour » (`/pilotage/salles`) prépare un message WhatsApp par salle (« Riviera · L1 · Salle de conférence 1 », puis « Mardi 13 octobre, 8h30-12h30 : Art oratoire, M. Dianda », une ligne par cours, puis « Écran de la salle : » et son lien, ou « déjà installé » ; jamais le code ; pas de message pour une salle sans cours, ni pour une salle dont l'écran est à installer sans lien : « Préparez d'abord le lien de l'écran »), envoyé d'un toucher (wa.me) au coordinateur des salles, qui le transfère au responsable de la salle. Son numéro (par défaut +225 07 07 72 09 40) se règle sur la page par la direction (contenus_site, clé « pilotage.salles ») ; repère « Envoyé » gardé dans le navigateur, par jour, salle et contenu du message (un message modifié redevient à envoyer) ; le site public écarte ces clés (date du site, sitemap). Le campus n'a pas accès à l'API WhatsApp : chaque jour à 6 h 30 (Abidjan), s'il y a des messages, chaque compte de la direction reçoit le rappel « Les liens des salles du jour sont prêts » (une seule fois par jour, réservé en base : clé « pilotage.salles.rappel » ; jour rendu si l'envoi échoue). Depuis le 15 octobre 2026, chaque campus a aussi son compte (« Campus simple ») : sur l'écran du campus, c'est la personne qui choisit le cours, et chaque ordinateur ouvert avec ce compte compte comme une salle ; les anciens écrans « salle » et leurs liens marchent toujours.
- **Ouverture automatique des classes (14 octobre 2026)** : à la demande de José (« Par défaut ouvre automatiquement tous les cours 30 mn avant »), chaque séance prévue d'un cours publié passe d'elle-même en direct N minutes avant son heure, tant qu'il reste au moins 15 min de cours (tâche « live-ouverture-auto », chaque minute, `server/routes/live.ts`) : les écrans des salles quittent la salle d'attente et règlent le son et l'image (code d'émargement et QR en grand jusqu'au début du cours), les étudiants peuvent entrer, le formateur trouve sa classe ouverte (« Entrer dans ma classe »). N = 30 par défaut ; la direction coupe ou choisit 15, 30, 45 ou 60 min dans « Pilotage · visio » (contenus_site, clé « pilotage.ouverture-auto », jamais servie au site public). Même code que « Démarrer » (passerEnDirect puis suitesDuDemarrage : mise à jour atomique, « demarrage » consigné avec { auto: true } dans la même transaction, statut publié, bandeaux, site prévenu, journal « live_ouvert_auto »). La séance garde `ouverture_auto`, `debut_cours` et `animateur_le` (migration 0036). Un seul rappel par étudiant (D3), qui dit « La classe est ouverte · le cours commence à 08h30 (heure d'Abidjan) » (ouverte après l'heure, au redémarrage du serveur par exemple : « le cours devait commencer à 08h30, le formateur arrive »), sans second rappel à l'heure ni après « C'était un essai » ; les formateurs du cours reçoivent « Votre classe est ouverte : les salles s'installent, le cours commence à 08h30 » (heure de chez eux aussi). Garde-fous : une seule ouverture par séance et par horaire (repère « ouverture-auto » de rappels_live, dans la même transaction ; effacé quand la séance change d'horaire) ; « C'était un essai » dans l'heure qui précède le cours pose ce repère (pas de réouverture aussitôt : le formateur démarre lui-même) ; jamais tant qu'une autre séance du même cours est en direct. **Qui anime** : le formateur du cours dès qu'il ouvre son Studio ou entre dans la visio ; la direction ou la vie scolaire seulement sur « Je prends la classe », « Commencer le cours maintenant » ou un geste d'animation (diapo, parole, sondage) (regarder le Studio ou un écran de salle ne compte pas ; un écran de salle entre toujours comme une salle, sans enregistrer). Tant que personne n'anime, l'heure passée : « En attente du formateur » (sans chrono ni « REC »), « Le formateur arrive » sur l'écran des salles, mention dans « En direct en ce moment » et « Les salles du jour » ; sans personne jusqu'à 30 min après la fin prévue (10 min s'il reste au plus une personne connectée : fermeture logique, « Campus simple »), la classe finit « Séance non tenue » (démarrage effacé, ni présents ni absents). **Une classe ouverte automatiquement n'avance pas le cours** (`debutDuCours`, `shared/ouverture.ts`, et `sqlDebutCours` côté SQL : `debut_cours`, sinon le démarrage réel) : le cours commence à l'heure prévue, ou plus tôt si l'animateur appuie sur « Commencer le cours maintenant », ou à l'arrivée d'un formateur en retard ; retards (15 min après le début du cours), minutes de présence et seuil des 70 %, fin du cours (attendus, échéance « fin du cours » d'un devoir en direct, fin automatique), baromètre, moments du QR d'émargement (début, +15, +45), chrono du Studio, transcription, moments et enregistrement du replay en partent (jeton Daily sans enregistrement avant ; le Studio le lance au début du cours). Un « Démarrer » à la main, même 20 minutes avant l'heure, garde son démarrage comme début du cours, comme avant : le formateur a commencé.
- **Salles occupées, lien intervenant et régie (14 octobre 2026, avec le Chargé de cours)** : deux règles de José s'ajoutent à l'ouverture automatique (la première, barrée, est annulée). ~~(1) « Laisse-les fermer, ne force pas la fermeture » : l'ouverture automatique ne ferme jamais un cours, et n'ouvre pas un cours tant qu'un autre cours en direct occupe une de ses salles de conférence (même campus, même salle selon `salleDuCours`, `shared/salles.ts` ; par exemple Anglais commun L1 + L2 en salle 1 jusqu'à 12h30, puis Marketing digital commun à 13h00 dans la même salle 1 : Marketing s'ouvre dès que le formateur d'Anglais a fermé sa classe, la fin réveillant la tâche, s'il reste au moins 15 min de cours). Un cours suivi par plusieurs campus s'ouvre quand AUCUNE de ses salles n'est occupée : une salle libre ailleurs n'est pas une raison d'ouvrir partiellement (une classe est en direct dans tous ses campus à la fois). Un essai de visio (direct immédiat sans étudiants prévenus) n'occupe pas de salle. Classe abandonnée qui retient la salle (formateur parti sans « Terminer », page de l'intervenant fermée) : la fin automatique la clôt sans attendre ses 30 min ni les onglets d'étudiants restés ouverts, dès que sa fin est passée (fin prévue, ou comptée depuis le début du cours si plus tardive) et que personne ne l'anime depuis 10 min (trois passages de la fin automatique de suite, toutes les 5 min) ; une classe ouverte automatiquement que personne n'a jamais animée finit « Séance non tenue » dès sa fin prévue. Seulement quand un cours attend cette salle (ou une autre séance du même cours) pour s'ouvrir automatiquement. Un formateur qui déborde, dans son Studio ou par le lien intervenant, n'est jamais coupé : c'est la fin d'une classe que personne n'anime plus, pas une fermeture forcée (décision à confirmer avec José). La direction ou le chargé de cours peut aussi la fermer (« Terminer »), et le cours suivant s'ouvre aussitôt. Quand deux classes sont en direct dans la même salle (un formateur démarre la sienne à la main), l'écran de la salle préfère celle qui n'est pas abandonnée. Le Studio d'un cours qui attend sa salle le dit (« Anglais commun est encore en direct (Riviera · Salle de conférence 1) »), et « Mon espace » aussi (« En attente de la salle », lien vers la classe qui l'occupe, « Ouvrir quand même » seulement après confirmation). Juste après un redémarrage du serveur (mise en ligne, plantage), la fin automatique ne clôt aucune classe en direct pendant 2 min : les Studios et les pages des intervenants se reconnectent (leur présence n'est gardée qu'en mémoire). Pendant l'attente, ni « Dans 15 min » ni rappel du jour (l'avis d'ouverture reste le seul rappel) : il part à l'ouverture, avec « le cours devait commencer à … » si l'heure est passée.~~ *Annulé par José le 14 octobre au soir : l'ouverture automatique ne regarde plus les salles et la classe qui retenait la salle se ferme par la fermeture logique (voir « Campus simple », ci-dessous).* (2) **Le lien intervenant anime** : des formateurs entrent souvent par le lien intervenant (sans compte, mot de passe oublié). La personne entrée dans la visio par le lien intervenant d'une séance compte comme animateur arrivé (`animateur_le`, « arrivee » marquée « lien intervenant » dans le bilan) : plus « En attente du formateur », jamais « Séance non tenue » ; sa télécommande des diapos aussi. Sa page se signale toutes les 30 s tant que sa visio est connectée (`POST /api/invite/:jeton/present`) : la fin automatique le voit présent, et s'il est entré avant l'ouverture (visio ouverte 30 min avant), son arrivée est notée dès que la classe s'ouvre. Le cours commencé, il le termine lui-même (« Terminer le cours » de sa page, confirmé ; `POST /api/invite/:jeton/terminer`, consigné « par l'intervenant ») : la fin libère ses salles pour le cours suivant. Refusé avant le début du cours, et quand un animateur avec un compte est dans la classe (formateur dans son Studio, régie qui a pris la classe) : c'est lui qui termine, un invité qui parle ne coupe pas la classe d'un autre. Dans « Mon espace », le formateur entré par ce lien est dit « connecté (lien intervenant) ». Le cours commence à son arrivée si l'heure prévue est passée, sinon à l'heure prévue. Sa parole passe par la visio (Daily), sans requête au campus : son entrée suffit. **Limite** : son lien ne le rend pas propriétaire de la visio, il ne lance donc pas l'enregistrement Daily ; un Studio ouvert sur la classe (formateur, direction, chargé de cours) le lance au début du cours. Sans aucun Studio ouvert, pas de replay. De même, les gestes explicites du chargé de cours comptent comme arrivée, comme pour la direction : « Ouvrir la classe », « Je prends la classe », « Commencer le cours maintenant », diapo, parole, sondage, vidéo ou copie projetée (regarder ne compte pas). **Régie qui ouvre avant l'heure** : « Ouvrir la classe » par la régie de l'équipe (chargé de cours, vie scolaire ; au plus tôt une heure avant, la même borne que l'ouverture automatique, `AVANCE_MAX_OUVERTURE_MIN`) fait comme l'ouverture automatique : les salles s'installent, le cours commence à l'heure prévue (`debut_cours` : retards, chrono, enregistrement), les étudiants lisent « La classe est ouverte · le cours commence à 08h30 » ; la personne qui ouvre est là, la classe n'attend personne. La direction et le formateur qui appuient sur « Démarrer » avant l'heure commencent le cours tout de suite, comme avant. Une classe ouverte automatiquement est toujours dans la fenêtre du chargé de cours : il la prend (« Je prends la classe »). Dans « Mon espace », une classe ouverte automatiquement que personne n'anime, l'heure passée, s'affiche « En attente du formateur » en rouge ; un cours à venir annonce l'heure de son ouverture automatique (« Ouverture automatique à 16h25 », et « Vous pourrez aussi l'ouvrir vous-même dès 15h55 » pour le chargé de cours). **Fermer avant l'heure** : le chargé de cours (régie seule) ne termine pas une classe dont le cours n'a pas commencé (ouverte automatiquement ou par lui, les salles s'installent) : elle compterait comme tenue, ne se rouvrirait plus d'elle-même, et « C'était un essai » relève de la programmation. Une classe qu'il a fermée trop tôt, par erreur, se rouvre (« Rouvrir la classe » dans le Studio et dans « Mon espace », tant que sa fin prévue n'est pas passée et moins de 2 h après la fin).

- **Campus simple (15 octobre 2026)** : José, le 14 octobre au soir, après une journée difficile (des personnes n'arrivaient pas à se connecter, des salles étaient sur le mauvais cours) : « On va simplifier tout. » Trois décisions.
  - **Un compte par campus**, géré par le chargé du campus (profil `campus`, rôle `vie_scolaire`, droit unique `espace_campus`, un campus obligatoire ; `shared/schema/ext-profils.ts` : `estProfilCampus`, `estEcran`). La direction le crée dans Comptes : un **code secret permanent** (sans date de fin ni changement forcé, haché, montré une fois : `codePermanentCampus`, `server/activation.ts`), et un message prêt à envoyer (lien `/mon-campus`, e-mail, code ; « Le même code marche sur tous les ordinateurs du campus »). « Nouveau code » déconnecte tous les ordinateurs du campus : leur page revient d'elle-même à « Espace du campus » (« Cet ordinateur a été déconnecté. Tapez le code secret. »), puis au cours qu'elle montrait (toute requête qui reçoit 401 fait relire la session : `lib/queryClient.ts`). « Envoyer plutôt un lien d'invitation » reste possible (la personne choisit alors son « code secret » une fois). Le compte ne change pas lui-même son code, ne ferme pas les autres ordinateurs et ne change pas son e-mail (403 « Le code du campus est donné par la direction. ») : seule la direction donne un nouveau code. Ni messagerie, ni cloche, ni guide par e-mail, ni lien invité, ni double casquette, ni pilotage, ni assistant IA, ni bibliothèque : **refus par défaut** côté serveur (`server/campus-filtre.ts`, avant toutes les routes : seuls son espace, la classe qu'il montre comme l'écran d'une salle, les leçons et résumés de ses cours, la connexion, le temps réel et les fichiers passent) et côté client (toute autre page renvoie à `/mon-campus`). Ses cours : seulement les cours publiés suivis par une classe de son campus (`acces.ts` : ni brouillons, ni cours sans classe). Le lien `/mon-campus` ouvert sur un ordinateur encore connecté avec un autre compte (l'ancien écran « salle », un formateur…) : « Cet ordinateur est ouvert avec un autre compte. » et un gros bouton « Entrer avec le compte du campus » (déconnexion, puis « Espace du campus »). « Se déconnecter » revient aussi à « Espace du campus ». Connexion simplifiée (« Espace du campus », e-mail et code secret) quand on arrive par `/mon-campus`. Pages nues (coquille « aucune »), textes de tous les jours dans `shared/textes/campus.ts` (jamais « visio », « session », « régie »… ; au plus 12 mots par phrase), texte d'au moins 20 px, blocs d'au moins 120 px, couleur du cours foncée jusqu'au contraste AA (`couleurLisible`, `modules/cours/outils.ts`).
  - **Les pages du campus** (`server/routes/espace-campus.ts`, `server/espace-campus.ts`, `shared/espace-campus.ts`, `client/src/modules/espace-campus`) : `/mon-campus`, un gros carré par cours que suit le campus (`anneesDesCoursDuSite`), le cours en direct d'abord, puis la salle ouverte, puis les cours du jour par heure (repère blanc : « En direct maintenant », « Salle ouverte · début à 8h30 », « Aujourd'hui à 9h50 ») ; `/mon-campus/cours/:id`, cinq gros blocs : « Entrer dans le live » (orange, vert en direct), « Les cours » (leçons publiées, chaque leçon lue dans l'espace : `/mon-campus/cours/:id/lecons/:leconId`, texte en 20 px, « Leçon suivante »), « Les résumés de cours » (cours complets prêts, lus dans l'espace : `…/resumes/:seanceId`, le cours en résumé, à retenir, les idées, les fiches ; ni onglets, ni médiathèque, ni replay), « Les examens » (devoirs publiés, copies rendues au campus), « Les notes » (notes publiées des étudiants du campus, lecture seule : `notesPubliees`, `routes/evaluations.ts`). Sous le nom de chaque carré, les classes du campus qui suivent le cours (« 1BTS · 2BTS »). Sans live aujourd'hui (fini, annulé, pas de séance), le bloc « Entrer dans le live » est grisé (« Le cours est fini »), sans plein écran. Un cours que le campus ne suit pas : 404. La direction voit les mêmes pages avec `?site=` (bandeau « Aperçu »). Titres avec élision (« Campus d'Azaguié » : `deCampus`).
  - **L'écran du campus** (`/mon-campus/cours/:id/live`) : toucher « Entrer dans le live » met en plein écran et l'ordinateur devient l'écran de la salle pour CE cours (`EcranSeance` de `modules/live/PageSalle.tsx` en mode campus : ni console, ni « Présentation seule », un seul bouton discret « Quitter », confirmé). Avant le cours : « Le cours commence à 9h50 : la salle s'ouvrira toute seule à 9h20 », et dès 1 h avant, un gros bouton « Ouvrir le cours » (`POST /api/mon-campus/seances/:id/ouvrir` → `ouvrirCommeAuto`, `routes/live.ts`) : exactement l'ouverture automatique (la classe attend son formateur, le cours commence à l'heure prévue, journal « live_ouvert_campus ») ; trop tôt : 409 « trop_tot » ; le même cours déjà en direct dans une autre séance d'un autre horaire : 409 (une séance précédente du même cours, finie et que personne n'anime, ne cache pas la suivante : l'écran montre la séance qui vient, « la salle s'ouvre juste après »). Deux séances du même cours à la même heure (deux sessions) : la personne choisit (« 11h00 · 1BTS », plus le titre, le formateur ou « 2e groupe » quand les deux se ressemblent) ; chacune s'ouvre (l'ouverture automatique n'ouvre que la première, un seul rappel aux étudiants du cours ; l'autre écran affiche alors « Vous pourrez ouvrir la salle à … » et son bouton). Le conseil « Laissez cet écran ouvert pendant le cours. » est en haut, visible même sur un vieil ordinateur (1024×600 : la page défile au lieu de couper). Après un rechargement de la page (ou un ordinateur rallumé), un bandeau jaune « Touchez l'écran pour reprendre le cours. » en haut, qui ne cache ni la vidéo, ni le QR, ni le code : le premier toucher, n'importe où, relance le plein écran et le son (le navigateur l'exige) ; le cours reste le même (il est dans l'adresse). **Plusieurs ordinateurs, un seul compte** : chaque ordinateur est un poste (compte et session : `postesSur`, `server/temps-reel.ts`) et compte comme une salle partout (`estEcran` : place dans la visio « Salle de conférence · Yamoussoukro », parole, mains levées, effectif, groupes, radio, devoir en direct) ; à Yamoussoukro, un ordinateur peut montrer Anglais et l'autre Marketing ; deux ordinateurs sur le même cours : pastille « Un autre ordinateur de Yamoussoukro montre ce cours. Même salle ? Fermez-en un. ». Les anciens comptes « salle » (`/salle`) marchent toujours ; quand deux classes sont en direct, leur écran prend celle dont l'heure de fin n'est pas passée (`enCoursPour`). Pas de migration.
  - **Le formateur, trois gros blocs** (`/enseigner`, `GET /api/enseigner/accueil-simple`, `modules/accueil/simple/blocs.tsx`) : « Le cours » (sa page du cours), « Entrer dans le live » (le Studio ; dès 1 h avant, la classe s'ouvre comme l'ouverture automatique : `demarrer` avec `avantLHeure`, sinon « Aujourd'hui à 11h00 · le live ouvre à 10h00 » ou « Samedi à 10h00 », et, au toucher, « Revenez à 10h00. » ou « Revenez samedi à 9h00. » ; au-delà de 6 jours, la date : « Vendredi 30 octobre à 10h00 »), « Préparer le cours » (PowerPoint, vidéos et plan de la prochaine séance). Plusieurs cours : un gros carré par cours d'abord (`/enseigner/mon-cours/:coursId`). « Plus · 2 choses à faire » ouvre l'accueil détaillé d'avant (`/enseigner/plus`). L'heure est donnée à Abidjan et chez le formateur.
  - **Fermeture logique** (« Ferme le cours, et puis on avance » : la règle « Laisse-les fermer » est annulée) : chaque minute, une classe en direct dont l'heure de fin prévue est passée et où il reste au plus UNE personne connectée (formateur, ordinateurs du campus, anciens écrans, intervenant du lien intervenant, étudiants confondus ; un Studio resté ouvert compte pour une) depuis 10 minutes sans interruption se ferme toute seule (`fermerLesClassesVides`, `routes/live.ts`). Jamais avant la fin prévue ; deux personnes ou plus remettent le compte à zéro (une classe qui déborde avec du monde continue). Jamais animée : « Séance non tenue » ; sinon terminée (événement « fin » avec `logique`, écran « Le cours est fini. Merci ! »). Juste après un redémarrage, rien pendant 2 min, et la mémoire repart de zéro (pas de fermeture avant redémarrage + 12 min). **Qui compte** : chaque poste abonné au temps réel de la classe, et aussi chaque page dont le flux temps réel est retenu (antivirus, réseau de la salle) et qui relit donc la diapo toutes les 2 s, vue depuis moins de 2 min (`noterPosteHttp` sur `GET /api/seances/:id/diapo`, relecture faite seulement dans ce cas ; `server/temps-reel.ts`) ; de même pour « salle connectée » et pour l'animateur. **Même cours** (gardé de la règle du 14 octobre, sans les salles) : une classe finie qui retient la séance suivante du même cours (prévue dans l'heure, ou déjà ouverte) se ferme quand personne ne l'anime depuis 10 min, même s'il reste deux personnes ou plus (écrans laissés ouverts, onglets d'étudiants) ; jamais animée : « Séance non tenue » dès sa fin ; un formateur qui déborde, présent, n'est jamais coupé ; la séance suivante s'ouvre dans la minute. Une classe fermée toute seule se rouvre pendant 2 h, même après sa fin prévue (« Rouvrir la classe » : `fermeeToutSeule`). L'ouverture automatique ne ferme toujours rien, mais n'attend plus la salle : plus de « En attente de la salle » ni de « Ouvrir quand même » (Studio, « Mon espace ») ; `GET /api/seances/:id/salle-occupee` répond `{ occupee: null }` pour les pages restées ouvertes (à retirer après le 21 octobre 2026). La fin automatique des séances oubliées (30 min) reste en filet. **Limites** : les invités du lien invité (sans micro) ne se signalent pas, ils ne comptent pas ; une classe fermée par erreur se rouvre (« Rouvrir la classe », ou « Démarrer » dans les 2 h).
- **Campus simple, suite (15 octobre 2026, 5 h)** : José : « Les salles n'ont pas besoin d'attendre que le professeur arrive pour ouvrir : elles doivent tester le son » ; « le professeur, il faut qu'il puisse rajouter ses vidéos, ses diapositives ; le chargé du campus aussi, et puis fermer » ; « des gros blocs, mais un peu de beauté ». Décisions :
  - **Ouvrir à tout moment** : le chargé du campus ouvre la classe d'un cours DU JOUR quand il veut (`POST /api/mon-campus/seances/:id/ouvrir`, plus de « dès 1 h avant » ; un autre jour : 409 `pas_aujourdhui`, « Ce cours est prévu lundi 19 octobre à 8h30. »). « Entrer dans le live » ouvre la salle (`…/live?ouvrir=1`, une seule ouverture même après un rechargement) ; plus d'une heure avant le cours, une confirmation d'un toucher (« Le cours commence à 16h00. Ouvrir la salle maintenant pour tester le son ? »). Le formateur (`avantLHeure`), la régie et l'ouverture automatique gardent leur borne d'une heure (`AVANCE_MAX_OUVERTURE_MIN`). Une classe du même cours finie que personne n'anime est fermée d'abord (fin automatique : elle se rouvre 2 h) ; encore animée : 409 « Le cours d'avant n'est pas fini. La salle s'ouvre juste après. ». Pour le campus, la séance suivante du jour passe devant une classe finie sans animateur à toute heure (`seancesDuMoment`).
  - **Le cours commence à l'heure prévue, quelle que soit l'avance** (`debut_cours`, déjà posé par l'ouverture « comme l'automatique ») : retards, chrono, enregistrement, présence et fermeture logique en partent. Trois corrections : la règle « séance démarrée plus d'une heure avant = autre créneau » ne vise plus que les « Démarrer » à la main sans `debut_cours` (`demarreeHorsCreneau`, `shared/ouverture.ts` : une classe ouverte à 6 h dont le formateur « commence » à 8 h finit à la fin prévue, pas 30 min plus tôt) ; le code de présence n'apparaît qu'une heure avant le début du cours (`fenetreEmargementOuverte`, et `POST /api/emargement` qui suit la même fenêtre) ; **avis différé** : ouverte avant l'heure où l'ouverture automatique aurait prévenu (30 min avant, 15 min si elle est coupée), la classe ne prévient personne (repère `rappels_live « avis-differe »`, posé dans la transaction de l'ouverture) ; la tâche « live-rappels » envoie le rappel unique aux étudiants et l'avis au formateur à ce moment-là, ou dès que le cours commence (« Commencer le cours maintenant ») (`envoyerAvisDifferes`, `routes/live.ts`) ; le filet de présence attend aussi ; « C'était un essai » efface l'avis en attente (et, plus d'une heure avant, le repère « ouverture-auto » : l'ouverture automatique fera son travail). Anciens écrans « salle » : une classe ouverte plus d'une heure avant son début ne passe pas devant le cours du moment de la salle (`enCoursPour`). Pas de migration (colonnes texte).
  - **Pas de cours aujourd'hui** : « Vous pouvez tester le son et l'image. », la salle d'essai en un toucher (`CadreDaily` sur `POST /api/visio/essai/rejoindre`, profil salle, nommée « Salle de conférence · Yamoussoukro »). Rien n'est enregistré ; elle se ferme seule après une heure.
  - **Ajouter un PowerPoint, une vidéo** : deux gros boutons pour le formateur en tête de « Préparer le cours » et dans le Studio (`modules/live/ajouts.tsx` : envoi avec progression, « Le PowerPoint devient des diapos… », fichier MP4/WebM/MOV ou lien YouTube, « La projeter maintenant dans les salles ») ; l'accueil dit ce qui est prêt (« 3 diapos · 1 vidéo »). Le chargé du campus ajoute aussi, à la séance du jour de ce cours ou à sa prochaine séance (`…/seances/:id/diapos`, `…/videos`, `…/videos/fichiers` ; YouTube seulement pour les liens, vidéos seulement pour les fichiers ; six PowerPoint et dix vidéos au plus en 10 minutes par compte) : ses ajouts ne changent jamais ce que voit la classe (un premier PowerPoint en direct reste caché jusqu'au geste du formateur), ils portent « Ajoutée par le campus de Yamoussoukro », le Studio l'annonce (événement `campus:geste`, distinct de « campus », l'état des salles). Il ne retire que ses propres vidéos. « Montrer dans la salle » seulement quand son campus est le seul à suivre le cours (une projection se voit dans toutes les salles) ; il n'anime jamais (pas de `noterGesteAnimation`).
  - **Fermer** : « Ajouter » et « Fermer » restent toujours à portée (le QR de présence, une minute au début, à +15 et +45 min, commence sous le bandeau du campus : `EmargementPleinEcran sousBandeau`). « Fermer la salle » (cet ordinateur quitte le cours ; si aucun autre écran de ce campus ne le montre, la parole de la salle est rendue et sa main baissée ; événement `salle_fermee` au fil et au bilan). « Terminer le cours », seulement quand c'est sans danger (`terminaisonCampus`, recalculé à la demande) : jamais avant le début du cours ; une classe qui attend son formateur, seulement après sa fin prévue (« Séance non tenue ») ; sinon si son campus est le seul du cours, ou si la fin est passée, ou si personne d'autre n'est là (ni formateur, ni intervenant, ni autre écran ; les étudiants ne comptent pas). Fin consignée `{ campus, siteId, raison }` ; le formateur qui revient la relance (« Démarrer » dans les 2 h).
  - **Gros blocs, mais beaux** (`components/ui/gros-blocs.tsx`) : carrés en dégradé doux de la couleur du cours (`degradeCours` : le second arrêt va toujours dans le sens du contraste, 4,5:1 au moins), bulles décoratives, icône dans un cercle, ombre légère qui s'allonge au survol, pression au toucher, point « En direct » vivant (coupé par « prefers-reduced-motion » et les données réduites) ; bande crème avec le logo en tête de l'espace du campus ; blocs de lecture sur une teinte très douce de la couleur du cours ; écran du live nuit avec ses feuilles plein écran. Vert « en direct » #16774C et étiquettes orange-profond : contraste AA (le vert et l'orange-foncé d'avant n'y arrivaient pas sur du texte de 20 px).
  - **Droits** : toutes les routes neuves sont sous `/api/mon-campus` (seul préfixe ouvert au compte de campus, avec la classe qu'il montre) ; chacune vérifie le cours, le campus, la séance, et journalise (`campus_diapos_ajoutees`, `campus_video_ajoutee`, `campus_ressource_retiree`, `campus_video_projetee`, `campus_salle_fermee`, `campus_cours_termine`, `live_ouvert_campus` avec `avisDiffere`). Le filtre du compte de campus est désormais posé AVANT le téléversement (`POST /api/fichiers`, enregistré avant les routes, lui échappait).
  - **Relecture (15 octobre 2026)** : un lien YouTube est reconnu sur l'adresse analysée, hôte de YouTube compris (`idYoutube` : youtube.com, m., music., youtube-nocookie.com, youtu.be ; « exemple.com/youtube.com/watch?v=… » n'en est plus un) et le compte de campus enregistre l'adresse canonique `https://www.youtube.com/watch?v=<id>`, jamais l'adresse saisie ; le quota de dépôts du campus ne compte que les dépôts réussis (la place est prise avant la réception, rendue si l'envoi échoue) ; une séance plus tard du même cours ne s'ouvre pas tant qu'une séance plus tôt du même jour est encore prévue (409 `pas_encore`, « Le cours de 8h30 passe d'abord. », `seancePrevueAvant`) ; ancien écran « salle » : une classe ouverte très tôt reste derrière le cours qui déborde avec son formateur (`enCoursPour`, « très en avance » reste la première clé du tri) ; chaque compte de campus a sa salle d'essai (`campus-2iae-essai-site-<id>`) : deux campus qui testent ne s'entendent pas, les étudiants qui testent ne voient pas la salle ; une classe ouverte qui attend son formateur après l'heure s'annonce partout « Salle ouverte · le formateur arrive » (repère `attente`), plus « En direct » sur le carré et « Salle ouverte » sur l'écran. Écran du campus : vocabulaire du campus dans les briques communes avec l'écran des salles (`lib/ecran-campus.ts` : « Connexion… », « Présence », « Présents par campus », jamais « visio » ni « émargement ») ; « Testez le son et l'image en attendant le cours. » quand la classe est ouverte très tôt ; la feuille « Fermer » s'intitule « Que voulez-vous fermer ? » et se referme par « ← Retour » (plus de « Fermer ✕ » qui ne ferme pas la salle) ; « Fermer » sur un cours pas encore ouvert revient simplement à la page du cours ; la salle d'essai lancée tient entière à l'écran (1024×600 compris) ; « Ajouter une vidéo » dit « Fichier ou lien YouTube ». Écrans bas (hauteur de 700 à 800 px au plus) : en-tête, carrés, héros du cours et blocs du formateur resserrés, « Entrer dans le live » et les trois blocs restent à l'écran ; « Salle fermée » est un bandeau posé sur la page qui part seul. Formateur : « Préparer » dit « Classe ouverte · début 16h00 » (comme le Studio) et le menu du téléphone « Salle ouverte » quand la classe est ouverte avant l'heure ; un lien qui n'est pas YouTube : « Lien ajouté aux documents. ».
