# R23. Après la publication : commentaires, messages privés assistés par IA, et amplification payée des meilleures publications

Rapport de recherche pour la machine social media multi-clients de José Kouadio (Markel-Tech, SEVARTA, 2IAE). Rédigé le 2 octobre 2026. Toutes les dates citées sont celles des pages consultées ; les prix sont en dollars américains sauf mention contraire.

Méthode : 21 recherches web distinctes, 22 pages ouvertes et lues (documentation Meta for Developers, page de prix d'Anthropic, pages de prix d'Agorapulse et de Sprout Social, documentation TikTok for Business, articles datés de 2026). Trois pages officielles ont refusé l'accès (manychat.com/pricing en 403, l'aide Meta sur les budgets minimaux et sur l'éligibilité commerce vides, l'article LinkedIn sur les Thought Leader Ads en 404) : les chiffres correspondants viennent de sources secondaires datées et concordantes, signalées comme telles.

## 1. Résumé exécutif

La routine de José s'arrête à « publication, puis mesure ». Ce rapport documente les trois maillons manquants : la réponse aux commentaires et aux messages privés (avec l'IA en brouillon et un humain en validation), l'amplification payée des publications qui marchent, et la vente directe depuis les réseaux.

Six constats :

1. **Les API de conversation de Meta sont gratuites et complètes.** Lire et répondre aux commentaires Instagram et Facebook, envoyer une réponse privée à un commentaire (7 jours, un seul message), répondre en messagerie dans la fenêtre de 24 heures, prolonger à 7 jours avec l'étiquette HUMAN_AGENT quand un humain répond : tout cela coûte 0 dollar, seules les permissions et la revue d'application (App Review) sont exigées. Les plafonds de volume (750 réponses privées par heure et par compte, 100 messages texte par seconde) dépassent de loin le besoin d'une agence de six clients.
2. **TikTok reste le trou noir.** Aucune API de commentaires organiques pour un outil d'agence (confirmé par R02) ; l'API Business Messaging existe mais ne se déclenche pas depuis un commentaire hors Vietnam, Indonésie, Thaïlande. Les commentaires TikTok se traitent dans l'application, avec une file de rappel.
3. **Le marché vend cher ce que l'API donne gratuitement.** ManyChat Pro 29 à 39 dollars par mois pour 2 500 contacts (grille du 2 mars 2026), Chatfuel 69 dollars, Agorapulse 79 à 149 dollars par utilisateur et par mois, Sprout 199 à 399 dollars par siège, Brandwatch dès 800 dollars par mois sur devis. Pour six clients, une boîte de réception maison sur l'API coûte des centimes de tokens par mois.
4. **Le tri par Haiku 4.5 coûte entre 0,30 et 0,75 dollar pour 1 000 commentaires** (1 dollar par million de tokens en entrée, 5 dollars en sortie, 0,10 dollar en lecture de cache, moitié prix en Batch, page de prix Anthropic lue le 2 octobre 2026). Un brouillon de réponse dans la voix du client revient à environ 1,20 dollar pour 1 000. La validation humaine reste obligatoire pour les critiques, les sujets sensibles (église, santé, argent) et tout message envoyé hors fenêtre de 24 heures avec HUMAN_AGENT.
5. **Booster une publication existante est une opération d'API documentée** (creative avec object_story_id ou source_instagram_media_id, puis campagne, ensemble de publicités, publicité) ; le budget minimal technique de Meta est de 1 dollar par jour en impressions et 5 dollars par jour en clics ou conversions (sources secondaires 2026 citant l'aide Meta), TikTok Spark Ads exige 20 dollars par jour et par groupe d'annonces et un code d'autorisation du créateur (7, 30, 60 ou 365 jours), LinkedIn Thought Leader Ads exige l'accord par courriel de l'auteur. Les publicités Click-to-WhatsApp ouvrent 72 heures de messages gratuits si l'entreprise répond dans les 24 heures.
6. **La vente directe sur Instagram et Facebook s'est repliée sur le site marchand** : le paiement natif est abandonné, le catalogue et les étiquettes produit restent. Les Shops ne sont pas offerts en Côte d'Ivoire selon les listes consultées (Canada oui). Pour la cliente beauté d'Abidjan, la commande passe par le catalogue WhatsApp (500 produits, panier) et le lien de paiement local.

## 2. Partie 1 : Instagram et Facebook Messaging API, règles et limites

### 2.1 Les deux chemins d'accès et les permissions

Meta offre deux manières de brancher un compte Instagram professionnel :

| Chemin | Permissions pour les messages | Permissions pour les commentaires | Particularité |
|---|---|---|---|
| Connexion Facebook (compte Instagram lié à une Page) | `pages_messaging`, `instagram_manage_messages`, jeton de Page avec tâche MESSAGING | `instagram_basic`, `instagram_manage_comments`, `pages_read_engagement` | Chemin historique, nécessaire pour Messenger et pour les réponses privées Facebook |
| Connexion Instagram (sans Page) | `instagram_business_manage_messages` | `instagram_business_basic`, `instagram_business_manage_comments` | Chemin « Instagram API with Instagram Login », plus simple pour un client sans Page Facebook active |

Source : https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-comment/ (permissions par chemin ; depuis le 27 août 2024, `instagram_manage_comments` est requis pour lire le nom d'utilisateur de l'auteur d'un commentaire). Source : https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies (réponses privées : `instagram_manage_comments` et `pages_messaging`, accès avancé requis).

L'accès avancé (Advanced Access) à ces permissions passe par la revue d'application et la vérification de l'entreprise. Un compte en accès standard ne voit que les données des utilisateurs qui ont un rôle dans l'application : utile pour tester sur les comptes de José, inutile pour les clients. R02 détaille la revue d'application.

### 2.2 La fenêtre de 24 heures et l'étiquette HUMAN_AGENT

Règle de base, page de politique Messenger Platform et IG Messaging API lue le 2 octobre 2026 : une entreprise dispose de 24 heures après le dernier message de la personne pour répondre ; dans cette fenêtre, le message peut contenir du contenu promotionnel. Hors fenêtre, l'envoi est bloqué sauf étiquette autorisée.

Étiquettes :

| Étiquette | Fenêtre | Disponible sur Instagram | Condition |
|---|---|---|---|
| Standard (aucune) | 24 heures après le dernier message de la personne | Oui | Aucune |
| HUMAN_AGENT | 7 jours après le dernier message de la personne | Oui (la seule étiquette disponible sur Instagram) | Réponse manuelle d'un humain ; revue d'application et vérification d'entreprise ; usage support uniquement ; Meta journalise chaque usage et peut retirer l'étiquette en cas d'automatisation ou de promotion |
| CONFIRMED_EVENT_UPDATE, POST_PURCHASE_UPDATE, ACCOUNT_UPDATE | Hors fenêtre, mises à jour non promotionnelles | Non (Messenger seulement) | Approbation |

Sources : https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy (« allows businesses to manually respond to user messages within a 7-day period » ; « Misuse of tags may result in restrictions on your ability to send messages ») ; https://www.conferbot.com/limits/instagram (récapitulatif daté du 20 août 2026 : seule HUMAN_AGENT est disponible sur Instagram) ; https://www.keyapi.ai/blog/instagram-messaging-api-policy/.

Conséquence pour la machine : un brouillon généré par Haiku puis cliqué par un humain dans la boîte de réception compte comme réponse humaine ; un envoi programmé sans clic humain ne peut pas porter HUMAN_AGENT. La plateforme doit rendre ce clic obligatoire et le tracer (horodatage, identifiant du gestionnaire).

### 2.3 Réponses privées à un commentaire (private replies)

- Facebook : quand une personne commente une publication de la Page, la Page peut lui envoyer un seul message Messenger ; autorisé dans les 7 jours suivant le commentaire (page de politique, lue le 2 octobre 2026).
- Instagram : `POST /<PAGE_ID>/messages` avec `recipient: {comment_id}` et `message: {text}` ; un seul message par commentaire ; 7 jours pour les publications, Reels et publicités ; pendant la diffusion seulement pour les commentaires de Live ; la conversation ne peut continuer que si la personne répond, ce qui ouvre la fenêtre de 24 heures. Les commentaires sous publicités peuvent déclencher des webhooks en double. Source : https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies.

C'est le mécanisme exact du « commentez MOT CLÉ pour recevoir le lien » : webhook de commentaire, détection du mot clé, réponse publique courte, puis réponse privée avec le lien. Rien n'oblige à passer par ManyChat.

### 2.4 Ice breakers

Jusqu'à 4 questions affichées à l'ouverture d'une conversation Instagram, définies par `POST /me/messenger_profile` avec `platform=instagram`, locale par défaut obligatoire et variantes par langue ; la sélection déclenche un webhook `messaging_postbacks` avec un payload que la machine route (par exemple « Horaires des cultes », « Commander un livre », « Admission 2027 »). Non affichés sur ordinateur. Source : https://developers.facebook.com/docs/messenger-platform/instagram/features/ice-breakers.

### 2.5 Limites de volume

Page officielle de limitation de débit (Graph API), lue le 2 octobre 2026 :

| Opération | Instagram (par compte professionnel) | Facebook (par Page) |
|---|---|---|
| Messages texte, liens, réactions, stickers | 100 appels par seconde | 300 appels par seconde |
| Messages audio ou vidéo | 10 appels par seconde | 10 appels par seconde |
| Réponses privées aux commentaires de publications et Reels | 750 appels par heure | 750 appels par heure |
| Réponses privées aux commentaires de Live | 100 appels par seconde | non précisé |
| Conversations API (lecture des fils) | 2 appels par seconde | 2 appels par seconde |
| Appels Messenger sur 24 heures | non applicable | 200 × nombre d'utilisateurs engagés |

Source : https://developers.facebook.com/docs/graph-api/overview/rate-limiting/. Autres limites utiles (récapitulatif Conferbot, 20 août 2026, à partir de la documentation Meta) : 1 000 caractères par message texte, 13 réponses rapides, 10 cartes de carrousel, images 8 Mo, audio et vidéo 25 Mo, et un seuil de 72 000 messages reçus et envoyés au-delà duquel la boîte de réception cesse d'afficher les nouveaux messages. Source : https://www.conferbot.com/limits/instagram.

Pour l'API Graph en général (lecture des commentaires, insights), la limite Business Use Case reste de 200 appels par utilisateur et par heure (R02). Une église avec 300 commentaires le dimanche soir tient dans ces plafonds sans difficulté.

### 2.6 Politique : réponses automatisées et identification du bot

- Divulgation : « lorsque la loi l'exige », l'expérience automatisée doit se présenter au début de la conversation, après une longue pause, ou quand la conversation passe d'un humain à un automate ; Meta la recommande dans tous les cas. Formules admises : « I'm the [Page Name] bot », « You are interacting with an automated experience ». Source : https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy.
- Réactivité : un automate doit répondre à toute entrée de l'utilisateur, et le faire dans les 30 secondes (même page).
- Interdits : messages promotionnels hors fenêtre, usage de HUMAN_AGENT par un automate, achats d'engagement, boucles de suivi et désabonnement, bots de vues ; les outils de « commentaire automatique » hors API officielle exposent le compte à une restriction. Sources : page de politique ; https://instantdm.com/blog/facebook-auto-comment-bot-safe ; https://appbrewers.com/blog/instagram-dm-automation-policy-2026.
- Canada : la Loi sur la protection du consommateur de l'Ontario et la LCAP (anti-pourriel) s'appliquent aux messages commerciaux ; une réponse à une demande entrante dans les 24 heures est une communication sollicitée, pas un pourriel (voir R08 pour le cadre juridique).

### 2.7 Coût

Zéro dollar côté Meta pour les commentaires, les réponses privées, Messenger et Instagram Direct : aucune de ces pages ne mentionne de tarif, contrairement à WhatsApp Business Platform qui facture les modèles. Les coûts réels sont la revue d'application (temps), l'hébergement des webhooks (Railway, déjà payé) et les tokens d'IA (partie 4).

## 3. Partie 2 : outils de référence et prix 2026

### 3.1 Tableau comparatif

| Outil | Prix 2026 (date de lecture) | Ce qui est inclus | Limites et frais cachés | Source |
|---|---|---|---|---|
| ManyChat | Grille du 2 mars 2026 : Free 0 dollar (25 contacts), Essential 14 à 17 dollars (250 contacts), Pro 29 à 39 dollars (2 500 contacts), Business 69 à 99 dollars (7 500), Advanced 139 à 199 dollars (25 000) ; le premier chiffre est le tarif annuel, le second le mensuel | Commentaire vers DM, mentions en story, mots clés, Instagram + Messenger + WhatsApp ou SMS, IA incluse à partir de Pro selon cette source | Dépassement 0,10 dollar par contact (Essential), 0,05 (Pro), 0,025 (Business) ; une autre source cite une extension IA à 29 dollars par mois ; frais WhatsApp de Meta refacturés ; la page officielle est un calculateur, les tarifs fixes varient selon la région et le compte | https://setsmart.io/blog/manychat-pricing ; https://chatarmin.com/en/blog/manychat-pricing (juin 2026) ; https://chatarmin.com signale que l'ancienne grille Free 1 000 contacts et Pro dès 15 dollars coexiste encore pour certains comptes |
| Chatfuel | Un seul plan « AI Business Assistant » à 69 dollars par mois, essai 7 jours, pas de plan gratuit (2026) | Contacts illimités, 5 canaux (Instagram, WhatsApp, Messenger, TikTok, widget web), IA Fuely, réservation, CRM | Limites d'usage de l'IA en fort trafic ; frais WhatsApp refacturés (0,005 à 0,09 dollar par conversation selon pays et catégorie) | https://chatbotscape.com/reviews/chatfuel-review ; https://bossbot.uk/blog/chatfuel-pricing-review-2026 |
| Agorapulse | Standard 79 dollars par utilisateur et par mois en annuel (99 en mensuel), Professional 119 (149), Advanced 149 (199), Custom sur devis ; page de prix lue le 2 octobre 2026 | 10 profils sociaux par plan ; boîte unifiée ; Professional ajoute l'assignation et la détection de collision de réponses ; Advanced ajoute réponses enregistrées, règles de modération automatique, suggestions de réponse par IA (limitées), gestion de spam avancée | Profil supplémentaire 10 à 15 dollars par mois ; facturation par siège | https://www.agorapulse.com/pricing/ |
| Sprout Social | Essentials 79 dollars par siège et par mois en annuel (99 en mensuel), Standard 199, Professional 299, Advanced 399, Enterprise sur devis ; page lue le 2 octobre 2026 | Smart Inbox dès Standard ; étiquetage des messages dès Professional ; sentiment dans la boîte, réponses assistées par IA, API et intégrations helpdesk sur Advanced ; 100 crédits d'agent IA par siège et par mois | 5 profils seulement sur Essentials et Standard ; modules d'écoute et d'influence en supplément non publié | https://sproutsocial.com/pricing/ |
| Brandwatch (Social Media Management, ex Falcon, boîte Engage) | Sur devis ; fourchettes rapportées de 800 dollars par mois à 15 000 dollars et plus ; médiane constatée 50 000 dollars par an sur 40 achats (Vendr) | Une boîte pour toutes les interactions, écoute, publication | Réservé aux grandes équipes ; aucune grille publique | https://www.vendr.com/marketplace/brandwatch ; https://costbench.com/software/social-media-management/brandwatch/ |

Lecture pour José : six clients à deux sièges (José et un gestionnaire) coûtent au minimum 158 dollars par mois chez Agorapulse Standard (sans assignation ni réponses enregistrées) ou 398 dollars chez Sprout Standard, et 60 profils sociaux dépassent les 10 inclus d'Agorapulse (50 profils supplémentaires à 10 dollars : 500 dollars de plus). ManyChat se paie par client et par contact actif : six comptes Pro reviennent à 174 à 234 dollars par mois avant dépassement. Une boîte maison sur l'API Meta remplace les trois à un coût marginal.

### 3.2 « Commentez MOT CLÉ pour recevoir le lien » : mécanisme et impact revendiqué

Mécanisme : la publication demande un mot clé en commentaire ; le webhook `comments` reçoit chaque commentaire ; si le texte contient le mot clé, l'outil publie une réponse publique (« Envoyé en message privé ! ») et envoie une réponse privée avec le lien, le code promo ou le document. Instagram traite chaque commentaire comme un signal d'engagement, et chaque conversation ouverte comme une relation. Source : https://manychat.com/blog/instagram-quick-automation-comment-to-dm-guide/.

Impact revendiqué : étude HypeAuditor et ManyChat sur 6 000 créateurs américains vérifiés de plus de 1 000 abonnés (3 000 avec automatisation, 3 000 sans, appariés) : 40 à 150 % de commentaires en plus par publication selon le palier (micro-créateurs : 46 commentaires par publication contre 18, soit +156 %), taux d'engagement médian supérieur à toutes les tailles d'audience (jusqu'à +30 % chez les créateurs moyens), croissance d'abonnés 30 à 140 % plus rapide sur un an. L'étude est corrélationnelle, limitée aux États-Unis, et la plus marquée en éducation, coaching, fitness et marketing. Source : https://hypeauditor.com/manychat/. Témoignages ManyChat (non vérifiables) : 1,6 million de comptes atteints (+172 %), 135 000 dollars générés par deux publications.

Retenue : l'effet mesurable et défendable est l'augmentation des commentaires et des conversations ouvertes (donc des fenêtres de 24 heures et des contacts qualifiés), pas un chiffre d'affaires. Pour une église, le mot clé « PRIÈRE » sous le replay du dimanche ouvre une conversation privée ; pour SEVARTA, « LIVRE » envoie le lien KDP ; pour 2IAE, « ADMISSION » envoie la brochure.

## 4. Partie 3 : chaîne IA de tri des commentaires et des messages

### 4.1 Classes et règles de routage

| Classe | Exemples | Action automatique | Validation humaine |
|---|---|---|---|
| Question | horaires, prix, disponibilité, adresse | brouillon de réponse publique à partir de la base de connaissances du client | obligatoire la première semaine, puis facultative si la réponse vient d'une FAQ validée |
| Intention d'achat ou d'inscription | « comment commander », « je veux m'inscrire » | réponse publique courte + réponse privée avec lien (7 jours) ; fiche prospect dans la plateforme | facultative (modèle validé par le client) |
| Spam, arnaque, publicité | liens, cryptomonnaies, « DM moi » | masquage (`hide=true`) et journal | contrôle hebdomadaire par échantillon |
| Critique, plainte, colère | produit abîmé, retard, accusation | aucune réponse automatique ; alerte WhatsApp (CallMeBot) au gestionnaire ; brouillon d'excuse et proposition de passage en privé | obligatoire, sous 1 heure en journée |
| Prière, détresse, santé, argent, doctrine | demande de prière, maladie, deuil, dette, question théologique | aucune réponse automatique ; file « pastorale » ou « sensible » ; brouillon neutre et chaleureux | obligatoire, par le client (pasteur, médecin, directeur), jamais par l'agence seule |
| Compliment, émoji, mention | « magnifique », « amen », tag d'un ami | like + réponse courte variée (banque de 20 formules par client) | non |

Le masquage d'un commentaire est réversible et invisible pour son auteur, ce qui rend l'erreur de classification peu coûteuse ; la suppression est réservée aux humains. Source : https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-comment/.

### 4.2 Coût avec Claude Haiku 4.5

Prix officiels (page de prix Anthropic, lue le 2 octobre 2026) : Haiku 4.5 à 1 dollar par million de tokens en entrée, 5 dollars en sortie, 1,25 dollar en écriture de cache 5 minutes, 0,10 dollar en lecture de cache ; Batch API à 0,50 et 2,50 dollars (remise de 50 %). Sonnet 5 et 5.5 : 2 et 10 dollars. Source : https://platform.claude.com/docs/en/about-claude/pricing.

Estimation pour 1 000 commentaires (hypothèses : consigne système de 500 tokens mise en cache, 100 tokens par commentaire avec contexte de la publication, 30 tokens de sortie en JSON) :

| Scénario | Entrée | Sortie | Total pour 1 000 |
|---|---|---|---|
| Sans cache, temps réel | 600 000 tokens = 0,60 dollar | 30 000 tokens = 0,15 dollar | 0,75 dollar |
| Avec cache de la consigne, temps réel | 500 000 en lecture de cache = 0,05 dollar + 100 000 = 0,10 dollar | 0,15 dollar | 0,30 dollar |
| Avec cache, Batch (traitement nocturne du spam et des compliments) | 0,075 dollar | 0,075 dollar | 0,15 dollar |

Brouillon de réponse dans la voix du client (guide de voix et FAQ de 1 000 tokens en cache, 500 tokens de contexte, 120 tokens de sortie) : environ 0,10 + 0,50 + 0,60 = 1,20 dollar pour 1 000 brouillons. Pour une église qui reçoit 2 000 commentaires par mois et 300 messages, le budget IA mensuel est inférieur à 3 dollars. Même en multipliant par six clients et par trois pour la marge d'erreur, le poste tokens reste sous 60 dollars par mois, à comparer aux 174 dollars minimum de six comptes ManyChat Pro.

Comparaison ordre de grandeur : la note Anthropic chiffre 10 000 tickets de support à environ 37 dollars avec Haiku 4.5 (3 700 tokens par conversation), soit 3,70 dollars pour 1 000 conversations complètes, cohérent avec l'estimation ci-dessus.

### 4.3 Voix du client et garde-fous

- Le brouillon s'appuie sur le dossier de voix constitué à l'intake (R21) et sur la doctrine R11 (anti-slop) : formules interdites, tutoiement ou vouvoiement, signature (« L'équipe SEVARTA », « Pasteur X »).
- Aucune réponse automatique ne promet un prix, un délai, un diagnostic ou une position doctrinale : ces champs sont des variables tirées de la fiche client, jamais générés.
- La divulgation du bot n'est pas nécessaire pour un commentaire public rédigé par IA et cliqué par un humain ; elle est obligatoire quand la machine répond seule en message privé (ice breaker ou mot clé) : la première réponse se présente (« Assistant automatique de [client], un membre de l'équipe prend le relais si besoin »).
- Tout message hors fenêtre de 24 heures passe par un humain et porte HUMAN_AGENT ; la plateforme bloque l'envoi programmé dans ce cas.

### 4.4 Cas TikTok

Confirmation de R02 : aucun endpoint public de lecture ou de modération des commentaires organiques dans le Content Posting API ni le Display API. L'API Organic de TikTok for Business (lister les commentaires des vidéos possédées, répondre, créer un commentaire) existe, mais son accès passe par une demande à TikTok for Business via le Business Center, réservée aux partenaires approuvés ; la page de documentation n'a renvoyé que son titre lors de la lecture. L'API Business Messaging est en service chez des partenaires (SleekFlow, MessageGate) mais ne peut pas déclencher un message depuis un commentaire : le webhook de commentaire n'existe pas, et le « comment to message » est limité aux comptes du Vietnam, d'Indonésie et de Thaïlande. Sources : https://business-api.tiktok.com/portal/docs/organic-api-overview/v1.3 ; https://business-api.tiktok.com/portal/docs/reply-to-a-comment/v1.3 ; https://creatorlanehq.com/blog/tiktok-dm-automation-state-2026 ; https://instantdm.com/blog/how-to-automate-tiktok-2026.

Règle pratique : la plateforme produit chaque matin une tâche « TikTok : X vidéos à commenter dans l'app » classée par volume de commentaires (compteurs publics du Display API), et le gestionnaire répond depuis le téléphone ; les réponses types sont copiées depuis la plateforme. Le temps passé est facturé au client dans le pack.

## 5. Partie 4 : amplification payée

### 5.1 Meta : booster une publication organique existante par la Marketing API

Chaîne documentée (référence Ad Creative, lue le 2 octobre 2026, API v25.0) :

1. Créer une creative à partir de la publication existante : `POST /act_<AD_ACCOUNT_ID>/adcreatives` avec `object_story_id=<PAGE_ID>_<POST_ID>` pour une publication Facebook, ou `source_instagram_media_id=<IG_MEDIA_ID>` pour une publication Instagram ; `effective_object_story_id` renvoie l'identifiant quel que soit le statut (organique ou non publié).
2. Créer une campagne (`objective` : OUTCOME_ENGAGEMENT pour les interactions, OUTCOME_TRAFFIC pour les clics, OUTCOME_LEADS pour Click-to-WhatsApp ou formulaire), puis un ensemble de publicités (budget, ciblage, placement), puis la publicité qui référence la creative.
3. Depuis le 21 janvier 2026, les champs `instagram_actor_id` et `instagram_story_id` sont remplacés par `instagram_user_id` et `instagram_media_id` ; plusieurs endpoints ne prennent plus les anciens objets.

Sources : https://developers.facebook.com/docs/marketing-api/reference/ad-creative/ ; https://ppc.land/meta-simplifies-instagram-and-marketing-api-integrations/ ; https://www.ayrshare.com/blog/facebook-ads-api-boosting-with-the-marketing-api/ (exemple de bout en bout).

Permissions : `ads_management` (écriture) et `ads_read`. Sans revue d'application, un jeton d'utilisateur système suffit pour les comptes publicitaires de son propre Business Manager ; dès que les comptes des clients sont gérés depuis un autre Business, l'accès avancé et la revue sont nécessaires. Le seuil d'éligibilité au palier « Marketing API Access Tier » est passé à 500 appels sur 15 jours (contre 1 500) et l'enregistrement d'écran n'est plus exigé. Sources : https://www.adamigo.ai/blog/meta-ads-api-access-levels-for-agencies ; https://adadvisor.ai/blog/meta-app-review-mcp. Dans la pratique, José gère les comptes publicitaires des clients comme partenaire dans leur Business Manager : chaque client reste le bénéficiaire et le payeur, ce qui évite de porter les dépenses sur la carte de l'agence.

Budget minimal par jour (sources secondaires 2026 citant l'aide Meta « Best practices for minimum budgets », dont la page n'a pas pu être lue) : 1 dollar pour les impressions, 5 dollars pour les clics, mentions J'aime, vues ou conversions, 40 dollars pour les événements à basse fréquence ; en cas d'objectif de coût par résultat, au moins 5 fois le coût cible. Les minimums sont exprimés en dollars et convertis dans la devise de facturation du compte. Sources : https://www.stackmatix.com/blog/facebook-ads-minimum-budget-requirements (23 août 2026) ; https://peretz.agency/blog/media-strategy-generates-leads-2026. Côte d'Ivoire et Canada : aucune source ne mentionne un minimum différent ; un compte facturé en dollars canadiens suit l'équivalent (environ 1,40 et 7 dollars canadiens), un compte ivoirien facturé en dollars américains suit les montants nominaux (voir incertitudes sur le franc CFA).

Coûts constatés en Afrique de l'Ouest (Nigeria, 2026, à défaut de données ivoiriennes) : CPM 1 à 2 dollars, coût par interaction 10 à 150 nairas (0,01 à 0,10 dollar). Sources : https://grey.co/blog/facebook-ads-cost-nigeria ; https://adligator.com/blog/meta-ads-cpm-by-country-benchmarks. Canada : CPM nettement plus élevé (voir R10).

Boost depuis Business Suite contre Ads Manager : un test contrôlé rapporte 3,09 dollars par clic pour un bouton Booster contre 1,04 dollar pour la même creative montée dans Ads Manager (source secondaire : https://admakeai.com/blog/how-to-boost-facebook-post). Le bouton Booster applique par défaut l'audience Advantage+ et des placements automatiques ; la Marketing API permet le même résultat avec un ciblage choisi.

Vérification de l'annonceur : depuis mars 2026, Meta remplace « bénéficiaire » par « annonceur » et étend la vérification obligatoire (identité ou entreprise) aux secteurs sensibles (finance, assurance), aux pays où la loi l'exige (Australie, Inde, Taïwan, Royaume-Uni), aux comptes à historique de rejets et aux comptes signalés ; objectif déclaré : 90 % des revenus publicitaires issus d'annonceurs vérifiés fin 2026 (70 % en mars). Le Canada n'impose la vérification que pour la publicité politique. La vérification débloque des plafonds de dépense plus élevés. Sources : https://mediaincanada.com/2026/03/12/meta-anti-scam/ ; https://izeads.com/blog/meta-advertiser-verification ; https://www.emarketer.com/content/meta-expands-advertiser-verification-amid-scam-concerns. Recommandation : faire vérifier le Business Manager de chaque client dès l'intake (R21), avant le premier boost.

Advantage+ : la documentation Marketing API lue ne décrit pas de bascule « boost Advantage+ » distincte ; Advantage+ désigne l'audience élargie par défaut, les placements automatiques et les améliorations de creative. Pour un boost d'engagement local (Abidjan, Toronto), l'audience Advantage+ avec une « suggestion » géographique suffit ; pour un Click-to-WhatsApp, elle est recommandée par Meta.

### 5.2 TikTok Spark Ads

- Principe : la publicité utilise la vidéo organique d'un compte (celui du client ou d'un créateur) et toute l'interaction payée (likes, commentaires, partages, abonnés dans la journée suivant la vue, visites de profil) est créditée à la publication organique. Formats : vidéo de 10 minutes maximum, sans contrainte de ratio ni de définition ; publications bannies rejetées ; 10 000 Spark Ads par compte Ads Manager. Objectifs en enchères : portée, trafic, vues, interaction communautaire, promotion d'application, conversions, génération de prospects, ventes. Source : https://ads.tiktok.com/help/article/spark-ads (lue le 2 octobre 2026).
- Autorisation : le créateur active « Ad authorization » dans Paramètres, Outils de créateur, Ad settings, puis sur la vidéo (menu trois points), choisit 7, 30, 60 ou 365 jours (30 par défaut), génère un code alphanumérique commençant par # et le transmet ; l'annonceur l'entre dans Ads Manager. Le créateur peut révoquer ; une vidéo supprimée ou passée en privé invalide le code ; à l'expiration, la diffusion s'arrête sans avertissement (erreur 4025) et un nouveau code est nécessaire. Sources : https://admakeai.com/blog/tiktok-spark-ads (20 juin 2026) ; https://www.genviral.io/blog/how-to-get-tiktok-spark-code.
- Coût : minimum 20 dollars par jour et par groupe d'annonces, 50 dollars par jour par campagne, 500 dollars en budget à vie (sources secondaires 2026 : https://www.stackmatix.com/blog/tiktok-ads-cost-2026-pricing-breakdown ; https://www.enrichlabs.ai/blog/tiktok-spark-ads-complete-guide-2026). CPM moyen rapporté 4 à 14 dollars selon le secteur, 5 à 10 dollars pour les Spark Ads. Si la vidéo appartient à un créateur tiers, le droit d'usage se négocie à 30 à 100 % du cachet de base par 30 jours.
- Pour José : les comptes TikTok des clients sont les leurs, donc le code d'autorisation vient du client lui-même (procédure à mettre dans le guide d'intake) ; la plateforme stocke la date d'expiration et alerte 3 jours avant.

### 5.3 LinkedIn Thought Leader Ads (Markel-Tech)

- Qui : les publications d'employés (le profil doit indiquer l'entreprise comme employeur actuel), de dirigeants, et de relations de 1er ou 2e degré de la Page ; au-delà, passage par le Creator Marketplace.
- Accord : l'annonceur envoie une demande depuis Campaign Manager, l'auteur approuve par courriel, l'annonceur est notifié ; l'auteur peut révoquer et la publicité s'arrête aussitôt. Accès requis : Creative Manager ou plus sur le compte publicitaire, administrateur ou poster de contenu sponsorisé sur la Page.
- Formats admis : image unique, vidéo native, article natif, newsletter, événement LinkedIn Live ; refusés : documents, sondages, multi-images, carrousels, célébrations, republications. Objectifs : notoriété et engagement (image, vidéo), vues (vidéo), génération de prospects (articles). La publication doit être publique ; une source cite une limite de 365 jours d'ancienneté (non confirmée sur la page LinkedIn, en 404 lors de la lecture).
- Sources : https://www.affectgroup.com/blog/linkedin-thought-leader-ads-formats-and-requirements/ (22 juillet 2026) ; https://goampy.com/resources/how-to-set-up-thought-leader-ads-linkedin ; https://www.commenti.in/blogs/what-is-linkedin-thought-leader-ads.
- Budget : LinkedIn n'impose pas de minimum spécifique aux Thought Leader Ads ; le minimum de la plateforme est de 10 dollars par jour par campagne (voir R09 pour les repères B2B).

### 5.4 Publicités Click-to-WhatsApp (CTWA)

- Mécanisme : publicité Facebook ou Instagram dont le bouton ouvre WhatsApp avec un message pré-rempli. Quand la personne écrit, une fenêtre de service de 24 heures s'ouvre ; si l'entreprise répond dans ces 24 heures, un point d'entrée gratuit de 72 heures s'ouvre, pendant lequel tout type de message (modèles marketing compris) est gratuit. Source officielle : https://developers.facebook.com/docs/whatsapp/pricing (lue le 2 octobre 2026). Cohérent avec R10.
- Tarifs par message livré hors fenêtre gratuite (grille Meta rapportée pour le 1er octobre 2026) : Reste de l'Afrique (dont la Côte d'Ivoire, indicatif 225) marketing 0,0225 dollar, utilitaire 0,004 dollar ; Amérique du Nord marketing 0,025 dollar, utilitaire 0,0034 dollar. Sources : https://www.flowcall.co/blog/whatsapp-business-api-pricing ; https://whautomate.com/whatsapp-business-api-pricing. Changement signalé par ces mêmes sources au 1er octobre 2026 : les messages de service dans la fenêtre de 24 heures deviennent payants au tarif utilitaire au-delà de 1 000 messages gratuits par numéro et par mois ; la page de Meta ne le confirmait pas lors de la lecture (voir incertitudes, et R10 qui note la même divergence).
- Coût publicitaire : la facture totale est la dépense média plus les messages payants plus la marge du fournisseur ; les sources ne donnent pas de coût par conversation fiable pour la Côte d'Ivoire. Source : https://www.wati.io/en/blog/click-to-whatsapp-ads-cost/ (18 août 2026).
- Pour la machine : la campagne CTWA se crée par la Marketing API (objectif OUTCOME_ENGAGEMENT ou OUTCOME_LEADS avec destination WhatsApp) et la plateforme doit garantir la réponse dans les 24 heures (alerte CallMeBot au gestionnaire si aucune réponse après 2 heures), sinon la gratuité de 72 heures est perdue.

### 5.5 Règle d'automatisation défendable pour le boost

Principe : la machine propose, le client décide, le gestionnaire exécute. Un boost n'est jamais lancé sans validation écrite (bouton dans l'espace client ou réponse WhatsApp horodatée).

Seuil de performance organique à 24 heures (calculé par la plateforme à partir des insights R02) : une publication est « candidate au boost » si, 24 heures après sa mise en ligne, elle remplit au moins deux conditions sur trois :

1. taux d'interaction (likes + commentaires + partages + enregistrements, divisé par la portée) supérieur ou égal à 1,5 fois la médiane des 30 dernières publications du client ;
2. portée supérieure ou égale à 1,5 fois la médiane des 30 dernières publications ;
3. pour une vidéo, taux de rétention moyen supérieur à la médiane, ou pour une publication avec lien, clics supérieurs à 2 fois la médiane.

Garde-fous :

- Une seule proposition par client et par semaine au maximum, envoyée avec capture de la publication, estimation de portée Meta et budget proposé.
- Budget proposé par défaut : 7 jours, 5 dollars par jour en objectif interaction (Abidjan) ou 10 dollars par jour (Canada), soit 35 à 70 dollars par boost ; les montants et le pack sont ceux de R10.
- Plafond mensuel par client fixé au contrat (par exemple 100 000 FCFA ou 150 dollars canadiens) et vérifié par la plateforme avant création de la campagne ; le compte publicitaire du client porte la dépense, jamais la carte de l'agence.
- Reste interdit sans validation explicite et séparée : tout boost d'une publication contenant un prix, une promotion, une offre d'admission, un témoignage de guérison, une déclaration politique ou religieuse polémique, une image d'un mineur, un contenu de santé ou financier (catégories soumises à vérification ou à politique spéciale chez Meta) ; tout boost vers un pays autre que celui du client ; tout dépassement du plafond ; toute Spark Ad sur la vidéo d'un tiers sans contrat écrit.
- Mesure à J+7 : coût par interaction, coût par conversation ouverte, nouveaux abonnés ; rapport automatique au client ; une publication boostée dont le coût par interaction dépasse 2 fois le repère du pays est arrêtée par le gestionnaire (pas par la machine seule).

Justification : les seuils relatifs (médiane du client) évitent de comparer une église de 800 abonnés à une marque de beauté de 40 000 ; la fenêtre de 24 heures correspond à la période où l'algorithme a déjà testé la publication sur son audience chaude ; le plafond contractuel protège l'agence contre un litige de dépense (R08).

## 6. Partie 5 : social commerce

### 6.1 État des Shops Facebook et Instagram en 2026

- Le paiement natif dans l'application (checkout on Facebook and Instagram) a été abandonné en septembre 2025 dans la plupart des régions ; le modèle actuel renvoie l'acheteur vers le site du marchand. Le catalogue, les étiquettes produit dans les publications, Reels et stories, et la vitrine restent ; l'onglet Boutique du profil Instagram a disparu pour de nombreux vendeurs dès 2023 aux États-Unis. Sources : https://www.godatafeed.com/blog/meta-is-dropping-native-checkout-on-facebook-and-instagram ; https://www.bigcommerce.com/blog/updates-to-meta-shops-checkout-for-bigcommerce/ ; https://www.conbersa.ai/learn/instagram-shop-setup-2026.
- Pays : les Shops et le marquage de produits sont offerts dans une quarantaine de pays, dont le Canada et les États-Unis, l'Europe de l'Ouest, le Brésil et le Mexique ; aucune liste consultée ne mentionne la Côte d'Ivoire ni un pays d'Afrique de l'Ouest francophone. La page officielle d'éligibilité commerce n'a pas pu être lue. Sources : https://www.icekulfi.com/blogs/instagram-shopping-setup-guide ; https://shopsetupexperts.net/facebook-shop-instagram-shop-supported-countries/ ; https://www.facebook.com/business/help/1627591223954487 (page vide à la lecture).
- Conséquence : la « boutique Facebook » vendue dans le pack E-commerce à 900 000 FCFA d'une agence d'Abidjan (R10, Digit Communication) correspond en pratique à un catalogue Commerce Manager et à une vitrine, sans paiement intégré, ou à une page de produits dont la commande se conclut sur WhatsApp. La plateforme doit dire clairement au client ce qu'il achète.

### 6.2 Catalogue et commandes par WhatsApp

- Application WhatsApp Business gratuite : catalogue de 500 produits maximum, panier permettant au client d'envoyer une commande groupée, réponses rapides, listes de diffusion de 256 contacts (R10). Sources : https://faq.whatsapp.com/1184376605821468 ; https://chatarmin.com/en/blog/whatsapp-business-catalog.
- Cloud API : catalogues reliés à Commerce Manager, messages produit (single et multi-product messages), réception des commandes sous forme de message `order` à traiter par la plateforme. Source : https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/catalogs-overview/.
- Contexte ivoirien : WhatsApp est le premier canal de vente numérique des PME, avec environ 10 à 11 millions d'utilisateurs (85 % des internautes), et la majorité des PME répond encore manuellement. Sources : https://www.askyazi.com/articles/whatsapp-penetration-across-africa-statistics-by-country ; https://www.pixlstudio.africa/en/automatisation-whatsapp-crm-les-3-secrets-des-entreprises-ivoiriennes-qui-vendent-24h-24-sans-intervention-humaine ; https://ijias.issr-journals.org/abstract.php?article=IJIAS-26-056-05.
- Pour la cliente beauté d'Abidjan : un seul catalogue Commerce Manager alimente les étiquettes produit Instagram (si le compte est éligible, à vérifier avec un compte dont le pays de la Page est le Canada ou la France, ou sinon abandonner cette brique), les messages produit WhatsApp, et les publicités catalogue ; la commande arrive en message `order`, la plateforme crée la fiche commande, le paiement se fait par Orange Money, Wave ou MTN MoMo via lien (R10), et le suivi de livraison part en modèle utilitaire (0,004 dollar) ou gratuitement dans la fenêtre.
- Pour SEVARTA : le livre se vend sur KDP (Canada, France) et par WhatsApp ou dépôt en Côte d'Ivoire ; le mot clé « LIVRE » en commentaire envoie le lien pertinent selon le pays déclaré par la personne (question posée par la réponse privée).

## 7. Incertitudes et points à vérifier

1. **ManyChat** : la page officielle est un calculateur par nombre de contacts et refuse les robots ; deux grilles coexistent (ancienne Free 1 000 contacts et Pro dès 15 dollars ; nouvelle du 2 mars 2026 à cinq paliers) et les sources secondaires divergent sur l'inclusion de l'IA dans Pro (incluse selon SetSmart, extension à 29 dollars selon d'autres). À vérifier en ouvrant le calculateur depuis le compte de José.
2. **Budgets minimaux Meta** : les montants 1, 5 et 40 dollars par jour viennent de sources secondaires citant la page d'aide « Best practices for minimum budgets », vide lors de la lecture. La devise de facturation possible pour un compte ivoirien (franc CFA ou dollar américain) et le minimum équivalent en FCFA ne sont pas confirmés.
3. **Advantage+ et boost** : aucune page officielle lue ne décrit un paramètre d'API spécifique au bouton Booster ; l'équivalence « boost = campagne engagement avec audience Advantage+ » est une interprétation.
4. **Spark Ads** : la page officielle lue ne détaille pas les durées 7, 30, 60, 365 jours ; elles viennent d'articles de juin 2026 ; l'article d'aide TikTok sur la génération du code n'existe plus à l'adresse consultée. Les minimums 20 et 50 dollars par jour sont de sources secondaires.
5. **LinkedIn** : page d'aide officielle en 404 ; la limite de 365 jours d'ancienneté et la liste exacte des formats admis (texte seul admis ou non) divergent entre sources.
6. **WhatsApp au 1er octobre 2026** : la facturation des messages de service au-delà de 1 000 par numéro et par mois est affirmée par Flowcall et Wati, non confirmée sur la page de prix de Meta ; R10 note la même divergence. À vérifier avant de promettre un coût au client.
7. **Instagram Shopping en Côte d'Ivoire** : absence dans les listes consultées, mais la page officielle d'éligibilité n'a pas pu être lue ; un test réel avec le compte de la cliente beauté tranchera.
8. **TikTok Organic API** : les pages de documentation n'ont renvoyé que leur titre ; les conditions d'accès (partenaire approuvé, pays) viennent de sources tierces de 2026 ; une demande d'accès par Markel-Tech est le seul moyen de savoir.
9. **Étude HypeAuditor et ManyChat** : corrélationnelle, États-Unis seulement, sans date de collecte publiée ; les chiffres de témoignages (1,6 million de comptes, 135 000 dollars) ne sont pas vérifiables.
10. **Règle des 30 secondes** : la politique l'énonce pour les automates ; son application à un brouillon validé par un humain (donc envoyé plus tard) n'est pas précisée ; l'interprétation retenue est qu'elle vise les flux entièrement automatiques.
11. **Coûts publicitaires en Côte d'Ivoire** : aucun repère ivoirien trouvé ; les CPM du Nigeria (1 à 2 dollars) servent d'approximation.
12. **Estimation des tokens** : les 0,30 à 0,75 dollar pour 1 000 commentaires reposent sur des hypothèses de longueur (100 tokens par commentaire, 30 en sortie) ; à mesurer sur un échantillon réel.

## 8. Implications pour la machine de José

1. **Construire la boîte de réception dans la plateforme, pas chez ManyChat ou Agorapulse.** Les API de commentaires et de messagerie Meta sont gratuites, les plafonds (750 réponses privées par heure, 100 messages par seconde) couvrent dix fois le besoin, et six comptes ManyChat Pro coûteraient 174 à 234 dollars par mois sans la voix du client. Les tokens Haiku pour six clients restent sous 60 dollars par mois.
2. **Demander dès maintenant les permissions en accès avancé** : `instagram_manage_comments`, `instagram_manage_messages`, `pages_messaging`, `pages_manage_engagement`, `ads_management`, `ads_read`, plus l'étiquette HUMAN_AGENT, en une seule revue d'application avec vidéo de démonstration de la boîte de réception. Prévoir trois à six semaines (R02).
3. **Implémenter le « commentez MOT CLÉ » en interne** : webhook `comments`, détection du mot clé par client, réponse publique variée, réponse privée avec lien dans les 7 jours, un seul message par commentaire, journal des envois. Mots clés par verticale : PRIÈRE (église), LIVRE (SEVARTA), ADMISSION (2IAE), PRODUIT ou PROMO (beauté), BILLET (association), GUIDE (Markel-Tech sur LinkedIn, où l'envoi se fait à la main).
4. **Classer chaque commentaire et message avec Haiku 4.5 en six classes** (question, achat, spam, critique, sensible, compliment) avec consigne mise en cache et sortie JSON ; traiter spam et compliments en Batch nocturne, le reste en temps réel. Coût cible : moins de 1 dollar pour 1 000 commentaires.
5. **Rendre la validation humaine obligatoire et traçable** pour les critiques, les sujets sensibles (prière, santé, argent, doctrine) et tout envoi hors fenêtre de 24 heures ; le clic du gestionnaire porte l'étiquette HUMAN_AGENT et son identifiant est journalisé. Les églises valident elles-mêmes les réponses pastorales : l'agence ne prie pas à la place du pasteur.
6. **Afficher au client un indicateur de réactivité** (délai médian de première réponse aux commentaires et messages, part des messages répondus en moins d'une heure) : 42 % des clients attendent moins d'une heure (R10) et 73 % partent sans réponse (R08) ; cet indicateur justifie à lui seul le pack.
7. **Déclarer l'automate en message privé** quand la machine répond seule (ice breaker, mot clé), avec une formule fixe par client, et ne jamais laisser un automate répondre à une plainte. C'est la politique Meta et la loi ontarienne.
8. **Configurer quatre ice breakers par client** depuis la fiche d'intake (R21), avec payloads routés vers la FAQ, la commande, l'inscription et « parler à quelqu'un ».
9. **Traiter TikTok hors API** : tâche quotidienne « commentaires TikTok à traiter » classée par volume, réponses types copiées depuis la plateforme, temps facturé ; ne pas acheter d'outil qui promet des réponses TikTok automatiques, et déposer une demande d'accès à l'API Organic pour lever le doute.
10. **Coder la règle de boost en trois temps** : détection à 24 heures (deux conditions sur trois dépassant 1,5 fois la médiane des 30 dernières publications), proposition au client avec capture et budget, exécution par le gestionnaire après validation écrite. Jamais de boost automatique.
11. **Inscrire dans chaque contrat un plafond mensuel de boost et la liste des contenus exclus** (prix, promotions, admissions, santé, religion polémique, mineurs, finance) ; la plateforme refuse la création de campagne au-delà du plafond. Le compte publicitaire et la carte sont ceux du client (bénéficiaire et payeur identiques), ce qui simplifie la vérification d'annonceur que Meta veut porter à 90 % des revenus fin 2026.
12. **Faire vérifier le Business Manager de chaque client à l'intake**, avant le premier boost : plafonds de dépense plus élevés, appels plus rapides, moins de rejets.
13. **Budget de boost par défaut** : 5 dollars par jour sur 7 jours en objectif interaction à Abidjan (CPM régional 1 à 2 dollars, donc 2 000 à 3 500 impressions par jour), 10 dollars par jour au Canada ; mesure à J+7 ; arrêt humain si le coût par interaction dépasse 2 fois le repère.
14. **Préférer la Marketing API au bouton Booster** : même creative (`object_story_id` ou `source_instagram_media_id`), ciblage choisi, et un test rapporte un coût par clic trois fois plus bas qu'avec le bouton.
15. **Pour TikTok, faire générer le code Spark Ads par le client** (procédure illustrée dans le guide d'intake, durée 365 jours), stocker la date d'expiration et alerter trois jours avant ; prévoir 20 dollars par jour minimum par groupe d'annonces.
16. **Pour Markel-Tech, sponsoriser les publications personnelles de José en Thought Leader Ads** (image ou vidéo native, jamais de document ni de carrousel), avec approbation par courriel conservée ; c'est le seul format LinkedIn où le boost d'un contenu organique existant est possible.
17. **Utiliser les publicités Click-to-WhatsApp comme amplification par défaut pour la beauté, l'association et 2IAE** : la réponse dans les 24 heures ouvre 72 heures de messages gratuits ; la plateforme déclenche une alerte CallMeBot au gestionnaire après 2 heures sans réponse. Vérifier la facturation des messages de service annoncée au 1er octobre 2026 avant de promettre un coût.
18. **Pour la vente, construire sur le catalogue Commerce Manager et WhatsApp, pas sur le paiement Instagram** : paiement natif abandonné, Shops absents des listes pour la Côte d'Ivoire ; les commandes arrivent en message `order`, la plateforme crée la commande, le paiement passe par lien mobile money, le suivi part en message utilitaire à 0,004 dollar ou gratuitement dans la fenêtre.
19. **Dire la vérité au client sur la « boutique Facebook »** du pack d'Abidjan : une vitrine et un catalogue, sans paiement intégré ; la plateforme doit présenter ce qu'elle livre et ce qu'elle ne peut pas livrer dans ce pays.
20. **Mesurer la chaîne complète** dans la couche « affaires » de la doctrine (R08) : conversations ouvertes par publication, prospects créés, commandes WhatsApp, coût par conversation des boosts ; ce sont ces chiffres, et non les likes, qui ont fait partir les anciens clients quand ils manquaient.

Sources principales consultées (par ordre d'apparition) :

- https://developers.facebook.com/documentation/business-messaging/messenger-platform/policy
- https://developers.facebook.com/docs/messenger-platform/instagram/features/private-replies
- https://developers.facebook.com/docs/messenger-platform/instagram/features/ice-breakers
- https://developers.facebook.com/docs/graph-api/overview/rate-limiting/
- https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-comment/
- https://www.conferbot.com/limits/instagram
- https://www.keyapi.ai/blog/instagram-messaging-api-policy/
- https://instantdm.com/blog/facebook-auto-comment-bot-safe
- https://appbrewers.com/blog/instagram-dm-automation-policy-2026
- https://setsmart.io/blog/manychat-pricing
- https://chatarmin.com/en/blog/manychat-pricing
- https://chatbotscape.com/reviews/chatfuel-review
- https://bossbot.uk/blog/chatfuel-pricing-review-2026
- https://www.agorapulse.com/pricing/
- https://sproutsocial.com/pricing/
- https://www.vendr.com/marketplace/brandwatch
- https://costbench.com/software/social-media-management/brandwatch/
- https://hypeauditor.com/manychat/
- https://manychat.com/blog/instagram-quick-automation-comment-to-dm-guide/
- https://platform.claude.com/docs/en/about-claude/pricing
- https://business-api.tiktok.com/portal/docs/organic-api-overview/v1.3
- https://business-api.tiktok.com/portal/docs/reply-to-a-comment/v1.3
- https://creatorlanehq.com/blog/tiktok-dm-automation-state-2026
- https://instantdm.com/blog/how-to-automate-tiktok-2026
- https://developers.facebook.com/docs/marketing-api/reference/ad-creative/
- https://ppc.land/meta-simplifies-instagram-and-marketing-api-integrations/
- https://www.ayrshare.com/blog/facebook-ads-api-boosting-with-the-marketing-api/
- https://www.adamigo.ai/blog/meta-ads-api-access-levels-for-agencies
- https://adadvisor.ai/blog/meta-app-review-mcp
- https://www.stackmatix.com/blog/facebook-ads-minimum-budget-requirements
- https://peretz.agency/blog/media-strategy-generates-leads-2026
- https://grey.co/blog/facebook-ads-cost-nigeria
- https://adligator.com/blog/meta-ads-cpm-by-country-benchmarks
- https://admakeai.com/blog/how-to-boost-facebook-post
- https://mediaincanada.com/2026/03/12/meta-anti-scam/
- https://izeads.com/blog/meta-advertiser-verification
- https://www.emarketer.com/content/meta-expands-advertiser-verification-amid-scam-concerns
- https://ads.tiktok.com/help/article/spark-ads
- https://admakeai.com/blog/tiktok-spark-ads
- https://www.genviral.io/blog/how-to-get-tiktok-spark-code
- https://www.stackmatix.com/blog/tiktok-ads-cost-2026-pricing-breakdown
- https://www.enrichlabs.ai/blog/tiktok-spark-ads-complete-guide-2026
- https://www.affectgroup.com/blog/linkedin-thought-leader-ads-formats-and-requirements/
- https://goampy.com/resources/how-to-set-up-thought-leader-ads-linkedin
- https://www.commenti.in/blogs/what-is-linkedin-thought-leader-ads
- https://developers.facebook.com/docs/whatsapp/pricing
- https://www.flowcall.co/blog/whatsapp-business-api-pricing
- https://whautomate.com/whatsapp-business-api-pricing
- https://www.wati.io/en/blog/click-to-whatsapp-ads-cost/
- https://www.godatafeed.com/blog/meta-is-dropping-native-checkout-on-facebook-and-instagram
- https://www.bigcommerce.com/blog/updates-to-meta-shops-checkout-for-bigcommerce/
- https://www.conbersa.ai/learn/instagram-shop-setup-2026
- https://www.icekulfi.com/blogs/instagram-shopping-setup-guide
- https://shopsetupexperts.net/facebook-shop-instagram-shop-supported-countries/
- https://faq.whatsapp.com/1184376605821468
- https://chatarmin.com/en/blog/whatsapp-business-catalog
- https://developers.facebook.com/documentation/business-messaging/whatsapp/catalogs/catalogs-overview/
- https://www.askyazi.com/articles/whatsapp-penetration-across-africa-statistics-by-country
- https://www.pixlstudio.africa/en/automatisation-whatsapp-crm-les-3-secrets-des-entreprises-ivoiriennes-qui-vendent-24h-24-sans-intervention-humaine
- https://ijias.issr-journals.org/abstract.php?article=IJIAS-26-056-05
