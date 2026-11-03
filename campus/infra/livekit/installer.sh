#!/usr/bin/env bash
# Installation du serveur de visio LiveKit du campus 2IAE (Kimsufi SYS-GAME-1, Ubuntu 24.04, Gravelines).
#
# Lancé une fois, en root, sur le serveur :  sudo bash installer.sh visio.2iae.com
# Relancé sans risque : il ne régénère jamais les clés existantes (/opt/livekit/.env).
#
# Ce qu'il met en place :
#   - mises à jour automatiques de sécurité, pare-feu (SSH, HTTPS, ports de la visio), fail2ban ;
#   - Docker, puis cinq conteneurs : Caddy (certificat HTTPS automatique, Let's Encrypt), LiveKit (la visio),
#     Redis (file des enregistrements), Egress (enregistrement des replays vers le bucket Railway) et Whisper
#     (transcription des replays, https://DOMAINE/transcription, protégée par un jeton) ;
#   - TURN intégré à LiveKit sur 3478/udp et 5349/tcp (TLS) : les réseaux qui bloquent la visio passent quand même.
#
# Relancer ce script hors des heures de cours : il peut redémarrer Egress et recharge Caddy.
#
# Les clés (API LiveKit, jeton de transcription) sont tirées au sort sur le serveur et restent dans /opt/livekit/.env (lisible par root
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
ufw allow 80/tcp comment "Certificat Lets Encrypt"
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
mkdir -p "$DOSSIER/caddy-donnees" "$DOSSIER/enregistrements" "$DOSSIER/whisper" "$DOSSIER/whisper-donnees" "$DOSSIER/whisper-modeles"
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
# Jeton du service de transcription (ajouté aussi sur un serveur déjà installé).
grep -q '^TRANSCRIPTION_TOKEN=' "$DOSSIER/.env" || (umask 077; echo "TRANSCRIPTION_TOKEN=$(openssl rand -hex 32)" >>"$DOSSIER/.env")
chmod 600 "$DOSSIER/.env"
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
  handle_path /transcription/* {
    request_body {
      max_size 64KB
    }
    reverse_proxy 127.0.0.1:9100
  }
  handle {
    reverse_proxy 127.0.0.1:7880
  }
}
EOF

# Service de transcription : faster-whisper sur le processeur, un travail à la fois, quatre cœurs au plus
# (la visio garde le reste). Le campus n'envoie rien pendant un cours en direct.
cat >"$DOSSIER/whisper/Dockerfile" <<'EOF'
FROM python:3.12-slim
RUN apt-get update -q && apt-get install -y -q --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir faster-whisper==1.1.1 requests
COPY serveur.py /app/serveur.py
CMD ["python", "-u", "/app/serveur.py"]
EOF
cat >"$DOSSIER/whisper/serveur.py" <<'PYEOF'
"""Service de transcription Whisper du campus 2IAE (faster-whisper, processeur).

API (jeton : en-tête « Authorization: Bearer <TRANSCRIPTION_TOKEN> ») :
  GET  /etat                  -> {"ok": true, "modele": ..., "enAttente": n}
  POST /travaux {url, langue} -> 202 {"id": ...}   (url : lien signé de la vidéo dans le bucket)
  GET  /travaux/<id>          -> {"statut": "en_attente|en_cours|terminee|erreur", "erreur": ...}
  GET  /travaux/<id>/vtt      -> le fichier WebVTT
Un travail à la fois. Les travaux survivent à un redémarrage (dossier /donnees) et sont effacés après 7 jours.
"""
import hmac, json, os, queue, re, subprocess, tempfile, threading, time, uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

JETON = os.environ.get("TRANSCRIPTION_TOKEN", "")
MODELE = os.environ.get("WHISPER_MODELE", "large-v3-turbo")
FILS = int(os.environ.get("WHISPER_FILS", "4"))
DOSSIER = os.environ.get("WHISPER_DONNEES", "/donnees")
PORT = int(os.environ.get("WHISPER_PORT", "9100"))
FAUX = os.environ.get("WHISPER_FAUX") == "1"  # essais : pas de modèle, une réplique fixe
GARDE_S = 7 * 24 * 3600
ID_VALIDE = re.compile(r"^[a-f0-9]{32}$")

os.makedirs(DOSSIER, exist_ok=True)
file_travaux = queue.Queue()
verrou = threading.Lock()


def chemin(id_, ext):
    return os.path.join(DOSSIER, f"{id_}.{ext}")


def lire(id_):
    try:
        with open(chemin(id_, "json")) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def ecrire(id_, travail):
    with verrou:
        tmp = chemin(id_, "json.tmp")
        with open(tmp, "w") as f:
            json.dump(travail, f)
        os.replace(tmp, chemin(id_, "json"))


def horodatage(t):
    h, r = divmod(max(0.0, t), 3600)
    m, s = divmod(r, 60)
    return f"{int(h):02d}:{int(m):02d}:{s:06.3f}"


modele = None


def charger_modele():
    global modele
    if modele is None and not FAUX:
        from faster_whisper import WhisperModel
        modele = WhisperModel(MODELE, device="cpu", compute_type="int8", cpu_threads=FILS)
    return modele


def transcrire(id_, travail):
    travail.update(statut="en_cours", debut=time.time())
    ecrire(id_, travail)
    with tempfile.TemporaryDirectory(dir=DOSSIER) as tmp:
        son = os.path.join(tmp, "son.wav")
        # Seul le son est gardé (mono, 16 kHz) : quelques centaines de Mo pour une heure de cours.
        r = subprocess.run(
            ["ffmpeg", "-nostdin", "-loglevel", "error", "-y", "-i", travail["url"], "-vn", "-ac", "1", "-ar", "16000", son],
            capture_output=True, text=True, timeout=3 * 3600,
        )
        if r.returncode != 0:
            message = r.stderr.replace(travail["url"], "<lien>").split("?X-Amz")[0]
            raise RuntimeError("Téléchargement ou lecture de la vidéo impossible : " + message.strip()[-300:])
        lignes = ["WEBVTT", ""]
        if FAUX:
            segments = [type("S", (), {"start": 0.0, "end": 2.0, "text": "Bonjour à tous."})()]
        else:
            # Vocabulaire du cours (titre, description) : les noms propres et termes techniques sont écrits juste.
            segments, _ = charger_modele().transcribe(
                son, language=travail.get("langue") or "fr", vad_filter=True, beam_size=1, initial_prompt=travail.get("vocabulaire") or None
            )
        for seg in segments:
            texte = seg.text.strip()
            if texte:
                lignes += [f"{horodatage(seg.start)} --> {horodatage(seg.end)}", texte, ""]
    with open(chemin(id_, "vtt.tmp"), "w") as f:
        f.write("\n".join(lignes))
    os.replace(chemin(id_, "vtt.tmp"), chemin(id_, "vtt"))


def ouvrier():
    try:
        charger_modele()  # premier démarrage : le modèle (1,6 Go) se télécharge une fois
        print("Modèle chargé", flush=True)
    except Exception as e:  # noqa: BLE001
        print(f"Modèle impossible à charger : {e}", flush=True)
    while True:
        id_ = file_travaux.get()
        travail = lire(id_)
        if not travail or travail.get("statut") not in ("en_attente", "en_cours"):
            continue
        try:
            transcrire(id_, travail)
            travail.update(statut="terminee", fin=time.time(), url=None)
        except Exception as e:  # noqa: BLE001 : toute erreur est rendue au campus
            travail.update(statut="erreur", erreur=str(e)[:500], fin=time.time(), url=None)
        ecrire(id_, travail)


def menage():
    while True:
        limite = time.time() - GARDE_S
        for nom in os.listdir(DOSSIER):
            p = os.path.join(DOSSIER, nom)
            try:
                if os.path.isfile(p) and os.path.getmtime(p) < limite:
                    os.remove(p)
            except OSError:
                pass
        time.sleep(3600)


def reprendre():
    """Au démarrage : les travaux interrompus repartent, dans l'ordre de leur demande."""
    restants = []
    for nom in os.listdir(DOSSIER):
        if nom.endswith(".json"):
            t = lire(nom[:-5])
            if t and t.get("statut") in ("en_attente", "en_cours"):
                restants.append((t.get("cree", 0), nom[:-5]))
    for _, id_ in sorted(restants):
        file_travaux.put(id_)


class Gestion(BaseHTTPRequestHandler):
    server_version = "whisper-2iae"

    def log_message(self, fmt, *args):  # pas de liens signés dans les journaux
        print(f"{self.command} {self.path.split('?')[0]} {args[1] if len(args) > 1 else ''}", flush=True)

    def repondre(self, code, corps, type_="application/json"):
        donnees = corps if isinstance(corps, bytes) else json.dumps(corps).encode()
        self.send_response(code)
        self.send_header("Content-Type", type_)
        self.send_header("Content-Length", str(len(donnees)))
        self.end_headers()
        self.wfile.write(donnees)

    def autorise(self):
        recu = self.headers.get("Authorization", "")
        if JETON and hmac.compare_digest(recu.encode(), f"Bearer {JETON}".encode()):
            return True
        self.repondre(401, {"erreur": "jeton invalide"})
        return False

    def do_GET(self):
        if not self.autorise():
            return
        parties = [p for p in self.path.split("?")[0].split("/") if p]
        if parties == ["etat"]:
            return self.repondre(200, {"ok": True, "modele": MODELE, "enAttente": file_travaux.qsize()})
        if len(parties) in (2, 3) and parties[0] == "travaux" and ID_VALIDE.match(parties[1]):
            t = lire(parties[1])
            if not t:
                return self.repondre(404, {"erreur": "travail inconnu"})
            if len(parties) == 2:
                return self.repondre(200, {"statut": t["statut"], "erreur": t.get("erreur")})
            if parties[2] == "vtt" and t["statut"] == "terminee":
                with open(chemin(parties[1], "vtt"), "rb") as f:
                    return self.repondre(200, f.read(), "text/vtt; charset=utf-8")
            return self.repondre(409, {"erreur": "transcription pas encore prête"})
        self.repondre(404, {"erreur": "inconnu"})

    def do_POST(self):
        if not self.autorise():
            return
        if self.path.split("?")[0].rstrip("/") != "/travaux":
            return self.repondre(404, {"erreur": "inconnu"})
        try:
            longueur = min(int(self.headers.get("Content-Length", "0")), 64_000)
            corps = json.loads(self.rfile.read(longueur) or b"{}")
        except ValueError:
            return self.repondre(400, {"erreur": "JSON invalide"})
        url = str(corps.get("url") or "")
        if not url.startswith("https://") and not FAUX:
            return self.repondre(400, {"erreur": "url https attendue"})
        id_ = uuid.uuid4().hex
        vocabulaire = str(corps.get("vocabulaire") or "")[:600]
        ecrire(id_, {"statut": "en_attente", "url": url, "langue": str(corps.get("langue") or "fr")[:5], "vocabulaire": vocabulaire, "cree": time.time()})
        file_travaux.put(id_)
        self.repondre(202, {"id": id_})


if __name__ == "__main__":
    if not JETON:
        raise SystemExit("TRANSCRIPTION_TOKEN manquant")
    reprendre()
    threading.Thread(target=ouvrier, daemon=True).start()
    threading.Thread(target=menage, daemon=True).start()
    print(f"Whisper ({MODELE}, {FILS} fils) sur 127.0.0.1:{PORT}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Gestion).serve_forever()
PYEOF

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
  whisper:
    build: ./whisper
    restart: unless-stopped
    network_mode: host
    cpus: "4"
    environment:
      TRANSCRIPTION_TOKEN: ${TRANSCRIPTION_TOKEN}
      WHISPER_MODELE: large-v3-turbo
      WHISPER_FILS: "4"
      WHISPER_DONNEES: /donnees
    volumes:
      - ./whisper-donnees:/donnees
      - ./whisper-modeles:/root/.cache/huggingface
EOF

echo "· 5/6 Démarrage (le certificat HTTPS est demandé à Let's Encrypt : ${DOMAINE} doit pointer vers ce serveur)"
cd "$DOSSIER"
docker compose pull -q --ignore-buildable
docker compose build -q whisper
docker compose up -d caddy redis
for i in $(seq 1 60); do
  [ -f "caddy-donnees/caddy/certificates/acme-v02.api.letsencrypt.org-directory/${DOMAINE}/${DOMAINE}.crt" ] && break
  sleep 5
done
[ -f "caddy-donnees/caddy/certificates/acme-v02.api.letsencrypt.org-directory/${DOMAINE}/${DOMAINE}.crt" ] \
  || echo "  ATTENTION : pas encore de certificat. Vérifiez le DNS de ${DOMAINE}, puis : cd $DOSSIER && docker compose up -d"
docker compose up -d
# Caddyfile modifié sur un serveur déjà en service : rechargement sans couper la visio.
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || true

# Le certificat est renouvelé par Caddy ; LiveKit (TURN TLS) le relit à son redémarrage : chaque dimanche à 3 h (GMT),
# heure sans cours.
echo "0 3 * * 0 root cd $DOSSIER && docker compose restart livekit >/dev/null 2>&1" >/etc/cron.d/livekit-certificat

echo "· 6/6 Vérification"
sleep 5
docker compose ps --format "table {{.Service}}\t{{.State}}"
curl -fsS -m 10 "https://${DOMAINE}" >/dev/null && echo "  OK : https://${DOMAINE} répond" || echo "  https://${DOMAINE} ne répond pas encore"
curl -fsS -m 10 -H "Authorization: Bearer ${TRANSCRIPTION_TOKEN}" "https://${DOMAINE}/transcription/etat" >/dev/null \
  && echo "  OK : transcription https://${DOMAINE}/transcription répond" \
  || echo "  Transcription pas encore prête (premier démarrage : modèle à télécharger). Journal : docker compose logs whisper"
echo "Clés dans $DOSSIER/.env (root seulement). Fin de l'installation."
