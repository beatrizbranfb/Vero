# Sprint 1: roteiro manual de acessibilidade

Segue o roteiro da seção 2 do [plano de testes](../plano-de-testes.md). Repetir para cada tela da S1:
**Cadastro**, **Verificação do código**, **Criação do PIN**, **Login com PIN**, **Registrar gasto** (teclado + categorias) e **Tela inicial (saldo)**.

Ambiente: staging · Dispositivo/navegador: __________ · Data: ____/____

## 1. Leitor de tela (TalkBack no Android ou NVDA no Windows)

- [ ] Título da tela anunciado ao abrir
- [ ] Todo botão é anunciado com nome compreensível (nada de "botão" sem nome)
- [ ] Teclas do teclado numérico anunciadas como números ("um", "dois"…, "apagar")
- [ ] Ícones de categoria anunciados pelo rótulo ("Mercado", "Farmácia"…)
- [ ] Campos com rótulo associado ("Número do celular", "Nome")
- [ ] Mensagens de erro e de confirmação anunciadas sem precisar mover o foco (`aria-live`)
- [ ] Saldo anunciado com valor e moeda ("Disponível no mês: 120 reais")
- [ ] Ordem de leitura segue a ordem visual

## 2. Zoom de 200% (navegador desktop, 1280px)

- [ ] Nenhum texto cortado, sobreposto ou escondido
- [ ] Sem rolagem horizontal
- [ ] Teclado numérico continua utilizável
- [ ] Saldo da tela inicial continua legível e inteiro

## 3. Celular 360px (aparelho real ou DevTools em 360×800)

- [ ] Sem rolagem horizontal em nenhuma tela
- [ ] Alvos de toque ≥ 44×44px (teclas, categorias, botões)
- [ ] Teclado numérico próprio cabe inteiro na tela
- [ ] Teclado do sistema não cobre o botão de confirmar

## 4. Complementares

- [ ] Navegação só com teclado (Tab/Shift+Tab/Enter): foco visível e ordem lógica
- [ ] Contraste de texto ≥ 4.5:1 (conferir com a extensão axe DevTools ou o Lighthouse)
- [ ] Linguagem sem termos contábeis ou técnicos (RNF02)

## Resultado por tela

| Tela | Leitor de tela | Zoom 200% | 360px | Issues |
|---|---|---|---|---|
| Cadastro | | | | |
| Verificação do código | | | | |
| Criação do PIN | | | | |
| Login com PIN | | | | |
| Registrar gasto | | | | |
| Tela inicial (saldo) | | | | |

Cada falha vira issue com o template **Bug** (rótulo `bug`).
