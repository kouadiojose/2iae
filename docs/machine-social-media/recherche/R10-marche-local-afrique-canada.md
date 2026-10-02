# R10. Usages des plateformes en Côte d'Ivoire, Afrique francophone et Canada, canaux locaux (WhatsApp), paiement et tarifs

Rapport de recherche rédigé le 2 octobre 2026 pour la conception de la machine social media multi-clients de José Kouadio (Markel-Tech, SEVARTA, 2IAE). Toutes les pages citées ont été ouvertes les 1er et 2 octobre 2026. Les chiffres d'audience par plateforme viennent des rapports Digital 2026 de Datareportal (données d'octobre 2025, publiées le 8 novembre 2025) : ce sont des audiences publicitaires déclarées par les plateformes, pas des comptes d'utilisateurs actifs, et Datareportal ne publie pas de chiffre TikTok, YouTube ni WhatsApp pour les pays d'Afrique de l'Ouest. Les chiffres qui viennent de blogs commerciaux sans méthode sont signalés comme tels et regroupés dans la section 9.

## 1. Résumé exécutif

Trois marchés, trois logiques. En Afrique francophone, Facebook est le réseau de masse (8,4 millions d'audience publicitaire en Côte d'Ivoire, +22,6 % en un an), Instagram est marginal (895 000, en recul de 11,6 %), LinkedIn pèse plus qu'Instagram dans tous les pays étudiés (1,8 million en Côte d'Ivoire), et WhatsApp est le canal réel de la relation client bien qu'aucun chiffre officiel par pays n'existe. Au Canada, le tableau est inversé : YouTube touche 82 % de la population, LinkedIn 72 %, Instagram 52 %, TikTok croît de 36 % en un an, et WhatsApp reste un canal secondaire derrière Messenger (estimations tierces autour de 38 % des internautes). Les publics africains sont jeunes (âge médian de 15,7 ans au Mali à 19,6 ans au Sénégal), très masculins sur Facebook (60 à 75 % d'hommes), connectés presque exclusivement sur mobile, le soir, avec des forfaits data limités (1,5 Go par jour pour 500 FCFA chez Moov). Les publics canadiens passent 3 h 41 par jour sur les réseaux (NETendances 2025, Québec) et s'informent d'abord par les réseaux sociaux chez les 18 à 34 ans (74 %).

WhatsApp comme canal de diffusion : en octobre 2026, il n'existe toujours aucune API officielle pour publier sur un Channel ou sur un Status. Les Channels se publient à la main (une fonction de programmation est en développement, repérée par WABetaInfo le 22 août 2026, non livrée). Ce qui existe par API, c'est la Business Platform (Cloud API) : des messages modèles approuvés, envoyés à des contacts qui ont donné leur accord, facturés au message depuis le 1er juillet 2025 : 0,0225 USD par message marketing en « Reste de l'Afrique » (Côte d'Ivoire incluse) et 0,025 USD en Amérique du Nord au 1er octobre 2026, les réponses dans la fenêtre de 24 heures restant gratuites. Depuis juin 2025, Meta vend aussi des publicités dans Status et des Channels promus via Ads Manager.

Tarifs du marché : à Abidjan, une agence facture 300 000 à 900 000 FCFA par mois (pack de 2 publications par semaine à pack e-commerce avec vidéos) ; à Dakar, les packs commencent à 49 000 FCFA et plafonnent autour de 275 000 FCFA ; à Douala, de 50 000 à 500 000 FCFA en freelance ; à Montréal, 500 à 3 500 CAD par mois ; à Toronto, 500 à 1 500 CAD en freelance et 1 500 à 5 000 CAD en agence boutique. Le paiement d'un SaaS passe par le mobile money en Afrique (Wave à environ 1 % de commission marchande, Orange Money 0,5 à 1,5 %, agrégateurs CinetPay, Paystack et Flutterwave entre 1,95 % et 3,5 %) et par Stripe au Canada (2,9 % + 0,30 CAD, facturation récurrente à 0,7 % de plus).

Conclusion produit : la machine doit être « WhatsApp-first » côté relation client (validation des planches, alertes, livraison des contenus) sans prétendre publier sur WhatsApp par API ; Facebook et TikTok sont les canaux de découverte en Afrique, YouTube, LinkedIn et Instagram au Canada ; la vidéo courte verticale, légère (moins de 15 Mo pour les forfaits data), sous-titrée (son souvent coupé) et en français parlé, avec une dose de nouchi pour la jeunesse ivoirienne, est le format pivot ; les créneaux de publication se calent sur le soir en heure d'Abidjan et sur la fin de matinée en heure de l'Est canadien.

## 2. Audiences par plateforme et par pays (Datareportal, Digital 2026)

### 2.1 Afrique francophone : sept pays

| Pays (données d'octobre 2025) | Population | Internautes (pénétration) | Identités sociales (% pop.) | Facebook | Instagram | LinkedIn | Messenger | X | Part d'hommes sur Facebook |
|---|---|---|---|---|---|---|---|---|---|
| Côte d'Ivoire | 32,9 M | 13,4 M (40,7 %) | 8,40 M (25,5 %, +22,6 %) | 8,40 M | 895 K (-11,6 %) | 1,80 M (+12,5 %) | 1,20 M (-27,3 %) | 239 K | 60,2 % |
| Sénégal | 19,0 M | 11,5 M (60,6 %) | 5,42 M (28,5 %, +8,2 %) | 3,60 M (+7,5 %) | 1,45 M (+11,5 %) | 1,50 M (+15,4 %) | 834 K | 263 K | 66,7 % |
| Cameroun | 30,1 M | 12,6 M (41,9 %) | 5,90 M (19,6 %, +15,7 %) | 5,90 M | 611 K (+2,6 %) | 1,60 M (+14,3 %) | 631 K | 185 K | 59,0 % |
| Bénin | 14,9 M | 4,80 M (32,2 %) | 2,50 M (16,8 %, +11,1 %) | 2,50 M | 237 K (+15,8 %) | 660 K (+17,9 %) | 487 K | 85 K | 60,0 % |
| Togo | 9,77 M | 3,62 M (37,0 %) | 644 K (6,6 %) | 644 K (-28,2 %) | 199 K (+14,6 %) | 430 K (+16,2 %) | 117 K | 46 K | 68,9 % |
| Burkina Faso | 24,2 M | 5,42 M (22,4 %) | 3,90 M (16,1 %, +23,8 %) | 3,90 M | 211 K (+15,2 %) | 510 K (+18,6 %) | 514 K | 62 K | 68,8 % |
| Mali | 25,4 M | 8,91 M (35,1 %) | 2,40 M (9,5 %, +17,1 %) | 2,40 M | 247 K (+4,4 %) | 470 K (+17,5 %) | 220 K | 68 K | 75,3 % |

Sources : https://datareportal.com/reports/digital-2026-cote-divoire ; https://datareportal.com/reports/digital-2026-senegal ; https://datareportal.com/reports/digital-2026-cameroon ; https://datareportal.com/reports/digital-2026-benin ; https://datareportal.com/reports/digital-2026-togo ; https://datareportal.com/reports/digital-2026-burkina-faso ; https://datareportal.com/reports/digital-2026-mali

Lecture pour la machine :

1. Facebook est, dans les sept pays, le réseau qui porte l'« identité sociale » mesurable : l'audience Facebook égale l'audience sociale totale partout sauf au Sénégal, où YouTube (5,42 M) dépasse Facebook (3,60 M). Au Sénégal, YouTube est donc le premier réseau mesuré.
2. Instagram est un réseau de niche urbaine : 2,7 % de la population en Côte d'Ivoire, 2,0 % au Cameroun, 1,6 % au Bénin. Une marque de beauté ivoirienne qui se concentre sur Instagram parle à moins d'un million de personnes, et ce public recule.
3. LinkedIn est deux fois plus gros qu'Instagram en Côte d'Ivoire (1,8 M contre 895 K) et il croît de 12 à 19 % par an dans tous les pays. C'est le réseau à activer pour 2IAE (admissions, partenariats) et Markel-Tech (B2B), y compris côté africain.
4. Les audiences sont très masculines (60 à 75 % d'hommes sur Facebook). Une marque de produits de beauté qui vise les femmes doit cibler précisément en publicité et ne pas se fier à la portée organique.
5. Âge médian : 18,3 ans en Côte d'Ivoire, 15,7 ans au Mali. Le public est jeune, mobile, et les codes de TikTok dominent même sur Facebook (Reels).
6. Les chiffres TikTok, YouTube et WhatsApp ne sont pas publiés par Datareportal pour ces pays. Les estimations qui circulent (5,2 millions d'utilisateurs TikTok en Côte d'Ivoire, 85 % des internautes ivoiriens sur WhatsApp chaque jour) viennent de blogs sans méthode (section 9).
7. Les connexions mobiles dépassent la population (151 % en Côte d'Ivoire, 122 % au Sénégal) : les gens ont plusieurs cartes SIM, et 92,7 % des connexions ivoiriennes sont en haut débit mobile.

### 2.2 Canada

| Plateforme (octobre 2025) | Audience | % population (40,2 M) | Variation annuelle |
|---|---|---|---|
| YouTube | 33,0 M | 82,1 % | +4,1 % |
| LinkedIn | 29,0 M | 72,1 % | +11,5 % |
| Facebook | 24,6 M | 61,2 % | +3,8 % |
| Instagram | 21,0 M | 52,2 % | +10,8 % |
| TikTok (18 ans et plus) | 16,6 M | 50,6 % | +36,4 % |
| Snapchat | 13,8 M | 34,2 % | +8,6 % |
| Pinterest | 11,1 M | 27,7 % | +8,4 % |
| X | 9,74 M | 24,2 % | -2,8 % |
| Threads | 2,30 M | 5,7 % | non publié |

Source : https://datareportal.com/reports/digital-2026-canada (internautes : 38,2 M, 95,1 % ; identités sociales : 33,0 M, 82,1 %). Datareportal ne publie pas de chiffre WhatsApp pour le Canada.

Habitudes canadiennes et québécoises :

- NETendances 2025 (Académie de la transformation numérique, Université Laval, enquête de juillet 2025 auprès d'environ 1 000 internautes québécois adultes) : 94 % des internautes utilisent les réseaux sociaux, 89 % chaque jour ; 3 h 41 par jour en moyenne, soit 51 minutes de plus qu'un an plus tôt ; les réseaux sociaux sont le deuxième canal d'information (48 %), et 74 % des 18 à 34 ans s'y informent ; les utilisateurs quotidiens de TikTok et d'Instagram passent environ deux heures de plus par jour que les autres. Source : https://transformation-numerique.ulaval.ca/enquetes-et-mesures/netendances/reseaux-sociaux-et-divertissement-en-ligne-2025/
- WhatsApp au Canada : les estimations tierces donnent 38,3 % de pénétration (13,9 millions d'utilisateurs) contre 60,9 % pour Messenger et 36,6 % pour iMessage ; une autre source donne 30 % contre 55 % pour Messenger. Aucune source officielle. Source : https://madeinca.ca/social-media-statistics-canada/ ; https://www.infobip.com/blog/most-popular-messaging-apps-by-country
- Genre : Instagram est à 53,5 % féminin et TikTok à 54 % masculin au Canada, l'inverse de la tendance africaine sur Facebook.

Lecture : au Canada, la diaspora ivoirienne et ouest-africaine utilise WhatsApp (groupes d'associations, familles) mais le grand public canadien, lui, est sur Messenger, YouTube, Instagram et LinkedIn. Pour une association culturelle de la diaspora à Toronto ou Ottawa, la machine doit donc servir deux publics : les membres (WhatsApp, Facebook) et la ville (Instagram, agendas municipaux, LinkedIn pour les partenaires et subventionneurs).

### 2.3 Chiffres mondiaux utiles (Digital 2026 Global Overview, données d'octobre 2025)

5,66 milliards d'identités sociales (68,7 % de la population mondiale) ; plus de 2 h 30 par jour sur réseaux et plateformes vidéo ; WhatsApp est la plateforme « préférée » numéro un (17,4 % des répondants), devant Instagram (16,4 %) et Facebook (13 %) ; l'utilisateur moyen ouvre WhatsApp plus de 20 fois par jour ; YouTube concentre le plus de temps total (session moyenne de 14 min 29 s). Source : https://datareportal.com/reports/digital-2026-global-overview-report

## 3. Habitudes de consommation en Afrique francophone

### 3.1 Mobile, data et vidéo

- Côte d'Ivoire, réseau : 36 millions d'abonnements internet dont 98 % mobiles (ARTCI) ; couverture 4G/5G de 80 % du territoire (Orange 86,45 %, MTN 84,29 %, Moov 62,95 %) ; 1,6 million d'abonnés 5G au premier trimestre 2026 (+220 % en un an) ; coût moyen du gigaoctet mobile 0,65 EUR (environ 425 FCFA), en baisse de 11 % en trois mois ; lancement commercial de la 5G nationale en juillet 2026. Sources : https://business.orange.ci/fr/newsletters/2026/mars/tendances-du-marche-bascule-des-telecoms-cote-ivoire-afrique-ouest.html ; https://artci.ci/index.php?Itemid=101&catid=11&id=75%3Aabonnes-service-internet&option=com_content&view=article ; https://lobservateur.info/article/118727/afrique/la-cote-divoire-lance-la-5g-des-juillet-2026
- Forfaits data 2026 : Moov CI, 1,5 Go par jour pour 500 FCFA, 3 Go par semaine pour 1 000 FCFA, 7 Go par mois pour 5 000 FCFA ; Orange, pass hebdomadaire 2 Go autour de 2 000 FCFA, mensuel 3 Go autour de 3 000 à 3 500 FCFA ; Orange et MTN, 1,5 Go pour 1 000 FCFA. Sources : https://www.moov-africa.ci/espace-particulier/forfait-internet-moov-folie/ ; https://phonerol.com/comparatif-internet-mobile-cote-d-ivoire
- Conséquence directe : un internaute qui achète 1,5 Go par jour regarde volontiers une vidéo de 15 à 30 secondes (3 à 8 Mo en 720p) mais hésite devant une vidéo de 5 minutes en 1080p (100 Mo et plus). Le poids des fichiers est un paramètre de portée, pas seulement de qualité.
- Vitesse fixe médiane (Datareportal) : 59,73 Mbps en Côte d'Ivoire, 23,01 au Sénégal, 11,01 au Cameroun, 24,49 au Bénin, 36,28 au Togo, 45,62 au Burkina, 21,24 au Mali. Le Cameroun est le marché le plus contraint.

### 3.2 Heures de connexion

- Abidjan, par plateforme (article de Linfodrome, repris dans les résultats de recherche ; l'article lui-même n'a pas pu être ouvert) : TikTok, pics le jeudi matin de 7 h à 11 h et en début de soirée de 18 h à 20 h, lundi et vendredi à partir de midi et de 15 h à 18 h, samedi vers 17 h, dimanche de 8 h à 9 h ou de 13 h à 14 h GMT ; Facebook, pics en semaine de 7 h à 9 h et de 13 h à 15 h, le mardi à 9 h étant le meilleur créneau, le week-end de 8 h à 11 h. Source : https://www.linfodrome.com/high-tech/111125-abidjan-voici-les-meilleures-heures-pour-publier-sur-tiktok-youtube-facebook-instagram-et-x
- Afrique en général (Neurone Digital, 22 mars 2026, sans méthode citée) : pics d'activité de 20 h à 23 h heure locale, 90 % des accès en Afrique subsaharienne sur mobile, contenu en français parlé et familier plus performant que le français d'entreprise. Source : https://www.neuronedigital.com/article/les-reseaux-sociaux-en-afrique-en-2026-ces-chiffres-vont-vous-surprendre
- Benchmark mondial (Sprout Social, 31 mars 2026, 2 milliards d'engagements) : mardi et mercredi de 11 h à 18 h heure locale ; dimanche, pire jour partout. Source : https://sproutsocial.com/insights/best-times-to-post-on-social-media/
- Décalage horaire : Abidjan est à GMT toute l'année ; Toronto et Montréal sont à GMT-4 en été (jusqu'au 1er novembre 2026) et GMT-5 en hiver. Un post publié à 19 h à Abidjan sort à 15 h à Toronto en été ; un post pour la diaspora à 20 h de Toronto sort à minuit à Abidjan.

### 3.3 Langues

- Côte d'Ivoire : français officiel ; le nouchi (argot urbain d'Abidjan) et le dioula sont les langues de la rue et de TikTok. Les sources commerciales affirment que les contenus en nouchi ou mêlant français et expressions locales obtiennent « 2,5 fois plus d'engagement » que le français formel, et que 69 % des Ivoiriens font davantage confiance à un créateur local qu'à une publicité de marque (81 % chez les 18 à 25 ans). Ces chiffres ne sont pas sourcés (section 9), mais l'observation qualitative (humour local, nouchi, références culturelles) est partagée par les agences d'Abidjan. Sources : https://blog.iambeezy.app/fr/tendances-consommation-digitale-cote-ivoire-donnees-2026/ ; https://www.khaleddjobo.com/expert-marketing-digital-cote-divoire/publicite-digitale-en-cote-divoire/
- Sénégal : français à l'écrit, wolof à l'oral et dans les vidéos. Cameroun : français et anglais officiels, pidgin dans les contenus populaires ; le Cameroun anglophone adopte LinkedIn plus vite. Canada : anglais à Toronto et Ottawa, français au Québec et dans la communauté franco-ontarienne (Festival franco-ontarien, Semaine de la francophonie de Toronto), ce qui compte pour une association culturelle ivoirienne qui valorise le français (l'ACIRT a tenu son gala 2024 sur le thème « Le français en tout lieu et en tout temps »). Source : https://l-express.ca/lassociation-ivoirienne-de-toronto-diversifie-ses-activites/
- Pour les églises et SEVARTA : le français standard reste la langue du sermon et du livre, mais les clips doivent être sous-titrés (son coupé sur mobile, 74 % des vidéos Facebook regardées sans le son selon Sprout, cité dans R09).

### 3.4 Les églises, YouTube et la vidéo courte

Les pasteurs ivoiriens de premier plan (Mohammed Sanogo, Vases d'Honneur, Abidjan) diffusent sur YouTube, EMCI TV, Facebook Live, TikTok et WhatsApp, et touchent des audiences dans toute la francophonie (Togo, Bénin, Burkina, France). Source : https://regardsprotestants.com/actualites/francophonie/de-lislam-au-reveil-chretien-entretien-avec-mohammed-sanogo/ ; https://mondafrique.com/a-la-une/cote-divoire-les-evangelistes-entre-business-et-influence-hors-norme/ La monétisation YouTube reste difficile en Afrique francophone (RPM faibles, blocages de paiement), ce qui rend le découpage en clips pour Facebook, TikTok et WhatsApp plus utile à une église que la chasse aux vues YouTube. Source : https://lesafriques.com/2026/06/monetisation-youtube-afrique-francophone-blocages-solutions/

## 4. WhatsApp comme canal de diffusion : ce qui est possible en octobre 2026

### 4.1 Les quatre outils et leurs limites

| Outil | Ce que c'est | Automatisable par API officielle ? | Limites (vérifiées octobre 2026) |
|---|---|---|---|
| WhatsApp Business (application gratuite) | Compte d'entreprise sur un téléphone, catalogue, réponses rapides, listes de diffusion, Status | Non (sauf coexistence avec la Cloud API sur le même numéro depuis janvier 2026) | Listes de diffusion limitées à 256 contacts et reçues seulement par ceux qui ont enregistré le numéro ; Status manuel |
| WhatsApp Channels (Chaînes) | Diffusion à sens unique vers des abonnés, dans l'onglet Actualités | Non. Aucune API officielle. Programmation en développement (WABetaInfo, 22 août 2026, build Android 2.26.33.5, de 10 minutes à deux semaines à l'avance, non livrée) | Pas de réponses, pas de statistiques détaillées, contenus visibles 30 jours ; profil dédié possible ; « Channel Status » (format 24 h) en test iOS |
| Status (statuts) | Photos et vidéos 24 h, vues par les contacts | Non. Aucune API | Seuls les contacts mutuels voient le Status ; publicités dans Status vendues par Meta depuis juin 2025 |
| WhatsApp Business Platform (Cloud API) | Messagerie programmable, modèles approuvés, webhooks, boutons, carrousels, appels | Oui | Opt-in obligatoire, modèles approuvés par Meta, paliers de 250 à illimité, prix au message |

Sources : https://www.infobip.com/blog/whatsapp-news-and-updates (coexistence app et Cloud API, janvier 2026 ; carrousels de 2 à 10 cartes, février 2026 ; appels, 1er juillet 2025) ; https://wabetainfo.com/whatsapp-is-testing-a-new-feature-to-schedule-channel-updates/ ; https://setsmart.io/blog/whatsapp-broadcast (limite de 256 inchangée en 2026) ; https://avocadosocial.com/whatsapp-channels-upgrades/

Des services non officiels (par exemple whapi.cloud, qui vend une « WhatsApp Channels API ») pilotent un compte WhatsApp personnel ou Business par rétro-ingénierie. Ils fonctionnent, mais violent les conditions d'utilisation de WhatsApp (« Do not ... spam, or surprise people », compte banni en cas d'abus, et interdiction pour l'organisation entière en cas de résiliation). Pour une agence qui gère les numéros de ses clients, le risque est de faire bannir le numéro d'un client. À exclure de la machine. Source : https://whatsappbusiness.com/policy/ (politique mise à jour le 23 septembre 2026)

### 4.2 Ce que Meta a ajouté en 2025 et 2026 autour de la diffusion

- 16 juin 2025 : Meta annonce trois nouveautés dans l'onglet Actualités (utilisé par 1,5 milliard de personnes par jour) : abonnements payants aux Channels (contenu exclusif contre un abonnement mensuel), Channels promus (visibilité payée dans l'annuaire) et publicités dans Status (plein écran, image ou vidéo verticale, bouton « Envoyer un message » qui ouvre une conversation). Déploiement « lent sur plusieurs mois ». Les messages personnels restent chiffrés et ne servent pas au ciblage ; le ciblage utilise le pays ou la ville, la langue, les Channels suivis. Source : https://about.fb.com/news/2025/06/helping-you-find-more-channels-businesses-on-whatsapp/
- 1er juillet 2025 : passage de la tarification par conversation à la tarification par message modèle livré. Source : https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- Quatrième trimestre 2025 : « Marketing Messages API » (meilleure délivrabilité, contourne les plafonds par utilisateur selon Infobip), webviews dans le chat, liens profonds. Janvier 2026 : coexistence de l'application Business et de la Cloud API sur le même numéro. Février 2026 : carrousels de médias interactifs. Source : https://www.infobip.com/blog/whatsapp-news-and-updates
- 13 mai 2026 : Meta cesse de facturer les « fournisseurs d'IA » pour les messages hors modèle en Union européenne (sans effet pour l'Afrique et le Canada) ; Embedded Signup v4 en aperçu public. Source : https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog

### 4.3 Prix par message (Cloud API) au 1er octobre 2026

| Marché | Marketing | Utilitaire | Authentification | Service |
|---|---|---|---|---|
| Reste de l'Afrique (Côte d'Ivoire, indicatif 225, Sénégal, Cameroun, Bénin, Togo, Burkina, Mali) | 0,0225 USD | 0,0040 USD | 0,0040 USD | 0,0040 USD |
| Nigeria | 0,0516 USD | 0,0067 USD | 0,0067 USD | 0,0067 USD |
| Afrique du Sud | 0,0379 USD | 0,0095 USD | 0,0200 USD | 0,0095 USD |
| Amérique du Nord (Canada et États-Unis, indicatif 1) | 0,0250 USD | 0,0034 USD | 0,0034 USD | 0,0034 USD |
| France | 0,0859 USD | 0,0300 USD | 0,0300 USD | 0,0300 USD |
| Reste de l'Europe de l'Ouest | 0,0592 USD | 0,0171 USD | 0,0171 USD | 0,0171 USD |

Sources : https://whautomate.com/whatsapp-business-api-pricing ; https://www.flowcall.co/blog/whatsapp-business-api-pricing (deux reprises concordantes de la grille Meta ; la page Meta elle-même renvoie à des fichiers CSV et PDF). Les regroupements « Reste de l'Afrique » et « Amérique du Nord » sont confirmés par la page de Meta : https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing

Règles de gratuité (page Meta, lue le 2 octobre 2026) : « All non-template messages are free » dans une fenêtre de service client ouverte (24 heures après le dernier message de l'utilisateur) ; les modèles utilitaires livrés dans cette fenêtre sont gratuits ; les messages de service sont gratuits depuis le 1er novembre 2024 ; un point d'entrée gratuit de 72 heures s'ouvre quand l'utilisateur écrit depuis une publicité Click-to-WhatsApp ou un bouton de page Facebook et que l'entreprise répond dans les 24 heures. Un message non livré n'est pas facturé. Un fournisseur (BSP) ajoute sa marge ; l'accès direct à la Cloud API via Meta évite cette marge. Note : Flowcall affirme qu'au 1er octobre 2026 les réponses de service deviennent payantes au-delà de 1 000 messages gratuits par mois et par numéro ; la page de Meta ne le dit pas au moment de la lecture. Point à vérifier (section 9).

Ordre de grandeur pour un client : 1 000 contacts ayant donné leur accord, 4 messages marketing par mois, soit 4 000 messages x 0,0225 USD = 90 USD par mois (environ 55 000 FCFA à 610 FCFA pour un dollar, taux à vérifier) ; les notifications utilitaires (« votre commande est prête », « votre planche est à valider ») coûtent 0,004 USD, soit 4 USD pour 1 000 envois.

### 4.4 Paliers d'envoi et qualité

Un numéro commence à 250 utilisateurs uniques par 24 heures glissantes ; il passe à 2 000 en vérifiant l'entreprise (ou en envoyant 2 000 messages livrés hors fenêtre en 30 jours avec des modèles de bonne qualité), puis à 10 000, 100 000 et illimité par montée automatique quand la qualité est bonne et que l'on utilise au moins 50 % de son palier pendant 7 jours (montée « dans les 6 heures »). Le champ « messaging_limit_tier » des anciens webhooks a disparu en février 2026. Source : https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits

Opt-in (politique du 23 septembre 2026) : on ne peut contacter une personne que si elle a donné son numéro et un accord explicite pour recevoir des messages ; l'entreprise est seule responsable de la méthode d'opt-in et de sa conformité aux lois locales (au Canada, la LCAP, loi canadienne anti-pourriel, exige un consentement et un mécanisme de retrait) ; toute demande de désabonnement doit être respectée ; Meta limite les envois selon les retours des utilisateurs (blocages, signalements). Secteurs restreints : armes, drogues, jeux d'argent (exceptions limitées), alcool dans certains pays, marketing multi-niveaux. Source : https://whatsappbusiness.com/policy/

### 4.5 Comment une agence intègre WhatsApp sans violer les règles

1. Un numéro Cloud API par client (ou un numéro par agence pour les notifications internes), avec coexistence de l'application Business sur le même numéro pour que le client continue de répondre à ses propres clients depuis son téléphone (fonction de janvier 2026).
2. Les diffusions à grande échelle passent par des modèles marketing approuvés, envoyés uniquement aux contacts opt-in collectés par un formulaire, un mot-clé (« écrivez OUI ») ou une case cochée sur le site ; le retrait (« STOP ») est traité automatiquement par la machine.
3. Les Channels et les Status restent manuels : la machine prépare le paquet (visuel au bon format, texte, lien) et l'envoie au gestionnaire humain ou au client par un message utilitaire avec un lien « copier et publier » ; le geste de publication reste humain, en attendant la programmation native des Channels.
4. Pour la portée payée dans WhatsApp, utiliser les publicités Status et les Channels promus depuis Ads Manager (Meta Marketing API, déjà utilisée pour Facebook et Instagram), pas des envois massifs.
5. Mesurer : accusés de lecture (webhooks « delivered », « read »), clics sur boutons, taux de blocage, note de qualité du numéro ; la machine met en pause un modèle dès que la qualité passe en orange.

## 5. Calendrier à surveiller par pays

### 5.1 Côte d'Ivoire (jours fériés 2026, 14 jours ; 2027 provisoire)

| Date 2026 | Fête | Date 2027 |
|---|---|---|
| 1er janvier | Jour de l'An | 1er janvier |
| 15 et 16 mars | Nuit du Destin (Laylat al-Qadr) | 6 mars (lendemain) |
| 20 mars | Aïd el-Fitr (fin du Ramadan, commencé le 18 février 2026) | 9 mars |
| 5 et 6 avril | Pâques et lundi de Pâques | 28 et 29 mars |
| 1er mai | Fête du Travail | 1er mai |
| 14 mai | Ascension | 6 mai |
| 24 et 25 mai | Pentecôte | 16 et 17 mai |
| 27 mai | Tabaski (Aïd el-Kébir) | 16 mai |
| 7 août | Fête nationale (indépendance, 1960) | 7 août |
| 15 août | Assomption | 15 août |
| 24 et 25 août | Maouloud | 14 août (lendemain) |
| 1er novembre | Toussaint | 1er novembre |
| 15 novembre | Journée nationale de la Paix | 15 novembre |
| 25 décembre | Noël | 25 décembre |

Sources : https://www.ivoirematin.com/fr/news/Societe/le-calendrier-officiel-des-jours-feries-et-journees-continues-pour-2026_n_119230.html ; https://www.joursferies.fr/pays/cote-d-ivoire.php ; https://publicholidays.africa/ivory-coast/fr/. Les fêtes musulmanes dépendent de l'observation lunaire et ne sont confirmées que la veille : la machine doit les traiter comme des fenêtres de plus ou moins deux jours.

Autres dates ivoiriennes : rentrée scolaire et universitaire le lundi 14 septembre 2026 (inscriptions en ligne du 6 au 21 septembre, 6 000 FCFA dans le public, 3 000 FCFA dans le privé ; inscriptions universitaires des nouveaux bacheliers du 25 août au 30 septembre, réinscriptions jusqu'au 31 octobre) ; trimestres du 14 septembre au 4 décembre 2026, du 7 décembre au 12 mars 2027, du 15 mars au 11 juin 2027 ; congés de Toussaint du 23 octobre au 1er novembre, de Noël du 18 décembre au 3 janvier, de février du 5 au 14 février 2027, de Pâques du 19 mars au 4 avril 2027 ; grandes vacances du 30 juillet au 12 septembre 2027 ; semestres universitaires du 14 septembre 2026 au 5 février 2027 et du 8 février au 18 juin 2027. Sources : https://www.yeclo.com/rentree-scolaire-2026-2027-le-14-septembre-tout-savoir-sur-les-nouvelles-mesures/ ; https://www.koaci.com/article/2026/08/21/cote-divoire/societe/cote-divoire-universites-la-rentree-academique-2026-2027-fixee-au-lundi-14-septembre-voici-le-decoupage-de-lannee-et-conges_199757.html

Pour 2IAE, cela donne un calendrier d'admissions dont les pics sont juin et juillet (résultats du bac, choix d'école), fin août et septembre (inscriptions), puis janvier et février (réorientations, deuxième semestre).

Fêtes commerciales : Saint-Valentin (14 février), Fête des mères (en Côte d'Ivoire comme en France, en général le dernier dimanche de mai, soit le 31 mai 2026 et le 30 mai 2027 ; à confirmer chaque année), Fête des pères (troisième dimanche de juin, 21 juin 2026), Journée internationale de la femme (8 mars), rentrée (septembre), Noël et fêtes de fin d'année (décembre, premier mois de ventes pour la beauté et l'édition).

Événements culturels d'Abidjan en 2026 :

- MASA, Marché des arts du spectacle africain, 14e édition, du 11 au 18 avril 2026, 89 artistes de 51 pays ; biennal, prochaine édition en 2028. Source : https://www.musicinafrica.net/fr/magazine/masa-2026-89-artistes-51-pays-et-une-ambition-continentale
- FEMUA 18, Festival des musiques urbaines d'Anoumabo, du 28 avril au 3 mai 2026, à Abidjan et Dimbokro, Gabon pays invité, Youssou N'Dour en tête d'affiche ; chaque année fin avril. Source : https://www.africaradio.com/actualite-113874-femua-2026-youssou-n-dour-en-tete-d-affiche-d-un-festival-geant-a-abidjan
- Fashion TExpo, du 16 au 18 avril 2026, Parc des expositions d'Abidjan. Source : https://www.fibre2fashion.com/trade-fairs/fashiontexpo-2026-66158
- Abidjan Fashion Week : le site officiel annonce une édition du 7 au 13 décembre 2026 ; une autre liste donne du 14 au 20 septembre 2026 ; la « Fashion Week by Elie Kuame » se tient en décembre. Dates à confirmer sur https://www.abidjanfashionweek.com/
- JICOM Days (journées de la communication, influence et contenu de marque), suivies par Digital Mag CI. Source : https://digitalmag.ci/jicom-days-2026-les-defis-des-influenceurs-web-dans-la-creation-de-contenu-de-marque-en-cote-divoire/

### 5.2 Sénégal, Cameroun et autres pays

Sénégal 2026 : Ramadan à partir du 18 février, Korité le 20 mars, Indépendance le 4 avril, lundi de Pâques le 6 avril, 1er mai, Ascension le 14 mai, lundi de Pentecôte le 25 mai, Tabaski le 27 mai, Tamkharit le 26 juin, Grand Magal de Touba et Maouloud selon la lune (dates annoncées la veille par la CONACOC). Source : https://lepetitjournal.com/dakar/jours-feries-senegal-295473 ; https://ilove-senegal.com/jours-feries-et-dates-a-retenir-au-senegal-en-2026/

Cameroun : Tabaski le 27 mai 2026 ; fête de la Jeunesse le 11 février ; fête nationale le 20 mai ; Noël et fêtes chrétiennes. Source : https://publicholidays.africa/cameroon/fr/eid-al-adha/

Fêtes nationales : Togo 27 avril ; Bénin 1er août ; Mali 22 septembre ; Burkina Faso 11 décembre. Dates fixes, à encoder dans la machine.

### 5.3 Canada (Ontario et Québec)

| Date 2026 | Fête | Portée |
|---|---|---|
| 1er janvier | Jour de l'An | fédéral |
| Février | Mois de l'histoire des Noirs, 30e anniversaire en 2026, thème « 30 ans du Mois de l'histoire des Noirs : honorer l'excellence des personnes noires à travers les générations » | national, pas férié |
| 16 février | Jour de la famille (Ontario) | Ontario |
| 20 mars | Journée internationale de la Francophonie ; Semaine de la francophonie de Toronto du 19 au 28 mars (lever du drapeau à l'hôtel de ville le 20 mars) | observance |
| 3 avril | Vendredi saint | fédéral |
| 6 avril | Lundi de Pâques | Québec (au choix) |
| 10 mai | Fête des mères (deuxième dimanche de mai ; 9 mai 2027) | observance |
| 18 mai | Fête de la Reine (Ontario) et Journée nationale des patriotes (Québec) | provincial |
| 21 juin | Fête des pères et Journée nationale des peuples autochtones | observance |
| 24 juin | Fête nationale du Québec | Québec |
| 1er juillet | Fête du Canada | fédéral |
| 3 août | Congé civique (Ontario) | Ontario |
| 7 septembre | Fête du Travail | fédéral |
| 25 septembre | Jour des Franco-Ontariens | observance |
| 30 septembre | Journée nationale de la vérité et de la réconciliation | fédéral |
| 12 octobre | Action de grâce | fédéral |
| 11 novembre | Jour du Souvenir | fédéral (non férié en Ontario) |
| 25 et 26 décembre | Noël et lendemain de Noël (Boxing Day, férié en Ontario) | fédéral / Ontario |

2027 : Jour de la famille 15 février, Vendredi saint 26 mars, Fête de la Reine et des patriotes 24 mai, congé civique 2 août, Fête du Travail 6 septembre, Action de grâce 11 octobre. Sources : https://www.statutoryholidays.com/ontario.php ; https://canada-holidays.ca/ ; https://ici.radio-canada.ca/nouvelle/2218770/mois-histoire-noirs-2026-30-ans

Événements de Toronto et d'Ottawa pertinents pour une association culturelle africaine ou une maison d'édition :

| Événement | Dates 2026 | Ville | Source |
|---|---|---|---|
| Bal de Neige (Winterlude), 48e édition | 30 janvier au 16 février | Ottawa et Gatineau | https://www.ottawafestivals.ca/post/winterlude-2026-your-ultimate-guide |
| Toronto Black Film Festival, 14e édition | 11 au 16 février | Toronto | https://grandtoronto.ca/liste-evenements/toronto-black-film-festival-2026/ |
| Kuumba (Harbourfront Centre) | février | Toronto | https://grandtoronto.ca/30-ans-du-mois-de-lhistoire-des-noirs/ |
| Semaine de la francophonie de Toronto | 19 au 28 mars | Toronto | https://grandtoronto.ca/liste-evenements/semaine-de-la-francophonie-de-toronto/ |
| Festival franco-ontarien, 50e anniversaire | 11 au 13 juin, parc Major's Hill | Ottawa | https://ffo.ca/en/ |
| Franco-Fête, 44e édition | 19 et 20 juin, atrium de CBC | Toronto | https://grandtoronto.ca/liste-evenements/franco-fete-2026/ |
| Festival de jazz d'Ottawa | 19 au 28 juin | Ottawa | https://ottawatours.net/ottawa-events-calendar-2026-2027/ |
| Fête du Canada | 1er juillet, colline du Parlement | Ottawa | idem |
| Bluesfest | 9 au 19 juillet, plaines LeBreton | Ottawa | https://www.musicfestivalwizard.com/festivals/ottawa-bluesfest-2026/ |
| Toronto Caribbean Carnival (grand défilé le 1er août) | 30 juillet au 3 août | Toronto | https://www.destinationtoronto.com/leisure-blog/post/toronto-caribbean-carnival/ |
| Fête de l'indépendance ivoirienne (célébrations de la diaspora) | autour du 7 août | Toronto, Ottawa, Montréal | https://acirt.ca/ |
| Afrofest, plus grand festival africain d'Amérique du Nord (140 000 visiteurs, 55 spectacles) | 14 au 16 août, Woodbine Park | Toronto | https://www.afrofest.ca/vendors |
| Afro-Carib Fest (120 spectacles, Thompson Memorial Park, Scarborough) | 22 et 23 août | Toronto | https://www.blogto.com/events/afro-carib-fest-2026-toronto/ |
| Francophonie en fête (Glenn Gould les 18 et 19 septembre, The Bentway du 25 au 27 septembre) | 18 au 27 septembre | Toronto | https://grandtoronto.ca/ |
| Cinéfranco | 6 au 15 novembre | Toronto | https://grandtoronto.ca/ |

Associations de la diaspora ivoirienne à suivre : ACIRT (Association de la communauté ivoirienne de la région de Toronto, créée en 2018, environ 2 000 familles, gala annuel en décembre avec 330 participants en 2024, camp d'été, tournoi de football, mini-festival gastronomique, cérémonie de l'indépendance ; partenariats avec l'Association des Burkinabès de Toronto et l'Association marocaine de Toronto), ASSIVO (Association des Ivoiriens d'Ottawa et de l'Outaouais), Solidarité ivoirienne du Canada, et la FAIC (Fédération des associations ivoiriennes du Canada) qui les regroupe. Sources : https://acirt.ca/ ; https://www.faic.ca/nos-associations/ ; https://www.solidariteci.ca/ ; https://l-express.ca/lassociation-ivoirienne-de-toronto-diversifie-ses-activites/

## 6. Sources locales d'actualité et d'événements à brancher sur la veille

| Source | Type | Usage pour la machine | URL |
|---|---|---|---|
| Abidjan.net (news.abidjan.net) | portail généraliste, premier site ivoirien ; a été suspendu 26 jours par l'ANP en 2026 avant de reprendre | fil RSS d'actualité, rubrique « Événements » | https://www.abidjan.net/ |
| Fratmat.info | quotidien du groupe Fraternité Matin (presse d'État) | actualité officielle, culture, éducation, sport | https://www.fratmat.info/ |
| Life Magazine (life.ci) | magazine de la vie culturelle et sociale d'Abidjan | sorties, mode, beauté, people | https://life.ci/ |
| Pulse Côte d'Ivoire (pulse.ci) | média jeune, lancé en septembre 2024, groupe Pulse présent dans six pays | tendances, divertissement, buzz | https://www.pulse.ci/ |
| Yeclo.com | actualité nationale et régionale (Indénié-Djuablin), très actif sur l'éducation | dates de rentrée, examens, calendriers | https://www.yeclo.com/ |
| KOACI, Linfodrome, 7info.ci, Afrik Soir | actualité en continu | calendriers officiels, annonces gouvernementales | https://www.koaci.com/ ; https://www.linfodrome.com/ ; https://7info.ci/ |
| Digital Mag CI | média du numérique ivoirien | événements du secteur (JICOM Days), influence | https://digitalmag.ci/ |
| Pages Facebook d'événements (FEMUA, MASA, Abidjan Fashion Week, Parc des expositions) | pages officielles | dates, affiches, programmes | via Graph API sur les pages publiques |
| Mesure d'audience HACA | la HACA a choisi Thinktank Media le 10 mars 2026 comme opérateur de mesure d'audience des médias audiovisuels (contesté par Life TV le 23 mars 2026) ; résultats à suivre | référence future pour pondérer les sources | https://www.yessouan.ci/HACA-Thinktank-Media-choisi-pour-mesurer-l-audience-des-medias-en-CI_a7349.html |
| GrandToronto.ca, L-Express.ca | médias francophones de Toronto | agenda francophone et diaspora | https://grandtoronto.ca/ ; https://l-express.ca/ |
| BlogTO, NOW Toronto, Destination Toronto, ToDoCanada | agendas de Toronto | festivals, événements gratuits | https://www.blogto.com/events/ ; https://nowtoronto.com/ |
| Ottawa Festivals, Ottawa Tourism, 613today | agendas d'Ottawa | festivals, Fête du Canada | https://www.ottawafestivals.ca/ |
| Destination Ontario (festivals francophones) | agenda provincial | calendrier francophone annuel | https://www.destinationontario.com/en-ca/articles/francophone-festivals-and-events |
| Radio-Canada Ontario | média public | couverture des événements de la diaspora et de la francophonie | https://ici.radio-canada.ca/ |

Il n'existe pas, au 2 octobre 2026, de classement d'audience public et fiable des sites d'information ivoiriens ; la pondération des sources doit rester un réglage manuel de la machine jusqu'à la publication des mesures de la HACA.

## 7. Tarifs du marché et attentes des clients

### 7.1 Ce que facturent les agences et les community managers

| Ville | Prestataire | Fourchette mensuelle | Détail | Source |
|---|---|---|---|---|
| Abidjan | agence (Digit Communication, grille en ligne, non datée) | 300 000 à 900 000 FCFA | Débutant 300 000 (1 compte, 2 posts par semaine, veille, rapport mensuel) ; Start-up 350 000 (2 comptes, 3 posts) ; Premium 400 000 (5 posts, 2 stories) ; Big Business 500 000 (5 à 7 posts, 3 stories, shooting 10 photos) ; Food Business 750 000 (7 posts, 7 stories, 4 vidéos courtes) ; E-commerce 900 000 (idem, 40 photos, boutique Facebook, rapport hebdomadaire). Stratégie, gestion des publicités et gestion de crise incluses | https://digitcommunication.ci/tarifs-des-prestations-en-community-management-en-cote-divoire/ |
| Abidjan | salarié | 150 000 à 300 000 FCFA (junior), 300 000 à 600 000 (confirmé), 800 000 et plus (senior) ; freelance 100 000 à 500 000 FCFA par projet | guide 2025 | https://institutdigital.com/devenir-community-manager-a-abidjan-formation-salaire-et-missions-guide-2025/ |
| Dakar | agences | 15 000 à 275 000 FCFA | Sennumeric Lite 15 000 et Complet 20 000 ; Jangaan Tech Démarrage 49 000 (5 publications par semaine), Croissance 115 000, Premium dès 220 000 (28 août 2025) ; Sabma Digital dès 75 000 ; WeD Raogo Basic 130 000, Medium 180 000, Advanced 275 000 | https://jangaantech.com/tarifs-community-management-senegal-budget-inclus/ ; https://sabmadigital.com/sn/services/social-media-marketing/community-management/ ; https://wedraogo.com/nos-offres-de-community-management/ ; https://sennumeric.com/community-manager |
| Douala | freelance et agences | freelance 50 000 à 500 000 FCFA par mois (2 000 à 25 000 FCFA de l'heure) ; agences 100 000 à 2 000 000 FCFA selon le périmètre ; salaire moyen 200 000 FCFA | https://adjemson.com/en/combien-coute-le-community-management-au-cameroun-prix/ ; https://econuma.com/go-digital/community-manager-cameroun-competences-formation-ia-1778596620 |
| Montréal et Québec | agences (guide Bolle, mis à jour le 1er juillet 2026) | 500 à 3 500 CAD et plus | entrée 500 à 900 CAD (1 à 2 plateformes, 8 à 12 visuels statiques) ; intermédiaire 1 000 à 2 000 CAD ; premium 2 500 à 3 500 CAD et plus (vidéo, animation de communauté) ; à la pièce : visuel 75 à 150 CAD, GIF animé 150 à 300 CAD, capsule vidéo 300 à 900 CAD ; animation de communauté seule 250 à 750 CAD ; budget publicitaire séparé 250 à 2 500 CAD | https://www.bolle.ca/guides/combien-coute-gestion-medias-sociaux-quebec |
| Toronto | freelance, boutique, full-service (guides 2026) | 500 à 7 000 CAD | freelance 500 à 1 500 CAD ; agence boutique 1 500 à 5 000 CAD (12 à 24 posts par mois, 1 à 4 plateformes, stratégie, KPI, animation) ; full-service 5 000 CAD et plus (vidéo, publicité) ; prime torontoise de 15 à 25 % par rapport aux villes moyennes | https://www.syntara.ca/blog/how-much-does-a-social-media-agency-cost-toronto ; https://ap-digital.ca/blog/how-much-does-social-media-marketing-cost-canada ; https://reeltimecreations.ca/blog/social-media-management-cost-toronto/ |

Lecture : l'écart entre Dakar (15 000 à 275 000 FCFA) et Abidjan (300 000 à 900 000 FCFA) tient à la taille et à la maturité des agences citées, pas seulement au marché ; les grilles sénégalaises à 15 000 ou 20 000 FCFA correspondent à de la planification de posts sans création. En CAD, 300 000 FCFA font environ 700 CAD, soit le bas de la fourchette montréalaise : le prix d'entrée d'une agence d'Abidjan est comparable au prix d'un freelance canadien. Un pack « vidéo » (4 vidéos courtes par mois) vaut 750 000 FCFA à Abidjan contre 2 500 CAD et plus à Montréal, ce qui place la vidéo courte produite par la machine comme l'élément de valeur le plus différenciant dans les deux marchés.

### 7.2 Attentes des clients locaux

- Réactivité : 42 % des clients attendent une réponse en moins d'une heure sur les réseaux sociaux ; les PME d'Abidjan classent la réactivité, la personnalisation, la transparence, l'engagement sociétal et la fluidité comme attentes de 2025. Source : https://www.dynabuy.fr/articles/pme-et-attentes-clients-ce-que-vos-clients-veulent-vraiment/ ; https://flexizi.wordpress.com/2025/05/28/reseaux-sociaux-pour-pme-5-astuces-pour-booster-vos-ventes-sur-whatsapp-et-instagram-en-cote-divoire/
- WhatsApp comme interface : les commerçants ivoiriens exposent leurs produits sur WhatsApp, prennent les commandes dans la messagerie et encaissent parfois en ligne (Fratmat, 4 mai 2025) ; les décisions d'achat des jeunes se prennent dans les groupes WhatsApp et sur les avis en ligne. Sources : https://www.fratmat.info/article/2633616/culture/whatsapp-franchit-le-cap-des-3-milliards-dutilisateurs-quel-impact-en-cote-divoire- ; https://annuaireci.com/blog/les-habitudes-de-consommation-en-cote-divoire-en-2025/
- Preuve de résultats : toutes les grilles d'agences d'Abidjan et de Dakar incluent un rapport mensuel ; le pack e-commerce le plus cher promet un rapport hebdomadaire. Le client paie en partie pour le rapport.
- Contenus en français, et en français d'ici : humour local, nouchi, références culturelles ; au Canada, bilinguisme obligatoire pour une association qui veut des subventions municipales ou provinciales (Ontario) et un public mixte.
- Observation de José (douleur citée dans le brief) : les clients partent parce que les tendances ne sont pas suivies, les vidéos pas exploitées, les nouveautés pas mises en avant. Les attentes locales confirment que la vidéo et la nouveauté sont les deux carences visibles par le client, et que le rapport mensuel est le moment où il juge.

### 7.3 Modes de paiement pour un SaaS

| Moyen | Frais marchands (2026) | Remarques | Source |
|---|---|---|---|
| Wave (Côte d'Ivoire, Sénégal) | environ 1 % en encaissement marchand ; API Wave Business gratuite pour les PME sous 10 millions FCFA par mois, obtention des clés en 1 à 5 jours après KYC (2 à 5 jours) | le moins cher ; pas d'abonnement récurrent natif, il faut relancer le client chaque mois par lien de paiement | https://kolonell.com/fr/blog/wave-cote-ivoire-integration-marchand-abidjan-2026 ; https://blog.iambeezy.app/fr/recevoir-paiement-wave-cote-ivoire-2026/ |
| Orange Money (Web Payment, API) | commission marchande généralement de 0,5 à 1,5 %, « autour de 1 % » en Côte d'Ivoire ; retrait marchand 0,8 à 1,5 % | contrat marchand via Orange Business ; API de paiement, de dépôt et de paiement de masse | https://business.orange.ci/fr/orange-money-web-payment.html ; https://afrotools.com/fr/blog/frais-orange-money-guide-2026/ |
| CinetPay (agrégateur, Abidjan) | 1,5 à 2 % en mobile money selon le plan (Wave 2 %, Orange Money Sénégal 2 %, MTN Cameroun 2 %), 3,5 % sur Visa et Mastercard ; lien de paiement 3 % Orange Money | couvre Orange, MTN, Moov, Wave et cartes en Côte d'Ivoire, Sénégal, Cameroun, Bénin, Togo, Burkina, Mali | https://cinetpay.com/pricing ; https://kolonell.com/fr/blog/passerelle-paiement-cote-divoire-wave-orange-mtn-2026 |
| Paystack Côte d'Ivoire | 1,95 % mobile money (Wave, MTN, Orange), 3,2 % cartes locales, 3,8 % cartes internationales, hors TVA | abonnements récurrents sur carte ; filiale de Stripe | https://paystack.com/ci/pricing ; https://support.paystack.com/en/articles/2130306 |
| Flutterwave Côte d'Ivoire | 2,5 % mobile money, 3,5 % cartes locales, 4,8 % cartes internationales ; virement sortant 1 500 FCFA (jusqu'à 49,9 millions), 4 000 FCFA au-delà ; 2 % vers mobile money | couverture panafricaine | https://www.flutterwave.com/ci/pricing ; https://flutterwave.com/ci/support/pricing/pricing-for-transfers-and-payouts |
| FedaPay, KkiaPay (Bénin, UEMOA) | grilles non vérifiées (page de tarifs inaccessible le 2 octobre 2026) | alternatives pour le Bénin et le Togo | https://www.fedapay.com/tarifications/ ; https://kkiapay.me/ |
| Stripe Canada | 2,9 % + 0,30 CAD par carte domestique ; +0,8 % cartes internationales ; +0,5 % saisie manuelle ; +2 % conversion de devise ; prélèvement préautorisé (PAD) 1 % + 0,40 CAD plafonné à 5 CAD ; Stripe Billing 0,7 % du volume (ou dès 770 CAD par mois avec contrat annuel) ; Stripe Tax 0,5 % par transaction | abonnements, factures, taxes (TPS, TVH 13 % en Ontario, TVQ) | https://stripe.com/en-ca/pricing |

Stripe n'ouvre pas de comptes marchands en Côte d'Ivoire (liste des pays pris en charge, à revérifier) : la machine a besoin de deux rails, Stripe pour les clients canadiens (CAD, abonnement mensuel automatique, taxes) et un agrégateur ou Wave Business pour les clients africains (FCFA, lien de paiement envoyé sur WhatsApp chaque mois, confirmation par webhook). Le mobile money est la norme locale : les sources commerciales citent 82 % des transactions en ligne ivoiriennes réglées par mobile money (chiffre non sourcé, section 9).

## 8. Implications pour la machine de José

1. **WhatsApp-first pour la relation, pas pour la publication.** Les planches de propositions, les demandes de validation (« est-ce que ça vous convient, madame ? »), les alertes de publication et le rapport mensuel partent sur WhatsApp via la Cloud API avec des modèles utilitaires (0,004 USD le message en Afrique, 0,0034 USD au Canada) et des boutons « Valider », « Modifier », « Refuser ». La publication sur les Channels et les Status reste un geste humain préparé par la machine (fichier au bon format, texte prêt, lien « ouvrir dans WhatsApp »). Aucune API non officielle.
2. **Deux numéros par client : le sien et celui de l'agence.** La coexistence application Business et Cloud API (janvier 2026) permet au client de garder son téléphone pour ses propres clients pendant que la machine envoie les notifications depuis le même numéro ; l'agence conserve en plus un numéro Cloud API pour ses alertes internes (CallMeBot reste pour les alertes de José seulement, car c'est un service non officiel).
3. **Opt-in intégré au produit.** Chaque client final de la marque de beauté ou de l'église entre dans la base par un formulaire, un mot-clé ou une case cochée ; la machine stocke la preuve (date, source, texte du consentement) pour satisfaire la politique WhatsApp du 23 septembre 2026 et la loi canadienne anti-pourriel, traite STOP automatiquement et surveille la note de qualité. Les diffusions marketing (0,0225 USD le message) ne dépassent pas 4 envois par mois et par contact.
4. **Facebook et TikTok comme canaux de découverte en Afrique, YouTube, Instagram et LinkedIn au Canada.** La règle des deux plateformes de la doctrine de José se décline par pays : Côte d'Ivoire, Facebook (8,4 M) + TikTok (chiffre non publié mais croissance avérée) avec WhatsApp pour la relation ; Canada, Instagram (21 M, majoritairement féminin) ou LinkedIn (29 M) pour la découverte, YouTube (33 M) pour la profondeur, Messenger et courriel pour la relation. Instagram est marginal en Afrique francophone (moins de 3 % de la population) : ne pas y investir pour un client ivoirien hors luxe et beauté urbaine.
5. **LinkedIn côté africain aussi.** Avec 1,8 M en Côte d'Ivoire, 1,6 M au Cameroun, 1,5 M au Sénégal et des croissances de 12 à 19 %, LinkedIn mérite un canal dans la machine pour 2IAE (admissions, employeurs, anciens) et Markel-Tech, en documents natifs et carrousels (meilleurs formats selon R09).
6. **Poids des vidéos : un profil d'export « Afrique mobile ».** Clips de 15 à 30 secondes, 720p vertical, bitrate réduit pour viser moins de 10 Mo sur WhatsApp et TikTok, sous-titres incrustés, premières 2 secondes sans logo. Un profil « Canada » peut garder 1080p. Le poids fait partie de la portée quand le public achète 1,5 Go par jour.
7. **Créneaux par fuseau.** Pour les clients ivoiriens : Facebook en semaine 7 h à 9 h et 13 h à 15 h, TikTok 18 h à 20 h et jeudi matin, et une fenêtre du soir 20 h à 22 h GMT ; pour les clients canadiens : mardi à jeudi 11 h à 17 h heure de l'Est ; pour les églises, clips du lundi au jeudi (le dimanche est le pire jour de publication). La machine stocke le fuseau du client et de son public, pas celui du serveur Railway.
8. **Langues et registre par client.** Un champ « registre » par client : français standard (SEVARTA, églises, 2IAE institutionnel), français parlé avec nouchi (beauté grand public, vie de campus 2IAE), anglais et français (association de Toronto, Markel-Tech). Les hooks des Reels et TikTok ivoiriens se rédigent en français parlé ; les sous-titres restent en français standard.
9. **Calendrier à trois couches.** Couche 1, fêtes fixes par pays (encodées une fois) ; couche 2, fêtes lunaires (Ramadan, Aïd, Tabaski, Maouloud, Magal) avec fenêtre de plus ou moins deux jours et confirmation la veille ; couche 3, événements vivants (FEMUA fin avril, MASA en avril des années paires, Afrofest mi-août, Caribbean Carnival début août, Francophonie en fête fin septembre, rentrée ivoirienne le 14 septembre) rafraîchis par la veille. La machine propose un contenu 10 jours avant chaque date, pour chaque client dont la verticale est concernée (Fête des mères pour la beauté et l'édition, Mois de l'histoire des Noirs pour l'association et SEVARTA, rentrée pour 2IAE).
10. **Veille locale par flux et par pages Facebook.** Brancher Abidjan.net, Fratmat, Yeclo, Pulse CI, Life.ci, Digital Mag CI, GrandToronto, L-Express, BlogTO et Ottawa Festivals en RSS ou par lecture de page, et les pages Facebook publiques des festivals via la Graph API déjà utilisée pour 2IAE ; pondération manuelle des sources tant que la mesure d'audience de la HACA (Thinktank Media, choisi le 10 mars 2026) n'a pas publié.
11. **Deux rails de paiement et une facturation mensuelle courte.** Stripe (CAD, abonnement, taxes) pour le Canada ; Wave Business ou CinetPay (FCFA, lien de paiement sur WhatsApp, webhook de confirmation) pour l'Afrique. Prévoir la relance automatique par message utilitaire 3 jours avant l'échéance et la suspension douce du service (plus de nouvelles propositions, mais les publications programmées partent) en cas de retard : les clients paient au mois et les retards sont fréquents.
12. **Grille de prix alignée sur le marché, valeur sur la vidéo.** À Abidjan : pack de base autour de 250 000 à 350 000 FCFA (3 posts par semaine, planches validées sur WhatsApp, rapport mensuel), pack vidéo autour de 500 000 à 750 000 FCFA (4 à 8 clips par mois dont découpage de sermons ou démonstrations produits), pack e-commerce autour de 900 000 FCFA ; au Canada : 900 à 1 500 CAD pour l'entrée, 2 500 à 3 500 CAD avec vidéo. La machine doit rendre le pack vidéo rentable là où les agences locales le vendent cher parce qu'elles le produisent à la main.
13. **Le rapport mensuel est un produit.** Toutes les grilles locales incluent un rapport ; la machine génère un rapport en trois couches (indicateurs avancés, croissance, affaires) en PDF léger et en résumé WhatsApp de 5 lignes, avec les 3 meilleures publications en vignette, le premier lundi du mois, avant 9 h heure du client.
14. **Publicité WhatsApp par Ads Manager plutôt que par envois massifs.** Pour une marque de beauté ou un événement, les publicités Status et Channels promus (juin 2025) et les Click-to-WhatsApp (72 heures de messages gratuits) rapportent des conversations opt-in à faible coût ; la machine crée la campagne par la Marketing API et répond dans les 24 heures pour garder la gratuité.
15. **Ciblage de genre en Afrique.** Facebook y est à 60 à 75 % masculin : pour la beauté, prévoir un budget de ciblage féminin et un tunnel WhatsApp (groupes de clientes, Status) qui compense le biais organique.
16. **Sermons : YouTube pour l'archive, Facebook, TikTok et WhatsApp pour la portée.** La monétisation YouTube est faible en Afrique francophone ; la valeur du découpage est dans les clips distribués sur Facebook Reels, TikTok, les Status et le Channel de l'église, avec le lien YouTube en commentaire. Les clips sortent du lundi au jeudi.
17. **Événements de la diaspora : public double.** Pour l'association de Toronto ou d'Ottawa, deux lignes éditoriales : membres (WhatsApp, Facebook, français) et ville (Instagram, agendas BlogTO et Ottawa Festivals, anglais et français), avec un calendrier calé sur février (Mois de l'histoire des Noirs), juin (Franco-Fête, Festival franco-ontarien), août (indépendance, Afrofest, Carnaval) et septembre (Francophonie en fête, Jour des Franco-Ontariens).
18. **Cameroun : prudence sur le poids des fichiers et sur le bilinguisme.** Vitesse fixe médiane de 11 Mbps, 87,5 % de connexions haut débit : profil d'export encore plus léger ; contenus en français et en anglais pour les clients de Douala qui vendent dans les deux zones.
19. **Mesurer WhatsApp comme un canal.** Webhooks « delivered » et « read », clics sur boutons, taux de blocage, note de qualité, coût par message : ces indicateurs entrent dans la couche « indicateurs avancés » du rapport, avec les vues de Status et les abonnés du Channel saisis à la main par le gestionnaire tant qu'il n'y a pas d'API.
20. **Prévoir la bascule.** Si Meta livre la programmation des Channels (en développement depuis août 2026) puis une API, la machine doit pouvoir remplacer le geste humain par un appel sans changer le reste du flux : isoler un adaptateur « publication WhatsApp » dès la conception.

## 9. Incertitudes et points à vérifier

1. **TikTok, YouTube et WhatsApp en Afrique de l'Ouest** : aucun chiffre Datareportal par pays. Les « 5,2 millions d'utilisateurs TikTok en Côte d'Ivoire (+85 %) », « 52 minutes par jour sur TikTok », « 72 % du contenu consommé en vidéos de 15 à 30 secondes », « 85 % des internautes ivoiriens sur WhatsApp chaque jour », « 82 % des transactions en mobile money » et « 2,5 fois plus d'engagement en nouchi » viennent de blogs (iambeezy.app, 1er mars 2026 ; whakup.com ; Neurone Digital, 22 mars 2026) qui ne citent aucune source. À traiter comme des hypothèses de terrain, pas comme des faits. Le chiffre d'audience publicitaire TikTok par pays peut être lu directement dans Ads Manager de TikTok, ce que la machine pourra faire.
2. **Rest of Africa, prix marketing** : deux reprises de la grille Meta donnent 0,0225 USD au 1er octobre 2026 ; un résumé de recherche a donné 0,0259 USD. Vérifier dans le CSV officiel de Meta avant de chiffrer un devis.
3. **Messages de service payants après 1 000 par mois** : affirmé par Flowcall pour le 1er octobre 2026, non retrouvé sur la page de Meta le 2 octobre 2026. À vérifier dans le changelog Meta du quatrième trimestre 2026.
4. **Programmation des Channels** : en développement (WABetaInfo, 22 août 2026), non livrée, pas d'annonce officielle. L'existence d'une API Channels reste inconnue ; les services qui en vendent une sont non officiels.
5. **Abidjan Fashion Week** : dates contradictoires (14 au 20 septembre ou 7 au 13 décembre 2026). Confirmer sur le site officiel.
6. **Fête des mères en Côte d'Ivoire** : date non vérifiée dans une source ivoirienne ; par usage, dernier dimanche de mai comme en France.
7. **Fêtes musulmanes 2027** : dates calculées, confirmées la veille par les autorités religieuses de chaque pays.
8. **Grilles d'agences** : la grille de Digit Communication n'est pas datée ; celles de Dakar vont de 15 000 à 275 000 FCFA selon des périmètres très différents ; aucune enquête de marché indépendante n'a été trouvée pour Abidjan, Dakar ou Douala.
9. **Taux de change** : les conversions FCFA et USD du rapport utilisent 610 FCFA pour un dollar et 430 FCFA pour un dollar canadien, à ajuster ; l'euro est fixe à 655,957 FCFA.
10. **Stripe en Côte d'Ivoire** : non disponible pour les marchands locaux selon la connaissance générale ; vérifier la liste des pays pris en charge au moment de l'intégration ; Paystack (filiale de Stripe) couvre la Côte d'Ivoire.
11. **FedaPay et KkiaPay** : grilles non ouvertes (pages inaccessibles le 2 octobre 2026).
12. **WhatsApp au Canada** : 30 à 42 % selon des estimations tierces non officielles ; aucun chiffre Datareportal ni Statistique Canada.
13. **Heures de publication à Abidjan** : l'article de Linfodrome n'a pu être lu que par son résumé dans les résultats de recherche ; la source de ses données n'est pas connue. Le benchmark Sprout est mondial.
14. **Audience des médias ivoiriens** : aucune mesure publique ; la mesure HACA par Thinktank Media (choisi le 10 mars 2026) est contestée et ses résultats ne sont pas publiés.
15. **Loi canadienne anti-pourriel (LCAP)** : mention de principe ; les obligations précises (consentement exprès ou tacite, mentions obligatoires) doivent être vérifiées avec le texte officiel avant d'envoyer des messages WhatsApp marketing à des contacts canadiens.

## 10. Sources consultées (sélection, toutes ouvertes ou lues par résumé les 1er et 2 octobre 2026)

Datareportal : https://datareportal.com/reports/digital-2026-cote-divoire ; https://datareportal.com/reports/digital-2026-senegal ; https://datareportal.com/reports/digital-2026-cameroon ; https://datareportal.com/reports/digital-2026-benin ; https://datareportal.com/reports/digital-2026-togo ; https://datareportal.com/reports/digital-2026-burkina-faso ; https://datareportal.com/reports/digital-2026-mali ; https://datareportal.com/reports/digital-2026-canada ; https://datareportal.com/reports/digital-2026-global-overview-report

Meta et WhatsApp : https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing ; https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog ; https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits ; https://whatsappbusiness.com/policy/ ; https://about.fb.com/news/2025/06/helping-you-find-more-channels-businesses-on-whatsapp/ ; https://www.infobip.com/blog/whatsapp-news-and-updates ; https://wabetainfo.com/whatsapp-is-testing-a-new-feature-to-schedule-channel-updates/ ; https://whautomate.com/whatsapp-business-api-pricing ; https://www.flowcall.co/blog/whatsapp-business-api-pricing ; https://setsmart.io/blog/whatsapp-broadcast ; https://chatmi.io/en/blog/whatsapp-pricing-2026-guide

Habitudes et marché : https://transformation-numerique.ulaval.ca/enquetes-et-mesures/netendances/reseaux-sociaux-et-divertissement-en-ligne-2025/ ; https://madeinca.ca/social-media-statistics-canada/ ; https://www.neuronedigital.com/article/les-reseaux-sociaux-en-afrique-en-2026-ces-chiffres-vont-vous-surprendre ; https://blog.iambeezy.app/fr/tendances-consommation-digitale-cote-ivoire-donnees-2026/ ; https://www.fratmat.info/article/2633616/culture/whatsapp-franchit-le-cap-des-3-milliards-dutilisateurs-quel-impact-en-cote-divoire- ; https://www.linfodrome.com/high-tech/111125-abidjan-voici-les-meilleures-heures-pour-publier-sur-tiktok-youtube-facebook-instagram-et-x ; https://sproutsocial.com/insights/best-times-to-post-on-social-media/ ; https://business.orange.ci/fr/newsletters/2026/mars/tendances-du-marche-bascule-des-telecoms-cote-ivoire-afrique-ouest.html ; https://www.moov-africa.ci/espace-particulier/forfait-internet-moov-folie/ ; https://lesafriques.com/2026/06/monetisation-youtube-afrique-francophone-blocages-solutions/

Tarifs et paiement : https://digitcommunication.ci/tarifs-des-prestations-en-community-management-en-cote-divoire/ ; https://institutdigital.com/devenir-community-manager-a-abidjan-formation-salaire-et-missions-guide-2025/ ; https://jangaantech.com/tarifs-community-management-senegal-budget-inclus/ ; https://sabmadigital.com/sn/services/social-media-marketing/community-management/ ; https://wedraogo.com/nos-offres-de-community-management/ ; https://adjemson.com/en/combien-coute-le-community-management-au-cameroun-prix/ ; https://www.bolle.ca/guides/combien-coute-gestion-medias-sociaux-quebec ; https://www.syntara.ca/blog/how-much-does-a-social-media-agency-cost-toronto ; https://ap-digital.ca/blog/how-much-does-social-media-marketing-cost-canada ; https://cinetpay.com/pricing ; https://paystack.com/ci/pricing ; https://www.flutterwave.com/ci/pricing ; https://stripe.com/en-ca/pricing ; https://kolonell.com/fr/blog/wave-cote-ivoire-integration-marchand-abidjan-2026 ; https://business.orange.ci/fr/orange-money-web-payment.html

Calendrier et événements : https://www.ivoirematin.com/fr/news/Societe/le-calendrier-officiel-des-jours-feries-et-journees-continues-pour-2026_n_119230.html ; https://www.joursferies.fr/pays/cote-d-ivoire.php ; https://lepetitjournal.com/dakar/jours-feries-senegal-295473 ; https://www.statutoryholidays.com/ontario.php ; https://ici.radio-canada.ca/nouvelle/2218770/mois-histoire-noirs-2026-30-ans ; https://www.yeclo.com/rentree-scolaire-2026-2027-le-14-septembre-tout-savoir-sur-les-nouvelles-mesures/ ; https://www.musicinafrica.net/fr/magazine/masa-2026-89-artistes-51-pays-et-une-ambition-continentale ; https://www.africaradio.com/actualite-113874-femua-2026-youssou-n-dour-en-tete-d-affiche-d-un-festival-geant-a-abidjan ; https://www.abidjanfashionweek.com/ ; https://www.afrofest.ca/vendors ; https://www.destinationtoronto.com/leisure-blog/post/toronto-caribbean-carnival/ ; https://www.blogto.com/events/afro-carib-fest-2026-toronto/ ; https://grandtoronto.ca/ ; https://ffo.ca/en/ ; https://www.ottawafestivals.ca/post/winterlude-2026-your-ultimate-guide ; https://l-express.ca/lassociation-ivoirienne-de-toronto-diversifie-ses-activites/ ; https://www.faic.ca/nos-associations/ ; https://www.yessouan.ci/HACA-Thinktank-Media-choisi-pour-mesurer-l-audience-des-medias-en-CI_a7349.html
