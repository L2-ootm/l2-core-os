# L2 CORE OS vs Deskito — Matriz Comparativa de Execução

## Escala usada
- Prioridade: P0 (crítico), P1 (alto), P2 (médio)
- Esforço: S (1-2 dias), M (3-7 dias), L (8-15 dias)
- Impacto: Alto / Médio / Baixo

## 1) Comparativo macro

| Dimensão | Deskito (observado) | L2 CORE OS (atual) | Gap | Vantagem estratégica L2 |
|---|---|---|---|---|
| Posicionamento | SaaS gestão para serviços | Infra Open Source agnóstica | Mensagem comercial ainda menos polida | Local-first + open infra + baixo custo |
| CRM/Pipeline | Forte e visível | Base de dados + endpoints; UI parcial | UI operacional incompleta | Pode nascer mais modular e idempotente |
| WhatsApp | Forte com API oficial | Baileys real + reconnect + webhook assinado | Camada funcional ainda inicial | Controle local e custo baixo |
| IA | Kito AI com funções comerciais | Fallback determinístico + política local | Falta biblioteca de blocos pronta | IA confiável por blocos fechados |
| Onboarding | Muito orientado a conversão | Setup técnico + wizard MVP | Falta onboarding comercial fluido | “1 clique local” pode ser diferencial |
| Mobile | Não validado no escopo | Estratégia Android-first definida | App Android ainda não iniciado | Operação sem depender de web paga |

---

## 2) Matriz de features (gap -> ação)

| Feature/Capacidade | Deskito | L2 CORE OS | Gap atual | Prioridade | Esforço | Impacto | Ação objetiva |
|---|---|---|---|---|---|---|---|
| Funil/CRM visual | Sim | Parcial | Falta UI completa | P1 | M | Alto | Tela pipeline básica (leads/status/actions) |
| Agendamentos operacionais | Sim | Base de eventos | Falta fluxo UI completo | P1 | M | Alto | Módulo agenda com status e filtros |
| WhatsApp inbound->CRM | Sim | Sim (base técnica) | Falta UX e automações de negócio | P0 | M | Alto | Regras visuais de automação por intenção |
| IA funcional por botões | Sim (indícios) | Parcial | Falta bloco pronto no front | P0 | M | Alto | 4 blocos fechados (confirm/cancel/remarcar/triagem) |
| Contratos/propostas | Sim | Parcial documental | Não implementado no MVP core | P2 | L | Médio | Deixar fora do piloto inicial |
| Financeiro | Sim | Base transações | Falta dashboard financeiro | P2 | M | Médio | KPI simples (receita, pendência, no-show) |
| Onboarding guiado | Sim | MVP técnico | Falta onboarding de negócio | P0 | S | Alto | Wizard de 5 passos com validação final |
| Android-first | Não claro | Estratégia definida | Falta app v0 | P1 | L | Alto | App Android mínimo com sync pull/push |
| GO/NO-GO automatizado | Não visível | Sim | Melhorar relatório visual | P1 | S | Médio | Saída JSON + painel de status |

---

## 3) Sprint sugerida (14 dias)

### Sprint Goal
Tornar L2 CORE OS superior em **operações clínicas de baixo custo**, com IA segura por blocos e WhatsApp operacional de ponta a ponta.

### Bloco A — Produto (P0)
1. **IA por blocos funcionais com botões (sem chat livre)**
   - Blocos: Confirmar, Cancelar, Remarcar, Triagem para humano
   - Critério aceite: 95% das mensagens comuns roteadas para bloco correto em testes internos
2. **Preflight IA v2 robusto**
   - Benchmark com cenário de carga (abas/processos)
   - Critério aceite: tier sugerido + recomendação automática + bloqueio seguro
3. **Wizard de onboarding clínico (5 passos)**
   - Critério aceite: usuário leigo conclui em <20 min

### Bloco B — Operação (P1)
4. **Pipeline/agenda operacional mínimo**
   - Visão de eventos: hoje, amanhã, pendentes de confirmação
5. **Automação WhatsApp visual por regra**
   - Se intenção=confirm -> status=confirmed
   - Se intenção=cancel -> status=canceled
   - Se baixa confiança -> human_review

### Bloco C — Confiabilidade (P1)
6. **Relatório GO/NO-GO em JSON + HTML**
7. **Estado distribuído para limiter/replay em Redis**

---

## 4) O que NÃO fazer agora (disciplina)
1. Não abrir chat IA genérico como interface principal.
2. Não expandir para 10 módulos antes do piloto em clínica.
3. Não gastar tempo em UI “bonita” antes de fechar fluxo operacional crítico.
4. Não adicionar cloud cara antes de validar valor local-first.

---

## 5) KPI de piloto (obrigatórios)
- Taxa de confirmação (antes vs depois)
- Taxa de no-show
- Tempo operacional gasto com WhatsApp
- % de mensagens roteadas automaticamente
- % de escalonamento para humano

---

## 6) Veredito estratégico
Deskito aparenta ser forte em produto SaaS completo.
**L2 CORE OS vence se focar em:**
1) custo inicial quase zero,
2) confiabilidade operacional,
3) IA funcional fechada por blocos,
4) Android-first para clínicas pequenas.

Esse é o caminho para diferenciação real e case verificável de impacto.