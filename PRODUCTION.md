# 🚀 Guide de Déploiement Production - 2IAE International

## Configuration Base de Données

### Développement vs Production

- **Développement**: NeonDatabase (serverless, actuel)
- **Production**: PostgreSQL standard sur DigitalOcean

### Architecture Adaptative

Le système détecte automatiquement l'environnement:

```typescript
// server/db.ts - Détection automatique
const isProduction = process.env.NODE_ENV === 'production' || 
                     process.env.DATABASE_URL?.includes('postgresql://');
```

## 📋 Prérequis Production

### 1. Base PostgreSQL DigitalOcean

✅ **Configurée**: Base `2iae-db` (PostgreSQL 15)  
✅ **Driver**: `pg` installé  
✅ **Configuration**: SSL activé avec `rejectUnauthorized: false`

### 2. Variables d'Environnement Requises

```bash
NODE_ENV=production
DATABASE_URL=${2iae-db.DATABASE_URL}  # Auto-injectée par DigitalOcean
OPENAI_API_KEY=${OPENAI_API_KEY}      # À configurer
SESSION_SECRET=${SESSION_SECRET}      # À générer
```

### 3. Configuration DigitalOcean (.do/app.yaml)

```yaml
databases:
- name: 2iae-db
  engine: PG
  version: "15"
  size: db-s-dev-database

envs:
- key: DATABASE_URL
  value: ${2iae-db.DATABASE_URL}  # Liaison automatique
  type: SECRET
```

## 🛠️ Scripts de Déploiement

### Test PostgreSQL

```bash
# Test de connexion à votre base PostgreSQL DigitalOcean
DATABASE_URL="postgresql://user:pass@host:port/db" node scripts/test-production.js
```

### Déploiement Automatique

```bash
# Déploiement complet avec vérifications
./scripts/production-deploy.sh
```

## 🔄 Migration des Données

### Export Neon → Import PostgreSQL

1. **Export développement** (déjà fait):
   ```bash
   # Export SQL disponible
   database_export_2iae_complete_20250828_093257.sql
   ```

2. **Import vers PostgreSQL DigitalOcean**:
   ```bash
   # Via doctl ou interface web DigitalOcean
   psql $DATABASE_URL < database_export_2iae_complete_20250828_093257.sql
   ```

## 🔧 Configuration de Production

### Différences Clés

| Aspect | Développement | Production |
|--------|---------------|------------|
| **Driver** | `@neondatabase/serverless` | `pg` |
| **SSL** | WebSocket | SSL requis |
| **Pool** | Basique | Optimisé (max: 10) |
| **Gestion d'erreur** | Verbose | Logging sécurisé |

### Optimisations Production

```typescript
// server/db-production.ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,                    // Pool maximum
  idleTimeoutMillis: 30000,   // Timeout inactif
  connectionTimeoutMillis: 5000, // Timeout connexion
});
```

## 🧪 Tests de Production

### 1. Connexion Base

```bash
node scripts/test-production.js
```

### 2. Build Production

```bash
npm ci && npm run build
```

### 3. Test Local Production

```bash
NODE_ENV=production npm start
```

## 🚨 Points de Vigilance

### Sessions Admin

- **Développement**: MemoryStore (volatile)
- **Production**: MemoryStore optimisé + SESSION_SECRET fort

### Sécurité

- SSL obligatoire en production
- Variables d'environnement sécurisées
- Cookies `secure: true` en production

### Performance

- Pool de connexions optimisé
- Gestion d'erreur non-bloquante
- Cache de sessions configuré

## 📊 Monitoring

### Health Checks

DigitalOcean surveille automatiquement:
- Port 5000 disponible
- Réponse HTTP 200
- Connexion base de données

### Logs

```bash
# Accès aux logs via doctl
doctl apps logs <app-id> --follow
```

## 🔄 Workflow de Déploiement

1. **Développement** → Commit sur main
2. **DigitalOcean** → Build automatique
3. **Tests** → Sanity checks
4. **Deploy** → Mise en ligne
5. **Monitoring** → Surveillance continue

## 📞 Support

En cas de problème:
1. Vérifiez les logs DigitalOcean
2. Testez la connexion PostgreSQL
3. Validez les variables d'environnement
4. Contactez le support DigitalOcean si nécessaire