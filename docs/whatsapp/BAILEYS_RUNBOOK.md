# BAILEYS RUNBOOK (Operação + Recuperação)

## 1) Objetivo
Garantir operação resiliente do WhatsApp no L2 Core OS com reconexão automática, QR controlado e forwarding inbound confiável.

## 2) Endpoints operacionais
- `GET /health` -> status do gateway
- `GET /session/status` -> estado da sessão (connected/disconnected/qr_ready)
- `GET /session/qr` -> QR atual (quando disponível)
- `POST /session/connect` -> força reconexão
- `POST /outbound/send` -> envio de mensagem
- `POST /simulate/inbound` -> teste de pipeline inbound

## 3) Fluxo de conexão
1. Serviço inicia e tenta `connectWhatsApp()`.
2. Se precisar autenticar, gera QR (`qr_ready`).
3. Após scan, status vira `connected`.
4. Mensagens inbound são encaminhadas para `api/webhooks/whatsapp/inbound`.

## 4) Estratégia anti-queda
- reconexão com backoff exponencial até 30s
- persistência de credenciais em `/.auth/<SESSION_NAME>`
- distinção de erro `loggedOut` (exige novo QR)

## 5) Procedimento para erro 503 intermitente
Quando ocorrer desconexão/503:
1. Verificar `GET /session/status`
2. Se `disconnected`, chamar `POST /session/connect`
3. Se `loggedOut`, solicitar novo QR via `GET /session/qr`
4. Validar reabertura com `GET /health` (`status=connected`)

## 6) Checklist de produção
- backup do diretório `.auth`
- monitorar taxa de reconexão por hora
- alertar se `reconnect_attempts` > 8
- manter relógio do host sincronizado (NTP)
