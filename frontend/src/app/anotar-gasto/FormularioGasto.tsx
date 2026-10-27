"use client";

import { useState, type FormEvent, type ReactNode } from "react";

import { DisplayValor } from "@/components/DisplayValor";
import { TecladoNumerico } from "@/components/TecladoNumerico";
import { useValorEmCentavos } from "@/hooks/useValorEmCentavos";
import { formatarCentavos } from "@/lib/moeda";

type Props = {
  /** Chamado com o valor em centavos. Só é chamado com valor maior que zero. */
  onSalvar?: (centavos: number) => void | Promise<void>;
  /** "entrada" troca os textos de gasto por entrada de dinheiro. */
  tipo?: "gasto" | "entrada";
  /** Conteúdo entre o teclado e o botão de salvar (ex.: categorias). */
  children?: ReactNode;
};

export function FormularioGasto({ onSalvar, tipo = "gasto", children }: Props) {
  const valor = useValorEmCentavos();
  const [confirmacao, setConfirmacao] = useState<string | null>(null);

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!valor.podeSalvar) return;

    await onSalvar?.(valor.centavos);
    setConfirmacao(
      tipo === "entrada"
        ? `Entrada de ${formatarCentavos(valor.centavos)} anotada.`
        : `Gasto de ${formatarCentavos(valor.centavos)} anotado.`,
    );
    valor.limpar();
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-5" noValidate>
      <DisplayValor
        rotulo={tipo === "entrada" ? "Valor da entrada" : "Valor do gasto"}
        valorFormatado={valor.valorFormatado}
      />

      {valor.atingiuLimite && (
        <p className="-mt-2 text-center text-base text-ardosia">O valor máximo é R$ 999.999,99.</p>
      )}

      <TecladoNumerico onDigito={valor.digitar} onApagar={valor.apagar} onLimpar={valor.limpar} />

      {children}

      <div className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={!valor.podeSalvar}
          aria-describedby={valor.podeSalvar ? undefined : "dica-salvar"}
          className="inline-flex min-h-15 w-full items-center justify-center rounded-2xl bg-violeta px-5 py-3 text-xl font-bold text-white shadow-[0_4px_14px_rgba(124,58,237,0.25)] transition-colors hover:bg-violeta-profundo focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-violeta-profundo disabled:cursor-not-allowed disabled:bg-borda disabled:text-ardosia disabled:shadow-none"
        >
          Salvar
        </button>
        {!valor.podeSalvar && (
          <p id="dica-salvar" className="text-center text-base text-ardosia">
            Digite um valor maior que zero para salvar.
          </p>
        )}
      </div>

      {/* Sempre presente no DOM para o leitor de tela anunciar quando mudar. */}
      <p role="status" className="text-center text-lg font-bold text-sucesso-texto empty:hidden">
        {confirmacao}
      </p>
    </form>
  );
}
