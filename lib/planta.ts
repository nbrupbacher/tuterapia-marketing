import { withDb } from "@/lib/db";
import { entero, porcentaje, usd, decimal } from "@/lib/ui/format";

/**
 * Lo que dice la planta del header.
 *
 * Las frases con números se arman acá, en el servidor, leyendo las mismas
 * tablas de agregados que leen las pestañas. No hay una lista de números
 * escrita a mano en ningún lado: si la conversión del mes cambia, cambia
 * también lo que dice la planta, porque es el mismo dato.
 *
 * Eso importa más de lo que parece. Un número en un globo sigue siendo un
 * número en pantalla, y la regla de este tablero es que un número que aparece
 * en dos lugares sale de un solo lugar. Una planta que dijera "la conversión
 * va 9,1%" mientras General muestra 9,4% sería peor que una planta muda.
 *
 * Solo se arma la frase cuando el valor existe. Un mes sin gasto cargado no
 * tiene CAC, y la planta simplemente no habla de eso en vez de decir "—".
 */

/** Cuántas frases con datos puede llegar a haber. El resto son las de ambiente. */
export type FrasesPlanta = string[];

/**
 * Las de ambiente. No dicen nada del negocio y esa es toda su función: si
 * todas las frases fueran números, el header pasaría a ser una pestaña más.
 *
 * El tono lo pidió el dueño del producto el 2026-11-04: más ácida. Las
 * anteriores eran amables y se volvían invisibles a la semana; estas se
 * burlan de lo único de lo que esta planta puede burlarse sin costo, que es
 * mirar un tablero.
 *
 * Tres cosas quedan afuera, y no por pudor:
 *
 *  · los pacientes. Es una empresa de terapia y la gente que aparece en estos
 *    números está yendo a terapia. No hay chiste ahí que valga la pena.
 *  · las personas del equipo. Son cuatro y entran todos los días; una chicana
 *    sobre el trabajo de alguien, repetida cada noventa segundos, deja de ser
 *    un chiste al tercer día.
 *  · las malas palabras. Esto se proyecta en reuniones.
 *
 * Y cortas: el globo es `white-space: nowrap`, así que una frase larga se
 * estira en una sola línea hasta salirse. Cuarenta y pico de caracteres.
 */
const AMBIENTE = [
  "mirarlo fijo no lo mueve",
  "refrescar tampoco, ya probé",
  "yo no decido nada acá, solo decoro",
  "spoiler: mañana va a ser parecido",
  "me regaron el martes, por las dudas",
  "¿otra vez el mismo gráfico?",
  "la conversión no mejora si la mirás",
  "hace ocho minutos que no pasa nada",
  "andá a tomar agua, yo te cubro",
  "estoy para que el header no esté vacío",
];

/**
 * Lo que dice cuando alguien la toca: una distinta por toque, y da la vuelta
 * a las diez antes de repetir una.
 *
 * No se mezclan con lo que dice sola cada noventa segundos. Así tocarla tiene
 * algo propio, y las frases con datos no quedan diluidas entre veinte más.
 *
 * La última no es un chiste y está a propósito. Nueve respuestas secas y una
 * sincera hacen que la sincera se note; diez seguidas de las otras serían un
 * personaje de una nota sola.
 */
export const MOTIVACIONALES = [
  "tocarme no es una estrategia de crecimiento",
  "bueno, ya está, no me gastes",
  "una más y pido aumento",
  "no soy un botón, pero gracias",
  "crecer lleva tiempo, mirá mi maceta",
  "preguntale al CAC, yo no sé nada",
  "si estás tocándome, el mes viene tranquilo",
  "dale, última, que estaba meditando",
  "la paciencia es gratis, el tráfico no",
  "cada registro es alguien que se animó a pedir ayuda",
];

type Fila = {
  mes: string;
  registros: string | null;
  pacientes_nuevos: string | null;
  conversion_cohorte: string | null;
  cac_usd: string | null;
  sesiones_historico: string | null;
};

type Barata = { utm_source: string; costo: string } | null;

export async function leerFrasesDePlanta(pais: string): Promise<FrasesPlanta> {
  // El país TOTAL tiene su propia fila guardada, así que no hay que sumar nada
  // acá: se lee la fila que corresponda y listo.
  const frases = await withDb(async (db) => {
    const [mes, barata] = await Promise.all([
      db.query<Fila>(
        `select to_char(mes, 'YYYY-MM') as mes, registros::text,
                pacientes_nuevos::text, conversion_cohorte::text,
                cac_usd::text, sesiones_historico::text
           from marketing.metricas_mensuales
          where pais = $1 and plataforma = 'TODAS'
          order by mes desc limit 1`,
        [pais],
      ),
      // La creatividad que trae registros más barato, según la última lectura
      // de gasto que alguien cargó. Es lo más fresco que hay en el tablero.
      db.query<{ utm_source: string; costo: string }>(
        `with lectura as (
           select distinct on (pais, utm_source)
                  pais, utm_source, acumulado_usd, hasta
             from marketing.gasto_campana
            where $1 = 'TOTAL' or pais = $1
            order by pais, utm_source, hasta desc
         )
         select l.utm_source,
                (l.acumulado_usd / nullif(sum(m.registros), 0))::text as costo
           from lectura l
           join marketing.metricas_utm m
             on m.utm_source = l.utm_source and m.pais = l.pais
            and m.fecha <= l.hasta
          group by l.utm_source, l.acumulado_usd
         having sum(m.registros) > 0
          order by 2 limit 1`,
        [pais],
      ),
    ]);

    return conDatos(mes.rows[0] ?? null, barata.rows[0] ?? null);
  });

  return [...AMBIENTE, ...frases];
}

/**
 * Las frases que llevan número, cada una condicionada a que su número exista.
 *
 * Separada de la consulta para poder leerla de un vistazo: lo que la planta
 * puede decir sobre el negocio es esta lista y nada más.
 */
function conDatos(fila: Fila | null, barata: Barata): string[] {
  const frases: string[] = [];
  if (!fila) return frases;

  const num = (v: string | null) => (v === null ? null : Number(v));

  const registros = num(fila.registros);
  const nuevos = num(fila.pacientes_nuevos);
  const conversion = num(fila.conversion_cohorte);
  const cac = num(fila.cac_usd);
  const sesiones = num(fila.sesiones_historico);

  if (registros !== null) {
    frases.push(`van ${entero(registros)} registros este mes`);
  }
  if (nuevos !== null) {
    frases.push(`${entero(nuevos)} pacientes nuevos este mes`);
  }
  if (conversion !== null) {
    frases.push(`la conversión va en ${porcentaje(conversion)}`);
  }
  if (cac !== null) {
    frases.push(`el CAC del mes está en ${usd(cac, 1)}`);
  }
  if (sesiones !== null) {
    frases.push(`un paciente hace ${decimal(sesiones)} sesiones de por vida`);
  }
  if (barata !== null) {
    frases.push(
      `${barata.utm_source} es la que trae registros más barato: ${usd(
        Number(barata.costo),
        2,
      )}`,
    );
  }

  return frases;
}
