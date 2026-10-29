import { GraficoSerie, type Serie } from "@/components/grafico-serie";
import { identidadDe } from "@/components/identidad";
import { entero, porcentaje, mesCorto } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

/**
 * MOCKUP de la pestaña Business. Se borra.
 *
 * Los números son REALES: salen de las sondas business_nuevos_por_mes,
 * business_activos_por_mes y business_cuantas_empresas que corrieron contra
 * producción el 2026-10-29. Lo único inventado son los nombres de los cupones
 * del panel de empresas, que están tapados a propósito.
 *
 * Vive en /login-biz porque el middleware deja pasar todo lo que empieza con
 * "login" sin sesión.
 */

const MESES = [
  "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03",
  "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10",
];

/** Pacientes nuevos: el cupón business se aplicó al pago con el que entraron. */
const NUEVOS = {
  AR: [5, 6, 5, 3, 5, 13, 7, 15, 0, 11, 5, 4, 22, 19],
  UY: [43, 91, 69, 41, 54, 62, 55, 44, 68, 57, 52, 61, 45, 35],
};
/** La otra lectura: usó un cupón business alguna vez, aunque haya entrado solo. */
const NUEVOS_ALGUNA_VEZ = {
  AR: [20, 11, 8, 7, 19, 29, 12, 25, 4, 20, 12, 9, 28, 19],
  UY: [54, 98, 74, 48, 62, 74, 61, 52, 75, 63, 61, 63, 48, 35],
};
const NUEVOS_TOTAL = {
  AR: [154, 119, 137, 129, 254, 319, 264, 353, 343, 384, 470, 613, 621, 483],
  UY: [135, 169, 126, 113, 162, 184, 197, 200, 225, 189, 259, 218, 256, 219],
};

/** Activos: sesión en el mes, de alguien que alguna vez usó un cupón business. */
const ACTIVOS = {
  AR: [206, 198, 189, 172, 156, 185, 171, 187, 164, 173, 175, 158, 161, 156],
  UY: [533, 592, 593, 587, 515, 597, 610, 576, 603, 624, 631, 605, 521, 424],
};
const ACTIVOS_TOTAL = {
  AR: [690, 664, 649, 640, 644, 791, 831, 946, 1032, 1162, 1322, 1536, 1668, 1620],
  UY: [864, 952, 925, 924, 833, 977, 1046, 1042, 1111, 1119, 1232, 1210, 1200, 1093],
};
/** Y la tercera lectura: compró con un cupón business EN el mes. */
const COMPRARON_CON_CUPON = [
  317, 411, 400, 331, 320, 461, 398, 406, 408, 446, 427, 455, 348, 313,
];
/** Cuántos cupones business distintos se usaron cada mes. */
const CUPONES_POR_MES = [
  94, 140, 128, 117, 104, 129, 131, 133, 124, 128, 140, 139, 130, 129,
];

const ULTIMO = MESES.length - 1; // 2026-10, sin cerrar
const CERRADO = ULTIMO - 1; // 2026-09
const PREVIO = ULTIMO - 2; // 2026-08

function serie(
  nombre: string,
  valores: number[],
  trazo: string,
  relleno: string,
): Serie {
  return {
    nombre,
    trazo,
    relleno,
    puntos: MESES.map((mes, i) => ({
      mes,
      valor: valores[i]!,
      enCurso: i === ULTIMO,
    })),
  };
}

export default function MockupBusiness() {
  const nuevos = [
    serie("AR", NUEVOS.AR, "stroke-teal", "fill-teal"),
    serie("UY", NUEVOS.UY, "stroke-gold", "fill-gold"),
  ];
  const activos = [
    serie("AR", ACTIVOS.AR, "stroke-teal", "fill-teal"),
    serie("UY", ACTIVOS.UY, "stroke-gold", "fill-gold"),
  ];
  const lecturas = [
    serie(
      "Compró con cupón en el mes",
      COMPRARON_CON_CUPON,
      "stroke-orange",
      "fill-orange",
    ),
  ];

  const nuevosCerrado = NUEVOS.AR[CERRADO]! + NUEVOS.UY[CERRADO]!;
  const nuevosPrevio = NUEVOS.AR[PREVIO]! + NUEVOS.UY[PREVIO]!;
  const activosCerrado = ACTIVOS.AR[CERRADO]! + ACTIVOS.UY[CERRADO]!;
  const activosPrevio = ACTIVOS.AR[PREVIO]! + ACTIVOS.UY[PREVIO]!;
  const nuevosTotalCerrado =
    NUEVOS_TOTAL.AR[CERRADO]! + NUEVOS_TOTAL.UY[CERRADO]!;
  const activosTotalCerrado =
    ACTIVOS_TOTAL.AR[CERRADO]! + ACTIVOS_TOTAL.UY[CERRADO]!;

  return (
    <main className="contenedor pb-16 pt-6">
      <p className="text-xs uppercase tracking-wide text-ter">
        Mockup · pestaña Business · números reales del 2026-10-29
      </p>
      <h1 className="mt-1 text-2xl text-texto">Business</h1>

      <p className="mt-4 border-l-2 border-gold bg-warn-bg px-3 py-2 text-sm text-texto">
        Business son los pacientes que llegan con el{" "}
        <strong>cupón de una empresa</strong>. No hay columna que lo diga: la
        tabla <code>cupones</code> no tiene tipo, así que business se define por
        descarte —todo cupón que <strong>no</strong> sea uno de los
        promocionales (<code>meanimo</code>, <code>terapia</code> + apellido,{" "}
        <code>#fcyo:)</code>, <code>ffnic32026</code>,{" "}
        <code>cuponespecialtt</code>…, <code>7años</code>). Hoy eso deja{" "}
        <strong>803 cupones business</strong> contra{" "}
        <strong>28 promocionales</strong>, de los 831 que alguna vez se usaron.
      </p>

      <div className="mt-4 grid gap-[10px] md:grid-cols-3">
        <Card
          nombre="Nuevos business"
          valor={entero(nuevosCerrado)}
          pie={`↑ +3% vs. ${mesCorto(MESES[PREVIO]!)} (${nuevosPrevio})`}
          tono="text-green"
        />
        <Card
          nombre="Activos business"
          valor={entero(activosCerrado)}
          pie={`↓ −11% vs. ${mesCorto(MESES[PREVIO]!)} (${activosPrevio})`}
          tono="text-coral"
        />
        <Card
          nombre="Parte de los pacientes nuevos"
          valor={porcentaje(nuevosCerrado / nuevosTotalCerrado)}
          pie={`${nuevosCerrado} de ${entero(nuevosTotalCerrado)} en ${mesCorto(
            MESES[CERRADO]!,
          )}`}
          tono="text-sec"
        />
      </div>

      <Bloque
        titulo="Pacientes nuevos business · por plataforma"
        series={nuevos}
        pie="Nuevo business es el que hizo su primera compra en el mes y esa compra llevaba un cupón de empresa. Casi todo es Uruguay: en Argentina son entre 0 y 22 por mes contra 483 nuevos totales."
      />

      <Bloque
        titulo="Pacientes activos business · por plataforma"
        series={activos}
        pie="Activo business es el que hizo una sesión en el mes y alguna vez usó un cupón de empresa — el mismo criterio que usa Exterior para sus activos."
      />

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-wide text-ter">
          Cuántas empresas hay detrás · cupones business distintos por mes
        </h2>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1">
            {MESES.map((mes, i) => (
              <div
                key={mes}
                className="flex items-center gap-3 border-t border-borde py-1.5 text-xs"
              >
                <span className="w-16 shrink-0 text-sec">{mesCorto(mes)}</span>
                <div className="h-1.5 flex-1 rounded-sm bg-surface-2">
                  <div
                    className="h-1.5 rounded-sm bg-orange"
                    style={{ width: `${(CUPONES_POR_MES[i]! / 140) * 100}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right tabular-nums text-texto">
                  {CUPONES_POR_MES[i]} cupones
                </span>
                <span className="w-24 shrink-0 text-right tabular-nums text-sec">
                  {COMPRARON_CON_CUPON[i]} pacientes
                </span>
              </div>
            ))}
          </div>

          <aside className="rounded-lg border border-borde bg-surface px-4 py-3 lg:w-[420px] lg:shrink-0">
            <p className="text-xs uppercase tracking-wide text-ter">
              Por qué la barra no se parte por empresa
            </p>
            <p className="mt-0.5 text-xl text-texto">129 cupones en un mes</p>
            <p className="mt-2 text-sm text-sec">
              Un mes típico usa entre 94 y 140 cupones business distintos, con
              unos tres pacientes cada uno. Apilada por empresa, la barra tendría
              130 franjas de un píxel. Así que la empresa va en una tabla aparte
              —las diez o veinte más grandes— y la barra se parte por plataforma,
              como en Exterior.
            </p>
            <table className="mt-3 w-full text-xs">
              <tbody className="text-sec">
                {["EMPRESA A", "EMPRESA B", "EMPRESA C", "EMPRESA D"].map(
                  (e, i) => (
                    <tr key={e} className="border-t border-borde">
                      <td className="py-1.5 text-texto">{e}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {[64, 41, 33, 28][i]} pacientes
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ter">
              Nombres tapados: los reales no los mostré todavía porque son datos
              que no habías pedido ver en pantalla.
            </p>
          </aside>
        </div>
      </section>

      <Bloque
        titulo="La tercera lectura · compraron con cupón business EN el mes"
        series={lecturas}
        pie="Esta es la serie que no depende del pasado: quién usó un cupón de empresa en el mes. En septiembre son 348, contra 682 por el criterio de «alguna vez». La mitad de los «activos business» ya no están comprando con cupón."
      />

      <section className="mt-10 rounded-lg border border-borde bg-surface px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-ter">
          Lo que hay que decidir antes de construirla
        </p>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-sec">
          <li>
            <strong className="text-texto">Qué es un activo business.</strong>{" "}
            «Alguna vez usó cupón» da 682 en septiembre; «compró con cupón ese
            mes» da 348. Son dos preguntas distintas y la diferencia es el doble.
          </li>
          <li>
            <strong className="text-texto">Qué es un nuevo business.</strong> El
            cupón en el pago de entrada ({NUEVOS.UY[CERRADO]} en septiembre en UY) o alguna vez ({NUEVOS_ALGUNA_VEZ.UY[CERRADO]}). Prefiero el primero: «alguna vez» hace crecer un mes ya
            cerrado cada vez que un paciente viejo se suma a una empresa, y el
            tablero no recalcula meses cerrados.
          </li>
          <li>
            <strong className="text-texto">La lista de promocionales.</strong> Me
            la diste como «los que están activos actualmente», pero la serie
            mira 13 meses atrás. Un promocional viejo que no esté en la lista
            hoy cuenta como business. ¿Hubo otros antes?
          </li>
          <li>
            <strong className="text-texto">
              Los nombres de las empresas en pantalla.
            </strong>{" "}
            La tabla de arriba necesita el nombre del cupón. ¿Los muestro?
          </li>
          <li>
            <strong className="text-texto">803 cupones business</strong> para lo
            que pensaba que eran unas pocas empresas. Puede ser que la empresa
            emita un cupón por empleado. Si es así, la tabla de empresas
            necesita agrupar por prefijo, no por cupón.
          </li>
        </ol>
      </section>
    </main>
  );
}

function Bloque({
  titulo,
  series,
  pie,
}: {
  titulo: string;
  series: Serie[];
  pie: string;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xs uppercase tracking-wide text-ter">{titulo}</h2>
      <GraficoSerie
        series={series}
        tipo="barras"
        formatoId="entero"
        identidad={identidadDe("TOTAL")}
        apiladas
        leyendaEnCurso="mes sin cerrar"
      />
      <p className="mt-3 text-sm text-sec">{pie}</p>
    </section>
  );
}

function Card({
  nombre,
  valor,
  pie,
  tono,
}: {
  nombre: string;
  valor: string;
  pie: string;
  tono: string;
}) {
  return (
    <div className="rounded-lg border border-borde bg-surface px-3 py-2.5">
      <p className="text-xs text-sec">{nombre}</p>
      <p className="mt-0.5 text-xl text-texto">{valor}</p>
      <p className={`mt-0.5 truncate text-xs ${tono}`}>{pie}</p>
    </div>
  );
}
