---
name: writing-plans
description: Cria planos de execução cirúrgicos para o L2 CORE OS. Garante que mudanças na UI (React) estejam sincronizadas com as rotas da API e as automações do Baileys.
---

# L2 CORE OS Strategic Planning

## Diretrizes de Planejamento
Ao planejar mudanças (ex: Reformular o Calendário ou a Pipeline de Clientes):

1. **User-Centric Design (Foco Leigo)**: Cada passo deve priorizar a simplicidade visual e clareza de interatividade (botões clicáveis, feedback visual).
2. **Sincronia API-UI**: Sempre planeje a rota da API (FastAPI) *antes* ou *junto* com o componente visual (React).
3. **Fluxo de Automação**: Se houver um botão de "Confirmar via WhatsApp", o plano deve incluir a lógica de disparo no `baileys-gateway`.
4. **Comando de Controle**: Use sempre o `l2-control.bat` para gerenciar os restarts necessários durante a implementação.

## Estrutura do Plano
- **Objetivo**: O que o usuário leigo ganhará com isso?
- **Fase Técnica**: Mudanças no Backend/DB.
- **Fase Visual**: Reconstrução da UI (Shadcn/Tailwind).
- **Fase de Verificação**: Teste de ponta a ponta (E2E).
