# C4. Différenciation et économie : la machine qui prouve qu'elle est à la page et qui gagne de l'argent

Conception complète de la plateforme social media multi-clients de José Kouadio (Markel-Tech, SEVARTA, 2IAE). Rédigée le 2 octobre 2026 à partir des dix-sept rapports de recherche R01 à R26. Angle de ce concepteur : être réellement au-dessus du marché et rentable. Chaque chiffre renvoie au rapport qui le porte ; en cas de contradiction entre rapports, R26 prévaut. Aucune fonctionnalité n'est supposée : si une API n'existe pas selon les rapports, elle n'est pas dans la conception.

---

## 1. Thèse en une page

### La phrase de positionnement

« Votre gestionnaire regarde ce qui se passe chez vous et autour de vous, vous propose la semaine en images, attend votre oui sur WhatsApp, produit et publie de vraies vidéos en français, et vous montre chaque mois ce que cela a rapporté. »

L'IA est l'atelier, pas l'enseigne (R08 §10.1 : 30 % des agences voient leur valeur perçue baisser quand le client croit que « l'IA réduit les coûts » ; près d'un tiers des consommateurs se méfient des publicités IA). On vend un service humain outillé, mesuré en revenu, et non un logiciel.

### Pourquoi cette phrase n'a pas de concurrent au 2 octobre 2026

R01 §6 le montre ligne par ligne : la colonne « veille » et la colonne « vidéo IA réelle » ne sont jamais vertes sur la même ligne du tableau du marché ; le portail client n'existe que chez Planable (49 $ par espace), ContentStudio et Vista Social Scale (449 $), trois outils sans production vidéo ; aucun outil ne relie la mesure au chiffre d'affaires du client ; aucun outil ne parle français d'Abidjan ni ne traite « l'église francophone avec un sermon YouTube de deux heures ». Hootsuite (99, 199, 399 $ par siège, R26 §2.5) a le signal mais pas la vidéo ; Predis (55 $) a la vidéo de gabarit mais ni signal ni validation ; Planable a la validation sans production ; n8n a la production sans porte humaine ; Sermon Shots (40 à 97 $) découpe en anglais sans animation ni publication.

### Les cinq choix qui rendent la machine supérieure au marché

1. **La doctrine comme contrat exécutable, pas comme « ton de marque ».** Règle des deux plateformes, piliers 60/25/15, frameworks PAS, AIDA, BAB, FAB, 3 à 5 hashtags (plafond dur Instagram de 5, R26 §2.6), mesure en trois couches : tout est encodé en contraintes vérifiées par un juge à sept critères (R11 §8.2, seuil 15/21). La machine refuse une semaine à plus de 15 % de promotion et un post sans fait vérifiable. Jasper, Blaze et Predis n'ont qu'un ton ; c'est une barrière d'entrée que le marché ne peut pas copier en changeant un prompt.

2. **La planche hebdomadaire validée en un tap sur WhatsApp, unité de travail et de facturation.** Une image composite 1080×1350 avec 6 à 10 propositions (maquette en qualité basse à moins de 0,01 $ pièce, R03 §9), envoyée en modèle utilitaire à 0,004 $ en Côte d'Ivoire et 0,0034 $ au Canada (R22 §3.5), trois boutons, Flow natif pour le détail. Aucun outil du marché n'a cet objet (R08 §4.1). La validation avant génération divise par cinq à dix le coût de ce qui n'est pas validé (R04 §8.3).

3. **Deux pipelines verticaux que personne ne vend en français : « Chaire » (sermon YouTube vers 20 contenus) et « Dépôt » (produits de beauté vers une semaine de calendrier).** Coût marchand sous 2,50 $ par sermon (R05 §4) contre 5 à 8 $ chez Pulpit AI et 53 à 97 $ par mois chez Sermonshots, sans français ni validation. Chaire est vendable seul et finance l'acquisition des églises, verticale la plus favorable en engagement (R09 §5).

4. **La mesure reliée au revenu, en haut du rapport, dès le premier mois.** Lien en bio maison, QR dynamiques, coupons dictables, `ctwa_clid` et Conversions API « business_messaging » pour WhatsApp (R24 §2). La question client numéro un en 2026 est « reliez la performance au revenu » (55 % des 494 agences interrogées par AgencyAnalytics, R08 §3.1) et 10 % des départs sont déjà dus au flou d'attribution. Après trois mois, la machine devient sa propre source de benchmarks par verticale et par pays, chose qu'aucun fournisseur ne publie pour la Côte d'Ivoire ni le Canada francophone (R24 §6).

5. **Acheter la plomberie, construire la différence.** Publication par API unifiée dès le premier jour (Upload-Post Pro 50 $ pour 25 profils ou Zernio à l'usage, R02 §8.1) pendant que les revues Meta, TikTok, YouTube et LinkedIn courent en parallèle ; serveur MCP exposé pour que Claude Cowork, Claude Code et les Routines agissent sur la plateforme (R07 §2.5) ; sorties de secours vers Metricool (MCP inclus même en plan gratuit) et Blotato (MCP sur tout plan payant, R26 §2.10). Chaque dollar de développement va à la veille locale, à la planche, au juge, aux pipelines et à la mesure.

### Prix de vente visé et coût par client

Tarification par client et par mois, tout compris, trois paliers plus un palier logiciel (R08 §6.2 et §10.4, R10 §7.1) :

| Palier | Abidjan (FCFA) | Canada (CAD) | France (EUR) | Contenu |
|---|---|---|---|---|
| Chaire (église, un sermon par semaine) | 175 000 | 450 | 350 | 5 clips, 10 citations, dévotionnel, chapitrage, publication, rapport |
| Présence | 300 000 | 900 | 700 | 12 visuels, 4 vidéos courtes, 2 plateformes, planche hebdomadaire, rapport |
| Vidéo+ | 550 000 | 1 800 | 1 400 | 12 Reels, 8 carrousels, 4 UGC, boîte de réception, boost supervisé |
| Logiciel seul | 60 000 | 150 | 110 | veille, planche, production, publication ; le client a son propre community manager |

Coût direct par client, humain compris, entre 95 et 190 $ US pour une église, entre 200 et 330 $ pour une marque de beauté en Vidéo+, entre 140 et 230 $ pour une école (section 12). Marge brute visée : plus de 60 % au Canada, plus de 50 % à Abidjan avec un gestionnaire local. Seuil de rentabilité : six clients payants en mélange Abidjan et Canada (section 12.5).

---

## 2. Les personnes

### José, propriétaire et architecte

Ce qu'il voit chaque semaine : un seul écran « santé de l'agence » (clients, planches en attente, risques de départ, coût de génération contre plafond, indicateurs « à la page » agrégés). Ce qu'il fait : il arbitre les escalades (trois refus du juge, client silencieux à J+5, dépassement de budget), il relit les posts LinkedIn de Markel-Tech que la machine lui propose (la voix du fondateur reste humaine, R09 §8), il tient l'atelier Higgsfield Unlimited sur son poste pour les clips musicaux SEVARTA (hors chemin critique, R26 §5.10), et il lance les revues à 90 jours. Temps cible : moins de deux heures par semaine pour l'exploitation. Il reçoit ses alertes WhatsApp depuis le numéro machine (R22 §10.2).

### Le gestionnaire humain

Un gestionnaire pour huit à douze clients, à Abidjan (250 000 à 350 000 FCFA par mois, R08 §6.3) ou au Canada (40 à 50 CAD de l'heure). Ce qu'il voit : la file « à relire avant envoi » (porte 1), la file « validé, à contrôler avant publication » (porte 3), la boîte de réception des commentaires et messages classés par Haiku 4.5 (R23 §8.4), la file « publier à la main » (paquets prêts à publier, R02 §10.5), la file « commentaires TikTok à traiter dans l'app ». Ce qu'il fait : cinq minutes par planche pour corriger, un clic par post pour approuver, un vocal ou un message par client pour entretenir la relation, la revue mensuelle lue avec le client. Budget de temps : 4 à 6 heures par client et par mois (R08 §6.3). Chaque correction qu'il fait est enregistrée comme paire (brouillon, correction, motif) et réinjectée dans la mémoire du client (R11 §10).

### Le client, par verticale

| Verticale | Qui valide | Ce qu'il voit chaque semaine | Ce qu'il fait | Ce qu'il doit fournir lui-même |
|---|---|---|---|---|
| Beauté (fondatrice, Abidjan ou Toronto) | la fondatrice | planche WhatsApp le lundi, « vos nouveautés sont en ligne » le jeudi, résumé de ventes attribuées le premier lundi du mois | un tap, parfois un vocal ; dépose ses nouveaux produits en deux photos (face et INCI, R21 §9.4) | GRWM, tutoriels face caméra, coulisses (R09 §3.4) |
| Association culturelle | le président ou le chargé de communication | planche de la séquence événement (teaser J-21, genèse J-14, programme J-7, rappel J-1, récap J+2) | valide la séquence entière, dépose le flyer (OCR automatique, R21 §2.1), envoie les plans tournés pendant l'événement | portraits, directs, prises de vue |
| Église (pasteur ou responsable communication) | le pasteur ou son délégué | le lundi midi, 8 vignettes de clips du sermon de dimanche avec verset, durée, plateforme (R05 §8.9) | valide chaque extrait (validation doctrinale obligatoire, R09 §5.7) | message face caméra de la semaine, témoignages avec consentement |
| SEVARTA (José et l'auteur) | José, l'auteur pour ses extraits | séquence de sortie en six semaines, citations animées, carrousels d'idées | valide ; l'auteur lit ses extraits | lecture d'extrait, interview |
| 2IAE (direction, service admissions) | la direction | compte à rebours admissions, carrousels métiers, récaps d'événements sous 48 h | valide ; fournit le registre des autorisations d'image | étudiants ambassadeurs, enseignants (la plateforme lit seulement les données publiques du campus, R05 §8.17) |
| Markel-Tech (José) | José | trois angles de posts fondateur tirés de la semaine, un document natif, un sondage | écrit ou valide ; accorde les études de cas avec le client concerné | posts texte, vidéos face caméra |

---

## 3. La routine : le cycle complet par client comme machine à états

### Les trois horloges

La routine ne tourne pas sur une seule horloge (R06 §16.14) : une horloge **tendances** (cycle de 2 heures, durée de vie 48 heures, newsjacking sous 4 heures), une horloge **hebdomadaire** (planche le lundi, production du mercredi au vendredi, publication étalée), une horloge **calendrier** (événements et fêtes à 6 à 8 semaines, revérification 48 heures avant). Les trois alimentent le même objet, la planche, et les mêmes portes humaines.

### Les états d'un contenu

Un `content_item` traverse les états suivants, en base Postgres, jamais dans un agent qui attend (R07 §5 : zéro jeton pendant l'attente, reprise garantie après redéploiement) :

`signal_detecte` → `idee` → `brouillon` → `juge_ok` (ou `juge_refuse`, deux révisions puis escalade) → `planche_prete` (porte 1, gestionnaire) → `planche_envoyee` → `valide_client` / `a_revoir` / `refuse_client` / `sans_reponse` → `en_production` → `rendu_ok` (contrôle qualité vision, R03 §10) → `a_controler` (porte 3, gestionnaire) → `programme` → `publie` (ou `publie_manuel` via paquet) → `mesure_j1`, `mesure_j7`, `mesure_j30` → `appris` (réinjection dans la mémoire du client).

### Le cycle hebdomadaire par défaut (heure du client, R10 §8.7)

| Moment | Événement | Acteur | Délai par défaut |
|---|---|---|---|
| Dimanche soir | clôture de la veille de la semaine, scoring, calendrier de la semaine suivante par Claude Opus 5.5 (0,32 $ par calendrier, R07 §7) en Batch nocturne | machine | avant lundi 6 h |
| Lundi 7 h | planche composée (6 à 10 propositions, maquettes basse qualité, faits sourcés, ligne « faits à confirmer », R11 §15.15) | machine, juge | 6 h à 7 h |
| Lundi 8 h | porte 1 : le gestionnaire relit, corrige, approuve | gestionnaire | 2 heures maximum, sinon alerte à José |
| Lundi 10 h | envoi WhatsApp (modèle utilitaire `planche_prete`) et courriel Resend avec lien signé | machine | immédiat |
| Mercredi 10 h | rappel 1 si aucune réponse (modèle `rappel_planche`) | machine | J+2 |
| Vendredi 10 h | rappel 2, puis bascule vers le gestionnaire (appel ou vocal) | machine, gestionnaire | J+4 |
| Lundi suivant | règle « sans réponse » : publication des seuls contenus **valeur** et **relation** déjà validés dans le cadre contractuel, rétention des contenus **promotion** (ou l'inverse, case cochée à l'onboarding, R08 §8.1.2) | machine | J+7 |
| Dès validation | production : images finales, vidéos (3 prises par plan, plafond), rendus Remotion, contrôle qualité, porte 3 | machine, gestionnaire | 24 à 48 heures |
| Mardi à jeudi, 11 h à 18 h locale | publication étalée (jamais le dimanche sauf directs d'église, R09 §11.5) | machine | selon calendrier |
| J+1, J+3, J+7, J+30 | relevés de métriques en ajout seul (R24 §3.6) | machine | automatique |
| 3 du mois | clôture des données, rapport le premier lundi après le 3 (R24 §10.8) | machine, gestionnaire | avant 9 h |

### Ce qui se passe quand le client ne répond pas

Deux rappels maximum (J+2, J+5 au plus tard), jamais plus : au-delà, les relances dégradent la note de qualité WhatsApp et tombent sous la politique « fréquence » du 23 septembre 2026 (R22 §10.10). Après le second rappel, le gestionnaire prend le relais par un appel. Si le silence dure deux semaines, la machine marque le client « risque de départ » (R08 §10.18) et José reçoit une alerte. Un client silencieux ne coûte rien en génération : la production ne démarre qu'après validation.

### Les trois portes humaines, et ce qui passe sans porte

Porte 1 (planche avant envoi), porte 2 (validation client), porte 3 (contrôle de la vidéo finale) (R01 §8.9). Publication automatique sans porte 3 seulement pour les contenus validés sur planche, sans drapeau « personne réelle », « promotion » ou « verticale réglementée » (R08 §8.2.10). Pour les églises, chaque extrait passe par le pasteur : un clip sorti de son contexte peut dire le contraire du sermon (R09 §5.7).

---

## 4. Les routines par verticale

### 4.1 Beauté : le dépôt de produits

Sources : fiches produit du site (crawl quotidien ou webhook Shopify et WordPress, R06 §13.2), dépôt WhatsApp de la fondatrice (deux photos en « document », refus automatique sous 1 000 px, R21 §9.4), commentaires et messages (trois questions identiques déclenchent un script de réponse vidéo), tendances TikTok du pays (R06 §16.4), calendrier commercial, météo et saison (harmattan, hiver canadien).

Déclencheur principal : nouveau produit déposé → extraction INCI par Sonnet 5.5 (0,015 $, vérification contre une base de noms, R21 §9.1 et §9.5) → kit de lancement en cinq temps : teaser J-3, unboxing J0, tutoriel J+3, carrousel teintes J+7, rappel WhatsApp J+10 (R09 §3.8). Le client valide la séquence entière sur une seule planche.

Formats produits automatiquement : packshot détouré (Photoroom 0,02 $ ou Recraft 0,01 $, R03 §6.5) remis en scène par gpt-image-2.5 (produit pixel-exact, jamais synthétisé, R03 §12.6), carrousels, visuels d'annonce avec texte posé en HTML, Reels produit de 20 secondes (packshot animé en Kling 3.0 ou Veo 3.1 Fast, 5 à 6,50 $ pièce, R04 §6), scripts et sous-titres de tutoriel, légendes PAS, BAB, FAB avec 3 à 5 hashtags, messages WhatsApp de réassort. Profil d'export « Afrique mobile » : 720p, moins de 10 Mo, sous-titres incrustés (R10 §8.6).

Humain obligatoire : tout visage à l'image, toute allégation (lexique Santé Canada, règlement 655/2013, politique Meta du 23 juillet 2026 : avant/après autorisé, 18 ans et plus, aucune promesse datée, aucun message d'infériorité, R26 §5.15), tout comparatif citant une marque tierce, exclusion par règle dure de l'éclaircissement de la peau (R09 §3.7).

### 4.2 Association culturelle : événements régionaux et genèse

Sources : agenda du site de l'association, flyers déposés par WhatsApp (OCR structuré : titre, dates, lieu par commune et repère, prix en FCFA, R21 §2.1), agendas de la ville et pages Facebook publiques des festivals via Graph API (R10 §5 et §6), journées internationales, Google Events via SerpApi (R06 §16.2).

Déclencheurs : nouvel événement publié → séquence teaser J-21, genèse J-14, programme J-7, rappel J-1, récap J+2 (R09 §4.8) ; événement régional tiers → carrousel « à voir cette semaine » ; journée internationale → citation animée.

Formats automatiques : teaser motion design 10 à 20 secondes (Remotion ou Claude Design, 0,05 à 0,30 $), carrousels programme et agenda, genèse en carrousel ou vidéo animée dont chaque fait est corroboré par deux sources dont une primaire (R06 §13.4), citation animée, QR dynamique maison sur chaque affiche (R24 §2.6). Public double au Canada : membres (WhatsApp, Facebook, français) et ville (Instagram, agendas, anglais et français, R10 §8.17).

Humain : portraits, directs, prises de vue, vérification des faits de la genèse, crédits et autorisations d'image (foule tolérée en plan large, personne individualisée interdite sans accord, R08 §7.4).

### 4.3 Église : le sermon YouTube (pipeline « Chaire »)

Sources : PubSubHubbub de la chaîne YouTube (gratuit, hors quota, R21 §9.6), fichier source déposé par la régie (Drive partagé, ou salle Daily à 1,21 $ par sermon de 90 minutes, R21 §9.7), ou audio seul par WhatsApp pour les églises sans régie (43 Mo pour 90 minutes, R21 §9.8). Jamais de téléchargement depuis YouTube (interdit par l'API, R08 §7.8). Calendrier liturgique (API AELF, conditions à lire) et évangélique (jeûne de janvier, veillée du 31 décembre).

Déclencheur : nouveau sermon → chaîne complète en moins de 24 heures : transcription AssemblyAI Universal-3.5 Pro à 0,21 $ par heure avec `language=fr` forcé, jamais la détection automatique sur du français africain (R05 §8.3), segmentation et pré-notation par Haiku 4.5, choix et titres par Opus 5.5 (0,14 $, 0,07 $ en Batch, R07 §7), grille de cinq types de moments (phrase-choc, illustration, application, contre-courant, appel) avec exclusion des annonces et de la quête (R05 §8.7), versets résolus contre une Bible de référence (Segond 1910 locale ou API.Bible), découpe ffmpeg, recadrage 9:16 par détection de visage, sous-titres karaoké libass, habillage Remotion, floutage automatique des visages du public, aucun plan d'enfant (R08 §10.11).

Formats automatiques : 5 clips de 30 à 60 secondes plus un format long de 2 à 3 minutes pour Instagram Reels et Shorts (l'API Instagram accepte 15 minutes et 300 Mo ; la limite de 90 secondes ne vaut que pour Facebook Reels, R26 §5.1), 10 citations image, dévotionnel 5 jours pour le Channel WhatsApp, chapitrage et description YouTube, article, guide de groupe de maison, teaser du dimanche. Deux comptes servis : l'église et le pasteur (le compte du pasteur fait 4 à 10 fois celui de l'église, R09 §11.7). Cadence : un clip par jour du lundi au samedi, jamais les cinq le même jour (R05 §8.10). Coût marchand sous 2,50 $ par sermon, sans génération IA, donc sans étiquette ni deepfake (R04 §8.5).

Humain : validation doctrinale de chaque extrait, message face caméra, témoignages avec consentement signé, réponse aux demandes de prière (l'agence ne prie pas à la place du pasteur, R23 §8.5).

### 4.4 Édition : SEVARTA, livres et auteurs

Sources : base des titres (manuscrit, métadonnées, date de sortie), chaîne YouTube des auteurs (même pipeline que Chaire, une prédication par chapitre, R09 §11.6), avis clients, calendrier liturgique, salons du livre, Journée mondiale du livre (23 avril).

Déclencheur : nouveau titre → séquence de six semaines (couverture J-42, extrait J-28, précommande J-21, extrait J-14, interview J-7, sortie J0, avis J+14, bilan J+30, R09 §6.3).

Formats automatiques : citations animées, carrousels « 5 idées du chapitre », révélation de couverture, extraits de prédication reliés au chapitre, visuels d'avis, newsletter (canal de relation en France et au Canada, R09 §11.8), audiogrammes, bande-annonce 30 secondes (Seedance 2.5 via l'API Higgsfield, 3,09 $ les 15 secondes, R26 §5.11 ; les clips musicaux restent l'atelier manuel de José).

Humain : lecture d'extrait par l'auteur (voix réelle prioritaire, voix de synthèse étiquetée), interview, validation doctrinale des résumés, respect de l'empreinte d'auteur (R09 §6.7).

### 4.5 École : 2IAE, admissions et campus

Sources : calendrier académique ivoirien (rentrée le 14 septembre 2026, inscriptions des nouveaux bacheliers du 25 août au 30 septembre, réorientations en janvier et février, R10 §5.1), site www.2iae.com (nouvelles formations, partenariats), résultats et classements, registre des autorisations d'image, données publiques du campus numérique uniquement (consigne de séparation des sessions).

Déclencheurs : date d'admission à J-30 → compte à rebours et carrousel ; rentrée à J-14 → série « bienvenue » et hashtag de rentrée ; résultat publié → visuel « victoire » ; événement terminé → récap sous 48 heures ; nouvelle formation → carrousel métiers (R09 §7.8).

Formats automatiques : comptes à rebours, visuels de résultats, carrousels métiers et conseils (coût quasi nul, R03 §12.9), récaps montés à partir des plans fournis, miniatures YouTube (R03 §9), posts LinkedIn (1,8 million d'utilisateurs en Côte d'Ivoire, deux fois Instagram, R10 §2.1), message WhatsApp hebdomadaire aux candidats et parents. Événements GA4 `generate_lead`, `begin_application`, `submit_application` demandés à la session du site (R24 §10.17).

Humain : étudiants ambassadeurs, enseignants, témoignages, autorisation parentale pour tout mineur (R09 §7.7), réponses aux candidats.

### 4.6 B2B : Markel-Tech sur LinkedIn

Sources : registre des projets livrés (chaque mise en ligne d'un site est un déclencheur), base de questions clients, veille sectorielle (plateformes, IA, outils), pages LinkedIn des clients.

Déclencheurs : projet mis en ligne → avant-après J+3, étude de cas en document natif J+14 après accord écrit du client, témoignage J+30 ; trois questions identiques → check-list ; actualité majeure d'une plateforme → post d'analyse proposé à José ; fin de mois → sondage (R09 §8.8).

Formats automatiques : documents natifs (7,00 % d'engagement, meilleur format LinkedIn, R09 §8.1), carrousels d'images, avant-après, sondages, motion design 15 à 30 secondes, newsletter mensuelle, vidéo 90 secondes avec voix clonée de José (0,20 à 0,50 $, R04 §6). Jamais de lien externe en premier (3,25 %). Publication sur la page entreprise par la Community Management API, jamais d'automatisation du profil personnel (interdit par LinkedIn, R08 §7.8) : les posts du fondateur sont préparés par la machine et publiés par José. X en option à budget plafonné (0,015 $ par post, R02 §1).

Humain : posts texte et vidéos du fondateur, accord des clients cités, vérification des chiffres.

---

## 5. La planche de propositions et la validation client

### Contenu exact d'une planche

Une planche est un objet versionné (`board`, `board_version`) qui porte :

1. En-tête : logo du client, semaine, mix réel 60/25/15 en trois pastilles (la machine refuse de composer une planche à plus de 15 % de promotion ou à moins de 60 % de valeur, R06 §16.15).
2. Six à dix propositions, chacune avec : maquette basse définition marquée « maquette » (gpt-image-2.5 en qualité low ou Nano Banana 2 Lite, moins de 0,04 $ pièce ; capture « frame 0 » Remotion pour les vidéos), hook en moins de 8 mots, format, plateforme cible selon la règle des deux plateformes, date et heure, pilier et framework (PAS, AIDA, BAB, FAB), sources visibles sous chaque fait (R06 §16.13), ce que le client doit tourner lui-même.
3. Ligne « faits à confirmer » : prix, dates, noms non retrouvés en base (R11 §15.15).
4. Pour les vidéos génératives : mode brouillon (1 prise, basse résolution) ; la production en 3 prises et 1080p ne démarre qu'après validation (R04 §8.3).
5. Pied : coût de génération prévu de la semaine contre plafond contractuel, trois boutons.

Coût de composition d'une planche : 0,03 à 0,20 $ en images (R03 §9) plus environ 0,10 $ de jetons ; composition HTML par React et rendu Playwright, export PNG 1080×1350 (sous 5 Mo pour l'en-tête WhatsApp) et PDF (R22 §10.8).

### Canaux

**WhatsApp Business Platform en accès direct** sous le portefeuille Markel-Tech, sans BSP, deux numéros dans le même compte (une SIM ivoirienne +225 et un numéro canadien +1, R22 §10.1 et §10.2), entreprise vérifiée dès le départ. Six modèles utilitaires soumis en une fois : `planche_prete`, `rappel_planche`, `production_terminee`, `publication_faite`, `rapport_mensuel`, `alerte_gestionnaire` (R22 §10.4). Le modèle `planche_prete` porte l'image composite et trois boutons (« Valider », « À revoir », « Appeler-moi »). Le tap ouvre une fenêtre de 24 heures ; la plateforme envoie alors un Flow générique à deux écrans (validées, à revoir avec motifs cochables), alimenté par `flow_token` (R22 §10.6 et §10.7). Les vocaux sont téléchargés dans les 5 minutes, archivés, transcrits par `gpt-4o-mini-transcribe` (0,003 $ la minute) ou Deepgram Nova-3, renvoyés en citation avec bouton de confirmation, puis transformés par Claude en instruction de retouche (R22 §10.9). Écoute du webhook `message_template_category_update` pour bloquer tout modèle reclassé marketing (R22 §10.5). CallMeBot n'est pas conforme pour écrire aux clients (R08 §7.9).

**Courriel (Resend)** avec le même lien signé, en repli et en double pour les clients canadiens et français (consentement CASL enregistré à la signature, R22 §6.2).

**Lien magique** : page mobile 390 px sans compte, jeton signé à usage limité, une carte par proposition, barre d'actions collante, feuille « À revoir » avec motifs et vocal ; même table de validations que le Flow, pour commencer sur WhatsApp et finir sur la page (R22 §10.14).

### États, relances, versions

États de la planche : `composee`, `relue` (porte 1), `envoyee`, `ouverte` (accusé de lecture WhatsApp), `partiellement_validee`, `validee`, `a_revoir`, `expiree`. Chaque commentaire crée une version n+1 des propositions concernées, générée automatiquement à partir de la remarque ; l'historique est conservé pendant toute la durée du contrat plus 12 mois (R08 §4.3). Toute validation par lien, courriel ou WhatsApp vaut accord écrit (clause contractuelle, R08 §8.1.2). Relances : J+2 et J+5, puis humain (section 3).

Indicateur suivi : taux d'acceptation des planches sans modification majeure, cible 70 % et plus (R11 §12), et délai médian dépôt vers planche, cible 24 heures (R21 §9.18).

---

## 6. Le poste de pilotage du gestionnaire

Une PWA (manifest `standalone`, service worker, Web Push VAPID ; sur iPhone, tutoriel « Partager puis Sur l'écran d'accueil », R22 §10.13). WhatsApp pour l'alerte, la PWA pour l'écran.

### Écrans

1. **Aujourd'hui** : files triées par urgence, nombre d'éléments et délai restant pour chacune.
2. **Files** : à relire avant envoi (porte 1) ; validé, à contrôler avant publication (porte 3) ; publier à la main (paquets prêts à publier, R02 §10.5) ; boîte de réception (commentaires et messages classés en six classes par Haiku 4.5, brouillon de réponse dans la voix du client à 1,20 $ pour 1 000, R23 §8.4) ; commentaires TikTok à traiter dans l'application (pas d'API, R23 §8.9) ; boosts proposés (détection à 24 heures, deux conditions sur trois au-dessus de 1,5 fois la médiane des 30 dernières publications, jamais automatique, R23 §8.10) ; connexions à renouveler (R21 §9.13).
3. **Client** : fiche, cerveau de marque, planche en cours, calendrier en trois états (proposé, validé, publié), banque d'assets réels, registre de consentements, coûts du mois contre plafond, indicateurs « à la page ».
4. **Qualité** : taux de passage du juge par client, paires de corrections récentes, moteurs qui échouent par produit (journal des rejets, R03 §10).
5. **Revue mensuelle** : rapport généré, trois décisions proposées, bouton d'envoi.

### Alertes (WhatsApp, modèle `alerte_gestionnaire`)

Planche non relue après 2 heures ; client sans réponse à J+5 ; trois refus du juge sur un même client (Routine « incident », R07 §11.12) ; client à 80 % de son plafond de génération (R25 §11.12) ; conversation Click-to-WhatsApp sans réponse depuis 2 heures (R23 §8.17) ; jeton à reconnecter ; métrique « invalid metric » détectée par le test hebdomadaire de collecte (R24 §10.20).

### Actions en un clic

Approuver, corriger dans Canva (le gestionnaire retouche dans Canva, pas dans le code, Brand Kit par client, R03 §12.8), renvoyer en génération avec motif, publier maintenant, basculer en paquet manuel, répondre avec l'étiquette HUMAN_AGENT journalisée (R23 §8.5), proposer un boost au client avec capture et budget (5 $ par jour sur 7 jours à Abidjan, 10 $ au Canada, R23 §8.13).

### Indicateurs « à la page » affichés par client (R11 §12, R24 §5)

Délai médian tendance vers publication (cible moins de 72 heures pour une nouveauté, moins de 48 heures pour un événement), taux de nouveautés exploitées sous 14 jours (cible 100 %), taux de vidéos (40 à 60 % selon la verticale), taux de sermons réemployés sous 7 jours (100 %), taux d'ancrage réel (80 % et plus), envois par portée et enregistrements par portée, rétention à 3 secondes, taux d'acceptation des planches, écart au mix 60/25/15 (moins de 10 points), taux d'étiquetage IA conforme (100 %), délai médian de première réponse aux commentaires et messages (R08 §10.7).

---

## 7. L'usine de production

### Principe d'architecture

Deux couches partout (R03 §12.1) : un moteur génératif pour les scènes et les éléments, une couche de composition déterministe (composants React rendus par Playwright, ou Canva Autofill) pour tout texte éditorial, logo et aplat de marque. Chaque moteur est abstrait derrière une interface interne (prompt, références, taille, qualité, masque ; soumettre, interroger, récupérer, webhook) avec un fournisseur par défaut et un repli, parce qu'un fournisseur change tous les trois mois (R01 §8.16 : Sora 2 retirée, Imagen 4 arrêté, gpt-image-1 arrêté le 23 octobre 2026, gpt-image-1.5 le 1er décembre 2026, R26 §2.2). Chaque actif stocke moteur, version, prompt, références, compte, plan et drapeaux d'étiquetage (registre de provenance, R08 §8.2.1). Contrôle qualité en trois couches avant toute planche : déterministe (0 $), vision Haiku 4.5 sur image réduite à 1 000 px (0,002 à 0,003 $), boucle de correction à deux tentatives puis bascule de moteur puis file humaine (R03 §10, R07 §11.14).

Règle économique centrale : la vidéo générative est le seul poste qui peut tripler la facture (1 à 4 $ par prise de 10 secondes). Plafond de 3 prises par plan, budget mensuel par client dans `tenant_budget`, alerte à 80 %, génération en mode brouillon avant validation (R08 §10.5, R25 §11.12).

### Tableau récapitulatif par type de contenu (prix au 1er et 2 octobre 2026)

| Type de contenu | Chaîne exacte (moteur, version) | Prix unitaire daté | Contrôle qualité | Repli |
|---|---|---|---|---|
| Post texte, légende, hashtags | Claude Opus 5.5 avec cerveau de marque en cache (0,022 $, R07 §7) ; juge Haiku 4.5 (0,0045 $) ; plafond 5 hashtags | 0,03 $ | juge 7 critères, seuil 15/21 ; lexique d'allégations par pays | Sonnet 5.5 (0,012 $) |
| Carrousel 8 planches (Instagram, LinkedIn PDF) | plan JSON par Opus 5.5 (0,068 $), slides React, rendu Playwright, cover optionnelle gpt-image-2.5 medium | 0,07 à 0,10 $ | lisibilité (police ≥ 40 px sur 1080), couleurs de marque par échantillonnage, 10 diapositives maximum par API Instagram (R02 §12.6) | Canva Autofill (Brand Kit) |
| Visuel avec texte (affiche, annonce, citation) | fond Nano Banana 2 1K (0,067 $) ou FLUX.2 pro (0,03 $) via fal ; texte posé en HTML ; gpt-image-2.5 Flare par défaut via Responses API (prix officiel en jetons : 5 $ texte, 8 $ image en entrée, 30 $ image en sortie par million ; coût réel par image mesuré sur `usage`, R26 §2.2) | 0,03 à 0,07 $ | OCR par vision comparé au JSON attendu ; texte parasite ; jeu de 30 phrases françaises accentuées à chaque changement de version (R03 §12.11) | Seedream 5.0 Pro (0,0675 $), Recraft V4.1 (0,035 $) |
| Photo produit mise en scène (beauté, livre) | packshot client détouré (Photoroom 0,02 $ ou Recraft 0,01 $) ; fond gpt-image-2.5 Sunburst en édition masquée avec packshot en référence, ou FLUX.2 ; composition HTML | 0,05 à 0,10 $ | comparaison vision du packaging avec le packshot original (logo, nom, couleur) ; étiquette lisible | FLUX.2 LoRA (8 $ d'entraînement) seulement pour un produit généré des centaines de fois (R03 §12.15) |
| Reel génératif produit 20 s, 9:16 | 2 clips I2V de 8 s en Kling 3.0 via API Higgsfield (0,084 $ par seconde, 1,26 $ les 15 s, R26 §5.11) ou Veo 3.1 Fast (0,10 $ par seconde, R04 §2.1), 3 prises ; montage Remotion (texte, logo, CTA) ; voix ElevenLabs v3 (0,08 $ par 1 000 caractères) ; musique bibliothèque de la plateforme ou ElevenLabs Music (0,15 $ par minute) | 5 à 6,50 $ (R04 §6) | vision sur 3 images clés (produit présent, anatomie), durée et encodage (H.264, AAC 48 kHz, moov en tête, sous 300 Mo, R26 §5.2) | LTX-2.3 (0,06 $ par seconde) pour les brouillons ; Wan 3.0 |
| Scène signature multi-références (teaser, bande-annonce de livre) | Seedance 2.5 via API Higgsfield (0,2057 $ par seconde, 4 à 30 s, jusqu'à 50 références ; 3,09 $ les 15 s, 6,17 $ les 30 s, R26 §2.4) ; storyboard Popcorn ou Nano Banana ; musique Lyria 3 Pro (0,08 $) | 6 à 14 $ (R04 §6) | idem ; test des filtres de contenu par verticale (culte, enfants, peau) | Kling 3.0 ; Unlimited manuel de José hors chemin critique |
| Reel programmé Remotion (chiffres, compte à rebours, tutoriel, versets, étude de cas) | composants React par client, rendu CPU sur le worker Railway (effectif de 3 personnes ou moins : licence gratuite ; sinon Automators 100 $ par mois minimum, R04 §4) ou Remotion Lambda (0,02 $ la minute) | 0,05 à 0,50 $ | déterministe (zones sûres, durée par plateforme) | ffmpeg + libass |
| Clip de sermon 45 à 60 s et format long 2 à 3 min | fichier de la régie ; AssemblyAI Universal-3.5 Pro 0,21 $ par heure, `language=fr` ; Haiku 4.5 puis Opus 5.5 (0,14 $, 0,07 $ en Batch) ; ffmpeg, MediaPipe, libass karaoké ; habillage Remotion ; floutage du public | 0,80 à 2,50 $ par sermon pour 8 clips (R05 §4) | verset vérifié contre une Bible de référence par texte ; aucune coupe au milieu d'un verset ; validation du pasteur | API Vizard (14,50 $ par mois, 600 minutes) ou Klap (0,44 $ par traitement, 0,32 $ par short) pendant la construction (R05 §8.2) |
| UGC synthétique « avis cliente » 30 s | portrait Soul 2 ou Nano Banana (0,07 $), script Claude, voix ElevenLabs, OmniHuman 1.5 ou HeyGen Avatar IV, sous-titres ASS, étiquette IA obligatoire | 1,70 à 3,80 $ (R04 §6) | drapeau « réaliste » posé ; `is_ai_generated: true` à la publication (R26 §5.4) ; jamais de visage d'une personne réelle sans consentement signé | UGC réel fourni par la cliente (20 % du mix réservé au 100 % humain, R11 §15.16) |
| Story | gpt-image-2.5 Flare 1024×1536 medium ou Nano Banana 2 ; texte HTML ; export MP4 par Canva | 0,02 à 0,05 $ | zones sûres (haut 250 px, bas 340 px) ; 60 s et 100 Mo maximum en vidéo (R26 §2.1) | Canva |
| Miniature YouTube | portrait réel détouré (Photoroom 0,02 $) + fond Nano Banana 2 (0,067 $) ou Gemini déjà en place ; titre 3 à 5 mots en HTML ; skill youtube-thumbnail existant | 0,07 à 0,10 $ | lisibilité à 168×94 px par vision ; visage non déformé | gpt-image-2.5 |
| Vidéo explicative de logiciel 60 à 90 s (2IAE, Markel-Tech) | captures ou enregistrement d'écran, zooms et curseur animés en Remotion, voix clonée de José (ElevenLabs, consentement propre), sous-titres | 0,15 à 0,40 $ (R04 §6) | déterministe + relecture humaine du texte | voix de catalogue |
| Planche de propositions | 6 à 10 maquettes gpt-image-2.5 low ou Nano Banana 2 Lite, captures Remotion « frame 0 », composition HTML, PDF Playwright | 0,03 à 0,20 $ en images (R03 §9), 0,50 à 2 $ par calendrier hebdomadaire avec brouillons vidéo (R04 §6) | aucun QC lourd, mention « maquette » | Canva |
| Musique | bibliothèque native des plateformes pour l'organique ; ElevenLabs Music ou Lyria 3 pour les vidéos hors plateforme ; Epidemic Sound (API sous licence) pour les églises sur YouTube ; Suno à la main par José (pas d'API publique, R04 §0.3), jamais en plan gratuit (R08 §10.9) | 0 à 0,15 $ | plan du compte vérifié avant export ; métadonnées jamais retirées | bibliothèque native |

Ordre de grandeur mensuel pour un client beauté en Vidéo+ (12 Reels générés, 8 carrousels, 4 UGC) : 60 à 80 $ de génération, 20 à 30 $ de planches et de prises écartées, moins de 110 $ de coûts variables (R04 §6). Pour une église : moins de 10 $ par mois de production pour 4 sermons. Pour une école : 1,5 à 4 $ d'images (R03 §12.18) plus 2 à 4 $ de rendus programmés.

---

## 8. La veille et l'intelligence

### Sources par flux (R06 §16, R10 §6)

**Flux A, le client lui-même** : crawl quotidien du site (sitemap, flux WordPress ou Shopify, webhook si disponible), dépôt de nouveautés par WhatsApp ou formulaire (la déclaration remplace la surveillance quand le client coopère, R06 §16.10), Business Discovery pour ses propres comptes, flux Atom YouTube et PubSubHubbub pour sa chaîne. Coût marginal nul.

**Flux B, le domaine et la région** : Google Trends « Trending Now » RSS par pays (CI, CA, FR, testé, R06 §2.2), Google News RSS par requête localisée, GDELT DOC 2.0 (gratuit, toutes les 15 minutes), flux RSS des médias d'Abidjan, de Toronto et d'Ottawa (R10 §6), pages Facebook publiques des festivals via Graph API, SerpApi (Starter 25 $, un seul abonnement partagé) pour Google Trends explore, Google Events par ville et Google News structuré, changedetection.io auto-hébergé pour les pages dynamiques, Tavily (1 000 crédits gratuits par mois) comme moteur de l'agent de genèse, Exa pour les concurrents. Jamais pytrends sur Railway (429 depuis les IP cloud, R06 §16.3). NewsAPI (449 $) et Bing News (retirée) écartés.

**Flux C, les formats et les sons** : un run Apify quotidien du TikTok Creative Center pour les trois pays, partagé entre tous les clients (moins de 20 $ par mois), avec pays et date de première apparition ; hashtags Instagram dans la limite de 30 par 7 jours par compte (10 de marque, 10 de niche, 10 exploratoires, R06 §16.6) ; Instagram Audio API (1er juin 2026) pour attacher un son à la publication (R26 §3.2). Scraping TikTok isolé des comptes clients et déclaré au contrat (R06 §16.18).

**Calendrier des moments** (R10 §8.9) : couche 1, fêtes fixes par pays ; couche 2, fêtes lunaires (Ramadan, Aïd, Tabaski, Maouloud, Magal) en fenêtre de plus ou moins deux jours, confirmées la veille ; couche 3, événements vivants rafraîchis par la veille (FEMUA fin avril, MASA en avril des années paires, Afrofest mi-août, Francophonie en fête fin septembre, rentrée ivoirienne le 14 septembre, pics d'admission 2IAE en juin, juillet, septembre et janvier) ; calendrier liturgique et évangélique. La machine propose un contenu 10 jours avant chaque date et génère les « moments » 8 semaines à l'avance.

### Fréquences et scoring (R06 §13)

Trending Now toutes les 2 heures ; Google News toutes les 4 heures ; GDELT toutes les 6 heures ; flux YouTube toutes les heures ; crawl du site, Apify TikTok et Business Discovery une fois par jour ; SerpApi une fois par semaine. Pipeline : collecte en Postgres avec hash et URL canonique, dédoublonnage exact puis sémantique (cosinus supérieur à 0,92 sur 7 jours), scoring par Haiku 4.5 avec profil client en cache et 20 items par appel (pertinence, pilier, urgence, format), score composite pertinence × fraîcheur (demi-vie 36 heures pour les tendances, 14 jours pour les événements) × signal × diversité, genèse automatique pour les items « newsjacking » ou « événement », classement par pilier pour nourrir le 60/25/15.

### Vérification des faits : règles dures (R06 §13.4)

Toute date et tout lieu corroborés par deux sources indépendantes dont une primaire ; extraction structurée avec niveau de confiance par champ, tout champ sous 0,8 bloque la publication automatique ; revérification 48 heures avant publication ; sujets politiques et religieux controversés marqués « risque » et exclus du newsjacking automatique pour les églises, SEVARTA et 2IAE ; « Source : URL » sous chaque fait dans la planche. C'est l'argument commercial contre les concurrents qui publient des tendances non vérifiées.

### Newsjacking : délais cibles (R06 §13.5)

Détection et scoring en moins de 15 minutes, genèse et vérification en moins de 45 minutes, alerte au gestionnaire avec angle et visuel brouillon en moins d'une heure, publication en moins de 4 heures pour une tendance et 24 heures pour un événement annoncé.

### Mesurer la veille elle-même

Pour chaque item retenu : proposé, accepté, publié, performance (R06 §16.19). Après 90 jours, les sources qui ne produisent jamais d'item accepté sont coupées. Plan B configuré pour chaque source gratuite non contractuelle (bascule vers SerpApi ou Apify sans redéploiement, R06 §16.20).

### Coût mensuel (R06 §14)

Socle partagé 60 à 170 $ (SerpApi 25 à 75 $, Apify 19 $, Tavily 0 à 30 $, Exa 0 à 10 $, changedetection.io 5 à 15 $, workers 10 à 20 $). Par client : 5 à 10 $ en profil léger (église, association), 12 à 25 $ en standard (beauté, SEVARTA, 2IAE), 30 à 60 $ en intensif. Avec Batch API et cache de prompt sur le scoring, le LLM descend sous 5 $ par client (R06 §16.12). La veille n'est pas le poste de coût ; c'est le poste de valeur, et c'est ce que Hootsuite vend à partir de 399 $ par siège, en anglais.

---

## 9. L'architecture agentique

### Doctrine : 80 % d'appels structurés, 20 % d'agents

Le cœur tourne sur l'API Messages avec sorties structurées, cache de prompt et Batch API, orchestré par pg-boss (R07 §11.1) : posts, carrousels, scripts, calendrier, juges, scoring de veille, extraction de documents sont des appels à 0,005 à 0,32 $. L'agent (Claude Agent SDK TypeScript dans un conteneur Railway dédié, `SessionStore` Postgres, `maxBudgetUsd` 2 $ par sermon, profondeur de sous-agents 1, hooks `PreToolUse` d'audit et `defer` sur la publication, R07 §11.8) est réservé aux tâches ouvertes : audit du site d'un nouveau client, genèse d'un événement, découpage d'un sermon qui exige d'écouter plusieurs passages. Facteur 4 à 15 sur les jetons documenté par Anthropic sans gain pour les tâches bien spécifiées (R07 §11.1).

### Modèles par tâche (prix officiels R26 §2.3)

| Tâche | Modèle | Prix (entrée / sortie / lecture de cache, par million de jetons) | Mode |
|---|---|---|---|
| Création (posts, carrousels, scripts, calendrier, titres de clips, rapport mensuel) | Claude Opus 5.5 | 4 $ / 20 $ / 0,20 $ (0,05x) | temps réel, Batch pour le calendrier |
| Synthèses de veille, extraction INCI et PDF, brouillons de réponses sensibles | Claude Sonnet 5.5 | 2 $ / 10 $ / 0,20 $ | Batch quand possible |
| Juges, scoring de veille, vision, classification des commentaires, extraction de flyers, ouvriers de lecture | Claude Haiku 4.5 | 1 $ / 5 $ / 0,10 $ | Batch nocturne |
| Sessions d'agent longues (orchestration d'un sermon complet, audit de site, revue mensuelle multi-clients) | Claude Fable 5.1 | 10 $ / 50 $ / 0,25 $ (0,025x) | jamais pour une légende |
| Second juge d'une autre famille sur 10 % des contenus | gpt-4o-mini (déjà en place) | selon OpenAI | échantillon |

Règles : majorer les entrées de 30 % pour le tokenizer des modèles 4.7 et suivants (R26 §5.8) ; ne jamais changer de modèle en cours de conversation (cache par modèle) ; cerveau de marque de 4 000 à 12 000 jetons en tête de prompt derrière `cache_control` TTL 1 heure (un cerveau de 10 000 jetons relu 500 fois coûte 1 $ au lieu de 20 $, R07 §11.3) ; tester `stop_reason === "refusal"` et activer `fallbacks: "default"` (R07 §11.15) ; clé API de la plateforme séparée de l'abonnement Max de José (interdiction documentée d'offrir la connexion claude.ai dans un produit tiers, R07 §11.17) ; budgets par client et alerte à 15 $ de jetons dans le mois.

Panier mensuel type par client (20 posts, 4 carrousels, 8 scripts, 1 calendrier, 4 sermons, 100 jugements, 60 vérifications d'images, veille quotidienne) : environ 10,6 $, 7 $ avec Batch sur la veille et les juges (R07 §7), soit 9 à 14 $ après majoration du tokenizer.

### Cerveau de marque et mémoire

Par client : fiche de voix versionnée (règles mécaniques, lexique signature, interdits lexicaux français construits par statistique, dix meilleurs posts, extraite de 15 textes validés par le prompt de R11 §5.4 et validée par le client sur la première planche), doctrine (deux plateformes, 60/25/15, frameworks, hashtags, registre de langue : français standard, français parlé avec nouchi, bilingue, R10 §8.8), profil de conformité par verticale, banque d'assets réels avec `asset_ids` obligatoire sur chaque contenu émotionnel (R11 §15.2), dix meilleures publications et cinq à dix paires de corrections réinjectées chaque mois (R11 §15.10). Brand kit extrait à l'onboarding par Firecrawl `branding` (1 crédit) puis Claude pour le ton, poussé dans un Brand Kit Canva (R21 §9.14) ; chemin « page Facebook + 3 visuels » pour les clients sans site (R21 §9.15).

### Juge qualité et garde-fous

Juge à sept critères (spécificité, originalité par test de substitution, voix, hook, appel à l'action, ancrage réel, conformité ; 0 à 3 chacun, seuil 15/21 et au moins 2 sur spécificité, voix et conformité, R11 §8.2), modèle différent du générateur, sortie structurée, deux révisions maximum puis escalade humaine, calibré le premier mois sur 100 posts notés par José par verticale (kappa d'au moins 0,6), recalibré chaque mois et à chaque changement de modèle (R11 §15.4). Lot d'évaluation de 50 cas par verticale avant toute mise en production et avant toute optimisation (R07 §11.20). Garde-fous encodés : lexique d'allégations par pays, versets vérifiés par outil, consentement d'image enregistré pour tout visage identifiable (vue SQL `publishable_assets`), chiffres 2IAE issus de la base, champ `etiquette_ia_requise` calculé par le juge (R11 §15.7).

### Place exacte de chaque surface Claude

- **Claude Cowork** : outil personnel de José, pas une brique de la plateforme. Il ne se déclenche pas sur un événement externe (R07 §11.10). La plateforme dépose des ordres de production (JSON : client, brief, formats, moteurs, délais) que Cowork vient chercher via le serveur MCP de la plateforme, dans une tâche planifiée ou une Routine.
- **Claude Code** : construit la plateforme ; en exploitation, agit sur elle via le même MCP (revues, audits, incidents).
- **Routines Claude Code** (aperçu de recherche) : pont d'entrée tiré par la plateforme : `POST /v1/claude_code/routines/{id}/fire` (30 par heure par routine, 100 par heure par compte), routine « revue hebdomadaire » et routine « incident » après trois refus du juge ; les prompts agissent explicitement sur le bloc `routine-fire-payload`, traité comme non fiable (R07 §11.12). Pas de clé d'idempotence : la plateforme journalise chaque tir.
- **Claude in Chrome** : poste de José seulement, pour l'atelier Higgsfield Unlimited, hors chemin critique. Le pilotage navigateur de l'Unlimited est interdit par la section 10.6 des conditions Higgsfield du 26 juillet 2026 et par le centre d'aide (R26 §2.4) ; une suspension couperait tous les clients d'un coup (R04 §8.1). `browser_toolset_20260801` dans un conteneur n'est pas retenu (fragile, 6 600 jetons de définition, 1 300 à 2 700 jetons par capture, R07 §11.11).
- **Serveur MCP exposé par la plateforme** (« machine-social ») : conforme à la spécification 2025-06-18 (OAuth 2.1, PKCE, RFC 9728, 8414, 7591, 8707), joignable depuis les adresses d'Anthropic (R07 §2.5). Dix outils au départ : `list_pending_briefs`, `get_brand_brain`, `get_assets`, `submit_render`, `submit_board`, `approve`, `reject`, `request_higgsfield_job`, `report_metrics`, `log_decision` (R07 §11.9). C'est aussi la porte d'interopérabilité : un client équipé ou un partenaire agence pilote sa part de la machine sans interface.
- **Higgsfield** : par l'API officielle (open.higgsfield.ai, paiement à la génération, SDK TypeScript, webhooks, fichiers conservés sept jours, usage par agent et MCP prévu par la section 11.12, R26 §2.4) pour Kling 3.0 (0,084 $ par seconde, voie la moins chère pour Kling), Seedance 2.5 (0,2057 $ par seconde, scènes signature seulement), Soul ID et Popcorn. Sans contrat Enterprise, les références envoyées peuvent servir à l'entraînement : visages de pasteurs et enfants exclus, mention au contrat (R26 §5.12). Gemini (Veo 3.1, Nano Banana, Lyria 3) et fal (FLUX.2, Seedream, LTX-2.3) sont les deux autres adaptateurs ; test hebdomadaire automatique par fournisseur (R04 §8.2).

### Observabilité

Langfuse auto-hébergé sur Railway (ou Core à 29 $) avec `client_id`, `job_id`, `content_type`, `usage`, score du juge ; comparaison mensuelle entre la facture Console et les estimations du SDK (R07 §11.16).

---

## 10. Publication, mesure et apprentissage

### Couche de publication : trajectoire en deux temps

Interface interne unique « connecteur » (publier, lire, statistiques) avec deux implémentations (R02 §12.1).

**Mois 1 à 9 : API unifiée.** Upload-Post Pro (50 $ par mois, 25 profils, marque blanche, aucune App Review Meta ni audit TikTok à porter) ou Zernio à l'usage (6 $ par compte de 3 à 10, 3 $ au-delà ; 90 $ pour 24 comptes, R02 §8.1) ; Ayrshare Launch (299 $, 10 profils) seulement si la maturité l'exige. Pour TikTok, Blotato Starter (29 $, « jusqu'à 900 posts TikTok par mois », audit porté par Blotato, MCP inclus, R26 §3.10) pour les clients église et beauté pressés. Dépendance assumée et bornée : si le fournisseur perd son app Meta, le paquet manuel prend le relais.

**Dès le mois 1, en parallèle : les demandes officielles.** App Meta liée à l'entreprise vérifiée Markel-Tech Inc. (App Review jusqu'à 20 jours par décision en 2026, Business Verification, permissions de publication, de commentaires, de messagerie, de publicité, Page Public Content Access et étiquette HUMAN_AGENT en une seule revue avec vidéo de démonstration, R02 §12.2, R23 §8.2), projet Google Cloud avec audit YouTube API Services (quota d'upload séparé de 100 par jour depuis le 1er juin 2026, R02 §12.7), app TikTok soumise à l'audit Content Posting (avant audit : 5 comptes au maximum, tous en privé, R26 §5.14), app LinkedIn Community Management (R02 §12.17), accès Google Business Profile pour 2IAE et les clients locaux (R02 §12.14).

**Mois 9 à 12 : bascule client par client vers les apps propres**, coût marginal nul, une personne responsable des revues et des versions.

### Contraintes par plateforme encodées

Instagram : lecture de `content_publishing_limit` avant chaque publication, 50 traité comme plafond prudent tant que le compteur n'a pas prouvé 100 (R26 §5.3) ; Reels 3 secondes à 15 minutes, 300 Mo, carrousel 10 éléments, médias servis depuis une URL présignée Railway de 48 heures sur une copie `pub/` (R25 §11.3) ; `is_ai_generated: true` sur tout média photoréaliste généré (R26 §5.4) ; Trial Reels par API pour les clips de sermon et les lancements produit (R26 §5.5). Facebook : Reels 3 à 90 secondes, 30 par 24 heures. YouTube : Shorts jusqu'à 3 minutes, divulgation du synthétique réaliste. TikTok : FILE_UPLOAD par défaut (4 Go, morceaux de 5 à 64 Mo) parce que PULL_FROM_URL exige un domaine vérifié sans redirection, impossible avec une URL présignée Railway (R25 §1.4) ; écran de validation strict exigé par l'audit. LinkedIn : document natif, en-tête de version mensuel. X : budget plafonné, Markel-Tech seulement. WhatsApp Channels et Status : aucune API, geste humain préparé par la machine, adaptateur isolé pour le jour où Meta livre la programmation des Channels (R10 §8.20). Fenêtres : Facebook en semaine 7 h à 9 h et 13 h à 15 h, TikTok 18 h à 20 h à Abidjan ; mardi à jeudi 11 h à 17 h heure de l'Est au Canada ; jamais le dimanche sauf directs (R10 §8.7).

### Repli manuel comme fonctionnalité de premier rang

Paquet prêt à publier (médias aux bons formats, légende finale, texte alternatif, heure, cases à cocher, lien profond), tâche « publier à la main », URL collée par le gestionnaire, mesure ensuite par lecture (R02 §10.5). Il couvre WhatsApp Channels, Snapchat, les refus d'API, les carrousels de 11 à 20, et toute la période avant les audits.

### Mesure en trois couches (R24)

**Collecte chez soi, chaque nuit, en ajout seul** : Instagram retarde de 48 heures, efface les Stories à 24 heures et ne garde que 2 ans ; Facebook limite à 90 jours par requête et a retiré une quarantaine de métriques le 15 juin 2026 (toutes les variantes « unique » de portée) ; LinkedIn ne sert que 12 mois (R24 §1). Stories relevées à H+6, H+12, H+23 ; posts et Reels à J+1, J+3, J+7, J+30 puis mensuel jusqu'à J+90 ; comptes chaque jour à 05 h GMT ; GA4 Data API chaque jour (200 000 jetons par propriété, partagés avec le client) ; YouTube Analytics chaque jour avec `creatorContentType=SHORTS` et `insightTrafficSourceType` pour savoir si les clips ramènent vers le sermon complet ; TikTok Display API (vues, likes, commentaires, partages, `is_aigc`). Table `metric_alias` versionnée et `metric_name` libre, jamais de colonnes figées (R24 §10.9). Test hebdomadaire de collecte sur un compte de test qui échoue bruyamment sur « invalid metric ».

**Couche affaires, en haut du rapport** : tout lien sortant est généré par la machine en `tracked_link` avec UTM conventionnés (`utm_campaign = {client}-{aaaa-mm}-{pilier}`, `utm_content = c{id}-{format}`) via un raccourcisseur maison `go.{domaine}/{code}` qui enregistre le clic côté serveur même sans GA4 chez le client (R24 §2.1) ; page lien en bio maison (formulaire court qui écrit dans `conversion_event` et déclenche la Conversions API avec `event_id`) à la place de Linktree Pro à 15 $ par profil (R24 §2.5) ; QR dynamiques maison sur chaque flyer, affiche et marque-page (R24 §2.6) ; un coupon par contenu promotionnel, lisible à voix haute, l'attribution qui marche à Abidjan où la commande se fait par message (R24 §10.6) ; `referral` et `ctwa_clid` stockés pour les conversations issues de publicités, `Lead`, `QualifiedLead`, `Purchase` renvoyés par Conversions API « business_messaging », liens `wa.me` pré-remplis pour l'organique (R24 §2.4) ; Pixel et CAPI posés dans le Business Manager du client, avec consentement en Ontario et en France (R24 §10.16). Chiffres par verticale : commandes attribuées et produits nouveaux vendus sous 30 jours (beauté), inscriptions et billets scannés (association), nouveaux visiteurs ayant cité un clip et demandes de prière WhatsApp (église), livres vendus avec code (SEVARTA), demandes d'information et dossiers commencés et finalisés (2IAE), devis et rendez-vous avec valeur de pipeline depuis Zoho (Markel-Tech) (R24 §4.3).

**Couche croissance** : abonnés nets, visites de profil, clics vers le lien en bio, messages entrants, vues (plus jamais « portée organique contre payée » sur Facebook, R24 §10.10).

**Couche indicateurs avancés** : envois par portée et enregistrements par portée en tête (Instagram les cite comme premiers signaux de classement, TikTok affiche +45 % de partages, R11 §15.13), taux de visionnage complet, `reels_skip_rate`, rétention à 3 secondes, taux d'engagement comparé à la médiane de la verticale (table `benchmark` encodée depuis Rival IQ et Socialinsider, datée, révisée chaque trimestre, R24 §6.2) puis remplacée après trois mois par la médiane locale des propres comptes de la machine et des concurrents suivis ; alerte « sous la médiane » seulement deux mois de suite et sous les deux seuils (R24 §10.14).

### Rapport mensuel : un produit, pas un export

PDF d'une page rendu par Puppeteer sur Railway plus résumé WhatsApp de cinq lignes avec les trois meilleures publications en vignette, livré le premier lundi après le 3 du mois avant 9 h heure du client (R10 §8.13, R24 §10.8). Gabarit : en-tête avec note de confiance, couche affaires en premier et en gros, croissance, indicateurs avancés avec pastille médiane, trois meilleures publications et une qui a échoué avec la leçon, indicateurs « à la page », trois décisions pour le mois suivant et état du plan à 90 jours (R24 §4.2). Coût : 1 à 3 $ par client et par mois contre 38 $ avec Linktree Pro, AgencyAnalytics et Bitly (R24 §8). Revue à 90 jours avec comparaison avant et après ; alerte interne « risque de départ » quand le client ne valide plus, ne commente plus ou voit ses indicateurs baisser deux mois de suite (R08 §10.18).

### Boucle d'apprentissage

Trois signaux (R11 §10) : corrections du gestionnaire (paires brouillon, correction, motif), décisions client sur la planche (accepté, à revoir, motif), performance réelle (envois, enregistrements, rétention à 3 secondes, conversions). Réinjection mensuelle dans le cerveau de marque ; bandit léger par verticale (pas par client) sur les familles de hooks avec récompense envois plus enregistrements par portée et 20 % d'exploration, probabilités affichées au gestionnaire plutôt que décision à sa place (R11 §15.9) ; Trial Reels pour tester un hook sans exposer la communauté (R26 §5.5) ; sélection des moments de sermon nourrie par les clips qui ont marché (R05 §8.14) ; sources de veille coupées ou renforcées à 90 jours.

---

## 11. Architecture technique et modèle de données

### Services Railway

Un projet Railway « machine » séparé du projet « Groupe 2iae » pour que les règles de déploiement du campus ne soient jamais en cause (R25 §11.1), région EU West Amsterdam (la plus proche d'Abidjan, 5 300 km), provisionné avec le Railway CLI, déploiement automatique depuis GitHub. Aucun Supabase, aucun Neon, aucun bucket chez un autre fournisseur pour la persistance (contrainte de José du 1er octobre 2026) ; la seule exception documentée est une copie de sauvegarde des originaux et des `pg_dump` hors Railway, parce que seul le dump logique survit à la suppression d'un projet (R25 §11.8), et un domaine public stable pour TikTok PULL_FROM_URL si FILE_UPLOAD ne suffit pas (R25 §11.2). Cette exception est à trancher par José (section 15).

| Service | Rôle | Dimensionnement (R25 §8) |
|---|---|---|
| `web` | API Express + React (PWA gestionnaire, page client, lien en bio, raccourcisseur, webhooks WhatsApp, Meta, PubSubHubbub, serveur MCP distant) | 0,5 vCPU, 1 Go à 6 clients ; 1 vCPU, 2 Go à 20 |
| `postgres` | Postgres Railway, RLS forcée, pg-boss, audit, PITR activé dès le premier jour | 0,25 vCPU, 1 Go, 5 Go de volume ; 0,5 vCPU, 2 Go, 20 Go à 20 clients |
| `worker` | pg-boss : files `veille`, `ideation`, `redaction`, `planche`, `juge`, `vision`, `production`, `publication`, `metrique`, `retention_purge`, clés de singleton `client:type:date`, dead letter visible dans le back-office (R07 §11.5) ; appels API Messages, Batch, adaptateurs de génération | 0,5 vCPU, 2 Go ; 1,5 vCPU, 4 Go |
| `agent` | Claude Agent SDK, conteneur séparé (l'agent attend des API, le rendu sature le CPU, R25 §11.11) | selon usage |
| `render` | ffmpeg, libass, MediaPipe, Remotion CPU, Playwright pour les planches et les carrousels ; mode serverless | 4 vCPU, 8 Go, 2 heures par jour (13 $) ; 6 heures, 2 réplicas à 20 clients |
| `tick` | cron Railway qui sort en moins d'une minute : échéances, relances, tirs de Routines (Railway saute un run si le précédent tourne encore, R07 §11.6) | minimal |
| `changedetection` | changedetection.io auto-hébergé | 5 à 15 $ |
| `langfuse` | observabilité LLM | 0 à 29 $ |

Buckets Railway : un bucket `media` avec préfixe par client (`{tenant_id}/orig/`, `/variants/`, `/pub/`), chiffré au repos, URL présignées jusqu'à 90 jours, 0,015 $ par Go, sortie gratuite, aucune règle de cycle de vie ni versionnage : job quotidien `retention_purge` qui lit `expires_at`, supprime, vérifie par `HEAD` et écrit `purged_at` (R25 §11.4). Rétention : originaux conservés (ou proxy 720p plus audio pour les sermons, décision au contrat, R25 §11.5), rendus purgés à 90 jours, copies `pub/` à 7 jours après publication. Réseau privé `railway.internal` seulement ; URL publique de la base désactivée (R25 §11.14). Limite de dépense dure Railway à 1,5 fois la facture attendue (R25 §11.13).

### Postgres : tables principales (R24 §7, R25 §9)

Schémas `app` (métier, RLS), `pgboss`, `audit` (ajout seul, partitionné par mois), `ref` (données partagées). UUIDv7 partout, `tenant_id` non nul sur chaque table métier, clé composite `(tenant_id, id)` sur les tables volumineuses, `timestamptz` partout avec `tenant.timezone`, argent en `usd_micro` bigint.

| Table | Colonnes clés |
|---|---|
| `tenant` | id, nom, verticale, pays, `timezone`, `data_region` (eu, ca), `registre_langue`, `plan` (chaire, presence, video_plus, logiciel), `plafond_generation_usd_micro`, `regle_sans_reponse` (publier_valeur_relation / retenir_tout), `canal_prefere` |
| `tenant_key`, `tenant_secret` | DEK chiffrée par la KEK (variable Railway), `key_version` ; jetons OAuth, BYOK, numéros WhatsApp en AES-256-GCM avec nonce et tag (R25 §11.7) |
| `brand_brain` | tenant_id, version, fiche_voix (jsonb), doctrine (jsonb : plateformes, piliers, frameworks, hashtags), profil_conformite (jsonb), `token_count`, `valid_from` |
| `social_account` | tenant_id, platform, external_id, handle, country, token_ref, api_version, `publishing_limit_last`, active |
| `source`, `signal` | type, configuration, fréquence, coût unitaire, santé ; signal : kind (trend, product_new, site_update, event, sermon), detected_at, payload, score, pilier, urgence, statut |
| `dossier` | signal pivot, sources corroborantes, faits avec confiance, angle par pilier, fenêtre |
| `asset`, `asset_variant` | origine (client, généré, capture), droits, `retention_class`, `expires_at`, `legal_hold`, `sha256` unique par tenant, `storage` (railway, r2), bucket, key ; variante : moteur, version, prompt_hash, références, compte, plan, `is_aigc`, `realistic`, `real_person`, `minor`, manifeste C2PA |
| `consent`, `asset_rights` | personne, pièce signée, portée, durée ; vue `publishable_assets` |
| `content_item` | tenant_id, signal_id, source_asset_id, format, plateforme, pilier, framework, hook, legende, hashtags (≤ 5), `asset_ids`, état (machine à états de la section 3), score_juge, version_rubrique, `etiquette_ia_requise`, coût prévu et réalisé |
| `board`, `board_version`, `board_decision` | semaine, mix 60/25/15, état, image composite, pdf, envoyé_à, ouvert_à ; décision par proposition : valide, a_revoir, motif, vocal_transcrit, canal (whatsapp_flow, lien, courriel), horodatage, preuve |
| `publication` | content_item_id, social_account_id, voie (api_unifiee, api_propre, manuel), external_post_id, url, published_at, trial, `is_ai_generated_flag`, statut |
| `account_metric_daily`, `media_metric_snapshot`, `metric_alias`, `benchmark` | grain jour et relevé en ajout seul, nom brut de métrique, breakdown jsonb, `age_hours` ; alias versionné ; médiane par verticale, plateforme, pays, `as_of` |
| `tracked_link`, `link_click`, `conversion_event`, `coupon`, `coupon_redemption`, `whatsapp_inbound` | code, kind, utm jsonb, qr_svg ; clic avec `visitor_hash` salé ; événement d'affaires avec `kind`, `value`, `currency`, `source`, `ctwa_clid`, `sent_to_capi_at` ; conversations entrantes avec `referral`, `first_reply_at` |
| `inbox_item` | commentaire ou message, classe (question, achat, spam, critique, sensible, compliment), brouillon, répondu_par, `human_agent`, délai |
| `whatsapp_template`, `whatsapp_optin`, `tarifs_whatsapp` | catégorie, statut, reclassement ; opt-in : date, source, texte, numéro haché ; grille Meta par marché datée (R22 §10.16) |
| `cost_ledger`, `tenant_budget` | réservation puis réalisation par appel, fournisseur, modèle, partitionné par mois ; plafonds jour et mois par type, vérifiés avant chaque appel (R25 §11.12) |
| `external_ref` | polymorphe : Canva, Higgsfield, YouTube, conteneurs Meta, publish_id TikTok, batch_id Anthropic, custom_id |
| `monthly_report` | période, pdf_ref, résumé WhatsApp, payload figé des trois couches |
| `audit_log` | acteur, action, objet, avant, après, voie ; ajout seul |

Rôles Postgres : `migrator`, `app_rw` (FORCE ROW LEVEL SECURITY, sans BYPASSRLS), `app_ro`, `backup` ; variable `app.tenant_id` posée par Drizzle dans chaque transaction par un helper qui génère la politique restrictive ; batterie d'isolation automatisée à chaque migration, générée par le skill `agents-base-donnees` (/db) avant la première ligne de code (R25 §9.17). Un seul Postgres, jamais une base par client (R25 §11.6).

### Sécurité, sauvegardes, fin de contrat

Chiffrement par enveloppe des jetons, rafraîchissement Meta à J-5 et alerte à J-10, rafraîchissement TikTok avant chaque publication (R02 §12.9) ; clés IA de l'agence en variables du seul service `worker`, projet OpenAI avec plafond dur mensuel et clés expirant à 90 jours (R25 §11.12) ; aucun mot de passe de client, accès par rôles et Business Manager uniquement, révocation en un clic (R08 §10.14). Sauvegardes : instantanés de volume (quotidien, hebdomadaire, mensuel), PITR, `pg_dump` hebdomadaire chiffré hors Railway, exercice de restauration trimestriel chronométré (R25 §11.8). Fin de contrat outillée : job `tenant_offboard` avec export ZIP, manifeste, sommes de contrôle, suppression vérifiée du préfixe et des lignes, suppression de la DEK, attestation PDF (R25 §11.9).

### Coûts d'hébergement

85 à 110 $ par mois à 6 clients, 230 à 290 $ à 20 clients, soit 12 à 18 $ par client, hors génération et hors licence Remotion ; moins de 2 % du chiffre d'affaires (R25 §8). Ajouter R2 sous 20 $ si l'exception est retenue.

---

## 12. Coûts et modèle économique

### 12.1 Coût mensuel détaillé par client type (dollars US, prix d'octobre 2026)

Hypothèses communes : socle partagé (veille 60 à 170 $, Canva Business 20 $ par utilisateur, Remotion gratuit tant que l'effectif reste à 3 personnes au plus, Langfuse 0 à 29 $, Upload-Post Pro 50 $ et Blotato Starter 29 $ ; l'abonnement Claude Max de José n'est pas imputé) soit 150 à 300 $ par mois, 20 à 40 $ par client à 8 clients, 8 à 15 $ à 20 clients. Hébergement 12 à 18 $ par client (R25 §8). Mesure 1 à 3 $ (R24 §8). WhatsApp provisionné à 1 $ (R22 §10.16). Jetons Claude 9 à 14 $ après majoration du tokenizer (R07 §7, R26 §5.8). Humain : 4 à 6 heures par client (R08 §6.3).

**Client A : église d'Abidjan, palier Chaire (4 sermons, 20 clips, 10 citations par sermon, dévotionnels, 2 comptes, publication, rapport)**

| Poste | Coût mensuel |
|---|---|
| Transcription (4 × 1,5 h × 0,21 $) | 1,3 $ |
| Analyse LLM sermons (4 × 0,14 $, 0,07 $ en Batch) | 0,3 à 0,6 $ |
| Autres jetons (citations, dévotionnels, juges, rapport) | 4 à 6 $ |
| Rendu ffmpeg, libass, Remotion CPU ; Remotion Lambda en pointe | 0,5 à 1,5 $ |
| Images (cartes de versets en HTML, miniatures) | 0,5 à 1 $ |
| Enregistrement Daily (si régie équipée) | 4,8 $ |
| Veille profil léger | 5 à 10 $ |
| Hébergement, stockage (proxy 720p) | 12 à 18 $ |
| Mesure, WhatsApp | 2 à 4 $ |
| Part du socle partagé (8 clients) | 20 à 40 $ |
| **Total hors humain** | **50 à 85 $** |
| Gestionnaire local 4 heures (R08 §6.3) | 20 000 à 30 000 FCFA, soit 33 à 50 $ |
| **Total avec humain** | **85 à 135 $** |

Prix de vente Chaire à Abidjan : 175 000 FCFA, soit environ 287 $ à 610 FCFA par dollar (R10 §9.9). Marge brute : 53 à 70 %. Au Canada, Chaire à 450 CAD (environ 325 $ à 1,38 CAD par dollar, taux à ajuster) avec gestionnaire canadien 2 heures (80 à 100 CAD) : marge brute 55 à 65 %. Comparaison marché : Sermonshots 53 à 97 $ par mois sans français, sans validation, sans publication ; Pulpit AI 39 à 129 $ ; Church Media Squad 1 697 $ en service humain (R05 §4).

**Client B : marque de beauté d'Abidjan ou de Toronto, palier Vidéo+ (12 Reels, 8 carrousels, 4 UGC, boîte de réception, boost supervisé)**

| Poste | Coût mensuel |
|---|---|
| Vidéo générative (12 Reels à 5 à 6,50 $, 4 UGC à 1,70 à 3,80 $) | 67 à 93 $ |
| Planches et prises écartées | 20 à 30 $ |
| Images, détourage, carrousels, QC | 3 à 6 $ |
| Jetons Claude (création, juges, veille standard, inbox 2 000 commentaires) | 12 à 20 $ |
| Veille profil standard (scrapers Instagram et TikTok compris) | 12 à 25 $ |
| Voix, musique, rendu | 3 à 8 $ |
| Extraction INCI, WhatsApp, mesure | 3 à 5 $ |
| Hébergement | 12 à 18 $ |
| Part du socle partagé | 20 à 40 $ |
| **Total hors humain** | **152 à 245 $** |
| Gestionnaire 6 heures : Abidjan 45 000 FCFA (74 $) ; Canada 300 CAD (217 $) | 74 à 217 $ |
| **Total avec humain** | **226 à 320 $ (Abidjan) ; 370 à 460 $ (Canada)** |

Prix de vente Vidéo+ : 550 000 FCFA (environ 900 $) à Abidjan, marge brute 64 à 75 % ; 1 800 CAD (environ 1 300 $) au Canada, marge brute 65 à 72 %. Comparaison marché : pack vidéo d'agence à Abidjan 750 000 à 900 000 FCFA produit à la main (R10 §7.1) ; Montréal 2 500 à 3 500 CAD ; Predis Rise 55 $ en qualité gabarit sans gestionnaire.

**Client C : école supérieure (2IAE), palier Présence élargi (12 visuels, 4 vidéos programmées, 2 carrousels, 5 posts Facebook par semaine, LinkedIn, WhatsApp hebdomadaire, rapport avec GA4)**

| Poste | Coût mensuel |
|---|---|
| Images et carrousels (coût quasi nul en composition HTML) | 2 à 4 $ |
| Vidéos programmées Remotion (comptes à rebours, résultats, récaps montés, miniatures) | 2 à 5 $ |
| Clips génératifs occasionnels (2 teasers de rentrée par an, lissés) | 2 à 4 $ |
| Jetons Claude | 9 à 14 $ |
| Veille standard (calendrier académique, site, LinkedIn, actualité des filières) | 12 à 20 $ |
| Hébergement, mesure, WhatsApp | 15 à 22 $ |
| Part du socle partagé | 20 à 40 $ |
| **Total hors humain** | **62 à 109 $** |
| Gestionnaire 5 heures à Abidjan | 35 000 FCFA, soit 57 $ |
| **Total avec humain** | **120 à 166 $** |

Prix de vente Présence à Abidjan : 300 000 FCFA (environ 490 $), marge brute 66 à 76 %. (Pour 2IAE, client interne, le coût direct est l'information utile : moins de 170 $ par mois pour une présence quotidienne mesurée jusqu'aux dossiers d'admission.)

Récapitulatif : coût direct mensuel, humain compris, de 85 à 135 $ pour une église, 226 à 460 $ pour une marque de beauté en Vidéo+, 120 à 166 $ pour une école. Le poste humain reste le premier ; la vidéo générative est le seul poste variable qui dérape (R08 §6.3) ; l'hébergement pèse moins de 2 % (R25 §11.18).

### 12.2 Tarifs de vente par marché

| Palier | Abidjan (FCFA) | Canada (CAD) | France (EUR) | Justification |
|---|---|---|---|---|
| Chaire | 175 000 | 450 | 350 | 2 à 4 fois Sermonshots, 5 à 10 fois sous Church Media Squad, français et publication inclus (R05 §8.18) |
| Présence | 300 000 | 900 | 700 | bas de la fourchette Abidjan (300 000 à 900 000), bas de Montréal (500 à 3 500), forfaits français 400 à 1 500 € (R08 §6.1, R10 §7.1) |
| Vidéo+ | 550 000 | 1 800 | 1 400 | sous les packs vidéo locaux (750 000 à 900 000 FCFA ; 2 500 à 3 500 CAD) avec plus de vidéos |
| Logiciel seul | 60 000 | 150 | 110 | au-dessus du plafond SaaS de la validation seule (15 à 50 $, R08 §5) parce qu'il inclut veille, planche, production et publication |
| Option boîte de réception (hors Vidéo+) | 40 000 | 120 | 90 | ManyChat Pro 29 à 39 $ par compte sans la voix du client (R23 §8.1) |
| Option boost supervisé | budget du client + 15 % de gestion, plafond au contrat | idem | idem | jamais de boost automatique (R23 §8.11) |

Facturation : Stripe au Canada (2,9 % + 0,30 CAD, Billing 0,7 %, taxes TVH), Wave Business ou CinetPay à Abidjan (1 à 2 %, lien de paiement envoyé sur WhatsApp chaque mois, relance utilitaire 3 jours avant l'échéance, suspension douce après 30 jours : plus de nouvelles propositions mais les publications programmées partent, R10 §8.11). Prix révisés chaque année ; surcoût par prise vidéo au-delà du plafond ; préavis de 30 jours (R08 §8.1.12).

### 12.3 Marge et structure de coûts à 8 puis 20 clients

Phase 1, 8 clients (3 églises Chaire Abidjan, 2 beauté Vidéo+ dont 1 au Canada, 1 association Présence Canada, 2IAE et SEVARTA en interne) : chiffre d'affaires externe d'environ 3 500 à 4 000 $ par mois ; coûts directs variables 800 à 1 300 $ ; socle partagé 150 à 300 $ ; hébergement 85 à 110 $ ; un gestionnaire à Abidjan 350 000 FCFA (575 $) ; marge brute d'exploitation 45 à 60 % avant le temps de José et avant le développement.

Phase 2, 20 clients (7 églises, 5 beauté, 3 associations, 2 écoles, 3 B2B et édition) : chiffre d'affaires 10 000 à 13 000 $ ; coûts directs 2 200 à 3 500 $ ; socle 200 à 350 $ (Remotion Automators 100 $ dès que l'effectif dépasse 3, Upload-Post Advanced 147 $ puis apps propres à 0 $) ; hébergement 230 à 290 $ ; deux gestionnaires (un à Abidjan, un au Canada à temps partiel) 2 000 à 2 500 $ ; marge brute 55 à 65 %.

### 12.4 Ce que la machine fait gagner par rapport aux outils du marché, pour 10 clients

Hootsuite Professional à 3 sièges 597 $ (R26 §5.18), Planable Pro 490 $, Linktree Pro 150 $, AgencyAnalytics 200 $, ManyChat Pro 290 à 390 $, Sermonshots pour 5 églises 265 à 485 $ : 2 000 à 2 400 $ par mois d'abonnements pour une couverture partielle, sans veille locale, sans planche WhatsApp, sans vidéo réelle, sans couche affaires. La machine remplace cet empilement pour 300 à 450 $ de socle et d'hébergement et 10 à 14 $ de jetons par client.

### 12.5 Seuil de rentabilité

Coûts fixes mensuels de phase 1 : socle 150 à 300 $, hébergement 85 à 110 $, gestionnaire 575 $, provision d'outils personnels de José 200 $ ; total 1 000 à 1 200 $. Contribution moyenne par client (prix moins coûts variables hors gestionnaire) : Chaire Abidjan 230 $, Présence Abidjan 390 $, Vidéo+ Abidjan 680 $, Vidéo+ Canada 1 050 $, Présence Canada 550 $. Avec un mélange réaliste (contribution moyenne 350 à 450 $), le seuil est à **trois clients payants** pour couvrir les fixes et à **six clients** pour dégager en plus 1 500 $ par mois rémunérant le temps de José. Au-delà de 12 clients par gestionnaire, un second gestionnaire s'ajoute par paliers de 575 à 2 000 $ selon le pays.

---

## 13. Risques, limites et garde-fous

### Juridiques

| Risque | Parade |
|---|---|
| Droits sur les contenus générés : une image brute n'a probablement pas d'auteur au Canada, en France ni dans l'OAPI (R08 §7.1) | contrat : licence d'usage commercial illimitée cédée, aucune promesse d'exclusivité sur les éléments bruts, preuve de l'apport humain et des licences de moteurs conservée par média (registre de provenance) |
| Palier gratuit d'un moteur pour un contenu publié (Suno Free, ElevenLabs Free non commerciaux ; Google gratuit et Higgsfield hors Enterprise entraînent sur les données, R08 §10.9) | un compte payant par moteur au nom de l'agence, plan vérifié avant export, sous-licence au client |
| Étiquetage IA : AI Act article 50 applicable depuis le 2 août 2026, TikTok depuis le 24 septembre 2026, Meta et YouTube par auto-déclaration (R08 §7.6) | drapeaux « réaliste » et « personne réelle » par variante, `is_ai_generated` à la publication, mention dans la légende pour l'UE, métadonnées C2PA jamais retirées, 20 % du mix en contenu 100 % humain |
| Droit à l'image, mineurs, fidèles, participants (R08 §7.4) | registre de consentements relié à chaque média, floutage automatique du public des sermons, aucun enfant, blocage de toute publication sans consentement actif, clause d'information de l'assemblée |
| Allégations cosmétiques (Santé Canada, règlement 655/2013, Meta du 23 juillet 2026) | lexique d'allégations par pays, contrôle de chaque légende, texte incrusté et voix off avant la planche, refus possible sans manquement contractuel, exclusion de l'éclaircissement |
| Anti-pourriel et messagerie : CASL (jusqu'à 10 M$ par violation), politique WhatsApp du 23 septembre 2026 (R08 §7.9) | opt-in nominatif en deux cases au contrat, journal de preuve, STOP automatique, modèles approuvés, deux rappels maximum, aucune prospection sortante depuis la machine |
| Données personnelles : LPRPDE, Loi 25 (jusqu'à 10 M$ ou 2 % administratif, 25 M$ ou 4 % au pénal, R26 §2.9), RGPD, loi ivoirienne 2013-450 | sous-traitants et région documentés par client, évaluation avant transfert hors Québec, déclaration ARTCI vérifiée, José responsable de la protection pour Markel-Tech, hachage des IP et numéros, offboarding outillé |
| Conditions des plateformes : YouTube interdit le téléchargement, LinkedIn interdit l'automatisation de profil, TikTok interdit les outils d'engagement artificiel (R08 §7.8) | fichier source fourni par l'église, API officielles seulement, pas d'automatisation de profil LinkedIn, pas de service WhatsApp non officiel |
| Scraping TikTok Creative Center par Apify (R06 §3.3) | isolé des comptes clients, clause au contrat, bascule configurable |

### Techniques

| Risque | Parade |
|---|---|
| Dépréciations trimestrielles (gpt-image-1 le 23 octobre 2026, gpt-image-1.5 le 1er décembre 2026, Sora 2 retirée, 40 métriques Facebook retirées le 15 juin 2026, LinkedIn 202510 retirée le 15 octobre 2026) | abstraction de chaque moteur et connecteur, repli, versions en paramètres, `metric_alias`, tests hebdomadaires, contrôle trimestriel des pages primaires avec diff et alerte (R26 §5.19) |
| Dépendance à l'API unifiée | paquet manuel, demandes d'accès propres dès le mois 1, bascule à 12 mois |
| Jetons expirés, PubSubHubbub non renouvelé (R21 §9.13) | rafraîchissement à J+50, réabonnement tous les 3 jours, état `a_reconnecter`, alerte |
| Plafonds : Instagram 50 ou 100 par 24 heures, Facebook Reels 30, TikTok 6 par minute, YouTube 100 uploads par jour | compteurs locaux, file avec reprise, lecture de `content_publishing_limit`, second projet Google au-delà de 30 clients vidéo |
| Routines en aperçu, `/fire` sans idempotence (R07 §10.4) ; Higgsfield : suspension possible | journal des tirs, rien de critique ne dépend d'une Routine ; API officielle seulement, Unlimited hors chemin critique |
| Worker qui boucle, dérive de coût | `cost_ledger` et `tenant_budget` avant chaque appel, limite dure Railway, plafond OpenAI par projet |
| Buckets Railway sans versionnage ni cycle de vie | job de rétention maison, copie des originaux hors Railway, PITR, `pg_dump` hebdomadaire, restauration testée |

### Qualité (slop)

56 % des utilisateurs voient du « AI slop » souvent, 50 % de la génération Z ont déjà bloqué une marque pour cela, et YouTube ne monétise plus les contenus « qui ont l'air faits avec un gabarit » depuis juillet 2026 (R11 §1). Parades : juge à sept critères avec test de substitution et seuil 15/21, ancrage réel obligatoire, liste française d'interdits lexicaux construite par statistique et révisée chaque trimestre, introduction originale par clip de sermon pour échapper au critère « gabarit », calibration mensuelle du juge sur des notes humaines, second juge d'une autre famille, QC vision avant chaque planche, 20 % de contenus humains fournis par le client, indicateurs « à la page » publiés au client. Limite honnête : Claude ne détecte pas les images synthétiques et ne nomme pas les personnes (R07 §11.14) ; la détection de « ça a l'air IA » n'est pas supportée (R11 §15.5).

### Opérationnels

| Risque | Parade |
|---|---|
| Client silencieux, production bloquée | règle « sans réponse » contractuelle, deux rappels puis humain, alerte risque de départ |
| Gestionnaire débordé | 8 à 12 clients par gestionnaire, files triées, actions en un clic, temps mesuré |
| Promesse excessive (« vous détenez les droits », « boutique Facebook avec paiement » alors que les Shops ne sont pas offerts en Côte d'Ivoire, R23 §8.19) | contrat type en trois versions relu par un avocat de chaque pays ; la plateforme dit ce qu'elle livre et ce qu'elle ne peut pas livrer |
| Fêtes lunaires et événements annulés | fenêtres de plus ou moins deux jours, revérification 48 heures avant |
| Forfaits data limités (1,5 Go par jour) | profil d'export « Afrique mobile », audio seul par WhatsApp pour les sermons, planche sous 5 Mo |
| Confusion avec le campus 2IAE | projet Railway séparé, lecture seule des données publiques, aucune action sur le service `campus` |

---

## 14. Feuille de route

### Ce qui est acheté et ce qui est construit

**Acheté ou loué** : publication multi-plateformes (Upload-Post ou Zernio, Blotato pour TikTok, puis apps propres), transcription (AssemblyAI), génération (OpenAI, Gemini, fal, Higgsfield API, ElevenLabs), détourage (Photoroom), veille (SerpApi, Apify, Tavily, Firecrawl), composition de marque partagée (Canva Business), messagerie (WhatsApp Cloud API en direct, Resend), observabilité (Langfuse), découpage de clips bruts pendant la construction (Vizard ou Klap). Rien de tout cela ne différencie.

**Construit** : cerveau de marque et doctrine exécutable, juge, veille locale et calendrier des moments, planche et validation WhatsApp, pipelines Chaire et Dépôt, composition HTML et Remotion par client, poste de pilotage, boîte de réception, mesure en trois couches avec lien en bio, QR, coupons et CAPI WhatsApp, rapport mensuel, serveur MCP, modèle de données multi-locataires.

### Phases

**Phase 0 (2 semaines, octobre 2026) : fondations et demandes d'accès.** Skill `/db` sur le schéma Postgres (RLS, rôles, batterie d'isolation) ; projet Railway « machine », buckets, PITR ; compte WhatsApp Business Platform direct, entreprise vérifiée, deux numéros, six modèles utilitaires soumis ; demandes Meta, Google, TikTok, LinkedIn et Google Business Profile lancées en parallèle ; comptes payants par moteur ; contrat type en trois versions chez l'avocat ; retrait de gpt-image-1 et 1.5 de tout code avant le 23 octobre. Sortie : schéma validé par la batterie d'isolation, premier message utilitaire reçu depuis le numéro machine, demandes d'accès déposées avec captures datées.

**Phase 1 (6 semaines, mi-octobre à fin novembre 2026) : Chaire, premier produit vendable.** Pipeline sermon complet, planche de 8 vignettes, validation WhatsApp en un tap, publication par API unifiée (TikTok via Blotato), dévotionnel Channel en paquet manuel, relevés J+1 à J+30, rapport minimal. Pilotes : une église d'Abidjan avec régie et, en interne, SEVARTA avec les prédications d'un auteur. Sortie (R05 §8.20) : WER mesuré sur 5 sermons contre un second moteur, acceptation des propositions par le pasteur supérieure à 70 %, 100 % des sermons réemployés sous 7 jours, coût réel par sermon sous 3 $, délai dépôt vers planche sous 24 heures.

**Phase 2 (8 semaines, décembre 2026 à janvier 2027) : Dépôt et Présence.** Cerveau de marque et fiche de voix, juge calibré sur 100 posts notés par José par verticale, veille en trois flux et calendrier des moments (Noël, Saint-Valentin, Ramadan 2027 dès le 18 février, Mois de l'histoire des Noirs), planche hebdomadaire générique, composition HTML et carrousels, Reels produit par API Higgsfield et Gemini avec plafond de prises, extraction INCI et flyers, boîte de réception dès obtention des permissions Meta, lien en bio, QR, coupons, rapport en trois couches. Pilotes : une marque de beauté d'Abidjan, 2IAE pour la réorientation de janvier et février, une association de la diaspora à Toronto pour février. Sortie : passage du juge supérieur à 70 % au premier coup, acceptation des planches supérieure à 70 %, délai tendance vers publication sous 72 heures, couche affaires non vide pour chaque pilote, génération sous le plafond contractuel.

**Phase 3 (4 semaines, février 2027) : interopérabilité et pilotage.** Serveur MCP « machine-social » avec OAuth 2.1 ; Routines « revue hebdomadaire » et « incident » ; PWA gestionnaire avec Web Push ; sorties vers Metricool MCP et Blotato MCP ; Langfuse ; tests hebdomadaires de collecte et de publication ; contrôle trimestriel des pages primaires. Sortie : José exécute une revue hebdomadaire depuis Cowork via le MCP sans ouvrir la PWA ; un client « logiciel seul » publie via Metricool.

**Phase 4 (mars à juin 2027) : preuve à 90 jours et passage à l'échelle.** Revue à 90 jours de chaque pilote (avant et après sur les quatre indicateurs « à la page » et la couche affaires), témoignages, grille de prix définitive, pilotes au plein tarif, recrutement du gestionnaire à Abidjan, bascule vers les apps propres dès obtention des accès, médianes locales en remplacement des benchmarks encodés, boost supervisé et Thought Leader Ads pour Markel-Tech, vente de Chaire à cinq églises supplémentaires. Sortie : 8 clients payants, marge brute mesurée supérieure à 50 %, aucun client perdu pour « pas à la page ».

### Premier client pilote

Une église d'Abidjan dont le pasteur a déjà une audience vidéo et une régie (le compte du pasteur fait 4 à 10 fois celui de l'église, R09 §11.7) : coût direct sous 10 $ par sermon, chaîne 85 % automatisable, preuve visible en deux dimanches, et le produit Chaire se vend ensuite seul. Offre pilote : 90 jours à 50 % du tarif contre données, témoignage et autorisation de référence.

---

## 15. Questions ouvertes pour José

1. **Stockage hors Railway.** La contrainte du 1er octobre 2026 exclut tout bucket chez un autre fournisseur. Les rapports recommandent pourtant deux exceptions précises : une copie de sauvegarde des originaux et des `pg_dump` hors Railway, seule chose qui survit à la suppression d'un projet (R25 §11.8), et un domaine public stable devant un bucket Cloudflare R2 pour TikTok PULL_FROM_URL (R25 §11.2). FILE_UPLOAD couvre TikTok sans R2 ; la sauvegarde, elle, n'a pas d'équivalent sur Railway. Acceptes-tu une copie chiffrée hors Railway pour les sauvegardes seulement, ou préfères-tu un second projet Railway dans une autre région comme copie ?

2. **Effectif et licence Remotion.** La licence est gratuite jusqu'à 3 personnes ; au-delà, ou si la plateforme vend des rendus automatisés à des clients, Automators coûte 100 $ par mois minimum (R04 §4, R25 §8). Quel est l'effectif réel de Markel-Tech, et faut-il vérifier auprès de Remotion si « vendre des rendus à des clients » s'applique ?

3. **Grille de prix.** Les fourchettes d'agence à Abidjan et en France sont des estimations faute de pages primaires (R08 §9.5, R10 §9.8). Peux-tu obtenir trois devis réels à Abidjan et trois en Ontario avant de figer les tarifs de la section 12.2 ? Et quel taux de change de référence (610 FCFA par dollar, 430 par dollar canadien dans les rapports) veux-tu retenir pour les devis ?

4. **Gestionnaire : où et quand.** Le modèle économique repose sur un gestionnaire local à Abidjan (250 000 à 350 000 FCFA) dès 4 à 6 clients. Veux-tu recruter avant le premier client payant, ou tenir toi-même les portes humaines pendant les pilotes ?

5. **Règle « sans réponse » par défaut.** Après deux rappels : publier les contenus valeur et relation et retenir la promotion, ou tout retenir ? Les deux sont défendables au contrat (R08 §8.1.2) ; le choix par défaut à l'onboarding doit être le tien.

6. **Sermons : original ou proxy.** Conserver l'original 1080p (environ 3 Go, 2,40 $ par mois par église au bout d'un an) ou un proxy 720p plus l'audio (1 Go) alors que l'église garde la source sur YouTube (R25 §11.5) ?

7. **Clé Claude et abonnement Max.** La plateforme doit payer les jetons à l'usage sur une clé API séparée (R07 §11.17). Acceptes-tu que Cowork, Chrome et Routines restent tes outils personnels, non facturés aux clients, ou veux-tu un abonnement Team pour l'agence ?

8. **TikTok avant audit.** Passer par Blotato (29 $ par mois, audit porté par Blotato) dès la phase 1 pour les églises et la beauté, ou attendre l'audit de notre propre app et publier en paquet manuel entre-temps (R26 §5.14) ?

9. **Higgsfield et entraînement.** Hors contrat Enterprise, les références envoyées peuvent entraîner les modèles de Higgsfield (R26 §5.12). Veux-tu négocier un contrat Enterprise si le volume le justifie, ou exclure simplement les visages de pasteurs, d'auteurs et de fondatrices des références ?

10. **Région et droit.** Pour un client québécois, une évaluation avant communication hors Québec est exigée ; pour Abidjan, la déclaration à l'ARTCI est à vérifier (R25 §11.16). Qui est l'avocat de référence dans chacun des trois pays pour relire le contrat type en trois versions ?

11. **2IAE et le site.** La couche affaires pour 2IAE suppose trois événements GA4 sur www.2iae.com, à demander à la session du site (R24 §10.17). Donnes-tu cette consigne, et veux-tu que la machine lise d'autres données publiques du campus (sujets des cours de la semaine) pour la vie de campus ?

12. **Marque et nom du produit.** « Chaire » pour l'offre église et « Dépôt » pour l'offre beauté sont des noms de travail. Faut-il une marque distincte de Markel-Tech pour vendre la machine à d'autres agences (palier logiciel, MCP exposé), ou rester une offre de service Markel-Tech ?
