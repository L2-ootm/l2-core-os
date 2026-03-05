# PRODUCT NOTES — Próximas Atualizações (input do Davi)

## 1) IA local: verificação pré-instalação mais robusta
Antes de perguntar ao usuário se deseja instalar IA local, o sistema deve rodar um preflight mais realista de capacidade operacional, considerando ambiente real de clínica.

### Requisitos do preflight v2
- Medir RAM/CPU **com carga real** (simular cenário com múltiplas abas/programas abertos)
- Rodar benchmark de inferência curta por 3-5 minutos
- Detectar degradação de latência (p95/p99) e uso de swap
- Só oferecer instalação se passar em todos os gates mínimos

## 2) IA funcional por blocos (não chat livre)
Caso IA seja instalada, preferir arquitetura de módulos funcionais já testados/validados, em vez de UI de chat aberta.

### Diretriz de UX/Produto
- Interface com **botões e fluxos fechados** por função
- Exemplos de blocos:
  - Confirmar consulta
  - Cancelar consulta
  - Remarcar consulta
  - Classificar urgência para revisão humana
- Evitar “chat genérico” como interface principal

### Benefícios
- Menor risco de respostas fora de escopo
- Mais previsibilidade operacional
- Melhor treinamento/validação por função específica

## Status
- Nota registrada para backlog de evolução do L2 CORE OS.
