# R22. WhatsApp comme interface de validation et de supervision : Flows, boutons interactifs, modèles, BSP, numéros et coût réel

Rapport de recherche rédigé le 2 octobre 2026 pour la machine social media multi-clients de José Kouadio (Markel-Tech, SEVARTA, 2IAE). Il répond aux sept questions posées par la mission, en s'appuyant d'abord sur la documentation officielle Meta (developers.facebook.com, whatsappbusiness.com), puis sur les pages de prix des BSP et sur des sources datées de 2026. Chaque prix et chaque limite porte sa date. Quand une information n'a pas pu être confirmée, elle est signalée dans la section « Incertitudes ».

Note de lecture : la documentation Meta a migré en 2026 de `developers.facebook.com/docs/whatsapp/...` vers `developers.facebook.com/documentation/business-messaging/whatsapp/...`. Plusieurs anciennes URL renvoient une erreur 404 et les nouvelles pages sont rendues côté client, ce qui complique l'extraction automatique. Les URL citées ci-dessous sont celles qui répondaient le 2 octobre 2026.

## 0. Résumé exécutif

1. La « validation en un tap sans compte » est techniquement simple et presque gratuite. Le message « votre planche est prête » part comme **modèle utilitaire** avec en-tête image et jusqu'à 3 boutons de réponse rapide. Hors fenêtre de 24 heures il coûte 0,0040 USD en Côte d'Ivoire (zone « Reste de l'Afrique »), 0,0034 USD au Canada (Amérique du Nord) et 0,0300 USD en France, grille Meta du 1er octobre 2026. Le tap de la cliente ouvre une fenêtre de 24 heures pendant laquelle les messages libres (boutons, listes, Flows) sont des messages de service : 1 000 gratuits par numéro et par mois depuis le 1er octobre 2026, puis 0,0040 USD.
2. Avec l'hypothèse de la mission (4 planches, 2 rappels, 10 alertes par client et par mois), le coût Meta est de **0,06 à 0,10 USD par client et par mois** en Côte d'Ivoire et au Canada, et de 0,48 USD en France. Le vrai coût est le coût fixe du fournisseur : 0 USD en accès direct Cloud API, 49 EUR par numéro et par mois chez 360dialog, 0,005 USD par message chez Twilio, 29 à 249 USD par mois plus environ 20 % de marge chez Wati.
3. Les **WhatsApp Flows** permettent de faire valider 6 à 10 propositions dans un seul formulaire natif (jusqu'à 100 écrans, 50 composants par écran, 3 images par écran, images conseillées sous 300 Ko, boutons radio jusqu'à 20 options). Un Flow ne coûte rien en lui-même : on paie le message qui le porte.
4. Les **carrousels** (2 à 10 cartes avec image ou vidéo) sont réservés à la catégorie marketing : 0,0225 USD par envoi en Côte d'Ivoire, 0,025 USD au Canada, 0,0859 USD en France. Ils restent abordables mais Meta peut les reclasser et ils comptent dans la note de qualité.
5. Les **vocaux entrants** arrivent en OGG Opus, se téléchargent avec un jeton d'accès (URL valable 5 minutes, média disponible 7 jours) et se transcrivent pour 0,003 à 0,006 USD la minute (OpenAI) ou 0,0043 à 0,0052 USD (Deepgram Nova-3).
6. L'**accès direct à la Cloud API** sous le portefeuille Markel-Tech, avec un numéro canadien et un numéro ivoirien dans le même compte WhatsApp Business, est la voie la plus économique. La **coexistence** avec l'application WhatsApp Business (même numéro sur l'app et sur l'API) existe depuis mai 2025, mais elle n'est accessible que par un Solution Partner ou un Tech Provider, plafonne à 20 messages par seconde et désactive plusieurs fonctions.
7. La **politique de messagerie WhatsApp du 23 septembre 2026** et la **loi canadienne anti-pourriel (LCAP, CASL)** se satisfont d'une clause d'opt-in nominative signée au contrat, avec journal de preuve et mot STOP.
8. Côté **gestionnaire humain**, la PWA de la plateforme avec Web Push (iOS 16.4 et plus, app ajoutée à l'écran d'accueil) et WhatsApp lui-même se complètent : WhatsApp pour l'alerte, la PWA pour l'écran de supervision.

## 1. Messages interactifs : ce que la Cloud API permet, avec ses limites

### 1.1 Les quatre formats interactifs (hors modèles)

Les messages interactifs sont des messages « libres » : ils ne peuvent être envoyés que dans une fenêtre de service de 24 heures ouverte par un message de la personne. Hors fenêtre, il faut un modèle approuvé (section 3).

| Format | Nombre d'options | En-tête | Corps | Pied | Libellé bouton | Source |
|---|---|---|---|---|---|---|
| Boutons de réponse (`interactive.type = button`) | 3 boutons maximum | texte, image, vidéo ou document | 1 024 caractères | 60 caractères | 20 caractères, identifiant 256 caractères | Meta, page « Interactive reply buttons messages », API v25.0 |
| Liste (`interactive.type = list`) | 10 sections, 10 lignes au total | texte seulement (60 caractères) | 4 096 caractères | 60 caractères | bouton d'ouverture 20 caractères, titre de ligne 24, description 72 | Meta, page « Interactive list messages » |
| Bouton URL (`interactive.type = cta_url`) | 1 seul bouton URL | texte, image, vidéo ou document | texte libre | optionnel | 20 caractères | documentation CM.com reprenant la spécification Meta (la page Meta renvoyait 404 le 2 octobre 2026) |
| Flow (`interactive.type = flow`) | 1 bouton d'ouverture | texte (média non confirmé, voir incertitudes) | texte | optionnel | `flow_cta` conseillé à 30 caractères, sans émoji | Meta, guide « Send a Flow message » |

Source : https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages
Source : https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-list-messages
Source : https://developers.cm.com/messaging/docs/whatsapp-interactive-messages
Source : https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/guides/sendingaflow

Lorsque la personne tape un bouton de réponse, le webhook `messages` reçoit un objet `button_reply` contenant l'identifiant et le titre du bouton ; pour une liste, un objet `list_reply` avec l'identifiant de la ligne. C'est tout ce dont la plateforme a besoin pour enregistrer « validé » ou « à revoir » sans que la cliente ne crée de compte.

### 1.2 Réponse directe à la question « image de maquette plus deux boutons Oui et À revoir »

Oui, et c'est même l'exemple de la documentation officielle : la page des boutons de réponse montre un message avec en-tête image, corps, pied et deux boutons de réponse. Le libellé est limité à 20 caractères, sans émoji ni mise en forme, et doit être unique dans le message. « Oui, je valide » (14 caractères) et « À revoir » (8 caractères) passent. Un troisième bouton « Voir en grand » est possible, mais un bouton URL ne se mélange pas aux boutons de réponse dans un message interactif : pour renvoyer vers la planche complète sur la PWA, il faut soit un second message `cta_url`, soit un modèle (un modèle accepte un en-tête image de 5 Mo, un corps de 1 024 caractères et jusqu'à 10 boutons mélangés, réponse rapide et URL, le webhook renvoyant le `payload` du bouton tapé).

Contrainte décisive : ce message interactif n'est envoyable que si la cliente a écrit dans les 24 dernières heures. Pour une planche hebdomadaire, ce n'est presque jamais le cas. La séquence correcte est donc :

1. **Modèle utilitaire** avec en-tête image (JPEG ou PNG, 5 Mo maximum) et boutons de réponse rapide « Je valide » / « À revoir » / « Voir la planche » : envoyable à tout moment, facturé au tarif utilitaire.
2. Dès que la cliente tape un bouton, la fenêtre de 24 heures s'ouvre : la plateforme enchaîne avec des messages interactifs libres (une image par proposition avec ses 2 ou 3 boutons, une liste pour choisir la proposition à commenter, ou un Flow pour tout valider d'un coup).

### 1.3 Carrousels : 2 à 10 cartes, marketing seulement

Les carrousels sont des **modèles** (pas des messages interactifs libres) et, d'après la page Meta « Media card carousel templates », ils relèvent de la catégorie marketing uniquement. Spécifications confirmées le 2 octobre 2026 :

- 2 cartes minimum, 10 maximum, nombre fixé à la création du modèle ;
- chaque carte : en-tête image ou vidéo (même type pour toutes les cartes), corps de 160 caractères, jusqu'à 2 boutons (réponse rapide, URL ou appel), configuration identique sur toutes les cartes ;
- bulle d'introduction : 1 024 caractères ;
- envoi par l'endpoint `/messages` avec les paramètres de chaque carte (identifiant de média, variables, index de carte) ;
- disponibles sur Cloud API uniquement.

Source : https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/marketing-templates/media-card-carousel-templates

Conséquence pour la machine : un carrousel « vos 6 propositions de la semaine » avec un bouton « Je valide » et un bouton « À revoir » sur chaque carte est exactement l'interface rêvée, mais il est facturé au tarif marketing (0,0225 USD en Côte d'Ivoire, 0,025 USD au Canada, 0,0859 USD en France) et il est soumis à la revue marketing, plus lente (30 minutes à 24 heures) que la revue utilitaire. Il faut aussi que les images (une par carte) soient déjà téléversées sur Meta (identifiant de média) au moment de l'envoi. Le surcoût reste dérisoire (4 planches par mois = 0,09 USD en Côte d'Ivoire), le vrai risque est la note de qualité si la cliente bloque ou signale.

## 2. WhatsApp Flows : formulaires natifs dans la conversation

### 2.1 Ce qu'est un Flow

Un Flow est un formulaire multi-écrans déclaré en JSON (Flow JSON), rendu nativement dans WhatsApp, qui s'ouvre depuis un bouton de message. Il s'envoie de deux façons (guide Meta « Send a Flow message ») :

- dans la fenêtre de 24 heures, comme message interactif de type `flow` ;
- hors fenêtre, comme **modèle** avec un bouton de type `FLOW`, le modèle devant être approuvé (catégorie utilitaire ou marketing).

Deux modes : `navigate` (le Flow embarque ses données, aucun serveur nécessaire) et `data_exchange` (chaque écran interroge un endpoint chiffré chez José). Un `flow_token` fourni à l'envoi revient avec la réponse : c'est l'identifiant de la planche.

Source : https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/guides/sendingaflow

### 2.2 Composants et limites (Flow JSON 7.x, documentation consultée le 2 octobre 2026)

| Élément | Limite |
|---|---|
| Écrans par Flow | 100 maximum (erreur de validation `MAX_SCREENS_NUMBER` au-delà) |
| Composants par écran | 50 |
| Images par écran (`Image`, base64 JPEG ou PNG) | 3, taille conseillée 300 Ko chacune |
| `RadioButtonsGroup` et `CheckboxGroup` | 1 à 20 options ; image d'option limitée à 100 Ko depuis la v6.0 |
| `Dropdown` | jusqu'à 200 options (100 avec images) |
| `ChipsSelector` | 1 à 20 options (depuis v7.1) |
| `OptIn` par écran | 5 |
| `EmbeddedLink` par écran | 2 |
| `NavigationList` par écran | 2 |
| `Footer` (bouton principal) par écran | 1 |
| `TextInput` libellé | 20 caractères ; `max-chars` configurable |
| Taille du Flow JSON | 10 Mo maximum ; 100 Ko recommandés par 8x8 pour la performance |
| Autres composants | `TextArea`, `DatePicker`, `CalendarPicker` (v6.1), `PhotoPicker`, `DocumentPicker`, `ImageCarousel`, `RichText`, `If`/`Switch` |

Source : https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/reference/components
Source : https://pywa.readthedocs.io/en/latest/content/flows/flow_json.html
Source : https://www.heltar.com/blogs/how-to-fix-maxscreensnumber-error-in-whatsapp-flows-2025-limit-hit-cmbz8mr660003m7n4xmvjbbvb
Source : https://developer.8x8.com/connect/docs/whatsapp/whatsapp-flows-best-practices/

### 2.3 Approbation, publication, coût

- **Publication** : un Flow passe de `DRAFT` à `PUBLISHED` après validation automatique du JSON ; la publication est irréversible (on peut mettre à jour les actifs, ce qui repasse le Flow en brouillon, puis republier). Un Flow brouillon peut être testé en mode `draft`. Un lien de prévisualisation web, valable 30 jours, peut être partagé avec la cliente.
- **Revue Meta** : les sources divergent. AWS End User Messaging décrit la publication comme une validation structurelle automatique ; plusieurs BSP (SMSGatewayCenter, Infiq) parlent d'une revue de 24 à 48 heures, surtout pour les Flows marketing. Ce qui est certain : le **modèle** qui porte le bouton Flow passe par la revue de modèles classique (voir section 3).
- **Coût** : Meta ne facture pas le Flow. On paie le message qui le porte : modèle utilitaire ou marketing hors fenêtre, message de service dans la fenêtre (1 000 gratuits par numéro et par mois depuis le 1er octobre 2026). Twilio demande, pour tout Flow envoyé hors fenêtre, un Content Template approuvé en catégorie MARKETING ou UTILITY.
- **Endpoint `data_exchange`** : chiffrement RSA-2048 (OAEP SHA-256) pour la clé, AES-128-GCM pour les données, clé publique enregistrée via `/{phone_number_id}/whatsapp_business_encryption`, réponse attendue en moins de quelques secondes (les implémentations courantes visent 2,5 à 3 secondes, 8x8 recommande moins de 5 secondes), action `ping` pour le contrôle de santé. Meta surveille le taux d'erreur, la latence et la disponibilité par webhooks d'alerte.

Source : https://docs.aws.amazon.com/social-messaging/latest/userguide/managing-flows-publish.html
Source : https://www.twilio.com/docs/content/whatsapp-flows
Source : https://github.com/guilhermejansen/whatsapp-flows-server

### 2.4 Faire valider 6 à 10 propositions en un seul Flow

C'est possible et c'est le bon usage. Deux architectures :

**A. Flow autonome (`navigate`), régénéré chaque semaine.** Un écran par proposition : composant `Image` (maquette compressée sous 300 Ko), `TextBody` (accroche et légende), `RadioButtonsGroup` à 3 options (« Je valide », « À revoir », « Je refuse »), `TextArea` optionnel « Votre remarque », `Footer` « Suivant ». Dernier écran : récapitulatif et bouton « Envoyer ». Dix propositions = 11 écrans et environ 4 Mo de JSON, sous les limites. Inconvénient : un Flow à créer et publier par planche, immuable une fois publié.

**B. Flow générique (`data_exchange`) alimenté par la plateforme.** Un seul Flow publié une fois pour toutes ; chaque écran demande à l'endpoint de Railway l'image et le texte de la proposition n, et renvoie la réponse de la cliente écran par écran. Avantage : un seul Flow à maintenir et des réponses enregistrées écran par écran. Inconvénient : chiffrement à implémenter et délai de réponse à tenir.

**C. Variante légère recommandée pour démarrer.** Envoyer la planche comme **une seule image composite** en en-tête du modèle (grille numérotée de 6 à 10 vignettes, 5 Mo maximum) puis un Flow sans image : un écran « Cochez les propositions validées » (`CheckboxGroup`, 10 options) et un écran « Lesquelles sont à revoir, et pourquoi » (`CheckboxGroup` plus `TextArea`). Deux écrans, Flow générique réutilisable, aucune contrainte de taille. La vignette agrandie reste accessible par le bouton URL vers la PWA.

Point d'attention : les composants de saisie d'un Flow ne font pas remonter de fichier image vers la cliente ; `PhotoPicker` sert à ce qu'elle envoie une photo (par exemple le nouveau produit de beauté à mettre en avant), ce qui est un atout pour l'étape 1 de la routine (dépôt des nouveautés).

## 3. Modèles de message : catégories, délais, reclassement, prix

### 3.1 Définitions Meta (page « Template categorization », consultée le 2 octobre 2026)

- **Utilitaire** : non promotionnel ET (lié à une demande ou une transaction précise de la personne OU essentiel). Exemples Meta : confirmation de commande, alerte de compte, confirmation d'opt-in, enquête de satisfaction liée à une transaction.
- **Marketing** : tout le reste, y compris les contenus mixtes ou ambigus (« un message qui contient des éléments utilitaires et marketing est classé et facturé marketing »).
- **Authentification** : codes à usage unique seulement, avec bouton de copie ou en un tap, sans URL, média ni émoji.

Source : https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization

### 3.2 Délai et taux d'approbation

Meta n'annonce pas de taux. Les observations concordantes des BSP en 2026 : la plupart des modèles utilitaires et d'authentification sont approuvés en moins de 5 minutes (revue automatique), les modèles marketing en 30 minutes à 24 heures, et jusqu'à 48 heures en cas de revue humaine. Causes de rejet les plus fréquentes : langage promotionnel dans un modèle utilitaire, variables mal formées ou en début et fin de texte, raccourcisseurs d'URL (bit.ly), contenu générique sans variable. Après approbation, chaque modèle reçoit une note de qualité (en attente, haute, moyenne, basse) et peut être mis en pause si trop de personnes le bloquent.

Source : https://chati.ai/blog/whatsapp-business-api-template-approval-time-in-2026-bottlenecks-rejections-how-to-get-approved-faster
Source : https://www.twilio.com/docs/whatsapp/tutorial/message-template-approvals-statuses

### 3.3 Règle de reclassement par Meta

- Utilitaire vers marketing : préavis d'un jour (courriel, webhook `message_template_category_update`, WhatsApp Manager) ; le modèle reste approuvé et utilisable, mais facturé marketing ; demande de révision possible dans les 60 jours. Depuis le 16 avril 2025, les entreprises déjà averties pour abus subissent le reclassement instantané, sans préavis.
- Marketing ou utilitaire vers authentification : préavis, puis le modèle passe en REJECTED le 1er du mois suivant, sans appel.
- Depuis le 9 avril 2025, la propriété `allow_category_change` est dépréciée : Meta applique sa catégorie par défaut.

Pour la machine : écouter le webhook de changement de catégorie et alerter José, car le prix du message « planche prête » peut passer de 0,0040 à 0,0225 USD du jour au lendemain si le texte dérape vers la promotion (« découvrez nos nouvelles créations »).

### 3.4 Quel modèle pour « votre planche de la semaine est prête » hors fenêtre

Catégorie **utilitaire**, parce que le message est lié à un service que la cliente a demandé (contrat de gestion social media), personnalisé (nom du client, numéro de planche, date) et non promotionnel. Formulation testée contre les critères Meta :

> Bonjour {{1}}, votre planche n° {{2}} ({{3}} propositions) est prête pour validation. Merci de répondre avant le {{4}}.
> [image : aperçu composite de la planche]
> Boutons : « Je valide tout » (réponse rapide) · « À revoir » (réponse rapide) · « Voir la planche » (URL vers la PWA avec jeton)

À éviter dans ce modèle : « nouveautés », « offre », « découvrez », émoji en rafale, lien raccourci. Un modèle de rappel distinct (« votre planche n° {{1}} attend toujours votre réponse ») reste utilitaire. Les alertes au gestionnaire humain (« planche validée », « production terminée », « publication faite ») sont également utilitaires.

### 3.5 Prix réel par pays (grille Meta en USD, par message délivré)

| Marché | Marketing | Utilitaire | Authentification | Service (au-delà de 1 000 gratuits par numéro et par mois) | Vérification |
|---|---|---|---|---|---|
| Reste de l'Afrique (Côte d'Ivoire, indicatif +225) | 0,0225 | 0,0040 | 0,0040 | 0,0040 | grille Meta effective 1er octobre 2026 reprise par Flowcall (vérifiée le 28 septembre 2026), Whautomate et 360dialog ; grille Salesforce du 1er mars 2026 cohérente (ligne « Ivory Coast », multiplicateur 27,78 contre 30,87 pour le Canada, soit le même rapport 0,0225 / 0,025) |
| Amérique du Nord (Canada, États-Unis) | 0,0250 | 0,0034 | 0,0034 | 0,0034 | idem, plus Engagelab (grilles Meta du 1er juillet et du 1er octobre 2026 relevées le 11 septembre 2026) |
| France (grille autonome) | 0,0859 | 0,0300 | 0,0300 | 0,0300 | idem, plus Getkanal (grille du 1er juillet 2026) |

Source : https://www.flowcall.co/blog/whatsapp-business-api-pricing
Source : https://whautomate.com/whatsapp-business-api-pricing
Source : https://www.engagelab.com/blog/whatsapp-business-api-pricing
Source : https://360dialog.com/blog/whatsapp-service-message-charging-october-2026/
Source : https://www.salesforce.com/en-us/wp-content/uploads/sites/4/assets/pdf/whatsapp-business-messaging-rate-card-mm-lite-march-1-2026.pdf
Source : https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing

**Sur la divergence 0,0225 contre 0,0259 USD signalée par R10** : les trois reprises datées de la grille du 1er octobre 2026 (Flowcall, Whautomate, 360dialog) et la grille Salesforce de mars 2026 donnent 0,0225 USD pour « Reste de l'Afrique ». La valeur 0,0259 n'apparaît que dans un résumé de moteur de recherche citant un calculateur tiers (Whatsetter), avec un utilitaire à 0,0046 qui ne correspond à aucune autre reprise. Au 1er octobre 2026, le Maroc a quitté la zone « Reste de l'Afrique » pour une grille autonome (0,0414 marketing, 0,0230 utilitaire), ce qui peut expliquer une confusion. Le CSV officiel n'a pas pu être téléchargé (page rendue en JavaScript, liens de téléchargement invisibles au robot) : à ouvrir à la main dans un navigateur avant tout devis (section « Rate cards effective October 1, 2026 » de la page Pricing).

### 3.6 Ce qui a changé le 1er octobre 2026

Page Meta « Upcoming pricing updates for Meta Business Agent, service and utility messages » : depuis le 1er octobre 2026, les **messages de service** (réponses libres, humaines ou IA tierce, dans la fenêtre de 24 heures) et les **modèles utilitaires envoyés dans la fenêtre** sont facturés au tarif utilitaire du marché, sans palier de volume pour le service. Les messages de service étaient gratuits depuis le 1er novembre 2024, les utilitaires dans la fenêtre depuis le 1er juillet 2025. Les BSP (360dialog, Wati, Respond.io, Tech-ish le 1er octobre 2026) confirment une **franchise de 1 000 messages de service gratuits par numéro de téléphone professionnel et par mois**, sans report ; la page Meta résumée par notre outil ne la mentionnait pas explicitement, elle est donc à vérifier dans WhatsApp Manager. Les messages dans la fenêtre gratuite de 72 heures ouverte par une publicité « Click to WhatsApp » restent gratuits. Les comptes sans moyen de paiement enregistré au 30 septembre 2026 ne reçoivent plus de messages de service délivrés.

Source : https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages
Source : https://tech-ish.com/2026/10/01/whatsapp-business-platform-charges-start-today-but-the-first-1000-replies-are-free/
Source : https://www.wati.io/en/blog/whatsapp-service-message-pricing/

## 4. Messages vocaux entrants : récupération et transcription

### 4.1 Mécanique Cloud API

1. Le webhook `messages` reçoit un message de type `audio` ; une note vocale porte `voice: true` et le type MIME `audio/ogg; codecs=opus`.
2. La plateforme appelle `GET /{API_VERSION}/{MEDIA_ID}?phone_number_id=...` avec le jeton d'accès pour obtenir l'URL du média, puis télécharge le fichier avec l'en-tête `Authorization: Bearer`. **L'URL expire après 5 minutes** ; en cas d'échec, redemander l'URL.
3. Un média reçu par webhook reste téléchargeable **7 jours** (30 jours pour un média téléversé par l'API). Taille maximale audio : 16 Mo. Formats acceptés : AAC, AMR, MP3, M4A, OGG Opus (mono).
4. Depuis le 17 mars 2026, Meta envoie aussi un statut `played` quand la personne écoute un vocal envoyé par l'entreprise.

Source : https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media
Source : https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/audio-messages

### 4.2 Transcription : prix au 2 octobre 2026

| Service | Modèle | Prix | Remarque |
|---|---|---|---|
| OpenAI | `gpt-4o-mini-transcribe` | 0,003 USD la minute | le moins cher, français correct |
| OpenAI | `gpt-transcribe` | 0,0045 USD la minute | nouveau modèle listé sur la page de prix |
| OpenAI | `whisper-1`, `gpt-4o-transcribe`, `gpt-4o-transcribe-diarize` | 0,006 USD la minute | diarisation utile si deux personnes parlent |
| Deepgram | Nova-3 multilingue, fichier | 0,0052 USD la minute (0,0043 en plan Growth) | 200 USD de crédit gratuit à l'ouverture, 45 langues et plus |
| Deepgram | Nova-3 multilingue, flux | 0,0058 USD la minute (promotion, 0,0092 au tarif plein) | inutile ici, les vocaux sont des fichiers |

Source : https://developers.openai.com/api/docs/pricing
Source : https://deepgram.com/pricing

OpenAI accepte l'OGG directement pour `whisper-1` ; certains retours de terrain conseillent une conversion en MP3 ou WAV (ffmpeg) avant envoi pour éviter les refus de format sur les nouveaux modèles. Coût réel : une cliente qui laisse 10 vocaux d'une minute par mois coûte 0,03 à 0,06 USD de transcription. Renvoyer la transcription à la cliente avec un bouton « C'est bien ça » : les modèles multilingues gèrent le mélange français-anglais, pas le baoulé ni le dioula.

## 5. Accès direct à la Cloud API ou BSP : coûts, hébergement, numéros, coexistence

### 5.1 Comparatif (prix relevés le 2 octobre 2026)

| Voie | Coût fixe | Marge par message | Hébergement du numéro | Prérequis | Observations |
|---|---|---|---|---|---|
| **Cloud API directe** (Meta) | 0 | 0 (grille Meta) | chez Meta, numéro apporté par José | portefeuille Business vérifié, app Meta, carte bancaire dans Billing Hub | 2 numéros avant vérification, 20 après ; limite de 250 conversations par jour avant vérification |
| **Twilio** | 0 (numéro Twilio en option, environ 1,15 USD par mois pour un numéro local américain, variable par pays) | 0,005 USD par message entrant ou sortant, plus 0,001 USD par message en échec, plus 0,015 USD par message pour le suivi de liens au-delà de 1 000 par mois | Twilio | compte Twilio, inscription du sender | SDK solide, Content Templates, prix « as of September 2026 » |
| **360dialog** | 49 EUR par numéro et par mois (Regular), 99 EUR (Premium, SLA 30 minutes, vérification sous 48 heures, MCP messagerie), 500 EUR (Scale) ; offre Partner Platform à partir de 250 EUR par mois plus 49 EUR par canal | 0 (« zero message markup ») | 360dialog | compte 360dialog | tarifs page Pricing datée du 1er octobre 2026, sans engagement |
| **Wati** | 29 USD (Growth, 3 utilisateurs), 99 USD (Pro, 5 utilisateurs), 249 USD (Business) par mois en facturation annuelle sur la page officielle ; 59, 119 et 279 USD d'après l'instantané Chatarmin de mai 2026 | environ 20 % sur les tarifs Meta d'après plusieurs comparatifs indépendants (Wati ne publie pas le chiffre) ; numéro supplémentaire autour de 29 USD par mois | Wati | compte Wati | solution « inbox » complète, surdimensionnée pour un usage API pur |
| **Infobip** | sur devis ; page de prix inaccessible au robot (403) | marge estimée autour de 39 % en moyenne sur 20 marchés par un comparatif concurrent (Getmacha), non vérifiée | Infobip | compte entreprise | orienté grands comptes |

Source : https://www.twilio.com/en-us/whatsapp/pricing
Source : https://360dialog.com/pricing
Source : https://www.wati.io/pricing/
Source : https://chatarmin.com/en/blog/wati-pricing
Source : https://www.getmacha.com/blog/best-infobip-alternatives

Pour 10 clients et environ 300 messages par mois, le coût Meta direct est inférieur à 2 USD ; Twilio ajouterait environ 2 USD (400 messages dans les deux sens), 360dialog 49 EUR par numéro, Wati 29 USD minimum plus marge. L'accès direct gagne sans discussion dès lors que la plateforme Node/Express gère elle-même les webhooks, ce qui est déjà le cas pour Facebook Graph API.

### 5.2 Vérification « Tech Provider » : utile seulement si les clients possèdent leur numéro

Deux organisations possibles :

- **Un seul WABA Markel-Tech** (recommandé) : les clientes sont des destinataires, pas des titulaires de compte. Elles reçoivent les planches depuis le numéro de Markel-Tech. Aucun statut partenaire n'est requis : « Onboard without a partner » dans le tableau de bord de l'app Meta, vérification de l'entreprise, carte bancaire.
- **Un WABA par client** (le client possède son numéro et paie Meta) : José doit devenir **Tech Provider** : vérification de l'entreprise Markel-Tech, revue d'app avec deux vidéos de démonstration (envoi de message, création de modèle), obtention de l'accès avancé aux permissions `whatsapp_business_messaging` et `whatsapp_business_management`, implémentation d'Embedded Signup (v4 obligatoire, la v2 est retirée le 15 octobre 2026), puis chaque client ajoute sa propre carte bancaire. Pas de frais Meta, pas de ligne de crédit (réservée aux Solution Partners). Depuis le 30 septembre 2025, le modèle « On Behalf Of » n'accepte plus de nouveaux WABA : c'est la création de WABA initiée par le partenaire qui le remplace.

Source : https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers
Source : https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview/

Le second modèle n'a de sens que pour les clients qui veulent eux-mêmes parler à leur public par WhatsApp (église, marque de beauté) : il devient alors un produit à part (diffusion aux fidèles ou aux clientes), différent de l'interface de validation.

### 5.3 Un numéro ivoirien et un numéro canadien dans le même compte

Oui. Un WABA peut héberger plusieurs numéros de pays différents ; un nouveau portefeuille est limité à 2 numéros enregistrés, porté à 20 après vérification de l'entreprise ou atteinte du palier de 2 000. Chaque numéro doit pouvoir recevoir un SMS ou un appel de vérification à l'enregistrement, ne doit pas être actif sur WhatsApp grand public (il faut d'abord le supprimer de l'app, ou passer par la coexistence s'il est sur WhatsApp Business), et possède sa propre note de qualité ; la limite d'envoi (250 conversations initiées par jour avant vérification de l'entreprise, 1 000 après, puis 2 000, 10 000 et 100 000 selon la qualité) est partagée au niveau du portefeuille depuis octobre 2025. Intérêt pratique : les clientes ivoiriennes voient un +225, les clientes canadiennes un +1 ; le prix, lui, dépend du pays du **destinataire**, pas de l'expéditeur. La franchise de 1 000 messages de service est par numéro : deux numéros, deux franchises.

Source : https://blueticks.co/blog/whatsapp-business-multiple-numbers
Source : https://help.manychat.com/hc/en-us/articles/14281346817308-WhatsApp-Messaging-Limits-How-they-work-and-how-to-scale-effectively

### 5.4 Coexistence avec l'application WhatsApp Business

La mission évoque « janvier 2026 ». Les faits vérifiables : Meta a lancé la coexistence le 6 mai 2025 dans Embedded Signup (option « onboarding des utilisateurs de l'app WhatsApp Business »). Page Meta « Onboard WhatsApp Business app users » consultée le 2 octobre 2026 :

- réservée aux **Solution Partners et Tech Providers** (pas d'activation en libre-service) ;
- application WhatsApp Business **2.24.17 ou plus récente** ; synchronisation à terminer dans les 24 heures ;
- **débit fixe de 20 messages par seconde** combinés app et API ;
- après activation : messages éphémères, « vue unique » et position en direct désactivés ; listes de diffusion en lecture seule ;
- non pris en charge par l'API : groupes, appels, catalogue et commandes ;
- historique : jusqu'à 180 jours de conversations individuelles si la personne y consent, médias seulement pour les 14 derniers jours ; contacts synchronisés ; jusqu'à 4 appareils liés (hors Windows et WearOS) ;
- incompatible avec l'API Marketing Messages Lite.

Disponibilité par pays : la page Meta ne cite aucune exclusion, SleekFlow (27 août 2026) parle de « pays sélectionnés », d'autres BSP excluent l'Union européenne, le Royaume-Uni, le Nigeria et l'Afrique du Sud. À confirmer pour +225 et +1 à l'activation.

Source : https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/
Source : https://www.instantreply.co/blog/whatsapp-coexistence-what-actually-syncs-2026
Source : https://help.sleekflow.io/en_US/whatsapp/whatsapp-coexistence

Pour que José « garde son téléphone » : la coexistence lui permettrait de continuer à discuter à la main depuis l'app WhatsApp Business sur son numéro habituel pendant que la plateforme envoie les planches depuis le même numéro. Mais l'activation passe obligatoirement par un partenaire (360dialog à 49 EUR par mois, ou le statut Tech Provider de Markel-Tech) et impose les restrictions ci-dessus. L'alternative plus simple : un numéro dédié à la machine (SIM ivoirienne prépayée, ou numéro virtuel canadien) et José garde son numéro personnel intact ; les alertes de supervision lui arrivent sur son WhatsApp personnel depuis le numéro de la machine.

### 5.5 Facturation

L'accès direct se paie par carte bancaire dans Meta Billing Hub (ligne de crédit réservée aux gros volumes, plus de 10 000 USD par mois). La carte de Markel-Tech Inc. (Ontario) convient ; l'acceptation d'une carte émise en Côte d'Ivoire n'a pas pu être vérifiée dans la documentation. Depuis le 1er octobre 2026, sans moyen de paiement enregistré, les messages de service ne sont plus délivrés.

## 6. Conformité : politique WhatsApp du 23 septembre 2026 et LCAP (CASL)

### 6.1 Politique de messagerie WhatsApp Business

La version en vigueur de la WhatsApp Business Messaging Policy porte la date du **23 septembre 2026** (whatsappbusiness.com/policy). Points utiles :

- une entreprise ne peut contacter une personne que si (a) elle a obtenu son numéro ou son nom d'utilisateur et (b) elle a reçu son opt-in ;
- l'entreprise choisit la méthode d'opt-in et en porte la responsabilité légale ; l'opt-in doit nommer l'entreprise et indiquer clairement que la personne accepte de recevoir des messages WhatsApp de cette entreprise ; des opt-ins séparés sont recommandés par type de message (commandes, offres, recommandations) et un opt-in distinct est requis pour les appels ;
- hors fenêtre de 24 heures, seuls les modèles approuvés sont autorisés ;
- contenus interdits classiques (tromperie, usurpation, données de carte complètes, discrimination).

Source : https://whatsappbusiness.com/policy/
Source : https://blueticks.co/blog/whatsapp-opt-in-compliance-requirements

Bonne pratique de preuve : enregistrer pour chaque contact l'horodatage, la source (contrat, formulaire, QR), le texte exact affiché, le numéro et l'identifiant client, et honorer STOP et les blocages immédiatement.

### 6.2 LCAP (Canada)

La loi canadienne anti-pourriel couvre les courriels, les SMS, **les messages instantanés et les messages vers des comptes similaires sur les réseaux sociaux** (guide Gowling WLG). Une demande de consentement exprès doit indiquer l'objet des messages, le nom de l'entreprise, ses coordonnées (adresse postale plus téléphone, courriel ou site) et le droit de retirer son consentement ; la case ne peut pas être pré-cochée. Le consentement tacite vaut 2 ans après un achat ou un contrat, 6 mois après une demande de renseignements. Chaque message doit identifier l'expéditeur et offrir un mécanisme de désabonnement traité sous 10 jours ouvrables. Sanctions administratives récentes de 40 000 à 1,1 million CAD ; le droit d'action privé est suspendu depuis 2017. Les messages purement transactionnels liés à un contrat en cours (« votre planche est prête ») ne sont pas des messages commerciaux au sens de la loi, mais la même conversation servira tôt ou tard à proposer une option ou un service, d'où l'intérêt d'un consentement exprès dès la signature.

Source : https://gowlingwlg.com/en/insights-resources/guides/2023/doing-business-in-canada-casl
Source : https://ised-isde.canada.ca/site/canada-anti-spam-legislation/en

### 6.3 Formulation d'opt-in minimale à signer au contrat

> « J'accepte de recevoir de l'Agence Markel-Tech Inc. (adresse, téléphone, courriel, site), sur WhatsApp au numéro +… que j'indique, les messages liés à la gestion de mes réseaux sociaux : planches de propositions à valider, rappels, comptes rendus de publication et de mesure, ainsi que des propositions de services complémentaires, à raison d'environ … messages par mois. Je peux retirer ce consentement à tout moment en répondant STOP ou en écrivant à … ; le retrait est appliqué sous 10 jours ouvrables. »

Deux cases distinctes (jamais pré-cochées) : « messages de service liés à mon contrat » et « propositions commerciales ». La seconde seule peut être refusée sans empêcher la machine de fonctionner. En Côte d'Ivoire, la loi 2013-450 sur la protection des données personnelles (ARTCI) impose le même esprit de consentement préalable ; cette formulation la couvre sans adaptation.

## 7. Côté gestionnaire humain : notifications et supervision depuis le téléphone

### 7.1 Trois canaux, un rôle chacun

| Canal | Portée | Contraintes | Rôle dans la machine |
|---|---|---|---|
| **WhatsApp** (numéro de la machine vers le WhatsApp personnel de José) | fiable, instantané, sonore, fonctionne hors PWA | 1 000 messages de service gratuits par numéro et par mois ; hors fenêtre il faut un modèle utilitaire à 0,0034 ou 0,0040 USD ; José doit avoir donné son opt-in (il est lui-même destinataire) | alerte courte avec 3 boutons (« Voir », « Approuver », « Reporter ») |
| **Web Push de la PWA** | gratuit, illimité, lien profond vers l'écran exact | iOS et iPadOS 16.4 et plus (sortie le 27 mars 2023) : l'app doit être **ajoutée à l'écran d'accueil** (manifest `display: standalone`), permission demandée sur un geste de l'utilisateur, service worker, VAPID, serveurs `*.push.apple.com` à autoriser ; Safari 18.4 ajoute le Web Push déclaratif sans service worker ; Android Chrome sans restriction ; dans l'Union européenne les PWA iOS sont bridées depuis iOS 17.4 | fil d'activité détaillé, badge de compteur sur l'icône (Badging API) |
| **Courriel (Resend)** | déjà en place, archivable | pas d'instantanéité garantie | récapitulatif quotidien et pièces jointes |

Source : https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
Source : https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide

CallMeBot, utilisé aujourd'hui, est remplacé par le numéro de la machine : José écrit une fois « ok » au numéro, ce qui ouvre une fenêtre de 24 heures ; la plateforme peut le relancer dans la fenêtre à coût nul (franchise), et au-delà par un modèle utilitaire à 0,0034 USD.

### 7.2 Lire une planche sur 390 px

Règles de mise en page pour l'écran de validation de la PWA (largeur de référence 390 px, iPhone 14 et 15, 360 px sur les Android courants d'Abidjan) :

- `viewport-fit=cover` et `env(safe-area-inset-*)` pour l'encoche et la barre d'accueil ; hauteur en `100dvh` ; `interactive-widget=resizes-content` pour que la zone de commentaire reste visible au-dessus du clavier ;
- une proposition par carte, en pile verticale : vignette 358 px de large (390 moins 2 x 16 px de marge), ratio 4:5 ou 1:1 pour les visuels Instagram, 9:16 réduit pour les Reels et TikTok avec lecture au tap ; sous la vignette, l'accroche en 16 px, le texte de publication replié (« Lire la suite »), la plateforme et la date prévue ;
- barre d'actions collante en bas, hauteur 56 px, deux cibles de 44 px minimum : « Je valide » (plein) et « À revoir » (contour) ; une pression sur « À revoir » ouvre une feuille avec 4 motifs à cocher (texte, visuel, date, autre) et un champ vocal ou texte ;
- aucune connexion : le lien envoyé par WhatsApp porte un jeton signé à usage limité (valable 7 jours, lié au numéro) ; la validation côté PWA et la validation côté WhatsApp écrivent dans la même table.

## 8. Diagramme complet : planche vers validation vers production

```
[Plateforme Railway : Node/Express, Postgres, bucket S3]
        |
        | 1. Génération de la planche (6 à 10 propositions : maquette PNG < 300 Ko,
        |    texte, plateforme, date) + image composite 1080x1350 (< 5 Mo)
        v
[Téléversement média Cloud API]  POST /{phone_number_id}/media  -> media_id (30 jours)
        |
        | 2. Envoi du MODÈLE UTILITAIRE « planche_prete_v1 »
        |    en-tête image (composite) + corps personnalisé + boutons
        |    [Je valide tout] [À revoir] [Voir la planche -> URL PWA + jeton]
        |    coût : 0,0040 USD (CI) / 0,0034 USD (CA) / 0,0300 USD (FR)
        v
[Cliente, WhatsApp personnel]
        |                                   \
        | 3a. tap « Je valide tout »          \ 3b. tap « Voir la planche » -> PWA 390 px
        |     webhook button -> fenêtre 24 h    \   (jeton signé, zéro compte)
        |                                        \
        | 3c. tap « À revoir » -> fenêtre 24 h
        v
[Dans la fenêtre : messages de service, 1 000 gratuits / numéro / mois]
        |
        | 4. Flow « validation_planche » (interactive type=flow, flow_token = id planche)
        |    écran 1 : CheckboxGroup « propositions validées » (10 options)
        |    écran 2 : CheckboxGroup « à revoir » + TextArea « pourquoi »
        |    ou : une image + RadioButtonsGroup par écran (jusqu'à 100 écrans)
        |    ou : vocal de la cliente -> GET media (URL 5 min) -> transcription
        |         (0,003 à 0,006 USD / min) -> citation renvoyée + bouton « C'est bien ça »
        v
[Webhook nfm_reply / button_reply / audio] -> table validations (planche, proposition, verdict, motif, horodatage)
        |
        | 5. Rappel J+2 si silence : modèle utilitaire « rappel_planche_v1 » (0,0040 USD)
        |    Rappel J+5 : second rappel, puis alerte au gestionnaire
        v
[Gestionnaire humain : José]
        |  alertes WhatsApp depuis le numéro machine (service dans la fenêtre, sinon
        |  modèle utilitaire 0,0034 USD) + Web Push PWA + courriel récapitulatif
        |  [Voir] [Lancer la production] [Reporter]
        v
[Production : textes, images gpt-image, vidéos Higgsfield par Claude-in-Chrome, Canva MCP]
        |
        | 6. Modèle utilitaire « production_terminee_v1 » à la cliente avec aperçu final
        |    (optionnel, 0,0040 USD) ; publication ; mesure
        v
[Alerte « publié » + rapport mensuel]  -> boucle veille / idéation du mois suivant
```

### 8.1 Coût mensuel WhatsApp par client (hypothèse de la mission : 4 planches, 2 rappels, 10 alertes)

Hypothèses de calcul : les 4 planches et les 2 rappels partent **hors fenêtre** en modèle utilitaire ; les 10 alertes sont adressées au gestionnaire humain (José, numéro canadien, Amérique du Nord), la moitié hors fenêtre en modèle utilitaire, l'autre moitié dans la fenêtre en message de service couvert par la franchise ; les échanges de la cliente dans la fenêtre (Flow, boutons, vocaux, environ 20 messages par planche) sont des messages de service, couverts par la franchise de 1 000 par numéro tant que la machine sert moins d'une dizaine de clients actifs par numéro.

| Poste | Côte d'Ivoire (cliente à Abidjan) | Canada (cliente à Toronto) | France (cliente à Paris) |
|---|---|---|---|
| 4 planches, modèle utilitaire | 4 x 0,0040 = 0,016 USD | 4 x 0,0034 = 0,014 USD | 4 x 0,0300 = 0,120 USD |
| 2 rappels, modèle utilitaire | 0,008 USD | 0,007 USD | 0,060 USD |
| 10 alertes au gestionnaire (5 modèles utilitaires NA + 5 service dans la franchise) | 5 x 0,0034 = 0,017 USD | 0,017 USD | 0,017 USD |
| Échanges dans la fenêtre (environ 80 messages de service) | 0 (franchise) ; 0,32 USD si franchise épuisée | 0 ; 0,27 USD si épuisée | 0 ; 2,40 USD si épuisée |
| Transcription de 10 vocaux d'une minute | 0,03 à 0,06 USD | idem | idem |
| **Total Meta + transcription** | **0,07 à 0,10 USD** (environ 40 à 60 FCFA) | **0,07 à 0,10 USD** | **0,23 à 0,26 USD** |
| Variante : planches en carrousel marketing | + 4 x (0,0225 - 0,0040) = + 0,074 USD | + 0,086 USD | + 0,224 USD |
| Variante : reclassement marketing de tous les modèles | total 0,15 USD | 0,16 USD | 0,53 USD |
| Coût fixe fournisseur, à répartir sur tous les clients | 0 (direct) ; 49 EUR par numéro (360dialog) ; environ 0,50 USD par client (Twilio, 100 messages x 0,005) ; 29 USD par mois plus 20 % (Wati) |

Lecture : le coût Meta par client reste sous 1 USD par mois dans tous les scénarios ; la seule dépense significative serait un BSP à abonnement.

## 9. Incertitudes et points à vérifier

1. **CSV officiel des tarifs** : non téléchargeable par le robot (page Pricing rendue en JavaScript). Les valeurs 0,0225 / 0,0040 (Reste de l'Afrique), 0,0250 / 0,0034 (Amérique du Nord) et 0,0859 / 0,0300 (France) sont confirmées par quatre reprises concordantes datées de 2026 ; ouvrir le CSV « effective October 1, 2026 » à la main pour clore la divergence 0,0259.
2. **Franchise de 1 000 messages de service** : annoncée par 360dialog, Wati, Respond.io, Tech-ish et Engagelab pour le 1er octobre 2026 ; la page Meta résumée par notre outil ne l'a pas affichée. Vérifier dans WhatsApp Manager > Facturation après le premier mois.
3. **En-tête média sur le message interactif de type `flow`** : les guides officiels consultés citent un en-tête texte ; la prise en charge d'une image en en-tête d'un message Flow interactif n'a pas été confirmée. Le modèle avec bouton FLOW accepte, lui, un en-tête image.
4. **Revue Meta des Flows** : validation automatique à la publication selon AWS, revue de 24 à 48 heures selon certains BSP. À tester avec un premier Flow en brouillon.
5. **Coexistence** : la date « janvier 2026 » de la mission n'a pas été retrouvée (lancement documenté le 6 mai 2025, v4 d'Embedded Signup en aperçu public le 12 mai 2026) ; la liste des pays disponibles diverge selon les sources. Vérifier pour +225 et +1 au moment de l'activation, via un partenaire.
6. **Carte bancaire ivoirienne** dans Meta Billing Hub : non documenté. Utiliser la carte canadienne de Markel-Tech.
7. **Marge Infobip (39 %)** et **marge Wati (20 %)** : chiffres de comparatifs concurrents, non publiés par les intéressés.
8. **Prix Wati** : la page officielle affiche 29 / 99 / 249 USD (annuel) le 2 octobre 2026, l'instantané Chatarmin de mai 2026 donnait 59 / 119 / 279 USD. Promotion ou changement de grille, à confirmer avant comparaison.
9. **Twilio** : la page de prix lue par le robot indiquait « pas de frais Meta sur les modèles marketing », ce qui contredit toutes les autres sources ; il s'agit très probablement d'une erreur d'extraction, Twilio refacturant les tarifs Meta à l'identique.
10. **Limite de 20 caractères des boutons** : la documentation Meta dit 20, plusieurs BSP écrivent 25 ; rester à 20. Un numéro canadien virtuel (Twilio, Telnyx) fonctionne s'il reçoit les SMS ou appels de vérification, certains numéros VoIP étant refusés par Meta.

## 10. Implications pour la machine de José

1. **Accès direct Cloud API sous le portefeuille Markel-Tech, sans BSP.** Coût fixe nul, grille Meta sans marge, webhooks déjà maîtrisés (Graph API Facebook). Les BSP n'apportent rien que la plateforme ne fasse déjà, sauf la coexistence.
2. **Deux numéros dédiés dans le même WABA** : une SIM ivoirienne prépayée (+225) et un numéro canadien (+1), tous deux réservés à la machine. José garde son téléphone et son numéro personnel intacts ; il reçoit les alertes depuis le numéro machine.
3. **Faire vérifier l'entreprise dès le départ** (Markel-Tech Inc., documents ontariens) : passe la limite de 2 à 20 numéros, de 250 à 1 000 conversations par jour, et débloque le nom affiché.
4. **Un modèle utilitaire par événement**, rédigé sans vocabulaire promotionnel, avec variables au milieu du texte : `planche_prete`, `rappel_planche`, `production_terminee`, `publication_faite`, `rapport_mensuel`, plus `alerte_gestionnaire`. Soumettre les six en une fois, les approbations utilitaires tombent en minutes.
5. **Écouter le webhook `message_template_category_update`** et bloquer l'envoi d'un modèle reclassé marketing jusqu'à révision, avec une alerte à José : c'est la seule façon de garder le coût à 0,004 USD et la note de qualité intacte.
6. **Validation en un tap d'abord, Flow ensuite.** Le modèle `planche_prete` porte l'image composite et trois boutons ; le tap ouvre la fenêtre ; la plateforme envoie alors le Flow générique à deux écrans (validées / à revoir plus motif). Les carrousels marketing restent une option pour les clientes qui préfèrent voir chaque visuel en grand dans WhatsApp, à 0,0225 USD l'envoi.
7. **Un seul Flow générique publié une fois**, alimenté par `flow_token` (identifiant de planche) et, dans un second temps, par un endpoint `data_exchange` chiffré sur Railway (RSA-2048 et AES-128-GCM, réponse sous 3 secondes). Commencer en mode `navigate` sans endpoint : moins de code, aucune clé à gérer.
8. **Images de maquette à deux résolutions** : composite 1080 x 1350 (sous 5 Mo) pour l'en-tête de modèle, vignettes individuelles sous 300 Ko pour les Flows et la PWA. Les téléverser sur Meta (identifiant valable 30 jours) à la génération de la planche, pas à l'envoi.
9. **Les vocaux de la cliente sont une fonctionnalité, pas un problème.** Télécharger dans les 5 minutes, archiver sur le bucket S3 (le média Meta disparaît au bout de 7 jours), transcrire avec `gpt-4o-mini-transcribe` (0,003 USD la minute) ou Deepgram Nova-3, renvoyer la citation avec un bouton de confirmation, puis laisser Claude transformer la remarque en instruction de retouche.
10. **Rappels bornés** : deux rappels maximum (J+2, J+5), puis bascule vers le gestionnaire humain. Au-delà, les relances dégradent la note de qualité et tombent sous le coup de la politique « fréquence » du 23 septembre 2026.
11. **Franchise de service par numéro** : surveiller le compteur mensuel des messages de service par numéro ; au-delà de 1 000, chaque message dans la fenêtre coûte 0,004 USD, ce qui reste négligeable mais doit apparaître dans le tableau de bord de coûts par client.
12. **Opt-in au contrat, en deux cases**, avec la formulation de la section 6.3, journal de preuve (horodatage, source, texte, numéro) en base, traitement automatique de STOP et des blocages, et un modèle `confirmation_optin` envoyé à la signature (utilitaire, 0,004 USD), qui sert à la fois de preuve et de premier contact.
13. **Supervision : WhatsApp pour l'alerte, PWA pour l'écran.** Ajouter le manifest `standalone`, le service worker, VAPID et la demande de permission sur un bouton « Activer les notifications » ; sur iPhone, afficher le tutoriel « Partager puis Sur l'écran d'accueil ». Les alertes WhatsApp vers José restent dans la franchise tant qu'il répond de temps en temps au numéro machine.
14. **Écran de validation 390 px** : une carte par proposition, barre d'actions collante à 44 px, feuille « À revoir » avec motifs cochables et vocal, jeton signé sans compte. Même table de validations que le Flow WhatsApp, pour que la cliente puisse commencer sur WhatsApp et finir sur la PWA.
15. **Ne pas activer la coexistence pour l'instant.** Elle exige un partenaire, plafonne à 20 messages par seconde et désactive des fonctions ; elle ne devient utile que si un client veut parler à son public depuis son propre numéro WhatsApp Business. Ce jour-là, étudier le statut Tech Provider (vérification, revue d'app avec deux vidéos, Embedded Signup v4) comme produit distinct.
16. **Budget WhatsApp dans le prix de vente** : provisionner 1 USD par client et par mois pour Meta et la transcription ; tenir en base une table `tarifs_whatsapp` (date d'effet, marché, catégorie, prix) mise à jour à chaque grille Meta, et valider toute la chaîne avec une cliente pilote d'Abidjan sur la SIM +225 avant d'ouvrir le Canada.

## Sources consultées (liste)

- https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages
- https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-list-messages
- https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media
- https://developers.facebook.com/docs/whatsapp/pricing
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages
- https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization
- https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/marketing-templates/media-card-carousel-templates
- https://developers.facebook.com/documentation/business-messaging/whatsapp/flows
- https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/guides/sendingaflow
- https://developers.facebook.com/documentation/business-messaging/whatsapp/flows/reference/components
- https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/audio-messages
- https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/changelog
- https://whatsappbusiness.com/policy/
- https://www.twilio.com/en-us/whatsapp/pricing
- https://www.twilio.com/docs/content/whatsapp-flows
- https://www.twilio.com/docs/whatsapp/tutorial/message-template-approvals-statuses
- https://360dialog.com/pricing
- https://360dialog.com/blog/whatsapp-service-message-charging-october-2026/
- https://www.wati.io/pricing/
- https://www.wati.io/en/blog/whatsapp-service-message-pricing/
- https://chatarmin.com/en/blog/wati-pricing
- https://www.getmacha.com/blog/best-infobip-alternatives
- https://www.flowcall.co/blog/whatsapp-business-api-pricing
- https://whautomate.com/whatsapp-business-api-pricing
- https://www.engagelab.com/blog/whatsapp-business-api-pricing
- https://getkanal.com/blog/whatsapp-business-pricing-guide
- https://www.salesforce.com/en-us/wp-content/uploads/sites/4/assets/pdf/whatsapp-business-messaging-rate-card-mm-lite-march-1-2026.pdf
- https://tech-ish.com/2026/10/01/whatsapp-business-platform-charges-start-today-but-the-first-1000-replies-are-free/
- https://www.instantreply.co/blog/whatsapp-coexistence-what-actually-syncs-2026
- https://help.sleekflow.io/en_US/whatsapp/whatsapp-coexistence
- https://blueticks.co/blog/whatsapp-opt-in-compliance-requirements
- https://blueticks.co/blog/whatsapp-business-multiple-numbers
- https://help.manychat.com/hc/en-us/articles/14281346817308-WhatsApp-Messaging-Limits-How-they-work-and-how-to-scale-effectively
- https://m.aisensy.com/blog/whatsapp-message-limits-guide/
- https://chati.ai/blog/whatsapp-business-api-template-approval-time-in-2026-bottlenecks-rejections-how-to-get-approved-faster
- https://developers.cm.com/messaging/docs/whatsapp-interactive-messages
- https://developer.8x8.com/connect/docs/whatsapp/whatsapp-flows-components/
- https://developer.8x8.com/connect/docs/whatsapp/whatsapp-flows-best-practices/
- https://developer.8x8.com/connect/docs/whatsapp/template-components-reference/
- https://pywa.readthedocs.io/en/latest/content/flows/flow_json.html
- https://www.heltar.com/blogs/how-to-fix-maxscreensnumber-error-in-whatsapp-flows-2025-limit-hit-cmbz8mr660003m7n4xmvjbbvb
- https://docs.aws.amazon.com/social-messaging/latest/userguide/managing-flows-publish.html
- https://github.com/guilhermejansen/whatsapp-flows-server
- https://developers.openai.com/api/docs/pricing
- https://deepgram.com/pricing
- https://gowlingwlg.com/en/insights-resources/guides/2023/doing-business-in-canada-casl
- https://ised-isde.canada.ca/site/canada-anti-spam-legislation/en
- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide
