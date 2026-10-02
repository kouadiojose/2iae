# R25. Infrastructure Railway, stockage des médias (DAM), URL publiques, isolation multi-locataires et coût d'hébergement par client

État au 2 octobre 2026. Toutes les pages citées ont été ouvertes ce jour, sauf mention contraire. Les prix sont en dollars américains, hors taxes. Les estimations (volumes, temps de rendu, latence) sont signalées comme telles et séparées des faits sourcés.

## 1. Résumé exécutif

1. Le stockage n'est pas le poste qui coûte : chez Railway comme chez Cloudflare R2, un gigaoctet stocké vaut 0,015 $ par mois, la sortie réseau depuis le bucket est gratuite et, chez Railway, toutes les opérations S3 sont gratuites et illimitées. Un client église qui dépose 4 sermons de 60 minutes par mois accumule environ 160 Go au bout d'un an (originaux conservés, rendus purgés à 90 jours) et coûte alors 2,40 $ par mois de stockage ; un client beauté à 24 contenus par mois reste sous 30 Go, soit moins de 0,50 $ par mois.
2. Ce qui coûte, c'est le calcul permanent : Railway facture 20 $ par vCPU et par mois et 10 $ par Go de RAM et par mois, à la minute, sur la consommation réelle. Une plateforme à 6 clients tient dans 85 à 110 $ par mois tout compris (plan Pro inclus) ; à 20 clients, 230 à 290 $ par mois. Soit 12 à 18 $ par client et par mois d'infrastructure, hors génération IA (R04, R07) et hors licence Remotion (100 $ par mois minimum au-delà de 3 personnes).
3. Les buckets Railway ont trois trous à connaître avant la première migration : pas de bucket public (les URL présignées, valables jusqu'à 90 jours, remplacent), pas de règles de cycle de vie (la rétention à 90 jours se fait par un job maison), pas de versionnage ni de verrou d'objet (une suppression est définitive, donc la copie de sauvegarde des originaux doit vivre ailleurs). Ils sont chiffrés au repos et disponibles dans quatre régions, dont Amsterdam, la plus proche d'Abidjan (5 300 km).
4. Pour la publication, Instagram et Threads téléchargent le média depuis une URL publique : une URL présignée Railway suffit. TikTok en mode PULL_FROM_URL exige un domaine ou un préfixe d'URL vérifié, sans redirection : impossible avec une URL présignée sur le domaine de Railway. Deux issues : l'envoi par fichier (FILE_UPLOAD, 4 Go maximum, morceaux de 5 à 64 Mo) ou un domaine propre devant un bucket Cloudflare R2 (sortie gratuite, point de présence Cloudflare à Abidjan).
5. L'isolation multi-locataires tient sur un seul Postgres et un seul bucket : colonne tenant_id partout, Row Level Security forcée avec un rôle applicatif qui n'est pas propriétaire des tables, variable de session posée par Drizzle dans chaque transaction, préfixe de clé S3 par client, clé de données par client enveloppée par une clé maître (R02), journal d'audit en ajout seul. Sauvegardes : instantanés de volume (6, 27 et 89 jours), PITR Postgres par pgBackRest sur un bucket Railway (environ 4 semaines), et un pg_dump hebdomadaire hors Railway, car seul le dump logique survit à la suppression d'un projet.
6. Le rendu vidéo lourd reste sur le conteneur Railway (ffmpeg, CPU) pour la découpe et les sous-titres, sur Remotion Lambda pour l'habillage animé (un lot de 5 clips d'une minute coûte environ 0,10 $ et sort en moins d'une minute) et sur un GPU loué à la seconde (RunPod 0,69 $ par heure, Modal L4 0,80 $ par heure) uniquement si WhisperX auto-hébergé devient nécessaire, ce qui n'arrive pas avant 200 heures d'audio par mois (R05).
7. Les clés des connecteurs IA restent celles de l'agence, partagées par fournisseur, avec un registre de dépense interne par client et par jour, vérifié avant chaque appel. OpenAI permet en plus un projet par client avec plafond mensuel dur et date d'expiration des clés ; Gemini lie chaque clé à un projet Google Cloud (10 projets maximum dans AI Studio) ; fal et ElevenLabs n'exposent pas de plafond par clé dans leurs pages publiques.

## 2. Railway en 2026 : prix, limites, régions

### 2.1 Grille de prix (page de prix et documentation, lues le 2 octobre 2026)

| Ressource | Prix | Détail |
|---|---|---|
| Plan Hobby | 5 $ par mois | inclut 5 $ d'usage ; 48 Go de RAM et 48 vCPU par service, 5 Go de volume par service, 6 réplicas |
| Plan Pro | 20 $ par mois par workspace | inclut 20 $ d'usage ; 1 To de RAM et 1 000 vCPU par service (24 vCPU et 24 Go par réplica selon la page de scaling), volumes jusqu'à 1 To en libre-service, 42 réplicas |
| vCPU (conteneur) | 20 $ par vCPU et par mois | 0,000463 $ par vCPU et par minute, sur consommation réelle |
| RAM (conteneur) | 10 $ par Go et par mois | 0,000231 $ par Go et par minute |
| Volume | 0,15 $ par Go et par mois | facturé sur l'espace utilisé, 2 à 3 % de surcharge de métadonnées |
| Sortie réseau d'un service | 0,05 $ par Go | y compris les envois d'un service vers un bucket |
| Bucket (stockage objet) | 0,015 $ par Go et par mois | sortie gratuite et illimitée, toutes les opérations S3 gratuites ; usage moyenné sur le mois et arrondi au Go supérieur |
| VM (sandboxes, agents cloud) | 50 $ par vCPU et par mois, 50 $ par Go et par mois | hors sujet ici, mais cinq fois plus cher que le conteneur |

Sources : https://railway.com/pricing ; https://docs.railway.com/reference/pricing/plans ; https://docs.railway.com/storage-buckets/billing ; https://docs.railway.com/pricing/understanding-your-bill

Points de facturation importants :
- Les crédits inclus dans le plan ne se reportent pas d'un mois sur l'autre ; un usage de 15 $ sur Hobby donne une facture de 15 $, pas de 20 $.
- Les limites de dépense se posent par cycle de facturation : alerte par courriel à un seuil choisi, et limite dure (10 $ minimum) qui met tous les services hors ligne, avec alertes à 75, 90 et 100 %. Les usages « Compute » et « Agent » ont des limites séparées. Source : https://docs.railway.com/pricing/cost-control
- Le trafic du réseau privé (`*.railway.internal`, chiffré WireGuard) n'est pas facturé comme sortie ; il faut donc joindre Postgres par `DATABASE_URL` et non par l'URL publique. Sources : https://docs.railway.com/reference/private-networking ; https://docs.railway.com/pricing/cost-control
- Le mode Serverless endort un service après 5 à 10 minutes sans trafic sortant ; la première requête peut renvoyer un 502 ; une connexion de base de données ouverte ou du trafic privé empêche la mise en veille. Utile pour un worker de rendu rarement sollicité, inutile pour l'API. Source : https://docs.railway.com/reference/app-sleeping

### 2.2 Volumes et sauvegardes

- Un seul volume par service, pas de réplicas avec volume, redéploiement avec une courte coupure même avec healthcheck (c'est la cause de l'incident du campus du 29 septembre 2026 décrit dans CLAUDE.md). Agrandissement à chaud sans coupure depuis le 30 janvier 2026 ; réduction impossible. Limites : 0,5 Go (gratuit), 5 Go (Hobby), 50 Go puis 1 To en libre-service (Pro), au-delà sur demande. La page des plans dit 1 To pour Pro et 5 To pour Enterprise : les deux pages ne concordent pas, voir les incertitudes. Sources : https://docs.railway.com/reference/volumes ; https://railway.com/changelog (entrée du 30 janvier 2026)
- Sauvegardes de volume : quotidienne (conservée 6 jours), hebdomadaire (27 jours), mensuelle (89 jours), cumulables, plus manuelles (limitées à 50 % de la capacité du volume). Incrémentales et copy-on-write, facturées au prix du volume pour les données uniques. Restauration dans le même projet et le même environnement seulement ; effacer le volume efface ses sauvegardes. Source : https://docs.railway.com/reference/backups
- PITR Postgres : archivage WAL continu par pgBackRest vers un bucket Railway privé, sauvegarde complète hebdomadaire et différentielle quotidienne, 4 complètes conservées, soit environ 4 semaines de fenêtre ; aucun frais propre, seulement le stockage du bucket et la sortie du service vers le bucket (données compressées en zstd, « quelques Go par jour » en écriture soutenue). La restauration crée un service Postgres frère ; la source n'est jamais touchée. La fenêtre ne commence qu'à l'activation. Source : https://docs.railway.com/volumes/point-in-time-recovery
- Le guide officiel conseille trois couches : instantanés de volume, PITR et dumps logiques `pg_dump --format=custom`, et rappelle qu'« une sauvegarde jamais restaurée n'est pas vérifiée » ; seul le dump logique survit à la suppression du projet. Source : https://docs.railway.com/guides/postgres-backups-restores

### 2.3 Buckets Railway : ce qu'ils font et ce qu'ils ne font pas

| Capacité | État au 2 octobre 2026 |
|---|---|
| Compatibilité S3 | Put, Get, Head, Delete, List v1 et v2, Copy, URL présignées, tags, multipart ; URL de style virtual-hosted (le nom du bucket en sous-domaine) |
| Non pris en charge | chiffrement côté serveur paramétrable (SSE), versionnage, verrous d'objet, règles de cycle de vie |
| Chiffrement | « encrypted at rest » (clés gérées par Railway) |
| Accès public | « Public buckets are currently not supported » ; tout passe par des URL présignées, qui « peuvent vivre jusqu'à 90 jours » et sortent sans frais |
| Envoi direct depuis le navigateur | presigned POST avec restriction de type et de taille (`content-length-range`), CORS à configurer par l'AWS CLI |
| Régions | sjc (Californie), iad (Virginie), ams (Amsterdam), sin (Singapour) ; choix définitif à la création ; buckets Singapour ajoutés le 16 janvier 2026 |
| Variables fournies | BUCKET, ACCESS_KEY_ID, SECRET_ACCESS_KEY, ENDPOINT, REGION (et équivalents AWS_* via le CLI) ; `railway bucket credentials --reset` révoque et régénère |
| Plafonds | Free 10 Go-mois, Trial 50 Go-mois, Hobby 1 To combiné, Pro illimité ; taille maximale d'un objet non publiée |
| Outils | navigateur de fichiers des buckets dans le tableau de bord depuis le 29 mai 2026 |

Sources : https://docs.railway.com/storage-buckets ; https://docs.railway.com/storage-buckets/uploading-serving ; https://docs.railway.com/storage-buckets/billing ; https://docs.railway.com/cli/bucket ; https://railway.com/changelog

Le campus 2IAE utilise déjà deux buckets Railway (fichiers et replays, région ams) avec des liens signés d'une heure et une sortie gratuite ; la machine peut reprendre ce patron tel quel (campus/RAILWAY.md, lecture seule).

### 2.4 Régions et distance d'Abidjan

Railway opère quatre régions « Metal » : US West (Californie, us-west2), US East (Virginie, us-east4-eqdc4a), EU West (Amsterdam, europe-west4-drams3a), Southeast Asia (Singapour, asia-southeast1-eqsg3a). Un service sans volume change de région sans coupure ; avec volume, la migration coupe le service. Source : https://docs.railway.com/reference/regions

Distances orthodromiques calculées depuis Abidjan (calcul propre, pas une mesure réseau) : Paris 4 875 km, Le Cap 4 960 km, Amsterdam 5 290 km, Montréal 8 000 km, Virginie 8 210 km, Singapour 11 960 km, Californie 12 040 km. Amsterdam est donc la région Railway la plus proche des clients ivoiriens, et la seule raisonnable pour les clients canadiens aussi (Virginie est à 8 200 km d'Abidjan). Aucune mesure de latence Abidjan-Amsterdam n'a pu être chargée (wondernetwork et cloudping indisponibles le jour de la recherche) ; l'ordre de grandeur attendu par les câbles sous-marins de la côte ouest-africaine est de 90 à 130 ms aller-retour, à mesurer depuis Abidjan avant de décider.

Cloudflare annonce un point de présence à Abidjan (et à Yamoussoukro, Accra, Dakar, Lagos, Ouagadougou, 33 villes africaines, 348 villes au total). Un domaine propre devant un bucket R2 sert donc les médias depuis Abidjan même, sans frais de sortie. Source : https://www.cloudflare.com/network/

## 3. Comparaison des stockages objet pour les médias publics

| Critère | Railway Buckets | Cloudflare R2 | Backblaze B2 | Bunny Storage + CDN |
|---|---|---|---|---|
| Stockage | 0,015 $ par Go-mois | 0,015 $ (Standard), 0,01 $ (Infrequent Access, 30 jours minimum, 0,01 $ par Go de lecture) | 6,95 $ par To-mois (0,00695 $ par Go) ; Overdrive 15 $ par To | 0,01 $ par Go (HDD, 1 région), 0,02 $ (2 régions), 0,025 $ (3 régions) ; SSD 0,02 $ par région |
| Sortie | gratuite, illimitée | gratuite | gratuite jusqu'à 3 fois le stockage moyen, puis 0,01 $ par Go ; gratuite via Cloudflare, Bunny, Fastly | CDN 0,01 $ par Go (Europe, Amérique du Nord), 0,03 $ (Asie, Océanie), 0,045 $ (Amérique du Sud), 0,06 $ (Moyen-Orient et Afrique) ; réseau Volume 0,005 $ |
| Opérations | gratuites, illimitées | classe A 4,50 $ par million, classe B 0,36 $ par million ; gratuit : 10 Go, 1 million A, 10 millions B par mois | classes A, B, C gratuites ; classe D 0,004 $ par 10 000 au-delà de 2 500 par jour | pas de frais d'API |
| Bucket public | non | oui : sous-domaine r2.dev (limité en débit, « développement seulement ») ou domaine propre dans la même zone Cloudflare, avec cache | oui | oui, c'est le principe |
| URL présignées | jusqu'à 90 jours | 1 seconde à 7 jours, GET, HEAD, PUT, DELETE | oui (S3) | jetons signés CDN |
| Cycle de vie | non | règles par préfixe (suppression après N jours, transition IA, abandon des multipart à 7 jours par défaut), 1 000 règles par bucket | oui | oui |
| Versionnage, verrou | non | bucket locks par préfixe (WORM, 90 jours, date ou indéfini) ; versionnage non documenté | Object Lock (non vérifié ici) | non vérifié |
| Taille d'objet | non publiée | 4,995 Gio en une partie, 4,995 Tio en multipart, 10 000 parties | 5 Go en un envoi, 10 To en « large file » (parties de 5 Mo à 5 Go) | non vérifiée |
| Régions | sjc, iad, ams, sin | automatique ou indice (wnam, enam, weur, eeur, apac, oc) ; juridictions garanties EU, US, FedRAMP | US West, US East, EU Central (non rechargé ce jour) | 5 régions Europe, 4 Amérique du Nord, 4 Asie-Pacifique, Johannesburg, São Paulo |
| Chiffrement au repos | oui, clés gérées | AES-256-GCM, clés gérées, pas de SSE-C documenté | oui (SSE, non rechargé) | non vérifié |
| Durabilité | non publiée | 99,999999999 % annuelle (onze 9) | non rechargé | non vérifié |
| Jetons | un couple de clés par bucket, réinitialisable | jetons Object Read only ou Read & Write restreints à des buckets, jetons de compte ou d'utilisateur, identifiants temporaires dérivés | clés d'application par bucket et préfixe | clés par zone |

Sources : https://docs.railway.com/storage-buckets ; https://developers.cloudflare.com/r2/pricing/ ; https://developers.cloudflare.com/r2/platform/limits/ ; https://developers.cloudflare.com/r2/buckets/public-buckets/ ; https://developers.cloudflare.com/r2/api/s3/presigned-urls/ ; https://developers.cloudflare.com/r2/api/tokens/ ; https://developers.cloudflare.com/r2/buckets/object-lifecycles/ ; https://developers.cloudflare.com/r2/buckets/bucket-locks/ ; https://developers.cloudflare.com/r2/reference/durability/ ; https://developers.cloudflare.com/r2/reference/data-security/ ; https://developers.cloudflare.com/r2/reference/data-location/ ; https://www.backblaze.com/cloud-storage/pricing ; https://www.backblaze.com/docs/cloud-storage-large-files ; https://bunny.net/pricing/ ; https://bunny.net/pricing/storage/ ; https://bunny.net/pricing/stream/

Lecture : pour le volume de José (quelques centaines de Go, quelques dizaines de Go servis par mois), les quatre fournisseurs coûtent moins de 10 $ par mois. Le choix se fait sur les fonctions, pas sur le prix :
- Railway : zéro composant externe, variables injectées, sortie et opérations gratuites, mais pas de bucket public, pas de cycle de vie, pas de versionnage. Parfait comme stockage de travail et de rendus.
- R2 : bucket public sur domaine propre avec cache Cloudflare servi depuis Abidjan, règles de cycle de vie, verrous WORM pour les originaux à conserver, migration Sippy à la demande depuis un bucket S3 compatible. Parfait comme stockage « public » de publication et comme copie de sauvegarde hors Railway.
- B2 : le moins cher au To, utile seulement au-delà de quelques To (archives de sermons sur plusieurs années).
- Bunny : CDN et Stream (transcodage gratuit, lecteur) utiles si la plateforme devait lire des vidéos à des audiences, ce qui n'est pas le cas : les audiences regardent sur Instagram, TikTok et YouTube. À 0,06 $ par Go vers l'Afrique, Bunny est aussi le plus cher pour servir les planches à des clients d'Abidjan.

Les exigences des plateformes qui tirent le média :
- Instagram : « media must be hosted on a publicly accessible server at the time of the attempt », récupération par cURL, 100 publications API par 24 heures glissantes, 400 conteneurs par 24 heures, conteneur expiré après 24 heures ; image JPEG 8 Mo, Reels MP4 ou MOV en H.264 ou HEVC, 300 Mo, 3 secondes à 15 minutes, 23 à 60 images par seconde. Sources : https://developers.facebook.com/docs/instagram-platform/content-publishing ; https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media
- Threads : même logique, vidéo 1 Go et 5 minutes (R02).
- TikTok : PULL_FROM_URL exige « que l'URL du média appartienne à un chemin que vous possédez » (domaine ou préfixe vérifié dans le portail développeur), HTTPS, sans redirection, téléchargement en moins d'une heure ; FILE_UPLOAD : morceaux de 5 à 64 Mo (dernier jusqu'à 128 Mo), 1 à 1 000 morceaux envoyés dans l'ordre, 4 Go maximum, vidéos jusqu'à 10 minutes selon le compte. Sources : https://developers.tiktok.com/doc/content-posting-api-get-started ; https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide

Conséquence : une URL présignée Railway (domaine de Railway, chaîne de requête signée) convient à Instagram et Threads, mais pas à TikTok en PULL_FROM_URL. Pour TikTok, soit FILE_UPLOAD depuis le worker (le fichier transite par le service : 0,05 $ par Go de sortie Railway, soit 0,003 $ pour un clip de 60 Mo), soit un domaine propre (`media.markel-tech.com`) devant un bucket R2 avec préfixe vérifié. Reste à vérifier qu'Instagram accepte sans incident les URL très longues avec chaîne de requête signée : la documentation ne dit rien contre, et R02 l'a déjà prévu, mais aucun test n'a été fait.

## 4. Modèle de DAM par client

### 4.1 Objets et arborescence

Un seul bucket Railway de travail (région ams), un bucket R2 « public et archive » (indice weur, domaine propre), et une arborescence par client :

```
t/{tenant_id}/
  orig/{asset_id}/{sha256}.{ext}        original déposé (sermon, photo produit, logo), conservé
  der/{asset_id}/{variant}/{version}.{ext}   dérivés : audio, proxy 720p, clips 9:16, vignettes, planches
  pub/{post_id}/{variant}.{ext}         copie de publication, courte durée (7 jours après publication)
  exp/{export_id}.zip                   exports de fin de contrat, 30 jours
```

Tables Postgres (toutes avec `tenant_id` non nul et RLS, voir section 5) :

| Table | Rôle | Colonnes clés |
|---|---|---|
| asset | un original ou un dérivé racine | id (UUIDv7), tenant_id, kind (original, derived), source (upload, youtube, higgsfield, gpt_image, canva, remotion, ffmpeg), sha256, bytes, mime, width, height, duration_ms, storage (railway, r2), bucket, key, region, retention_class (keep, 90d, 7d), legal_hold, created_by, deleted_at, purged_at |
| asset_variant | rendu dérivé d'un asset | id, asset_id, variant (audio_mp3, proxy_720, clip_916, thumb, planche_png, sub_ass), version, key, bytes, params_json, parent_variant_id, engine, engine_version |
| asset_rights | droits et consentements | asset_id, rights_kind (owned, licensed, ugc, platform_terms), licence_ref, consent_id (R08), persons_json (visages identifiables), expires_at, territory, usage_allowed_json |
| ai_label | étiquette IA | asset_id, generator (nano_banana, seedance, gpt_image, veo, elevenlabs), prompt_hash, is_aigc (champ TikTok), c2pa_manifest_key, disclosed_at |
| external_ref | identifiants externes | asset_id, system (canva, higgsfield, youtube, meta_container, tiktok_publish, suno, r11_asset_id), external_id, url, synced_at |
| asset_url | URL émises | asset_id, variant_id, purpose (planche, review, publish_ig, publish_threads, publish_tiktok, export), url_hash, expires_at, issued_to, revoked_at |
| retention_job | purge | key, due_at, done_at, verified_at |
| cost_ledger | coût par asset | tenant_id, asset_id, provider, unit, qty, usd_micro, occurred_at |
| audit_log | journal en ajout seul | tenant_id, actor, action, object_type, object_id, before_hash, after_hash, ip, at (partitionné par mois) |

Le `sha256` sur l'original permet la déduplication (le même logo déposé dix fois n'est stocké qu'une fois par client, jamais entre clients) et prouve l'intégrité lors d'un export.

### 4.2 Versions, URL et durées

- Chaque rendu produit une nouvelle `version` ; la précédente reste jusqu'à la purge à 90 jours, ce qui permet au gestionnaire humain (étape 5 de la routine) de comparer deux habillages.
- Planches de propositions : URL présignées GET d'une heure (comme le campus), régénérées à chaque ouverture de la page de validation ; jamais envoyées telles quelles dans WhatsApp (R22), où l'on envoie un lien vers la page de validation qui, elle, redirige vers l'URL signée.
- Publication Instagram et Threads : URL présignée de 48 heures sur la copie `pub/` (le conteneur Meta expire après 24 heures ; 48 heures couvrent une nouvelle tentative), révoquée en base dès `status_code = FINISHED`, objet purgé 7 jours après publication (R02 recommande 7 jours).
- Publication TikTok : FILE_UPLOAD par défaut ; PULL_FROM_URL seulement si le domaine R2 est en place et vérifié.
- Export de fin de contrat : archive dans `exp/`, URL présignée de 30 jours (Railway permet 90), puis purge.
- Lecture par le client des originaux et des rendus validés : toujours via l'application, qui vérifie le rôle puis redirige vers une URL d'une heure.

### 4.3 Politique de rétention

| Classe | Objets | Durée | Mécanisme |
|---|---|---|---|
| keep | originaux (sermons, photos produits, logos, chartes), rendus publiés (une copie finale par post) | durée du contrat, puis export et purge sous 30 jours | pas de purge automatique ; `legal_hold` bloque toute suppression |
| 90d | dérivés intermédiaires, prises non retenues, planches, versions remplacées | 90 jours après création | job pg-boss quotidien (Railway n'a pas de cycle de vie) ; sur R2, règle de cycle de vie par préfixe en doublon |
| 7d | copies `pub/`, uploads temporaires, multipart abandonnés | 7 jours | même job ; R2 abandonne les multipart à 7 jours par défaut |

Un sermon original de 3 Go téléchargé depuis YouTube n'a pas besoin d'être conservé en 1080p si l'église garde la source sur YouTube : un proxy 720p (environ 1 Go) et l'audio suffisent à refaire des clips. Le choix (garder 3 Go ou 1 Go) divise par trois le stockage de la verticale église ; il appartient au contrat.

### 4.4 Chiffrage par client (hypothèses explicites)

Hypothèses de volume (estimations, à recalibrer après trois mois réels) :
- Sermon de 60 minutes : YouTube recommande 8 Mbit/s en 1080p à 30 images par seconde plus 384 kbit/s d'audio, soit environ 3,06 Go par heure en qualité d'envoi ; le flux réellement téléchargé depuis YouTube est généralement plus léger (1,5 à 2,5 Go). On retient 3 Go par sermon par prudence. Source : https://support.google.com/youtube/answer/1722171
- Dérivés par sermon : audio 60 Mo, proxy 720p 1 Go, 5 clips 9:16 de 60 secondes à 8 Mbit/s soit 60 Mo chacun (300 Mo), sous-titres, vignettes, planche : environ 1,5 Go.
- Client beauté : 24 contenus par mois ; originaux déposés 1,6 Go par mois (photos produits, quelques vidéos téléphone) ; rendus 2 Go par mois (variantes d'images gpt-image, 3 prises Seedance par Reel, montages Remotion, planches).

| Poste | Église (4 sermons par mois) | Beauté (24 contenus par mois) |
|---|---|---|
| Originaux ajoutés par mois | 12 Go | 1,6 Go |
| Rendus ajoutés par mois (purgés à 90 jours) | 6 Go | 2 Go |
| Stock au 12e mois | 144 Go d'originaux + 18 Go de rendus = 162 Go | 19 Go + 6 Go = 25 Go |
| Stockage Railway au 12e mois (0,015 $) | 2,43 $ | 0,38 $ |
| Stockage moyen de la première année | environ 1,30 $ par mois | environ 0,25 $ par mois |
| Sortie service vers bucket (0,05 $ par Go, envois des rendus et originaux) | 18 Go : 0,90 $ | 3,6 Go : 0,18 $ |
| Sortie bucket (planches, publications, lectures du client) | gratuite | gratuite |
| Copie R2 des originaux (0,015 $) | 2,16 $ au 12e mois | 0,29 $ |
| Total stockage et transfert au 12e mois | environ 5,50 $ par mois | environ 0,85 $ par mois |
| Variante « proxy 720p seulement » (église) | 48 Go + 18 Go = 66 Go : 1 $ Railway + 0,72 $ R2 | sans objet |

Le stockage d'un client église vaut donc 5 à 6 $ par mois au bout d'un an avec les originaux en 1080p, moins de 2 $ avec des proxys ; un client beauté, moins de 1 $. Même avec 7 églises, le stockage total reste sous 40 $ par mois la première année.

## 5. Isolation multi-locataires : un Postgres, un bucket

### 5.1 Row Level Security Postgres, pilotée par Drizzle

Faits (documentation PostgreSQL) :
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` : sans politique, aucune ligne n'est visible (refus par défaut). Les propriétaires de table contournent les politiques sauf `FORCE ROW LEVEL SECURITY` ; les superutilisateurs et les rôles `BYPASSRLS` contournent toujours. `TRUNCATE` et `REFERENCES` ne sont pas filtrés, et les contrôles d'intégrité référentielle contournent la RLS.
- `USING` filtre la lecture, la mise à jour et la suppression ; `WITH CHECK` contrôle les insertions et les nouvelles valeurs ; les politiques permissives se combinent en OU, les restrictives en ET.
- Les expressions de politique sont évaluées par ligne, avant les conditions de la requête ; une sous-requête dans une politique peut créer une course ; `SET row_security = off` fait échouer une requête qui serait filtrée, ce qui protège un `pg_dump` contre une sauvegarde partielle silencieuse.
Source : https://www.postgresql.org/docs/current/ddl-rowsecurity.html

Faits (Drizzle) : `pgPolicy` avec `as`, `to`, `for`, `using`, `withCheck` ; `pgRole` (avec `.existing()` pour ne pas migrer un rôle du fournisseur) ; `.withRLS()` sur une table ; variables de session posées en SQL brut dans la transaction (`select set_config('...', ..., true)` et `set local role`), remises à zéro à la fin de la transaction. Source : https://orm.drizzle.team/docs/rls

Patron retenu pour la machine :

```sql
-- une fois, en migration (rôle propriétaire : migrator)
create role app_rw nologin;           -- rôle applicatif, non propriétaire, sans BYPASSRLS
grant usage on schema app to app_rw;
grant select, insert, update, delete on all tables in schema app to app_rw;
alter table app.asset enable row level security;
alter table app.asset force row level security;
create policy tenant_isolation on app.asset
  as restrictive
  using (tenant_id = current_setting('app.tenant_id', true)::uuid)
  with check (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

```ts
// à chaque requête, dans Drizzle
await db.transaction(async (tx) => {
  await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
  await tx.execute(sql`set local role app_rw`);
  // ... requêtes du locataire
});
```

Règles :
- Le pool de connexions se connecte avec un rôle de connexion qui peut `SET ROLE app_rw` ; les migrations tournent avec le propriétaire (`migrator`), jamais l'application.
- pg-boss (R07) vit dans son propre schéma `pgboss`, hors RLS ; les charges utiles des jobs ne contiennent que des identifiants, jamais de données client ; le worker rouvre une transaction avec le `tenant_id` du job.
- Les tables de référence partagées (modèles de formats, tarifs) n'ont pas de `tenant_id` et pas de RLS.
- Un test automatisé par table : insérer deux locataires, poser `app.tenant_id` sur l'un, vérifier que `count(*)` ne voit que lui, et qu'une insertion avec l'autre `tenant_id` échoue. Le skill `agents-base-donnees` du dépôt fait précisément ce genre de batterie.
- `current_setting(..., true)` renvoie NULL sans variable posée : la politique échoue alors proprement (aucune ligne) au lieu de laisser passer.

### 5.2 Isolation du bucket

- Un bucket par environnement, préfixe `t/{tenant_id}/` par client ; la clé S3 est toujours construite par une fonction unique `keyFor(tenantId, ...)` et validée par une expression régulière avant tout `GetObject`, `PutObject` ou `DeleteObject`.
- Railway ne permet qu'un couple de clés par bucket, sans politique IAM par préfixe : l'isolation est donc applicative, pas infrastructurelle. Si un client exige une isolation forte (contrat, audit), lui créer un bucket dédié (coût nul, variables séparées) ou un bucket R2 avec jeton restreint à ce bucket.
- Les URL présignées sont des jetons porteurs : les journaliser (hash), ne jamais les écrire dans un journal applicatif en clair, et les garder courtes.

### 5.3 Clé de données par client (R02)

Enveloppe à deux niveaux : une clé maître (KEK) en variable Railway du service, jamais en base ; une clé de données (DEK) AES-256-GCM par client, générée à la création du locataire, stockée chiffrée par la KEK dans `tenant_key` (avec `version`, `rotated_at`). Les jetons OAuth (R02), les clés fournies par un client (BYOK) et les numéros WhatsApp (R22) sont chiffrés avec la DEK du client. La rotation de la KEK rechiffre toutes les DEK (quelques lignes) ; la rotation d'une DEK rechiffre les secrets d'un seul client. Les médias ne sont pas chiffrés applicativement : le chiffrement au repos du bucket suffit, et chiffrer soi-même casserait les URL présignées.

### 5.4 Journal d'audit

Table `audit_log` en ajout seul (trigger qui interdit UPDATE et DELETE au rôle applicatif), partitionnée par mois, avec `before_hash` et `after_hash` des lignes modifiées, l'acteur (humain, agent Claude, job), l'adresse et l'identifiant de session de l'agent (R07 propose déjà des hooks d'audit). Événements obligatoires : émission d'une URL présignée, publication, suppression, export, changement de clé, connexion OAuth, dépassement de plafond. Conservation 13 mois, puis archivage en Parquet dans R2.

### 5.5 Export et suppression de fin de contrat

Obligations :
- RGPD, article 28 (3) g : à la fin de la prestation, le sous-traitant « supprime ou renvoie » toutes les données personnelles au choix du responsable et détruit les copies ; (h) : il contribue aux audits ; article 28 (4) : un sous-traitant ultérieur (OpenAI, Google, Higgsfield, Railway, Cloudflare) doit être lié par les mêmes obligations et le sous-traitant initial reste pleinement responsable. Article 17 : effacement « dans les meilleurs délais », réponse sous un mois (article 12). Article 20 : portabilité « dans un format structuré, couramment utilisé et lisible par machine ». Sources : https://gdpr-info.eu/art-28-gdpr/ ; https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3
- Loi 25 (Québec) : destruction ou anonymisation une fois la finalité accomplie, droit à la portabilité en vigueur depuis le 22 septembre 2024, évaluation des facteurs relatifs à la vie privée avant communication hors Québec, registre des incidents ; les pages officielles (CAI, LégisQuébec, quebec.ca) ont toutes refusé le chargement (403 ou 404) le 2 octobre 2026, comme déjà noté dans R08 ; les montants de sanction circulant (jusqu'à 10 millions de dollars ou 2 % du chiffre d'affaires mondial en sanction administrative, 25 millions ou 4 % au pénal) restent à vérifier sur le texte.
- Loi ivoirienne 2013-450 du 19 juillet 2013 : déclaration préalable à l'ARTCI pour la plupart des traitements (article 5), autorisation préalable pour les données sensibles, biométriques et les transferts transfrontaliers (article 7, réponse sous un mois, silence vaut rejet), information des personnes y compris sur la durée de conservation (article 28), conservation limitée à la finalité (article 16), transferts seulement vers un pays de protection équivalente avec autorisation de l'ARTCI (article 26), obligation de sécurité (article 40), pas d'obligation légale de notification de violation ; sanctions aux articles 49 et suivants (avertissement, mise en demeure, sanctions pécuniaires, suspension, sanctions pénales), montants non lus. Source : https://www.dlapiperdataprotection.com/index.html?t=law&c=CI

Procédure de fin de contrat, exécutée par un job pg-boss `tenant_offboard` :
1. Gel : `legal_hold` levé, publications programmées annulées, jetons OAuth révoqués côté plateformes puis effacés.
2. Export : `manifest.json` (assets, variantes, droits, étiquettes IA, calendrier, métriques, journal d'audit filtré) + médias de classe keep, en ZIP dans `exp/`, somme de contrôle SHA-256, URL présignée de 30 jours, ou copie directe vers un bucket fourni par le client (S3 compatible).
3. Suppression : `LIST` du préfixe `t/{tenant_id}/` en boucle, `DeleteObjects` par lots, nouveau `LIST` qui doit revenir vide ; suppression des lignes Postgres par `tenant_id` (RLS désactivée pour ce job avec le rôle `migrator`, sous journalisation) ; suppression des copies R2 ; suppression de la DEK (ce qui rend illisible tout secret résiduel).
4. Attestation : PDF signé listant ce qui a été exporté, supprimé et vérifié, avec les dates, conservé 5 ans hors du préfixe du client.
5. Sous-traitants : demander la suppression chez les fournisseurs qui conservent des données (Higgsfield conserve les générations dans le compte ; OpenAI conserve 30 jours par défaut hors option zéro rétention, à vérifier dans R08).
6. Les sauvegardes (instantanés 89 jours, PITR 4 semaines, dumps hebdomadaires) contiennent encore le client jusqu'à leur expiration : l'attestation le dit explicitement, et les dumps hors Railway sont chiffrés avec une clé qu'on fait tourner après chaque offboarding.

### 5.6 Sauvegardes et restauration testée

| Couche | Quoi | Fréquence et rétention | Coût estimé |
|---|---|---|---|
| Instantanés de volume Postgres | volume entier | quotidien 6 jours, hebdomadaire 27 jours, mensuel 89 jours | données uniques au prix du volume : 1 à 3 $ par mois pour 20 Go |
| PITR Postgres | WAL vers bucket Railway | fenêtre d'environ 4 semaines | quelques Go par jour compressés : 20 à 60 Go-mois, 0,30 à 0,90 $ ; sortie 0,05 $ par Go |
| Dump logique hors Railway | `pg_dump --format=custom`, chiffré, vers R2 | hebdomadaire, 12 semaines, puis mensuel 12 mois | moins de 1 $ |
| Originaux (classe keep) | copie vers R2 à l'ingestion, verrou de bucket 90 jours | continue | 0,015 $ par Go-mois |
| Rendus (classe 90d) | pas de copie | aucune | 0 $ |
| Exercice de restauration | restaurer le dernier dump dans une base de brouillon, compter les lignes, ouvrir trois URL présignées sur la copie R2, chronométrer | trimestriel, consigné dans `audit_log` | 1 heure d'humain |

Sources : https://docs.railway.com/reference/backups ; https://docs.railway.com/volumes/point-in-time-recovery ; https://docs.railway.com/guides/postgres-backups-restores

Railway affiche SOC 2 Type 2, SOC 3, HIPAA, RGPD, les cadres EU-US et Swiss-US Data Privacy Framework, un DPA disponible, « Encryption-at-rest », une infrastructure sur Google Cloud Platform, et un objectif de temps de reprise de 60 minutes. Cloudflare figure parmi ses sous-traitants. Source : https://trust.railway.com/

## 6. Où tourne le rendu vidéo lourd

### 6.1 Trois options, avec prix lus le 2 octobre 2026

| Option | Prix | Limites | Convient à |
|---|---|---|---|
| Conteneur Railway (ffmpeg, libass, MediaPipe) | 20 $ par vCPU-mois (0,0278 $ par vCPU-heure), 10 $ par Go-mois de RAM (0,0139 $ par Go-heure), à la minute sur usage réel | pas de GPU ; jusqu'à 24 vCPU et 24 Go par réplica sur Pro | découpe, recadrage, sous-titres incrustés, extraction audio, proxys, concaténation |
| Remotion Lambda (AWS) | Lambda x86 0,0000166667 $ par Go-seconde et 0,20 $ par million de requêtes (eu-west-3 Paris listé par Remotion à 0,00001333 $, af-south-1 Le Cap à 0,00001768 $) ; exemples Remotion : 1 minute avec vidéo incrustée 0,017 à 0,021 $ en 15 à 19 secondes, 10 minutes HD 0,10 à 0,11 $ en 56 à 61 secondes, 10 secondes 4K 0,013 $ en 45 à 53 secondes (2 048 Mo, us-east-1) | 10 Go de disque (sortie limitée à environ 5 Go, 2 heures Full HD), 15 minutes de timeout (80 minutes Full HD maximum), 1 000 lambdas concurrentes par région par défaut, pas d'AV1 ; fonction et bucket dans la même région | habillage animé (textes, versets, logos, chiffres), planches, motion design programmé |
| GPU loué à la seconde | RunPod serverless 24 Go (4090, L4) 0,69 $ par heure, 80 Go A100 2,72 $, H100 4,79 $ ; pods communautaires RTX 4090 0,34 $, L4 0,44 $, A100 1,19 $ ; Modal T4 0,59 $ par heure, L4 0,80 $, A10 1,10 $, L40S 1,95 $, A100 80 Go 2,50 $, H100 3,95 $ ; Modal CPU 0,047 $ par cœur-heure, RAM 0,008 $ par Gio-heure, 30 $ de crédits par mois (Starter) ; fal H100 4,50 $ par heure en liste, 2,49 $ négocié | démarrage à froid, images Docker à maintenir, licence pyannote (R05) | WhisperX auto-hébergé, recadrage par détection de visage lourd, modèles ouverts (LTX-2) |

Sources : https://docs.railway.com/reference/pricing/plans ; https://www.remotion.dev/docs/lambda ; https://www.remotion.dev/docs/lambda/cost-example ; https://www.remotion.dev/docs/lambda/region-selection ; https://aws.amazon.com/lambda/pricing/ ; https://www.runpod.io/pricing (mise à jour du 27 septembre 2026) ; https://www.modal.com/pricing ; https://fal.ai/pricing

Licence Remotion : gratuite pour les particuliers et les entreprises de 3 personnes au plus, usage commercial et illimité ; Creators 25 $ par mois et par siège ; Automators 0,01 $ par rendu avec minimum 100 $ par mois (10 000 rendus inclus), sans siège pour les développeurs ; Enterprise à partir de 500 $ par mois. Les entreprises qui rendent sur le cloud doivent acheter des Cloud Rendering Units. Source : https://www.remotion.pro/license

### 6.2 Lot de 5 clips de sermon : temps et coût

Chaîne (R05) : téléchargement YouTube (3 Go, ingress gratuit sur Railway), extraction audio, transcription par API (Scribe v2 0,22 $ par heure, ou équivalent), choix des moments par Claude, découpe, recadrage 9:16, sous-titres mot à mot, habillage, 5 fichiers de 60 secondes.

| Étape | Railway CPU (4 vCPU, 8 Go) | Remotion Lambda | GPU loué |
|---|---|---|---|
| Transcription 60 minutes | API 0,22 $ (ElevenLabs Scribe), 2 à 5 minutes | sans objet | WhisperX à 25 à 30 fois le temps réel (R05) : 2 à 3 minutes plus démarrage, 0,03 à 0,05 $ sur RunPod 24 Go à 0,69 $ par heure |
| Découpe et recadrage de 5 minutes de vidéo | ffmpeg x264 preset veryfast 1080p : estimation 2 à 4 fois le temps réel sur 4 vCPU, soit 1,5 à 2,5 minutes de calcul ; 4 vCPU x 0,04 h x 0,0278 $ + 8 Go x 0,04 h x 0,0139 $ = environ 0,01 $ | sans objet | inutile |
| Sous-titres incrustés (libass) | compris dans l'encodage ci-dessus | sans objet | inutile |
| Habillage animé (bandeau, verset, logo) | Remotion en CPU sur le conteneur : estimation 0,5 à 1 fois le temps réel, 5 à 10 minutes de 4 vCPU, environ 0,03 $ | 5 rendus d'une minute en parallèle : 5 x 0,02 $ = 0,10 $, moins d'une minute | inutile |
| Envoi des 5 clips vers le bucket | 300 Mo x 0,05 $ = 0,015 $ | S3 AWS vers Railway : sortie AWS environ 0,09 $ par Go, 0,03 $ | idem |
| Total par lot | 0,25 à 0,30 $ et 10 à 20 minutes, dont 0,22 $ d'API de transcription | 0,35 à 0,40 $ et 5 à 8 minutes | 0,10 à 0,15 $ et 8 à 15 minutes, mais avec un conteneur GPU à maintenir |

Les temps ffmpeg et Remotion-CPU sont des estimations, pas des mesures : à chronométrer sur un sermon réel dès la première semaine. La conclusion ne change pas : un lot de 5 clips coûte moins de 0,50 $ quelle que soit l'option, et ce qui compte, c'est le délai (le dimanche soir, l'église veut ses clips le lundi matin) et la simplicité d'exploitation. D'où le choix : ffmpeg sur Railway pour tout ce qui est découpe et sous-titres, Remotion Lambda pour l'habillage animé dès que la licence ou le volume le justifient (en dessous de 3 personnes, Remotion en CPU sur Railway est gratuit et suffisant), GPU loué uniquement au-delà de 200 heures d'audio par mois.

Dimensionnement du worker de rendu Railway : 4 vCPU et 8 Go en limite de réplica, mode Serverless activé (il dort entre deux lots), file pg-boss `rendu` à concurrence 1 par réplica, deux réplicas au-delà de 10 clients. Coût d'un worker qui travaille 2 heures par jour à 4 vCPU : 4 x 60 h x 0,0278 $ + 8 x 60 h x 0,0139 $ = 6,70 $ + 6,70 $ = environ 13 $ par mois.

## 7. Sécurité des connecteurs et plafonds de dépense

### 7.1 Ce que permettent les fournisseurs

| Fournisseur | Isolation par client | Plafond de dépense | Rotation | Source |
|---|---|---|---|---|
| OpenAI (gpt-image, gpt-4o-mini) | projets séparés dans l'organisation, clés par projet, limites de débit et de dépense par projet | alertes de dépense à un montant choisi ; « hard spend limits » mensuels qui coupent le trafic API ; les administrateurs imposent une durée de vie maximale des clés par organisation ou projet | expiration à la création « fortement recommandée » et rotation régulière ; suivi d'usage par clé depuis le 20 décembre 2023 | https://developers.openai.com/api/docs/guides/production-best-practices |
| Gemini (vignettes YouTube) | chaque clé est liée à un projet Google Cloud qui porte la facturation ; 10 projets maximum dans AI Studio ; clés « auth » liées à un compte de service par défaut depuis le 28 mai 2026, les clés standard non restreintes sont refusées | pas de plafond propre à l'API ; alertes de facturation Google Cloud recommandées | créer la nouvelle clé, basculer, désactiver l'ancienne ; restrictions par origine ou par API | https://ai.google.dev/gemini-api/docs/api-key |
| fal (Seedance, LTX, Whisper) | facturation à l'usage par modèle ou par seconde GPU | aucun plafond ni budget documenté sur la page de prix publique | non documentée | https://fal.ai/pricing |
| ElevenLabs (Scribe 0,22 $ par heure, voix) | plans à crédits (Starter 6 $, Creator 22 $, Pro 99 $, Scale 299 $, Business 990 $ par mois) | pas de plafond par clé documenté ; limites de débit personnalisées en Enterprise | non documentée | https://elevenlabs.io/pricing/api |
| Higgsfield (Unlimited, piloté par navigateur) | un compte, pas d'API chez José | abonnement forfaitaire, pas de dérapage possible, mais pas de compteur par client non plus | sans objet | R04 |
| Anthropic (Agent SDK) | `maxBudgetUsd` par job, budgets de session en cents | oui, par job et par session | clés d'organisation | R07 |

### 7.2 Modèle retenu

1. Clés partagées, propriété de l'agence, par fournisseur, en variables Railway du seul service `worker` (jamais du service web), une variable par fournisseur et par environnement. Les clients ne voient jamais une clé. Un client qui exige ses propres clés (BYOK, cas d'une école ou d'une entreprise avec contrat OpenAI) les dépose dans l'interface, elles sont chiffrées avec sa DEK et utilisées à sa place.
2. OpenAI : un projet « machine-prod » avec plafond mensuel dur égal à 1,5 fois le budget prévu de tous les clients, plus un projet dédié pour tout client dont le budget dépasse 100 $ par mois, avec son propre plafond dur. Clés avec expiration à 90 jours, rotation par un job qui lit la nouvelle clé dans Railway et marque l'ancienne.
3. Registre de dépense interne `cost_ledger` (section 4.1), alimenté avant et après chaque appel : réservation du coût estimé, puis écriture du coût réel. Plafonds par client : jour, mois, et par type (images, vidéo, transcription, jetons Claude). Un appel qui dépasserait le plafond est refusé par le worker, le job est mis en attente « plafond atteint » et le gestionnaire reçoit une alerte WhatsApp (CallMeBot, R22). C'est le seul moyen de plafonner fal, ElevenLabs et Gemini par client, puisqu'ils ne le font pas.
4. Plafonds par défaut au contrat : église 15 $ par jour et 60 $ par mois ; beauté 10 $ par jour et 120 $ par mois ; valeurs dérivées des budgets de R04 (moins de 110 $ par mois pour 12 Reels, 8 carrousels et 4 UGC) et R08 (poste qui dérape : la génération).
5. Rotation : 90 jours pour toutes les clés fournisseurs, immédiate en cas de doute, et obligatoire après le départ d'un collaborateur ; `railway bucket credentials --reset` pour les buckets ; rotation de la KEK une fois par an.
6. Journal : chaque appel fournisseur écrit `provider`, `model`, `tenant_id`, `asset_id`, `usd_micro`, `latency_ms`, `status` ; une vue par client alimente la facture et la revue mensuelle (doctrine de José, mesure en 3 couches).

## 8. Facture d'infrastructure mensuelle : 6 puis 20 clients

Hypothèses : plan Pro (20 $, crédités), région EU West pour tout, 2 églises et 4 autres clients à 6 clients ; 7 églises et 13 autres à 20 clients ; consommations CPU et RAM moyennes (Railway facture la consommation réelle à la minute) ; stockage au 12e mois ; hors génération IA, hors jetons Claude, hors licence Remotion et hors API unifiée de publication (R02).

| Poste | 6 clients | 20 clients |
|---|---|---|
| Plan Pro (couvert par le crédit inclus) | 20 $ (0 $ net si l'usage dépasse 20 $) | 20 $ (0 $ net) |
| Service web (API Express + React) : 0,5 vCPU, 1 Go | 10 + 10 = 20 $ | 1 vCPU, 2 Go : 40 $ |
| Postgres : 0,25 vCPU, 1 Go, 5 Go de volume | 5 + 10 + 0,75 = 16 $ | 0,5 vCPU, 2 Go, 20 Go : 33 $ |
| Worker agents (pg-boss, Claude Agent SDK, veille) : 0,5 vCPU, 2 Go | 10 + 20 = 30 $ | 1,5 vCPU, 4 Go : 70 $ |
| Worker rendu (ffmpeg, Remotion CPU) : 4 vCPU, 8 Go, serverless, 2 h par jour | 13 $ | 6 h par jour, 2 réplicas : 40 $ |
| Buckets Railway (originaux + rendus) | 2 x 162 + 4 x 25 = 424 Go : 6,40 $ | 7 x 162 + 13 x 25 = 1 459 Go : 22 $ |
| Copie R2 des originaux | 2 x 144 + 4 x 19 = 364 Go : 5,50 $ | 1 255 Go : 19 $ |
| PITR et instantanés | 2 $ | 5 $ |
| Sortie réseau des services (envois vers buckets, API des plateformes) | 2 x 18 + 4 x 4 = 52 Go : 2,60 $ | 178 Go : 9 $ |
| Remotion Lambda (habillage, 10 lots par mois à 6 clients, 40 à 20) | 1 $ | 4 $ |
| Total usage | environ 97 $ | environ 242 $ |
| Fourchette réaliste (consommations réelles entre 0,7 et 1,3 fois les hypothèses) | 85 à 110 $ par mois | 230 à 290 $ par mois |
| Par client | 14 à 18 $ | 12 à 15 $ |

Hors de cette facture mais à provisionner :
- Licence Remotion Automators : 100 $ par mois minimum dès que l'effectif dépasse 3 personnes ou que la plateforme vend des rendus automatisés à des clients (voir incertitudes).
- Génération IA : 3 à 8 $ par vidéo générée, 0,05 à 0,50 $ par vidéo programmée (R04) ; jetons Claude environ 0,45 $ par calendrier mensuel et 0,14 $ par sermon analysé (R07).
- Domaine propre sur Cloudflare pour R2 : zone gratuite, R2 sous le palier gratuit de 10 Go puis 0,015 $ par Go.
- Variante « proxys 720p au lieu des originaux 1080p » pour les églises : retire 15 à 20 $ par mois à 20 clients.

Ordre de grandeur de contrôle : à 20 clients, l'infrastructure coûte environ 250 $ par mois pour un chiffre d'affaires que R01 situe entre 300 et 1 500 $ par client et par mois ; elle pèse moins de 2 % des revenus. Le poste à surveiller est bien la génération, pas l'hébergement.

## 9. Décisions de schéma à prendre avant la première migration

1. Identifiants : UUIDv7 partout (triables par temps, générés côté application), `tenant_id` UUID non nul sur chaque table métier, clé primaire composite `(tenant_id, id)` sur les tables volumineuses pour que l'index serve la RLS.
2. Rôles Postgres : `migrator` (propriétaire, migrations Drizzle), `app_rw` (application, `FORCE ROW LEVEL SECURITY` sur toutes les tables métier, sans `BYPASSRLS`), `app_ro` (tableaux de bord et exports), `backup` (lecture, `row_security = off` pour que `pg_dump` échoue plutôt que de produire une sauvegarde partielle). Décider dès la première migration, car ajouter la RLS après coup impose de revoir chaque requête.
3. Variable de session : `app.tenant_id` posée par `set_config(..., true)` dans chaque transaction, et `app.actor_id` pour l'audit ; politique restrictive unique par table, générée par un helper Drizzle pour ne jamais l'oublier.
4. Schémas : `app` (métier, RLS), `pgboss` (files, hors RLS), `audit` (ajout seul, partitionné par mois), `ref` (données partagées sans RLS).
5. Asset et variantes : séparer `asset` (origine, droits, rétention) de `asset_variant` (rendus versionnés) ; `sha256` unique par `(tenant_id, sha256)` ; `storage` en enum (railway, r2) avec `bucket`, `key`, `region` explicites pour pouvoir migrer un client ou un fournisseur sans réécrire les clés.
6. Rétention : `retention_class` en enum (keep, 90d, 7d), `expires_at` calculé à l'insertion, `legal_hold` booléen, `deleted_at` (suppression logique) distinct de `purged_at` (objet réellement supprimé et vérifié).
7. Droits et consentements : `asset_rights` et `consent` (R08) référencés par clé étrangère ; aucune publication possible si un visage identifiable est enregistré sans consentement (contrainte applicative dans le juge de R07, et vue SQL `publishable_assets`).
8. Étiquette IA : table `ai_label` avec `is_aigc` (champ TikTok), générateur, version, hash du prompt, et place pour un manifeste C2PA ; décider maintenant si l'étiquette est au niveau de l'asset ou de la variante (recommandé : variante, car un montage mêle réel et généré).
9. Identifiants externes : table `external_ref` polymorphe (Canva, Higgsfield, YouTube, conteneurs Meta, publish_id TikTok, asset_ids de R11) plutôt que des colonnes par système.
10. URL émises : table `asset_url` avec `url_hash`, `purpose`, `expires_at`, `revoked_at` ; ne jamais stocker l'URL signée en clair.
11. Argent : `usd_micro` en entier (bigint), jamais de flottant ; `cost_ledger` avec réservation puis réalisation ; table `tenant_budget` (jour, mois, par type) consultée par le worker avant chaque appel.
12. Secrets : `tenant_key` (DEK chiffrée par la KEK, version), `tenant_secret` (jetons OAuth, BYOK) chiffrés avec AES-256-GCM, nonce et tag stockés, `key_version` pour la rotation.
13. Temps : `timestamptz` partout, fuseau de référence par client (Abidjan GMT, Toronto, Montréal) stocké dans `tenant.timezone` pour la planification et les rapports.
14. Partitionnement : `audit_log` et `cost_ledger` partitionnés par mois dès le départ (pas de migration de partitionnement a posteriori).
15. Suppression de locataire : fonction SQL `purge_tenant(tenant_id)` exécutée par `migrator` sous journalisation, et job de suppression S3 idempotent ; les clés étrangères en `ON DELETE RESTRICT` par défaut, `CASCADE` seulement sur les tables purement dépendantes.
16. Régions : `tenant.data_region` (eu, ca) même si tout est à Amsterdam au départ, pour pouvoir honorer plus tard une exigence québécoise ou ivoirienne sans refonte.
17. Tests : batterie d'isolation automatisée (deux locataires, chaque table, chaque rôle) exécutée à chaque migration ; le skill `agents-base-donnees` du dépôt la génère.

## 10. Incertitudes et points à vérifier

1. Taille maximale d'un objet dans un bucket Railway : non publiée ; tester un envoi multipart de 5 Go avant d'ingérer des sermons en 1080p.
2. Latence Abidjan vers Amsterdam : aucune mesure chargée (wondernetwork et cloudping en 503 ou 404) ; mesurer depuis une connexion ivoirienne avant d'arrêter la région.
3. Limite de volume du plan Pro : la page des plans dit 1 To, la page des volumes dit 50 Go puis libre-service jusqu'à 1 To ; sans effet ici (Postgres de 20 Go), mais à relire.
4. Instagram et URL présignées très longues : la documentation exige seulement un serveur public ; aucun test n'a été fait avec une URL signée Railway de plusieurs centaines de caractères.
5. TikTok PULL_FROM_URL et R2 : la vérification de préfixe d'URL sur un domaine propre devant R2 n'a pas été testée ; FILE_UPLOAD reste la voie sûre.
6. Licence Remotion : « jusqu'à 3 personnes » ; comment Remotion compte les sous-traitants, et si une plateforme qui vend des rendus automatisés à des clients relève d'Automators (100 $ par mois minimum) même à 3 personnes. Question déjà ouverte dans R04 et R05.
7. Temps de rendu ffmpeg et Remotion en CPU sur Railway : estimations, pas de mesure ; chronométrer un sermon réel.
8. Prix Lambda régionaux : Remotion liste eu-west-3 à 0,00001333 $ par Go-seconde, en dessous du prix AWS standard de 0,0000166667 $ ; vérifier sur la grille AWS par région avant chiffrage.
9. Backblaze B2 : la page des régions et celle des fonctionnalités n'ont pas chargé (404) ; régions et Object Lock cités de mémoire, non confirmés ce jour.
10. Loi 25 : aucune page officielle n'a chargé (CAI, LégisQuébec, quebec.ca en 403 ou 404) ; les montants de sanction et la date du droit à la portabilité restent à confirmer sur le texte.
11. Loi 2013-450 : lue via DLA Piper, pas sur le site de l'ARTCI (404) ; montants des sanctions non lus ; vérifier si une déclaration à l'ARTCI est due pour une agence étrangère traitant des données de résidents ivoiriens pour le compte de clients ivoiriens.
12. fal et ElevenLabs : aucun plafond de dépense par clé ou par projet trouvé sur les pages publiques ; vérifier dans les tableaux de bord connectés.
13. Projets OpenAI : nombre maximal de projets par organisation non lu (page d'aide en 403).
14. Railway Buckets : « public buckets » annoncés comme fonctionnalité demandée ; si elle arrive, le domaine R2 devient optionnel. Suivre le changelog.
15. Hypothèses de volume par client (3 Go par sermon, 1,5 Go de dérivés, 2 Go de rendus beauté) : à recalibrer sur trois mois réels ; l'écart ne change pas l'ordre de grandeur (le stockage reste sous 40 $ par mois à 20 clients).
16. Taille des flux YouTube réellement téléchargés : 1,5 à 2,5 Go par heure en 1080p est une observation d'usage, pas une donnée officielle.

## 11. Implications pour la machine de José

1. Rester sur Railway pour tout le cœur (API, Postgres, workers, bucket de travail), en région EU West Amsterdam, bucket `ams` : c'est la région la plus proche d'Abidjan (5 300 km) et le campus y est déjà ; aucun autre hébergeur n'apporte assez pour justifier un deuxième tableau de bord. Un seul projet Railway « machine » séparé du projet « Groupe 2iae » pour que les règles de déploiement du campus (CLAUDE.md) ne soient jamais en cause.
2. Ajouter un bucket Cloudflare R2 avec domaine propre (`media.markel-tech.com`, zone Cloudflare) pour deux usages précis : copie des originaux (verrou de bucket 90 jours, cycle de vie natif) et URL publiques stables pour TikTok PULL_FROM_URL et toute plateforme qui refuserait une URL signée. Coût sous 20 $ par mois à 20 clients, point de présence à Abidjan.
3. Servir Instagram et Threads avec des URL présignées Railway de 48 heures sur une copie `pub/`, révoquées après `FINISHED`, purgées à 7 jours ; TikTok en FILE_UPLOAD par défaut (4 Go, morceaux de 5 à 64 Mo). Tester dès la première semaine qu'un conteneur Instagram accepte l'URL signée.
4. Écrire la rétention soi-même : Railway n'a ni cycle de vie ni versionnage. Un job pg-boss quotidien `retention_purge` qui lit `expires_at`, supprime, vérifie par `HEAD` et écrit `purged_at`. Sur R2, doubler par une règle de cycle de vie par préfixe.
5. Décider au contrat ce que l'on garde d'un sermon : l'original 1080p (3 Go, 2,40 $ par mois par église au bout d'un an) ou un proxy 720p plus l'audio (1 Go). L'église garde la source sur YouTube ; le proxy suffit pour refaire des clips.
6. Un seul Postgres avec RLS forcée, rôle applicatif non propriétaire, variable `app.tenant_id` posée par Drizzle dans chaque transaction, batterie d'isolation automatisée à chaque migration. Pas de base par client : la facture et l'exploitation exploseraient, sans gain réel de sécurité pour des clients de cette taille.
7. Clé de données par client (AES-256-GCM, enveloppée par une KEK en variable Railway) pour les jetons OAuth, les clés BYOK et les numéros WhatsApp ; médias non chiffrés applicativement, le chiffrement au repos du bucket suffit et les URL présignées restent possibles.
8. Trois couches de sauvegarde dès le premier jour : instantanés de volume (quotidien, hebdomadaire, mensuel), PITR activé immédiatement (la fenêtre ne commence qu'à l'activation), et `pg_dump` hebdomadaire chiffré vers R2, car seul le dump logique survit à la suppression du projet. Exercice de restauration trimestriel, chronométré, consigné.
9. Procédure de fin de contrat outillée (job `tenant_offboard`) : export ZIP avec manifeste et sommes de contrôle, suppression vérifiée du préfixe S3 et des lignes, suppression de la DEK, attestation PDF, demandes de suppression aux sous-traitants. C'est l'article 28 (3) g du RGPD, et la même exigence vaut pour la loi 25 et la loi 2013-450 ; c'est aussi un argument commercial face aux agences qui gardent tout.
10. Rendu : ffmpeg et libass sur un worker Railway de 4 vCPU et 8 Go en mode Serverless (environ 13 $ par mois pour 2 heures de travail par jour) ; Remotion en CPU sur ce même worker tant que l'effectif reste à 3 personnes au plus ; Remotion Lambda (0,10 $ le lot de 5 clips, moins d'une minute) quand le délai ou la licence l'imposent ; pas de GPU loué avant 200 heures d'audio par mois.
11. Mettre le worker de rendu et le worker d'agents dans des services séparés : le rendu sature le CPU, l'agent attend des API ; des limites de réplica distinctes évitent qu'un sermon de 2 heures ne ralentisse la veille de tous les clients.
12. Clés IA partagées, propriété de l'agence, en variables du seul service worker ; projet OpenAI avec plafond dur mensuel et clés expirant à 90 jours ; plafonds par client et par jour tenus dans `cost_ledger` et vérifiés avant chaque appel, puisque fal, ElevenLabs et Gemini ne plafonnent pas par clé. Alerte WhatsApp au gestionnaire quand un client atteint 80 % de son plafond.
13. Limite de dépense dure Railway à 1,5 fois la facture attendue (150 $ à 6 clients, 400 $ à 20) avec alerte douce à 1,2 fois ; c'est le filet contre un worker qui boucle.
14. Joindre Postgres et les autres services uniquement par le réseau privé `railway.internal` ; l'URL publique de la base reste désactivée. Chaque Go sorti coûte 0,05 $ et, surtout, une base exposée publiquement est un risque inutile.
15. Mesurer avant d'optimiser : chronométrer le premier sermon (téléchargement, encodage, habillage), relever la taille réelle des originaux et des rendus par client pendant trois mois, puis recalibrer les tableaux de la section 8. Le stockage restera sous 2 % du chiffre d'affaires ; le temps de l'équipe vaut plus que ces dollars.
16. Documenter par client la liste des sous-traitants et la région (Railway Amsterdam, Cloudflare, OpenAI, Google, Higgsfield, ElevenLabs, Anthropic) dans la page de confidentialité (R08) ; pour un client québécois, faire l'évaluation avant communication hors Québec ; pour un client ivoirien, vérifier avec l'ARTCI la formalité de déclaration et l'autorisation de transfert.
17. Prévoir dans le schéma `tenant.data_region` et `asset.storage` dès la première migration : si un jour un client exige l'hébergement au Canada ou en Côte d'Ivoire, on ajoute un bucket et on migre un préfixe, sans refonte.
18. Garder la facture d'infrastructure à part de la facture de génération dans les rapports mensuels aux clients : 12 à 18 $ par client et par mois d'hébergement, contre 50 à 150 $ de génération ; c'est le poste de génération qu'il faut rendre visible et plafonner, pas l'hébergement.

## 12. Sources consultées

Pages ouvertes le 2 octobre 2026 :
- Railway : https://railway.com/pricing ; https://docs.railway.com/reference/pricing/plans ; https://docs.railway.com/reference/volumes ; https://docs.railway.com/reference/regions ; https://docs.railway.com/reference/backups ; https://docs.railway.com/volumes/point-in-time-recovery ; https://docs.railway.com/guides/postgres-backups-restores ; https://docs.railway.com/storage-buckets ; https://docs.railway.com/storage-buckets/billing ; https://docs.railway.com/storage-buckets/uploading-serving ; https://docs.railway.com/cli/bucket ; https://docs.railway.com/data-storage ; https://docs.railway.com/pricing/cost-control ; https://docs.railway.com/pricing/understanding-your-bill ; https://docs.railway.com/pricing/faqs ; https://docs.railway.com/reference/app-sleeping ; https://docs.railway.com/reference/scaling ; https://docs.railway.com/reference/private-networking ; https://docs.railway.com/guides/postgresql ; https://railway.com/changelog ; https://trust.railway.com/
- Cloudflare : https://developers.cloudflare.com/r2/pricing/ ; https://developers.cloudflare.com/r2/platform/limits/ ; https://developers.cloudflare.com/r2/buckets/public-buckets/ ; https://developers.cloudflare.com/r2/reference/data-location/ ; https://developers.cloudflare.com/r2/reference/data-security/ ; https://developers.cloudflare.com/r2/api/s3/presigned-urls/ ; https://developers.cloudflare.com/r2/api/tokens/ ; https://developers.cloudflare.com/r2/buckets/object-lifecycles/ ; https://developers.cloudflare.com/r2/reference/durability/ ; https://developers.cloudflare.com/r2/buckets/bucket-locks/ ; https://developers.cloudflare.com/r2/buckets/cors/ ; https://developers.cloudflare.com/r2/data-migration/sippy/ ; https://www.cloudflare.com/network/
- Backblaze et Bunny : https://www.backblaze.com/cloud-storage/pricing ; https://www.backblaze.com/docs/cloud-storage-large-files ; https://bunny.net/pricing/ ; https://bunny.net/pricing/storage/ ; https://bunny.net/pricing/stream/
- Rendu et GPU : https://www.remotion.dev/docs/lambda ; https://www.remotion.dev/docs/lambda/cost-example ; https://www.remotion.dev/docs/lambda/region-selection ; https://www.remotion.pro/license ; https://aws.amazon.com/lambda/pricing/ ; https://www.runpod.io/pricing ; https://www.modal.com/pricing ; https://fal.ai/pricing ; https://elevenlabs.io/pricing/api
- Connecteurs : https://developers.openai.com/api/docs/guides/production-best-practices ; https://ai.google.dev/gemini-api/docs/api-key
- Base de données : https://www.postgresql.org/docs/current/ddl-rowsecurity.html ; https://orm.drizzle.team/docs/rls ; https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html
- Plateformes : https://developers.facebook.com/docs/instagram-platform/content-publishing ; https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media ; https://developers.tiktok.com/doc/content-posting-api-get-started ; https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide ; https://support.google.com/youtube/answer/1722171
- Droit : https://gdpr-info.eu/art-28-gdpr/ ; https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre3 ; https://www.dlapiperdataprotection.com/index.html?t=law&c=CI
- Interne : campus/RAILWAY.md (lecture seule) ; rapports R02, R04, R05, R07, R08 de ce dossier.

Pages tentées sans succès (403, 404, 503) : docs.railway.com/reference/buckets et /guides/buckets (anciennes adresses), railway.com/blog/buckets, remotion.dev/docs/lambda/cost et /docs/license, remotion.pro/pricing, help.openai.com (projets), cai.gouv.qc.ca (loi 25), legisquebec.gouv.qc.ca, canlii.org, quebec.ca, educaloi.qc.ca, osler.com, dentons.com, artci.ci (deux pages et le PDF de la loi), afapdp.org, backblaze.com (régions et fonctionnalités), wondernetwork.com, cloudping.co, trac.ffmpeg.org, fal.ai/models/fal-ai/whisper (prix non affiché).
