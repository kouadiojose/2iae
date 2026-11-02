#!/usr/bin/env bash
# Installation du serveur de visio LiveKit du campus 2IAE (Kimsufi SYS-GAME-1, Ubuntu 24.04, Gravelines).
#
# Lancé une fois, en root, sur le serveur :  sudo bash installer.sh visio.2iae.com
# Relancé sans risque : il ne régénère jamais les clés existantes (/opt/livekit/.env).
#
# Ce qu'il met en place :
#   - mises à jour automatiques de sécurité, pare-feu (SSH, HTTPS, ports de la visio), fail2ban ;
#   - Docker, puis quatre conteneurs : Caddy (certificat HTTPS automatique, Let's Encrypt), LiveKit (la visio),
#     Redis (file des enregistrements) et Egress (enregistrement des replays vers le bucket Railway) ;
#   - TURN intégré à LiveKit sur 3478/udp et 5349/tcp (TLS) : les réseaux qui bloquent la visio passent quand même.
#
# Les clés (API LiveKit) sont tirées au sort sur le serveur et restent dans /opt/livekit/.env (lisible par root
# seulement). Elles ne s'affichent jamais : on les recopie dans les variables Railway du campus à la main.
set -euo pipefail

DOMAINE="${1:-}"
[ -n "$DOMAINE" ] || { echo "Usage : sudo bash installer.sh visio.2iae.com" >&2; exit 1; }
[ "$(id -u)" = "0" ] || { echo "À lancer en root (sudo)." >&2; exit 1; }
DOSSIER=/opt/livekit
export DEBIAN_FRONTEND=noninteractive

echo "· 1/6 Système à jour et mises à jour automatiques"
apt-get update -q
apt-get -y -q upgrade
apt-get -y -q install ca-certificates curl gnupg ufw fail2ban unattended-upgrades jq openssl
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "· 2/6 Pare-feu"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment "SSH"
ufw allow 80/tcp comment "Certificat Let's Encrypt"
ufw allow 443/tcp comment "LiveKit (wss) via Caddy"
ufw allow 7881/tcp comment "LiveKit WebRTC TCP"
ufw allow 3478/udp comment "TURN UDP"
ufw allow 5349/tcp comment "TURN TLS"
ufw allow 50000:60000/udp comment "LiveKit WebRTC UDP"
ufw --force enable
systemctl enable --now fail2ban

echo "· 3/6 Docker"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" >/etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get -y -q install docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
systemctl enable --now docker

echo "· 4/6 Clés et configuration"
mkdir -p "$DOSSIER/caddy-donnees" "$DOSSIER/enregistrements"
chmod 700 "$DOSSIER"
if [ ! -f "$DOSSIER/.env" ]; then
  umask 077
  {
    echo "LIVEKIT_API_KEY=campus$(openssl rand -hex 6)"
    echo "LIVEKIT_API_SECRET=$(openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-48)"
    echo "SOFIFRAN_API_KEY=sofifran$(openssl rand -hex 6)"
    echo "SOFIFRAN_API_SECRET=$(openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-48)"
    echo "DOMAINE=$DOMAINE"
  } >"$DOSSIER/.env"
fi
# shellcheck disable=SC1091
. "$DOSSIER/.env"

cat >"$DOSSIER/livekit.yaml" <<EOF
port: 7880
bind_addresses: [""]
log_level: info
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
  # Réseaux faibles : la vidéo baisse de qualité couche par couche, puis se met en pause ; le son passe en premier.
  congestion_control:
    enabled: true
    allow_pause: true
redis:
  address: 127.0.0.1:6379
keys:
  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}
  ${SOFIFRAN_API_KEY}: ${SOFIFRAN_API_SECRET}
room:
  empty_timeout: 300
  departure_timeout: 30
  auto_create: false
turn:
  enabled: true
  domain: ${DOMAINE}
  tls_port: 5349
  udp_port: 3478
  cert_file: /certs/certificates/acme-v02.api.letsencrypt.org-directory/${DOMAINE}/${DOMAINE}.crt
  key_file: /certs/certificates/acme-v02.api.letsencrypt.org-directory/${DOMAINE}/${DOMAINE}.key
webhook:
  api_key: ${LIVEKIT_API_KEY}
  urls:
    - https://campus.2iae.com/api/visio/livekit/webhook
EOF

cat >"$DOSSIER/egress.yaml" <<EOF
api_key: ${LIVEKIT_API_KEY}
api_secret: ${LIVEKIT_API_SECRET}
ws_url: ws://127.0.0.1:7880
redis:
  address: 127.0.0.1:6379
log_level: info
health_port: 9090
EOF

cat >"$DOSSIER/Caddyfile" <<EOF
${DOMAINE} {
  reverse_proxy 127.0.0.1:7880
}
EOF

cat >"$DOSSIER/docker-compose.yml" <<'EOF'
services:
  caddy:
    image: caddy:2.8
    restart: unless-stopped
    network_mode: host
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./caddy-donnees:/data
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    network_mode: host
    command: redis-server --bind 127.0.0.1 --save "" --appendonly no
  livekit:
    image: livekit/livekit-server:v1.9.4
    restart: unless-stopped
    network_mode: host
    command: --config /etc/livekit.yaml
    volumes:
      - ./livekit.yaml:/etc/livekit.yaml:ro
      - ./caddy-donnees/caddy:/certs:ro
    depends_on: [redis, caddy]
  egress:
    image: livekit/egress:v1.9
    restart: unless-stopped
    network_mode: host
    cap_add: [SYS_ADMIN]
    environment:
      EGRESS_CONFIG_FILE: /etc/egress.yaml
    volumes:
      - ./egress.yaml:/etc/egress.yaml:ro
      - ./enregistrements:/out
    depends_on: [redis, livekit]
EOF

echo "· 5/6 Démarrage (le certificat HTTPS est demandé à Let's Encrypt : ${DOMAINE} doit pointer vers ce serveur)"
cd "$DOSSIER"
docker compose pull -q
docker compose up -d caddy redis
for i in $(seq 1 60); do
  [ -f "caddy-donnees/caddy/certificates/acme-v02.api.letsencrypt.org-directory/${DOMAINE}/${DOMAINE}.crt" ] && break
  sleep 5
done
[ -f "caddy-donnees/caddy/certificates/acme-v02.api.letsencrypt.org-directory/${DOMAINE}/${DOMAINE}.crt" ] \
  || echo "  ATTENTION : pas encore de certificat. Vérifiez le DNS de ${DOMAINE}, puis : cd $DOSSIER && docker compose up -d"
docker compose up -d

# Le certificat est renouvelé par Caddy ; LiveKit (TURN TLS) le relit à son redémarrage : chaque dimanche à 3 h (GMT),
# heure sans cours.
echo "0 3 * * 0 root cd $DOSSIER && docker compose restart livekit >/dev/null 2>&1" >/etc/cron.d/livekit-certificat

echo "· 6/6 Vérification"
sleep 5
docker compose ps --format "table {{.Service}}\t{{.State}}"
curl -fsS -m 10 "https://${DOMAINE}" >/dev/null && echo "  OK : https://${DOMAINE} répond" || echo "  https://${DOMAINE} ne répond pas encore"
echo "Clés dans $DOSSIER/.env (root seulement). Fin de l'installation."
