import type { Metadata } from "next";
import Link from "next/link";

import { Cabecalho } from "@/components/Cabecalho";
import { botaoCabecalho, cartao, pagina } from "@/lib/estilos";

import { AnotarLancamento } from "./AnotarLancamento";

export const metadata: Metadata = {
  title: "Anotar gasto · Vero",
};

export default function AnotarGastoPage() {
  return (
    <div className={pagina}>
      <Cabecalho
        acao={
          <Link href="/inicio" className={botaoCabecalho}>
            Cancelar
          </Link>
        }
      />

      <main className={`${cartao} mx-auto max-w-[520px]`}>
        <AnotarLancamento />
      </main>
    </div>
  );
}
