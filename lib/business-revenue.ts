import { withDb } from "@/lib/db";
import { type Rango } from "@/lib/dashboard";
import type { Punto } from "@/lib/desglose";

/**
 * Lo que lee la sección de revenue de Business. Todo sale de
 * `marketing.business_revenue`, que escribe el cron del funnel; la pantalla
 * no calcula nada que no sea sumar.
 *
 * Los montos están en dólares, así que en TOTAL AR y UY se suman sin más.
 */

export type Monto = { ingreso: number; ganancia: number };

export type FilaEmpresaRevenue = Monto & {
  empresa: string;
  tipo: "fee" | "cupon";
  sesiones: number;
};

export type VistaRevenue = {
  meses: { mes: string; enCurso: boolean; fee: number; cupon: number }[];
  /** La ganancia de cada empresa por mes, para el tooltip de las barras. */
  porEmpresa: Punto[];
  /** El último mes CERRADO, que es el que muestran las tarjetas y la tabla. */
  mes: string | null;
  mesPrevio: string | null;
  total: Monto;
  totalPrevio: Monto;
  fee: Monto & { empresas: number };
  cupon: Monto & { empresas: number };
  empresas: FilaEmpresaRevenue[];
  /** null si hay datos; si no, por qué no hay. */
  falta: string | null;
};

type Fila = {
  mes: string;
  pais: string;
  empresa: string;
  tipo: "fee" | "cupon";
  sesiones: number;
  ingreso: number;
  ganancia: number;
};

export async function leerRevenueBusiness(
  pais: string,
  meses: Rango,
): Promise<VistaRevenue> {
  let filas: Fila[];
  try {
    filas = await withDb(async (db) => {
      const { rows } = await db.query<{
        mes: string;
        pais: string;
        empresa: string;
        tipo: "fee" | "cupon";
        sesiones: number;
        ingreso_usd: string;
        ganancia_usd: string;
      }>(
        `select to_char(mes, 'YYYY-MM') as mes, pais, empresa, tipo, sesiones,
                ingreso_usd::text, ganancia_usd::text
           from marketing.business_revenue
          where mes > (date_trunc('month', current_date)
                       - make_interval(months => $1))
          order by mes`,
        [meses],
      );
      return rows.map((r) => ({
        mes: r.mes,
        pais: r.pais,
        empresa: r.empresa,
        tipo: r.tipo,
        sesiones: Number(r.sesiones),
        ingreso: Number(r.ingreso_usd),
        ganancia: Number(r.ganancia_usd),
      }));
    });
  } catch {
    // La tabla llega con una migración. Hasta que corra, la sección lo dice
    // en vez de tirar la pestaña entera.
    return vacia("Falta crear marketing.business_revenue: corré la migración.");
  }

  return armarRevenue(
    pais === "TOTAL" ? filas : filas.filter((f) => f.pais === pais),
  );
}

/** Pura, para poder razonarla sin base de datos. */
export function armarRevenue(filas: Fila[], hoy = new Date()): VistaRevenue {
  if (filas.length === 0) {
    return vacia("Todavía no hay revenue sincronizado. Lo escribe /api/cron/funnel.");
  }

  const actual = new Date(hoy.getTime() - 3 * 3_600_000).toISOString().slice(0, 7);
  const nombres = [...new Set(filas.map((f) => f.mes))].sort();
  const cerrados = nombres.filter((m) => m < actual);
  const mes = cerrados.at(-1) ?? null;
  const mesPrevio = cerrados.at(-2) ?? null;

  const suma = (fs: Fila[]): Monto => ({
    ingreso: fs.reduce((a, f) => a + f.ingreso, 0),
    ganancia: fs.reduce((a, f) => a + f.ganancia, 0),
  });
  const delMes = (m: string | null) => filas.filter((f) => f.mes === m);
  const deTipo = (fs: Fila[], tipo: Fila["tipo"]) => fs.filter((f) => f.tipo === tipo);

  // Una empresa con filas en AR y en UY es una sola empresa en la tabla.
  const porEmpresaDelMes = new Map<string, FilaEmpresaRevenue>();
  for (const f of delMes(mes)) {
    const clave = `${f.empresa}|${f.tipo}`;
    const e = porEmpresaDelMes.get(clave) ?? {
      empresa: f.empresa,
      tipo: f.tipo,
      sesiones: 0,
      ingreso: 0,
      ganancia: 0,
    };
    e.sesiones += f.sesiones;
    e.ingreso += f.ingreso;
    e.ganancia += f.ganancia;
    porEmpresaDelMes.set(clave, e);
  }

  // El tooltip: una fila por mes y empresa, redondeada a dólares enteros,
  // porque el tooltip imprime enteros y una ganancia de US$ 222,738 no ayuda.
  const tooltip = new Map<string, Punto>();
  for (const f of filas) {
    const clave = `${f.mes}|${f.empresa}`;
    const p = tooltip.get(clave) ?? { periodo: f.mes, clave: f.empresa, valor: 0 };
    p.valor += f.ganancia;
    tooltip.set(clave, p);
  }

  const esteMes = delMes(mes);
  const empresasDe = (tipo: Fila["tipo"]) =>
    new Set(deTipo(esteMes, tipo).map((f) => f.empresa)).size;

  return {
    meses: nombres.map((m) => {
      const fs = delMes(m);
      return {
        mes: m,
        enCurso: m >= actual,
        fee: suma(deTipo(fs, "fee")).ganancia,
        cupon: suma(deTipo(fs, "cupon")).ganancia,
      };
    }),
    porEmpresa: [...tooltip.values()].map((p) => ({ ...p, valor: Math.round(p.valor) })),
    mes,
    mesPrevio,
    total: suma(esteMes),
    totalPrevio: suma(delMes(mesPrevio)),
    fee: { ...suma(deTipo(esteMes, "fee")), empresas: empresasDe("fee") },
    cupon: { ...suma(deTipo(esteMes, "cupon")), empresas: empresasDe("cupon") },
    empresas: [...porEmpresaDelMes.values()].sort((a, b) => b.ganancia - a.ganancia),
    falta: null,
  };
}

function vacia(falta: string): VistaRevenue {
  const cero = { ingreso: 0, ganancia: 0 };
  return {
    meses: [],
    porEmpresa: [],
    mes: null,
    mesPrevio: null,
    total: cero,
    totalPrevio: cero,
    fee: { ...cero, empresas: 0 },
    cupon: { ...cero, empresas: 0 },
    empresas: [],
    falta,
  };
}
