# Sprint 1: validação dos critérios de aceite

Ambiente: staging · Data da validação: ____/____ · Responsável: Beatriz (QA)

Legenda: ✅ passou · ❌ falhou (abrir issue) · ⏳ não entregue · ➖ não se aplica

## RF03 · Cadastro por número de celular

| # | Critério | Status | Issue / observação |
|---|---|---|---|
| 1 | Cadastro pede só celular (com DDD) e nome, sem e-mail obrigatório | | |
| 2 | Número validado no formato BR | | |
| 3 | Número verificado por código (SMS ou WhatsApp) | | |
| 4 | Número já cadastrado mostra mensagem clara oferecendo "Entrar" | | |
| 5 | Telefone armazenado protegido e ausente dos logs (RNF05) | | |

## RF01 · Acesso por PIN numérico curto

| # | Critério | Status | Issue / observação |
|---|---|---|---|
| 1 | PIN numérico criado no cadastro (tamanho definido pelo time) | | |
| 2 | Teclado numérico grande na tela de login | | |
| 3 | PIN guardado com hash (bcrypt/argon2), nunca em texto puro | | |
| 4 | Bloqueio temporário após N tentativas erradas, com mensagem simples | | |
| 5 | Fluxo "Esqueci meu PIN" via verificação do celular | | |

## RF08 · Digitação em teclado numérico

| # | Critério | Status | Issue / observação |
|---|---|---|---|
| 1 | Teclado próprio com botões ≥ 44px e alto contraste | | |
| 2 | Valor exibido em R$ enquanto digita (1250 → R$ 12,50) | | |
| 3 | Botão de apagar visível | | |
| 4 | Valor zero ou vazio não pode ser salvo | | |
| 5 | Funciona em celular de 360px | | |

## RF09 · Seleção de categoria por ícones

| # | Critério | Status | Issue / observação |
|---|---|---|---|
| 1 | Categoria obrigatória no registro manual | | |
| 2 | Cada categoria tem ícone + rótulo curto | | |
| 3 | Ícones com texto alternativo para leitor de tela | | |
| 4 | Lista de categorias definida num único lugar do back-end (mesma do RF12) | | |

## RF19 · Saldo disponível na tela inicial

| # | Critério | Status | Issue / observação |
|---|---|---|---|
| 1 | Tela inicial mostra "Disponível no mês" em fonte grande | | |
| 2 | Saldo = receitas − gastos do mês, com testes unitários (virada de mês, negativos) | | |
| 3 | Saldo atualiza logo após registrar um gasto manual | | |
| 4 | Legível com zoom de 200% sem quebrar o layout | | |

## RNF01 · Acessibilidade WCAG 2.1 AA

| # | Critério | Status | Issue / observação |
|---|---|---|---|
| 1 | Guia de estilo: contraste ≥ 4.5:1, corpo ≥ 16px, tamanho mínimo de botão, foco visível | | |
| 2 | Componentes base acessíveis (botão, campo, teclado numérico, confirmação) | | |
| 3 | Teste axe automatizado rodando no CI | | |

## RNF02 · Simplicidade linguística

| # | Critério | Status | Issue / observação |
|---|---|---|---|
| 1 | `docs/linguagem.md` com regras e lista de palavras proibidas/substitutas | | |
| 2 | Mensagens de erro no formato "o que aconteceu + o que fazer" | | |
| 3 | Textos de cada tela revisados pela QA | | |

## RNF03 · Aplicativo responsivo

| # | Critério | Status | Issue / observação |
|---|---|---|---|
| 1 | Testado em 360px, 768px e 1280px | | |
| 2 | Sem rolagem horizontal | | |
| 3 | Testes E2E em viewport de celular no CI | | |
| 4 | Funciona em Chrome Android e Safari iOS | | |
