# R21. Entrée des matières premières et onboarding client : dépôt de produits, OCR de flyers, réception des sermons, extraction de la marque

Rapport de recherche daté du 1er octobre 2026. Périmètre : le début de la chaîne de la machine social media de José, c'est-à-dire tout ce qui se passe entre « le client a quelque chose à montrer » et « la machine possède une fiche structurée, un fichier exploitable et un brand kit ». Les rapports R03 (images), R05 (sermons), R11 (voix de marque) et R02 (publication) traitent l'aval ; celui-ci traite l'amont.

Convention : chaque prix est daté et sourcé. Quand une donnée n'a pas pu être vérifiée sur une page primaire, elle est marquée « à vérifier » et reprise dans la section Incertitudes.

---

## 1. Résumé exécutif

1. **Extraction structurée depuis une photo ou un PDF.** Pour des flyers, étiquettes cosmétiques et affiches d'église (1 à 3 pages, français, mise en page libre), la voie la moins chère et la plus souple est un modèle de vision avec sortie JSON contrainte. Claude Haiku 4.5 revient à environ 4 à 5 USD par 1 000 images (1 000 × 1 000 px, prompt et JSON compris), Sonnet 5.5 à environ 14 USD par 1 000 images en haute résolution, et la Batch API divise ces chiffres par deux. Mistral OCR 4 coûte 4 USD par 1 000 pages (2 USD en batch) et offre nativement des « annotations » JSON à partir d'un schéma. Google Document AI (OCR 1,50 USD, Custom Extractor 30 USD par 1 000 pages) et Azure Document Intelligence (Read 1,50 USD, Layout 10 USD, Custom 30 USD par 1 000 pages) sont taillés pour des factures et formulaires en volume, pas pour des affiches. Tous couvrent le français imprimé ; seul Azure documente le français manuscrit.
2. **Sermons.** YouTube ne doit jamais servir de source de fichier. Le webhook PubSubHubbub de YouTube est gratuit, hors quota, et prévient en quelques minutes qu'une vidéo est publiée ; la source légale du fichier est le dépôt par la régie de l'église (Google Drive partagé avec `changes.watch`, ou export Daily à 5 Mbit/s en 1080p depuis la régie). Un sermon de 90 minutes pèse 5,4 Go à 8 Mbit/s (recommandation YouTube 1080p) ou 3,4 Go dans l'encodage Daily ; avec un pass Orange CI de 1,5 Go à 1 000 FCFA (7 jours), il faut réduire la source à 720p (1,7 Go pour 90 min à 2,5 Mbit/s) ou laisser la régie envoyer depuis une connexion fixe.
3. **Dépôt mobile.** WhatsApp Cloud API accepte en entrée des images jusqu'à 5 Mo, des vidéos jusqu'à 16 Mo et des documents jusqu'à 100 Mo ; l'identifiant média reçu par webhook expire au bout de 7 jours (30 jours pour les médias envoyés par l'entreprise) et chaque URL de téléchargement n'est valable que 5 minutes. Les messages entrants restent gratuits dans la fenêtre de 24 h ; les sources secondaires annoncent qu'à partir du 1er octobre 2026 les réponses de service deviennent payantes au-delà de 1 000 par numéro et par mois (point à confirmer sur la page Meta, qui ne le mentionnait pas le 1er octobre 2026).
4. **Onboarding en moins d'une heure.** Firecrawl extrait un brand kit (logo, couleurs hex, polices, espacements) en un appel « branding » facturé 1 crédit (plan gratuit 1 000 crédits par mois, Hobby 16 USD par mois en annuel). L'import des 50 derniers posts passe par Business Discovery (compte pro public, permissions `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`). La connexion des comptes par le client lui-même se fait avec Instagram Business Login (jeton long 60 jours, renouvelable) ou Facebook Login for Business (jeton système sans expiration), l'un et l'autre exigeant l'Advanced Access après App Review pour des comptes que José ne possède pas. Le partage d'actifs Business Manager se fait par l'identifiant de portefeuille à 16 chiffres de Markel-Tech.
5. **Packshot réel.** Oui pour la verticale beauté, mais à prix plancher : une boîte photo LED de 40 cm coûte 16 245 à 18 900 FCFA sur Jumia CI (septembre 2026) et suffit pour des fonds blancs propres que Nano Banana Pro ou gpt-image remettent ensuite en scène. Un studio à Toronto facture 25 à 50 USD par image (ou 10 USD par produit à partir de 10 produits, frais d'installation en sus). Aucun tarif packshot public n'a été trouvé pour Abidjan ; les studios locaux affichent des forfaits de 25 000 à 90 000 FCFA pour des séances portrait.

---

## 2. Extraction structurée depuis une photo ou un PDF

### 2.1 Ce que la machine doit sortir

Trois types de documents entrent par ce canal, et le schéma JSON attendu diffère :

| Document | Champs à extraire | Pièges |
|---|---|---|
| Flyer d'événement (association culturelle, église) | titre, dates (début, fin, heure), lieu (commune, salle, repère), prix d'entrée en FCFA ou « entrée libre », organisateur, contacts (téléphone, WhatsApp), invités, hashtags imprimés | dates partielles (« samedi 12 » sans mois ni année), montants écrits « 5 000 F », « 5.000 FCFA », « 5000f », adresses par repères (« non loin de la pharmacie ») |
| Étiquette ou fiche produit cosmétique | nom commercial, gamme, contenance (ml, g), liste INCI ordonnée, allégations, usage, précautions, prix conseillé, code-barres | INCI en très petits caractères et en majuscules, parfois sur face courbe ; texte multilingue ; nom INCI latin que l'OCR « corrige » en mot français |
| Affiche d'église | thème, orateur, dates et heures des cultes, programme (veillée, séminaire), lieu, lien de diffusion, verset cité | typographies décoratives, texte sur photo, plusieurs horaires, références bibliques à normaliser |

### 2.2 Claude (vision + sorties structurées)

Faits vérifiés sur platform.claude.com le 1er octobre 2026 :

- **Images** : JPEG, PNG, GIF, WebP ; 10 Mo par image sur l'API directe (5 Mo sur Bedrock et Google Cloud) ; 8 000 × 8 000 px maximum ; jusqu'à 100 images par requête pour les modèles à contexte 200 k, 600 pour les autres ; au-delà de 20 images dans une même requête, chaque image doit tenir sous 2 000 px de côté.
- **Coût en tokens** : un token visuel par bloc de 28 × 28 px, soit ⌈largeur/28⌉ × ⌈hauteur/28⌉. Palier standard (modèles antérieurs à 4.7, dont Haiku 4.5 et Sonnet 4.5) : grand côté ramené à 1 568 px, plafond 1 568 tokens par image. Palier haute résolution (Claude 4.7 et suivants, dont Sonnet 5.5 et Opus 5.5) : grand côté 2 576 px, plafond 4 784 tokens. Exemples du tableau officiel : 1 000 × 1 000 px = 1 296 tokens sur les deux paliers ; 1 920 × 1 080 px = 1 560 tokens (standard) ou 2 691 (haute résolution) ; 2 000 × 1 500 px = 1 564 ou 3 888.
- **PDF** : 32 Mo par requête, 100 pages par requête (600 pour les requêtes avec contexte 1 M) ; chaque page est traitée en texte et en image, soit environ 7 000 tokens pour 3 pages (2 300 tokens par page) ; Files API disponible pour ne pas renvoyer le fichier à chaque appel.
- **Sorties structurées** : en disponibilité générale, sans en-tête bêta, via `output_config.format` de type `json_schema` ; décodage contraint, donc JSON toujours valide ; aucun surcoût ; grammaire compilée mise en cache 24 h ; prise en charge sur Haiku 4.5, Sonnet 5 et 5.5, Opus 5 et 5.5. Limites du schéma : pas de récursion, pas de `minimum`/`maximum` ni `minLength`/`maxLength` (le SDK les retire et les reporte en description), formats `date`, `date-time`, `email`, `uri` acceptés.
- **Prix par million de tokens** (entrée / sortie) : Haiku 4.5 1 / 5 USD ; Sonnet 4.5 3 / 15 USD ; Sonnet 5.5 2 / 10 USD ; Opus 5.5 4 / 20 USD. Batch API : moitié prix. Lecture de cache : 0,1 × le prix d'entrée (0,05 × sur Opus 5.5).

Source : https://platform.claude.com/docs/en/build-with-claude/vision
Source : https://platform.claude.com/docs/en/build-with-claude/pdf-support
Source : https://platform.claude.com/docs/en/build-with-claude/structured-outputs
Source : https://platform.claude.com/docs/en/about-claude/pricing

**Coût unitaire calculé pour un flyer photographié au téléphone, ramené à 1 000 × 1 000 px** (1 296 tokens image + 800 tokens de consignes et schéma + 500 tokens de JSON en sortie) :

| Modèle | Entrée | Sortie | Total par document | Par 1 000 documents | Batch |
|---|---|---|---|---|---|
| Haiku 4.5 | 2 096 × 1 USD/M = 0,0021 USD | 500 × 5 USD/M = 0,0025 USD | 0,0046 USD | 4,6 USD | 2,3 USD |
| Sonnet 4.5 | 2 096 × 3 = 0,0063 | 500 × 15 = 0,0075 | 0,0138 | 13,8 USD | 6,9 USD |
| Sonnet 5.5 (image 2 000 × 1 500 en haute résolution, 3 888 tokens) | 4 688 × 2 = 0,0094 | 500 × 10 = 0,005 | 0,0144 | 14,4 USD | 7,2 USD |

Pour un PDF de 3 pages (fiche produit fournisseur) : 7 000 tokens d'entrée, soit 0,007 USD sur Haiku, 0,014 USD sur Sonnet 5.5, hors sortie. La page officielle rappelle que la facturation d'une image 1 000 × 1 000 sur Haiku 4.5 revient à « environ 1,30 USD pour mille images » (image seule).

Qualité annoncée sur le français : la documentation Claude ne publie pas de benchmark par langue ; elle avertit que le modèle « peut halluciner ou se tromper sur des images de mauvaise qualité, pivotées ou très petites (moins de 200 px) » et que le texte important doit rester lisible après redimensionnement. Pour une liste INCI, cela impose d'envoyer un recadrage de la zone d'ingrédients à pleine résolution plutôt que l'étiquette entière.

### 2.3 Mistral OCR 4 et annotations

- Modèle `mistral-ocr-4` (alias `mistral-ocr-latest`), lancé le 23 juin 2026, mise à jour 4.1 le 16 juillet 2026 (scores de confiance par bloc). 170 langues annoncées. Entrées : PDF, PPTX, DOCX, PNG, JPEG, AVIF, TIFF, WebP. Sortie JSON par page (markdown, images, tableaux, en-têtes, blocs avec boîtes englobantes, scores de confiance).
- **Annotations** : `document_annotation` envoie le markdown OCR et les huit premières images détectées à un modèle de vision, avec un schéma Pydantic, Zod ou JSON Schema, et renvoie l'objet structuré ; `bbox_annotation` fait de même par image. C'est l'équivalent d'une extraction en un appel.
- **Prix** : les pages tierces datées de 2026 citent 4 USD par 1 000 pages en API, 2 USD en batch, et 5 USD par 1 000 pages annotées ; la page mistral.ai/pricing dit seulement « OCR facturé par 1 000 pages » et renvoie à la vue des modèles, consultable uniquement avec rendu JavaScript. Chiffres **à vérifier** dans la console Mistral avant devis.
- **Limites** : 50 Mo et 1 000 pages par document, selon la documentation relayée par plusieurs intégrateurs (LibreChat, AIMLAPI) ; non retrouvé sur la page primaire le 1er octobre 2026, donc **à vérifier**.
- **Français** : le billet de lancement de Mistral OCR (6 mars 2025, modèle 2503 aujourd'hui déprécié) donnait un score de 99,20 en français contre 97,50 pour Azure OCR, 97,06 pour Gemini 2.0 Flash et 96,36 pour Google Document AI. Aucun chiffre équivalent publié pour OCR 4.

Source : https://docs.mistral.ai/capabilities/document_ai/basic_ocr
Source : https://docs.mistral.ai/capabilities/document_ai/annotations
Source : https://mistral.ai/news/mistral-ocr
Source : https://mistral.ai/pricing
Source : https://www.aimadetools.com/blog/mistral-ocr-4-complete-guide/
Source : https://www.librechat.ai/docs/features/ocr

### 2.4 Google Document AI

- Enterprise Document OCR : 1,50 USD par 1 000 pages jusqu'à 5 millions de pages par mois, 0,60 USD au-delà. Layout Parser : 10 USD. Form Parser et Custom Extractor : 30 USD par 1 000 pages jusqu'à 1 million, 20 USD au-delà. Classifieur et splitter : à partir de 5 USD. Les requêtes en échec ne sont pas facturées.
- Limites en ligne (synchrone) : 40 Mo par fichier, 15 pages par requête pour OCR, Form Parser et Custom Extractor (30 pages en `imageless_mode`), 40 mégapixels par page d'image. Batch : 1 Go par fichier, 5 000 fichiers par lot. Débit du Custom Extractor génératif : 120 pages par minute (versions 1.4 et 1.5), 30 pages par minute pour les versions Pro.
- Le Custom Extractor repose sur un modèle de fondation (Gemini 2.5 en few-shot d'après les pages commerciales 2026) et accepte un schéma sans entraînement.
- Français : plus de 200 langues pour l'OCR, 50 en manuscrit ; le français figure dans les listes des processeurs Expense et Invoice.

Source : https://cloud.google.com/document-ai/pricing
Source : https://docs.cloud.google.com/document-ai/limits
Source : https://docs.cloud.google.com/document-ai/quotas
Source : https://aiproductivity.ai/blog/document-ai-cost-comparison/ (mis à jour le 19 juillet 2026)

### 2.5 Azure Document Intelligence

- Niveau F0 : 500 pages gratuites par mois. Niveau S0 : Read 1,50 USD par 1 000 pages (0,60 USD au-delà de 1 million par mois) ; Layout 10 USD ; modèles prédéfinis 10 USD ; extraction personnalisée 30 USD ; classification 3 USD ; compléments (haute résolution, polices, formules) 6 USD ; champs de requête 10 USD en sus du modèle de base. Paliers d'engagement jusqu'à 0,45 à 0,53 USD par 1 000 pages pour Read à 8 millions de pages. Taille maximale 500 Mo par requête. La page officielle azure.microsoft.com affiche « $- » tant qu'on n'a pas choisi région et devise ; les chiffres ci-dessus viennent d'un relevé daté d'août 2026.
- Français : pris en charge en imprimé pour Read et Layout (v4.0 GA), et en **manuscrit** (liste de douze langues dont le français). C'est le seul des quatre fournisseurs à documenter explicitement le manuscrit français, utile pour une étiquette de prix écrite à la main.

Source : https://azure.microsoft.com/en-us/pricing/details/ai-document-intelligence/
Source : https://docuocr.com/blog/azure-document-intelligence-pricing (août 2026)
Source : https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/language-support/ocr (mise à jour 10 juillet 2026)

### 2.6 Tableau comparatif (1er octobre 2026)

| Critère | Claude (Haiku 4.5 / Sonnet 5.5) | Mistral OCR 4 | Google Document AI | Azure Document Intelligence |
|---|---|---|---|---|
| Prix par 1 000 pages, extraction JSON comprise | ~4,6 USD / ~14 USD (calcul ci-dessus) ; batch ÷2 | 4 USD OCR, 2 USD batch, ~5 USD annoté (à vérifier) | OCR 1,50 USD + Custom Extractor 30 USD | Read 1,50 USD ; Layout 10 USD ; Custom 30 USD |
| Pages par requête | 100 (600 avec contexte 1 M) ; 32 Mo | 1 000 pages, 50 Mo (à vérifier) | 15 en ligne (30 en imageless) ; 40 Mo ; batch 1 Go | 500 Mo ; pas de limite de pages publiée sur la page prix |
| Schéma JSON garanti | Oui, décodage contraint, GA | Oui, annotations par schéma | Oui, schéma de champs du Custom Extractor | Oui, champs de requête ou modèle custom |
| Dates, lieux, prix FCFA | Excellent sur texte libre, normalisation en même appel (« 5.000 F » vers 5000 XOF) | Bon sur OCR, normalisation déléguée au modèle d'annotation | Nécessite un processeur custom par type de document | Idem, ou champs de requête à 10 USD en sus |
| INCI | Bon si recadrage haute résolution ; vérification ensuite contre une base INCI | Bon sur texte dense ; blocs avec confiance par mot | OCR fiable ; extraction de liste ordonnée via custom | OCR fiable ; haute résolution en complément payant |
| Français | Non chiffré par Anthropic | 99,20 (modèle 2503, mars 2025) | 200+ langues, français inclus | Imprimé et manuscrit documentés |
| Gratuit pour démarrer | Crédits de bienvenue | Essai console | Essai GCP | 500 pages par mois |

Conclusion de section : pour 50 à 300 documents par mois tous clients confondus, la différence de coût entre fournisseurs est inférieure à 5 USD par mois. Le critère qui compte est la souplesse du schéma et la normalisation des champs français et ivoiriens, où un modèle de vision généraliste avec JSON contraint l'emporte. Mistral OCR est la réserve naturelle pour les PDF longs (catalogues fournisseurs de 50 à 200 pages) où la facturation à la page est plus prévisible que la facturation en tokens.

### 2.7 Point particulier : la liste INCI

Une étude de 2024 (KTH, YOLOv5 + EasyOCR) n'obtenait que 12,7 % de correspondance entre les ingrédients lus sur l'emballage et la fiche INCI de référence, à cause des textes courbes, verticaux ou noyés dans le graphisme. Un pipeline OCR + grand modèle de langage sur des étiquettes imprimées atteint en revanche 95,4 % d'exactitude au niveau des champs (étude PMC sur des étiquettes de spécimens, 2025). Leçon pour la machine : exiger du client une photo dédiée de la zone INCI, à plat, en lumière rasante, puis faire valider la liste extraite contre une base de noms INCI (par exemple le dictionnaire public de SpecialChem) avant toute publication d'allégation.

Source : https://kth.diva-portal.org/smash/get/diva2:1865192/FULLTEXT01.pdf
Source : https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12835874/
Source : https://www.specialchem.com/cosmetics/all-inci-ingredients

---

## 3. Réception des sermons sans violer les conditions YouTube

### 3.1 Ce que YouTube interdit

Les Conditions d'utilisation de YouTube (version du 15 décembre 2023, en vigueur le 1er octobre 2026) interdisent d'« accéder, reproduire, télécharger, distribuer [...] toute partie du Service ou tout Contenu » sauf autorisation expresse du Service ou permission écrite, et d'accéder au Contenu « par tout moyen autre que les pages de lecture du Service, le lecteur intégrable ou tout autre moyen explicitement autorisé ». Un `yt-dlp` lancé sur la chaîne de l'église, même avec l'accord du pasteur, reste donc une violation des conditions côté YouTube. La seule voie « YouTube » légitime est celle offerte au propriétaire de la chaîne.

Source : https://www.youtube.com/static?template=terms

### 3.2 Ce que YouTube offre au propriétaire

- **YouTube Studio** permet au propriétaire de télécharger ses propres vidéos en MP4, mais « en 720p ou 360p selon la taille de la vidéo », avec une limite de cinq téléchargements par vidéo et par jour, et pas de téléchargement si la vidéo porte une réclamation de droits ou une piste audio préapprouvée.
- **Google Takeout** exporte les vidéos originales « dans leur format d'origine pendant les six premiers mois après la mise en ligne », puis en version compressée H.264/AAC ; l'export peut être livré directement dans Google Drive ou Dropbox et programmé tous les deux mois pendant un an. Il faut être connecté comme propriétaire du compte de marque de la chaîne.
- **captions.download** (Data API) renvoie les sous-titres d'une vidéo que l'on possède, pour 200 unités de quota ; utile pour la transcription si l'église a activé les sous-titres automatiques.

Source : https://support.google.com/youtube/answer/56100
Source : https://techieinspire.com/download-youtube-videos-original-format-google-takeout/
Source : https://joshdance.medium.com/youtube-studio-only-gives-you-720p-when-you-download-your-own-video-3a7c3a751507

Conséquence : pour obtenir une source 1080p de qualité montage, YouTube Studio ne suffit pas. Le fichier doit arriver par la régie de l'église, avant ou en parallèle de la mise en ligne.

### 3.3 Détecter la publication : PubSubHubbub

- Hub : `https://pubsubhubbub.appspot.com/subscribe`. Sujet : `https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID`. Le hub envoie un GET de vérification avec `hub.challenge` que le serveur doit renvoyer tel quel avec un 200 ; ensuite chaque mise en ligne, changement de titre ou de description déclenche un POST Atom contenant `yt:videoId`, `yt:channelId`, `title`, `published`, `updated`.
- Coût : nul, et hors quota de l'API Data (10 000 unités par jour).
- Bail : la page officielle ne publie pas de durée ; la liste de discussion Google et les guides tiers indiquent un plafond `hub.lease_seconds` de 432 000 s, soit 5 jours, après quoi les notifications cessent. Il faut donc un cron de réabonnement tous les 3 à 4 jours et par chaîne cliente.
- Limites : pas de notification de suppression, pas de contenu vidéo, et la notification n'arrive qu'après publication (un direct en cours n'est annoncé qu'au moment où YouTube crée la vidéo).

Source : https://developers.google.com/youtube/v3/guides/push_notifications
Source : https://groups.google.com/g/google-pubsubhubbub/c/DWDnBOoQxew
Source : https://vidproxy.pro/youtube-webhook

### 3.4 Trois voies légales pour obtenir le fichier

**Voie A, Google Drive partagé par la régie.** L'église dépose le MP4 dans un dossier partagé avec un compte de service Markel-Tech. L'API Drive permet `changes.watch` (canal valable au plus 604 800 s, soit 7 jours, à renouveler manuellement car « il n'existe aucun moyen automatique de renouveler un canal ») ou `files.watch` (1 jour). Le webhook doit être servi en HTTPS avec un certificat valide ; la notification ne contient ni nom ni contenu, il faut rappeler `changes.list`. Google Drive accepte des fichiers jusqu'à 5 To, 750 Go de téléversement par jour, et l'application mobile reprend les envois interrompus dans la plupart des cas.

Source : https://developers.google.com/workspace/drive/api/guides/push
Source : https://developers.google.com/workspace/drive/api/guides/limits

**Voie B, enregistrement Daily.** 2IAE utilise déjà Daily pour ses salles de cours. L'enregistrement cloud sort « par défaut en 1920 × 1080, 30 i/s, H.264 à 5 Mbit/s, audio AAC 96 kbit/s, en MP4 », supporte des appels jusqu'à trois heures, et peut être écrit directement dans un bucket S3 ou OCI appartenant au client. Prix : 0,01349 USD par minute enregistrée (temps mural, indépendant du nombre de participants) et 0,003 USD par minute de stockage ; 10 000 minutes gratuites par mois sur le plan. Un sermon de 90 minutes coûte 1,21 USD d'enregistrement et 0,27 USD par mois de stockage, et pèse 90 × 60 × 5 / 8 = 3,4 Go (2,25 Go pour 60 minutes). Cette voie suppose que la régie branche sa caméra dans une salle Daily (via OBS ou un navigateur) en plus de son direct YouTube ; c'est réaliste pour une église déjà équipée pour le streaming, et le fichier atterrit alors sans aucun téléversement manuel.

Source : https://docs.daily.co/guides/products/live-streaming-recording/recording-calls-with-the-daily-api
Source : https://www.daily.co/pricing/video-sdk/

**Voie C, dépôt WhatsApp ou formulaire.** Impossible pour la vidéo intégrale (16 Mo maximum en vidéo, 100 Mo en document), mais parfaite pour un extrait de 2 minutes choisi par le pasteur, ou pour l'audio seul (16 Mo, soit environ 90 minutes en AAC 24 kbit/s mono).

### 3.5 Poids et délai depuis Abidjan

| Source | Débit | 60 min | 90 min |
|---|---|---|---|
| Export régie à 8 Mbit/s (recommandation YouTube 1080p) | 8 Mbit/s | 3,6 Go | 5,4 Go |
| Enregistrement Daily 1080p | 5 Mbit/s | 2,25 Go | 3,4 Go |
| Réencodage 720p conseillé | 2,5 Mbit/s | 1,1 Go | 1,7 Go |
| Audio seul AAC 64 kbit/s | 0,064 Mbit/s | 29 Mo | 43 Mo |

Forfaits Orange Côte d'Ivoire relevés le 13 février 2026 : 1,5 Go pour 1 000 FCFA valables 7 jours ; 3,5 Go pour 2 000 FCFA valables 7 jours ; 1,5 Go de nuit (0 h à 8 h) pour 500 FCFA ; jusqu'à 55 Go pour 20 000 FCFA. Avec un budget de 1,5 Go par jour, un sermon 1080p de 5,4 Go consomme quatre jours de forfait (4 000 FCFA en pass de 1,5 Go, ou 4 000 FCFA en deux pass de 3,5 Go qui laissent 1,6 Go de marge) ; en 720p il tient dans un seul pass de 1,5 Go… à condition de ne rien faire d'autre ce jour-là.

Temps de transfert : aucune mesure Ookla récente n'a pu être ouverte pour la Côte d'Ivoire (speedtest.net inaccessible depuis cet environnement, et Trading Economics ne publie qu'une moyenne Akamai de 2017 à 2,6 Mo/s). En supposant un débit montant 4G de 5 à 10 Mbit/s en zone bien couverte d'Abidjan (ordre de grandeur, à mesurer sur place), 5,4 Go demandent 1,2 à 2,4 heures de transfert ininterrompu ; 1,7 Go demandent 23 à 45 minutes. Sur une fibre Orange, la question disparaît.

Source : https://blog.iambeezy.app/fr/forfait-internet-orange-ci-2026-pass-data/
Source : https://www.vibrantsnap.com/video-file-size-calculator
Source : https://tradingeconomics.com/ivory-coast/internet-speed

### 3.6 Schéma recommandé pour un sermon

1. Dimanche 11 h : la régie diffuse sur YouTube et, si équipée, enregistre dans une salle Daily (voie B) ; sinon elle exporte le MP4 de l'enregistreur.
2. Dimanche après-midi : PubSubHubbub signale la vidéo ; la machine crée la fiche « sermon » (titre, date, lien YouTube, orateur depuis la description) et envoie un WhatsApp à la régie : « Déposez le fichier ou l'audio ici » (lien Drive pré-créé ou simple réponse WhatsApp pour l'audio).
3. Dimanche soir ou lundi matin : arrivée du fichier (Drive `changes.watch`) ou de l'audio (WhatsApp). Si seul l'audio arrive, le pipeline R05 produit les clips sous-titrés à partir de l'audio et d'une image fixe ou d'un extrait 720p de YouTube Studio téléchargé par le propriétaire.
4. Lundi midi : planche de clips proposée au pasteur.

Délai cible dépôt vers planche : 24 heures.

---

## 4. Dépôt mobile par le client

### 4.1 WhatsApp Cloud API comme boîte aux lettres

Faits vérifiés sur developers.facebook.com le 1er octobre 2026 :

- **Tailles en réception** : images JPEG, PNG 5 Mo ; audio AAC, AMR, MP3, M4A, OGG 16 Mo ; vidéo MP4, 3GPP (H.264/AAC) 16 Mo ; documents TXT, XLS, XLSX, DOC, DOCX, PPT, PPTX, PDF 100 Mo ; stickers 100 Ko (500 Ko animés). Au-delà de 100 Mo, le webhook renvoie le code 131052 et l'expéditeur est invité à renvoyer un fichier plus petit. Note pratique : WhatsApp compresse les photos envoyées « en image » ; pour une étiquette INCI lisible, le client doit envoyer la photo « en document ».
- **Webhook** : chaque média entrant porte `id`, `mime_type`, `sha256`, `file_size` et éventuellement `caption`. Le téléchargement se fait en deux temps : GET `/MEDIA_ID` renvoie une URL, puis GET de cette URL avec le jeton porteur. **L'URL expire au bout de 5 minutes** ; **l'identifiant média issu d'un webhook expire au bout de 7 jours** (30 jours pour les médias téléversés par l'entreprise). Les messages sont conservés au plus 30 jours côté Meta pour les retransmissions. La machine doit donc télécharger et archiver immédiatement dans le bucket Railway, et ne jamais compter sur Meta comme stockage.
- **Tarification** : depuis le 1er juillet 2025 la facturation est par message livré, en quatre catégories (marketing, utilitaire, authentification, service). La page Meta indique que « tous les messages non modèles sont gratuits » dans la fenêtre de service de 24 h ouverte par le client. Plusieurs sources de septembre 2026 (EngageLab mis à jour le 11 septembre 2026, Chatarmin, Peppercloud) annoncent qu'au 1er octobre 2026 les réponses de service deviennent payantes au tarif utilitaire après 1 000 messages gratuits par numéro et par mois ; la page Meta consultée le 1er octobre 2026 ne reprenait pas cette règle. Pour les marchés « Autres », qui incluent la Côte d'Ivoire (indicatif 225, groupe « Rest of Africa »), EngageLab relève 0,0077 USD par message utilitaire et 0,0604 USD par message marketing. À 30 clients déposant 20 fois par mois, on reste très loin du seuil de 1 000.
- **WhatsApp Flows** permet des formulaires dans la conversation (listes, champs, dates) : c'est le bon outil pour demander « quel produit ? quelle gamme ? prix de vente ? » juste après la réception d'une photo.

Source : https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media
Source : https://developers.facebook.com/docs/whatsapp/pricing/
Source : https://www.engagelab.com/blog/whatsapp-business-api-pricing (mis à jour le 11 septembre 2026)
Source : https://chatarmin.com/en/blog/whatsapp-business-costs

### 4.2 Formulaire web léger

Un formulaire sur la plateforme (React, upload direct vers le bucket S3 de Railway avec URL présignée, reprise d'envoi par morceaux) reste indispensable pour tout ce qui dépasse 16 Mo (vidéo produit, sermon) et pour les lots (10 photos d'une nouvelle gamme). Son avantage décisif : le client choisit le type de dépôt dans une liste, ce qui supprime la reconnaissance automatique. Son inconvénient : taux d'usage faible chez des clients qui vivent dans WhatsApp. La règle pratique : WhatsApp pour le quotidien (une photo, un vocal, un flyer), le formulaire pour les lots et les vidéos, avec un lien magique envoyé par WhatsApp pour basculer de l'un à l'autre sans connexion.

### 4.3 Reconnaissance automatique du type de dépôt

Pipeline proposé, exécuté dès l'arrivée d'un média :

1. Règles sans modèle : MIME et taille (PDF de 40 pages = catalogue, MP4 = vidéo brute, OGG = vocal), légende WhatsApp (mots « flyer », « événement », « nouveau », « sermon »), expéditeur (numéro associé à un client et à une verticale).
2. Classification par Haiku 4.5 avec sortie JSON contrainte sur un enum fermé : `flyer_evenement`, `etiquette_produit`, `packshot_brut`, `affiche_eglise`, `capture_ecran_concurrent`, `vocal_consigne`, `document_long`, `autre`. Coût : 1 296 tokens d'image + 300 de consignes + 30 de sortie, soit 0,0018 USD par média ; la classification et l'extraction peuvent d'ailleurs tenir dans le même appel pour les types connus.
3. Vocal : transcription (Whisper ou équivalent, voir R05) puis extraction des consignes.
4. Accusé de réception WhatsApp dans la minute : « Reçu : flyer de l'événement du 12 octobre à Cocody, entrée 5 000 F. C'est bien ça ? » avec deux boutons. Cette boucle de confirmation remplace avantageusement une précision OCR supplémentaire de deux points.

---

## 5. Onboarding d'un nouveau client en moins d'une heure

### 5.1 Extraction du brand kit depuis le site

**Firecrawl.** Le format `branding` de l'endpoint Scrape renvoie en un appel le logo (URL), le favicon, l'image og, la palette (primaire, secondaire, accent, fond, texte) en hexadécimal, les familles de polices avec tailles et graisses, les espacements, les rayons, les styles de boutons et des « traits de personnalité » de marque. Version v2 publiée le 6 février 2026, avec extraction de logo améliorée pour les sites Wix et Framer. Coût : 1 crédit par page pour un scrape simple (le glossaire Firecrawl indique qu'un scrape branding coûte 1 crédit ; la page de prix ne le détaille pas) ; le format JSON par schéma ajoute 4 crédits par page. Plans : Free 1 000 crédits par mois ; Hobby 16 USD par mois en annuel (19 USD en mensuel) pour 5 000 crédits ; Standard 83 USD pour 100 000 crédits.

Source : https://docs.firecrawl.dev/features/scrape
Source : https://www.firecrawl.dev/blog/branding-format-v2
Source : https://www.firecrawl.dev/glossary/web-extraction-apis/extract-website-branding
Source : https://www.firecrawl.dev/pricing

**Claude seul.** Alternative sans abonnement : récupérer la page d'accueil (web fetch, sans surcoût au-delà des tokens ; une page de 10 Ko = 2 500 tokens environ), la capturer en image (Claude-in-Chrome ou Playwright), et demander à Sonnet 5.5 un JSON brand kit (couleurs, polices visibles, ton, promesses, vocabulaire). Coût de l'ordre de 0,02 à 0,05 USD par site. Firecrawl est plus fiable pour les codes hexadécimaux exacts (lus dans le CSS), Claude est meilleur pour le ton et les « mots interdits ». La machine devrait faire les deux et fusionner.

**Clients sans site.** Fréquent à Abidjan (association, église) : le brand kit se déduit de la page Facebook (photo de profil, couverture, dernières affiches) et d'un dépôt WhatsApp de trois visuels récents. Canva (MCP connecté) sait ensuite créer un Brand Kit à partir de ces couleurs et logos pour les gabarits des planches.

### 5.2 Import des 50 derniers posts pour la fiche de voix (R11)

- **Business Discovery** (Instagram Graph API via Facebook Login) : lecture publique d'un compte professionnel tiers, champs compte (`biography`, `followers_count`, `media_count`, `website`) et champs média (`caption`, `media_type`, `media_url`, `permalink`, `timestamp`, `like_count`, `comments_count`, `view_count`), pagination par curseurs sur l'arête `media` (mais pas de `next`/`previous`, il faut construire la requête suivante). Permissions requises : `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, plus `ads_management` ou `ads_read` si le rôle a été accordé via Business Manager. Limite BUC : 200 appels par heure et par utilisateur. Exclusions : comptes privés, comptes personnels, comptes à restriction d'âge.
- **Après connexion du client** (section 5.3) : l'arête `me/media` ou `/{ig-user-id}/media` donne tout l'historique avec insights ; pour Facebook, `/{page-id}/posts` que José utilise déjà pour relire la page 2IAE.
- **LinkedIn** (Markel-Tech) : pas d'équivalent public ; export manuel ou connexion de la page par le client.

Source : https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery

### 5.3 Connexion OAuth des comptes par le client lui-même

Deux routes Meta coexistent :

| | Instagram Business Login (API avec connexion Instagram) | Facebook Login for Business |
|---|---|---|
| Ce qu'il faut au client | Un compte Instagram professionnel ; aucune Page Facebook requise | Page Facebook liée au compte Instagram, et un portefeuille Business |
| Scopes | `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_messages`, `instagram_business_manage_comments` | Configurations prédéfinies parmi 31 permissions (dont `pages_manage_posts`, `instagram_content_publish`, `business_management`, WhatsApp) |
| Jeton | Court (1 h) échangé contre un jeton long de **60 jours**, renouvelable s'il a plus de 24 h et n'est pas expiré | Jeton utilisateur court, ou **jeton d'utilisateur système (SUAT) qui par défaut n'expire jamais**, conçu pour les appels serveur à serveur |
| Prérequis côté José | App de type Business, App Review et **Advanced Access** pour les comptes qu'il ne possède pas | Idem, plus vérification d'entreprise et revues de conformité récurrentes |

Le « lien magique » de la plateforme est donc : un lien signé, à usage unique, envoyé par WhatsApp, qui ouvre la page d'autorisation Instagram ou Facebook avec les scopes de la verticale, puis stocke le jeton long chiffré avec la date de renouvellement (cron à J+50 pour Instagram Login). Tant que l'App Review n'est pas obtenue, seuls les comptes dont José ou ses testeurs sont administrateurs fonctionnent : c'est le chemin critique de l'onboarding, à lancer avant tout le reste.

Source : https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login
Source : https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business

### 5.4 Checklist des accès Business Manager (Meta)

1. Markel-Tech communique son identifiant de portefeuille Business à 16 chiffres (Paramètres > Infos sur l'entreprise).
2. Le client (rôle administrateur de son portefeuille) ouvre Meta Business Suite > Paramètres de l'entreprise > Utilisateurs > Partenaires > Ajouter > « Donner à un partenaire l'accès à vos actifs », saisit l'identifiant.
3. Il coche les actifs : Page Facebook, compte Instagram, compte publicitaire, pixel ou jeu de données, catalogue, compte WhatsApp Business, et choisit « contrôle total » ou accès partiel par tâches (contenu, messagerie, statistiques, publicités).
4. Variante inversée : José envoie une demande de partenariat depuis son propre portefeuille (Partenaires > Ajouter > demander l'accès), et le client approuve d'un clic.
5. Le client garde la propriété et peut révoquer à tout moment ; aucun mot de passe ne circule.
6. À prévoir dans le même quart d'heure : le client ajoute l'adresse Markel-Tech comme gestionnaire de sa chaîne YouTube (pour PubSubHubbub, rien n'est requis, mais pour `captions.download` et Takeout, oui) et partage le dossier Drive de dépôt.

Source : https://www.facebook.com/business/help/1717412048538897
Source : https://www.leadsie.com/blog/give-meta-business-portfolio-access
Source : https://oneclickonboard.com/blog/how-to-get-meta-business-manager-access-from-clients-2026

### 5.5 Chronométrage d'un onboarding à 60 minutes

| Minute | Étape | Outil | Qui |
|---|---|---|---|
| 0 à 5 | Création de la fiche client, verticale, langue, plateformes | Plateforme | José |
| 5 à 10 | Brand kit automatique depuis le site ou la page Facebook | Firecrawl + Claude | Machine |
| 10 à 20 | Import des 50 derniers posts, première fiche de voix (R11) | Business Discovery / Graph API + Claude | Machine |
| 20 à 35 | Lien magique OAuth, partage Business Manager, dossier Drive, numéro WhatsApp enregistré | Meta, Drive, WhatsApp | Client, guidé par José en visio |
| 35 à 45 | Premier dépôt test (une photo, un flyer) et accusé de réception automatique | WhatsApp Cloud API + Haiku | Client |
| 45 à 55 | Validation du brand kit et de la fiche de voix, ajustement du ton | Plateforme | Client + José |
| 55 à 60 | Génération de la première planche de 3 propositions | Pipeline R03/R09 | Machine |

Tenable à condition que l'App Review Meta soit déjà obtenue et que le client arrive avec ses accès administrateur.

---

## 6. Réception physique des produits de beauté

### 6.1 Faut-il un packshot réel ?

Oui, pour trois raisons : la générative ne sait pas inventer un packaging qu'elle n'a jamais vu (texte sur étiquette, bouchon, contenance), la cliente reconnaîtra immédiatement un flacon approximatif, et les plateformes marchandes exigent la photo du vrai produit. Mais un packshot « de base » suffit : fond blanc, trois angles, haute résolution ; la mise en scène (mains, décor, lumière chaude) se fait ensuite avec Nano Banana Pro ou gpt-image en prenant le packshot comme image de référence (voir R03).

### 6.2 Qui le fait, et à quel prix

| Option | Lieu | Coût relevé | Délai | Commentaire |
|---|---|---|---|---|
| Boîte photo LED 40 × 40 × 40 cm, 102 LED, 3 000 à 6 500 K, fonds noir, blanc, bleu, vert | Abidjan, Jumia CI | 16 245 à 18 900 FCFA (relevé septembre 2026) | 1 à 3 jours de livraison | Achetée une fois, prêtée à la cliente ou gardée par un assistant 2IAE ; photos au téléphone |
| Studio photo local (Babi Lens Studio) | Abidjan | Forfaits affichés 25 000 à 90 000 FCFA par séance | Sur rendez-vous | Tarifs publiés pour le portrait et le streetwear, pas pour le packshot ; devis à demander |
| Studio packshot e-commerce | Toronto | 25 à 50 USD par image (moyenne 2026) ; une offre locale à partir de 10 USD par produit pour 10 produits minimum plus frais d'installation ; une autre à 150 USD de l'heure | 3 à 7 jours | Pour une marque qui vend au Canada ; expédition des produits à prévoir |
| Studio packshot Casablanca (référence régionale) | Maroc | À partir de 1 000 MAD la séance | Expédition | Indicatif seulement |

Source : https://www.jumia.ci/generic-mini-studio-photo-box-portable40x40x40cm-boite-a-lumiere-tente-declairage-shooting-avec-102-led-lampeseclairage-3000-6500k-lightbox-avec-4-couleurs-de-fonds-20532025.html
Source : https://www.babi-lens-studio.com/boutique
Source : https://www.studioepic.com/Toronto-Product-Photography-Prices.php
Source : https://nightjar.so/blog/the-real-cost-of-product-photography-a-breakdown
Source : https://www.julesdesign.ca/toronto-bulk-product-photography/

### 6.3 Protocole de réception recommandé

1. La cliente dépose (ou fait livrer) un exemplaire de chaque nouveauté à 2IAE, ou photographie elle-même dans la boîte prêtée en suivant une fiche de 6 clichés : face, dos (INCI), 3/4, bouchon ouvert, texture sur fond blanc, échelle avec une pièce de 100 FCFA.
2. Les 6 photos partent « en document » par WhatsApp ; la machine extrait la fiche produit (section 2), détoure le packshot (Canva `remove-background` ou pipeline R03), vérifie l'INCI.
3. Fiche de validation renvoyée à la cliente dans l'heure ; la planche de propositions suit sous 24 heures.

---

## 7. Schéma d'entrée par verticale : coût unitaire et délai cible

Coûts calculés au 1er octobre 2026 avec Haiku 4.5 pour la classification, Sonnet 5.5 pour l'extraction fine, Daily pour l'enregistrement, Orange CI pour la data ; hors génération d'images et de vidéos (R03, R04) et hors temps humain.

| Verticale | Matière première typique | Canal d'entrée | Traitement automatique | Coût unitaire d'entrée | Délai cible dépôt vers planche |
|---|---|---|---|---|---|
| Marque de produits de beauté | 6 photos par produit (dont INCI), parfois fiche fournisseur PDF | WhatsApp « document » ; formulaire pour les lots | Classification, extraction fiche + INCI, détourage packshot, vérification INCI | 0,02 USD d'extraction (6 images Haiku + 1 passe Sonnet) + amortissement boîte photo (18 000 FCFA une fois) | 24 h ; 1 h pour la fiche de validation |
| Association culturelle | Flyer d'événement (image ou PDF), vocal du président | WhatsApp ; PubSubHubbub inutile ; veille agenda régional (R06) | Extraction dates, lieu, prix FCFA ; normalisation ; création de l'événement dans le calendrier éditorial | 0,005 USD par flyer ; 0,01 USD par vocal transcrit | 12 h (les événements sont annoncés tard) |
| Église | Sermon 60 à 90 min ; affiche de culte | PubSubHubbub + Drive `changes.watch` ou Daily ; WhatsApp pour l'affiche et l'audio | Fiche sermon, réception fichier, transcription (R05), extraction affiche | 1,21 USD d'enregistrement Daily pour 90 min + 0,27 USD par mois de stockage ; 1 000 à 4 000 FCFA de data côté église selon résolution ; 0,005 USD par affiche | 24 h (dimanche vers lundi midi) |
| Maison d'édition chrétienne (SEVARTA) | Manuscrit ou PDF de couverture, 4e de couverture, photo auteur, lien Amazon | Formulaire (fichiers lourds) ; Firecrawl sur la page Amazon | Extraction titre, auteur, prix, résumé ; brand kit par livre | 0,01 à 0,05 USD par livre (PDF de 3 à 10 pages sur Sonnet) ; 1 à 5 crédits Firecrawl | 48 h (planche de lancement) |
| École supérieure (2IAE) | Affiche d'admission, photos de vie de campus, replays de cours Daily | Dépôt interne (déjà sur Railway) ; Daily | Extraction dates limites, filières, frais en FCFA ; sélection d'extraits | 0,005 USD par affiche ; 0 USD de collecte (interne) | 24 h |
| Agence B2B (Markel-Tech, LinkedIn) | Étude de cas, capture de livrable, article de veille | Formulaire ; Firecrawl sur le site du client final | Extraction chiffres clés, brand kit du client final | 0,02 USD par étude de cas ; 1 crédit Firecrawl par page | 48 h |

Ordre de grandeur mensuel pour 10 clients actifs et 300 dépôts : moins de 10 USD d'extraction, environ 15 USD de Daily pour 10 sermons, 16 USD de Firecrawl Hobby (ou 0 USD avec le plan gratuit à 1 000 crédits), 0 USD de WhatsApp tant que les clients initient la conversation. L'entrée des matières premières n'est pas un poste de coût ; c'est un poste de délai et de discipline client.

---

## 8. Incertitudes et points à vérifier

1. **Prix Mistral OCR 4** : 4 USD / 2 USD batch / 5 USD annoté viennent de pages tierces de 2026 ; la page mistral.ai/pricing n'affichait pas les montants en rendu statique. À confirmer dans la console Mistral.
2. **Limites Mistral OCR** (50 Mo, 1 000 pages) : relayées par des intégrateurs, non retrouvées sur la page primaire au 1er octobre 2026.
3. **Bail PubSubHubbub de 5 jours** : la documentation Google ne le chiffre pas ; la valeur 432 000 s vient de la liste de discussion du hub et de guides tiers. Prévoir un réabonnement tous les 3 jours par sécurité et journaliser les réponses du hub.
4. **WhatsApp au 1er octobre 2026** : la règle « 1 000 messages de service gratuits par numéro et par mois, puis tarif utilitaire » est annoncée par plusieurs BSP mais absente de la page Meta consultée le même jour ; vérifier la grille « Rest of Africa » (0,0077 USD utilitaire, 0,0604 USD marketing selon EngageLab) sur le fichier de tarifs Meta.
5. **Débit montant réel à Abidjan** : aucune mesure 2026 ouverte ; les 5 à 10 Mbit/s retenus sont une hypothèse. Mesurer avec la régie de chaque église (test de 100 Mo) avant de fixer la résolution demandée.
6. **Qualité française de Claude en OCR** : non chiffrée par Anthropic ; monter un jeu de 30 flyers et 20 étiquettes ivoiriennes annotés à la main et mesurer Haiku, Sonnet 5.5 et Mistral OCR 4 avant de choisir.
7. **Prix Azure** : la page officielle affiche « $- » sans sélection de région ; les montants cités viennent d'un relevé d'août 2026.
8. **Coût du format `branding` Firecrawl** : 1 crédit selon le glossaire Firecrawl ; la page de prix ne le mentionne pas explicitement.
9. **Packshot à Abidjan** : aucun tarif public spécifique ; les forfaits Babi Lens concernent le portrait. Demander deux devis.
10. **Google Takeout** : la règle « format d'origine pendant 6 mois » date de sources anciennes ; vérifier le comportement actuel sur une chaîne test.
11. **Business Discovery** : la documentation ne précise pas de limite de médias par page ; tester `.limit(50)` sur l'arête `media`.
12. **App Review Meta** : durée et exigences (vidéo de démonstration, politique de confidentialité, vérification d'entreprise de Markel-Tech Inc.) non chiffrées ici ; c'est le risque calendaire principal de l'onboarding en une heure.

---

## 9. Implications pour la machine de José

1. **Un seul extracteur par défaut : Claude avec `output_config.format` JSON Schema.** Haiku 4.5 pour classifier et extraire les flyers simples (0,005 USD par document), Sonnet 5.5 pour les étiquettes INCI et les PDF (0,015 USD). Le gain d'un OCR spécialisé ne vaut pas une intégration de plus pour quelques centaines de documents par mois.
2. **Garder Mistral OCR 4 en seconde ligne** pour les PDF longs (catalogues fournisseurs, manuscrits SEVARTA) grâce au prix à la page et aux annotations par schéma ; activer le batch (2 USD par 1 000 pages) puisque ces documents n'ont jamais besoin d'une réponse immédiate.
3. **Un schéma JSON par verticale, versionné dans le dépôt**, avec des champs normalisés : `date_debut` au format ISO, `prix_xof` en entier, `lieu` décomposé en commune, quartier, repère, `inci` en tableau ordonné. La normalisation se fait dans l'appel d'extraction, pas après.
4. **Deux photos obligatoires pour un produit cosmétique** : la face et la zone INCI à plat, envoyées « en document » WhatsApp pour échapper à la compression. Refuser poliment (message automatique) les photos floues de moins de 1 000 px de côté.
5. **Vérifier chaque INCI extrait contre une base de noms** avant publication ; une liste d'ingrédients fausse sur un post beauté est un risque réglementaire et de réputation que 95 % d'exactitude ne couvre pas.
6. **Ne jamais télécharger depuis YouTube**, même la chaîne d'un client consentant : PubSubHubbub pour détecter, Drive ou Daily pour recevoir, Studio (720p) ou Takeout seulement par le propriétaire, pour dépanner.
7. **Proposer aux églises une salle Daily d'enregistrement** branchée sur leur régie : 1,21 USD par sermon de 90 minutes, fichier 1080p dans le bucket Railway sans téléversement manuel ni forfait data, et 2IAE maîtrise déjà l'outil.
8. **Pour les églises sans régie, demander l'audio seul par WhatsApp** (43 Mo pour 90 minutes à 64 kbit/s) et produire les clips à partir de l'audio et d'extraits 720p ; la planche sort le lundi midi au lieu d'attendre un transfert de 5 Go.
9. **Télécharger tout média WhatsApp dans la minute et l'archiver dans le bucket** : URL valable 5 minutes, identifiant 7 jours. Le webhook doit mettre en file, pas traiter en ligne.
10. **Accusé de réception conversationnel systématique** (« Reçu : flyer du 12 octobre, Cocody, 5 000 F, c'est bien ça ? ») avec boutons oui/non : c'est la couche de qualité la moins chère de toute la chaîne.
11. **Formulaire web avec lien magique uniquement pour les lots et les vidéos** ; tout le reste passe par WhatsApp. Ne pas construire un portail client complet avant d'avoir mesuré que les clients l'ouvrent.
12. **Lancer l'App Review Meta (Advanced Access) dès maintenant**, avant la plateforme, sur les deux routes : Instagram Business Login pour les clients sans Page Facebook, Facebook Login for Business avec jeton d'utilisateur système pour les clients structurés. Sans cela, l'onboarding en une heure est impossible pour un compte que José n'administre pas.
13. **Automatiser le renouvellement des jetons Instagram à J+50** et le réabonnement PubSubHubbub tous les 3 jours, avec alerte CallMeBot en cas d'échec : ce sont les deux pannes silencieuses qui font « décrocher » un client sans que personne ne s'en aperçoive.
14. **Brand kit en deux passes** : Firecrawl `branding` (1 crédit, plan gratuit suffisant) pour les hexadécimaux et polices, Claude pour le ton et les mots interdits ; pousser le résultat dans un Brand Kit Canva pour que les planches héritent des couleurs sans ressaisie.
15. **Pour les clients sans site**, prévoir le chemin « page Facebook + 3 visuels WhatsApp » comme source de brand kit ; c'est le cas majoritaire des associations et églises d'Abidjan.
16. **Importer 50 posts, pas 500** : Business Discovery suffit pour la fiche de voix et ne nécessite que les permissions de lecture ; l'historique complet n'apporte rien de plus à R11 et consomme le quota BUC.
17. **Une boîte photo de 18 000 FCFA par ville** (Abidjan, et une à Toronto pour les marques canadiennes) plutôt qu'un studio par produit : le packshot réel devient une étape à coût marginal nul, et la mise en scène reste générative.
18. **Mesurer dès le premier mois trois indicateurs d'entrée** : délai médian dépôt vers planche par verticale (cible 24 h), taux de dépôts « incomplets » renvoyés au client (cible sous 20 %), taux de corrections humaines sur les fiches extraites (cible sous 10 %). Ce sont ces chiffres, pas le prix de l'OCR, qui diront si « la machine fait le reste ».

---

## Sources consultées

1. https://platform.claude.com/docs/en/build-with-claude/vision
2. https://platform.claude.com/docs/en/build-with-claude/pdf-support
3. https://platform.claude.com/docs/en/build-with-claude/structured-outputs
4. https://platform.claude.com/docs/en/about-claude/pricing
5. https://docs.mistral.ai/capabilities/document_ai/document_ai_overview
6. https://docs.mistral.ai/capabilities/document_ai/basic_ocr
7. https://docs.mistral.ai/capabilities/document_ai/annotations
8. https://mistral.ai/pricing
9. https://mistral.ai/news/mistral-ocr
10. https://www.aimadetools.com/blog/mistral-ocr-4-complete-guide/
11. https://www.librechat.ai/docs/features/ocr
12. https://cloud.google.com/document-ai/pricing
13. https://docs.cloud.google.com/document-ai/limits
14. https://docs.cloud.google.com/document-ai/quotas
15. https://aiproductivity.ai/blog/document-ai-cost-comparison/
16. https://azure.microsoft.com/en-us/pricing/details/ai-document-intelligence/
17. https://docuocr.com/blog/azure-document-intelligence-pricing
18. https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/language-support/ocr
19. https://kth.diva-portal.org/smash/get/diva2:1865192/FULLTEXT01.pdf
20. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12835874/
21. https://www.specialchem.com/cosmetics/all-inci-ingredients
22. https://www.youtube.com/static?template=terms
23. https://support.google.com/youtube/answer/56100
24. https://techieinspire.com/download-youtube-videos-original-format-google-takeout/
25. https://joshdance.medium.com/youtube-studio-only-gives-you-720p-when-you-download-your-own-video-3a7c3a751507
26. https://developers.google.com/youtube/v3/guides/push_notifications
27. https://groups.google.com/g/google-pubsubhubbub/c/DWDnBOoQxew
28. https://vidproxy.pro/youtube-webhook
29. https://developers.google.com/workspace/drive/api/guides/push
30. https://developers.google.com/workspace/drive/api/guides/limits
31. https://docs.daily.co/guides/products/live-streaming-recording/recording-calls-with-the-daily-api
32. https://www.daily.co/pricing/video-sdk/
33. https://blog.iambeezy.app/fr/forfait-internet-orange-ci-2026-pass-data/
34. https://www.vibrantsnap.com/video-file-size-calculator
35. https://tradingeconomics.com/ivory-coast/internet-speed
36. https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media
37. https://developers.facebook.com/docs/whatsapp/pricing/
38. https://www.engagelab.com/blog/whatsapp-business-api-pricing
39. https://chatarmin.com/en/blog/whatsapp-business-costs
40. https://docs.firecrawl.dev/features/scrape
41. https://www.firecrawl.dev/blog/branding-format-v2
42. https://www.firecrawl.dev/glossary/web-extraction-apis/extract-website-branding
43. https://www.firecrawl.dev/pricing
44. https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery
45. https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login
46. https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business
47. https://www.facebook.com/business/help/1717412048538897
48. https://www.leadsie.com/blog/give-meta-business-portfolio-access
49. https://oneclickonboard.com/blog/how-to-get-meta-business-manager-access-from-clients-2026
50. https://www.jumia.ci/generic-mini-studio-photo-box-portable40x40x40cm-boite-a-lumiere-tente-declairage-shooting-avec-102-led-lampeseclairage-3000-6500k-lightbox-avec-4-couleurs-de-fonds-20532025.html
51. https://www.babi-lens-studio.com/boutique
52. https://www.studioepic.com/Toronto-Product-Photography-Prices.php
53. https://nightjar.so/blog/the-real-cost-of-product-photography-a-breakdown
54. https://www.julesdesign.ca/toronto-bulk-product-photography/
