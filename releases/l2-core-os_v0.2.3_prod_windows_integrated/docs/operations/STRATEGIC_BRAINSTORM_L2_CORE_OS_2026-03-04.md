# MISSÃO KILO — SUPER BRAINSTORM RÍGIDO (L2 CORE OS)

**Data:** 2026-03-04  
**Versão:** 1.0  
**Classificação:** Operacional — Uso Interno

---

## 1. MAPA DE TESES (10 TESES)

### Tese 01: Arquitetura Modular Monolítica com Service Mesh Leve

**Hipótese:** Um monólito modular bem Boundariesado (vertical slices por domínio) com Celery/Redis como message broker é superior a microservices puros para o stage inicial (0-500 clínicas), permitindo deploy simples sem sacrificar testabilidade e possibilidade de futura extração.

**Evidência Exigida:**
- Tempo médio de deploy < 15 minutos (medido em 10 pushes)
- Acoplamento circular < 2 dependências (verificado via depgraph)
- Latência P95 entre módulos < 200ms em load test

**Custo:** 2-3 semanas de refatoração inicial. Overhead deoperacional 15% vs monolito tight-coupled.

**Risco:** Média. Complexidade de Boundaries pode ser mal interpretada pela equipe. Mitigação: ADR formal para cada módulo.

**Lead Time:** 30 dias para primeira versão estável.

---

### Tese 02: Android-First com Sync Local SQLite + Remote Reconciliation

**Hipótese:** Um app Android com banco local SQLite cifrado + protocolo CRDT-like para reconciliação assíncrona permite operaçãooffline real para 90% dos fluxos (agendamento, cadastro, anamnese), eliminando dependência de conectividade constante e diferencionando de qualquer competidor brasileiro.

**Evidência Exigida:**
- 100% das operações core funcionais offline por 72h contínuas
- Conflitos de sync resolvidos automaticamente em < 2s para 95% dos casos
- Dados sensíveis cifrados at-rest com chave derivada de PIN local (AES-256-GCM)

**Custo:** 4-6 semanas para camada sync. Desenvolvimento Android 60% mais longo que PWA.

**Risco:** Alta. Complexidade de resolução de conflitos subestimada frequentemente. Mitigação: implementar Operational Transformation simplificado para operações comonoclusões (create, update, delete).

**Lead Time:** 60 dias para MVP sync funcional.

---

### Tese 03: WhatsApp Gateway como Canal Primário (Não Secundário)

**Hipótese:** Operações via WhatsApp (com Baileys/WWEBJS) devem ser o canal primário de interaction design, não complemento ao app/web. Isso reduz drasticamente o CAC e aumenta adopção em mercados de baixa literacia digital.

**Evidência Exigida:**
- 60% das ações completadas via WhatsApp no primeiro mês
- Taxa de abandono de fluxo < 15% em conversas iniciadas
- Suporte a rich messages (botões, listas, imagens) funcionando

**Custo:** 1-2 semanas. Integração Baileys já existente.

**Risco:** Baixa. Baileys já implementado e testado.

**Lead Time:** 7 dias para evolução de UX conversacional.

---

### Tese 04: Pricing Stackado (Freemium → SMB → Enterprise)

**Hipótese:** O modelo de revenue mais viável para Latin America é freemium com limite estrito de pacientes (50) + mensagens (200/mês), SMB até 500 pacientes com WhatsApp ilimitado, Enterprise com AI avançado e múltiplas clínicas.

**Evidência Exigida:**
- LTV/CAC > 3.0 após 12 meses
- Taxa de conversão free→pago > 8% ao trimestre
- Churn < 5% mensal em planos pagos

**Custo:** Sistema de billing e metering. 2 semanas.

**Risco:** Baixa. Modelo validado por concorrentes.

**Lead Time:** 21 dias para implementação.

---

### Tese 05: Observabilidade Total (OpenTelemetry + Grafana + Loki)

**Hipótese:** Sem observabilidade enterprise-grade, sustentação é impossível além de 10 clientes. Implementação inicial evita dívida operacional exponencial.

**Evidência Exigida:**
- 100% dos endpoints com tracing
- Métricas customizadas por domínio de negócio (não só infraestrutura)
- SLOs documentados com error budget

**Custo:** 1 semana de setup. Overhead de performance < 2%.

**Risco:** Baixa. Stack padrão.

**Lead Time:** 14 dias para baseline funcional.

---

### Tese 06: API-First Design com OpenAPI 3.1 Mandatório

**Hipótese:** Toda feature deve ser exposta via API antes de UI, permitindo parceiros, automação e future white-label. Contratos de API versionados e Strongly Typed.

**Evidência Exigida:**
- 100% das features com API correspondente
- Contratos breaking-change versionados
- SDKs auto-gerados para TypeScript e Python

**Custo:** 1 semana para pipeline de SDKs. Disciplina de equipe.

**Risco:** Média. Resistência a "fazer o dobro de trabalho". Mitigação: templates FastAPI que geram spec automaticamente.

**Lead Time:** 7 dias (contínuo).

---

### Tese 07: Security Zero Trust com Short-Lived Tokens

**Hipótese:** Tokens JWT com lifetime < 15 minutos + refresh token rotativo + device fingerprinting é o mínimo viável para dados de saúde (LGPD).

**Evidência Exigida:**
- Token lifetime verificado em testes automatizados
- Refresh token invalidado após 7 dias ou logout
- 2FA opcional mas disponível

**Custo:** 3-5 dias. Já parcialmente implementado (JWT + RBAC).

**Risco:** Baixa. Stack de segurança padrão.

**Lead Time:** 7 dias para hardening.

---

### Tese 08: AI como Diferenciador Core (Não Feature)

**Hipótese:** AI não deve ser "chatbot de sacanagem" ou gimmick. Deve resolver dor real: triagem automática, suggéstão de diagnóstico, automação de faturamento, detecção de no-show.

**Evidência Exigida:**
- 3 features AI em produção no dia 1
- Redução mensurável de tempo de consulta/triagem
- ROI de AI calculado por feature

**Custo:** Integração API (OpenAI/Anthropic) + Fine-tuning. $2k-5k/mês em inferência.

**Risco:** Alta. Dependência de vendor e custo variável. Mitigação: start with prompt engineering, evoluir para fine-tuned.

**Lead Time:** 30 dias para primeira feature.

---

### Tese 09: Community-Led Growth via Forkability

**Hipótese:** Ser genuinamente open-source (não "open core"伪善) com repo público, documentação de self-hosting, e comunidade ativa cria defensibilidade via ecossistema e reduz dependência de venture capital.

**Evidência Exigida:**
- 50+ stars em 90 dias
- 5+ pull requests externos no primeiro semestre
- 2+ forks em produção por terceiros

**Custo:** Documentação, CI/CD para release, community management. 1 semana inicial + ongoing.

**Risco:** Média. Competidor pode fazer fork e undercut. Mitigação: inovar mais rápido que fork, criar network effects.

**Lead Time:** 14 dias para repo público funcional.

---

### Tese 10: Deployment Híbrido (Cloud + On-Premise)

**Hipótese:** Para o mercado brasileiro de saúde, muitos gestores exigem on-premise ou cloud soberana. A arquitetura deve suportar ambos sem重构, com dados residentes em território nacional (LGPD art. 16).

**Evidência Exigida:**
- Deploy em VPS padrão funcionando em < 1 hora
- Suporte a S3-compatible storage local (MinIO)
- Backup cifrado com chave gerenciada pelo cliente

**Custo:** Docker Compose production-ready + Ansible/Terraform. 2 semanas.

**Risco:** Baixa. Infra já containerizada.

**Lead Time:** 14 dias.

---

## 2. ARQUITETURA-ALVO EM 3 ONDAS

### ONDA 1: FUNDAÇÃO (0-30 DIAS)

**Decisões Irreversíveis:**

- Stack FastAPI + Celery + Redis + PostgreSQL — locked in
- OpenAPI 3.1 como contrato primário
- SQLite local no Android como store offline

**Decisões Reversíveis:**

- Message broker (RabbitMQ vs Redis Streams) — pode migrar
- Provedor de AI (OpenAI vs Anthropic vs auto-hosteado)
- Mobile framework (Flutter vs Kotlin puro)

**Objetivos:**

- [ ] API REST com todos os CRUDs de domínio
- [ ] Auth JWT + RBAC completo
- [ ] Baileys gateway operacional com 2-way messaging
- [ ] Health check + basic observability
- [ ] Docker Compose production-ready
- [ ] Android app com login + listagem básica offline

**Dependências Críticas:**

- Configuração de CI/CD
- Setup de staging environment
- Documentação de API

---

### ONDA 2: ESCALABILIDADE (31-90 DIAS)

**Decisões Irreversíveis:**

- CRDT-based sync protocol para offline
- Rate limiting por tenant (não só global)
- Criptografia end-to-end para dados sensíveis

**Decisões Reversíveis:**

- Kafka vs Redis Streams para event sourcing
- Elasticsearch vs PostgreSQL full-text
- CDN provider

**Objetivos:**

- [ ] Sync offline completo com resolução de conflitos
- [ ] Multi-tenant com isolamento de dados
- [ ] Webhooks com HMAC + replay protection
- [ ] Billing system com usage metering
- [ ] AI features: triagem, sugestões, automação
- [ ] Dashboard admin com analytics
- [ ] Telegram + Email como canais adicionais
- [ ] Deploy em cloud (AWS/Render/Supabase)

**Dependências Críticas:**

- Feature flags system
- A/B testing framework
- Monitoring de custos

---

### ONDA 3: MATURAÇÃO (91-180 DIAS)

**Decisões Irreversíveis:**

- Architecture de event sourcing para audit log
- Data residency controls (LGPD compliance)
- Marketplace de plugins

**Decisões Reversíveis:**

- Database migration path
- Infra as code provider

**Objetivos:**

- [ ] Enterprise SSO (SAML/OIDC)
- [ ] API GraphQL opcional
- [ ] White-label capabilities
- [ ] Public marketplace de integrações
- [ ] On-premise installer (VM/Docker)
- [ ] Community governance
- [ ] SOC2 Type II prep (se enterprise demandar)

---

## 3. TOP 20 IDEIAS DE ALAVANCAGEM ASSIMÉTRICA

Ordenado por **impacto × esforço × defensibilidade**

| # | Ideia | Impacto | Esforço | Defensibilidade | Score |
|---|-------|---------|---------|-----------------|-------|
| 1 | **Sync offline verdadeiramente offline** | 10 | 6 | 9 | 27 |
| 2 | **AI triagem conversacional via WhatsApp** | 9 | 3 | 7 | 19 |
| 3 | **One-click deploy (Docker Compose)** | 8 | 2 | 8 | 18 |
| 4 | **Automação de faturamento convênio** | 8 | 5 | 8 | 21 |
| 5 | **Detecção de no-show preditiva** | 7 | 4 | 6 | 17 |
| 6 | **API-first com SDKs auto-gerados** | 7 | 2 | 7 | 16 |
| 7 | **Webhook marketplace** | 6 | 3 | 8 | 17 |
| 8 | **Audit log inalterável (append-only)** | 8 | 3 | 9 | 20 |
| 9 | **Multi-clínica com hierarchy RBAC** | 7 | 4 | 6 | 17 |
| 10 | **Template de anamnese IA** | 6 | 3 | 5 | 14 |
| 11 | **Integração laboratório online** | 6 | 5 | 7 | 18 |
| 12 | **Prescrição digital com assinatura** | 7 | 6 | 8 | 21 |
| 13 | **Chat interno equipe** | 5 | 4 | 4 | 13 |
| 14 | **Agendamento por IA (disponibilidade)** | 6 | 4 | 5 | 15 |
| 15 | **Recall automático de pacientes** | 6 | 3 | 5 | 14 |
| 16 | **Relatórios customizados (BI builder)** | 6 | 5 | 6 | 17 |
| 17 | **SMS/Email via gateway próprio** | 4 | 2 | 4 | 10 |
| 18 | **Two-factor auth biométrico** | 5 | 3 | 7 | 15 |
| 19 | **Feedback loop de satisfação** | 4 | 2 | 3 | 9 |
| 20 | **Dashboard em tempo real (WebSocket)** | 5 | 5 | 5 | 15 |

**Análise:**

- **Vencedoras imediatas (executar nas próximas 2 semanas):** #3 (one-click deploy), #6 (SDKs), #8 (audit log), #2 (AI triagem WhatsApp)
- **Estratégicas (31-60 dias):** #1 (sync offline), #4 (faturamento), #12 (prescrição digital)
- **Diferenciadoras de longo prazo:** #7 (webhook marketplace), #11 (integração laboratório)

---

## 4. RED TEAM TÉCNICO — 15 MODOS DE FALHA

| # | Modo de Falha | Probabilidade | Impacto | Mitigação Concreta |
|---|---------------|---------------|---------|-------------------|
| 1 | **Rate limiter bypass via IP spoofing** | Alta | Alto | Implementar rate limiting no API Gateway + token-based + device fingerprint. Fail2ban automático. |
| 2 | **Redis como SPOF (down = app down)** | Média | Crítico | Redis Cluster mode + fallback to in-memory local cache com circuit breaker. Múltiplas réplicas. |
| 3 | **Dados de pacientes vazados** | Baixa | Catastrófico | Encryption at-rest (AES-256), at-transit (TLS 1.3), chave por tenant. Tokenização de dados sensíveis. |
| 4 | **WhatsApp ban (meta crackdowns)** | Média | Alto | Implementar fallback para SMS + Telegram simultaneamente. Warn users sobre tos. Distribute across numbers. |
| 5 | **Sync conflict data loss** | Alta | Alto | CRDTs para dados críticos. Append-only log para recuperação. "Last-write-wins" apenas para dados não-críticos. UI conflict resolution para o resto. |
| 6 | **Celery task explosion (queue flood)** | Média | Médio | Per-tenant rate limits, max retry configurável, exponential backoff, dead letter queue após 3 falhas. |
| 7 | **AI prompt injection (jailbreak)** | Alta | Médio | Input sanitization, output filtering, rate limit por user, sandboxing de prompts. Monitoramento de anomalies. |
| 8 | **Database migration lock (long migration)** | Média | Médio | Zero-downtime migration strategy (expand-contract). migrations em batches de 1000 rows. Feature flags para código antigo. |
| 9 | **Dependência de vendor AI (cost spike)** | Alta | Médio | Implementar cache de respostas, prompt caching, fallback para modelo open-source (Llama 3 local se necessário). Budget alerts. |
| 10 | **Cron job overlap (scheduled jobs)** | Baixa | Médio | Distributed lock (Redis SETNX) para jobs. Idempotency mandatory. Job status tracking. |
| 11 | **Memory leak em long-running workers** | Média | Médio | Prometheus memory alerts + restart automático após threshold. Memory profiling em staging. |
| 12 | **OAuth/SSO token leak** | Baixa | Alto | Short-lived tokens (15min), refresh token rotation, device revocation, suspicious activity detection. |
| 13 | **Backup restoration failure** | Baixa | Catastrófico | Testes mensais de restore em ambiente isolado. Backups cifrados com chave separada. RTO < 4h. |
| 14 | **GDPR/LGPD violation (data export)** | Média | Alto | Data export endpoint para pacientes (art. 48 LGPD). Automated retention policies. Data lineage tracking. |
| 15 | **Escalabilidade do Baileys (many sessions)** | Alta | Alto | Session pooling, message queue por sessão, rate limit respect (20msg/min), múltiplas instâncias. |

---

## 5. PLANO DE DIFERENCIAÇÃO BRUTAL OPEN-SOURCE

### Posicionamento

Não somos "só mais um CRM". Somos **infraestrutura operacional de saúde** — o back-office que其他 sistemas não querem construir.

### Pilares de Diferenciação

**1. Open-Source Real (Não Open-Core)**

- Repositório público principal
- Licença AGPLv3 para backend
- Frontend Apache 2.0
- ZERO funcionalidades "pro" bloqueadas
- Revenue via SaaS托管 + serviços (não via feature lock)

**2. Cauda Longa de Integrações**

- API webhook universale
- Zapier/Make nativo
- Marketplace de plugins
- SDKs para as 5 linguagens mais populares
- Documentação de developer experience de nível Stripe

**3. Local-First / Soberania de Dados**

- Deploy em qualquer cloud ou on-premise
- Dados ficam no Brasil (LGPD)
- Exportação completa a qualquer momento
- Portabilidade total (não vendor lock-in)

**4. Operações, Não Apenas Software**

- Runbooks operacionais publicados
- Checklist de segurança compartilhado
- Monitoramento como feature
- Alta disponibilidade como padrão, não upgrade

**5. Community como moat**

- Discord/Slack ativo com resposta < 4h
- Contribuições reconhecidas publicamente
- Governance transparente
- Roadmaps votados pela comunidade

### Messaging

> "L2 CORE OS: onde seu sistema de saúde roda na sua cloud, na sua regras, com seu branding — open source, enterprise, seu."

### Estratégia de Avoidance

- **Não competir em preço** — competir em valor e controle
- **Não fazer "freemium forever"** — limite claro para convertir
- **Não ignorar enterprise** — SOC2, HIPAA-ready, SLA enterprise
- **Não depender de venture capital** — bootstrap com revenue real

---

## 6. ROADMAP ANDROID-FIRST COM SYNC LOCAL/HÍBRIDO

### Stack Mobile

- **Framework:** Flutter (multi-platform, hot-reload, performance)
- **State Management:** Riverpod (type-safe, testável)
- **Local Database:** Drift (SQLite wrapper type-safe, migrations)
- **Encryption:** AES-256-GCM via flutter_secure_storage
- **Sync Protocol:** Custom Operational Transformation com conflict resolution

### Protocolo de Sync

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTE ANDROID                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │  SQLite     │◄──►│  Sync       │◄──►│  Baileys/      │  │
│  │  Local      │    │  Engine     │    │  HTTP Client   │  │
│  └─────────────┘    └──────┬──────┘    └─────────────────┘  │
│                            │                                 │
│                     ┌──────▼──────┐                         │
│                     │  Operation  │                         │
│                     │  Log (OPLOG) │                         │
│                     └──────┬──────┘                         │
└────────────────────────────┼────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   SERVER        │
                    │                  │
                    │  ┌────────────┐  │
                    │  │ Conflict   │  │
                    │  │ Resolver   │  │
                    │  └────────────┘  │
                    │  ┌────────────┐  │
                    │  │ PostgreSQL │  │
                    │  │ (Source    │  │
                    │  │ of Truth)  │  │
                    │  └────────────┘  │
                    └─────────────────┘
```

### Estrutura do Operation Log (OPLOG)

```json
{
  "id": "uuid-v4",
  "entity_type": "patient|appointment|anamnesis",
  "entity_id": "uuid-v4",
  "operation": "CREATE|UPDATE|DELETE",
  "payload": { ... },
  "timestamp": 1709510400000,
  "vector_clock": { "device_id": 42 },
  "checksum": "sha256-hash",
  "synced": false
}
```

### Resolução de Conflitos

**Estratégia:** Last-Write-Wins com Vector Clock para detecção, exceto para:

- **Conflitos de agendamento:** Notificar usuário para resolver manualmente
- **Dados clínicos:** Merge automático apenas para campos não-confidentes, resto manual
- **Delete vs Update:** Delete wins (conservador para compliance)

**Regras de Negócio:**

1. Server é source of truth após sync
2. Client não pode fazer "hard delete" — apenas soft delete com flag
3. Toda operação local gera OPLOG entry
4. Sync em foreground para operações críticas (agendamento), background para o resto

### Segurança Offline

- **Criptografia at-rest:** SQLCipher ou AES-256 via flutter_secure_storage
- **Autenticação:** PIN local + biometric (opcional) para desbloquear app
- **Chave de cifra:** Derivada de PIN + device-specific key (Keychain/Keystore)
- **Wipe automático:** Após 10 tentativas de PIN falhas
- **Zero dados sensíveis em memória após logout**

### UX Offline

- **Indicador de status:** Badge "Online" / "Offline" / "Sincronizando"
- **Queue visual:** Lista de operações pendentes visível ao usuário
- **Rollback manual:** Usuário pode desfazer operações locais antes de sync
- **Feedback proativo:** Toast "Dados salvos localmente, será sincronizado quando online"

### Cronograma

| Semana | Entregável |
|--------|------------|
| 1-2 | Setup Flutter + Drift + modelo de dados |
| 3 | Implementação de OPLOG e sync engine básico |
| 4 | Resolution de conflitos + testes de edge cases |
| 5 | Criptografia local + autenticação PIN |
| 6 | UI de sincronização + feedback ao usuário |
| 7 | Integração com API + testflight |
| 8 | QA + refinamentos + release |

---

## 7. RUBRICA DE QUALIDADE (GO/NO-GO)

### Critérios de Release — Onda 1

| # | Critério | Threshold GO | Peso |
|---|----------|--------------|------|
| 1 | **Uptime** | ≥ 99.5% em staging (30 dias) | Crítico |
| 2 | **Latência P95** | < 500ms para API, < 2s para sync | Crítico |
| 3 | **Cobertura de testes** | ≥ 70% (unit + integration) | Alto |
| 4 | **Security scan** | Zero high/critical vulnerabilities | Crítico |
| 5 | **Code review** | Aprovação por ≥ 1 senior | Alto |
| 6 | **Observabilidade** | Tracing, métricas, logs completos | Alto |
| 7 | **Documentação** | API docs + runbooks + deploy guide | Médio |
| 8 | **Performance offline** | App funcional offline por 24h | Crítico |
| 9 | **Sync success rate** | ≥ 99% sync bem-sucedido | Alto |
| 10 | **LGPD compliance** | Consentimento, portabilidade, exclusão | Crítico |

### Checklist GO

- [ ] Todos os testes passando (CI verde)
- [ ] SonarQube sem blocker/critical issues
- [ ] OWASP ZAP scan limpo
- [ ] Load test com 1000 req/s sem degradação
- [ ] Chaos monkey test (simular falha de 1 serviço)
- [ ] Rollback procedure documentada e testada
- [ ] Post-mortem template preparado

### Checklist NO-GO (Bloqueia Release)

- [ ] Qualquer vulnerability crítico aberto
- [ ] Dados de pacientes expostos em logs
- [ ] Rate limiter desabilitado "por enquanto"
- [ ] Credenciais no código
- [ ] Backup não testado
- [ ] Sem monitoring para serviço crítico
- [ ] Documentação faltando ou incompleta

---

## 8. 3 PROPOSTAS DE "EFEITO UAU" (IA)

### Proposta A: Assistente de Triagem via WhatsApp

**Descrição:** Paciente manda "estou com dor de cabeça há 3 dias" → IA faz perguntas estruturadas → sugere especialidade + agenda automaticamente.

**Tecnologia:** OpenAI GPT-4 + fine-tuning com dados de triagem clínica.

**Impacto:** Redução de 40% no tempo de triagem humana. Aumento de 25% em agendamentos.

**Custo:** $3k-5k/mês (inferência) + 2 semanas de desenvolvimento.

**ROI Esperado:** Em 6 meses, retorno > 10x via redução de equipe + aumento de conversão.

**Defensibilidade:** Base de conhecimento proprietária + feedback loop contínuo.

**Veredicto:** **VENCEDOR** — Implementar inmediatamente. Menor custo, maior impacto mensurável, integração natural com WhatsApp (canal já existente).

---

### Proposta B: Geração Automática de Prontuário/Anamnese

**Descrição:** IA transcreve consulta via áudio (ou analisa chat) e gera estrutura de prontuário preenchida automaticamente.

**Tecnologia:** Whisper API (transcrição) + GPT-4 (estruturação).

**Impacto:** Redução de 60% em tempo de documentação por consulta.

**Custo:** $5k-8k/mês + 3 semanas desenvolvimento.

**ROI:** Retorno em 9 meses via economia de tempo médico.

**Defensibilidade:** Média — depends on prompt engineering quality.

---

### Proposta C: Predição de No-Show e Churn

**Descrição:** ML model que prediz quais pacientes não aparecerão ou cancelarão, permitindo outreach proativo.

**Tecnologia:** scikit-learn ou similar + feature store.

**Impacto:** Redução de 30% em no-shows, aumento de 15% em retenção.

**Custo:** $2k/mês (compute) + 4 semanas (data engineering + training).

**ROI:** Retorno em 12 meses (longo prazo).

**Veredicto:** **ADiar** — Executar na Onda 2, quando dados suficientes existirem.

---

### Justificativa Econômica Proposta A

- **Custo mensal:** $3,000 (200k tokens/dia × $0.015/1k)
- **Economia mensal:** ~$2,000 (1 função de triagem menos)
- **Receita incremental:** ~$5,000/mês (mais agendamentos)
- **Net monthly:** $4,000 positivo
- **Payback:** Imediato (margem já positiva no mês 1)

---

## 9. BACKLOG EXECUTÁVEL 14 DIAS

### Sprint 1 (Dias 1-7)

| # | Tarefa | Owner | Dependência | Critério de Aceite |
|---|--------|-------|-------------|-------------------|
| 1 | Implementar JWT com refresh token rotation | Backend | — | Token rotaciona automaticamente após uso, TTL < 15min |
| 2 | Setup OpenTelemetry (tracing + métricas) | DevOps | — | 100% endpoints cobertos, dashboards no Grafana |
| 3 | Implementar rate limiting por tenant | Backend | 1 | Rate limits configuráveis por plano, IP + token |
| 4 | One-click deploy script (Docker Compose) | DevOps | — | Deploy em < 15min em VPS virgem |
| 5 | CRUD pacientes + agendamentos | Backend | — | POST/GET/PUT/DELETE funcionando com validação |
| 6 | Setup CI/CD com testes automatizados | DevOps | 5 | Pipeline verde em merge, coverage report |
| 7 | Android: setup Flutter + estrutura | Mobile | — | App compila, navega entre telas mockadas |

### Sprint 2 (Dias 8-14)

| # | Tarefa | Owner | Dependência | Critério de Aceite |
|---|--------|-------|-------------|-------------------|
| 8 | Webhook com HMAC signature + dedup | Backend | 1 | Headers validados, replay attack impossível |
| 9 | SDKs auto-gerados (TS + Python) | Backend | 5 | Pacotes publicados, exemplo funcionando |
| 10 | Android: SQLite local com Drift | Mobile | 7 | Dados persistem offline, criptografia ativa |
| 11 | AI Triagem via WhatsApp (MVP) | Backend | — | Fluxo completo: mensagem → triagem → sugestão |
| 12 | Audit log append-only | Backend | 5 | Log imutável, exportável, compliance-ready |
| 13 | Dashboard básico admin | Frontend | 5 | Visualização de métricas, usuários, config |
| 14 | Documentação de API (OpenAPI) | Backend | 5 | Spec completa, validador online funcionando |

### Métricas do Sprint

- **Velocity:** Story points adaptados ao team
- **Cycle Time:** < 4 dias por tarefa
- **Bug Rate:** < 3 bugs/sprint (severidade média+)
- **Code Review:** < 24h de turnaround

### Priorização

**Must Have (executar):** 1, 2, 3, 5, 7, 8, 11

**Should Have (se der tempo):** 4, 6, 9, 10, 12

**Could Have (próximo sprint):** 13, 14

---

## RESUMO EXECUTIVO

- **Tese central:** Modular monolith + Android-first + AI como produto
- **Onda 1 (30 dias):** Fundação operacional com todos os CRUDs, auth, e AI triagem
- **Diferenciação:** Open-source real + sync offline + deploy anywhere
- **Risco principal:** Complexidade de sync offline + vendor lock-in AI
- **Go/No-Go:** Uptime 99.5%, zero vulnerabilidades críticas, cobertura 70%

**Próximos passos imediatos:**

1. Aprovação deste documento
2. Setup de tasks no tracker
3. Kick-off Sprint 1
4. Daily standups apartir de amanhã
