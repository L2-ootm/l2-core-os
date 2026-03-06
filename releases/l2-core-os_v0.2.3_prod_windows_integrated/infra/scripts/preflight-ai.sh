#!/usr/bin/env bash
set -e

REPORT="infra/scripts/preflight-ai-report.json"

echo "================================"
echo "L2 CORE OS - AI PREFLIGHT CHECK V2"
echo "================================"

ram_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
ram_gb=$((ram_kb/1024/1024))
ram_effective=$((ram_gb-2))
if [ "$ram_effective" -lt 1 ]; then ram_effective=1; fi
cpu_logical=$(nproc || echo 2)

tests=80
start=$(date +%s%3N)
for i in $(seq 1 $tests); do
  python - << 'PY' >/dev/null
x=0
for i in range(1,5001):
    x += i**0.5
print(x)
PY
done
end=$(date +%s%3N)
total_ms=$((end-start))
p95_ms=$((total_ms/tests))

tier="C"
mode="deterministic_fallback"
allowed_install="false"
reason="insufficient_resources"

if [ "$ram_effective" -ge 14 ] && [ "$cpu_logical" -ge 8 ] && [ "$p95_ms" -le 2500 ]; then
  tier="A"; mode="local_llm_7b"; allowed_install="true"; reason="meets_tier_a"
elif [ "$ram_effective" -ge 6 ] && [ "$cpu_logical" -ge 4 ] && [ "$p95_ms" -le 2500 ]; then
  tier="B"; mode="local_llm_3b"; allowed_install="true"; reason="meets_tier_b"
fi

cat > "$REPORT" <<JSON
{
  "ram_gb": $ram_gb,
  "ram_effective_gb": $ram_effective,
  "cpu_logical": $cpu_logical,
  "tests": $tests,
  "estimated_p95_ms": $p95_ms,
  "tier": "$tier",
  "mode": "$mode",
  "allowed_install": $allowed_install,
  "reason": "$reason"
}
JSON

echo "TIER=$tier"
echo "MODE=$mode"
echo "allowed_install=$allowed_install"
echo "report=$REPORT"
