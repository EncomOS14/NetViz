#!/usr/bin/env bash
# Start NetViz on port 8081
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
mkdir -p logs data
PORT="${PORT:-8081}"
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
  sleep 1
fi
JAR="${JAR:-$DIR/netviz.jar}"
if [[ ! -f "$JAR" ]]; then
  JAR="$DIR/target/netviz-1.0.0.jar"
fi
nohup java -jar "$JAR" --server.port="$PORT" > logs/app.log 2>&1 &
echo "NetViz started on port $PORT (pid $!)"
