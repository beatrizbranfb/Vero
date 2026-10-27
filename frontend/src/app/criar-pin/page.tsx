import type { Metadata } from "next";

import { Cabecalho } from "@/components/Cabecalho";
import { cartao, pagina, subtituloTela, tituloTela } from "@/lib/estilos";

import { FormularioCriarPin } from "./FormularioCriarPin";

export const metadata: Metadata = {
  title: "Criar PIN · Vero",
};

type Props = {
  searchParams: Promise<{ recuperar?: string }>;
};

// Usada no cadastro (passo 3 de 3) e no "Esqueceu sua senha?" (?recuperar=1).
export default async function CriarPinPage({ searchParams }: Props) {
  const recuperar = (await searchParams).recuperar !== undefined;

  return (
    <div className={pagina}>
      <Cabecalho />

      <main className={`${cartao} mx-auto max-w-[520px]`}>
        <span className="font-bold text-ardosia">
          {recuperar ? "Recuperar senha · Passo 2 de 2" : "Passo 3 de 3"}
        </span>
        <h1 className={`${tituloTela} mt-1`}>{recuperar ? "Crie seu novo PIN" : "Crie seu PIN numérico"}</h1>
        <p className={subtituloTela}>Escolha 4 números fáceis de lembrar para entrar no aplicativo:</p>
        <FormularioCriarPin recuperar={recuperar} />
      </main>
    </div>
  );
}
