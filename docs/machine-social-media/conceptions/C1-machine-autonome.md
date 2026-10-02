# C1. La machine autonome : conception complète de la plateforme social media multi-clients de José Kouadio

Conception rédigée le 2 octobre 2026 à partir des dix-sept rapports de recherche R01 à R26 (138 000 mots, 1er et 2 octobre 2026). Angle retenu : la routine qui tourne seule et ne laisse jamais un client sans contenu à la page. En cas de contradiction entre rapports, R26 prévaut, conformément à la consigne. Les prix sont en dollars américains sauf mention contraire, datés de la page lue par le rapport cité.

---

## 1. Thèse en une page

### 1.1 La phrase de positionnement

« La seule machine qui regarde chaque jour ce qui se passe chez vous et autour de vous, vous propose la semaine en images le mercredi, attend votre oui sur WhatsApp, produit de vraies vidéos en français, les fait relire par un humain, publie, mesure, et apprend ; et qui, si vous ne répondez pas, continue de publier ce que vous avez déjà autorisé plutôt que de vous laisser disparaître. » (positionnement dérivé de R01 §8.19, enrichi par la règle de continuité de service de cette conception)

Le mot clé de cette conception est **continuité**. Les clients perdus l'ont été parce que le fil s'est rompu : tendance manquée, produit non mis en avant, sermon non découpé, semaine sans publication. R08 §3.1 chiffre les causes de départ (lenteur, tendances ignorées, vidéo non exploitée, absence de preuve de résultat). La machine est donc conçue comme un système à états avec des horloges, des délais par défaut et des replis, de sorte qu'aucun état d'attente ne dure indéfiniment et qu'aucune panne ne bloque un client plus de 24 heures sans alerte humaine.

### 1.2 Les cinq choix qui la rendent supérieure au marché

1. **Une machine à états par client, avec des horloges et des délais par défaut.** Le marché valide des posts (Planable, Gain, R08 §1.3) ; la machine pilote un cycle hebdomadaire complet dont chaque étape a une échéance, un rappel, une escalade et un repli. La validation client est un état en base, pas un agent qui attend (R07 §5) : zéro jeton pendant l'attente, reprise garantie après redéploiement.

2. **La règle du « jamais sans contenu ».** Chaque client signe un cadre éditorial trimestriel qui autorise la machine à publier, en l'absence de réponse, les seuls contenus « valeur » déjà validés dans ce cadre, à cadence réduite, depuis une réserve de sécurité de six contenus intemporels toujours pleine (idée de R01 §8.9, rendue systématique). Aucun outil du marché n'a cette garantie de service.

3. **Trois rythmes de veille et un chronomètre « tendance vers publication ».** Tendances (cycle de 2 heures, durée de vie 48 heures), sons (hebdomadaire, 3 semaines), événements et calendrier (hebdomadaire, horizon 6 semaines, revérification 48 heures avant) (R06 §13.5 et §16.14). Le délai médian entre détection et publication est calculé chaque mois depuis la base (R24 §5) et affiché au client : c'est la réponse chiffrée au reproche « pas à la page ».

4. **Production en deux modes et moteurs abstraits.** Brouillon à moins d'un cent pour la planche (gpt-image-2.5-flare en qualité low, R03 §12.5 et R26 §5.6), production en haute qualité seulement après validation, vidéo générative par l'API officielle Higgsfield (Kling 3.0 à 0,084 $ par seconde, Seedance 2.5 à 0,2057 $ par seconde, R26 tableau 4e) ou par les API directes, jamais par le pilotage navigateur de l'Unlimited (R26 §5.10). Chaque moteur vit derrière une interface avec un repli automatique (R01 §8.16, R04 §8.2).

5. **La boucle fermée par la mesure et l'apprentissage.** Relevés quotidiens stockés chez soi en ajout seul (R24 §3.6), couche affaires en tête du rapport (R24 §10.1), bandit par verticale sur les hooks (R11 §15.9), corrections du gestionnaire réinjectées chaque mois dans le prompt (R11 §15.10), sources de veille coupées après 90 jours sans item accepté (R06 §16.19).

### 1.3 Prix de vente visé et coût par client

Trois paliers par client et par mois, tout compris, avec un nombre explicite de vidéos et de visuels (R08 §10.4), déclinés par marché (R10 §8.12) :

| Palier | Abidjan (FCFA) | Canada (CAD) | France (EUR) | Contenu |
|---|---|---|---|---|
| Présence | 250 000 | 900 | 700 | 3 publications par semaine, planche hebdomadaire WhatsApp, rapport mensuel, boîte de réception assistée |
| Croissance | 450 000 | 1 800 | 1 400 | 5 publications par semaine dont 2 vidéos, carrousels, stories, 1 boost proposé par mois |
| Vidéo+ | 750 000 | 3 000 | 2 400 | 7 publications par semaine dont 4 vidéos, découpage de sermons ou démonstrations produits, UGC, newsletter |
| Église (offre dédiée) | 180 000 | 400 | 300 | 4 à 5 sermons, 20 à 25 clips, citations, dévotionnel, chapitrage, publication, rapport |

Coût direct mensuel par client type, détaillé en section 12 : église 45 à 70 $, B2B LinkedIn 40 à 65 $, beauté Croissance 95 à 160 $. Le poste à surveiller est la vidéo générative (R25 §11.18), plafonnée par client dans la base (R25 §7.2).

---

## 2. Les personnes

### 2.1 José (fondateur, architecte, atelier manuel)

Ce qu'il voit chaque semaine : le tableau de bord multi-clients (section 6) avec une ligne par client et une pastille d'état (vert : cycle nominal ; orange : client silencieux ou porte en retard ; rouge : panne, plafond atteint, jeton à reconnecter). Il reçoit sur le numéro WhatsApp de la machine les alertes de niveau « incident » seulement (R22 §10.13).

Ce qu'il fait : il tient le cerveau de marque des nouveaux clients (30 minutes à l'intake, R08 §10.17), il arbitre les escalades que le gestionnaire ne peut pas trancher (doctrine, allégation, client mécontent), il lance une Routine Claude Code « revue hebdomadaire » que la plateforme tire le lundi matin (R07 §11.12), et il garde Higgsfield Unlimited comme atelier manuel pour les clips musicaux SEVARTA, hors du chemin critique (R04 §8.1, R26 §5.10). Il n'intervient dans aucun cycle client en fonctionnement nominal.

### 2.2 Le gestionnaire humain (porte 1 et porte 3)

Ce qu'il voit : la file « à relire » (planches avant envoi, rendus avant publication), la file « réponses à valider » (commentaires critiques et sensibles), la file « TikTok à traiter dans l'app » (R23 §8.9), les alertes WhatsApp de la machine et la PWA installée sur son téléphone avec Web Push (R22 §10.13).

Ce qu'il fait, par semaine et par client : 5 minutes de relecture de la planche le mercredi matin, 10 à 20 minutes de contrôle des rendus le lundi (lecture, droits, orthographe, R01 §8.9), 10 minutes par jour de réponses aux commentaires classés « critique » ou « sensible » (R23 §4.1), et une action en un clic par événement : approuver, corriger dans Canva ou dans l'éditeur de légende, renvoyer en révision avec motif, publier en repli manuel. Chaque correction qu'il fait est enregistrée comme paire (brouillon, correction, motif) pour l'apprentissage (R11 §15.10). Charge cible : 4 à 8 heures par client et par mois selon le palier.

### 2.3 Le client, par verticale

Le client ne crée pas de compte. Il reçoit, sur WhatsApp, un modèle utilitaire « votre planche est prête » avec l'image composite et trois boutons (R22 §0.1), et, s'il tape, un Flow natif pour valider ou commenter chaque proposition ; il peut aussi finir sur la page mobile sans compte (lien signé) (R22 §10.14). Il dépose ses matières premières par WhatsApp (photos de produits, flyers, audio de sermon) ou par un formulaire à lien magique pour les lots et les vidéos (R21 §9.11).

| Verticale | Ce que le client voit | Ce qu'il fait |
|---|---|---|
| Marque de beauté | planche du mercredi, accusé de réception de chaque produit déposé, rapport mensuel avec commandes attribuées par coupon | dépose 2 photos par produit (face et INCI, R21 §9.4), valide la planche, confirme les allégations et les prix |
| Association culturelle | séquence J-21 à J+2 par événement, carrousel agenda régional | dépose le flyer, confirme dates et lieu (accusé conversationnel, R21 §9.10), fournit les photos de l'événement |
| Église (pasteur ou responsable) | planche de 8 vignettes par sermon le lundi midi, dévotionnel quotidien | valide doctrinalement chaque extrait (R09 §5.8), répond aux demandes de prière (jamais l'agence, R23 §8.5) |
| Maison d'édition (SEVARTA) | séquence de six semaines par titre, visuels d'avis | dépose le manuscrit et les métadonnées, valide les résumés, enregistre une lecture d'extrait |
| École (2IAE) | comptes à rebours d'admission, récaps d'événements sous 48 heures | fournit les plans tournés et le registre des autorisations d'image (R09 §11.9) |
| Agence B2B (Markel-Tech) | documents natifs LinkedIn, avant-après de projets | accord des clients pour les études de cas, posts personnels du fondateur |

---

## 3. La routine : le cycle complet comme machine à états

### 3.1 Les unités de travail et leurs états

La machine manipule cinq objets à états, tous en Postgres, tous avec `tenant_id`, chacun avançant par des jobs pg-boss idempotents (clé `client:type:date:hash`, R07 §8.3). Aucune transition n'est faite par un agent qui attend ; chaque transition est un job qui lit l'état, agit, écrit l'état suivant et enfile le job suivant.

**Signal (item de veille)** : `detecte` → `dedoublonne` (exact puis sémantique, R06 §13.3) → `score` → `retenu` ou `rejete` → `genese_en_cours` → `verifie` ou `a_verifier_humain` (champ sous 0,8 de confiance, R06 §13.4) → `propose` (entré dans une planche) → `publie` ou `expire` (durée de vie dépassée). Chaque signal porte `detected_at`, qui est le point de départ du chronomètre « tendance vers publication » (R24 §5).

**Cycle hebdomadaire (semaine éditoriale d'un client)** : `planifie` → `ideation` → `brouillons` → `juge` → `porte_1` (gestionnaire) → `planche_envoyee` (porte 2, client) → `rappel_1` → `rappel_2` → `escalade` → `validee` (totale ou partielle) ou `validee_par_cadre` (défaut) → `production` → `controle_qualite` → `porte_3` (gestionnaire) → `programmee` → `publiee` → `mesuree` → `apprise`. Un cycle ne peut jamais rester plus de 7 jours dans un même état sans qu'une alerte parte au gestionnaire.

**Proposition (élément de planche)** : `brouillon` → `en_planche` → `validee`, `a_revoir`, `refusee` ou `expiree` → `en_production` → `rendue` → `qc_ok` ou `qc_ko` (deux révisions maximum avant escalade, R07 §6.1) → `approuvee` → `programmee` → `publiee`, `echec_publication`, `reportee_quota` ou `repli_manuel` → `mesuree`. La production d'une proposition démarre dès que cette proposition est validée, sans attendre le reste de la planche.

**Job de génération (image, vidéo, voix, transcription)** : `reserve` (coût estimé réservé dans `cost_ledger`, R25 §7.2) → `soumis` (identifiant externe stocké avant tout appel) → `en_attente` (webhook ou polling) → `recupere` (copié dans le bucket sous 7 jours pour Higgsfield, 2 jours pour Veo, R04 §8.15) → `juge_vision` → `accepte` ou `rejete_moteur` (repli vers le moteur suivant) → `plafond_atteint` (mise en attente et alerte).

**Publication** : `programmee` → `conteneur_cree` (identifiant Meta ou publish_id TikTok stocké) → `envoyee` → `en_attente_plateforme` → `publiee` → `echouee` → `reportee_quota` → `repli_manuel` (paquet prêt à publier, R02 §12.15) → `mesuree`.

### 3.2 Les horloges

Toutes les horloges sont déclarées dans pg-boss (cron et différés, R07 §8.1), sauf le « tick » qui tourne en Railway cron toutes les 5 minutes et sort en moins d'une minute (R07 §11.6). Les heures sont celles du fuseau du client (`tenant.timezone`, R25 §9.13), jamais celles du serveur.

| Horloge | Fréquence | Ce qu'elle fait |
|---|---|---|
| H0 tick | toutes les 5 minutes | échéances dépassées, rappels, escalades, quotas de publication, reprise des jobs orphelins, tirs de Routines |
| H1 tendances | toutes les 2 heures | Trending Now RSS (CI, CA, FR), Google News RSS, GDELT (R06 §16.1) ; durée de vie d'un signal tendance : 48 heures |
| H2 flux client | toutes les heures, et en temps réel par webhook | flux Atom YouTube, PubSubHubbub des chaînes d'église (R06 §16.7), webhook WhatsApp (dépôts), crawl quotidien du site client (sitemap, flux WordPress ou Shopify, R06 §9) |
| H3 sons | hebdomadaire, lundi 06:00 | run Apify Creative Center partagé pour les 3 pays (R06 §16.4), saisie manuelle de 10 sons Reels par le gestionnaire (R06 §4.2) ; durée de vie 3 semaines |
| H4 calendrier | hebdomadaire, horizon 6 semaines | fêtes fixes, lunaires (fenêtre de deux jours, confirmation la veille), événements vivants (R10 §8.9) ; revérification de chaque événement 48 heures avant publication (R06 §13.4) |
| H5 cycle éditorial | hebdomadaire, par client, jeudi 06:00 pour la semaine S+1 | idéation, brouillons, juge, porte 1, envoi mercredi 10:00, rappels, défaut, production, porte 3, programmation |
| H6 mesure | quotidienne 05:00 GMT, plus relevés par média | comptes la veille ; médias J+1, J+3, J+7, J+30, J+90 ; Stories H+6, H+12, H+23 (R24 §3.6) |
| H7 rapport mensuel | premier lundi après le 3 du mois, avant 9 h heure client (R24 §10.8) | rapport PDF d'une page et résumé WhatsApp de cinq lignes |
| H8 itération | tous les 90 jours | revue avant/après, recalcul des médianes locales, révision du cadre éditorial (R08 §10.18, R24 §6.2) |
| H9 santé | quotidienne, hebdomadaire, trimestrielle | jetons Meta et LinkedIn rafraîchis à J-5, alerte à J-10 (R02 §12.9) ; réabonnement PubSubHubbub tous les 3 jours (R21 §9.13) ; test hebdomadaire par fournisseur de génération et par plateforme de publication (R04 §8.2, R24 §10.20) ; diff trimestriel des pages de prix et de politique citées (R26 §5.19) |

### 3.3 Le cycle hebdomadaire, pas à pas, avec ses délais par défaut

Exemple pour un client dont le fuseau est Abidjan (GMT). La semaine S est planifiée pendant la semaine S-1.

1. **Jeudi 06:00, idéation.** Le job `ideation` lit le cerveau de marque (en cache, R07 §4), les signaux `verifie` non expirés, le calendrier à 6 semaines, les assets déposés depuis le dernier cycle, les performances des 30 derniers contenus et la réserve de sécurité. Il produit 6 à 10 propositions sous forme de séquences (lancement produit en 5 étapes, événement en 5 étapes, sermon en clips, R09 §11.15), chacune avec pilier, framework, plateforme, date et heure, en respectant 60/25/15 et la règle des deux plateformes. Si la veille ne fournit pas 60 % d'items « valeur », le job refuse la semaine et complète avec la réserve (R06 §16.15). Coût : environ 0,32 $ sur Opus 5.5 pour un calendrier complet (R07 §7).

2. **Jeudi 06:30 à 09:00, brouillons et juge.** Textes sur Opus 5.5, visuels de référence en qualité low (moins de 0,10 $ pour 6 maquettes, R03 §12.5), captures « frame 0 » Remotion pour les vidéos programmées, prises uniques en LTX-2.3 à 0,06 $ par seconde pour les vidéos génératives en mode brouillon (R04 §8.3). Juge à sept critères sur Haiku 4.5, seuil 15/21, modèle différent du générateur (R11 §15.3, R07 §11.13). Contrôle vision de chaque maquette à 0,002 $ (R07 §6.2). Deux révisions maximum puis escalade.

3. **Jeudi 10:00, porte 1 (gestionnaire).** La planche entre dans la file « à relire ». Délai par défaut : 24 heures. Si le gestionnaire n'a pas agi vendredi 10:00, alerte à José ; si rien samedi 10:00, la planche part telle quelle au client (le juge a déjà filtré) et l'incident est journalisé. Le gestionnaire ne doit jamais être le point de blocage silencieux.

4. **Mercredi 10:00 (semaine S-1), porte 2 (client).** Envoi du modèle utilitaire `planche_prete` (image composite 1080 × 1350, trois boutons, 0,004 $ en Côte d'Ivoire, R22 §10.6 et §10.8) et du courriel Resend en copie. Chaque tap de validation produit une transition de proposition et déclenche immédiatement sa production.

5. **Rappels bornés.** Vendredi 10:00 (J+2) : modèle `rappel_planche`. Lundi 10:00 (J+5) : second et dernier rappel (R22 §10.10). Mardi 10:00 (J+6) : escalade au gestionnaire, qui appelle le client ou envoie un vocal.

6. **Mardi 18:00, défaut : validation par cadre.** Si le client reste silencieux, le cycle passe à `validee_par_cadre` : seules les propositions dont le pilier est « valeur » ou « relation », qui ne contiennent ni prix, ni promotion, ni allégation, ni visage sans consentement, et qui relèvent d'une catégorie autorisée par le cadre éditorial signé, sont produites et publiées, à la cadence réduite définie par le cadre (par défaut 3 par semaine au lieu de 5). Les propositions « promotion » et tout contenu lié à un nouveau produit restent en attente. Si le cadre ne suffit pas à remplir la cadence réduite, la réserve de sécurité (6 contenus intemporels validés, renouvelés chaque mois) complète. Un client silencieux deux semaines de suite passe en « risque de départ » (R08 §10.18).

7. **Production (dès validation, au plus tard mercredi de la semaine S).** Jobs de génération en mode production (3 prises, 1080p, R04 §8.3), composition déterministe HTML vers PNG pour tout texte éditorial (R03 §12.1), rendu ffmpeg et Remotion, sous-titres mot à mot, profil d'export « Afrique mobile » sous 10 Mo (R10 §8.6). Chaque rendu passe le contrôle qualité en trois couches (déterministe, vision, boucle de correction, R03 §12.10).

8. **Porte 3 (gestionnaire), délai 24 heures.** Lecture de chaque vidéo finale, vérification des droits et de l'orthographe, case « étiquette IA » calculée et vérifiée (R04 §8.7). Un rendu non relu à l'échéance n'est pas publié : il est reporté d'un jour et une alerte part. La porte 3 est la seule porte sans publication par défaut, parce que TikTok et YouTube exigent un consentement exprès par post (R02 §12.3).

9. **Programmation et publication.** File `publication` avec compteurs locaux par connexion : Instagram 50 lus comme plafond prudent tant que `content_publishing_limit` n'a pas prouvé 100 (R26 §5.3), Facebook Reels 30 par 24 heures, TikTok 6 requêtes par minute, YouTube 100 uploads par jour par projet lissés entre clients (R02 §12.7 et §12.8). Créneaux par fuseau (R10 §8.7), dimanche interdit par défaut sauf églises (R09 §11.5). Un échec est réessayé trois fois avec backoff, puis converti en paquet « prêt à publier » pour le gestionnaire.

10. **Mesure et apprentissage.** Relevés selon H6 ; à J+30, chaque contenu reçoit sa récompense (envois par portée plus enregistrements par portée, R11 §15.13) ; le bandit par verticale met à jour ses probabilités de hooks ; les corrections du gestionnaire et les décisions du client sont réinjectées le premier du mois.

### 3.4 La voie rapide : newsjacking

Une tendance a une durée de vie de 48 heures (R06 §13.5). Le cycle hebdomadaire est trop lent ; la machine a donc une voie rapide avec ses propres délais :

| Étape | Délai cible | Repli |
|---|---|---|
| Détection, dédoublonnage, scoring | moins de 15 minutes | aucun |
| Genèse et vérification à deux sources dont une primaire | moins de 45 minutes | si une seule source : état `a_verifier_humain` |
| Alerte gestionnaire avec angle et visuel brouillon statique | moins d'une heure | aucune vidéo en voie rapide |
| Validation client express (modèle `tendance_express`, deux boutons) | 4 heures par défaut | passé 4 heures : la proposition expire, sauf si le cadre autorise le « mode réactif » pour les tendances « valeur » sans produit ni prix |
| Publication | moins de 4 heures après validation | repli manuel |

Les sujets politiques et religieux controversés sont marqués « risque » et exclus de la voie rapide pour les églises, SEVARTA et 2IAE (R06 §16.16).

### 3.5 Reprise après panne

- **Jobs** : pg-boss avec tentatives et backoff exponentiel, dead letter visible dans le poste de pilotage, clés de singleton pour qu'un redéploiement ne relance pas deux fois la même idéation (R07 §11.5). Aucun job de plus de 30 minutes sans point de reprise (R07 §8.3).
- **Agents** : les sessions Agent SDK sauvegardent `session_id` dans le `SessionStore` Postgres et reprennent par `resume` (R07 §11.8) ; `maxBudgetUsd` par job (2 $ par sermon).
- **Batch** : `batch_id` et `custom_id` en base avant envoi ; résultats conservés 29 jours chez Anthropic (R07 §11.4).
- **Génération externe** : l'identifiant de requête est écrit avant l'appel ; au redémarrage, le worker relit l'état chez le fournisseur au lieu de resoumettre (webhooks Higgsfield et fal, R04 §1.1).
- **Publication** : l'identifiant de conteneur Meta est écrit avant `media_publish` ; au redémarrage, le worker lit le `status_code` du conteneur et ne republie jamais un conteneur `FINISHED` ou déjà publié. Les URL présignées de 48 heures sur la copie `pub/` couvrent une nouvelle tentative (R25 §4.2).
- **Redéploiement** : le worker de rendu et le worker d'agents sont des services séparés avec arrêt gracieux (fin du job courant, puis sortie) ; la base, elle, n'a pas de volume partagé avec un service applicatif. Leçon directe de l'incident du campus du 29 septembre 2026 (CLAUDE.md du dépôt, R25 §2.2).
- **Médias éphémères** : tout média WhatsApp reçu est téléchargé dans la minute (URL valable 5 minutes, R21 §9.9) ; toute sortie de génération est copiée dans le bucket avant l'expiration du fournisseur.
- **Détection des pannes silencieuses** : les deux pannes qui font « décrocher » un client sans bruit sont le jeton Instagram expiré et l'abonnement PubSubHubbub tombé (R21 §9.13) ; l'horloge H9 les surveille et l'état `a_reconnecter` est visible et alerté (R02 §12.9).

---

## 4. Les routines par verticale

Les six playbooks de R09 sont transposés ci-dessous en déclencheurs, formats automatiques et interventions humaines, avec les sources exactes de la veille.

### 4.1 Marque de produits de beauté (dépôt de produits)

- **Sources** : flux produits du site (Shopify `/products.json`, WordPress `/feed/`, R06 §9), dépôt WhatsApp (deux photos obligatoires, face et INCI, envoyées en document, R21 §9.4), commentaires et messages (R23), Creative Center TikTok et sons du pays (H3), calendrier commercial (fête des mères, Tabaski, rentrée).
- **Déclencheurs** : nouveau produit déposé ou détecté → extraction JSON par Sonnet 5.5 (0,015 $, R21 §9.1), INCI vérifié contre une base de noms (R21 §9.5), accusé de réception avec boutons (R21 §9.10), puis kit de lancement en 5 étapes (teaser J-3, unboxing J0, tutoriel J+3, carrousel teintes J+7, rappel WhatsApp J+10, R09 §3.8) proposé dans la planche sous 24 heures (R21 §9.18) ; réassort → story ; trois commentaires posant la même question → script de réponse vidéo ; fête à J-14 → planche.
- **Formats automatiques** : packshot réel détouré (Photoroom 0,02 $, R03 §12.6) mis en scène par gpt-image-2.5, carrousels composés en HTML, Reel I2V de 15 à 20 secondes en Kling 3.0 via l'API Higgsfield (R26 §5.11), motion design Remotion, messages WhatsApp Channel préparés pour un geste humain (R10 §8.1), coupon par contenu promotionnel (R24 §10.6).
- **Humain obligatoire** : tout visage (tutoriel, GRWM), chaque allégation (Santé Canada, règlement 655/2013, R08 §10.12), avant-après (18 ans et plus, aucune promesse chiffrée, R26 §5.15), réponse aux plaintes.
- **Règle dure** : aucun produit synthétisé ; le packshot est pixel-exact et vérifié par comparaison vision avec l'original (R03 §12.6).

### 4.2 Association culturelle (événements régionaux et genèse)

- **Sources** : agenda du site, pages Facebook publiques des lieux et festivals (Graph API déjà utilisée pour 2IAE, R10 §8.10 ; Page Public Content Access demandée à l'App Review, R06 §16.5), agendas municipaux via changedetection.io (R06 §16.11), Google Events via SerpApi (R06 §10), journées ONU, flyers déposés par WhatsApp (extraction Haiku 4.5 à 0,005 $, R21 §9.1).
- **Déclencheurs** : nouvel événement → séquence teaser J-21, genèse J-14, programme J-7, rappel J-1, récap J+2 (R09 §4.8) ; événement régional tiers → carrousel « à voir cette semaine » ; journée internationale liée au domaine → citation animée.
- **Genèse** : dossier automatique (origine, dates, lieu, organisateur, éditions passées) par Tavily et Perplexity Sonar (R06 §16.9), deux sources dont une primaire, « Source : URL » sous chaque fait (R06 §16.13), revérification 48 heures avant publication.
- **Formats automatiques** : teaser motion design, carrousels programme et agenda, citation animée, QR dynamique par affiche (R24 §10.4), récap monté à partir des plans fournis.
- **Humain** : portraits, directs, crédits et autorisations, faits sous 0,8 de confiance. Diaspora de Toronto et d'Ottawa : deux lignes éditoriales, membres (WhatsApp, Facebook) et ville (Instagram, BlogTO, bilingue), calendrier février, juin, août, septembre (R10 §8.17).

### 4.3 Église (sermon YouTube)

- **Sources** : PubSubHubbub de la chaîne YouTube pour la détection en minutes (R21 §9.6), fichier source déposé par la régie (Google Drive partagé ou salle Daily à 1,21 $ par sermon de 90 minutes, R21 §9.7), audio seul par WhatsApp pour les églises sans régie (43 Mo pour 90 minutes, R21 §9.8), calendrier liturgique (R09 §11.14). Jamais de téléchargement depuis YouTube (R21 §9.6).
- **Déclencheur principal** : sermon reçu → chaîne complète en moins de 24 heures : transcription AssemblyAI Universal-3.5 Pro à 0,21 $ par heure, français forcé, mots horodatés exigés (R05 §8.3 et §8.4) ; segmentation sur Haiku 4.5, sélection, titres et dérivés sur Opus 5.5 avec transcription en cache (environ 0,14 $, R05 §8.5, R07 §7) ; cinq types de moments, exclusion des annonces, de la quête et de la prière finale (R05 §8.7) ; versets résolus contre une base Segond 1910 locale ; planche de 8 vignettes prête le lundi midi (R05 §8.9).
- **Formats automatiques** : 5 clips verticaux sous-titrés (Reels 30 à 45 s, Shorts 45 à 58 s, TikTok 15 à 30 s, Facebook 45 à 75 s, R05 §8.10) plus un format long de 2 à 3 minutes pour Instagram et Shorts (R26 §5.1), recadrage par détection de visage, habillage Remotion avec bandeau verset, courte introduction originale par clip contre le critère « gabarit » de YouTube (R11 §15.8), 10 citations image, dévotionnel 5 jours, chapitrage et description YouTube, guide de groupe, newsletter (R05 §8.11). Cadence : un clip par jour, jamais les 5 le même jour, lundi à jeudi en priorité (R10 §8.16).
- **Humain obligatoire** : validation doctrinale de chaque extrait par le pasteur ou un responsable (un clip sorti de son contexte peut dire le contraire du sermon, R05 §8.15), aucune coupe au milieu d'un verset, demandes de prière traitées par l'église, zéro visage synthétique du pasteur (R03 §12.7), floutage du public, aucun enfant (R08 §10.11).
- **Mesure spécifique** : `creatorContentType=SHORTS` et `insightTrafficSourceType` pour savoir si les clips ramènent vers le message complet (R24 §10.11).

### 4.4 Maison d'édition chrétienne (livres, auteurs)

- **Sources** : base des titres (manuscrit, métadonnées, date de sortie), chaîne YouTube des auteurs (flux Atom), avis clients, calendrier liturgique, salons.
- **Déclencheurs** : nouveau titre → séquence de six semaines (révélation de couverture, citations, extraits, avis, lancement, rappel) ; nouveau sermon de l'auteur → extrait relié au livre par la même chaîne que l'église (une prédication par chapitre, R09 §11.6) ; avis 4 ou 5 étoiles → visuel « ils en parlent » ; fête liturgique → sélection thématique.
- **Formats automatiques** : citations animées, carrousels d'idées, révélation de couverture, audiogrammes avec couverture, bande-annonce de 15 secondes (R05 §8.16), newsletter, mot clé « LIVRE » en commentaire qui envoie le lien KDP ou WhatsApp selon le pays (R23 §8.3 et §6.2).
- **Humain** : lecture d'extrait par l'auteur, interview, validation doctrinale des résumés, dédicaces. Les clips musicaux « music video » restent dans l'atelier manuel de José (Higgsfield Unlimited), hors machine (R04 §8.1).

### 4.5 École supérieure (admissions, campus)

- **Sources** : calendrier académique, site www.2iae.com en lecture publique seulement (la session du site ajoute les événements GA4 `generate_lead`, `begin_application`, `submit_application`, R24 §10.17 ; le campus numérique n'est jamais touché, conformément à CLAUDE.md), agenda, résultats, registre des autorisations d'image.
- **Déclencheurs** : admission à J-30 → compte à rebours et carrousel ; rentrée à J-14 → série « bienvenue » ; résultat publié → visuel « victoire » ; événement terminé → récap sous 48 heures ; nouvelle formation → carrousel métiers ; actualité sectorielle → mini-cours proposé à un enseignant (R09 §7.8).
- **Formats automatiques** : comptes à rebours, carrousels métiers, récaps montés à partir des plans fournis, miniatures YouTube (Gemini, déjà en place), « 60 secondes pour comprendre » à partir des replays rendus publics avec consentement écrit (R05 §8.17), posts Google Business Profile (R02 §12.14), LinkedIn côté africain (1,8 million d'audience en Côte d'Ivoire, R10 §8.5).
- **Humain** : étudiants ambassadeurs, enseignants, témoignages, autorisations d'image (blocage automatique sans autorisation enregistrée, mineurs avec autorisation parentale, R09 §11.9), réponses aux candidats.

### 4.6 Agence B2B (Markel-Tech, LinkedIn)

- **Sources** : registre des projets (mises en ligne), base de questions clients, veille sectorielle par Tavily et Exa, X limité aux tendances par ville (R06 §6.2).
- **Déclencheurs** : projet mis en ligne → avant-après J+3, étude de cas en document natif J+14 après accord client, témoignage J+30 ; trois questions identiques → check-list ; actualité majeure d'une plateforme → post d'analyse proposé au fondateur ; fin de mois → sondage (R09 §8.8).
- **Formats automatiques** : documents natifs (7,00 % d'engagement) et carrousels d'images (6,45 %) avant la vidéo (6,00 %) (R09 §11.13), vidéo Remotion de 90 secondes avec voix clonée de José (0,20 à 0,50 $, R04 tableau §6), newsletter mensuelle, jamais de lien externe en premier commentaire automatique.
- **Humain** : posts et vidéos du fondateur (le compte de la personne fait 4 à 10 fois celui de l'organisation, R09 §11.7), accord des clients, chiffres vérifiés, Thought Leader Ads avec approbation par courriel (R23 §8.16). Aucune automatisation de profil LinkedIn (R08 §10.14).

---

## 5. La planche de propositions et la validation client

### 5.1 Contenu exact d'une planche

Une planche est une page composite (1080 × 1350 pour l'en-tête WhatsApp, vignettes individuelles sous 300 Ko pour le Flow et la PWA, R22 §10.8) qui présente 6 à 10 propositions ordonnées par date. Pour chaque proposition :

1. visuel de référence (maquette low, capture frame 0 ou prise brouillon) ;
2. hook en première ligne (le texte à l'image fait office de titre, R09 §2.4) ;
3. format et plateforme (Reel, carrousel, document, story, clip) ;
4. date et heure prévues, dans le fuseau du client ;
5. pilier (valeur, relation, promotion) et framework (PAS, AIDA, BAB, FAB) ;
6. ce que le client doit fournir lui-même (visage, témoignage, plan tourné) (R09 §11.11) ;
7. ligne « faits à confirmer » (prix, dates, noms non retrouvés en base) et « Source : URL » sous chaque fait de veille (R11 §15.15, R06 §16.13) ;
8. mention « étiquette IA requise » quand le visuel est photoréaliste généré (R11 §15.7).

En pied de planche : la répartition 60/25/15 de la semaine, la réserve de sécurité disponible, et le rappel du cadre (« sans réponse mardi 18 h, nous publierons les 3 contenus marqués d'un point vert »).

### 5.2 Canaux

- **WhatsApp Business Platform en accès direct Cloud API** sous le portefeuille Markel-Tech, deux numéros dédiés (+225 et +1), entreprise vérifiée (R22 §10.1 à §10.3). Modèles utilitaires soumis une fois : `planche_prete`, `rappel_planche`, `production_terminee`, `publication_faite`, `rapport_mensuel`, `alerte_gestionnaire` (R22 §10.4), plus `tendance_express` et `confirmation_optin`. Coût : 0,004 $ par message en Côte d'Ivoire, 0,0034 $ au Canada, 0,030 $ en France, soit 0,06 à 0,10 $ par client et par mois (R22 §0.1 et §0.2). Le webhook `message_template_category_update` bloque tout modèle reclassé marketing (R22 §10.5).
- **Flow générique** publié une fois, deux écrans (validées, à revoir avec motif), alimenté par `flow_token`, en mode `navigate` sans endpoint au départ (R22 §10.7).
- **Vocaux** : téléchargés sous 5 minutes, archivés, transcrits par gpt-4o-mini-transcribe à 0,003 $ la minute, renvoyés en citation avec bouton de confirmation, puis transformés par Claude en instruction de retouche (R22 §10.9).
- **Courriel Resend** en parallèle, avec le même lien signé.
- **Lien magique** : page mobile 390 px, une carte par proposition, feuille « à revoir » avec motifs cochables et vocal, jeton signé sans compte ; même table de décisions que le Flow, pour commencer sur WhatsApp et finir sur la PWA (R22 §10.14).

### 5.3 États, relances, versions

États de la planche : `brouillon` → `relue` (porte 1) → `envoyee` → `partiellement_validee` → `validee`, `validee_par_cadre` ou `expiree`. Relances bornées à deux (J+2, J+5) puis humain (R22 §10.10). Chaque modification crée une version (`board_version`) avec diff lisible ; une proposition `a_revoir` revient dans la version suivante avec le motif et la correction, envoyée par message de service dans la fenêtre de 24 heures ouverte par le tap (gratuit sous 1 000 messages par numéro et par mois, R22 §0.1 ; le passage à 0,004 $ au-delà reste à confirmer sur la page Meta, R10 §9.3). Toutes les décisions sont journalisées (qui, quand, par quel canal) dans `audit_log` (R02 §12.16).

### 5.4 Opt-in et conformité

Opt-in nominatif en deux cases au contrat, preuve horodatée en base, STOP traité automatiquement, modèle `confirmation_optin` à la signature (R22 §10.12) ; conformité à la politique WhatsApp du 23 septembre 2026 et à la LCAP canadienne (R08 §1.5).

---

## 6. Le poste de pilotage du gestionnaire

### 6.1 Écrans

1. **Vue flotte** : une ligne par client : état du cycle, prochaine échéance, âge de la dernière publication, réserve de sécurité, plafond de génération consommé (alerte à 80 %, R25 §11.12), jetons de connexion (vert, J-10 orange, expiré rouge), note de qualité WhatsApp.
2. **File « à relire »** (porte 1) : planches avec score du juge, faits à confirmer, visuels rejetés par la vision ; un clic : approuver, corriger la légende, ouvrir dans Canva (MCP, Brand Kit par client, R03 §12.8), renvoyer avec motif, remplacer par une proposition de réserve.
3. **File « à contrôler »** (porte 3) : rendus finaux avec lecteur et checklist (droits, orthographe, étiquette IA, musique, consentements) ; un clic : publier, reporter, repli manuel, renvoyer.
4. **Boîte de réception** : commentaires et messages en six classes par Haiku 4.5 (R23 §8.4) ; seuls critique, sensible et envois hors fenêtre exigent un clic (étiquette HUMAN_AGENT tracée, R23 §8.5) ; file pastorale renvoyée au client église.
5. **TikTok à traiter dans l'app** : liste quotidienne classée par volume de commentaires (R23 §8.9).
6. **Dead letter et incidents** : jobs en échec définitif, plafonds atteints, moteurs en repli, pages de politique modifiées.
7. **Boosts à proposer** : candidates à 24 heures (deux conditions sur trois à 1,5 fois la médiane, R23 §5.5), validation écrite du client, exécution par le gestionnaire, jamais de boost automatique (R23 §8.10).

### 6.2 Alertes (WhatsApp vers le numéro machine, Web Push sur la PWA)

Niveau 1 (information, PWA seulement) : planche envoyée, publication faite. Niveau 2 (action sous 24 heures, PWA et WhatsApp) : porte en retard, client silencieux, jeton J-10, plafond à 80 %. Niveau 3 (incident, WhatsApp à José aussi) : publication en échec après trois tentatives, moteur de génération indisponible après repli, client sans publication depuis 7 jours, critique non traitée depuis 1 heure en journée (R23 §4.1), CTWA sans réponse après 2 heures (R23 §8.17). CallMeBot reste pour les alertes personnelles de José seulement, parce que non officiel (R10 §8.2).

### 6.3 Indicateurs « à la page » affichés par client

Les quatre indicateurs de R11 §12, calculés depuis `signal`, `source_asset` et `publication` (R24 §5) : délai médian tendance vers publication (cibles : tendance 24 heures, nouveauté produit 72 heures, événement 48 heures, sermon 24 heures, R09 §11.16), taux de nouveautés exploitées sous 14 jours (cible 100 %), taux de vidéos (cible de la verticale), sermons réemployés (3 dérivés sous 7 jours). Plus le taux de validation du premier coup par client (R07 §11.13), le délai médian de première réponse aux commentaires (R08 §10.7) et les trois indicateurs d'entrée de R21 §9.18 (dépôt vers planche sous 24 heures, dépôts incomplets sous 20 %, corrections humaines sur fiches sous 10 %).

---

## 7. L'usine de production

### 7.1 Principes

- **Deux couches pour l'image** : moteur génératif pour scènes et éléments, composition déterministe (React rendu par Playwright sur Railway, ou Canva Autofill ouvert aux plans Teams depuis le 21 septembre 2026) pour tout texte, logo et aplat de marque (R03 §12.1). Le texte généré par l'IA n'est admis que lorsqu'il fait partie de la scène.
- **Deux modes** : brouillon pour la planche, production après validation (R04 §8.3). Ce seul choix divise par 5 à 10 le coût de ce qui n'est pas validé.
- **Remotion au cœur** : vidéos programmées (texte, sous-titres, chiffres, logos) rendues sur le worker CPU Railway tant que l'effectif reste à 3 personnes (licence gratuite, à confirmer, R25 §10.6), Remotion Lambda sinon (0,10 $ le lot de 5 clips d'une minute, R25 §6.2).
- **Humain là où l'émotion porte** : visages, témoignages, fondatrice, pasteur ; la machine prépare, découpe, sous-titre, habille (R04 §8.17). 20 % du mix reste 100 % humain (R11 §15.16).
- **Étiquette IA calculée, jamais devinée** : champ `is_aigc` par variante (R25 §9.8), `is_ai_generated: true` sur Instagram pour tout média photoréaliste généré (R26 §5.4), métadonnées C2PA et SynthID conservées (R03 §12.13).
- **Prix cités** : prix officiels par jeton pour OpenAI (gpt-image-2.5 : 5 $ texte entrée, 8 $ image entrée, 30 $ image sortie par million de jetons, R26 tableau 2d) ; les prix par image ci-dessous sont les tarifs de l'agrégateur fal lus en octobre 2026 (R03 §1) et seront remplacés par le coût réel mesuré sur vingt générations (R26 §5.7).

### 7.2 Tableau récapitulatif par type de contenu

| Type de contenu | Chaîne (moteurs, versions) | Prix unitaire daté | Contrôle qualité | Repli |
|---|---|---|---|---|
| Post texte (légende, hashtags) | Opus 5.5, cerveau de marque en cache 1 h, sortie structurée | 0,022 $ (0,011 $ en Batch), R07 §7 | juge 7 critères Haiku 4.5 (0,0045 $), 5 hashtags maximum en contrainte dure (R26 §5.13) | Sonnet 5.5 si refus ou latence |
| Carrousel 8 planches | Opus 5.5 pour le JSON, composition HTML vers PNG (Satori ou Playwright), export PDF pour LinkedIn | 0,068 $ de jetons, rendu quasi nul (R07 §7, R03 §12.9) | vision Haiku sur chaque planche (texte attendu, lisibilité 390 px) | Canva Autofill |
| Visuel avec texte (annonce, citation) | fond gpt-image-2.5-flare (low 0,006 $ brouillon, high 0,053 $ production, tarif fal) ou style de marque Recraft V4.1 (0,035 $), texte posé en HTML | 0,01 à 0,06 $ (R03 §12.2, §12.14) | vision Haiku 0,002 $ (R07 §6.2), jeu de test français de 30 phrases accentuées à chaque changement de version (R03 §12.11) | FLUX.2 [pro] 0,03 $ via fal, Nano Banana 2 0,067 $ |
| Photo produit mise en scène (beauté) | packshot détouré (Photoroom 0,02 $), scène gpt-image-2.5-sunburst en édition masquée avec 16 références, composition | 0,08 à 0,15 $ | comparaison vision avec le packshot original, aucun produit synthétisé (R03 §12.6) | Seedream 5.0 Pro 0,0675 $ |
| Reel génératif (produit, ambiance) 15 à 20 s | script Opus 5.5 (0,086 $), brouillon LTX-2.3 1 prise 0,06 $/s, production Kling 3.0 via API Higgsfield 0,084 $/s × 3 prises (1,26 $ par prise de 15 s), montage Remotion, voix ElevenLabs v3 0,08 $ par 1 000 caractères, musique Lyria 3 Pro 0,08 $ | 4 à 7 $ par Reel (R26 §5.11, R04 tableau §6) | juge vision par image clé, test de filtres de contenu par verticale (R04 §8.16), étiquette IA | Veo 3.1 Fast 0,10 $/s via Gemini, fal (Seedance 2.0) ; scène signature en Seedance 2.5 0,2057 $/s seulement sur demande |
| Reel programmé Remotion (annonce, chiffres, compte à rebours, tutoriel) | composition React par client, rendu CPU Railway ou Lambda 0,02 $ la minute, sous-titres mot à mot | 0,05 à 0,50 $ (R04 §8.13) | rendu déterministe, vision sur frame 0 et frame finale | aucun nécessaire |
| Clip de sermon 30 à 60 s (et long 2 à 3 min) | AssemblyAI 0,21 $/h, Haiku puis Opus (0,14 $), découpe ffmpeg, recadrage visage, sous-titres libass, habillage Remotion | 0,80 à 2,50 $ par sermon pour 5 clips (R05 §8.1, R25 §6.2) | validation doctrinale humaine, verset vérifié, coupe interdite au milieu d'un verset | Vizard API (600 min pour 14,50 $/mois) le temps que la chaîne maison dépasse la leur (R05 §8.2) |
| UGC (témoignage, démonstration) | vidéo réelle du client montée par ffmpeg et Remotion, sous-titres, grain uniforme ; avatar synthétique neutre seulement pour un présentateur générique, étiqueté (R04 §8.6) | 0,10 à 0,30 $ monté ; avatar HeyGen hors périmètre par défaut | consentement enregistré, étiquette | aucun |
| Story | visuel ou extrait 9:16 de 15 s, texte posé en HTML, export MP4 Canva possible | 0,01 à 0,05 $ | vision | aucun |
| Miniature YouTube | Gemini (déjà en place) pour le fond, titre posé en HTML, test de lisibilité à 160 px | 0,07 $ (Nano Banana 2) | vision, contraste | gpt-image-2.5 |
| Vidéo explicative de logiciel 60 à 90 s (2IAE, Markel-Tech) | captures ou enregistrement d'écran, zooms et curseur Remotion, voix ElevenLabs ou voix clonée, sous-titres | 0,15 à 0,40 $ (R04 tableau §6) | relecture humaine des étapes | aucun |
| Musique | bibliothèque native des plateformes pour l'organique ; Lyria 3 Pro 0,08 $ ou ElevenLabs Music 0,15 $/min hors plateforme ; Epidemic Sound sous licence pour les églises sur YouTube | 0,08 à 0,15 $ | drapeau « usage commercial à vérifier » sur tout son tendance (R06 §12) | Suno jamais automatisé (pas d'API, R04 §8.12) |

### 7.3 Abstraction des moteurs et bascule

Une interface interne par famille (image, vidéo, voix, transcription, LLM) avec `soumettre`, `interroger`, `récupérer`, webhooks, et pour chaque actif le moteur, la version, le prompt, les références et le coût réel (R03 §12.11, R08 §10.8). Trois adaptateurs vidéo : Gemini (Veo 3.1 Fast et Lite), fal (Seedance, Kling, LTX-2.3), Higgsfield API (Kling 3.0, Seedance 2.5, Soul ID, Popcorn) (R04 §8.2). Calendrier de retrait connu : gpt-image-1 le 23 octobre 2026, gpt-image-1.5 le 1er décembre 2026 (R26 tableau 2b et 2c). Un test hebdomadaire par fournisseur (H9) détecte une dépréciation avant qu'un client ne la subisse.

---

## 8. La veille et l'intelligence

### 8.1 Sources par flux et fréquences

| Flux | Sources | Fréquence | Coût |
|---|---|---|---|
| A. Chez le client | crawl du site (sitemap, flux WordPress ou Shopify), dépôts WhatsApp, flux Atom YouTube et PubSubHubbub, Business Discovery sur ses propres comptes | quotidien, horaire, temps réel | 0 (R06 §13.2) |
| B. Domaine et région | Google Trends Trending Now RSS (CI, CA, FR), Google News RSS (10 requêtes par client), GDELT DOC 2.0 (3 requêtes), Abidjan.net et médias ontariens en RSS, SerpApi Google Events (2 villes, hebdomadaire), changedetection.io pour les agendas rendus en JavaScript | 2 h, 4 h, 6 h, hebdomadaire | SerpApi 25 à 75 $ partagés, changedetection 5 à 15 $ d'hébergement (R06 §14.1) |
| C. Tendances de format | Apify Creative Center TikTok (hashtags et sons, 3 pays, partagé), saisie hebdomadaire de 10 sons Reels par le gestionnaire, YouTube videos.list mostPopular (1 unité), Shazam CSV, Instagram 30 hashtags par 7 jours par compte (10 marque, 10 niche, 10 exploratoires, R06 §16.6) | quotidien, hebdomadaire | Apify 19 $ partagés |
| D. Concurrents | Business Discovery (5 à 10 comptes par client), Page Public Content Access après App Review | quotidien | 0 |
| E. Recherche agentique | Tavily (1 000 crédits gratuits par mois), Exa pour les sites similaires, Perplexity Sonar pour la genèse citée | 2 recherches par client et par jour | 0 à 40 $ partagés |
| F. Calendrier | Nager.Date (CI), canada-holidays.ca, ONU, calendrier liturgique calculé, fêtes musulmanes saisies à la main chaque année, dates propres du client | hebdomadaire, horizon 6 semaines | 0 |

Interdits : pytrends sur Railway (429 depuis les IP cloud, R06 §16.3), NewsAPI (449 $ par mois pour ce que Google News RSS et GDELT rendent gratuitement, R06 §16.8), API Google Trends officielle (alpha fermée, R06 §2.1). Les scrapers (Apify) sont isolés des comptes de publication des clients et mentionnés au contrat (R06 §16.18). Plan B par source gratuite : bascule vers SerpApi ou Apify par changement de configuration, sans redéploiement (R06 §16.20).

### 8.2 Scoring

Service à part, avec cache de prompt (profil client stable en tête) et Batch API pour tout ce qui n'est pas newsjacking (R06 §16.12). Haiku 4.5 reçoit 20 items par appel et renvoie en sortie structurée : pertinence 0 à 100, pilier, urgence (newsjacking, planifiable, intemporel), risque, angle en une phrase (R06 §13.3). Score composite : pertinence × fraîcheur (demi-vie 36 heures pour les tendances, 14 jours pour les événements, infinie pour le calendrier) × signal de tendance × diversité (R06 §13.3). Coût : environ 3 $ par client et par mois sur Haiku, moins de 5 $ avec le Batch (R06 §16.12).

### 8.3 Vérification des faits

Règles dures de R06 §13.4 : deux sources dont une primaire pour toute date et tout lieu ; confiance par champ, blocage sous 0,8 ; horodatage de la vérification et revérification 48 heures avant publication ; citation exacte et URL conservées ; sujets politiques et religieux controversés exclus du newsjacking pour les églises, SEVARTA et 2IAE ; pour les sermons, aucun fait extérieur sans source.

### 8.4 Calendrier des moments

Trois couches (R10 §8.9) : fêtes fixes par pays ; fêtes lunaires avec fenêtre de deux jours et confirmation la veille ; événements vivants rafraîchis par la veille (FEMUA, MASA, Afrofest, Caribbean Carnival, Francophonie en fête, rentrée ivoirienne le 14 septembre). La machine propose un contenu 10 jours avant chaque date pour chaque client concerné, et génère 8 semaines à l'avance les moments à préparer (R06 §16.17). Hashtags « de fête » par pays, les plus performants dans presque toutes les industries (R09 §11.4).

### 8.5 Mesure de la veille elle-même et coût mensuel

Pour chaque item retenu : proposé, accepté, publié, performance (R06 §16.19). Après 90 jours, les sources sans item accepté sont coupées. Coût : socle partagé 60 à 170 $ par mois, puis 5 à 10 $ par client léger (église, association), 12 à 25 $ standard (beauté, SEVARTA, 2IAE), 30 à 60 $ intensif (R06 §14.2). La veille n'est pas le poste de coût, c'est le poste de valeur (R06 §14.2).

---

## 9. L'architecture agentique

### 9.1 Principe : appels structurés pour 80 % du volume, agents pour les tâches ouvertes

Le cœur tourne sur l'API Messages avec sorties structurées (`output_config.format`, GA, sans surcoût, R21 §2.2) : posts, carrousels, scripts, calendrier, juges, vision, scoring, tri de commentaires, extraction de flyers (R07 §11.1). Un agent coûte 4 fois plus de jetons qu'un appel, un système multi-agents 15 fois (R07 §3) ; ils sont réservés aux sermons qui exigent d'écouter plusieurs passages, aux audits de site à l'intake et à la revue mensuelle.

### 9.2 Modèles Claude par tâche (prix officiels, R26 tableau 3)

| Tâche | Modèle | Prix (entrée / sortie par MTok) | Justification |
|---|---|---|---|
| Création (posts, scripts, calendrier, sélection de clips, dérivés de sermon) | Opus 5.5 | 4 $ / 20 $, cache 0,20 $ (0,05x) | qualité de voix ; cache rentable dès la première relecture (R26 §5.9) |
| Synthèse, extraction INCI et PDF, brouillons de réponse | Sonnet 5.5 | 2 $ / 10 $, cache 0,20 $ | rapport qualité prix pour l'extraction (R21 §9.1) |
| Juges, vision, scoring de veille, ouvriers de lecture, tri de commentaires, classification de flyers | Haiku 4.5 | 1 $ / 5 $, cache 0,10 $ | 0,002 $ par image, 0,30 à 0,75 $ pour 1 000 commentaires (R07 §6.2, R23 §4.2) |
| Sessions d'agent longues (orchestration d'un sermon complet, revue mensuelle) | Fable 5.1 | 10 $ / 50 $, cache 0,25 $ (0,025x) | réservé aux sessions longues, jamais aux légendes (R26 §5.8) |
| Second juge d'une autre famille (10 % d'échantillon) | gpt-4o-mini (déjà en place) | prix 2024 non vérifié | biais d'auto-préférence (R11 §15.4) |

Règles : ne jamais changer de modèle en cours de conversation (cache par modèle), majorer les entrées de 30 % pour le tokenizer 2026 (R26 §5.8), Batch API pour tout ce qui n'attend personne (veille nocturne, jugement en masse, calendrier du mois suivant, 50 % d'économie, R07 §11.4), tester `stop_reason === "refusal"` et activer `fallbacks: "default"` (R07 §11.15). Panier type : environ 10,6 $ par client et par mois, 7 $ avec le Batch (R07 §7).

### 9.3 Cerveau de marque et mémoire

Trois couches (R07 §4) : couche stable de 4 000 à 12 000 jetons par client (fiche de voix versionnée avec règles mécaniques, lexique, interdits, dix meilleurs posts, R11 §15.1 ; doctrine encodée comme contrat : deux plateformes, 60/25/15, frameworks, hooks, 3 à 5 hashtags, R01 §8.8 ; profil de conformité par verticale, R03 §12.12) derrière un `cache_control` TTL 1 heure ; couche vivante en tables Postgres exposées par outils (`get_brand_assets`, `get_recent_posts`, `get_metrics`) pour ne pas casser le préfixe caché ; couche agentique dans le `SessionStore` Postgres. Registre ivoirien : nouchi autorisé dans le lexique signature quand le client le souhaite (R11 §15.14).

### 9.4 Juge qualité et garde-fous

Juge à sept critères (spécificité, originalité par test de substitution, voix, framework, exactitude sourcée, pilier, risque), seuil 15/21, modèle différent du générateur, deux révisions maximum (R11 §15.3, R07 §6.1). Calibration le premier mois : 100 posts notés par José par verticale, kappa d'au moins 0,6, recalibration mensuelle et à chaque changement de modèle (R11 §15.4). Interdits lexicaux français construits par statistique sur 500 brouillons bruts contre le corpus validé (R11 §15.6). Garde-fous codés : allégations par verticale, versets vérifiés par outil, consentement d'image enregistré, chiffres d'admission 2IAE issus de la base (R07 §11.15), étiquette IA requise calculée (R11 §15.7).

### 9.5 Place exacte de chaque surface Anthropic et de Higgsfield

- **API Messages et Agent SDK** : dans les workers Railway, clé API de la plateforme, jamais l'abonnement claude.ai de José (interdiction documentée, R07 §11.17). Agent SDK TypeScript dans un conteneur dédié, `SessionStore` Postgres, `maxBudgetUsd` par job, profondeur de sous-agents 1, hooks `PreToolUse` d'audit et `defer` pour les actions irréversibles (R07 §11.8).
- **Serveur MCP distant « machine-social »** exposé par la plateforme (Streamable HTTP, OAuth 2.1, PKCE, RFC 9728, 8414, 7591, 8707, joignable depuis les adresses d'Anthropic, R07 §11.9). Dix outils au départ : `list_pending_briefs`, `get_brand_brain`, `get_assets`, `submit_render`, `submit_board`, `approve`, `reject`, `request_generation_job`, `report_metrics`, `log_decision`. C'est la seule interface que Cowork, Claude Code, les Routines et Managed Agents parlent tous (R07 §9.2).
- **Claude Cowork** : la plateforme ne peut pas le déclencher (pas d'API publique, R07 §11.10). Cowork tire : une tâche planifiée Cowork lit la file via le connecteur MCP et exécute les tâches ouvertes de José (audit de site d'un nouveau client, page de campagne). Vérifier avant le 6 octobre 2026 la bascule « nuage uniquement » des plans Pro et Max (R07 §10.1).
- **Claude Code et Routines** : une Routine « revue hebdomadaire des clients » tirée par la plateforme le lundi (POST `/fire`, 30 tirs par heure et par routine, 65 536 caractères, aucune clé d'idempotence, donc un seul tir par cycle journalisé) et une Routine « incident » quand un client cumule trois refus du juge (R07 §11.12).
- **Claude in Chrome** : outil personnel de José pour Higgsfield Unlimited (skill maison), hors du chemin critique des clients ; aucune dépendance de la plateforme à un Chrome ouvert (R07 §11.11, R26 §5.10).
- **Higgsfield** : API officielle (console open.higgsfield.ai, lancée le 16 septembre 2026, paiement à la génération, SDK TypeScript, webhooks, fichiers conservés 7 jours) pour Kling 3.0 à 0,084 $ par seconde et Seedance 2.5 à 0,2057 $ par seconde (R26 tableau 4d et 4e). Jamais le pilotage navigateur de l'Unlimited (section 10.6 des conditions du 26 juillet 2026, centre d'aide du 28 août 2026). Les visages de pasteurs et les enfants sont exclus des références envoyées à Higgsfield hors contrat Enterprise (entraînement possible, R26 §5.12).
- **Canva** : Brand Kit par client, 10 à 20 brand templates, Autofill par l'API Connect ou le MCP ; le gestionnaire et le client retouchent dans Canva (R03 §12.8).
- **Managed Agents** : option de montée en gamme sans réécriture (Deployments programmés, Memory stores, 0,08 $ par heure) si José veut cesser d'opérer le conteneur agent (R07 §11.18) ; non retenu au départ (bêta).

---

## 10. Publication, mesure et apprentissage

### 10.1 Couche de publication : trajectoire

Interface unique « connecteur » (publier, lire, statistiques) avec deux implémentations (R02 §12.1) :

- **Phase 1 (mois 1 à 6)** : API unifiée Upload-Post Professional (50 $ par mois, 25 profils, marque blanche, sans App Review ni audit TikTok à porter, R02 tableau §6) pour Facebook, Instagram, LinkedIn, YouTube, Threads et Google Business Profile ; Blotato Starter (29 $ par mois) comme couche de repli TikTok et comme MCP de secours (R26 §5.17) ; test de deux semaines sur les comptes de José avant le premier client. Ayrshare Launch (299 $ par mois, 10 profils) reste l'option si le pilote exige support et apps auditées de longue date.
- **Dès J0 en parallèle** : demandes officielles lancées, car les délais ne se compressent pas (Meta App Review jusqu'à 20 jours par décision, YouTube 2 à 4 semaines, TikTok et LinkedIn plusieurs semaines, R02 §12.2) : app Meta liée à Markel-Tech Inc. vérifiée (publication, Instagram Public Content Access, Page Public Content Access, commentaires, messages, HUMAN_AGENT, ads en une seule revue, R23 §8.2), projet Google Cloud audité, app TikTok soumise à l'audit Content Posting, LinkedIn Community Management Development Tier, Google Business Profile.
- **Phase 2 (mois 6 à 12)** : migration client par client vers les apps propres, coût marginal nul, une personne responsable des revues et des versions (Meta v26.0, LinkedIn 202609 avec retrait de 202510 le 15 octobre 2026, R02 §12.17).

### 10.2 Contraintes par plateforme encodées

Instagram : Reel de 3 secondes à 15 minutes et 300 Mo par API, MP4 sans edit lists, moov en tête, H.264, AAC 48 kHz, 1080 × 1920 à 8 Mbps (R26 §5.2) ; carrousel 10 éléments par API (R02 §12.6) ; 5 hashtags maximum ; Trial Reels pour les clips de sermon et les lancements (R26 §5.5). Facebook Reels : 3 à 90 secondes, 30 par 24 heures. TikTok : privé tant que l'app n'est pas auditée, 5 utilisateurs publiant par 24 heures en pré-audit (R26 résumé), écran de validation par post avec choix de confidentialité sans valeur par défaut (R02 §12.3). YouTube : 100 uploads par jour par projet, Shorts jusqu'à 3 minutes, consentement exprès. LinkedIn : documents natifs et multi-images, version mensuelle. X : réservé à Markel-Tech, 0,015 $ par post, budget plafonné (R02 §12.13). WhatsApp Channels et Status : aucune API, paquet prêt à publier (R10 §8.1), adaptateur isolé pour le jour où Meta livre la programmation (R10 §8.20).

### 10.3 Repli manuel comme fonctionnalité

Le « paquet prêt à publier » (médias au bon format, légende, hashtags, heure, cases à cocher, lien profond) couvre WhatsApp Channels, Snapchat, TikTok pré-audit, les refus d'API et les pannes ; le gestionnaire colle l'URL publiée et la machine mesure ensuite (R02 §12.15).

### 10.4 Mesure en trois couches

- **Couche affaires, en premier** : liens traçables générés par la machine (`go.{domaine}/{code}`, convention UTM `utm_campaign={client}-{aaaa-mm}-{pilier}`, `utm_content={content_item}-{format}`, R24 §2.1), page lien en bio maison (contre 15 $ par profil chez Linktree Pro, R24 §10.3), QR dynamiques maison pour flyers et affiches, coupon par contenu promotionnel lisible à voix haute (R24 §10.6), `ctwa_clid` et objet `referral` des conversations WhatsApp issues de publicités, Conversions API « business_messaging » pour `Lead`, `QualifiedLead`, `Purchase` (R24 §10.5), événements GA4 du site 2IAE, CRM Zoho pour Markel-Tech.
- **Couche croissance** : abonnés nets, visites de profil, clics vers le lien en bio, messages entrants, vues (plus jamais « portée organique contre payée » sur Facebook depuis le retrait du 15 juin 2026, R24 §10.10).
- **Couche indicateurs avancés** : envois par portée et enregistrements par portée en tête (R11 §15.13), visionnage complet, `reels_skip_rate`, rétention à 3 secondes, comparaison à la médiane de la verticale (seuils de R24 §6.2, remplacés par la médiane locale après trois mois) ; alerte seulement deux mois de suite sous le seuil et sous la médiane locale (R24 §10.14).
- **Collecte** : chaque nuit, en ajout seul, chez soi (Instagram retarde de 48 heures et efface à 2 ans, Stories à 24 heures, Facebook 90 jours par requête, LinkedIn 12 mois glissants, R24 §10.7) ; noms de métriques bruts avec `metric_alias` versionnée (R24 §10.9) ; test hebdomadaire de collecte qui échoue bruyamment sur « invalid metric » (R24 §10.20).

### 10.5 Rapport mensuel

PDF d'une page rendu par Puppeteer sur Railway et résumé WhatsApp de cinq lignes avec les trois meilleures publications en vignette, livrés le premier lundi après le 3 du mois avant 9 h heure du client (R24 §4.2 et §10.8). Gabarit : couche affaires en gros, croissance, indicateurs avancés avec pastille, trois meilleures publications et une qui a échoué avec la leçon, indicateurs « à la page », trois décisions pour le mois suivant et l'état du plan à 90 jours. Coût de la mesure : 1 à 3 $ par client et par mois (R24 §8), contre 38 $ avec des outils tiers.

### 10.6 Boucle d'apprentissage

1. Chaque contenu reçoit à J+30 une récompense (envois et enregistrements par portée) ; un bandit par verticale (pas par client) avec 20 % d'exploration met à jour les probabilités des familles de hooks, affichées au gestionnaire plutôt qu'imposées (R11 §15.9).
2. Les corrections du gestionnaire (paires brouillon, correction, motif) et les décisions du client sont réinjectées le premier du mois dans le prompt de génération (10 meilleurs posts, 5 à 10 dernières paires, R11 §15.10).
3. Les clips de sermon qui ont marché nourrissent le modèle de sélection par client (R05 §8.14).
4. Les sources de veille sans item accepté en 90 jours sont coupées (R06 §16.19).
5. L'effet de l'étiquette IA sur chaque compte est mesuré sur 90 jours, étiqueté contre non étiqueté (R04 §8.8).
6. Revue à 90 jours : comparaison avant/après, révision du cadre éditorial, recalcul des médianes locales (R08 §10.18).

### 10.7 Après la publication : commentaires, messages, amplification

Boîte de réception maison sur les API Meta gratuites (750 réponses privées par heure, R23 §8.1) : tri Haiku en six classes, mot clé par verticale (PRIÈRE, LIVRE, ADMISSION, PRODUIT, BILLET, GUIDE) avec réponse publique variée et réponse privée sous 7 jours (R23 §8.3), divulgation de l'automate en message privé (R23 §8.7), indicateur de réactivité affiché au client (R23 §8.6). Boost en trois temps : détection à 24 heures, proposition, exécution humaine après validation écrite ; 5 $ par jour sur 7 jours à Abidjan, 10 $ au Canada ; plafond mensuel et contenus exclus au contrat ; compte publicitaire du client (R23 §8.10 à §8.13). Click-to-WhatsApp comme amplification par défaut pour la beauté, l'association et 2IAE, avec réponse garantie sous 24 heures (R23 §8.17).

---

## 11. Architecture technique et modèle de données

### 11.1 Contrainte d'infrastructure respectée

Toute la persistance vit sur Railway, provisionnée avec le Railway CLI : Postgres, volumes, buckets S3 de Railway. Aucun Supabase, Neon ni bucket chez un autre fournisseur (rappel de José du 1er octobre 2026). R25 §11.2 recommandait un bucket Cloudflare R2 pour deux usages ; cette conception les couvre autrement : TikTok en FILE_UPLOAD (4 Go, morceaux de 5 à 64 Mo, R25 §11.3), qui n'exige aucune URL publique ; copie des originaux et dumps hebdomadaires dans un **second bucket Railway placé dans un projet Railway distinct « machine-archives »**, pour survivre à la suppression accidentelle du projet principal (seul le dump logique survit à la suppression d'un projet, R25 §11.8). Railway n'ayant ni versionnage ni verrou d'objet (R25 §1.3), la rétention et la vérification de purge sont écrites en jobs maison. Ce choix est posé en question ouverte à José (section 15).

### 11.2 Services Railway (projet « machine », environnement production, région EU West Amsterdam, R25 §11.1)

| Service | Rôle | Dimensionnement de départ (R25 §8) |
|---|---|---|
| `web` | Express + React PWA (postes de pilotage, pages de validation, lien en bio, raccourcisseur), webhooks (WhatsApp, Meta, PubSubHubbub, fournisseurs de génération), serveur MCP distant | 0,5 vCPU, 1 Go : 20 $ |
| `worker-api` | pg-boss : veille, scoring, idéation, rédaction, juge, vision, planche, notification, publication, métrique, rapport, rétention, santé | 0,5 vCPU, 2 Go : 30 $ |
| `worker-agent` | Claude Agent SDK, `SessionStore` Postgres, budgets par job | selon usage, séparé du rendu (R25 §11.11) |
| `worker-rendu` | ffmpeg, libass, MediaPipe, Remotion CPU, Puppeteer ; mode Serverless, file `rendu` à concurrence 1 par réplica | 4 vCPU, 8 Go, 2 h par jour : 13 $ |
| `tick` | Railway cron toutes les 5 minutes, sort en moins d'une minute | négligeable |
| `changedetection` | agendas et concurrents rendus en JavaScript | 5 à 15 $ |
| Postgres | base unique, RLS forcée, PITR activé dès le premier jour | 0,25 vCPU, 1 Go, 5 Go : 16 $ |
| Bucket `machine-ams` | travail : `t/{tenant}/orig`, `der`, `pub`, `exp` (R25 §4.1) | 0,015 $ par Go |
| Bucket `machine-archives` (projet distinct) | copies des originaux, dumps `pg_dump` hebdomadaires chiffrés | 0,015 $ par Go |

Total hébergement : 85 à 110 $ par mois à 6 clients, 230 à 290 $ à 20 clients, soit 12 à 18 $ par client (R25 §1.2). Limite de dépense dure Railway à 1,5 fois la facture attendue (R25 §11.13). Réseau privé `railway.internal` seulement, URL publique de la base désactivée (R25 §11.14). Le projet « Groupe 2iae » (site et campus) n'est jamais touché.

### 11.3 Files pg-boss

`veille`, `scoring`, `genese`, `ideation`, `redaction`, `juge`, `vision`, `planche`, `notification`, `generation`, `rendu`, `publication`, `inbox`, `metrique`, `rapport`, `retention_purge`, `sante`, `tenant_offboard`. Clés de singleton par `client:type:date`, dead letter visible, schéma `pgboss` hors RLS avec charges utiles réduites à des identifiants (R25 §5.1). Les jobs liés à un client rouvrent une transaction avec `set_config('app.tenant_id', …)`.

### 11.4 Postgres : tables principales et colonnes clés

Conventions (R25 §9) : UUIDv7, `tenant_id` non nul partout, clé composite `(tenant_id, id)` sur les tables volumineuses, `timestamptz`, `usd_micro` en bigint, schémas `app` (RLS), `pgboss`, `audit` (ajout seul, partitionné par mois), `ref` (partagé). Rôles : `migrator`, `app_rw` (sans `BYPASSRLS`, `FORCE ROW LEVEL SECURITY`), `app_ro`, `backup` (`row_security = off`). Le skill maison `agents-base-donnees` (/db) valide ce schéma avec le Railway CLI avant la première ligne de code et génère la batterie d'isolation (R25 §11.6).

| Table | Colonnes clés |
|---|---|
| `tenant` | id, nom, verticale, pays, timezone, langues, registre (standard, nouchi, bilingue), data_region, palier, cadence_contrat, cadence_reduite, cadre_version, statut (actif, suspendu_doux, offboard) |
| `tenant_key`, `tenant_secret` | DEK chiffrée par la KEK (version, rotated_at) ; jetons OAuth, BYOK, numéros WhatsApp en AES-256-GCM avec nonce, tag, key_version (R25 §5.3) |
| `person` | gestionnaires et contacts clients, rôle, opt-in WhatsApp (horodatage, source, texte), stop_at |
| `brand_brain` | tenant_id, version, bloc_stable (texte caché), fiche_voix, interdits, piliers, plateformes, profil_conformite, valide_par_client_at |
| `editorial_frame` | cadre trimestriel : catégories auto-publiables, cadence_reduite, mode_reactif, plafonds de boost, contenus exclus, signé_at |
| `social_account` | plateforme, external_id, handle, pays, token_ref, api_version, actif, etat_connexion, expire_at, derniere_verification |
| `asset`, `asset_variant`, `asset_rights`, `asset_url`, `retention_job` | selon R25 §4.1 : sha256, storage, bucket, key, retention_class, legal_hold, purged_at ; variantes versionnées avec engine et engine_version ; droits et consentements ; `is_aigc` par variante ; URL émises hachées |
| `consent` | personne identifiable, type (image, voix, témoignage), preuve, expire_at, mineur_autorisation_parentale |
| `signal` | kind (trend, product_new, site_update, event, sermon, son), detected_at, source, url_canonique, hash, embedding, scores (pertinence, fraîcheur, tendance), pilier, urgence, risque, statut, expires_at |
| `dossier` | signal pivot, sources corroborantes, faits (champ, valeur, confiance, source, verifie_at), angle, format, fenêtre |
| `calendar_event` | origine, confiance, source, date, fenêtre, confirme_at |
| `cycle` | tenant_id, semaine, statut, échéances (porte_1_due, envoi_at, rappel_1_at, rappel_2_at, escalade_at, defaut_at), repartition_piliers, reserve_utilisee |
| `board`, `board_version`, `board_decision` | planche, versions avec diff, décisions (proposition, décision, canal, acteur, horodatage, vocal_transcrit) |
| `proposition` | cycle_id, signal_id, source_asset_id, sequence_id, pilier, framework, plateforme, format, date_prevue, statut, hook_famille, etiquette_ia_requise, faits_a_confirmer |
| `content_item` | proposition_id, texte final, hashtags, variantes par plateforme, asset_ids, juge_score, juge_version, revisions |
| `generation_job` | provider, model, version, prompt_hash, references, external_id, statut, cost_reserve, cost_real, retrieved_at, fallback_de |
| `render_job` | composition, params, version, worker, statut, duree_ms |
| `publication` | content_item_id, social_account_id, statut, scheduled_at, container_id, published_at, external_url, erreur, tentatives, voie (api, unifiee, manuel) |
| `account_metric_daily`, `media_metric_snapshot`, `metric_alias` | selon R24 §7 (grain unitaire, ajout seul, noms bruts, correspondance versionnée) |
| `tracked_link`, `link_click`, `conversion_event`, `coupon`, `coupon_redemption`, `whatsapp_inbound` | selon R24 §7 (code, kind, utm, visitor_hash salé ; event_id CAPI ; ctwa_clid ; first_reply_at) |
| `inbox_message`, `inbox_reply` | plateforme, classe, brouillon, validé_par, human_agent, envoyé_at, fenêtre_ouverte_jusqu_a |
| `boost_proposal` | publication_id, conditions remplies, budget, validation client, campagne_id, cout_par_interaction_j7 |
| `benchmark`, `monthly_report` | seuils datés par verticale et pays ; rapports figés (pdf_ref, résumé WhatsApp, payload) |
| `learning_pair`, `hook_bandit` | brouillon, correction, motif, acteur ; famille de hook, verticale, essais, récompense cumulée |
| `cost_ledger`, `tenant_budget`, `llm_call` | réservation puis réalisation en usd_micro par fournisseur ; plafonds jour, mois, par type ; traces LLM (modèle, jetons, cache lu, coût, score du juge) |
| `audit_log` | acteur (humain, agent, job), action, objet, before_hash, after_hash, ip, session_agent, at ; trigger qui interdit UPDATE et DELETE (R25 §5.4) |

### 11.5 Sécurité multi-locataires et chiffrement

RLS restrictive par table pilotée par Drizzle (`set_config('app.tenant_id', …, true)` puis `set local role app_rw` dans chaque transaction, R25 §5.1) ; préfixe S3 par client construit par une fonction unique et validé par expression régulière (R25 §5.2) ; enveloppe KEK en variable Railway du seul service worker, DEK par client, rotation annuelle de la KEK, 90 jours pour les clés fournisseurs (R25 §7.2) ; clés IA de l'agence partagées par fournisseur, projet OpenAI avec plafond dur mensuel et clés expirant à 90 jours (R25 §11.12) ; plafonds par client vérifiés avant chaque appel (église 15 $ par jour et 60 $ par mois, beauté 10 $ par jour et 120 $ par mois par défaut, R25 §7.2) ; un tenant par client, jamais de jeton partagé (R02 §12.16) ; job `tenant_offboard` avec export ZIP, suppression vérifiée, destruction de la DEK et attestation PDF (R25 §11.9).

### 11.6 Observabilité et sauvegardes

Traces LLM dans `llm_call` et coûts dans `cost_ledger` (vue par client pour la facture et la revue mensuelle, R25 §7.2) ; Langfuse auto-hébergé envisagé plus tard seulement s'il tient dans le périmètre Railway ; logs Railway ; tests hebdomadaires de santé (H9). Sauvegardes : instantanés de volume (6, 27, 89 jours), PITR dès le premier jour, `pg_dump` hebdomadaire chiffré vers le bucket du projet « machine-archives », exercice de restauration trimestriel chronométré (R25 §11.8).

---

## 12. Coûts et modèle économique

### 12.1 Coût mensuel détaillé par client type (dollars américains, prix datés des rapports)

**Église (offre dédiée : 4 sermons, 24 clips, 10 citations par sermon, dévotionnel, chapitrage, 2 annonces)**

| Poste | Calcul | Coût |
|---|---|---|
| Transcription | 4 heures × 0,21 à 0,22 $ (R05 §8.3) | 0,90 $ |
| Analyse Claude | 4 × 0,14 $ en API directe plus 4 sessions Agent SDK à 0,70 $ (R07 §7, §9.3) | 3,40 $ |
| Rendu clips | 4 lots × 0,25 à 0,40 $ (R25 §6.2) | 1,50 $ |
| Visuels citations et annonces | 48 × 0,013 $ plus vision | 1,00 $ |
| Jetons posts, juges, dévotionnel, veille LLM | panier réduit (R07 §7) | 6,00 $ |
| Veille légère et part du socle | 5 à 10 $ plus 10 $ (R06 §14) | 15 à 20 $ |
| WhatsApp et transcription des vocaux | R22 §10.16 | 1,00 $ |
| Mesure et rapport | R24 §8 | 1 à 3 $ |
| Hébergement et stockage | 14 à 18 $ plus 1,30 à 5,50 $ selon originaux ou proxys (R25 §4.4) | 15 à 24 $ |
| Publication (part de l'API unifiée) | 79 $ partagés entre 6 à 10 clients | 5 à 10 $ |
| **Total** | | **45 à 70 $** |

**Agence B2B LinkedIn (Markel-Tech : 12 posts page, 4 documents natifs, 1 vidéo Remotion, newsletter, veille sectorielle)**

| Poste | Coût |
|---|---|
| Jetons création, juges, veille LLM (R07 §7) | 8 à 11 $ |
| Carrousels et documents composés en HTML, visuels | 1 $ |
| Vidéo Remotion 90 s avec voix clonée (R04 tableau §6) | 1 $ |
| Veille standard et part du socle, X tendances (R06 §14, §6.2) | 15 à 28 $ |
| Hébergement | 14 à 18 $ |
| Publication, mesure, courriel | 3 à 6 $ |
| **Total** | **40 à 65 $** |

**Marque de beauté, palier Croissance (20 à 24 contenus : 6 Reels génératifs, 6 Reels programmés, 6 carrousels, 4 visuels, stories, boîte de réception, 1 boost proposé)**

| Poste | Calcul | Coût |
|---|---|---|
| Images | 60 visuels finaux × 0,053 $ plus 150 brouillons × 0,006 $ plus détourage 20 × 0,02 $ plus vision (tarifs fal, R03) | 5 à 6 $ |
| Reels génératifs | brouillons LTX-2.3 6 × 8 s × 0,06 $ ; production Kling 3.0 via API Higgsfield 6 × 2 plans × 8 s × 0,084 $ × 3 prises ; 1 scène signature Seedance 2.5 15 s × 0,2057 $ × 3 (R26 §5.11) | 36 à 45 $ |
| Reels programmés, voix, musique | 6 × 0,05 $ ; ElevenLabs ; Lyria 3 Pro (R04) | 2 $ |
| Jetons Claude (création, juges, veille LLM, tri de 1 000 commentaires) | 10,6 $ plus 1 à 2 $ (R07 §7, R23 §4.2) | 12 à 13 $ |
| Veille standard et part du socle | 12 à 25 $ dont LLM déjà compté, plus 10 à 20 $ (R06 §14) | 18 à 35 $ |
| WhatsApp | R22 §10.16 | 1 $ |
| Mesure | R24 §8 | 1 à 3 $ |
| Hébergement | R25 §8 | 14 à 18 $ |
| Publication (part de l'API unifiée et TikTok) | | 6 à 12 $ |
| **Total** | | **95 à 160 $** |

Le temps humain s'ajoute : 4 à 8 heures de gestionnaire par client et par mois (section 2.2), soit à Abidjan, sur la base d'un salaire de community manager entre 148 939 et 599 167 FCFA par mois (R08 §1.4), 15 000 à 60 000 FCFA par client ; au Canada, 100 à 300 CAD.

### 12.2 Tarifs, marges, seuil de rentabilité

| Client type | Prix de vente | Coût direct (USD) | Temps humain | Marge brute estimée |
|---|---|---|---|---|
| Église Abidjan | 180 000 FCFA (environ 295 $ à 610 FCFA pour un dollar, R10 §9.9) | 45 à 70 $ | 3 heures, environ 30 $ | 65 à 75 % |
| Beauté Abidjan, Croissance | 450 000 FCFA (environ 740 $) | 95 à 160 $ | 6 heures, environ 60 $ | 70 à 79 % |
| B2B Canada, Croissance | 1 800 CAD (environ 1 300 $) | 40 à 65 $ | 8 heures, environ 230 $ | 77 à 80 % |
| Beauté France, Vidéo+ | 2 400 € | 140 à 220 $ | 10 heures, environ 350 $ | 76 à 80 % |

Ces prix se situent dans les fourchettes du marché (Abidjan 300 000 à 900 000 FCFA, Montréal 500 à 3 500 CAD, Toronto 1 500 à 5 000 CAD en agence, R10 §1 ; R08 §10.4 : 600 à 1 500 CAD, 500 à 1 500 €, 150 000 à 500 000 FCFA ; église 150 à 300 $, R05 §8.18). Le pack vidéo est rentable là où les agences locales le vendent cher parce qu'elles le produisent à la main (R10 §8.12). À trois sièges, Hootsuite Professional coûte 597 $ par mois, l'équivalent de deux à trois clients tout compris (R26 §5.18).

Coûts fixes mensuels de la plateforme : socle de veille 60 à 170 $, hébergement de base 85 $, API unifiée 79 $, abonnement Claude Max de José pour Cowork, Chrome et Routines à partir de 100 $ (usage personnel, R07 §9.3), licence Remotion 0 ou 100 $ selon l'effectif : 330 à 540 $. Avec un gestionnaire à mi-temps à Abidjan (environ 350 000 FCFA, 575 $), le point mort est atteint à **trois clients** au palier Croissance ; le seuil de confort, qui amortit le temps de développement de José, se situe à **six clients**, soit le périmètre du pilote.

Paiement : Stripe au Canada (2,9 % plus 0,30 CAD), Wave Business ou CinetPay en Afrique (lien de paiement sur WhatsApp, webhook), relance automatique 3 jours avant l'échéance, suspension douce en cas de retard (plus de nouvelles propositions, mais les publications programmées partent, R10 §8.11).

---

## 13. Risques, limites et garde-fous

| Risque | Nature | Parade |
|---|---|---|
| Interdiction du pilotage navigateur de l'Unlimited Higgsfield (section 10.6 des conditions, 26 juillet 2026) et bannissement qui couperait tous les clients | juridique et opérationnel | API Higgsfield officielle ou API directes dans la plateforme ; Unlimited réservé à l'atelier manuel de José (R26 §5.10) |
| Entraînement par Higgsfield sur les références hors contrat Enterprise (section 4.4) | juridique | exclure visages de pasteurs et enfants des références, information au contrat (R26 §5.12) |
| Sorties sans auteur au sens du droit canadien, français ou OAPI | juridique | registre de provenance et de licence par média (moteur, version, prompt, références, compte, date), preuve de l'apport humain, comptes payants au nom de l'agence avec sous-licence (R08 §10.8 et §10.9) |
| Étiquetage IA obligatoire (AI Act article 50 depuis le 2 août 2026, TikTok depuis le 24 septembre 2026, Instagram 31 août 2026) | juridique et portée | drapeau `is_aigc` par variante, case native cochée à la publication, contenus émotionnels toujours réels (R11 §15.7, R08 §10.10) |
| Droits des sermons, visages de l'assemblée, enfants | juridique | fichier fourni par l'église, clause de titularité (musique de louange comprise), plans sur le prédicateur, floutage, consentement signé pour les témoignages (R05 §8.12, R08 §10.11) |
| Allégations cosmétiques (Santé Canada, règlement 655/2013, Meta 23 juillet 2026) | juridique | lexique d'allégations dans le profil de conformité, contrôle sur légende, texte incrusté et voix off avant la planche (R08 §10.12, R26 §5.15) |
| Données personnelles (RGPD, Loi 25, loi ivoirienne 2013-450, ARTCI) | juridique | page de confidentialité par client listant sous-traitants et région, évaluation avant transfert hors Québec, déclaration ARTCI à vérifier, `tenant.data_region` prévu (R25 §11.16 et §11.17, R26 §5.16) |
| Consentement aux relances (LCAP, politique WhatsApp du 23 septembre 2026) | juridique | opt-in nominatif au contrat, journal de preuve, STOP automatique, deux rappels maximum (R22 §10.10 et §10.12) |
| Dépréciations d'API (Sora 2 retirée, Imagen 4 arrêté, gpt-image-1 le 23 octobre 2026, métriques Facebook du 15 juin 2026, LinkedIn 202510 le 15 octobre 2026) | technique | interface par moteur avec repli, test hebdomadaire par fournisseur et par plateforme, `metric_alias` versionnée, diff trimestriel des pages primaires avec alerte (R01 §8.16, R24 §10.9, R26 §5.19) |
| App Review Meta jusqu'à 20 jours par décision, audit TikTok, YouTube ; puis dépendance à l'API unifiée (si elle perd une app Meta, tous les clients sont coupés, R02 tableau §6) | technique et délai | API unifiée dès le premier jour, demandes officielles lancées à J0, repli manuel de premier rang, connecteur à deux implémentations et migration vers les apps propres à 12 mois (R02 §12.1, §12.2, §12.15) |
| Quotas partagés (YouTube 100 uploads par jour par projet, Instagram 50 ou 100 par 24 heures) | technique | compteurs locaux, lissage entre clients, second projet Google au-delà de 30 clients vidéo (R02 §12.7, R26 §5.3) |
| Pannes silencieuses (jeton Instagram expiré, PubSubHubbub tombé) | opérationnel | horloge H9, état `a_reconnecter` visible, alertes (R21 §9.13) |
| Redéploiement qui coupe un job long | opérationnel | services séparés, arrêt gracieux, aucun job de plus de 30 minutes sans point de reprise, leçon du 29 septembre 2026 (R07 §8.3) |
| Contenu plat, « AI slop » (56 % des utilisateurs en voient souvent, 50 % de la génération Z ont désabonné une marque pour cela, R11 §2.1) | qualité | fiche de voix mesurable, banque d'assets réels obligatoire pour tout contenu émotionnel, juge à sept critères calibré, test de substitution, 20 % de contenus 100 % humains (R11 §15.1 à §15.3, §15.16) |
| Pénalités « gabarit » de YouTube (16 juillet 2026) et profils IA non étiquetés sur Instagram | qualité et portée | introduction originale par clip, pas de visage synthétique récurrent (R11 §15.8) |
| Valeur perçue en baisse « parce que c'est de l'IA » (30 % des agences, R08 §1.1) | commercial | vendre un gestionnaire humain outillé qui livre vite, produit de vraies vidéos et prouve les résultats ; l'IA est l'atelier, pas l'enseigne (R08 §10.1) |
| Dérapage du coût de génération (seul poste qui peut tripler la facture) | économique | plafonds par client en base vérifiés avant chaque appel, alerte à 80 %, nombre de prises par plan (R08 §10.5, R25 §7.2) |
| Client silencieux qui finit par partir | opérationnel et commercial | validation par cadre, réserve de sécurité, alerte « risque de départ » après deux semaines, revue mensuelle et à 90 jours (section 3.3, R08 §10.18) |
| Veille par scrapers (TikTok considère le scraping comme une violation) | contractuel | scrapers isolés des comptes clients, clause au contrat, bascule possible vers des sources officielles (R06 §3.3 et §16.18) |

---

## 14. Feuille de route

### 14.1 Phases

**Phase 0, préparation (semaines 1 et 2).** Toutes les demandes d'accès lancées à J0 (app Meta vérifiée Markel-Tech Inc. avec l'ensemble des permissions en une revue, projet Google Cloud et audit YouTube, app TikTok et audit Content Posting, LinkedIn Community Management, Google Business Profile, WhatsApp Business Platform avec vérification d'entreprise et deux numéros, R02 §12.2, R22 §10.2, R23 §8.2). Projet Railway « machine » créé par le CLI (Postgres, bucket `ams`, projet « machine-archives »). Schéma validé par le skill `/db` (RLS, rôles, batterie d'isolation, R25 §11.6). Contrat type en trois versions relu par un avocat de chaque pays (R08 §10.16). Six modèles WhatsApp soumis. Sortie : schéma migré avec batterie verte, numéros WhatsApp actifs, comptes de test de José connectés à l'API unifiée.

**Phase 1, noyau et pilote (semaines 3 à 10).** Tenant, cerveau de marque, intake en 30 minutes (brand kit Firecrawl, import de 50 posts par Business Discovery, R21 §9.14), veille sur flux gratuits avec scoring Haiku, cycle hebdomadaire complet avec ses horloges, planche et validation WhatsApp, production images et Remotion, chaîne sermon maison, publication via l'API unifiée avec paquet manuel, mesure de base et lien en bio maison, poste de pilotage minimal. Premier client pilote : **une église d'Abidjan** (chaîne automatisable à 85 %, produit vendable seul, R05 §8.20), suivie à deux semaines d'intervalle par SEVARTA (même chaîne sermon vers livre) et par une cliente beauté d'Abidjan sur la SIM +225 (R22 §10.16). Sortie (4 semaines de pilote, R05 §8.20, R21 §9.18) : WER mesuré sur 5 sermons, taux d'acceptation des propositions supérieur à 60 %, planche de sermon livrée avant lundi midi 4 semaines sur 4, délai dépôt vers planche sous 24 heures, zéro publication manquée.

**Phase 2, vidéo, conversation, intelligence (semaines 11 à 18).** Vidéo générative via l'API Higgsfield et les adaptateurs Gemini et fal avec modes brouillon et production, boîte de réception et mots clés, boost en trois temps, rapport mensuel PDF et WhatsApp, serveur MCP « machine-social », Routines « revue hebdomadaire » et « incident », juge calibré (100 posts notés par verticale, kappa d'au moins 0,6, R11 §15.4), réserve de sécurité et validation par cadre en production. Clients : 2IAE (admissions de janvier) et Markel-Tech (LinkedIn), puis une association culturelle de Toronto. Critères de sortie : six clients actifs, taux de validation du premier coup supérieur à 70 %, coût de génération par client sous le plafond trois mois de suite, premier rapport mensuel avec couche affaires non vide pour chaque client.

**Phase 3, apps propres et échelle (mois 5 à 9).** Migration client par client vers les apps Meta, TikTok, YouTube et LinkedIn propres au fur et à mesure des accords ; bandit sur les hooks ; médianes locales par verticale et pays ; second gestionnaire ; profil d'export par pays ; Managed Agents évalués si le conteneur agent devient un fardeau. Critères de sortie : 20 clients, 12 à 15 $ d'hébergement par client, revue à 90 jours livrée pour chaque client, procédure d'offboarding testée une fois.

### 14.2 Acheté ou construit

| Brique | Décision | Raison |
|---|---|---|
| Publication multi-plateformes | achetée (Upload-Post, Blotato pour TikTok), puis apps propres | problème résolu et bon marché, délais de revue (R01 §8.1, R02 §12.1) |
| Veille | construite sur flux gratuits plus SerpApi, Apify, Tavily | 70 % du besoin pour 0 $ (R06 §16.1) |
| Planche et validation WhatsApp | construites | aucun concurrent, objet central (R01 §8.2, R08 §10.2) |
| Génération d'images et de vidéos | achetée à l'usage (OpenAI, Higgsfield API, fal, Gemini, ElevenLabs) | moteurs qui changent tous les 3 à 5 mois (R03 §12.11) |
| Composition visuelle et vidéo programmée | construite (HTML, Remotion) | texte exact, pile identique au dépôt (R03 §12.1, R04 §8.4) |
| Chaîne sermon | construite, avec Vizard en pont le premier mois | 0,80 à 2,50 $ par sermon contre 4,44 à 8 $ (R05 §8.1 et §8.2) |
| Boîte de réception | construite sur l'API Meta | gratuite, voix du client (R23 §8.1) |
| Lien en bio, QR, raccourcisseur, rapport | construits | 1 à 3 $ contre 38 $ par client avec des outils tiers (R24 §8) |
| Orchestration | pg-boss sur le Postgres existant | zéro composant, zéro SaaS avant 30 clients (R07 §11.5) |
| Retouche humaine | Canva Teams (Brand Kit, Autofill, MCP) | partagée avec le client (R03 §12.8) |
| Sorties de secours | MCP Metricool (plan Free) et MCP Blotato | compatibilité avec un client déjà équipé (R26 §5.17) |

---

## 15. Questions ouvertes pour José

1. **Sauvegarde hors Railway.** Railway n'a ni versionnage ni verrou d'objet sur les buckets ; cette conception place la copie des originaux et les dumps dans un second projet Railway. Acceptes-tu ce niveau de protection, ou autorises-tu une exception à la contrainte d'infrastructure pour une copie de dernier recours hors Railway ? (R25 §1.3 et §11.8)
2. **Validation par cadre.** Es-tu d'accord pour que la machine publie, sans réponse du client le mardi soir, les contenus « valeur » autorisés par le cadre signé, à cadence réduite ? Ou préfères-tu qu'aucune publication ne parte sans oui explicite, au prix de semaines vides ?
3. **Cadence de la planche.** Le mercredi 10 heures (heure du client) est-il le bon jour pour tes clients d'Abidjan et de Toronto, ou faut-il un jour par verticale (lundi midi pour les églises, après le sermon) ?
4. **Effectif et licence Remotion.** Markel-Tech compte-t-il 3 personnes au plus, sous-traitants compris, et une plateforme vendue à des clients relève-t-elle d'Automators (100 $ par mois minimum) ? (R25 §10.6)
5. **Originaux de sermons.** Garder l'original 1080p (3 Go, 2,40 $ par mois par église au bout d'un an) ou un proxy 720p plus l'audio (1 Go) ? Décision à inscrire au contrat (R25 §11.5).
6. **Premier pilote.** Quelle église d'Abidjan, et sa régie peut-elle déposer le fichier (Drive, Daily, ou audio seul par WhatsApp) ? (R21 §9.6 à §9.8)
7. **Cowork après le 6 octobre 2026.** La bascule « nuage uniquement » des plans Pro et Max est-elle effective sur ton compte ? Elle ne touche pas la plateforme, mais elle change ton atelier Higgsfield personnel (R07 §10.1).
8. **Numéro WhatsApp des clients.** Les planches partent du numéro de la machine (+225 ou +1). Souhaites-tu, plus tard, que les notifications partent du numéro propre de chaque client (coexistence, qui exige un partenaire et plafonne à 20 messages par seconde) ? (R22 §10.15)
9. **Tarifs par marché.** Les paliers proposés en section 1.3 sont dans les fourchettes documentées ; les forfaits d'agence d'Abidjan n'ont pas de source primaire (R10 §9.8). Peux-tu confirmer deux ou trois prix réellement pratiqués par tes concurrents locaux ?
10. **Frontière entre ton usage personnel et le service aux clients.** La machine paie ses jetons à l'usage sur une clé Console ; ton abonnement Max reste personnel. Veux-tu que l'atelier SEVARTA (clips musicaux, Higgsfield Unlimited) soit totalement en dehors de la plateforme, ou que ses rendus y soient déposés comme assets pour la mesure ? (R07 §10.13)
