"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { CampoPin } from "@/components/CampoPin";
import { TecladoNumerico } from "@/components/TecladoNumerico";
import { usePin } from "@/hooks/usePin";
import { botaoLilas, botaoPrimario, campoTexto, rotuloCampo } from "@/lib/estilos";

export function FormularioLogin() {
  const router = useRouter();
  const pin = usePin();
  const [tentouEntrar, setTentouEntrar] = useState(false);

  function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setTentouEntrar(true);
    if (!pin.completo) return;
    router.push("/inicio");
  }

  return (
    <form onSubmit={entrar} className="flex flex-col gap-5" noValidate>
      <div>
        <label htmlFor="login-celular" className={rotuloCampo}>
          Celular com DDD
        </label>
        <input
          id="login-celular"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          defaultValue="(61) 99888-7766"
          className={campoTexto}
        />
      </div>

      <CampoPin digitados={pin.pin.length} tamanho={pin.tamanho} />

      <p role="alert" className="-my-2 text-center text-base font-bold text-erro-texto empty:hidden">
        {tentouEntrar && !pin.completo ? `Digite os ${pin.tamanho} números do PIN.` : ""}
      </p>

      <TecladoNumerico onDigito={pin.digitar} onApagar={pin.apagar} onLimpar={pin.limpar} />

      <button type="submit" className={botaoPrimario}>
        Entrar
      </button>

      <div className="grid grid-cols-2 gap-2.5">
        <Link href="/cadastro" className={`${botaoLilas} text-[16px]`}>
          Não tenho conta na Vero
        </Link>
        <Link href="/codigo-sms?recuperar=1" className={`${botaoLilas} text-[16px]`}>
          Esqueceu sua senha?
        </Link>
      </div>
    </form>
  );
}
