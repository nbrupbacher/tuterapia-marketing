import { withDb } from "@/lib/db";
import { type Rango } from "@/lib/dashboard";
import type { Desglose } from "@/lib/desglose";

/**
 * La pestaña Business: los pacientes que llegan con el cupón de una empresa.
 *
 * Todo sale de `marketing.business_mensual`, que escribe el cron del funnel.
 * La pantalla no consulta MySQL nunca.
 *
 * Las barras siguen el patrón de Exterior: en TOTAL se parten por
 * **plataforma**, y con una plataforma elegida se parten por **empresa**.
 *
 * En los nuevos las franjas suman exacto: se midió y la diferencia es cero en
 * los veintiséis meses×plataforma, porque un paciente entra con el cupón de
 * una sola empresa. En los activos no: quien usó cupones de dos empresas
 * cuenta en las dos, y en septiembre sumar las 46 empresas de Uruguay da 373
 * contra 366 personas distintas. Se apilan igual, a pedido del dueño del
 * producto el 2026-10-29, y la barra puede quedar más alta que la tarjeta.
 * La tarjeta sigue contando personas desde las filas TODAS (METRICAS.md
 * §6 septies).
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
  /**
   * Los activos de cada mes del rango, en el orden de `meses`, para la serie
   * en miniatura de la tabla.
   *
   * Va en la tabla y no solo en el detalle a propósito: son casi sesenta
   * empresas, y si la tendencia viviera únicamente adentro del panel habría
   * que abrirlas una por una para encontrar la que se está yendo.
   */
  serie: number[];
  /** Activos del último mes cerrado y del anterior, para el movimiento. */
  ahora: number;
  antes: number;
};

export type VistaBusiness = {
  meses: string[];
  nuevos: SerieBusiness[];
  /**
   * Por plataforma en TOTAL, por empresa con una plataforma elegida. Por
   * empresa puede sumar más que las personas: no usar para la tarjeta.
   */
  activos: SerieBusiness[];
  /**
   * Los activos de cada mes por empresa, para el tooltip de la barra de
   * activos. No suman la barra en TOTAL: quien usó cupones de dos empresas
   * está en las dos.
   */
  activosEmpresa: Desglose["utm"];
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
  /** Los últimos 45 días, para el gráfico de abajo. Solo nuevos. */
  diario: Desglose;
  vacia: boolean;
};

type FilaDia = { dia: string; pais: string; empresa: string; nuevos: string };

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
    const [mensual, totales, diario] = await Promise.all([
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
      db.query<FilaDia>(
        `select to_char(fecha, 'YYYY-MM-DD') as dia, pais, empresa, nuevos::text
           from marketing.business_diario
          order by fecha`,
      ),
    ]);

    return armar(mensual.rows, totales.rows, pais, diario.rows);
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
  dias: FilaDia[] = [],
  hoy = new Date(),
): VistaBusiness {
  const esTotal = pais === "TOTAL";
  const filas = esTotal ? todas : todas.filter((f) => f.pais === pais);
  const meses = [...new Set(todas.map((f) => f.mes))].sort();
  const mesEnCurso = meses[meses.length - 1];

  // Las filas TODAS son el total del mes ya deduplicado. Sumar las empresas
  // contaría dos veces a alguien que usó cupones de dos.
  const totalesPorPlataforma = filas.filter((f) => f.empresa === TODAS);
  const deEmpresas = filas.filter((f) => f.empresa !== TODAS);

  // Con una plataforma elegida, las barras se abren por empresa. En TOTAL no:
  // ahí la pregunta es cuánto pesa cada plataforma, y mezclar las empresas de
  // las dos en una sola barra no contesta ninguna de las dos cosas.
  const nuevos = esTotal
    ? serie(totalesPorPlataforma, meses, (f) => f.pais, (f) => Number(f.nuevos))
    : serie(deEmpresas, meses, (f) => f.empresa, (f) => Number(f.nuevos));

  // Las personas activas, siempre de las filas TODAS. Es lo que cuenta la
  // tarjeta, aunque la barra se abra por empresa y sume más.
  const activosPersonas = serie(
    totalesPorPlataforma,
    meses,
    (f) => f.pais,
    (f) => Number(f.activos),
  );
  const activos = esTotal
    ? activosPersonas
    : serie(deEmpresas, meses, (f) => f.empresa, (f) => Number(f.activos));

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
    activosEmpresa: porEmpresa(
      deEmpresas.map((f) => ({
        periodo: f.mes,
        empresa: f.empresa,
        valor: Number(f.activos),
      })),
    ),
    empresas: armarEmpresas(deEmpresas, meses, mes, mesPrevio),
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
      activos: sumaDe(activosPersonas, mes),
      activosPrevio: sumaDe(activosPersonas, mesPrevio),
      mes,
      mesPrevio,
    },
    diario: armarDiario(dias, esTotal, pais, hoy),
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

/**
 * Una serie por clave, con los meses completos.
 *
 * Los meses sin fila para una clave llevan 0 y no un hueco: una barra apilada
 * necesita que todas las series tengan el mismo largo, y una empresa que no
 * trajo a nadie en marzo trajo cero, no "no se sabe".
 *
 * Las plataformas van en orden alfabético, siempre el mismo, para que el color
 * de AR no cambie entre pestañas. Las empresas van por total descendente, así
 * las grandes se llevan los colores fuertes y la cola queda al final, donde el
 * gráfico la agrupa.
 */
function serie(
  filas: Fila[],
  meses: string[],
  clave: (f: Fila) => string,
  valor: (f: Fila) => number,
): SerieBusiness[] {
  const porClave = new Map<string, Map<string, number>>();
  const total = new Map<string, number>();

  for (const f of filas) {
    const v = valor(f);
    if (v === 0) continue;
    const k = clave(f);
    let mesesDe = porClave.get(k);
    if (!mesesDe) {
      mesesDe = new Map();
      porClave.set(k, mesesDe);
    }
    mesesDe.set(f.mes, (mesesDe.get(f.mes) ?? 0) + v);
    total.set(k, (total.get(k) ?? 0) + v);
  }

  // Las plataformas son dos y se nombran igual siempre; las empresas son
  // muchas y el orden lo decide el volumen.
  const esPlataforma = [...porClave.keys()].every((k) => k === "AR" || k === "UY");
  const orden = esPlataforma
    ? [...porClave.keys()].sort()
    : [...total.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);

  const mesEnCurso = meses[meses.length - 1];

  return orden.map((k) => ({
    nombre: k,
    puntos: meses.map((m) => ({
      mes: m,
      valor: porClave.get(k)?.get(m) ?? 0,
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
function armarEmpresas(
  filas: Fila[],
  meses: string[],
  mes: string | null,
  mesPrevio: string | null,
): FilaEmpresa[] {
  const por = new Map<string, FilaEmpresa>();
  // Los activos de cada empresa en cada mes. Una empresa tiene una fila por
  // plataforma, así que se suman: en TOTAL la serie es la de las dos juntas.
  const serie = new Map<string, Map<string, number>>();

  for (const f of filas) {
    const nuevos = Number(f.nuevos);
    const activos = Number(f.activos);
    if (nuevos === 0 && activos === 0) continue;

    let e = por.get(f.empresa);
    if (!e) {
      e = {
        empresa: f.empresa,
        nuevos: 0,
        activos: 0,
        meses: 0,
        ultimo: f.mes,
        serie: [],
        ahora: 0,
        antes: 0,
      };
      por.set(f.empresa, e);
      serie.set(f.empresa, new Map());
    }
    e.nuevos += nuevos;
    e.activos += activos;
    if (f.mes > e.ultimo) e.ultimo = f.mes;

    const porMes = serie.get(f.empresa)!;
    porMes.set(f.mes, (porMes.get(f.mes) ?? 0) + activos);
  }

  for (const e of por.values()) {
    const porMes = serie.get(e.empresa)!;
    e.serie = meses.map((m) => porMes.get(m) ?? 0);
    e.ahora = mes === null ? 0 : (porMes.get(mes) ?? 0);
    e.antes = mesPrevio === null ? 0 : (porMes.get(mesPrevio) ?? 0);
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

/**
 * Las filas de empresa en la forma del tooltip, una por período y empresa.
 *
 * En TOTAL una empresa con pacientes en AR y en UY trae dos filas por
 * período; acá se juntan en una, porque el tooltip pregunta de qué empresa y
 * no de qué plataforma.
 */
function porEmpresa(
  filas: { periodo: string; empresa: string; valor: number }[],
): Desglose["utm"] {
  const por = new Map<string, Desglose["utm"][number]>();
  for (const f of filas) {
    if (f.empresa === TODAS || f.valor === 0) continue;
    const k = `${f.periodo}|${f.empresa}`;
    const punto = por.get(k);
    if (punto) punto.valor += f.valor;
    else por.set(k, { periodo: f.periodo, clave: f.empresa, valor: f.valor });
  }
  return [...por.values()];
}

/**
 * Los últimos días, en la forma que espera `GraficoDiario`.
 *
 * Se parte igual que la barra mensual —por plataforma en TOTAL, por empresa
 * dentro de una plataforma— para que las dos lean lo mismo. Un gráfico arriba
 * partido por empresa y el de abajo por plataforma obligaría a recalibrar el
 * ojo entre uno y otro.
 *
 * `utm` lleva las empresas de cada día, para el tooltip. En TOTAL las franjas
 * son plataformas y la empresa no se ve en ningún lado; dentro de una
 * plataforma sí son empresas, pero son más que los doce colores y la franja
 * sola no dice cuál es. Las filas suman lo mismo que la barra porque un
 * paciente entra con el cupón de una sola empresa.
 */
function armarDiario(
  dias: FilaDia[],
  esTotal: boolean,
  pais: string,
  hoy = new Date(),
): Desglose {
  const filas = esTotal ? dias : dias.filter((f) => f.pais === pais);
  const deInteres = esTotal
    ? filas.filter((f) => f.empresa === TODAS)
    : filas.filter((f) => f.empresa !== TODAS);

  const total = new Map<string, number>();
  const barras = deInteres
    .map((f) => {
      const clave = esTotal ? f.pais : f.empresa;
      const valor = Number(f.nuevos);
      total.set(clave, (total.get(clave) ?? 0) + valor);
      return { periodo: f.dia, clave, valor };
    })
    .filter((p) => p.valor > 0);

  // Por volumen descendente: el apilado no se reordena entre renders y la
  // empresa grande se lleva el color fuerte.
  const claves = [...total.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k);

  // Un día sin ningún paciente nuevo no deja fila, y el gráfico arma su eje
  // con los días que recibe. Sin esto, un día en cero no se dibuja como cero:
  // desaparece. Eso hacía dos cosas feas a la vez —el 25, 26, 27 y 29 quedaban
  // pegados como si fueran consecutivos, y con UY elegido el gráfico terminaba
  // el 27 y parecía que el tablero estaba desactualizado—.
  //
  // Así que el eje lo pone el calendario: todos los días desde el primero que
  // hay guardado hasta ayer, con un cero invisible donde no hubo nadie.
  const primero = dias.map((f) => f.dia).sort()[0];
  if (primero && claves.length > 0) {
    const conDato = new Set(barras.map((b) => b.periodo));
    for (const dia of calendario(primero, ayerLocal(hoy))) {
      if (!conDato.has(dia)) {
        barras.push({ periodo: dia, clave: claves[0]!, valor: 0 });
      }
    }
  }

  return {
    barras,
    plataformas: esTotal ? claves.sort() : claves,
    utm: porEmpresa(
      filas.map((f) => ({
        periodo: f.dia,
        empresa: f.empresa,
        valor: Number(f.nuevos),
      })),
    ),
  };
}

/** Ayer, en día local (UTC−3): el último día completo que se puede dibujar. */
function ayerLocal(hoy: Date): string {
  const d = new Date(hoy.getTime() - 3 * 3_600_000);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Todos los días entre dos fechas 'YYYY-MM-DD', inclusive. */
function calendario(desde: string, hasta: string): string[] {
  const dias: string[] = [];
  const d = new Date(`${desde}T00:00:00Z`);
  const fin = new Date(`${hasta}T00:00:00Z`);
  while (d <= fin) {
    dias.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dias;
}
