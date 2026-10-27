import type { Metadata } from "next";
import Link from "next/link";

import { Cabecalho } from "@/components/Cabecalho";
import { botaoCabecalho, pagina } from "@/lib/estilos";

import { PainelInicio } from "./PainelInicio";

export const metadata: Metadata = {
  title: "Página inicial · Vero",
};

export default function InicioPage() {
  return (
    <div className={pagina}>
      <Cabecalho
        acao={
          <Link href="/login" className={botaoCabecalho}>
            Sair
          </Link>
        }
      />
      <main>
        <PainelInicio />
      </main>
    </div>
  );
}
