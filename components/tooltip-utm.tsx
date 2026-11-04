import { entero, porcentaje } from "@/lib/ui/format";
import type { Punto } from "@/lib/desglose";

/**
 * Pasadas estas filas la lista se parte en dos columnas.
 *
 * Antes la cola se juntaba en una fila "otras" y el dueño del producto pidió
 * lo contrario, con razón: el utm es un código que alguien escribió en una
 * campaña y el único motivo para abrir el tooltip es ir a buscarlo. "otras ·
 * 2" esconde justamente lo que se vino a leer.
 *
 * Mostrarlas todas en una columna sí rompe en el caso más largo: un mes de
 * registros en TOTAL llega a 57 fuentes, que son mil píxeles de alto. En dos
 * columnas entra en la mitad. Medido el 2026-11-04 sobre el último año:
 *
 *   nuevos · día             hasta 12, promedio 7
 *   nuevos · mes             hasta 35, promedio 22
 *   registros · día          hasta 30, promedio 23
 *   registros · mes          hasta 57, promedio 36
 */
const EN_UNA_COLUMNA = 18;

export type Detalle = {
  titulo: string;
  total: number;
  filas: { clave: string; valor: number; parte: number | null }[];
  rate: boolean;
};

/**
 * What one bar is made of, by raw utm_source.
 *
 * The sources are shown exactly as the database holds them — metaarj7,
 * tkarg, gadspre — because that is the string somebody typed into a campaign
 * and the only one they can go and look up. The bars are already grouped by
 * platform; grouping here too would answer the same question twice.
 */
export function detalleDe(
  puntos: Punto[],
  periodo: string,
  titulo: string,
  rate: boolean,
): Detalle | null {
  const delPeriodo = puntos
    .filter((p) => p.periodo === periodo && p.valor > 0)
    .sort((a, b) => b.valor - a.valor);

  if (delPeriodo.length === 0) return null;

  // A rate is never added up, so there is no total to take a share of.
  if (rate) {
    return {
      titulo,
      total: 0,
      filas: delPeriodo.map((p) => ({
        clave: p.clave,
        valor: p.valor,
        parte: null,
      })),
      rate,
    };
  }

  const total = delPeriodo.reduce((a, p) => a + p.valor, 0);

  return {
    titulo,
    total,
    filas: delPeriodo.map((p) => ({
      clave: p.clave,
      valor: p.valor,
      parte: total > 0 ? p.valor / total : null,
    })),
    rate,
  };
}

export function TooltipUtm({
  detalle,
  estilo,
  mono = true,
  nota,
}: {
  detalle: Detalle;
  estilo: React.CSSProperties;
  /**
   * utm_source goes in monospace because it is a code someone typed. Other
   * keys, like Business's company names, are plain words and read better in
   * the body font.
   */
  mono?: boolean;
  /** A line under the list, for when the rows need a caveat. */
  nota?: string;
}) {
  const valor = (v: number) => (detalle.rate ? porcentaje(v) : entero(v));

  // En dos columnas la lista se llena hacia abajo primero y después al
  // costado, para que siga leyéndose de mayor a menor. El alto de la grilla
  // va en estilo y no en una clase: Tailwind lee el fuente como texto y una
  // clase armada en runtime nunca llega a la hoja de estilo.
  const dos = detalle.filas.length > EN_UNA_COLUMNA;
  const porColumna = dos ? Math.ceil(detalle.filas.length / 2) : 0;

  return (
    <div
      className={`pointer-events-none absolute top-0 z-10 rounded-lg border border-borde bg-surface px-3 py-2 text-xs shadow-lg ${
        dos ? "w-[30rem]" : "w-60"
      }`}
      style={estilo}
    >
      <p className="flex items-baseline justify-between gap-2">
        <span className="text-sec">{detalle.titulo}</span>
        {detalle.rate ? null : (
          <span className="text-texto">{entero(detalle.total)}</span>
        )}
      </p>

      <ul
        className={dos ? "mt-1.5 grid gap-x-5 gap-y-0.5" : "mt-1.5 space-y-0.5"}
        style={
          dos
            ? {
                gridTemplateRows: `repeat(${porColumna}, auto)`,
                gridAutoFlow: "column",
              }
            : undefined
        }
      >
        {detalle.filas.map((f) => (
          <li key={f.clave} className="flex items-baseline gap-2">
            <span
              className={`flex-1 truncate text-sec ${
                mono ? "font-mono text-[11px]" : ""
              }`}
            >
              {f.clave}
            </span>
            <span className="tabular-nums text-texto">{valor(f.valor)}</span>
            {f.parte === null ? null : (
              <span className="w-9 text-right tabular-nums text-ter">
                {porcentaje(f.parte)}
              </span>
            )}
          </li>
        ))}
      </ul>

      {nota ? (
        <p className="mt-1.5 border-t border-borde pt-1 text-[11px] text-ter">
          {nota}
        </p>
      ) : null}
    </div>
  );
}
