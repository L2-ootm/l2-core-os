# AI CAPABILITY POLICY (LOW-COST / LOCAL-FIRST)

## Meta
Permitir IA local sem comprometer operação da clínica.

## Estratégia
A IA local só liga após benchmark. Se não passar, sistema entra em fallback determinístico.

## Tiers
- TIER A: LLM local 7B quantizado
- TIER B: LLM local 3B quantizado
- TIER C: fallback sem LLM (regras + parser de intenção)

## Requisitos mínimos
- TIER A: 16GB RAM+, CPU 6c+, SSD
- TIER B: 8GB RAM (ideal 16), CPU 4c+, SSD
- TIER C: 8GB RAM, qualquer CPU moderna

## SLO de liberação da IA local
- p95 resposta curta < 2.5s
- sem swap agressivo
- estabilidade em teste de 5 minutos

## Fallback obrigatório
Mesmo com IA local ativa, ações críticas (confirmar/cancelar/remarcar) sempre têm rota determinística.

## Política de segurança
- IA não toma decisão clínica final
- baixa confiança => escalar para humano
- logs de classificação para auditoria
