import Link from "next/link";

import { IconeVero } from "@/components/Cabecalho";
import { botaoPrimario } from "@/lib/estilos";

// Boas-vindas: primeira tela ao abrir o aplicativo.
export default function BoasVindas() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-60px)] w-full max-w-[560px] flex-col items-center justify-center gap-5 px-4 py-10 text-center">
      <div className="mb-2 flex flex-col items-center gap-2 font-titulo text-5xl leading-none font-black text-violeta">
        <IconeVero className="size-24" />
        <span>Vero</span>
      </div>

      <span className="inline-flex items-center gap-2 rounded-full bg-lavanda px-[18px] py-2 text-base font-bold text-violeta-profundo">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-6 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Acesso rápido e protegido
      </span>

      <h1 className="font-titulo text-[clamp(30px,4vw,42px)] leading-tight font-black">
        Suas finanças na palma da sua mão.
      </h1>

      <Link href="/login" className={`${botaoPrimario} mt-2 max-w-[360px]`}>
        Fazer login
      </Link>
    </main>
  );
}
