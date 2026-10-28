import type { Connection, RowDataPacket } from "mysql2/promise";
import { LOCAL_UTC_OFFSET_HOURS, type Rango } from "./shared";

/**
 * Los pacientes del exterior: los que pagan en dólares.
 *
 * `pacientes_pagos.moneda = 'U$S'` es la única marca que la base tiene de un
 * pago por PayPal. Medido el 2026-10-28: `tipo` vale 1 en los 124.376 pagos
 * confirmados, `mercadopago` está vacía salvo en 86 filas de 2020, y el
 * catálogo del esquema no tiene ninguna otra tabla de pagos. Lo confirmó el
 * dueño del producto: "paypal es exterior y es lo que nos importa porque el
 * pago es en dólares".
 *
 * Las tres consultas devuelven la ventana entera agrupada, no un mes por
 * llamada: son conteos sobre índices y traer trece meses cuesta casi lo mismo
 * que traer uno.
 *
 * Chile queda afuera de las tres, como en todo el resto del tablero
 * (METRICAS.md §1).
 */

/** El mes local (UTC−3) de una columna de fecha, como lo hace el resto. */
function mesLocal(columna: string): string {
  return `DATE_FORMAT(DATE_SUB(${columna}, INTERVAL ${LOCAL_UTC_OFFSET_HOURS} HOUR), '%Y-%m')`;
}

/**
 * El primer pago confirmado de cada paciente, para quedarse con los que
 * arrancaron pagando en dólares.
 *
 * Se compara contra el pago mismo y no contra un `MIN` por separado: lo que
 * interesa es la MONEDA de ese primer pago, no que exista un pago en dólares
 * en algún momento. Alguien que compró en pesos en marzo y pagó en dólares en
 * agosto es un paciente nuevo de marzo, no del exterior en agosto.
 */
const PRIMER_PAGO_PROPIO = `
  SELECT id_paciente, MIN(creacion) AS primera
    FROM pacientes_pagos WHERE confirmado = 1
   GROUP BY id_paciente`;

export type FilaExterior = {
  mes: string;
  pais: string;
  origen: string;
  n: number;
};

/** Pacientes nuevos del exterior, por mes, plataforma y país del perfil. */
export async function nuevosDelExterior(
  conn: Connection,
  rango: Rango,
): Promise<FilaExterior[]> {
  const [rows] = await conn.query<
    (RowDataPacket & { mes: string; pais: string; origen: string; n: number })[]
  >(
    `SELECT ${mesLocal("pp.creacion")} AS mes,
            l.paisDominio AS pais,
            COALESCE(NULLIF(p.pais, ''), '??') AS origen,
            COUNT(DISTINCT pp.id_paciente) AS n
       FROM pacientes_pagos pp
       JOIN (${PRIMER_PAGO_PROPIO}) f
         ON f.id_paciente = pp.id_paciente AND f.primera = pp.creacion
       JOIN login l ON l.id = pp.id_paciente AND l.tipo = 1
       JOIN pacientes p ON p.id_login = l.id
      WHERE pp.confirmado = 1 AND pp.moneda = 'U$S'
        AND l.paisDominio IN ('AR', 'UY')
        AND pp.creacion >= ? AND pp.creacion < ?
      GROUP BY 1, 2, 3`,
    [rango.start, rango.end],
  );
  return rows.map(normalizar);
}

/**
 * Pacientes activos del exterior: sesión realizada en el mes, de alguien que
 * ALGUNA VEZ pagó en dólares.
 *
 * "Alguna vez" y no "su primer pago": un activo de octubre puede haber
 * comprado hace dos años, y lo que lo hace del exterior es que paga en
 * dólares, no cuándo empezó.
 */
export async function activosDelExterior(
  conn: Connection,
  rango: Rango,
): Promise<FilaExterior[]> {
  const [rows] = await conn.query<
    (RowDataPacket & { mes: string; pais: string; origen: string; n: number })[]
  >(
    `SELECT ${mesLocal("s.fecha")} AS mes,
            l.paisDominio AS pais,
            COALESCE(NULLIF(p.pais, ''), '??') AS origen,
            COUNT(DISTINCT s.id_paciente) AS n
       FROM sesiones s
       JOIN login l ON l.id = s.id_paciente AND l.tipo = 1
       JOIN pacientes p ON p.id_login = l.id
       JOIN (SELECT DISTINCT id_paciente FROM pacientes_pagos
              WHERE confirmado = 1 AND moneda = 'U$S') usd
         ON usd.id_paciente = s.id_paciente
      WHERE s.realizada = 1
        AND l.paisDominio IN ('AR', 'UY')
        AND s.fecha >= ? AND s.fecha < ?
      GROUP BY 1, 2, 3`,
    [rango.start, rango.end],
  );
  return rows.map(normalizar);
}

export type FilaUtmExterior = {
  mes: string;
  pais: string;
  utm_source: string;
  n: number;
};

/**
 * Con qué `utm_source` se registró el que después pagó en dólares, fechado por
 * el mes de esa primera compra.
 *
 * El utm viene de `login` y es de cuando se registró, que puede ser mucho
 * antes. Se fecha por la compra igual, para que la fila conteste la misma
 * pregunta que `nuevos`: de dónde vinieron los que compraron este mes.
 *
 * Crudo, sin mapear a plataforma: el mapeo vive en Supabase y acá lo que
 * importa es cuántos llegan SIN marcar, que medido son el 89%.
 */
export async function utmDelExterior(
  conn: Connection,
  rango: Rango,
): Promise<FilaUtmExterior[]> {
  const [rows] = await conn.query<
    (RowDataPacket & { mes: string; pais: string; utm_source: string; n: number })[]
  >(
    `SELECT ${mesLocal("pp.creacion")} AS mes,
            l.paisDominio AS pais,
            COALESCE(l.utm_source, '') AS utm_source,
            COUNT(DISTINCT pp.id_paciente) AS n
       FROM pacientes_pagos pp
       JOIN (${PRIMER_PAGO_PROPIO}) f
         ON f.id_paciente = pp.id_paciente AND f.primera = pp.creacion
       JOIN login l ON l.id = pp.id_paciente AND l.tipo = 1
      WHERE pp.confirmado = 1 AND pp.moneda = 'U$S'
        AND l.paisDominio IN ('AR', 'UY')
        AND pp.creacion >= ? AND pp.creacion < ?
      GROUP BY 1, 2, 3`,
    [rango.start, rango.end],
  );
  return rows.map((r) => ({
    mes: r.mes,
    pais: r.pais,
    utm_source: r.utm_source,
    n: Number(r.n),
  }));
}

function normalizar(r: {
  mes: string;
  pais: string;
  origen: string;
  n: number;
}): FilaExterior {
  return { mes: r.mes, pais: r.pais, origen: r.origen, n: Number(r.n) };
}
