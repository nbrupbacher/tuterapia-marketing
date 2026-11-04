import { withDb } from "@/lib/db";
import { LOCAL_UTC_OFFSET_HOURS } from "@/lib/queries/shared";
import {
  armarVista,
  type FilaModalidad,
  type Modalidad,
  type VistaSesiones,
} from "@/lib/sesiones";
import type { Desglose, Punto } from "@/lib/desglose";

/**
 * Pacientes nuevos por modalidad, al mes y al día.
 *
 * Nuevo = primer pago confirmado, la misma definición de conversión que usa
 * todo el tablero; la modalidad es la de ESE pago. Por eso la suma de las
 * modalidades de un mes da exactamente `pacientes_nuevos` de General, y por
 * eso la parte presencial se puede calcular acá sin ir a buscar el total a
 * otra tabla: ya está adentro de esta.
 *
 * La pregunta que vino a contestar: el 1º de noviembre de 2026 subió el
 * precio presencial de Argentina de 46.000 a 60.000, y hace falta ver si eso
 * mueve la cantidad de gente que entra presencial.
 */

/** Cuántos días dibuja el apilado. */
export const DIAS_DE_PRESENCIAL_UI = 45;

export type VistaPresencial = {
  /** Los meses de la ventana, en orden. */
  meses: string[];
  /** Cuál de ellos todavía está corriendo. */
  enCurso: boolean[];
  /** Presenciales por país, en el orden de `meses`. */
  porPais: { pais: string; valores: number[] }[];
  /** Nuevos de todas las modalidades, para la parte presencial. */
  totales: number[];
  /**
   * El apilado diario: presenciales por país, y nada más.
   *
   * Con el online apilado encima no se podía leer. Son 45 barras en la
   * mitad del ancho —el panel ocupa la otra— y el presencial es entre el 5%
   * y el 20% del día, así que quedaba una lámina de dos píxeles abajo de una
   * banda de Argentina online que la tapaba. Además el gráfico decía 39 y el
   * panel de al lado 11, dos números distintos pegados sin explicación.
   *
   * La mezcla la contesta el mensual, con la frase que dice qué parte de los
   * nuevos entró presencial.
   */
  desglose: Desglose;
  /**
   * Las mismas bandas, en el mismo orden, con la clave cruda
   * `'UY·presencial'`. El desglose lleva el nombre lindo para la leyenda y
   * el tooltip; la paleta se busca por la clave.
   */
  claves: string[];
  /** El panel del mes, sobre los mismos presenciales que el gráfico. */
  panel: VistaSesiones;
  /** La frase de abajo del gráfico mensual, o null si no hay con qué. */
  lectura: string | null;
};

export async function leerPresencial(
  pais: string,
  meses: number,
  ahora = new Date(),
): Promise<VistaPresencial> {
  const hoy = diaLocal(ahora);
  // Uruguay primero: adentro de cada modalidad la banda más grande va abajo,
  // así la de arriba no flota a distinta altura cada día.
  const paises = pais === "TOTAL" ? ["UY", "AR"] : [pais];

  const { mensual, diario } = await withDb(async (db) => {
    const [m, d] = await Promise.all([
      db.query<{ mes: string; pais: string; modalidad: Modalidad; nuevos: number }>(
        `select to_char(mes, 'YYYY-MM') as mes, pais, modalidad, nuevos
           from marketing.presencial_mensual
          where pais = any($1)
            and mes > (date_trunc('month', current_date)
                       - make_interval(months => $2))
          order by mes`,
        [paises, meses],
      ),
      db.query<{ fecha: string; pais: string; modalidad: Modalidad; nuevos: number }>(
        `select fecha::text, pais, modalidad, nuevos
           from marketing.presencial_diario
          where pais = any($1) and fecha <= $2
          order by fecha`,
        [paises, hoy],
      ),
    ]);
    return { mensual: m.rows, diario: d.rows };
  });

  const filas: FilaModalidad[] = diario.map((f) => ({
    fecha: f.fecha,
    pais: f.pais,
    modalidad: f.modalidad,
    n: Number(f.nuevos),
  }));

  const panel = armarVista(
    filas.filter((f) => f.modalidad === "presencial"),
    { paises, dias: DIAS_DE_PRESENCIAL_UI, hoy, orden: "modalidad" },
  );

  return {
    ...armarMensual(mensual, paises, hoy),
    desglose: armarDesglose(panel),
    claves: panel.claves,
    panel,
  };
}

/** La serie mensual, el total por mes y la frase. Pura, para poder probarla. */
export function armarMensual(
  filas: { mes: string; pais: string; modalidad: Modalidad; nuevos: number }[],
  paises: string[],
  hoy: string,
): Pick<VistaPresencial, "meses" | "enCurso" | "porPais" | "totales" | "lectura"> {
  const meses = [...new Set(filas.map((f) => f.mes))].sort();
  const mesEnCurso = hoy.slice(0, 7);

  const porPais = paises.map((p) => ({
    pais: p,
    valores: meses.map((m) =>
      filas
        .filter(
          (f) => f.mes === m && f.pais === p && f.modalidad === "presencial",
        )
        .reduce((a, f) => a + Number(f.nuevos), 0),
    ),
  }));

  const totales = meses.map((m) =>
    filas.filter((f) => f.mes === m).reduce((a, f) => a + Number(f.nuevos), 0),
  );

  return {
    meses,
    enCurso: meses.map((m) => m === mesEnCurso),
    porPais,
    totales,
    lectura: leer(meses, porPais, totales, mesEnCurso),
  };
}

/**
 * La frase de abajo del gráfico.
 *
 * Dice la parte presencial del último mes CERRADO y cómo se movió contra el
 * anterior, en puntos porcentuales. La parte y no el número suelto porque es
 * lo que el número suelto esconde: entre marzo y octubre de 2026 los
 * presenciales se quedaron quietos en 130 y la parte cayó ocho puntos, porque
 * lo que creció fue Argentina online.
 */
function leer(
  meses: string[],
  porPais: { pais: string; valores: number[] }[],
  totales: number[],
  mesEnCurso: string,
): string | null {
  const i = meses.lastIndexOf(mesEnCurso) === -1
    ? meses.length - 1
    : meses.lastIndexOf(mesEnCurso) - 1;
  if (i < 1) return null;

  const presencialDe = (k: number) =>
    porPais.reduce((a, p) => a + (p.valores[k] ?? 0), 0);

  const ahora = presencialDe(i);
  const antes = presencialDe(i - 1);
  const totalAhora = totales[i] ?? 0;
  const totalAntes = totales[i - 1] ?? 0;
  if (totalAhora === 0 || totalAntes === 0) return null;

  const parte = ahora / totalAhora;
  const parteAntes = antes / totalAntes;
  const pp = (parte - parteAntes) * 100;
  const mes = nombreCorto(meses[i]!);

  const movimiento =
    Math.abs(pp) < 0.5
      ? "la misma parte que el mes anterior"
      : `${Math.abs(pp).toFixed(1).replace(".", ",")} puntos ${pp > 0 ? "más" : "menos"} que el mes anterior`;

  return `En ${mes}, ${ahora} de los ${totalAhora} pacientes nuevos entraron presencial: ${(parte * 100).toFixed(0)}%, ${movimiento}.`;
}

/**
 * El apilado diario, en el formato que espera `GraficoDiario`.
 *
 * Se arma a partir de las barras que ya calculó `armarVista` y no de las
 * filas crudas, para que el gráfico y el panel no puedan discrepar: son el
 * mismo dato contado una sola vez.
 */
export function armarDesglose(vista: VistaSesiones): Desglose {
  const barras: Punto[] = [];
  for (const b of vista.barras) {
    let tiene = false;
    for (const clave of vista.claves) {
      const valor = b.segmentos.get(clave) ?? 0;
      if (valor === 0) continue;
      tiene = true;
      barras.push({ periodo: b.fecha, clave: etiqueta(clave), valor });
    }

    // El día sin nadie lleva una fila en cero igual.
    //
    // El eje del gráfico se arma con las fechas que vienen en los puntos, así
    // que un día sin fila desaparece y los días que quedan se dibujan
    // pegados: tres días sin un solo presencial se leen como si fueran
    // consecutivos. Con la fila en cero el día ocupa su lugar y el gráfico lo
    // marca con su rayita en el piso, que es lo que deja contar cuántos días
    // vacíos hubo en el medio. Es lo mismo que se arregló en Business el
    // 2026-11-02.
    if (!tiene && vista.claves.length > 0) {
      barras.push({ periodo: b.fecha, clave: etiqueta(vista.claves[0]!), valor: 0 });
    }
  }
  return {
    barras,
    plataformas: vista.claves.map(etiqueta),
    // El tooltip muestra las mismas filas que el apilado: con dos claves no
    // hay una segunda dimensión que mostrar, y repetirlas es lo que hace que
    // el día apuntado se pueda leer sin contar píxeles.
    utm: barras,
  };
}

/** 'UY·presencial' → 'UY presencial', que es como lo nombra la leyenda. */
export function etiqueta(clave: string): string {
  const [pais, modalidad] = clave.split("·");
  return `${pais} ${modalidad === "sin_dato" ? "sin dato" : modalidad}`;
}

function nombreCorto(mes: string): string {
  const NOMBRES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  return NOMBRES[Number(mes.slice(5, 7)) - 1] ?? mes;
}

function diaLocal(ahora: Date): string {
  return new Date(ahora.getTime() - LOCAL_UTC_OFFSET_HOURS * 3_600_000)
    .toISOString()
    .slice(0, 10);
}
