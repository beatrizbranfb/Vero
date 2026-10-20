# Relatório de QA da Sprint 1

Período planejado: 07/10–11/10 · Situação em 20/10 · Responsável: Beatriz (QA)

## Resumo

A Sprint 1 não pôde ser validada em staging. Ainda não existe ambiente de staging nem frontend, e o backend
commitado na `dev` foi feito em Django, enquanto o Documento de Arquitetura define FastAPI. Os responsáveis
pelo back estão reescrevendo o código, então os critérios de aceite ficam pendentes até a nova versão chegar à `dev`.

## Situação dos cartões

| Cartão | Coluna no Trello | Situação na QA |
|---|---|---|
| RF03 · Cadastro por celular | Em QA | ⏳ Implementado em Django (PR #2), será refeito em FastAPI |
| RF01 · Acesso por PIN | Em Desenvolvimento | ⏳ Não entregue |
| RF19 · Saldo na tela inicial | Em Desenvolvimento | ⏳ Não entregue |
| RF08 · Teclado numérico | A Fazer | ⏳ Não iniciado |
| RF09 · Categorias por ícones | A Fazer | ⏳ Não iniciado |
| RNF01 · Acessibilidade WCAG | A Fazer | ⏳ Não iniciado |
| RNF02 · Guia de linguagem | A Fazer | ⏳ Não iniciado |
| RNF03 · Responsividade | A Fazer | ⏳ Não iniciado |

## O que passou

- Pipeline de CI/CD com Dependabot, CodeQL e secret scanning (cartão [S0], em Pronto).
- Proteção das branches: `main` exige PR com aprovação e CI verde; `dev` exige PR aprovado pela QA, pelo Scrum Master ou pelo PO.

## O que ficou para a próxima sprint

- Todos os cartões funcionais da S1, que passam a ser regressão obrigatória da S2.
- Ambiente de staging (pré-requisito para qualquer validação de aceite).
- Execução da suíte E2E (`e2e/`), que já está escrita e aguarda o frontend.
- Execução do roteiro manual de acessibilidade.

## Riscos

- **Stack divergente da arquitetura:** o código em Django na `dev` precisa ser substituído antes de novas features, para não acumular retrabalho.
- **Sem staging:** sem ele, o rito de QA de domingo não acontece. Sugestão: subir staging junto com o primeiro endpoint em FastAPI.
- **Acúmulo de sprints:** a S2 começa com 8 cartões herdados da S1, e a S3 tem prova em 21/10.

## Bugs registrados

Nenhum até agora (nada foi entregue em staging para testar).
