type Props = {
  digitados: number;
  tamanho: number;
};

// Os quadradinhos são só visuais; o leitor de tela ouve quantos números já foram digitados.
export function CampoPin({ digitados, tamanho }: Props) {
  return (
    <div className="flex justify-center gap-[clamp(8px,2.5vw,14px)]">
      <p aria-live="polite" className="sr-only">
        {digitados} de {tamanho} números digitados
      </p>
      {Array.from({ length: tamanho }, (_, i) => {
        const preenchido = i < digitados;
        return (
          <span
            key={i}
            aria-hidden="true"
            className={`flex h-[clamp(60px,16vw,72px)] w-[clamp(52px,14vw,66px)] items-center justify-center rounded-2xl border-[3px] text-[clamp(28px,7vw,34px)] font-extrabold ${
              preenchido ? "border-violeta bg-lavanda text-violeta-profundo" : "border-ardosia bg-nevoa"
            }`}
          >
            {preenchido ? "•" : ""}
          </span>
        );
      })}
    </div>
  );
}
