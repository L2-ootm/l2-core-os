#!/usr/bin/env bash
set -e

echo "================================"
echo "L2 CORE OS - AI PREFLIGHT CHECK"
echo "================================"

ram_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
ram_gb=$((ram_kb/1024/1024))

if [ "$ram_gb" -ge 16 ]; then
  echo "TIER=A"
  echo "Recomendacao: LLM local 7B quantizado"
elif [ "$ram_gb" -ge 8 ]; then
  echo "TIER=B"
  echo "Recomendacao: LLM local 3B quantizado"
else
  echo "TIER=C"
  echo "Recomendacao: fallback deterministico sem LLM"
fi

echo "RAM detectada: ~${ram_gb} GB"
