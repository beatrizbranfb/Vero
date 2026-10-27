import Link from "next/link";
import type { ReactNode } from "react";

import { foco } from "@/lib/estilos";

export function IconeVero({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 36 36"
      className={`fill-none stroke-violeta stroke-[5] ${className ?? ""}`}
    >
      <path d="M6 18.5L14.5 27L30 9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Props = {
  /** Botão do canto direito (Sair, Cancelar, Voltar...). */
  acao?: ReactNode;
};

export function Cabecalho({ acao }: Props) {
  return (
    <header className="mb-6 flex items-center justify-between gap-3 border-b-2 border-lavanda pb-5">
      <Link
        href="/inicio"
        className={`inline-flex items-center gap-2.5 font-titulo text-[30px] font-black text-violeta ${foco}`}
      >
        <IconeVero className="size-[34px]" />
        Vero
      </Link>
      {acao}
    </header>
  );
}
