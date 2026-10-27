import { describe, expect, it } from "vitest";

import {
  MAX_DIGITOS,
  adicionarDigito,
  digitosParaCentavos,
  formatarCentavos,
  removerUltimoDigito,
} from "./moeda";

describe("formatarCentavos", () => {
  it.each([
    [0, "R$ 0,00"],
    [5, "R$ 0,05"],
    [1250, "R$ 12,50"],
    [100000, "R$ 1.000,00"],
    [99999999, "R$ 999.999,99"],
  ])("%i centavos → %s", (centavos, esperado) => {
    expect(formatarCentavos(centavos)).toBe(esperado);
  });

  it("usa espaço comum entre R$ e o número", () => {
    expect(formatarCentavos(1250)).not.toContain(" ");
  });
});

describe("adicionarDigito", () => {
  it("acrescenta dígitos ao final", () => {
    const digitos = ["1", "2", "5", "0"].reduce((acc, d) => adicionarDigito(acc, d), "");
    expect(digitos).toBe("1250");
  });

  it("ignora zero à esquerda", () => {
    expect(adicionarDigito("", "0")).toBe("");
    expect(adicionarDigito("1", "0")).toBe("10");
  });

  it("ignora o que não é um único dígito", () => {
    expect(adicionarDigito("1", "a")).toBe("1");
    expect(adicionarDigito("1", "12")).toBe("1");
    expect(adicionarDigito("1", ",")).toBe("1");
  });

  it(`não passa de ${MAX_DIGITOS} dígitos`, () => {
    const cheio = "9".repeat(MAX_DIGITOS);
    expect(adicionarDigito(cheio, "1")).toBe(cheio);
  });
});

describe("removerUltimoDigito e digitosParaCentavos", () => {
  it("apaga o último dígito", () => {
    expect(removerUltimoDigito("1250")).toBe("125");
    expect(removerUltimoDigito("")).toBe("");
  });

  it("vazio vale zero", () => {
    expect(digitosParaCentavos("")).toBe(0);
    expect(digitosParaCentavos("1250")).toBe(1250);
  });
});
