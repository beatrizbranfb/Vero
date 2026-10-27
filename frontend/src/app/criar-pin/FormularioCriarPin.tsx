"use client";

import { useState, type FormEvent } from "react";

import { CampoPin } from "@/components/CampoPin";
import { ConfirmacaoSucesso } from "@/components/ConfirmacaoSucesso";
import { TecladoNumerico } from "@/components/TecladoNumerico";
import { usePin } from "@/hooks/usePin";
import { botaoPrimario } from "@/lib/estilos";

export function FormularioCriarPin({ recuperar }: { recuperar: boolean }) {
  const pin = usePin();
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [salvo, setSalvo] = useState(false);

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setTentouSalvar(true);
    if (pin.completo) setSalvo(true);
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-5" noValidate>
      <CampoPin digitados={pin.pin.length} tamanho={pin.tamanho} />

      <p role="alert" className="-my-2 text-center text-base font-bold text-erro-texto empty:hidden">
        {tentouSalvar && !pin.completo ? `Digite os ${pin.tamanho} números do PIN.` : ""}
      </p>

      <TecladoNumerico
        onDigito={pin.digitar}
        onApagar={pin.apagar}
        onLimpar={pin.limpar}
        aceitarTecladoFisico={!salvo}
      />

      <button type="submit" className={botaoPrimario}>
        Confirmar e salvar PIN
      </button>

      <ConfirmacaoSucesso
        aberta={salvo}
        mensagem={
          recuperar
            ? "Seu novo PIN foi salvo. Use ele para entrar na Vero."
            : "Seu PIN foi criado e sua conta está pronta."
        }
        onDesfazer={() => setSalvo(false)}
      />
    </form>
  );
}
