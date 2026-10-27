"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

import { PASSO_ESCALA, escalaDoGrafico, puloDosRotulos, type PontoSaldo } from "@/lib/lancamentos";
import { formatarCentavos } from "@/lib/moeda";

type Props = {
  pontos: PontoSaldo[];
  /** Meta de saldo do mês, em centavos. */
  meta: number;
  diasNoMes: number;
};

const ALTURA = 360;
const MARGEM = { topo: 16, dir: 16, base: 34, esq: 84 };

function rotuloReais(centavos: number) {
  return `R$ ${(centavos / 100).toLocaleString("pt-BR")}`;
}

function LegendaLinha({ tipo }: { tipo: "saldo" | "meta" }) {
  return (
    <i
      aria-hidden="true"
      className={`inline-block h-0 w-[22px] rounded-sm border-t-[3px] ${
        tipo === "saldo" ? "border-solid border-violeta" : "border-dashed border-serie-meta"
      }`}
    />
  );
}

/** Linha roxa do saldo disponível dia a dia e linha azul tracejada da meta. */
export function GraficoSaldo({ pontos, meta, diasNoMes }: Props) {
  const caixaRef = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(0);
  const [diaEmFoco, setDiaEmFoco] = useState<number | null>(null);

  useEffect(() => {
    const caixa = caixaRef.current;
    if (!caixa) return;
    const observador = new ResizeObserver(([entrada]) => setLargura(entrada.contentRect.width));
    observador.observe(caixa);
    return () => observador.disconnect();
  }, []);

  const w = Math.max(0, largura - MARGEM.esq - MARGEM.dir);
  const h = ALTURA - MARGEM.topo - MARGEM.base;
  const { minimo, maximo, passos } = escalaDoGrafico([...pontos.map((p) => p.saldo), meta]);
  const pulo = puloDosRotulos(h, passos);

  const x = (dia: number) => MARGEM.esq + (diasNoMes === 1 ? 0 : ((dia - 1) / (diasNoMes - 1)) * w);
  const y = (valor: number) => MARGEM.topo + ((maximo - valor) / (maximo - minimo)) * h;

  // Marcas do eixo dos dias, sem deixar duas coladas em telas estreitas.
  const marcas: number[] = [];
  let ultimaMarca = -Infinity;
  for (const dia of [1, 5, 10, 15, 20, 25, diasNoMes]) {
    if (marcas.includes(dia) || (dia !== diasNoMes && diasNoMes - dia < 3)) continue;
    if (dia !== 1 && x(dia) - ultimaMarca < 40) continue;
    marcas.push(dia);
    ultimaMarca = x(dia) + (dia === 1 ? 22 : 0);
  }

  const ultimo = pontos[pontos.length - 1];
  const saldoAcimaDaMeta = ultimo.saldo >= meta;
  const rotuloSaldoADireita = x(ultimo.dia) + 110 <= MARGEM.esq + w;
  const pontoEmFoco = diaEmFoco === null ? undefined : pontos.find((p) => p.dia === diaEmFoco);

  function aoMover(evento: PointerEvent<SVGRectElement>) {
    const caixa = evento.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!caixa || w === 0) return;
    const px = evento.clientX - caixa.left;
    const dia = Math.round(((px - MARGEM.esq) / w) * (diasNoMes - 1)) + 1;
    setDiaEmFoco(Math.max(1, Math.min(diasNoMes, dia)));
  }

  const larguraDica = 190;
  const dicaADireita = diaEmFoco !== null && x(diaEmFoco) + 12 + larguraDica <= largura;

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-[18px] gap-y-1.5 text-base text-ardosia">
        <span className="inline-flex items-center gap-2">
          <LegendaLinha tipo="saldo" />
          Saldo disponível
        </span>
        <span className="inline-flex items-center gap-2">
          <LegendaLinha tipo="meta" />
          Meta de saldo
        </span>
      </div>

      <div
        ref={caixaRef}
        role="img"
        aria-label="Gráfico de linha do saldo disponível em cada dia do mês comparado com a meta de saldo"
        className="relative w-full touch-pan-y"
        style={{ height: ALTURA }}
      >
        {largura > 0 && (
          <svg width={largura} height={ALTURA} aria-hidden="true" className="block">
            {Array.from({ length: passos + 1 }, (_, i) => {
              const valor = minimo + i * PASSO_ESCALA;
              const comRotulo = i % pulo === 0;
              return (
                <g key={valor}>
                  <line
                    x1={MARGEM.esq}
                    x2={MARGEM.esq + w}
                    y1={y(valor)}
                    y2={y(valor)}
                    stroke={comRotulo ? "#E9E4F8" : "#F3F0FB"}
                  />
                  {comRotulo && (
                    <text
                      x={MARGEM.esq - 8}
                      y={y(valor)}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className="fill-ardosia text-[16px]"
                    >
                      {rotuloReais(valor)}
                    </text>
                  )}
                </g>
              );
            })}

            {marcas.map((dia) => (
              <text
                key={dia}
                x={x(dia)}
                y={ALTURA - 8}
                textAnchor={dia === 1 ? "start" : "middle"}
                className="fill-ardosia text-[16px]"
              >
                {dia === 1 ? "Dia 1" : dia}
              </text>
            ))}

            <line
              x1={x(1)}
              x2={x(diasNoMes)}
              y1={y(meta)}
              y2={y(meta)}
              stroke="var(--color-serie-meta)"
              strokeWidth={2.5}
              strokeDasharray="8 6"
              strokeLinecap="round"
            />

            <path
              d={pontos.map((p, i) => `${i ? "L" : "M"}${x(p.dia)},${y(p.saldo)}`).join(" ")}
              fill="none"
              stroke="var(--color-violeta)"
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {/* Rótulos diretos: valor de hoje e "Meta" */}
            <circle
              cx={x(ultimo.dia)}
              cy={y(ultimo.saldo)}
              r={5}
              fill="var(--color-violeta)"
              stroke="white"
              strokeWidth={2}
            />
            <text
              x={x(ultimo.dia) + (rotuloSaldoADireita ? 10 : -10)}
              y={y(ultimo.saldo)}
              textAnchor={rotuloSaldoADireita ? "start" : "end"}
              dominantBaseline="middle"
              className="fill-grafite text-[16px] font-bold"
            >
              {formatarCentavos(ultimo.saldo)}
            </text>
            <text
              x={x(diasNoMes)}
              y={y(meta) + (saldoAcimaDaMeta ? 20 : -8)}
              textAnchor="end"
              className="fill-grafite text-[16px] font-bold"
            >
              Meta
            </text>

            {diaEmFoco !== null && (
              <>
                <line
                  x1={x(diaEmFoco)}
                  x2={x(diaEmFoco)}
                  y1={MARGEM.topo}
                  y2={MARGEM.topo + h}
                  stroke="var(--color-ardosia)"
                  strokeDasharray="3 3"
                />
                {pontoEmFoco && (
                  <circle
                    cx={x(diaEmFoco)}
                    cy={y(pontoEmFoco.saldo)}
                    r={5}
                    fill="var(--color-violeta)"
                    stroke="white"
                    strokeWidth={2}
                  />
                )}
              </>
            )}

            <rect
              x={MARGEM.esq}
              y={MARGEM.topo}
              width={w}
              height={h}
              fill="transparent"
              onPointerMove={aoMover}
              onPointerDown={aoMover}
              onPointerLeave={() => setDiaEmFoco(null)}
            />
          </svg>
        )}

        {diaEmFoco !== null && (
          <div
            className="pointer-events-none absolute z-[5] flex flex-col gap-0.5 rounded-xl border-2 border-borda-card bg-white px-3 py-2 text-base whitespace-nowrap shadow-[0_6px_18px_rgba(26,26,46,0.12)]"
            style={{
              top: MARGEM.topo,
              left: dicaADireita ? x(diaEmFoco) + 12 : Math.max(0, x(diaEmFoco) - larguraDica - 12),
            }}
          >
            <strong>Dia {diaEmFoco}</strong>
            {pontoEmFoco && (
              <span className="inline-flex items-center gap-2">
                <LegendaLinha tipo="saldo" />
                Saldo: {formatarCentavos(pontoEmFoco.saldo)}
              </span>
            )}
            <span className="inline-flex items-center gap-2">
              <LegendaLinha tipo="meta" />
              Meta: {formatarCentavos(meta)}
            </span>
          </div>
        )}
      </div>

      <details className="mt-3 text-base">
        <summary className="flex min-h-11 cursor-pointer items-center font-bold text-violeta-profundo">
          Ver valores em tabela
        </summary>
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr>
              {["Dia", "Saldo", "Meta"].map((coluna) => (
                <th key={coluna} scope="col" className="border-b border-borda-card px-2 py-1.5 text-left">
                  {coluna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pontos.map((p) => (
              <tr key={p.dia}>
                <td className="border-b border-borda-card px-2 py-1.5">{p.dia}</td>
                <td className="border-b border-borda-card px-2 py-1.5">{formatarCentavos(p.saldo)}</td>
                <td className="border-b border-borda-card px-2 py-1.5">{formatarCentavos(meta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
