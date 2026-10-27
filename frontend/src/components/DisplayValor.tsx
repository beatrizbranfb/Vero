type Props = {
  rotulo: string;
  valorFormatado: string;
};

// Não usamos <output> nem role="status" aqui: o "status" da tela fica reservado
// para a confirmação de que o gasto foi salvo. O aria-live faz o leitor de tela
// anunciar o valor a cada tecla.
export function DisplayValor({ rotulo, valorFormatado }: Props) {
  return (
    <p
      aria-live="polite"
      aria-atomic="true"
      className="flex min-h-18 w-full items-center justify-center rounded-[18px] border-[3px] border-violeta bg-nevoa px-2 py-2 text-center text-[clamp(32px,9vw,44px)] leading-tight font-extrabold break-all text-grafite tabular-nums"
    >
      <span className="sr-only">{rotulo}: </span>
      <span data-testid="valor-digitado">{valorFormatado}</span>
    </p>
  );
}
