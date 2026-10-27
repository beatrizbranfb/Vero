import { describe, expect, it } from "vitest";

import {
  escalaDoGrafico,
  fracaoDisponivel,
  mensagemDisponivel,
  nivelDisponivel,
  puloDosRotulos,
  saldoPorDia,
  totalEntradas,
  type Lancamento,
} from "./lancamentos";

const itens: Lancamento[] = [
  { id: 1, dia: 1, tipo: "entrada", centavos: 200000, categoria: "Entrada" },
  { id: 2, dia: 3, tipo: "gasto", centavos: 25000, categoria: "Contas" },
  { id: 3, dia: 3, tipo: "gasto", centavos: 5000, categoria: "Mercado" },
  { id: 4, dia: 5, tipo: "entrada", centavos: 10000, categoria: "Entrada" },
];

describe("saldoPorDia", () => {
  it("acumula receitas menos gastos em cada dia", () => {
    expect(saldoPorDia(itens, 5)).toEqual([
      { dia: 1, saldo: 200000 },
      { dia: 2, saldo: 200000 },
      { dia: 3, saldo: 170000 },
      { dia: 4, saldo: 170000 },
      { dia: 5, saldo: 180000 },
    ]);
  });

  it("ignora lançamentos depois do dia pedido", () => {
    expect(saldoPorDia(itens, 2).at(-1)).toEqual({ dia: 2, saldo: 200000 });
  });

  it("aceita saldo negativo", () => {
    const gastos: Lancamento[] = [{ id: 1, dia: 1, tipo: "gasto", centavos: 1250, categoria: "Mercado" }];
    expect(saldoPorDia(gastos, 1)).toEqual([{ dia: 1, saldo: -1250 }]);
  });
});

describe("indicador do quanto ainda está disponível", () => {
  it("soma só as entradas", () => {
    expect(totalEntradas(itens)).toBe(210000);
  });

  it.each([
    [150000, 200000, 0.75],
    [-100, 200000, 0],
    [300000, 200000, 1],
    [5000, 0, 0],
  ])("saldo %i de %i entradas → %f", (saldo, entradas, esperado) => {
    expect(fracaoDisponivel(saldo, entradas)).toBe(esperado);
  });

  it.each([
    [0.8, "bom", /mais da metade/i],
    [0.4, "atencao", /menos da metade/i],
    [0.1, "critico", /acabando/i],
    [0, "critico", /gastou todo/i],
  ])("%f → %s", (fracao, nivel, frase) => {
    expect(nivelDisponivel(fracao)).toBe(nivel);
    expect(mensagemDisponivel(fracao)).toMatch(frase);
  });
});

describe("escala do gráfico", () => {
  it("usa múltiplos de R$ 100 com folga de um passo", () => {
    expect(escalaDoGrafico([177000, 287000, 200000])).toEqual({ minimo: 160000, maximo: 300000, passos: 14 });
  });

  it("não desce abaixo de zero quando não há saldo negativo", () => {
    expect(escalaDoGrafico([5000, 20000]).minimo).toBe(0);
  });

  it("desce abaixo de zero quando o saldo fica negativo", () => {
    expect(escalaDoGrafico([-5000, 20000]).minimo).toBe(-20000);
  });

  it("escreve o valor em toda linha quando cabe, senão pula", () => {
    expect(puloDosRotulos(310, 14)).toBe(1);
    expect(puloDosRotulos(310, 30)).toBe(2);
  });
});
