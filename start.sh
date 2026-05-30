#!/usr/bin/env bash
# ============================================================
#  Draft Mundial 26 — arranque local
#  Uso:  ./start.sh      (o  bash start.sh)
# ============================================================
set -e
cd "$(dirname "$0")"

# Usa el almacén de certificados del sistema (proxy SSL corporativo)
export NODE_OPTIONS=--use-system-ca

if [ ! -f ".env.local" ]; then
  echo ""
  echo "[!] No existe .env.local — copiando desde .env.local.example"
  cp ".env.local.example" ".env.local"
  echo "    Edita .env.local con las claves de tu proyecto Supabase antes de continuar."
  echo ""
fi

if [ ! -d "node_modules/next" ]; then
  echo "Instalando dependencias…"
  npm install --no-audit --no-fund
fi

echo ""
echo "Arrancando en http://localhost:3000  (Ctrl+C para parar)"
echo ""

# Abre Chrome en localhost tras unos segundos (best-effort, multiplataforma)
(
  sleep 4
  if command -v cmd.exe >/dev/null 2>&1; then
    cmd.exe /c "start chrome http://localhost:3000 || start http://localhost:3000" >/dev/null 2>&1
  elif command -v google-chrome >/dev/null 2>&1; then
    google-chrome http://localhost:3000 >/dev/null 2>&1 &
  elif command -v open >/dev/null 2>&1; then
    open -a "Google Chrome" http://localhost:3000 >/dev/null 2>&1 || open http://localhost:3000
  fi
) &

npm run dev
