import { withDb } from "@/lib/db";
import { PAISES_REALES, type Rango } from "@/lib/dashboard";

/**
 * La pestaña Exterior: los pacientes que pagan en dólares.
 *
 * Dos dimensiones, y cuál se dibuja lo decide el selector de país, igual que
 * en General pero al revés: General en TOTAL apila por país y con un país
 * elegido apila por plataforma; acá en TOTAL apila por PLATAFORMA y con una
 * plataforma elegida apila por el PAÍS DEL PACIENTE.
 *
 * Todo sale de `marketing.exterior_mensual` y `marketing.exterior_utm`, que
 * escribe el cron del funnel. La pantalla no consulta MySQL nunca.
 */

/** Cuántos países se nombran antes de agrupar el resto. */
export const PAISES_NOMBRADOS = 5;

/** La etiqueta del origen cuando el perfil no tiene país. */
export const SIN_PAIS = "??";

export type Punto = { mes: string; valor: number; enCurso: boolean };

export type SerieExterior = {
  nombre: string;
  puntos: Punto[];
};

export type FuenteUtm = {
  /** 'Sin utm' cuando el registro no trajo ninguno. */
  fuente: string;
  /** Por plataforma, en el orden de PAISES_REALES. */
  porPais: { pais: string; pacientes: number; parte: number }[];
  total: number;
};

export type VistaExterior = {
  meses: string[];
  /** Series apiladas de cada gráfico, ya recortadas y ordenadas. */
  nuevos: SerieExterior[];
  activos: SerieExterior[];
  /** Totales del último mes cerrado y del anterior, para las tarjetas. */
  resumen: {
    nuevos: number;
    nuevosPrevio: number;
    activos: number;
    activosPrevio: number;
    mes: string | null;
    mesPrevio: string | null;
  };
  /** Pacientes nuevos del exterior y del total, para la parte que representan. */
  parte: { exterior: number; total: number; mes: string | null };
  utm: FuenteUtm[];
  /** Si no hay una sola fila: el cron todavía no corrió. */
  vacia: boolean;
};

type FilaMensual = {
  mes: string;
  pais: string;
  origen: string;
  nuevos: string;
  activos: string;
};

export async function leerExterior(
  pais: string,
  meses: Rango,
): Promise<VistaExterior> {
  const esTotal = pais === "TOTAL";

  return withDb(async (db) => {
    const [mensual, utm, totales] = await Promise.all([
      db.query<FilaMensual>(
        // Sin filtrar por plataforma a propósito: las series se filtran al
        // armarlas, pero la tarjeta de "parte de los pacientes nuevos" mide el
        // exterior ENTERO contra el negocio entero, y con AR elegido una
        // consulta filtrada dejaría afuera la mitad del numerador sin cambiar
        // el denominador.
        `select to_char(mes, 'YYYY-MM') as mes, pais, origen,
                nuevos::text, activos::text
           from marketing.exterior_mensual
          where mes > (date_trunc('month', current_date)
                       - make_interval(months => $1))
          order by mes`,
        [meses],
      ),
      db.query<{ pais: string; utm_source: string; nuevos: string }>(
        `select pais, utm_source, sum(nuevos)::text as nuevos
           from marketing.exterior_utm
          where mes > (date_trunc('month', current_date)
                       - make_interval(months => $1))
          group by pais, utm_source`,
        [meses],
      ),
      // Los pacientes nuevos de todo el negocio, de la MISMA tabla que lee
      // General: la parte que es el exterior no se puede calcular con un
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

    return armar(mensual.rows, utm.rows, totales.rows, esTotal, pais);
  });
}

/**
 * Pura, para poder razonarla sin base de datos.
 *
 * El recorte de países vive acá y no en la consulta: guardados están todos, y
 * cuál cae en "resto" depende de la ventana que se esté mirando. Recortarlo al
 * escribir ataría la tabla al rango con el que se escribió.
 */
export function armar(
  todas: FilaMensual[],
  utmFilas: { pais: string; utm_source: string; nuevos: string }[],
  totales: { mes: string; pacientes_nuevos: string | null }[],
  esTotal: boolean,
  pais = "TOTAL",
): VistaExterior {
  // Los gráficos miran la plataforma elegida; la tarjeta de "parte" mira todo.
  const filas = esTotal ? todas : todas.filter((f) => f.pais === pais);
  const meses = [...new Set(todas.map((f) => f.mes))].sort();
  const mesEnCurso = meses[meses.length - 1];

  // La clave de apilado: la plataforma en TOTAL, el país del paciente adentro
  // de una plataforma. Es el único lugar donde se decide, así que los dos
  // gráficos y el panel no pueden discrepar.
  const clave = (f: FilaMensual) => (esTotal ? f.pais : f.origen);

  const nuevos = serie(filas, meses, clave, (f) => Number(f.nuevos), esTotal);
  const activos = serie(filas, meses, clave, (f) => Number(f.activos), esTotal);

  // El último mes CERRADO, no el último a secas: medio octubre contra todo
  // septiembre dice que el mes se derrumbó, y eso solo es cierto del
  // calendario.
  const cerrados = meses.filter((m) => m !== mesEnCurso);
  const mes = cerrados[cerrados.length - 1] ?? null;
  const mesPrevio = cerrados[cerrados.length - 2] ?? null;

  const sumaDe = (series: SerieExterior[], m: string | null) =>
    m === null
      ? 0
      : series.reduce(
          (a, s) => a + (s.puntos.find((p) => p.mes === m)?.valor ?? 0),
          0,
        );

  const totalDelMes = totales.find((t) => t.mes === mes)?.pacientes_nuevos;

  // Sobre el exterior entero y no sobre la plataforma elegida: la tarjeta
  // contesta cuánto pesa el exterior en el negocio, y con AR elegido un
  // numerador filtrado contra un denominador entero no contesta ninguna de
  // las dos preguntas.
  const exteriorDelMes =
    mes === null
      ? 0
      : todas
          .filter((f) => f.mes === mes)
          .reduce((a, f) => a + Number(f.nuevos), 0);

  return {
    meses,
    nuevos,
    activos,
    resumen: {
      nuevos: sumaDe(nuevos, mes),
      nuevosPrevio: sumaDe(nuevos, mesPrevio),
      activos: sumaDe(activos, mes),
      activosPrevio: sumaDe(activos, mesPrevio),
      mes,
      mesPrevio,
    },
    parte: {
      exterior: exteriorDelMes,
      total: totalDelMes === null || totalDelMes === undefined ? 0 : Number(totalDelMes),
      mes,
    },
    utm: armarUtm(utmFilas),
    vacia: todas.length === 0,
  };
}

/**
 * Una serie por clave, con los meses completos y el resto agrupado.
 *
 * Los meses sin fila para una clave llevan 0 y no un hueco: una barra apilada
 * necesita que todas las series tengan el mismo largo, y un país que no
 * apareció en marzo aportó cero, no "no se sabe".
 *
 * En TOTAL no se recorta nada: son dos plataformas. Adentro de una, se nombran
 * las cinco más grandes y el resto va junto, porque la cola son unos veinte
 * países con uno o dos pacientes y veinte franjas de un píxel no son un
 * gráfico.
 */
function serie(
  filas: FilaMensual[],
  meses: string[],
  clave: (f: FilaMensual) => string,
  valor: (f: FilaMensual) => number,
  esTotal: boolean,
): SerieExterior[] {
  const porClave = new Map<string, Map<string, number>>();
  const totalPorClave = new Map<string, number>();

  for (const f of filas) {
    const k = clave(f);
    const v = valor(f);
    if (v === 0) continue;
    let mesesDe = porClave.get(k);
    if (!mesesDe) {
      mesesDe = new Map();
      porClave.set(k, mesesDe);
    }
    mesesDe.set(f.mes, (mesesDe.get(f.mes) ?? 0) + v);
    totalPorClave.set(k, (totalPorClave.get(k) ?? 0) + v);
  }

  const orden = [...totalPorClave.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  const nombradas = esTotal ? orden : orden.slice(0, PAISES_NOMBRADOS);
  const agrupadas = esTotal ? [] : orden.slice(PAISES_NOMBRADOS);

  const mesEnCurso = meses[meses.length - 1];
  const armarPuntos = (claves: string[]): Punto[] =>
    meses.map((m) => ({
      mes: m,
      valor: claves.reduce((a, k) => a + (porClave.get(k)?.get(m) ?? 0), 0),
      enCurso: m === mesEnCurso,
    }));

  const series: SerieExterior[] = nombradas.map((k) => ({
    nombre: k === SIN_PAIS ? "sin país" : k,
    puntos: armarPuntos([k]),
  }));

  if (agrupadas.length > 0) {
    series.push({ nombre: "resto", puntos: armarPuntos(agrupadas) });
  }

  return series;
}

/**
 * El utm, con las dos plataformas en la misma fila.
 *
 * Siempre las dos, sin importar el selector: la gracia de este bloque es la
 * diferencia entre una y otra —96% sin marcar en Uruguay contra 80% en
 * Argentina— y con una sola columna esa diferencia no se ve.
 */
function armarUtm(
  filas: { pais: string; utm_source: string; nuevos: string }[],
): FuenteUtm[] {
  const porFuente = new Map<string, Map<string, number>>();
  const totalPorPais = new Map<string, number>();

  for (const f of filas) {
    const n = Number(f.nuevos);
    if (n === 0) continue;
    const fuente = f.utm_source === "" ? "Sin utm" : f.utm_source;
    let paises = porFuente.get(fuente);
    if (!paises) {
      paises = new Map();
      porFuente.set(fuente, paises);
    }
    paises.set(f.pais, (paises.get(f.pais) ?? 0) + n);
    totalPorPais.set(f.pais, (totalPorPais.get(f.pais) ?? 0) + n);
  }

  return [...porFuente.entries()]
    .map(([fuente, paises]) => {
      const porPais = PAISES_REALES.map((p) => {
        const pacientes = paises.get(p) ?? 0;
        const total = totalPorPais.get(p) ?? 0;
        return { pais: p as string, pacientes, parte: total > 0 ? pacientes / total : 0 };
      });
      return {
        fuente,
        porPais,
        total: porPais.reduce((a, p) => a + p.pacientes, 0),
      };
    })
    // "Sin utm" primero porque es la respuesta, no una fuente más; el resto
    // por volumen.
    .sort((a, b) => {
      if (a.fuente === "Sin utm") return -1;
      if (b.fuente === "Sin utm") return 1;
      return b.total - a.total;
    });
}
