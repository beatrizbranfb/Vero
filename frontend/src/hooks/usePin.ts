"use client";

import { useCallback, useState } from "react";

/** PIN numérico curto (RF01). Diferente do valor em R$, aceita zero no começo. */
export function usePin(tamanho = 4) {
  const [pin, setPin] = useState("");

  const digitar = useCallback(
    (digito: string) =>
      setPin((atual) => (/^\d$/.test(digito) && atual.length < tamanho ? atual + digito : atual)),
    [tamanho],
  );
  const apagar = useCallback(() => setPin((atual) => atual.slice(0, -1)), []);
  const limpar = useCallback(() => setPin(""), []);

  return { pin, tamanho, completo: pin.length === tamanho, digitar, apagar, limpar };
}
