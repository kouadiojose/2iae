# R06. Veille, tendances et détection de sujets : sources et API exploitables en 2026

Rapport de recherche pour la machine de social media multi-clients de José Kouadio (Markel-Tech, SEVARTA, 2IAE). Date de rédaction : 1er octobre 2026. Tous les prix et limites ont été relus sur les pages officielles ce jour, sauf mention contraire. Lorsqu'une information n'a pas pu être vérifiée, elle est signalée comme telle dans la section « Incertitudes et points à vérifier ».

Méthode : 4 recherches web (le quota de recherche de la session a été atteint ensuite) puis ouverture directe de 55 pages primaires (documentation officielle, pages de prix, flux RSS testés en direct, fiches de scrapers). Les faits qui proviennent de ma mémoire et non d'une page ouverte ce jour sont explicitement marqués « non vérifié en ligne ».

---

## 1. Résumé en dix lignes

1. Il n'existe toujours pas d'API Google Trends ouverte : l'API officielle annoncée en juillet 2025 reste en alpha fermée. Les voies praticables sont SerpApi (à partir de 25 USD par mois pour 1 000 recherches) et, gratuitement, le flux RSS « Trending Now » par pays (testé ce jour pour la Côte d'Ivoire et le Canada, il fonctionne).
2. pytrends est archivé depuis avril 2025 et renvoie des erreurs 429 depuis les IP de cloud : à ne pas mettre en production.
3. TikTok Creative Center ne fournit pas d'API publique. Les classements de hashtags, sons et créateurs sont accessibles par scrapers Apify (de 0,76 à 3,1 millièmes de dollar par ligne), avec un risque juridique assumé : TikTok considère le scraping comme une violation de ses conditions.
4. Instagram : la recherche de hashtags via Graph API est limitée à 30 hashtags uniques par fenêtre glissante de 7 jours et par compte. Aucune API pour les sons tendance. Business Discovery permet de lire les compteurs publics d'un concurrent.
5. YouTube : la page officielle du quota affiche désormais un seau séparé de 100 appels search.list par jour, et 10 000 unités pour le reste. Le flux Atom par chaîne est gratuit, hors quota, et contient les vues. videos.list avec chart=mostPopular coûte 1 unité.
6. Actualités : Bing News API est retirée depuis le 11 août 2025. NewsAPI coûte 449 USD par mois en production. GDELT DOC 2.0 est gratuit et rafraîchi toutes les 15 minutes. Google News RSS est gratuit et fonctionne pour la Côte d'Ivoire (50 articles par requête testée).
7. Moteurs pour agents : Tavily (1 000 crédits gratuits par mois), Exa (4 à 7 USD pour 1 000 requêtes), Brave (5 USD pour 1 000), Perplexity Search API (1 à 5 USD pour 1 000), Linkup (5 à 6 USD pour 1 000), You.com (5 USD pour 1 000), Firecrawl Search (2 crédits pour 10 résultats).
8. Surveillance du site du client : Firecrawl offre un suivi de changements sans surcoût en mode git-diff ; changedetection.io est open source et auto-hébergeable (hébergé : 8,99 USD par mois pour 5 000 URL) ; Visualping démarre à 14 USD par mois.
9. Événements : l'API publique de recherche d'Eventbrite n'est plus documentée (à confirmer), Meetup réserve son API GraphQL au plan Pro, les événements Facebook de pages tierces exigent la validation « Page Public Content Access ». Google Events via SerpApi reste le moyen le plus simple pour « événements à Abidjan cette semaine ».
10. Coût réaliste de la veille : de 12 à 25 USD par client et par mois en configuration standard, dont plus de la moitié en appels LLM de scoring, avec un socle partagé de 100 à 160 USD par mois pour l'ensemble des clients.

---

## 2. Tendances de recherche : Google Trends et alternatives

### 2.1 État des lieux

Google a annoncé une API Google Trends officielle le 24 juillet 2025, en alpha, avec cinq ans d'historique et des agrégations configurables. Au 1er octobre 2026, elle est toujours en alpha fermée sur formulaire, et plusieurs guides de développeurs rapportent des demandes sans réponse. Il ne faut donc pas la mettre dans le plan.
Source : https://developers.google.com/search/blog/2025/07/trends-api

pytrends (bibliothèque Python non officielle) est archivé depuis avril 2025 (dernière version 4.9.2 d'avril 2023). Les points d'entrée /trends/api/widgetdata renvoient 429 aux plages d'adresses AWS, GCP et Azure. Railway tourne sur ce type d'infrastructure : un pytrends hébergé sur Railway échouera.
Sources : https://github.com/GeneralMills/pytrends/issues/492 ; https://dev.to/kyungmin_lee_85c597046ee0/pytrends-is-dead-here-is-how-google-trends-actually-loads-data-in-2026-including-trending-now-3bn

### 2.2 Le flux RSS « Trending Now », gratuit et testé

Google publie un flux RSS des sujets en forte hausse par pays : https://trends.google.com/trending/rss?geo=CI et https://trends.google.com/trending/rss?geo=CA. Testé le 1er octobre 2026 :
- Côte d'Ivoire : 8 items, par exemple « danemark – portugal » (5 000+ recherches, 1er octobre 11 h), « stage » (1 000+).
- Canada : 10 items, par exemple « tariff » (10 000+), « donald trump » (5 000+).
- Champs : ht:approx_traffic, ht:picture, ht:news_item_title, ht:news_item_url, ht:news_item_source, ht:news_item_picture.

C'est la source de newsjacking la moins chère qui existe : zéro coût, un article de presse associé à chaque tendance, et une fraîcheur de quelques heures. Limites : 8 à 20 sujets seulement, pas d'historique, pas de filtre par catégorie dans le flux, et aucune garantie contractuelle de pérennité.
Source : https://trends.google.com/trending/rss?geo=CI (testé)

### 2.3 Comparatif des accès à Google Trends

| Voie | Accès | Prix (1er octobre 2026) | Données | Risque |
|---|---|---|---|---|
| API officielle Google | Alpha fermée depuis juillet 2025 | Inconnu | 5 ans, agrégation | Pas accessible |
| RSS Trending Now | Public, gratuit | 0 | 8 à 20 sujets chauds par pays, article lié | Pas de SLA |
| SerpApi Google Trends | Clé API | Free 250 recherches ; Starter 25 USD pour 1 000 ; Developer 75 USD pour 5 000 ; Production 150 USD pour 15 000 | TIMESERIES, GEO_MAP, GEO_MAP_0, RELATED_TOPICS, RELATED_QUERIES, paramètre geo (CI, CA…) ; Trending Now disponible | Faible ; une recherche = un crédit, le même pool sert Google Search, YouTube, Events, News |
| Apify google-trends-scraper | Clé Apify | « à partir de 0,30 USD pour 1 000 résultats », taux de succès affiché 95,2 % | Interest over time, régions, related queries | Blocage possible, proxies résidentiels conseillés |
| Glimpse | Compte, API sur devis | Non affiché sur le site (contact hello@meetglimpse.com) | Volumes absolus, prévisions, répartition par réseau | Prix opaque |
| pytrends | Code open source archivé | 0 | Tout, en théorie | 429 depuis le cloud, projet mort |

Sources : https://serpapi.com/pricing ; https://serpapi.com/google-trends-api ; https://apify.com/emastra/google-trends-scraper ; https://meetglimpse.com/pricing

Recommandation : RSS Trending Now pour les sujets chauds (gratuit), SerpApi plan Starter ou Developer pour les séries temporelles et les requêtes associées sur les mots-clés de chaque client (quelques dizaines de recherches par client et par semaine). Les crédits SerpApi expirent chaque mois sans report.

---

## 3. TikTok : Creative Center, API de recherche et scrapers

### 3.1 Ce qui est officiel

- Research API : réservée aux chercheurs académiques affiliés à des institutions aux États-Unis, dans l'EEE, au Royaume-Uni, au Canada, en Suisse, ou à des organisations à but non lucratif de l'UE, « indépendants de tout intérêt commercial ». Une agence n'y a pas droit.
- Commercial Content API : ouverte sur candidature à toute personne, quel que soit son pays, mais ne couvre que les publicités et contenus commerciaux, et uniquement les données de l'UE pour l'instant. Réponse sous 2 jours ouvrables. Utile pour la veille publicitaire concurrentielle en Europe, inutile pour les sons tendance en Côte d'Ivoire.
- Le Creative Center (ads.tiktok.com/business/creativecenter) affiche les hashtags, sons, créateurs et vidéos en tendance avec filtres par pays, industrie et période (7, 30, 120 jours). Ouvert en consultation, mais une partie des listes est masquée derrière une connexion « TikTok for Business », et il n'existe aucune API publique.

Sources : https://developers.tiktok.com/products/research-api/ ; https://developers.tiktok.com/products/commercial-content-api/ ; https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en

### 3.2 Scrapers Apify pour TikTok

| Acteur Apify | Prix affiché (1er octobre 2026) | Données | Notes |
|---|---|---|---|
| automation-lab/tiktok-creative-center-scraper | Démarrage 0,005 USD par run, puis 0,0031 USD par ligne (Free) à 0,00076 USD par ligne (Diamond) | Hashtags tendance (rang, catégorie, posts, vues), Top Ads (annonceur, objectif, CTR percentile, période 7, 30, 180 jours) | Le pays se saisit avec le libellé exact du Creative Center ; TikTok « peut n'afficher qu'un échantillon anonyme limité avant de demander une connexion » |
| clockworks/tiktok-scraper | 1,70 USD pour 1 000 résultats | Vidéos par hashtag, profil, son (métadonnées musique, vues, partages, commentaires) | Pas de données privées, rappel RGPD |
| Autres acteurs « TikTok Trends Scraper » (rastriq, doliz, datapeak, dami_studio) | Variables, non vérifiés individuellement | Hashtags, sons, créateurs par région, 27 pays annoncés | À tester : fiabilité inégale |

Sources : https://apify.com/automation-lab/tiktok-creative-center-scraper ; https://apify.com/clockworks/tiktok-scraper ; https://apify.com/pricing

### 3.3 Légalité et risques

Les fiches Apify insistent sur le caractère public des données et sur le RGPD. En revanche, un guide d'avril 2026 relève que TikTok a renforcé ses conditions : le scraping est désormais aussi une violation des conditions de la Commercial Content Licensing API, et TikTok renvoie vers la Research API ou la Commercial Content API pour tout besoin en volume. En clair : scraper le Creative Center pour un usage interne de veille est un risque contractuel (fermeture de comptes TikTok for Business liés, blocage d'IP), pas un risque pénal en soi, mais il faut l'assumer et ne jamais lier le scraper aux comptes de publication des clients.
Source : https://scrapebadger.com/blog/tiktok-scraping-apis-in-2026-the-complete-deep-guide

Budget : relever chaque jour les 100 premiers hashtags et 100 premiers sons pour 3 pays (Côte d'Ivoire, Canada, France) représente environ 600 lignes par jour, soit 18 000 lignes par mois : entre 14 USD (plan Free) et 56 USD au tarif Free, et moins de 15 USD sur un plan Starter à 19 USD. Il faut vérifier que la Côte d'Ivoire figure bien dans la liste des marchés du Creative Center (voir incertitudes).

---

## 4. Instagram et Facebook : ce que la Graph API autorise

### 4.1 Hashtags Instagram

L'endpoint ig_hashtag_search renvoie uniquement l'identifiant d'un hashtag ; ensuite /top_media et /recent_media donnent les publications. Limites officielles :
- 30 hashtags uniques maximum par compte Business ou Creator sur toute fenêtre glissante de 7 jours ; une requête répétée sur le même hashtag ne compte pas deux fois.
- Les hashtags jugés sensibles renvoient une erreur générique.
- Permissions : fonctionnalité « Instagram Public Content Access » plus instagram_basic (et ads_management, business_management ou pages_read_engagement selon le rôle), donc une App Review.
- Aucune métrique de popularité du hashtag n'est renvoyée par l'endpoint de recherche.

Source : https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-hashtag-search

Conséquence : avec 6 clients et un compte Instagram connecté par client, on dispose de 30 hashtags par client et par semaine. C'est suffisant pour suivre les hashtags de marque et de niche, pas pour explorer les tendances larges. Pour l'exploration, le scraper Apify instagram-hashtag-scraper coûte 2,60 USD pour 1 000 résultats (2,30 USD sur plan Starter), un type de contenu (posts ou reels) par run.
Source : https://apify.com/apify/instagram-hashtag-scraper

### 4.2 Sons tendance Instagram

Il n'existe aucun endpoint Graph API pour l'audio tendance. Les tendances Reels ne sont visibles que dans l'application (onglet Reels, « audio tendance ») et dans le tableau de bord professionnel. Pour automatiser, les seules options sont : un scraper non officiel (risque de blocage élevé, pas de source fiable identifiée ce jour), ou une routine manuelle hebdomadaire de 10 minutes par un gestionnaire humain, qui saisit 10 sons dans la plateforme. Je recommande la seconde option, assistée par TikTok Creative Center (les sons migrent souvent de TikTok vers Reels avec quelques jours de décalage).

### 4.3 Concurrents : Business Discovery et Page Public Content Access

- Business Discovery (Instagram) : avec business_discovery.username(nom) on lit followers_count, media_count et la liste des médias avec like_count, comments_count, view_count d'un autre compte Business ou Creator. Permissions : instagram_basic, instagram_manage_insights, pages_read_engagement. Comptes avec restriction d'âge exclus. C'est la bonne voie pour surveiller 5 à 10 concurrents par client, sans scraping.
Source : https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery
- Page Public Content Access (Facebook) : permet de lire /page/feed et les commentaires de Pages tierces et d'utiliser la recherche de Pages. Exige l'App Review, la vérification de l'entreprise et parfois un contrat supplémentaire ; en développement, seules les Pages administrées par l'équipe sont lisibles.
Source : https://developers.facebook.com/docs/features-reference/page-public-content-access
- Limites de taux : 200 appels par heure multipliés par le nombre d'utilisateurs de l'application ; Instagram Platform : 4 800 appels par 24 heures multipliés par le nombre d'impressions ; Pages API : 4 800 × utilisateurs engagés.
Source : https://developers.facebook.com/docs/graph-api/overview/rate-limiting
- Scraper de secours : apify/facebook-posts-scraper « à partir de 2,00 USD pour 1 000 posts », pages publiques seulement, proxies résidentiels requis. apify/instagram-scraper : 1,50 à 2,70 USD pour 1 000 résultats.
Sources : https://apify.com/apify/facebook-posts-scraper ; https://apify.com/apify/instagram-scraper

### 4.4 Meta Content Library

Réservée aux chercheurs affiliés à une institution académique ou à une organisation sans but lucratif. Couvre Facebook, Instagram, Threads et les chaînes WhatsApp (pages, groupes, événements, comptes de 100 abonnés et plus). Une agence commerciale n'y est pas éligible. À écarter.
Source : https://transparency.meta.com/researchtools/meta-content-library/

---

## 5. YouTube : quota, recherche, tendances et flux par chaîne

La page officielle du quota, relue le 1er octobre 2026, indique : « Projects that enable the YouTube Data API have a default quota allocation of 100 search.list calls, 100 videos.insert calls, and 10,000 units per day combined for all other endpoints. » search.list « costs 1 unit in the Search Queries quota bucket ». videos.list coûte 1 unité, channels.list 1, playlistItems.list 1, commentThreads.list 1, captions.list 50. Le quota se remet à zéro à minuit, heure du Pacifique, et une page de résultats supplémentaire coûte un appel de plus.
Sources : https://developers.google.com/youtube/v3/getting-started ; https://developers.google.com/youtube/v3/determine_quota_cost ; https://developers.google.com/youtube/v3/docs/search/list

C'est un changement important par rapport au modèle historique (search.list à 100 unités sur 10 000) : la contrainte dure est désormais 100 recherches par jour pour tout le projet, soit 16 recherches par client et par jour pour 6 clients. Il faut donc :
1. Réserver search.list aux requêtes thématiques (publishedAfter, regionCode=CI ou CA, relevanceLanguage=fr, order=date ou viewCount).
2. Suivre les chaînes connues (clients, concurrents, églises, médias ivoiriens) par le flux Atom gratuit https://www.youtube.com/feeds/videos.xml?channel_id=… Testé ce jour : 15 entrées, champs title, published, media:statistics views, media:starRating, yt:videoId. Aucun quota.
3. Utiliser videos.list avec chart=mostPopular et regionCode (CI, CA, FR) et videoCategoryId pour les tendances nationales : 1 unité par appel, 50 vidéos par page.
Sources : https://www.youtube.com/feeds/videos.xml?channel_id=UCBR8-60-B28hp2BmDPdntcQ (testé) ; https://developers.google.com/youtube/v3/docs/videos/list

Pour le découpage des sermons (églises clientes), la détection d'une nouvelle vidéo se fait par le flux Atom (ou PubSubHubbub pour une notification quasi instantanée), puis captions.list (50 unités) ou mieux, une transcription locale (Whisper) pour éviter le quota.

---

## 6. Reddit, X, Pinterest

### 6.1 Reddit

Les pages officielles (support.reddithelp.com, redditinc.com) n'ont pas pu être ouvertes depuis cet environnement (403 et domaine bloqué). Non vérifié en ligne ce jour, de mémoire : accès gratuit limité à 100 requêtes par minute par client OAuth pour un usage non commercial, et tarif commercial annoncé en juin 2023 à 0,24 USD pour 1 000 appels, avec interdiction d'usage pour l'entraînement de modèles sans accord. Pertinence pour José : faible (audiences ivoiriennes et chrétiennes francophones peu présentes sur Reddit), sauf r/toronto et r/ontario pour la vie locale ontarienne. À traiter en priorité basse.

### 6.2 X (Twitter)

La page de tarification officielle affiche un modèle « pay-per-usage » sans abonnement : lecture de posts 0,005 USD par post, utilisateurs 0,010 USD, tendances 0,010 USD par ressource, plafond de 3 millions de posts lus par cycle mensuel ; « owned reads » (ses propres données) à 0,001 USD. Aucune date de tarification n'est affichée.
Source : https://docs.x.com/x-api/getting-started/pricing

Pour la veille, lire 1 000 posts par jour sur des requêtes thématiques coûte 5 USD par jour, soit 150 USD par mois : trop cher pour un usage large. Limiter X à l'endpoint trends par WOEID (Abidjan, Toronto) une à deux fois par jour, soit moins de 1 USD par mois, et à la lecture ciblée de 20 à 50 comptes de référence.

### 6.3 Pinterest

Pinterest Trends (outil web) exige un compte Business et permet de filtrer par région ; l'aide en ligne ne mentionne pas d'API. L'endpoint documenté trends/keywords de l'API v5 existe dans la référence (page non lisible sans JavaScript dans cet environnement ; régions et conditions non vérifiées ce jour). Pertinent pour la cliente beauté et SEVARTA (visuels, citations), peu pour les églises et l'école.
Source : https://help.pinterest.com/en/business/article/pinterest-trends

---

## 7. Actualités : API, RSS, GDELT

| Source | Accès | Prix (1er octobre 2026) | Couverture CI / CA | Fraîcheur |
|---|---|---|---|---|
| Google News RSS (news.google.com/rss/search?q=…&hl=fr&gl=CI&ceid=CI:fr) | Gratuit, sans clé | 0 | Testé : 50 articles pour « Abidjan événement », sources Africaguinee, Financial Afrik, RFI, BAD ; liens encodés news.google.com/rss/articles/… | Minutes à heures |
| GDELT DOC 2.0 | Gratuit, sans clé | 0 | sourcecountry, sourcelang=french ; 75 résultats par défaut, 250 max ; 3 mois d'historique | Mise à jour toutes les 15 minutes |
| NewsAPI | Clé | Developer gratuit (100 requêtes par jour, articles retardés de 24 h, interdit en production) ; Business 449 USD par mois ; Advanced 1 749 USD | Mondiale | Temps réel en payant |
| Bing News Search | Retirée | Retirée le 11 août 2025 avec toutes les API Bing Search publiques | Néant | Néant |
| Brave Search API | Clé | 5 USD pour 1 000 requêtes, 5 USD de crédit gratuit par mois, résultats news inclus | Mondiale | Heures |
| Abidjan.net | Flux RSS par rubrique (/rss/politique.xml, /rss/economie.xml, Art et Culture, 24 rubriques listées) | 0 | Côte d'Ivoire, rubrique Agenda | Jour |
| Presse locale ontarienne | RSS classique (à inventorier par ville) | 0 | Ontario | Jour |

Sources : https://news.google.com/rss/search?q=Abidjan+%C3%A9v%C3%A9nement&hl=fr&gl=CI&ceid=CI:fr (testé) ; https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/ ; https://newsapi.org/pricing ; https://learn.microsoft.com/en-us/bing/search-apis/ ; https://brave.com/search/api/ ; https://news.abidjan.net/rss

Remarque : l'URL exacte du flux « Art et Culture » d'Abidjan.net n'a pas répondu (404 sur /rss/art-et-culture.xml) ; les noms de fichiers doivent être relevés sur la page /rss qui liste les 24 rubriques. NewsAPI est à écarter (449 USD par mois pour un service que Google News RSS et GDELT rendent gratuitement, avec une couverture ivoirienne au moins équivalente).

---

## 8. Moteurs de recherche pour agents

Ces API servent à deux choses dans la machine : la recherche thématique (« nouveautés skincare peau noire octobre 2026 ») et la « genèse d'un événement » (retrouver origine, dates, organisateur, éditions passées). Prix relevés le 1er octobre 2026 :

| Service | Prix | Gratuit | Points forts | Points faibles |
|---|---|---|---|---|
| Tavily | Search basic 1 crédit, advanced 2 ; extract 1 crédit pour 5 pages ; crawl combiné ; PAYG 0,008 USD par crédit ; Project 30 USD pour 4 000 | 1 000 crédits par mois sans carte | Conçu pour les agents, extraction incluse | Couverture francophone à tester |
| Exa | Instant 4 USD pour 1 000, Fast/Auto 7 USD, Deep 12 USD, Deep-reasoning 15 USD ; contents 1 USD pour 1 000 pages ; résultats au-delà de 10 : 1 USD pour 1 000 | 10 USD de crédit chaque mois | Recherche neuronale, « sites similaires » (concurrents) | Plus cher |
| Perplexity | Search API 5 USD pour 1 000 (mode rapide 1 USD) ; Sonar 1 USD entrée et sortie par million de tokens plus 5 à 12 USD pour 1 000 requêtes ; Sonar Pro 3 et 15 USD | Non précisé | Réponse citée en une requête | Coût par requête élevé pour Sonar Pro |
| Brave | 5 USD pour 1 000, 50 requêtes par seconde ; Answers 4 USD pour 1 000 plus tokens | 5 USD par mois | Index indépendant, news incluses | Pas d'extraction |
| Linkup | Search 5 à 6 USD pour 1 000 ; Fetch 1 à 6 USD ; Research 250 à 2 500 USD pour 1 000 | 4 000 requêtes à l'ouverture | Index incluant presse payante | Moins connu |
| You.com | Web Search 5 USD pour 1 000 (web et news en une requête) ; Contents 1 USD ; Research 12 USD | 100 USD de crédit, puis 100 requêtes par jour | News incluses | Pas de spécificité agent |
| Firecrawl Search | 2 crédits pour 10 résultats ; scrape 1 crédit par page | 1 000 crédits par mois ; Hobby 16 USD pour 5 000 ; Standard 83 USD pour 100 000 | Même outil pour chercher, scraper, suivre les changements | Qualité de recherche inférieure aux moteurs dédiés |

Sources : https://docs.tavily.com/documentation/api-credits ; https://exa.ai/pricing ; https://docs.perplexity.ai/getting-started/pricing ; https://brave.com/search/api/ ; https://www.linkup.so/pricing ; https://you.com/platform/upgrade ; https://www.firecrawl.dev/pricing

Choix recommandé : Tavily comme moteur principal (gratuit jusqu'à 1 000 crédits, soit 500 recherches avancées par mois, largement suffisant pour 6 clients à 2 recherches par jour), Exa en complément pour la découverte de concurrents et de sites similaires, Perplexity Sonar réservé à la rédaction de la « genèse » avec citations.

---

## 9. Surveillance du site du client et des concurrents

Objectif : détecter un nouveau produit (cliente beauté), un nouvel article ou livre (SEVARTA), une annonce d'admission (2IAE), un événement (association), une nouvelle vidéo (église), sans que le client ait à prévenir.

| Outil | Modèle | Prix (1er octobre 2026) | Forces |
|---|---|---|---|
| Crawler maison (Node, sitemap.xml, hash du contenu principal) | Auto-hébergé sur Railway | Coût d'hébergement seulement | Contrôle total, pas de limite, détection des nouveaux URL via sitemap |
| Firecrawl change tracking | API | Inclus (modes basic et git-diff sans surcoût), mode JSON 5 crédits par page ; champs changeStatus new/same/changed/removed, previousScrapeAt | Diff structuré, extraction par schéma (prix, stock) |
| changedetection.io | Open source auto-hébergé, ou hébergé 8,99 USD par mois pour 5 000 URL | Vérification dès 5 minutes, 85 types de notifications, API, filtres CSS et XPath, navigateur Chrome réel | Idéal pour pages dynamiques |
| Visualping | SaaS | Gratuit 150 vérifications par mois (toutes les 60 min) ; 14 USD pour 1 000 (15 min) ; 35 USD pour 5 000 ; 70 USD pour 10 000 ; API REST et serveur MCP | Résumés de changement par IA |

Sources : https://docs.firecrawl.dev/features/change-tracking ; https://changedetection.io/ ; https://visualping.io/pricing

Recommandation : crawler maison pour les sites des clients (ils sont connus, souvent sur WordPress ou Shopify avec sitemap et flux RSS natifs : /feed/ sur WordPress, /collections/all.atom et /products.json sur Shopify), et changedetection.io auto-hébergé sur Railway pour les pages des concurrents et les agendas municipaux rendus en JavaScript.

---

## 10. Découverte d'événements régionaux

| Source | État au 1er octobre 2026 | Usage |
|---|---|---|
| Google Events via SerpApi | Paramètres q, location, htichips date:today/week/month ; renvoie titre, date, adresse, lien, billetterie, lieu avec note ; 1 crédit SerpApi | Requête hebdomadaire « événements Abidjan », « concerts Toronto », « salon beauté Ontario » |
| Eventbrite API v3 | Lecture des événements d'une organisation que l'on gère ; la page de référence est protégée (401) et la recherche publique d'événements n'est plus documentée (retrait annoncé fin 2019, non vérifié en ligne ce jour) | Peu utile sans compte organisateur |
| Meetup | API GraphQL réservée à Meetup Pro | Ontario seulement, coût du plan Pro à vérifier |
| Facebook Events | Événements des Pages tierces via Page Public Content Access (App Review) ; sinon seulement les Pages gérées | Associations ivoiriennes très présentes sur Facebook : la validation vaut la peine |
| Agendas municipaux | Toronto : jeu de données « Festivals & Events » retiré ; le calendrier toronto.ca se charge en JavaScript (scraping navigateur). Abidjan : page /agenda d'Abidjan.net introuvable ce jour (404), rubrique Agenda annoncée dans le menu | changedetection.io avec Chrome |
| Google News RSS | « Abidjan événement » : 50 résultats dont « Abidjan: The Fintech Event », « festival culturel ivoirien » | Détection indirecte par la presse |

Sources : https://serpapi.com/google-events-api ; https://www.meetup.com/api/general/ ; https://open.toronto.ca/dataset/festivals-events/ ; https://www.toronto.ca/explore-enjoy/festivals-events/festivals-events-calendar/

Point d'attention pour la Côte d'Ivoire : RFI rapportait fin juillet 2026 une nouvelle licence obligatoire pour les spectacles, qui fait polémique. Les calendriers d'événements ivoiriens peuvent donc bouger plus que d'habitude ; d'où l'importance de la vérification des faits (section 13).

---

## 11. Calendriers culturels, religieux et civils

| Source | Accès | Couverture | Prix |
|---|---|---|---|
| Nager.Date (API v3) | GET https://date.nager.at/api/v3/PublicHolidays/2026/CI | Côte d'Ivoire : 10 jours renvoyés pour 2026 (1er janvier, lundi de Pâques 6 avril, 1er mai, Ascension 14 mai, lundi de Pentecôte 25 mai, fête nationale 7 août, Assomption 15 août, Toussaint 1er novembre, journée de la Paix 15 novembre, Noël). Les fêtes musulmanes (Tabaski, fin du Ramadan, Maouloud) et la fête du travail ne sont pas toutes présentes : incomplet | 0 |
| canada-holidays.ca (API v1) | https://canada-holidays.ca/api/v1/ (provinces, fédéral, prochains jours fériés, 2013 à 2038) | Canada et Ontario, sources gouvernementales | 0 |
| Calendarific | Clé | 230 pays dont CI et CA, fêtes nationales, locales et religieuses | Gratuit 500 appels par mois ; Starter 100 USD par an ; Business 500 USD par an |
| ONU, journées internationales | Page https://www.un.org/fr/observances/list-days-weeks, HTML structuré par mois | Plus de 180 journées (café 1er octobre, droits de l'homme 10 décembre, migrants 18 décembre) | 0 |
| Calendrier liturgique | À construire : Avent, Noël, Épiphanie, Carême (18 février 2026 était le mercredi des Cendres ; calcul par algorithme de Pâques), Pentecôte, Toussaint ; côté ivoirien, Tabaski et Ramadan (calcul astronomique, confirmation officielle quelques jours avant) | Chrétien et musulman | 0 |

Sources : https://date.nager.at/api/v3/PublicHolidays/2026/CI (testé) ; https://canada-holidays.ca/api ; https://calendarific.com/pricing ; https://www.un.org/fr/observances/list-days-weeks

Recommandation : stocker un calendrier maison par client (table calendar_events avec origine, confiance, source) alimenté par Nager, canada-holidays et le scraping de la page ONU, complété à la main pour les fêtes musulmanes ivoiriennes et les dates propres à chaque vertical (rentrée 2IAE, lancement de livre SEVARTA, fête patronale d'une église). Calendarific n'est utile que si l'on veut 230 pays.

---

## 12. Tendances musicales par pays

| Source | État | Côte d'Ivoire | Canada |
|---|---|---|---|
| TikTok Creative Center, onglet Songs | Scraping (Apify), connexion parfois demandée | À confirmer dans la liste des marchés | Oui |
| Shazam Charts | Page https://www.shazam.com/charts/top-200/cote-d-ivoire avec bouton « Download CSV » ; pas d'API documentée | Oui (numéro 1 ce jour : « STORM II », GENER8ION & Yung Lean) | Oui |
| Spotify Charts | Page charts.spotify.com ; rendu JavaScript, connexion requise pour l'export (non vérifié) | Classement regional-ci à confirmer | Oui |
| YouTube videos.list chart=mostPopular, videoCategoryId=10 (Musique) | API, 1 unité | regionCode=CI | regionCode=CA |

Sources : https://www.shazam.com/charts/top-200/cote-d-ivoire ; https://developers.google.com/youtube/v3/docs/videos/list

Point important : ces sources disent quels sons sont populaires, pas lesquels sont libres de droits pour une marque. Pour un compte Business sur Instagram et TikTok, la bibliothèque de sons commerciaux est restreinte. Le tableau des tendances doit porter un drapeau « usage commercial à vérifier » et la production doit privilégier Suno (déjà utilisé par José) pour les musiques originales, les sons tendance étant réservés aux comptes personnels des dirigeants ou aux reprises d'ambiance.

---

## 13. Architecture de veille par client

### 13.1 Modèle de données

- client : vertical, pays cibles (CI, CA, FR), langues, deux plateformes principales (doctrine des deux plateformes), hashtags de marque, concurrents (5 à 10), comptes de référence, mots-clés (10 à 30), site web et flux.
- source : type (rss, trends_rss, serpapi_trends, serpapi_events, youtube_feed, youtube_chart, gdelt, tavily, apify_tiktok_cc, ig_hashtag, business_discovery, site_crawl, calendar), configuration, fréquence, coût unitaire, dernière exécution, état de santé.
- item : URL canonique, titre, texte, date de publication, source, pays, hash de contenu, empreinte sémantique (embedding), entités extraites (lieu, date, organisateur, produit), score de pertinence, score de fraîcheur, score de tendance, statut (nouveau, dédoublonné, rejeté, retenu, proposé, publié).
- dossier (genèse) : item pivot, sources corroborantes (minimum 2), faits vérifiés avec niveau de confiance, angle proposé par pilier (valeur, relation, promotion), format suggéré (reel, carrousel, texte LinkedIn), fenêtre de publication.

### 13.2 Fréquences

| Famille | Fréquence | Coût marginal |
|---|---|---|
| RSS Trending Now (par pays) | Toutes les 2 heures | 0 |
| Google News RSS (10 requêtes par client) | Toutes les 4 heures | 0 |
| GDELT (3 requêtes par client) | Toutes les 6 heures | 0 |
| Flux Atom YouTube (chaînes suivies) | Toutes les heures | 0 |
| videos.list mostPopular (CI, CA, catégories 10 et 0) | 1 fois par jour | 4 unités |
| search.list YouTube | 2 par client et par jour | 12 des 100 appels quotidiens |
| Crawl du site client | 1 fois par jour (sitemap), ou webhook Shopify/WordPress | 0 |
| changedetection.io (concurrents, agendas) | Toutes les 6 heures | 0 (auto-hébergé) |
| SerpApi Trends (mots-clés) | 1 fois par semaine, 10 requêtes par client | 10 crédits |
| SerpApi Events (2 villes) | 1 fois par semaine, 4 requêtes par client | 4 crédits |
| Apify TikTok Creative Center (hashtags et sons, 3 pays) | 1 fois par jour, partagé | 600 lignes |
| Instagram hashtag (top_media) | 1 fois par jour, 30 hashtags max par compte | 0 (quota 200 par heure) |
| Business Discovery (concurrents) | 1 fois par jour | 0 |
| Tavily, recherche thématique | 2 par client et par jour | 4 crédits |

### 13.3 Pipeline de traitement

1. Collecte : chaque source écrit des items bruts dans Postgres (Railway), avec hash du contenu et URL canonique (suppression des paramètres utm, résolution des liens Google News).
2. Dédoublonnage en deux temps : exact (hash et URL) puis sémantique (embedding, similarité cosinus supérieure à 0,92 dans une fenêtre de 7 jours). Un item dédoublonné renforce le score de l'item pivot au lieu de créer une entrée.
3. Scoring par LLM : un modèle rapide (Claude Haiku 4.5 à 1 USD en entrée et 5 USD en sortie par million de tokens, ou Claude Sonnet 5.5 à 2 et 10 USD, prix du 25 septembre 2026 ; gpt-4o-mini déjà utilisé par José, 0,15 et 0,60 USD par million, prix de 2024, non vérifié ce jour) reçoit le profil du client (mis en cache de prompt) et 20 items par appel, et renvoie une sortie structurée : pertinence (0 à 100), pilier (valeur, relation, promotion), urgence (newsjacking, planifiable, evergreen), risque (sujet sensible, politique, religieux controversé), angle en une phrase. Avec 300 items par jour et par client, soit 15 appels de 6 000 tokens en entrée dont 2 500 en cache, le coût mensuel est d'environ 3 USD par client avec Haiku, 6 USD avec Sonnet 5.5, et moins de 1 USD avec gpt-4o-mini. L'API Batch divise ces chiffres par deux pour tout ce qui n'est pas urgent.
4. Score composite : pertinence × fraîcheur (demi-vie 36 heures pour les tendances, 14 jours pour les événements à venir, infini pour le calendrier) × signal de tendance (approx_traffic, vues, rang Creative Center) × diversité (pénalité si trois sujets similaires sont déjà retenus cette semaine).
5. Genèse automatique pour les items retenus à urgence « newsjacking » ou « événement » : un agent (Claude avec outils web_search et web_fetch, ou Tavily plus Perplexity Sonar) rassemble origine, dates, lieu, organisateur, éditions précédentes, chiffres, puis produit un dossier avec citations (URL et extrait cité par fait).
6. Vérification des faits (voir 13.4).
7. Proposition : le dossier alimente le calendrier éditorial et la planche de propositions envoyée au client, avec les sources visibles.

### 13.4 Vérification des faits : règles dures

- Toute date et tout lieu d'événement doivent être corroborés par au moins deux sources indépendantes, dont une source primaire (site de l'organisateur, page d'événement Facebook de l'organisateur, billetterie, communiqué officiel). Un article de presse seul ne suffit pas.
- Extraction structurée des faits (date de début, date de fin, heure, ville, salle, prix, organisateur) avec un niveau de confiance par champ ; tout champ sous 0,8 bloque la publication automatique et passe au gestionnaire humain.
- Horodatage : chaque fait porte la date de sa vérification ; un événement vérifié il y a plus de 7 jours est revérifié 48 heures avant publication (annulations, changements de salle, licence de spectacle en Côte d'Ivoire).
- Les contenus religieux et politiques (élections, grèves, polémiques) sont marqués « risque » et exclus du newsjacking automatique pour les églises, l'école et SEVARTA, sauf validation humaine explicite.
- Les citations sont conservées avec l'extrait exact et l'URL ; la planche montre « Source : URL » sous chaque fait, ce qui rassure le client et protège l'agence.
- Pour les sermons YouTube, la source est la vidéo elle-même (transcription horodatée) : aucun fait extérieur n'est ajouté sans source.

### 13.5 Newsjacking : délais cibles

| Étape | Délai cible | Moyen |
|---|---|---|
| Apparition d'une tendance dans Trending Now ou GDELT | 0 | Flux rafraîchis toutes les 2 heures (15 minutes possible) |
| Détection, dédoublonnage, scoring | moins de 15 minutes | Cron Railway, LLM rapide |
| Genèse et vérification | moins de 45 minutes | Agent avec recherche web, 2 sources |
| Alerte au gestionnaire (WhatsApp via CallMeBot, déjà en place) avec angle et visuel brouillon | moins de 1 heure | Image statique par gpt-image ou Canva, pas de vidéo |
| Validation humaine et publication | moins de 4 heures pour une tendance, moins de 24 heures pour un événement annoncé | Un clic dans la plateforme |

Les tendances Google Trends vivent souvent moins de 48 heures (sport, actualité) ; les sons TikTok 2 à 4 semaines ; les événements se préparent 2 à 6 semaines avant. Le pipeline doit donc traiter trois rythmes distincts, pas un seul.

---

## 14. Coûts mensuels

### 14.1 Socle partagé (tous clients)

| Poste | Plan | Coût mensuel |
|---|---|---|
| SerpApi | Starter 1 000 recherches (6 clients × 14 par semaine ≈ 360) ou Developer 5 000 | 25 à 75 USD |
| Apify | Starter 19 USD (TikTok Creative Center quotidien, scrapers de secours) | 19 USD |
| Tavily | Gratuit jusqu'à 1 000 crédits, puis Project | 0 à 30 USD |
| Exa | Crédit mensuel de 10 USD | 0 à 10 USD |
| changedetection.io auto-hébergé sur Railway | Service plus Chrome | 5 à 15 USD d'hébergement |
| Postgres, workers de veille sur Railway | Existant | 10 à 20 USD |
| X API (trends par ville) | Pay-per-usage | moins de 2 USD |
| Total socle | | 60 à 170 USD |

### 14.2 Par client

| Profil | Sources | LLM scoring et genèse | Scrapers dédiés | Total par client |
|---|---|---|---|---|
| Léger (église, association) | RSS, Trending Now, YouTube Atom, calendrier, 2 recherches par jour | 3 à 6 USD | 0 | 5 à 10 USD |
| Standard (beauté, SEVARTA, 2IAE) | Léger plus SerpApi, Instagram hashtags, concurrents, crawl du site | 6 à 12 USD | 3 à 8 USD (Apify Instagram ou Facebook) | 12 à 25 USD |
| Intensif (marque avec newsjacking quotidien et 3 pays) | Standard plus X ciblé, Exa, genèse quotidienne avec Sonar | 15 à 30 USD | 10 à 20 USD | 30 à 60 USD |

Avec 6 clients standard : 72 à 150 USD de coûts variables, plus 60 à 170 USD de socle, soit 130 à 320 USD par mois pour toute la veille, loin devant la production vidéo en termes d'économie. La veille n'est pas le poste de coût ; c'est le poste de valeur.

---

## 15. Incertitudes et points à vérifier

1. YouTube : la nouvelle structure de quota (100 appels search.list par jour en seau séparé, 1 unité par recherche) est celle affichée sur la page officielle le 1er octobre 2026 ; vérifier dans la console Google Cloud du projet réel, et demander une extension de quota si la veille YouTube devient centrale.
2. Reddit : conditions et prix (100 requêtes par minute gratuites, 0,24 USD pour 1 000 appels commerciaux, annonce de 2023) non vérifiés en ligne, pages inaccessibles depuis cet environnement.
3. Eventbrite : le retrait de la recherche publique d'événements (fin 2019 de mémoire) n'a pas pu être confirmé, la page de référence renvoie 401.
4. Pinterest : l'endpoint trends/keywords de l'API v5 n'a pas pu être lu (page rendue en JavaScript) ; régions couvertes et conditions d'accès inconnues.
5. TikTok Creative Center : présence de la Côte d'Ivoire dans la liste des marchés à confirmer en ouvrant l'outil connecté ; les listes complètes exigent une connexion TikTok for Business.
6. Instagram : la limite de 30 hashtags par 7 jours est confirmée ; vérifier si « Instagram Public Content Access » est encore accordé facilement en App Review aux agences en 2026 (processus réputé long).
7. Facebook : la fonctionnalité Page Public Content Access exige une vérification d'entreprise ; délai et probabilité d'acceptation pour Markel-Tech à estimer.
8. Google Trends Trending Now RSS : non documenté officiellement, peut disparaître sans préavis ; prévoir SerpApi Trending Now en repli.
9. Nager.Date pour la Côte d'Ivoire omet des jours fériés (fêtes musulmanes, Maouloud, lendemain de la nuit du destin) ; compléter à la main chaque année à partir du décret ivoirien.
10. Prix OpenAI (gpt-4o-mini, gpt-5-nano) : page de prix inaccessible (403) ; chiffres de mémoire, à relire.
11. Spotify Charts : disponibilité d'un classement Côte d'Ivoire et d'un export sans connexion non vérifiée.
12. Abidjan.net : noms exacts des fichiers RSS par rubrique et existence de la page Agenda à relever directement sur https://news.abidjan.net/rss.
13. Légalité du scraping : les conditions de TikTok, Instagram et Facebook interdisent le scraping automatisé ; l'usage interne de données publiques est toléré en pratique mais les comptes liés peuvent être sanctionnés. Décision à prendre avec José : isoler strictement les scrapers (comptes, IP, proxies Apify) des comptes de publication des clients.
14. Glimpse : prix de l'API non publiés, à demander si les volumes absolus de recherche deviennent nécessaires pour la cliente beauté.

---

## 16. Implications pour la machine de José

1. Construire la veille d'abord sur des flux gratuits et stables : Google Trends Trending Now RSS (CI, CA, FR), Google News RSS par requête, GDELT DOC 2.0, flux Atom YouTube par chaîne, flux RSS d'Abidjan.net et des médias ontariens, API Nager et canada-holidays. Cela couvre 70 % du besoin pour 0 USD et ne dépend d'aucune App Review.
2. Prendre un seul abonnement SerpApi (Starter à 25 USD, Developer à 75 USD si plus de 1 000 recherches) et le réserver à trois usages : Google Trends explore (séries et requêtes associées sur les mots-clés de chaque client), Google Events (événements par ville) et Google News structuré. Suivre la consommation par client dans la base.
3. Ne jamais déployer pytrends ni un scraper Google Trends maison sur Railway : les plages d'IP cloud reçoivent des 429.
4. Pour TikTok, lancer chaque jour un seul run Apify du Creative Center pour les trois pays et partager le résultat entre tous les clients ; le coût reste sous 20 USD par mois. Tagger chaque son et hashtag avec son pays et sa date de première apparition pour mesurer la vitesse de montée.
5. Faire la demande Meta App Review dès maintenant pour « Instagram Public Content Access » et « Page Public Content Access » : elles conditionnent la recherche de hashtags, la lecture des Pages concurrentes et des événements Facebook des associations ivoiriennes. En attendant, utiliser Business Discovery (pas d'App Review spécifique au-delà des permissions de base) pour les concurrents Instagram.
6. Respecter la limite de 30 hashtags par 7 jours par compte en l'affichant dans l'interface du client : 10 hashtags de marque, 10 de niche, 10 « exploratoires » renouvelés chaque semaine.
7. Traiter YouTube par flux Atom et PubSubHubbub pour les chaînes des églises : détection en minutes d'un nouveau sermon, sans quota, puis transcription locale plutôt que captions.list (50 unités). Réserver les 100 appels search.list quotidiens aux recherches thématiques.
8. Oublier NewsAPI (449 USD par mois) et Bing News (retirée) ; Google News RSS plus GDELT font mieux pour l'Afrique francophone, gratuitement.
9. Mettre Tavily (1 000 crédits gratuits par mois) comme moteur de l'agent de genèse, avec Exa pour trouver les concurrents et les sites similaires, et Perplexity Sonar en option pour obtenir des réponses déjà citées.
10. Surveiller le site de chaque client par crawler maison (sitemap, flux WordPress ou Shopify) et proposer au client un « dépôt de nouveautés » dans la plateforme : la cliente beauté ajoute un produit, la veille le prend comme item pivot avec priorité maximale ; cela remplace la surveillance par la déclaration quand le client coopère.
11. Héberger changedetection.io sur Railway pour les pages dynamiques (concurrents, calendrier de Toronto, agendas ivoiriens) ; 5 000 URL pour moins de 15 USD d'hébergement.
12. Faire du scoring LLM un service à part avec cache de prompt (profil client stable en tête de prompt) et API Batch pour tout ce qui n'est pas newsjacking : le coût par client descend sous 5 USD par mois.
13. Imposer la règle des deux sources, dont une primaire, pour toute date et tout lieu, et afficher « Source : URL » sous chaque fait dans la planche envoyée au client. C'est l'argument de vente contre les concurrents qui publient des tendances non vérifiées.
14. Construire trois horloges distinctes dans la routine : tendances (cycle de 2 heures, durée de vie 48 heures), sons (hebdomadaire, durée de vie 3 semaines), événements et calendrier (hebdomadaire, horizon 6 semaines, revérification 48 heures avant).
15. Classer automatiquement chaque item par pilier (valeur, relation, promotion) pour alimenter directement la répartition 60/25/15 de la doctrine, et refuser une semaine éditoriale où la veille ne fournit pas au moins 60 % d'items « valeur ».
16. Marquer les sujets politiques et religieux controversés comme « risque » et les sortir du newsjacking automatique pour les églises, SEVARTA et 2IAE : la rapidité ne vaut pas une crise.
17. Tenir un calendrier maison par client avec les fêtes chrétiennes calculées (Pâques, Carême, Avent), les fêtes musulmanes ivoiriennes saisies à la main chaque année, les journées mondiales ONU scrappées, les jours fériés ivoiriens et ontariens, et les dates propres (rentrée, salons beauté, lancements de livres). Générer 8 semaines à l'avance les « moments » à préparer.
18. Isoler les scrapers (comptes, proxies, clés Apify) des comptes de publication des clients, et inscrire dans le contrat client que la veille utilise des données publiques et des outils tiers soumis à leurs conditions.
19. Mesurer la veille elle-même : pour chaque item retenu, enregistrer s'il a été proposé, accepté, publié et sa performance (couche 1 de la doctrine). Après 90 jours, couper les sources qui ne produisent jamais d'item accepté et renforcer celles qui en produisent.
20. Prévoir dès la conception un plan B pour chaque source gratuite non contractuelle (Trending Now RSS, Google News RSS, flux Atom YouTube) : une bascule vers SerpApi ou Apify en un changement de configuration, sans redéploiement.

---

## 17. Sources consultées (pages ouvertes le 1er octobre 2026)

- https://serpapi.com/pricing
- https://serpapi.com/google-trends-api
- https://serpapi.com/google-events-api
- https://developers.google.com/search/blog/2025/07/trends-api
- https://trends.google.com/trending/rss?geo=CI
- https://trends.google.com/trending/rss?geo=CA
- https://github.com/GeneralMills/pytrends/issues/492
- https://dev.to/kyungmin_lee_85c597046ee0/pytrends-is-dead-here-is-how-google-trends-actually-loads-data-in-2026-including-trending-now-3bn
- https://apify.com/emastra/google-trends-scraper
- https://meetglimpse.com/pricing
- https://developers.tiktok.com/products/research-api/
- https://developers.tiktok.com/products/commercial-content-api/
- https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en
- https://apify.com/automation-lab/tiktok-creative-center-scraper
- https://apify.com/clockworks/tiktok-scraper
- https://apify.com/pricing
- https://scrapebadger.com/blog/tiktok-scraping-apis-in-2026-the-complete-deep-guide
- https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-hashtag-search
- https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery
- https://developers.facebook.com/docs/features-reference/page-public-content-access
- https://developers.facebook.com/docs/graph-api/overview/rate-limiting
- https://apify.com/apify/instagram-hashtag-scraper
- https://apify.com/apify/instagram-scraper
- https://apify.com/apify/facebook-posts-scraper
- https://transparency.meta.com/researchtools/meta-content-library/
- https://developers.google.com/youtube/v3/getting-started
- https://developers.google.com/youtube/v3/determine_quota_cost
- https://developers.google.com/youtube/v3/docs/search/list
- https://developers.google.com/youtube/v3/docs/videos/list
- https://www.youtube.com/feeds/videos.xml?channel_id=UCBR8-60-B28hp2BmDPdntcQ
- https://docs.x.com/x-api/getting-started/about-x-api
- https://docs.x.com/x-api/getting-started/pricing
- https://help.pinterest.com/en/business/article/pinterest-trends
- https://news.google.com/rss/search?q=Abidjan+%C3%A9v%C3%A9nement&hl=fr&gl=CI&ceid=CI:fr
- https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/
- https://newsapi.org/pricing
- https://learn.microsoft.com/en-us/bing/search-apis/
- https://learn.microsoft.com/en-us/bing/search-apis/bing-news-search/overview
- https://brave.com/search/api/
- https://news.abidjan.net/
- https://news.abidjan.net/rss
- https://docs.tavily.com/documentation/api-credits
- https://exa.ai/pricing
- https://docs.perplexity.ai/getting-started/pricing
- https://www.linkup.so/pricing
- https://you.com/platform/upgrade
- https://www.firecrawl.dev/pricing
- https://docs.firecrawl.dev/features/change-tracking
- https://changedetection.io/
- https://visualping.io/pricing
- https://www.meetup.com/api/general/
- https://www.eventbrite.com/platform/docs/introduction
- https://open.toronto.ca/dataset/festivals-events/
- https://www.toronto.ca/explore-enjoy/festivals-events/festivals-events-calendar/
- https://date.nager.at/api/v3/PublicHolidays/2026/CI
- https://canada-holidays.ca/api
- https://calendarific.com/pricing
- https://www.un.org/fr/observances/list-days-weeks
- https://www.shazam.com/charts/top-200/cote-d-ivoire
- Prix Anthropic (Haiku 4.5, Sonnet 5.5) : référence interne du skill claude-api, mise en cache le 25 septembre 2026
