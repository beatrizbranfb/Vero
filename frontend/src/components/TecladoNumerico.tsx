"use client";

import { useEffect } from "react";

type Props = {
  onDigito: (digito: string) => void;
  onApagar: () => void;
  onLimpar: () => void;
  /** Aceita também o teclado do computador (0–9, Backspace, Delete/Esc). */
  aceitarTecladoFisico?: boolean;
};

const DIGITOS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

// Botões com no mínimo 56px de altura (o critério pede ≥ 44px), fonte grande
// e borda escura: contraste ≥ 3:1 da borda e ≥ 7:1 do texto (WCAG AAA).
const tecla =
  "flex h-16 min-h-14 items-center justify-center rounded-2xl border-2 border-ardosia bg-white " +
  "font-titulo text-[clamp(26px,7vw,32px)] font-extrabold text-grafite select-none " +
  "transition-colors hover:bg-lavanda active:bg-violeta-claro " +
  "focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-violeta";

const teclaAcao =
  // Ícone em cima do texto para "Apagar" caber em telas de 360px.
  "flex h-16 min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-violeta-profundo bg-lavanda " +
  "text-[clamp(16px,4.4vw,19px)] leading-tight font-bold text-violeta-profundo select-none " +
  "transition-colors hover:bg-violeta-claro/40 active:bg-violeta-claro " +
  "focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-violeta";

function campoDeTexto(alvo: EventTarget | null): boolean {
  return (
    alvo instanceof HTMLElement &&
    (alvo.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(alvo.tagName))
  );
}

export function TecladoNumerico({ onDigito, onApagar, onLimpar, aceitarTecladoFisico = true }: Props) {
  useEffect(() => {
    if (!aceitarTecladoFisico) return;

    function aoPressionar(evento: KeyboardEvent) {
      if (evento.ctrlKey || evento.metaKey || evento.altKey || campoDeTexto(evento.target)) return;

      if (/^\d$/.test(evento.key)) onDigito(evento.key);
      else if (evento.key === "Backspace") onApagar();
      else if (evento.key === "Delete" || evento.key === "Escape") onLimpar();
      else return;

      evento.preventDefault();
    }

    window.addEventListener("keydown", aoPressionar);
    return () => window.removeEventListener("keydown", aoPressionar);
  }, [aceitarTecladoFisico, onDigito, onApagar, onLimpar]);

  return (
    <div
      role="group"
      aria-label="Teclado numérico"
      className="mx-auto grid w-full max-w-sm grid-cols-3 gap-2 sm:gap-3"
    >
      {DIGITOS.map((digito) => (
        <button key={digito} type="button" className={tecla} onClick={() => onDigito(digito)}>
          {digito}
        </button>
      ))}

      <button type="button" className={teclaAcao} onClick={onLimpar}>
        Limpar
      </button>

      <button type="button" className={tecla} onClick={() => onDigito("0")}>
        0
      </button>

      <button type="button" className={teclaAcao} onClick={onApagar}>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-6 shrink-0 fill-none stroke-current stroke-2 [stroke-linecap:round] [stroke-linejoin:round]"
        >
          <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
          <line x1="18" y1="9" x2="12" y2="15" />
          <line x1="12" y1="9" x2="18" y2="15" />
        </svg>
        Apagar
      </button>
    </div>
  );
}
