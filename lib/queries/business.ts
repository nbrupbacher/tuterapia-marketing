import type { Connection, RowDataPacket } from "mysql2/promise";
import { LOCAL_UTC_OFFSET_HOURS, type Rango } from "./shared";
import { sqlEmpresa } from "@/lib/empresas";

/**
 * Los pacientes que llegan con el cupón de una empresa.
 *
 * La base no tiene columna que diga qué es un cupón de empresa: `cupones` es
 * id, codigo, nombre, pais, fecha, los límites, el porcentaje y activo. La
 * empresa sale del nombre del cupón, con el mapeo de `lib/empresas.ts` que
 * revisó el dueño del producto el 2026-10-29.
 *
 * `sqlEmpresa()` se arma en TypeScript y corre DENTRO de MySQL a propósito:
 * varias empresas emiten un cupón por empleado y le ponen el nombre de esa
 * persona —pacientes en tratamiento—, así que el nombre del cupón se compara
 * allá y de acá solo vuelve el nombre de la empresa.
 *
 * Las campañas quedan afuera: Black Friday, cyber, cumpleaños y los cupones
 * mensuales de ads no son una empresa, y la primera versión de esto las
 * contaba —daba 682 activos en septiembre contra 388 reales—.
 *
 * Chile queda afuera, como en todo el tablero (METRICAS.md §1).
 */

/** La etiqueta de la fila con el total del mes, ya deduplicado. */
export const TODAS = "TODAS";

/** El día local (UTC−3) de una columna de fecha. */
function diaLocal(columna: string): string {
  return `DATE(DATE_SUB(${columna}, INTERVAL ${LOCAL_UTC_OFFSET_HOURS} HOUR))`;
}

/** El mes local (UTC−3) de una columna de fecha, como el resto del tablero. */
function mesLocal(columna: string): string {
  return `DATE_FORMAT(DATE_SUB(${columna}, INTERVAL ${LOCAL_UTC_OFFSET_HOURS} HOUR), '%Y-%m')`;
}

/** El primer día del mes SIGUIENTE al de una fecha, en día local. */
function finDelMes(columna: string): string {
  return `DATE_ADD(DATE_FORMAT(DATE_SUB(${columna}, INTERVAL ${LOCAL_UTC_OFFSET_HOURS} HOUR), '%Y-%m-01'), INTERVAL 1 MONTH)`;
}

/** El primer pago confirmado de cada paciente. */
const PRIMER_PAGO = `
  SELECT id_paciente, MIN(creacion) AS primera
    FROM pacientes_pagos WHERE confirmado = 1
   GROUP BY id_paciente`;

/**
 * Pago → empresa: a qué empresa pertenece el cupón que se aplicó a un pago.
 *
 * Es lo que define un paciente NUEVO de empresa: el cupón vino en la compra
 * con la que entró. La otra lectura —"usó un cupón de empresa alguna vez"— se
 * descartó porque haría crecer un mes ya cerrado cada vez que un paciente
 * viejo se suma a una empresa, y el tablero no recalcula meses cerrados.
 */
const PAGO_EMPRESA = `
  SELECT DISTINCT pc.id_pago, ${sqlEmpresa()} AS empresa
    FROM pacientes_cupones pc
    JOIN cupones c ON c.id = pc.id_cupon
   WHERE ${sqlEmpresa()} <> '' AND pc.id_pago IS NOT NULL`;

/**
 * Paciente → empresa → desde cuándo.
 *
 * `desde` es la primera vez que esa persona usó un cupón de esa empresa, y es
 * lo que permite medir los activos **al cierre de cada mes** en vez de a hoy.
 * Sin eso, septiembre crecería cada vez que alguien que ya venía viniendo se
 * suma a una empresa en noviembre, y un mes cerrado no se recalcula.
 */
const PACIENTE_EMPRESA = `
  SELECT pc.id_paciente, ${sqlEmpresa()} AS empresa, MIN(pc.fecha) AS desde
    FROM pacientes_cupones pc
    JOIN cupones c ON c.id = pc.id_cupon
   WHERE ${sqlEmpresa()} <> ''
   GROUP BY pc.id_paciente, 2`;

export type FilaBusiness = {
  mes: string;
  pais: string;
  empresa: string;
  n: number;
};

/**
 * Pacientes nuevos de empresa, por mes, plataforma y empresa.
 *
 * Devuelve además la fila `TODAS` con el total del mes sin duplicar: alguien
 * cuyo primer pago llevó cupones de dos empresas aparece en las dos filas de
 * empresa, y sumarlas lo contaría dos veces.
 */
export async function nuevosDeEmpresa(
  conn: Connection,
  rango: Rango,
): Promise<FilaBusiness[]> {
  const [porEmpresa] = await conn.query<
    (RowDataPacket & { mes: string; pais: string; empresa: string; n: number })[]
  >(
    `SELECT ${mesLocal("pp.creacion")} AS mes,
            l.paisDominio AS pais, pe.empresa,
            COUNT(DISTINCT pp.id_paciente) AS n
       FROM pacientes_pagos pp
       JOIN (${PRIMER_PAGO}) f
         ON f.id_paciente = pp.id_paciente AND f.primera = pp.creacion
       JOIN login l ON l.id = pp.id_paciente AND l.tipo = 1
       JOIN (${PAGO_EMPRESA}) pe ON pe.id_pago = pp.id
      WHERE pp.confirmado = 1
        AND l.paisDominio IN ('AR', 'UY')
        AND pp.creacion >= ? AND pp.creacion < ?
      GROUP BY 1, 2, 3`,
    [rango.start, rango.end],
  );

  const [totales] = await conn.query<
    (RowDataPacket & { mes: string; pais: string; n: number })[]
  >(
    `SELECT ${mesLocal("pp.creacion")} AS mes,
            l.paisDominio AS pais,
            COUNT(DISTINCT pp.id_paciente) AS n
       FROM pacientes_pagos pp
       JOIN (${PRIMER_PAGO}) f
         ON f.id_paciente = pp.id_paciente AND f.primera = pp.creacion
       JOIN login l ON l.id = pp.id_paciente AND l.tipo = 1
      WHERE pp.confirmado = 1
        AND l.paisDominio IN ('AR', 'UY')
        AND pp.creacion >= ? AND pp.creacion < ?
        AND pp.id IN (SELECT id_pago FROM (${PAGO_EMPRESA}) x)
      GROUP BY 1, 2`,
    [rango.start, rango.end],
  );

  return [
    ...porEmpresa.map(normalizar),
    ...totales.map((r) => ({ ...normalizar(r), empresa: TODAS })),
  ];
}

/**
 * Pacientes activos de empresa: sesión realizada en el mes, de alguien que ya
 * tenía un cupón de esa empresa **al cierre de ese mes**.
 *
 * El corte al cierre del mes, y no a hoy, es lo que hace que un mes cerrado no
 * cambie nunca. Medido el 2026-10-29: de los 388 activos de septiembre, 282
 * usaron el cupón ese mismo mes, 69 entre uno y tres meses antes y solo 14
 * hace más de un año — así que el criterio no está arrastrando historia
 * muerta, está contando a la gente que todavía está haciendo las sesiones del
 * pack que compró con el cupón.
 */
export async function activosDeEmpresa(
  conn: Connection,
  rango: Rango,
): Promise<FilaBusiness[]> {
  const [porEmpresa] = await conn.query<
    (RowDataPacket & { mes: string; pais: string; empresa: string; n: number })[]
  >(
    `SELECT ${mesLocal("s.fecha")} AS mes,
            l.paisDominio AS pais, e.empresa,
            COUNT(DISTINCT s.id_paciente) AS n
       FROM sesiones s
       JOIN login l ON l.id = s.id_paciente AND l.tipo = 1
       JOIN (${PACIENTE_EMPRESA}) e ON e.id_paciente = s.id_paciente
      WHERE s.realizada = 1
        AND l.paisDominio IN ('AR', 'UY')
        AND s.fecha >= ? AND s.fecha < ?
        AND e.desde < ${finDelMes("s.fecha")}
      GROUP BY 1, 2, 3`,
    [rango.start, rango.end],
  );

  const [totales] = await conn.query<
    (RowDataPacket & { mes: string; pais: string; n: number })[]
  >(
    `SELECT ${mesLocal("s.fecha")} AS mes,
            l.paisDominio AS pais,
            COUNT(DISTINCT s.id_paciente) AS n
       FROM sesiones s
       JOIN login l ON l.id = s.id_paciente AND l.tipo = 1
      WHERE s.realizada = 1
        AND l.paisDominio IN ('AR', 'UY')
        AND s.fecha >= ? AND s.fecha < ?
        AND EXISTS (SELECT 1 FROM (${PACIENTE_EMPRESA}) e
                     WHERE e.id_paciente = s.id_paciente
                       AND e.desde < ${finDelMes("s.fecha")})
      GROUP BY 1, 2`,
    [rango.start, rango.end],
  );

  return [
    ...porEmpresa.map(normalizar),
    ...totales.map((r) => ({ ...normalizar(r), empresa: TODAS })),
  ];
}

function normalizar<T extends { mes: string; pais: string; n: number }>(
  fila: T,
): T & { empresa: string } {
  return {
    ...fila,
    empresa: (fila as { empresa?: string }).empresa ?? TODAS,
    n: Number(fila.n),
  };
}

export type FilaDiaria = {
  dia: string;
  pais: string;
  empresa: string;
  n: number;
};

/**
 * Los mismos pacientes nuevos de empresa, pero por día.
 *
 * Solo nuevos. Los activos no tienen versión diaria que signifique algo: la
 * definición es "sesión en el mes, de alguien que ya tenía cupón al cierre del
 * mes", y un día no tiene cierre de mes.
 *
 * El día es el LOCAL (UTC−3), como en Movimientos: con días UTC la noche de un
 * día cae en el siguiente y el patrón de fin de semana se emborrona.
 */
export async function nuevosDeEmpresaPorDia(
  conn: Connection,
  rango: Rango,
): Promise<FilaDiaria[]> {
  const [porEmpresa] = await conn.query<
    (RowDataPacket & { dia: string; pais: string; empresa: string; n: number })[]
  >(
    `SELECT ${diaLocal("pp.creacion")} AS dia,
            l.paisDominio AS pais, pe.empresa,
            COUNT(DISTINCT pp.id_paciente) AS n
       FROM pacientes_pagos pp
       JOIN (${PRIMER_PAGO}) f
         ON f.id_paciente = pp.id_paciente AND f.primera = pp.creacion
       JOIN login l ON l.id = pp.id_paciente AND l.tipo = 1
       JOIN (${PAGO_EMPRESA}) pe ON pe.id_pago = pp.id
      WHERE pp.confirmado = 1
        AND l.paisDominio IN ('AR', 'UY')
        AND pp.creacion >= ? AND pp.creacion < ?
      GROUP BY 1, 2, 3`,
    [rango.start, rango.end],
  );

  const [totales] = await conn.query<
    (RowDataPacket & { dia: string; pais: string; n: number })[]
  >(
    `SELECT ${diaLocal("pp.creacion")} AS dia,
            l.paisDominio AS pais,
            COUNT(DISTINCT pp.id_paciente) AS n
       FROM pacientes_pagos pp
       JOIN (${PRIMER_PAGO}) f
         ON f.id_paciente = pp.id_paciente AND f.primera = pp.creacion
       JOIN login l ON l.id = pp.id_paciente AND l.tipo = 1
      WHERE pp.confirmado = 1
        AND l.paisDominio IN ('AR', 'UY')
        AND pp.creacion >= ? AND pp.creacion < ?
        AND pp.id IN (SELECT id_pago FROM (${PAGO_EMPRESA}) x)
      GROUP BY 1, 2`,
    [rango.start, rango.end],
  );

  const dia = (r: { dia: unknown }) => String(r.dia).slice(0, 10);

  return [
    ...porEmpresa.map((r) => ({
      dia: dia(r),
      pais: r.pais,
      empresa: r.empresa,
      n: Number(r.n),
    })),
    ...totales.map((r) => ({
      dia: dia(r),
      pais: r.pais,
      empresa: TODAS,
      n: Number(r.n),
    })),
  ];
}
