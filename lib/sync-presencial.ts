import type { Connection } from "mysql2/promise";
import type { Client } from "pg";
import {
  nuevosPorModalidad,
  nuevosPorModalidadPorDia,
} from "@/lib/queries/presencial";
import { transaction } from "@/lib/db";
import { mesLocal, mesesAtras } from "@/lib/sync-business";

/**
 * Escribe `marketing.presencial_mensual` y `marketing.presencial_diario`.
 *
 * Va en el cron del funnel y no en el mensual por lo mismo que Exterior y
 * Business: `/api/cron/sync` ya gasta sus 60 segundos y muere sin llegar al
 * mes anterior, así que un mes que dependiera de ese job se quedaría con el
 * valor del día en que dejó de ser el mes en curso.
 *
 * Acá eso importa menos que en Business —la modalidad del primer pago de un
 * paciente de septiembre no cambia en octubre— pero el mes en curso sí se
 * mueve todos los días, y es justo el que se está mirando.
 */

/** Trece meses: la pestaña muestra doce y queda uno de margen. */
export const MESES_DE_PRESENCIAL = 13;

/**
 * Ciento veinte días de grano diario, los mismos que `sesiones_vendidas`.
 *
 * El gráfico dibuja 45. El resto es para el panel del mes, que proyecta a fin
 * de mes con el peso de cada día de la semana y necesita ocho semanas
 * completas para que ese patrón no sea inventado.
 */
export const DIAS_DE_PRESENCIAL = 120;

export async function sincronizarPresencial(
  mysql: Connection,
  db: Client,
  ahora = new Date(),
): Promise<number> {
  const hastaMes = mesLocal(ahora);
  const desdeMes = mesesAtras(hastaMes, MESES_DE_PRESENCIAL - 1);
  const hastaDia = diaLocal(ahora);
  const desdeDia = sumarDias(hastaDia, -(DIAS_DE_PRESENCIAL - 1));

  const [meses, dias] = await Promise.all([
    nuevosPorModalidad(mysql, desdeMes, hastaMes),
    nuevosPorModalidadPorDia(mysql, desdeDia, hastaDia),
  ]);

  await transaction(db, async () => {
    // Las dos tablas se borran enteras y se reescriben: son una ventana
    // móvil, y una fila que se cae de la ventana no se vuelve a tocar nunca
    // más si el borrado lleva cota inferior. Es la regla que quedó después
    // de Bosch (METRICAS.md §6 septies).
    // Un `insert` por tabla y no uno por fila: son quinientas filas y
    // quinientas idas y vueltas a Supabase le costarían al job más que las
    // dos consultas a MySQL juntas.
    await db.query(`delete from marketing.presencial_mensual`);
    await db.query(
      `insert into marketing.presencial_mensual
         (mes, pais, modalidad, provincia, nuevos)
       select * from unnest($1::date[], $2::text[], $3::text[], $4::text[],
                            $5::int[])`,
      [
        meses.map((f) => `${f.periodo}-01`),
        meses.map((f) => f.pais),
        meses.map((f) => f.modalidad),
        meses.map((f) => f.provincia),
        meses.map((f) => f.n),
      ],
    );

    await db.query(`delete from marketing.presencial_diario`);
    await db.query(
      `insert into marketing.presencial_diario
         (fecha, pais, modalidad, utm_source, nuevos)
       select * from unnest($1::date[], $2::text[], $3::text[], $4::text[],
                            $5::int[])`,
      [
        dias.map((f) => f.periodo),
        dias.map((f) => f.pais),
        dias.map((f) => f.modalidad),
        dias.map((f) => f.utm_source),
        dias.map((f) => f.n),
      ],
    );
  });

  return meses.length + dias.length;
}

/** El día de hoy en hora local (UTC−3), como todo el resto del proyecto. */
function diaLocal(ahora: Date): string {
  return new Date(ahora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10);
}

function sumarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
