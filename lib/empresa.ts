import { withDb } from "@/lib/db";
import { type Rango } from "@/lib/dashboard";

/**
 * El detalle de UNA empresa: si la cuenta viene subiendo o bajando.
 *
 * Lee solo las filas de esa empresa, de las dos tablas que ya escribe el cron.
 * No hay consulta nueva a MySQL ni tabla nueva: la pregunta "¿esta cuenta se
 * está yendo?" se contesta con los agregados que ya existen.
 *
 * Se lee aparte de `leerBusiness` y no dentro: el detalle solo se pide cuando
 * hay una empresa elegida en la URL, y cargarlo siempre sería traer trece
 * meses de revenue de todas para mostrar una.
 */

export type DetalleEmpresa = {
  empresa: string;
  meses: { mes: string; enCurso: boolean }[];
  activos: number[];
  nuevos: number[];
  sesiones: number[];
  ingreso: number[];
  ganancia: number[];
  /** Las plataformas donde aparece: casi siempre una, a veces las dos. */
  plataformas: string[];
  /** Si cobra fee fijo, si cobra por cupón, o las dos cosas. */
  tipos: string[];
  /** El último mes cerrado y el anterior, para el movimiento. */
  mes: string | null;
  mesPrevio: string | null;
  /** En cuántos meses del rango tuvo algún activo, y el pico. */
  mesesVivos: number;
  pico: { valor: number; mes: string } | null;
  vacia: boolean;
};

export async function leerEmpresa(
  empresa: string,
  pais: string,
  meses: Rango,
): Promise<DetalleEmpresa> {
  return withDb(async (db) => {
    const [mensual, revenue] = await Promise.all([
      db.query<{
        mes: string;
        pais: string;
        nuevos: string;
        activos: string;
      }>(
        `select to_char(mes, 'YYYY-MM') as mes, pais, nuevos::text, activos::text
           from marketing.business_mensual
          where empresa = $1
            and mes > (date_trunc('month', current_date)
                       - make_interval(months => $2))
          order by mes`,
        [empresa, meses],
      ),
      // La tabla de revenue puede no existir todavía: llega con su migración,
      // y el detalle tiene que seguir mostrando activos y nuevos igual.
      db
        .query<{
          mes: string;
          pais: string;
          tipo: string;
          sesiones: string;
          ingreso_usd: string;
          ganancia_usd: string;
        }>(
          `select to_char(mes, 'YYYY-MM') as mes, pais, tipo, sesiones::text,
                  ingreso_usd::text, ganancia_usd::text
             from marketing.business_revenue
            where empresa = $1
              and mes > (date_trunc('month', current_date)
                         - make_interval(months => $2))`,
          [empresa, meses],
        )
        .catch(() => ({ rows: [] })),
    ]);

    return armarDetalle(empresa, mensual.rows, revenue.rows, pais);
  });
}

type FilaMensual = { mes: string; pais: string; nuevos: string; activos: string };
type FilaRevenue = {
  mes: string;
  pais: string;
  tipo: string;
  sesiones: string;
  ingreso_usd: string;
  ganancia_usd: string;
};

/** Pura, para poder razonarla sin base de datos. */
export function armarDetalle(
  empresa: string,
  mensual: FilaMensual[],
  revenue: FilaRevenue[],
  pais = "TOTAL",
): DetalleEmpresa {
  const esTotal = pais === "TOTAL";
  const filas = esTotal ? mensual : mensual.filter((f) => f.pais === pais);
  const rev = esTotal ? revenue : revenue.filter((f) => f.pais === pais);

  const meses = [...new Set(mensual.map((f) => f.mes))].sort();
  const enCurso = meses[meses.length - 1];

  const sumar = <T,>(
    origen: T[],
    mesDe: (f: T) => string,
    valor: (f: T) => number,
  ) => {
    const por = new Map<string, number>();
    for (const f of origen) {
      por.set(mesDe(f), (por.get(mesDe(f)) ?? 0) + valor(f));
    }
    return meses.map((m) => por.get(m) ?? 0);
  };

  const activos = sumar(filas, (f) => f.mes, (f) => Number(f.activos));
  const nuevos = sumar(filas, (f) => f.mes, (f) => Number(f.nuevos));

  const cerrados = meses.filter((m) => m !== enCurso);
  const mes = cerrados[cerrados.length - 1] ?? null;
  const mesPrevio = cerrados[cerrados.length - 2] ?? null;

  const conActivos = activos.filter((v) => v > 0).length;
  const maximo = Math.max(...activos, 0);
  const pico =
    maximo > 0
      ? { valor: maximo, mes: meses[activos.indexOf(maximo)]! }
      : null;

  return {
    empresa,
    meses: meses.map((m) => ({ mes: m, enCurso: m === enCurso })),
    activos,
    nuevos,
    sesiones: sumar(rev, (f) => f.mes, (f) => Number(f.sesiones)),
    ingreso: sumar(rev, (f) => f.mes, (f) => Number(f.ingreso_usd)),
    ganancia: sumar(rev, (f) => f.mes, (f) => Number(f.ganancia_usd)),
    plataformas: [...new Set(filas.map((f) => f.pais))].sort(),
    tipos: [...new Set(rev.map((f) => f.tipo))].sort(),
    mes,
    mesPrevio,
    mesesVivos: conActivos,
    pico,
    vacia: filas.length === 0,
  };
}

/**
 * El veredicto en palabras, que es lo que un porcentaje solo no dice.
 *
 * "−71%" no distingue un mes flojo de una cuenta perdida. Esto mira la serie
 * entera: de dónde venía, dónde está, y si todavía entra gente nueva.
 *
 * Con números chicos no se pronuncia. Una empresa de dos activos que pasa a
 * tres subió "50%" y es una persona: ahí la única lectura honesta es que no
 * hay suficiente para leer.
 */
export function veredicto(d: DetalleEmpresa): {
  tono: "mal" | "bien" | "quieto" | "chico";
  titulo: string;
  texto: string;
} | null {
  const i = d.mes === null ? -1 : d.meses.findIndex((m) => m.mes === d.mes);
  if (i < 1) return null;

  const ahora = d.activos[i]!;
  const antes = d.activos[i - 1]!;
  const previos = d.activos.slice(0, i);
  const piso = Math.min(...previos.filter((v) => v > 0));
  const techo = Math.max(...previos);
  // Solo el mes cerrado: el que sigue está corriendo y todavía puede entrar
  // gente, así que contarlo diría "no entró nadie" todos los meses.
  const nuevosDelMes = d.nuevos[i] ?? 0;

  if (Math.max(ahora, antes, techo) < 5) {
    return {
      tono: "chico",
      titulo: "Es una cuenta chica.",
      texto: `Nunca pasó de ${techo} activos en el rango, así que el movimiento mes a mes es una persona yendo y viniendo, no una tendencia.`,
    };
  }

  const caida = antes > 0 ? ahora / antes - 1 : 0;

  if (ahora < piso && caida < -0.3) {
    return {
      tono: "mal",
      titulo: "La cuenta se está yendo.",
      texto: `Venía entre ${piso} y ${techo} activos y cayó a ${ahora}.${
        nuevosDelMes === 0 ? " Y no entró ningún paciente nuevo." : ""
      }`,
    };
  }

  if (ahora >= techo && caida > 0.1) {
    return {
      tono: "bien",
      titulo: "Es el mejor mes de la cuenta.",
      texto: `${ahora} activos, por encima del máximo anterior de ${techo}.`,
    };
  }

  return {
    tono: "quieto",
    titulo: "La cuenta está estable.",
    texto: `Se mueve entre ${piso} y ${techo} activos desde hace ${d.mesesVivos} meses.`,
  };
}
