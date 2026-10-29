import { withDb } from "@/lib/db";
import { type Rango } from "@/lib/dashboard";

/**
 * La pestaña Business: los pacientes que llegan con el cupón de una empresa.
 *
 * Todo sale de `marketing.business_mensual`, que escribe el cron del funnel.
 * La pantalla no consulta MySQL nunca.
 *
 * Las barras se parten siempre por **plataforma** y la empresa va en una tabla
 * aparte. No es una elección estética: hay entre 33 y 46 empresas distintas
 * por mes y la cola es larga —después de las diez primeras hay empresas de uno
 * o dos pacientes—, así que una barra apilada por empresa sería cuarenta
 * franjas de un píxel.
 */

/** La fila que trae el total del mes, ya deduplicado. */
export const TODAS = "TODAS";

export type Punto = { mes: string; valor: number; enCurso: boolean };

export type SerieBusiness = { nombre: string; puntos: Punto[] };

export type FilaEmpresa = {
  empresa: string;
  nuevos: number;
  activos: number;
  /** En cuántos meses del rango apareció. Una que aparece en uno se murió. */
  meses: number;
  /** El último mes del rango en el que tuvo algún paciente. */
  ultimo: string;
};

export type VistaBusiness = {
  meses: string[];
  nuevos: SerieBusiness[];
  activos: SerieBusiness[];
  /** Las empresas del rango, de la más grande a la más chica. */
  empresas: FilaEmpresa[];
  /** Cuántas empresas distintas aparecieron en cada mes. */
  porMes: { mes: string; empresas: number; enCurso: boolean }[];
  resumen: {
    nuevos: number;
    nuevosPrevio: number;
    activos: number;
    activosPrevio: number;
    mes: string | null;
    mesPrevio: string | null;
  };
  /** Pacientes nuevos de empresa y del total, para la parte que representan. */
  parte: { empresa: number; total: number; mes: string | null };
  vacia: boolean;
};

type Fila = {
  mes: string;
  pais: string;
  empresa: string;
  nuevos: string;
  activos: string;
};

export async function leerBusiness(
  pais: string,
  meses: Rango,
): Promise<VistaBusiness> {
  return withDb(async (db) => {
    const [mensual, totales] = await Promise.all([
      db.query<Fila>(
        `select to_char(mes, 'YYYY-MM') as mes, pais, empresa,
                nuevos::text, activos::text
           from marketing.business_mensual
          where mes > (date_trunc('month', current_date)
                       - make_interval(months => $1))
          order by mes`,
        [meses],
      ),
      // Los pacientes nuevos de todo el negocio, de la MISMA tabla que lee
      // General: la parte que son las empresas no se puede calcular con un
      // total propio, porque entonces habría dos totales distintos en dos
      // pestañas.
      db.query<{ mes: string; pacientes_nuevos: string | null }>(
        `select to_char(mes, 'YYYY-MM') as mes, pacientes_nuevos::text
           from marketing.metricas_mensuales
          where pais = 'TOTAL' and plataforma = 'TODAS'
          order by mes desc limit $1`,
        [meses],
      ),
    ]);

    return armar(mensual.rows, totales.rows, pais);
  });
}

/**
 * Pura, para poder razonarla sin base de datos.
 *
 * El selector de país filtra la plataforma. La tarjeta de "parte de los
 * pacientes nuevos" NO se filtra: contesta cuánto pesan las empresas en el
 * negocio entero, y con AR elegido un numerador filtrado contra un denominador
 * entero no contestaría ninguna de las dos preguntas. Es el mismo error que
 * Exterior tuvo el 2026-10-28 y que solo se vio al dibujarlo.
 */
export function armar(
  todas: Fila[],
  totales: { mes: string; pacientes_nuevos: string | null }[],
  pais = "TOTAL",
): VistaBusiness {
  const esTotal = pais === "TOTAL";
  const filas = esTotal ? todas : todas.filter((f) => f.pais === pais);
  const meses = [...new Set(todas.map((f) => f.mes))].sort();
  const mesEnCurso = meses[meses.length - 1];

  // Las barras usan SOLO las filas TODAS: son el total del mes ya
  // deduplicado. Sumar las empresas contaría dos veces a alguien que usó
  // cupones de dos.
  const totalesPorPlataforma = filas.filter((f) => f.empresa === TODAS);
  const deEmpresas = filas.filter((f) => f.empresa !== TODAS);

  const nuevos = serie(totalesPorPlataforma, meses, (f) => Number(f.nuevos));
  const activos = serie(totalesPorPlataforma, meses, (f) => Number(f.activos));

  // El último mes CERRADO, no el último a secas.
  const cerrados = meses.filter((m) => m !== mesEnCurso);
  const mes = cerrados[cerrados.length - 1] ?? null;
  const mesPrevio = cerrados[cerrados.length - 2] ?? null;

  const sumaDe = (series: SerieBusiness[], m: string | null) =>
    m === null
      ? 0
      : series.reduce(
          (a, s) => a + (s.puntos.find((p) => p.mes === m)?.valor ?? 0),
          0,
        );

  const totalDelMes = totales.find((t) => t.mes === mes)?.pacientes_nuevos;
  const empresaDelMes =
    mes === null
      ? 0
      : todas
          .filter((f) => f.mes === mes && f.empresa === TODAS)
          .reduce((a, f) => a + Number(f.nuevos), 0);

  return {
    meses,
    nuevos,
    activos,
    empresas: armarEmpresas(deEmpresas),
    porMes: meses.map((m) => ({
      mes: m,
      empresas: new Set(
        deEmpresas
          .filter(
            (f) => f.mes === m && (Number(f.nuevos) > 0 || Number(f.activos) > 0),
          )
          .map((f) => f.empresa),
      ).size,
      enCurso: m === mesEnCurso,
    })),
    resumen: {
      nuevos: sumaDe(nuevos, mes),
      nuevosPrevio: sumaDe(nuevos, mesPrevio),
      activos: sumaDe(activos, mes),
      activosPrevio: sumaDe(activos, mesPrevio),
      mes,
      mesPrevio,
    },
    parte: {
      empresa: empresaDelMes,
      total:
        totalDelMes === null || totalDelMes === undefined
          ? 0
          : Number(totalDelMes),
      mes,
    },
    vacia: todas.length === 0,
  };
}

/** Una serie por plataforma, con los meses completos. */
function serie(
  filas: Fila[],
  meses: string[],
  valor: (f: Fila) => number,
): SerieBusiness[] {
  const porPais = new Map<string, Map<string, number>>();
  for (const f of filas) {
    const v = valor(f);
    if (v === 0) continue;
    let mesesDe = porPais.get(f.pais);
    if (!mesesDe) {
      mesesDe = new Map();
      porPais.set(f.pais, mesesDe);
    }
    mesesDe.set(f.mes, (mesesDe.get(f.mes) ?? 0) + v);
  }

  const mesEnCurso = meses[meses.length - 1];

  return [...porPais.keys()].sort().map((p) => ({
    nombre: p,
    puntos: meses.map((m) => ({
      mes: m,
      valor: porPais.get(p)?.get(m) ?? 0,
      enCurso: m === mesEnCurso,
    })),
  }));
}

/**
 * La tabla de empresas, sobre el rango que se está mirando y no sobre toda la
 * historia.
 *
 * Con toda la historia, SiSi entraba al top veinte con 20 pacientes aunque su
 * último cupón es de diciembre de 2024, sentada al lado de Pilay, que arrancó
 * hace cinco semanas. Una tabla que dice "las más grandes" tiene que decir las
 * más grandes de lo que estás mirando.
 *
 * `activos` se suma a lo largo de los meses, así que una empresa con el mismo
 * paciente doce meses seguidos suma doce. Por eso la columna que ordena es
 * `nuevos` cuando hay, y el número de activos va al lado como volumen, no como
 * gente distinta.
 */
function armarEmpresas(filas: Fila[]): FilaEmpresa[] {
  const por = new Map<string, FilaEmpresa>();

  for (const f of filas) {
    const nuevos = Number(f.nuevos);
    const activos = Number(f.activos);
    if (nuevos === 0 && activos === 0) continue;

    let e = por.get(f.empresa);
    if (!e) {
      e = { empresa: f.empresa, nuevos: 0, activos: 0, meses: 0, ultimo: f.mes };
      por.set(f.empresa, e);
    }
    e.nuevos += nuevos;
    e.activos += activos;
    if (f.mes > e.ultimo) e.ultimo = f.mes;
  }

  // Los meses se cuentan aparte: una empresa tiene una fila por plataforma, y
  // sumarlas diría que estuvo el doble de meses.
  for (const e of por.values()) {
    e.meses = new Set(
      filas
        .filter(
          (f) =>
            f.empresa === e.empresa &&
            (Number(f.nuevos) > 0 || Number(f.activos) > 0),
        )
        .map((f) => f.mes),
    ).size;
  }

  return [...por.values()].sort(
    (a, b) => b.activos - a.activos || b.nuevos - a.nuevos,
  );
}
