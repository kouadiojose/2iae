# C2. La cliente d'abord : conception d'une machine social media multi-clients centrée sur l'expérience du client et du gestionnaire

Conception rédigée le 2 octobre 2026 pour José Kouadio (Markel-Tech, SEVARTA, 2IAE), à partir des dix-sept rapports de recherche R01 à R26. Angle retenu : l'expérience vécue par la cliente beauté, le pasteur, le président d'association, l'éditeur, l'école et l'agence, et celle du gestionnaire humain qui les sert. Chaque écran et chaque message sont décrits. En cas de contradiction entre rapports, R26 prévaut. Aucune fonctionnalité qui n'existe pas dans les rapports n'est supposée.

Convention : les prix sont en dollars américains sauf mention (CAD, EUR, FCFA), datés des 1er et 2 octobre 2026. Les références renvoient aux rapports (par exemple R22 §3.5).

---

## 1. Thèse en une page

### 1.1 La phrase de positionnement

« Chaque semaine, votre gestionnaire vous envoie sur WhatsApp la planche de ce qu'il propose de publier pour vous, en images. Vous répondez en un tap. Ensuite il produit, publie, répond, et vous prouve en une page ce que cela rapporte. »

L'IA est l'atelier, pas l'enseigne. R08 §10.1 le démontre : 30 % des agences voient leur valeur perçue baisser quand le client croit que l'IA réduit les coûts, et près d'un tiers des consommateurs rejettent les marques aux publicités IA. La machine se vend donc comme un service humain outillé, livré dans l'application que le client ouvre déjà vingt fois par jour (WhatsApp, R10 §2.3).

### 1.2 Les cinq choix qui rendent la machine supérieure au marché

1. **La planche hebdomadaire validée par WhatsApp est l'unité de travail, pas le post.** Aucun outil du marché n'a cette unité (R01 §8.2, R08 §4.1) : Planable valide des posts, Gain a le lien magique mais pas la production, Predis produit sans validation. La planche coûte 0,03 à 0,20 $ à produire (R08 §4.1) et son envoi 0,0040 $ en Côte d'Ivoire (R22 §3.5). Le client valide une séquence entière (lancement produit en cinq étapes, sortie de livre en huit) et non un post isolé (R09 §11.15).
2. **Le dépôt par WhatsApp est la porte d'entrée de la matière première.** Une photo de produit, un vocal, un flyer, l'audio d'un sermon : la machine accuse réception en moins d'une minute avec un résumé structuré et deux boutons (« C'est bien ça ? »), ce qui est la couche de qualité la moins chère de toute la chaîne (R21 §9.10). Le portail web ne sert qu'aux lots et aux vidéos lourdes (R21 §9.11).
3. **Production en deux temps : maquette avant validation, qualité production après.** Les maquettes de planche sont générées en qualité basse (moins de 0,10 $ pour six maquettes, R03 §12.5), les vidéos en mode brouillon (1 prise), et la production haute définition ne démarre qu'après le oui du client, ce qui divise par 5 à 10 le coût de ce qui n'est pas validé (R04 §8.3). C'est exactement le « est-ce que ça vous convient, madame ? » de José.
4. **Un gestionnaire humain à trois portes, outillé par un poste de pilotage à files.** Porte 1 avant l'envoi de la planche, porte 2 la validation client, porte 3 le contrôle du rendu final (R01 §8.9). Le gestionnaire ne regarde jamais un calendrier vide : il traite des files (à relire, en attente, à contrôler, à publier à la main, commentaires sensibles, jetons à reconnecter) avec une action par ligne.
5. **Le rapport mensuel d'une page relie le travail au revenu, et affiche les quatre indicateurs « à la page ».** « Reliez la performance au revenu » est la question numéro un des clients en 2026 (55 % des 494 agences interrogées, R08 §3.1). Le rapport met la couche affaires en haut (R24 §10.1) et chiffre nommément les reproches des clients perdus : délai tendance vers publication, taux de nouveautés exploitées, taux de vidéos, taux de sermons réemployés (R11 §12).

### 1.3 Prix de vente visé et coût par client

Trois paliers par client et par mois, tout compris (planches, production, publication, réponses, rapport), avec un nombre explicite de vidéos et de visuels (R08 §10.4, R10 §8.12) :

| Palier | Contenu mensuel | Abidjan (FCFA) | Canada (CAD) | France (EUR) |
|---|---|---|---|---|
| Présence | 12 visuels ou carrousels, 4 vidéos courtes, 2 plateformes, planches hebdomadaires, rapport mensuel | 300 000 | 1 200 | 900 |
| Croissance | 16 visuels, 8 vidéos dont 4 génératives, réponses aux commentaires, 3 plateformes | 550 000 | 2 000 | 1 500 |
| Sermon (églises) | 4 sermons découpés en 20 à 24 clips, 28 citations animées, dévotionnel WhatsApp quotidien, chapitrage YouTube, 2 comptes (église et pasteur) | 350 000 | 1 400 | 1 100 |

Coût direct par client hors gestionnaire humain : 45 à 115 $ en palier Présence (R08 §6.3), 60 à 130 $ en Croissance, 45 à 70 $ en Sermon (détail en section 12). Le gestionnaire ajoute 4 à 6 heures par client et par mois, soit 20 000 à 45 000 FCFA à Abidjan ou 160 à 300 CAD au Canada (R08 §6.3). La marge brute dépasse 60 % au Canada et 50 % à Abidjan (R08 §6.3).

---

## 2. Les personnes

### 2.1 José

Fondateur, vendeur, auteur de la doctrine et, pour quelques pièces signature, réalisateur. Chaque lundi matin, un message WhatsApp du numéro machine : « Semaine 41 : 7 planches à relire, 2 clients en silence depuis 5 jours, 1 jeton Instagram à reconnecter (Église de Yopougon), coût de la semaine passée 212 $ », avec trois boutons (« Voir », « Approuver tout ce qui est prêt », « Reporter »). Dans la PWA, un écran « Portefeuille » : une ligne par client avec un feu (vert, orange, rouge) et l'alerte « risque de départ » de R08 §10.18 (client qui ne valide plus, ne commente plus, ou dont les indicateurs baissent deux mois de suite).

Son atelier manuel reste hors chemin critique : Higgsfield Unlimited piloté par Claude in Chrome sert aux clips SEVARTA, car les conditions du 26 juillet 2026 (section 10.6) et le centre d'aide du 28 août 2026 interdisent l'automatisation de l'Unlimited (R26 §4b-4c, §5.10). Pour les pièces signature, la plateforme dépose des ordres sur son serveur MCP ; une tâche planifiée Cowork ou une Routine Claude Code vient les chercher, car aucune API publique ne permet de « déclencher Cowork » (R07 §11.10).

### 2.2 Le gestionnaire

Un gestionnaire à Abidjan (250 000 à 350 000 FCFA par mois, R08 §6.3) ou à Toronto (40 à 50 CAD de l'heure) sert 8 à 15 clients à 4 à 6 heures chacun. Il est relecteur, voix humaine, publieur et garant, pas graphiste ni monteur. Lundi : relecture des planches générées la nuit (5 minutes par planche, porte 1), correction des accroches, retrait d'une proposition risquée, ajout d'un fait qu'il connaît, envoi. Mardi et mercredi : retours « à revoir » (motif et vocal transcrit), relance des silencieux, réponses aux commentaires sensibles avec le clic obligatoire qui porte l'étiquette HUMAN_AGENT (R23 §8.5). Jeudi et vendredi : contrôle des rendus (porte 3 : lecture, orthographe, droits, étiquette IA), programmation, publications manuelles depuis les paquets prêts à publier. Premier lundi après le 3 : rapports mensuels et appel de revue de 20 minutes par client. Il ne cherche jamais un fichier, ne retape jamais un texte, n'ouvre jamais quatre onglets pour publier, ne calcule jamais un indicateur.

### 2.3 Les clients, par verticale

**Madame Koné, marque de beauté, Cocody.** Elle vit et vend dans WhatsApp ; son public est sur Facebook (8,4 millions en Côte d'Ivoire) et TikTok, pas sur Instagram (895 000, en recul, R10 §2.1). Le mardi à 10 h, elle reçoit « Votre planche n° 12 (8 propositions) est prête » avec une image composite et trois boutons ; elle valide en un tap ou laisse un vocal (« le sérum, c'est 12 000, pas 10 000 »). Quand une gamme arrive, elle photographie la face et l'étiquette INCI « en document » (R21 §9.4) ; une minute plus tard : « Reçu : Sérum Éclat, 30 ml, gamme Visage. On prépare le lancement ? » La planche lui dit ce qu'elle doit faire elle-même : filmer 20 secondes d'application sur sa main (R09 §3.8).

**Le pasteur et sa régie, Yopougon.** Le dimanche, la régie diffuse sur YouTube ; PubSubHubbub signale la vidéo en minutes (R21 §3.3) ; la machine demande le fichier (lien Drive pré-créé) ou l'audio seul par WhatsApp (43 Mo pour 90 minutes, R21 §3.5). Lundi midi, le pasteur reçoit 8 vignettes de clips (image du hook, titre, durée, verset, type de moment) et valide en un tap ; chaque clip est relu par lui ou un responsable, car un extrait hors contexte peut dire l'inverse du sermon (R05 §8.15). Les clips sortent du lundi au jeudi (R09 §2.2), sur le compte de l'église et sur celui du pasteur, qui fait 4 à 10 fois celui de l'organisation (R09 §11.7).

**Le président d'une association ivoirienne de Toronto.** Deux publics (R10 §8.17) : les membres (WhatsApp, Facebook, français) et la ville (Instagram, agendas BlogTO et Ottawa Festivals, anglais et français). Il dépose l'affiche de la prochaine soirée ; la machine extrait titre, date, lieu, prix (R21 §2.1) et propose la séquence J-21 teaser, J-14 genèse, J-7 programme, J-1 rappel, J+2 récap (R09 §4.8), validée en bloc. Il fournit les plans tournés pendant la soirée dans les 48 heures.

**SEVARTA.** Chaque titre déclenche une séquence de six semaines (R09 §6.3) ; la source est le manuscrit et les prédications YouTube de l'auteur, traitées par la chaîne sermon (R09 §11.6) ; aucune phrase inventée « à la manière de » l'auteur (R09 §6.7).

**2IAE.** Verticale la plus favorable (plus de quatre fois la médiane sur Instagram et TikTok, R09 §7.1). Déclencheurs : calendrier académique, site public, données publiques du campus seulement (R05 §8.17). Toute personne reconnaissable est reliée à une autorisation d'image, sinon le contenu est bloqué (R09 §7.7).

**Markel-Tech.** Deux comptes LinkedIn : la page (preuve) et José (expertise). Documents natifs et carrousels d'abord (7,00 % et 6,45 %, R09 §8.1), jamais de lien externe en premier. Déclencheur principal : un site client mis en ligne (R09 §8.8).

---

## 3. La routine : le cycle complet par client, comme une machine à états

### 3.1 Trois horloges et trois déclencheurs

La routine d'un client est pilotée par des horloges (planifiées) et par des événements (déclencheurs), jamais par un agent qui attend en consommant des jetons : l'attente est un état en base, la reprise est un nouveau job pg-boss (R07 §11.7).

Horloges, en heure du client (le fuseau est stocké par client et par public, R10 §8.7) :

| Horloge | Moment | Ce qu'elle fait |
|---|---|---|
| Veille | tendances toutes les 2 heures, sons chaque semaine, événements chaque semaine avec horizon de 6 semaines et revérification 48 heures avant (R06 §16.14) | alimente la table `signal` classée par pilier |
| Semaine | dimanche 22 h : consolidation de la veille et génération du calendrier de la semaine + 1 ; lundi 6 h : planche en brouillon ; mardi 10 h : envoi au client (après la porte 1) | crée la planche, l'envoie, arme les rappels |
| Mois | nuit du 3 au 4 : clôture des relevés ; premier lundi après le 3 : rapport mensuel avant 9 h (R24 §10.8) | génère le PDF d'une page et le résumé WhatsApp de cinq lignes |

Déclencheurs événementiels :

| Déclencheur | Source | Délai cible |
|---|---|---|
| Dépôt d'un produit, d'un flyer, d'une photo, d'un vocal | webhook WhatsApp Cloud API ou formulaire web | accusé de réception sous 1 minute, planche dédiée sous 24 heures (R21 §9.18) |
| Nouveau sermon | PubSubHubbub YouTube puis fichier Drive ou audio WhatsApp | planche de clips sous 24 heures (R21 §3.6) |
| Nouveauté sur le site du client | crawler maison, flux Shopify ou WordPress, changedetection.io (R06 §16.10-11) | contenu publié sous 72 heures (R11 §12) |
| Événement régional détecté | Google Events via SerpApi, pages Facebook publiques, flux RSS locaux (R10 §6) | proposition dans la planche suivante, publication sous 48 heures pour un récap |
| Fête ou moment du calendrier | table maison à trois couches (R10 §8.9) | proposition 10 jours avant |
| Commentaire ou message entrant | webhooks Meta | tri sous 5 minutes, brouillon de réponse, humain si sensible (R23 §8.4) |

### 3.2 Les états d'une semaine client

```
[veille_consolidee] --dimanche 22 h--> [calendrier_propose]
[calendrier_propose] --juge >= 15/21, mix 60/25/15 vérifié--> [planche_brouillon]
[calendrier_propose] --juge < 15/21 ou mix hors tolérance--> [regeneration] (2 fois max) --> [escalade_gestionnaire]
[planche_brouillon] --porte 1 : gestionnaire relit, corrige, approuve--> [planche_envoyee]
[planche_envoyee] --tap « Je valide tout »--> [validee]
[planche_envoyee] --Flow ou PWA : partiel--> [validee_partielle] + [items_a_revoir]
[planche_envoyee] --tap « À revoir » + motif ou vocal--> [a_revoir] --> version n+1 --> [planche_envoyee]
[planche_envoyee] --silence 48 h--> [rappel_1] --silence 5 jours--> [rappel_2] --silence 3 jours ouvrés--> [escalade_humaine]
[escalade_humaine] --appel ou message du gestionnaire--> [validee | a_revoir | regle_par_defaut]
[regle_par_defaut] : publie les items « valeur » et « relation » validés dans le cadre, retient les items « promotion » (ou l'inverse, choix coché à l'onboarding, R08 §8.1 clause 2)
[validee] --> [production] (rendu haute définition, 3 prises) --> [controle] (porte 3)
[controle] --gestionnaire : OK--> [programmee] --> [publiee] --> [mesuree J+1, J+7, J+30]
[controle] --défaut--> [retouche] (2 fois) --> [controle] ou [remplacement par un item de réserve]
[programmee] --échec API--> [a_publier_manuellement] (paquet prêt à publier)
```

Règles de temps par défaut, modifiables par client à l'onboarding :

- Validation attendue sous 3 jours ouvrés (clause 2 du contrat type, R08 §8.1).
- Deux rappels au maximum, J+2 et J+5, puis bascule vers le gestionnaire ; au-delà, les relances dégradent la note de qualité WhatsApp et tombent sous la politique « fréquence » du 23 septembre 2026 (R22 §10.10).
- Aucune publication d'un item « promotion », d'une allégation beauté, d'un extrait de sermon ou d'un média marqué « personne réelle » sans validation explicite (R08 §8.2.10).
- Items de réserve : chaque planche contient deux propositions « valeur » surnuméraires, validées dans le même geste, qui remplacent un item rejeté au contrôle sans repasser par le client.

### 3.3 Ce qui se passe quand le client ne répond pas

Le silence est un signal de rétention, pas seulement un blocage. À J+2, rappel utilitaire (« votre planche n° 12 attend toujours votre réponse », 0,0040 $). À J+5, second rappel avec un bouton « Appelez-moi ». À J+8, le gestionnaire appelle ; la fiche client passe en orange ; José le voit dans son message du lundi. Si la règle par défaut est activée, la machine publie les contenus « valeur » et « relation » (dévotionnel, agenda culturel, conseil beauté sans allégation) et retient tout ce qui engage le client commercialement. Deux semaines de silence consécutives déclenchent l'alerte « risque de départ » (R08 §10.18) et une proposition de revue à 30 minutes.

---

## 4. Les routines par verticale

Même gabarit partout : sources, déclencheurs, formats produits automatiquement, ce qui exige un humain. Cadences et ratios viennent de R09 §9 ; les chaînes de production sont détaillées en section 7.

### 4.1 Beauté : le dépôt de produits

- **Sources** : dépôt WhatsApp (photo de face et photo INCI envoyée « en document », R21 §9.4), fiches du site ou de la boutique (nouveauté, réassort, prix), commentaires (3 questions identiques = script de réponse vidéo), tendances et sons TikTok du pays (un run Apify quotidien partagé, R06 §16.4), calendrier commercial (Saint-Valentin, fête des mères, Tabaski, rentrée, Noël), saison (harmattan, hiver canadien).
- **Déclencheur produit** : extraction JSON par Sonnet 5.5 (nom, gamme, contenance, INCI ordonnée, allégations, prix ; environ 0,015 $, R21 §9.1), INCI vérifiée contre une base de noms (R21 §9.5), accusé de réception avec boutons, puis kit de lancement en cinq étapes (teaser J-3, unboxing J0, tutoriel J+3, carrousel teintes J+7, rappel WhatsApp J+10, R09 §3.8) envoyé comme planche dédiée sous 24 heures.
- **Formats automatiques** : packshot détouré puis mis en scène avec le packshot en référence (jamais de produit synthétisé, R03 §12.6), carrousels, visuels d'annonce, Reel programmé Remotion de 15 à 20 secondes, Reel génératif d'ambiance, scripts et sous-titres de tutoriel, légendes à 3 à 5 hashtags (plafond dur de 5, R26 §5.13), messages WhatsApp Channel préparés.
- **Humain obligatoire** : tout visage (GRWM, tutoriel, coulisses), chaque allégation (Santé Canada, règlement 655/2013, politique Meta du 23 juillet 2026 : avant-après autorisé, 18 ans et plus, aucune promesse chiffrée dans un délai, aucun message d'infériorité, R26 §5.15), tout comparatif avec une marque tierce, éclaircissement de la peau exclu par règle dure (R09 §3.7), réponses aux plaintes.
- **Cadence** : 4 vidéos, 2 carrousels, 1 vidéo Facebook, stories, 2 à 3 messages Channel par semaine ; mix 50 gestes, 25 communauté, 25 produit.

### 4.2 Association culturelle : événements régionaux et genèse

- **Sources** : page Facebook ou site de l'association, affiches déposées par WhatsApp, agendas de la ville (Abidjan.net, Life.ci ; GrandToronto, L-Express, BlogTO, Ottawa Festivals, R10 §6), pages Facebook publiques des festivals, journées internationales, calendrier à trois couches (FEMUA fin avril, MASA en avril des années paires, Afrofest mi-août, Francophonie en fête fin septembre, Mois de l'histoire des Noirs, R10 §8.9).
- **Déclencheurs** : nouvel événement → J-21 teaser, J-14 genèse, J-7 programme, J-1 rappel, J+2 récap ; événement régional tiers → carrousel « à voir cette semaine » ; journée internationale → citation animée (R09 §4.8).
- **Formats automatiques** : teaser motion design 10 à 20 secondes, genèse en carrousel ou vidéo 30 à 60 secondes avec recherche (Tavily, Exa), règle des deux sources dont une primaire et source affichée sous chaque fait (R06 §16.13), carrousels programme et agenda, légendes bilingues pour Toronto.
- **Humain** : portraits, directs, prises de vue pendant l'événement, vérification des faits de la genèse, crédits et autorisations d'image (R09 §4.7).
- **Cadence** : 3 publications par semaine hors événement, quotidien de J-21 à J+7 ; billetterie sous 15 %.

### 4.3 Église : le sermon YouTube

- **Sources** : chaîne YouTube par PubSubHubbub (réabonnement tous les 3 jours, R21 §9.13), fichier déposé par la régie (Drive partagé, salle Daily à 1,21 $ par sermon de 90 minutes, ou audio seul par WhatsApp, R21 §9.7-9.8 ; jamais de téléchargement depuis YouTube, R21 §9.6), calendrier liturgique (API AELF ou table évangélique : Avent, Carême, Pâques, jeûne de janvier, R09 §5.5), agenda de l'église, formulaire de témoignages.
- **Déclencheurs** : nouveau sermon → chaîne complète sous 24 heures (transcription, sélection par Claude des cinq types de moments avec exclusion des annonces, de la quête et de la prière finale, R05 §8.7 ; 6 extraits, 10 citations, dévotionnel 5 jours, chapitrage, article, guide de groupe) ; dimanche à J-3 → teaser ; fête liturgique à J-7 → série de citations ; témoignage reçu → consentement puis mise en forme.
- **Formats automatiques** : clips 9:16 en deux durées (30 à 60 secondes, et 2 à 3 minutes pour Instagram Reels et Shorts ; Facebook Reels limité à 90 secondes, R26 §5.1), citations animées, highlights typographiques, teaser du dimanche, dévotionnel WhatsApp, chapitrage et description YouTube, miniature.
- **Humain** : validation doctrinale et contextuelle de chaque extrait (pas de coupe au milieu d'un verset, R05 §8.15), message face caméra en semaine, témoignages, direct, demandes de prière (R23 §8.5) ; floutage du public et exclusion de tout enfant (R08 §7.4) ; aucun visage synthétique du pasteur (R03 §12.7).
- **Cadence** : un clip par jour du lundi au samedi, jamais les cinq le même jour (R05 §8.10), une citation par jour, deux annonces, dévotionnel quotidien, deux comptes (église et pasteur).

### 4.4 Édition : livres et auteurs

- **Sources** : base des titres (manuscrit, métadonnées, date de sortie), chaîne YouTube de l'auteur, avis sur la boutique et Amazon, calendrier liturgique, salons, Journée mondiale du livre le 23 avril (R09 §6.5).
- **Déclencheurs** : nouveau titre → séquence de six semaines (couverture J-42, extraits, précommande, interview, sortie, avis J+14, bilan J+30) ; sermon de l'auteur → extrait relié au chapitre ; avis 4 ou 5 étoiles → visuel « ils en parlent » ; fête liturgique → sélection thématique (R09 §6.8).
- **Formats automatiques** : citations animées, carrousel « 5 idées du chapitre », révélation de couverture, extraits de prédication par la chaîne sermon, audiogrammes, bande-annonce 15 secondes, visuels d'avis, newsletter, messages WhatsApp de précommande (R09 §6.4, R05 §8.16).
- **Humain** : lecture d'extrait par l'auteur (voix réelle, sinon voix de synthèse consentie et étiquetée), interview, validation doctrinale des résumés, salons ; aucune phrase inventée « à la manière de » l'auteur (R09 §6.7).
- **Cadence** : 4 à 5 publications par semaine ; mix 55 livre, 25 auteur, 20 promotion.

### 4.5 École : admissions et campus

- **Sources** : calendrier académique ivoirien (rentrée le 14 septembre 2026, inscriptions universitaires du 25 août au 30 septembre, pics d'admission en juin-juillet puis janvier-février, R10 §5.1), site www.2iae.com, résultats et classements, registre des autorisations d'image, publications des anciens sur LinkedIn ; données publiques du campus seulement (R05 §8.17).
- **Déclencheurs** : admission à J-30 → compte à rebours et carrousel ; rentrée à J-14 → série « bienvenue » et #openingweek ; résultat publié → visuel « victoire » ; événement terminé → récap sous 48 heures ; nouvelle formation → carrousel métiers ; actualité sectorielle → mini-cours proposé à un enseignant (R09 §7.8).
- **Formats automatiques** : comptes à rebours, visuels de résultats, carrousels métiers (export PDF pour LinkedIn), récaps montés depuis les plans fournis, tutoriels logiciel Remotion, message WhatsApp Channel hebdomadaire, miniatures YouTube.
- **Humain** : étudiants ambassadeurs, enseignants, témoignages, autorisation parentale pour tout mineur (R09 §7.7), réponses aux candidats (mot clé ADMISSION → réponse privée sous 7 jours, R23 §8.3).
- **Cadence** : 4 vidéos, 2 carrousels, 5 publications Facebook, stories, 1 message WhatsApp ; doublée en admission et en rentrée.

### 4.6 B2B : LinkedIn pour Markel-Tech

- **Sources** : registre des projets (chaque site mis en ligne), questions clients récurrentes, veille sectorielle, pages LinkedIn des clients (R09 §8.5).
- **Déclencheurs** : projet mis en ligne → avant-après à J+3, étude de cas en document natif à J+14 après accord écrit, témoignage à J+30 ; 3 questions identiques → check-list ; actualité majeure d'une plateforme → post d'analyse proposé à José ; fin de mois → sondage (R09 §8.8).
- **Formats automatiques** : documents natifs (7,00 %), carrousels (6,45 %), avant-après, sondages, motion design 15 à 30 secondes, newsletter mensuelle, visuels de témoignage ; jamais de lien externe en premier (3,25 %, R09 §8.1).
- **Humain** : posts texte et vidéos face caméra de José (trois angles proposés chaque semaine), accord des clients, vérification des chiffres ; aucune automatisation du profil personnel (interdit par LinkedIn, R08 §7.8) : la page passe par la Community Management API, les posts de José par un paquet prêt à publier.
- **Cadence** : 3 publications page, 1 vidéo, 3 à 5 posts de José, du mardi au jeudi entre 11 h et 17 h ; X plafonné à l'usage (0,015 $ par post, R02 §12.13).

---

## 5. La planche de propositions et la validation client

### 5.1 Contenu exact d'une planche

Une planche est une page visuelle unique, en deux rendus : une image composite 1080 × 1350 (moins de 5 Mo, en-tête du modèle WhatsApp) et une page PWA à 390 px de large, une carte par proposition (R22 §10.8, §7.2). Elle contient :

**En-tête** : logo du client, « Planche n° 12, semaine du 12 au 18 octobre », nombre de propositions, date limite de réponse (« merci de répondre avant jeudi 15 à 18 h »), mix de la semaine en trois pastilles (valeur 5, relation 2, promotion 1 : la machine refuse une semaine qui dépasse 15 % de promotion ou n'atteint pas 60 % de valeur, R01 §8.8, R06 §16.15).

**Six à dix cartes numérotées**, chacune avec :

1. La vignette : maquette basse définition (gpt-image-2.5-flare en qualité low, ou capture « frame 0 » de la composition Remotion pour une vidéo, R04 §8), ratio 4:5 ou 1:1, ou 9:16 réduit avec lecture au tap pour un brouillon vidéo (LTX-2.3 ou mode Lite, 1 prise, R04 §8.3). Un bandeau « MAQUETTE » en diagonale, pour que personne ne confonde avec le rendu final (R08 §4.1).
2. Plateforme, format et moment : « TikTok + Reels, vidéo 20 s, jeudi 15 octobre 18 h » (créneaux par fuseau et par pays, R10 §8.7).
3. Le hook en moins de 8 mots (R11 §8.2), en français parlé pour une cliente d'Abidjan si sa fiche de voix l'autorise (R10 §8.8).
4. Le texte de publication replié (« Lire la suite »), avec ses 3 à 5 hashtags.
5. Le pilier (valeur, relation, promotion) et le cadre (PAS, AIDA, BAB, FAB) en petites capitales.
6. « Ce que nous attendons de vous » quand un humain est requis : « filmez 20 secondes d'application sur votre main, à la lumière du jour, avant mercredi » (R09 §11.11).
7. « Faits à confirmer » : prix, date, nom non retrouvés en base, présentés comme une question (R11 §15.15) ; chaque fait de veille porte sa source (R06 §16.13).
8. Les deux boutons : « Je valide » (plein) et « À revoir » (contour), cibles de 44 px, barre collante en bas (R22 §7.2).

**Pied** : deux propositions de réserve « valeur », repliées ; un bouton « Tout valider » ; un champ « une remarque pour toute la semaine » (texte ou vocal).

### 5.2 Les canaux, dans l'ordre

**WhatsApp Business Platform d'abord**, en accès direct Cloud API sous le portefeuille Markel-Tech, sans BSP (R22 §10.1), avec deux numéros dédiés dans le même compte : une SIM ivoirienne +225 et un numéro canadien +1 ; José garde son numéro personnel intact (R22 §10.2). CallMeBot, service non officiel, est retiré du contact client et ne sert plus qu'aux alertes personnelles de José, puis disparaît quand le numéro machine le remplace (R22 §7.1).

Le message « planche prête » est un **modèle utilitaire** approuvé une fois, non promotionnel, avec en-tête image et boutons, envoyable hors fenêtre de 24 heures (R22 §3.4) :

> Bonjour {{1}}, votre planche n° {{2}} ({{3}} propositions) est prête pour validation. Merci de répondre avant le {{4}}.
> [image composite]
> Boutons : « Je valide tout » (réponse rapide) · « À revoir » (réponse rapide) · « Voir la planche » (URL vers la PWA avec jeton)

Coût : 0,0040 $ en Côte d'Ivoire, 0,0034 $ au Canada, 0,0300 $ en France (R22 §3.5). Six modèles utilitaires suffisent, soumis en une fois : `planche_prete`, `rappel_planche`, `production_terminee`, `publication_faite`, `rapport_mensuel`, `alerte_gestionnaire`, plus `confirmation_optin` à la signature (R22 §10.4, §10.12). La plateforme écoute `message_template_category_update` et bloque tout modèle reclassé marketing jusqu'à révision, sinon le prix passe de 0,0040 à 0,0225 $ du jour au lendemain (R22 §10.5).

Dès que la cliente tape un bouton, la fenêtre de 24 heures s'ouvre et la plateforme enchaîne, en messages de service (1 000 gratuits par numéro et par mois depuis le 1er octobre 2026, puis 0,0040 $, R22 §3.6), avec un **Flow générique** à deux écrans : « Cochez les propositions validées » (CheckboxGroup, 10 options) puis « Lesquelles sont à revoir, et pourquoi » (CheckboxGroup et TextArea) ; le `flow_token` porte l'identifiant de la planche (R22 §2.4 variante C, §10.6-10.7). Les carrousels de 2 à 10 cartes avec deux boutons par carte, l'interface rêvée, relèvent de la catégorie marketing (0,0225 $) : ils restent une option pour les clientes qui préfèrent voir chaque visuel en grand (R22 §1.3).

**Les vocaux sont une fonctionnalité** : téléchargement sous 5 minutes (URL éphémère), archivage dans le bucket (le média Meta disparaît à 7 jours), transcription par gpt-4o-mini-transcribe à 0,003 $ la minute ou Deepgram Nova-3, citation renvoyée avec un bouton « C'est bien ça », puis Claude transforme la remarque en instruction de retouche sur la proposition concernée (R22 §10.9).

**Courriel (Resend) en repli et en archive** : le même lien magique, le même composite en pièce jointe, un lien de désinscription dans chaque message (CASL, R08 §7.9). Utile pour les clients canadiens (WhatsApp n'y touche qu'un tiers des internautes, R10 §2.2) et pour la trace écrite.

**Lien magique, zéro compte** : jeton signé, valable 7 jours, lié au numéro, à usage limité ; la validation côté PWA et la validation côté WhatsApp écrivent dans la même table `validation`, donc la cliente peut commencer sur WhatsApp et finir sur la PWA (R22 §10.14). Toute validation par lien, courriel ou WhatsApp vaut accord écrit (clause 2, R08 §8.1).

### 5.3 États, relances et versions

États d'une planche : `brouillon`, `relue` (porte 1), `envoyee`, `vue` (webhook `read`), `validee`, `validee_partielle`, `a_revoir`, `expiree`, `remplacee`. États d'une proposition : `proposee`, `validee`, `a_revoir` (avec motif coché : texte, visuel, date, autre ; et transcription du vocal), `refusee`, `reserve`.

Relances : rappel 1 à J+2 (modèle `rappel_planche`), rappel 2 à J+5, escalade humaine ensuite (R22 §10.10). Pas de troisième rappel automatique.

Versions : un « à revoir » génère automatiquement la version n+1 de la proposition à partir du motif et de la remarque (Opus 5.5, avec le cerveau de marque en cache), relue par le gestionnaire si le motif est « autre » ou si le juge note sous 15/21, puis renvoyée dans la fenêtre de 24 heures en message interactif image + deux boutons, sans nouveau modèle payant. Historique conservé pendant toute la durée du contrat plus 12 mois (R08 §4.3).

### 5.4 Les autres messages que le client reçoit

Notifier peu, au bon moment (R08 §4.6) : par mois, 4 planches, 2 rappels au plus, 1 à 4 « production terminée » avec aperçu (optionnel), 1 « publié » hebdomadaire regroupé, 1 rapport, soit 10 à 12 messages. Coût Meta : 0,06 à 0,10 $ par client et par mois en Côte d'Ivoire et au Canada, 0,48 $ en France (R22 §0.2). Opt-in en deux cases au contrat (service, commercial), journal de preuve, STOP honoré automatiquement (R22 §6.3, §10.12).

---

## 6. Le poste de pilotage du gestionnaire

Une PWA (manifest `standalone`, service worker, Web Push VAPID ; sur iPhone, tutoriel « Partager puis Sur l'écran d'accueil », R22 §10.13). WhatsApp pour l'alerte, la PWA pour l'écran (R22 §10.13).

### 6.1 Les écrans

**Aujourd'hui** (écran d'accueil) : une pile de files, chacune avec son compteur et son délai le plus ancien.

| File | Ce qu'elle contient | Action en un clic |
|---|---|---|
| À relire (porte 1) | planches en brouillon, triées par heure d'envoi prévue | « Approuver et envoyer », « Modifier », « Retirer une proposition » |
| En attente client | planches envoyées, avec J+n et état des rappels | « Relancer maintenant », « Appeler » (lien tel:), « Appliquer la règle par défaut » |
| Retours à traiter | propositions « à revoir » avec motif et vocal transcrit, version n+1 déjà générée | « Envoyer la v2 », « Reprendre à la main » |
| À contrôler (porte 3) | rendus terminés : lecture de la vidéo, texte incrusté, checklist (orthographe, droits, étiquette IA, musique) | « Approuver et programmer », « Retouche », « Remplacer par une réserve » |
| À publier à la main | paquets prêts à publier : WhatsApp Channel et Status, TikTok avant audit, LinkedIn de José, carrousels de 11 à 20 | « Copier le texte », « Télécharger le média », « Ouvrir dans l'app », « J'ai publié : coller l'URL » |
| Commentaires et messages sensibles | critiques, sujets sensibles (prière, santé, argent, doctrine), hors fenêtre de 24 heures | « Envoyer le brouillon » (porte HUMAN_AGENT, identifiant journalisé, R23 §8.5), « Modifier », « Transmettre au client » |
| Dépôts incomplets | photo floue sous 1 000 px, INCI manquante, flyer sans date | « Demander la pièce manquante » (message préparé) |
| Jetons et connexions | jeton Instagram à J-10, PubSubHubbub non renouvelé, modèle WhatsApp reclassé | « Envoyer le lien de reconnexion au client » |
| Coûts | clients à 80 % de leur plafond de génération (R25 §11.12) | « Relever le plafond », « Basculer en brouillon » |

**Client** : fiche en trois onglets. Relation (feu, dernière validation, délai médian de réponse du client, canal préféré, interlocuteurs, règles par défaut, consentements et autorisations d'image). Marque (cerveau de marque : fiche de voix versionnée, lexique et interdits, deux plateformes, mix cible, plafonds, calendrier propre). Affaires (coupons, liens traçables, conversions saisies ou remontées).

**Planche** : la vue gestionnaire d'une planche, identique à celle du client plus les colonnes cachées : score du juge par critère, faits vérifiés et sources, moteur et version des maquettes, coût estimé de la production si tout est validé, drapeaux (réaliste, personne réelle, allégation, étiquette IA requise).

**Production** : liste des rendus avec état (en file, en cours, terminé, échec, repli vers un autre moteur), prévisualisation, provenance par média (moteur, version, prompt, références, compte, plan, date, drapeaux, R08 §8.2.1).

**Boîte de réception** : commentaires et messages Instagram et Facebook classés en six classes par Haiku 4.5 (question, achat, spam, critique, sensible, compliment ; 0,30 à 0,75 $ pour 1 000 commentaires, R23 §8.4), brouillons dans la voix du client, mots clés par verticale (PRIÈRE, LIVRE, ADMISSION, PRODUIT, BILLET, GUIDE, R23 §8.3), tâche quotidienne « commentaires TikTok à traiter dans l'app » (aucune API, R23 §8.9).

**Calendrier** : lecture seule pour le client, trois états par contenu (proposé, validé, publié) avec le lien vers la publication réelle (R08 §4.4) ; édition pour le gestionnaire ; interdiction par défaut du dimanche sauf directs d'église (R09 §11.5).

**Mesure** : les trois couches par client, les relevés quotidiens, le rapport mensuel en prévisualisation, les trois décisions proposées.

### 6.2 Les alertes

Trois canaux, un rôle chacun (R22 §7.1) : WhatsApp depuis le numéro machine pour l'alerte courte à trois boutons ; Web Push de la PWA avec lien profond vers la file exacte et badge ; courriel Resend pour le récapitulatif quotidien. Niveau rouge : client en silence depuis 5 jours, jeton expiré, publication échouée trois fois, client à 100 % de son plafond, modèle WhatsApp reclassé, note de qualité du numéro en orange, métrique renvoyant « invalid metric » au test hebdomadaire (R24 §10.20), publication bloquée faute d'étiquette IA.

### 6.3 Les indicateurs « à la page » du gestionnaire

Affichés par client et en moyenne du portefeuille, calculés depuis `signal`, `source_asset` et `publication` (R24 §5), avec les cibles de R11 §12 :

| Indicateur | Cible |
|---|---|
| Délai tendance vers publication | moins de 72 heures pour une nouveauté produit, moins de 48 heures pour un événement |
| Taux de nouveautés exploitées sous 14 jours | 100 % |
| Taux de vidéos | 40 à 60 % selon la verticale |
| Taux de sermons réemployés (3 clips sous 7 jours) | 100 % |
| Taux d'ancrage réel (contenus avec au moins un asset réel) | 80 % et plus |
| Taux d'acceptation des planches sans modification majeure | 70 % et plus |
| Délai médian de première réponse aux commentaires | moins d'une heure en heures ouvrées (42 % des clients l'attendent, R10 §7.2) |
| Mix de piliers | écart inférieur à 10 points par rapport à 60/25/15 |
| Taux d'étiquetage IA conforme | 100 % |

Ces chiffres sont aussi ceux du rapport mensuel : le gestionnaire voit en semaine ce que le client lira le mois suivant.

---

## 7. L'usine de production

Principe (R03 §12.1) : un moteur génératif produit les scènes et les éléments, une couche déterministe (React rendu en PNG par Playwright, ou Remotion pour la vidéo) pose tout texte éditorial, logo et couleur avec une exactitude de 100 %. Chaque moteur est abstrait derrière une interface interne avec un fournisseur par défaut et un repli (R04 §8.2) ; chaque média porte sa provenance et ses drapeaux.

Prix de référence (R26 §2d, §4e ; R04 §8.3) : OpenAI ne publie pas de prix par image pour gpt-image-2.5 mais un prix par jeton (5 $ texte entrée, 8 $ image entrée, 30 $ image sortie par million, Batch à moitié prix), donc la machine mesure le coût réel par qualité sur vingt générations et le stocke par client (R26 §5.7). Kling 3.0 via l'API Higgsfield : 0,084 $ par seconde, soit 1,26 $ les 15 secondes ; Seedance 2.5 : 0,2057 $ par seconde, soit 3,09 $ les 15 secondes, réservé aux scènes signature ; Veo 3.1 Fast : 0,10 $ par seconde ; LTX-2.3 : 0,06 $ par seconde pour les brouillons. gpt-image-1 disparaît le 23 octobre 2026 et gpt-image-1.5 le 1er décembre 2026 (R26 §2b-c).

| Type de contenu | Chaîne (moteurs, versions) | Coût unitaire indicatif | Contrôle qualité | Repli |
|---|---|---|---|---|
| Post texte (Facebook, LinkedIn, X) | Opus 5.5 avec cerveau de marque en cache 1 heure (environ 0,02 $ par post, R07 §1) ; juge à 7 critères sur un modèle différent (Haiku 4.5 ou Sonnet 5.5) | 0,02 à 0,04 $ | seuil 15/21, au moins 2 sur spécificité, voix et conformité (R11 §8.2) ; lexique d'allégations ; 5 hashtags maximum | régénération 2 fois puis gestionnaire |
| Carrousel (Instagram 10 diapositives par API, LinkedIn PDF) | JSON par Opus 5.5 → composition React + Playwright (texte exact, logo, couleurs) ; fond optionnel gpt-image-2.5-flare high | 0,05 à 0,30 $ | couche déterministe (dimensions, contraste, logo par hash) + vision Haiku 4.5 (0,002 $ par image, R07 §11.14) | 11 à 20 diapositives → paquet manuel (R02 §12.6) |
| Visuel avec texte (affiche, citation, annonce) | fond gpt-image-2.5-flare (low pour la planche, high en production) ; texte posé en HTML ; styles Recraft V4.1 à 0,035 $ pour un univers illustré (R03 §12.14) | 0,02 à 0,10 $ | vision : OCR du texte attendu, mains, visages, logos (R03 §10) | Nano Banana 2 ou FLUX.2 [pro] via fal (R03 §12.3) |
| Photo produit mise en scène | packshot client (boîte photo LED à 16 245-18 900 FCFA, R21 §6.2) → détourage Canva MCP ou Photoroom 0,02 $ → gpt-image-2.5-sunburst en édition avec le packshot en référence (jusqu'à 16 références, R26 §2f) | 0,05 à 0,25 $ | comparaison vision avec le packshot original : packaging, texte d'étiquette (R03 §12.6) ; drapeau « photoréaliste » → étiquette IA à la publication | FLUX.2 [pro] ; sinon photo réelle seule |
| Reel génératif (ambiance, teaser) | storyboard 3 images Nano Banana ou Popcorn (0,20 $) → Kling 3.0 I2V 15 s, 1 prise en brouillon, 3 prises en production → montage Remotion (hook sous 2 s, texte, logo, CTA) → voix ElevenLabs v3 (0,08 $ par 1 000 caractères) → musique Lyria 3 Pro (0,08 $) ou ElevenLabs Music (0,15 $ la minute), jamais Suno automatisé (R04 §8.12) | 4 à 6,50 $ (Kling) ; 10 à 14 $ (Seedance 2.5 signature) | lecture par le gestionnaire (porte 3) ; drapeaux réaliste et personne réelle ; test des filtres de contenu par verticale (R04 §8.16) | Veo 3.1 Fast via Gemini ; LTX-2.3 via fal ; sinon Reel programmé |
| Reel programmé (produit, chiffres, calendrier, tutoriel) | composition Remotion par client (design system de composants), packshot animé, sous-titres mot à mot, rendu CPU sur le worker Railway ou Remotion Lambda (0,017 à 0,021 $ la minute, lot de 5 clips pour 0,10 $, R25 §11.10) | 0,05 à 0,50 $ | déterministe (zones sûres, poids, profil « Afrique mobile » sous 10 Mo en 720p, R10 §8.6) | aucun nécessaire : chaîne entièrement maîtrisée |
| Clip de sermon | transcription AssemblyAI Universal-3.5 Pro (0,21 $ par heure) ou Deepgram Nova-3 fr (0,31 $), mots horodatés obligatoires (R05 §8.4) ; analyse à deux étages Haiku 4.5 puis Opus 5.5 (0,14 $, R07 §1) ; découpe ffmpeg ; recadrage MediaPipe ; sous-titres ASS libass ; habillage Remotion ; encodage MP4 moov en tête, H.264, AAC 48 kHz 128 kbps, 1080 × 1920 à 8 Mbps (R26 §5.2) | moins de 3 $ par sermon pour 6 à 8 clips et les dérivés (R05 §8.1) | relecture doctrinale humaine de chaque clip ; verset vérifié contre une Bible de référence par texte (R03 §12.7) ; pas de coupe au milieu d'un verset ; aucune génération, donc aucune étiquette IA | Vizard API (600 minutes pour 14,50 $ par mois) ou Klap (0,44 $ par traitement) le premier mois (R05 §8.2) |
| UGC (créatrice réelle ou avatar neutre) | script et sous-titres par la machine, tournage par la cliente ou une créatrice ; avatar synthétique neutre seulement pour un présentateur d'admissions ou une hôtesse, étiqueté (R04 §8.6) | 0,10 à 0,40 $ hors tournage | consentement d'image enregistré ; divulgation IA si avatar | aucun |
| Story | visuel ou extrait vidéo 9:16 sous 60 secondes, composition Remotion, export MP4 depuis Canva pour les gabarits partagés avec le client (R03 §12.8) | 0,02 à 0,10 $ | déterministe | paquet manuel |
| Miniature YouTube | capture réelle du sermon ou du cours + titre posé en HTML + visage réel ; skill maison youtube-thumbnail de José pour les cas signature | 0,02 à 0,05 $ | vision : lisibilité à 390 px | gpt-image fond seul |
| Vidéo explicative de logiciel (2IAE, Markel-Tech) | enregistrement d'écran fourni ou captures, zooms et curseur animés en Remotion, voix off ElevenLabs ou voix clonée de José avec consentement, sous-titres (R04 table) | 0,15 à 0,40 $ | déterministe + relecture | aucun |
| Planche de propositions | maquettes gpt-image-2.5-flare low ou Nano Banana 2 Lite, captures « frame 0 » Remotion, brouillons vidéo LTX-2.3 1 prise, composition PDF et composite 1080 × 1350 par Playwright | 0,03 à 0,20 $ par planche d'images (R08 §4.1), 0,50 à 2 $ si elle contient des brouillons vidéo (R04 table) | vision Haiku sur chaque vignette avant envoi (R11 §15.5) | aucun |

Qualité transversale (R11 §15) : fiche de voix par client générée à partir de 15 textes validés et validée par le client sur la première planche ; liste française d'interdits lexicaux construite par statistique (500 brouillons contre le corpus validé), mise à jour chaque trimestre ; 20 % du mix réservé à des contenus 100 % humains fournis par le client ; chaque correction du gestionnaire enregistrée comme paire (brouillon, correction, motif) et réinjectée chaque mois ; jeu de test de 30 phrases françaises accentuées rejoué à chaque changement de moteur (R03 §12.11).

---

## 8. La veille et l'intelligence

### 8.1 Trois flux par client (R01 §8.4)

**Flux A, chez le client** (toutes les 6 heures, dépôt immédiat) : crawler maison du site (sitemap, flux Shopify ou WordPress), dépôt de nouveautés par WhatsApp en priorité maximale (R06 §16.10), page Facebook et compte Instagram du client (Graph API, Business Discovery), chaîne YouTube par flux Atom et PubSubHubbub, hors quota (R06 §16.7).

**Flux B, domaine et région** (tendances toutes les 2 heures, durée de vie 48 heures ; événements chaque semaine, horizon 6 semaines) : Google Trends Trending Now RSS par pays (CI, CA, FR, gratuit et testé, R06 §2.2), Google News RSS par requête localisée, GDELT DOC 2.0, flux RSS d'Abidjan.net, Fratmat, Life.ci, Pulse CI, Yeclo, GrandToronto, L-Express, BlogTO, Ottawa Festivals (R10 §6), Google Events via SerpApi (R06 §16.2), pages Facebook publiques des festivals, changedetection.io auto-hébergé pour les agendas dynamiques (R06 §16.11).

**Flux C, formats et sons** (hebdomadaire, durée de vie 3 semaines) : un run Apify quotidien du TikTok Creative Center pour les trois pays, partagé entre tous les clients (moins de 20 $ par mois, R06 §16.4), sons et hashtags taggés par pays et date de première apparition ; comptes de référence de la verticale par Business Discovery, avec la limite de 30 hashtags par 7 jours affichée au client (10 de marque, 10 de niche, 10 exploratoires, R06 §16.6). Scrapers isolés des comptes de publication (R06 §16.18). À déposer dès maintenant : Instagram Public Content Access et Page Public Content Access (R06 §16.5). Jamais pytrends sur Railway (R06 §16.3).

### 8.2 Scoring, vérification, calendrier

Scoring par Haiku 4.5 en Batch nocturne (profil client en cache ; sous 5 $ par client et par mois, R06 §16.12) : pertinence 0 à 3, pilier, fraîcheur, risque (politique, religieux controversé, santé, exclus du newsjacking pour les églises, SEVARTA et 2IAE, R06 §16.16), format suggéré. Règle des deux sources dont une primaire pour toute date et tout lieu, source affichée sous chaque fait (R06 §16.13). Opus 5.5 n'intervient qu'à l'idéation hebdomadaire sur les 20 meilleurs signaux.

Calendrier maison à trois couches (R10 §8.9, R06 §16.17) : fêtes fixes par pays (Fête nationale ivoirienne du 7 août, Journée de la Paix du 15 novembre, Jour des Franco-Ontariens du 25 septembre, Mois de l'histoire des Noirs), fêtes lunaires avec fenêtre de plus ou moins deux jours confirmée la veille, fêtes chrétiennes calculées et liturgie AELF, événements vivants rafraîchis par la veille (FEMUA, MASA, Afrofest, Francophonie en fête, rentrée du 14 septembre). Moments générés 8 semaines à l'avance, proposition 10 jours avant. Chaque signal est suivi jusqu'à sa performance ; après 90 jours, les sources sans item accepté sont coupées (R06 §16.19) ; plan B par source gratuite vers SerpApi ou Apify par configuration (R06 §16.20).

### 8.3 Coût mensuel

Socle partagé : SerpApi 25 $ (75 $ au-delà de 1 000 recherches), Apify environ 20 $, Tavily gratuit (1 000 crédits), Exa 4 à 7 $ pour 1 000 requêtes, changedetection.io auto-hébergé (moins de 15 $) ; R06 §1.10 situe le socle complet entre 100 et 160 $. Par client : 12 à 25 $, dont plus de la moitié en jetons de scoring, ramenés sous 5 $ avec cache et Batch (R06 §16.12).

---

## 9. L'architecture agentique

### 9.1 Appels structurés d'abord, agents ensuite

Le cœur (veille, scoring, idéation, calendrier, rédaction, planches, juges, vision, rapport) est fait d'appels à l'API Messages avec sorties structurées (`output_config.format` json_schema, GA, sans surcoût, R21 §2.2), orchestrés par pg-boss sur le Postgres Railway (R07 §11.1, §11.5). Les agents (Claude Agent SDK dans un conteneur Railway dédié, `SessionStore` Postgres, `maxBudgetUsd` par job, par exemple 2 $ par sermon, profondeur de sous-agents à 1, hooks d'audit et `defer` sur la publication, R07 §11.8) ne servent qu'aux tâches ouvertes : sermon qui exige d'écouter plusieurs passages, audit de site d'un nouveau client, revue mensuelle du portefeuille.

Modèles par tâche, prix officiels (R26 §3, R07 §2.2) :

| Tâche | Modèle | Pourquoi |
|---|---|---|
| Rédaction (posts, scripts, hooks, dérivés de sermon), idéation hebdomadaire, version n+1 | Opus 5.5 (4 $ entrée, 20 $ sortie, cache à 0,20 $ soit 0,05x) | création ; cache rentable dès la première relecture |
| Synthèses, fiche de voix, extraction INCI et PDF, juge second avis | Sonnet 5.5 (2 $ et 10 $) | qualité à prix moyen |
| Juge à 7 critères, classification des commentaires, extraction des flyers, vision des maquettes, scoring de veille | Haiku 4.5 (1 $ et 5 $, cache 0,10 $) | 0,002 $ par image à 1 000 px, 0,0046 $ par flyer, 0,30 à 0,75 $ pour 1 000 commentaires |
| Sessions d'agent longues (orchestration d'un sermon complet, revue mensuelle) | Fable 5.1 (10 $ et 50 $, cache 0,25 $) uniquement, jamais pour une légende (R26 §5.8) | raisonnement long |
| Tout ce qui n'attend personne (veille nocturne, jugement en masse, calendrier du mois suivant) | Batch API, moitié prix, `batch_id` stocké | 24 heures de délai acceptables (R07 §11.4) |

Règles : jamais de changement de modèle au milieu d'une conversation (cache par modèle, R26 §5.9) ; entrées majorées de 30 % pour le tokenizer des modèles 4.7 et suivants (R26 §5.8) ; `stop_reason === "refusal"` toujours testé (R07 §11.15) ; clé API de la plateforme séparée de l'abonnement Max de José (interdiction documentée d'offrir la connexion claude.ai dans un produit tiers, R07 §11.17) ; budget par client avec alerte à 15 $ de jetons dans le mois (R07 §11.17) ; chaque appel tracé dans Langfuse auto-hébergé avec `client_id`, `job_id`, `content_type`, `usage`, score du juge (R07 §11.16).

### 9.2 Cerveau de marque et mémoire

Un document par client de 4 000 à 12 000 jetons placé en tête de prompt derrière un `cache_control` de 1 heure (un cerveau de 10 000 jetons relu 500 fois coûte 1 $ au lieu de 20 $, R07 §11.3) : la doctrine encodée comme contrat (deux plateformes, mix 60/25/15, cadres autorisés, hooks, 3 à 5 hashtags, interdits, R01 §8.8), la fiche de voix versionnée (règles mécaniques, lexique signature, interdits, dix meilleurs posts, exemples avant-après, R11 §15.1), le registre linguistique (français standard, français parlé avec nouchi, bilingue, R10 §8.8), le profil de conformité de la verticale, les dix meilleurs posts et les cinq à dix dernières paires de correction du mois (R11 §15.10), les faits stables (prix, adresses, horaires, noms). Un juge calibré le premier mois sur 100 posts notés par José par verticale, kappa par critère, recalibré chaque mois et à chaque changement de modèle, avec gpt-4o-mini comme second juge d'une autre famille sur 10 % (R11 §15.4).

### 9.3 La place exacte de chaque surface Anthropic

| Surface | Rôle dans la machine | Limite |
|---|---|---|
| API Messages | 80 % du volume : tout le pipeline structuré | rien d'ouvert |
| Claude Agent SDK dans un conteneur Railway | sermons complexes, audits de site, revue mensuelle du portefeuille | publication toujours différée |
| Serveur MCP distant « machine-social » exposé par la plateforme (spécification 2025-06-18, OAuth 2.1 avec PKCE, RFC 9728, 8414, 7591, 8707, R07 §11.9) | seule voie documentée pour que Cowork, Claude Code, les Routines et Managed Agents agissent sur la plateforme ; dix outils : `list_pending_briefs`, `get_brand_brain`, `get_assets`, `submit_render`, `submit_board`, `approve`, `reject`, `request_higgsfield_job`, `report_metrics`, `log_decision` | attend d'être appelé |
| Routines Claude Code | pont d'entrée tiré par la plateforme (`POST /v1/claude_code/routines/{id}/fire`, 30 par heure et par routine, 100 par heure et par compte) : « revue hebdomadaire des clients » le lundi, « incident » après trois refus du juge (R07 §11.12) | pas de temps réel |
| Claude Cowork | l'atelier de José : une tâche planifiée vient chercher les ordres via le MCP, produit les pièces signature (motion design Claude Design rendu en MP4, miniatures Gemini, clips Suno), dépose par `submit_render` ; aucune API publique d'entrée (R07 §11.10) ; vérifier avant le 6 octobre 2026 la bascule « nuage uniquement » annoncée pour Pro et Max | ne tourne pas sans José |
| Claude in Chrome | Higgsfield Unlimited à la main, sur le poste de José, pour SEVARTA | jamais dans le chemin critique d'un client (R26 §5.10) |
| Higgsfield API (open.higgsfield.ai, 16 septembre 2026, paiement à la génération, usage par agent prévu à la section 11.12 des conditions) | Kling 3.0 à 0,084 $ par seconde, Seedance 2.5 à 0,2057 $, Soul ID et Popcorn (R26 §4d-4e) ; visages de pasteurs et enfants exclus des références car Higgsfield s'autorise l'entraînement hors contrat Enterprise (R26 §5.12) | pas l'Unlimited |
| Managed Agents (bêta, 0,08 $ par heure de session) | montée en gamme sans réécriture si José cesse d'opérer le conteneur agent (R07 §11.18) | pas avant la phase 4 |

Garde-fous codés (R07 §11.15, R08 §8.2) : lexique d'allégations par pays, citations bibliques vérifiées par outil, consentement d'image enregistré pour tout visage, chiffres 2IAE issus de la base, registre de provenance par média, drapeau d'étiquette IA calculé depuis la chaîne, publication automatique seulement pour les contenus validés sur planche sans drapeau, journal d'audit en ajout seul (R02 §12.16).

---

## 10. Publication, mesure et apprentissage

### 10.1 Couche de publication : trajectoire en trois temps

Une interface « connecteur » unique (publier, lire, statistiques) avec deux implémentations, API unifiée et API officielles, pour migrer client par client sans réécrire la machine (R02 §12.1).

**Mois 1 à 6 : API unifiée**, pour ne pas attendre les revues (Meta jusqu'à 20 jours par cycle, YouTube 2 à 4 semaines, TikTok et LinkedIn plusieurs semaines, R02 §12.1) : Upload-Post Pro à 50 $ par mois pour 25 profils ou Ayrshare Launch à 299 $ pour 10 profils ; Blotato à 29 $ par mois porte l'audit TikTok (R26 §5.14) ; Postiz auto-hébergé (0 $, 30 plateformes, MCP) reste en observation car il ramène la revue d'application chez nous (R02 §1.9).

**Dès le jour 1, en parallèle** : app Meta liée à l'entreprise vérifiée (Facebook Login for Business avec jeton d'utilisateur système sans expiration pour les clients structurés ; Instagram Business Login à 60 jours renouvelé à J+50 pour les clients sans Page, R21 §9.12-9.13), projet Google Cloud audité, app TikTok soumise à l'audit (sans audit, 5 utilisateurs en privé, R26 §5.14), app LinkedIn Community Management, Google Business Profile pour 2IAE (R02 §12.14), permissions de messagerie et HUMAN_AGENT en une seule revue (R23 §8.2).

**Mois 7 à 12 : nos propres apps**, coût marginal nul, une personne responsable des versions (LinkedIn-Version mensuel, Meta v25.0, R02 §12.17), test automatique hebdomadaire de publication sur un compte de test.

### 10.2 Contraintes par plateforme encodées

Instagram : `content_publishing_limit` lu avant chaque publication, 50 comme plafond prudent tant que le compteur n'a pas prouvé 100 (R26 §5.3), carrousel de 10 par API, Reels de 3 secondes à 15 minutes et 300 Mo, `is_ai_generated: true` sur tout média photoréaliste généré, Trial Reels pour les clips de sermon et les lancements (R26 §5.4-5.5), 5 hashtags. Facebook : Reels de 3 à 90 secondes, 30 par 24 heures. YouTube : 100 uploads par jour par projet partagés, publications lissées (R02 §12.7), Shorts sous 3 minutes. TikTok : 6 requêtes par minute, FILE_UPLOAD par défaut car PULL_FROM_URL exige un domaine vérifié sans redirection (R25 §11.3). LinkedIn : documents natifs et multi-images. X : à l'usage, plafonné à Markel-Tech. WhatsApp Channels et Status : aucune API, geste humain préparé, adaptateur isolé pour le jour où Meta livre la programmation en développement depuis août 2026 (R10 §8.20).

Médias servis par URL présignée Railway de 48 heures sur une copie `pub/`, révoquée après publication, purgée à 7 jours ; Cloudflare R2 avec domaine propre pour TikTok (R25 §11.2-11.3). File de publication par client avec compteurs de quota et reprise ; jetons chiffrés par enveloppe, rafraîchis à J-5, alerte à J-10 (R02 §12.8-12.9).

### 10.3 Repli manuel, fonctionnalité de premier rang

Le « paquet prêt à publier » (médias au bon format, légende, hashtags, heure, cases à cocher, lien profond) couvre WhatsApp Channels et Status, les cas refusés par l'API, la période avant les audits, les carrousels de 11 à 20 et les posts personnels LinkedIn de José (R02 §12.15). Le gestionnaire colle l'URL publiée ; la machine mesure ensuite.

### 10.4 Mesure en trois couches

Collecte chaque nuit, en ajout seul, chez nous : Instagram retarde de 48 heures et efface à 2 ans, les Stories meurent à 24 heures (relevées trois fois), Facebook limite à 90 jours par requête et a retiré une quarantaine de métriques le 15 juin 2026, LinkedIn ne sert que 12 mois (R24 §1.1, §10.7-10.9) ; noms de métriques jamais figés dans le schéma.

Couche 1, indicateurs avancés : envois par portée et enregistrements par portée en tête (R11 §15.13), vues, rétention à 3 secondes, visionnage complet, délai de réponse ; sources de trafic des Shorts de sermon (R24 §10.11) ; délivrés, lus, clics et note de qualité WhatsApp (R10 §8.19). Couche 2, croissance : abonnés nets, visites de profil, clics. Couche 3, affaires, en haut du rapport : tout lien sortant généré par la machine (`go.{domaine}/x7k2`) avec UTM stables (`utm_campaign = {client}-{aaaa-mm}-{pilier}`, `utm_content = c12345-reel`, R24 §2.1), page lien en bio maison (contre 15 $ par profil chez Linktree), QR dynamiques maison pour les flyers, coupon par contenu promotionnel lisible à voix haute (l'attribution qui marche à Abidjan, R24 §10.6), `referral` et `ctwa_clid` des conversations WhatsApp issues de publicités renvoyés par Conversions API (R24 §10.5), Pixel et CAPI posés avec consentement, trois événements GA4 demandés à la session du site 2IAE (R24 §10.17), saisie du client dans un Flow mensuel (« combien de commandes WhatsApp ce mois-ci ? »).

### 10.5 Le rapport mensuel d'une page

PDF léger et résumé WhatsApp de cinq lignes avec les trois meilleures publications en vignette, le premier lundi après le 3, avant 9 h heure du client (R10 §8.13, R24 §10.8). Couche affaires en haut (« 3 demandes de devis, 1 inscription, 14 commandes WhatsApp avec le coupon SERUM10 »), puis croissance, puis indicateurs avancés, cinq chiffres maximum par couche, une phrase de décision par chiffre, les quatre indicateurs « à la page », la comparaison au seuil de la verticale (0,12 % est bon en beauté, 0,73 % moyen pour une école, 5,20 % la moyenne LinkedIn, R09 §11.1) puis à la médiane locale après trois mois (R24 §10.13), et « ce que nous avons appris et ce que nous changeons » avec trois décisions proposées (R08 §4.4). L'alerte « sous la médiane » ne part que deux mois de suite, sous le seuil et sous la médiane locale (R24 §10.14). Revue à 90 jours avec comparaison avant-après.

### 10.6 Boucle d'apprentissage

Trois à cinq hooks de familles différentes par idée vidéo, publiés sur des jours distincts ou en Trial Reels, rétention à 3 secondes mesurée, bandit par verticale avec récompense envois plus enregistrements par portée et 20 % d'exploration, probabilités affichées au gestionnaire (R11 §15.9) ; chaque signal de veille suivi jusqu'à sa performance (R06 §16.19) ; clips de sermon qui ont marché réinjectés dans la sélection (R05 §8.14) ; corrections du gestionnaire et décisions client réinjectées chaque mois (R11 §15.10) ; effet du label IA mesuré par compte sur 90 jours (R04 §8.8).

---

## 11. Architecture technique et modèle de données

### 11.1 Services Railway

Un projet Railway « machine » séparé du projet « Groupe 2iae », pour que les règles de déploiement du campus ne soient jamais en cause (R25 §11.1). Région EU West Amsterdam, bucket `ams`, la plus proche d'Abidjan (R25 §11.1). Tout est provisionné avec le Railway CLI et le schéma est validé par le skill maison agents-base-donnees (/db) avant la première ligne de code.

| Service | Rôle | Dimensionnement de départ (R25 §8) |
|---|---|---|
| `web` | Express (API, webhooks WhatsApp, Meta, PubSubHubbub, Drive, serveur MCP distant) + React PWA (client et gestionnaire) | 0,5 vCPU, 1 Go |
| `postgres` | une seule base, RLS forcée, pg-boss | 0,25 vCPU, 1 Go, volume 5 Go |
| `worker-agents` | pg-boss : veille, scoring, idéation, rédaction, juge, vision, planche, WhatsApp, publication, métriques, Agent SDK | 0,5 vCPU, 2 Go |
| `worker-rendu` | ffmpeg, libass, MediaPipe, Remotion CPU, Playwright ; serverless, réveillé par la file | 4 vCPU, 8 Go, environ 13 $ par mois pour 2 heures par jour |
| `tick` | cron Railway toutes les 5 minutes, sort en moins d'une minute : échéances, rappels, tirs de Routines, réabonnements PubSubHubbub (R07 §11.6) | minimal |
| `bucket-media` | bucket Railway : originaux, rendus, copie `pub/` ; pas de bucket public, pas de cycle de vie, pas de versionnage (R25 §1.3) | 0,015 $ par Go |
| optionnels | changedetection.io, Langfuse, Postiz | serverless |

Hors Railway, justifié par R25 §11.2 : un bucket Cloudflare R2 avec domaine propre pour la copie des originaux (verrou 90 jours, cycle de vie natif) et les URL publiques stables exigées par TikTok ; `pg_dump` hebdomadaire chiffré vers R2, car seul le dump logique survit à la suppression d'un projet (R25 §11.8). Trois couches de sauvegarde dès le premier jour : instantanés de volume, PITR activé immédiatement, dump hebdomadaire ; exercice de restauration trimestriel chronométré.

### 11.2 Postgres : tables principales

Toutes les tables portent `tenant_id`, Row Level Security forcée, rôle applicatif non propriétaire, variable `app.tenant_id` posée par Drizzle dans chaque transaction, batterie d'isolation à chaque migration (R25 §11.6). Colonnes clés :

- `tenant` : verticale, pays, fuseau_client, fuseau_public, registre_langue, data_region, palier, plafond_generation_usd, regle_silence, canal_prefere, statut.
- `person` et `consent` : rôle, numéro WhatsApp chiffré, courriel ; type de consentement (service, commercial, image, voix), source, texte affiché, horodatage, preuve, révocation.
- `brand_brain` : version, contenu_json (doctrine, fiche de voix, lexique, interdits, conformité), validé par, validé le.
- `source_asset` : kind (packshot, inci, flyer, affiche, sermon, audio, video_client, temoignage), s3_key, sha256, extraction_json, personnes_representees[], autorisation_ids[], expires_at, purged_at.
- `signal` et `calendar_moment` : flux, kind, source_url, source_primaire_url, detected_at, score, pilier, risque, proposé, accepté, publié ; date, fenêtre, couche, verticales concernées, confirmé le.
- `board` et `board_item` : numéro, semaine, état, composite_s3_key, media_id_meta, jeton_lien, envoyée, vue, rappels, escalade, version ; position, pilier, cadre, hook, plateforme, format, prévu le, maquette, moteur et version, score_juge_json, faits_a_confirmer_json, attendu_du_client, réserve, état.
- `validation` : canal (whatsapp_bouton, whatsapp_flow, pwa, email, gestionnaire), verdict, motifs[], remarque, vocal_s3_key, transcription, horodatage, auteur.
- `content_item` et `content_version` : signal_id, source_asset_ids[], type, pilier, cadre, plateforme, texte, hashtags[], hook_famille, etiquette_ia_requise, personne_reelle, allegation, état ; n, texte, moteur, prompt, corrigé par, motif.
- `render_job` et `cost_ledger` : moteur, version, prompt, références[], prises, mode (brouillon, production), cout_usd, s3_key, provenance_json, drapeaux ; fournisseur, modèle, job_id, usd, vérifié avant appel (R25 §11.12).
- `publication_connection` et `publication` : plateforme, compte, jeton chiffré (AES-256-GCM, DEK par client enveloppée par une KEK en variable Railway, R25 §11.7), expire le, rafraîchi le, voie (unifiée, officielle, manuelle) ; prévu le, published_at, url, id_plateforme, état, erreur, is_ai_generated, publié par.
- `metric_snapshot` (ajout seul) : publication ou compte, metric_alias, metric_name, valeur, relevé le.
- `tracked_link` et `conversion_event` : support (bio, story, qr, whatsapp), slug, utm_json, clics ; kind (lead, inscription, commande, don, devis), source (ga4, capi, whatsapp, coupon, saisie), valeur, event_id, content_item_id.
- `inbox_message`, `report`, `audit_log` (ajout seul), `whatsapp_template`, `whatsapp_tarif` (date d'effet, marché, catégorie, prix, R22 §10.16), `benchmark` (verticale, plateforme, seuil, as_of, source).

### 11.3 Files pg-boss

`veille`, `scoring`, `ideation`, `redaction`, `juge`, `vision`, `planche`, `whatsapp_in`, `whatsapp_out`, `transcription`, `rendu`, `publication`, `metrique`, `rapport`, `retention_purge` (lit `expires_at`, supprime, vérifie par HEAD, écrit `purged_at`, R25 §11.4), `tenant_offboard` (export ZIP avec manifeste et sommes de contrôle, suppression vérifiée du préfixe S3 et des lignes, suppression de la DEK, attestation PDF, R25 §11.9). Clés de singleton `client:type:date`, dead letter visible dans la file « incidents » du gestionnaire (R07 §11.5).

### 11.4 Sécurité, observabilité, coûts d'hébergement

Un tenant par client, jamais de jeton partagé (R02 §12.16). Postgres joint uniquement par le réseau privé `railway.internal`, URL publique désactivée (R25 §11.14). Clés IA de l'agence en variables du seul service worker ; projet OpenAI avec plafond dur mensuel et clés expirant à 90 jours ; plafonds par client et par jour vérifiés avant chaque appel (R25 §11.12). Limite de dépense dure Railway à 1,5 fois la facture attendue (R25 §11.13). Langfuse pour les appels LLM, test hebdomadaire par fournisseur de génération et par plateforme de collecte (R04 §8.2, R24 §10.20), contrôle trimestriel automatique des pages primaires citées avec diff et alerte WhatsApp (R26 §5.19). Page de confidentialité par client listant les sous-traitants et la région (Railway Amsterdam, Cloudflare, OpenAI, Google, Higgsfield, ElevenLabs, Anthropic, R25 §11.16) ; `tenant.data_region` et `asset.storage` dès la première migration (R25 §11.17).

Coût d'hébergement : 85 à 110 $ par mois à 6 clients, 230 à 290 $ à 20 clients, soit 12 à 18 $ par client (R25 §8), moins de 2 % du chiffre d'affaires.

---

## 12. Coûts et modèle économique

### 12.1 Coût mensuel détaillé par client type (hors gestionnaire)

Hypothèses : prix de R26 pour les LLM et la vidéo, R03 et R04 pour les images et le rendu, R06 pour la veille, R22 pour WhatsApp, R25 pour l'infrastructure, Upload-Post Pro mutualisé (50 $ pour 25 profils) ou Ayrshare Launch (299 $ pour 10 profils) pour la publication.

**Cliente beauté d'Abidjan, palier Croissance** (16 visuels, 8 vidéos dont 4 génératives, 3 plateformes, réponses) :

| Poste | Détail | Coût |
|---|---|---|
| Vidéos génératives | 4 Reels, Kling 3.0 15 s, 3 prises en production, 1 en brouillon (0,084 $ par seconde) : 4 × 4 × 1,26 $ | 20 $ |
| Reels programmés | 4 Reels Remotion depuis packshots, voix, musique | 2 $ |
| Visuels et carrousels | 16 compositions avec fond gpt-image-2.5 high, packshots mis en scène, QC vision | 3 à 5 $ |
| Planches | 4 planches avec maquettes low et 2 brouillons vidéo LTX-2.3 | 2 à 4 $ |
| Jetons Claude | calendrier 0,45 $, 36 posts à 0,02 $, juges, versions n+1, 300 commentaires, extraction produits | 4 à 8 $ |
| Veille | part client (scoring, SerpApi, Apify partagés) | 12 à 20 $ |
| WhatsApp | 12 messages utilitaires, transcriptions de vocaux | 1 $ |
| Publication | part d'Upload-Post Pro (2 $) ou d'Ayrshare Launch (30 $) | 2 à 30 $ |
| Infrastructure | part Railway et R2 | 14 à 18 $ |
| Total hors humain | | 60 à 108 $ |

Gestionnaire : 5 à 6 heures, 25 000 à 45 000 FCFA (41 à 74 $ à 610 FCFA pour un dollar). Prix de vente 550 000 FCFA (environ 900 $). Marge brute après humain : plus de 75 %.

**Église d'Abidjan, palier Sermon** (4 sermons, 20 à 24 clips, 28 citations, dévotionnel, 2 comptes) :

| Poste | Détail | Coût |
|---|---|---|
| Sermons | transcription 4 × 0,21 à 0,31 $, analyse 4 × 0,14 $ Opus 5.5, dérivés, rendu ffmpeg et Remotion CPU, habillage Lambda 4 × 0,10 $ | 4 à 12 $ |
| Enregistrement | salle Daily 4 × 1,21 $ (si régie branchée) ou 0 $ (audio WhatsApp) | 0 à 5 $ |
| Citations animées et visuels | 28 citations Remotion, 8 annonces, miniatures | 1 à 2 $ |
| Jetons Claude | dévotionnels, chapitrages, légendes, juge, 200 commentaires (demandes de prière vers l'humain) | 3 à 5 $ |
| Veille | calendrier liturgique, agenda, flux YouTube : part réduite | 5 à 8 $ |
| WhatsApp | planches, rappels, rapport | 1 $ |
| Publication | part unifiée | 2 à 30 $ |
| Infrastructure et stockage | part Railway ; proxy 720p plus audio conservés (1 Go par sermon) plutôt que l'original (R25 §11.5) | 15 à 20 $ |
| Total hors humain | | 31 à 83 $ |

Gestionnaire : 4 à 5 heures (relecture doctrinale partagée avec le responsable de l'église). Prix de vente 350 000 FCFA (environ 575 $). Pulpit AI facture 4,64 à 8 $ par sermon sans français ni validation, Sermonshots 53 à 97 $ par mois en anglais (R05 §2.2) ; l'offre reste 2 à 4 fois au-dessus de Sermonshots, justifiée par le français, la validation, les deux comptes et la publication incluse (R05 §8.18).

**Association culturelle de Toronto, palier Présence** (12 visuels, 4 vidéos dont 2 teasers génératifs, bilingue, 2 plateformes) :

| Poste | Détail | Coût |
|---|---|---|
| Teasers génératifs | 2 × Kling 3.0 15 s × 3 prises + storyboard 0,20 $ + musique Lyria 3 Pro 0,08 $ | 8 à 9 $ |
| Teasers et récaps programmés | 2 Remotion (texte, date, lieu, plans fournis) | 1 $ |
| Visuels, carrousels, genèse | 12 compositions, recherche Tavily et Exa, fond gpt-image | 2 à 4 $ |
| Planches | 4 | 1 à 2 $ |
| Jetons Claude | calendrier, 24 posts bilingues, juge, vérification des faits | 3 à 6 $ |
| Veille | agendas de Toronto et d'Ottawa, Google Events via SerpApi, Trending Now CA | 15 à 25 $ |
| WhatsApp et courriel | utilitaire à 0,0034 $, Resend | 1 $ |
| Publication | part unifiée | 2 à 30 $ |
| Infrastructure | | 14 à 18 $ |
| Total hors humain | | 47 à 96 $ |

Gestionnaire : 4 à 6 heures à 40 à 50 CAD, soit 160 à 300 CAD. Prix de vente 1 200 CAD. Marge brute après humain : environ 60 %.

### 12.2 Tarifs par marché

| Palier | Abidjan | Canada | France | Repères de marché |
|---|---|---|---|---|
| Présence | 300 000 FCFA | 1 200 CAD | 900 EUR | Abidjan 300 000 à 400 000 FCFA pour 2 à 5 posts par semaine chez Digit Communication (R10 §7.1) ; Montréal 500 à 900 CAD en entrée, Toronto 500 à 1 500 CAD en freelance (R10 §7.1) ; France 400 à 1 500 EUR en freelance (R08 §6.1, estimation) |
| Croissance | 550 000 FCFA | 2 000 CAD | 1 500 EUR | pack vidéo 500 000 à 750 000 FCFA à Abidjan, 2 500 à 3 500 CAD à Montréal (R10 §8.12) |
| Sermon | 350 000 FCFA | 1 400 CAD | 1 100 EUR | 150 à 300 $ suggérés par R05 §8.18 ; relevé à 350 000 FCFA pour les deux comptes et le dévotionnel |
| Logiciel seul (client équipé d'un community manager) | 90 000 FCFA | 300 CAD | 200 EUR | plafond de 15 à 50 $ par client pour la validation seule (R08 §5), relevé par la planche, la veille et la mesure |

Options : prise vidéo supplémentaire au-delà du plafond (facturée 2 500 FCFA ou 8 CAD), boost publicitaire sur compte et carte du client avec plafond mensuel au contrat (R23 §8.11), gestion du canal WhatsApp du client vers son public (produit distinct, statut Tech Provider, R22 §10.15).

Paiement : Stripe au Canada (2,9 % + 0,30 CAD, facturation récurrente 0,7 % de plus) ; Wave Business (environ 1 %) ou CinetPay (1,95 à 3,5 %) à Abidjan avec lien de paiement envoyé par WhatsApp, relance utilitaire 3 jours avant l'échéance, suspension douce après 30 jours (plus de nouvelles propositions, mais les publications programmées partent, R10 §8.11).

### 12.3 Marge et seuil de rentabilité

Coûts fixes mensuels de la plateforme : Railway 85 à 110 $, SerpApi 25 à 75 $, Apify environ 20 $, Upload-Post 50 $ ou Ayrshare 299 $, Blotato 29 $ si TikTok, R2 moins de 20 $, deux numéros WhatsApp (SIM prépayée et numéro virtuel), Remotion gratuit tant que l'effectif reste à 3 personnes (sinon 100 $ par mois minimum, R04 §4), Langfuse auto-hébergé, Claude Max de José inchangé. Total : 250 à 650 $ par mois selon l'API unifiée retenue.

Avec un revenu moyen de 650 $ par client et un coût variable de 60 à 110 $ plus 40 à 75 $ d'humain à Abidjan, la contribution par client est de 470 à 550 $. Les coûts fixes sont couverts dès 2 clients ; un gestionnaire à plein temps à Abidjan (300 000 FCFA, environ 490 $) est couvert par 3 clients supplémentaires et peut en servir 12 à 15 à 5 heures chacun. Seuil réaliste, José rémunéré à 2 000 $ par mois sur l'activité : 8 clients payants. À 20 clients et 13 000 $ de revenus mensuels, la marge nette dépasse 50 % avec deux gestionnaires.

Le poste qui peut faire déraper la facture est la vidéo générative (chaque prise coûte 1,26 à 3,09 $ les 15 secondes) : nombre de prises plafonné par palier, budget par client, alerte à 80 %, validation de la planche avant toute génération (R08 §10.5).

---

## 13. Risques, limites et garde-fous

### 13.1 Juridiques

| Risque | Parade |
|---|---|
| Une image brute n'a probablement pas d'auteur au Canada, en France ni dans l'OAPI (R08 §7.1) | Licence d'usage commercial illimitée cédée sans garantie d'exclusivité ; registre de provenance par média comme preuve d'apport humain et de licence ; jamais de palier gratuit pour un contenu publié (R08 §10.8-10.9) |
| Étiquetage IA : AI Act article 50 depuis le 2 août 2026, TikTok depuis le 24 septembre 2026, Instagram profils IA depuis le 31 août 2026 (R08 §7.6) | Drapeau « réaliste » calculé par la chaîne, `is_ai_generated` à la publication, mention en légende pour l'Union européenne, C2PA conservé ; contenus émotionnels sur assets réels pour éviter la taxe émotionnelle de l'étiquette (R11 §2.2) |
| Droit à l'image, mineurs, fidèles, références Higgsfield (R08 §7.4, R26 §5.12) | Registre de consentements lié aux médias, blocage de tout visage sans consentement, exclusion totale des mineurs, floutage du public, aucun visage de pasteur en référence |
| Allégations beauté (Santé Canada, règlement 655/2013, Meta du 23 juillet 2026) | Lexique par pays, contrôle de chaque légende, texte incrusté et voix off avant la planche, capture datée de la politique Meta par campagne (R26 §5.15) |
| Données personnelles : LPRPDE, Loi 25 (jusqu'à 10 M$ ou 2 %, R26 §5.16), RGPD, loi ivoirienne 2013-450 | Page de confidentialité par client avec sous-traitants et région, évaluation avant transfert hors Québec, offboarding outillé, José responsable de la protection des renseignements |
| Anti-pourriel : CASL (jusqu'à 10 M$ par violation), politique WhatsApp du 23 septembre 2026 | Opt-in en deux cases, preuve horodatée, STOP automatique, modèles approuvés, deux rappels maximum, aucune prospection depuis la machine |
| Conditions des plateformes : YouTube (téléchargement), LinkedIn (profils), TikTok (automatisation), Higgsfield (Unlimited) | Fichier source fourni par l'église, page LinkedIn par API et posts personnels manuels, TikTok par API auditée, Higgsfield par API payée |
| Musique | Catalogues des plateformes, Lyria 3 ou ElevenLabs Music sous compte payant, Epidemic Sound pour YouTube ; Suno jamais automatisé (R04 §8.12) |

### 13.2 Techniques

| Risque | Parade |
|---|---|
| Dépréciations en rafale (Sora 2, gpt-image-1 le 23 octobre 2026, gpt-image-1.5 le 1er décembre 2026, métriques Facebook le 15 juin 2026, LinkedIn-Version 202510 le 15 octobre 2026) : six faits sur dix avaient bougé en moins de six mois (R26) | Interface par moteur avec repli, moteur et version stockés par média, test hebdomadaire par fournisseur et par plateforme, contrôle trimestriel des pages primaires, `metric_alias` versionnée |
| Revues d'application longues (Meta jusqu'à 20 jours par cycle, R02) | API unifiée dès le jour 1, demandes officielles en parallèle, repli manuel de premier rang |
| Jetons expirés et PubSubHubbub non renouvelé, les deux pannes silencieuses (R21 §9.13) | Rafraîchissement à J-5, alerte à J-10, réabonnement tous les 3 jours, file « jetons » |
| Buckets Railway sans cycle de vie ni versionnage, médias WhatsApp éphémères (R25 §1.3, R21 §9.9) | Job `retention_purge`, copie R2 avec verrou, dump hebdomadaire hors Railway, webhook qui met en file et télécharge dans la minute |
| Quota YouTube partagé, reclassement d'un modèle WhatsApp, worker qui boucle | Lissage et second projet au-delà de 30 clients vidéo ; webhook de reclassement écouté et envoi bloqué ; limite de dépense dure Railway et plafonds par client |

### 13.3 Qualité et opérations

| Risque | Parade |
|---|---|
| Contenu plat : 56 % des utilisateurs voient du « AI slop » souvent, 50 % de la génération Z ont désabonné une marque pour cela (R11 §2.1) | Juge à sept critères bloquant à 15/21 avec test de substitution, ancrage réel obligatoire sur les contenus émotionnels, 20 % de contenus 100 % humains, fiche de voix mesurable, interdits français construits par statistique, calibration mensuelle et second juge d'une autre famille |
| Hallucination de faits, clip de sermon hors contexte, visuel de produit infidèle | Règle des deux sources et ligne « faits à confirmer », versets vérifiés contre une Bible de référence, validation humaine de chaque extrait, packshot réel en référence et comparaison vision |
| Client silencieux qui part sans bruit | Deux rappels, escalade, règle par défaut, alerte « risque de départ », revue mensuelle de 20 minutes (R08 §10.18) |
| Gestionnaire submergé | Files avec délais, deux réserves par planche, publication automatisée des contenus validés sans drapeau, cible de 5 heures par client mesurée |
| Dépendance au poste de José (Cowork, Chrome, Unlimited) | Rien de contractuel ne passe par le poste de José ; les pièces signature sont un bonus |
| Déploiement pendant un culte ou un cours, note de qualité WhatsApp qui chute | Projet Railway séparé et fenêtres de déploiement hors heures de publication ; fréquence bornée, modèles sobres, pause d'un modèle dès l'orange |

---

## 14. Feuille de route

| Phase | Durée | Contenu | Critères de sortie |
|---|---|---|---|
| 0. Les demandes qui ne se compressent pas | semaines 1 à 3 | Entreprise Markel-Tech vérifiée chez Meta ; app Meta avec les deux routes de connexion et les permissions de publication, messagerie, contenu public et HUMAN_AGENT ; compte WhatsApp Business Platform en accès direct, SIM +225 et numéro +1, sept modèles utilitaires, Flow générique ; projet Google audité ; app TikTok en audit ; app LinkedIn ; Google Business Profile ; comptes payants par moteur au nom de l'agence ; contrat type en trois versions relu par un avocat de chaque pays ; schéma Postgres validé par /db ; projet Railway « machine » provisionné au CLI | Toutes les demandes déposées, schéma validé, premier modèle WhatsApp approuvé |
| 1. Le noyau « planche, validation, pilotage » | semaines 2 à 8 | Intake WhatsApp (téléchargement immédiat, classification et extraction, accusé de réception) ; onboarding en 60 minutes chronométré (R21 §5.5) ; cerveau de marque et fiche de voix ; veille flux A et B sur sources gratuites ; idéation, calendrier, juge ; planche composite et PWA 390 px ; validation par boutons, Flow et lien magique ; rappels ; poste de pilotage avec ses files ; visuels, carrousels et Reels programmés Remotion ; publication par Upload-Post Pro ; collecte nocturne ; paquet prêt à publier. Pilotes : une cliente beauté d'Abidjan sur la SIM +225 (R22 §10.16) et SEVARTA | 4 planches validées par la cliente pilote ; délai médian dépôt vers planche sous 24 heures ; dépôts incomplets sous 20 % ; corrections humaines des fiches extraites sous 10 % (R21 §9.18) ; validation du premier coup au-dessus de 70 % |
| 2. Sermons, vidéo, rapport, boîte de réception | mois 3 et 4 | Chaîne sermon maison (Vizard ou Klap en hybride le premier mois) ; compositions Remotion par client ; Reels génératifs par l'API Higgsfield en modes brouillon et production ; QC vision en trois couches ; veille flux C et SerpApi ; calendrier à trois couches ; rapport mensuel ; liens traçables, lien en bio, QR, coupons ; boîte de réception ; indicateurs « à la page ». Pilote : une église d'Abidjan, 1 sermon par semaine pendant 4 semaines, WER sur 5 sermons de référence (R05 §8.20) | 3 clips sous 7 jours pour 100 % des sermons ; rapport livré le premier lundi ; lot d'évaluation de 50 cas par verticale passé au juge avec coût par asset mesuré (R07 §11.20) |
| 3. Canada, agents, amplification | mois 5 et 6 | Clients canadiens (association de Toronto, 2IAE admissions, Markel-Tech) sur le numéro +1 et Stripe ; serveur MCP distant à dix outils ; Routines « revue hebdomadaire » et « incident » ; tâche planifiée Cowork de José ; Agent SDK pour les sermons complexes et les audits ; boost en trois temps avec plafond au contrat ; Click-to-WhatsApp (R23 §8.17) ; Trial Reels ; bandit de hooks | 8 clients payants ; un gestionnaire à plein temps à Abidjan servant 10 clients à 5 heures chacun ; marge brute mesurée au-dessus de 55 % |
| 4. Nos propres apps et les produits adjacents | mois 7 à 12 | Migration client par client vers les API officielles, API unifiée en repli ; adaptateur WhatsApp Channels prêt ; produit « canal WhatsApp du client vers son public » en Tech Provider avec Embedded Signup v4 ; Managed Agents si José cesse d'opérer le conteneur agent ; médiane locale par verticale et par pays ; second projet Google au-delà de 30 clients vidéo | 20 clients ; infrastructure sous 2 % du chiffre d'affaires ; coût de génération visible et plafonné par client |

Acheté ou loué, parce que résolu et bon marché : publication multi-plateformes (Upload-Post ou Ayrshare, Blotato pour TikTok), images (OpenAI, fal), vidéo (Higgsfield API, Gemini, fal), transcription (AssemblyAI, Deepgram), voix (ElevenLabs), musique (Lyria, ElevenLabs Music, Epidemic), OCR long (Mistral OCR 4), brand kit (Firecrawl), recherche d'agent (Tavily, Exa), tendances (SerpApi, Apify), surveillance de pages (changedetection.io), observabilité (Langfuse), stockage (Railway, R2), paiement (Stripe, Wave, CinetPay), gabarits partagés avec le client (Canva). Construit, parce que différenciant : planche, validation WhatsApp et PWA, poste de pilotage à files, cerveau de marque, juge, chaîne sermon, compositions Remotion, veille à trois flux, rapport en trois couches, lien en bio et QR, boîte de réception, serveur MCP, registres de provenance et de consentements.

---

## 15. Questions ouvertes pour José

1. **Règle par défaut en cas de silence** : publier les contenus « valeur » et « relation » et retenir la « promotion », ou tout retenir ? Choix commercial par verticale, coché à l'onboarding (R08 §8.1).
2. **Le gestionnaire** : un salarié à Abidjan dès la phase 1, ou José seul jusqu'à 6 clients ? Le seuil de rentabilité à 8 clients suppose un gestionnaire local à plein temps.
3. **Effectif de Markel-Tech pour Remotion** : employés et contractuels restent-ils à 3 personnes au plus, et une plateforme vendue à des clients compte-t-elle comme usage interne (R04 §9.10) ? Sinon 100 $ par mois minimum.
4. **API unifiée de départ** : Upload-Post Pro (50 $, 25 profils) ou Ayrshare Launch (299 $, 10 profils) ? L'écart pèse 28 $ par client et par mois à 10 clients ; deux semaines de test sur les comptes de José trancheront.
5. **Prix réels à Abidjan et en Ontario** : trois devis d'agences dans chaque ville avant de figer les paliers (R08 §9.5).
6. **Église pilote** : laquelle, et sa régie peut-elle brancher une salle Daily ou déposer sur Drive ? Sinon, démarrage en mode « audio par WhatsApp ».
7. **TikTok avant audit** : Blotato à 29 $ par mois pour les clients pressés, ou publication manuelle depuis le paquet prêt à publier ?
8. **Clients québécois et européens** dès la phase 3 (évaluation avant transfert hors Québec, registre des traitements), ou Ontario, Côte d'Ivoire et France hors Québec jusqu'à relecture des clauses ?
9. **Cowork et Claude in Chrome après le 6 octobre 2026** : la bascule « nuage uniquement » annoncée pour Pro et Max change-t-elle l'accès de la tâche planifiée Cowork au MCP de la plateforme (R07 §11.10) ? À vérifier sur le poste de José avant la phase 3.
10. **Contrat Enterprise Higgsfield** pour exclure l'entraînement sur les références (section 4.4), ou s'en tenir à exclure visages et enfants ?
11. **Dates à confirmer** : Abidjan Fashion Week (deux dates contradictoires), fête des mères ivoirienne, fêtes musulmanes 2027 (R10 §9).
