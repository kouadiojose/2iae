# R02. API de publication, de lecture et d'analytics des plateformes sociales (état au 1er octobre 2026)

Rapport de recherche pour la machine social media multi-clients de José Kouadio (Markel-Tech, SEVARTA, 2IAE). Toutes les valeurs sont datées. Quand une donnée n'a pas pu être confirmée sur une page primaire, elle est marquée « à vérifier » et reprise dans la section Incertitudes.

Méthode : 27 recherches web, une trentaine de pages ouvertes (documentation officielle Meta, TikTok, Google, LinkedIn/Microsoft Learn, X, Pinterest ; pages de prix des API unifiées ; articles datés 2026). Les pages de prix de X (docs.x.com/x-api/pricing, developer.x.com) ont refusé l'accès (404 et 402) : les prix X viennent de trois sources secondaires concordantes datées de 2026.

---

## 1. Synthèse en dix lignes

1. Publier par API sur Facebook, Instagram et Threads est possible et gratuit, mais exige une App Review Meta (délai constaté jusqu'à 20 jours en 2026) et une vérification d'entreprise, sauf si les utilisateurs ont un rôle sur l'app.
2. Instagram : 100 publications API par 24 h, carrousel limité à 10 éléments par API (20 dans l'app), médias servis depuis une URL publique, pas de planification native.
3. TikTok : sans audit, toute publication est forcée en SELF_ONLY (privée) ; l'audit impose une interface stricte (choix de confidentialité sans valeur par défaut, aperçu, divulgation commerciale).
4. YouTube : depuis le 1er juin 2026, l'upload a son propre quota (100 appels par jour à 1 unité), séparé des 10 000 unités quotidiennes ; les projets non audités créés après le 28 juillet 2020 uploadent en privé uniquement.
5. LinkedIn : publier sur une page entreprise passe par la Community Management API (niveau Development puis Standard sur screencast), permission w_organization_social ; limites non publiées.
6. X : plus de palier Free, Basic ni Pro pour les nouveaux comptes ; paiement à l'usage, 0,015 $ par post (0,20 $ avec lien), 0,005 $ par lecture.
7. WhatsApp Channels et Status : aucune API officielle de publication. Snapchat : API partenaire fermée. Google Business Profile : posts via l'API legacy v4, accès sur demande.
8. Les API unifiées (Ayrshare, Zernio ex-Late, Upload-Post, Blotato, Postiz, Post Bridge, SocialBu, Metricool) portent les revues d'application à votre place ; prix de 0 à 599 $ par mois selon le volume de profils.
9. Les solutions auto-hébergées (Postiz open source, Mixpost 299 $ une fois) ramènent la revue d'application chez vous : elles n'enlèvent pas la charge réglementaire.
10. Un outil d'agence doit prévoir OAuth par client, chiffrement des jetons, rafraîchissement avant expiration (60 jours chez Meta), détection de déconnexion, et un repli manuel « paquet prêt à publier ».

---

## 2. Meta : Facebook Pages, Instagram, Threads

### 2.1 Procédure d'accès commune (App Review, vérification d'entreprise, jetons)

- **Quand l'App Review est inutile** : « If your app will only be used by app users who have a role on the app itself, App Review is not required. » Pour une agence qui ne gère que ses propres pages et celles de quelques clients acceptant d'être ajoutés comme testeurs sur l'app, on peut démarrer sans revue. Mais chaque client doit alors avoir un compte développeur Meta et accepter un rôle, ce qui ne tient pas à l'échelle. Source : https://developers.facebook.com/docs/app-review/
- **Advanced Access** : les permissions de publication (pages_manage_posts, instagram_content_publish, threads_content_publish) exigent l'App Review plus la Business Verification dès que l'app sert des utilisateurs sans rôle. Depuis le 1er février 2023, « if your app requires advanced level access to permissions, you might need to complete Business Verification ». Source : https://developers.facebook.com/docs/development/release/business-verification
- **Délai constaté en 2026** : Meta annonce désormais jusqu'à 20 jours par décision (4 à 6 jours en janvier-mars 2026, 9 à 12 en avril, 17 à 19 en mai, 20 depuis). Chaque rejet relance un cycle complet. Source : https://bundle.social/blog/meta-app-review-20-days
- **Dossier à fournir** : screencast montrant la connexion depuis une page publique, la fenêtre de consentement OAuth, la fonctionnalité qui utilise chaque permission et la réponse API ; identifiants de test fonctionnels sans 2FA ni blocage géographique ; texte précis du type « nous demandons [permission] pour que l'utilisateur puisse [action], visible à 01:15 ». Cause principale de rejet : permissions demandées sans fonctionnalité démontrée. Même source.
- **Jetons** : jeton utilisateur long (Facebook Login) et jeton Instagram long valables 60 jours ; le jeton Instagram se rafraîchit via `GET graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token` à condition d'avoir au moins 24 h et de ne pas être expiré ; un jeton expiré ne se rafraîchit pas, l'utilisateur doit se reconnecter. Un jeton de Page dérivé d'un jeton utilisateur long n'expire pas. Sources : https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token/ et https://www.upload-post.com/facebook-graph-api/

### 2.2 Facebook Pages (Graph API v25.0)

| Fonction | Endpoint et conditions (2026) | Source |
|---|---|---|
| Post texte, lien, photo | `POST /{page-id}/feed`, `/photos` ; permissions pages_show_list, pages_read_engagement, pages_manage_posts ; jeton de Page avec tâche CREATE_CONTENT | https://developers.facebook.com/docs/video-api/guides/publishing/ |
| Programmation | `published=false` + `scheduled_publish_time` (timestamp Unix) ; fenêtre 10 minutes à 30 jours pour le fil, 10 minutes à 6 mois pour les vidéos (à vérifier sur la doc Meta, valeur relayée par posteverywhere.ai) | https://posteverywhere.ai/blog/post-to-facebook-api |
| Vidéo | Resumable Upload API en trois étapes (start, upload vers rupload.facebook.com, finish) puis `POST /{page-id}/videos` avec le file handle | https://developers.facebook.com/docs/video-api/guides/publishing/ |
| Reels | `POST /{page-id}/video_reels` ; 3 à 90 s, 9:16, 1080×1920 recommandé (540×960 minimum), H.264/H.265, 24 à 60 fps, AAC 128 kbps ; `scheduled_publish_time` entre 10 minutes et 29 jours ; **30 Reels publiés par API par 24 h glissantes** | https://developers.facebook.com/docs/video-api/guides/reels-publishing/ |
| Stories | `POST /{page-id}/photo_stories` (photo_id) et `/video_stories` (video_id, upload_phase=finish) ; photo 10 Mo max (PNG 1 Mo conseillé), vidéo MP4 9:16, 3 à 90 s mais une story vidéo ne dépasse pas 60 s ; un média déjà publié ailleurs est refusé ; pas de planification documentée | https://developers.facebook.com/docs/page-stories-api/ |
| Insights | `GET /{page-id}/insights` avec read_insights et pages_read_engagement ; fenêtre maximale 90 jours par requête, historique 2 ans ; **au 15 juin 2026, plusieurs métriques sont retirées pour toutes les versions** (page_impressions_unique, post_impressions, page_video_views_unique) ; restent page_impressions, page_post_engagements, page_fans, page_views_total, page_video_views | https://developers.facebook.com/docs/graph-api/reference/page/insights/ |
| Commentaires et Messenger | lecture et réponse aux commentaires via pages_manage_engagement ; Messenger via pages_messaging (fenêtre 24 h) | https://developers.facebook.com/docs/app-review/ (liste des permissions) |

### 2.3 Instagram (Content Publishing API, Instagram API avec Instagram Login ou Facebook Login)

- **Deux voies d'accès** : Instagram Login (permissions instagram_business_basic + instagram_business_content_publish, pas besoin de Page Facebook) ou Facebook Login (instagram_basic + instagram_content_publish + pages_read_engagement, et ads_management/ads_read si le rôle vient d'un Business Manager). Source : https://developers.facebook.com/docs/instagram-platform/content-publishing/
- **Modèle en conteneurs** : créer un conteneur (`POST /{ig-id}/media`), attendre son statut FINISHED, puis `POST /{ig-id}/media_publish`. Les carrousels créent un conteneur par enfant puis un conteneur parent. Même source.
- **Limite de volume** : « Instagram accounts are limited to 100 API-published posts within a 24-hour moving period » ; un carrousel compte pour un. Contrôle en temps réel par `GET /{ig-id}/content_publishing_limit`. Même source.
- **Carrousel** : 2 à 10 éléments par API, images ou vidéos (pas de Reels comme enfants), alors que l'application accepte 20 diapositives depuis 2024. Sources : doc ci-dessus et https://postpost.ai/articles/instagram-carousel-limit
- **URL publique obligatoire** : « media must be hosted on a publicly accessible server ». Le média est téléchargé par Meta, pas poussé par vous (sauf upload résumable de vidéos via rupload.facebook.com). Conséquence : la machine doit exposer ses rendus sur un bucket public (ou une URL signée longue durée) avant de publier.
- **Formats** (référence ig-user/media, consultée le 1er octobre 2026) :
  - Image : JPEG, 8 Mo, ratio 4:5 à 1.91:1, largeur 320 à 1440 px, sRGB.
  - Reels : 3 s à 15 min, MOV ou MP4, 9:16 recommandé, HEVC ou H.264, 23 à 60 fps, 25 Mbps max, taille maximale 300 Mo d'après la page lue (d'autres sources parlent de 1 Go : à vérifier).
  - Stories : image JPEG 8 Mo ; vidéo MOV/MP4 100 Mo, 3 à 60 s, 9:16 ; expirent après 24 h.
  - Paramètres utiles : `share_to_feed`, `cover_url`, `thumb_offset`, `collaborators` (3 max), `location_id`, `user_tags`, `product_tags` (5 max), `alt_text`.
  Source : https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/
- **Planification** : aucune. L'API publie immédiatement ; c'est votre ordonnanceur qui tient le calendrier. Un conteneur vidéo reste valable 24 h après création (à vérifier).
- **Insights par média** : likes, comments, shares, saved, reach, views, total_interactions ; pour les Reels ig_reels_avg_watch_time, ig_reels_video_view_total_time, reels_skip_rate (abandon avant 3 s), crossposted_views ; pour les Stories navigation (exit, forward, back), link_clicks, profile_visits, follows, replies (0 pour l'Europe et le Japon). **impressions est déprécié pour tout média créé après le 2 juillet 2024.** Données en retard jusqu'à 48 h, conservées 2 ans, stories lisibles 24 h seulement, pas d'insights sur les albums. Source : https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-media/insights/
- **Messagerie et commentaires** : Messaging API avec instagram_business_basic + instagram_business_manage_messages ; votre app ne peut écrire qu'après un message entrant, fenêtre de 24 h, tag humain pour prolonger ; textes, liens, 10 images max, audio, vidéo 25 Mo, PDF ; les demandes inactives 30 jours disparaissent ; webhooks messages, messaging_optins, messaging_postbacks, messaging_reactions, messaging_seen. Les commentaires se lisent et se modèrent avec instagram_business_manage_comments (réponse privée possible). Source : https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/

### 2.4 Threads API

- Permissions threads_basic + threads_content_publish, threads_manage_replies, threads_manage_insights, threads_delete, threads_location_tagging.
- **250 posts par 24 h glissantes**, 1 000 réponses, 100 suppressions, 500 recherches de lieu ; contrôle via `/threads_publishing_limit`.
- Texte 500 caractères ; image JPEG/PNG 8 Mo, largeur 320 à 1440 px ; vidéo MP4/MOV, H.264 ou HEVC, 5 min max, 1 Go ; carrousel 2 à 20 éléments. Même logique de conteneurs qu'Instagram, même exigence d'URL publique, mêmes jetons 60 jours.
- Source : https://developers.facebook.com/documentation/threads/overview

---

## 3. TikTok Content Posting API

- **Deux modes** : Direct Post (scope video.publish, publication immédiate dans le profil) et Upload (scope video.upload, envoi dans la boîte de réception du créateur qui termine la publication dans l'app). Source : https://developers.tiktok.com/doc/content-posting-api-get-started/ (page datée du 4 août 2026)
- **Audit obligatoire** : « All content posted by unaudited clients will be restricted to private viewing mode. » Un client non audité ne peut produire que du SELF_ONLY, et la page des guidelines fixe un plafond de 5 publications par 24 h pour les comptes non audités (une source secondaire parle de 5 utilisateurs par 24 h : à vérifier, les deux formulations circulent). Source : https://developers.tiktok.com/doc/content-sharing-guidelines/
- **Exigences UX contrôlées à l'audit** : afficher le pseudonyme du créateur ; menu déroulant de confidentialité sans valeur par défaut (PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, FOLLOWER_OF_CREATOR, SELF_ONLY, et seulement les options renvoyées par creator_info/query) ; cases commentaires, duet, stitch décochées par défaut ; bascule « divulgation de contenu commercial » éteinte par défaut avec les options Your Brand et Branded Content ; mention « By posting, you agree to TikTok's Music Usage Confirmation » ; aperçu obligatoire du contenu ; avertissement que le traitement prend quelques minutes. Même source. En clair : une « machine » entièrement automatique qui publie sur TikTok sans qu'un humain choisisse la confidentialité à chaque post est contraire aux règles de l'audit. Il faut un écran de validation par post.
- **Champs** : title 2 200 caractères UTF-16 (hashtags et mentions acceptés), privacy_level obligatoire, disable_duet, disable_stitch, disable_comment, brand_content_toggle, brand_organic_toggle, **is_aigc** (étiquette contenu généré par IA), video_cover_timestamp_ms ; source_info FILE_UPLOAD (envoi par morceaux) ou PULL_FROM_URL (**le domaine d'origine doit être vérifié** dans le portail développeur). Formats video/mp4, video/quicktime, video/webm. Source : https://developers.tiktok.com/doc/content-posting-api-reference-direct-post/
- **Quotas** : 6 requêtes par minute par jeton utilisateur ; plafond quotidien de posts par utilisateur et quota d'utilisateurs actifs par app ; en pratique environ 15 publications par jour par créateur, toutes apps confondues. Sources : page ci-dessus et https://www.ayrshare.com/docs/apis/post/social-networks/tiktok
- **Photos** : jusqu'à 35 images par post, JPEG ou WebP (PNG refusé par TikTok selon Ayrshare), 20 Mo par image. Source : https://www.ayrshare.com/docs/apis/post/social-networks/tiktok
- **Durée vidéo** : l'exemple de la doc Get Started traite une vidéo de 300 s ; la limite réelle dépend du compte (jusqu'à 10 min pour la plupart) : à vérifier via creator_info/query qui renvoie max_video_post_duration_sec.
- **Jetons** : jeton d'accès 24 h, jeton de rafraîchissement 365 jours ; Ayrshare constate qu'un compte TikTok doit être réautorisé chaque année.
- **Commentaires** : **aucun endpoint public de lecture ou de modération des commentaires organiques** dans le Content Posting API ou le Display API. Les endpoints comment_list et comment_post existent dans l'API Business (publicités) et dans la Research API (académique). Un outil d'agence ne peut donc pas répondre aux commentaires TikTok par API officielle. Sources : https://business-api.tiktok.com/portal/docs/reply-to-a-comment/v1.3 et https://www.rapidevelopers.com/api-automations/how-to-automate-tiktok-comment-moderation-using-the-api
- **Analytics** : le Display API donne les compteurs publics d'une vidéo (vues, likes, commentaires, partages) avec video.list ; pas de rétention ni de démographie.

---

## 4. YouTube Data API v3 et Analytics API

- **Quota** : 10 000 unités par jour pour l'ensemble des endpoints, sauf deux buckets séparés : `search.list` 100 appels par jour et `videos.insert` 100 appels par jour, chacun à 1 unité. videos.list, channels.list, playlistItems.list, commentThreads.list coûtent 1 unité. Source (page consultée, mise à jour 15 septembre 2026) : https://developers.google.com/youtube/v3/determine_quota_cost
- **Historique daté** : videos.insert coûtait environ 1 600 unités (6 uploads par jour au mieux) ; coût ramené à environ 100 le 4 décembre 2025, puis bucket séparé depuis le 1er juin 2026. Source : https://www.socialcrawl.dev/blog/youtube-data-api-2026 et https://postproxy.dev/blog/youtube-upload-api-guide/
- **Vidéos privées sans audit** : toute vidéo envoyée par videos.insert depuis un projet non vérifié créé après le 28 juillet 2020 est verrouillée en privé ; l'appel réussit, le créateur reçoit un courriel. Pour lever la restriction : audit de conformité des YouTube API Services (description de l'app, démonstration, gestion des données), 2 à 4 semaines selon les retours terrain. Sources : https://www.outstand.so/blog/youtube-api-pricing-quota et https://postproxy.dev/blog/youtube-upload-api-guide/
- **Politique** : « you must not automate or trigger views, uploads, comments, likes... without the user's prior specific and express consent ». Un upload lancé par la machine doit reposer sur un consentement explicite du client, consigné. Source : https://developers.google.com/youtube/terms/developer-policies
- **Shorts** : pas de drapeau API ; une vidéo verticale de 60 s ou moins (9:16, 1080×1920) avec #Shorts dans le titre ou la description est traitée comme un Short. Source : https://postproxy.dev/blog/youtube-upload-api-guide/
- **Planification** : `status.privacyStatus = private` + `status.publishAt` (ISO 8601). Même source.
- **Lecture des commentaires** : commentThreads.list (1 unité), réponse via comments.insert (50 unités).
- **Analytics** : YouTube Analytics API (reports.query) avec scope yt-analytics.readonly : views, estimatedMinutesWatched, averageViewDuration, subscribersGained, dimensions géographiques et démographiques ; YouTube Reporting API pour les rapports de masse. Source : https://developers.google.com/youtube/analytics
- **Découpage de sermons** : télécharger la vidéo source d'un client passe par ses droits (le propriétaire de la chaîne exporte, ou autorise l'app). L'API ne donne pas le fichier vidéo ; il faut le fichier d'origine ou un export YouTube Studio. Point à cadrer avec les églises clientes.

---

## 5. LinkedIn (Marketing Developer Platform, Community Management API)

- **Produit** : Community Management API, « vetted product » à deux niveaux : Development Tier (volume limité, 500 requêtes par jour par app et 100 par membre après relèvement) puis Standard Tier, obtenu en soumettant un screencast démontrant chaque cas d'usage du formulaire. Demander le Development Tier uniquement sur une app neuve sans autre produit. Source (page mise à jour 15 mai 2026) : https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview
- **Permissions** : w_organization_social (publier, commenter, aimer au nom d'une organisation ; le membre doit être ADMINISTRATOR, CONTENT_ADMIN ou DIRECT_SPONSORED_CONTENT_POSTER de la page), r_organization_social (lecture), w_member_social (profil personnel), r_member_social **fermé** (« We're not accepting access requests at this time »). Source : https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-04
- **Posts API** (`POST /rest/posts`, en-têtes LinkedIn-Version: YYYYMM et X-Restli-Protocol-Version: 2.0.0) : texte, image, vidéo, document (PDF), article (champs titre, description, vignette fournis, pas de scraping), multi-image (organique), sondage (organique) ; **carrousel organique non supporté** (sponsorisé seulement). Pas de champ de planification : `lifecycleState` accepte uniquement PUBLISHED à la création. Mentions `@[Nom](urn:li:organization:id)` et hashtags en commentaire. Versioning mensuel : la version 202510 est retirée le 15 octobre 2026 ; il faut suivre les versions. Même source.
- **Limites de débit** : « Standard rate limits are not published in documentation » ; elles se lisent dans l'onglet Analytics du portail développeur, par app et par endpoint ; réinitialisation à minuit UTC ; courriel à 75 % du quota. Source : https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/rate-limits
- **Analytics** : Follower Statistics, Page Statistics, Share Statistics, Social Metadata (réactions, commentaires), Video Analytics (watch time, vues, spectateurs) pour les organisations ; équivalents membres. Commentaires via Comments API et Reactions API. Source : page overview citée.
- **Jetons** : jeton d'accès 60 jours ; jeton de rafraîchissement programmatique 365 jours réservé aux apps approuvées (à vérifier pour votre app ; sinon reconnexion tous les 60 jours).
- **Délai d'accès** : 1 à 4 semaines selon les retours 2026. Source : https://www.getphyllo.com/post/linkedin-api-access-in-2026-partner-program-approval-timeline-alternatives

---

## 6. X (ex-Twitter) API v2

- **Paliers 2026** : plus de Free, Basic ni Pro pour les nouveaux inscrits depuis février 2026 ; paiement à l'usage par crédits : **0,015 $ par post créé, 0,20 $ si le post contient un lien (depuis avril 2026), 0,005 $ par post lu**, plafond de 2 millions de lectures par mois avant Enterprise (une source dit 3 millions : à vérifier). Les abonnés Basic (200 $/mois) ont été migrés après le 1er juin 2026 ; Pro (5 000 $/mois) déprécié, migration automatique après le 1er septembre 2026. Enterprise à partir d'environ 42 000 $/mois. Sources : https://postproxy.dev/blog/x-api-pricing-2026/ , https://www.outstand.so/blog/x-api-pricing , https://www.socialcrawl.dev/blog/x-twitter-api-2026
- **Limites de débit** (indépendantes de la facturation) : `POST /2/tweets` 100 par 15 min par utilisateur, 10 000 par 24 h par app ; `GET /2/tweets` 3 500 par app et 5 000 par utilisateur par 15 min. Source : https://docs.x.com/x-api/fundamentals/rate-limits
- **Ordre de grandeur pour une agence** : 6 clients × 20 posts par mois avec lien = 120 × 0,20 $ = 24 $/mois ; la lecture des mentions et réponses coûte vite plus cher que l'écriture. X n'est pas une plateforme prioritaire pour les verticales de José (beauté, églises, édition), sauf Markel-Tech B2B.

---

## 7. Pinterest, Snapchat, WhatsApp, Google Business Profile

### Pinterest API v5
- **Trial** : accordé après approbation de l'app ; « all Pins and Boards created with Trial access are only visible to their creator » ; environ 1 000 appels par jour, 300 écritures (org_write) par jour par app.
- **Standard** : demande depuis My apps avec vidéo de démonstration du flux OAuth et de l'action réelle ; limites relevées (100 écritures par minute par utilisateur, 100 requêtes par seconde par utilisateur par app).
- Sources : https://developers.pinterest.com/docs/key-concepts/access-tiers/ et https://developers.pinterest.com/docs/reference/rate-limits/

### Snapchat
- Pas d'API publique de publication organique. Le Public Profile API (dans le Marketing API) est réservé aux partenaires allowlistés et aux profils publics ayant opté ; endpoint de publication de Stories ; Spotlight accessible via certains agrégateurs (Ayrshare, Zernio). Sources : https://developers.snap.com/marketing-api/Public-Profile-API/ProfileAssetManagement et https://www.ayrshare.com/docs/apis/post/social-networks/snapchat

### WhatsApp
- **Channels** : « WhatsApp Channels don't support post scheduling yet, all updates must be published manually. » Aucune API Meta pour publier dans un Channel. Source : https://www.wati.io/en/blog/whatsapp-channels/
- **Status** : non supporté par la WhatsApp Business Platform. Les « WhatsApp Status API » et « Channels API » vendues par whapi.cloud et consorts reposent sur des sessions WhatsApp Web non officielles : risque de bannissement du numéro, à proscrire pour des clients. Source : https://whapi.cloud/whatsapp-status-api (offre non officielle)
- **WhatsApp Business Platform (Cloud API)** : messagerie conversationnelle 1:1 (fenêtre 24 h, modèles approuvés hors fenêtre, tarification par conversation), utilisable pour envoyer au client la planche de validation ou l'alerte « post publié ». En juillet 2026 arrivent les noms d'utilisateur et l'identifiant BSUID ; seuils de qualité durcis au T2 2026 (throttling au-delà de 0,5 % de blocages). Source : https://www.zavu.dev/en/blog/whatsapp-business-api-updates

### Google Business Profile
- Les posts (localPosts) vivent sur l'API legacy v4 `mybusiness.googleapis.com/v4/accounts/{a}/locations/{l}/localPosts`, jamais migrés vers v1 ; types STANDARD, EVENT, OFFER avec boutons BOOK, ORDER, SHOP, LEARN_MORE, SIGN_UP, CALL ; photo via `media.sourceUrl` (vidéo non documentée) ; « Product Posts cannot be created using the Google My Business API ».
- Accès : quota à 0 tant que la demande « Application For Basic API Access » n'est pas acceptée ; 300 requêtes par minute par API ; 10 modifications par minute par fiche, non relevable.
- Sources : https://developers.google.com/my-business/content/posts-data , https://developers.google.com/my-business/content/limits , https://slashpost.ai/blogs/google-business-profile/google-business-profile-api-documentation-2026

---

## 8. Les API unifiées (prix et conditions relevés le 1er octobre 2026)

| Service | Prix (mensuel, hors remise annuelle) | Unité facturée | Réseaux | Qui porte la revue d'application | White label / multi-clients | Points d'attention |
|---|---|---|---|---|---|---|
| **Ayrshare** | Premium 149 $ (1 profil), Launch 299 $ (10 profils), Business dès 599 $ (30 profils, puis 8,99 $ par profil de 31 à 100, 3,49 $ de 101 à 500, 2,49 $ au-delà), Enterprise sur devis (300+). La page « Business Plan » affiche encore « from $499 » : incohérence à clarifier avec Ayrshare. | Profil = un client avec tous ses réseaux | 14+ (FB, IG, TikTok, YouTube, LinkedIn, X, Threads, Pinterest, Reddit, Bluesky, Snapchat, GBP, Telegram...) | Ayrshare (apps Meta, TikTok, LinkedIn, Pinterest auditées) ; « bring your own app » possible sur X | User Profiles dès Launch ; page de connexion hébergée sur profile.ayrshare.com avec logo, couleurs, CSS, langue ; domaine personnalisé pour les liens courts seulement | Commentaires et DM inclus ; TikTok à réautoriser chaque année ; 28 jours d'essai sur Launch |
| **Zernio (ex-Late, getlate.dev redirige vers zernio.com)** | Usage : comptes 1 et 2 gratuits, 3 à 10 à 6 $ par compte, 11 à 100 à 3 $, 101+ à 1 $ ; 10 000 messages inclus puis 1 $ par 10 000 | Compte social connecté | 16 réseaux dont WhatsApp et Snapchat, plus 7 régies pub | Zernio | Pas de mention de white label sur la page de prix ; MCP hébergé avec 280+ outils | Rebrand 2026, mêmes endpoints et clés ; anciens plans Late (Build 19 $, Accelerate 49 $, Unlimited 999 $) caducs |
| **Upload-Post** | Free 0 $ (2 profils, 10 uploads), Basic 24 $ (5 profils), Professional 50 $ (25 profils, white label), Advanced 147 $ (75), Business 438 $ (225) ; annuel 192 / 400 / 1 411 / 4 205 $ | Profil = un compte par plateforme sur chacune des 22 plateformes | 22 (dont GBP, Discord, Telegram, WordPress) | Upload-Post (« no Meta developer app or app review needed », « no TikTok audited-client review needed ») | White label dès Professional | Minutes FFmpeg incluses (300 à 10 000) ; analyses IA ; prix et volumes très agressifs |
| **Blotato** | Starter 29 $ (20 comptes, 1 250 crédits IA), Creator 97 $ (40 comptes, 5 000 crédits), Agency 499 $ (100 comptes, 28 000 crédits) ; essai 7 jours sans API | Compte social | principaux réseaux | Blotato | Pas de white label documenté | La page de prix lue ne liste pas l'API dans les plans alors que la doc l'annonce sur tout plan payant : à confirmer ; outil orienté créateur IA plus que plateforme d'agence |
| **Post Bridge** | Creator 29 $ (15 comptes), Pro 49 $ (illimité) ; API : 5 $ d'add-on sur les anciens plans, incluse sur les nouveaux plans Marketer et Operator | Compte social | principaux réseaux | Post Bridge | Non documenté | Doc API sur api.post-bridge.com/reference ; produit jeune |
| **SocialBu** | Free (2 comptes, 40 posts), Standard 15,8 $ (12 comptes, 800 posts), Super 49,2 $ (30 comptes, illimité), Supreme 165,8 $ (150 comptes), en annuel | Compte social | 12 (LinkedIn, X, IG, Threads, TikTok, FB, YouTube, Reddit, Bluesky, Pinterest, Mastodon, GBP) | SocialBu | Non documenté | API : posts CRUD, comptes, métriques, IA |
| **Postiz cloud** | Standard 29 $ (5 canaux), Team 39 $ (10), Pro 49 $ (30), Ultimate 99 $ (100) ; annuel 23 / 31 / 39 / 79 $ | Canal | 30+ | Postiz (cloud) | API publique, MCP, CLI sur tous les plans ; limite documentée 30 requêtes par heure | Essai 7 jours ; images et vidéos IA incluses par plan |
| **Postiz auto-hébergé** | 0 $ (AGPL-3.0) + serveur (4 vCPU, 8 Go, PostgreSQL, Redis, Temporal) | aucune | 30+ | **Vous** (vos propres apps OAuth et vos revues) | Oui, c'est votre instance | Même code que le cloud, mais la charge réglementaire revient chez vous |
| **Mixpost** | Lite gratuit (Facebook Pages, X, Mastodon) ; Pro 299 $ une fois (11 plateformes, API, MCP, white label de base, workspaces illimités, 1 domaine, 1 an de mises à jour) ; Enterprise 1 199 $ une fois (white label complet, gestion d'abonnements et facturation clients) | Licence par domaine | 11 en Pro | **Vous** | Oui, conçu pour la revente | Licence perpétuelle de repli ; PHP/Laravel, à héberger |
| **Metricool** | Advanced 54 $ (15 marques), 88 $ (25), 172 $ (50) ; Custom sur devis | Marque | 10+ | Metricool | White label **Custom uniquement** ; API sur Advanced et Custom, en-tête X-Mc-Auth + userId + blogId ; MCP | API orientée planification et export analytics, pas un vrai service OAuth multi-tenant |
| **Buffer** | Plans Buffer classiques ; API REST legacy retirée le 1er février 2027 (brownouts 11 novembre et 9 décembre 2026), nouvelle API GraphQL lancée en mai 2026 en bêta publique, clé personnelle, **OAuth tiers pas encore ouvert** | | | Buffer | Non | Inutilisable aujourd'hui pour onboarder des clients tiers |

Sources : https://www.ayrshare.com/pricing/ , https://www.ayrshare.com/docs/apis/profiles/overview , https://www.ayrshare.com/docs/apis/profiles/social-linking-overview , https://zernio.com/pricing , https://www.alexisbouchez.com/research/zernio-social-media-api-analysis , https://www.upload-post.com/llms-full.txt , https://www.blotato.com/pricing , https://support.post-bridge.com/api/post-bridge-api-overview-access-and-pricing , https://www.socialchamp.com/blog/socialbu-pricing/ , https://socialbu.com/api , https://postiz.com/pricing , https://mixpost.app/pricing , https://www.socialpilot.co/insights/metricool-pricing , https://help.metricool.com/api-access-export-your-metricool-data-to-other-tools-and-automate-tasks-x8ln5 , https://buffer.com/resources/legacy-rest-api-retired/

### 8.1 Comparaison pour une agence de 6 à 30 clients

| Critère | Ayrshare | Zernio | Upload-Post | Postiz cloud | Mixpost Pro |
|---|---|---|---|---|---|
| Coût pour 6 clients × 4 réseaux (24 comptes) | 299 $ (Launch, 10 profils) | 2 gratuits + 8 × 6 $ + 14 × 3 $ = 90 $ | 50 $ (Pro, 25 profils) | 49 $ (Pro, 30 canaux) | 299 $ une fois + serveur |
| Coût pour 30 clients × 4 réseaux (120 comptes) | 599 $ (Business, 30 profils) | 2 gratuits + 8 × 6 + 90 × 3 + 20 × 1 = 338 $ | 147 $ (Advanced, 75 profils) | 99 $ (Ultimate, 100 canaux) + dépassement | 299 $ + serveur |
| Revue d'application portée par | le fournisseur | le fournisseur | le fournisseur | le fournisseur | vous |
| Commentaires et DM | oui (IG, FB, LinkedIn, YouTube...) | oui, messagerie incluse | partiel (à vérifier) | partiel | partiel |
| Analytics | oui, par post et par profil | oui | analyses IA par plan | tableau de bord | basique |
| Maturité et fiabilité | la plus ancienne (depuis 2020), docs très complètes | jeune, croissance rapide, rebrand 2026 | jeune, prix cassés | open source actif | open source, communauté Laravel |
| Droit de revente multi-clients | oui (User Profiles, agences visées) | oui (par compte) | oui (white label dès Pro) | oui | oui (Enterprise pour facturer) |
| Dépendance | forte : si Ayrshare perd une app Meta, tous vos clients sont coupés | idem | idem | idem | vos propres apps : le risque est le vôtre |

Lecture : pour démarrer vite (sans attendre 20 jours d'App Review, 2 à 4 semaines d'audit YouTube, un audit TikTok et un Standard Tier LinkedIn), une API unifiée coûte entre 50 et 300 $ par mois et fait gagner deux à trois mois. Pour la pérennité et la marge, posséder ses propres apps reste l'objectif à 12 mois.

---

## 9. Tableau plateforme × fonction × accessibilité

Légende : **O** = API officielle, à condition d'avoir passé la revue ; **U** = via API unifiée (le fournisseur a passé la revue) ; **M** = manuel seulement (repli humain) ; **X** = impossible.

| Plateforme | Publier image | Publier vidéo / Reels | Carrousel | Stories | Programmer | Lire commentaires | Répondre DM | Analytics |
|---|---|---|---|---|---|---|---|---|
| Facebook Page | O / U | O / U (Reels 3 à 90 s, 30 par 24 h) | O / U (multi-photo) | O / U (60 s) | O (10 min à 30 jours ; vidéo jusqu'à 6 mois) / U | O / U | O / U (Messenger, 24 h) | O / U (Page Insights, métriques réduites au 15 juin 2026) |
| Instagram pro | O / U (JPEG, URL publique) | O / U (Reels 3 s à 15 min) | O / U (10 max par API, 20 dans l'app) | O / U (image ou vidéo 60 s) | X natif (ordonnanceur à vous) / U | O / U | O / U (24 h + agent humain) | O / U (views, reach, saved, skip rate ; impressions supprimé) |
| Threads | O / U | O / U (5 min) | O / U (20) | X | X natif / U | O / U (réponses) | X | O / U (insights) |
| TikTok | O (35 photos) / U | O (SELF_ONLY sans audit) / U | photos oui, vidéos non | X | X natif / U | **X** par API publique ; M | X | O partiel (compteurs publics) / U |
| YouTube | X (pas d'images) | O (privé sans audit ; 100 uploads par jour depuis le 1er juin 2026) / U | X | X | O (publishAt) / U | O (commentThreads) / U | X | O (Analytics API) / U |
| LinkedIn page | O (Standard Tier) / U | O / U | multi-image O ; carrousel organique X | X | X natif / U | O / U | X | O (Page, Follower, Share, Video statistics) / U |
| X | O (payant à l'usage) / U | O / U | jusqu'à 4 médias | X | X natif / U | O (payant par lecture) / U | O (DM, payant) / U | O (métriques publiques) / U |
| Pinterest | O (Standard) / U | O / U | O (carrousel d'épingles) | X | X natif / U | O | X | O |
| Snapchat | U seulement (Stories, Spotlight) | U | X | U | U | X | X | X |
| WhatsApp Channel | **M** | **M** | M | M (Status) | X | X | O (Cloud API, 1:1) | X |
| Google Business Profile | O (v4 localPosts, accès sur demande) / U | X (non documenté) | X | X | X natif / U | O (avis) / U | X | O (Performance API) |

---

## 10. Ce qu'un outil d'agence doit prévoir

### 10.1 Connexion OAuth par client

- Un **espace par client** (tenant) avec ses propres connexions sociales, jamais un jeton partagé entre clients. Chez Ayrshare cela s'appelle User Profile avec une Profile-Key par client ; chez vous, une table `connexions_sociales` liée à `clients`.
- Le client (ou le gestionnaire, depuis le compte du client) clique « Connecter Instagram » et passe par la fenêtre OAuth. Avec Ayrshare, vous générez un JWT et ouvrez la page hébergée profile.ayrshare.com habillée à votre logo ; avec vos propres apps, vous gérez les redirections OAuth pour Meta (Facebook Login ou Instagram Login), TikTok (Login Kit), Google (YouTube, GBP), LinkedIn, X, Pinterest.
- Enregistrer pour chaque connexion : plateforme, identifiant externe (page id, ig user id, open_id TikTok, channel id), permissions accordées, date d'expiration, rôle du membre (LinkedIn vérifie ADMINISTRATOR ou CONTENT_ADMIN), domaine d'origine vérifié (TikTok PULL_FROM_URL).

### 10.2 Stockage chiffré des jetons

- Chiffrement au repos par enveloppe : une clé maîtresse dans les variables Railway (jamais dans le dépôt), une clé de données par client chiffrée par la clé maîtresse, jetons chiffrés en AES-256-GCM avec nonce unique. Colonnes `token_chiffre`, `nonce`, `version_cle`.
- Les jetons ne sortent jamais vers le client ni vers les journaux ; les erreurs API sont journalisées sans le jeton.
- Rotation de la clé maîtresse possible grâce à `version_cle`.

### 10.3 Renouvellement et reconnexion

- **Meta** : tâche quotidienne qui rafraîchit tout jeton Instagram ou utilisateur de plus de 24 h et de moins de 55 jours ; les jetons de Page dérivés n'expirent pas mais tombent si le mot de passe change, si l'utilisateur perd son rôle ou si l'app perd Advanced Access.
- **TikTok** : jeton 24 h, rafraîchissement par refresh_token (365 jours) avant chaque publication ; réautorisation annuelle.
- **LinkedIn** : jeton 60 jours, rafraîchissement programmatique si votre app y a droit, sinon alerte J-10 au gestionnaire.
- **Google** : refresh token durable tant que l'app est en production et que l'utilisateur ne révoque pas ; en mode « testing », expiration à 7 jours.
- **Détection** : toute erreur 190 (Meta), 401 ou `access_token_invalid` (TikTok) ou 401 (LinkedIn) bascule la connexion en état `a_reconnecter`, envoie une alerte WhatsApp (CallMeBot existe déjà chez José) et un courriel au client avec un lien de reconnexion en un clic ; les posts programmés passent en `en_attente_reconnexion` au lieu d'échouer silencieusement.

### 10.4 Respect des limites et des règles d'audit

- Compteurs locaux par connexion : Instagram 100 par 24 h, Facebook Reels 30 par 24 h, Threads 250, TikTok environ 15 et 6 requêtes par minute, YouTube 100 uploads par jour par projet (partagés entre tous vos clients : à 30 clients, 3 vidéos par jour chacun), X 100 par 15 min. Interroger `content_publishing_limit` et `threads_publishing_limit` avant d'envoyer.
- Écran de validation TikTok conforme : confidentialité choisie à la main, cases décochées, bascule de divulgation commerciale, aperçu, mention musique ; le drapeau `is_aigc` activé quand la vidéo vient de Higgsfield, Seedance ou d'un modèle d'image.
- Consentement YouTube explicite et horodaté par client (« j'autorise la plateforme à publier sur ma chaîne »).

### 10.5 Repli manuel : le « paquet prêt à publier »

Quand l'API refuse (audit non obtenu, permission révoquée, plateforme sans API comme WhatsApp Channels ou Snapchat sans partenaire, carrousel Instagram de 11 à 20 diapositives, Reel collaboratif, post produit Google) :

- la machine génère un **paquet** : fichiers médias aux bons formats (9:16 1080×1920 pour Reels, Stories, TikTok, Shorts ; 4:5 pour le fil Instagram ; 1:1 ou 1.91:1 pour Facebook et LinkedIn), légende finale avec hashtags, texte alternatif, heure recommandée, cases à cocher (confidentialité, divulgation), lien profond vers l'écran de création de la plateforme ;
- le gestionnaire reçoit une tâche « Publier à la main » avec le paquet (téléchargeable, aussi envoyé par WhatsApp Cloud API ou courriel) ;
- il publie, colle l'URL du post dans la tâche ; la machine récupère ensuite les statistiques par lecture (les permissions de lecture sont plus faciles à obtenir que celles d'écriture) ;
- rien ne se perd : le calendrier éditorial reste vrai, seule la voie de sortie change.

---

## 11. Incertitudes et points à vérifier

1. **Prix X** : pages officielles inaccessibles pendant la recherche (404 et 402) ; 0,015 $ / 0,20 $ / 0,005 $ et le plafond mensuel (2 ou 3 millions de lectures) viennent de sources secondaires concordantes d'avril à septembre 2026. Vérifier sur console.x.com avant tout engagement.
2. **Taille maximale des Reels Instagram** : la page de référence lue annonce 300 Mo ; d'autres pages Meta ont indiqué 1 Go. Tester avec un fichier de 400 Mo.
3. **Fenêtre de programmation des vidéos Facebook** (10 minutes à 6 mois) : donnée relayée par une source secondaire, à confirmer sur la doc Video API.
4. **TikTok non audité** : 5 posts par 24 h (guidelines) ou 5 utilisateurs par 24 h (sources secondaires) ; la durée maximale de vidéo dépend du compte et se lit dans creator_info/query.
5. **Ayrshare Business** : 599 $ sur la page de prix contre « from $499 » sur la page Business Plan ; qui porte la revue Meta en white label (apps Ayrshare ou vos apps) : poser la question au commercial.
6. **Blotato** : la page de prix lue n'affiche pas l'API dans les plans alors que la documentation annonce l'API sur tout plan payant.
7. **Metricool** : documentation API en ligne (app.metricool.com/resources/apidocs) non lue directement ; la page metricool.com/api est un guide générique.
8. **LinkedIn** : les limites de débit du Standard Tier ne sont pas publiées ; le rafraîchissement programmatique des jetons dépend de l'approbation de votre app.
9. **Google Business Profile** : support des vidéos dans localPosts non documenté ; délai d'octroi de l'accès API non publié.
10. **Zernio** : absence de mention du white label sur la page de prix ; conditions de revente à lire dans les CGU.
11. **Meta, 15 juin 2026** : liste exacte des métriques Page Insights supprimées à relire dans le changelog v25/v26 avant de concevoir les tableaux de bord.
12. **Snapchat** : accès partenaire au Public Profile API non chiffré ; seules Ayrshare et Zernio annoncent Stories et Spotlight.

---

## 12. Implications pour la machine de José

1. **Démarrer sur une API unifiée, viser vos propres apps à 12 mois.** Les délais cumulés (Meta jusqu'à 20 jours par cycle, YouTube 2 à 4 semaines, TikTok et LinkedIn plusieurs semaines) retarderaient la première publication de deux à trois mois. Ayrshare Launch (299 $/mois, 10 profils) ou Upload-Post Pro (50 $/mois, 25 profils) couvrent 6 à 25 clients dès le premier jour. Prévoir dans le code une **couche d'abstraction « connecteur »** (interface unique publier / lire / statistiques) avec deux implémentations : API unifiée et API officielles, pour migrer client par client sans réécrire la machine.
2. **Lancer dès maintenant les demandes d'accès officielles en parallèle**, même si elles ne servent pas tout de suite : app Meta liée à l'entreprise vérifiée Markel-Tech Inc. (documents ontariens), projet Google Cloud avec audit YouTube API Services, app TikTok soumise à l'audit Content Posting, app LinkedIn Community Management Development Tier. Ces délais ne se compressent pas ; autant qu'ils courent pendant la construction.
3. **Un écran de validation par post, obligatoire, pas optionnel.** TikTok l'impose (choix de confidentialité sans valeur par défaut, aperçu, divulgation), YouTube exige un consentement exprès, et c'est de toute façon l'étape « le gestionnaire regarde » voulue par José. La machine propose, l'humain approuve par lot avec un clic par post.
4. **Servir les médias depuis une URL publique stable** (bucket S3 Railway ou domaine public) : Instagram, Threads et TikTok PULL_FROM_URL téléchargent le média eux-mêmes ; TikTok exige en plus un domaine vérifié. Garder les fichiers 7 jours après publication, puis archiver.
5. **Rendre les vidéos au bon format dès la production** : 9:16, 1080×1920, H.264, AAC 128 kbps, 24 à 60 fps, 3 à 90 s pour Facebook Reels, 60 s maximum pour les Stories, moins de 60 s avec #Shorts pour YouTube, 3 s à 15 min pour les Reels Instagram. Les clips de sermons pour les églises se coupent donc en segments de 45 à 60 s pour être publiables partout sans re-encodage.
6. **Carrousels : concevoir en 10 diapositives maximum** si on publie par API Instagram, ou prévoir le repli manuel pour les carrousels de 11 à 20. Threads accepte 20, TikTok 35 photos, LinkedIn un multi-image organique (pas de carrousel).
7. **Quota YouTube partagé** : 100 uploads par jour par projet Google pour tous les clients ; lissez les publications (pas de rafale le dimanche soir pour toutes les églises) et, si vous dépassez 30 clients vidéo, ouvrez un second projet Google audité.
8. **Compteurs de quota locaux et file d'attente avec reprise** : chaque publication passe par une file (BullMQ ou équivalent) qui connaît les plafonds par connexion (IG 100/24 h, FB Reels 30/24 h, TikTok 6/min, X 100/15 min) et reporte au lieu d'échouer.
9. **Chiffrer les jetons par enveloppe, rafraîchir à J-5, alerter à J-10.** Tâche quotidienne de rafraîchissement Meta et LinkedIn, rafraîchissement TikTok avant chaque publication, état `a_reconnecter` visible dans le tableau de bord gestionnaire et alerte WhatsApp via CallMeBot déjà en place.
10. **WhatsApp : messagerie oui, publication non.** Utiliser la Cloud API pour envoyer au client sa planche de validation (image + boutons « Valider / Modifier ») et la confirmation de publication ; ne jamais automatiser un Channel ou un Status avec un service non officiel (risque de perdre le numéro du client).
11. **TikTok sans réponse aux commentaires par API** : prévoir dans la routine du gestionnaire une tâche quotidienne « commentaires TikTok à traiter dans l'app », nourrie par les compteurs publics (Display API) qui signalent les vidéos qui commentent le plus.
12. **Analytics : s'appuyer sur views, reach, saved, shares, skip rate, watch time**, pas sur impressions (déprécié chez Instagram depuis le 2 juillet 2024, retiré chez Facebook Pages au 15 juin 2026). Aligner la mesure en trois couches de la doctrine de José sur ces métriques natives, et stocker les relevés chez vous (Meta efface après 2 ans, Stories après 24 h, Facebook limite à 90 jours par requête).
13. **X en option payante** : réserver X à Markel-Tech (B2B) avec un budget plafonné (quelques dizaines de dollars par mois) ; ne pas l'inclure dans l'offre de base des clients beauté, églises et édition.
14. **Google Business Profile pour 2IAE et les clients locaux** : demander l'accès API dès maintenant (quota à 0 tant que non accordé) ; posts STANDARD, EVENT, OFFER avec photo ; c'est un canal à fort rendement local que la concurrence des outils de création IA ignore.
15. **Repli manuel comme fonctionnalité de premier rang** : le « paquet prêt à publier » (médias, légende, hashtags, heure, cases à cocher, lien profond) couvre WhatsApp Channels, Snapchat, les cas refusés par l'API et la période avant les audits. Le gestionnaire colle l'URL publiée ; la machine mesure ensuite.
16. **Un tenant par client, jamais de jeton partagé**, avec journal d'audit (qui a validé quoi, quand, publié par quelle voie). C'est aussi ce qui protège l'agence quand un client part : on révoque ses connexions et on exporte son historique.
17. **Prévoir la version mensuelle LinkedIn** (en-tête LinkedIn-Version, version 202510 retirée le 15 octobre 2026) et la version Meta (v25.0 aujourd'hui) comme paramètres de configuration, avec un test automatique de publication sur un compte de test chaque semaine.
18. **Budget réaliste phase 1 (6 clients, 4 réseaux)** : API unifiée 50 à 299 $/mois, X 0 à 30 $/mois, stockage et calcul Railway, plus les coûts de génération média (hors périmètre de ce rapport). Phase 2 (30 clients) : 147 à 599 $/mois en unifié, ou vos propres apps avec coût marginal nul mais une personne responsable des revues et des changements de versions.

