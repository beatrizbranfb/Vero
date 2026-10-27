// Regras do mês: saldo dia a dia, quanto do dinheiro ainda está disponível
// e a escala do gráfico. Todos os valores em centavos, como em moeda.ts.

export type TipoLancamento = "gasto" | "entrada";

export type Lancamento = {
  id: number;
  dia: number;
  tipo: TipoLancamento;
  centavos: number;
  categoria: string;
};

export type PontoSaldo = { dia: number; saldo: number };

/** Saldo ao fim de cada dia, do dia 1 até `ateDia` (receitas − gastos acumulados). */
export function saldoPorDia(itens: Lancamento[], ateDia: number): PontoSaldo[] {
  const pontos: PontoSaldo[] = [];
  let saldo = 0;
  for (let dia = 1; dia <= ateDia; dia++) {
    for (const item of itens) {
      if (item.dia !== dia) continue;
      saldo += item.tipo === "entrada" ? item.centavos : -item.centavos;
    }
    pontos.push({ dia, saldo });
  }
  return pontos;
}

export function totalEntradas(itens: Lancamento[]): number {
  return itens.filter((i) => i.tipo === "entrada").reduce((total, i) => total + i.centavos, 0);
}

/** Parte do dinheiro que entrou no mês que ainda está disponível, de 0 a 1. */
export function fracaoDisponivel(saldo: number, entradas: number): number {
  if (entradas <= 0) return 0;
  return Math.max(0, Math.min(1, saldo / entradas));
}

export type NivelDisponivel = "bom" | "atencao" | "critico";

export function nivelDisponivel(fracao: number): NivelDisponivel {
  if (fracao > 0.5) return "bom";
  if (fracao > 0.25) return "atencao";
  return "critico";
}

/** Frase do indicador, para não depender da leitura de números. */
export function mensagemDisponivel(fracao: number): string {
  if (fracao > 0.5) return "Mais da metade do seu dinheiro continua disponível.";
  if (fracao > 0.25) return "Menos da metade do seu dinheiro continua disponível.";
  if (fracao > 0) return "Seu dinheiro do mês está acabando.";
  return "Você já gastou todo o dinheiro do mês.";
}

/** R$ 100,00 entre cada linha da grade do gráfico. */
export const PASSO_ESCALA = 10000;

/** Limites do eixo do gráfico em múltiplos de R$ 100, com folga de um passo. */
export function escalaDoGrafico(valores: number[]): { minimo: number; maximo: number; passos: number } {
  const menor = Math.min(...valores);
  const maior = Math.max(...valores);
  let minimo = Math.floor(menor / PASSO_ESCALA) * PASSO_ESCALA - PASSO_ESCALA;
  if (menor >= 0) minimo = Math.max(0, minimo);
  const maximo = Math.ceil(maior / PASSO_ESCALA) * PASSO_ESCALA + PASSO_ESCALA;
  return { minimo, maximo, passos: (maximo - minimo) / PASSO_ESCALA };
}

/**
 * A cada quantas linhas da grade um valor é escrito: em todas quando cabe,
 * senão a cada 2, 5, 10... para os textos não ficarem uns por cima dos outros.
 */
export function puloDosRotulos(alturaPx: number, passos: number, minimoPx = 20): number {
  return [1, 2, 5, 10, 20, 50].find((k) => (alturaPx / passos) * k >= minimoPx) ?? 100;
}
