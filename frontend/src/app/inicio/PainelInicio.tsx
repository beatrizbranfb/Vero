"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { GraficoSaldo } from "@/components/GraficoSaldo";
import { useDadosDoMes } from "@/hooks/useDadosDoMes";
import {
  botaoLilas,
  botaoPrimario,
  campoTexto,
  cartao,
  foco,
  rotuloCampo,
  tituloCartao,
} from "@/lib/estilos";
import {
  fracaoDisponivel,
  mensagemDisponivel,
  nivelDisponivel,
  saldoPorDia,
  totalEntradas,
} from "@/lib/lancamentos";
import { formatarCentavos } from "@/lib/moeda";

const COR_DO_NIVEL = { bom: "bg-sucesso-texto", atencao: "bg-aviso-texto", critico: "bg-erro-texto" };

function ouvir(texto: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = "pt-BR";
  window.speechSynthesis.speak(fala);
}

export function PainelInicio() {
  const { hoje, estado, definirMeta } = useDadosDoMes();
  const [metaDigitada, setMetaDigitada] = useState<string | null>(null);
  const [avisoMeta, setAvisoMeta] = useState("Quanto você quer ter guardado no fim do mês.");

  if (!hoje || !estado) {
    return <p className="py-10 text-center text-ardosia">Carregando seu mês…</p>;
  }

  const pontos = saldoPorDia(estado.itens, hoje.dia);
  const saldo = pontos[pontos.length - 1].saldo;
  const fracao = fracaoDisponivel(saldo, totalEntradas(estado.itens));
  const ultimos = [...estado.itens].sort((a, b) => b.dia - a.dia || b.id - a.id).slice(0, 4);

  function salvarMeta(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const reais = Number((metaDigitada ?? "").replace(/\D/g, ""));
    if (!reais) {
      setAvisoMeta("Digite um valor para a meta, por exemplo 2000.");
      return;
    }
    definirMeta(reais * 100);
    setMetaDigitada(null);
    setAvisoMeta(`Meta salva: ${formatarCentavos(reais * 100)}.`);
  }

  const quando = (dia: number) => (dia === hoje.dia ? "Hoje" : dia === hoje.dia - 1 ? "Ontem" : `Dia ${dia}`);

  return (
    <div className="flex w-full flex-col gap-6 min-[900px]:grid min-[900px]:grid-cols-2 min-[900px]:gap-9">
      {/* Coluna principal: saldo e últimos valores */}
      <section className="flex flex-col gap-6">
        <div className={cartao}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-ardosia">Você ainda tem disponível no mês:</span>
            <button
              type="button"
              onClick={() =>
                ouvir(`Disponível no mês: ${formatarCentavos(saldo)}. ${mensagemDisponivel(fracao)}`)
              }
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-lavanda px-3.5 py-2 text-base font-bold text-violeta ${foco}`}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-6 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              Ouvir
            </button>
          </div>

          <div
            data-testid="saldo-disponivel"
            className="mt-2 mb-3.5 text-[clamp(34px,7vw,50px)] leading-tight font-black tracking-tight break-words"
          >
            {formatarCentavos(saldo)}
          </div>

          {/* Indicador de quanto já foi gasto, sem precisar ler números */}
          <div aria-hidden="true" className="mb-2 h-3 w-full overflow-hidden rounded-full bg-lavanda">
            <div
              className={`h-full rounded-full ${COR_DO_NIVEL[nivelDisponivel(fracao)]}`}
              style={{ width: `${fracao * 100}%` }}
            />
          </div>
          <span className="text-base text-ardosia">{mensagemDisponivel(fracao)}</span>
        </div>

        <div className={`${cartao} flex-1`}>
          <h2 className={tituloCartao}>Últimos valores anotados</h2>
          <ul className="flex flex-col gap-3">
            {ultimos.map((item) => {
              const entrada = item.tipo === "entrada";
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-[14px] bg-nevoa p-3"
                >
                  <div>
                    <strong className="block">{item.categoria}</strong>
                    <span className="block text-base text-ardosia">{quando(item.dia)}</span>
                  </div>
                  <strong className={`text-xl ${entrada ? "text-sucesso-texto" : "text-erro-texto"}`}>
                    {entrada ? "+" : "-"} {formatarCentavos(item.centavos)}
                  </strong>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Coluna lateral: meta e gráfico */}
      <aside className="flex flex-col gap-6">
        <form onSubmit={salvarMeta} className={cartao} noValidate>
          <label className={rotuloCampo} htmlFor="meta-valor">
            Meta de saldo do mês
          </label>
          <div className="flex flex-wrap gap-2.5">
            <div className="relative flex-[1_1_180px]">
              <span
                aria-hidden="true"
                className="absolute top-1/2 left-4 -translate-y-1/2 text-xl font-bold text-ardosia"
              >
                R$
              </span>
              <input
                id="meta-valor"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={metaDigitada ?? (estado.meta / 100).toLocaleString("pt-BR")}
                onChange={(e) => setMetaDigitada(e.target.value)}
                className={`${campoTexto} pl-[52px]`}
              />
            </div>
            <button type="submit" className={`${botaoPrimario} min-h-14 w-auto flex-[1_1_160px]`}>
              Salvar meta
            </button>
          </div>
          <span role="status" className="mt-1.5 block text-base text-ardosia">
            {avisoMeta}
          </span>
          <strong className="mt-1.5 block text-base">
            {saldo >= estado.meta
              ? "Seu saldo está acima da meta do mês."
              : `Faltam ${formatarCentavos(estado.meta - saldo)} para chegar na meta do mês.`}
          </strong>
        </form>

        <div className={`${cartao} flex-1`}>
          <h2 className="mb-1.5 font-titulo text-[22px] font-bold">Seu saldo no mês</h2>
          <GraficoSaldo pontos={pontos} meta={estado.meta} diasNoMes={hoje.diasNoMes} />
        </div>
      </aside>

      {/* Botões na mesma linha, abaixo das duas colunas */}
      <Link href="/anotar-gasto" className={botaoPrimario}>
        Anotar gasto ou entrada
      </Link>
      <a href="https://wa.me/5561999998888" target="_blank" rel="noreferrer" className={botaoLilas}>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-6 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
        >
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        Anotar pelo WhatsApp
      </a>
    </div>
  );
}
