---
name: verification-before-completion
description: Protocolo de verificação de "Prontidão para Combate" no L2 CORE OS. Garante que a funcionalidade está estável, visualmente correta e pronta para o usuário final.
---

# L2 CORE OS Readiness Verification

## Checklist de Prontidão
Antes de dar uma tarefa como concluída:

1. **Integridade Sistêmica**: O `docker-compose` está rodando sem erros nos logs?
2. **Interatividade (Click-Test)**: No Calendário/Pipeline, os botões respondem? O estado muda dinamicamente sem refresh de página?
3. **Experiência do Leigo**: A interface é autoexplicativa? O botão de WhatsApp funciona de primeira?
4. **Cross-Reference Check**: A mudança na Agenda não quebrou a visualização na Pipeline de Clientes?
5. **Auto-Certificação**: Rode o `infra/scripts/e2e-go-no-go.ps1` se disponível.
