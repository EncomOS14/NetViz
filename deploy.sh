#!/usr/bin/env bash
# Build NetViz (if needed), copy the jar to a remote host, and restart it.
# Usage:
#   export DEPLOY_HOST=user@your-vm
#   ./deploy.sh
#   ./deploy.sh path/to/netviz-1.0.0.jar
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
JAR_SRC="${1:-}"
DEPLOY_HOST="${DEPLOY_HOST:-}"
REMOTE_DIR="${REMOTE_DIR:-~/netviz}"
APP_PORT="${APP_PORT:-8081}"

if [[ -z "$DEPLOY_HOST" ]]; then
  echo "Set DEPLOY_HOST first, for example:"
  echo "  export DEPLOY_HOST=user@your-vm"
  exit 1
fi

if [[ -z "$JAR_SRC" ]]; then
  JAR_SRC="$(ls -1t "$ROOT"/target/netviz-*.jar 2>/dev/null | grep -v original | head -1 || true)"
fi

if [[ -z "$JAR_SRC" || ! -f "$JAR_SRC" ]]; then
  echo "Building..."
  (cd "$ROOT" && mvn -q -DskipTests package)
  JAR_SRC="$(ls -1t "$ROOT"/target/netviz-*.jar | grep -v original | head -1)"
fi

echo "Deploying $(basename "$JAR_SRC") to $DEPLOY_HOST:$REMOTE_DIR"
ssh "$DEPLOY_HOST" "mkdir -p $REMOTE_DIR/data $REMOTE_DIR/logs"
scp "$JAR_SRC" "$DEPLOY_HOST:$REMOTE_DIR/netviz.jar"

ssh "$DEPLOY_HOST" bash -s <<EOF
set -euo pipefail
cd $REMOTE_DIR
if command -v fuser >/dev/null 2>&1; then
  fuser -k ${APP_PORT}/tcp 2>/dev/null || true
fi
sleep 1
nohup java -jar netviz.jar --server.port=${APP_PORT} > logs/app.log 2>&1 &
sleep 3
curl -fsS "http://127.0.0.1:${APP_PORT}/api/health" || true
echo
EOF

echo "Done."
