import { withDb } from "@/lib/db";
import { PAISES_REALES, type Rango } from "@/lib/dashboard";
import { bandera } from "@/lib/ui/format";
import type { Desglose } from "@/lib/desglose";

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

/** La etiqueta del origen cuando el perfil no tiene país. */
export const SIN_PAIS = "??";

/**
 * Cómo se nombra un origen en pantalla: la banderita y la abreviatura.
 *
 * La abreviatura va siempre, aunque esté la bandera. En Windows, Chrome no
 * dibuja los pares de indicadores regionales y muestra dos cajitas, así que
 * la bandera es un adorno que puede faltar y el código es el dato.
 */
export function etiquetaOrigen(origen: string): string {
  if (origen === SIN_PAIS) return `${bandera("")} sin país`;
  return `${bandera(origen)} ${origen}`;
}

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
  /** Los últimos 45 días, entre las dos mensuales. Solo nuevos. */
  diario: Desglose;
  /** Si no hay una sola fila: el cron todavía no corrió. */
  vacia: boolean;
};

type FilaDia = {
  dia: string;
  pais: string;
  origen: string;
  utm_source: string;
  nuevos: string;
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
    const [mensual, utm, totales, diario] = await Promise.all([
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
      db.query<FilaDia>(
        `select to_char(fecha, 'YYYY-MM-DD') as dia, pais, origen, utm_source,
                nuevos::text
           from marketing.exterior_diario
          order by fecha`,
      ),
    ]);

    return armar(
      mensual.rows,
      utm.rows,
      totales.rows,
      esTotal,
      pais,
      diario.rows,
    );
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
  dias: FilaDia[] = [],
  hoy = new Date(),
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
    diario: armarDiario(dias, esTotal, pais, hoy),
    vacia: todas.length === 0,
  };
}

/**
 * Una serie por clave, con los meses completos.
 *
 * Los meses sin fila para una clave llevan 0 y no un hueco: una barra apilada
 * necesita que todas las series tengan el mismo largo, y un país que no
 * apareció en marzo aportó cero, no "no se sabe".
 *
 * **No se agrupa nada.** Antes la cola caía en una franja "resto" y el pedido
 * fue verlos: *"prefiero que los muestres que decir resto"*. Es menos cola de
 * lo que parece — el rango entero junta 22 países en Argentina, pero un mes
 * suelto tiene entre 3 y 7 en los nuevos y hasta 17 en los activos, que es lo
 * que una barra tiene que dibujar.
 *
 * El orden es por total descendente, así que los países grandes se llevan los
 * colores fuertes y los de un paciente quedan al final, donde la franja mide
 * un píxel y el color ya no distingue nada.
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

  const mesEnCurso = meses[meses.length - 1];

  return orden.map((k) => ({
    // La plataforma se nombra sola; el país lleva su banderita adelante.
    nombre: esTotal ? k : etiquetaOrigen(k),
    puntos: meses.map((m) => ({
      mes: m,
      valor: porClave.get(k)?.get(m) ?? 0,
      enCurso: m === mesEnCurso,
    })),
  }));
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

/**
 * Los últimos días, en la forma que espera `GraficoDiario`.
 *
 * Las barras se parten como las mensuales —por plataforma en TOTAL, por país
 * del paciente adentro de una— para que arriba y abajo se lean igual.
 *
 * El tooltip, en cambio, muestra **país y utm juntos** en cada fila: de dónde
 * es la persona y de dónde vino. Son las dos preguntas de esta pestaña y en el
 * diario se pueden cruzar sin contar a nadie dos veces, porque acá no hay
 * activos.
 */
function armarDiario(
  dias: FilaDia[],
  esTotal: boolean,
  pais: string,
  hoy: Date,
): Desglose {
  const filas = esTotal ? dias : dias.filter((f) => f.pais === pais);

  const total = new Map<string, number>();
  const porClave = new Map<string, number>();
  const porDetalle = new Map<string, number>();

  for (const f of filas) {
    const valor = Number(f.nuevos);
    if (valor === 0) continue;

    const clave = esTotal ? f.pais : etiquetaOrigen(f.origen);
    total.set(clave, (total.get(clave) ?? 0) + valor);
    porClave.set(`${f.dia}|${clave}`, (porClave.get(`${f.dia}|${clave}`) ?? 0) + valor);

    const detalle = `${etiquetaOrigen(f.origen)} · ${
      f.utm_source === "" ? "sin utm" : f.utm_source
    }`;
    porDetalle.set(
      `${f.dia}|${detalle}`,
      (porDetalle.get(`${f.dia}|${detalle}`) ?? 0) + valor,
    );
  }

  const barras = [...porClave.entries()].map(([k, valor]) => {
    const [periodo, clave] = k.split("|");
    return { periodo: periodo!, clave: clave!, valor };
  });

  const claves = [...total.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  // Un día sin nadie no deja fila, y el gráfico arma su eje con los días que
  // recibe: sin esto el día vacío desaparece en vez de dibujarse como cero, y
  // los días que quedan se pegan como si fueran consecutivos.
  const primero = dias.map((f) => f.dia).sort()[0];
  if (primero && claves.length > 0) {
    const conDato = new Set(barras.map((b) => b.periodo));
    for (const dia of calendarioHasta(primero, ayerLocal(hoy))) {
      if (!conDato.has(dia)) {
        barras.push({ periodo: dia, clave: claves[0]!, valor: 0 });
      }
    }
  }

  return {
    barras,
    plataformas: esTotal ? claves.sort() : claves,
    utm: [...porDetalle.entries()].map(([k, valor]) => {
      const [periodo, clave] = k.split("|");
      return { periodo: periodo!, clave: clave!, valor };
    }),
  };
}

/** Ayer, en día local (UTC−3): el último día completo que se puede dibujar. */
function ayerLocal(hoy: Date): string {
  const d = new Date(hoy.getTime() - 3 * 3_600_000);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Todos los días entre dos fechas 'YYYY-MM-DD', inclusive. */
function calendarioHasta(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  const d = new Date(`${desde}T00:00:00Z`);
  const fin = new Date(`${hasta}T00:00:00Z`);
  while (d <= fin) {
    dias.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dias;
}
