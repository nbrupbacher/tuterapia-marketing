import type { Connection } from "mysql2/promise";
import type { Client } from "pg";
import { monthRangeUtc } from "@/lib/queries/shared";
import {
  nuevosDelExterior,
  activosDelExterior,
  utmDelExterior,
} from "@/lib/queries/exterior";
import { transaction } from "@/lib/db";

/**
 * Escribe `marketing.exterior_mensual` y `marketing.exterior_utm`.
 *
 * Va colgado del cron del funnel y no del sync mensual, por la misma razón
 * medida el 2026-10-26 para `eligieron_terapeuta`: `/api/cron/sync` escribe el
 * mes en curso a los 44 segundos y lo matan a los 60 sin llegar al anterior
 * —en `marketing.sync_log` todas sus corridas nocturnas figuran "sin
 * terminar"—, así que un mes que dependa de ese job para reescribirse se
 * queda con el valor que tuvo el día que dejó de ser el mes en curso.
 *
 * Acá eso importa: `activos` cuenta sesiones realizadas, y una sesión de
 * septiembre puede marcarse como realizada en octubre. Un mes escrito una sola
 * vez quedaría corto para siempre.
 *
 * Son tres consultas agrupadas sobre toda la ventana, y el cron del funnel
 * cierra en cuatro segundos con cincuenta y seis libres.
 */

/**
 * Cuántos meses reescribe cada corrida.
 *
 * La pestaña muestra como mucho doce, así que trece cubren todo lo que se
 * puede mirar y dejan uno de margen. Reescribir de más no cuesta: es la misma
 * consulta agrupada y los meses viejos ya no se mueven.
 */
export const MESES_DE_EXTERIOR = 13;

export async function sincronizarExterior(
  mysql: Connection,
  db: Client,
  meses = MESES_DE_EXTERIOR,
  ahora = new Date(),
): Promise<number> {
  const hasta = mesLocal(ahora);
  const desde = mesesAtras(hasta, meses - 1);
  const rango = {
    start: monthRangeUtc(desde).start,
    end: monthRangeUtc(hasta).end,
  };

  const [nuevos, activos, utm] = await Promise.all([
    nuevosDelExterior(mysql, rango),
    activosDelExterior(mysql, rango),
    utmDelExterior(mysql, rango),
  ]);

  // Las dos series se cruzan en una fila por (mes, plataforma, origen): un mes
  // puede tener activos de un país y ningún paciente nuevo de ese país, y al
  // revés.
  const filas = new Map<string, { nuevos: number; activos: number }>();
  const tocar = (clave: string) => {
    let v = filas.get(clave);
    if (!v) {
      v = { nuevos: 0, activos: 0 };
      filas.set(clave, v);
    }
    return v;
  };
  for (const f of nuevos) tocar(`${f.mes}|${f.pais}|${f.origen}`).nuevos = f.n;
  for (const f of activos) tocar(`${f.mes}|${f.pais}|${f.origen}`).activos = f.n;

  await transaction(db, async () => {
    // Se borra y se reescribe la ventana en vez de hacer upsert: un país que
    // deja de aparecer un mes tiene que desaparecer de la fila, y un upsert lo
    // dejaría ahí con el valor viejo. Es el mismo criterio que usa el funnel.
    await db.query(
      `delete from marketing.exterior_mensual where mes >= $1::date`,
      [`${desde}-01`],
    );
    for (const [clave, v] of filas) {
      const [mes, pais, origen] = clave.split("|");
      await db.query(
        `insert into marketing.exterior_mensual
           (mes, pais, origen, nuevos, activos)
         values ($1, $2, $3, $4, $5)`,
        [`${mes}-01`, pais, origen, v.nuevos, v.activos],
      );
    }

    await db.query(
      `delete from marketing.exterior_utm where mes >= $1::date`,
      [`${desde}-01`],
    );
    for (const f of utm) {
      await db.query(
        `insert into marketing.exterior_utm (mes, pais, utm_source, nuevos)
         values ($1, $2, $3, $4)`,
        [`${f.mes}-01`, f.pais, f.utm_source, f.n],
      );
    }
  });

  return filas.size + utm.length;
}

/** 'YYYY-MM' del mes en curso, en día local (UTC−3). */
function mesLocal(ahora: Date): string {
  return new Date(ahora.getTime() - 3 * 3_600_000).toISOString().slice(0, 7);
}

function mesesAtras(mes: string, n: number): string {
  const [year, month] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(year!, month! - 1 - n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
