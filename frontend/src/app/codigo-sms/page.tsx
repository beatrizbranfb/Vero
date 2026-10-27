import type { Metadata } from "next";
import Link from "next/link";

import { Cabecalho } from "@/components/Cabecalho";
import {
  botaoCabecalhoContorno,
  botaoContorno,
  botaoPrimario,
  cartao,
  pagina,
  subtituloTela,
  tituloTela,
} from "@/lib/estilos";

export const metadata: Metadata = {
  title: "Código de confirmação · Vero",
};

type Props = {
  searchParams: Promise<{ recuperar?: string }>;
};

// Usada no cadastro (passo 2 de 3) e no "Esqueceu sua senha?" (?recuperar=1).
export default async function CodigoSmsPage({ searchParams }: Props) {
  const recuperar = (await searchParams).recuperar !== undefined;
  const voltar = recuperar ? "/login" : "/cadastro";

  return (
    <div className={pagina}>
      <Cabecalho
        acao={
          <Link href={voltar} className={botaoCabecalhoContorno}>
            Voltar
          </Link>
        }
      />

      <main className={`${cartao} mx-auto max-w-[520px]`}>
        <span className="font-bold text-ardosia">
          {recuperar ? "Recuperar senha · Passo 1 de 2" : "Passo 2 de 3"}
        </span>
        <h1 className={`${tituloTela} mt-1`}>
          {recuperar ? "Código para recuperar a senha" : "Código de confirmação"}
        </h1>
        <p className={subtituloTela}>Digite o código de 6 números enviado por SMS para seu celular:</p>

        <label htmlFor="codigo" className="sr-only">
          Código recebido por SMS
        </label>
        <input
          id="codigo"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          defaultValue="000000"
          className="min-h-14 w-full rounded-2xl border-[3px] border-violeta bg-nevoa px-4 py-3 text-center text-[32px] font-extrabold tracking-[8px] outline-none focus:bg-white focus:shadow-[0_0_0_4px_var(--color-lavanda)]"
        />

        <div className="mt-6 flex flex-col gap-3">
          <Link href={recuperar ? "/criar-pin?recuperar=1" : "/criar-pin"} className={botaoPrimario}>
            Confirmar código
          </Link>
          <Link href={voltar} className={botaoContorno}>
            {recuperar ? "Voltar para o login" : "Corrigir número de celular"}
          </Link>
        </div>
      </main>
    </div>
  );
}
