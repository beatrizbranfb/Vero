// Classes repetidas entre as telas (mesmo visual do preview/shared.css).

export const foco = "focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-violeta";

export const pagina = "mx-auto flex w-full max-w-[1200px] flex-col px-4 pt-4 pb-10";

export const cartao =
  "w-full overflow-hidden rounded-3xl border-2 border-borda-card bg-white p-[clamp(16px,4.5vw,32px)] " +
  "shadow-[0_10px_30px_rgba(26,26,46,0.06)]";

export const tituloTela = "mb-2 font-titulo text-[clamp(24px,5vw,28px)] font-black";

export const subtituloTela = "mb-5 text-[clamp(16px,4vw,18px)] text-ardosia";

export const tituloCartao = "mb-4 font-titulo text-[22px] font-bold";

export const rotuloCampo = "mb-1.5 block text-[17px] font-bold";

export const campoTexto =
  "min-h-14 w-full rounded-2xl border-[3px] border-ardosia bg-nevoa px-4 py-3 text-[clamp(18px,4.5vw,22px)] " +
  "font-bold outline-none focus:border-violeta focus:bg-white focus:shadow-[0_0_0_4px_var(--color-lavanda)]";

export const botaoPrimario =
  "inline-flex min-h-15 w-full items-center justify-center rounded-2xl bg-violeta px-5 py-3 text-center " +
  "text-xl font-bold text-white shadow-[0_4px_14px_rgba(124,58,237,0.25)] transition-colors " +
  "hover:bg-violeta-profundo disabled:cursor-not-allowed disabled:bg-borda disabled:text-ardosia " +
  `disabled:shadow-none ${foco}`;

/** Fundo lilás, letras e borda pretas (Sair, Cancelar, WhatsApp...). */
export const botaoLilas =
  "inline-flex min-h-15 w-full items-center justify-center gap-2.5 rounded-2xl border-2 border-grafite " +
  `bg-lavanda px-4 py-3 text-center font-bold text-grafite transition-colors hover:bg-violeta-claro/40 ${foco}`;

export const botaoContorno =
  "inline-flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-ardosia px-4 py-3 " +
  `text-center font-bold text-grafite transition-colors hover:bg-lavanda ${foco}`;

/** Botão pequeno do cabeçalho, ao lado do logo. */
export const botaoCabecalho =
  "inline-flex min-h-11 shrink-0 items-center rounded-xl border-2 border-grafite bg-lavanda px-4 py-2 " +
  `font-bold text-grafite transition-colors hover:bg-violeta-claro/40 ${foco}`;

export const botaoCabecalhoContorno =
  "inline-flex min-h-11 shrink-0 items-center rounded-xl border-2 border-ardosia px-4 py-2 font-bold " +
  `text-grafite transition-colors hover:bg-lavanda ${foco}`;
