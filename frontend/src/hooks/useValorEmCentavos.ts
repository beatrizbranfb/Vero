"use client";

import { useCallback, useState } from "react";

import {
  MAX_DIGITOS,
  adicionarDigito,
  digitosParaCentavos,
  formatarCentavos,
  removerUltimoDigito,
} from "@/lib/moeda";

/** Estado do valor digitado no teclado numérico (US03 / RF08). */
export function useValorEmCentavos(maxDigitos = MAX_DIGITOS) {
  const [digitos, setDigitos] = useState("");

  const digitar = useCallback(
    (digito: string) => setDigitos((atual) => adicionarDigito(atual, digito, maxDigitos)),
    [maxDigitos],
  );
  const apagar = useCallback(() => setDigitos(removerUltimoDigito), []);
  const limpar = useCallback(() => setDigitos(""), []);

  const centavos = digitosParaCentavos(digitos);

  return {
    centavos,
    valorFormatado: formatarCentavos(centavos),
    /** Valor zero ou vazio não pode ser salvo. */
    podeSalvar: centavos > 0,
    atingiuLimite: digitos.length >= maxDigitos,
    digitar,
    apagar,
    limpar,
  };
}
