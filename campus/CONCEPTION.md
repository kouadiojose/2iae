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
10. **L'IA propose, l'humain décide.** Tout ce que l'IA produit pour noter,
    publier ou annoncer reste un brouillon marqué « Proposé par l'IA » tant
    qu'un humain ne l'a pas validé. L'IA ne met jamais une note seule.
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

---

## 5. Modules et responsabilités

Chaque module possède ses fichiers ; il ne modifie pas ceux des autres.

| Module | Serveur | Client | Pages |
|---|---|---|---|
| **compte** | `routes/compte.ts` (+ `routes/auth.ts`) | `modules/compte` | `/connexion`, `/activer/:jeton`, `/mot-de-passe-oublie`, `/reinitialiser/:jeton`, `/bienvenue`, `/profil` |
| **accueil / agenda / annonces** | `routes/accueil.ts`, `routes/agenda.ts`, `routes/annonces.ts` | `modules/accueil`, `modules/agenda`, `modules/annonces` | `/accueil`, `/enseigner`, `/agenda`, `/annonces` |
| **cours** | `routes/cours.ts` | `modules/cours` | `/cours`, `/cours/:id`, `/cours/:id/lecons/:leconId`, `/enseigner/cours/:id` |
| **live** | `routes/live.ts` (+ `server/visio.ts`) | `modules/live` | `/direct`, `/live/:id`, `/replays/:id`, `/salle`, `/emargement/:code`, `/enseigner/seances/:id` |
| **évaluations** | `routes/evaluations.ts` | `modules/evaluations` | `/devoirs`, `/devoirs/:id`, `/quiz/:id`, `/notes`, `/corrections`, `/enseigner/devoirs/:id`, `/enseigner/devoirs/:id/copies` |
| **messages** | `routes/messages.ts` | `modules/messages` | `/messages`, `/messages/:id`, `/messages/cours/:coursId` |
| **pilotage** | `routes/admin.ts` | `modules/pilotage` | `/pilotage`, `/pilotage/comptes`, `/pilotage/comptes/import`, `/pilotage/fiches`, `/pilotage/classes`, `/pilotage/cours`, `/pilotage/planning`, `/pilotage/presences`, `/pilotage/annonces`, `/pilotage/site`, `/pilotage/suivi`, `/pilotage/etudiants/:id`, `/pilotage/ia`, `/releve/:jeton` |
| **ia** | `routes/ia.ts` | `modules/ia` | `/assistant`, `/assistant/:id` |
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
- Formateur (`/enseigner`) : prochaine séance (préparer / ouvrir le studio), copies à corriger, questions restées sans réponse au dernier live, mes cours, messages.
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
- **Émargement** : QR (`/emargement/:code`) ou code tapé dans la salle live → « ✓ Présent · Yopougon ». Présence en ligne automatique par battements (tolérante aux coupures). Statuts : en salle, en ligne, partiel, absent, justifié, incident de salle.
- **Rattrapage après coupure** : « Voici ce que tu as raté » (sous-titres et questions de la période, résumé IA à la demande).
- Rappels automatiques 24 h et 15 min avant (notification + push).
- **Replay** : vidéo, fiche de révision (résumé IA validé par le formateur), transcription horodatée, questions posées, recherche dans la transcription (« Où a-t-il parlé de la TVA ? » → saut au bon moment), poids affiché.
- **Bilan de séance** pour le formateur : présences par campus, questions non traitées, baromètre, sondages ; « Générer la fiche de révision » → validation → envoi aux étudiants.
- À la sortie d'un live : « Ce cours t'a coûté environ 18 Mo » (estimation selon le mode).

### Devoirs, interrogations, notes
- Devoirs : À rendre / Rendus / Corrigés. Rendre en **photo** (appareil photo du téléphone), texte ou fichier ; brouillon local ; **file d'envoi hors ligne** ; **reçu de dépôt** ; remplacer sa copie avant l'échéance ; retard accepté ou non ; ✓✓ quand le formateur a ouvert la copie.
- Interrogations : une question par écran, gros boutons, chrono côté serveur, chaque réponse enregistrée aussitôt (reprise après coupure), correction automatique (QCM, choix multiple, vrai/faux, réponse courte), correction détaillée après l'échéance. **L'assistant IA est en pause pendant une interrogation.**
- Formateur : création de devoirs et d'interrogations, **génération de questions par l'IA** (brouillon), grille de correction, copies à corriger (rendus / en retard / non rendus), correction par critère, **commentaire vocal**, **correction proposée par l'IA** (brouillon à valider, jamais automatique), publication des notes.
- Carnet de notes : moyenne pondérée par cours pour l'étudiant ; vue par classe pour le formateur et l'équipe.

### Messages
- Comme WhatsApp : liste des conversations, bulles, ✓ envoyé / ✓✓ lu, photos, fichiers, **notes vocales**, temps réel, file d'envoi hors ligne.
- Conversations directes (étudiant ↔ formateurs de ses cours, ↔ vie scolaire de son site), **salon de chaque cours**, salon de classe. Contexte automatique quand on écrit depuis un devoir ou une leçon.

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
11. **Messagerie** : pas de discussion libre ni de messages privés entre étudiants en v1. Conversations directes étudiant ↔ formateurs de ses cours et ↔ vie scolaire de son site ; **« Questions du cours »** (salon modéré par le formateur, bouton « Signaler », masquage) ; annonces.
12. **Retards** : l'heure de réception par le serveur fait foi ; l'heure « préparé hors ligne » est affichée à titre indicatif ; le formateur décide (retard accepté ou non par devoir). Chrono des interrogations tenu par le serveur.
13. **Horloge** : toute logique horaire côté client utilise l'heure du serveur (`maintenantServeur()` dans `lib/horloge.ts`, déjà branché dans `useMaintenant`).
14. **Consommation affichée honnêtement** : mode compagnon (en salle) < 5 Mo/h ; audio ≈ 25 Mo/h ; audio + diapos ≈ 30 Mo/h ; vidéo 150 à 250 Mo/h. Afficher la consommation **mesurée** quand c'est possible (`getNetworkStats()` de Daily), jamais une promesse.
15. **IA** : aucun nom d'étudiant dans les prompts ; supports et copies traités comme des données non fiables (injection de prompt) ; le modèle n'a aucun outil qui écrit en base ; tout résultat IA qui touche une note, une publication ou une annonce est un brouillon à valider. Sous-titres par la reconnaissance vocale du navigateur du formateur (option « bêta »), résumé à la demande et en fin de séance (pas en continu).
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
| **Radio du cours** (tous fournisseurs) | étudiants en ligne en 3G/4G, jusqu'à des centaines | son du formateur (WebM/Opus 24 kbit/s) envoyé au serveur par tranches d'une seconde et rediffusé en flux HTTP, + diapos synchronisées + sous-titres | ≈ 11–15 Mo/h | aucune |

Le mode compagnon (étudiant présent en salle) ne consomme presque rien
(< 5 Mo/h) : ni son ni image, seulement questions, votes, sondages et
ressenti. L'écran de la salle de conférence rejoint la visio comme un
participant « Salle … » avec la caméra et le micro de la salle.
