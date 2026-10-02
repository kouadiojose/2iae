# C5. Conception « Ingénierie pragmatique » : la machine social media multi-clients de José, construite et mise en ligne en 90 jours sur Railway

Conception rédigée le 2 octobre 2026 à partir des rapports R01 à R11 et R21 à R26. Angle : architecte produit et technique. Obsession : ce qui peut être construit par José avec Claude Code, sur sa pile (Node, Express, React, Vite, Drizzle, TypeScript, Tailwind, shadcn), hébergé intégralement sur Railway (Postgres, buckets, services), mis en ligne en 90 jours, puis étendu sans réécriture. Quand deux rapports se contredisent, R26 tranche. Quand une fonctionnalité n'existe pas dans les rapports, elle n'est pas supposée ici.

Convention : les prix sont en dollars américains sauf mention, datés des rapports (1er et 2 octobre 2026). Les références « R07 §9.2 » renvoient aux sections des rapports.

---

## 1. Thèse en une page

**Phrase de positionnement.** « Votre gestionnaire vous envoie chaque semaine, sur WhatsApp, une planche de propositions nourrie de ce qui se passe chez vous et autour de vous ; vous répondez d'un tap ; la machine produit de vraies vidéos et de vrais visuels en français, un humain vérifie, elle publie, puis elle vous prouve le résultat en chiffres d'affaires. » L'IA est l'atelier, pas l'enseigne (R08 §10.1 : 30 % des agences voient leur valeur perçue baisser quand le client croit que l'IA réduit les coûts).

**Les cinq choix qui rendent la machine supérieure au marché d'octobre 2026.**

1. **La planche hebdomadaire validée en un tap sur WhatsApp est l'unité de travail**, pas le post. Aucun outil du marché n'a cet objet (R01 §8.2, R08 §10.2) ; Planable valide des posts, Gain prouve que le lien magique sans compte est le standard attendu. La planche coûte 0,03 à 0,20 $ à produire (R03 §9) et évite de générer des vidéos pour rien : la production ne démarre qu'après le « oui, madame ».
2. **La veille par client est locale, sourcée et mesurée.** Flux gratuits (Trending Now RSS CI et CA, Google News RSS, GDELT, Atom YouTube, Abidjan.net, calendriers civils et liturgiques) plus un seul abonnement SerpApi (R06 §16). Chaque fait de la planche porte « Source : URL ». Quatre indicateurs « à la page » (délai tendance vers publication, taux de nouveautés exploitées, taux de vidéos, sermons réemployés) répondent nommément aux reproches des clients perdus (R11 §12, R24 §5).
3. **L'usine vidéo repose sur Remotion et ffmpeg, la générative est plafonnée et passe par des API officielles.** La plupart des formats qui manquent aux clients sont de la vidéo programmée à quelques centimes (R04 §8.4). La découpe de sermons est maison (0,80 à 2,50 $ par sermon, R05 §4). Les clips génératifs passent par l'API Higgsfield (Kling 3.0 à 0,084 $ la seconde, R26 §2.4) ou Gemini, jamais par le pilotage navigateur de l'Unlimited, interdit par la section 10.6 des conditions Higgsfield (R26 §2.4).
4. **La qualité est codée, pas espérée.** Cerveau de marque par client en cache de prompt, juge à sept critères bloquant avant toute planche (seuil 15/21, R11 §8.2), contrôle vision de chaque image, trois portes humaines (gestionnaire avant envoi, client, gestionnaire avant publication, R01 §8.9), étiquette IA calculée par média.
5. **La mesure en trois couches est collectée chez soi chaque nuit et la couche affaires est en tête du rapport.** Instagram retarde de 48 h et efface à 2 ans, Facebook a retiré une quarantaine de métriques le 15 juin 2026 (R24 §1) ; la machine tient ses propres relevés, ses liens traçables et ses coupons, et produit elle-même le rapport mensuel d'une page plus le résumé WhatsApp de cinq lignes.

**Le choix d'ingénierie qui rend ces cinq promesses tenables en 90 jours** : un seul projet Railway, un monolithe modulaire TypeScript en quatre services (web, worker, rendu, tick), un seul Postgres avec sécurité au niveau ligne, pg-boss comme file, une couche « connecteur » qui achète la publication multi-plateformes au départ (API unifiée) et la remplace client par client par les API officielles sans réécriture. On achète ce qui est résolu et réglementé (publication, transcription, génération d'images et de vidéos, OCR) ; on construit ce que personne ne vend (planche, validation WhatsApp, veille locale, cerveau de marque, juge, rapport affaires).

**Prix de vente visé** (section 12) : à Abidjan, Présence 250 000 FCFA, Croissance 400 000 FCFA, Vidéo+ 650 000 FCFA par mois ; offre église à 175 000 FCFA ; au Canada, 900, 1 500 et 2 800 CAD ; en France, 600, 1 000 et 1 800 EUR. Le marché local vend 300 000 à 900 000 FCFA à Abidjan et 500 à 3 500 CAD à Montréal (R10 §1).

**Coût par client et par mois, hors gestionnaire humain** : 40 à 55 $ pour une église, 60 à 90 $ pour une école, 105 à 150 $ pour une marque de beauté à 12 Reels génératifs ; l'infrastructure Railway pèse 12 à 18 $ par client (R25 §8), le reste est de la génération plafonnée au contrat.

---

## 2. Les personnes

**José** (fondateur, architecte, premier gestionnaire). Il voit un tableau de bord d'agence : files en attente par porte, alertes, coûts du jour par client, état des connexions sociales. Chaque semaine : il relit les planches avant envoi (porte 1, 5 minutes par client), tranche les escalades du juge, valide les publications « promotion » et « personne réelle » (porte 3), et ouvre son atelier manuel Higgsfield Unlimited pour les scènes signature SEVARTA, hors chemin critique (R04 §8.1). Chaque mois : il lit les rapports générés et les trois décisions proposées par client. Il pilote Claude Code sur le dépôt de la machine et Claude Cowork avec le connecteur MCP de la plateforme (section 9).

**Le gestionnaire** (humain, à Abidjan ou Toronto, 4 à 6 heures par client et par mois, R08 §6.3). Il voit le poste de pilotage (section 6) sur une PWA à 390 px et reçoit ses alertes sur WhatsApp depuis le numéro machine (R22 §10.13). Chaque semaine : vendredi matin, revue des planches de la semaine ; lundi, lecture des validations et lancement des productions ; chaque jour, file « commentaires et messages à valider », file « TikTok à traiter dans l'application » (pas d'API de commentaires TikTok, R02 §3), file « publier à la main » (paquets prêts à publier, R02 §10.5). Il colle les URL des publications manuelles. Il enregistre chaque correction, qui devient une donnée d'apprentissage (R11 §15.10).

**Le client, par verticale.** Il n'a pas de compte et n'installe rien. Il reçoit sur WhatsApp un modèle utilitaire « votre planche est prête » avec une image composite et trois boutons : « Je valide tout », « À revoir », « Voir la planche » (R22 §1.2, §8). Le troisième ouvre une page mobile à jeton signé, une carte par proposition. Il peut répondre par un vocal, transcrit et renvoyé pour confirmation (R22 §10.9).

- *La fondatrice beauté* dépose ses nouveautés par WhatsApp en « document » (6 clichés dont la face INCI, R21 §6.3), reçoit un accusé de réception dans l'heure, la planche sous 24 h ; elle valide, tourne elle-même les vidéos « visage » demandées, reçoit le rapport le premier lundi du mois.
- *Le président d'association* dépose un flyer, reçoit « Reçu : 12 octobre, Cocody, 5 000 F, c'est bien ça ? » (R21 §9.10), puis la séquence teaser J-21, genèse J-14, programme J-7, rappel J-1, récap J+2 (R09 §4.8).
- *Le pasteur* ne fait rien le dimanche : la régie dépose le fichier sur un Drive partagé ou la salle Daily enregistre (R21 §3.4) ; lundi midi, la planche de 8 vignettes arrive ; il valide doctrinalement chaque extrait (R09 §5.8).
- *SEVARTA* : chaque nouveau titre déclenche une séquence de six semaines ; chaque prédication de l'auteur, un extrait relié au livre (R09 §6.8).
- *2IAE* : la plateforme lit uniquement les données publiques du campus (CLAUDE.md) ; calendrier académique et affiches déposés ; étudiants ambassadeurs et autorisations d'image restent humains (R09 §7.8).
- *Markel-Tech* : documents natifs et carrousels LinkedIn générés, posts du fondateur écrits par José, accord du client final avant toute étude de cas (R09 §8.8).

---

## 3. La routine : machine à états par client

La routine est modélisée comme des états en base, jamais comme un agent en attente (R07 §5, §11.7) : zéro jeton pendant l'attente, reprise garantie après redéploiement.

### 3.1 Horloges

| Horloge | Cadence (heure du client, `tenant.timezone`) | Travail |
|---|---|---|
| Tick | toutes les 5 minutes (Railway cron, sort en moins d'une minute, R07 §11.6) | échéances, rappels, relances de jobs, publications dues |
| Tendances | toutes les 2 h | Trending Now RSS, Google News RSS, GDELT, Atom YouTube (R06 §13.2) |
| Veille nocturne | 02:00 | scoring Batch des items, crawl du site client, concurrents, calendrier des moments à 8 semaines |
| Collecte des métriques | 06:00 | relevés comptes et médias J+1, J+3, J+7, J+30, J+90 ; Stories relevées trois fois avant 24 h (R24 §10.8) |
| Planche | jeudi 06:00 génération ; vendredi 09:00 porte 1 ; vendredi 10:00 envoi | la semaine éditoriale suivante, 6 à 10 propositions |
| Production | lundi dès validation, lots de nuit pour la vidéo (R04 §8.15) | rendu, contrôle, programmation |
| Rapport | premier lundi du mois tombant après le 3, 08:00 (R24 §10.8) | PDF une page + résumé WhatsApp |
| Revue 90 jours | tous les trimestres | comparaison avant/après, trois décisions |

### 3.2 États d'une planche (`board.status`)

`brouillon` → `revue_gestionnaire` (porte 1, SLA 24 h, sinon alerte) → `envoyee` (modèle `planche_prete`, horodatage) → `rappel_1` à J+2 → `rappel_2` à J+5 et alerte au gestionnaire (R22 §10.10 : deux rappels maximum) → l'un de `validee`, `partiellement_validee`, `a_revoir`, `silence` à J+7 → `close`.

Règle de silence, cochée au contrat et à l'onboarding (R08 §8.1 clause 2) : après deux rappels sans réponse, la machine publie les propositions des piliers « valeur » et « relation » qui ont passé le juge et la porte 1, et retient les propositions « promotion ». L'option inverse (ne rien publier) est un drapeau `tenant.silence_policy`.

### 3.3 États d'un contenu (`content_item.status`)

`idee` (issue de la veille, du calendrier ou d'un dépôt) → `brouillon` (texte, prompts, maquette basse qualité) → `juge` (rubrique 7 critères ; `retour_generation` deux fois maximum puis `revue_humaine`, R07 §11.13) → `en_planche` → `propose` → `valide` | `a_revoir` (avec motif, nouvelle version) | `refuse` → `en_production` (jobs de rendu) → `controle` (QC déterministe, vision, puis porte 3 humaine si pilier promotion, verticale réglementée ou drapeau personne réelle, R08 §8.2.10) → `programme` → `publie` | `publie_manuel` | `en_attente_reconnexion` | `echec` → `mesure` (relevés J+1 à J+90) → `archive`.

Transitions interdites codées en base (contrainte `check` sur une table de transitions `ref.content_transition`) : aucun passage à `programme` sans `judge_score` ≥ 15, sans `asset_rights` valides pour chaque personne identifiable, et sans `ai_label` calculé.

### 3.4 Déclencheurs

| Déclencheur | Source | Délai cible |
|---|---|---|
| Dépôt WhatsApp (photo, document, vocal, flyer) | webhook Cloud API → job `ingest` (téléchargement dans la minute, URL valable 5 minutes, R21 §9.9) | accusé de réception sous 1 h, planche sous 24 h |
| Nouveau sermon | PubSubHubbub YouTube (gratuit, hors quota, réabonnement tous les 3 jours, R21 §9.13) + fichier reçu par Drive `changes.watch` ou Daily | planche lundi midi, clips sous 24 h |
| Nouveauté sur le site client | crawl quotidien du sitemap ou webhook Shopify/WordPress (R06 §16.10) | contenu sous 72 h |
| Tendance ou actualité | cycle 2 h, scoring, genèse, vérification à deux sources | alerte sous 1 h, publication sous 4 h après validation (R06 §13.5) |
| Moment du calendrier | couche 1 fêtes fixes, couche 2 fêtes lunaires avec fenêtre ± 2 jours, couche 3 événements vivants (R10 §8.9) | proposition 10 jours avant |
| Commentaire ou message entrant | webhooks Meta | tri Haiku en temps réel, réponse humaine sous 1 h en cible |
| Publication candidate au boost | règle 2 conditions sur 3 à 24 h (R23 §5.5) | proposition au client, jamais de boost automatique |

### 3.5 Ce qui se passe quand le client ne répond pas

J+2 rappel utilitaire (0,004 $ en Côte d'Ivoire, R22 §8.1) ; J+5 second rappel et tâche au gestionnaire « appeler la cliente » ; J+7 règle de silence ; trois planches consécutives en silence déclenchent l'alerte interne « risque de départ » (R08 §10.18) et une revue téléphonique. Les relances au-delà de deux dégraderaient la note de qualité WhatsApp et tomberaient sous la politique du 23 septembre 2026 (R22 §10.10).

---

## 4. Les routines par verticale

Les plans de routine viennent de R09 §3.8 à §8.8 ; la part automatisable est celle du tableau R09 §9. Les séquences par déclencheur sont stockées dans `ref.sequence_template` (lancement produit 5 étapes, sortie de livre 8 étapes, événement 5 étapes, admission 4 étapes, R09 §11.15) : le client valide une séquence entière, pas un post isolé.

| Verticale | Sources surveillées | Déclencheurs et séquences | Formats produits automatiquement | Humain obligatoire |
|---|---|---|---|---|
| **Beauté** (TikTok ou Reels + WhatsApp) | dépôts de produits, flux produits du site, commentaires, Creative Center TikTok du pays (Apify, run quotidien partagé), calendrier commercial, avis | nouveau produit → teaser J-3, unboxing J0, tutoriel J+3, carrousel teintes J+7, rappel WhatsApp J+10 ; réassort → story ; 3 commentaires identiques → script de réponse ; fête J-14 → planche | fiche produit (INCI vérifié, R21 §9.5), packshot détouré, mises en scène, carrousels, Reels I2V 15 à 20 s, scripts, légendes, messages Channel prêts à coller, miniatures | tout visage à l'image, chaque allégation, avant/après (18 ans et plus, aucune promesse chiffrée, R26 §2.8), plaintes |
| **Association culturelle** (Facebook + WhatsApp en CI ; Instagram + Facebook au Canada) | agenda du site, agendas de la ville (Toronto Open Data, BlogTO, Abidjan.net), pages Facebook des lieux, journées internationales | nouvel événement → teaser J-21, genèse J-14, programme J-7, rappel J-1, récap J+2 ; événement tiers → carrousel « à voir cette semaine » | teaser Remotion, carrousels programme et agenda, citation animée, affiche (texte en HTML, scène générée), QR dynamique (R24 §10.4) | portraits, directs, prises de vue, faits de genèse (deux sources dont une primaire, R06 §13.4), crédits |
| **Église** (YouTube + Shorts/Reels/TikTok + WhatsApp) | PubSubHubbub de la chaîne, calendrier liturgique interne, site, témoignages, commentaires | nouveau sermon → chaîne complète en moins de 24 h : 6 à 8 candidats, 5 clips publiés du lundi au samedi (jamais 5 le même jour, R05 §8.10), 10 citations, dévotionnel 5 jours, chapitrage, guide de groupe ; fête J-7 → citations ; témoignage → consentement puis mise en forme | extraits 9:16 sous-titrés mot à mot, verset vérifié contre une Segond 1910 locale (R05 §3.7), citations HTML, miniatures, dévotionnel WhatsApp ; un format long 2 à 3 minutes (Instagram accepte 15 minutes par API, R26 §5.1) | validation doctrinale de chaque extrait, message face caméra, prière ; aucun visage synthétique du pasteur (R03 §12.7) ; floutage du public |
| **Édition** (Instagram et TikTok + newsletter et WhatsApp) | base des titres, chaîne YouTube des auteurs, avis, calendrier liturgique, page Amazon (Firecrawl) | nouveau titre → séquence six semaines ; sermon de l'auteur → extrait relié au livre ; avis 4 ou 5 étoiles → visuel | citations animées, carrousels, révélation de couverture, audiogrammes, bande-annonce 15 s, newsletter | lecture par l'auteur, interview, validation doctrinale, clips musicaux signature (atelier Higgsfield de José) |
| **École** (TikTok ou Reels + Facebook et WhatsApp, LinkedIn pour admissions) | calendrier académique, site public, résultats, registre des autorisations d'image | admission J-30 → compte à rebours ; rentrée J-14 → série bienvenue ; résultat → visuel ; événement → récap sous 48 h ; nouvelle formation → carrousel métiers | comptes à rebours Remotion, visuels de résultats, carrousels métiers, récaps à partir des plans fournis, « 60 secondes pour comprendre » depuis les replays publics, documents LinkedIn | étudiants ambassadeurs, enseignants, autorisation parentale pour tout mineur (blocage automatique, R09 §11.9), réponses aux candidats |
| **B2B** (LinkedIn page + fondateur, newsletter) | registre des projets, questions clients, veille sectorielle, pages des clients finaux | projet en ligne → avant-après J+3, étude de cas J+14 après accord, témoignage J+30 ; 3 questions identiques → check-list ; actualité majeure → post d'analyse proposé | documents natifs PDF, carrousels, sondages, motion design chiffré, newsletter | posts et vidéos du fondateur, accord du client final, chiffres ; X avec budget plafonné (R02 §12.13) |

Benchmarks encodés par verticale (R24 §6.2) : 0,12 % Instagram est bon en beauté, 0,73 % moyen pour une école, 5,20 % la moyenne LinkedIn ; l'alerte « sous la médiane » ne part que deux mois de suite et sous la médiane locale.

---

## 5. La planche de propositions et la validation client

### 5.1 Contenu exact d'une planche

Une planche = une semaine éditoriale pour un client, 6 à 10 propositions, vérifiée 60/25/15 (la machine refuse une semaine à plus de 15 % de promotion ou à moins de 60 % de valeur, R01 §8.8, R06 §16.15). Chaque proposition porte :

1. une maquette : image fixe basse qualité (GPT Image 2.5 Flare en `low`, moins d'un cent, R03 §12.5) ou capture « frame 0 » Remotion pour une vidéo, ou vignette de clip de sermon à l'image du hook, avec la mention visible « maquette » ;
2. le hook (moins de 8 mots), le texte ou le script résumé, le framework (PAS, AIDA, BAB, FAB), le pilier, la plateforme, la date et l'heure prévues (créneaux par fuseau, R10 §8.7), le format ;
3. la ligne « faits à confirmer » (prix, dates, noms non retrouvés en base, R11 §15.15) et « Source : URL » sous chaque fait de veille ;
4. ce que le client doit tourner lui-même (visage, coulisses, témoignage) ;
5. le coût de production estimé en interne (non montré au client) et la version.

Rendu : page PWA à 390 px (une carte par proposition, barre d'actions collante à 44 px, feuille « À revoir » avec motifs cochables et vocal, R22 §10.14) et image composite 1080 × 1350 sous 5 Mo pour l'en-tête WhatsApp, vignettes sous 300 Ko, générées par Playwright sur le service rendu.

### 5.2 Canaux

- **WhatsApp Business Platform, accès direct Cloud API sous le portefeuille Markel-Tech, sans BSP** (R22 §10.1) ; deux numéros dédiés dans le même WABA (+225 prépayée, +1) ; entreprise vérifiée dès le départ (R22 §10.3). Six modèles utilitaires soumis en une fois : `planche_prete`, `rappel_planche`, `production_terminee`, `publication_faite`, `rapport_mensuel`, `alerte_gestionnaire` (R22 §10.4), plus `confirmation_optin`. Coût : 0,0040 $ par envoi en Côte d'Ivoire, 0,0034 $ au Canada, 0,0300 $ en France (R22 §0). Le webhook `message_template_category_update` bloque tout modèle reclassé marketing (R22 §10.5). Webhooks `button_reply`, `list_reply`, `audio` écrivent dans `validation`.
- **Lien magique** : jeton aléatoire de 256 bits, haché en base (`magic_link.token_hash`), objet unique (une planche), expiration 14 jours, révocation à la clôture, aucun compte. Le même jeton sert sur WhatsApp et par courriel.
- **Courriel (Resend, déjà en place)** : repli pour les clients sans WhatsApp (Canada) et récapitulatif.
- **WhatsApp Flows** : phase 2, un seul Flow générique publié une fois (écran 1 propositions validées, écran 2 à revoir plus motif), alimenté par `flow_token`, en mode `navigate` sans endpoint (R22 §10.7).

### 5.3 États, relances, versions

États en section 3.2. Chaque proposition a des versions (`content_version`) ; un « À revoir » avec motif crée une version 2 générée avec le motif en instruction (Claude transforme la remarque, textuelle ou vocale transcrite à 0,003 $ la minute, en instruction de retouche, R22 §10.9), et la planche repart partiellement : seules les propositions révisées sont renvoyées. Le journal `audit_log` enregistre qui a validé quoi, quand, par quel canal (R02 §12.16). Opt-in horodaté au contrat en deux cases, mot STOP traité automatiquement (R22 §10.12).

---

## 6. Le poste de pilotage du gestionnaire

PWA React (manifest `standalone`, service worker, Web Push VAPID, tutoriel iPhone, R22 §10.13), mêmes composants shadcn que le reste, pensée pour un téléphone.

**Écrans.**
1. *Aujourd'hui* : files par porte avec compteurs et SLA (planches à relire, validations reçues, productions à contrôler, paquets manuels, commentaires sensibles, TikTok à traiter), alertes (connexion à reconnecter, plafond à 80 %, juge bloqué trois fois, client silencieux).
2. *Client* : calendrier, planche en cours, cerveau de marque versionné, médiathèque (originaux, dérivés, droits, étiquettes IA), connexions sociales et leur santé, coûts du mois, indicateurs « à la page ».
3. *Contenu* : brouillon, score du juge par critère avec justifications, rendu, QC vision, versions, boutons « Corriger » (chaque correction crée une paire brouillon/correction/motif réinjectée mensuellement, R11 §15.10), « Envoyer en planche », « Publier », « Reporter », « Paquet manuel ».
4. *Boîte de réception* : commentaires et messages Meta classés par Haiku en six classes (R23 §8.4), brouillon dans la voix du client, validation obligatoire pour critiques, sensibles et envois hors fenêtre 24 h avec étiquette HUMAN_AGENT journalisée (R23 §8.5).
5. *Agence* : coûts par client et par fournisseur, facture d'infrastructure, dead letter pg-boss avec relance en un clic, tests hebdomadaires de collecte et de publication, demandes d'accès en cours.

**Actions en un clic** : valider, renvoyer en génération avec motif, lancer la production, publier maintenant, créer un paquet manuel, reconnecter un compte, relever un plafond pour la journée, proposer un boost (jamais exécuter sans validation écrite du client, R23 §5.5), marquer un commentaire traité.

**Indicateurs « à la page » affichés par client** (R11 §12) : délai tendance vers publication (cible moins de 72 h produit, moins de 48 h événement), taux de nouveautés exploitées (cible 100 % sous 14 jours), taux de vidéos (40 à 60 %), sermons réemployés (3 clips sous 7 jours, 100 %), taux d'ancrage réel (80 %), envois par portée et enregistrements par portée, rétention à 3 s, taux d'acceptation des planches (70 %), mix réel des piliers (écart inférieur à 10 points), taux d'étiquetage conforme (100 %), délai médian de réponse aux commentaires (R08 §10.7).

---

## 7. L'usine de production

Principe d'architecture (R03 §12.1) : un moteur génératif produit les scènes et les éléments, une couche de composition déterministe (composants React par gabarit, rendu Playwright sur le service rendu) pose tout texte éditorial, logo et aplat de marque. Un titre, une date, un prix, un verset ne dépendent jamais d'un modèle de diffusion. Chaque moteur est abstrait derrière une interface interne (`ImageProvider`, `VideoProvider`, `TranscribeProvider`, `TtsProvider`) avec fournisseur par défaut et repli, et chaque actif stocke le moteur et sa version (R01 §8.16, R03 §12.11) : en 2026, un fournisseur change tous les trois mois (gpt-image-1 retiré le 23 octobre 2026, gpt-image-1.5 le 1er décembre, Sora 2 retirée le 24 septembre, R26 §2.2, R04 §0).

Mode brouillon pour la planche (image `low`, frame 0), mode production après validation (3 prises maximum, 1080p) : cela divise par 5 à 10 le coût de ce qui n'est pas validé (R04 §8.3).

### 7.1 Tableau récapitulatif par type de contenu

| Type | Chaîne exacte (moteurs, versions) | Prix unitaire daté | Contrôle qualité | Repli |
|---|---|---|---|---|
| Post texte, légende, hashtags | Claude Opus 5.5 (4 $ / 20 $ par MTok, cache 0,20 $), cerveau de marque en cache 1 h, sortie structurée JSON ; 3 à 5 hashtags, rejet au-delà de 5 (R26 §5.13) | 0,022 $ (0,011 $ en Batch), R07 §7 | juge 7 critères Haiku 4.5 (0,0045 $) ; lexique d'allégations par verticale | Sonnet 5.5 (0,012 $) |
| Carrousel 3 à 10 pages (Instagram, LinkedIn PDF) | plan JSON Opus 5.5 (0,068 $), slides React par client, rendu Playwright 1080 × 1350, cover optionnelle GPT Image 2.5 Flare `medium` (0,013 $ via fal, prix OpenAI en jetons : 30 $ par M jetons image sortie, R26 §2.2) | 0,07 à 0,10 $ | contraste, police ≥ 40 px, mots par slide, couleurs par échantillonnage de pixels (R03 §9) | 10 diapositives maximum par API Instagram, 11 à 20 → paquet manuel (R02 §12.6) |
| Visuel avec texte (annonce, affiche, citation) | scène FLUX.2 [pro] via fal (0,03 $) ou Nano Banana 2 (0,067 $, grounding Search pour un lieu) ; texte posé en HTML | 0,03 à 0,07 $ | OCR par vision Claude du PNG final comparé au JSON attendu ; détection de pseudo-lettres | GPT Image 2.5 Sunburst pour édition masquée ; Canva Connect Autofill (Pro ou Teams depuis le 21 septembre 2026, R03 §7.3) en phase 3 |
| Photo produit mise en scène (beauté, livre) | packshot client détouré Photoroom (0,02 $) ou Recraft (0,01 $) ; fond FLUX.2 [pro] (0,03 $) ou GPT Image 2.5 `high` avec 3 références via Responses API (entrée image en cache à 2 $ au lieu de 8 $, R26 §3.8) ; composition HTML | 0,05 à 0,10 $ | comparaison vision du packaging avec le packshot original ; étiquette lisible et identique | GPT Image 2.5 Sunburst edit avec packshot en référence ; LoRA FLUX.2 (8 $) seulement pour un produit généré des centaines de fois |
| Reel génératif (produit, teaser) 15 à 20 s | storyboard 2 à 3 images, I2V Kling 3.0 via API Higgsfield (0,084 $ / s, 15 s = 1,26 $, R26 §2.4) ou Veo 3.1 Fast via Gemini (0,10 $ / s 720p, R04 §2.1), 3 prises par plan ; montage Remotion (texte, logo, CTA) ; voix ElevenLabs v3 0,08 $ par 1 000 caractères ; musique bibliothèque native de la plateforme ou ElevenLabs Music 0,15 $ / min | 4 à 6,50 $ | vision sur frames clés (produit présent, mains, texte parasite) ; étiquette IA photoréaliste = oui | Seedance 2.5 (0,2057 $ / s, 4 à 30 s) réservé aux scènes signature ; LTX-2.3 fal 0,06 $ / s pour brouillons ; en cas de refus de filtre, bascule automatique vers le modèle suivant (R04 §8.16) |
| Reel programmé Remotion (compte à rebours, chiffres, tutoriel, citation animée, avant-après) | composition React par client, données JSON, rendu Remotion en CPU sur le service rendu (licence gratuite jusqu'à 3 personnes, R04 §4 ; à confirmer) ; Lambda 0,02 $ la minute si le délai l'impose | 0,05 à 0,50 $ | snapshot de frames clés, durée, zones sûres 9:16 | ffmpeg seul pour un montage simple |
| Clip de sermon 30 à 60 s (et version 2 à 3 min) | fichier déposé par l'église (jamais téléchargé depuis YouTube, R21 §9.6) ; ffmpeg extraction audio ; AssemblyAI Universal-3.5 Pro 0,21 $ / h, `language=fr` forcé (R05 §8.3) ; Haiku 4.5 segmente, Opus 5.5 choisit, titre, écrit hooks et dérivés (0,45 $ par sermon, R05 §4) ; affinage des bornes au mot ; recadrage 9:16 centré (v1) puis MediaPipe (phase 2) ; sous-titres ASS karaoké par libass ; habillage Remotion ; profil d'export « Afrique mobile » 720p sous 10 Mo (R10 §8.6) et profil 1080p | 0,80 à 2,50 $ par sermon pour 5 clips | verset vérifié contre Segond 1910 locale ; interdiction de couper au milieu d'un verset ; liste de mots sensibles ; porte humaine du pasteur | ElevenLabs Scribe v2 (0,22 $ / h) en second moteur ; Vizard API si la chaîne maison est en retard |
| UGC synthétique « avis cliente » 30 s | portrait Nano Banana 2 (0,07 $), script Claude, voix ElevenLabs, OmniHuman 1.5 0,12 $ / s ou HeyGen Avatar IV 0,05 $ / s, sous-titres ASS, étiquette IA | 1,70 à 3,80 $ | personne synthétique neutre seulement ; jamais une personne réelle sans consentement écrit (R08 §8.1 clause 6) | UGC humain demandé au client |
| Story (image ou vidéo ≤ 60 s) | GPT Image 2.5 Flare 1024 × 1536 `medium` ou dérivé d'un Reel ; texte HTML ; MP4 Remotion | 0,02 à 0,05 $ | zones sûres (haut 250 px, bas 340 px) | paquet manuel pour Status WhatsApp (R02 §7) |
| Miniature YouTube | portrait réel détouré Photoroom + fond Nano Banana 2 + titre 3 à 5 mots en HTML (skill youtube-thumbnail existant) | 0,07 à 0,10 $ | lisibilité à 168 × 94 px par vision | Gemini déjà en place |
| Vidéo explicative de logiciel 60 à 90 s | enregistrement d'écran déposé, zooms et curseur Remotion, voix clonée (consentement) ou gpt-4o-mini-tts 0,015 $ / min, sous-titres | 0,15 à 0,40 $ | lisibilité du texte à 390 px | aucun |
| Planche de propositions | maquettes `low` 0,006 $ pièce, composition HTML, composite PNG Playwright | 0,03 à 0,20 $ | mention « maquette » | aucun |

Une voix par client (clonage ElevenLabs avec consentement, seul moyen d'un accent ouest-africain crédible, R04 §8.11), stockée comme actif chiffré du client. Musique : bibliothèque native des plateformes pour l'organique, ElevenLabs Music ou Lyria 3 Pro (0,08 $ par morceau) pour les planches et vidéos hors plateforme, Epidemic Sound (API, sous-licence) pour les églises sur YouTube ; Suno reste manuel, jamais automatisé (R04 §8.12). Métadonnées C2PA conservées (R03 §12.13).

### 7.2 Rendu lourd : où et comment

Service Railway `rendu` : 4 vCPU, 8 Go, mode Serverless (dort entre deux lots), file pg-boss `rendu` à concurrence 1 par réplica, deux réplicas au-delà de 10 clients ; environ 13 $ par mois pour 2 heures de travail par jour (R25 §6.2). Image Docker avec ffmpeg, libass, Chromium (Playwright), Node 22, Remotion. Aucun GPU avant 200 heures d'audio par mois (R05 §8.19). Remotion Lambda (compte AWS) seulement si le délai ou la licence l'imposent : son stockage S3 est temporaire et les sorties sont copiées dans le bucket Railway, ce qui respecte la règle « toute persistance sur Railway ».

---

## 8. La veille et l'intelligence

Modèle de données R06 §13.1 (`source`, `item`, `dossier`) repris tel quel, avec `tenant_id`.

| Flux | Sources | Fréquence | Coût mensuel |
|---|---|---|---|
| A. Chez le client | crawl quotidien du sitemap, flux WordPress ou Shopify, dépôts WhatsApp, Business Discovery sur son compte, Atom YouTube | quotidien, Atom toutes les heures | 0 $ |
| B. Domaine et région | Trending Now RSS (CI, CA, FR), Google News RSS 10 requêtes par client, GDELT 3 requêtes, Abidjan.net, Fratmat, BlogTO, Ottawa Festivals en RSS, pages Facebook publiques des festivals (Graph API déjà en place), SerpApi Google Events 2 villes et Google Trends mots-clés hebdomadaires, Tavily 2 recherches par client et par jour | 2 h, 4 h, 6 h, hebdomadaire | SerpApi 25 à 75 $ partagé ; Tavily gratuit jusqu'à 1 000 crédits |
| C. Formats et sons | Apify TikTok Creative Center un run quotidien pour 3 pays partagé (moins de 20 $), hashtags Instagram 30 par 7 jours par compte (10 marque, 10 niche, 10 exploratoires, R06 §16.6), Business Discovery des 5 à 10 concurrents, changedetection.io auto-hébergé sur Railway pour les pages dynamiques (5 à 15 $) | quotidien, 6 h | 25 à 35 $ partagé |
| D. Calendrier des moments | fêtes fixes par pays (Nager, canada-holidays), fêtes lunaires saisies à la main avec fenêtre ± 2 jours, journées mondiales ONU, calendrier liturgique interne, dates propres (rentrée 14 septembre, FEMUA, MASA, Afrofest, Mois de l'histoire des Noirs) | hebdomadaire, horizon 8 semaines | 0 $ |

Ne jamais déployer pytrends ni un scraper Google Trends sur Railway (429 depuis les IP cloud, R06 §2.1). Oublier NewsAPI (449 $) et Bing News (retirée). Plan B par configuration pour chaque flux gratuit non contractuel (bascule SerpApi ou Apify sans redéploiement, R06 §16.20).

**Pipeline** (R06 §13.3) : collecte → dédoublonnage exact puis sémantique (embedding, cosinus > 0,92 sur 7 jours) → scoring Haiku 4.5 par lots de 20 items avec profil client en cache (pertinence 0 à 100, pilier, urgence, risque, angle) en Batch API nocturne (moitié prix) → score composite (pertinence × fraîcheur à demi-vie 36 h pour les tendances, 14 jours pour les événements × signal de tendance × diversité) → genèse (Claude avec `web_search` et `web_fetch`, 10 $ pour 1 000 recherches) pour les items « newsjacking » ou « événement » → vérification des faits.

**Vérification des faits, règles dures** (R06 §13.4) : toute date et tout lieu corroborés par deux sources indépendantes dont une primaire ; extraction structurée avec confiance par champ, tout champ sous 0,8 bloque la publication automatique ; revérification 48 h avant publication ; sujets politiques et religieux controversés marqués « risque » et exclus du newsjacking automatique pour les églises, SEVARTA et 2IAE.

**Mesure de la veille** : chaque item retenu enregistre proposé, accepté, publié, performance ; après 90 jours, les sources qui ne produisent jamais d'item accepté sont coupées (R06 §16.19).

**Coût** : socle partagé 60 à 170 $ par mois, puis 5 à 10 $ par client léger (église, association), 12 à 25 $ par client standard (beauté, SEVARTA, 2IAE) (R06 §14). Avec Batch et cache, le scoring descend sous 5 $ par client (R06 §16.12).

---

## 9. L'architecture agentique

### 9.1 Appels structurés d'abord, agents ensuite

80 % du volume (post, carrousel, script, calendrier, juge, vision, scoring de veille, extraction de dépôts) sont des appels à l'API Messages avec sorties structurées (`output_config.format` JSON Schema, sans surcoût, R21 §2.2), à 0,01 à 0,32 $ l'unité (R07 §7). Un agent coûte 4 à 15 fois plus de jetons sans gain mesurable sur une tâche bien spécifiée (R07 §3). L'Agent SDK n'entre qu'en phase 2 pour les tâches ouvertes (audit du site d'un client, croisement d'un sermon avec les annonces), dans un conteneur Railway dédié, avec `SessionStore` Postgres, `maxBudgetUsd` 2 $ par job, profondeur de sous-agents 1, hooks `PreToolUse` d'audit et `defer` pour toute action irréversible (R07 §11.8). Le modèle Fable 5.1 (10 $ / 50 $, R26 §2.3) est réservé à ces sessions longues, jamais à la rédaction de légendes (R26 §5.8).

| Tâche | Modèle | Prix officiel (R26 §2.3) | Mode |
|---|---|---|---|
| Création (posts, scripts, calendrier, sélection des moments de sermon) | Claude Opus 5.5 | 4 $ entrée, 20 $ sortie, cache lu 0,20 $ | temps réel pour la planche, Batch (2 $ / 10 $) pour le calendrier du mois suivant |
| Synthèse de veille, extraction INCI et PDF | Claude Sonnet 5.5 | 2 $ / 10 $ | Batch nocturne |
| Juges, ouvriers de lecture, scoring, tri des commentaires, vision des images, classification des dépôts | Claude Haiku 4.5 | 1 $ / 5 $, cache lu 0,10 $ | Batch quand rien n'attend |
| Second juge d'une autre famille sur 10 % des contenus | gpt-4o-mini (déjà en place) | R11 §15.4 | échantillon |
| Sessions d'agent longues | Fable 5.1 ou Opus 5.5 | 10 $ / 50 $ | Agent SDK, phase 2 |

Règles : jamais changer de modèle en cours de conversation (cache par modèle) ; cerveau de marque de 4 000 à 12 000 jetons en tête de prompt derrière `cache_control` TTL 1 heure (un cerveau de 10 000 jetons relu 500 fois coûte 1 $ au lieu de 20 $, R07 §11.3) ; minimum cacheable 4 096 jetons sur Haiku (R07 §4) ; majorer les entrées de 30 % pour le tokenizer 2026 (R26 §3.5) ; toujours tester `stop_reason === "refusal"` et activer `fallbacks: "default"` (R07 §11.15) ; stocker `batch_id` et `custom_id` avant envoi (R07 §8.3).

### 9.2 Cerveau de marque et mémoire (R07 §4)

Trois couches : stable (fiche de voix mesurable avec règles mécaniques, lexique, interdits, exemples avant/après, dix meilleurs posts, piliers, plateformes, personas, glossaire, extraite par le prompt R11 §5.4 à partir de 15 textes validés et validée par le client sur la première planche) dans `brand_brain` versionné ; vivante (assets, produits, événements, performances, décisions, refus) en tables Postgres exposées au modèle par outils (`get_brand_assets`, `get_recent_posts`, `get_metrics`) pour ne pas casser le préfixe caché ; agentique (notes de travail) dans `SessionStore` en phase 2. Réinjection mensuelle des 10 meilleurs posts et des 5 à 10 dernières paires de corrections (R11 §15.10).

### 9.3 Juge et garde-fous

Rubrique à sept critères notés 0 à 3 (spécificité, originalité avec test de substitution, voix, hook, appel à l'action, ancrage réel, conformité), seuil 15/21 et au moins 2 sur spécificité, voix et conformité (R11 §8.2), stockée avec version de rubrique, modèle et hash du prompt ; calibration le premier mois sur 100 posts notés par José par verticale, kappa ≥ 0,6 par critère, 40 contre-exemples (R11 §8.4). Vision Haiku 4.5 sur chaque image réduite à 1 000 px (0,0026 $) avec checklist produit, texte, anatomie, zoom sur les zones de texte ; ne jamais demander « est-ce que ça a l'air IA » (non supporté, R11 §15.5). Garde-fous codés : lexique d'allégations par verticale et par pays, verset vérifié par outil, consentement d'image enregistré (vue SQL `publishable_assets`), chiffres 2IAE issus de la base, étiquette IA calculée par variante (R25 §9.8), `is_ai_generated` posé par API Instagram (R26 §3.2), `is_aigc` TikTok.

### 9.4 Place exacte de chaque surface Claude

- **Claude Code** : outil de construction de José sur le dépôt de la machine ; en nuage via les **Routines** (aperçu de recherche) comme pont d'entrée tiré par la plateforme : `POST /v1/claude_code/routines/{id}/fire` avec jeton par routine, 30 tirs par heure et par routine, texte de 65 536 caractères arrivant dans un bloc `routine-fire-payload` que le prompt doit explicitement traiter (R07 §2.6). Deux routines en phase 3 : « revue hebdomadaire » et « incident » quand un client cumule trois refus du juge (R07 §11.12). Pas de clé d'idempotence : le tick ne tire une routine qu'une fois par clé `client:semaine`.
- **Claude Cowork** : aucune API publique d'entrée (R07 §2.7). La plateforme ne déclenche pas Cowork ; elle expose un **serveur MCP distant « machine-social »** (Streamable HTTP, OAuth 2.1, PKCE, RFC 9728, 8414, 7591, 8707, joignable publiquement depuis les serveurs d'Anthropic, R07 §2.5) que Cowork appelle de lui-même, ou qu'une tâche planifiée Cowork vient lire. Dix outils au départ : `list_pending_briefs`, `get_brand_brain`, `get_assets`, `submit_render`, `submit_board`, `approve`, `reject`, `request_video_job`, `report_metrics`, `log_decision` (R07 §11.9). Le même serveur sert à Claude Code, aux Routines et à l'API Messages (connecteur MCP). José doit vérifier avant le 6 octobre 2026 la bascule « nuage uniquement » annoncée pour Pro et Max (R07 §10.1).
- **Claude in Chrome** : outil personnel de José pour son atelier Higgsfield Unlimited (clips musicaux SEVARTA, essais), nourri par une file d'ordres de scènes exposée via le MCP (prompt image Nano Banana Pro, prompt vidéo Seedance 2.5 par scène) ; **hors chemin critique** et jamais pour un client (R04 §8.1, R26 §5.10). Pas de `browser_toolset` sur Railway contre Higgsfield : fragile, coûteux en jetons d'images, et contraire aux conditions (R07 §2.8).
- **Higgsfield** : l'API officielle (open.higgsfield.ai, lancée le 16 septembre 2026, paiement à la génération, SDK TypeScript `@higgsfield/client`, asynchrone avec webhooks, sorties conservées au moins sept jours donc copiées dans le bucket) est l'adaptateur `VideoProvider` par défaut : Kling 3.0 à 0,084 $ / s, Seedance 2.5 à 0,2057 $ / s, 4 à 30 s (R26 §2.4). La section 11.12 des conditions prévoit explicitement l'usage par agent et MCP (R26 §3.7). Section 4.4 : hors contrat Enterprise, les entrées peuvent entraîner les modèles ; aucun visage de pasteur ni d'enfant n'est envoyé en référence (R26 §5.12), et le contrat client le dit.
- **Clé API Console séparée de l'abonnement Max de José** : la machine multi-clients paie à l'usage (interdiction documentée d'offrir la connexion claude.ai dans un produit tiers, R07 §11.17) ; budgets par client dans `tenant_budget`, alerte WhatsApp à 15 $ de jetons dans le mois.

---

## 10. Publication, mesure et apprentissage

### 10.1 Couche de publication : trajectoire

Interface unique `Connecteur` (`publier`, `programmer`, `lire`, `statistiques`, `commentaires`, `sante`) avec deux implémentations dès le premier jour (R02 §12.1) :

1. **`UnifiedConnector` : Upload-Post Professional, 50 $ par mois, 25 profils, white label, revues Meta et audit TikTok portés par le fournisseur, minutes ffmpeg incluses** (R02 §8). Il couvre jusqu'à 25 clients, démarre le jour 1 sans attendre 20 jours d'App Review Meta, 2 à 4 semaines d'audit YouTube, l'audit TikTok ni le Standard Tier LinkedIn. Le plan Free (2 profils, 10 uploads) sert aux tests de la semaine 2. Repli nommé si Upload-Post déçoit à l'essai : Blotato Starter 29 $ (20 comptes, API et MCP inclus, audit TikTok porté, paramètres `isAiGenerated` et Trial Reels, R26 §2.10).
2. **`MetaDirectConnector` : Graph API v25.0 en propre** pour les pages où Markel-Tech a déjà un rôle (la page 2IAE lue aujourd'hui, SEVARTA, Markel-Tech), sans App Review (R02 §2.1), puis pour tous les clients après Advanced Access et Business Verification (dossier déposé en semaine 1, section 14).

Ordre de migration vers les API officielles, client par client et sans réécriture : Meta (Facebook Pages, Instagram, Threads) à 3 mois, YouTube (audit) à 3 mois, LinkedIn Community Management (Development puis Standard, version mensuelle en paramètre de configuration, 202510 retirée le 15 octobre 2026, R02 §12.17) à 6 mois, TikTok (audit, écran de validation conforme : confidentialité sans valeur par défaut, cases décochées, divulgation commerciale, aperçu, R02 §3) à 6 à 12 mois. X en option payante à l'usage pour Markel-Tech seulement (0,015 $ par post, 0,20 $ avec lien, R02 §6). Google Business Profile demandé dès maintenant pour 2IAE et les clients locaux (R02 §12.14). Sorties de secours vers le marché : MCP Metricool (tout plan) et MCP Blotato (R26 §5.17).

### 10.2 Contraintes par plateforme codées dans `ref.platform_rule`

Instagram : lire `content_publishing_limit` avant chaque publication, 50 comme plafond prudent (R26 §5.3) ; Reels 3 s à 15 minutes, 300 Mo, H.264, 1080 × 1920 à 8 Mbps (R26 §5.2) ; carrousel 10 ; 5 hashtags ; pas de planification native (l'ordonnanceur est le tick) ; `is_ai_generated` ; Trial Reels par API (R26 §5.5). Facebook : Reels 3 à 90 s, 30 par 24 h ; Stories 60 s. Threads : 250 par 24 h, carrousel 20. YouTube : 100 uploads par jour par projet partagés entre tous les clients (lisser, R02 §12.7), `publishAt`, #Shorts sous 60 s, consentement horodaté. TikTok : 6 requêtes par minute, environ 15 publications par jour, 5 utilisateurs en SELF_ONLY avant audit (R26 §2.7), FILE_UPLOAD (PULL_FROM_URL exige un domaine vérifié, impossible avec une URL présignée Railway, R25 §3). LinkedIn : documents natifs et multi-images, pas de carrousel organique, pas de planification. WhatsApp Channels et Status : aucune API, paquet manuel (R10 §8.1).

Médias servis par URL présignée Railway de 48 h sur une copie `pub/`, révoquée après `FINISHED`, purgée à 7 jours (R25 §11.3) ; test dès la première semaine qu'un conteneur Instagram accepte l'URL signée (R25 §10.4).

### 10.3 Jetons et reconnexion

Chiffrement par enveloppe (section 11.5). Tâche quotidienne : rafraîchir les jetons Meta et Instagram de plus de 24 h et de moins de 55 jours, à J-5 ; LinkedIn alerte J-10 ; TikTok rafraîchi avant chaque publication, réautorisation annuelle ; Google refresh token durable en production (R02 §10.3). Toute erreur 190, 401 ou `access_token_invalid` bascule la connexion en `a_reconnecter`, alerte WhatsApp, courriel au client avec lien de reconnexion en un clic, publications en `en_attente_reconnexion` au lieu d'échouer (R02 §12.9). Test hebdomadaire automatique de publication et de collecte sur un compte de test par plateforme, qui échoue bruyamment dès qu'une métrique renvoie « invalid metric » (R24 §10.20).

### 10.4 Repli manuel comme fonctionnalité de premier rang

Paquet prêt à publier : médias aux bons formats, légende, texte alternatif, heure, cases à cocher (confidentialité, divulgation), lien profond ; envoyé au gestionnaire par WhatsApp ou courriel ; il colle l'URL ; la machine mesure ensuite par lecture (R02 §10.5).

### 10.5 Mesure en trois couches

- Couche 1, indicateurs avancés : views, reach, saved, shares, `reels_skip_rate`, watch time, jamais impressions (déprécié, R02 §12.12) ; envois par portée et enregistrements par portée en tête (R11 §15.13).
- Couche 2, croissance : abonnés nets, visites de profil, clics.
- Couche 3, affaires : `conversion_event` (lead, devis, candidature commencée et déposée, achat, don, visite) alimentés par liens traçables maison (`go.{domaine}/x7k2` avec la convention UTM R24 §2.1), page lien en bio maison, QR dynamiques, coupons lisibles à voix haute (l'attribution qui marche à Abidjan, R24 §10.6), objet `referral` et `ctwa_clid` WhatsApp, GA4 Data API (gratuite, 200 000 jetons par jour) avec trois événements à demander à la session du site pour www.2iae.com (`generate_lead`, `begin_application`, `submit_application`, R24 §10.17), Pixel et Conversions API posés chez le client avec consentement et `event_id = conversion_event.id`.

Collecte nocturne en ajout seul, noms de métriques jamais figés (`metric_alias` versionnée, R24 §10.9), mois clos le 3 du mois suivant.

**Rapport mensuel** : PDF d'une page (Playwright) en trois couches, couche affaires en haut même avec de petits chiffres (« 3 demandes de devis, 1 inscription »), trois meilleures publications en vignette, section « ce que nous changeons » avec trois décisions proposées, comparaison au seuil de verticale ; résumé WhatsApp de cinq lignes par modèle `rapport_mensuel` (R24 §10.1, R10 §8.13). Coût 1 à 3 $ par client (R24 §8).

**Boucle d'apprentissage** : chaque correction du gestionnaire et chaque décision client enregistrées ; trois à cinq hooks de familles différentes par idée vidéo, publiés sur des jours distincts ou en Trial Reels, rétention à 3 s mesurée ; bandit par verticale (pas par client) avec récompense envois + enregistrements par portée et 20 % d'exploration, probabilités affichées au gestionnaire plutôt que décision automatique (R11 §15.9) ; revue à 90 jours ; benchmarks remplacés par la médiane locale après trois mois (R24 §10.13).

---

## 11. Architecture technique et modèle de données

### 11.1 Services Railway

Un projet Railway « machine » distinct du projet « Groupe 2iae » (R25 §11.1), région EU West Amsterdam (5 300 km d'Abidjan, la plus proche ; latence attendue 90 à 130 ms, à mesurer depuis Abidjan avant d'arrêter la région, R25 §2.4), plan Pro (20 $ crédités). Dépôt GitHub à part, monorepo pnpm : `apps/web`, `apps/worker`, `apps/rendu`, `apps/tick`, `packages/db` (Drizzle), `packages/core` (états, règles, prix), `packages/providers` (adaptateurs), `packages/remotion` (compositions par client).

| Service | Rôle | Taille de départ | Déploiement |
|---|---|---|---|
| `web` | Express (API REST, webhooks WhatsApp et plateformes, serveur MCP, pages magiques, PWA React servie en statique) | 0,5 vCPU, 1 Go, 2 réplicas | automatique à chaque push sur `main` ; sans volume, donc sans coupure |
| `worker` | pg-boss (files `veille`, `ideation`, `redaction`, `planche`, `juge`, `vision`, `publication`, `metrique`, `ingest`, `whatsapp`, `retention`), appels Claude, OpenAI, fal, Higgsfield, AssemblyAI, ElevenLabs, Upload-Post ; seules variables à porter les clés fournisseurs (R25 §7.2) | 0,5 vCPU, 2 Go | automatique ; arrêt gracieux (`SIGTERM` : finir le job courant sous 30 s, sinon pg-boss le réessaie) |
| `rendu` | ffmpeg, libass, Chromium Playwright, Remotion CPU ; file `rendu` | 4 vCPU, 8 Go, Serverless | automatique |
| `tick` | Railway cron toutes les 5 minutes, sort en moins d'une minute ; enfile les jobs dus (R07 §11.6) | 0,25 vCPU | automatique |
| `postgres` | une seule base, schémas `app` (RLS), `pgboss`, `audit`, `ref` ; joint uniquement par `railway.internal`, URL publique désactivée (R25 §11.14) | 0,25 vCPU, 1 Go, volume 5 Go | PITR activé le jour 1 |
| `bucket-travail` (ams) | originaux, dérivés, copies `pub/`, exports ; préfixe `t/{tenant_id}/` | 0,015 $ par Go-mois, sortie gratuite | |
| `changedetection` (phase 2) | surveillance des pages dynamiques | 0,25 vCPU, volume | |
| `agent` (phase 2) | conteneur Agent SDK, séparé du rendu (le rendu sature le CPU, l'agent attend des API, R25 §11.11) | 0,5 vCPU, 2 Go | |

**Contrainte absolue respectée** : toute persistance vit sur Railway. Les buckets Railway n'ont ni bucket public, ni cycle de vie, ni versionnage, ni verrou d'objet (R25 §2.3) ; la rétention est donc un job `retention_purge` quotidien (lit `expires_at`, supprime, vérifie par `HEAD`, écrit `purged_at`, R25 §11.4), et la copie de sauvegarde des originaux et les `pg_dump` hebdomadaires chiffrés vont dans un **second bucket Railway dans un second projet Railway « machine-sauvegarde »** : seul le dump logique survit à la suppression d'un projet (R25 §2.2), et un projet distinct protège contre une suppression accidentelle du premier, sans quitter Railway. Pas de Cloudflare R2 : TikTok se publie en FILE_UPLOAD ou via l'API unifiée.

Sauvegardes en trois couches dès le jour 1 : instantanés de volume (quotidien 6 jours, hebdomadaire 27, mensuel 89), PITR (fenêtre 4 semaines, commence à l'activation), `pg_dump --format=custom` hebdomadaire chiffré vers le projet de sauvegarde ; exercice de restauration trimestriel chronométré et consigné dans `audit_log` (R25 §5.6). Limite de dépense dure Railway à 1,5 fois la facture attendue (150 $ à 6 clients, 400 $ à 20), alerte douce à 1,2 fois (R25 §11.13).

### 11.2 Postgres : tables principales

Décisions prises avant la première migration (R25 §9) et validées par le skill `agents-base-donnees` (`/db`) avec le Railway CLI avant la première ligne de code : UUIDv7 partout ; `tenant_id` non nul sur chaque table métier ; clé primaire composite `(tenant_id, id)` sur les tables volumineuses pour que l'index serve la RLS ; rôles `migrator` (propriétaire), `app_rw` (sans `BYPASSRLS`, `FORCE ROW LEVEL SECURITY`), `app_ro`, `backup` (`row_security = off` pour qu'un `pg_dump` partiel échoue) ; `app.tenant_id` et `app.actor_id` posés par `set_config(..., true)` dans chaque transaction Drizzle, puis `set local role app_rw` ; politique restrictive unique par table générée par un helper Drizzle ; `timestamptz` partout, `tenant.timezone` pour la planification ; `usd_micro` en bigint ; `audit_log` et `cost_ledger` partitionnés par mois dès le départ ; `tenant.data_region` prévu même si tout est à Amsterdam.

| Table (schéma `app` sauf mention) | Colonnes clés | Index et contraintes |
|---|---|---|
| `tenant` | id, name, vertical (enum 6), country, timezone, register (standard, parle_nouchi, bilingue), platforms_json (découverte, relation), silence_policy, data_region, plan (presence, croissance, video_plus, eglise), status, created_at | unique slug |
| `user`, `membership` | user : id, email, phone_hash, role_global ; membership : (tenant_id, user_id), role (owner, manager, client_viewer) | unique (tenant_id, user_id) |
| `tenant_key` | tenant_id, dek_encrypted, key_version, rotated_at | une ligne active par tenant |
| `tenant_secret` | (tenant_id, id), kind (oauth_token, byok, whatsapp_number, voice_id), ciphertext, nonce, tag, key_version, expires_at | index (tenant_id, kind) |
| `social_connection` | (tenant_id, id), platform, external_id, handle, connector (unified, meta_direct, ...), unified_profile_ref, secret_id → tenant_secret, scopes_json, api_version, status (ok, a_reconnecter, revoque), token_expires_at, last_checked_at | unique (platform, external_id) ; index status |
| `brand_brain` | (tenant_id, id), version, voice_sheet_json (règles, lexique, interdits, exemples), pillars_json (60/25/15), frameworks_json, hashtags_json, compliance_profile_json, cached_prompt_hash, validated_by_client_at | une version courante par tenant |
| `asset` | (tenant_id, id), kind (original, derived), source (upload, whatsapp, drive, daily, gpt_image, fal, higgsfield, remotion, ffmpeg, canva), sha256, bytes, mime, width, height, duration_ms, storage (railway), bucket, key, retention_class (keep, 90d, 7d), expires_at, legal_hold, created_by, deleted_at, purged_at | unique (tenant_id, sha256) ; index (tenant_id, expires_at) where purged_at is null |
| `asset_variant` | (tenant_id, id), asset_id, variant (audio_mp3, proxy_720, clip_916, clip_long, thumb, planche_png, sub_ass, export_afrique, export_1080), version, key, bytes, params_json, engine, engine_version, parent_variant_id | index (asset_id, variant, version desc) |
| `asset_rights` | asset_id, rights_kind (owned, licensed, ugc, platform_terms), licence_ref, persons_json, consent_id, expires_at, territory | |
| `consent` | (tenant_id, id), person_name, person_kind (adulte, mineur_avec_parent), scope, document_key, signed_at, expires_at, revoked_at | index (tenant_id, revoked_at) |
| `ai_label` | variant_id, is_aigc (bool), generator, generator_version, prompt_hash, realistic (bool), real_person (bool), minor (bool), c2pa_key, disclosed_at | étiquette au niveau variante (R25 §9.8) |
| `external_ref` | (tenant_id, id), object_type, object_id, system (upload_post, meta_container, tiktok_publish, youtube_video, higgsfield_request, canva_design, batch_anthropic), external_id, url, synced_at | index (system, external_id) |
| `asset_url` | asset_id, variant_id, purpose (planche, review, publish, export), url_hash, expires_at, issued_to, revoked_at | jamais l'URL en clair |
| `source`, `item`, `dossier` (veille, R06 §13.1) | source : (tenant_id, id), type, config_json, frequency, unit_cost_micro, last_run_at, health ; item : (tenant_id, id), canonical_url, content_hash, embedding (vector), entities_json, score_relevance, score_fresh, score_trend, pillar, urgency, risk, status ; dossier : item_id, facts_json (avec confiance et URL), sources_json, angle, format, window_start, window_end, verified_at | unique (tenant_id, content_hash) ; index (tenant_id, status, score desc) ; index ivfflat sur embedding |
| `signal` | (tenant_id, id), kind (trend, product_new, site_update, event, sermon, deposit), detected_at, payload_json, item_id, source_asset_id | index (tenant_id, detected_at) |
| `calendar_moment` | (tenant_id, id), date, kind (fete_fixe, fete_lunaire, journee_mondiale, liturgique, propre), label, window_days, confirmed_at, proposed_at | index (tenant_id, date) |
| `campaign` | (tenant_id, id), sequence_template_id (ref), trigger_signal_id, start_at, status | |
| `content_item` | (tenant_id, id), campaign_id, signal_id, source_asset_id, format (post, carrousel, visuel, reel_gen, reel_remotion, clip_sermon, ugc, story, miniature, tuto), platform, pillar, framework, scheduled_at, status (enum section 3.3), current_version_id, board_id, judge_score, ai_label_required, needs_human_gate3 | index (tenant_id, status) ; index (tenant_id, scheduled_at) ; contrainte de transition via trigger |
| `content_version` | (tenant_id, id), content_item_id, version, text_json (hook, body, hashtags, alt, script), prompts_json, asset_ids[], maquette_variant_id, final_variant_ids[], generated_by_model, cache_read_tokens, revision_reason | unique (content_item_id, version) |
| `judge_score` | content_version_id, rubric_version, model, prompt_hash, scores_json (7 critères), facts_verified_json, decision, created_at | index (content_version_id) |
| `board` | (tenant_id, id), week_start, status (section 3.2), composite_variant_id, sent_at, reminder1_at, reminder2_at, closed_at, pillar_mix_json | unique (tenant_id, week_start) |
| `board_item` | board_id, content_item_id, position, verdict (null, valide, a_revoir, refuse), motive, verdict_channel (whatsapp_button, whatsapp_flow, pwa, email, voice), verdict_at | |
| `magic_link` | (tenant_id, id), token_hash, board_id, expires_at, used_count, revoked_at | unique token_hash |
| `validation` | (tenant_id, id), board_id, board_item_id, verdict, motive, transcript, wa_message_id, actor, created_at | journal brut des réponses |
| `publication` | (tenant_id, id), content_item_id, social_connection_id, connector, status (programme, en_cours, publie, publie_manuel, en_attente_reconnexion, echec), scheduled_at, published_at, external_post_id, permalink, attempt_count, last_error, ai_flag_sent | index (tenant_id, status, scheduled_at) ; index (social_connection_id, published_at) |
| `publication_attempt` | publication_id, attempt, request_hash, response_json (sans jeton), status, at | |
| `manual_package` | (tenant_id, id), content_item_id, package_key, instructions_json, assigned_to, done_at, pasted_url | |
| `account_metric_daily`, `media_metric_snapshot`, `metric_alias`, `tracked_link`, `link_click`, `conversion_event`, `coupon`, `coupon_redemption`, `whatsapp_inbound`, `benchmark`, `monthly_report` | reprises de R24 §7 à l'identique, avec `tenant_id` et clés composites | voir R24 §7 pour les colonnes ; append-only sur les relevés |
| `whatsapp_message` | (tenant_id, id), direction, wa_message_id, template_name, category, phone_hash, media_asset_id, status (sent, delivered, read, failed), cost_micro, window_open_until, created_at | unique wa_message_id |
| `whatsapp_template` | name, language, category, status, last_category_update_at, body_hash | bloque l'envoi si reclassé |
| `inbox_item` | (tenant_id, id), platform, kind (comment, dm), external_id, author_hash, text, classification (6 classes), draft_reply, requires_human, replied_at, replied_by, human_agent_tag | index (tenant_id, requires_human, replied_at) |
| `boost_proposal` | (tenant_id, id), publication_id, metrics_24h_json, budget_proposed_micro, status (proposed, approved, running, stopped), approved_via, created_at | plafond mensuel vérifié par trigger contre `tenant_budget` |
| `llm_call` | (tenant_id, id), job_id, model, purpose, input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, usd_micro, latency_ms, stop_reason, batch_id, custom_id | index (tenant_id, created_at) ; partition mensuelle |
| `cost_ledger` (partitionnée) | (tenant_id, id), provider, model, unit, qty, usd_micro_reserved, usd_micro_actual, object_type, object_id, occurred_at | index (tenant_id, occurred_at) |
| `tenant_budget` | tenant_id, scope (jour, mois), category (images, video, transcription, llm, whatsapp, total), cap_micro, alert_ratio | vérifié par le worker avant chaque appel (R25 §7.2) |
| `retention_job` | key, due_at, done_at, verified_at | index due_at where done_at is null |
| `audit.audit_log` (ajout seul, partitionnée) | tenant_id, actor (humain, agent, job), action, object_type, object_id, before_hash, after_hash, ip, session_id, at | trigger interdisant UPDATE et DELETE au rôle applicatif ; conservation 13 mois |
| `ref.sequence_template`, `ref.platform_rule`, `ref.content_transition`, `ref.tarif_whatsapp`, `ref.holiday`, `ref.bible_segond1910`, `ref.setting` | données partagées sans RLS | |
| `pgboss.*` | files pg-boss ; charges utiles = identifiants seulement, jamais de données client (R25 §5.1) | hors RLS |

### 11.3 Files pg-boss

Pas de Redis, pas de SaaS d'orchestration avant 30 clients (R07 §11.5). Clés de singleton `tenant:type:date:hash(brief)` ; retries avec backoff exponentiel ; dead letter visible dans l'écran Agence ; `retention_purge`, `token_refresh`, `metrics_collect`, `board_generate`, `board_remind` en cron pg-boss ; concurrence par file (`rendu` 1 par réplica, `publication` 2, `veille` 4, `juge` 8). Aucune tâche de plus de 30 minutes sans point de reprise (R07 §8.3) : un sermon est découpé en jobs chaînés (transcribe → analyse → cut → subtitle → dress → board).

### 11.4 Sécurité multi-locataires

RLS forcée avec politique restrictive `tenant_id = current_setting('app.tenant_id', true)::uuid` en `USING` et `WITH CHECK` sur chaque table métier ; `current_setting(..., true)` renvoie NULL sans variable posée, donc aucune ligne (R25 §5.1). Clé S3 toujours construite par `keyFor(tenantId, ...)` et validée par expression régulière avant tout `GetObject`, `PutObject`, `DeleteObject` ; Railway n'ayant qu'un couple de clés par bucket, l'isolation du bucket est applicative, et un client exigeant une isolation forte reçoit un bucket Railway dédié (coût nul, R25 §5.2). Batterie d'isolation automatisée à chaque migration (deux locataires, chaque table, chaque rôle), générée par le skill `/db`. Webhooks vérifiés par signature (`X-Hub-Signature-256` Meta et WhatsApp, HMAC Upload-Post si fourni) avant mise en file. Liens magiques à usage borné. Limitation de débit sur les routes publiques. Clés fournisseurs en variables du seul service `worker`, rotation à 90 jours, OpenAI en projet « machine-prod » avec plafond mensuel dur et clés expirant à 90 jours (R25 §7.2).

### 11.5 Chiffrement des jetons

Enveloppe à deux niveaux (R25 §5.3, R02 §10.2) : KEK en variable Railway du service, jamais en base ; DEK AES-256-GCM par client, générée à la création du locataire, stockée chiffrée par la KEK dans `tenant_key` ; jetons OAuth, clés BYOK, numéros WhatsApp, identifiants de voix clonée chiffrés avec la DEK, nonce et tag stockés, `key_version` pour la rotation. Rotation de la KEK une fois par an (rechiffre quelques lignes de DEK) ; rotation d'une DEK rechiffre les secrets d'un seul client ; suppression de la DEK à la fin du contrat rend illisible tout résidu. Les médias ne sont pas chiffrés applicativement (le chiffrement au repos du bucket suffit et les URL présignées restent possibles). Les jetons ne sortent jamais vers les journaux : `publication_attempt.response_json` est expurgé par un sérialiseur unique.

### 11.6 Observabilité et tests

- Phase 1 : `llm_call` et `cost_ledger` comme traces ; journaux structurés pino avec `tenant_id`, `job_id`, `content_type` ; alertes WhatsApp au gestionnaire (CallMeBot pour José seul, Cloud API pour le reste) sur dead letter, plafond à 80 %, connexion à reconnecter, test hebdomadaire rouge. Phase 2 : Langfuse Hobby (50 000 unités gratuites, R07 §8.2) puis auto-hébergé sur Railway ou Core 29 $, avec score du juge par trace ; comparaison mensuelle entre la facture Console Anthropic et les estimations locales (R07 §11.16).
- Tests : batterie RLS à chaque migration ; tests de contrat par connecteur contre comptes de test (hebdomadaires en production) ; lot d'évaluation de 50 cas par verticale pour le juge, cinq essais par configuration avant toute optimisation de modèle ou de caching (R07 §11.20) ; jeu de 30 phrases françaises accentuées rejoué à chaque changement de moteur d'image (R03 §12.11) ; tests de rendu (frames clés Remotion comparées par hash perceptuel) ; test Playwright de la page de validation à 390 px ; test de restauration trimestriel.
- Contrôle trimestriel automatique des pages primaires citées (prix OpenAI et Claude, dépréciations, référence ig-user/media, guidelines TikTok, conditions Higgsfield) avec diff et alerte : sur dix faits vérifiés, six avaient bougé en moins de six mois (R26 §5.19).

### 11.7 Déploiement

GitHub → Railway automatique sur `main` pour les quatre services (aucun volume sur les services applicatifs, donc pas de coupure) ; migrations Drizzle exécutées par `migrator` dans la commande de pré-déploiement du service `web`, idempotentes, jamais destructives sans migration en deux temps (ajouter, migrer les données, retirer) ; drapeaux de fonctionnalité dans `ref.setting` ; script de garde `scripts/garde-service.mjs` comme dans le dépôt 2IAE, qui refuse une construction destinée à un autre service ; jamais `railway up` à la main ; environnement `staging` Railway avec sa propre base (copie anonymisée) pour les migrations lourdes. Fenêtre d'évitement : pas de redéploiement entre 05:45 et 06:30 GMT (collecte) et pendant un lot de rendu de sermons (le job reprend, mais autant éviter).

### 11.8 Coûts d'hébergement

Repris de R25 §8 : 85 à 110 $ par mois à 6 clients (dont web 20 $, Postgres 16 $, worker 30 $, rendu 13 $, buckets 6,40 $, PITR 2 $, sortie réseau 2,60 $), 230 à 290 $ à 20 clients, soit 12 à 18 $ par client ; le second projet de sauvegarde ajoute 5 à 20 $ de bucket. Le stockage reste sous 40 $ par mois la première année même avec 7 églises en 1080p (proxy 720p plus audio divise par trois, R25 §11.5). Hors facture Railway : Upload-Post 50 $, SerpApi 25 à 75 $, Apify 19 $, Canva Teams existant, licence Remotion 0 $ si l'effectif reste à 3 (sinon Automators 100 $ minimum, R25 §10.6), abonnement Claude Max de José (outil personnel, hors machine).

---

## 12. Coûts et modèle économique

Taux de conversion de R10 §9 : 610 FCFA pour un dollar, 430 FCFA pour un dollar canadien, euro fixe à 655,957 FCFA.

### 12.1 Coût mensuel par client type, hors gestionnaire humain

| Poste | Église (4 sermons, 20 clips, 10 citations, dévotionnels, 2 annonces) | Beauté (12 Reels génératifs, 8 carrousels, 4 UGC, 20 posts, stories) | École (16 vidéos programmées, 2 teasers génératifs, 8 carrousels, 20 posts FB) |
|---|---|---|---|
| Transcription (AssemblyAI 0,21 $ / h) | 0,84 $ | 0 | 0,50 $ (replays) |
| Jetons Claude (R07 §7, majorés de 30 %, Batch sur veille et juges) | 4 à 6 $ (4 analyses à 0,45 $, 30 légendes, juges, vision) | 9 à 14 $ | 9 à 13 $ |
| Images (R03 §9) | 0,50 à 1 $ (miniatures, citations HTML) | 1,50 à 4 $ | 2 à 4 $ |
| Vidéo générative (plafond contrat) | 0 (contenu réel, pas de label) | 12 Reels × 2 clips × 8 s × 0,084 $ × 3 prises = 48 $ (Kling 3.0) à 58 $ (Veo 3.1 Fast) ; UGC 4 × 2,5 $ = 10 $ ; plafond 120 $ (R25 §7.2) | 2 teasers × 6 $ = 12 $ |
| Vidéo programmée, voix, musique, rendu | 2 $ (part du service rendu) | 3 à 10 $ | 5 à 8 $ |
| Veille (R06 §14.2) | 5 à 10 $ | 12 à 25 $ | 12 à 25 $ |
| WhatsApp (R22 §8.1) | 0,10 $ | 0,10 $ | 0,10 $ |
| Mesure et rapport (R24 §8) | 1 à 3 $ | 1 à 3 $ | 1 à 3 $ |
| Publication unifiée (50 $ / 6 clients) | 8 $ | 8 $ | 8 $ |
| Infrastructure Railway (R25 §8) | 14 à 18 $ | 14 à 18 $ | 14 à 18 $ |
| Stockage et sauvegarde (R25 §4.4) | 1,30 à 5,50 $ (selon 720p ou 1080p) | 0,85 $ | 1 $ |
| Enregistrement Daily (option, R21 §9.7) | 4,84 $ | 0 | 0 |
| **Total hors humain** | **40 à 55 $** | **105 à 150 $** | **60 à 90 $** |
| Gestionnaire humain (R08 §6.3) | 3 à 4 h : 20 000 à 30 000 FCFA à Abidjan | 5 à 6 h : 160 à 300 CAD au Canada ou 30 000 à 45 000 FCFA | 4 à 5 h |

### 12.2 Tarifs de vente

| Palier | Contenu | Abidjan (FCFA) | Canada (CAD) | France (EUR) |
|---|---|---|---|---|
| Église | 4 sermons, 20 clips, dérivés écrits, dévotionnel, 2 plateformes, publication, rapport | 175 000 | 450 | 300 |
| Présence | 12 visuels, 4 vidéos programmées ou 2 génératives, 2 plateformes, planche hebdomadaire, rapport | 250 000 | 900 | 600 |
| Croissance | 20 contenus, 8 vidéos dont 4 génératives, boîte de réception assistée, 3 plateformes | 400 000 | 1 500 | 1 000 |
| Vidéo+ | 12 Reels génératifs, 4 UGC, 8 carrousels, stories, boost proposé, 4 plateformes | 650 000 | 2 800 | 1 800 |
| Logiciel seul (client avec community manager) | planche, veille, juge, mesure, sans production vidéo | 100 000 | 300 | 200 |

Ces montants se situent dans les fourchettes documentées (Abidjan 300 000 à 900 000 FCFA en agence, R10 §1 ; Canada 500 à 3 500 CAD ; France 500 à 1 500 EUR, R08 §10.4) ; l'offre église (environ 287 $) reste 5 à 10 fois sous Church Media Squad et 2 à 4 fois au-dessus de Sermonshots (R05 §8.18). Surcoût par prise vidéo au-delà du plafond, écrit au contrat. Paiement : Stripe au Canada, Wave Business ou CinetPay en Afrique (lien de paiement WhatsApp, webhook), relance 3 jours avant l'échéance, suspension douce après retard (R10 §8.11).

### 12.3 Marge et seuil de rentabilité

- Église Abidjan : 175 000 FCFA ≈ 287 $ ; coût 50 $ + humain 25 000 FCFA (41 $) ; contribution ≈ 196 $ (68 %).
- Présence Canada : 900 CAD ≈ 635 $ ; coût 75 $ + humain 220 CAD (155 $) ; contribution ≈ 405 $ (64 %).
- Vidéo+ Abidjan : 650 000 FCFA ≈ 1 065 $ ; coût 150 $ + humain 40 000 FCFA (66 $) ; contribution ≈ 849 $ (80 %).

Socle fixe mensuel : Railway 100 $, sauvegarde 10 $, Upload-Post 50 $, SerpApi 25 $, Apify 19 $, domaine court et WhatsApp fixes 5 $, soit environ 210 $ (hors abonnements personnels de José : Claude Max, Higgsfield Unlimited, Canva). **Seuil de rentabilité : un client Présence au Canada ou deux clients à Abidjan.** À 6 clients pilotes (2 églises, 2 beauté ou édition, 2IAE et un Canadien), le revenu mensuel se situe entre 1 800 et 2 500 $ pour 450 à 650 $ de coûts variables et 210 $ de socle. Le vrai plafond n'est pas financier : c'est le temps de gestionnaire (4 à 6 heures par client) et, pendant 90 jours, le temps de construction de José.

---

## 13. Risques, limites et garde-fous

| Risque | Parade |
|---|---|
| **Juridique : droits sur les sorties IA.** Une image brute sans apport humain n'a probablement pas d'auteur au Canada, en France ni dans l'OAPI (R08 §1.5) | registre de provenance par média (moteur, version, prompt, références, compte, plan, date) ; preuve de l'apport humain (composition, corrections) ; licences payantes seulement, jamais de palier gratuit pour un contenu publié (R08 §10.9) ; clause 5 du contrat type (R08 §8.1) |
| **Consentements et droit à l'image** (églises, écoles, mineurs) | table `consent` liée aux médias ; blocage de toute publication référençant un visage sans consentement actif ; aucun mineur sans autorisation parentale (R09 §11.9) ; floutage automatique du public dans les sermons ; clause « pas de deepfake » |
| **Étiquetage IA** (AI Act article 50 depuis le 2 août 2026, TikTok depuis le 24 septembre 2026, Meta et YouTube par auto-déclaration, R08 §10.10) | `ai_label` calculé par variante à la génération ; drapeau natif coché à la publication (`is_ai_generated`, `is_aigc`) ; motion design, captures et vidéos réelles non étiquetés ; C2PA conservé ; taux d'étiquetage conforme affiché |
| **Données personnelles** (PIPEDA, Loi 25 jusqu'à 10 M$ ou 2 % du CA, RGPD, loi ivoirienne 2013-450 et ARTCI, R26 §2.9, R25 §5.5) | hébergement Amsterdam documenté avec la liste des sous-traitants par client ; évaluation avant transfert hors Québec ; job `tenant_offboard` (export ZIP avec manifeste et sommes de contrôle, suppression vérifiée, suppression de la DEK, attestation PDF, R25 §5.5) ; hachés salés pour les numéros et IP ; José désigné responsable de la protection des renseignements personnels |
| **Allégations beauté** (Santé Canada, règlement 655/2013, politique Meta du 23 juillet 2026) | lexique d'allégations interdites par pays dans le profil de conformité ; contrôle de la légende, du texte incrusté et de la voix off avant la planche ; avant/après 18 ans et plus, aucune promesse chiffrée, aucun message d'infériorité, exclusion des produits éclaircissants (R26 §2.8, R09 §11.10) |
| **Anti-pourriel** (CASL jusqu'à 10 M$, politique WhatsApp du 23 septembre 2026) | opt-in nominatif au contrat, journal de preuve, STOP automatique, deux rappels maximum, modèles utilitaires seulement, surveillance de la note de qualité (R22 §10.12) |
| **Technique : dépendance aux API et dépréciations** (gpt-image-1 le 23 octobre 2026, gpt-image-1.5 le 1er décembre, Sora 2 retirée, LinkedIn 202510 retirée le 15 octobre, Facebook métriques retirées le 15 juin 2026) | adaptateurs par fournisseur avec repli automatique ; versions d'API en configuration ; `metric_alias` versionnée ; tests hebdomadaires de contrat ; contrôle trimestriel des pages primaires avec diff et alerte |
| **Technique : dépendance à l'API unifiée** (si Upload-Post perd une app Meta, tous les clients sont coupés, R02 §8.1) | dossiers d'accès officiels déposés dès la semaine 1 ; `MetaDirectConnector` opérationnel dès le jour 1 sur les pages de l'agence ; paquet manuel ; Blotato comme second fournisseur configurable |
| **Technique : pannes silencieuses** (jeton Instagram à 60 jours, PubSubHubbub à renouveler, Railway sans cycle de vie, cron qui saute un run) | jobs quotidiens de rafraîchissement et alerte J-10 ; réabonnement PubSubHubbub tous les 3 jours (R21 §9.13) ; job de rétention maison ; tick qui sort en moins d'une minute ; limite de dépense dure ; sauvegardes trois couches dans un second projet |
| **Qualité : slop et communication plate** (56 % voient du AI slop souvent, 50 % des Gen Z ont désabonné une marque pour cela, R11 §2.1) | juge 7 critères avec test de substitution ; banque d'assets réels obligatoire pour tout contenu émotionnel ; 20 % du mix 100 % humain fourni par le client ; liste française d'interdits lexicaux construite par statistique sur 500 brouillons (R11 §15.6) ; introduction originale par clip de sermon pour échapper au critère « gabarit » de YouTube (R11 §15.8) |
| **Qualité : hallucinations de faits** | règle des deux sources ; champs sous 0,8 de confiance bloquants ; ligne « faits à confirmer » sur la planche ; exclusion du newsjacking politique et religieux pour les églises, SEVARTA et 2IAE |
| **Qualité : filtres de contenu des moteurs vidéo** (Veo refuse les enfants en I2V, faux positifs documentés, R04 §2.2) | test des filtres par verticale avant de signer (culte, enfants, cosmétiques sur peau, foules) ; bascule automatique vers le modèle suivant ; humain réel là où l'émotion porte le message (R04 §8.17) |
| **Opérationnel : José seul pendant la construction ; dérive des coûts de génération** (seul poste qui peut tripler, R08 §10.5) | périmètre strict par phase ; achat de tout ce qui est résolu ; API directe plutôt qu'agents ; pas de portail client complet avant d'avoir mesuré que les clients l'ouvrent (R21 §9.11) ; `tenant_budget` vérifié avant chaque appel, prises plafonnées à 3, alerte à 80 %, mode brouillon avant validation |
| **Opérationnel : Higgsfield et séparation 2IAE** | API officielle seulement pour les clients ; Unlimited réservé à l'atelier manuel de José ; aucun visage de pasteur ni d'enfant en référence (section 4.4, R26 §2.4) ; projet Railway distinct du campus, lecture seule de ses données publiques (CLAUDE.md) |

---

## 14. Feuille de route : 90 jours, puis extension

### 14.1 Acheter ou construire

| Brique | Décision | Justification |
|---|---|---|
| Publication multi-plateformes | **Acheter** (Upload-Post Pro 50 $) puis **construire** les connecteurs officiels client par client | problème résolu et réglementé ; les délais d'accès ne se compressent pas (R02 §12.1) |
| Transcription | Acheter (AssemblyAI 0,21 $ / h, Scribe v2 en second) | WhisperX auto-hébergé n'a de sens qu'au-delà de 200 h par mois (R05 §8.19) |
| Génération d'images | Acheter (OpenAI GPT Image 2.5 via Responses API ; fal pour FLUX.2 et Nano Banana 2 ; Photoroom) | prix à 0,006 à 0,053 $ ; abstraction `ImageProvider` |
| Génération vidéo | Acheter (API Higgsfield Kling 3.0 et Seedance 2.5 ; Gemini Veo 3.1 Fast en second adaptateur, phase 3) | API officielles, asynchrones, semblables (R04 §8.2) |
| Vidéo programmée | **Construire** sur Remotion et ffmpeg | la pile de José est celle de Remotion ; coût centimes |
| Découpe de sermons | **Construire** (ffmpeg, libass, Claude) | 0,80 à 2,50 $ par sermon ; différenciation française ; Vizard API seulement si retard |
| Veille | **Construire** sur flux gratuits + SerpApi + Apify + Tavily | aucun outil ne couvre Abidjan en français ; Hootsuite Listening vend cela à 399 $ par siège (R01 §8.4) |
| Planche, validation WhatsApp, lien magique | **Construire** (Cloud API directe, pas de BSP) | objet central, aucun équivalent sur le marché |
| Cerveau de marque, juge, QC vision | **Construire** (API Messages, sorties structurées) | avantage défendable (R01 §8.8) |
| Boîte de réception commentaires et messages | **Construire** (API Meta gratuites) | ManyChat ou Agorapulse coûteraient 174 à 234 $ pour six clients sans la voix du client (R23 §8.1) |
| Lien en bio, QR, raccourcisseur, rapport mensuel | **Construire** | remplace 38 $ par client d'outils tiers (R24 §8) |
| Orchestration | pg-boss (gratuit) | zéro composant supplémentaire (R07 §8.3) |
| Observabilité LLM | tables maison puis Langfuse Hobby | 0 à 29 $ |
| Composition déterministe de visuels | Construire (React + Playwright) ; Canva Connect Autofill en option phase 3 | 0 $ hors CPU ; Canva pour les retouches du client |
| Extraction de dépôts (flyers, INCI, PDF) | Acheter (Claude vision + JSON Schema ; Mistral OCR 4 en seconde ligne pour les PDF longs, 2 $ par 1 000 pages en batch) | R21 §9.1 |

### 14.2 Phases

**Phase 0 (semaine 0, avant toute ligne de code).** Dépôt des demandes d'accès qui courent pendant la construction (R02 §12.2, R21 §9.12, R23 §8.2) : app Meta liée à Markel-Tech Inc. vérifiée, Advanced Access sur publication, commentaires, messages, `ads_management`, Instagram Public Content Access et Page Public Content Access, étiquette HUMAN_AGENT, avec screencast ; projet Google Cloud et audit YouTube API Services ; app TikTok et audit Content Posting ; app LinkedIn Community Management Development Tier ; accès API Google Business Profile ; WhatsApp Business Platform sous le portefeuille Markel-Tech, vérification d'entreprise, SIM +225 et numéro +1, six modèles utilitaires ; compte Upload-Post Free pour test ; clé API Higgsfield (open.higgsfield.ai) ; compte AssemblyAI ; projet OpenAI « machine-prod » avec plafond dur. Mesure de latence Abidjan vers Amsterdam. Exécution du skill `/db` sur le schéma de la section 11.2 avec le Railway CLI : migrations, seed, batterie d'isolation, audit noté, jusqu'au feu vert. Contrat type en trois versions (Ontario, France, Côte d'Ivoire) envoyé à relecture d'avocat. **Critère de sortie** : schéma validé par `/db`, dossiers déposés avec numéros de suivi, deux numéros WhatsApp actifs et modèles approuvés.

**Phase 1 (jours 1 à 30) : socle et pilote église.** Monorepo, quatre services Railway, Postgres avec RLS, bucket, sauvegardes trois couches, `tick`, pg-boss, tables de la section 11.2 ; chiffrement par enveloppe ; onboarding en 60 minutes (brand kit Firecrawl + Claude, import de 50 posts par Business Discovery, fiche de voix, R21 §5.5) ; ingestion WhatsApp (dépôt, accusé de réception, vocaux transcrits) ; pipeline sermon complet (PubSubHubbub, Drive ou Daily, transcription, analyse, découpe centrée, sous-titres ASS, habillage Remotion de base, dérivés écrits, profil d'export Afrique mobile et 1080p) ; génération de posts et de citations HTML ; juge 7 critères et vision ; planche PWA 390 px + composite + modèle `planche_prete` + boutons + lien magique + rappels + règle de silence ; porte 1 et porte 3 dans le poste de pilotage ; `UnifiedConnector` (Upload-Post) et `MetaDirectConnector` pour les pages de l'agence ; paquet manuel ; collecte nocturne des métriques ; `cost_ledger` et `tenant_budget`. Clients : une église d'Abidjan (pilote payant ou gratuit un mois), SEVARTA et la page 2IAE comme locataires internes. **Critères de sortie** : un sermon déposé le dimanche donne une planche le lundi midi et 5 clips publiés du lundi au samedi sans intervention de José hors validation ; WER mesuré sur 5 sermons de référence ; taux d'acceptation de la planche ≥ 70 % sur 4 semaines ; batterie RLS verte ; restauration d'un dump testée ; coût réel par sermon sous 3 $ ; zéro jeton en clair dans les journaux.

**Phase 2 (jours 31 à 60) : beauté, veille, mesure affaires.** Dépôt de produits (6 clichés, extraction INCI vérifiée, détourage, boîte photo LED à 18 000 FCFA prêtée, R21 §9.17) ; photo produit mise en scène ; Reels génératifs via API Higgsfield (Kling 3.0, 3 prises, mode brouillon frame 0) avec montage Remotion, voix ElevenLabs, étiquette IA ; carrousels Playwright ; séquence lancement produit 5 étapes ; profil de conformité beauté ; veille flux A, B, D (RSS, GDELT, SerpApi, calendrier des moments à 8 semaines) avec scoring Batch et règle des deux sources ; liens traçables, lien en bio maison, coupons, `conversion_event`, premier rapport mensuel PDF + WhatsApp ; recadrage MediaPipe ; WhatsApp Flow générique ; Langfuse Hobby ; calibration du juge sur 100 posts par verticale (kappa ≥ 0,6). Clients : une marque de beauté d'Abidjan, une seconde église. **Critères de sortie** : délai dépôt vers planche médian ≤ 24 h ; taux de dépôts incomplets renvoyés < 20 % ; corrections humaines sur fiches extraites < 10 % (R21 §9.18) ; coût de génération beauté sous le plafond de 120 $ ; rapport mensuel livré le premier lundi avec couche affaires non vide ; 100 % des médias photoréalistes étiquetés.

**Phase 3 (jours 61 à 90) : école, serveur MCP, boîte de réception, Canada.** Verticale école (comptes à rebours, carrousels métiers, récaps à partir de plans fournis, registre des autorisations d'image bloquant) ; serveur MCP distant « machine-social » avec OAuth 2.1 et dix outils, testé depuis Claude Cowork et Claude Code ; file d'ordres de scènes pour l'atelier Higgsfield de José ; Routine « revue hebdomadaire » tirée par le tick ; boîte de réception commentaires et messages (tri Haiku, brouillons, validation, HUMAN_AGENT) dès que l'Advanced Access est accordé ; règle de boost en trois temps ; veille flux C (Apify TikTok partagé, hashtags Instagram, concurrents, changedetection.io) ; indicateurs « à la page » complets ; Veo 3.1 Fast en second adaptateur vidéo ; premier client canadien (Stripe, numéro +1, créneaux heure de l'Est) ; migration des pages Meta de l'agence vers le connecteur direct si l'Advanced Access est obtenu. **Critères de sortie** : 6 locataires actifs dont 4 payants ; test hebdomadaire de publication et de collecte vert quatre semaines de suite ; MCP utilisable depuis Cowork avec approbation d'une planche de bout en bout ; délai médian de réponse aux commentaires affiché ; facture Railway sous 150 $ ; marge brute hors humain ≥ 60 % sur chaque client payant.

**Après 90 jours (jours 91 à 180).** Connecteurs officiels YouTube et Meta pour tous les clients, LinkedIn Standard Tier et verticale B2B, TikTok direct après audit, Agent SDK dans un conteneur dédié, Canva Connect Autofill, verticales association et édition en séquences complètes, bandit par verticale, Routine « incident », Managed Agents en option si José veut cesser d'opérer le conteneur agent (R07 §11.18), passage à Upload-Post Advanced (147 $, 75 profils) ou aux apps propres selon le nombre de clients.

**Premier client pilote** : une église d'Abidjan (85 % automatisable, aucun label IA, public affectif, pipeline mesurable en une semaine), avec SEVARTA et la page 2IAE comme locataires internes pour tester la beauté des visuels et la mesure sans risque client. Critères du pilote de 4 semaines (R05 §8.20) : WER, taux d'acceptation des propositions, rétention à 3 s, portée hors assemblée.

---

## 15. Questions ouvertes pour José

1. **Effectif de Markel-Tech** (salariés et contractuels) : la licence Remotion est gratuite jusqu'à 3 personnes ; au-delà, ou si Remotion considère qu'une plateforme vendant des rendus relève d'Automators, c'est 100 $ par mois minimum (R25 §10.6). La réponse change la ligne budgétaire, pas l'architecture.
2. **Cowork au 6 octobre 2026** : la bascule « nuage uniquement » des plans Pro et Max est-elle effective dans son application (R07 §10.1) ? Elle conditionne la façon dont son atelier Higgsfield local est piloté par tâche planifiée.
3. **Qui est le gestionnaire humain** à Abidjan et au Canada, à quel coût horaire, et José accepte-t-il de n'être que la porte 3 après le premier mois ? Le modèle économique repose sur 4 à 6 heures par client.
4. **Règle de silence par défaut** : publier les contenus « valeur » et « relation » après deux rappels, ou ne rien publier ? À cocher au contrat et à l'onboarding (R08 §8.1 clause 2).
5. **Originaux de sermons** : conserver le 1080p (environ 3 Go, 2,40 $ par église et par mois au bout d'un an) ou un proxy 720p plus l'audio (1 Go) ? L'église garde la source sur YouTube (R25 §11.5).
6. **Latence Abidjan vers Amsterdam** mesurée depuis une connexion ivoirienne avant de figer la région (aucune mesure n'a pu être chargée, R25 §10.2).
7. **Upload-Post ou Blotato** comme API unifiée de départ : à trancher par un test d'une semaine en phase 1 sur les plans gratuits ou d'essai (publication d'un Reel, lecture des statistiques, étiquette IA, fiabilité).
8. **Plafonds de génération au contrat** : 60 $ par mois pour une église et 120 $ pour la beauté (R25 §7.2) conviennent-ils, et le surcoût par prise supplémentaire est-il facturé ou absorbé ?
9. **Déclaration à l'ARTCI** : une agence ontarienne traitant des données de résidents ivoiriens pour le compte de clients ivoiriens doit-elle déclarer ses traitements, et faut-il un correspondant local (R25 §10.11) ? Question pour un avocat d'Abidjan.
10. **Voix clonées** : José accepte-t-il d'enregistrer 30 minutes pour une voix « Markel-Tech » et « SEVARTA », et quelles fondatrices ou pasteurs consentiraient (R04 §8.11) ?
11. **Trois événements GA4 sur www.2iae.com** (`generate_lead`, `begin_application`, `submit_application`) : José autorise-t-il la session du site à les ajouter (R24 §10.17) ?
