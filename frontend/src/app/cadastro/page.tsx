import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Cabecalho } from "@/components/Cabecalho";
import {
  botaoCabecalhoContorno,
  botaoContorno,
  botaoPrimario,
  campoTexto,
  cartao,
  pagina,
  rotuloCampo,
  subtituloTela,
  tituloTela,
} from "@/lib/estilos";

export const metadata: Metadata = {
  title: "Criar conta · Vero",
};

const icone = "size-6 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]";

function Pilar({ icone: desenho, titulo, texto }: { icone: ReactNode; titulo: string; texto: string }) {
  return (
    <div className="flex items-center gap-4 rounded-[18px] border-2 border-borda-card bg-white px-5 py-4">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-lavanda text-violeta">
        {desenho}
      </div>
      <div>
        <strong className="block">{titulo}</strong>
        <span className="block text-[17px] text-ardosia">{texto}</span>
      </div>
    </div>
  );
}

export default function CadastroPage() {
  return (
    <div className={pagina}>
      <Cabecalho
        acao={
          <Link href="/login" className={botaoCabecalhoContorno}>
            Já tenho conta
          </Link>
        }
      />

      <div className="flex w-full flex-col gap-6 min-[900px]:grid min-[900px]:grid-cols-[1.1fr_500px] min-[900px]:items-center min-[900px]:gap-12">
        {/* Apresentação em telas grandes */}
        <aside className="hidden flex-col gap-5 pr-4 min-[900px]:flex">
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-lavanda px-[18px] py-2 text-base font-bold text-violeta-profundo">
            <svg aria-hidden="true" viewBox="0 0 24 24" className={icone}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Seu dinheiro em dia, sem complicação
          </span>
          <h2 className="font-titulo text-[clamp(30px,4vw,42px)] leading-tight font-black">
            Controlar o dinheiro não precisa ser coisa de especialista.
          </h2>
          <p className="text-[19px] text-ardosia">
            A Vero ajuda você a saber quanto ainda tem disponível no mês e avisa antes de as contas vencerem,
            pelo celular ou pelo WhatsApp.
          </p>
          <Pilar
            titulo="Letras e botões grandes"
            texto="Tudo visível e confortável para ler sem esforço."
            icone={
              <svg aria-hidden="true" viewBox="0 0 24 24" className={icone}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            }
          />
          <Pilar
            titulo="Sem jargão contábil"
            texto={'Linguagem simples: "Gasto", "Entrou dinheiro" e "Saldo".'}
            icone={
              <svg aria-hidden="true" viewBox="0 0 24 24" className={icone}>
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            }
          />
        </aside>

        <main className={cartao}>
          <span className="font-bold text-ardosia">Passo 1 de 3</span>
          <h1 className={`${tituloTela} mt-1`}>Criar sua conta na Vero</h1>
          <p className={subtituloTela}>Digite seu nome e o número de celular.</p>

          <div className="mb-[18px]">
            <label className={rotuloCampo} htmlFor="nome">
              Seu nome completo
            </label>
            <input
              id="nome"
              type="text"
              autoComplete="name"
              defaultValue="Maria Teste"
              className={campoTexto}
            />
          </div>

          <div className="mb-[18px]">
            <label className={rotuloCampo} htmlFor="celular">
              Número de celular com DDD
            </label>
            <input
              id="celular"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              defaultValue="(61) 99888-7766"
              aria-describedby="dica-celular"
              className={campoTexto}
            />
            <span id="dica-celular" className="mt-1.5 block text-base text-ardosia">
              Enviaremos um código SMS para confirmar este número
            </span>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            <Link href="/codigo-sms" className={botaoPrimario}>
              Continuar
            </Link>
            <Link href="/login" className={botaoContorno}>
              Já tenho conta na Vero
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
