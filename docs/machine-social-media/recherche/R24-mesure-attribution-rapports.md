# R24. Mesure en trois couches reliée aux affaires : attribution, liens en bio, rapports clients en marque blanche

Rapport de recherche rédigé le 2 octobre 2026 pour la machine social media multi-clients de José Kouadio (Markel-Tech, SEVARTA, 2IAE). Toutes les pages citées ont été ouvertes les 1er et 2 octobre 2026. Chaque prix, quota et date est celui affiché ce jour-là ; lorsqu'une page officielle n'a pas pu être lue (rendu JavaScript, 403, 404), la valeur vient d'une source secondaire datée et le fait est marqué « à vérifier » puis repris en section 9. Les rapports frères sont cités par leur numéro : R02 (API de publication), R08 (relation agence-client), R09 (playbooks verticaux), R10 (marché local), R11 (qualité et indicateurs « à la page »).

Note de méthode : 15 recherches web distinctes ont été faites, puis le quota de recherche de la session s'est épuisé ; le reste du travail a consisté à ouvrir directement une quarantaine de pages primaires (documentation Meta, Google, LinkedIn, TikTok, pages de prix), dont 35 ont répondu. Le détail des sources est en fin de rapport.

## 1. Résumé exécutif

La doctrine de José mesure en trois couches : indicateurs avancés (portée, envois, enregistrements, visionnage), croissance (abonnés, visites de profil, clics) et affaires (devis, inscriptions, ventes, visiteurs). R08 montre que la question client numéro un en 2026 est « reliez la performance au revenu » (55 % des 494 agences interrogées par AgencyAnalytics, février à avril 2026) et que 10 % des départs de clients sont déjà attribués au flou d'attribution. Aucun outil de reporting du marché ne fait ce lien à la place de l'agence : AgencyAnalytics, Swydo, DashThis ou Metricool assemblent des métriques de plateforme ; le lien entre un Reel et une inscription à 2IAE, une vente SEVARTA ou une commande de crème se construit chez soi, avec quatre briques gratuites ou presque : des liens traçables (UTM, lien en bio maison, QR dynamiques), des événements de conversion renvoyés à Meta (Pixel et Conversions API, y compris pour WhatsApp via `ctwa_clid`), des coupons par client, et une base de mesures tenue à jour chaque nuit.

Quatre faits structurants :

1. **La collecte doit se faire chez soi, tôt et souvent.** Instagram sert ses insights avec jusqu'à 48 h de retard, efface les insights de Stories 24 h après leur création et ne garde que 2 ans ; Facebook limite chaque requête à 90 jours et a retiré le 15 juin 2026 une quarantaine de métriques (toutes les variantes « unique » de portée et de vues vidéo) pour toutes les versions de l'API ; LinkedIn ne sert que 12 mois glissants. Sans relevés quotidiens stockés, le rapport à 90 jours de la doctrine est impossible.
2. **L'attribution coûte 0 $ en licences.** Meta Pixel, Conversions API, GA4 Data API (200 000 jetons par jour et par propriété), webhooks WhatsApp et YouTube Analytics API sont gratuits. Ce qui coûte, c'est le temps de câblage sur le site du client et la discipline des conventions.
3. **Le lien en bio et les QR codes se font maison.** Linktree Pro coûte 15 $ par mois et par profil (analytics 365 jours, pixels GA4 et Meta), Premium 35 $ (export CSV, 0 % de commission) ; Bitly Growth 29 $ par mois pour 500 liens et 10 QR codes. À dix clients, une page maison hébergée sur le domaine de la machine (ou un sous-domaine du client) avec clics horodatés dans Postgres remplace 150 à 350 $ par mois d'abonnements et donne des données brutes.
4. **Le rapport mensuel est un produit, pas un export.** AgencyAnalytics facture 20 $ par client et par mois (annuel) avec marque blanche, portail client et domaine personnalisé inclus ; Swydo 69 € par mois pour 10 sources ; DashThis 44 à 429 $ selon le nombre de tableaux ; Metricool réserve la marque blanche au plan Custom sur devis ; Looker Studio est gratuit (Pro à 9 $ par utilisateur et par projet). Pour six verticales et une dizaine de clients, générer soi-même un PDF d'une page en trois couches, plus un résumé WhatsApp de cinq lignes, est moins cher et surtout plus fidèle à la doctrine (couche affaires au centre).

## 2. Attribution : relier un contenu à un résultat d'affaires

### 2.1 Conventions UTM par client et par post

GA4 reconnaît neuf paramètres : `utm_id`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_source_platform`, `utm_term`, `utm_content`, `utm_creative_format` et `utm_marketing_tactic` ; les deux derniers sont acceptés mais « pas encore reportés » dans l'interface. Source : https://support.google.com/analytics/answer/10917952

Le regroupement de canaux par défaut de GA4 classe en « Organic Social » tout trafic dont la source figure dans sa liste de sites sociaux ou dont le medium vaut `social`, `social-network`, `social-media`, `sm`, `social network` ou `social media` ; en « Paid Social » si la source est sociale et que le medium correspond à `^(.*cp.*|ppc|retargeting|paid.*)$` ; en « Organic Video » si la source est un site vidéo (YouTube, TikTok, Vimeo) ou si le medium contient `video`. Source : https://support.google.com/analytics/answer/9756891

Convention proposée pour la machine, stable d'un client à l'autre et lisible par une personne :

| Paramètre | Règle | Exemple (2IAE, Reel admissions) |
|---|---|---|
| `utm_source` | nom canonique de la plateforme en minuscules : `instagram`, `facebook`, `tiktok`, `youtube`, `linkedin`, `whatsapp`, `qr` | `instagram` |
| `utm_medium` | `social` pour l'organique (classé Organic Social par GA4), `paid-social` pour une publicité, `video` pour YouTube organique, `qr` pour un support imprimé, `whatsapp` pour un Channel ou un Status | `social` |
| `utm_campaign` | `{client}-{aaaa-mm}-{pilier}` où pilier vaut `valeur`, `relation` ou `promo` (les 60/25/15 de la doctrine) | `2iae-2026-10-promo` |
| `utm_content` | identifiant interne du contenu (clé primaire de `content_item`), suffixé par le format : `c12345-reel` | `c12345-reel` |
| `utm_term` | variante de hook ou de visuel quand un même contenu est testé en deux versions | `hook-pas` |
| `utm_id` | identifiant de campagne numérique si le client a un plan média payant ; sinon vide | vide |

Trois règles d'hygiène. Tout lien sortant de la machine passe par un raccourcisseur maison (`go.{domaine}/x7k2`) qui porte les UTM et enregistre le clic côté serveur, de sorte qu'on mesure même quand GA4 n'est pas posé sur le site du client (cas fréquent des églises et des associations). Le lien court est généré au moment de la validation de la planche, jamais à la main. Les UTM ne figurent jamais dans la légende Instagram (lien non cliquable) : ils vivent dans le lien en bio, la Story et le QR.

### 2.2 Meta Pixel et Conversions API

Le Meta Pixel est « un extrait de code JavaScript qui permet de suivre l'activité des visiteurs sur votre site » ; il collecte en-têtes HTTP, informations de navigateur, adresse IP, clics de boutons, identifiant de pixel, cookies Facebook et données optionnelles ; les noms de champs de formulaire sont captés mais « pas les valeurs sauf si vous les incluez via Advanced Matching ». La page ne mentionne aucun prix : le Pixel est gratuit. Source : https://developers.facebook.com/docs/meta-pixel/

La Conversions API (CAPI) « crée une connexion entre les données marketing d'un annonceur » (serveurs, sites, applications, CRM) et Meta, pour l'optimisation et la mesure ; la page d'accueil ne mentionne ni prix ni limite de débit. Source : https://developers.facebook.com/docs/marketing-api/conversions-api/

Points pratiques, vérifiés sur des sources secondaires 2026 (à confirmer dans la doc « API Parameters » de Meta) : score Event Match Quality de 0 à 10, objectif 7 et plus sur tous les événements clés, 8,8 à 9,3 pour Purchase ; l'e-mail haché ajoute jusqu'à 4 points, le téléphone haché 3 ; `fbp` (cookie navigateur) et `fbc` (identifiant de clic) relient l'événement serveur à la session ; la déduplication Pixel + CAPI exige un `event_id` identique des deux côtés. Sources : https://weltpixel.com/blogs/news/meta-event-match-quality-emq-guide ; https://adsuploader.com/blog/meta-conversions-api

Pour la machine : un seul pixel et un seul « dataset » par client, créés dans le Business Manager du client (jamais celui de l'agence, voir R08 sur la propriété des comptes) ; la machine n'envoie par CAPI que les conversions qu'elle constate elle-même (formulaire de devis sur la page lien en bio, inscription 2IAE, commande SEVARTA, échange de coupon, message WhatsApp qualifié), avec `event_id = conversion_event.id` pour que le Pixel du site du client ne compte pas double.

### 2.3 GA4 Data API : quotas et prix

L'API Data de GA4 a quatre familles de quotas (Core, Realtime, Funnel, Chat) ; une requête n'en consomme qu'une. Valeurs pour une propriété standard contre Analytics 360 : 200 000 contre 2 000 000 jetons par jour ; 40 000 contre 400 000 jetons par heure ; 14 000 contre 140 000 jetons par projet et par heure ; 10 contre 50 requêtes simultanées ; 10 contre 50 erreurs serveur par heure. Le coût en jetons « est déterminé au moment de l'exécution » selon le nombre de lignes, de dimensions, de métriques, la complexité des filtres, la plage de dates et le volume d'événements de la propriété ; `returnPropertyQuota: true` renvoie la consommation et le solde. Aucun prix : l'API est gratuite. Source : https://developers.google.com/analytics/devguides/reporting/data/v1/quotas

Point qui compte pour une agence : le quota journalier appartient à la **propriété du client**, pas au projet Cloud de la machine ; tout tableau Looker Studio, script ou connecteur que le client utilise par ailleurs puise dans le même réservoir de 200 000 jetons (constat convergent de Swydo, Piwik PRO et busyless). Une requête quotidienne par client (sessions, utilisateurs, conversions par `sessionSource / sessionMedium / sessionCampaign / sessionManualAdContent` sur la veille) coûte quelques dizaines de jetons : la machine ne risque rien, mais elle doit stocker ses résultats pour ne jamais recalculer un mois entier.

### 2.4 WhatsApp : clics sur publicité et messages entrants

Quand une personne écrit à l'entreprise depuis une publicité « Cliquer pour WhatsApp » (CTWA), le premier message entrant du webhook Cloud API contient un objet `referral` avec l'annonce source (identifiant, titre, texte, média) et un identifiant de clic `ctwa_clid`. Ce `ctwa_clid` n'est présent que sur le premier message de la conversation (source secondaire). Twilio a exposé ce paramètre (`ReferralCtwaClid`) dans son changelog du 15 mars 2024. Sources : https://whapi.cloud/blog/track-click-to-whatsapp-ctwa-clid (mis à jour le 24 avril 2026) ; https://www.twilio.com/en-us/changelog/new--click-id--callback-parameter-for-inbound-whatsapp-messages-

La Conversions API « for Business Messaging » permet ensuite de renvoyer à Meta ce qui s'est passé dans la conversation : `action_source: "business_messaging"`, `messaging_channel: "whatsapp"`, `ctwa_clid` dans `user_data` avec `whatsapp_business_account_id`, `event_name`, `event_time`. Événements supportés : « Purchase, LeadSubmitted, InitiateCheckout, AddToCart, ViewContent, OrderCreated, OrderShipped, OrderDelivered, OrderCanceled, OrderReturned, CartAbandoned, QualifiedLead, RatingProvided, ReviewProvided ». La doc précise que ces événements « ne doivent représenter que des interactions survenues dans le fil de messagerie » et que « Meta n'aide pas à dédupliquer ». Source : https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging/

Pour les messages **organiques** (quelqu'un qui écrit après avoir vu un Status ou un post, sans publicité), il n'y a pas de `referral` : l'attribution se fait par le texte pré-rempli du lien `wa.me/{num}?text=` que la machine génère par contenu (« Bonjour, je vous écris au sujet de la crème Karité [réf. c12345] »), par le coupon cité, ou par une question posée par le gestionnaire. La page de composants des webhooks documente aussi l'objet `statuses` (sent, delivered, read) avec `conversation.origin.type` et `pricing` (`billable`, `pricing_model`, `category`), utile pour compter les conversations ouvertes par la machine et leur coût. Source : https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components/

### 2.5 Page « lien en bio » maison contre Linktree, Beacons, Later

| Outil | Prix (lu le 2 octobre 2026) | Analytics | Limites utiles | Source |
|---|---|---|---|---|
| Linktree Free | 0 $ | total de visites, pas de clics par lien | branding Linktree, 12 % de commission sur les ventes | u2l.ai (1er octobre 2026), page officielle non lisible |
| Linktree Starter | 8 $ par mois (environ 6 à 6,40 $ en annuel) | analytics de base | 9 % de commission | idem |
| Linktree Pro | 15 $ par mois (12 $ en annuel) | clics par lien, taux de clic, pays, appareil, référent ; historique 365 jours ; intégration GA4, Meta Pixel, TikTok Pixel ; URL courtes avec UTM | 9 % de commission | idem ; https://app.unilink.us/blog/linktree-pricing-2026 |
| Linktree Premium | 35 $ par mois (28 à 30 $ en annuel) | export CSV, historique « à vie », tests A/B (source secondaire) | 0 % de commission | idem |
| Beacons Free | 0 $ | analytics « temps réel » | 9 % de commission, 50 e-mails par mois, 30 crédits IA par jour | https://beacons.ai/i/pricing |
| Beacons Creator | 10 $ par mois (8,33 $ en annuel, 100 $ par an) | analytics avancés | 9 % de commission, 500 e-mails, domaine personnalisé | idem |
| Beacons Creator Plus | 30 $ par mois (25 $ en annuel) | analytics avancés + données de media kit | 0 % de commission, e-mails illimités, plusieurs pages | idem |
| Beacons Creator Max | 100 $ par mois (83,33 $ en annuel) | idem | plusieurs domaines, 10 sites, onboarding, carte NFC | idem |
| Later Starter | 18,75 $ par mois en annuel (25 $ en mensuel) | 3 mois d'analytics ; Linkin.bio inclus avec GA et collecte d'e-mails | 1 jeu de 8 profils, 30 posts par profil et par mois | https://later.com/pricing/ |
| Later Growth | 37,50 $ en annuel (50 $ en mensuel) | 1 an d'analytics | 2 jeux, 180 posts par profil | idem |
| Later Scale | 82,50 $ en annuel (110 $ en mensuel) | 2 ans d'analytics, intégration Meta Ads | 6 jeux (48 profils), posts illimités | idem |

Lecture. Linktree Pro, le plan minimal pour avoir des clics par lien et un pixel, coûte 15 $ par profil : 150 $ par mois pour dix clients, 180 $ pour douze, sans accès brut aux clics (export réservé à Premium, 35 $). Later n'a de sens que si on utilise aussi sa planification, ce que R02 exclut (la machine publie elle-même). Beacons vise les créateurs qui vendent des produits numériques.

Page maison, ce qu'elle doit faire pour battre Linktree Pro : une route `/{client}` servie par le site de la machine (ou `bio.{domaine-du-client}` en CNAME), rendue en moins de 200 ms, avec les 3 à 6 liens du moment (dernier produit, inscription, dernier livre, sermon de dimanche, événement) ; chaque bouton pointe sur `go.{domaine}/{code}` qui écrit une ligne `link_click` (horodatage, code, user-agent, pays par IP, référent) puis redirige en 302 avec les UTM ; la page charge le Pixel et GA4 du client avec consentement (bandeau léger ; en Ontario et en France, pas de Pixel avant consentement, voir R08 section juridique) ; un formulaire court (nom, WhatsApp, « je veux : devis / inscription / le livre ») écrit directement dans `conversion_event` et déclenche CAPI avec `event_name: "Lead"`. Les clics par lien, par jour, par pays et par contenu d'origine sont alors dans Postgres, sans limite de rétention. Coût : hébergement déjà payé sur Railway ; un domaine court (environ 10 à 15 $ par an).

### 2.6 Codes QR traçables pour flyers et affiches d'église

Un QR « statique » encode l'URL elle-même : gratuit, permanent, mais non mesurable et non modifiable. Un QR « dynamique » encode une URL courte qui redirige : mesurable (scans, heure, pays, appareil) et modifiable après impression. Prix du marché en 2026 : 5 à 10 $ par mois pour une cinquantaine de codes dynamiques chez les vendeurs sérieux (Scanova, QRLynx, QR Code Stack) ; Bitly : Free 2 QR par mois sans analytics, Core 10 $ par mois (annuel) 5 QR et 30 jours d'historique, Growth 29 $ en annuel ou 35 $ en mensuel pour 10 QR, 500 liens et 120 jours d'historique avec domaine personnalisé, Premium 199 $ en annuel ou 300 $ en mensuel pour 200 QR, 3 000 liens et 1 an ; les scans sont illimités sur tous les plans, seule la création est plafonnée. QR Code Generator (groupe Bitly) : Starter 2 codes dynamiques et 10 000 scans, Advanced 50 codes et 3 000 appels API par mois, Professional 250 codes et 10 000 appels, prix non affichés sans localisation. Sources : https://bitly.com/pages/pricing ; https://www.qr-code-generator.com/pricing/ ; https://scanova.io/blog/qr-codes-cost-guide/

Pour la machine : le QR dynamique est un simple `tracked_link` de type `qr` dont le PNG ou SVG est généré par une bibliothèque Node (`qrcode`) au moment de produire le flyer ; chaque affiche d'église, chaque flyer de rentrée 2IAE, chaque marque-page SEVARTA porte son propre code (`utm_source=qr`, `utm_medium=print`, `utm_content=affiche-eglise-2026-10`). Le scan est un clic comme un autre dans la base, et le coût est nul.

### 2.7 Coupons par client

Le coupon est l'attribution la plus robuste pour les ventes hors ligne et sur WhatsApp, là où ni Pixel ni GA4 ne voient rien : la cliente de la marque de beauté qui commande par message et cite « KARITE10 » attribue sa commande au Reel qui portait ce code. Règles : un code par contenu ou par campagne (jamais un code générique), lisible à voix haute (dictée WhatsApp), valable 14 à 30 jours, saisi par le gestionnaire ou par le client dans un formulaire minuscule (`coupon_redemption`: code, montant, date, canal). Les plateformes de boutique du client (Shopify, WooCommerce, Amazon KDP pour SEVARTA) ont leurs propres codes ; la machine ne gère que le registre et le rapprochement.

## 3. Collecte des insights

### 3.1 Instagram : 48 heures de retard, Stories 24 heures

La référence des insights par média précise : « Les données utilisées pour calculer les métriques peuvent être retardées jusqu'à 48 heures » ; « les métriques sont conservées jusqu'à 2 ans » ; les métriques de Stories ne sont disponibles que 24 heures (sauf ajout en « à la une ») ; « aucune donnée d'insights n'est disponible pour les médias d'un album ». Métriques par type : fil (`comments, likes, profile_activity, profile_visits, reach, reposts, saved, shares, total_interactions, views, facebook_views`) ; Reels (`comments, crossposted_views, facebook_views, ig_reels_avg_watch_time, ig_reels_video_view_total_time, likes, reach, reels_skip_rate, reposts, saved, shares, total_interactions, views`) ; Stories (`facebook_views, follows, link_clicks, navigation, profile_activity, profile_visits, reach, replies, reposts, shares, total_interactions, views`). `impressions` est « déprécié pour les médias créés après le 2 juillet 2024 ». Source : https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-media/insights/

Au niveau du compte : `reach, likes, comments, saves, shares, views, replies, reposts, total_interactions, accounts_engaged, follows_and_unfollows, profile_links_taps, follower_demographics, engaged_audience_demographics` ; période `day` pour les interactions, `lifetime` pour les démographies ; `follower_count` et `online_followers` indisponibles sous 100 abonnés, `online_followers` limité aux 30 derniers jours, démographies limitées aux 45 premières valeurs ; `impressions` de compte « déprécié pour toutes les versions le 21 avril 2025 », remplacé par `views` avec ventilation `follower_type` et `media_product_type`. Source : https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/insights/

Supermetrics ajoute un détail de terrain : les Stories de moins de 5 vues renvoient des zéros, il faut donc relire avant l'expiration pour capter la vraie valeur. Source : https://docs.supermetrics.com/docs/about-instagram-insights-story-reporting-limitations

Conséquences : relever chaque Story à H+6, H+12 et H+23 et garder la dernière valeur non nulle ; relever chaque post du fil et chaque Reel à J+1, J+3, J+7 et J+30 (les valeurs de J+1 sont provisoires à cause des 48 h), puis mensuellement jusqu'à 90 jours ; ne jamais produire un rapport mensuel avant le 3 du mois pour que les deux derniers jours soient consolidés.

### 3.2 Facebook Pages : ce qui a été retiré le 15 juin 2026

La référence officielle dit : « By June 15, 2026, a number of the Page Insights metrics will be deprecated for all API versions. The API returns an invalid metric error when calling any of these metrics. » Les limites restent : 2 ans d'historique, 90 jours par requête (`since`/`until`), mise à jour « une fois toutes les 24 heures » pour la plupart des métriques, données servies seulement aux pages de 100 « j'aime » ou plus ; permissions `read_insights` et `pages_read_engagement` avec un jeton de Page portant la tâche ANALYZE. Source : https://developers.facebook.com/docs/graph-api/reference/page/insights/

Le changelog de la v25.0 (sortie le 18 février 2026) annonçait le détail : 15 métriques Page Insights, 9 métriques Post Insights, 15 métriques Video Insights et 2 métriques Stories retirées « pour toutes les versions à la sortie de la v26.0 » ; remplacements nommés : `page_impressions_unique` par `page_total_media_view_unique` ou `page_media_view` ; `post_impressions_unique` par `post_total_media_view_unique` ou `post_media_view` ; `PAGE_STORY_IMPRESSIONS_BY_STORY_ID` par `STORY_MEDIA_VIEW` ; `PAGE_STORY_IMPRESSIONS_BY_STORY_ID_UNIQUE` par `STORY_TOTAL_MEDIA_VIEW_UNIQUE`. La v26.0 est sortie le 29 juillet 2026 ; son changelog ne parle plus d'insights mais fixe le retrait de la v20.0 au 24 septembre 2026 et de la v21.0 au 21 janvier 2027. Sources : https://developers.facebook.com/docs/graph-api/changelog/version25.0/ ; https://developers.facebook.com/docs/graph-api/changelog/version26.0/

Liste reconstituée (Windsor.ai et Supermetrics, qui l'ont documentée pour leurs connecteurs ; Supermetrics indique que Meta a avancé au 15 juin une échéance prévue au 30 juin) :

| Famille | Retiré le 15 juin 2026 | Remplacement |
|---|---|---|
| Portée de Page | `page_impressions_unique` (unique, payé, viral, non viral) et variantes 7 et 28 jours | `page_total_media_view_unique` (sans ventilation payé/organique) |
| Impressions de posts de Page | `page_posts_impressions` total, unique, payé, unique payé, organique unique, servi organique unique, viral, unique viral, non viral, unique non viral | aucun (sauf `page_media_view` pour le total) |
| Vues vidéo de Page | `page_video_views_unique` | `page_total_media_view_unique` |
| Portée de post | `post_impressions_unique` et variantes payé, fan, organique, viral, non viral | `post_total_media_view_unique` |
| Vues vidéo de post | uniques organiques, payées, totales | `post_total_media_views_unique` (orthographe de Supermetrics, à vérifier) |
| Impressions vidéo | total, unique, payé, organique, viral, fan et leurs variantes uniques (12 métriques) | aucun |
| Stories | impressions totales et uniques | `STORY_MEDIA_VIEW`, `STORY_TOTAL_MEDIA_VIEW_UNIQUE` |

Métriques qui restent (lues dans la référence) : `page_impressions`, `page_post_engagements`, `page_fans`, `page_video_views`, `page_views_total`, `page_daily_follows_unique` et leurs ventilations payé/organique, viral/non viral. Dataslayer note en plus qu'« aucun équivalent direct ne subsiste pour la portée des Reels » ; seul le nombre de lectures reste. Sources : https://windsor.ai/documentation/guide-for-deprecating-metrics-for-facebook-organic-connector-june-15-2026/ ; https://docs.supermetrics.com/docs/facebook-insights-field-changes-june-30-2026 ; https://improvado.io/product-updates/connectors/facebook-pages-metrics-deprecation ; https://support.dataslayer.ai/understanding-upcoming-removal-of-metrics-on-facebook

Conséquence pour la doctrine : la couche « indicateurs avancés » sur Facebook s'appuie désormais sur les **vues** (`page_media_view`, `post_total_media_view_unique`), l'engagement (`page_post_engagements`) et les abonnés (`page_daily_follows_unique`), plus jamais sur « portée organique contre payée ». Le modèle de données doit porter un champ `metric_name` libre et une table de correspondance versionnée, pas des colonnes figées.

### 3.3 LinkedIn : Share Statistics

`GET /rest/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:{id}` renvoie, en organique seulement, `clickCount, commentCount, engagement, impressionCount, likeCount, shareCount, uniqueImpressionsCount` ; sans `timeIntervals` on obtient le cumul « à vie », avec `timeIntervals` (granularité `DAY` ou `MONTH`) une série ; les statistiques par post se demandent avec `shares` ou `ugcPosts` (cumul seulement, pas de série). « L'endpoint ne renvoie des données que sur les 12 derniers mois, fenêtre glissante » ; pas de pagination ; permission `rw_organization_admin` (rôle ADMINISTRATOR sur la page). Version en cours au 2 octobre 2026 : 202609 ; la version 202510 sera retirée le 15 octobre 2026 (R02). Document mis à jour le 28 avril 2026. Source : https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/share-statistics?view=li-lms-2026-06

Cadence : un relevé quotidien de la série `DAY` de la veille au niveau page, et un relevé cumulé par post à J+1, J+7 et J+30. Le champ `likeCount` « peut devenir négatif » (retrait d'un like sur un post sponsorisé) : stocker tel quel, nettoyer au rapport.

### 3.4 YouTube Analytics API : quotas et dimensions

L'API Analytics (`reports.query`) prend `ids` (`channel==MINE`), `startDate`, `endDate`, `metrics`, et en option `dimensions`, `filters`, `maxResults`, `sort` ; jusqu'à 500 identifiants vidéo dans un filtre. Dimensions principales : `day, month, video, country, ageGroup, gender, sharingService, insightTrafficSourceType` (valeurs : ADVERTISING, END_SCREEN, EXT_URL, HASHTAGS, NOTIFICATION, PLAYLIST, RELATED_VIDEO, SHORTS, SUBSCRIBER, YT_CHANNEL, YT_SEARCH, SOUND_PAGE, etc.), `insightPlaybackLocationType`, `deviceType`, et `creatorContentType` (`SHORTS, LIVE_STREAM, VIDEO_ON_DEMAND`, données depuis le 1er janvier 2019). Métriques : `views, engagedViews, estimatedMinutesWatched, averageViewDuration, averageViewPercentage, subscribersGained, subscribersLost, likes, comments, shares, cardClicks, cardClickRate`. Sources : https://developers.google.com/youtube/analytics/reference/reports/query ; https://developers.google.com/youtube/analytics/dimensions ; https://developers.google.com/youtube/analytics/metrics

Quota : la documentation dit seulement que « le serveur évalue chaque requête pour en déterminer le coût » ; le chiffre par défaut n'est pas publié dans la page (il se lit dans la console Google Cloud : à vérifier au moment de créer le projet). Il est distinct du quota de l'API Data v3, dont la page « getting started » lue le 2 octobre 2026 indique « 100 appels `search.list`, 100 appels `videos.insert` et 10 000 unités par jour pour tous les autres endpoints », une requête de liste coûtant « habituellement 1 unité » et une écriture « habituellement 50 unités » ; cette formulation (plafonds séparés pour search et insert) diffère de la grille classique (search à 100 unités) et doit être confirmée. Sources : https://developers.google.com/youtube/analytics/quota ; https://developers.google.com/youtube/v3/getting-started

Pour les églises et SEVARTA : relever chaque jour `views, engagedViews, estimatedMinutesWatched, averageViewPercentage, subscribersGained` par `video` et `creatorContentType`, plus `insightTrafficSourceType` pour savoir si les Shorts (clips de sermon) ramènent vers la vidéo longue (`EXT_URL`, `SHORTS`, `END_SCREEN`).

### 3.5 TikTok Display API

Scopes `user.info.basic` et `video.list` ; `/v2/video/list/` « renvoie une liste paginée des vidéos **publiques** de l'utilisateur », 10 par page par défaut, 20 au maximum ; objet vidéo : `id, create_time, cover_image_url (TTL 6 h), share_url, video_description (150 caractères), duration, height, width, title, embed_html, embed_link, like_count, comment_count, share_count, view_count, is_aigc`. Limites : 600 requêtes par minute et par endpoint (`/v2/user/info/`, `/v2/video/query/`, `/v2/video/list/`), fenêtre glissante d'une minute, erreur 429 `rate_limit_exceeded` ; des plafonds journaliers existent mais ne sont pas publiés (Phyllo, 30 juin 2026). Jeton d'accès 24 h, jeton de rafraîchissement 365 jours (R02). Sources : https://developers.tiktok.com/doc/tiktok-api-v2-video-list ; https://developers.tiktok.com/doc/tiktok-api-v2-video-object ; https://developers.tiktok.com/doc/tiktok-api-v2-rate-limit ; https://www.getphyllo.com/post/tiktok-api-rate-limits-in-2026-quotas-errors-workarounds

Pas de portée, pas de temps de visionnage, pas de démographie par l'API publique : TikTok se mesure en vues, likes, commentaires, partages, et en abonnés (`user.info.stats`, à vérifier). Le champ `is_aigc` mérite d'être stocké : il dit si TikTok a étiqueté la vidéo comme générée par IA (lien avec R11).

### 3.6 Fréquence de collecte

| Source | Cadence | Fenêtre lue | Pourquoi |
|---|---|---|---|
| Instagram Stories | H+6, H+12, H+23 après publication | la Story | expire à 24 h ; zéros sous 5 vues |
| Instagram posts et Reels | J+1, J+3, J+7, J+30, puis mensuel jusqu'à J+90 | le média | retard 48 h ; les partages et enregistrements continuent plusieurs semaines |
| Instagram compte | quotidien à 05 h GMT | la veille (`day`) | `reach`, `views`, `profile_links_taps`, `follows_and_unfollows` |
| Facebook Page | quotidien à 05 h GMT | la veille | mise à jour toutes les 24 h ; 90 jours max par requête |
| Facebook posts | J+1, J+7, J+30 | le post | `post_total_media_view_unique`, engagements |
| LinkedIn page | quotidien | la veille (`DAY`) | 12 mois glissants seulement |
| LinkedIn posts | J+1, J+7, J+30 | le post | cumul seulement |
| YouTube Analytics | quotidien | J-3 à J-1 | données consolidées avec 2 à 3 jours de latence (pratique courante, à vérifier) |
| TikTok | J+1, J+3, J+7, J+30 | les 20 dernières vidéos | pas de série temporelle, on la construit par différence |
| GA4 Data API | quotidien | la veille | 200 000 jetons par jour par propriété, partagés |
| Liens, QR, formulaires, coupons, webhooks WhatsApp | temps réel | événement | ce sont nos propres tables |

Un relevé = une ligne `metric_snapshot` (jamais une mise à jour en place), ce qui permet de tracer les corrections de Meta et de calculer les vitesses (vues à J+1 contre J+7).

### 3.7 Schéma de stockage chez soi

Trois principes : grain unitaire (une ligne par entité, par métrique, par jour de relevé), noms de métriques bruts de la plateforme (pas de traduction à l'écriture), et clés d'attribution portées par le contenu (`content_item.id` dans `utm_content`, dans le lien court, dans le QR, dans le coupon, dans le texte WhatsApp). Le modèle complet est en section 7.

## 4. Rapport mensuel en marque blanche

### 4.1 Ce que facturent les outils

| Outil | Prix lu le 2 octobre 2026 | Marque blanche | Ce qu'on paie en plus | Source |
|---|---|---|---|---|
| AgencyAnalytics « Core » | 20 $ par client et par mois en annuel (« roughly 25 $ » en mensuel selon des sources secondaires) ; USD, CAD, EUR acceptés | incluse : portail client, domaine, e-mails, logo | sources, rapports, tableaux et comptes staff illimités ; 85 intégrations ; alertes et anomalies ; « AgencyAI » ; benchmarks ; « accès MCP (ChatGPT et Claude) » ; add-ons AI Tracker 20,83 $ par mois pour 250 crédits et Rank Tracker 41,67 $ pour 500 mots-clés ; tarif volume dès 25 clients | https://agencyanalytics.com/pricing |
| Swydo | 69 € par mois (62 € en annuel) pour 10 sources ; 4,50 € par source de 11 à 100, 3 € de 101 à 500, 2 € au-delà | incluse sur tous les plans, domaine personnalisé | portail client, 4 000 crédits IA par mois (environ 95 par résumé), essai 14 jours | https://www.swydo.com/pricing/ |
| DashThis | Individual 44 $ (3 tableaux), Professional 139 $ (10), Business 279 $ (25), Standard 429 $ (50), affichés avec « économisez 120 à 840 $ par an » (prix annuels ; sources secondaires : 49, 159, 309, 479 $ en mensuel) | incluse sur tous les plans : logo, domaine, expéditeur e-mail | utilisateurs et intégrations illimités ; 15 à 100 sources selon le plan | https://dashthis.com/pricing/ |
| Metricool | Free 0 € (1 marque, 30 jours de données) ; Starter 16 à 29 € (5 à 10 marques) ; Advanced 43 à 130 € (15 à 50 marques, connecteur Looker Studio, Zapier et Make) ; Custom sur devis | **Custom seulement** | rapports PDF/PPT automatiques dès Starter ; jusqu'à 24 % de remise en annuel | https://metricool.com/pricing/ |
| Looker Studio | gratuit ; Pro 9 $ par utilisateur et par projet et par mois (page de prix Google introuvable le 2 octobre, chiffre repris de Mammoth, 25 septembre 2026) | « marque blanche » = thème et logo, pas de portail | connecteurs Google gratuits ; connecteurs tiers (Meta, LinkedIn, TikTok) payants chez Supermetrics, Windsor, Dataslayer ; quotas GA4 partagés | https://mammoth.io/blog/looker-studio-pricing/ |

Lecture pour José. À 10 clients : AgencyAnalytics 200 $ par mois (2 400 $ par an), Swydo environ 69 € plus 30 sources supplémentaires (10 clients × 4 sources = 40 sources, soit 69 + 30 × 4,50 = 204 € par mois), DashThis Professional 139 $ (10 tableaux, un par client), Metricool Custom non chiffré. Tous rendent des métriques de plateforme ; aucun ne connaît les inscriptions à 2IAE ni les coupons SEVARTA sans câblage supplémentaire (webhooks, Google Sheets ou API). Le rapport maison coûte un gabarit HTML rendu en PDF (Puppeteer sur Railway) et un prompt de rédaction (5 à 15 $ de LLM par mois pour tous les clients, R08). AgencyAnalytics garde un intérêt précis : ses benchmarks et son accès MCP, si José veut un jour vendre du reporting publicitaire (Google Ads, Meta Ads) qu'il ne collecte pas lui-même.

### 4.2 Structure du rapport d'une page (R08 et R10)

R08 recommande « trois couches, cinq chiffres maximum par couche, une phrase de décision par chiffre, et une section ce que nous avons appris et ce que nous changeons » ; R10 ajoute un résumé WhatsApp de cinq lignes, les trois meilleures publications en vignette, livraison le premier lundi du mois avant 9 h heure du client. Gabarit :

1. **En-tête** : logo du client (marque blanche), mois, période comparée (mois précédent et même mois de l'année précédente), note de confiance (« données Instagram consolidées au 3 du mois »).
2. **Couche affaires (en premier, en gros)** : 3 à 5 chiffres propres à la verticale, chacun avec sa source d'attribution (lien, QR, coupon, WhatsApp, GA4) et sa variation.
3. **Couche croissance** : abonnés nets par plateforme, visites de profil, clics vers le lien en bio, messages entrants, portée mensuelle (vues uniques là où elles existent encore).
4. **Couche indicateurs avancés** : envois par portée, enregistrements par portée, taux de visionnage complet ou `averageViewPercentage`, `reels_skip_rate`, taux d'engagement comparé à la médiane de la verticale (section 6), avec une pastille « au-dessus / sous la médiane ».
5. **Trois meilleures publications** (vignette, chiffre clé, pourquoi ça a marché) et une qui a échoué (sans honte, avec la leçon).
6. **Indicateurs « à la page »** (section 5) : délai tendance vers publication, taux de nouveautés exploitées, taux de vidéos, sermons réemployés.
7. **Ce que nous changeons** : trois décisions pour le mois suivant, et l'état du plan à 90 jours.

### 4.3 Un exemple par verticale

| Verticale | Chiffres de la couche affaires | D'où ils viennent |
|---|---|---|
| Marque de beauté (Abidjan) | commandes attribuées (coupon + WhatsApp CTWA + lien boutique) : 37 ; panier moyen ; produits nouveaux vendus dans les 30 jours de leur mise en avant : 3 sur 4 | `coupon_redemption`, `conversion_event` (CAPI business_messaging), `link_click` vers la boutique |
| Association culturelle | inscriptions à l'événement du mois via lien : 142 ; billets scannés depuis l'affiche : 58 ; nouveaux membres : 9 | formulaire lien en bio, QR affiche, registre des membres |
| Église | nouveaux visiteurs ayant cité un clip ou scanné le QR du flyer : 11 ; demandes de prière reçues via WhatsApp : 24 ; dons en ligne attribués : montant | QR flyer, `wa.me` pré-rempli, lien de don avec UTM |
| SEVARTA (édition) | livres vendus avec code ou lien : 63 ; inscrits à la liste auteur : 120 ; demandes d'auteurs reçues : 4 | lien court vers KDP ou boutique, formulaire, coupon |
| 2IAE (école) | demandes d'information : 48 ; dossiers d'admission commencés : 19, finalisés : 7 ; visites de campus réservées : 12 | GA4 (événements du site 2iae.com), formulaire lien en bio, WhatsApp |
| Markel-Tech (B2B, LinkedIn) | demandes de devis : 6 ; rendez-vous de découverte : 4 ; valeur du pipeline : montant ; clics vers le site depuis LinkedIn : 310 | `clickCount` LinkedIn, GA4 (`sessionSource=linkedin`), CRM (Zoho) |

Pour 2IAE, la session du site peut ajouter les événements GA4 `generate_lead`, `begin_application` et `submit_application` sur www.2iae.com (la session du campus n'est pas concernée) ; la machine les lira par la Data API avec `sessionManualAdContent` pour retrouver le `content_item`.

## 5. Indicateurs « à la page » (R11) : calcul depuis la base

R11 définit quatre indicateurs qui répondent nommément aux reproches des anciens clients. Formules sur le modèle de la section 7 :

**Délai tendance vers publication** (objectif : moins de 72 h pour une nouveauté produit, moins de 48 h pour un événement) :

```sql
select c.client_id,
       percentile_cont(0.5) within group (order by extract(epoch from (p.published_at - s.detected_at))/3600) as delai_median_h,
       avg(extract(epoch from (p.published_at - s.detected_at))/3600) as delai_moyen_h
from signal s
join content_item c on c.signal_id = s.id
join publication p on p.content_item_id = c.id and p.status = 'published'
where s.detected_at >= date_trunc('month', now() - interval '1 month')
  and s.detected_at <  date_trunc('month', now())
group by c.client_id;
```

**Taux de nouveautés exploitées** (objectif 100 % sous 14 jours) :

```sql
select s.client_id,
       count(*) filter (where exists (
         select 1 from content_item c join publication p on p.content_item_id = c.id
         where c.signal_id = s.id and p.status = 'published'
           and p.published_at <= s.detected_at + interval '14 days')) * 100.0 / count(*) as taux_exploite
from signal s
where s.kind in ('product_new', 'site_update', 'event')
  and s.detected_at between date_trunc('month', now() - interval '1 month') and date_trunc('month', now())
group by s.client_id;
```

**Taux de vidéos** : part des publications du mois dont `format in ('reel','short','tiktok','video')`, par client, comparée à l'objectif de la verticale (R09 : 4 vidéos courtes par semaine en beauté et pour une école).

**Sermons réemployés** (églises, SEVARTA pour les auteurs qui prêchent) : pour chaque `source_asset` de type `sermon` déposé ou détecté sur YouTube dans le mois, nombre de `content_item` dérivés (clips, highlights, citations) publiés ; indicateur = part des sermons avec au moins 3 dérivés publiés sous 7 jours, et nombre moyen de dérivés par sermon.

```sql
select a.client_id,
       count(*) filter (where d.n >= 3) * 100.0 / count(*) as taux_sermons_reemployes,
       avg(coalesce(d.n, 0)) as derives_par_sermon
from source_asset a
left join lateral (
  select count(*) as n from content_item c join publication p on p.content_item_id = c.id
  where c.source_asset_id = a.id and p.status = 'published'
    and p.published_at <= a.created_at + interval '7 days') d on true
where a.kind = 'sermon' and a.created_at >= date_trunc('month', now() - interval '1 month')
group by a.client_id;
```

À ces quatre, ajouter les deux indicateurs de preuve que R11 place en tête de la couche avancée : **envois par portée** (`shares / reach`) et **enregistrements par portée** (`saved / reach`), calculés sur le dernier relevé disponible de chaque média (J+7 pour le rapport mensuel, J+30 pour le trimestriel).

## 6. Benchmarks par verticale et par pays

### 6.1 Ce que publient Socialinsider et Rival IQ

Socialinsider (rapport du 16 janvier 2026, 70 millions de posts, janvier 2024 à décembre 2025, marques internationales) : la page lue le 2 octobre 2026 affiche TikTok 3,73 % (+49 % sur un an), Instagram 0,48 % (-4 %), Facebook 0,15 % (stable), X 0,12 % (-20 %), avec la mention que « les valeurs 2025 sont présentées comme benchmarks 2026 » faute de données suffisantes ; R09, qui a lu la même page le 1er octobre, a noté TikTok 2,60 % (-10 %) : l'écart est signalé en section 9. Pas de ventilation par industrie sur cette page ; LinkedIn fait l'objet d'un rapport séparé du 16 mars 2026 (moyenne 5,20 %, documents natifs 7,00 %, R09). La page propose un téléchargement du rapport et une « Social Media Data Integration » ; l'accès API est un add-on à 100 $ par mois sur tous les plans (Adapt 82 $ par mois ou 990 $ par an, 20 profils, 3 mois d'historique ; Optimize 124 $ ou 1 488 $ par an, 30 profils, 6 mois ; Predict 199 $ ou 2 388 $ par an, 40 profils, 12 mois ; exports illimités partout). Sources : https://www.socialinsider.io/social-media-benchmarks ; https://www.socialinsider.io/pricing

Rival IQ (rapport du 25 février 2025, aucune édition 2026 au 2 octobre 2026) : enseignement supérieur « plus de quatre fois la médiane » sur Instagram et TikTok, organisations sans but lucratif au-dessus de la médiane partout et deuxièmes sur TikTok, santé et beauté « l'engagement le plus bas sur toutes les plateformes » ; baisse générale sur un an (Instagram -16 %, Facebook -36 %, TikTok -34 %, X -48 %). Benchmarks « live » sur 30 jours (R09) : soin de la peau 0,12 % pour 11 posts par semaine ; enseignement supérieur 0,73 % pour 15,1 posts ; organisations sans but lucratif 0,22 % sur Instagram, 0,06 à 0,07 % sur Facebook, 32,7 posts par semaine. Prix : Drive 239 $ par mois (203,15 $ en annuel), 10 entreprises suivies, 6 mois ; Engage 349 $ (296,65 $), 20 entreprises, 12 mois ; Engage Pro 559 $ (475,15 $), 40 entreprises, 24 mois, « API disponible en add-on » ; exports CSV, PowerPoint, PDF, PNG sur tous les plans. Sources : https://www.rivaliq.com/blog/social-media-industry-benchmark-report/ ; https://www.rivaliq.com/pricing/ ; https://www.rivaliq.com/live-benchmarks/skincare/ ; https://www.rivaliq.com/live-benchmarks/higher-education/ ; https://www.rivaliq.com/live-benchmarks/nonprofits-industry-benchmarks/

Ni l'un ni l'autre ne publie d'API gratuite ni d'export public des benchmarks : les pages « live » de Rival IQ sont lisibles et peuvent être relevées par un crawl mensuel respectueux (une page par verticale), les rapports annuels sont des PDF ou des pages blog. Aucun des deux ne ventile par pays d'Afrique de l'Ouest ni par le Canada francophone.

### 6.2 Table de seuils à encoder (version initiale, à réviser chaque trimestre)

Le taux d'engagement se calcule de façon uniforme : `(likes + comments + shares + saved) / followers` par post pour Instagram, Facebook et TikTok (convention Socialinsider), `engagement` tel que renvoyé par LinkedIn (interactions sur impressions, à ne pas mélanger). Les seuils ci-dessous sont des médianes de référence pour l'alerte « sous la médiane » ; ils se recalculent dès qu'un rapport 2026 par industrie paraît.

| Verticale | Instagram | TikTok | Facebook | LinkedIn | YouTube (Shorts) | Base de départ |
|---|---|---|---|---|---|---|
| Beauté (produits) | 0,12 % (live Rival IQ, soin de la peau) ; alerte sous 0,10 % | 2,6 à 3,7 % toutes industries (Socialinsider) ; beauté sous la médiane : seuil 1,5 % | 0,02 % image, 0,13 % vidéo (live Rival IQ) | n. a. | `averageViewPercentage` 60 % sur Shorts (objectif interne) | R09 |
| Association culturelle | 0,22 % (nonprofits live) | médiane + : seuil 3 % | 0,06 à 0,07 % | n. a. | idem | R09 |
| Église | assimilée aux nonprofits : 0,22 % ; viser 0,5 % (public affectif) | 3 % | 0,10 % | n. a. | sermons : `averageViewDuration` et `subscribersGained` par vidéo | R09, extrapolation |
| Édition chrétienne (SEVARTA) | assimilée aux médias et à la religion : 0,25 % (extrapolation) | 2,6 % | 0,10 % | 4 % (auteurs sur LinkedIn) | idem | extrapolation, à vérifier |
| École supérieure (2IAE) | 0,73 % (live) ; 2,92 à 3,02 % pour les universités américaines (Rival IQ, août 2024) | 3,69 à 4,75 % (idem) | 0,24 à 0,40 % | 4 % | idem | R09 |
| Agence B2B (Markel-Tech) | 0,3 % | n. a. | 0,10 % | 5,20 % (moyenne Socialinsider mars 2026) ; documents 7,00 %, multi-images 6,45 %, vidéo 6,00 %, lien 3,25 % | n. a. | R09 |

Ajustement par pays : aucune source de benchmark publique ne distingue la Côte d'Ivoire du Canada. La machine construit donc sa propre médiane locale après trois mois : pour chaque verticale et chaque pays du client, la médiane glissante des 90 derniers jours de ses propres comptes et des comptes concurrents suivis (R06 veille). L'alerte « sous la médiane » se déclenche si le taux du mois est inférieur à la fois au seuil encodé et à la médiane locale, deux mois de suite (évite les faux positifs d'un mois creux comme le Ramadan ou juillet-août).

## 7. Modèle de données des mesures

Postgres sur Railway, Drizzle. Les tables de contenu (`client`, `content_item`, `publication`) existent dans le reste de la machine ; ne sont détaillées ici que les tables de mesure et d'attribution et les clés qui les relient.

```sql
-- Comptes sociaux du client (une ligne par plateforme)
create table social_account (
  id bigserial primary key,
  client_id bigint not null references client(id),
  platform text not null check (platform in ('instagram','facebook','tiktok','youtube','linkedin','whatsapp','threads','x')),
  external_id text not null,            -- ig user id, page id, channel id, org urn
  handle text,
  country text,                          -- 'CI', 'CA', 'FR'
  token_ref text,                        -- référence du secret (jamais le jeton)
  api_version text,                      -- 'v26.0', '202609'
  active boolean not null default true,
  unique (platform, external_id)
);

-- Relevés au niveau du compte, grain jour, append-only
create table account_metric_daily (
  id bigserial primary key,
  social_account_id bigint not null references social_account(id),
  metric_name text not null,             -- nom brut de la plateforme : 'reach', 'views', 'page_media_view', 'impressionCount'
  day date not null,
  value numeric not null,
  breakdown jsonb,                       -- {follower_type:'non_follower'} ou {creatorContentType:'SHORTS'}
  fetched_at timestamptz not null default now(),
  unique (social_account_id, metric_name, day, breakdown, fetched_at)
);

-- Relevés au niveau du média, append-only (J+1, J+3, J+7, J+30, J+90)
create table media_metric_snapshot (
  id bigserial primary key,
  publication_id bigint not null references publication(id),
  metric_name text not null,             -- 'views','reach','saved','shares','reels_skip_rate','clickCount','view_count'
  value numeric not null,
  age_hours integer not null,            -- heures depuis la publication au moment du relevé
  fetched_at timestamptz not null default now()
);
create index on media_metric_snapshot (publication_id, metric_name, age_hours);

-- Table de correspondance versionnée des noms de métriques (gère le 15 juin 2026)
create table metric_alias (
  platform text not null,
  canonical text not null,               -- 'views_unique', 'engagements', 'followers_net'
  metric_name text not null,             -- nom brut servi par l'API
  valid_from date not null,
  valid_to date,
  primary key (platform, metric_name, valid_from)
);

-- Liens traçables : lien en bio, QR, Story, WhatsApp
create table tracked_link (
  id bigserial primary key,
  client_id bigint not null references client(id),
  content_item_id bigint references content_item(id),
  code text not null unique,             -- 'x7k2'
  kind text not null check (kind in ('bio','story','qr','whatsapp','email','print','other')),
  destination_url text not null,
  utm jsonb not null,                    -- {source, medium, campaign, content, term}
  qr_svg text,                           -- rendu du code quand kind = 'qr'
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table link_click (
  id bigserial primary key,
  tracked_link_id bigint not null references tracked_link(id),
  clicked_at timestamptz not null default now(),
  country text, device text, referer text,
  visitor_hash text                      -- hash salé IP + UA, rotation quotidienne, pas d'IP en clair
);
create index on link_click (tracked_link_id, clicked_at);

-- Événements d'affaires (la couche 3)
create table conversion_event (
  id uuid primary key default gen_random_uuid(),   -- sert d'event_id CAPI
  client_id bigint not null references client(id),
  kind text not null,                    -- 'lead','quote_request','application_started','application_submitted','purchase','booking','visit','donation','member_join'
  value numeric, currency text,          -- 'XOF', 'CAD', 'EUR'
  occurred_at timestamptz not null,
  source text not null,                  -- 'bio_form','ga4','whatsapp_ctwa','whatsapp_organic','coupon','qr','crm','manual'
  content_item_id bigint references content_item(id),
  tracked_link_id bigint references tracked_link(id),
  ctwa_clid text,                        -- présent si origine publicité CTWA
  ga4_session_key text,                  -- source/medium/campaign/content de GA4
  sent_to_capi_at timestamptz,
  notes text
);
create index on conversion_event (client_id, occurred_at);

-- Coupons
create table coupon (
  code text primary key,
  client_id bigint not null references client(id),
  content_item_id bigint references content_item(id),
  discount text, valid_from date, valid_to date
);
create table coupon_redemption (
  id bigserial primary key,
  code text not null references coupon(code),
  conversion_event_id uuid references conversion_event(id),
  amount numeric, redeemed_at timestamptz not null default now(), channel text
);

-- Conversations WhatsApp entrantes (attribution et réactivité)
create table whatsapp_inbound (
  id bigserial primary key,
  client_id bigint not null references client(id),
  wa_message_id text unique,
  from_hash text not null,               -- numéro haché
  received_at timestamptz not null,
  referral jsonb,                        -- objet referral du webhook si CTWA
  ctwa_clid text,
  matched_content_item_id bigint references content_item(id),  -- via texte pré-rempli ou coupon cité
  first_reply_at timestamptz             -- pour le délai de réponse (R08)
);

-- Signaux de veille (pour les indicateurs « à la page »)
create table signal (
  id bigserial primary key,
  client_id bigint not null references client(id),
  kind text not null,                    -- 'trend','product_new','site_update','event','sermon'
  detected_at timestamptz not null,
  payload jsonb
);
-- content_item porte signal_id et source_asset_id (clips dérivés d'un sermon)

-- Benchmarks encodés
create table benchmark (
  id bigserial primary key,
  vertical text not null, platform text not null, country text, -- country null = global
  metric text not null,                  -- 'engagement_rate_by_followers'
  median numeric not null, source text not null, as_of date not null
);

-- Rapports produits
create table monthly_report (
  id bigserial primary key,
  client_id bigint not null references client(id),
  period date not null,                  -- premier jour du mois
  generated_at timestamptz not null,
  pdf_ref text, whatsapp_summary text,
  payload jsonb not null,                -- les chiffres figés des trois couches
  unique (client_id, period)
);
```

Volumétrie : un client à 25 publications par mois sur 4 plateformes, 5 relevés par média et 12 métriques par relevé produit environ 6 000 lignes `media_metric_snapshot` par mois ; 4 comptes × 15 métriques × 30 jours font 1 800 lignes `account_metric_daily`. À 20 clients, 160 000 lignes par mois, soit quelques dizaines de Mo par an : négligeable pour le Postgres de Railway.

Confidentialité : `link_click.visitor_hash` et `whatsapp_inbound.from_hash` sont des hachés salés ; aucune IP ni aucun numéro en clair ; les données de la Côte d'Ivoire, de l'Ontario et de la France relèvent de régimes différents (R08), et la base ne stocke rien que le client ne pourrait pas lire.

## 8. Coût mensuel de la collecte par client

| Poste | Coût par client et par mois | Note |
|---|---|---|
| API Meta (Instagram, Facebook, WhatsApp webhooks, CAPI) | 0 $ | gratuites ; coût caché : revue d'app et jetons à rafraîchir (R02) |
| GA4 Data API | 0 $ | 200 000 jetons par jour par propriété, partagés avec le client |
| YouTube Analytics API | 0 $ | quota par projet, non publié |
| LinkedIn Community Management API | 0 $ | accès partenaire à obtenir (R02) |
| TikTok Display API | 0 $ | audit client requis (R02) |
| Postgres Railway (part de la base) | 0,10 à 0,50 $ | quelques dizaines de Mo par client et par an |
| Tâches planifiées (collecte, rendu PDF Puppeteer) | 0,20 à 1 $ | part du service Railway |
| LLM pour la rédaction du rapport et des décisions | 0,50 à 1,50 $ | R08 : 5 à 15 $ par mois tous clients confondus |
| Envoi WhatsApp du rapport et des alertes | 0,02 à 0,10 $ | messages utilitaires 0,004 $ en Afrique, 0,0034 $ au Canada (R10) ; 5 à 25 messages par mois |
| Lien en bio et QR maison | 0 $ | domaine court 10 à 15 $ par an pour toute l'agence |
| **Total maison** | **environ 1 à 3 $** | contre 15 $ (Linktree Pro) + 20 $ (AgencyAnalytics) + 3 $ (Bitly Growth réparti) = 38 $ par client avec des outils tiers |
| Option benchmarks Socialinsider Adapt + API | 182 $ par mois pour l'agence, soit 18 $ par client à 10 clients | utile seulement si José veut vendre la comparaison aux concurrents (R06) |

## 9. Incertitudes et points à vérifier

1. **Linktree** : la page officielle de prix est rendue en JavaScript et n'a pas pu être lue ; les 8, 15 et 35 $ mensuels (6 à 6,40 $, 12 $, 28 à 30 $ en annuel) viennent de trois sources secondaires concordantes datées de mai à octobre 2026 ; les commissions 12 / 9 / 9 / 0 % et le détail des analytics (365 jours sur Pro, export CSV et A/B sur Premium) sont à confirmer sur linktr.ee/s/pricing, qui affiche des prix « par région en monnaie locale ».
2. **Liste exacte des métriques Facebook retirées le 15 juin 2026** : la page officielle renvoie vers une sous-page de « deprecating metrics » et un billet de blog qui n'ont pas été ouverts ; la liste de la section 3.2 est reconstituée à partir de Windsor.ai, Supermetrics, Improvado et Dataslayer. L'orthographe `post_total_media_views_unique` (Supermetrics) contre `post_total_media_view_unique` (changelog v25.0) doit être testée sur l'API.
3. **Socialinsider TikTok** : 3,73 % (+49 %) lu le 2 octobre contre 2,60 % (-10 %) lu par R09 le 1er octobre sur la même page ; l'un des deux relevés est une erreur de lecture ou la page a changé. Relire avant d'encoder le seuil.
4. **YouTube Analytics API** : le quota par défaut n'est pas écrit dans la documentation ; la formulation nouvelle de la page Data API (« 100 appels search.list, 100 appels videos.insert, 10 000 unités ») doit être confirmée dans la console Cloud au moment de créer le projet.
5. **DashThis** : la page de prix affichait 44, 139, 279 et 429 $ avec des mentions « économisez X $ par an », ce qui laisse penser à des prix annuels ; les sources secondaires donnent 49, 159, 309 et 479 $ en mensuel ; à relire avec un sélecteur mensuel/annuel.
6. **Swydo** : la page lue affiche des euros (69 €) ; des sources secondaires affichent des dollars (69 $) ; la devise dépend probablement de la localisation.
7. **Looker Studio Pro** : la page de prix Google a répondu 404 ; les 9 $ par utilisateur et par projet viennent d'une source secondaire du 25 septembre 2026.
8. **`ctwa_clid` seulement sur le premier message** : affirmé par des sources secondaires ; la page officielle des composants de webhook n'a pas rendu l'objet `referral`.
9. **Event Match Quality** : les cibles (7 et plus, 8,8 à 9,3 pour Purchase) sont celles de guides d'intégrateurs, pas de Meta.
10. **TikTok `user.info.stats`** (abonnés, likes totaux, nombre de vidéos) : scope cité par des sources secondaires, non vérifié dans la page « get started » qui ne mentionne que `user.info.basic` et `video.list`.
11. **Benchmarks par pays** : aucune source publique ne distingue la Côte d'Ivoire ni le Canada francophone ; les seuils « église » et « édition chrétienne » de la section 6.2 sont des extrapolations à partir des nonprofits et des médias.
12. **Latence YouTube Analytics** (2 à 3 jours) et **Metricool Custom** (prix) : non chiffrés par les pages officielles.
13. **Rival IQ 2026** : pas de rapport par industrie 2026 au 2 octobre ; les lectures sectorielles datent du 25 février 2025.

## 10. Implications pour la machine de José

1. **Mettre la couche affaires en haut du rapport, dès le premier mois.** C'est la demande numéro un des clients (55 %, R08) et la seule chose qu'aucun outil du marché ne fait à la place de l'agence. Même avec des chiffres petits (« 3 demandes de devis, 1 inscription »), le client voit le lien.
2. **Générer tout lien sortant depuis la machine, jamais à la main.** Un `tracked_link` par contenu et par support (bio, Story, QR, WhatsApp), avec la convention UTM de la section 2.1 : c'est le fil qui relie un Reel à une inscription dans GA4 et dans la base.
3. **Construire la page lien en bio maison plutôt que payer Linktree Pro.** 15 $ par profil et par mois sans export brut contre une route sur le site de la machine et des clics dans Postgres ; le client garde son domaine et ses données s'il part (argument de confiance, R08).
4. **Faire des QR dynamiques maison pour les églises et les associations.** Flyers, affiches, marque-pages : un code par support, scan = clic en base, coût nul, modifiable après impression.
5. **Instrumenter WhatsApp comme un canal d'attribution.** Stocker l'objet `referral` et le `ctwa_clid` des conversations issues de publicités, renvoyer `Lead`, `QualifiedLead` et `Purchase` par Conversions API « business_messaging », et pré-remplir les liens `wa.me` avec la référence du contenu pour les conversations organiques.
6. **Un coupon par contenu promotionnel, lisible à voix haute.** C'est l'attribution qui marche à Abidjan, où la commande se fait par message et où le Pixel ne voit rien.
7. **Collecter chaque nuit et conserver chez soi, en append-only.** Instagram retarde de 48 h et efface à 2 ans, les Stories meurent à 24 h, Facebook limite à 90 jours par requête, LinkedIn à 12 mois : la revue à 90 jours de la doctrine n'existe que si la machine a ses propres relevés (section 3.6).
8. **Relever les Stories trois fois avant 24 h** et ne clore un mois qu'au 3 du mois suivant ; livrer le rapport le premier lundi du mois seulement si ce lundi tombe après le 3, sinon le lundi suivant (ajustement de la règle de R10).
9. **Ne jamais figer les noms de métriques dans le schéma.** Le 15 juin 2026 a retiré une quarantaine de métriques Facebook ; `metric_alias` versionnée et `metric_name` libre permettent d'absorber la prochaine vague sans migration.
10. **Abandonner « portée organique contre payée » sur Facebook** et parler de vues (`page_media_view`, `post_total_media_view_unique`), d'engagements et d'abonnés nets ; aligner le gabarit de rapport sur ce vocabulaire, qui est aussi celui de l'application Meta Business Suite que le client regarde.
11. **Mesurer les Shorts de sermons avec `creatorContentType=SHORTS` et `insightTrafficSourceType`.** Le rapport de l'église doit montrer si les clips ramènent vers le message complet (sources SHORTS, END_SCREEN, EXT_URL) et combien d'abonnés chaque sermon a gagnés.
12. **Produire le rapport soi-même (PDF d'une page + résumé WhatsApp de cinq lignes)** et garder AgencyAnalytics (20 $ par client) en option seulement si José vend un jour du reporting publicitaire ; Metricool n'offre la marque blanche que sur devis, Looker Studio est gratuit mais n'a ni portail ni couche affaires.
13. **Encoder les benchmarks par verticale (section 6.2), puis les remplacer par la médiane locale après trois mois.** Aucune source ne couvre la Côte d'Ivoire ni le Canada francophone : la machine devient sa propre source de benchmarks, ce qui est aussi un argument commercial (R06).
14. **Déclencher l'alerte « sous la médiane » seulement deux mois de suite** et à la fois sous le seuil de verticale et sous la médiane locale : un mois creux (Ramadan, été) ne doit pas effrayer le client.
15. **Calculer les quatre indicateurs « à la page » depuis `signal`, `source_asset` et `publication`** (section 5) et les afficher dans le rapport : ce sont les réponses chiffrées aux reproches qui ont fait partir les anciens clients.
16. **Faire poser Pixel + CAPI dans le Business Manager du client, avec consentement**, et n'envoyer par CAPI que les conversions constatées par la machine avec `event_id = conversion_event.id`. En Ontario et en France, pas de Pixel avant consentement (R08).
17. **Pour 2IAE, demander à la session du site d'ajouter trois événements GA4** (`generate_lead`, `begin_application`, `submit_application`) sur www.2iae.com ; la machine les lit par la Data API avec `sessionManualAdContent` et les relie au contenu. Le campus n'est pas concerné.
18. **Budgéter 1 à 3 $ par client et par mois pour la mesure** (section 8) et le dire dans le contrat : la mesure n'est pas une option payante, c'est ce qui retient le client.
19. **Réviser la table des seuils chaque trimestre** à partir des pages « live » de Rival IQ et du prochain rapport Socialinsider, et consigner la source et la date dans `benchmark.as_of` : un benchmark sans date est une opinion.
20. **Tenir un test automatique hebdomadaire de collecte** (une requête par plateforme sur un compte de test) qui échoue bruyamment dès qu'une métrique renvoie « invalid metric » : c'est ainsi que le 15 juin 2026 aurait été détecté le jour même.

## Sources consultées

Attribution et plateformes
- https://support.google.com/analytics/answer/10917952
- https://support.google.com/analytics/answer/9756891
- https://developers.google.com/analytics/devguides/reporting/data/v1/quotas
- https://developers.facebook.com/docs/meta-pixel/
- https://developers.facebook.com/docs/marketing-api/conversions-api/
- https://developers.facebook.com/docs/marketing-api/conversions-api/business-messaging/
- https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components/
- https://whapi.cloud/blog/track-click-to-whatsapp-ctwa-clid
- https://www.twilio.com/en-us/changelog/new--click-id--callback-parameter-for-inbound-whatsapp-messages-
- https://weltpixel.com/blogs/news/meta-event-match-quality-emq-guide
- https://adsuploader.com/blog/meta-conversions-api

Liens en bio, QR, raccourcisseurs
- https://u2l.ai/blog/linktree-pricing
- https://app.unilink.us/blog/linktree-pricing-2026
- https://beacons.ai/i/pricing
- https://later.com/pricing/
- https://bitly.com/pages/pricing
- https://www.qr-code-generator.com/pricing/
- https://scanova.io/blog/qr-codes-cost-guide/

Collecte des insights
- https://developers.facebook.com/docs/graph-api/reference/page/insights/
- https://developers.facebook.com/docs/graph-api/changelog/version25.0/
- https://developers.facebook.com/docs/graph-api/changelog/version26.0/
- https://windsor.ai/documentation/guide-for-deprecating-metrics-for-facebook-organic-connector-june-15-2026/
- https://docs.supermetrics.com/docs/facebook-insights-field-changes-june-30-2026
- https://improvado.io/product-updates/connectors/facebook-pages-metrics-deprecation
- https://support.dataslayer.ai/understanding-upcoming-removal-of-metrics-on-facebook
- https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-media/insights/
- https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/insights/
- https://docs.supermetrics.com/docs/about-instagram-insights-story-reporting-limitations
- https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/share-statistics?view=li-lms-2026-06
- https://developers.google.com/youtube/analytics/reference/reports/query
- https://developers.google.com/youtube/analytics/dimensions
- https://developers.google.com/youtube/analytics/metrics
- https://developers.google.com/youtube/analytics/quota
- https://developers.google.com/youtube/v3/getting-started
- https://developers.tiktok.com/doc/tiktok-api-v2-video-list
- https://developers.tiktok.com/doc/tiktok-api-v2-video-object
- https://developers.tiktok.com/doc/tiktok-api-v2-rate-limit
- https://www.getphyllo.com/post/tiktok-api-rate-limits-in-2026-quotas-errors-workarounds

Rapports en marque blanche
- https://agencyanalytics.com/pricing
- https://www.swydo.com/pricing/
- https://dashthis.com/pricing/
- https://metricool.com/pricing/
- https://mammoth.io/blog/looker-studio-pricing/

Benchmarks
- https://www.socialinsider.io/social-media-benchmarks
- https://www.socialinsider.io/pricing
- https://www.rivaliq.com/blog/social-media-industry-benchmark-report/
- https://www.rivaliq.com/pricing/
- https://www.rivaliq.com/live-benchmarks/skincare/ (via R09)
- https://www.rivaliq.com/live-benchmarks/higher-education/ (via R09)
- https://www.rivaliq.com/live-benchmarks/nonprofits-industry-benchmarks/ (via R09)

Rapports frères réutilisés : R02 (API et jetons), R08 (enquête AgencyAnalytics 2026, structure du rapport), R09 (benchmarks par verticale), R10 (coût WhatsApp, livraison du rapport), R11 (indicateurs « à la page »).
