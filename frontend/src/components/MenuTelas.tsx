"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { foco } from "@/lib/estilos";

const TELAS = [
  { href: "/", nome: "Vero" },
  { href: "/login", nome: "Login" },
  { href: "/inicio", nome: "Página Inicial" },
  { href: "/anotar-gasto", nome: "Anotar" },
];

/** Barra superior com as telas principais e menu lateral (☰) com as mesmas telas. */
export function MenuTelas() {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const botaoRef = useRef<HTMLButtonElement>(null);
  const fecharRef = useRef<HTMLButtonElement>(null);

  function fechar() {
    setAberto(false);
    botaoRef.current?.focus();
  }

  useEffect(() => {
    if (!aberto) return;
    fecharRef.current?.focus();

    function aoPressionar(evento: KeyboardEvent) {
      if (evento.key === "Escape") {
        setAberto(false);
        botaoRef.current?.focus();
      }
    }
    window.addEventListener("keydown", aoPressionar);
    return () => window.removeEventListener("keydown", aoPressionar);
  }, [aberto]);

  const links = (classe: string, aoClicar?: () => void) =>
    TELAS.map((tela) => {
      const ativa = caminho === tela.href;
      return (
        <Link
          key={tela.href}
          href={tela.href}
          onClick={aoClicar}
          aria-current={ativa ? "page" : undefined}
          className={`${classe} ${ativa ? "bg-violeta text-white" : ""}`}
        >
          {tela.nome}
        </Link>
      );
    });

  return (
    <>
      <nav
        aria-label="Telas"
        className="sticky top-0 z-[1000] flex items-center justify-between gap-2.5 bg-grafite px-4 py-2 text-sm"
      >
        <div className="flex flex-wrap gap-1">
          {links(`rounded-md px-2.5 py-1 font-bold text-[#ddd6fe] hover:bg-violeta hover:text-white ${foco}`)}
        </div>
        <button
          ref={botaoRef}
          type="button"
          aria-label="Abrir menu de telas"
          aria-expanded={aberto}
          aria-controls="menu-telas"
          onClick={() => setAberto(true)}
          className={`inline-flex h-11 w-12 shrink-0 flex-col items-center justify-center gap-[5px] rounded-[10px] hover:bg-violeta ${foco}`}
        >
          <span className="block h-[3px] w-6 rounded-full bg-white" />
          <span className="block h-[3px] w-6 rounded-full bg-white" />
          <span className="block h-[3px] w-6 rounded-full bg-white" />
        </button>
      </nav>

      {aberto && <div className="fixed inset-0 z-[1500] bg-grafite/50" onClick={fechar} aria-hidden="true" />}

      <aside
        id="menu-telas"
        aria-label="Telas do aplicativo"
        className={`fixed inset-y-0 right-0 z-[1600] flex w-[min(300px,85vw)] flex-col gap-4 overflow-y-auto bg-white p-4 shadow-[-8px_0_30px_rgba(26,26,46,0.2)] transition-[transform,visibility] duration-200 ${
          aberto ? "visible translate-x-0" : "invisible translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between font-titulo text-[22px] text-violeta-profundo">
          <strong>Telas</strong>
          <button
            ref={fecharRef}
            type="button"
            aria-label="Fechar menu"
            onClick={fechar}
            className={`inline-flex size-11 items-center justify-center rounded-xl bg-lavanda text-violeta-profundo ${foco}`}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-6 fill-none stroke-current stroke-2 [stroke-linecap:round]"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          {links(
            `flex min-h-13 items-center rounded-[14px] border-2 border-borda-card bg-nevoa px-4 py-2.5 font-bold text-grafite hover:border-violeta ${foco}`,
            () => setAberto(false),
          )}
        </div>
      </aside>
    </>
  );
}
