import type { Connection } from "mysql2/promise";
import type { Client } from "pg";
import { monthRangeUtc } from "@/lib/queries/shared";
import { nuevosDeEmpresa, activosDeEmpresa } from "@/lib/queries/business";
import { transaction } from "@/lib/db";

/**
 * Escribe `marketing.business_mensual`.
 *
 * Va colgado del cron del funnel y no del sync mensual, por la misma razón que
 * Exterior y `eligieron_terapeuta`: `/api/cron/sync` escribe el mes en curso a
 * los 44 segundos y lo matan a los 60 sin llegar al anterior, así que un mes
 * que dependa de ese job se queda con el valor que tuvo el día que dejó de ser
 * el mes en curso.
 *
 * Acá eso importa el doble. `activos` cuenta sesiones realizadas, y una sesión
 * de septiembre puede marcarse como realizada en octubre; y una empresa nueva
 * puede aparecer a mitad de mes.
 */

/**
 * Cuántos meses reescribe cada corrida.
 *
 * La pestaña muestra como mucho doce. Trece cubren todo lo que se puede mirar
 * y dejan uno de margen.
 *
 * Reescribir meses viejos no los cambia: los activos se miden **al cierre de
 * cada mes**, así que septiembre da lo mismo hoy que en marzo. Esa es la
 * propiedad que hace que un mes cerrado no se mueva, y reescribirlo cada noche
 * es justamente lo que la comprueba.
 */
export const MESES_DE_BUSINESS = 13;

export async function sincronizarBusiness(
  mysql: Connection,
  db: Client,
  meses = MESES_DE_BUSINESS,
  ahora = new Date(),
): Promise<number> {
  const hasta = mesLocal(ahora);
  const desde = mesesAtras(hasta, meses - 1);
  const rango = {
    start: monthRangeUtc(desde).start,
    end: monthRangeUtc(hasta).end,
  };

  const [nuevos, activos] = await Promise.all([
    nuevosDeEmpresa(mysql, rango),
    activosDeEmpresa(mysql, rango),
  ]);

  // Las dos series se cruzan en una fila por (mes, plataforma, empresa): una
  // empresa puede tener activos un mes y ningún paciente nuevo, y al revés.
  const filas = new Map<string, { nuevos: number; activos: number }>();
  const tocar = (clave: string) => {
    let v = filas.get(clave);
    if (!v) {
      v = { nuevos: 0, activos: 0 };
      filas.set(clave, v);
    }
    return v;
  };
  for (const f of nuevos) tocar(`${f.mes}|${f.pais}|${f.empresa}`).nuevos = f.n;
  for (const f of activos) tocar(`${f.mes}|${f.pais}|${f.empresa}`).activos = f.n;

  await transaction(db, async () => {
    // Se borra y se reescribe la ventana en vez de hacer upsert: una empresa
    // que deja de aparecer un mes tiene que desaparecer de la fila, y un
    // upsert la dejaría ahí con el valor viejo.
    await db.query(
      `delete from marketing.business_mensual where mes >= $1::date`,
      [`${desde}-01`],
    );
    for (const [clave, v] of filas) {
      const [mes, pais, empresa] = clave.split("|");
      await db.query(
        `insert into marketing.business_mensual
           (mes, pais, empresa, nuevos, activos)
         values ($1, $2, $3, $4, $5)`,
        [`${mes}-01`, pais, empresa, v.nuevos, v.activos],
      );
    }
  });

  return filas.size;
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
