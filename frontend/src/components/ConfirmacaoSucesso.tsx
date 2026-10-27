"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { foco } from "@/lib/estilos";

type Props = {
  aberta: boolean;
  mensagem: string;
  onDesfazer: () => void;
  /** Tempo para desfazer (botão "Desfazer" por 10 segundos). */
  segundos?: number;
};

/** "Tudo certo!" sobre a própria tela, com "Ir para a tela inicial" e "Desfazer". */
export function ConfirmacaoSucesso({ aberta, mensagem, onDesfazer, segundos = 10 }: Props) {
  const [restante, setRestante] = useState(segundos);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!aberta) return;
    setRestante(segundos);
    tituloRef.current?.focus();
    const contagem = setInterval(() => setRestante((atual) => Math.max(0, atual - 1)), 1000);
    return () => clearInterval(contagem);
  }, [aberta, segundos]);

  if (!aberta) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center overflow-y-auto bg-grafite/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmacao-titulo"
        className="flex w-full max-w-[540px] flex-col items-center rounded-[28px] bg-violeta px-5 py-[clamp(36px,8vw,60px)] text-center text-white"
      >
        <div className="mb-6 flex size-[110px] items-center justify-center rounded-full bg-white/20">
          <svg
            aria-hidden="true"
            viewBox="0 0 36 36"
            className="size-16 fill-none stroke-white stroke-[5] [stroke-linecap:round] [stroke-linejoin:round]"
          >
            <path d="M6 18.5L14.5 27L30 9.5" />
          </svg>
        </div>

        <h2
          id="confirmacao-titulo"
          ref={tituloRef}
          tabIndex={-1}
          className="mb-3 font-titulo text-[clamp(30px,6vw,40px)] font-black outline-none"
        >
          Tudo certo!
        </h2>
        <p className="mb-8 text-[clamp(18px,4.5vw,22px)] opacity-95">{mensagem}</p>

        <div className="flex w-full max-w-[360px] flex-col gap-3">
          <Link
            href="/inicio"
            className={`inline-flex min-h-14 items-center justify-center rounded-2xl bg-white px-5 py-3 text-lg font-bold text-violeta-profundo ${foco}`}
          >
            Ir para a tela inicial
          </Link>
          {restante > 0 && (
            <button
              type="button"
              onClick={onDesfazer}
              className={`inline-flex min-h-14 items-center justify-center rounded-2xl border-2 border-white px-5 py-3 text-lg font-bold text-white ${foco}`}
            >
              Desfazer ({restante}s)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
