import type { Connection } from "mysql2/promise";
import type { Client } from "pg";
import { monthRangeUtc } from "@/lib/queries/shared";
import { usoDeEmpresa, type FilaUso } from "@/lib/queries/business-revenue";
import { PLANES } from "@/lib/planes-business";
import { ingresoYGananciaUsd } from "@/lib/metrics";
import { transaction } from "@/lib/db";
import { MESES_DE_BUSINESS, mesLocal, mesesAtras } from "@/lib/sync-business";

/**
 * Escribe `marketing.business_revenue`: cuánto entró y cuánto quedó de cada
 * empresa, por mes, separado en fee y cupón.
 *
 * Va con el resto de Business en el cron del funnel y reescribe la misma
 * ventana de trece meses. Un mes cerrado da lo mismo cada noche: las sesiones
 * son las mismas, los planes son los de `lib/planes-business.ts` y la comisión
 * y el tipo de cambio son los vigentes en ESE mes.
 */

export type Tipo = "fee" | "cupon";

export type FilaRevenue = {
  mes: string;
  pais: string;
  empresa: string;
  tipo: Tipo;
  sesiones: number;
  ingreso_usd: number;
  ganancia_usd: number;
};

type Parametro = { clave: string; pais: string; valor: number; desde: string };

export async function sincronizarRevenueBusiness(
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

  const [uso, parametros] = await Promise.all([
    usoDeEmpresa(mysql, rango),
    leerParametros(db),
  ]);
  const filas = armarRevenue(uso, parametros);

  await transaction(db, async () => {
    // Borrar y reescribir la ventana, como business_mensual: una empresa que
    // deja de aparecer un mes tiene que desaparecer de ese mes.
    await db.query(
      `delete from marketing.business_revenue where mes >= $1::date`,
      [`${desde}-01`],
    );
    for (const f of filas) {
      await db.query(
        `insert into marketing.business_revenue
           (mes, pais, empresa, tipo, sesiones, ingreso_usd, ganancia_usd)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          `${f.mes}-01`,
          f.pais,
          f.empresa,
          f.tipo,
          f.sesiones,
          f.ingreso_usd,
          f.ganancia_usd,
        ],
      );
    }
  });

  return filas.length;
}

/**
 * Pura, para poder razonarla sin base de datos.
 *
 * - Lo que pagó el paciente viene en la fila, en la moneda del pago.
 * - Lo que paga la empresa por sesión sale del plan, solo en Uruguay: la
 *   planilla no tiene tarifas de Argentina, así que allá todo es cupón.
 * - El fee entra una vez por mes y por empresa, en los meses en que la
 *   empresa tuvo alguna sesión. La planilla no dice desde cuándo rige cada
 *   contrato, y contar el fee en meses sin actividad inventaría ingresos
 *   antes de que la empresa existiera para el tablero.
 */
export function armarRevenue(
  uso: FilaUso[],
  parametros: Parametro[],
): FilaRevenue[] {
  const filas = new Map<string, FilaRevenue>();
  const fila = (mes: string, pais: string, empresa: string, tipo: Tipo) => {
    const clave = `${mes}|${pais}|${empresa}|${tipo}`;
    let f = filas.get(clave);
    if (!f) {
      f = { mes, pais, empresa, tipo, sesiones: 0, ingreso_usd: 0, ganancia_usd: 0 };
      filas.set(clave, f);
    }
    return f;
  };

  const sumar = (
    f: FilaRevenue,
    montoLocal: number,
    moneda: string,
    pais: string,
    mes: string,
  ) => {
    if (montoLocal === 0) return;
    const pctComision = vigente(parametros, "pct_comision", pais, mes);
    if (pctComision === null) return;
    const r = ingresoYGananciaUsd({
      montoLocal,
      moneda,
      pctComision,
      tipoCambio: vigente(parametros, "tipo_cambio", pais, mes),
    });
    if (!r) return;
    f.ingreso_usd += r.ingreso;
    f.ganancia_usd += r.ganancia;
  };

  const fees = new Map<string, { mes: string; plan: string }>();

  for (const u of uso) {
    const plan = u.pais === "UY" ? PLANES[u.plan] : undefined;

    if (plan?.tipo === "fee") {
      const f = fila(u.mes, u.pais, plan.empresa, "fee");
      f.sesiones += u.sesiones;
      sumar(f, u.pagado, u.moneda, u.pais, u.mes);
      fees.set(`${u.mes}|${u.plan}`, { mes: u.mes, plan: u.plan });
      continue;
    }

    const f = fila(u.mes, u.pais, u.empresa, "cupon");
    f.sesiones += u.sesiones;
    sumar(f, u.pagado, u.moneda, u.pais, u.mes);

    if (plan?.tipo === "sesion") {
      const porSesion = u.modalidad === "presencial" ? plan.presencial : plan.online;
      sumar(f, u.sesiones * porSesion, plan.moneda, u.pais, u.mes);
    }
  }

  for (const { mes, plan: clave } of fees.values()) {
    const plan = PLANES[clave];
    if (plan?.tipo !== "fee") continue;
    sumar(
      fila(mes, "UY", plan.empresa, "fee"),
      plan.porMes?.[mes] ?? plan.mensual,
      "$",
      "UY",
      mes,
    );
  }

  return [...filas.values()].filter((f) => f.sesiones > 0);
}

/**
 * El valor vigente al cierre del mes (METRICAS.md §3). Las fechas son
 * 'YYYY-MM-DD', así que compararlas como texto contra el día 31 alcanza para
 * cualquier mes.
 */
function vigente(
  parametros: Parametro[],
  clave: string,
  pais: string,
  mes: string,
): number | null {
  let mejor: Parametro | null = null;
  for (const p of parametros) {
    if (p.clave !== clave || p.pais !== pais || p.desde > `${mes}-31`) continue;
    if (!mejor || p.desde > mejor.desde) mejor = p;
  }
  return mejor?.valor ?? null;
}

async function leerParametros(db: Client): Promise<Parametro[]> {
  const { rows } = await db.query<{
    clave: string;
    pais: string;
    valor: string;
    desde: string;
  }>(
    `select clave, pais, valor::text, vigente_desde::text as desde
       from marketing.parametros
      where clave in ('pct_comision', 'tipo_cambio')`,
  );
  return rows.map((r) => ({
    clave: r.clave,
    pais: r.pais,
    valor: Number(r.valor),
    desde: r.desde,
  }));
}
