// O valor digitado é guardado como uma sequência de dígitos que representa
// centavos: "1250" → 1250 centavos → R$ 12,50. Assim não há vírgula para o
// usuário posicionar e não há erro de arredondamento com números decimais.

/** 8 dígitos = até R$ 999.999,99. */
export const MAX_DIGITOS = 8;

const formatadorReal = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formata centavos em reais: 1250 → "R$ 12,50". */
export function formatarCentavos(centavos: number): string {
  // O Intl separa "R$" do número com espaço não separável; trocamos por um
  // espaço comum para o texto ser igual em qualquer navegador e nos testes.
  return formatadorReal.format(centavos / 100).replace(/ /g, " ");
}

/** Acrescenta um dígito ao final. Ignora zeros à esquerda e o que passar do limite. */
export function adicionarDigito(digitos: string, digito: string, maxDigitos = MAX_DIGITOS): string {
  if (!/^\d$/.test(digito)) return digitos;
  if (digitos.length >= maxDigitos) return digitos;
  if (digitos === "" && digito === "0") return digitos;
  return digitos + digito;
}

export function removerUltimoDigito(digitos: string): string {
  return digitos.slice(0, -1);
}

export function digitosParaCentavos(digitos: string): number {
  return digitos === "" ? 0 : Number(digitos);
}
