import { withDb } from "@/lib/db";
import { LOCAL_UTC_OFFSET_HOURS } from "@/lib/queries/shared";

/**
 * Sesiones vendidas: la serie diaria y el panel del mes.
 *
 * Vendidas, no realizadas. Una venta es un paquete entero y cae completa el
 * día del pago, así que la serie es dentada por naturaleza: ocho sesiones
 * compradas un martes son ocho de ese martes. No confundir con
 * `metricas_diarias.sesiones_realizadas`, que es cuándo ocurrió la sesión.
 */

/** Lo que dibuja el gráfico. */
export const DIAS_DE_BARRAS = 15;

/** Cuántas semanas completas miran el patrón semanal de la proyección. */
const SEMANAS_DE_PATRON = 8;

export const MODALIDADES = ["online", "presencial", "sin_dato"] as const;
export type Modalidad = (typeof MODALIDADES)[number];

/**
 * El mismo juego, al revés: presencial primero.
 *
 * Lo usa la sección de presencial, donde el apilado tiene que empezar por
 * abajo con lo que se está mirando. Con el presencial arriba de todo, la
 * banda flota a distintas alturas según el online del día y deja de poder
 * compararse contra sí misma.
 */
const POR_MODALIDAD = ["presencial", "online", "sin_dato"] as const;

export type Barra = {
  fecha: string;
  /** Por `${pais}·${modalidad}`. */
  segmentos: Map<string, number>;
  total: number;
};

export type Parte = {
  pais: string;
  modalidad: Modalidad;
  sesiones: number;
  /** Sobre el total del mes en curso del país filtrado. */
  parte: number;
};

export type VistaSesiones = {
  barras: Barra[];
  /** Las claves presentes, en orden de dibujo. */
  claves: string[];
  /** Sesiones del mes en curso, hasta hoy. */
  delMes: number;
  /** Los mismos días del mes anterior. */
  delMesPrevio: number;
  /** Cierre completo del mes anterior. */
  cierrePrevio: number;
  /** Desglose del mes en curso. */
  partes: Parte[];
  /** A fin de mes, con el patrón semanal. */
  proyeccion: number;
  /** Cuántos días del mes ya pasaron y cuántos tiene. */
  diaDelMes: number;
  diasDelMes: number;
  /** Si el patrón semanal no tenía base suficiente y se cayó a lineal. */
  proyeccionLineal: boolean;
};

export async function leerSesiones(
  pais: string,
  ahora = new Date(),
): Promise<VistaSesiones> {
  const hoy = diaLocal(ahora);
  const paises = pais === "TOTAL" ? ["AR", "UY"] : [pais];

  const filas = await withDb(async (db) => {
    const { rows } = await db.query<{
      fecha: string;
      pais: string;
      modalidad: Modalidad;
      sesiones: number;
    }>(
      `select fecha::text, pais, modalidad, sesiones
         from marketing.sesiones_vendidas
        where pais = any($1) and fecha <= $2
        order by fecha`,
      [paises, hoy],
    );
    return rows.map((r) => ({ ...r, n: Number(r.sesiones) }));
  });

  return armarVista(filas, { paises, dias: DIAS_DE_BARRAS, hoy });
}

/** Una fila de un conteo diario partido por país y modalidad. */
export type FilaModalidad = {
  fecha: string;
  pais: string;
  modalidad: Modalidad;
  n: number;
};

/**
 * El gráfico y el panel, a partir de las filas diarias.
 *
 * Vive aparte de la consulta porque hay dos tablas con esta misma forma
 * —`sesiones_vendidas` y `presencial_diario`— y la cuenta del mes contra los
 * mismos días del anterior, el reparto y la proyección son idénticas. La
 * regla del proyecto es que un cálculo no se escribe dos veces.
 *
 * `dias` es cuántas barras dibuja el gráfico; las filas que quedan afuera de
 * esa ventana igual se usan, porque el mes anterior y el patrón semanal de la
 * proyección miran más atrás que el gráfico.
 *
 * `orden` decide cómo se apila. Por país —online antes que presencial dentro
 * de cada uno— es lo que hace falta cuando la pregunta es "de qué país".
 * Por modalidad pone el presencial abajo de todo, que es lo que hace falta
 * cuando la pregunta es justamente esa.
 */
export function armarVista(
  filas: FilaModalidad[],
  {
    paises,
    dias,
    hoy,
    orden = "pais",
  }: {
    paises: string[];
    dias: number;
    hoy: string;
    orden?: "pais" | "modalidad";
  },
): VistaSesiones {
  // Un día de la serie por fecha, aunque no haya tenido ninguna sesión: un
  // domingo sin sesiones es un dato, no un hueco, y sin la barra vacía el eje
  // mentiría sobre el ritmo de la semana.
  const desde = sumarDias(hoy, -(dias - 1));
  const barras: Barra[] = [];
  for (let d = desde; d <= hoy; d = sumarDias(d, 1)) {
    barras.push({ fecha: d, segmentos: new Map(), total: 0 });
  }
  const porFecha = new Map(barras.map((b) => [b.fecha, b]));

  const porDia = new Map<string, number>();
  for (const f of filas) {
    porDia.set(f.fecha, (porDia.get(f.fecha) ?? 0) + f.n);
    const barra = porFecha.get(f.fecha);
    if (!barra) continue;
    const clave = `${f.pais}·${f.modalidad}`;
    barra.segmentos.set(clave, (barra.segmentos.get(clave) ?? 0) + f.n);
    barra.total += f.n;
  }

  // El orden de dibujo es fijo. Si saliera de los datos, el apilado se
  // reordenaría solo el día que una modalidad quede en cero.
  const pares =
    orden === "pais"
      ? paises.flatMap((p) => MODALIDADES.map((m) => [p, m] as const))
      : POR_MODALIDAD.flatMap((m) => paises.map((p) => [p, m] as const));
  const claves: string[] = [];
  for (const [p, m] of pares) {
    const clave = `${p}·${m}`;
    if (barras.some((b) => (b.segmentos.get(clave) ?? 0) > 0)) {
      claves.push(clave);
    }
  }

  const mes = hoy.slice(0, 7);
  const previo = mesPrevio(mes);
  const diaDelMes = Number(hoy.slice(8, 10));
  const diasDelMes = diasEnMes(mes);

  const enMes = (f: { fecha: string }) => f.fecha.slice(0, 7);
  const delMes = filas
    .filter((f) => enMes(f) === mes)
    .reduce((a, f) => a + f.n, 0);

  // Los mismos días del mes anterior, no el mes entero: medio septiembre
  // contra todo agosto dice que el mes se derrumbó, y eso solo es cierto del
  // calendario.
  const corte = `${previo}-${String(Math.min(diaDelMes, diasEnMes(previo))).padStart(2, "0")}`;
  const delMesPrevio = filas
    .filter((f) => enMes(f) === previo && f.fecha <= corte)
    .reduce((a, f) => a + f.n, 0);

  const cierrePrevio = filas
    .filter((f) => enMes(f) === previo)
    .reduce((a, f) => a + f.n, 0);

  const porParte = new Map<string, number>();
  for (const f of filas) {
    if (enMes(f) !== mes) continue;
    const clave = `${f.pais}·${f.modalidad}`;
    porParte.set(clave, (porParte.get(clave) ?? 0) + f.n);
  }
  const partes: Parte[] = [];
  for (const [p, m] of pares) {
    const n = porParte.get(`${p}·${m}`) ?? 0;
    if (n === 0) continue;
    partes.push({
      pais: p,
      modalidad: m,
      sesiones: n,
      parte: delMes > 0 ? n / delMes : 0,
    });
  }

  const { total: proyeccion, lineal } = proyectar(
    porDia,
    mes,
    diaDelMes,
    diasDelMes,
    delMes,
    hoy,
  );

  return {
    barras,
    claves,
    delMes,
    delMesPrevio,
    cierrePrevio,
    partes,
    proyeccion,
    diaDelMes,
    diasDelMes,
    proyeccionLineal: lineal,
  };
}

/**
 * La proyección a fin de mes, con el peso real de cada día de la semana.
 *
 * Una proyección lineal —lo que va del mes dividido los días transcurridos,
 * por los días del mes— es mentira acá: los fines de semana casi no hay
 * sesiones, así que un mes que arranca un lunes proyecta de más y uno que
 * arranca un sábado, de menos.
 *
 * En vez de eso:
 *
 *  1. De las últimas ocho semanas COMPLETAS sale el peso de cada día de la
 *     semana: cuántas sesiones tiene un martes comparado con el día promedio.
 *  2. El nivel del mes en curso se mide contra su propio calendario — las
 *     sesiones que ya pasaron divididas por la suma de los pesos de los días
 *     que ya pasaron. Eso es el "ritmo" del mes, limpio de qué días cayeron.
 *  3. Los días que faltan se suman con su peso, a ese ritmo.
 *
 * Si no hay al menos cuatro semanas completas, cae a lineal y lo dice: una
 * proyección con un patrón inventado sobre dos semanas es peor que una lineal
 * honesta.
 */
function proyectar(
  porDia: Map<string, number>,
  mes: string,
  diaDelMes: number,
  diasDelMes: number,
  delMes: number,
  hoy: string,
): { total: number; lineal: boolean } {
  const linealmente = () => ({
    total: diaDelMes > 0 ? Math.round((delMes / diaDelMes) * diasDelMes) : 0,
    lineal: true,
  });

  // Semanas completas: se corta en el último domingo anterior a hoy, así el
  // patrón nunca incluye la semana a medio andar.
  const finDePatron = ultimoDomingo(hoy);
  const inicioDePatron = sumarDias(finDePatron, -(SEMANAS_DE_PATRON * 7 - 1));

  const suma = new Array(7).fill(0);
  const cuenta = new Array(7).fill(0);
  for (let d = inicioDePatron; d <= finDePatron; d = sumarDias(d, 1)) {
    // Un día sin ventas cuenta como cero, no como ausente: si se saltearan,
    // el promedio del sábado se calcularía solo sobre los sábados que
    // vendieron y el peso del fin de semana saldría el doble de lo que es.
    const dow = diaDeSemana(d);
    suma[dow] += porDia.get(d) ?? 0;
    cuenta[dow] += 1;
  }

  const semanasCubiertas = Math.min(...cuenta);
  const totalPatron = suma.reduce((a, b) => a + b, 0);
  if (semanasCubiertas < 4 || totalPatron === 0) return linealmente();

  const promedioDiario = totalPatron / suma.length / semanasCubiertas;
  if (promedioDiario <= 0) return linealmente();
  const peso = suma.map((s, i) => s / cuenta[i]! / promedioDiario);

  let pesoTranscurrido = 0;
  let pesoRestante = 0;
  for (let n = 1; n <= diasDelMes; n += 1) {
    const fecha = `${mes}-${String(n).padStart(2, "0")}`;
    const w = peso[diaDeSemana(fecha)]!;
    if (n <= diaDelMes) pesoTranscurrido += w;
    else pesoRestante += w;
  }

  if (pesoTranscurrido <= 0) return linealmente();
  const ritmo = delMes / pesoTranscurrido;
  return { total: Math.round(delMes + ritmo * pesoRestante), lineal: false };
}

/** 0 = domingo, como getUTCDay. */
function diaDeSemana(fecha: string): number {
  return new Date(`${fecha}T00:00:00Z`).getUTCDay();
}

function ultimoDomingo(hoy: string): string {
  return sumarDias(hoy, -diaDeSemana(hoy) - (diaDeSemana(hoy) === 0 ? 7 : 0));
}

function diaLocal(ahora: Date): string {
  return new Date(ahora.getTime() - LOCAL_UTC_OFFSET_HOURS * 3_600_000)
    .toISOString()
    .slice(0, 10);
}

function sumarDias(fecha: string, dias: number): string {
  return new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function mesPrevio(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y!, m! - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function diasEnMes(mes: string): number {
  const [y, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}
