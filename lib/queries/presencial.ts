import type { Connection, RowDataPacket } from "mysql2/promise";
import { LOCAL_UTC_OFFSET_HOURS } from "./shared";

/**
 * Pacientes nuevos por modalidad: cuántos entran eligiendo presencial.
 *
 * La modalidad no es del paciente ni de la sesión, es del PAGO
 * (`pacientes_pagos.tipo_session`), que es justamente lo que cambia el precio
 * (METRICAS.md §3). Así que la modalidad con la que alguien entra es la de su
 * primer pago confirmado — el mismo hecho que el tablero llama conversión.
 *
 * Eso excluye a propósito al paciente que ya era online y después compra un
 * paquete presencial. Es demanda, pero no es conversión, y mezclarlos daría un
 * número que no cierra contra `pacientes_nuevos` de General: en octubre son
 * 527 contra 136. Decisión del dueño del producto, 2026-11-03.
 *
 * `tipo_session` es nullable, así que hay una tercera modalidad de hecho. Se
 * trae como `sin_dato` en vez de filtrarse: ese paciente entró igual, y
 * descartarlo rompería la igualdad con el total.
 *
 * El país sale de `login.paisDominio` y no del pago, que es la regla de
 * METRICAS.md §1 y lo que hace que esto se sume contra General.
 */

export type NuevoPorModalidad = {
  periodo: string;
  pais: string;
  modalidad: "online" | "presencial" | "sin_dato";
  /** Crudo, como lo guarda `login.utm_source`. Vacío = se registró sin utm. */
  utm_source: string;
  n: number;
};

/**
 * El primer pago de cada paciente, con su modalidad.
 *
 * Es una ventana sobre todos los pagos confirmados y no un `MIN(creacion)`
 * agrupado, porque lo que hace falta no es la fecha del primer pago sino la
 * FILA: su `tipo_session`. El desempate por `id` evita contar dos veces al
 * paciente que tenga dos pagos con el mismo instante de creación.
 *
 * El filtro de la ventana se aplica DESPUÉS de `rn = 1`, afuera: el primer
 * pago tiene que ser el primero de la vida del paciente, no el primero dentro
 * de los trece meses que se están mirando. Un paciente de 2024 que vuelve a
 * comprar hoy no es nuevo hoy.
 */
function sql(periodo: string, conUtm: boolean): string {
  // El utm es del REGISTRO (`login.utm_source`) y la modalidad es del PAGO.
  // Son dos momentos distintos del mismo paciente y por eso se pueden cruzar
  // sin contar a nadie dos veces: cada paciente nuevo tiene exactamente un
  // primer pago y exactamente un utm.
  const utm = conUtm ? `COALESCE(l.utm_source, '') AS utm_source,` : "";
  return `
    SELECT periodo, pais, modalidad, ${conUtm ? "utm_source," : ""} COUNT(*) AS n
      FROM (SELECT ${periodo} AS periodo,
                   l.paisDominio AS pais,
                   COALESCE(pp.tipo_session, 'sin_dato') AS modalidad,
                   ${utm}
                   ROW_NUMBER() OVER (PARTITION BY pp.id_paciente
                                      ORDER BY pp.creacion, pp.id) AS rn
              FROM pacientes_pagos pp
              JOIN login l ON l.id = pp.id_paciente AND l.tipo = 1
             WHERE pp.confirmado = 1
               AND l.paisDominio IN ('AR', 'UY')) t
     WHERE rn = 1 AND periodo >= ? AND periodo <= ?
     GROUP BY 1, 2, 3${conUtm ? ", 4" : ""}
     ORDER BY 1, 2, 3`;
}

/** El mes local (UTC−3) del pago, 'YYYY-MM'. */
const MES = `DATE_FORMAT(DATE_SUB(pp.creacion, INTERVAL ${LOCAL_UTC_OFFSET_HOURS} HOUR), '%Y-%m')`;

/** Y el día local, 'YYYY-MM-DD'. */
const DIA = `DATE(DATE_SUB(pp.creacion, INTERVAL ${LOCAL_UTC_OFFSET_HOURS} HOUR))`;

/**
 * Por mes. Los extremos son meses locales ('YYYY-MM') y los dos entran: la
 * ventana se arma en el job con el mismo calendario con el que se dibuja.
 */
export function nuevosPorModalidad(
  conn: Connection,
  desde: string,
  hasta: string,
): Promise<NuevoPorModalidad[]> {
  return consultar(conn, sql(MES, false), desde, hasta);
}

/**
 * Y por día, con extremos 'YYYY-MM-DD', también inclusivos.
 *
 * Este trae además el `utm_source`, que el mensual no necesita: el gráfico
 * mensual tiene su panel de composición al costado y el diario no, así que su
 * única forma de contestar "¿de dónde vinieron estos tres?" es el tooltip.
 */
export function nuevosPorModalidadPorDia(
  conn: Connection,
  desde: string,
  hasta: string,
): Promise<NuevoPorModalidad[]> {
  return consultar(conn, sql(DIA, true), desde, hasta);
}

async function consultar(
  conn: Connection,
  consulta: string,
  desde: string,
  hasta: string,
): Promise<NuevoPorModalidad[]> {
  const [rows] = await conn.query<
    (RowDataPacket & {
      periodo: string;
      pais: string;
      modalidad: string;
      utm_source?: string;
      n: number;
    })[]
  >(consulta, [desde, hasta]);

  return rows.map((r) => ({
    // La conexión va con `dateStrings`, así que DATE() ya vuelve como texto.
    periodo: String(r.periodo),
    pais: r.pais,
    modalidad: r.modalidad as NuevoPorModalidad["modalidad"],
    utm_source: r.utm_source ?? "",
    n: Number(r.n),
  }));
}
