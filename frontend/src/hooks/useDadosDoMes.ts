"use client";

import { useCallback, useEffect, useState } from "react";

import type { Lancamento, TipoLancamento } from "@/lib/lancamentos";

// Enquanto a API de lançamentos (RF19) não existe, os dados do mês ficam no
// navegador. Valores em centavos.
const CHAVE = "vero-dados-do-mes";

type Estado = { mes: string; meta: number; itens: Lancamento[] };

export type Hoje = { mes: string; dia: number; diasNoMes: number };

function calcularHoje(): Hoje {
  const data = new Date();
  return {
    mes: `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`,
    dia: data.getDate(),
    diasNoMes: new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate(),
  };
}

// Exemplo para a tela não começar vazia.
function exemplo({ mes, dia }: Hoje): Estado {
  const ate = (d: number) => Math.min(d, dia);
  return {
    mes,
    meta: 200000,
    itens: [
      { id: 1, dia: ate(1), tipo: "entrada", centavos: 220000, categoria: "Entrada" },
      { id: 2, dia: ate(3), tipo: "gasto", centavos: 25000, categoria: "Contas" },
      { id: 3, dia: ate(6), tipo: "gasto", centavos: 18000, categoria: "Mercado" },
      { id: 4, dia: ate(10), tipo: "entrada", centavos: 110000, categoria: "Entrada" },
      { id: 5, dia: ate(14), tipo: "gasto", centavos: 21000, categoria: "Casa" },
      { id: 6, dia: ate(17), tipo: "gasto", centavos: 9000, categoria: "Transporte" },
      { id: 7, dia: Math.max(1, dia - 1), tipo: "gasto", centavos: 4500, categoria: "Farmácia" },
      { id: 8, dia, tipo: "gasto", centavos: 12000, categoria: "Mercado" },
    ],
  };
}

function carregar(hoje: Hoje): Estado {
  try {
    const salvo = JSON.parse(localStorage.getItem(CHAVE) ?? "null") as Estado | null;
    if (salvo && salvo.mes === hoje.mes) return salvo;
  } catch {
    // Armazenamento indisponível ou corrompido: usa o exemplo.
  }
  return exemplo(hoje);
}

function guardar(estado: Estado) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
  } catch {
    // Sem armazenamento (aba anônima, bloqueio): segue só na memória.
  }
}

/** Lançamentos e meta do mês atual. `estado` fica nulo até carregar no navegador. */
export function useDadosDoMes() {
  const [hoje, setHoje] = useState<Hoje | null>(null);
  const [estado, setEstado] = useState<Estado | null>(null);

  useEffect(() => {
    const agora = calcularHoje();
    setHoje(agora);
    setEstado(carregar(agora));
  }, []);

  const atualizar = useCallback((mudar: (atual: Estado) => Estado) => {
    setEstado((atual) => {
      if (!atual) return atual;
      const novo = mudar(atual);
      guardar(novo);
      return novo;
    });
  }, []);

  const adicionar = useCallback(
    (tipo: TipoLancamento, centavos: number, categoria: string) => {
      const id = Date.now();
      const dia = calcularHoje().dia;
      atualizar((atual) => ({ ...atual, itens: [...atual.itens, { id, dia, tipo, centavos, categoria }] }));
      return id;
    },
    [atualizar],
  );

  const remover = useCallback(
    (id: number) => atualizar((atual) => ({ ...atual, itens: atual.itens.filter((i) => i.id !== id) })),
    [atualizar],
  );

  const definirMeta = useCallback(
    (centavos: number) => atualizar((atual) => ({ ...atual, meta: centavos })),
    [atualizar],
  );

  return { hoje, estado, adicionar, remover, definirMeta };
}
