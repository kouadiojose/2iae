# SYNTHESE-v1. La machine de référence : la colonne vertébrale de C4, le squelette de C5, la continuité de C1, l'expérience de C2, la qualité de C3

Conception de référence de la plateforme social media multi-clients de José Kouadio (Markel-Tech, SEVARTA, 2IAE). Rédigée le 2 octobre 2026 par fusion des cinq conceptions concurrentes C1 à C5, dans l'ordre du classement cumulé des trois juges (C4 149, C5 139, C1 136, C2 130, C3 129 sur 180), à partir des dix-sept rapports de recherche R01 à R26. En cas de contradiction entre rapports, R26 prévaut. Conventions : prix en dollars américains sauf mention, datés des 1er et 2 octobre 2026 ; taux de conversion de R10 §9.9 (610 FCFA pour un dollar, 430 FCFA pour un dollar canadien, euro fixe à 655,957 FCFA), soit un dollar canadien pour environ 0,705 $. Aucune fonctionnalité n'est supposée : si une API n'existe pas dans les rapports, elle n'est pas ici.

---

## 0. Ce que la synthèse retient, corrige et tranche

### 0.1 La règle de fusion

C4 fournit la colonne vertébrale : positionnement, cinq choix, produits nommés (Chaire, Dépôt), doctrine encodée comme contrat exécutable, couche affaires en tête du rapport, grille de prix justifiée marché par marché, économie complète avec socle partagé et gestionnaire. C5 fournit le squelette : monorepo, schéma Postgres avec index et table de transitions, déploiement, staging, sauvegardes dans un second projet Railway, sécurité, connecteur Meta direct dès le jour 1. C1 fournit la continuité : règle « jamais sans contenu », réserve de sécurité, voie rapide chronométrée, reprise après panne, horloge de santé, plafonds de génération. C2 fournit l'expérience vécue : accusé de réception conversationnel, neuf files nommées, budget de notifications, version n+1 automatique, réserve validée dans le même geste, message du lundi à José. C3 fournit la qualité fabriquée : contrôle en trois couches, bancs d'essai permanents, registre des moteurs, kit de référence, profils d'export, chaîne sermon enrichie, écran Conformité.

### 0.2 Corrections factuelles apportées, vérifiées dans les rapports

| Point | Ce que disait la conception | Ce que retient la synthèse | Source |
|---|---|---|---|
| Coût complet par client (C4) | thèse : 95 à 190 $ (église), 200 à 330 $ (beauté), 140 à 230 $ (école) ; section 12 : 85 à 135 $, 226 à 460 $, 120 à 166 $ | un seul jeu de chiffres (section 12, repris en section 1) : église 85 à 135 $ à Abidjan, beauté Vidéo+ 190 à 320 $ à Abidjan et 330 à 455 $ au Canada, école 120 à 166 $ | R08 §6.3, R25 §8, R06 §14 |
| Coût d'un calendrier (C1, C4) | 0,32 $ | environ 0,45 $ par calendrier mensuel complet, révisions comprises ; 0,32 $ n'est que l'appel de génération du tableau | R07 §1 et §7 |
| Ramadan 2027 « dès le 18 février » (C4) | date affirmée | retirée : fêtes lunaires calculées, fenêtre de plus ou moins deux jours, confirmation la veille | R10 §8.9 et §9.7 |
| Sauvegarde et TikTok hors Railway (C2, C3, C4) | bucket Cloudflare R2 | second projet Railway « machine-sauvegarde » pour les originaux et les pg_dump ; TikTok en FILE_UPLOAD ; question fermée | R25 §2.2, §11.3, §11.8 |
| Atelier Higgsfield Unlimited piloté par Claude in Chrome (C1 à C5) | « atelier manuel, hors chemin critique » | automatisation interdite par la section 10.6 des conditions (26 juillet 2026) et le centre d'aide (28 août 2026), sanctionnable par suspension ; aucune brique de la plateforme n'en dépend, aucune file d'ordres de scènes ; décision personnelle de José hors plateforme | R26 §2.4 et §5.10 |
| Porte 1 (C4 : 2 h ; C1 : envoi automatique après 48 h) | | 24 heures, alerte à José, jamais d'envoi sans relecture | R01 §8.9 |
| Rappel 2 (C4) | J+4 au tableau, J+5 au texte | J+5 | R22 §10.10 |
| Pulpit AI (C4) | « 39 à 129 $ » | page de prix du 1er octobre 2026 : 39, 59, 129 $ (R05 §2.2) ; R01 §3.7 relève 49 à 50 $ ; on cite 5 à 8 $ par sermon | R05 §1 |
| Chaire à 450 CAD (C4) | « environ 325 $ » | environ 317 $ aux taux de référence | R10 §9.9 |
| Sermon Shots (C4) | « 40 à 97 $ » | 53 à 97 $ par mois en annuel | R05 §2.2 |
| YouTube Shorts (C5) | « sous 60 s » | 3 minutes | R26 §5.1 |
| Rubrique du juge (C1) | spécificité, originalité, voix, framework, exactitude, pilier, risque | spécificité, originalité, voix, hook, appel à l'action, ancrage réel, conformité | R11 §8.2 |
| Modèle du juge (C3) | Sonnet 5.5 | Haiku 4.5 par défaut | R07 §11.2 |
| Blotato pont unique (C3) | tous réseaux six mois | Starter limité à 20 comptes et 1 250 crédits : pont TikTok seulement | R26 §2.10 |
| Messages de service WhatsApp (C2) | « 1 000 gratuits puis 0,004 $ » acquis | hypothèse de coût à confirmer dans le changelog Meta | R22 §3.6, R10 §9.3 |

### 0.3 Arbitrages

1. **C4 en colonne vertébrale, pas C5.** C5 laisse José aux portes 1 et 3, omet le gestionnaire du seuil de rentabilité et ne nomme aucun produit. Le marché s'achète avec un résultat (Chaire, Dépôt, indicateurs « à la page », couche affaires) ; on garde la thèse de C4 et on y visse l'ingénierie de C5.
2. **Toute persistance sur Railway, sans exception.** FILE_UPLOAD règle TikTok (R25 §11.3) et un second projet Railway règle la sauvegarde, puisque seul le dump logique survit à la suppression d'un projet (R25 §2.2). La contrainte du 1er octobre 2026 est absolue.
3. **Higgsfield Unlimited et Claude in Chrome sortent de la conception.** R26 §2.4 décrit le pilotage navigateur comme interdit ; la plateforme n'expose pas de file d'ordres de scènes (C5) et ne compte aucun rendu venant de là. Tout ce qui est vendu passe par l'API Higgsfield, Gemini ou fal. Une suspension du compte personnel de José ne toucherait aucun client.
4. **Porte 1 à 24 heures, jamais contournée.** C4 exigeait 2 heures, C1 envoyait sans relecture après 48 heures. On garde la porte, on desserre le délai, on alerte José.
5. **Sans réponse : la réserve validée, pas la validation par cadre.** C1 publiait sans oui explicite ; la synthèse ne publie jamais un contenu que le client n'a pas vu : les créneaux non validés sont tenus par la réserve de six contenus intemporels validés le mois précédent (C1), alimentée par les deux propositions de réserve de chaque planche (C2). Case cochée au contrat ; défaut à trancher par José.
6. **Premier pilote : une église d'Abidjan, pas la beauté (C2).** Verticale la plus favorable (R09 §2.1), 85 % automatisable, aucune étiquette IA, preuve en deux dimanches, produit vendable seul (R05 §8.20).
7. **Prix église : 175 000 FCFA.** C2 fixait 350 000 (environ 575 $), hors de la fourchette 150 à 300 $ de R05 §8.18. C3, C4, C5 retiennent 175 000.
8. **Vidéo+ à Abidjan : 550 000 FCFA.** C5 (650 000) et C1 (750 000) dépassent le pack vidéo local de 500 000 à 750 000 FCFA (R10 §7.1) pour une offre qui doit encore prouver sa qualité.
9. **Trois paliers plus un palier logiciel, pas quatre.** Le palier Croissance de C2 et C5 naîtra, s'il le faut, de l'observation des pilotes.
10. **Agent SDK en phase 2, Fable 5.1 réservé.** Facteur 4 à 15 sur les jetons sans gain pour les tâches bien spécifiées (R07 §11.1) ; Fable 5.1 (10 $ et 50 $, R26 §2.3) n'écrit jamais une légende.
11. **Juge sur Haiku 4.5, calibré, second juge gpt-4o-mini.** C3 le mettait sur Sonnet 5.5 contre R07 §11.2 ; si un critère reste sous un kappa de 0,6 après deux recalibrations, ce critère seul passe sur Sonnet 5.5.
12. **Surface de moteurs réduite.** Quatre familles abstraites, quatre adaptateurs au lancement (OpenAI, fal, API Higgsfield, AssemblyAI) plus ElevenLabs ; Gemini en phase 3 ; avatars et Canva Autofill sur besoin client (R01 §8.16).
13. **UGC synthétique : option écrite, jamais par défaut.** R08 §3.1 et R11 §2.2 documentent le rejet des visages IA ; Vidéo+ comprend quatre UGC montés à partir de vidéos réelles.
14. **Publication : Upload-Post Pro plus connecteur Meta direct dès le jour 1, Blotato pour TikTok seulement.** C1 payait deux API unifiées dès J0 ; C3 faisait de Blotato (20 comptes) le pont unique.
15. **Calendrier : génération le jeudi, envoi le vendredi, production par proposition dès validation, voie rapide à part.** C4 composait le lundi avec relecture en 2 heures ; C1 s'enchaînait mal. Les quatre déclencheurs « à la page » n'attendent jamais la planche hebdomadaire.
16. **Chaîne sermon maison dès la phase 1, Vizard en filet et comparateur** (600 minutes pour 14,50 $ par mois, R05 §2.1), coupé quand le banc de cinq sermons (C3) donne l'avantage à la chaîne maison.
17. **Coûts fixes sans Claude Max (R07 §11.17), seuil avec gestionnaire.** Contre C1 (Max imputé) et C5 (seuil à un client sans gestionnaire).
18. **Clips de sermon du mardi au samedi, jamais le dimanche.** R05 §8.10 et R10 §8.16 divergent ; la planche arrivant le lundi midi, le premier clip part le mardi, le format long le jeudi.
19. **Budget de 10 à 12 notifications par client et par mois (C2)**, pour la note de qualité du numéro (R22 §10.10) et la patience du client.
20. **Quatre services Railway plus un agent en phase 2, un monorepo (C5)** ; le tick cron est indispensable (R07 §11.6), l'agent n'a pas de raison d'exister avant la phase 2.

---
## 1. Thèse en une page

### La phrase de positionnement

« Votre gestionnaire regarde ce qui se passe chez vous et autour de vous, vous propose la semaine en images, attend votre oui sur WhatsApp, produit et publie de vraies vidéos en français, et vous montre chaque mois ce que cela a rapporté. »

L'IA est l'atelier, pas l'enseigne : 30 % des agences voient leur valeur perçue baisser quand le client croit que « l'IA réduit les coûts » et près d'un tiers des consommateurs se méfient des publicités IA (R08 §3.1 et §10.1). Au 2 octobre 2026, cette phrase n'a pas de concurrent : la colonne « veille » et la colonne « vidéo réelle » ne sont jamais vertes sur la même ligne du marché (R01 §6). Hootsuite (99, 199, 399 $ par siège et par mois, R26 §2.5) a le signal sans vidéo ; Predis (55 $) la vidéo de gabarit sans signal ni validation ; Planable la validation sans production ; n8n la production sans porte humaine ; Sermon Shots (53 à 97 $, R05 §2.2) le découpage en anglais sans animation ni publication. Aucun ne parle français d'Abidjan ni ne relie un Reel à une vente (R01 §1).

### Les cinq choix qui rendent la machine supérieure au marché

1. **La doctrine de José comme contrat exécutable.** Deux plateformes, piliers 60/25/15, frameworks PAS, AIDA, BAB, FAB, 3 à 5 hashtags (plafond dur Instagram de 5, R26 §2.6), mesure en trois couches : tout est vérifié. La machine refuse une semaine à plus de 15 % de promotion ou à moins de 60 % de valeur (R06 §16.15) et un contenu sans fait vérifiable ; un juge à sept critères (R11 §8.2, seuil 15/21) bloque avant chaque planche. Une doctrine vérifiée ne se copie pas en changeant un prompt (R01 §8.8).
2. **La planche hebdomadaire validée en un tap sur WhatsApp, unité de travail et de facturation, et une machine qui ne laisse jamais une semaine vide.** Image composite 1080 × 1350, six à dix maquettes à moins d'un cent (R03 §12.5), modèle utilitaire à 0,004 $ en Côte d'Ivoire et 0,0034 $ au Canada (R22 §0), trois boutons, Flow natif, vocaux transcrits. Aucun outil n'a cet objet (R08 §10.2). La validation avant génération divise par cinq à dix le coût de ce qui n'est pas validé (R04 §8.3). Quand le client se tait, la réserve de six contenus qu'il a déjà validés tient les créneaux : la continuité est un invariant (C1).
3. **Deux produits verticaux que personne ne vend en français : « Chaire » et « Dépôt ».** Chaire transforme le sermon du dimanche en 20 contenus (5 clips, un format long de 2 à 3 minutes, 10 citations, dévotionnel, chapitrage, guide de groupe) pour moins de 2,50 $ de coût marchand (R05 §4), sans génération IA donc sans étiquette, contre 5 à 8 $ par sermon chez Pulpit AI et 53 à 97 $ par mois chez Sermonshots, en anglais (R05 §1). Dépôt transforme deux photos déposées sur WhatsApp en une séquence de lancement en cinq temps, INCI vérifié, packshot réel, Reels plafonnés (R09 §3.8, R21 §9.5).
4. **Quatre indicateurs « à la page », un chronomètre, et la couche affaires en haut du rapport.** Délai tendance vers publication calculé depuis `signal.detected_at`, nouveautés exploitées sous 14 jours, taux de vidéos, sermons réemployés sous 7 jours (R11 §12, R24 §5) : les réponses chiffrées aux reproches des clients perdus. Au-dessus, dès le premier mois, les commandes, inscriptions, dons et devis attribués par lien en bio maison, QR, coupons, `ctwa_clid` et Conversions API (R24 §2) : « reliez la performance au revenu » est la question client numéro un (55 % des 494 agences, R08 §3.1).
5. **Acheter la plomberie, construire la différence, ne jamais dépendre d'un agent vivant.** API unifiée dès le mois 1 pendant que les revues officielles courent (R02 §12.1), transcription, génération et détourage à l'acte ; tout le développement sur la veille locale, la planche, le juge, Chaire, Dépôt, la mesure. Toute attente est un état en Postgres (R07 §11.7) ; chaque appel externe est précédé d'un identifiant écrit en base ; un redéploiement ne perd rien, leçon de l'incident du campus du 29 septembre 2026.

### Prix de vente visé et coût par client

| Palier | Abidjan (FCFA) | Canada (CAD) | France (EUR) | Contenu mensuel |
|---|---|---|---|---|
| Chaire (église, un sermon par semaine) | 175 000 | 450 | 350 | 4 sermons, 20 clips, format long, 40 citations, dévotionnels, chapitrage, 2 comptes, publication, rapport |
| Présence | 300 000 | 900 | 700 | 12 visuels, 4 vidéos programmées, 2 plateformes, planche hebdomadaire, rapport |
| Vidéo+ | 550 000 | 1 800 | 1 400 | 12 Reels dont 6 génératifs, 8 carrousels, 4 UGC montés, boîte de réception, boost supervisé |
| Logiciel seul | 60 000 | 150 | 110 | veille, planche, production, publication ; community manager chez le client |
| Option boîte de réception (hors Vidéo+) | 40 000 | 120 | 90 | tri Haiku, brouillons dans la voix du client, validation humaine |
| Option boost supervisé | budget du client + 15 % | idem | idem | jamais automatique (R23 §8.10) |

Coût direct mensuel, humain compris (section 12) : église en Chaire 85 à 135 $ à Abidjan ; beauté en Vidéo+ 190 à 320 $ à Abidjan et 330 à 455 $ au Canada ; école en Présence 120 à 166 $. Marge brute : 53 à 70 % sur Chaire à Abidjan, 64 à 79 % sur Vidéo+ à Abidjan, 64 à 74 % sur Vidéo+ au Canada. Seuil : trois clients payants couvrent les coûts fixes, gestionnaire d'Abidjan compris ; six clients dégagent en plus 1 500 $ par mois pour José. Pilotes à 50 % pendant 90 jours contre données et témoignage.

---
## 2. Les personnes

### José, propriétaire et architecte

Il voit un seul écran « santé de l'agence » (clients, planches en attente par porte, risques de départ, coût de génération contre plafond, connexions, indicateurs « à la page » agrégés) et reçoit le lundi matin un message WhatsApp du numéro machine avec trois boutons : « Voir », « Approuver tout ce qui est prêt », « Reporter » (C2). Il arbitre les escalades (trois refus du juge, client silencieux à J+5, plafond atteint), relit les posts LinkedIn de Markel-Tech (la voix du fondateur reste humaine et l'automatisation du profil est interdite, R08 §7.8), lance les revues à 90 jours et pilote Claude Code sur le dépôt. Temps cible d'exploitation : moins de deux heures par semaine (C4). Pendant les 90 jours de construction il est aussi le constructeur, et pendant le premier pilote il tient les portes 1 et 3 jusqu'au recrutement du gestionnaire (question 3). CallMeBot, non officiel, reste réservé à ses alertes personnelles puis disparaît (R08 §7.9). Ce qu'il fait sur son poste avec Claude in Chrome, Suno ou Higgsfield Unlimited n'entre pas dans la plateforme (arbitrage 3).

### Le gestionnaire humain

Un gestionnaire pour huit à douze clients, à Abidjan (250 000 à 350 000 FCFA par mois) ou au Canada (40 à 50 CAD de l'heure), 4 à 6 heures par client et par mois (R08 §6.3). Il voit la PWA du poste de pilotage avec neuf files (section 6), les alertes WhatsApp du numéro machine, le récapitulatif quotidien par courriel. Chaque semaine : le vendredi matin, cinq minutes par planche à la porte 1 ; le lundi, lecture des validations, lancement des productions, appels aux silencieux ; chaque jour, la file « à contrôler » (porte 3), les commentaires sensibles, la file « publier à la main » (Channels, Status, TikTok avant audit, R02 §12.15), la tâche « commentaires TikTok dans l'application » (R23 §8.9) ; le premier lundi après le 3, la revue lue avec le client. Chaque correction devient une paire (brouillon, correction, motif) réinjectée dans la mémoire du client (R11 §15.10). Il ne cherche jamais un fichier : chaque ligne d'une file porte le média, le texte et le bouton.

### Le client, par verticale

| Verticale | Qui valide | Ce qu'il voit | Ce qu'il fait | Ce qu'il fournit lui-même |
|---|---|---|---|---|
| Beauté (fondatrice) | la fondatrice | planche le vendredi ; « Reçu : Sérum Éclat, 30 ml, gamme Visage. On prépare le lancement ? » dans la minute après chaque dépôt (R21 §9.10) ; « publié cette semaine » le dimanche soir ; rapport mensuel | un tap, parfois un vocal ; dépose deux photos « document » (face et INCI, R21 §9.4) | tutoriels face caméra, application sur la main, coulisses (R09 §3.4) |
| Association culturelle | président ou chargé de communication | planche de séquence par événement (teaser J-21, genèse J-14, programme J-7, rappel J-1, récap J+2, R09 §4.8) ; accusé de réception du flyer | valide la séquence entière, dépose le flyer, envoie les plans tournés | portraits, directs |
| Église (pasteur ou délégué) | le pasteur | le lundi midi, 8 vignettes de clips avec verset, durée, plateforme (R05 §8.9) | valide chaque extrait (validation doctrinale, R09 §5.7) ; répond lui-même aux demandes de prière (R23 §8.5) | message face caméra, témoignages consentis |
| SEVARTA (José et l'auteur) | José, l'auteur pour ses extraits | séquence de sortie en six semaines, citations animées | valide ; l'auteur lit ses extraits | lecture, interview |
| 2IAE (direction) | la direction | compte à rebours admissions, carrousels métiers, récaps sous 48 h | valide ; fournit le registre des autorisations d'image | étudiants ambassadeurs, enseignants ; données publiques du campus seulement |
| Markel-Tech (José) | José | trois angles de posts fondateur, un document natif, un sondage | écrit ou valide ; accord des clients cités | posts et vidéos du fondateur |

Le client n'a pas de compte : WhatsApp d'abord, courriel en double au Canada (WhatsApp n'y touche qu'un tiers des internautes, R10 §2.2), lien magique pour le détail. Il reçoit 10 à 12 messages par mois (C2) : 4 planches, 2 rappels au plus, 1 « publié » hebdomadaire regroupé, 1 rapport, plus les accusés de réception de ses propres dépôts.

---
## 3. La routine : le cycle complet par client comme machine à états

### 3.1 Principe

Toute attente humaine est un état en base, jamais un agent qui attend : zéro jeton pendant l'attente, reprise garantie après redéploiement (R07 §5 et §11.7). Chaque transition est un job pg-boss idempotent (clé `tenant:type:date:hash`) qui lit l'état, agit, écrit l'état suivant et enfile le suivant (C1, C5). Cinq objets portent les états : signal, planche (`board`), contenu (`content_item`), job de génération, publication. Les heures sont celles de `tenant.timezone`.

### 3.2 Les horloges

| Horloge | Cadence | Travail |
|---|---|---|
| H0 tick | 5 minutes, Railway cron, sort en moins d'une minute (R07 §11.6) | échéances, rappels, escalades, quotas, jobs orphelins, tirs de Routines une fois par clé `client:semaine` |
| H1 tendances | 2 heures ; durée de vie 48 heures (R06 §13.5) | Trending Now RSS (CI, CA, FR), Google News RSS, GDELT |
| H2 flux client | horaire et webhooks | Atom YouTube, PubSubHubbub, dépôts WhatsApp, crawl quotidien du site (R06 §16.7 et §16.10) |
| H3 sons et formats | hebdomadaire, lundi 06:00 ; durée de vie 3 semaines | run Apify Creative Center partagé (R06 §16.4), 10 sons Reels saisis |
| H4 calendrier | hebdomadaire, horizon 8 semaines | fêtes fixes, lunaires (fenêtre de plus ou moins deux jours, confirmation la veille), événements vivants, revérification 48 h avant (R10 §8.9, R06 §13.4) |
| H5 cycle éditorial | jeudi 06:00 génération, vendredi 10:00 envoi | idéation, brouillons, juge, porte 1, envoi, rappels, réserve, production, porte 3, programmation |
| H6 mesure | 05:00 GMT, plus relevés par média | comptes la veille ; médias J+1, J+3, J+7, J+30, J+90 ; Stories H+6, H+12, H+23 (R24 §10.8) |
| H7 rapport | premier lundi après le 3, avant 9 h heure client (R24 §10.8) | PDF d'une page, résumé WhatsApp de cinq lignes |
| H8 itération | 90 jours | avant et après, médianes locales, réinjection des corrections, sources coupées ou renforcées (R06 §16.19) |
| H9 santé (C1) | quotidienne, hebdomadaire, trimestrielle | jetons Meta et LinkedIn rafraîchis à J-5, alerte J-10, TikTok avant chaque publication (R02 §12.9) ; réabonnement PubSubHubbub tous les 3 jours (R21 §9.13) ; test hebdomadaire par fournisseur et par plateforme (R04 §8.2, R24 §10.20) ; diff trimestriel des pages primaires avec alerte WhatsApp (R26 §5.19) |

### 3.3 Les états d'un contenu

`idee` → `brouillon` → `juge` (deux retours au plus, puis `revue_humaine`, R07 §11.13) → `en_planche` → `propose` → `valide` | `a_revoir` (motif, version n+1) | `refuse` | `reserve` → `en_production` (jobs chaînés) → `controle` (QC déterministe, vision, puis porte 3 humaine si promotion, verticale réglementée, personne réelle, TikTok ou YouTube) → `programme` → `publie` | `publie_manuel` | `en_attente_reconnexion` | `echec` → `mesure` → `archive`. Trigger sur `ref.content_transition` (C5) : aucun passage à `programme` sans `judge_score` d'au moins 15, sans `asset_rights` valides pour chaque personne identifiable, sans `ai_label` calculé, et sans décision client `valide` ou provenance `reserve`.

### 3.4 Le cycle hebdomadaire (client à Abidjan, GMT)

| Moment | Événement | Acteur | Délai par défaut |
|---|---|---|---|
| Jeudi 02:00 | clôture de la veille, scoring en Batch, calendrier à 8 semaines | machine | nuit |
| Jeudi 06:00 à 09:00 | idéation sur Opus 5.5 avec cerveau en cache (calendrier complet environ 0,45 $ par mois, R07 §1), 6 à 10 propositions en séquences (R09 §11.15), vérification 60/25/15, maquettes low, « frame 0 » Remotion, prises uniques LTX-2.3 à 0,06 $ par seconde pour les brouillons vidéo (R04 §8.3), juge, vision, deux propositions de réserve en pied | machine | avant 09:00 |
| Jeudi 09:00 | porte 1 : file « à relire » | gestionnaire | 24 heures ; vendredi 09:00 alerte à José ; jamais d'envoi sans relecture |
| Vendredi 10:00 | modèle `planche_prete` (image composite, trois boutons) et courriel Resend avec le même lien | machine | chaque tap déclenche la production de la proposition concernée |
| Lundi 09:00 | rappel 1 (`rappel_planche`) ; J+2 tomberait un dimanche | machine | J+3 |
| Mercredi 09:00 | rappel 2, dernier (R22 §10.10), tâche « appeler la cliente » | machine, gestionnaire | J+5 |
| Mardi à samedi | production dès validation (3 prises, 1080p), QC, porte 3, publication aux créneaux du fuseau (Facebook 7 h à 9 h et 13 h à 15 h, TikTok 18 h à 20 h à Abidjan ; mardi à jeudi 11 h à 17 h heure de l'Est ; jamais le dimanche sauf directs d'église, R10 §8.7, R09 §11.5) | machine, gestionnaire | 24 à 48 heures après validation |
| Dès mardi | règle « jamais sans contenu » : créneau non validé tenu par la réserve si la case est cochée ; créneaux « promotion » laissés vides | machine | automatique |
| Vendredi suivant | planche expirée, propositions non validées archivées « silence », nouvelle planche | machine | J+7 |
| Deux planches en silence | « risque de départ », alerte à José, revue de 20 minutes proposée (R08 §10.18, C2) | gestionnaire | |

La planche hebdomadaire est le fond de semaine (valeur, relation) ; elle a trois à dix jours d'âge à la publication, ce qui est acceptable parce que tout ce qui est « à la page » passe par quatre déclencheurs qui ne l'attendent pas : la tendance (voie rapide), le dépôt de produit (mini-planche sous 24 heures, R21 §9.18), l'événement (séquence à J-21), le sermon (planche du lundi midi).

### 3.5 Ce qui se passe quand le client ne répond pas

Deux rappels, jamais plus (note de qualité, politique « fréquence » du 23 septembre 2026, R22 §10.10), puis l'humain appelle, puis la réserve : six contenus intemporels par client (citations de sermons passés, conseils d'usage, rappels de métiers), validés le mois précédent dans le même geste que la planche, renouvelés chaque mois, du pilier valeur ou relation, sans prix, sans allégation, sans visage non consenti. Un client silencieux ne coûte rien en génération au-delà de la réserve. L'option « tout retenir » est un drapeau `tenant.regle_sans_reponse` coché à l'onboarding (R08 §8.1.2).

### 3.6 La voie rapide : newsjacking (C1)

| Étape | Délai cible | Repli |
|---|---|---|
| Détection, dédoublonnage, scoring Haiku | moins de 15 minutes | aucun |
| Genèse et vérification à deux sources dont une primaire (R06 §13.4) | moins de 45 minutes | une seule source : `a_verifier_humain` |
| Alerte au gestionnaire avec angle, source et visuel brouillon statique | moins d'une heure | aucune vidéo en voie rapide |
| Validation client express (modèle `tendance_express`, deux boutons) | 4 heures, puis expiration | aucune publication sans oui |
| Publication | moins de 4 heures après validation | paquet manuel |

Sujets politiques et religieux controversés exclus pour les églises, SEVARTA et 2IAE (R06 §16.16). Le chronomètre « tendance vers publication » part de `signal.detected_at` et s'arrête à `published_at` ; sa médiane est montrée au gestionnaire chaque semaine et au client chaque mois, avec des cibles par nature de signal : tendance 24 heures, nouveauté produit 72 heures, événement 48 heures, sermon 24 heures (R09 §11.16).

### 3.7 Les trois portes humaines

Porte 1 (planche avant envoi), porte 2 (client), porte 3 (rendu final) (R01 §8.9). Publication sans porte 3 seulement pour un contenu validé sur planche, sans drapeau « personne réelle », « promotion » ni « verticale réglementée », et jamais sur TikTok ni YouTube, qui exigent un consentement exprès par publication (R02 §12.3). Pour les églises, chaque extrait passe par le pasteur (R09 §5.7). Un rendu non relu à l'échéance est reporté d'un jour avec alerte, jamais publié.

### 3.8 Reprise après panne (C1 §3.5)

Identifiant externe écrit avant chaque appel (conteneur Meta, `publish_id` TikTok, requête Higgsfield ou fal, `batch_id` et `custom_id` Anthropic, résultats conservés 29 jours, R07 §11.4) ; au redémarrage, relecture de l'état chez le fournisseur, jamais de resoumission ni de republication d'un conteneur `FINISHED`. Aucun job de plus de 30 minutes sans point de reprise (R07 §8.3) : un sermon est une chaîne de jobs (transcription, analyse, découpe, sous-titres, habillage, planche). Services `worker` et `rendu` séparés, arrêt gracieux `SIGTERM` sous 30 secondes, aucun volume sur un service applicatif : un redéploiement ne coupe rien, à l'inverse du campus le 29 septembre 2026 (R25 §2.2). Médias WhatsApp téléchargés dans la minute (URL valable 5 minutes, R21 §9.9) ; sorties de génération copiées avant expiration (7 jours Higgsfield, 2 jours Veo, R04 §8.15). Les deux pannes silencieuses (jeton Instagram expiré, PubSubHubbub tombé, R21 §9.13) sont surveillées par H9 et visibles par l'état `a_reconnecter`.

---
## 4. Les routines par verticale

Les séquences par déclencheur vivent dans `ref.sequence_template` (lancement produit 5 étapes, sortie de livre 8, événement 5, admission 4, R09 §11.15) : le client valide une séquence entière. Benchmarks encodés par verticale (0,12 % sur Instagram est bon en beauté, 0,73 % moyen pour une école, 5,20 % la moyenne LinkedIn, R09 §11.1), remplacés par la médiane locale après trois mois (R24 §10.13).

### 4.1 Beauté : le dépôt de produits (pipeline « Dépôt »)

Sources : fiches produit du site (crawl, flux Shopify ou WordPress, R06 §16.10), dépôt WhatsApp (deux photos « en document », refus poli sous 1 000 px, R21 §9.4), commentaires (trois questions identiques déclenchent un script de réponse), Creative Center TikTok du pays, calendrier commercial, saison. Déclencheur : produit déposé → accusé de réception sous une minute avec boutons → extraction Sonnet 5.5 en JSON Schema (0,015 $, R21 §9.1), INCI vérifié contre une base de noms (R21 §9.5), fiche incomplète vers la file « dépôts incomplets » → mini-planche sous 24 heures : teaser J-3, unboxing J0, tutoriel J+3, carrousel teintes J+7, rappel WhatsApp J+10 (R09 §3.8). Indicateurs d'entrée : délai dépôt vers planche (24 h), dépôts incomplets (sous 20 %), corrections sur fiches (sous 10 %) (R21 §9.18). Formats automatiques : packshot détouré (Photoroom 0,02 $, R03 §12.6) remis en scène, jamais synthétisé, carrousels, visuels avec texte HTML, Reels produit de 15 à 20 secondes (Kling 3.0 via l'API Higgsfield ou Veo 3.1 Fast, 5 à 6,50 $, R04 §6), scripts de tutoriel, légendes PAS, BAB, FAB, messages de réassort pour le Channel, profil « Afrique mobile » (R10 §8.6). Deux plateformes par pays : Facebook et TikTok à Abidjan (Instagram y est marginal, 895 000 personnes en recul, R10 §2.1), Instagram et TikTok à Toronto, WhatsApp pour la relation. Humain : tout visage (la fondatrice filme ses 20 secondes, 20 % du mix 100 % humain, R11 §15.16), toute allégation (Santé Canada, règlement 655/2013, Meta du 23 juillet 2026 : avant/après autorisé, 18 ans et plus, aucune promesse chiffrée dans un délai, R26 §2.8), tout comparatif, exclusion de l'éclaircissement de la peau (R09 §11.10), plaintes.

### 4.2 Association culturelle : événements régionaux et genèse

Sources : agenda du site, flyers déposés (OCR Haiku 4.5 à 0,005 $ : titre, dates, lieu par commune et repère, prix en FCFA, R21 §2.1), agendas de ville (Toronto Open Data, BlogTO, Ottawa Festivals, Abidjan.net), pages Facebook des festivals par Graph API (R10 §8.10), journées internationales, Google Events via SerpApi (R06 §16.2). Déclencheurs : événement → teaser J-21, genèse J-14, programme J-7, rappel J-1, récap J+2 (R09 §4.8) ; événement tiers → carrousel « à voir cette semaine » ; journée internationale → citation animée. Formats : teaser Remotion 10 à 20 secondes (0,05 à 0,30 $), carrousels programme, genèse à deux sources dont une primaire (R06 §13.4), affiche (scène générée, texte HTML), QR dynamique sur chaque support (R24 §10.4). Public double au Canada : membres (WhatsApp, Facebook) et ville (Instagram, agendas, bilingue), calendrier février, juin, août, septembre (R10 §8.17). Humain : portraits, directs, faits de genèse, crédits, autorisations (foule en plan large tolérée, personne individualisée interdite sans accord, R08 §7.4).

### 4.3 Église : le sermon YouTube (pipeline « Chaire »)

Sources : PubSubHubbub de la chaîne (gratuit, hors quota, R21 §9.6), fichier déposé par la régie (Drive `changes.watch`, ou salle Daily à 1,21 $ par sermon de 90 minutes, R21 §9.7), ou audio seul par WhatsApp (43 Mo pour 90 minutes, R21 §9.8). Jamais de téléchargement depuis YouTube (R08 §10.11). Déclencheur : sermon reçu → chaîne en moins de 24 heures : AssemblyAI Universal-3.5 Pro à 0,21 $ par heure avec `language=fr` forcé (R05 §8.3), segmentation Haiku 4.5, choix, titres, hooks et dérivés par Opus 5.5 avec transcription en cache (0,14 $, 0,07 $ en Batch, R07 §7), cinq types de moments, exclusion des annonces et de la quête, aucune coupe dans un verset, versets résolus contre une Segond 1910 locale (R05 §8.7), découpe ffmpeg, recadrage centré puis MediaPipe en phase 2, sous-titres karaoké libass, habillage Remotion avec introduction originale de 2 secondes contre le critère « gabarit » de YouTube du 16 juillet 2026 (R11 §15.8), floutage du public, aucun enfant. Formats : 5 clips (TikTok 15 à 30 s, Reels 30 à 45 s, Shorts 45 à 58 s, Facebook 45 à 75 s) plus un format long de 2 à 3 minutes (Instagram accepte 15 minutes et 300 Mo ; 90 secondes ne vaut que pour Facebook Reels ; Shorts jusqu'à 3 minutes, R26 §2.1 et §5.1), 10 citations, dévotionnel de cinq jours pour le Channel (paquet manuel, R10 §8.1), chapitrage poussé par `videos.update`, guide de groupe. Deux comptes, église et pasteur (4 à 10 fois l'audience, R09 §11.7). Cadence : planche le lundi midi, un clip par jour du mardi au samedi, format long le jeudi (arbitrage 18). Coût 0,80 à 2,50 $ par sermon (R05 §4), sans étiquette IA (R04 §8.5). Trial Reels pour montrer d'abord un clip aux non-abonnés (R26 §5.5). Humain : validation doctrinale de chaque extrait, message face caméra, témoignages consentis, prières (R23 §8.5).

### 4.4 Édition : SEVARTA, livres et auteurs

Sources : base des titres, chaîne YouTube des auteurs (pipeline Chaire, R09 §11.6), avis, page Amazon par Firecrawl, calendrier liturgique, salons. Déclencheur : nouveau titre → séquence de six semaines (couverture J-42, extrait J-28, précommande J-21, extrait J-14, interview J-7, sortie J0, avis J+14, bilan J+30, R09 §6.3) ; sermon de l'auteur → extrait relié au chapitre. Formats : citations animées, carrousels « 5 idées du chapitre », révélation de couverture, audiogrammes, newsletter (R09 §11.8), bande-annonce de 15 à 30 secondes en Seedance 2.5 via l'API Higgsfield (0,2057 $ par seconde, R26 §2.4). Humain : lecture par l'auteur (voix réelle, ou clonée consentie et étiquetée), interview, validation doctrinale. Les clips musicaux SEVARTA ne sont pas un produit de la plateforme.

### 4.5 École : 2IAE, admissions et campus

Sources : calendrier académique (rentrée le 14 septembre 2026, inscriptions du 25 août au 30 septembre, réorientations en janvier et février, R10 §5.1), site public, résultats, registre des autorisations d'image, données publiques du campus seulement. Déclencheurs : admission J-30 → compte à rebours ; rentrée J-14 → série « bienvenue » ; résultat → visuel ; événement → récap sous 48 heures ; nouvelle formation → carrousel métiers (R09 §7.8). Formats : comptes à rebours Remotion, carrousels métiers (coût quasi nul, R03 §12.9), récaps montés, « 60 secondes pour comprendre » depuis les replays publics consentis, miniatures, documents LinkedIn (1,8 million d'utilisateurs en Côte d'Ivoire, R10 §2.1), message WhatsApp hebdomadaire. Événements GA4 à demander à la session du site (R24 §10.17). Humain : ambassadeurs, enseignants, autorisation parentale pour tout mineur avec blocage automatique (R09 §11.9), réponses aux candidats.

### 4.6 B2B : Markel-Tech sur LinkedIn

Sources : registre des projets livrés, questions clients, veille sectorielle, pages des clients finaux. Déclencheurs : projet en ligne → avant-après J+3, étude de cas J+14 après accord écrit, témoignage J+30 ; trois questions identiques → check-list ; actualité majeure → post d'analyse proposé ; fin de mois → sondage (R09 §8.8). Formats : documents natifs (7,00 %, meilleur format LinkedIn), carrousels (6,45 %), sondages, motion design, newsletter, vidéo de 90 secondes Remotion avec voix clonée de José (0,20 à 0,50 $, R04 §6) ; jamais de lien externe en premier (3,25 %) (R09 §2.1). Page entreprise par la Community Management API ; posts du fondateur publiés par José ; Thought Leader Ads avec accord conservé (R23 §8.16) ; X en option plafonnée (0,015 $ par post, R02 §1). Humain : posts et vidéos du fondateur, accords, chiffres.

---
## 5. La planche de propositions et la validation client

### 5.1 Contenu exact d'une planche

Objet versionné (`board`, `board_version`, `board_item`) rendu en image composite 1080 × 1350 sous 5 Mo pour l'en-tête WhatsApp et en page PWA à 390 px, une carte par proposition, vignettes sous 300 Ko (R22 §10.8 et §10.14). En-tête : logo, « Planche n° 12, semaine du 12 au 18 octobre », date limite, mix en trois pastilles (planche refusée hors 60/25/15, R06 §16.15). Six à dix cartes : maquette basse définition (gpt-image-2.5-flare en low, « frame 0 » Remotion, ou vignette de clip à l'image du hook) frappée d'un bandeau « MAQUETTE » (C2) ; plateforme, format et créneau ; hook en moins de 8 mots, en français parlé si la fiche de voix l'autorise (R10 §8.8) ; texte replié avec 3 à 5 hashtags ; pilier et framework ; « ce que nous attendons de vous » (« filmez 20 secondes d'application sur votre main avant mercredi », R09 §11.11) ; « Source : URL » sous chaque fait (R06 §16.13) ; pour une vidéo générative, « brouillon, 1 prise » (R04 §8.3). Ligne « faits à confirmer » posée comme une question (R11 §15.15). Pied : deux propositions de réserve « valeur » validées dans le même geste (C1, C2), coût de génération prévu contre plafond, boutons « Je valide tout », « À revoir », « Voir la planche » à 44 px, champ « une remarque pour toute la semaine » (texte ou vocal). Coût : 0,03 à 0,20 $ en images (R03 §9) plus environ 0,10 $ de jetons ; React rendu par Playwright sur le service `rendu`.

### 5.2 Canaux

**WhatsApp Business Platform en accès direct Cloud API** sous le portefeuille Markel-Tech, sans BSP (R22 §10.1), deux numéros dans le même compte (SIM +225, numéro +1), entreprise vérifiée (20 numéros, 1 000 conversations par jour, R22 §10.3). Sept modèles utilitaires soumis en une fois : `planche_prete`, `rappel_planche`, `tendance_express`, `production_terminee`, `publication_faite`, `rapport_mensuel`, `alerte_gestionnaire`, plus `confirmation_optin` (R22 §10.4 et §10.12). Texte du modèle principal : « Bonjour {{1}}, votre planche n° {{2}} ({{3}} propositions) est prête pour validation. Merci de répondre avant le {{4}}. » (C2). Le tap ouvre la fenêtre de 24 heures ; la plateforme envoie un Flow générique à deux écrans (validées ; à revoir avec motifs), alimenté par `flow_token`, en mode `navigate` sans endpoint (R22 §10.6 et §10.7). Carrousels marketing (0,0225 $) en option seulement (R22 §1.3). Le webhook `message_template_category_update` bloque tout modèle reclassé (sinon 0,004 passe à 0,0225 $, R22 §10.5). **Vocaux** : téléchargés sous 5 minutes, archivés, transcrits par `gpt-4o-mini-transcribe` à 0,003 $ la minute ou Deepgram Nova-3, renvoyés en citation avec « C'est bien ça ? », puis transformés en instruction de retouche (R22 §10.9). **Dépôts** : accusé de réception structuré sous une minute avec boutons (R21 §9.10), refus poli sous 1 000 px avec la consigne « envoyez en document » (R21 §9.4), dépôts incomplets vers le gestionnaire avec message préparé (C2). **Courriel (Resend)** : même lien signé, composite en pièce jointe, désinscription (CASL), en double au Canada et en France (R22 §6.2). **Lien magique** : jeton de 256 bits haché en base (`magic_link.token_hash`), une planche, expiration 14 jours, révocation à la clôture (C5) ; même table `validation` que WhatsApp, le client commence sur l'un et finit sur l'autre (R22 §10.14). Toute validation vaut accord écrit (R08 §8.1.2).

### 5.3 États, relances, versions

États : `brouillon`, `relue`, `envoyee`, `vue` (webhook `read`), `partiellement_validee`, `validee`, `a_revoir`, `expiree`, `remplacee`. Relances J+3 et J+5, puis humain, jamais de troisième (R22 §10.10). Un « À revoir » génère la version n+1 depuis le motif coché ou le vocal transcrit (Opus 5.5, cerveau en cache), relue par le gestionnaire seulement si le motif est « autre » ou si le juge note sous 15, renvoyée dans la fenêtre de 24 heures en message interactif sans modèle payant (C2) ; seules les propositions révisées repartent. Historique conservé la durée du contrat plus 12 mois (R08 §4.3). Indicateurs : acceptation sans modification majeure (70 %, R11 §12), délai dépôt vers planche (24 heures, R21 §9.18).

### 5.4 Opt-in et conformité

Opt-in nominatif en deux cases au contrat, journal de preuve (horodatage, source, texte, numéro haché), STOP automatique, `confirmation_optin` à la signature (R22 §10.12). Aucune prospection sortante. Budget WhatsApp 1 $ par client et par mois, grille Meta datée dans `ref.tarif_whatsapp` (R22 §10.16) ; la franchise de 1 000 messages de service est une hypothèse à confirmer (R10 §9.3).

---
## 6. Le poste de pilotage du gestionnaire

Une PWA React (manifest `standalone`, service worker, Web Push VAPID, tutoriel iPhone, R22 §10.13), mêmes composants shadcn que le reste, pensée pour un téléphone. WhatsApp pour l'alerte, la PWA pour l'écran, le courriel pour le récapitulatif (R22 §7.1).

### 6.1 Écran « Aujourd'hui » : neuf files, une action par ligne (C2)

| File | Contenu | Action en un clic |
|---|---|---|
| À relire (porte 1) | planches en brouillon, délai restant sur 24 heures | « Approuver et envoyer », « Modifier », « Retirer une proposition », « Corriger dans Canva » (Brand Kit par client, R03 §12.8) |
| En attente client | planches envoyées, J+n, rappels, voie rapide (chronomètre sur 4 heures) | « Relancer maintenant », « Appeler », « Appliquer la réserve » |
| Retours à traiter | « à revoir » avec motif, vocal transcrit, version n+1 prête | « Envoyer la v2 », « Reprendre à la main » |
| À contrôler (porte 3) | rendus terminés, checklist (orthographe, droits, étiquette IA, musique), résultat des trois couches de QC | « Approuver et programmer », « Retouche », « Remplacer par une réserve » |
| À publier à la main | paquets : Channels et Status WhatsApp, TikTok avant audit, profil LinkedIn de José, carrousels de 11 à 20 (R02 §10.5) | « Copier le texte », « Télécharger le média », « Ouvrir dans l'app », « J'ai publié : coller l'URL » |
| Commentaires et messages sensibles | critiques, prière, santé, argent, doctrine, hors fenêtre de 24 heures (R23 §8.5) | « Envoyer le brouillon » (HUMAN_AGENT journalisé), « Modifier », « Transmettre au client » |
| Dépôts incomplets | photo sous 1 000 px, INCI manquante, flyer sans date | « Demander la pièce manquante » |
| Jetons et connexions | jeton à J-10, PubSubHubbub, modèle reclassé, test hebdomadaire rouge | « Envoyer le lien de reconnexion », « Relancer le test » |
| Coûts | clients à 80 % du plafond, dead letter pg-boss (R25 §11.12) | « Relever le plafond pour la journée », « Basculer en brouillon », « Relancer le job » |

### 6.2 Autres écrans

**Client** en trois onglets (C2) : Relation (feu, dernière validation, délai médian de réponse du client, canal préféré, règles par défaut, consentements), Marque (cerveau versionné, kit de référence), Affaires (coupons, liens, conversions). **Planche** : la vue client plus les colonnes cachées (score du juge par critère, faits et sources, moteur des maquettes, coût si tout est validé, drapeaux). **Production** : rendus et provenance par média. **Boîte de réception** : commentaires et messages Meta classés en six classes par Haiku 4.5 (0,30 à 0,75 $ pour 1 000, R23 §8.4), brouillons dans la voix du client (1,20 $ pour 1 000), mots clés par verticale (PRIÈRE, LIVRE, ADMISSION, PRODUIT, BILLET, GUIDE, R23 §8.3), tâche quotidienne TikTok. **Calendrier** : lecture seule pour le client, trois états. **Conformité** (C3) : consentements, `licence_registry` par média, étiquettes IA, versions bibliques, export PDF opposable. **Agence** : coûts par client et par fournisseur, facture Railway, dead letter, tests hebdomadaires, demandes d'accès, bancs d'essai.

### 6.3 Alertes

Niveau rouge, par WhatsApp (`alerte_gestionnaire`) et Web Push avec lien profond : planche non relue à 24 heures ; client sans réponse à J+5 ; voie rapide à 3 heures sans décision ; trois refus du juge (Routine « incident », R07 §11.12) ; plafond à 80 % puis 100 % ; conversation Click-to-WhatsApp sans réponse depuis 2 heures (R23 §8.17) ; jeton à reconnecter ; publication échouée trois fois ; modèle reclassé ; note de qualité du numéro en orange ; « invalid metric » (R24 §10.20) ; publication bloquée faute d'étiquette ou de consentement.

### 6.4 Indicateurs « à la page », en semaine et dans le rapport

| Indicateur | Cible |
|---|---|
| Délai médian tendance vers publication (depuis `signal.detected_at`) | tendance 24 h, nouveauté 72 h, événement 48 h, sermon 24 h |
| Nouveautés exploitées sous 14 jours | 100 % |
| Taux de vidéos | 40 à 60 % selon la verticale |
| Sermons réemployés (3 clips sous 7 jours) | 100 % |
| Ancrage réel (au moins un asset réel) | 80 % et plus |
| Acceptation des planches sans modification majeure | 70 % et plus |
| Écart au mix 60/25/15 | moins de 10 points |
| Étiquetage IA conforme | 100 % |
| Délai médian de première réponse aux commentaires et messages | moins d'une heure en heures ouvrées (R08 §10.7, R10 §7.2) |
| Envois et enregistrements par portée, rétention à 3 secondes | contre la médiane de la verticale puis la médiane locale (R11 §15.13, R24 §10.13) |

---
## 7. L'usine de production

### 7.1 Principes

Deux couches partout (R03 §12.1) : un moteur génératif pour les scènes et les éléments, une composition déterministe (React rendu par Playwright) pour tout texte éditorial, logo et aplat ; un titre, une date, un prix, un verset ne dépendent jamais d'un modèle de diffusion. Quatre familles abstraites (`ImageProvider`, `VideoProvider`, `TranscribeProvider`, `TtsProvider`) avec défaut, repli et registre `engine_registry` (famille, moteur, version, défaut, repli, `dernier_test_ok`, `cout_unitaire_mesure`) (C3), parce qu'un fournisseur change tous les trois mois (gpt-image-1 retiré le 23 octobre 2026, gpt-image-1.5 le 1er décembre, Sora 2 le 24 septembre, R26 §2.2, R04 §0). Mode brouillon pour la planche, production après validation (R04 §8.3). Kit de référence par client injecté automatiquement (`reference_kit` : packshots détourés sous 6 angles, logo, Brand Kit Canva, 3 références Veo, références Seedance sans visage de pasteur ni d'enfant à cause de la clause 4.4, voix clonée consentie, fiche de voix, profil de conformité, R26 §5.12, R04 §8.14). Profils d'export : « Afrique mobile » 720p vertical sous 10 Mo, premières 2 secondes sans logo (R10 §8.6) ; « Canada » 1080 × 1920 à 8 Mbps ; MP4 sans edit lists, moov en tête, H.264 GOP fermé 4:2:0, AAC 48 kHz, 300 Mo maximum (R26 §5.2). Étiquette IA calculée par variante (`ai_label` vrai si visage, voix, décor réaliste ou produit photoréaliste synthétique ; faux pour motion design, captures, vidéos réelles), posée à la publication, C2PA et SynthID conservés (R03 §12.13, R04 §8.7). Chaque actif stocke moteur, version, prompt, références, compte, plan, date et coût réel lu dans `usage` (R08 §10.8). La vidéo générative est le seul poste qui peut tripler la facture (1 à 4 $ par prise de 10 secondes) : 3 prises par plan, plafond mensuel dans `tenant_budget`, réservation dans `cost_ledger` avant chaque appel, alerte à 80 %, état `plafond_atteint` (R08 §10.5, R25 §11.12, C1).

### 7.2 Tableau récapitulatif par type de contenu (prix des 1er et 2 octobre 2026)

| Type | Chaîne exacte (moteurs, versions) | Prix unitaire | Contrôle qualité | Repli |
|---|---|---|---|---|
| Post texte, légende, hashtags | Opus 5.5 (4 $ et 20 $ par MTok, cache lu 0,20 $, R26 §2.3), cerveau en cache 1 h, sortie structurée, rejet au-delà de 5 hashtags (R26 §5.13) | 0,022 $ (0,011 $ en Batch, R07 §7) | juge sept critères sur Haiku 4.5 (0,0045 $), lexique d'allégations | Sonnet 5.5 (0,012 $) |
| Carrousel 3 à 10 pages (Instagram, LinkedIn PDF) | plan JSON Opus 5.5 (0,068 $), slides React par client, Playwright 1080 × 1350, couverture optionnelle gpt-image-2.5-flare medium | 0,07 à 0,10 $ | contraste WCAG, police d'au moins 40 px, couleurs par échantillonnage, 10 diapositives par API Instagram (R02 §12.6) | Canva Autofill (Pro et Teams depuis le 21 septembre 2026, R03 §1) ; 11 à 20 en paquet manuel |
| Visuel avec texte (affiche, annonce, citation) | scène gpt-image-2.5-flare via Responses API (prix officiel en jetons : 5 $ texte et 8 $ image en entrée, 30 $ image en sortie par million ; coût mesuré sur `usage`, R26 §2.2), FLUX.2 [pro] via fal (0,03 $) ou Nano Banana 2 (0,067 $) ; texte en HTML | 0,03 à 0,07 $ (R03 §9) | OCR par vision comparé caractère par caractère au JSON, zoom sur les zones de texte, pseudo-lettres, zones sûres | Seedream 5.0 Pro (0,0675 $), Recraft V4.1 (0,035 $) |
| Photo produit mise en scène | packshot réel détouré (Photoroom 0,02 $, Recraft 0,01 $) ; fond gpt-image-2.5-sunburst en édition masquée avec packshot en référence, ou FLUX.2 ; composition HTML | 0,05 à 0,10 $ | packaging comparé au packshot par vision, mains, conformité beauté | édition masquée 2 essais, FLUX.2, humain ; LoRA FLUX.2 (8 $) seulement pour un produit généré des centaines de fois (R03 §12.15) |
| Reel génératif produit ou teaser, 15 à 20 s | storyboard 2 à 3 images ; I2V Kling 3.0 via API Higgsfield (0,084 $ par seconde, 1,26 $ les 15 s, R26 §2.4), 3 prises ; montage Remotion ; voix ElevenLabs v3 (0,08 $ par 1 000 caractères) ; musique native ou ElevenLabs Music (0,15 $ par minute) | 5 à 6,50 $ (R04 §6) | vision sur 3 images clés, encodage, étiquette IA vraie ; filtres testés par verticale (R04 §8.16) | Veo 3.1 Fast via Gemini (0,10 $ par seconde, phase 3), Wan 3.0 Prime (0,068 $), LTX-2.3 (0,06 $) pour les brouillons |
| Scène signature (bande-annonce, teaser d'événement) | Seedance 2.5 via API Higgsfield (0,2057 $ par seconde, 4 à 30 s d'une génération, 50 références ; 3,09 $ les 15 s, 6,17 $ les 30 s, R26 §2.4) ; musique Lyria 3 Pro (0,08 $) | 6 à 14 $ (R04 §6) | idem | Kling 3.0 |
| Reel programmé Remotion (compte à rebours, chiffres, citation, tutoriel, packshot animé) | composition React par client, rendu CPU sur `rendu` (licence gratuite jusqu'à 3 personnes, sinon Automators 100 $ par mois, R04 §4) ; Lambda (0,02 $ la minute) seulement si le délai l'impose, sorties copiées dans le bucket Railway | 0,05 à 0,50 $ | texte exact par construction, durée, zones sûres, hash perceptuel des images clés | ffmpeg seul |
| Clip de sermon (5 durées) et format long 2 à 3 min | fichier de la régie ; AssemblyAI 0,21 $ par heure, `language=fr` ; Haiku 4.5 puis Opus 5.5 (0,14 $) ; ffmpeg, libass, MediaPipe (phase 2), Remotion avec introduction de 2 s ; floutage ; profils d'export | 0,80 à 2,50 $ par sermon pour 8 clips (R05 §4) | verset contre Segond 1910, aucune coupe dans un verset, sous-titres relus (noms ivoiriens, termes religieux), durée par plateforme (R26 §2.1 et §5.1), porte du pasteur | Scribe v2 (0,22 $ par heure) ; API Vizard (600 min pour 14,50 $, R05 §2.1) en filet |
| UGC monté (avis cliente, coulisses) | vidéo réelle de la fondatrice ou d'un client consentant ; Remotion, sous-titres ASS, musique | 0,10 à 0,30 $ | consentement enregistré, zones sûres | avatar neutre étiqueté sur demande écrite seulement (OmniHuman 1.5 ou HeyGen Avatar IV, 1,70 à 3,80 $ les 30 s, R04 §6) |
| Story | gpt-image-2.5-flare 1024 × 1536 medium ou dérivé d'un Reel ; texte hors zones d'interface (haut 250 px, bas 340 px) ; MP4 Remotion | 0,02 à 0,05 $ | zones sûres, 60 s, 100 Mo | paquet manuel pour le Status |
| Miniature YouTube | portrait réel détouré (0,02 $) + fond Nano Banana 2 (0,067 $) + titre 3 à 5 mots en HTML (skill youtube-thumbnail) | 0,07 à 0,10 $ | lisibilité à 168 × 94 px, visage non déformé | gpt-image-2.5, Gemini |
| Vidéo explicative de logiciel 60 à 90 s | enregistrement d'écran ou parcours Playwright scripté, zooms et curseur Remotion, voix clonée ou gpt-4o-mini-tts (0,015 $ la minute), sous-titres | 0,15 à 0,40 $ (R04 §6) | chaque étape retrouvée sur une image clé, lisibilité à 390 px | voix de catalogue |
| Planche de propositions | maquettes low (0,006 $ pièce, prix fal), « frame 0 », composite Playwright | 0,03 à 0,20 $ ; 0,50 à 2 $ avec brouillons vidéo (R04 §6) | mention « MAQUETTE » | aucun |
| Voix et musique | une voix clonée par client (ElevenLabs, consentement écrit, seul moyen d'un accent ouest-africain crédible, R04 §8.11) ; musique native pour l'organique, ElevenLabs Music ou Lyria 3 hors plateforme, Epidemic Sound (API sous licence) pour les églises ; Suno à la main, jamais en plan gratuit (R04 §8.12, R08 §10.9) | 0,07 $ par 60 s de voix ; 0 à 0,15 $ de musique | plan vérifié avant export, métadonnées conservées | gpt-4o-mini-tts, Chirp 3 HD |

Ordre de grandeur mensuel : moins de 10 $ de production pour une église ; 60 à 80 $ de génération plus 20 à 30 $ de planches et prises écartées pour une marque en Vidéo+ (R04 §6) ; 1,5 à 4 $ d'images plus 2 à 5 $ de rendus pour une école (R03 §12.18).

### 7.3 Contrôle qualité en trois couches, bloquant avant la planche et avant la publication (C3 §7.4)

**Couche 1, déterministe, 0 $** : dimensions, poids, encodage (ffprobe), logo par hash perceptuel, couleurs de marque par échantillonnage, zones sûres, contraste WCAG, durée par plateforme, 3 à 5 hashtags, C2PA présent. **Couche 2, vision Haiku 4.5** : image réduite à 1 000 px (environ 1,30 $ pour mille images, R11 §15.5), zoom à pleine résolution sur les zones de texte, prompt structuré avec logo et packshot de référence, sortie JSON (texte lu, écarts, logo, produit, anomalies anatomiques, lisibilité à 390 px) ; jamais « est-ce que ça a l'air IA » : Claude ne détecte pas les images synthétiques et ne nomme pas les personnes (R07 §11.14). **Couche 3, juge éditorial** : sept critères notés 0 à 3 (spécificité, originalité par test de substitution, voix, hook, appel à l'action, ancrage réel, conformité), seuil 15/21 et au moins 2 sur spécificité, voix et conformité (R11 §8.2), juge figé (modèle, version de rubrique, hash du prompt), ordre aléatoire contre le biais de position, 40 contre-exemples, calibration mensuelle. **Boucle de correction masquée** : édition masquée à deux essais, moteur de repli, file humaine ; chaque rejet journalisé dans `qc_result` par moteur et par client (R03 §10).

### 7.4 Bancs d'essai permanents (phase 0, puis à chaque changement de version)

Trente phrases françaises accentuées générées sur chaque moteur d'image et notées par OCR (R03 §12.11) ; cinq sermons de référence (Abidjan, Paris, Montréal) avec WER par moteur (R05 §8.3) ; prompts « culte », « prière », « baptême », « enfants », « peau » sur Kling, Seedance puis Veo (R04 §8.16) ; vingt générations gpt-image-2.5 par qualité avec lecture de `usage` (R26 §5.7) ; test hebdomadaire par fournisseur (H9) ; lot d'évaluation de 50 cas par verticale pour le juge, cinq essais par configuration, avant toute optimisation (R07 §11.20).

---
## 8. La veille et l'intelligence

### 8.1 Sources par flux et fréquences (R06 §16, R10 §8.10)

| Flux | Sources | Fréquence | Coût |
|---|---|---|---|
| A, le client | crawl du site (sitemap, flux WordPress ou Shopify, webhook), dépôts WhatsApp, Business Discovery sur ses comptes, Atom YouTube et PubSubHubbub | quotidien ; Atom horaire ; webhooks temps réel | 0 $ |
| B, le domaine et la région | Trending Now RSS par pays (CI, CA, FR, testé le 1er octobre 2026, R06 §2.2), Google News RSS localisé, GDELT DOC 2.0 (gratuit, 15 minutes), RSS d'Abidjan.net, Fratmat, BlogTO, Ottawa Festivals, pages Facebook des festivals par Graph API, SerpApi partagé (Starter 25 $ ou Developer 75 $) pour Trends explore, Google Events et News structuré, changedetection.io auto-hébergé, Tavily (1 000 crédits gratuits) pour la genèse, Exa pour les concurrents | 2 h, 4 h, 6 h, hebdomadaire | SerpApi 25 à 75 $ partagé |
| C, formats et sons | run Apify quotidien du Creative Center TikTok pour trois pays, partagé (moins de 20 $, R06 §16.4), hashtags Instagram dans la limite de 30 par 7 jours et par compte (10 marque, 10 niche, 10 exploratoires, R06 §16.6), Business Discovery de 5 à 10 concurrents, Instagram Audio API (R26 §3) | quotidien | 25 à 35 $ partagé |
| D, calendrier des moments | fêtes fixes par pays (Nager, canada-holidays), lunaires saisies à la main avec fenêtre et confirmation la veille, événements vivants (FEMUA fin avril, MASA en avril des années paires, Afrofest mi-août, Francophonie en fête fin septembre, rentrée le 14 septembre, pics d'admission 2IAE), calendrier liturgique, journées ONU (R10 §8.9) | hebdomadaire, horizon 8 semaines, proposition 10 jours avant | 0 $ |

Jamais pytrends ni un scraper Google Trends sur Railway (429 depuis les IP cloud, R06 §16.3) ; NewsAPI (449 $) et Bing News (retirée) écartés. Plan B par configuration pour chaque flux gratuit (R06 §16.20). Scrapers isolés des comptes de publication et déclarés au contrat (R06 §16.18).

### 8.2 Scoring, vérification, mesure de la veille

Pipeline (R06 §13.3) : collecte avec hash et URL canonique, dédoublonnage exact puis sémantique (cosinus supérieur à 0,92 sur 7 jours), scoring Haiku 4.5 par lots de 20 avec profil client en cache (pertinence, pilier, urgence, risque, format, angle) en Batch nocturne hors newsjacking (R06 §16.12), score composite pertinence × fraîcheur (demi-vie 36 heures pour une tendance, 14 jours pour un événement) × signal × diversité, genèse par Claude avec recherche web (10 $ pour 1 000 recherches, R07 §2), classement par pilier ; refus d'une semaine sans 60 % d'items « valeur » (R06 §16.15). Règles dures (R06 §13.4) : toute date et tout lieu corroborés par deux sources dont une primaire ; confiance par champ, tout champ sous 0,8 bloque ; revérification 48 heures avant ; politique et religion exclus du newsjacking pour les églises, SEVARTA et 2IAE ; « Source : URL » sur la planche. Mesure de la veille : proposé, accepté, publié, performance par item ; sources sans item accepté coupées à 90 jours (R06 §16.19).

### 8.3 Coût mensuel (R06 §14)

Socle partagé 60 à 170 $ (SerpApi 25 à 75 $, Apify 19 $, Tavily 0 à 30 $, Exa 0 à 10 $, changedetection.io 5 à 15 $, workers 10 à 20 $). Par client : 5 à 10 $ en profil léger (église, association), 12 à 25 $ en standard (beauté, SEVARTA, 2IAE), 30 à 60 $ en intensif ; LLM sous 5 $ avec Batch et cache. C'est le poste de valeur : Hootsuite vend la veille à partir de 399 $ par siège, en anglais (R01 §8.4).

---
## 9. L'architecture agentique

### 9.1 Doctrine : 80 % d'appels structurés, 20 % d'agents, zéro agent en attente

Le cœur tourne sur l'API Messages avec sorties structurées (`output_config.format` JSON Schema, sans surcoût, R21 §2.2), cache de prompt et Batch, orchestré par pg-boss (R07 §11.1) : posts, carrousels, scripts, calendrier, juges, scoring, extractions, classification sont des appels à 0,005 à 0,32 $ (R07 §7). Un agent coûte 4 à 15 fois plus de jetons sans gain sur une tâche bien spécifiée (R07 §3). Le Claude Agent SDK (TypeScript, conteneur `agent`, `SessionStore` Postgres, `maxBudgetUsd` 2 $ par sermon, profondeur 1, hooks `PreToolUse` d'audit et `defer` sur toute action irréversible, R07 §11.8) n'entre qu'en phase 2 pour les tâches ouvertes : audit du site d'un client, genèse, sermon à croiser avec les annonces (R07 §11.19).

### 9.2 Modèles par tâche (prix officiels R26 §2.3)

| Tâche | Modèle | Entrée / sortie / lecture de cache par MTok | Mode |
|---|---|---|---|
| Création (posts, carrousels, scripts, calendrier, clips, dérivés, rapport) | Opus 5.5 | 4 $ / 20 $ / 0,20 $ (0,05x, seul modèle à ce taux) | temps réel pour la planche, Batch (2 $ / 10 $) pour le calendrier |
| Synthèses de veille, extraction INCI et PDF, brouillons sensibles | Sonnet 5.5 | 2 $ / 10 $ / 0,20 $ | Batch quand possible |
| Juges, scoring, vision, classification, flyers, ouvriers de lecture | Haiku 4.5 | 1 $ / 5 $ / 0,10 $ ; minimum cacheable 4 096 jetons (R07 §4) | Batch nocturne |
| Sessions d'agent longues (sermon complet, audit de site, revue multi-clients) | Fable 5.1 | 10 $ / 50 $ / 0,25 $ (0,025x) | Agent SDK, phase 2 ; jamais une légende (R26 §5.8) |
| Second juge d'une autre famille sur 10 % des contenus | gpt-4o-mini (déjà en place) | prix non vérifié dans les rapports | échantillon (R11 §15.4) |

Règles : majorer les entrées de 30 % pour le tokenizer (R26 §5.8) ; jamais changer de modèle en cours de conversation ; cerveau de 4 000 à 12 000 jetons derrière `cache_control` TTL 1 heure (10 000 jetons relus 500 fois : 1 $ au lieu de 20 $, R07 §11.3) ; tester `stop_reason === "refusal"` et `fallbacks: "default"` (R07 §11.15) ; `batch_id` et `custom_id` en base avant envoi (R07 §8.3) ; clé Console séparée de l'abonnement Max de José (R07 §11.17) ; alerte à 15 $ de jetons par client et par mois. Panier mensuel type : environ 10,6 $, 7 $ avec Batch, soit 9 à 14 $ après majoration (R07 §7).

### 9.3 Cerveau de marque et mémoire

Trois couches (R07 §4, C5) : stable, dans `brand_brain` versionné (fiche de voix extraite de 15 textes validés par le prompt R11 §5.4 et validée par le client sur la première planche : règles mécaniques, lexique signature, interdits lexicaux français construits par statistique sur 500 brouillons, exemples avant et après, dix meilleurs posts ; doctrine ; registre de langue standard, parlé avec nouchi ou bilingue, R10 §8.8 ; profil de conformité) ; vivante, en tables exposées par outils (`get_brand_assets`, `get_recent_posts`, `get_metrics`) pour ne pas casser le préfixe caché ; agentique, dans `SessionStore` en phase 2. `asset_ids` obligatoire sur tout contenu émotionnel (R11 §15.2). Réinjection mensuelle des dix meilleurs posts et des cinq à dix dernières paires de corrections (R11 §15.10). Brand kit par Firecrawl `branding` (1 crédit) puis Claude, poussé dans un Brand Kit Canva (R21 §9.14) ; « page Facebook plus trois visuels » pour les clients sans site (R21 §9.15) ; 50 posts importés, pas 500 (R21 §9.16).

### 9.4 Juge et garde-fous

Le juge de la section 7.3, calibré le premier mois sur 100 posts notés par José par verticale (kappa d'au moins 0,6, R11 §15.4), recalibré chaque mois et à chaque changement de modèle. Garde-fous encodés : lexique d'allégations par pays, versets vérifiés par outil, consentement d'image pour tout visage (vue SQL `publishable_assets`), chiffres 2IAE issus de la base, `ai_label` par variante, « faits à confirmer » sur la planche. Trois refus sur un client : Routine « incident » et alerte (R07 §11.12).

### 9.5 Place exacte de chaque surface

- **Claude Code** construit la plateforme ; en exploitation, il agit sur elle par le serveur MCP.
- **Routines Claude Code** (aperçu de recherche) : pont d'entrée tiré par la plateforme, `POST /v1/claude_code/routines/{id}/fire`, 30 tirs par heure et par routine, 100 par compte, bloc `routine-fire-payload` traité comme non fiable (R07 §2.6 et §11.12) ; deux routines en phase 3 (« revue hebdomadaire », « incident ») ; pas d'idempotence, donc un tir par clé `client:semaine` journalisé (C5) ; rien de critique n'en dépend.
- **Claude Cowork** : outil personnel de José, sans API d'entrée (R07 §2.7). La plateforme ne déclenche pas Cowork ; elle dépose des ordres que Cowork vient lire par le MCP dans une tâche planifiée. Bascule « nuage uniquement » à vérifier avant le 6 octobre 2026 (R07 §10.1).
- **Serveur MCP distant « machine-social »** (phase 3) : Streamable HTTP, OAuth 2.1, PKCE, RFC 9728, 8414, 7591, 8707, joignable depuis les adresses d'Anthropic (R07 §2.5) ; dix outils : `list_pending_briefs`, `get_brand_brain`, `get_assets`, `submit_render`, `submit_board`, `approve`, `reject`, `request_video_job`, `report_metrics`, `log_decision` (R07 §11.9) ; même serveur pour Claude Code, les Routines, Managed Agents, un partenaire agence et le palier « logiciel seul ».
- **Claude in Chrome** : hors plateforme (arbitrage 3). Aucun `browser_toolset` sur Railway contre Higgsfield : fragile, 6 600 jetons de définition, 1 300 à 2 700 par capture, contraire aux conditions (R07 §11.11).
- **Higgsfield** : API officielle seulement (open.higgsfield.ai, 16 septembre 2026, paiement à la génération, SDK `@higgsfield/client`, webhooks, sorties conservées sept jours donc copiées ; usage par agent et MCP prévu par la section 11.12 des conditions, R26 §2.4) pour Kling 3.0 et Seedance 2.5. Hors Enterprise, les références peuvent entraîner les modèles (section 4.4) : visages de pasteurs, d'auteurs, de fondatrices et d'enfants exclus, mention au contrat (R26 §5.12). Le pilotage navigateur de l'Unlimited est interdit (section 10.6, R26 §2.4) ; la plateforme n'en dépend pas, donc une suspension du compte personnel de José ne toucherait aucun client.
- **fal** (FLUX.2, Seedream, LTX-2.3, Recraft) et **Gemini** (Veo 3.1 Fast, Nano Banana 2, Lyria 3, phase 3) : autres adaptateurs, test hebdomadaire (R04 §8.2).

### 9.6 Observabilité

Phase 1 : `llm_call` (modèle, jetons, cache, coût, latence, `stop_reason`, `batch_id`) et `cost_ledger` ; journaux pino avec `tenant_id`, `job_id`, `content_type`, expurgés de tout jeton par un sérialiseur unique (C5). Phase 2 : Langfuse Hobby (50 000 unités gratuites, R07 §8.2) puis auto-hébergé ou Core à 29 $, score du juge par trace ; comparaison mensuelle entre la facture Console et les estimations locales (R07 §11.16).

---
## 10. Publication, mesure et apprentissage

### 10.1 Couche de publication : trajectoire

Interface `Connecteur` (`publier`, `programmer`, `lire`, `statistiques`, `commentaires`, `sante`) avec deux implémentations dès le jour 1 (R02 §12.1, C5) : **`UnifiedConnector` sur Upload-Post Professional** (50 $, 25 profils, marque blanche, revues Meta et audit TikTok portés, minutes ffmpeg incluses, R02 §8.1 ; plan Free pour les tests ; Zernio à l'usage ou Ayrshare Launch à 299 $ en alternatives) et **`MetaDirectConnector` en Graph API v25.0** pour les pages où Markel-Tech a déjà un rôle (page 2IAE, SEVARTA, Markel-Tech), sans App Review (R02 §2.1), puis pour tous après Advanced Access. **Blotato Starter** (29 $, 20 comptes, 1 250 crédits, « jusqu'à 900 posts TikTok par mois », audit porté, MCP, R26 §2.10) seulement pour un client qui exige TikTok avant l'audit de notre app, après un test d'une semaine. Dès la semaine 0, les demandes officielles courent : app Meta liée à Markel-Tech Inc. vérifiée (App Review jusqu'à 20 jours par décision, permissions de publication, commentaires, messagerie, publicité, Page Public Content Access et HUMAN_AGENT en une revue avec vidéo, R02 §12.2, R23 §8.2), projet Google Cloud avec audit YouTube (quota d'upload séparé de 100 par jour, R02 §12.7), app TikTok et audit Content Posting (avant audit : 5 utilisateurs en SELF_ONLY, 6 requêtes par minute, R26 §2.7), app LinkedIn Community Management (version mensuelle en paramètre, 202510 retirée le 15 octobre 2026, R02 §12.17), Google Business Profile (R02 §12.14). Migration client par client : Meta et YouTube vers 3 mois, LinkedIn vers 6, TikTok vers 6 à 12 ; apps propres à coût marginal nul vers 9 à 12 mois. Sorties de secours : MCP Metricool (tout plan) et MCP Blotato (R26 §2.10, §5.17).

### 10.2 Contraintes par plateforme codées dans `ref.platform_rule`

Instagram : `content_publishing_limit` lu avant chaque publication, 50 comme plafond prudent tant que le compteur n'a pas prouvé 100 (R26 §5.3) ; Reels 3 secondes à 15 minutes, 300 Mo, 1080 × 1920 à 8 Mbps (R26 §5.2) ; carrousel 10 ; 5 hashtags ; `is_ai_generated` ; Trial Reels (R26 §5.5) ; médias servis par URL présignée Railway de 48 heures sur une copie `pub/`, révoquée après `FINISHED`, purgée à 7 jours, testé dès la première semaine (R25 §11.3). Facebook : Reels 3 à 90 secondes, 30 par 24 heures ; Stories 60 secondes. Threads : 250 par 24 heures, carrousel 20. YouTube : 100 uploads par jour par projet, lissés (R02 §12.7) ; Shorts jusqu'à 3 minutes (R26 §5.1) ; consentement horodaté. TikTok : FILE_UPLOAD (4 Go, morceaux de 5 à 64 Mo), PULL_FROM_URL exigeant un domaine vérifié sans redirection (R25 §11.3) ; écran de validation conforme à l'audit (R02 §12.3) ; `is_aigc`. LinkedIn : documents natifs et multi-images, pas de planification. X : Markel-Tech seulement, 0,015 $ par post, 0,20 $ avec lien (R02 §6). WhatsApp Channels et Status : aucune API, paquet manuel, adaptateur isolé pour le jour où Meta livre la programmation (R10 §8.20). Créneaux par fuseau (R10 §8.7), dimanche interdit par défaut (R09 §11.5).

### 10.3 Jetons, reconnexion, repli manuel

Rafraîchissement quotidien Meta et Instagram à J-5, LinkedIn alerte J-10, TikTok avant chaque publication, Google durable (R02 §10.3 et §12.9). Erreur 190, 401 ou `access_token_invalid` : état `a_reconnecter`, alerte, courriel au client avec lien de reconnexion, publications en `en_attente_reconnexion`. Échec de publication réessayé trois fois avec backoff puis converti en paquet « prêt à publier » (médias, légende, texte alternatif, heure, cases à cocher, lien profond) ; le gestionnaire colle l'URL, la machine mesure (R02 §10.5). Le paquet couvre Channels, Status, Snapchat, refus d'API, carrousels de 11 à 20, période avant audits.

### 10.4 Mesure en trois couches (R24)

**Collecte chez soi, chaque nuit, en ajout seul** : Instagram retarde de 48 heures, efface les Stories à 24 heures et ne garde que 2 ans ; Facebook limite à 90 jours par requête et a retiré une quarantaine de métriques le 15 juin 2026 ; LinkedIn ne sert que 12 mois (R24 §1). GA4 Data API (200 000 jetons par jour et par propriété) ; YouTube Analytics avec `creatorContentType=SHORTS` et `insightTrafficSourceType` pour savoir si les clips ramènent vers le sermon (R24 §10.11) ; TikTok Display API. `metric_alias` versionnée, jamais de colonnes figées (R24 §10.9) ; mois clos le 3 ; test hebdomadaire qui échoue bruyamment sur « invalid metric » (R24 §10.20). **Couche affaires, en haut dès le premier mois** : tout lien sortant généré en `tracked_link` avec UTM conventionnés (`utm_campaign = {client}-{aaaa-mm}-{pilier}`, `utm_content = c{id}-{format}`) via un raccourcisseur maison `go.{domaine}/{code}` qui enregistre le clic côté serveur même sans GA4 (R24 §2.1) ; lien en bio maison à la place de Linktree Pro (15 $ par profil, R24 §2.5) ; QR dynamiques maison (R24 §10.4) ; un coupon par contenu promotionnel, lisible à voix haute (R24 §10.6) ; `referral` et `ctwa_clid`, `Lead`, `QualifiedLead`, `Purchase` par Conversions API « business_messaging » avec `event_id` (R24 §2.4) ; Pixel et CAPI chez le client avec consentement (R24 §10.16). Chiffres par verticale : commandes attribuées, billets scannés, visiteurs ayant cité un clip et demandes de prière, livres vendus avec code, dossiers d'admission, devis et pipeline Zoho (R24 §4.3). **Couche croissance** : abonnés nets, visites de profil, clics, messages entrants, vues ; plus jamais « portée organique contre payée » sur Facebook (R24 §10.10). **Couche indicateurs avancés** : envois et enregistrements par portée en tête, visionnage complet, `reels_skip_rate`, rétention à 3 secondes, engagement contre la médiane de la verticale (table `benchmark` datée, révisée chaque trimestre, R24 §10.19) puis contre la médiane locale ; alerte seulement deux mois de suite et sous les deux seuils (R24 §10.14).

### 10.5 Rapport mensuel et boucle d'apprentissage

PDF d'une page par Playwright plus résumé WhatsApp de cinq lignes avec les trois meilleures publications, le premier lundi après le 3, avant 9 h (R10 §8.13, R24 §10.8) : note de confiance, couche affaires en premier même avec de petits chiffres, croissance, indicateurs avancés avec pastille médiane, les quatre indicateurs « à la page » et le chronomètre, une publication qui a échoué et sa leçon, trois décisions, état du plan à 90 jours (R24 §4.2). Coût 1 à 3 $ par client (R24 §8). Revue à 90 jours ; alerte « risque de départ » (R08 §10.18). Apprentissage (R11 §10) : corrections du gestionnaire, décisions client, performance réelle, réinjectées chaque mois ; trois à cinq hooks de familles différentes par idée vidéo, testés sur des jours distincts ou en Trial Reels ; bandit par verticale (pas par client), récompense envois plus enregistrements par portée, 20 % d'exploration, probabilités affichées au gestionnaire (R11 §15.9, phase 4) ; moments de sermon nourris par les clips qui ont marché (R05 §8.14).

### 10.6 Après la publication (R23)

Boîte de réception maison sur les API Meta gratuites (750 réponses privées par heure, R23 §8.1), tri Haiku, « commentez MOT CLÉ » interne avec réponse privée unique sous 7 jours (R23 §8.3), quatre ice breakers par client, automate déclaré, jamais sur une plainte (R23 §8.7). Boost en trois temps : détection à 24 heures (deux conditions sur trois au-dessus de 1,5 fois la médiane des 30 dernières publications), proposition au client avec capture et budget (5 $ par jour sur 7 jours à Abidjan, 10 $ au Canada ; Meta exige 1 $ par jour en impressions et 5 $ en clics, TikTok Spark Ads 20 $ par jour avec code du créateur), exécution par le gestionnaire après validation écrite par la Marketing API ; plafond et exclusions au contrat ; compte publicitaire du client (R23 §8.10 à §8.16). Click-to-WhatsApp comme amplification par défaut (72 heures de messages gratuits si réponse sous 24 heures, R23 §8.17). Vente par catalogue Commerce Manager et WhatsApp, jamais le paiement Instagram ; la « boutique Facebook » d'Abidjan est une vitrine sans paiement (R23 §8.18 et §8.19).

---
## 11. Architecture technique et modèle de données

### 11.1 Services Railway

Projet Railway « machine » distinct du projet « Groupe 2iae » (R25 §11.1), région EU West Amsterdam (5 300 km d'Abidjan ; latence mesurée en phase 0 avant de figer, R25 §2.4), plan Pro, tout provisionné par le Railway CLI, déploiement automatique depuis GitHub. Monorepo pnpm : `apps/web`, `apps/worker`, `apps/rendu`, `apps/tick`, `apps/agent` (phase 2), `packages/db` (Drizzle), `packages/core` (états, règles, prix, transitions), `packages/providers`, `packages/remotion` (C5).

| Service | Rôle | Taille de départ (R25 §8) |
|---|---|---|
| `web` | Express (API, webhooks WhatsApp, Meta, PubSubHubbub, fournisseurs ; serveur MCP en phase 3 ; pages magiques, lien en bio, raccourcisseur ; PWA React statique) | 0,5 vCPU, 1 Go, 2 réplicas (20 $) ; sans volume, donc sans coupure |
| `worker` | pg-boss : `veille`, `scoring`, `genese`, `ideation`, `redaction`, `juge`, `vision`, `planche`, `notification`, `generation`, `publication`, `inbox`, `metrique`, `rapport`, `ingest`, `whatsapp`, `retention_purge`, `token_refresh`, `sante`, `tenant_offboard` ; seul porteur des clés fournisseurs (R25 §7.2) | 0,5 vCPU, 2 Go (30 $) ; arrêt gracieux sous 30 s |
| `rendu` | ffmpeg, libass, MediaPipe, Chromium Playwright, Remotion CPU ; concurrence 1 par réplica, 2 réplicas au-delà de 10 clients ; Serverless | 4 vCPU, 8 Go, 2 h par jour (13 $) |
| `tick` | Railway cron 5 minutes, sort en moins d'une minute (R07 §11.6) | 0,25 vCPU |
| `agent` (phase 2) | Agent SDK, séparé du rendu (R25 §11.11) | 0,5 vCPU, 2 Go |
| `changedetection` (phase 2) | pages dynamiques | 5 à 15 $ |
| `postgres` | une base ; schémas `app` (RLS), `pgboss`, `audit`, `ref` ; `railway.internal` seulement, URL publique désactivée (R25 §11.14) ; PITR le jour 1 | 0,25 vCPU, 1 Go, volume 5 Go (16 $) |
| bucket `machine-ams` | `t/{tenant_id}/orig`, `der`, `pub`, `exp` ; chiffré au repos ; URL présignées jusqu'à 90 jours ; 0,015 $ par Go, sortie gratuite (R25 §2.1) | |
| projet « machine-sauvegarde », bucket `archives` | copies des originaux, `pg_dump --format=custom` hebdomadaires chiffrés ; survit à la suppression du premier projet (R25 §2.2) | 5 à 20 $ |

Les buckets Railway n'ont ni bucket public, ni cycle de vie, ni versionnage, ni verrou (R25 §1.3) : job quotidien `retention_purge` (lit `expires_at`, supprime, vérifie par `HEAD`, écrit `purged_at`, R25 §11.4). Rétention : originaux ou proxy 720p plus audio (question 5), rendus 90 jours, copies `pub/` 7 jours. Sauvegardes en trois couches : instantanés (6, 27, 89 jours), PITR (4 semaines), dump hebdomadaire ; restauration trimestrielle chronométrée dans `audit_log` (R25 §11.8). Limite de dépense dure à 1,5 fois la facture attendue (R25 §11.13). Remotion Lambda, s'il sert un jour pour le délai, est du calcul hors Railway sans persistance : sorties copiées dans le bucket Railway, stockage temporaire purgé (C5), dit explicitement parce que cela touche la lettre de la contrainte.

### 11.2 Postgres : tables principales (schéma validé par `/db` avec le Railway CLI avant la première ligne de code)

Conventions (R25 §9, C5) : UUIDv7 ; `tenant_id` non nul sur chaque table métier ; clé composite `(tenant_id, id)` sur les tables volumineuses ; `timestamptz` ; `usd_micro` bigint ; partitions mensuelles pour `audit_log`, `cost_ledger`, `llm_call` ; `tenant.data_region` et `asset.storage` dès la première migration (R25 §11.17).

| Groupe | Tables et colonnes clés | Contraintes |
|---|---|---|
| Locataire et accès | `tenant` (vertical, country, timezone, register, platforms_json, plan, `regle_sans_reponse`, `reserve_activee`, data_region, status) ; `user`, `membership` (owner, manager, client_viewer) ; `person` (opt-in horodaté, source, texte, `stop_at`) ; `tenant_key` (DEK chiffrée, `key_version`) ; `tenant_secret` (kind oauth_token, byok, whatsapp_number, voice_id ; ciphertext, nonce, tag) ; `magic_link` (`token_hash`, board_id, expires_at, revoked_at) | unique slug ; unique (tenant_id, user_id) ; unique token_hash |
| Marque | `brand_brain` (version, voice_sheet_json, pillars_json, frameworks_json, hashtags_json, compliance_profile_json, `cached_prompt_hash`, `validated_by_client_at`) ; `reference_kit` ; `learning_pair` ; `hook_bandit` | une version courante par tenant |
| Médias et droits | `asset` (kind, source, sha256, bytes, mime, dimensions, storage, bucket, key, retention_class, expires_at, legal_hold, purged_at) ; `asset_variant` (variant, version, engine, engine_version, params_json) ; `asset_rights` ; `consent` (adulte ou mineur_avec_parent, scope, document_key, signed_at, revoked_at) ; `ai_label` (is_aigc, generator, version, prompt_hash, realistic, real_person, minor, c2pa_key, disclosed_at) ; `licence_registry` ; `asset_url` (url_hash, purpose, expires_at) | unique (tenant_id, sha256) ; index (tenant_id, expires_at) where purged_at is null ; vue `publishable_assets` |
| Veille et calendrier | `source` ; `item` (canonical_url, content_hash, embedding, scores, pillar, urgency, risk) ; `dossier` (facts_json avec confiance et URL, sources_json, angle, window) ; `signal` (kind, `detected_at`, item_id, source_asset_id) ; `calendar_moment` (date, kind, window_days, confirmed_at) | unique (tenant_id, content_hash) ; ivfflat sur embedding ; index (tenant_id, detected_at) |
| Contenus et planches | `campaign` ; `content_item` (format, platform, pillar, framework, scheduled_at, status, current_version_id, board_id, judge_score, ai_label_required, needs_human_gate3, `is_reserve`) ; `content_version` (text_json, prompts_json, asset_ids[], maquette_variant_id, final_variant_ids[], model, cache_read_tokens, revision_reason) ; `judge_score` (rubric_version, model, prompt_hash, scores_json, decision) ; `qc_result` (couche, verdict, details, modele, tentative) ; `board` (week_start, status, composite_variant_id, sent_at, reminder1_at, reminder2_at, pillar_mix_json) ; `board_item` (verdict, motive, verdict_channel, verdict_at) ; `validation` (journal brut) | unique (tenant_id, week_start) ; index (tenant_id, status) ; trigger `ref.content_transition` |
| Production | `generation_job` (provider, model, version, prompt_hash, `external_id` écrit avant l'appel, status, cost_reserve, cost_real, fallback_of) ; `render_job` ; `external_ref` (system, external_id, synced_at) ; `engine_registry` | index (system, external_id) |
| Publication et messagerie | `social_connection` (platform, external_id, connector, secret_id, scopes_json, api_version, status ok, a_reconnecter, revoque ; token_expires_at, `publishing_limit_last`) ; `publication` (connector, status, scheduled_at, published_at, external_post_id, permalink, attempt_count, last_error, ai_flag_sent, trial) ; `publication_attempt` (response_json sans jeton) ; `manual_package` ; `whatsapp_message` (direction, template_name, category, phone_hash, status, cost_micro, window_open_until) ; `whatsapp_template` (bloque l'envoi si reclassé) ; `inbox_item` (classification, draft_reply, requires_human, human_agent_tag) ; `boost_proposal` | unique (platform, external_id) ; index (tenant_id, status, scheduled_at) ; trigger plafond de boost contre `tenant_budget` |
| Mesure et affaires | `account_metric_daily`, `media_metric_snapshot`, `metric_alias`, `benchmark` (`as_of`), `tracked_link`, `link_click` (`visitor_hash` salé), `conversion_event` (kind, value, currency, source, ctwa_clid, `sent_to_capi_at`), `coupon`, `coupon_redemption`, `whatsapp_inbound`, `monthly_report` | relevés en ajout seul (R24 §7) |
| Coûts et audit | `llm_call` ; `cost_ledger` (usd_micro_reserved, usd_micro_actual) ; `tenant_budget` (scope jour ou mois, category, cap_micro, alert_ratio) ; `retention_job` ; `audit.audit_log` (actor, action, before_hash, after_hash) | partitions mensuelles ; trigger interdisant UPDATE et DELETE ; 13 mois |
| Référentiels | `ref.sequence_template`, `ref.platform_rule`, `ref.content_transition`, `ref.tarif_whatsapp`, `ref.holiday`, `ref.bible_segond1910`, `ref.setting` ; `pgboss.*` avec identifiants seulement | sans RLS |

Plafonds par défaut en base (C1, R25 §11.12) : église 15 $ par jour et 60 $ par mois, beauté 10 $ par jour et 120 $ par mois ; réservation puis réalisation ; alerte à 80 %.

### 11.3 Sécurité multi-locataires et chiffrement

Rôles `migrator`, `app_rw` (sans `BYPASSRLS`, `FORCE ROW LEVEL SECURITY`), `app_ro`, `backup` (`row_security = off`) ; `app.tenant_id` et `app.actor_id` posés par `set_config(..., true)` puis `set local role app_rw` dans chaque transaction Drizzle ; politique restrictive `tenant_id = current_setting('app.tenant_id', true)::uuid` en `USING` et `WITH CHECK` (sans variable, aucune ligne) ; batterie d'isolation à chaque migration générée par `/db` (R25 §11.6). Clé S3 par `keyFor(tenantId, ...)` validée par expression régulière ; bucket dédié pour un client exigeant (R25 §5.2). Webhooks vérifiés par signature (`X-Hub-Signature-256`, HMAC Upload-Post) avant mise en file ; limitation de débit ; liens magiques bornés. Enveloppe : KEK en variable Railway du seul service `worker`, DEK AES-256-GCM par client dans `tenant_key`, jetons OAuth, BYOK, numéros WhatsApp et voix chiffrés, rotation annuelle de la KEK et à 90 jours des clés fournisseurs, DEK supprimée en fin de contrat (R25 §11.7). Projet OpenAI « machine-prod » avec plafond dur (R25 §11.12). Aucun jeton dans les journaux (sérialiseur unique). Aucun mot de passe de client : rôles Business Manager, révocation en un clic (R08 §10.14). Job `tenant_offboard` : export ZIP avec manifeste et sommes de contrôle, suppression vérifiée, suppression de la DEK, attestation PDF (R25 §11.9).

### 11.4 Déploiement et tests

GitHub vers Railway automatique sur `main` ; migrations Drizzle par `migrator` en pré-déploiement de `web`, idempotentes, destructives seulement en deux temps ; `scripts/garde-service.mjs` repris du dépôt 2IAE ; jamais `railway up` à la main ; environnement `staging` avec base anonymisée ; fenêtre d'évitement 05:45 à 06:30 GMT et pendant un lot de sermons (C5). Tests : batterie RLS, contrats par connecteur sur comptes de test chaque semaine, lot d'évaluation du juge, bancs de la section 7.4, rendus comparés par hash perceptuel, page de validation à 390 px en Playwright, restauration trimestrielle, diff trimestriel des pages primaires (six faits sur dix avaient bougé en six mois, R26 §5.19).

### 11.5 Coûts d'hébergement

85 à 110 $ par mois à 6 clients (web 20 $, Postgres 16 $, worker 30 $, rendu 13 $, buckets 6,40 $, PITR 2 $, sortie 2,60 $, plan Pro), 230 à 290 $ à 20 clients, soit 12 à 18 $ par client ; sauvegarde 5 à 20 $ ; stockage sous 40 $ par mois la première année (R25 §8 et §11.5). Moins de 2 % du chiffre d'affaires : c'est la génération qu'il faut plafonner (R25 §11.18).

---
## 12. Coûts et modèle économique

### 12.1 Coût mensuel détaillé par client type (dollars US, prix d'octobre 2026)

Hypothèses : socle partagé 150 à 300 $ par mois (veille 60 à 170 $, R06 §14.1 ; Upload-Post Pro 50 $ ; Blotato 29 $ si activé ; Canva 20 $ par utilisateur ; Langfuse 0 à 29 $ ; Remotion 0 $ jusqu'à trois personnes, R04 §4), soit 20 à 40 $ par client à 8 clients ; outils personnels de José non imputés (R07 §11.17). Hébergement 12 à 18 $ (R25 §8). Mesure 1 à 3 $ (R24 §8). WhatsApp 1 $ (R22 §10.16). Jetons 9 à 14 $ après majoration (R07 §7, R26 §5.8). Humain 4 à 6 heures (R08 §6.3) : Abidjan 20 000 à 45 000 FCFA (33 à 74 $), Canada 160 à 300 CAD (113 à 211 $).

**Client A : église d'Abidjan, Chaire (4 sermons, 20 clips, format long, 40 citations, dévotionnels, 2 comptes)**

| Poste | Coût mensuel |
|---|---|
| Transcription (4 × 1,5 h × 0,21 $, R05 §8.3) | 1,3 $ |
| Analyse des sermons (4 × 0,14 $, 0,07 $ en Batch, R07 §7) | 0,3 à 0,6 $ |
| Autres jetons (citations, dévotionnels, juges, rapport) | 4 à 6 $ |
| Rendu (part du service `rendu`) | 0,5 à 1,5 $ |
| Images (cartes de versets HTML, miniatures) | 0,5 à 1 $ |
| Enregistrement Daily si régie (4 × 1,21 $, R21 §9.7) | 4,8 $ |
| Veille profil léger (R06 §14.2) | 5 à 10 $ |
| Hébergement et stockage (proxy 720p plus audio) | 12 à 18 $ |
| Mesure, WhatsApp | 2 à 4 $ |
| Part du socle partagé | 20 à 40 $ |
| **Total hors humain** | **50 à 85 $** |
| Gestionnaire local 4 heures (20 000 à 30 000 FCFA) | 33 à 49 $ |
| **Total avec humain** | **85 à 135 $** |

Chaire à 175 000 FCFA (environ 287 $) : marge brute 53 à 70 %. Au Canada à 450 CAD (environ 317 $) avec 2 heures de gestionnaire canadien (56 à 70 $) : coût 106 à 155 $, marge 51 à 67 %. Comparaison : Sermonshots 53 à 97 $ par mois sans français ni validation ni publication ; Pulpit AI 5 à 8 $ par sermon ; Church Media Squad 1 697 $ en service humain (R05 §1 et §2.2).

**Client B : marque de beauté, Vidéo+ (12 Reels dont 6 génératifs et 6 programmés, 8 carrousels, 4 UGC montés, boîte de réception, boost supervisé)**

| Poste | Coût mensuel |
|---|---|
| Vidéo générative (6 Reels à 5 à 6,50 $, 3 prises ; 1 scène signature lissée, R04 §6) | 36 à 48 $ |
| Reels programmés, UGC montés, voix, musique | 4 à 10 $ |
| Planches et prises écartées (brouillons LTX-2.3, maquettes low) | 15 à 25 $ |
| Images, détourage, carrousels, QC vision (R03 §9) | 3 à 6 $ |
| Jetons (création, juges, veille, tri de 2 000 commentaires, R23 §8.4) | 12 à 20 $ |
| Veille profil standard (R06 §14.2) | 12 à 25 $ |
| Extraction INCI, WhatsApp, mesure | 3 à 5 $ |
| Hébergement | 12 à 18 $ |
| Part du socle partagé | 20 à 40 $ |
| Marge pour l'option avatar étiqueté ou des Reels génératifs supplémentaires sous plafond de 120 $ | 0 à 48 $ |
| **Total hors humain** | **117 à 245 $** |
| Gestionnaire 6 heures : Abidjan 45 000 FCFA (74 $) ; Canada 300 CAD (211 $) | 74 à 211 $ |
| **Total avec humain** | **190 à 320 $ (Abidjan) ; 330 à 455 $ (Canada)** |

Vidéo+ à 550 000 FCFA (environ 902 $) : marge brute 64 à 79 %. Au Canada à 1 800 CAD (environ 1 269 $) : 64 à 74 %. Comparaison : pack vidéo d'agence à Abidjan 500 000 à 900 000 FCFA produit à la main (R10 §7.1) ; Montréal 2 500 à 3 500 CAD ; Predis 55 $ en gabarit sans gestionnaire (R01 §3).

**Client C : école (2IAE), Présence élargi (12 visuels, 4 vidéos programmées, 2 carrousels, LinkedIn, WhatsApp hebdomadaire, rapport avec GA4)**

| Poste | Coût mensuel |
|---|---|
| Images et carrousels (composition HTML) | 2 à 4 $ |
| Vidéos programmées, récaps, miniatures | 2 à 5 $ |
| Clips génératifs occasionnels (2 teasers par an, lissés) | 2 à 4 $ |
| Jetons | 9 à 14 $ |
| Veille standard | 12 à 20 $ |
| Hébergement, mesure, WhatsApp | 15 à 22 $ |
| Part du socle partagé | 20 à 40 $ |
| **Total hors humain** | **62 à 109 $** |
| Gestionnaire 5 heures à Abidjan (35 000 FCFA) | 57 $ |
| **Total avec humain** | **120 à 166 $** |

Présence à 300 000 FCFA (environ 492 $) : marge 66 à 76 % ; au Canada à 900 CAD (environ 635 $) avec 5 heures canadiennes (141 à 176 $) : coût 203 à 285 $, marge 55 à 68 %. Pour 2IAE, client interne : moins de 170 $ par mois pour une présence quotidienne mesurée jusqu'aux dossiers d'admission.

Récapitulatif, identique à la section 1 : église 85 à 135 $, beauté Vidéo+ 190 à 320 $ à Abidjan et 330 à 455 $ au Canada, école 120 à 166 $. L'humain reste le premier poste, la vidéo générative le seul qui dérape (R08 §6.3), l'hébergement moins de 2 % (R25 §11.18).

### 12.2 Tarifs par marché et facturation

Grille de la section 1 (C4) : Chaire à 2 à 4 fois Sermonshots et 5 à 10 fois sous Church Media Squad (R05 §8.18) ; Présence au bas des fourchettes d'Abidjan (300 000 à 900 000 FCFA), de Montréal (500 à 3 500 CAD) et de France (500 à 1 500 €) (R10 §7.1, R08 §10.4) ; Vidéo+ sous les packs vidéo locaux avec plus de vidéos ; Logiciel seul au-dessus du plafond SaaS de la validation seule (15 à 50 $, R08 §5) ; boîte de réception contre ManyChat Pro 29 à 39 $ par compte (R23 §8.1). Facturation : Stripe au Canada (2,9 % plus 0,30 CAD, Billing 0,7 %), Wave Business ou CinetPay à Abidjan (1 à 2 %, lien de paiement WhatsApp, relance 3 jours avant l'échéance, suspension douce après 30 jours, R10 §8.11) ; surcoût par prise au-delà du plafond ; préavis de 30 jours (R08 §8.1). Les fourchettes d'Abidjan reposent sur une grille d'agence non datée (R10 §9.8) : trois devis réels par marché avant de figer (question 2).

### 12.3 Marge et structure à 8 puis 20 clients

Phase 1, 8 clients (3 églises, 2 beauté Vidéo+ dont 1 au Canada, 1 association Présence au Canada, 2IAE et SEVARTA en interne) : chiffre d'affaires externe 3 500 à 4 000 $ par mois ; variables 800 à 1 300 $ ; socle 150 à 300 $ ; hébergement 90 à 130 $ ; un gestionnaire à Abidjan 350 000 FCFA (574 $) ; marge d'exploitation 45 à 60 % avant le temps de José. Phase 2, 20 clients : 10 000 à 13 000 $ ; variables 2 200 à 3 500 $ ; socle 200 à 350 $ (Remotion Automators 100 $ au-delà de trois personnes, Upload-Post Advanced 147 $ puis apps propres) ; hébergement 230 à 310 $ ; deux gestionnaires 2 000 à 2 500 $ ; marge 55 à 65 %.

### 12.4 Ce que la machine remplace, pour 10 clients

Hootsuite Professional à trois sièges 597 $ (R26 §5.18), Planable Pro 490 $, Linktree Pro 150 $, AgencyAnalytics 200 $, ManyChat Pro 290 à 390 $, Sermonshots pour cinq églises 265 à 485 $ : 2 000 à 2 400 $ par mois d'abonnements pour une couverture partielle, sans veille locale, sans planche WhatsApp, sans vidéo réelle en français, sans couche affaires, contre 300 à 450 $ de socle et d'hébergement et 10 à 14 $ de jetons par client (C4).

### 12.5 Seuil de rentabilité

Coûts fixes de phase 1 : socle 150 à 300 $, hébergement et sauvegarde 90 à 130 $, gestionnaire 574 $ : 815 à 1 005 $. Contribution par client (prix moins coûts variables, hors socle, hébergement et gestionnaire) : Chaire Abidjan environ 260 $, Chaire Canada 290 $, Présence Abidjan 450 $, Présence Canada 590 $, Vidéo+ Abidjan 750 $, Vidéo+ Canada 1 100 $. Avec une contribution moyenne de 400 à 500 $, **trois clients payants couvrent les fixes, gestionnaire compris** ; **six clients dégagent en plus 1 500 $ par mois pour José** ; au-delà de douze clients par gestionnaire, un second s'ajoute (574 à 2 000 $ selon le pays). Trois pilotes à 50 % rapportent 400 à 600 $ et ne couvrent pas les fixes : la phase 4 doit convertir au plein tarif.

---
## 13. Risques, limites et garde-fous

### 13.1 Juridiques

| Risque | Parade |
|---|---|
| Droits sur les sorties IA : une image brute n'a probablement pas d'auteur au Canada, en France ni dans l'OAPI (R08 §1.5) | `licence_registry` par média, preuve de l'apport humain, licence d'usage commercial cédée sans exclusivité sur les éléments bruts, contrat type en trois versions relu par un avocat de chaque pays (R08 §10.16) |
| Palier gratuit d'un moteur (Suno Free, ElevenLabs Free non commerciaux ; Google gratuit et Higgsfield hors Enterprise entraînent, R08 §10.9) | un compte payant par moteur au nom de l'agence, plan vérifié avant export |
| Étiquetage IA : AI Act article 50 depuis le 2 août 2026, TikTok depuis le 24 septembre 2026, Meta et YouTube par auto-déclaration (R08 §10.10) | `ai_label` par variante, drapeau natif, mention en légende pour l'UE, C2PA conservé, 20 % du mix humain, taux d'étiquetage affiché |
| Droit à l'image, mineurs, fidèles (R08 §7.4, R09 §11.9) | registre de consentements relié à chaque média, blocage sans consentement, floutage du public, aucun enfant sans autorisation parentale |
| Allégations cosmétiques (Santé Canada, règlement 655/2013, Meta du 23 juillet 2026, R26 §2.8) | lexique par pays, contrôle avant la planche, exclusion de l'éclaircissement, refus sans manquement contractuel |
| Anti-pourriel : CASL jusqu'à 10 M$ par violation, politique WhatsApp du 23 septembre 2026 (R08 §7.9) | opt-in en deux cases, journal de preuve, STOP, modèles approuvés, deux rappels, aucune prospection |
| Données personnelles : LPRPDE, Loi 25 (10 M$ ou 2 % en administratif, 25 M$ ou 4 % au pénal, R26 §2.9), RGPD, loi ivoirienne 2013-450 | sous-traitants et région documentés, évaluation avant transfert hors Québec, déclaration ARTCI à vérifier (R25 §11.16), José responsable de la protection, hachage, offboarding outillé |
| Conditions des plateformes et des moteurs : YouTube interdit le téléchargement, LinkedIn l'automatisation de profil, TikTok l'engagement artificiel (R08 §7.8), Higgsfield l'automatisation de l'Unlimited (R26 §2.4) | fichier fourni par l'église, API officielles, posts du fondateur publiés par José, API Higgsfield à l'acte sur compte agence, aucune dépendance au compte Unlimited |
| Scraping du Creative Center par Apify (R06 §3.3) | isolé des comptes clients, clause au contrat, bascule configurable |

### 13.2 Techniques

| Risque | Parade |
|---|---|
| Dépréciations trimestrielles (gpt-image-1 le 23 octobre 2026, gpt-image-1.5 le 1er décembre, Sora 2, 40 métriques Facebook le 15 juin 2026, LinkedIn 202510 le 15 octobre 2026) | moteurs et connecteurs abstraits avec repli, versions en configuration, `metric_alias`, tests hebdomadaires, diff trimestriel (R26 §5.19) |
| Dépendance à l'API unifiée (R02 §8.1) | `MetaDirectConnector` dès le jour 1, demandes officielles dès la semaine 0, paquet manuel, Blotato en second fournisseur |
| Pannes silencieuses : jeton Instagram à 60 jours, PubSubHubbub, Railway sans cycle de vie, cron qui saute un run (R21 §9.13) | H9, `a_reconnecter`, job de rétention, tick sous une minute, limite de dépense dure |
| Plafonds : Instagram 50 ou 100, Facebook Reels 30, TikTok 6 par minute et 5 utilisateurs avant audit, YouTube 100 uploads par jour | compteurs locaux, file avec reprise, `content_publishing_limit`, second projet Google au-delà de 30 clients vidéo |
| Routines en aperçu sans idempotence (R07 §10.4), Cowork sans API d'entrée | journal des tirs, clé `client:semaine`, rien de critique n'en dépend |
| Worker qui boucle, dérive de génération | `cost_ledger` et `tenant_budget` avant chaque appel, 3 prises, limite dure Railway, plafond OpenAI |
| Buckets sans versionnage ni verrou | rétention vérifiée, originaux et dumps dans le second projet, PITR, restauration trimestrielle |
| Filtres de contenu des moteurs vidéo (Veo refuse les enfants en I2V, R04 §2.2) | bancs par verticale avant de signer, bascule automatique, humain réel là où l'émotion porte le message |
| Latence Abidjan vers Amsterdam non mesurée (R25 §10.2) | mesure en phase 0, pages légères |

### 13.3 Qualité (slop)

56 % des utilisateurs voient du « AI slop » souvent, 50 % de la génération Z ont bloqué une marque pour cela, YouTube ne monétise plus le « gabarit » depuis juillet 2026 (R11 §1). Parades : juge à sept critères avec test de substitution, ancrage réel obligatoire, interdits lexicaux français par statistique révisés chaque trimestre, introduction originale par clip, calibration mensuelle, second juge d'une autre famille, QC vision, 20 % de contenus humains, réserve composée de contenus validés par le client et renouvelée chaque mois pour ne pas devenir générique, indicateurs « à la page » publiés. Limite honnête : Claude ne détecte pas les images synthétiques et ne nomme pas les personnes (R07 §11.14) ; « ça a l'air IA » n'est pas supporté (R11 §15.5).

### 13.4 Opérationnels

| Risque | Parade |
|---|---|
| José construit seul 90 jours et tient les portes pendant le premier pilote | périmètre strict par phase, achat de tout ce qui est résolu, API directe plutôt qu'agents, pas de portail client complet avant mesure (R21 §9.11), recrutement décidé en phase 2 |
| Client silencieux | deux rappels, humain, réserve validée, alerte risque de départ, revue de 20 minutes |
| Gestionnaire débordé | 8 à 12 clients, neuf files, une action par ligne, temps mesuré |
| Promesse excessive (« boutique Facebook avec paiement », Shops absents de Côte d'Ivoire, R23 §8.19) | la plateforme dit ce qu'elle livre et ce qu'elle ne livre pas |
| Fêtes lunaires et événements annulés | fenêtres, confirmation la veille, revérification 48 heures avant |
| Forfaits data limités (1,5 Go par jour, R10 §1) | profil « Afrique mobile », audio seul pour les sermons, planche sous 5 Mo |
| Confusion avec le campus 2IAE | projet Railway séparé, lecture seule des données publiques, aucune action sur `campus` |
| Suspension du compte Higgsfield personnel de José | aucune conséquence pour les clients : API à l'acte sur un compte au nom de l'agence |

---
## 14. Feuille de route

### 14.1 Acheté ou construit

| Brique | Décision | Justification |
|---|---|---|
| Publication multi-plateformes | acheter (Upload-Post Pro ; Blotato pour TikTok si nécessaire) puis construire les connecteurs officiels ; `MetaDirectConnector` dès le jour 1 | problème résolu et réglementé, délais incompressibles (R02 §12.1) |
| Transcription | acheter (AssemblyAI 0,21 $ par heure ; Scribe v2 en second) | WhisperX n'a de sens qu'au-delà de 200 heures par mois (R05 §8.19) |
| Images, détourage, vidéo générative | acheter (OpenAI via Responses API, fal, Photoroom, API Higgsfield ; Gemini en phase 3) | API officielles, asynchrones, abstraites (R04 §8.2) |
| Vidéo programmée, découpe de sermons, composition | construire (Remotion, ffmpeg, libass, React et Playwright) | centimes par rendu, différenciation française (R05 §8.1) |
| Veille, calendrier, voie rapide | construire sur flux gratuits plus SerpApi, Apify, Tavily | personne ne couvre Abidjan en français (R01 §8.4) |
| Planche, validation WhatsApp, lien magique, accusés de réception | construire (Cloud API directe) | objet central sans équivalent (R08 §10.2) |
| Cerveau de marque, juge, QC vision, bancs | construire (API Messages) | avantage défendable (R01 §8.8) |
| Boîte de réception, lien en bio, QR, rapport | construire (API Meta gratuites, Postgres) | remplace ManyChat, Linktree, AgencyAnalytics (R23 §8.1, R24 §8) |
| Extraction de dépôts | acheter (Claude vision et JSON Schema ; Mistral OCR 4 pour les PDF longs, 2 $ pour 1 000 pages en batch) | R21 §9.1 |
| Orchestration, observabilité | pg-boss ; tables maison puis Langfuse Hobby | aucun composant de plus (R07 §8.3) |
| Clips bruts pendant la construction | louer (API Vizard 14,50 $ par mois) | filet et comparateur (R05 §8.2) |

### 14.2 Phases, critères de sortie, premier pilote

**Phase 0 (2 semaines, du 5 au 18 octobre 2026) : fondations, demandes d'accès, bancs.** Skill `/db` sur le schéma 11.2 avec le Railway CLI jusqu'au feu vert ; projets « machine » et « machine-sauvegarde », buckets, PITR, limite de dépense ; mesure de latence Abidjan vers Amsterdam ; WhatsApp Business Platform sous le portefeuille Markel-Tech, entreprise vérifiée, SIM +225 et numéro +1, sept modèles ; demandes Meta, Google, TikTok, LinkedIn déposées avec captures datées ; comptes payants par moteur, projet OpenAI avec plafond dur, clé API Higgsfield, AssemblyAI, Upload-Post Free, Vizard ; retrait de gpt-image-1 et 1.5 avant le 23 octobre (R26 §5.6) ; bancs (30 phrases, 5 sermons, prompts par verticale, 20 générations par qualité) ; contrat type chez les avocats. Sortie : schéma validé, premier message utilitaire reçu, dossiers déposés avec numéros de suivi, coûts unitaires inscrits dans `engine_registry`.

**Phase 1 (6 semaines, du 19 octobre au 29 novembre 2026) : socle et Chaire.** Monorepo, quatre services, RLS, bucket, sauvegardes, tick, pg-boss, enveloppe, `cost_ledger` et `tenant_budget` ; onboarding en 60 minutes (brand kit, 50 posts, fiche de voix) ; ingestion WhatsApp avec accusé de réception et vocaux ; pipeline sermon complet avec introduction de 2 s, dérivés, chapitres, profils d'export ; citations HTML et posts ; juge et vision ; planche PWA, composite, `planche_prete`, lien magique, rappels, réserve ; portes 1 et 3 avec les neuf files ; `UnifiedConnector` et `MetaDirectConnector` ; paquet manuel ; collecte nocturne ; rapport minimal. Pilotes : une église d'Abidjan avec régie à 50 % contre données et témoignage ; SEVARTA et la page 2IAE en interne. Sortie (R05 §8.20, C5) : un sermon déposé le dimanche donne une planche le lundi midi et cinq clips du mardi au samedi sans intervention de José hors validation ; WER sur 5 sermons contre un second moteur ; acceptation du pasteur supérieure à 70 % sur quatre semaines ; 100 % des sermons réemployés sous 7 jours ; coût réel sous 3 $ ; dépôt vers planche sous 24 heures ; batterie RLS verte ; restauration testée ; zéro jeton en clair dans les journaux.

**Phase 2 (8 semaines, du 30 novembre 2026 au 24 janvier 2027) : Dépôt, Présence, veille, mesure affaires.** Dépôt de produits (INCI vérifié, détourage, boîte photo LED à 18 000 FCFA prêtée, R21 §9.17), photo produit, Reels génératifs par API Higgsfield avec plafond, carrousels, séquence de lancement, profil de conformité beauté ; cerveau de marque et juge calibré sur 100 posts par verticale ; veille flux A, B, D et calendrier (Noël, Saint-Valentin, Mois de l'histoire des Noirs, fêtes lunaires 2027 saisies à la main) ; voie rapide et chronomètre ; liens traçables, lien en bio, QR, coupons, `conversion_event`, premier rapport ; Flow générique ; MediaPipe ; conteneur `agent` ; Langfuse Hobby ; message du lundi à José. Pilotes : une marque de beauté d'Abidjan dès la troisième semaine, une seconde église, 2IAE pour la réorientation de janvier. Sortie : juge supérieur à 70 % au premier coup ; planches acceptées à plus de 70 % ; dépôt vers planche sous 24 heures ; dépôts incomplets sous 20 % ; corrections sur fiches sous 10 % (R21 §9.18) ; tendance vers publication sous 72 heures ; génération beauté sous 120 $ ; 100 % des médias photoréalistes étiquetés ; rapport avec couche affaires non vide ; décision sur le recrutement du gestionnaire.

**Phase 3 (4 semaines, du 25 janvier au 21 février 2027) : interopérabilité, pilotage, Canada.** Serveur MCP avec OAuth 2.1 et dix outils, testé depuis Cowork et Claude Code ; Routines « revue hebdomadaire » et « incident » ; Web Push ; boîte de réception dès l'Advanced Access ; règle de boost ; veille flux C ; Veo 3.1 Fast en second adaptateur ; sorties Metricool et Blotato MCP ; tests hebdomadaires ; premier client canadien (Stripe, numéro +1, créneaux de l'Est) : une association de la diaspora à Toronto pour le Mois de l'histoire des Noirs ; migration des pages de l'agence vers le connecteur direct. Sortie : six locataires dont quatre payants ; José exécute une revue hebdomadaire depuis Cowork par le MCP ; test hebdomadaire vert quatre semaines de suite ; délai de réponse aux commentaires affiché ; facture Railway sous 150 $.

**Phase 4 (mars à juin 2027) : preuve à 90 jours et échelle.** Revue à 90 jours de chaque pilote (avant et après sur les quatre indicateurs, le chronomètre, la couche affaires), témoignages, prix figés sur devis réels, plein tarif, gestionnaire en poste, apps propres dès obtention des accès, médianes locales, bandit par verticale, boost supervisé et Thought Leader Ads, Canva Autofill et avatars sur demande, Managed Agents en option (R07 §11.18), Chaire vendu à cinq églises de plus. Sortie : huit clients payants, marge brute mesurée supérieure à 50 %, aucun client perdu pour « pas à la page ».

**Premier client pilote** : une église d'Abidjan dont le pasteur a déjà une audience vidéo et une régie (R09 §11.7) : coût direct sous 10 $ par sermon, chaîne 85 % automatisable, aucune étiquette IA, preuve visible en deux dimanches ; critères du pilote de quatre semaines (R05 §8.20) : WER, acceptation des propositions, rétention à 3 secondes, portée hors assemblée.

---
## 15. Questions ouvertes pour José

1. **Règle « sans réponse » par défaut.** Après deux rappels et l'appel du gestionnaire : publier la réserve que vous avez validée le mois précédent, ou ne rien publier ? Les deux sont défendables au contrat (R08 §8.1.2) ; le défaut doit être le vôtre.
2. **Prix et taux de change.** Les fourchettes d'Abidjan viennent d'une grille non datée (R10 §9.8) : trois devis réels à Abidjan et trois en Ontario avant de figer, et quel taux de référence retenir pour les devis ?
3. **Gestionnaire : qui, où, quand.** Recruter à Abidjan (250 000 à 350 000 FCFA) avant le premier client payant, ou tenir vous-même les portes pendant les pilotes et n'être que l'escalade ensuite ?
4. **Effectif et licence Remotion.** Gratuite jusqu'à trois personnes, sinon Automators 100 $ par mois ; faut-il demander si « vendre des rendus à des clients » relève d'Automators (R04 §4, R25 §10.6) ?
5. **Sermons : original 1080p (3 Go, 2,40 $ par mois par église au bout d'un an) ou proxy 720p plus audio (1 Go)** (R25 §11.5) ?
6. **Clé Claude et abonnement Max.** Cowork, Chrome et Routines restent-ils vos outils personnels non facturés, ou faut-il un abonnement Team (R07 §11.17) ? La bascule « nuage uniquement » du 6 octobre 2026 est-elle effective dans votre application (R07 §10.1) ?
7. **TikTok avant audit.** Blotato Starter dès la phase 1, ou attendre l'audit et publier en paquet manuel (R26 §5.14) ?
8. **Higgsfield et entraînement.** Contrat Enterprise si le volume le justifie, ou exclusion des visages (R26 §5.12) ?
9. **Votre atelier personnel.** Cette conception ne dépend d'aucun rendu produit sur l'Unlimited piloté par Claude in Chrome, parce que R26 §2.4 décrit ce pilotage comme interdit et sanctionnable. Ce que vous faites de votre compte pour vos clips SEVARTA est une décision personnelle que la recherche ne peut pas prendre à votre place.
10. **Plafonds de génération au contrat** : 60 $ pour une église et 120 $ pour la beauté (R25 §7.2) conviennent-ils, et le surcoût par prise est-il facturé ou absorbé ?
11. **Voix clonées.** Acceptez-vous d'enregistrer 30 minutes pour « Markel-Tech » et « SEVARTA », et quelles fondatrices ou quels pasteurs consentiraient (R04 §8.11) ?
12. **Avocats de référence** en Ontario, en France et à Abidjan pour le contrat type, l'évaluation hors Québec et la déclaration ARTCI (R25 §11.16) ?
13. **2IAE et le site.** Consigne à la session du site pour les trois événements GA4 (R24 §10.17), et lecture d'autres données publiques du campus ?
14. **Marque et nom.** « Chaire » et « Dépôt » sont des noms de travail ; marque distincte de Markel-Tech pour vendre à d'autres agences, ou offre de service Markel-Tech ?

---
## 16. Points faibles qui restent, honnêtement

1. **Un seul constructeur pendant 90 jours, aussi premier gestionnaire.** La feuille de route est plus prudente que C5, mais la phase 2 reste chargée ; si elle glisse, c'est la beauté qui attend.
2. **Le gestionnaire n'existe pas encore.** Toute l'économie suppose 4 à 6 heures par client à 250 000 à 350 000 FCFA par mois (R08 §6.3, estimation) ; recrutement, formation aux neuf files et qualité de relecture sont le risque humain le plus lourd.
3. **Les prix d'Abidjan sont des estimations** (grille non datée, aucune enquête indépendante, R10 §9.8) : la grille peut bouger de 20 % après trois devis.
4. **Neuf à douze mois de dépendance à une API unifiée** pour les clients où l'agence n'a pas de rôle Meta ; une perte d'app chez Upload-Post renvoie au paquet manuel jusqu'aux revues officielles (jusqu'à 20 jours par cycle, R02 §2.1).
5. **Deux hypothèses de coût non confirmées sur page officielle** : la franchise de 1 000 messages de service WhatsApp (R22 §3.6 contre R10 §9.3) et le prix de gpt-4o-mini ; montants faibles, incertitude réelle.
6. **Le juge coûte du temps humain avant de servir** : 100 posts par verticale, 40 contre-exemples, 50 cas d'évaluation (R11 §15.4, R07 §11.20), environ une journée par verticale au lancement puis une heure par mois.
7. **Le banc de cinq sermons exige des transcriptions de référence humaines** que personne n'a encore produites.
8. **La réserve peut devenir générique** si le client valide sans lire ; le renouvellement mensuel et le juge limitent le risque sans le supprimer.
9. **Les Routines sont en aperçu, sans idempotence** (R07 §10.4), et la promesse « José pilote depuis Cowork » tient à des surfaces qu'Anthropic peut changer, comme la bascule du 6 octobre 2026.
10. **Le chronomètre vaut ce que vaut `detected_at`** : une source lente fausse l'indicateur, et la machine se mesure elle-même ; les médianes locales n'existeront qu'après trois mois, et les benchmarks ne couvrent ni la Côte d'Ivoire ni le Canada francophone (R24 §10.13).
11. **Claude ne détecte pas les images synthétiques et ne nomme pas les personnes** (R07 §11.14) : le consentement d'un visage repose sur le registre tenu par le gestionnaire, pas sur le QC vision.
12. **La clause d'entraînement de Higgsfield (section 4.4)** gêne commercialement une fondatrice qui voudrait son visage dans un Reel ; seule réponse : Enterprise ou exclusion.
13. **Instagram publie deux plafonds (50 et 100, R26 §3)** ; se caler sur 50 peut freiner un client à cinq comptes. **Blotato plafonne à 20 comptes** (R26 §2.10) et n'est qu'un pont TikTok.
14. **Vidéo+ promet douze Reels dont six génératifs** ; une cliente qui en exige douze génératifs atteint le plafond de 120 $ et la marge d'Abidjan descend vers 55 %.
15. **La latence Abidjan vers Amsterdam n'a pas été mesurée** (R25 §10.2), et le téléversement d'un sermon de 3 Go reste le point lent de Chaire, d'où Daily et l'audio seul.
16. **Markel-Tech sur LinkedIn ne sera jamais entièrement automatique** (automatisation de profil interdite, R08 §7.8) : José reste dans la boucle de sa propre verticale.
17. **La règle Railway est tenue au prix d'un second projet à administrer et d'un job de rétention maison** : une erreur dans ce job est une perte définitive, d'où la restauration trimestrielle.
18. **Le document ne tranche pas l'atelier personnel de José sur Higgsfield Unlimited**, parce qu'il ne le peut pas ; il garantit seulement que les clients n'en dépendent pas.
