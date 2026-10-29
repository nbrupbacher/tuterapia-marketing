import type { Connection, RowDataPacket } from "mysql2/promise";
import { LOCAL_UTC_OFFSET_HOURS, type Rango } from "./shared";
import { sqlEmpresa } from "@/lib/empresas";
import { sqlPlan } from "@/lib/planes-business";

/**
 * Cuántas sesiones hizo cada empresa por mes, con qué plan, y cuánto pagaron
 * los pacientes por ellas.
 *
 * **A qué pago pertenece una sesión.** La base no lo dice: `sesiones` no tiene
 * el pago que la cubre. Se toma el último pago confirmado del paciente antes
 * de la sesión, que es el paquete que la está pagando salvo que alguien
 * compre otro antes de terminar el anterior. El cupón de ESE pago decide la
 * empresa y el plan, así que una sesión de un paquete comprado sin cupón no
 * cuenta para ninguna empresa aunque el paciente haya usado uno antes.
 *
 * Que todo cupón tenga pago está medido: 26.601 de 26.601 filas de
 * `pacientes_cupones` apuntan a un pago del mismo paciente (METRICAS.md).
 *
 * Lo pagado por sesión es `monto / sesiones` del pago, en su moneda. Un plan
 * 100% deja un pago en 0: el paciente no paga nada y la parte de la empresa
 * se suma después, desde `lib/planes-business.ts`.
 */

export type FilaUso = {
  mes: string;
  pais: string;
  empresa: string;
  plan: string;
  modalidad: string;
  moneda: string;
  sesiones: number;
  /** Lo que pagaron los pacientes por esas sesiones, en `moneda`. */
  pagado: number;
};

/**
 * Pago → empresa y plan. El nombre del cupón entra en `texto` y no sale de
 * MySQL: lo único que vuelve es la empresa y el nombre del plan.
 */
const PAGO_PLAN = `
  SELECT e.id_pago, MIN(e.empresa) AS empresa, MIN(${sqlPlan("e")}) AS plan
    FROM (SELECT pc.id_pago, ${sqlEmpresa()} AS empresa,
                 LOWER(CONCAT_WS(' ', c.nombre, c.codigo)) AS texto
            FROM pacientes_cupones pc
            JOIN cupones c ON c.id = pc.id_cupon
           WHERE pc.id_pago IS NOT NULL) e
   WHERE e.empresa <> ''
   GROUP BY e.id_pago`;

export async function usoDeEmpresa(
  conn: Connection,
  rango: Rango,
): Promise<FilaUso[]> {
  const [rows] = await conn.query<
    (RowDataPacket & {
      mes: string;
      pais: string;
      empresa: string;
      plan: string;
      modalidad: string;
      moneda: string;
      sesiones: number;
      pagado: number | null;
    })[]
  >(
    `SELECT DATE_FORMAT(DATE_SUB(x.fecha, INTERVAL ${LOCAL_UTC_OFFSET_HOURS} HOUR), '%Y-%m') AS mes,
            x.pais, pl.empresa, pl.plan,
            COALESCE(pp.tipo_session, 'online') AS modalidad,
            pp.moneda,
            COUNT(*) AS sesiones,
            SUM(CASE WHEN pp.sesiones > 0 THEN pp.monto / pp.sesiones ELSE 0 END) AS pagado
       FROM (
         SELECT s.fecha, l.paisDominio AS pais,
                (SELECT pp2.id FROM pacientes_pagos pp2
                  WHERE pp2.id_paciente = s.id_paciente
                    AND pp2.confirmado = 1
                    AND pp2.creacion <= s.fecha
                  ORDER BY pp2.creacion DESC, pp2.id DESC
                  LIMIT 1) AS id_pago
           FROM sesiones s
           JOIN login l ON l.id = s.id_paciente AND l.tipo = 1
          WHERE s.realizada = 1
            AND l.paisDominio IN ('AR', 'UY')
            AND s.fecha >= ? AND s.fecha < ?
            AND s.id_paciente IN (
              SELECT pc.id_paciente
                FROM pacientes_cupones pc
                JOIN cupones c ON c.id = pc.id_cupon
               WHERE ${sqlEmpresa()} <> '')
       ) x
       JOIN pacientes_pagos pp ON pp.id = x.id_pago
       JOIN (${PAGO_PLAN}) pl ON pl.id_pago = x.id_pago
      GROUP BY 1, 2, 3, 4, 5, 6`,
    [rango.start, rango.end],
  );

  return rows.map((r) => ({
    mes: r.mes,
    pais: r.pais,
    empresa: r.empresa,
    plan: r.plan,
    modalidad: r.modalidad,
    moneda: r.moneda,
    sesiones: Number(r.sesiones),
    pagado: Number(r.pagado ?? 0),
  }));
}
