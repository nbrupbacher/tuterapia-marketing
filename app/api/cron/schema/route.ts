import { NextResponse } from "next/server";
import { withMysql } from "@/lib/mysql";
import { isCronAuthorized } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Throwaway introspection endpoint for phase 1: lists the columns of the four
 * source tables so the queries can be written against the real schema.
 *
 * Returns column metadata only — never a data row, so no personal data is
 * exposed. Delete this route once the queries are validated against Looker.
 */
/**
 * Las cuatro que el proyecto lee, por defecto.
 *
 * `?tablas=cupones,pacientes_cupones` describe otras: el catálogo mostró 22 y
 * el proyecto solo conocía estas cuatro, así que cada vez que aparece una
 * pregunta nueva —los cupones, ahora— hace falta mirar una que nadie miró.
 */
const TABLES = ["login", "pacientes", "sesiones", "pacientes_pagos"];

/** Un nombre de tabla y nada más: esto arma SQL con el valor. */
const NOMBRE_VALIDO = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Y el listado completo de tablas, con cuántas filas tiene cada una.
 *
 * Las cuatro de arriba son las que el proyecto lee, no las que existen. Al
 * buscar cómo se marca un pago de PayPal apareció la pregunta de si la
 * respuesta está en otra tabla que nadie miró: `pacientes_pagos.mercadopago`
 * está vacía salvo en 86 filas de 2020, así que la pasarela no se nombra ahí.
 *
 * Solo nombres y conteos aproximados del catálogo, ninguna fila de datos.
 */
const CATALOGO = `
  SELECT TABLE_NAME, TABLE_ROWS
    FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = ?
   ORDER BY TABLE_ROWS DESC`;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const pedidas = new URL(request.url).searchParams.get("tablas");
  const tablas = pedidas
    ? pedidas.split(",").map((t) => t.trim()).filter((t) => NOMBRE_VALIDO.test(t))
    : TABLES;

  if (tablas.length === 0) {
    return NextResponse.json({ error: "invalid ?tablas=" }, { status: 400 });
  }

  try {
    const schema = await withMysql(async (conn) => {
      const [rows] = await conn.query<
        (import("mysql2").RowDataPacket & {
          TABLE_NAME: string;
          COLUMN_NAME: string;
          COLUMN_TYPE: string;
          IS_NULLABLE: string;
        })[]
      >(
        `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${tablas.map(() => "?").join(", ")})
          ORDER BY TABLE_NAME, ORDINAL_POSITION`,
        [process.env.MYSQL_DATABASE, ...tablas],
      );

      const [catalogo] = await conn.query<
        (import("mysql2").RowDataPacket & {
          TABLE_NAME: string;
          TABLE_ROWS: number | null;
        })[]
      >(CATALOGO, [process.env.MYSQL_DATABASE]);

      const columnas = rows.reduce<Record<string, string[]>>((acc, row) => {
        const column = `${row.COLUMN_NAME} ${row.COLUMN_TYPE}${
          row.IS_NULLABLE === "YES" ? " null" : ""
        }`;
        (acc[row.TABLE_NAME] ??= []).push(column);
        return acc;
      }, {});

      return {
        columnas,
        tablas: catalogo.map((t) => `${t.TABLE_NAME} ~${t.TABLE_ROWS ?? "?"}`),
      };
    });

    return NextResponse.json({ ok: true, schema });
  } catch (error) {
    console.error("[cron/schema] failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "unknown error",
      },
      { status: 500 },
    );
  }
}
