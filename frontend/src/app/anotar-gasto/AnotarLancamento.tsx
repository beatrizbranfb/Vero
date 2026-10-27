"use client";

import { useState } from "react";

import { ConfirmacaoSucesso } from "@/components/ConfirmacaoSucesso";
import { useDadosDoMes } from "@/hooks/useDadosDoMes";
import { CATEGORIAS } from "@/lib/categorias";
import { foco, subtituloTela, tituloTela } from "@/lib/estilos";
import type { TipoLancamento } from "@/lib/lancamentos";

import { FormularioGasto } from "./FormularioGasto";

const botaoTipo =
  "min-h-13 rounded-[14px] border-[3px] px-2.5 py-2 text-xl leading-tight font-bold transition-colors " +
  foco;

export function AnotarLancamento() {
  const { adicionar, remover } = useDadosDoMes();
  const [tipo, setTipo] = useState<TipoLancamento>("gasto");
  const [categoria, setCategoria] = useState(CATEGORIAS[0].nome);
  const [ultimoId, setUltimoId] = useState<number | null>(null);

  const entrada = tipo === "entrada";

  function salvar(centavos: number) {
    setUltimoId(adicionar(tipo, centavos, entrada ? "Entrada" : categoria));
  }

  function desfazer() {
    if (ultimoId !== null) remover(ultimoId);
    setUltimoId(null);
  }

  return (
    <>
      <h1 className={tituloTela}>{entrada ? "Anotar dinheiro que entrou" : "Anotar novo gasto"}</h1>

      <div role="group" aria-label="O que você quer anotar?" className="mb-[18px] grid grid-cols-2 gap-2.5">
        {(["gasto", "entrada"] as const).map((opcao) => (
          <button
            key={opcao}
            type="button"
            aria-pressed={tipo === opcao}
            onClick={() => setTipo(opcao)}
            className={`${botaoTipo} ${
              tipo === opcao
                ? "border-violeta bg-lavanda text-violeta-profundo"
                : "border-borda bg-nevoa text-grafite"
            }`}
          >
            {opcao === "gasto" ? "Gasto" : "Entrada"}
          </button>
        ))}
      </div>

      <p className={subtituloTela}>Digite o valor no teclado abaixo:</p>

      <FormularioGasto tipo={tipo} onSalvar={salvar}>
        {!entrada && (
          <fieldset>
            <legend className="mb-2.5 text-lg font-bold">Escolha a categoria:</legend>
            <div className="grid grid-cols-3 gap-[clamp(6px,2vw,10px)]">
              {CATEGORIAS.map((item) => {
                const ativa = categoria === item.nome;
                return (
                  <button
                    key={item.nome}
                    type="button"
                    aria-pressed={ativa}
                    onClick={() => setCategoria(item.nome)}
                    className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-2xl border-[3px] px-1 py-2.5 text-[clamp(13px,3.5vw,16px)] font-bold ${foco} ${
                      ativa ? "border-violeta bg-lavanda text-violeta-profundo" : "border-borda bg-nevoa"
                    }`}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="size-[26px] fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
                      dangerouslySetInnerHTML={{ __html: item.icone }}
                    />
                    {item.nome}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
      </FormularioGasto>

      <ConfirmacaoSucesso
        aberta={ultimoId !== null}
        mensagem={entrada ? "Sua entrada foi anotada com sucesso." : "Seu gasto foi anotado com sucesso."}
        onDesfazer={desfazer}
      />
    </>
  );
}
