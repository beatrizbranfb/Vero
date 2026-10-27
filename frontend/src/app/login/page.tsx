import type { Metadata } from "next";
import Link from "next/link";

import { Cabecalho } from "@/components/Cabecalho";
import { botaoCabecalho, cartao, pagina, subtituloTela, tituloTela } from "@/lib/estilos";

import { FormularioLogin } from "./FormularioLogin";

export const metadata: Metadata = {
  title: "Entrar · Vero",
};

export default function LoginPage() {
  return (
    <div className={pagina}>
      <Cabecalho
        acao={
          <Link href="/cadastro" className={botaoCabecalho}>
            Criar conta
          </Link>
        }
      />

      <main className={`${cartao} mx-auto max-w-[520px]`}>
        <h1 className={tituloTela}>Entrar na Vero</h1>
        <p className={subtituloTela}>
          Digite seu celular e sua senha de <strong>4 números</strong> para conferir o saldo disponível e
          anotar gastos.
        </p>
        <FormularioLogin />
      </main>
    </div>
  );
}
