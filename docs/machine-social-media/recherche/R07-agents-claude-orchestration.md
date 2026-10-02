# R07. Architecture agentique avec Claude, orchestration des tâches longues et intégration Claude Cowork et Claude Code

Rapport de recherche daté du 1er octobre 2026. Toutes les sources ont été ouvertes directement (documentation officielle Anthropic, pages de prix des fournisseurs, dépôts GitHub). Chaque prix et chaque limite portent la date de consultation : 2026-10-01, sauf mention contraire.

Note de méthode : le quota de recherche web de la session était épuisé ; la recherche a été menée par ouverture directe de 42 pages primaires (Anthropic, centre d'aide, pages de prix, dépôts GitHub, spécification MCP), complétées par les fichiers de référence du skill « claude-api ». Aucun fait ci-dessous ne vient de mémoire.

## 1. Résumé exécutif

La machine de José doit faire trois choses très différentes, et aucune surface Anthropic unique ne couvre les trois :

1. Un pipeline déterministe, répétable et bon marché (veille, idéation, calendrier, rédaction, planches, jugement qualité) : c'est le domaine de l'API Messages directe (tool use, sorties structurées, caching, Batch API), orchestrée par une file de tâches Postgres sur Railway.
2. Des tâches ouvertes à horizon long (analyser un sermon d'une heure, fouiller le site d'un client, produire un lot de scripts avec vérification) : c'est le domaine du Claude Agent SDK (hébergé par la plateforme) ou de Claude Managed Agents (hébergé par Anthropic, 0,08 $ par heure de session en plus des jetons).
3. Des actions sur des outils sans API, en premier lieu Higgsfield : c'est le domaine de Claude in Chrome et des tâches planifiées du bureau, qui exigent un Chrome ouvert et le compte claude.ai de José. Une plateforme SaaS ne peut pas déclencher cela directement, mais elle peut déposer des ordres que Claude Cowork ou Claude Code viennent chercher via un serveur MCP distant exposé par la plateforme.

Les prix 2026 rendent le cœur de la machine très bon marché : un post coûte environ 0,02 $ en jetons sur Claude Opus 5.5 avec caching, un calendrier mensuel complet environ 0,45 $ et l'analyse d'un sermon environ 0,14 $. À une trentaine de clients, la facture de jetons mensuelle reste sous 200 $ hors génération d'images et de vidéos. L'orchestration elle-même peut tenir dans Postgres (pg-boss ou Graphile Worker, gratuits) sans ajouter Redis ni un service payant.

L'architecture de référence recommandée en fin de rapport est « noyau Postgres, API directe pour 80 % du volume, Agent SDK dans un conteneur Railway pour les tâches ouvertes, serveur MCP distant OAuth 2.1 pour laisser Cowork et Claude Code agir sur la plateforme, Routines Claude Code comme pont d'entrée, Chrome local pour Higgsfield ».

## 2. Les surfaces Anthropic en 2026 : ce qu'elles sont, ce qu'elles coûtent, ce qu'une plateforme peut déclencher

### 2.1 Tableau de synthèse

| Surface | Qui héberge la boucle | Qui héberge l'exécution des outils | Déclenchable par un serveur tiers | Facturation | Statut au 2026-10-01 |
|---|---|---|---|---|---|
| API Messages (+ tool runner) | La plateforme de José | La plateforme de José | Oui, par appel HTTP | Jetons uniquement | Stable |
| Claude Agent SDK (TypeScript, Python) | Le processus de José (bibliothèque qui lance le binaire Claude Code) | Le même processus | Oui, c'est du code | Jetons par clé API (pas d'abonnement claude.ai autorisé pour un produit tiers) | Stable, versions 0.3.2xx en 2026 |
| Claude Managed Agents | Anthropic | Sandbox Anthropic (ou sandbox auto-hébergée) | Oui, REST ou SDK | Jetons + 0,08 $ par heure de session en statut running | Bêta, en-tête managed-agents-2026-04-01 |
| Claude Code en nuage (claude.ai/code) | Anthropic | VM Anthropic | Indirectement, via une Routine | Usage de l'abonnement claude.ai | Pro, Max, Team, Enterprise |
| Routines Claude Code | Anthropic | VM Anthropic | Oui, POST /v1/claude_code/routines/{id}/fire avec jeton par routine | Usage de l'abonnement | Aperçu de recherche |
| Claude Cowork | Anthropic (nuage) ou bureau | Nuage ou bureau | Non, pas d'API publique d'entrée | Abonnement | Pro, Max, Team, Enterprise |
| Claude in Chrome | Extension locale + nuage | Chrome de l'utilisateur | Non | Abonnement | Tous plans payants |
| Computer use / browser use (API) | La plateforme de José | VM ou navigateur fournis par José | Oui | Jetons (surcoût d'environ 4 500 jetons pour computer_toolset, environ 6 600 pour browser_toolset) | GA |

Sources : https://platform.claude.com/docs/en/about-claude/pricing ; https://code.claude.com/docs/en/agent-sdk/overview ; https://platform.claude.com/docs/en/managed-agents/overview ; https://code.claude.com/docs/en/claude-code-on-the-web ; https://code.claude.com/docs/en/routines ; https://support.claude.com/en/articles/13345190-getting-started-with-cowork ; https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome ; https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool

### 2.2 Prix des modèles (2026-10-01)

| Modèle | Entrée (par MTok) | Sortie | Écriture cache 5 min | Écriture cache 1 h | Lecture cache | Batch entrée / sortie |
|---|---|---|---|---|---|---|
| Claude Opus 5.5 | 4 $ | 20 $ | 5 $ | 8 $ | 0,20 $ (0,05x) | 2 $ / 10 $ |
| Claude Sonnet 5.5 | 2 $ | 10 $ | 2,50 $ | 4 $ | 0,20 $ | 1 $ / 5 $ |
| Claude Sonnet 5 | 2 $ | 10 $ | 2,50 $ | 4 $ | 0,20 $ | 1 $ / 5 $ |
| Claude Haiku 4.5 | 1 $ | 5 $ | 1,25 $ | 2 $ | 0,10 $ | 0,50 $ / 2,50 $ |
| Claude Fable 5.1 | 10 $ | 50 $ | 12,50 $ | 20 $ | 0,25 $ (0,025x) | 5 $ / 25 $ |

Faits utiles pour le chiffrage :
- Le prix de Sonnet 5 à 2 $ / 10 $, annoncé comme introductif jusqu'au 31 août 2026, est devenu le prix standard ; la hausse prévue au 1er septembre 2026 n'aura pas lieu.
- Les modèles Claude 4.7 et suivants utilisent un tokenizer qui produit environ 30 % de jetons en plus pour le même texte.
- Recherche web : 10 $ pour 1 000 recherches. Web fetch : gratuit hors jetons. Exécution de code : gratuite si combinée à web_search ou web_fetch, sinon 1 550 heures gratuites par mois puis 0,05 $ par heure et par conteneur.
- La fenêtre de 1 M de jetons est au tarif standard sur les modèles 4.6 et suivants.
- Fast mode (Opus 5.5) : 8 $ / 40 $, API uniquement.

Source : https://platform.claude.com/docs/en/about-claude/pricing

### 2.3 Claude Agent SDK (TypeScript)

Le SDK est « Claude Code en bibliothèque » : il lance le binaire Claude Code et expose la boucle d'agent, les outils intégrés (Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch), les sous-agents, les hooks, les permissions, les sessions et le chargement des skills depuis `.claude/`.

Points qui comptent pour une plateforme SaaS :
- Authentification : clé API obligatoire. La documentation précise qu'Anthropic n'autorise pas, sauf accord préalable, les développeurs tiers à offrir la connexion claude.ai ou ses limites d'usage dans leurs produits. La machine multi-clients ne peut donc pas tourner sur l'abonnement Max de José ; elle paie à l'usage.
- Options clés de `query()` : `model`, `allowedTools`, `permissionMode` (default, acceptEdits, bypassPermissions, plan, dontAsk, auto), `canUseTool`, `mcpServers` (stdio, sse, http, sdk en processus), `hooks`, `agents` (sous-agents en code avec `tools`, `model`, `effort`, `maxTurns`), `maxBudgetUsd`, `resume`, `sessionStore`.
- Sessions multi-hôtes : l'interface `SessionStore` (méthodes `append` et `load` obligatoires) permet de refléter les transcriptions dans Postgres, Redis ou S3 pour qu'une session commencée sur un conteneur soit reprise par un autre. Des adaptateurs de référence Postgres, Redis et S3 sont fournis dans `examples/session-stores/` (SDK TypeScript v0.3.234 ou supérieur pour certaines options).
- Hooks : PreToolUse (refuser, modifier l'entrée, ou `defer` pour mettre la requête en pause et la reprendre plus tard), PostToolUse, Stop, SubagentStop, PermissionRequest, Notification, SessionStart et SessionEnd (TypeScript seulement). `defer` est le mécanisme d'interruption et reprise pour une validation humaine.
- Plafonds de sous-agents : profondeur `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` (3 par défaut), concurrence `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` (20 par défaut), dépense `maxBudgetUsd` (illimité par défaut ; à la limite, le résultat porte le sous-type `error_max_budget_usd`).
- Coûts : `total_cost_usd` et `modelUsage` sont des estimations client calculées à partir d'une table de prix embarquée ; la documentation demande de ne pas facturer un client final sur ces champs et d'utiliser l'API Usage and Cost pour la facturation.
- Caching : automatique ; TTL 5 minutes par défaut avec clé API, passage au TTL 1 heure par `ENABLE_PROMPT_CACHING_1H` ou `promptCacheTtl`.
- Marque : interdiction d'appeler le produit « Claude Code » ou « Claude Code Agent » ; « Propulsé par Claude » est autorisé.

Sources : https://code.claude.com/docs/en/agent-sdk/overview ; https://code.claude.com/docs/en/agent-sdk/typescript ; https://code.claude.com/docs/en/agent-sdk/session-storage ; https://code.claude.com/docs/en/agent-sdk/hooks ; https://code.claude.com/docs/en/agent-sdk/subagents ; https://code.claude.com/docs/en/agent-sdk/cost-tracking

### 2.4 Claude Managed Agents

Objets : Agent (versionné), Environment (sandbox cloud ou auto-hébergée), Session (historique persistant côté serveur), Events (flux SSE), Vaults (secrets substitués à la sortie, jamais visibles dans la sandbox), Memory stores (répertoires montés, versionnés), Deployments (cron), Outcomes (rubrique notée par un grader indépendant, 3 itérations par défaut, 20 au maximum), Multiagent (roster de 1 à 20 agents, un seul niveau de délégation, 25 fils concurrents).

Ce que cela apporte à une plateforme SaaS :
- Aucune boucle d'agent ni sandbox à opérer. Compaction, caching et thinking sont intégrés.
- Deployments programmés : expression cron POSIX avec fuseau IANA, granularité minute, 1 000 déploiements par organisation, exécution décalée jusqu'à 9 minutes pour lisser la charge, enregistrements `deployment_run` pour chaque tir, budgets copiés sur chaque session.
- Budgets de session : plafond en dollars au tarif public (`max_list_cost`, en cents, USD seulement) ; la session se met en pause avec `stop_reason: budget_reached` et reprend si l'on relève le plafond. Les jetons, les recherches web (10 $ pour 1 000) et le temps d'exécution (0,08 $ par heure) comptent.
- Memory stores : fichiers texte de 100 Ko maximum chacun, 8 stores par session, accès read_only ou read_write, montage FUSE dans `/mnt/memory/<nom>/`, versions immuables avec rédaction possible. C'est une base naturelle pour un « cerveau de marque » par client lu par l'agent, à condition de ne jamais y écrire de secret.
- Permissions : `always_allow`, `always_ask` (la session passe idle et attend un `user.tool_confirmation`), `auto` (le serveur évalue chaque appel et l'exécute, le refuse ou met en pause). C'est un deuxième mécanisme d'« humain dans la boucle ».
- Webhooks : enregistrés dans la Console seulement, signature HMAC vérifiée par `client.beta.webhooks.unwrap()`.
- Limites : 300 créations par minute, 1 200 lectures par minute par organisation ; pas d'éligibilité Zero Data Retention ni BAA HIPAA ; pas de Batch API dans une session.
- Prix : exemple officiel d'une session d'une heure sur Opus 5 avec 50 000 jetons d'entrée et 15 000 de sortie : 0,705 $ ; 0,525 $ si 40 000 jetons sont lus en cache.

Sources : https://platform.claude.com/docs/en/managed-agents/overview ; https://platform.claude.com/docs/en/managed-agents/sessions ; https://platform.claude.com/docs/en/managed-agents/reference ; https://platform.claude.com/docs/en/about-claude/pricing (section Claude Managed Agents) ; fichiers de référence du skill claude-api (scheduled deployments, memory, multiagent, outcomes, tools)

### 2.5 Serveurs MCP distants : exposer la plateforme à Cowork, Claude Code et Managed Agents

Spécification MCP (révision 2025-06-18) pour un serveur distant protégé :
- OAuth 2.1 obligatoire côté serveur d'autorisation ; PKCE obligatoire côté client.
- Le serveur MCP doit publier `/.well-known/oauth-protected-resource` (RFC 9728) et renvoyer un en-tête `WWW-Authenticate` sur 401.
- Le serveur d'autorisation doit publier ses métadonnées (RFC 8414) et devrait accepter l'enregistrement dynamique des clients (RFC 7591).
- Le client doit envoyer le paramètre `resource` (RFC 8707) ; le serveur doit vérifier l'audience des jetons et ne jamais les retransmettre en aval.

Côté claude.ai : les connecteurs personnalisés via MCP distant sont disponibles sur Claude, Cowork et Claude Desktop pour tous les plans, y compris Free (limité à un connecteur). Les connexions partent des serveurs d'Anthropic, pas du poste de l'utilisateur, donc le serveur MCP de la plateforme doit être joignable publiquement. Trois options d'OAuth sont proposées : identité publiée de Claude (recommandée), enregistrement automatique, client OAuth propre ; les identifiants fixes (clé API) sont aussi acceptés. Sur Team, seuls les propriétaires ajoutent un connecteur.

Côté API Messages : le connecteur MCP (bêta `mcp-client-2025-11-20`) accepte des serveurs Streamable HTTP ou SSE publics avec un `authorization_token` Bearer ; il n'est pas éligible ZDR, n'est pas disponible sur Bedrock ni Vertex, et exige la paire `mcp_servers` + `tools: [{type: "mcp_toolset"}]`.

Côté Managed Agents : les serveurs MCP sont déclarés sur l'agent sans secret ; les jetons vivent dans un vault (`mcp_oauth` avec refresh automatique, ou `static_bearer`) attaché à la session ; les serveurs ne supportant que SSE fonctionnent par repli automatique. Un jeton d'API REST (par exemple un jeton d'intégration Notion) ne vaut pas jeton OAuth MCP.

Conséquence pratique : si la plateforme expose un serveur MCP « machine-social » (outils : lister les briefs à produire, déposer une planche, marquer un asset validé, lire le cerveau de marque, demander une génération Higgsfield), alors Claude Cowork, Claude Code, les Routines et Managed Agents peuvent tous agir sur la plateforme avec le même code.

Sources : https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization ; https://support.claude.com/en/articles/11175166-building-custom-connectors-via-remote-mcp-servers ; https://platform.claude.com/docs/en/agents-and-tools/mcp-connector ; https://platform.claude.com/docs/en/managed-agents/reference

### 2.6 Claude Code en nuage, Routines, déclencheurs programmés et sessions à distance

- Sessions en nuage : Pro, Max, Team et Enterprise (sièges premium). VM Ubuntu 24.04 isolée, pas de frais de calcul séparés, consommation imputée sur l'abonnement. Une VM inactive se met en pause après quelques minutes ; la réouverture restaure l'historique mais pas les processus de fond.
- Création depuis le terminal : `claude --cloud "tâche"` crée une session ; `claude -p "message" --cloud <session-id>` dépose un message dans une session existante et renvoie `{ok, session_id, url}` en JSON. C'est une forme d'API par la CLI, sans SDK.
- Routines (aperçu de recherche) : une Routine est un prompt + des dépôts + des connecteurs, exécutée comme session en nuage sans invite de permission. Trois déclencheurs : planification (intervalle minimum une heure, cron personnalisé via `/schedule update`, exécution unique possible), API (POST sur `https://api.anthropic.com/v1/claude_code/routines/{trig_...}/fire` avec jeton Bearer `sk-ant-oat01-...` propre à la routine, corps `{text}` jusqu'à 65 536 caractères, réponse avec `claude_code_session_id` et URL), GitHub (pull_request, release). Limites : 100 exécutions planifiées par heure et par compte, 30 tirs API par heure et par routine, 100 tirs API par heure et par compte, aucun dépassement possible, aucune clé d'idempotence (un webhook qui réessaie crée plusieurs sessions).
- Le texte envoyé dans `/fire` arrive dans un bloc `<routine-fire-payload>` étiqueté comme donnée non fiable ; le prompt de la routine doit explicitement dire d'agir dessus.
- Les Routines appartiennent au compte individuel ; leurs actions (commits, messages Slack, tickets) apparaissent sous l'identité de José. Connecteurs : tous les connecteurs claude.ai du compte sont inclus par défaut et utilisables en écriture sans demande d'autorisation ; il faut retirer ceux dont la routine n'a pas besoin.
- API credentials sur les environnements cloud (Pro et Max seulement, pas Team ni Enterprise) : une clé stockée sur l'environnement est injectée par le proxy d'agent sur les hôtes listés, sans jamais entrer dans la VM.
- Projets Claude Code (bêta publique Pro et Max, déploiement progressif) : une conversation ambiante qui lance des fils (sessions nuage) en parallèle, avec un onglet Routines. Pas encore sur Team ni Enterprise.
- Tâches planifiées du bureau : minimum une minute, exécution locale avec accès aux fichiers et à Chrome, seulement si l'application est ouverte et l'ordinateur éveillé ; un run de rattrapage unique après réveil.

Sources : https://code.claude.com/docs/en/claude-code-on-the-web ; https://code.claude.com/docs/en/routines ; https://platform.claude.com/docs/en/api/claude-code/routines-fire ; https://code.claude.com/docs/en/cloud-environments ; https://code.claude.com/docs/en/claude-projects ; https://code.claude.com/docs/en/desktop-scheduled-tasks

### 2.7 Claude Cowork en 2026

D'après le centre d'aide (consulté le 2026-10-01) : Cowork est le mode d'exécution de tâches multi-étapes de Claude, sur macOS et Windows (Claude Desktop), web, mobile et panneau latéral Chrome, pour Pro, Max, Team et Enterprise. Il accède aux dossiers locaux connectés, pilote un navigateur intégré, utilise les connecteurs et MCP, exécute des tâches planifiées en nuage sans que l'appareil soit allumé, charge des plugins et produit des fichiers Excel, PowerPoint et documents. Les sessions suivent le compte Claude d'une surface à l'autre.

L'article mentionne une bascule au 6 octobre 2026 : les plans Pro et Max passent à l'exécution de tâches en nuage uniquement et l'option « seulement sur votre ordinateur » disparaît. Ce point mérite une vérification directe par José dans son application, car il change la manière dont Higgsfield (qui a besoin du Chrome local) sera piloté.

Ce qu'une plateforme peut ou ne peut pas déclencher : il n'existe pas d'API publique pour lancer une tâche Cowork depuis un serveur tiers. Les deux ponts documentés sont (a) un connecteur MCP distant que Cowork appelle de lui-même (la plateforme devient un outil de Cowork) et (b) les tâches planifiées de Cowork ou de Chrome qui, à heure fixe, viennent lire la file de travail de la plateforme. Dans les deux cas, c'est Cowork qui tire ; la plateforme ne pousse pas.

Sources : https://support.claude.com/en/articles/13345190-getting-started-with-cowork ; https://support.claude.com/en/articles/11175166-building-custom-connectors-via-remote-mcp-servers

### 2.8 Claude in Chrome, computer use, browser use : automatiser Higgsfield

Claude in Chrome (extension, version 1.0.36 ou supérieure pour l'intégration Claude Code) :
- Fonctionne sur Chrome, Edge et les navigateurs Chromium ; pas sous WSL ; exige une connexion `/login` claude.ai (une clé API désactive l'intégration ; avant la v2.1.216 chaque tentative échouait avec une 403).
- Partage l'état de connexion du navigateur de l'utilisateur, donc accède aux sites où José est déjà connecté (Higgsfield compris). À une page de connexion ou un CAPTCHA, Claude s'arrête et demande une intervention manuelle.
- Tâches planifiées : prises en charge (quotidien, hebdomadaire, mensuel, annuel) mais « les tâches qui ont besoin de vos fichiers locaux, de votre ordinateur, ou de Claude pilotant Chrome depuis une autre surface exigent que Claude Desktop soit ouvert et connecté, même si la session tourne dans le nuage ».
- Fiabilité documentée : le service worker de l'extension peut s'endormir pendant les longues sessions (reconnexion par `/chrome`), une boîte de dialogue JavaScript bloque les commandes, et les captures ou téléversements ont des limites (10 Mo par téléversement). Aucune garantie de disponibilité ni limite d'actions n'est publiée.
- Le skill maison « production-video-higgsfield » de José encode déjà les pièges éprouvés (une vidéo à la fois, boucle auto-planifiée par send_later).

Côté API, deux toolsets GA sans en-tête bêta : `computer_toolset_20260801` (17 outils, bureau virtuel fourni par la plateforme, environ 4 500 jetons de définition) et `browser_toolset_20260801` (31 outils dont 27 actifs par défaut, navigateur opéré par la plateforme, environ 6 600 jetons, GA sur l'API Claude et Google Cloud seulement). Les deux exigent un conteneur dédié, un allowlist réseau, aucun identifiant sensible dans le profil et une confirmation humaine pour les actions conséquentes. Les captures d'écran sont facturées comme images : une image 1000 x 1000 vaut 1 296 jetons, une 1920 x 1080 vaut 2 691 jetons en haute résolution (modèles 4.7 et suivants).

Conséquence : automatiser Higgsfield par `browser_toolset` depuis Railway est techniquement possible (Playwright dans un conteneur avec le compte Higgsfield de José) mais fragile et coûteux en jetons d'images ; c'est aussi une automatisation d'un service sans API, à vérifier contre les conditions d'utilisation de Higgsfield. Le chemin le plus sûr reste Claude in Chrome sur le poste de José, nourri par une file de travail exposée par la plateforme.

Sources : https://code.claude.com/docs/en/chrome ; https://support.claude.com/en/articles/12012173-getting-started-with-claude-in-chrome ; https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool ; https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool ; https://platform.claude.com/docs/en/build-with-claude/vision

## 3. Patrons multi-agents applicables

Anthropic distingue (article « Building effective agents », 19 décembre 2024) cinq workflows et les agents proprement dits :

| Patron | Quand l'utiliser | Application à la machine |
|---|---|---|
| Chaîne de prompts | Tâche décomposable en étapes fixes | Brief, puis texte, puis adaptation par plateforme, puis hashtags |
| Routage | Catégories distinctes | Classer une entrée (nouveau produit, événement, sermon, actualité) vers le bon pipeline |
| Parallélisation (sectionnement, vote) | Sous-tâches indépendantes ou besoin de confiance | Trois angles créatifs en parallèle, vote du juge |
| Orchestrateur et ouvriers | Sous-tâches imprévisibles | Veille : l'orchestrateur décide quelles sources fouiller ; ouvriers Haiku 4.5 lisent |
| Évaluateur et optimiseur | Critères d'évaluation clairs et gain mesurable par itération | Juge LLM avec rubrique de voix de marque, deux tours de révision maximum |
| Agent autonome | Problème ouvert, nombre d'étapes imprévisible | Analyse de sermon avec recherche de passages, découpage de clips |

La règle d'Anthropic : commencer simple, n'ajouter de la complexité que si elle améliore mesurablement le résultat. Le système de recherche multi-agents d'Anthropic (13 juin 2025) donne l'ordre de grandeur : un agent consomme environ 4 fois plus de jetons qu'un chat, un système multi-agents environ 15 fois ; le gain mesuré sur l'agent seul était de 90,2 % sur leurs évaluations de recherche. Leçons de production : points de reprise, traçage complet, « rainbow deployments ».

Dans Managed Agents, le patron orchestrateur et ouvriers est natif : `multiagent: {type: "coordinator", agents: [worker.id, {type: "self"}]}`, avec des ouvriers sur Haiku 4.5 et une seule couche de délégation. Dans l'Agent SDK, ce sont les `agents` de `query()` avec `model: "haiku"` et des `tools` restreints.

Sources : https://www.anthropic.com/engineering/building-effective-agents ; https://www.anthropic.com/engineering/multi-agent-research-system ; référence multiagent du skill claude-api

## 4. Mémoire par client : le cerveau de marque

Trois couches, chacune avec un support différent :

1. Couche stable (voix, interdits, piliers 60/25/15, plateformes, personas, glossaire, exemples de posts validés) : un bloc de système de 4 000 à 12 000 jetons par client, placé en tête du prompt, derrière un `cache_control` avec TTL 1 heure pendant les rafales de production. Minimum cacheable : 512 jetons sur Opus 5.5 et Sonnet 5.5, 4 096 sur Haiku 4.5 (un cerveau court ne se cache donc pas sur Haiku). Lecture en cache à 0,20 $ par MTok sur Opus 5.5 : un cerveau de 10 000 jetons relu 500 fois dans le mois coûte 1 $.
2. Couche vivante (assets déposés, produits, événements, performances, décisions du client, historique des refus) : tables Postgres (Drizzle) exposées au modèle par outils (`get_brand_assets`, `get_recent_posts`, `get_metrics`) plutôt qu'injectées, pour ne pas casser le préfixe caché.
3. Couche agentique (notes de travail que l'agent écrit lui-même) : Memory stores Managed Agents (fichiers de 100 Ko maximum, versionnés, rédigeables) ou, avec l'Agent SDK, le `SessionStore` Postgres plus un répertoire de mémoire monté dans le conteneur.

Règle de caching à respecter : ordre `tools`, puis `system`, puis `messages` ; tout contenu volatile (date, identifiant de requête) après le dernier point de rupture ; vérifier `cache_read_input_tokens` dans `usage`. Un changement d'`effort` ou de modèle au milieu d'une conversation invalide le cache ; les messages système en milieu de conversation (rôle `system` dans `messages`, Opus 5.5 et Sonnet 5.5) permettent d'ajouter une consigne sans tout invalider.

Sources : https://platform.claude.com/docs/en/about-claude/pricing ; référence prompt-caching du skill claude-api ; référence memory du skill claude-api

## 5. Humain dans la boucle : interruption, reprise, validation

Mécanismes disponibles, du plus simple au plus intégré :

| Mécanisme | Où | Comportement |
|---|---|---|
| Table d'états Postgres (`brouillon`, `planche_envoyée`, `validé_client`, `en_production`, `publié`) | Plateforme | Le pipeline s'arrête à `planche_envoyée` ; la reprise est un nouveau job déclenché par l'action du client. Idempotent, auditable, sans agent vivant à maintenir. |
| Hook `PreToolUse` avec `permissionDecision: "defer"` | Agent SDK | La requête se termine ; la plateforme stocke l'identifiant de session et reprend avec `resume` quand le gestionnaire a tranché. |
| `canUseTool` + `permissionMode: "auto"` | Agent SDK | Approbation programmatique ou classifieur automatique ; `deny` prime sur `defer`, qui prime sur `ask`. |
| Politique `always_ask` ou `auto` | Managed Agents | La session passe `idle` avec `requires_action` et attend un `user.tool_confirmation` ; les sessions restent reprises après des heures de pause. |
| `user.interrupt` et `user.message` en cours de tour | Managed Agents | Le gestionnaire redirige l'agent sans le tuer. |
| Outcomes avec rubrique | Managed Agents | Le grader indépendant renvoie `satisfied`, `needs_revision`, `max_iterations_reached`, `failed`. |

Pour la validation par la cliente (« est-ce que ça vous convient, madame ? »), la première ligne du tableau suffit et coûte zéro jeton : un lien signé par e-mail (Resend) ou WhatsApp (CallMeBot) vers une page de planche avec trois boutons (valider, modifier, refuser) qui écrit l'état et déclenche le job suivant.

Sources : https://code.claude.com/docs/en/agent-sdk/hooks ; https://code.claude.com/docs/en/agent-sdk/typescript ; références tools et outcomes du skill claude-api

## 6. Évaluations de qualité et garde-fous

### 6.1 Juge LLM avec rubrique

Recommandations officielles : critères spécifiques et mesurables, grading automatisé (binaire, Likert 1 à 5, ordinal), volume de cas plutôt que qualité de notation manuelle, et utiliser un modèle différent de celui qui a généré. Les Outcomes de Managed Agents demandent des critères indépendamment notables (« le CSV a une colonne numérique price », pas « les données semblent bonnes »).

Rubrique proposée pour la machine, notée par Haiku 4.5 ou Sonnet 5.5 en sortie structurée (`output_config.format`) :
- Voix de marque (1 à 5) : ton, vocabulaire, interdits respectés, comparaison avec cinq exemples validés du client.
- Framework (binaire) : le post suit le framework annoncé (PAS, AIDA, BAB, FAB), hook en première ligne, 3 à 5 hashtags.
- Exactitude (binaire + citations) : chaque fait vérifiable est appuyé par une source du dossier de veille ou par un asset du client ; sinon « non vérifié ».
- Pilier (classification) : valeur, relation ou promotion, pour tenir le ratio 60/25/15 sur le mois.
- Risque (binaire par catégorie) : allégation santé ou beauté non prouvée, promesse financière, contenu religieux sensible (doctrine, personnes nommées, politique), droit à l'image (personne identifiable sans consentement enregistré), mineurs.

Seuil : voix inférieure à 4 ou tout risque positif renvoie en révision ; deux révisions maximum avant escalade au gestionnaire.

### 6.2 Vérification des images par vision

Claude ne génère pas d'images mais les lit. Pour détecter les images ratées (texte illisible, mains déformées, logo altéré, produit absent), envoyer l'image générée (réduite à 1 000 px, soit 1 296 jetons) avec une checklist : « le texte attendu est-il exactement présent ? », « le produit référencé est-il visible ? », « y a-t-il une anomalie anatomique ? ». Sur Haiku 4.5, cela coûte environ 0,002 $ par image ; sur Sonnet 5.5, environ 0,004 $. Limites documentées : Claude ne peut pas identifier des personnes, compte approximativement, ne détecte pas si une image est synthétique, et se trompe sur les textes très petits (préférer un zoom sur la zone de texte).

### 6.3 Garde-fous réglementaires et éditoriaux

- Allégations : liste par verticale (cosmétiques : pas de « guérit », « élimine » ; édition : pas de promesse spirituelle chiffrée ; école : conformité aux chiffres d'admission réels fournis).
- Contenu religieux : pour les églises, limiter les clips aux passages que le pasteur a validés comme « publiables », exiger une citation biblique exacte vérifiée par outil, interdire les extraits mentionnant des personnes de l'assemblée.
- Droit à l'image : tout visage identifiable issu d'une vidéo YouTube de l'église ou d'un événement doit avoir un consentement enregistré dans la base ; sinon flou ou recadrage.
- `stop_reason: "refusal"` sur Opus 5.5 et Sonnet 5.5 (catégories `cyber`, `bio`, `reasoning_extraction`, `frontier_llm`, `general_harms`) : toujours tester avant de lire `content`, et activer `fallbacks: "default"` (bêta `server-side-fallback-2026-07-01`).

Sources : https://platform.claude.com/docs/en/test-and-evaluate/develop-tests ; https://platform.claude.com/docs/en/build-with-claude/vision ; référence outcomes du skill claude-api ; SKILL.md claude-api (section refusal)

## 7. Coûts en jetons par type de contenu (prix du 2026-10-01)

Hypothèses : cerveau de marque de 8 000 jetons en cache (lecture à 0,20 $ par MTok sur Opus 5.5 et Sonnet 5.5), brief et contexte non cachés, sortie estimée au tokenizer 2026 (environ 1,3 jeton par mot français). Les montants sont des estimations, à recalibrer avec `count_tokens` et `usage` réels.

| Contenu | Entrée non cachée | Sortie | Opus 5.5 | Sonnet 5.5 | Haiku 4.5 | Opus 5.5 en Batch |
|---|---|---|---|---|---|---|
| Post simple (texte, légende, hashtags) | 2 000 | 600 | 0,022 $ | 0,012 $ | 0,006 $ | 0,011 $ |
| Carrousel 8 planches | 4 000 | 2 500 | 0,068 $ | 0,035 $ | 0,018 $ | 0,034 $ |
| Script vidéo 60 s + prompts image et vidéo par scène | 6 000 | 3 000 | 0,086 $ | 0,044 $ | 0,022 $ | 0,043 $ |
| Calendrier mensuel (30 idées, angles, dates, piliers) avec dossier de veille de 40 000 jetons | 40 000 | 8 000 | 0,32 $ | 0,16 $ | 0,08 $ | 0,16 $ |
| Analyse de sermon (transcription de 45 min, 15 000 jetons ; 6 clips scriptés, highlights, titres) | 15 000 | 4 000 | 0,14 $ | 0,07 $ | 0,035 $ | 0,07 $ |
| Juge LLM par asset (rubrique, sortie structurée) | 3 000 | 300 | 0,018 $ | 0,009 $ | 0,0045 $ | 0,0023 $ (Haiku Batch) |
| Vérification vision d'une image 1 000 px | 1 300 + 500 | 150 | 0,010 $ | 0,005 $ | 0,0026 $ | 0,0013 $ (Haiku Batch) |

Veille quotidienne par client en orchestrateur et ouvriers (3 ouvriers Haiku 4.5 lisant 30 000 jetons chacun, synthèse Sonnet 5.5 de 2 000 jetons, 10 recherches web) : environ 0,09 $ (Haiku) + 0,03 $ (synthèse) + 0,10 $ (recherches) = 0,22 $ par jour, soit 6,6 $ par mois ; divisé par deux en Batch pour la partie lecture.

Panier mensuel type par client (20 posts, 4 carrousels, 8 scripts vidéo, 1 calendrier, 4 sermons, 100 jugements, 60 vérifications d'images, veille quotidienne), sur Opus 5.5 pour la création, Haiku 4.5 pour les juges et les ouvriers :
- Création : 0,44 + 0,27 + 0,69 + 0,32 + 0,56 = 2,28 $
- Révisions (facteur 1,5) : 1,14 $
- Juges et vision : 0,45 + 0,16 = 0,61 $
- Veille : 6,60 $
- Total : environ 10,6 $ par client et par mois, dont 60 % de veille (recherches web). Avec Batch sur la veille et les juges : environ 7 $.

Effet des deux leviers :
- Caching : sans cache, le cerveau de 8 000 jetons coûte 0,032 $ par appel sur Opus 5.5 au lieu de 0,0016 $ ; sur 500 appels par mois, 16 $ contre 0,80 $. Rentable dès la deuxième requête en TTL 5 minutes, dès la troisième en TTL 1 heure.
- Batch API : 50 % sur tout, cache compris ; limites de 100 000 requêtes ou 256 Mo par lot, la plupart terminés sous une heure, expiration à 24 heures, résultats conservés 29 jours ; taux de cache en lot de 30 % à 98 % selon le trafic ; pas de `stream`, pas de `speed` fast. Parfait pour la veille nocturne, les jugements en masse et la génération du calendrier.

Comparaison avec les routes agentiques : une analyse de sermon en session Managed Agents d'une heure sur Opus 5.5 (lecture YouTube, transcription, découpage, écriture de six scripts) consomme typiquement 150 000 jetons d'entrée dont 70 % en cache et 20 000 de sortie : 0,18 + 0,02 + 0,40 + 0,08 (temps) = 0,68 $, soit cinq fois la route API directe. Multi-agents complet : compter le facteur 15 d'Anthropic.

Sources : https://platform.claude.com/docs/en/about-claude/pricing ; https://platform.claude.com/docs/en/build-with-claude/batch-processing ; https://platform.claude.com/docs/en/build-with-claude/vision ; https://www.anthropic.com/engineering/multi-agent-research-system

## 8. Orchestration des tâches longues et planifiées sur Railway

### 8.1 Comparatif

| Solution | Prix (2026-10-01) | Dépendance | Reprise après échec | Idempotence | Planification | Observabilité | Remarques |
|---|---|---|---|---|---|---|---|
| Railway cron | Inclus dans le service | Aucune | Aucune : un run est un conteneur qui démarre et sort | Non | Cron 5 champs, UTC, intervalle minimum 5 minutes, exécution sautée si la précédente tourne encore, imprécision de quelques minutes | Logs Railway | Bon pour un « tick » qui enfile des jobs, pas pour exécuter les jobs |
| pg-boss | Gratuit (MIT) | PostgreSQL 13+, Node 22.12+ | Retries avec backoff exponentiel, dead letter queue avec redrive, archivage | Clés de singleton, debounce, politiques de file | Cron et RRULE, différé | OpenTelemetry intégré | Multi-maître, compatible PGlite pour les tests ; un seul mainteneur |
| Graphile Worker | Gratuit (MIT) | PostgreSQL | 25 tentatives sur environ 3 jours par défaut, backoff exponentiel | `job_key` unique, lots | Crontab | Hooks d'événements | Latence inférieure à 3 ms via LISTEN/NOTIFY ; files nommées séquentielles |
| BullMQ | Gratuit (MIT) ; BullMQ Pro payant (prix non publié sur la doc) | Redis (service Redis Railway supplémentaire) | Retries, backoff, récupération après crash, « au moins une fois » | Déduplication | Job schedulers cron, délais | Dashboards tiers | Flows parent-enfant utiles pour « calendrier puis 30 posts » ; ajoute un composant |
| Inngest | Free 50 000 exécutions par mois, 5 étapes concurrentes ; Pro à partir de 99 $ par mois (1 M d'exécutions, 100 étapes concurrentes, traces 7 jours) ; Business à partir de 499 $ | SaaS, serveur HTTP de la plateforme | Étapes durables, retries, reprise à l'étape | Clés d'idempotence par événement | Cron, `waitForEvent`, `sleep` | Traces et métriques (15 min en Pro) | Le pattern `waitForEvent` colle à « attendre la validation de la cliente » |
| Trigger.dev v4 | Free 5 $ de crédits, 20 runs concurrents, 10 schedules ; Hobby 10 $ ; Pro 50 $ (200 concurrents, 1 000 schedules, logs 30 jours) ; calcul 0,0000338 $ par seconde en Small 1x, 0,000025 $ par invocation | SaaS exécutant le code (ou self-host) | Runs durables sans timeout, `wait` sans facturation pendant l'attente, retries | Clés d'idempotence | Schedules | Logs, Realtime | Exécute les tâches hors Railway |
| Temporal Cloud | À partir de 50 $ par million d'actions (25 $ en volume), stockage actif 0,042 $ par Go-heure, 150 $ de crédits gratuits sur 90 jours, Business à partir de 500 $ par mois | SaaS + workers sur Railway | Workflows durables, replays, timers longs | Workflow ID unique | Schedules | Web UI, métriques | Surdimensionné pour une équipe d'une personne |

Sources : https://docs.railway.com/reference/cron-jobs ; https://github.com/timgit/pg-boss ; https://worker.graphile.org/docs ; https://docs.bullmq.io/ ; https://www.inngest.com/pricing ; https://trigger.dev/pricing ; https://temporal.io/pricing

### 8.2 Observabilité LLM

| Outil | Gratuit | Payant | Rétention | Points forts |
|---|---|---|---|---|
| Langfuse | Hobby : 50 000 unités par mois, 30 jours, 2 utilisateurs ; auto-hébergement gratuit (Docker Compose) | Core 29 $ (100 000 unités, 8 $ par 100 000 au-delà, 90 jours) ; Pro 199 $ (3 ans) ; Enterprise 2 499 $ | 30 jours à 3 ans | Traces, datasets, évaluations, juge LLM, gestion des prompts, tableaux de bord ; open source |
| Helicone | Hobby : 10 000 requêtes, 1 Go, 7 jours, 1 siège | Pro 79 $ (1 000 logs par minute, 1 mois) ; Team 799 $ (3 mois, SOC 2, HIPAA) | 7 jours à 3 mois | Proxy ou journalisation asynchrone, cache, limitation de débit |
| Braintrust | Starter : 10 $ de crédits modèle, 1 Go, 10 000 scores, 14 jours | Pro 249 $ (100 $ de crédits, 5 Go, 50 000 scores, 30 jours) | 14 à 30 jours | Évaluations, autoevals, playground, juge LLM |

Sources : https://langfuse.com/pricing ; https://www.helicone.ai/pricing ; https://www.braintrust.dev/pricing

### 8.3 Lecture pour Railway

La plateforme a déjà Postgres, des volumes et des buckets. Ajouter Redis (BullMQ) ou un SaaS (Inngest, Trigger.dev, Temporal) ajoute un composant, une facture et un point de défaillance. pg-boss couvre retries, cron, singleton et dead letter avec la base existante ; Graphile Worker apporte la latence LISTEN/NOTIFY si des événements temps réel comptent (validation client qui doit relancer immédiatement). Railway cron reste utile pour un service minuscule qui, toutes les 5 minutes, vérifie les Routines et les échéances, à condition qu'il sorte proprement.

Points de vigilance pour les jobs Claude :
- Idempotence : clé `client:type:date:hash(brief)` sur chaque job ; l'API Messages n'a pas de clé d'idempotence et le Batch API conserve les résultats 29 jours, donc stocker `batch_id` et `custom_id` en base avant d'envoyer.
- Reprise : un job long (analyse de sermon via Agent SDK) doit sauvegarder `session_id` et reprendre par `resume` plutôt que repartir de zéro.
- Pas de tâche de plus de 30 minutes dans un worker Railway sans point de reprise ; les redéploiements coupent les conteneurs (la règle du dépôt 2IAE sur le service campus l'a montré).

## 9. Architecture de référence recommandée

### 9.1 Vue d'ensemble

```
[Clients : marque beauté, église, association, SEVARTA, 2IAE, Markel-Tech]
        |  dépôt d'assets, validation de planches (web + e-mail + WhatsApp)
        v
[Plateforme Railway : Express + React + Drizzle + Postgres + buckets S3]
   |- Orchestrateur de jobs : pg-boss (files : veille, ideation, redaction, planche, juge, vision, publication, metrique)
   |- Service « tick » Railway cron toutes les 5 minutes : échéances, relances, tirs de Routines
   |- Workers « API directe » : Claude API Messages (Opus 5.5 création, Sonnet 5.5 synthèse, Haiku 4.5 juges et ouvriers), caching 1 h, Batch API nocturne, sorties structurées
   |- Worker « agent » (conteneur dédié) : Claude Agent SDK TypeScript, SessionStore Postgres, hooks d'audit, maxBudgetUsd par job, sous-agents Haiku
   |- Serveur MCP distant « machine-social » (Streamable HTTP, OAuth 2.1, PKCE, RFC 9728/8414/7591/8707) : outils de lecture de la file, dépôt de rendus, validation
   |- Connecteurs sortants : OpenAI gpt-image (images), Canva (MCP), Suno, Facebook Graph, YouTube Data, Resend, CallMeBot
   |- Observabilité : Langfuse auto-hébergé sur Railway (ou Core 29 $), traces par client et par job
        ^
        |  (tire, ne pousse pas)
[Poste de José : Claude Desktop + Claude in Chrome + Cowork]
   |- Tâche planifiée locale (1 min minimum) ou Claude in Chrome planifié : « lis la file Higgsfield via le connecteur machine-social, produis les clips, dépose les URL »
   |- Skill maison production-video-higgsfield
[Compte claude.ai de José : Routines Claude Code]
   |- Routine « revue hebdo » tirée par la plateforme (POST /fire, 30 par heure par routine)
   |- Routine « incident » (API) quand un juge bloque trois fois un même client
```

### 9.2 Justifications

1. API directe pour le volume : 80 % des unités de travail (post, carrousel, script, calendrier, juge, vision) sont des appels à une ou deux étapes, où un agent coûte 4 à 15 fois plus cher sans gain mesurable. Les sorties structurées (`output_config.format`) donnent des objets prêts pour Drizzle.
2. Agent SDK plutôt que Managed Agents pour les tâches ouvertes : même harnais, même modèle de hooks, mais sur Railway, avec les secrets déjà en variables Railway, les buckets déjà montés, sans 0,08 $ par heure ni bêta, et avec `maxBudgetUsd` par job. Managed Agents reste l'option de repli si la maintenance du conteneur agent devient un fardeau, ou pour les Deployments programmés avec Memory stores si José préfère ne rien opérer.
3. Serveur MCP distant comme colonne vertébrale d'intégration : c'est la seule interface que Cowork, Claude Code, les Routines, Managed Agents (via vault) et l'API Messages (via connecteur MCP) parlent tous. Il remplace tout « déclencher Cowork depuis la plateforme » qui n'existe pas.
4. Routines comme pont d'entrée : la plateforme peut tirer une Routine par HTTP avec un texte de contexte (65 536 caractères), ce qui donne un vrai Claude Code en nuage sur le dépôt de la plateforme (par exemple pour générer une page de campagne), sous l'identité de José et dans ses limites d'abonnement.
5. Higgsfield en local : pas d'API, pilotage navigateur éprouvé par le skill maison, Chrome local obligatoire pour les tâches planifiées qui touchent le navigateur. La plateforme prépare les prompts image et vidéo scène par scène ; Claude in Chrome les exécute et rapporte les URL.
6. pg-boss sur Postgres : zéro composant supplémentaire, cron, retries, dead letter, singleton ; migration vers Inngest ou Trigger.dev possible plus tard si le besoin de `waitForEvent` à grande échelle apparaît.

### 9.3 Coûts mensuels de l'architecture (hors génération d'images et de vidéos, hors Railway)

| Poste | Hypothèse | Coût |
|---|---|---|
| Jetons Claude, 10 clients | 10,6 $ par client (section 7), Batch sur veille et juges | 70 à 106 $ |
| Jetons Claude, 30 clients | idem | 210 à 320 $ |
| Tâches agentiques (sermons, audits de site) | 4 sessions Agent SDK par client et par mois à environ 0,70 $ | 28 $ (10 clients) |
| Recherches web | incluses dans la veille (10 par jour par client) | inclus |
| Orchestration | pg-boss | 0 $ |
| Observabilité | Langfuse auto-hébergé ou Core | 0 à 29 $ |
| Abonnement Claude de José (Cowork, Chrome, Routines) | Max 5x | à partir de 100 $ |
| Conteneur agent Railway | selon usage | à mesurer |

Les options SaaS d'orchestration (Inngest Pro 99 $, Trigger.dev Pro 50 $ plus calcul, Temporal Business 500 $) coûteraient plus que tous les jetons à 10 clients.

Sources : sections 2, 7 et 8 ci-dessus ; https://claude.com/pricing

## 10. Incertitudes et points à vérifier

1. Cowork : la bascule « nuage uniquement » des plans Pro et Max au 6 octobre 2026 vient d'un article d'aide résumé par l'outil de lecture ; José doit la confirmer dans son application, car elle conditionne la façon de piloter Higgsfield (Desktop ouvert et connecté).
2. Aucune API publique de déclenchement de Cowork n'a été trouvée ; si Anthropic en publie une, la section 2.7 devient caduque.
3. Managed Agents est en bêta (en-tête managed-agents-2026-04-01) ; les comportements « peuvent être affinés entre versions ». Les tunnels MCP et le « dreaming » sont en aperçu restreint.
4. Les Routines sont en aperçu de recherche ; l'endpoint `/fire` est expérimental, sans clé d'idempotence, et le texte transmis est traité comme non fiable par défaut.
5. Les estimations de jetons de la section 7 sont des calculs à partir des prix officiels et d'hypothèses de longueur ; les nombres réels dépendent du tokenizer 2026 (environ 30 % de plus que 4.6) et doivent être mesurés avec `count_tokens` puis `usage`.
6. Le coût exact des recherches web dans la veille (10 $ pour 1 000) domine le panier ; une veille par flux RSS, sitemaps et API Facebook ou YouTube réduirait ce poste, mais ce point n'a pas été chiffré ici.
7. Higgsfield : l'automatisation par navigateur d'un service sans API doit être vérifiée contre ses conditions d'utilisation ; aucune source Higgsfield n'a été consultée dans cette mission.
8. Prix Railway (Redis, conteneurs, volumes) non consultés ; la comparaison BullMQ contre pg-boss suppose que Redis coûte un service supplémentaire.
9. BullMQ Pro : prix non publié dans la documentation consultée.
10. Graphile Worker et pg-boss : numéros de version exacts non confirmés dans les pages lues (pg-boss exige Postgres 13+ et Node 22.12+ ; Graphile Worker annonce 25 tentatives par défaut et moins de 3 ms de latence).
11. API credentials des environnements Claude Code en nuage : Pro et Max seulement, « pas encore » sur Team ni Enterprise ; si José passe à Team, les clés devront vivre en variables d'environnement visibles par les membres.
12. Projets Claude Code : bêta publique en déploiement progressif sur Pro et Max ; peuvent ne pas être visibles sur le compte de José.
13. La politique « pas de connexion claude.ai pour les produits tiers » implique que la machine, dès qu'elle sert d'autres clients, consomme une clé API Console et non l'abonnement Max ; la frontière entre « usage personnel de José via Cowork » et « service aux clients » devra être tracée proprement.
14. Le quota de recherche web de la session était épuisé ; la couverture repose sur 42 pages primaires ouvertes directement, sans recherche exploratoire d'articles tiers datés (comparatifs, retours d'expérience).

## 11. Implications pour la machine de José

1. Construire le cœur sur l'API Messages, pas sur des agents : posts, carrousels, scripts, calendrier et juges sont des appels structurés à 0,01 à 0,32 $ ; réserver l'agent (SDK) aux sermons et aux audits de site. Argument : facteur 4 à 15 sur les jetons documenté par Anthropic, sans gain pour des tâches bien spécifiées.
2. Choisir Opus 5.5 pour la création (4 $ / 20 $, cache à 0,20 $), Sonnet 5.5 pour les synthèses et Haiku 4.5 pour les juges et les ouvriers de lecture ; ne jamais changer de modèle au milieu d'une conversation (cache par modèle).
3. Mettre le cerveau de marque de chaque client en tête de prompt derrière un `cache_control` TTL 1 heure, de 4 000 à 12 000 jetons, et vérifier `cache_read_input_tokens` dès la première semaine ; un cerveau de 10 000 jetons relu 500 fois coûte 1 $ au lieu de 20 $.
4. Passer en Batch API tout ce qui n'attend personne : veille nocturne, jugement en masse, génération du calendrier du mois suivant. Économie de 50 % sur jetons et cache ; prévoir 24 heures de délai et stocker `batch_id` et `custom_id` en base.
5. Orchestrer avec pg-boss sur le Postgres Railway existant : files `veille`, `ideation`, `redaction`, `planche`, `juge`, `vision`, `publication`, `metrique`, clés de singleton `client:type:date`, dead letter visible dans le back-office du gestionnaire. Pas de Redis, pas de SaaS avant 30 clients.
6. Utiliser Railway cron uniquement pour un service « tick » qui sort en moins d'une minute (échéances, relances, tirs de Routines), car Railway saute un run si le précédent tourne encore et impose 5 minutes minimum.
7. Modéliser la validation client comme un état en base et non comme un agent en attente : lien signé par e-mail (Resend) et WhatsApp (CallMeBot) vers la planche, trois boutons, reprise par un nouveau job. Zéro jeton pendant l'attente, reprise garantie après redéploiement.
8. Pour les tâches ouvertes, lancer l'Agent SDK TypeScript dans un conteneur Railway dédié avec `SessionStore` Postgres (adaptateur de référence fourni), `maxBudgetUsd` par job (par exemple 2 $ par sermon), `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1`, hooks `PreToolUse` d'audit et `defer` pour les actions irréversibles (publication).
9. Exposer la plateforme comme serveur MCP distant « machine-social » conforme à la spécification 2025-06-18 (OAuth 2.1, PKCE, RFC 9728, 8414, 7591, 8707), joignable depuis les adresses d'Anthropic ; c'est le seul moyen documenté pour que Cowork, Claude Code, les Routines et Managed Agents agissent sur la plateforme. Dix outils suffisent au départ : `list_pending_briefs`, `get_brand_brain`, `get_assets`, `submit_render`, `submit_board`, `approve`, `reject`, `request_higgsfield_job`, `report_metrics`, `log_decision`.
10. Ne pas promettre « déclencher Cowork depuis la plateforme » : la plateforme dépose des ordres, et une tâche planifiée Cowork ou Claude in Chrome (Desktop ouvert) vient les chercher. Vérifier avant le 6 octobre 2026 l'impact de la bascule « nuage uniquement » annoncée pour Pro et Max.
11. Garder Higgsfield sur le poste de José avec le skill maison : la plateforme fournit, par scène, le prompt image (Nano Banana Pro) et le prompt vidéo (Seedance 2.5, 15 s), Claude in Chrome exécute et renvoie les URL via le connecteur. Évaluer plus tard `browser_toolset_20260801` dans un conteneur Playwright seulement si Higgsfield publie une API ou si les conditions d'utilisation le permettent ; compter 6 600 jetons de définition et 1 300 à 2 700 jetons par capture.
12. Brancher les Routines Claude Code comme pont d'entrée : une routine « revue hebdomadaire des clients » tirée par la plateforme (POST `/fire`, 30 par heure et par routine, 100 par heure et par compte, texte de 65 536 caractères maximum) et une routine « incident » quand un client cumule trois refus du juge. Écrire les prompts pour qu'ils agissent explicitement sur le bloc `routine-fire-payload`.
13. Mettre en place le juge dès le premier post : rubrique en cinq axes (voix 1 à 5, framework, exactitude sourcée, pilier, risque par catégorie), modèle différent du générateur, sortie structurée, seuil de 4 sur la voix, deux révisions maximum avant escalade humaine. Les tableaux de bord « taux de validation du premier coup » par client deviennent l'argument commercial contre « pas à la page ».
14. Vérifier chaque image générée par vision sur Haiku 4.5 (0,002 $ par image à 1 000 px) avec une checklist produit, texte attendu et anatomie ; zoomer sur les zones de texte ; se rappeler que Claude ne nomme pas les personnes et ne détecte pas les images synthétiques.
15. Encoder les garde-fous par verticale dans le cerveau de marque et dans le juge : allégations cosmétiques, citations bibliques vérifiées par outil, consentement d'image enregistré pour les visages de l'assemblée, chiffres d'admission 2IAE issus de la base. Toujours tester `stop_reason === "refusal"` et activer `fallbacks: "default"`.
16. Tracer chaque appel dans Langfuse (auto-hébergé sur Railway, ou Core à 29 $) avec `client_id`, `job_id`, `content_type`, `usage` et score du juge ; comparer la facture Console et les estimations `total_cost_usd` du SDK, qui ne sont pas des données de facturation.
17. Isoler la clé API de la plateforme de l'abonnement Max de José : la machine multi-clients doit payer à l'usage (interdiction documentée d'offrir la connexion claude.ai dans un produit tiers), tandis que Cowork, Chrome et Routines restent les outils personnels de José. Budgets par client (jobs pg-boss) et alertes WhatsApp quand un client dépasse 15 $ de jetons dans le mois.
18. Prévoir la montée en gamme sans réécriture : les mêmes briefs structurés alimentent aujourd'hui l'API directe et demain un Deployment programmé Managed Agents avec Memory store par client (0,08 $ par heure, budgets en dollars, Outcomes avec rubrique) si José veut cesser d'opérer le conteneur agent.
19. Pour les sermons : pipeline hybride, transcription hors Claude, analyse en API directe (0,14 $ sur Opus 5.5, 0,07 $ en Batch) pour les six clips et les highlights, puis Agent SDK seulement si le découpage exige d'écouter plusieurs passages ou de croiser avec les annonces de l'église.
20. Avant toute mise en production, exécuter un lot d'évaluation de 50 cas par verticale (posts validés par les clients comme référence) et mesurer le taux de passage du juge et le coût par asset ; ne rien optimiser (modèle, effort, caching) sans ce lot, conformément à la méthode d'Anthropic (environ 50 cas, cinq essais par configuration).

