# CR2. Équipe rouge « qualité éditoriale et expérience client » sur SYNTHESE-v1

## 1. Reproches mal couverts

- **Tendances : réponse statique, machine qui se note elle-même.** La voie rapide (§3.6) exclut la vidéo et produit un visuel statique ; or une tendance TikTok ou Reels est un son ou un format vidéo, donc elle ne passe que par la planche hebdomadaire (3 à 10 jours d'âge). Le chronomètre part de `signal.detected_at` : une tendance non vue n'entre jamais dans l'indicateur. À écrire : « voie rapide vidéo » en gabarits Remotion prêts par format tendance, son attaché par l'Instagram Audio API (R26 §3, 1er juin 2026), script de 15 s envoyé à la cliente si un visage est nécessaire, cible 24 h. Ajouter l'indicateur « tendances signalées par le client avant la machine ».
- **Produits : seuls les nouveaux sont couverts.** Aucun suivi du catalogue existant ; en silence la réserve exclut la promotion et les créneaux promotion restent vides. À écrire : indicateur « couverture du catalogue » (chaque produit du site montré au moins une fois tous les 90 jours, crawl quotidien R06 §16.10) ; réserve enrichie de contenus produit sans prix ni allégation (usage, texture, geste).
- **Vidéos : la cliente valide des images fixes.** Ajouter un aperçu vidéo de 5 à 6 s (brouillon LTX-2.3 déjà prévu) envoyé dans la fenêtre de 24 h ouverte par son tap, message à boutons avec en-tête vidéo (R22 §1.1).
- **Église : le pasteur demande des « vidéos animées et highlights ».** Chaire livre des clips bruts et des citations fixes. Ajouter 2 highlights animés en typographie cinétique et 1 verset animé par sermon (Remotion, quelques centimes, sans étiquette IA, R05 §3.8, R09 §5.4, R11 §6.3), plus audiogrammes.
- **Voix de marque qui recopie la communication plate.** La fiche de voix extraite des 50 derniers posts (§9.3, R21 §9.16) recopie des posts plats. R11 §5.1 : exclure les posts d'agences précédentes et les brouillons IA. Corpus de voix tiré de la parole réelle (sermons transcrits, vocaux de la fondatrice, réponses aux commentaires, page « à propos »). Ajouter le test d'acceptation en aveugle de R11 §5.1.
- **Risques de générique restants** : réserve servie au client le plus à risque (la renouveler depuis ses propres actifs, ancrage réel obligatoire) ; genèse d'événement faite par recherche web sans le récit vivant du président (demander un vocal) ; juge à 15/21 qui laisse passer du tiède (exiger 3/3 en ancrage réel pour le pilier relation).

## 2. Frictions d'expérience

1. **Budget de notifications intenable** : non comptés `tendance_express`, mini-planches produit, séquences d'événement, propositions de boost, confirmations de vocal, `production_terminee`, reconnexions, relance de paiement. Le pasteur reçoit planche du vendredi et planche du lundi (8 par mois). À écrire : une seule planche hebdomadaire par client (pour Chaire, le lundi midi remplace le vendredi), le reste regroupé dans le récapitulatif du dimanche, plafond mesuré dans `whatsapp_message` et bloquant.
2. **Planche illisible sur téléphone** : composite 1080 × 1350 à 6-10 vignettes, environ 300 px par vignette. « Je valide tout » pousse à valider sans lire. Pilier, framework et coût prévu sont du jargon d'agence. À écrire : vue client limitée à visuel, hook, jour, réseau, « ce que nous attendons de vous » ; composite à 6 vignettes numérotées au plus ; le reste côté gestionnaire.
3. **Cliente muette dès le départ sans réserve** : réserve de démarrage de 12 contenus validée pendant l'onboarding (minutes 45 à 55, R21 §5.5). Trancher le défaut « sans réponse » avant le premier pilote. Élargir l'alerte « risque de départ » à la hausse des « à revoir » et au délai de réponse qui s'allonge.
4. **Voie rapide à 4 h trop courte à Abidjan** : « mandat tendance » optionnel au contrat, formats sans visage, sans prix, sans sujet religieux ; le gestionnaire valide à la place du client, informé après.
5. **Reconnexion à la charge du client** : utiliser le jeton d'utilisateur système de Facebook Login for Business qui n'expire pas par défaut (R21 §5.3) pour tout client avec une Page.
6. **Dépôt « en document » rebutant** : accepter la photo normale, produire la maquette, ne demander le document que pour la zone INCI.

## 3. Charge de José

La cible « moins de deux heures par semaine » ne tient pas la première année : calibration du juge (100 posts par verticale, environ une journée par verticale), onboarding en visio, portes 1 et 3 pendant le pilote en construisant seul, José client lui-même (SEVARTA, 2IAE, Markel-Tech, LinkedIn), configuration de chaque client, quatorze questions ouvertes. Écrire une trajectoire honnête (année 1 vs régime de croisière).

Contradictions : le bouton « Approuver tout ce qui est prêt » du message du lundi contourne les portes ; le limiter aux éléments déjà passés en porte 3. La version n+1 part sans relecture si motif standard et juge ≥ 15 : l'écrire comme exception assumée ou ajouter la relecture.

Charge du gestionnaire sous-estimée : paquets manuels des Channels et Status (dévotionnel quotidien : 15 publications manuelles par semaine pour trois églises), commentaires TikTok dans l'application, porte 3, appels. Chronométrer pendant le pilote, critère de sortie de phase 1. Ajouter un « mode José absent ».

## 4. Idées novatrices à ajouter (faisables selon les rapports)

1. **Boîte à tendances de la cliente** : elle transfère un lien TikTok ou Reel au numéro machine, il devient un `signal` daté de son envoi, voie rapide ; indicateur « tendances vues par vous avant nous » (R21 §4.1).
2. **« Ce qui marche chez vos voisins cette semaine »** : carte dans la planche et page du rapport, Business Discovery de 5 à 10 concurrents (R06 §16.6, R09 §11.17).
3. **Couverture du catalogue et « produit oublié du mois »** (R06 §16.10, R11 §12).
4. **Tournage guidé** : script de 15 à 20 s, plan dessiné et exemple dans la planche ; la cliente filme, la machine monte et sous-titre (R09 §3.4, R11 §15.16, §6.3).
5. **Réponse vidéo aux commentaires** : trois questions identiques produisent un script de réponse vidéo à tourner (R09 §3.4 et §3.8).
6. **Collecte d'UGC réel** : mot clé « AVIS » en Click-to-WhatsApp ou commentaire, demande de vidéo, lien de consentement signé rangé dans `consent` (R23 §8.3, §8.17, R09 §3.7). Sans cela, « 4 UGC montés » de Vidéo+ n'a pas de source.
7. **Bibliothèque de formats gagnants par verticale dès le mois 2** : structures (famille de hook, format, durée), jamais le contenu d'un client (R09, R11 §15.9).
8. **Pré-test des hooks adapté au pays** : Trial Reels au Canada (R26 §3, §5.5) ; à Abidjan, variantes sur TikTok et Facebook à des jours distincts, rétention à 3 s montrée (R11 §7.1, R10 §2.1).
9. **Remonter les meilleurs contenus** avec un nouveau hook ou décliner (Reel vers carrousel, verset animé), jamais repost tel quel (R11 §10, R24).
10. **Fond de catalogue des sermons** à l'onboarding : 10 meilleurs anciens sermons fournis par l'église, série thématique et réserve de démarrage, preuve dès la semaine 1 (R21 §3.4, R05 §3.10).
11. **Co-création par le vocal du lundi** : une minute de vocal « ma semaine, mes nouveautés, mes événements » devient l'entrée prioritaire de l'idéation (R22 §10.9, R11 §5.1).

## 5. Demandes de José mal traitées

| Demande | À écrire |
|---|---|
| ChatGPT Image | Nommer : « ChatGPT Image, c'est la famille GPT Image ; la plateforme l'utilise par l'API sous le nom gpt-image-2.5 (flare et sunburst) ; chatgpt-image-latest retiré le 1er décembre 2026 (R26). » |
| Higgsfield par MCP (« Xfield ») | Un MCP officiel existe (mcp.higgsfield.ai/mcp, 30 avril 2026, R04 §1), OAuth, en crédits, conforme. « Oui, votre MCP : la plateforme passe par l'API ; vous, dans Claude ou Cowork, par le MCP en crédits ; seul l'Unlimited piloté par Chrome est interdit. » |
| Déclencher Cowork ou Claude Code | Claude Code oui (Routines `POST /fire`, 30 tirs par heure, R07 §2.6), Cowork non directement (tâche planifiée qui lit `list_pending_briefs`, R07 §2.7). Bouton « Confier à Claude » dans la PWA dès la phase 2 avec ordres types (genèse d'événement, vidéo explicative de logiciel, relecture de planche). Le dire dès la thèse. |
| Vidéos explicatives de logiciel | Déclencheur « projet Markel-Tech livré → vidéo explicative 60 à 90 s », réception d'un compte de démonstration, script validé par le client, prix à l'unité. |
| Genèse d'événement en petite vidéo animée | Format Remotion 30 à 60 s (R09 §4.4) à partir des archives photo de l'association et du vocal du président, faits sourcés, relecture humaine. |
| Highlights animés du sermon | Voir section 1 (R05 §3.8). |

## 6. Ce qui est solide

Indicateurs « à la page » et couche affaires en tête du rapport ; juge fidèle à R11 ; usage de WhatsApp (accusés, vocaux, deux rappels, Flow, lien magique) ; Chaire et Dépôt ; honnêteté sur les limites (à garder en proposant la voie permise) ; continuité (machine à états, reprise, plafonds).
