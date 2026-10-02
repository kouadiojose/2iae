# C3. L'usine média : conception de la machine social media multi-clients par la qualité de ce qu'elle produit

Conception rédigée le 2 octobre 2026 à partir des dix-sept rapports de recherche R01 à R26 (138 000 mots, sources primaires datées des 1er et 2 octobre 2026). Angle retenu : la plateforme n'est pas un planificateur de plus, c'est une usine qui fabrique, pour chaque client, des contenus que ses concurrents ne savent pas fabriquer : images au texte exact, photos produit pixel-exactes, Reels programmés, clips de sermons sous-titrés et habillés, miniatures lisibles, vidéos explicatives, le tout contrôlé en trois couches avant qu'un humain ne le voie. En cas de contradiction entre rapports, R26 prévaut ; toutes les valeurs ci-dessous respectent ses arbitrages (prix OpenAI en jetons, Opus 5.5 à 4 et 20 dollars, API Higgsfield réelle, Reels Instagram jusqu'à 15 minutes par API, 5 hashtags maximum).

Convention : prix en dollars américains hors taxes sauf mention (CAD, EUR, FCFA) ; « R03 §9 » renvoie au rapport R03, section 9.

---

## 1. Thèse en une page

**Phrase de positionnement.** « La seule machine francophone qui transforme ce que vous avez déjà (vos produits, vos sermons, vos livres, vos cours, vos événements) en contenus de qualité studio, vous les montre en images avant de les fabriquer, attend votre oui sur WhatsApp, puis produit, vérifie, publie et prouve le résultat, avec un gestionnaire humain qui signe chaque semaine. »

**Pourquoi la qualité produite est le bon champ de bataille.** Les clients perdus par José ne l'ont pas quitté faute de planificateur ; ils l'ont quitté parce que les tendances n'étaient pas suivies, les vidéos pas exploitées, les produits pas mis en avant, la communication plate (R08 §3.1 ; R11 §2 : 56 % des utilisateurs voient du « AI slop » souvent, 50 % de la génération Z a déjà bloqué une marque pour cela). Le marché 2026 est saturé d'outils qui planifient, génèrent des légendes et publient (R01 §3) ; personne ne combine fabrication vidéo réelle, texte exact dans l'image, produit pixel-exact, contrôle qualité automatique et validation client visuelle (R01 §8.1, R08 §10.2). L'usine est l'avantage défendable : ses chaînes, ses kits de référence et ses journaux de rejets s'améliorent client après client, ce qu'un abonnement Predis ou Blotato ne fera jamais.

**Les cinq choix qui rendent la machine supérieure au marché.**

1. **Deux couches pour toute image : génératif pour la scène, déterministe pour le texte.** Un titre, un prix, une date, un verset ne sortent jamais d'un modèle de diffusion ; ils sont posés par un gabarit React rendu par Playwright ou par Canva Autofill (ouvert aux plans Pro et Teams depuis le 21 septembre 2026). Exactitude typographique de 100 %, couleurs de marque mesurées au pixel (R03 §7, §12.1) ; neuf moteurs atteignent 5,0/5 en « text accuracy » sur le banc img.ly de septembre 2026, mais aucun ne garantit un code HEX ni un accent français (R03 §3, §6.2).

2. **Remotion comme cœur de la fabrication vidéo.** Chaque client devient un design system de compositions React (sous-titres mot à mot, chiffres animés, bandeaux de verset, packshot animé, zooms de tutoriel) ; les clips IA ne sont que des plans insérés. Rendu à environ 0,02 dollar la minute sur Lambda ou sur le worker Railway (R04 §4, §8.4 ; R25 §11.10). La pile de José est exactement celle de Remotion.

3. **Le vrai avant le synthétique.** Produit détouré depuis un packshot réel (Photoroom 0,02 dollar, Recraft 0,01 dollar), visages et voix réels pour tout contenu émotionnel, IA réservée aux décors, aux plans d'ambiance, aux infographies et aux animations typographiques. L'étiquette IA est une donnée calculée par la chaîne, jamais un oubli (R03 §8.2, R04 §5.2, R11 §6.3) : c'est ce qui évite la « taxe émotionnelle » des contenus étiquetés (R11 §2.2) et la pénalité « profil IA » d'Instagram du 31 août 2026.

4. **Contrôle qualité en trois couches, bloquant, avant la planche.** Couche 1 déterministe (dimensions, zones sûres, contraste, hash du logo, encodage), couche 2 vision par Claude Haiku 4.5 (OCR comparé au texte attendu, mains, visages, packaging contre packshot, lisibilité à 390 pixels ; environ 1,30 dollar pour mille images), couche 3 juge éditorial à sept critères sur 21 points, seuil 15, chaque fait vérifié contre la base (R03 §10, R11 §8, §9). Boucle de correction masquée journalisée par moteur et par client.

5. **Moteurs abstraits, kits de référence par client, tests de non-régression.** Une interface par famille (image, vidéo, voix, transcription, LLM) avec fournisseur par défaut et repli ; un kit de référence par client (packshots détourés, références Veo et Seedance, Soul ID, voix clonée consentie, Brand Kit Canva, fiche de voix versionnée) injecté automatiquement ; un jeu de 30 phrases françaises accentuées et un test hebdomadaire par fournisseur, parce qu'un moteur change tous les trois à cinq mois (Sora 2 retirée le 24 septembre 2026, gpt-image-1 arrêté le 23 octobre 2026, gpt-image-1.5 le 1er décembre 2026 ; R26 §2.2, R04 §2.1).

**Prix de vente visé.** Trois paliers par client et par mois, tout compris (planche hebdomadaire validée sur WhatsApp, production, publication, rapport mensuel, gestionnaire humain) : Abidjan 175 000 / 350 000 / 600 000 FCFA (église : 175 000 FCFA pour quatre sermons, vingt clips, dévotionnels et publication) ; Canada 900 / 1 800 / 3 000 CAD ; France 600 / 1 200 / 2 000 EUR. Cohérent avec R10 §8.12, R08 §10.4 et R05 §8.18.

**Coût par client.** Hors gestionnaire humain : 40 à 55 dollars pour une église, 100 à 160 dollars pour une marque de beauté « Vidéo », 50 à 75 dollars pour une école ou une agence B2B (section 12), dont 12 à 18 dollars d'hébergement Railway (R25 §8). Le gestionnaire humain reste le premier poste : 4 à 6 heures par client et par mois (R08 §6.3).

## 2. Les personnes

### 2.1 José (direction, architecte de l'usine)

Chaque lundi matin, un tableau à six colonnes (une par verticale) avec, par client, l'état de la semaine, les quatre indicateurs « à la page » (délai tendance vers publication, taux de nouveautés exploitées, taux de vidéos, taux de sermons réemployés ; R11 §12) et le coût de génération du mois contre le plafond contractuel. Il intervient sur trois choses : les escalades du juge (trois refus consécutifs sur un client), les boosts après validation client, la revue mensuelle (trois décisions proposées par la machine). Ses outils personnels (Claude Cowork, Claude Code, Claude in Chrome, Higgsfield Unlimited, Suno) restent un atelier d'exception hors du chemin critique (R04 §8.1, R26 §5.10). Une Routine Claude Code « revue hebdomadaire », tirée par la plateforme, lui prépare chaque vendredi un mémo par client (R07 §11.12).

### 2.2 Le gestionnaire (humain dans la boucle)

Local à Abidjan ou à Toronto. Lundi : relecture des planches brouillon (porte 1, cinq minutes par client). Mardi à jeudi : boîte de réception (commentaires classés par Haiku 4.5, validation obligatoire des critiques et sujets sensibles ; R23 §8.4, §8.5), commentaires TikTok dans l'application (pas d'API ; R23 §8.9). Vendredi : contrôle des rendus finaux (porte 3 : lecture, droits, orthographe, étiquette IA) et programmation. Premier lundi du mois : rapport. Il travaille sur une PWA à 390 pixels avec Web Push et reçoit ses alertes sur WhatsApp depuis le numéro machine (R22 §10.13). Chaque correction est enregistrée comme paire (brouillon, correction, motif) et nourrit la fiche de voix (R11 §10).

### 2.3 Le client, par verticale

| Verticale | Qui valide | Ce qu'il voit chaque semaine | Ce qu'il fait |
|---|---|---|---|
| Beauté (Abidjan ou Toronto) | la fondatrice | planche de 6 à 10 propositions sur WhatsApp ; fiche de validation d'un produit sous une heure après dépôt | dépose 6 photos par produit, répond par un tap ou un vocal, tourne 20 % de contenus humains |
| Association culturelle (Toronto, Ottawa) | le président | planche bilingue, calendrier à 6 semaines, affiches à texte exact | dépose flyers et vocaux, confirme dates et prix, fournit les photos sous 48 heures |
| Église (Abidjan, Paris) | le pasteur | planche de 8 vignettes de clips le lundi midi (capture au hook, titre, durée, verset, plateforme) | dépose le fichier de régie ou l'audio, valide les clips, relit les réponses pastorales |
| SEVARTA | José puis l'auteur | séquence de lancement en 8 étapes, audiogrammes, citations animées | fournit PDF, 4e de couverture, photo auteur, lien Amazon |
| 2IAE | la direction | planche admissions et vie de campus, carrousels, « 60 secondes pour comprendre » | fournit affiches, replays publics, consentements étudiants |
| Markel-Tech | José | documents natifs et carrousels LinkedIn (7,00 % et 6,45 % d'engagement moyen, R09 §2.1), vidéos de données | fournit études de cas et chiffres sourcés |

## 3. La routine : machine à états par client

Chaque client possède une « semaine éditoriale » qui traverse treize états. La transition est un job pg-boss avec clé de singleton `client:semaine:etat` ; aucun agent n'attend en mémoire, l'attente est un état en base (R07 §11.7).

| État | Déclencheur d'entrée | Ce qui se passe | Sortie et délai par défaut |
|---|---|---|---|
| VEILLE | horloges : tendances toutes les 2 heures, sons chaque semaine, calendrier des moments hebdomadaire à 6 semaines (R06 §16.14) ; dépôt client (priorité maximale) | collecte des flux A, B, C, scoring Haiku 4.5 en Batch, classement par pilier | items retenus, mercredi soir |
| IDEATION | fin de veille ou dépôt pivot | Opus 5.5 avec cerveau de marque en cache produit 12 à 15 idées, en séquences par déclencheur (lancement produit 5 étapes, sortie de livre 8 étapes, événement 5 étapes, admission 4 étapes ; R09 §11.15) ; vérification 60/25/15 | 10 idées, jeudi matin |
| MAQUETTAGE | idéation terminée | brouillons à bas coût : gpt-image-2.5-flare qualité low, image 0 Remotion, carrousel HTML ; QC couche 1 et 2 ; juge éditorial | planche brouillon, jeudi midi |
| PORTE_1 | planche brouillon prête | le gestionnaire relit, corrige (motif obligatoire), retire | planche v1 validée, jeudi 17 h ; sans action à J+1, alerte José |
| ENVOYEE | porte 1 franchie | modèle utilitaire WhatsApp `planche_prete` (image composite 1080 × 1350, 3 boutons) + courriel Resend + lien signé PWA | horodatage d'envoi |
| EN_ATTENTE | envoi | rappel 1 à J+2, rappel 2 à J+5 (modèle `rappel_planche`), puis escalade au gestionnaire (R22 §10.10) | validée, modifiée, refusée, ou silence |
| SANS_REPONSE | J+7 sans réponse | application de la règle contractuelle : seuls les contenus « valeur » déjà validés dans le cadre (séquence récurrente, calendrier des moments) passent en production ; tout contenu promotionnel ou nouveau attend | production partielle, journal |
| PRODUCTION | validation (totale ou partielle) | jobs de rendu par type de contenu (section 7), mode production (3 prises, 1080p), voix, musique, sous-titres | rendus dans le bucket, 24 à 48 heures |
| QC_FINAL | rendus prêts | couche 1 déterministe sur l'encodage, couche 2 vision sur une image clé par vidéo, journal de conformité (étiquette, droits, musique, verset) | pass ou retour génération (2 essais) ou file humaine |
| PORTE_3 | QC passé | le gestionnaire regarde chaque vidéo finale, coche la checklist en 13 points (R11 §13) | programmée |
| PROGRAMMEE | porte 3 | file de publication par connexion, créneaux par fuseau (Abidjan : 7 à 9 h, 13 à 15 h, 18 à 22 h GMT ; Canada : mardi à jeudi 11 à 17 h Est ; R10 §8.7), compteurs de quota (`content_publishing_limit` Instagram, 30 Reels Facebook par 24 h, 6 requêtes par minute TikTok) | publiée ou report |
| PUBLIEE | réponse API ou URL collée (repli manuel) | relevés J+2, J+7, J+30 ; Stories relevées trois fois avant 24 heures (R24 §10.8) | métriques en base |
| APPRENTISSAGE | relevé J+7 | mise à jour des dix meilleurs posts, du bandit par verticale, des paires de correction, du journal des rejets par moteur | cerveau de marque v+1 |

Quand le client ne répond pas trois semaines de suite, la machine lève l'alerte interne « risque de départ » (R08 §10.18) et le gestionnaire appelle. Quand le juge refuse trois fois le même client, une Routine « incident » est tirée vers Claude Code pour que José reçoive un diagnostic (R07 §11.12).

---

## 4. Les routines par verticale

Chaque verticale suit la machine à états de la section 3 ; ce qui change, ce sont les sources, les déclencheurs, les formats fabriqués sans intervention et les points où un humain est obligatoire.

| Verticale | Sources et déclencheurs | Formats fabriqués automatiquement | Humain obligatoire |
|---|---|---|---|
| Beauté (dépôt de produits) | dépôt WhatsApp de 6 photos par produit dont la zone INCI à plat, « en document » (R21 §6.3) ; crawl hebdomadaire de la boutique ; Business Discovery sur les concurrents ; Creative Center TikTok par Apify, un run par jour partagé, moins de 20 dollars par mois (R06 §16.4) ; calendrier (Fête des mères, Saint-Valentin, Tabaski). Un produit déposé devient item pivot à priorité maximale : fiche extraite par Haiku 4.5 (0,005 dollar), INCI vérifié contre une base de noms, packshot détouré, fiche de validation dans l'heure, planche sous 24 heures (R21 §7) | photo produit mise en scène, carrousel « 5 raisons », Reel 20 secondes packshot animé, UGC synthétique étiqueté si la cliente l'accepte, story, séquence de lancement en 5 étapes | la fondatrice à l'image pour 20 % du mix (R11 §15.16) ; relecture des allégations selon le profil de conformité : aucune allégation thérapeutique, avant/après pour 18 ans et plus seulement, aucune promesse chiffrée dans un délai, aucun message d'infériorité, produits éclaircissants exclus (politique Meta du 23 juillet 2026, R26 §2.8) |
| Association culturelle (événements régionaux, genèse) | flyers déposés (dates, lieu, prix en FCFA ou CAD extraits) ; agendas BlogTO, Ottawa Festivals, Open Data Toronto ; Google Events via SerpApi ; calendrier à trois couches (février Mois de l'histoire des Noirs, juin Franco-Fête, août Afrofest et Caribbean Carnival, septembre Francophonie en fête ; R10 §8.17). Un événement à moins de 6 semaines ouvre la séquence en 5 étapes : annonce, genèse ou coulisses, rappel, direct, récapitulatif sous 48 heures (R09 §11.16) | affiche à texte exact (scène Nano Banana 2 avec grounding Google Search pour le lieu, ou FLUX.2 [pro] ; texte en HTML), teaser 15 secondes cinématique (Kling 3.0 via l'API Higgsfield, musique Lyria 3 Pro), carrousel bilingue, QR dynamique maison pour l'imprimé (R24 §10.4), reportage monté depuis les photos réelles | dates confirmées par deux sources dont une primaire (R06 §16.13) ; photos réelles de l'événement ; autorisations d'image |
| Église (sermon YouTube) | PubSubHubbub sur la chaîne (gratuit, hors quota, réabonnement tous les 3 jours) ; fichier de régie par Google Drive partagé ou salle Daily (1,21 dollar par sermon de 90 minutes, 1080p dans le bucket) ; audio seul par WhatsApp (43 Mo pour 90 minutes) pour les églises sans régie ; jamais de téléchargement YouTube (R21 §3, §9.6 à §9.8) ; affiches par WhatsApp ; calendrier liturgique. Dimanche détection, lundi matin fichier, lundi midi planche de 8 vignettes au pasteur, clips du lundi au samedi, un par jour (R05 §8.10) | 5 clips de 30 à 60 secondes et 1 enseignement de 2 à 3 minutes (Instagram accepte 15 minutes par API, Facebook Reels 90 secondes, Shorts 3 minutes ; R26 §5.1), cartes de versets vérifiés (Segond 1910, texte en HTML, aucun visage synthétique), dévotionnel 5 jours, chapitres YouTube par `videos.update`, résumé pour le Channel WhatsApp (publication manuelle, R10 §8.1), post LinkedIn pasteur | relecture du pasteur avant publication (R05 §8.15) ; consentement pour toute personne de l'assemblée visible, aucun enfant, floutage du public (R08 §10.11) |
| SEVARTA (livres, auteurs) | formulaire (PDF, 4e de couverture, photo auteur), Firecrawl sur la page Amazon, interviews et prédications de l'auteur (même chaîne que le sermon), calendrier (Pâques, Avent, rentrée). Un livre ouvre une séquence de lancement en 8 étapes sur 6 semaines ; une prédication alimente à la fois le clip et le post de lancement (R05 §6.1) | audiogramme avec couverture, citation animée Remotion, bande-annonce 15 secondes, carrousel de 5 citations, article « 5 idées du livre », clip d'interview 30 à 45 secondes | skill sevarta-empreinte-auteur pour tout texte signé de l'auteur ; validation doctrinale ; licence de la version biblique citée (R05 §7.8) ; clips musicaux SEVARTA dans l'atelier Higgsfield de José, hors machine |
| 2IAE (admissions, campus) | affiches d'admission (dates limites, filières, frais en FCFA), replays de cours rendus publics par le campus (lecture seule des données publiques, conformément à la séparation des sessions), témoignages, Google Business Profile. Une date limite ouvre la séquence en 4 étapes ; un replay public ouvre un « 60 secondes pour comprendre » | carrousel éducatif (format prioritaire, coût quasi nul), infographie depuis des données réelles en JSON, jamais de chiffres générés par un modèle d'image (R03 §9), vidéo « vie de campus » montée depuis des tournages réels, avatar présentateur neutre et étiqueté pour les admissions (HeyGen Avatar IV ou Hedra Character-3, 0,05 dollar par seconde ; R04 §3.1), post Google Business Profile | consentement écrit des étudiants et des enseignants ; chiffres d'insertion sourcés depuis la base ; aucun mineur sans autorisation parentale (R09 §11.9) |
| Markel-Tech (LinkedIn B2B) | études de cas, captures de livrables, veille Tavily et Exa, Google Trends Canada RSS. Une étude de cas validée ouvre une séquence de 3 contenus ; une tendance sectorielle ouvre une prise de position signée José, jamais de newsjacking automatique sur un sujet politique | document natif PDF (carrousel HTML exporté ; 7,00 % d'engagement moyen LinkedIn, R09 §2.1), carrousel d'images, vidéo de données Remotion 90 secondes avec voix clonée de José, sondage, vidéo explicative de logiciel | José signe chaque post personnel ; Thought Leader Ads seulement avec son accord par courriel conservé (R23 §8.16) ; aucune automatisation de profil LinkedIn (R08 §10.14) |

## 5. La planche de propositions et la validation client

### 5.1 Contenu exact d'une planche

Une planche hebdomadaire contient 6 à 10 propositions, une carte chacune :

1. Vignette maquette : gpt-image-2.5-flare en qualité low pour une scène (prix fal d'octobre 2026 : 0,006 dollar en 1024² ; la grille officielle OpenAI est en jetons, 5 dollars par million en texte, 8 en image en entrée, 30 en image en sortie ; R26 §2.2), image 0 d'une composition Remotion pour une vidéo, première diapositive d'un carrousel. Mention « maquette » imprimée.
2. Hook de moins de 8 mots avec sa famille (question, chiffre, contradiction, avant/après, citation réelle, action incomplète ; R11 §7.1).
3. Format, plateforme, date et heure dans le fuseau du client, pilier (valeur, relation, promotion), framework (PAS, AIDA, BAB, FAB).
4. Asset réel référencé (packshot, sermon, flyer) ; un contenu sans asset réel est marqué « générique » et doit être justifié (R11 §6.1).
5. Ligne « faits à confirmer » (prix, date, nom non retrouvés en base), et « Source : URL » sous chaque fait d'événement (R11 §15.15, R06 §16.13).
6. Pour une vidéo : durée, voix (réelle, clonée, catalogue), musique, étiquette IA prévue.
7. Pour une séquence (lancement produit, sortie de livre) : la séquence entière avec ses dates, validée d'un coup (R09 §11.15).
8. Jauge 60/25/15 et nombre de vidéos de la semaine.

Coût d'une planche : 0,03 à 0,20 dollar d'images et environ 0,45 dollar de jetons (R03 §9, R07 §1).

### 5.2 Canaux

- **WhatsApp Business Platform, accès direct Cloud API sous le portefeuille Markel-Tech, sans BSP** (R22 §10.1) : un numéro ivoirien (+225) et un numéro canadien (+1) dans le même compte WhatsApp Business, entreprise vérifiée. Modèle utilitaire `planche_prete` avec en-tête image (composite 1080 × 1350 sous 5 Mo, téléversé à la génération, identifiant valable 30 jours) et trois boutons : « Valider », « Modifier », « Voir en détail ». Coût hors fenêtre : 0,0040 dollar en Côte d'Ivoire, 0,0034 au Canada, 0,030 en France (grille Meta du 1er octobre 2026 ; R22 §0). Le tap ouvre une fenêtre de 24 heures ; la plateforme envoie alors un Flow générique à deux écrans (validées, à revoir avec motif) ; 1 000 messages de service gratuits par numéro et par mois depuis le 1er octobre 2026 (R22 §0).
- **Vocal** : le vocal de la cliente est une fonctionnalité : OGG Opus téléchargé dans les 5 minutes, archivé dans le bucket (le média Meta disparaît à 7 jours), transcrit par gpt-4o-mini-transcribe (0,003 dollar la minute) ou Deepgram Nova-3, renvoyé en citation avec bouton de confirmation, puis transformé par Claude en instruction de retouche (R22 §10.9).
- **Lien magique PWA** : jeton signé à usage limité, sans compte, écran de 390 pixels, une carte par proposition, barre d'actions collante, feuille « À revoir » avec motifs cochables et vocal ; même table de validations que le Flow, pour commencer sur WhatsApp et finir sur la PWA (R22 §10.14).
- **Courriel Resend** : même lien, en repli et pour les clients canadiens et français qui préfèrent le courriel (R10 §8).

### 5.3 États, relances, versions

Planche : `brouillon` → `v1` (porte 1) → `envoyee` → `validee` | `modifiee` | `refusee` | `sans_reponse`. Deux rappels au maximum (J+2, J+5), puis bascule humaine ; au-delà, la note de qualité WhatsApp se dégrade et la politique de messagerie du 23 septembre 2026 s'applique (R22 §10.10). Une modification crée `v2` avec diff visible ; la version validée est figée (hash) et devient la référence du journal d'audit (qui, quand, par quel canal). Opt-in WhatsApp et courriel signés au contrat, journal de preuve, STOP traité automatiquement (R22 §10.12). Budget WhatsApp : environ 1 dollar par client et par mois, transcription comprise (R22 §10.16).

---

## 6. Le poste de pilotage du gestionnaire

### 6.1 Écrans

1. **Aujourd'hui** : trois files, une par porte (planches à relire, rendus à contrôler, publications à confirmer), triées par échéance ; chaque ligne s'ouvre en un écran de 390 pixels.
2. **Clients** : une carte par client avec l'état de la machine (section 3), le délai depuis la dernière réponse client, le coût de génération du mois sur le plafond, les quatre indicateurs « à la page ».
3. **Usine** : jobs pg-boss par file (veille, idéation, rédaction, planche, juge, vision, rendu, publication, métrique), dead letter visible, journal des rejets par moteur (pourquoi gpt-image-2.5 a échoué sur ce packaging, pourquoi Veo a refusé ce storyboard), coût par asset.
4. **Veille** : items scorés par client, sources, « risque » (sujets politiques et religieux controversés sortis du newsjacking automatique ; R06 §16.16), bouton « proposer maintenant ».
5. **Boîte de réception** : commentaires et messages Meta classés en six classes par Haiku 4.5 (question, achat, spam, critique, sensible, compliment), brouillons de réponse dans la voix du client, validation obligatoire et étiquette HUMAN_AGENT journalisée ; file « commentaires TikTok à traiter dans l'application » (R23 §8).
6. **Mesure** : relevés quotidiens, rapport mensuel en préparation, boosts proposés (détection à 24 heures, deux conditions sur trois au-dessus de 1,5 fois la médiane ; R23 §8.10).
7. **Conformité** : registre des consentements d'image, des licences par média (moteur, version, prompt, compte, plan, date), des étiquettes IA, des versions bibliques, exportable en PDF (R11 §15.17).

### 6.2 Alertes WhatsApp (numéro machine, modèle `alerte_gestionnaire`)

Planche non relue à J+1 ; client sans réponse à J+5 ; juge en triple refus ; rendu en file humaine ; jeton à reconnecter (rafraîchissement Meta à J-5, alerte à J-10 ; R02 §12.9) ; budget de génération à 80 % du plafond (R25 §11.12) ; tendance « chaude » pertinente pour un client ; publicité Click-to-WhatsApp sans réponse après 2 heures (R23 §8.17) ; test hebdomadaire de fournisseur en échec.

### 6.3 Actions en un clic

Approuver la planche ; corriger une carte avec motif (liste fermée : voix, fait faux, hook faible, trop long, interdit lexical, mauvais pilier, visuel) ; relancer un rendu avec le moteur de repli ; approuver un rendu ; publier maintenant ; coller l'URL d'une publication manuelle (paquet prêt à publier) ; proposer un boost au client ; reconnecter un compte ; marquer un item de veille « proposer ».

### 6.4 Indicateurs « à la page » affichés en permanence

Délai médian tendance vers publication (cible moins de 72 heures pour une nouveauté, 48 heures pour un événement), taux de nouveautés exploitées sous 14 jours (cible 100 %), taux de vidéos (40 à 60 % selon la verticale), taux de sermons réemployés sous 7 jours (100 %), taux d'ancrage réel (80 % et plus), taux de passage du juge, taux d'acceptation des planches sans modification majeure (70 % et plus), écart au mix 60/25/15 (moins de 10 points), taux d'étiquetage conforme (100 %) ; formules SQL dans R24 §5.

---

## 7. L'usine de production

### 7.1 Principes communs à toutes les chaînes

- **Interface unique par famille de moteur** (`soumettre`, `interroger`, `récupérer`, webhooks) avec adaptateurs OpenAI (Responses API, pour l'entrée image en cache à 2 dollars par million au lieu de 8 ; R26 §3.8), Gemini (Nano Banana 2 et Pro, Veo 3.1, Omni Flash, Lyria 3, Chirp), fal.ai (FLUX.2, Seedream, Kling, LTX-2.3, Sync, Bria, Topaz, Recraft), Higgsfield API (Seedance 2.5, Kling 3.0, Soul 2, Popcorn, Cinema Studio), ElevenLabs, AssemblyAI, Deepgram. Chaque rendu stocke moteur, version, prompt, références, paramètres, coût réel lu dans `usage`, compte et plan (preuve de licence ; R08 §10.8).
- **Mode brouillon et mode production** : brouillon pour la planche (qualité low, 480p, une prise), production après validation (high, 1080p, trois prises par plan) ; coût de ce qui n'est pas validé divisé par 5 à 10 (R04 §8.3).
- **Kit de référence par client**, injecté automatiquement : packshots détourés (6 angles), logo vectoriel, Brand Kit Canva, 3 références Veo, jusqu'à 50 références Seedance via Higgsfield (visages de pasteurs et enfants exclus, clause d'entraînement 4.4 ; R26 §5.12), Soul ID pour un personnage récurrent (R04 §1.2), voix clonée consentie, fiche de voix, profil de conformité.
- **Profil d'export par marché** : « Afrique mobile » 720p vertical sous 10 Mo, premières 2 secondes sans logo (R10 §8.6) ; « Canada » 1080 × 1920 à 8 Mbps ; toujours MP4 sans edit lists, moov en tête, H.264 progressif GOP fermé 4:2:0, AAC 48 kHz 128 kbps, 23 à 60 images par seconde (R26 §5.2).
- **Étiquette IA calculée** : `etiquette_ia_requise` vrai si la chaîne a produit un visage, une voix, un décor réaliste ou un produit photoréaliste synthétique ; faux pour motion design, captures et vidéos réelles. À la publication : `is_ai_generated` sur Instagram (API du 22 juin 2026), curseur TikTok, divulgation YouTube, mention en légende ; C2PA et SynthID conservés (R03 §12.13, R04 §8.7).

### 7.2 Les chaînes, type par type

**Post texte et légende.** Opus 5.5 avec cerveau de marque en cache (TTL 1 heure, 4 000 à 12 000 jetons ; R07 §11.3), sortie structurée (texte, hook, CTA, 3 à 5 hashtags dont un local, plafond dur à 5 ; R26 §5.13), environ 0,02 dollar par post avec cache (R07 §1), entrée majorée de 30 % pour le tokenizer des modèles 4.7 et suivants (R26 §3.5). QC : juge à sept critères sur Sonnet 5.5 (contre-notation gpt-4o-mini sur 10 % ; R11 §15.4), faits vérifiés contre la base, test de substitution. Repli : deux régénérations avec les règles violées, puis file humaine.

**Carrousel.** Plan JSON par Opus 5.5 (hook, 5 à 7 points, CTA), gabarit React par client, rendu Playwright en 1080 × 1350 (10 diapositives maximum par API Instagram ; R02 §12.6), couverture optionnelle gpt-image-2.5-flare medium (prix fal 0,0133 dollar), export PDF pour le document natif LinkedIn. Coût : 0 à 0,05 dollar (R03 §7.5). QC couche 1 : contraste WCAG, police d'au moins 40 pixels sur 1080, mots par diapositive, couleurs au pixel.

**Visuel avec texte (affiche, citation, annonce).** Scène par Nano Banana 2 1K à 0,067 dollar (grounding Google Search pour un lieu réel), FLUX.2 [pro] à 0,03 dollar le mégapixel ou fond abstrait FLUX.2 klein à 0,014 dollar ; texte, logo et aplats posés en HTML par Playwright ou par Canva Autofill sur un brand template (60 requêtes par minute, PNG sans perte). Coût : 0,03 à 0,07 dollar (R03 §9). QC : OCR par vision comparé caractère par caractère au JSON (accents, FCFA, dates), pseudo-lettres dans la scène, zones sûres. Repli : Seedream 5.0 Pro (0,0675 dollar, 2e du banc img.ly, lent) puis gpt-image-2.5-flare high ; FLUX 3 Image et son layout par boîtes en observation (R03 §12.17).

**Photo produit mise en scène.** Jamais de packaging synthétisé : packshot réel détouré (Photoroom 0,02 dollar, Bria RMBG 2.0 0,018 dollar sur fal, Recraft 0,01 dollar), fond généré (FLUX.2 [pro] ou gpt-image-2.5-flare high, prix fal 0,053 dollar, avec 3 références), harmonisation de lumière et de grain, composition HTML ; variante : édition gpt-image-2.5-sunburst avec le packshot parmi 16 références et consigne « packaging identique ». Coût : 0,05 à 0,10 dollar (R03 §6.3, §9). QC : comparaison vision du rendu au packshot (logo, nom, couleur, étiquette), anatomie des mains, profil de conformité beauté sur le texte incrusté. Repli : édition masquée sunburst sur la zone fautive (2 essais), FLUX.2, file humaine. LoRA FLUX.2 (8 dollars pour 1 000 pas) seulement pour un produit généré des centaines de fois (R03 §12.15).

**Reel génératif (teaser, ambiance, produit animé).** Storyboard de 2 à 3 images (Popcorn via Higgsfield ou Nano Banana 2, environ 0,20 dollar), puis image-to-video : Veo 3.1 Fast à 0,10 dollar par seconde en 720p avec audio natif pour les Reels produit (personnes limitées à `allow_adult`, 8 secondes imposées avec références), Kling 3.0 à 0,084 dollar par seconde via l'API Higgsfield (1,26 dollar les 15 secondes) pour les scènes avec personnages, LTX-2.3 à 0,06 dollar par seconde pour les brouillons, Seedance 2.5 à 0,2057 dollar par seconde (3,09 dollars les 15 secondes, 4 à 30 secondes d'une seule génération, jusqu'à 50 références) pour les scènes signature (R26 §5.11, R04 §2.1). Trois prises par plan en production, assemblage Remotion (texte, logo, CTA, sous-titres), voix clonée ElevenLabs v3 (0,08 dollar par 1 000 caractères ; v4 à 0,022 dollar en promotion jusqu'au 12 octobre 2026), musique (plus bas). Coût : Reel produit de 20 secondes 5 à 6,50 dollars ; teaser événement 15 secondes 6 à 14 dollars (R04 §6). QC : vision sur trois images clés, étiquette IA toujours vraie, filtres de contenu testés par verticale avant signature (R04 §8.16). Repli : Veo refuse, puis Kling, puis Wan 3.0 Prime (à partir de 0,068 dollar par seconde chez Higgsfield), puis file humaine ; l'Unlimited de José reste un atelier manuel hors machine (R26 §5.10).

**Reel programmé Remotion (citation, chiffres, annonce, calendrier, packshot animé).** Composition React par client (tokens du Brand Kit, polices, logo, transitions), données JSON validées, rendu sur le worker Railway (4 vCPU, 8 Go, serverless, environ 13 dollars par mois pour 2 heures par jour ; R25 §11.10) ou Remotion Lambda (0,017 à 0,021 dollar la minute, lot de 5 clips d'une minute pour environ 0,10 dollar). Licence gratuite jusqu'à 3 personnes, sinon Automators à 0,01 dollar par rendu avec minimum 100 dollars par mois (R04 §4 ; section 15). Coût : 0,05 à 0,50 dollar. QC : couche 1 complète (texte exact par construction, encodage, durée), vision sur l'image clé. Repli : Claude Design HTML vers MP4 pour les citations premium, Canva export MP4 pour les stories.

**Clip de sermon (église, auteur SEVARTA, enseignant 2IAE).** Ingestion (Drive, Daily ou audio WhatsApp), extraction audio ffmpeg, transcription avec mots horodatés par AssemblyAI Universal-3.5 Pro (0,21 dollar l'heure) ou Deepgram Nova-3 (0,31 dollar l'heure, `language=fr` forcé : la détection automatique donne 40 à 50 % de WER sur du français africain), ElevenLabs Scribe v2 (0,22 dollar) en second avis (R05 §3.2, §8.3). Structure et candidats par Haiku 4.5, choix, bornes au mot près, titres, hooks, versets et dérivés par Opus 5.5 avec transcription en cache (environ 0,45 dollar en deux étages, majoré de 30 % ; R05 §4). Cinq types de moments (phrase-choc, illustration, application du passage, contre-courant, appel), exclusion des annonces et de la quête, interdiction de couper un verset. Recadrage 9:16 par « cameraman virtuel » MediaPipe (détection toutes les 5 images, trajectoire lissée, plan fixe en plan large), sous-titres mot à mot ASS rendus par libass en un passage ffmpeg, mots-clés surlignés, habillage Remotion (bandeau verset, logo, introduction originale de 2 secondes par clip pour échapper au critère « gabarit » de YouTube du 16 juillet 2026 ; R11 §15.8), six variantes de durée (TikTok 15 à 30 secondes, Reels 30 à 45, Shorts 45 à 58, Facebook 45 à 75, enseignement 2 à 3 minutes). Aucune génération, aucun label IA, voix et visage réels. Coût : 0,80 à 2,50 dollars par sermon pour 8 clips, 15 à 35 minutes de machine (R05 §4). QC : verset vérifié contre la Segond 1910 locale, sous-titres relus par le juge (noms ivoiriens, termes religieux), vision sur l'image du hook, durée et encodage par plateforme. Repli de démarrage : API Vizard (600 minutes pour 14,50 dollars par mois en annuel) ou Klap (0,44 dollar par traitement, 0,32 par short, 0,48 par export) pour les clips bruts, le temps que la chaîne maison dépasse leur qualité sur le banc de 5 sermons (R05 §8.2).

**UGC synthétique (avis cliente, présentateur).** Portrait Soul 2 via Higgsfield (à partir de 0,0032 dollar) ou Nano Banana 2, script Opus 5.5, voix ElevenLabs, animation OmniHuman 1.5 (0,12 dollar par seconde chez BytePlus) ou HeyGen Avatar IV (0,05 dollar par seconde), sous-titres ASS, label IA obligatoire. Coût : 1,70 à 3,80 dollars pour 30 secondes (R04 §6). Jamais le visage d'une personne réelle sans consentement écrit et label (R04 §8.6) ; option proposée au client, jamais imposée ; en verticales de confiance, avatar neutre pour l'utilitaire seulement. QC : synchronisation labiale sur image clé, étiquette, conformité. Repli : Hedra Character-3 (0,05 dollar par seconde 720p), puis UGC humain commandé au client.

**Story.** gpt-image-2.5-flare 1024 × 1536 medium (prix fal environ 0,02 dollar) ou Nano Banana 2, texte HTML hors des zones d'interface (haut 250 pixels, bas 340 pixels), export MP4 Remotion ou Canva ; 60 secondes et 100 Mo maximum sur Instagram. Coût : 0,02 à 0,05 dollar (R03 §9). Statistiques relevées trois fois avant 24 heures (R24 §10.8).

**Miniature YouTube.** Portrait réel détouré (Photoroom 0,02 dollar), fond Nano Banana 2 à 0,067 dollar (SynthID conservé), titre de 3 à 5 mots en HTML, skill youtube-thumbnail existant. Coût : 0,07 à 0,10 dollar. QC : lisibilité à 168 × 94 pixels par vision, visage non déformé (R03 §9).

**Vidéo explicative de logiciel.** Enregistrement d'écran fourni ou capturé par Playwright (parcours scripté), zooms, curseur animé, surlignages et chapitres en Remotion, voix clonée, sous-titres ASS. Coût : 0,15 à 0,40 dollar pour 60 à 90 secondes (R04 §6). QC : chaque étape du script retrouvée sur une image clé par vision.

**Voix.** Une voix par client : clonage professionnel ElevenLabs (plan Creator à 22 dollars par mois) de la fondatrice, du pasteur ou de José avec consentement écrit, seule façon d'obtenir un accent ouest-africain crédible (R04 §3.2). Réglages : stabilité 30 à 40 %, similarité 75 à 80 %, style 15 à 25 %, modèle v3 pour la narration, deux ou trois pauses explicites par script de 60 secondes (R11 §11.2). Repli : OpenAI gpt-4o-mini-tts (environ 0,015 dollar la minute), Google Chirp 3 HD (fr-FR, fr-CA).

**Musique.** Bibliothèque native (TikTok, Reels, Instagram Audio API du 1er juin 2026) pour l'organique ; ElevenLabs Music à 0,15 dollar la minute ou Lyria 3 Pro à 0,08 dollar le morceau pour les vidéos hors plateforme et les planches ; Epidemic Sound (API, sous-licence, sur devis) pour les églises sur YouTube et la publicité. Suno reste l'atelier manuel de José (pas d'API publique, plan Pro ou Premier pour l'usage commercial, métadonnées à conserver), jamais automatisé (R04 §3.3, §8.12, R08 §10.9).

### 7.3 Tableau récapitulatif

| Type de contenu | Moteurs et versions (octobre 2026) | Coût unitaire | QC spécifique | Repli |
|---|---|---|---|---|
| Post texte | Opus 5.5 (4 / 20 dollars, cache 0,20) | 0,02 dollar | juge 7 critères, faits en base, 5 hashtags | 2 régénérations, humain |
| Carrousel | Opus 5.5, React, Playwright ; cover gpt-image-2.5-flare | 0 à 0,05 dollar | contraste, police 40 px, couleurs au pixel | aucun moteur génératif requis |
| Visuel avec texte | Nano Banana 2 (0,067) ou FLUX.2 [pro] (0,03/MP), texte HTML ou Canva Autofill | 0,03 à 0,07 dollar | OCR comparé au JSON, pseudo-lettres, zones sûres | Seedream 5.0 Pro, gpt-image-2.5 high |
| Photo produit | Photoroom (0,02), FLUX.2 ou gpt-image-2.5 high, composition HTML, sunburst en édition | 0,05 à 0,10 dollar | packaging contre packshot, mains, conformité beauté | édition masquée, FLUX.2, humain |
| Reel génératif | Veo 3.1 Fast (0,10 $/s), Kling 3.0 Higgsfield (0,084 $/s), Seedance 2.5 (0,2057 $/s), LTX-2.3 brouillon (0,06 $/s), Remotion, ElevenLabs | 5 à 14 dollars | 3 images clés, étiquette IA, filtres testés | Veo, puis Kling, puis Wan 3.0 Prime, puis humain |
| Reel programmé | Remotion (Lambda 0,02 $/min ou worker Railway) | 0,05 à 0,50 dollar | encodage, durée, image clé | Claude Design, Canva MP4 |
| Clip de sermon | AssemblyAI 3.5 Pro (0,21 $/h) ou Deepgram Nova-3 fr (0,31 $/h), Haiku 4.5 et Opus 5.5, MediaPipe, ffmpeg libass, Remotion | 0,80 à 2,50 dollars par sermon | verset Segond 1910, sous-titres relus, hook visible, durée par plateforme | Vizard ou Klap pour les clips bruts |
| UGC synthétique | Soul 2 ou Nano Banana 2, ElevenLabs, OmniHuman 1.5 (0,12 $/s) ou HeyGen IV (0,05 $/s) | 1,70 à 3,80 dollars | synchro labiale, étiquette, consentement | Hedra, UGC humain |
| Story | gpt-image-2.5-flare medium ou Nano Banana 2, texte HTML | 0,02 à 0,05 dollar | zones sûres, 60 s, 100 Mo | FLUX.2 |
| Miniature YouTube | Photoroom, Nano Banana 2, titre HTML | 0,07 à 0,10 dollar | lisibilité à 168 × 94 px | FLUX.2 [pro] |
| Vidéo explicative | Playwright, Remotion, voix clonée | 0,15 à 0,40 dollar | étapes contre images clés | aucun |
| Voix | ElevenLabs v3 clonée (0,08 $/1 000 caractères) | 0,07 dollar par 60 s | script relu | gpt-4o-mini-tts, Chirp 3 HD |
| Musique | bibliothèque native ; ElevenLabs Music (0,15 $/min) ; Lyria 3 Pro (0,08 $) ; Epidemic | 0 à 0,15 dollar | licence enregistrée par média | catalogue licencié |

### 7.4 Contrôle qualité en trois couches, en détail

**Couche 1, déterministe, 0 dollar.** Dimensions et ratio par plateforme ; poids ; encodage (ffprobe) ; logo par hash perceptuel ; couleurs de marque par échantillonnage des aplats ; zones sûres ; contraste WCAG du texte HTML ; durée par plateforme (Facebook Reels 90 secondes, Shorts 3 minutes, Instagram 15 minutes, Story 60 secondes) ; 3 à 5 hashtags ; métadonnées C2PA conservées.

**Couche 2, vision Claude Haiku 4.5, 0,005 à 0,02 dollar par image.** Images redimensionnées à 1 000 pixels (1 296 jetons, environ 1,30 dollar pour mille images), zoom à pleine résolution sur les zones de texte (le modèle se trompe sous 200 pixels ; R11 §9.1). Prompt structuré : logo de référence, packshot de référence, rendu, texte attendu ; sortie JSON (texte lu, écarts, logo conforme, produit conforme, anomalies anatomiques, chevauchement des zones d'interface, lisibilité à 390 pixels). Jamais « est-ce que ça a l'air IA » : Claude ne détecte pas les images synthétiques.

**Couche 3, juge éditorial et boucle de correction.** Rubrique à sept critères sur 21 points (spécificité, originalité, voix, hook, appel à l'action, ancrage réel, conformité), seuil 15 avec au moins 2 sur spécificité, voix et conformité ; calibration le premier mois sur 100 posts notés par José par verticale, kappa de Cohen d'au moins 0,6 par critère, 40 contre-exemples qui doivent sortir en « retour génération » ; juge figé (modèle, version de rubrique, hash du prompt), recalibré chaque mois ; ordre des entrées aléatoire contre le biais de position (R11 §8). Pour un défaut visuel localisé : édition masquée (gpt-image-2.5-sunburst, Nano Banana 2, FLUX.2), deux tentatives, moteur suivant, file humaine ; chaque rejet journalisé avec moteur, prompt et cause (R03 §10).

**Anti-slop et voix de marque.** Fiche de voix par client générée depuis 15 textes validés : règles mécaniques vérifiables en 10 secondes, lexique signature de 40 tournures, interdits lexicaux français construits par statistique sur 500 brouillons contre le corpus validé, exemples avant/après tirés des corrections du gestionnaire, dix meilleurs posts en few-shot tournant chaque mois ; test de discrimination en aveugle par deux relecteurs avant mise en service ; registre par marché (nouchi autorisé pour la beauté grand public ivoirienne, français standard pour SEVARTA et 2IAE institutionnel ; R11 §5, §15.14, R10 §8.8). Pas de fine-tuning : fiche de voix plus RAG des faits (R11 §5.5).

**Tests permanents.** 30 phrases françaises accentuées (« Rentrée 2026 : inscrivez-vous dès aujourd'hui ! ») générées sur chaque moteur à chaque changement de version et notées par OCR (R03 §10) ; 5 sermons de référence (Abidjan, Paris, Montréal) avec WER par moteur (R05 §8.3) ; prompts « culte », « prière », « baptême », « enfants », « peau » sur Veo, Kling, Seedance (R04 §7.15) ; un test hebdomadaire par fournisseur qui échoue bruyamment ; vingt générations gpt-image-2.5 par qualité avec lecture de `usage` pour fixer le coût réel par image (R26 §5.7).

## 8. La veille et l'intelligence

Trois flux, trois horloges, un scoring (R01 §8.4, R06 §16).

**Flux A, le client lui-même.** Crawl maison hebdomadaire du site (sitemap, flux WordPress ou Shopify), dépôt de nouveautés dans la plateforme (prioritaire sur le crawl), flux Atom YouTube et PubSubHubbub des chaînes, Business Discovery sur ses propres comptes, changedetection.io hébergé sur Railway pour les pages dynamiques (moins de 15 dollars d'hébergement pour 5 000 URL).

**Flux B, domaine et région.** Google Trends « Trending Now » RSS par pays (CI, CA, FR, gratuit, testé), Google News RSS par requête localisée, GDELT DOC 2.0 (gratuit, rafraîchi toutes les 15 minutes), Abidjan.net, Fratmat, Yeclo, Pulse CI, BlogTO, Ottawa Festivals, L-Express en RSS, API Nager et canada-holidays pour les jours fériés, journées mondiales ONU, SerpApi (Starter 25 dollars par mois) réservé à Google Trends explore, Google Events par ville et Google News structuré. Jamais pytrends (archivé, 429 depuis les IP cloud).

**Flux C, formats et tendances.** Un run Apify par jour du Creative Center TikTok pour les trois pays, partagé entre clients (moins de 20 dollars par mois), sons et hashtags datés pour mesurer la vitesse de montée ; comptes de référence par verticale lus par un agent (Tavily 1 000 crédits gratuits, Exa pour les concurrents) ; 30 hashtags Instagram par 7 jours par compte (10 de marque, 10 de niche, 10 exploratoires).

**Fréquences et horloges.** Tendances : cycle de 2 heures, durée de vie 48 heures. Sons : hebdomadaire, durée de vie 3 semaines. Événements et calendrier : hebdomadaire, horizon 6 semaines, revérification 48 heures avant, « moments » générés 8 semaines à l'avance ; calendrier à trois couches (fêtes fixes, fêtes lunaires avec fenêtre de plus ou moins deux jours confirmée la veille, événements vivants).

**Scoring.** Haiku 4.5 en Batch avec profil client stable en cache : pertinence pour le client, fraîcheur, pilier (valeur, relation, promotion), format suggéré, risque (politique, religieux controversé : hors newsjacking automatique pour églises, SEVARTA, 2IAE). Refus d'une semaine éditoriale où la veille ne fournit pas 60 % d'items « valeur ».

**Vérification des faits.** Règle des deux sources dont une primaire pour toute date et tout lieu ; « Source : URL » sous chaque fait de la planche ; faits non retrouvés surlignés « à confirmer ».

**Mesure de la veille.** Pour chaque item : proposé, accepté, publié, performance ; après 90 jours, coupure des sources sans item accepté. Plan B par configuration (bascule vers SerpApi ou Apify sans redéploiement) pour chaque flux gratuit non contractuel.

**Coût.** 12 à 25 dollars par client et par mois, dont plus de la moitié en jetons de scoring (sous 5 dollars avec Batch et cache), plus un socle partagé de 100 à 160 dollars par mois (SerpApi, Apify, Firecrawl Hobby 16 dollars, changedetection.io) (R06 §1.10, §16.12).

---

## 9. L'architecture agentique

### 9.1 Principe : appels structurés pour 80 % du volume, agents pour le reste

Le cœur (veille, idéation, rédaction, planche, juge, vision, extraction) est fait d'appels à l'API Messages avec outils, sorties structurées, cache et Batch, orchestrés par pg-boss ; les tâches ouvertes (sermon qui exige d'écouter plusieurs passages, audit du site d'un client, lot de scripts avec vérification) passent par le Claude Agent SDK TypeScript dans un conteneur Railway, avec `SessionStore` Postgres, `maxBudgetUsd` par job (2 dollars par sermon), profondeur de sous-agents à 1, hook `PreToolUse` avec `defer` pour toute action irréversible (R07 §11.1, §11.8). Facteur 4 à 15 sur les jetons entre agent et appel direct, sans gain pour une tâche bien spécifiée.

### 9.2 Modèles Claude par tâche (grille officielle lue le 2 octobre 2026, R26 §2.3)

| Tâche | Modèle | Prix par million (entrée / sortie, lecture de cache) | Mode |
|---|---|---|---|
| Scoring de veille, classification des dépôts, tri des commentaires, vision QC, extraction de flyers | Haiku 4.5 | 1 / 5, cache 0,10 | Batch quand rien n'attend |
| Extraction INCI et PDF, synthèses, rapport mensuel, juge éditorial (famille différente du générateur, contre-notation gpt-4o-mini sur 10 %) | Sonnet 5.5 | 2 / 10, cache 0,20 | Batch pour le rapport |
| Idéation, calendrier, rédaction, hooks, sélection de clips, dérivés de sermon | Opus 5.5 | 4 / 20, cache 0,20 (0,05x), écriture 1 h 8, Batch 2 / 10 | cache 1 heure sur le cerveau de marque |
| Agent SDK (sermon complexe, audit de site) | Sonnet 5.5 | 2 / 10 | sessions à budget plafonné |
| Orchestration de la revue mensuelle, incident complexe | Fable 5.1 | 10 / 50, cache 0,25 | sessions longues seulement, jamais les légendes (R26 §5.8) |

Règles : jamais de changement de modèle en cours de conversation (cache par modèle) ; entrées majorées de 30 % pour le tokenizer ; `stop_reason === "refusal"` testé ; budgets par client dans `cost_ledger`, alerte à 15 dollars de jetons par mois (R07 §11.17).

### 9.3 Cerveau de marque et mémoire

Un document par client, 4 000 à 12 000 jetons, en tête de prompt derrière `cache_control` TTL 1 heure : fiche de voix, doctrine encodée comme contrat (deux plateformes, 60/25/15 vérifié, frameworks, hooks, 3 à 5 hashtags, interdits), profil de conformité, identifiants du kit de référence, dix meilleurs posts avec métriques, paires de correction récentes, faits de base. Les faits volumineux vivent dans un index récupérable (RAG), pas dans le prompt (R11 §5.5). Un cerveau de 10 000 jetons relu 500 fois coûte environ 1 dollar au lieu de 20 (R07 §11.3).

### 9.4 Juge, garde-fous et conformité codée

Juge décrit en section 7.4. Garde-fous par verticale dans le cerveau et dans le juge : allégations cosmétiques, citations bibliques vérifiées par outil, consentement d'image par visage, chiffres 2IAE issus de la base, étiquette IA calculée. Plafonds : prises par plan, budget de génération par client, boost jamais automatique (R23 §8.10).

### 9.5 Place exacte de chaque surface Anthropic et des outils de José

- **API Messages (clé de la plateforme, paiement à l'usage)** : tout le cœur, isolée de l'abonnement Max de José (interdiction documentée d'offrir la connexion claude.ai dans un produit tiers ; R07 §11.17).
- **Claude Agent SDK dans un conteneur Railway** : tâches ouvertes à budget plafonné.
- **Serveur MCP distant « machine-social » exposé par la plateforme** (spécification 2025-06-18, OAuth 2.1, PKCE), dix outils au départ : `list_pending_briefs`, `get_brand_brain`, `get_assets`, `submit_render`, `submit_board`, `approve`, `reject`, `request_higgsfield_job`, `report_metrics`, `log_decision` (R07 §11.9). C'est la seule interface que Cowork, Claude Code, les Routines et Managed Agents parlent tous.
- **Claude Cowork et Claude Code** : la plateforme ne les « déclenche » pas (aucune API d'entrée publique pour Cowork ; R07 §11.10) ; elle dépose des ordres de production (JSON : client, brief, formats, moteurs, délais) que Cowork ou Claude Code viennent chercher via le MCP, par tâche planifiée ou à la demande de José, et déposent les rendus par `submit_render`. Usage typique : lot de compositions Remotion pour un nouveau client, page de campagne, correctifs de gabarits.
- **Routines Claude Code** : pont d'entrée tiré par la plateforme (`POST /v1/claude_code/routines/{id}/fire`, 30 par heure et par routine, 100 par heure et par compte, 65 536 caractères) ; routine « revue hebdomadaire » le vendredi, routine « incident » au triple refus ; prompts écrits pour agir sur le bloc `routine-fire-payload` (R07 §11.12). Aperçu de recherche, sans idempotence : jamais sur le chemin critique.
- **Claude in Chrome** : outil personnel de José, hors machine. Le pilotage navigateur de l'Unlimited Higgsfield est interdit par la section 10.6 des conditions du 26 juillet 2026 et par le centre d'aide du 28 août 2026 (R26 §2.4) ; le skill production-video-higgsfield reste un atelier manuel pour les clips SEVARTA.
- **Higgsfield API** (open.higgsfield.ai, lancée le 16 septembre 2026, paiement à la génération, section 11.12 autorisant explicitement l'accès par agent et MCP) : adaptateur pour Kling 3.0, Seedance 2.5, Wan 3.0 Prime, Cinema Studio 4.0, Soul 2, Popcorn ; sorties copiées dans le bucket sous 7 jours ; clause 4.4 d'entraînement signalée au contrat, visages de pasteurs et enfants exclus des références (R26 §5.11, §5.12).
- **Canva MCP et Connect API** : Brand Kit et 10 à 20 brand templates par client, Autofill (Pro ou Teams depuis le 21 septembre 2026), retouches du gestionnaire et du client dans Canva plutôt que dans le code (R03 §12.8).
- **Observabilité** : Langfuse auto-hébergé sur Railway (ou Core à 29 dollars), traces par `client_id`, `job_id`, `content_type`, `usage`, score du juge (R07 §11.16).

## 10. Publication, mesure et apprentissage

### 10.1 Couche de publication : trajectoire

Interface « connecteur » unique (publier, lire, statistiques) avec deux implémentations (R02 §12.1).

- **Mois 1 à 6 : Blotato Starter** (29 dollars par mois, 1 250 crédits, 20 comptes, API et MCP mcp.blotato.com/mcp, jusqu'à 900 publications TikTok par mois, audit TikTok porté par Blotato, paramètres `isAiGenerated` et Trial Reels ; R26 §2.10, §5.14) pour TikTok et pour démarrer vite, en parallèle de l'app Meta propre pour Facebook, Instagram et Threads dès que l'App Review est obtenue (jusqu'à 20 jours par décision, vérification d'entreprise Markel-Tech Inc. ; R02 §2.1).
- **Dès le jour 1, demandes officielles lancées** : app Meta (publication, commentaires, messagerie, Business Discovery, `ads_management`, HUMAN_AGENT, en une seule revue avec vidéo), projet Google Cloud audité YouTube (quota d'upload séparé de 100 appels par jour depuis le 1er juin 2026), app TikTok à l'audit Content Posting (avant audit : 5 utilisateurs par 24 heures en SELF_ONLY), app LinkedIn Community Management (version mensuelle en paramètre), Google Business Profile (R02 §12.2, §12.17, R26 §2.7).
- **Mois 6 à 12 : migration client par client vers les apps propres** ; Blotato en repli ; MCP Metricool (inclus même en plan Free) pour un client déjà équipé (R26 §5.17).
- **WhatsApp** : messagerie oui, publication non (aucune API Channels ni Status) : paquet prêt à publier, adaptateur isolé pour le jour où Meta livrera la programmation des Channels (R10 §8.1, §8.20). **X** : réservé à Markel-Tech, 0,015 dollar par post, budget plafonné (R02 §12.13).

### 10.2 Contraintes par plateforme encodées dans le planificateur

Instagram : Reels de 3 secondes à 15 minutes et 300 Mo, encodage strict ; images JPEG 8 Mo, ratio 4:5 à 1,91:1 ; carrousel 10 éléments ; Story 60 secondes et 100 Mo ; lecture de `content_publishing_limit` avant chaque envoi (50 ou 100 selon la page Meta, 50 par prudence) ; `is_ai_generated` ; Trial Reels par API pour les clips de sermon et les lancements ; Audio API ; 5 hashtags maximum ; médias servis par URL présignée Railway de 48 heures sur une copie `pub/` ; jeton long de 60 jours rafraîchi à J-5 (R26 §2.1, §5, R25 §11.3). Facebook Pages : Reels de 3 à 90 secondes, 30 par 24 heures, programmation de 10 minutes à 30 jours, Resumable Upload, métriques « unique » retirées le 15 juin 2026 (R02 §2.2, R24 §1). TikTok : avant audit, 5 utilisateurs en privé ; 6 requêtes par minute par jeton, environ 15 publications par créateur et par jour ; interface stricte (confidentialité sans valeur par défaut, aperçu, divulgation commerciale) ; FILE_UPLOAD par défaut, car PULL_FROM_URL exige un domaine vérifié sans redirection ; aucun commentaire par API (R26 §2.7, R25 §1.4, R23 §1). YouTube : 100 uploads par jour par projet, lissés ; Shorts de moins de 3 minutes ; chapitres par `videos.update` ; divulgation « altered or synthetic » ; monétisation refusée au contenu « gabarit » (R02 §12.7, R11 §3). LinkedIn : Community Management API, documents natifs et multi-images, pas de boost organique hors Thought Leader Ads (R02 §1, R23 §8.16). WhatsApp Channels et Status : geste humain préparé.

File de publication par connexion avec compteurs locaux et reprise (report au lieu d'échec), test automatique hebdomadaire sur un compte de test, créneaux par fuseau, dimanche interdit par défaut sauf directs d'église (R09 §11.5).

### 10.3 Repli manuel comme fonctionnalité de premier rang

« Paquet prêt à publier » : médias au bon format, légende, hashtags, heure, cases à cocher, lien profond ; le gestionnaire colle l'URL publiée et la machine mesure ensuite (R02 §12.15). Couvre WhatsApp Channels, Snapchat, la période avant les audits, les carrousels de 11 à 20 diapositives, et tout refus d'API.

### 10.4 Mesure en trois couches

- **Couche 1, indicateurs avancés** : vues, portée, envois par portée, enregistrements par portée, rétention à 3 secondes, visionnage complet, partages ; pas d'impressions (dépréciées) ; relevés quotidiens stockés chez soi en ajout seul, car Instagram efface à 2 ans, les Stories à 24 heures, Facebook limite à 90 jours par requête, LinkedIn à 12 mois (R24 §1, §10.7). Shorts de sermons mesurés avec `creatorContentType=SHORTS` et `insightTrafficSourceType` (R24 §10.11).
- **Couche 2, croissance** : abonnés nets, visites de profil, clics, comparés au seuil de la verticale (0,12 % est bon en beauté, 0,73 % moyen pour une école, 5,20 % moyenne LinkedIn ; R09 §11.1), puis à la médiane locale après trois mois.
- **Couche 3, affaires** : liens traçables générés par la machine (UTM par contenu et par support, page lien en bio maison, QR dynamiques maison), Pixel et Conversions API posés chez le client avec consentement, événements GA4 (`generate_lead`, `begin_application`, `submit_application` à demander à la session du site pour www.2iae.com), `ctwa_clid` et objet `referral` WhatsApp, coupons lisibles à voix haute pour Abidjan, commandes WhatsApp, dons et présences saisis par l'église (R24 §10). Budget : 1 à 3 dollars par client et par mois, inclus dans le prix.

### 10.5 Rapport mensuel et boucle d'apprentissage

Rapport d'une page en trois couches, couche affaires en haut, PDF léger et résumé WhatsApp de cinq lignes avec les trois meilleures publications en vignette, le premier lundi du mois après le 3 (mois clos au 3), avant 9 heures heure du client ; indicateurs « à la page » ; alerte « sous la médiane » seulement deux mois de suite ; trois décisions proposées ; revue à 90 jours avec avant/après (R24 §10.12, §10.14, R08 §10.18). Boucle : dix meilleurs posts en few-shot, paires de correction, motifs de refus devenant règles après validation de José, bandit Thompson au niveau de la verticale (récompense envois plus enregistrements par portée, 20 % d'exploration, probabilités affichées au gestionnaire, jamais de décision automatique ; R11 §7.2), journal des rejets par moteur, effet de l'étiquette IA mesuré par compte sur 90 jours (R04 §8.8).

## 11. Architecture technique et modèle de données

### 11.1 Services Railway

Projet « machine » séparé du projet « Groupe 2iae », région EU West Amsterdam, bucket `ams`, la plus proche d'Abidjan (R25 §11.1).

| Service | Rôle | À 6 clients (R25 §8) |
|---|---|---|
| `web` | API Express, React Vite, PWA gestionnaire, écran de validation client, serveur MCP distant, webhooks (WhatsApp, Meta, PubSubHubbub, Drive, Higgsfield, Veo, Blotato) qui mettent en file sans traiter | 0,5 vCPU, 1 Go, environ 20 dollars |
| `postgres` | une base, RLS forcée | 0,25 vCPU, 1 Go, 5 Go, environ 16 dollars |
| `worker` | pg-boss, appels Claude, veille, extraction, juge, vision, publication, métriques ; clés IA en variables de ce seul service | 0,5 vCPU, 2 Go, environ 30 dollars |
| `agent` | Claude Agent SDK, `SessionStore` Postgres, budgets par job ; séparé du rendu | selon usage |
| `render` | ffmpeg, libass, MediaPipe, Playwright, Remotion CPU ; serverless | 4 vCPU, 8 Go, 2 heures par jour, environ 13 dollars |
| `tick` | cron Railway toutes les 5 minutes, sortie en moins d'une minute : échéances, relances, réabonnements PubSubHubbub, tirs de Routines | négligeable |
| `changedetection`, `langfuse` | pages dynamiques ; traces LLM | moins de 15 dollars ; 0 à 29 dollars |

Buckets Railway : `originaux` (rétention au contrat : original 1080p ou proxy 720p), `rendus` (purgés à 90 jours par un job `retention_purge` maison, Railway n'ayant ni cycle de vie ni versionnage), `pub` (copies servies par URL présignée de 48 heures, purgées à 7 jours), `kits` (références par client). Bucket Cloudflare R2 avec domaine propre pour la copie des originaux (verrou 90 jours) et les URL publiques stables (R25 §11.2 à §11.4). Sauvegardes : instantanés de volume, PITR activé dès le premier jour, `pg_dump` hebdomadaire chiffré vers R2, restauration trimestrielle chronométrée (R25 §11.8).

### 11.2 Postgres : tables principales et colonnes clés

Schéma validé avec le skill agents-base-donnees (/db) et le Railway CLI avant la première ligne de code ; UUIDv7 ; `tenant_id` non nul partout ; rôles `migrator`, `app_rw` (FORCE ROW LEVEL SECURITY, sans BYPASSRLS), `app_ro`, `backup` ; variable `app.tenant_id` posée par Drizzle dans chaque transaction ; batterie d'isolation à chaque migration (R25 §9, §11.6).

| Table | Colonnes clés |
|---|---|
| `tenant` | verticale, pays, fuseau_client, fuseau_public, registre (standard, parlé, bilingue), devise, data_region, palier, plafond_generation_usd, regle_sans_reponse |
| `brand_brain` | version, fiche_voix (jsonb), doctrine (plateformes, mix 60/25/15, frameworks, interdits), profil_conformite, brand_kit (hex, polices, logo, canva_brand_kit_id), meilleurs_posts, paires_correction, hash |
| `source_asset` | kind (packshot, sermon, flyer, video_brute, temoignage, livre, cours), storage (bucket, clé, r2_clé), sha256, metadata extraite (jsonb), transcription_id, consent_ids[], licence, expires_at, purged_at |
| `reference_kit` | packshots_detoures[], refs_veo[], refs_seedance[], soul_id, voice_id, version |
| `consent` | personne, type (image, voix, temoignage), source, texte, horodatage, preuve_asset_id, expire_le |
| `signal` | flux (A, B, C), kind (product_new, site_update, event, trend, sound, moment), detected_at, sources[] avec drapeau primaire, score, pilier, risque, duree_vie, statut |
| `sequence` | type (lancement, livre, evenement, admission), signal_id, etapes (jsonb), statut |
| `content_item` | semaine_id, sequence_id, signal_id, format, plateforme, pilier, framework, hook, hook_famille, texte, hashtags[], asset_ids[], source_asset_id, etiquette_ia_requise, generique, faits (jsonb avec verifie), juge_score, juge_rubrique_version, statut |
| `board`, `board_item`, `approval` | semaine, version, composite_asset_id, meta_media_id, envoyee_at, rappel1_at, rappel2_at, hash_valide ; décision par carte (valide, modifie, refuse), motif, vocal_asset_id, transcription ; canal, jeton, acteur, horodatage |
| `render_job` | content_item_id, type, engine, engine_version, mode (brouillon, production), prompt, params, refs[], prises, cost_usd, usage, provider_job_id, output_asset_id, statut, repli_de |
| `qc_result` | render_job_id, couche (1, 2, 3), verdict, details, modele, rubrique_version, prompt_hash, tentative |
| `publication` | content_item_id, connecteur (meta_app, blotato, youtube, linkedin, manuel), connexion_id, platform_post_id, url, scheduled_at, published_at, status, ai_label_pose, quota_lu |
| `connexion` | plateforme, compte_id, jeton_chiffre (AES-256-GCM, DEK par client enveloppée par une KEK en variable Railway), expire_le, rafraichi_le, etat (ok, a_reconnecter), scopes[] |
| `metric_snapshot` | publication_id, metric_name, metric_alias, metric_version, value, as_of, source ; ajout seul (R24 §10.9) |
| `tracked_link`, `conversion_event` | support (bio, story, qr, whatsapp), slug, utm, clics ; kind (lead, inscription, commande, don, presence), source (ga4, capi, whatsapp, coupon, saisie), valeur |
| `inbox_message` | plateforme, kind, classe (6 classes), brouillon, statut, humain_agent, repondu_par |
| `cost_ledger`, `licence_registry`, `engine_registry` | jour, poste, montant_usd, plafond ; moteur, version, prompt, compte, plan, date, droits, c2pa_present ; famille, nom, defaut, repli_de, dernier_test_ok, cout_unitaire_mesure |
| `benchmark`, `audit_log`, `tarifs_whatsapp` | verticale, pays, metric, seuil, as_of, source ; acteur, action, objet, avant, apres (ajout seul) ; marche, categorie, prix, date_effet |

Files pg-boss : `veille`, `ideation`, `redaction`, `planche`, `juge`, `vision`, `rendu_image`, `rendu_video`, `transcription`, `publication`, `metrique`, `inbox`, `retention_purge`, `tenant_offboard` ; clés de singleton `client:type:date`, retries avec backoff, dead letter visible dans l'écran Usine (R07 §11.5).

### 11.3 Sécurité, multi-locataires, observabilité

Un tenant par client, jamais de jeton partagé ; préfixe S3 par client ; Postgres joignable seulement par `railway.internal` ; clés IA de l'agence en variables du seul service `worker`, projet OpenAI avec plafond mensuel dur et clés expirant à 90 jours, plafonds par client et par jour dans `cost_ledger` vérifiés avant chaque appel (fal, ElevenLabs et Gemini ne plafonnent pas par clé) ; limite de dépense Railway à 1,5 fois la facture attendue ; fin de contrat outillée (`tenant_offboard` : export ZIP avec manifeste, suppression vérifiée, suppression de la DEK, attestation PDF) ; page de confidentialité par client listant sous-traitants et région ; `tenant.data_region` et `asset.storage` dès la première migration (R25 §11). Traces Langfuse ; test hebdomadaire de collecte qui échoue sur « invalid metric » (R24 §10.20) ; contrôle trimestriel des pages primaires de prix et de conditions avec diff et alerte WhatsApp (R26 §5.19).

### 11.4 Coûts d'hébergement

85 à 110 dollars par mois à 6 clients, 230 à 290 dollars à 20 clients, soit 12 à 18 dollars par client ; stockage sous 2 % du chiffre d'affaires ; hors génération, jetons et licence Remotion (R25 §8).

## 12. Coûts et modèle économique

### 12.1 Coût mensuel par client type (hors gestionnaire humain, prix d'octobre 2026)

**Église d'Abidjan, palier Sermon** (4 sermons, 20 clips, 4 enseignements longs, 20 cartes de versets, dévotionnels, miniatures, publication sur quatre réseaux, résumé WhatsApp).

| Poste | Calcul | Montant |
|---|---|---|
| Réception Daily (régie en salle Daily) | 4 × 1,21 | 4,84 dollars |
| Transcription Deepgram Nova-3 fr | 4 × 1,5 h × 0,31 | 1,86 dollar |
| Analyse Haiku 4.5 et Opus 5.5 avec cache, +30 % tokenizer | 4 × 0,60 | 2,40 dollars |
| Habillage Remotion Lambda, cartes, miniatures, QC vision et juge, rédaction des dérivés | 0,40 + 0,40 + 0,40 + 0,60 | 1,80 dollar |
| Veille, WhatsApp, publication (part Blotato puis apps propres), mesure | 12 + 1 + 5 + 2 | 20 dollars |
| Hébergement Railway, bucket, R2 (162 Go au 12e mois) | | 16 dollars |
| **Total** | | **47 dollars** (40 à 55) |

**Marque de beauté d'Abidjan, palier Vidéo+** (12 Reels dont 6 génératifs, 8 carrousels, 4 photos produit, 2 UGC synthétiques, 4 stories).

| Poste | Calcul | Montant |
|---|---|---|
| Reels génératifs (Veo 3.1 Fast ou Kling 3.0, 3 prises, Remotion, voix) | 6 × 5,75 | 34,50 dollars |
| Reels Remotion, UGC, photos produit, carrousels, stories, brouillons de planche | 2,40 + 5,50 + 0,55 + 0,40 + 0,24 | 9,10 dollars |
| Voix clonée (part du plan ElevenLabs Creator) et musique | | 7 dollars |
| Prises écartées et corrections masquées | 20 % des rendus | 9 dollars |
| QC vision et juge, rédaction, idéation, extraction de fiches | 0,60 + 6 | 6,60 dollars |
| Veille, WhatsApp (dépôts, planches, Flows, vocaux), publication, mesure | 18 + 1,50 + 7 | 26,50 dollars |
| Hébergement (moins de 30 Go) | | 15 dollars |
| **Total** | | **108 dollars** (100 à 160 selon le nombre de prises et de clips Seedance) |

**École ou agence B2B au Canada, palier Croissance** (8 carrousels ou documents natifs, 4 vidéos de données Remotion, 2 avatars présentateurs, 1 vidéo explicative, 6 posts).

| Poste | Montant |
|---|---|
| Carrousels, infographies, posts, vidéos Remotion et explicative (voix clonée de José) | 4 dollars |
| Avatars HeyGen Avatar IV (2 × 60 s × 0,05) | 6 dollars |
| QC, juge, extraction, idéation et rédaction (Opus 5.5 avec cache) | 7 dollars |
| Veille (Tavily, Exa, SerpApi, agendas), courriel et WhatsApp | 16 dollars |
| Publication (LinkedIn, Instagram, Google Business Profile ; X optionnel plafonné) et mesure (GA4, Pixel, liens, QR) | 11 dollars |
| Hébergement | 14 dollars |
| **Total** | **58 dollars** (50 à 75) |

Gestionnaire humain dans tous les cas : 4 à 6 heures par client et par mois, soit 160 à 300 CAD à Toronto, 20 000 à 45 000 FCFA à Abidjan pour un salaire de 250 000 à 350 000 FCFA (R08 §6.3).

### 12.2 Tarifs de vente par marché

| Palier | Contenu | Abidjan (FCFA) | Canada (CAD) | France (EUR) |
|---|---|---|---|---|
| Présence | 12 visuels, 4 vidéos programmées, 2 plateformes, planche hebdomadaire, rapport | 175 000 | 900 | 600 |
| Croissance | 16 contenus dont 8 vidéos (4 génératives), boîte de réception, boost supervisé | 350 000 | 1 800 | 1 200 |
| Vidéo+ | 24 contenus dont 12 vidéos, UGC, séquences de lancement, e-commerce WhatsApp | 600 000 | 3 000 | 2 000 |
| Sermon (église) | 4 sermons, 20 clips, enseignements longs, dévotionnels, publication, résumé WhatsApp | 175 000 | 600 | 450 |
| Logiciel seul | plateforme, planches et usine, sans gestionnaire | 75 000 | 350 | 250 |

Facturation : Stripe au Canada (2,9 % + 0,30 CAD, abonnement) ; Wave Business ou CinetPay à Abidjan (lien de paiement sur WhatsApp, webhook), relance utilitaire 3 jours avant l'échéance, suspension douce après retard (plus de nouvelles propositions, les publications programmées partent ; R10 §8.11). Jamais vendu comme « de l'IA » : un gestionnaire humain outillé qui livre plus vite, plus de vidéos, et prouve les résultats (R08 §10.1).

### 12.3 Marge et seuil de rentabilité

Coûts fixes mensuels de la plateforme : hébergement de base 85 dollars, socle de veille 120 dollars (SerpApi, Apify, Firecrawl, changedetection), Blotato 29 dollars, ElevenLabs Creator 22 dollars, Canva Teams (environ 21 dollars par siège), AssemblyAI et Deepgram à l'usage, licence Remotion 0 ou 100 dollars (selon effectif), Langfuse 0, abonnement Max de José (outil personnel, hors plateforme) ; total 300 à 400 dollars. Gestionnaire local à Abidjan : 350 000 FCFA (environ 575 dollars à 610 FCFA par dollar), capable de suivre 10 à 12 clients à 5 heures chacun.

Contribution par client (prix moins coût variable) : église Abidjan 175 000 FCFA (287 dollars) moins 47 = 240 dollars ; beauté Vidéo+ Abidjan 600 000 FCFA (984 dollars) moins 108 = 876 dollars ; école Croissance Canada 1 800 CAD (environ 1 300 dollars) moins 58 = 1 240 dollars ; Présence Canada 900 CAD (650 dollars) moins 50 = 600 dollars. Marge brute après gestionnaire : supérieure à 60 % au Canada, supérieure à 50 % à Abidjan tant que la vidéo générative reste plafonnée (R08 §6.3).

Seuil de rentabilité (fixes 400 dollars plus gestionnaire 575 dollars = 975 dollars) : 4 églises d'Abidjan, ou 2 clients Présence au Canada, ou 1 client Vidéo+ et 1 église. Avec le portefeuille cible de la phase 2 (3 églises, 2 beauté, 2IAE, SEVARTA, Markel-Tech, 1 association de Toronto), le chiffre d'affaires mensuel approche 5 000 dollars pour environ 1 600 dollars de coûts totaux. Deux garde-fous : la vidéo générative est le seul poste capable de tripler la facture (1 à 4 dollars par prise supplémentaire), donc nombre de prises par plan plafonné, budget par client et alerte à 80 % ; et le temps du gestionnaire est le premier coût, donc tout ce qui réduit la relecture (planche propre, validation en un tap, publication automatisée) augmente directement la marge.

---

## 13. Risques, limites et garde-fous

### 13.1 Juridiques

- **Droits sur les sorties IA** (pas d'auteur sur une image brute au Canada, en France ni dans l'OAPI ; usage commercial seulement sur plans payants). Parade : registre de provenance et de licence par média, jamais de palier gratuit pour un contenu publié, apport humain documenté, sous-licence au client (R08 §10.8, §10.9).
- **Clause d'entraînement Higgsfield 4.4.** Parade : information au contrat, visages de pasteurs, enfants et packshots sensibles exclus des références, contrat Enterprise si le volume le justifie (R26 §5.12).
- **Étiquetage IA** (AI Act article 50 depuis le 2 août 2026, jusqu'à 15 millions d'euros ou 3 % du CA ; TikTok, Meta, YouTube). Parade : `etiquette_ia_requise` calculée et posée à la publication, journal de conformité exportable, icône du Code of Practice pour les clients qui diffusent vers l'UE, avis juridique (R04 §5.2, R11 §14.9).
- **Droit à l'image et deepfakes.** Parade : registre de consentements relié à chaque visage, blocage automatique sans autorisation, autorisation parentale pour tout mineur, aucun lipsync ni avatar d'une personne réelle sans consentement écrit et label (R09 §11.9, R04 §8.6).
- **Allégations cosmétiques** (Santé Canada, règlement 655/2013, Meta du 23 juillet 2026). Parade : profil de conformité lu par le générateur et le juge, capture datée de la politique à chaque campagne (R26 §5.15).
- **Versions bibliques.** Parade : Segond 1910 par défaut, API.Bible Pro (29 dollars par mois) ou licence éditeur pour les autres (R05 §7.8).
- **Données personnelles** (PIPEDA, Loi 25 jusqu'à 2 % du CA mondial ou 10 millions de dollars, RGPD, loi ivoirienne 2013-450). Parade : Amsterdam documenté, page de confidentialité par client, évaluation avant transfert hors Québec, déclaration ARTCI à vérifier, José responsable de la protection des renseignements, offboarding outillé (R26 §5.16, R25 §11.9).
- **Consentement aux messages** (CASL jusqu'à 10 millions de dollars par violation ; politique WhatsApp du 23 septembre 2026). Parade : opt-in nominatif au contrat, journal de preuve, STOP automatique, deux rappels maximum, webhook `message_template_category_update` (R22 §10.5, §10.12).
- **Source YouTube et scraping.** Parade : jamais de yt-dlp, clause de titularité des droits incluant la musique de louange, scrapers isolés des comptes de publication (R21 §9.6, R06 §16.18).

### 13.2 Techniques

- **Dépréciations** (gpt-image-1 le 23 octobre 2026, gpt-image-1.5 le 1er décembre 2026, Sora 2, Imagen 4, Hailuo 2.3, MiniMax Music, versions LinkedIn, métriques Facebook du 15 juin 2026). Parade : abstraction par famille, `engine_registry`, aucun nom de modèle en dur, `metric_alias` versionnée, tests hebdomadaires, contrôle trimestriel des pages primaires (R01 §8.16, R24 §10.9, R26 §5.19).
- **App Reviews et audits** (Meta jusqu'à 20 jours par cycle, YouTube et TikTok des semaines). Parade : demandes le jour 1, Blotato en pont, 5 comptes TikTok de test, repli manuel (R02 §12.1, R26 §5.14).
- **Pannes silencieuses** (jetons Instagram à 60 jours, bail PubSubHubbub à 5 jours, Drive à 7 jours). Parade : rafraîchissement à J-5, réabonnement tous les 3 jours, état `a_reconnecter`, alerte WhatsApp (R21 §9.13).
- **Quotas** (Instagram 50 ou 100 par 24 heures, Facebook Reels 30, TikTok 6 par minute, YouTube 100 uploads par projet). Parade : compteurs locaux, lecture de `content_publishing_limit`, lissage, second projet Google au-delà de 30 clients vidéo (R02 §12.7, §12.8).
- **Buckets Railway** sans bucket public ni cycle de vie ni versionnage. Parade : URL présignées, `retention_purge`, copie R2 verrouillée, trois couches de sauvegarde (R25 §11.3, §11.8).
- **Latences et concurrence vidéo** (Veo jusqu'à 6 minutes, Higgsfield limité en requêtes concurrentes). Parade : lots de nuit heure d'Abidjan, webhooks, files par fournisseur, copie des sorties avant expiration (R04 §8.15).
- **Transcription du français ivoirien et faux positifs des filtres.** Parade : `language=fr` forcé, banc de 5 sermons, second moteur, tests par verticale, bascule automatique (R05 §8.3, R04 §8.16).
- **Dépense non plafonnée.** Parade : limite Railway à 1,5 fois, `cost_ledger` avant chaque appel, plafond dur OpenAI, alertes à 80 % (R25 §11.12).

### 13.3 Qualité

- **Contenu plat** (YouTube démonétise le « gabarit » depuis le 16 juillet 2026). Parade : ancrage par `asset_ids`, test de substitution, juge calibré, fiche de voix testée en aveugle, introduction originale par clip, 20 % de contenus 100 % humains (R11 §15).
- **Texte faux, mains, logos, packaging.** Parade : deux couches, OCR comparé, produit réel détouré, boucle de correction masquée, 30 phrases françaises (R03 §10, §12.6).
- **Taxe émotionnelle des étiquettes IA.** Parade : humain réel là où l'émotion porte le message (R11 §2.2).
- **Juge biaisé.** Parade : ordre aléatoire, rubrique neutre en longueur, contre-notation d'une autre famille, contre-exemples, contrat figé (R11 §8.1).
- **Clip de sermon hors contexte.** Parade : relecture du pasteur, verset jamais coupé, annonces exclues (R05 §8.15).

### 13.4 Opérationnels

- **Client silencieux ou dépôts médiocres.** Parade : règle contractuelle « sans réponse », deux rappels puis humain, refus poli des photos de moins de 1 000 pixels, accusé de réception conversationnel (R21 §9.4, §9.10).
- **Transfert de 5 Go depuis Abidjan.** Parade : salle Daily ou audio seul par WhatsApp (R21 §9.7, §9.8).
- **Gestionnaire submergé.** Parade : planche propre, validation en un tap, publication automatisée, 10 à 12 clients par gestionnaire.
- **Dépendance à José** (compte claude.ai, Routines). Parade : Routines hors chemin critique, clé API de plateforme, tout ce qui tourne la nuit tourne sur Railway (R07 §11.17).
- **Risque de départ client.** Parade : alerte interne, rituel mensuel et à 90 jours, couche affaires en haut du rapport (R08 §10.18).
- **Confusion avec le campus 2IAE.** Parade : projet Railway séparé, lecture seule des données publiques, aucune action sur le service `campus`.

## 14. Feuille de route

**Phase 0, préparation (6 au 24 octobre 2026, 3 semaines).** Demandes d'accès déposées (app Meta avec vidéo de démonstration couvrant publication, commentaires, messagerie, Business Discovery, `ads_management`, HUMAN_AGENT ; projet Google Cloud et audit YouTube ; app TikTok ; LinkedIn Community Management ; Google Business Profile ; vérification Markel-Tech Inc. ; WhatsApp Business Platform avec deux numéros et six modèles utilitaires) ; schéma Postgres validé par /db avec le Railway CLI ; comptes payants par moteur (OpenAI projet plafonné, Gemini, fal, Higgsfield API, ElevenLabs Creator, AssemblyAI, Deepgram, Blotato Starter, SerpApi Starter, Firecrawl, Canva Teams) ; bancs d'essai : 30 phrases françaises sur gpt-image-2.5-flare, Nano Banana 2, FLUX.2 [pro] et Seedream 5.0 Pro ; 5 sermons avec WER par moteur ; prompts « culte », « enfants », « peau » sur Veo, Kling, Seedance ; vingt générations gpt-image-2.5 par qualité avec lecture de `usage` ; retrait de gpt-image-1 et 1.5 de tout code existant ; éligibilité Remotion vérifiée. Sortie : schéma en production avec RLS testée, moteur par défaut et repli choisis par type, demandes déposées, coût réel par image mesuré.

**Phase 1, usine image et sermon, pilote église et SEVARTA (27 octobre au 12 décembre 2026, 7 semaines).** Intake WhatsApp (classification, extraction, accusé de réception), brand kit en deux passes, fiche de voix v1 et juge calibré sur 100 posts par verticale, composition HTML Playwright et Canva Autofill, carrousels, visuels à texte exact, photos produit, chaîne sermon complète, planche WhatsApp avec modèle, Flow et PWA, publication via Blotato et app Meta propre si obtenue, mesure quotidienne, rapport mensuel v1. Pilote : une église d'Abidjan (1 sermon par semaine) et SEVARTA (lancement d'un livre), critères de R05 §8.20. Sortie : 4 sermons traités de bout en bout, délai médian dépôt vers planche inférieur à 24 heures, taux de passage du juge supérieur à 70 %, planches acceptées sans modification majeure à 70 %, coût par sermon inférieur à 3 dollars.

**Phase 2, usine vidéo et pilote beauté (15 décembre 2026 au 13 février 2027, 8 semaines).** Adaptateurs vidéo (Gemini Veo 3.1 Fast et Lite, Higgsfield API Kling 3.0 et Seedance 2.5, fal LTX-2.3), mode brouillon et production, compositions Remotion par client, voix clonées consenties, musique à trois niveaux, UGC synthétique optionnel, stories, miniatures, profils d'export par marché, boucle de correction masquée, boîte de réception Meta si App Review obtenue, indicateurs « à la page », rapport v2 avec couche affaires. Pilote : une marque de beauté d'Abidjan, 2IAE (admissions), Markel-Tech (LinkedIn). Sortie : 12 Reels par mois pour la cliente beauté sous 110 dollars de génération, 100 % des nouveautés exploitées sous 14 jours, taux de vidéos de 50 %, étiquetage conforme à 100 %, zéro texte faux sur 100 contrôles.

**Phase 3, intégration agentique, 10 clients (16 février au 17 avril 2027, 9 semaines).** Serveur MCP distant (dix outils), Routines « revue hebdomadaire » et « incident », worker Agent SDK, Cowork et Claude Code branchés sur le MCP, boost supervisé par la Marketing API, publicités Click-to-WhatsApp, association culturelle de Toronto, migration des premiers clients vers les apps propres, audit TikTok propre déposé, GA4 pour 2IAE, bandit par verticale en lecture seule, benchmarks locaux. Sortie : 10 clients actifs, un gestionnaire à Abidjan en charge, marge brute supérieure à 50 % par client, planches acceptées à 75 %, aucune panne silencieuse de jeton sur 60 jours.

**Phase 4, industrialisation (à partir de mai 2027).** 20 clients, second gestionnaire (Toronto), régions de données optionnelles, Managed Agents évalués si l'exploitation du conteneur agent pèse, FLUX 3 Image évalué pour les affiches, sorties de secours Metricool et Blotato exposées, palier « logiciel seul ».

**Acheté ou construit.** Acheté : publication de pont (Blotato), veille (SerpApi, Apify, Firecrawl, Tavily, Exa), transcription (AssemblyAI, Deepgram, Scribe), voix (ElevenLabs), génération (OpenAI, Gemini, fal, Higgsfield API), avatars (HeyGen, OmniHuman, Hedra), détourage (Photoroom, Bria, Recraft), mise en page partagée (Canva Teams), musique licenciée (Epidemic si exigée), observabilité (Langfuse), clips bruts de démarrage (Vizard ou Klap). Construit : composition deux couches, compositions Remotion, chaîne sermon française, QC trois couches et juge, cerveau de marque et kits de référence, planche et validation WhatsApp, poste de pilotage, boîte de réception, mesure et rapport, serveur MCP, abstraction des moteurs et tests. Jamais : Postiz ou Mixpost en plus, ManyChat ou Agorapulse, Linktree, AgencyAnalytics, outils d'église anglophones, Midjourney, pytrends, pilotage navigateur de l'Unlimited.

## 15. Questions ouvertes pour José

1. **Effectif et licence Remotion.** Markel-Tech et SEVARTA comptent-ils 3 personnes ou moins, contractuels compris, et une plateforme qui vend des rendus automatisés est-elle un usage « interne » pour Remotion ? Réponse à obtenir avant la phase 2 ; sinon, provisionner 100 dollars par mois (R04 §7.10).
2. **Higgsfield.** Accepte-t-on la clause d'entraînement 4.4 pour les packshots des clientes, négocie-t-on un contrat Enterprise, ou réserve-t-on l'API aux scènes sans référence sensible ? Garde-t-il l'Unlimited (99 à 129 dollars par mois) comme atelier personnel ?
3. **Voix clonées.** José accepte-t-il que sa voix devienne celle de Markel-Tech, de 2IAE et de SEVARTA ? Quels pasteurs et fondatrices signeront un consentement ? Sans cela, aucune voix « d'Abidjan » crédible n'existe (R04 §3.2).
4. **Avatars et UGC synthétiques.** Proposés à la cliente beauté, jamais aux églises, ou nulle part la première année ?
5. **Version biblique.** Segond 1910 seule, ou licence Semeur ou Segond 21 pour les églises et SEVARTA qui les utilisent ?
6. **Source des sermons.** Les églises pilotes acceptent-elles une salle Daily branchée sur leur régie, ou part-on de l'audio seul par WhatsApp ? Débit montant réel à mesurer avec chaque régie (R21 §8.5). Garde-t-on l'original 1080p ou un proxy 720p (R25 §11.5) ?
7. **Région d'hébergement.** Amsterdam pour tous, ou une région Canada ou Côte d'Ivoire exigée par un client dès 2027 ?
8. **Gestionnaire.** Recrutement à Abidjan dès la phase 1 (350 000 FCFA, 10 à 12 clients) ou José tient le rôle jusqu'à 6 clients ? Le seuil de rentabilité en dépend.
9. **Tarifs.** Les paliers de la section 12.2 sont des hypothèses ; aucune enquête indépendante n'existe pour Abidjan. Quel prix la première église et la première cliente beauté acceptent-elles ?
10. **TikTok.** Démarrer via Blotato (29 dollars, audit porté) ou attendre l'audit de notre app ?
11. **Règle « sans réponse ».** Quelle part du calendrier le client pré-autorise-t-il au contrat pour être publiée sans validation hebdomadaire ?
12. **GA4 sur www.2iae.com.** La session du site accepte-t-elle d'ajouter `generate_lead`, `begin_application` et `submit_application` ? Sans eux, la couche affaires de 2IAE repose sur les liens traçables seuls.
