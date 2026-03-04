#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  echo "[.env] criado a partir de .env.example"
fi

echo "======================================"
echo "L2 Core OS Setup (Linux/macOS)"
echo "======================================"

command -v docker >/dev/null 2>&1 || { echo "[ERRO] Docker não encontrado."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "[ERRO] Docker Compose não encontrado."; exit 1; }

echo "[1/3] Subindo serviços..."
docker compose -f docker-compose.yml --env-file .env up -d

echo "[2/3] Validando API..."
sleep 6
curl -fsS http://localhost:8000/health >/dev/null || echo "[AVISO] API ainda inicializando."

echo "[3/3] Setup finalizado"
echo "Dashboard: http://localhost:3000"
echo "API: http://localhost:8000"
echo "Baileys: http://localhost:8090"

echo "Próximo passo: conectar WhatsApp via QR no baileys-gateway."
