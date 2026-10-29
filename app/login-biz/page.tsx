import { GraficoSerie, type Serie } from "@/components/grafico-serie";
import { identidadDe } from "@/components/identidad";
import { entero, porcentaje, mesCorto } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

/**
 * MOCKUP de la pestaña Business. Se borra.
 *
 * Segunda versión. La primera contaba como business todo cupón que no fuera
 * promocional, y eso metía Black Friday, cyber, cumpleaños y tres cupones
 * llamados "fb ads" — daba 67 nuevos y 682 activos en septiembre. Estos
 * números salen del mapeo de `lib/empresas.ts`, que son empresas de verdad:
 * 53 y 388.
 *
 * Todo es real, de las sondas empresas_* contra producción el 2026-10-29,
 * nombres de empresa incluidos.
 *
 * Vive en /login-biz porque el middleware deja pasar todo lo que empieza con
 * "login" sin sesión.
 */

const MESES = [
  "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02", "2026-03",
  "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10",
];

/** Pacientes nuevos: el cupón de empresa se aplicó al pago con el que entraron. */
const NUEVOS = {
  AR: [1, 0, 1, 1, 1, 1, 0, 4, 0, 2, 1, 0, 14, 14],
  UY: [39, 86, 67, 40, 48, 55, 52, 41, 66, 56, 50, 60, 39, 32],
};
/** La otra lectura: usó un cupón de empresa alguna vez, aunque haya entrado solo. */
const NUEVOS_ALGUNA_VEZ = {
  AR: [3, 0, 1, 2, 1, 1, 1, 4, 0, 2, 1, 1, 14, 14],
  UY: [42, 89, 67, 42, 49, 57, 53, 45, 69, 59, 56, 61, 40, 32],
};
const NUEVOS_TOTAL = {
  AR: [154, 119, 137, 129, 254, 319, 264, 353, 343, 384, 470, 613, 621, 483],
  UY: [135, 169, 126, 113, 162, 184, 197, 200, 225, 189, 259, 218, 256, 219],
};

/** Activos: sesión en el mes, de alguien que alguna vez usó un cupón de empresa. */
const ACTIVOS = {
  AR: [23, 23, 20, 21, 20, 18, 19, 21, 19, 20, 20, 19, 21, 32],
  UY: [301, 370, 380, 382, 345, 401, 408, 383, 414, 449, 460, 456, 367, 291],
};
const ACTIVOS_TOTAL = {
  AR: [690, 664, 649, 640, 644, 791, 831, 946, 1032, 1162, 1322, 1536, 1668, 1620],
  UY: [864, 952, 925, 924, 833, 977, 1046, 1042, 1111, 1119, 1232, 1210, 1200, 1093],
};
/** Y la tercera lectura: compró con un cupón de empresa EN el mes. */
const COMPRARON_CON_CUPON = [
  272, 335, 317, 308, 286, 343, 353, 339, 379, 419, 400, 431, 311, 287,
];
/** Cuántas empresas distintas aparecieron cada mes. */
const EMPRESAS_POR_MES = [
  35, 34, 36, 34, 34, 36, 33, 36, 38, 39, 46, 42, 44, 37,
];

/** Las más grandes, por pacientes distintos desde que existe cada cupón. */
const TOP_EMPRESAS: [string, number][] = [
  ["Farmashop", 368],
  ["Fosmetal", 260],
  ["TCS", 233],
  ["UTEC", 93],
  ["December Labs", 67],
  ["Galicia", 61],
  ["L'Oréal", 50],
  ["AXO", 49],
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
        <strong>cupón de una empresa</strong>. La tabla <code>cupones</code> no
        tiene columna de tipo, así que la empresa sale del nombre del cupón:{" "}
        <strong>67 empresas</strong> mapeadas a mano en{" "}
        <code>lib/empresas.ts</code>. Las campañas quedan afuera —Black Friday,
        cyber, cumpleaños y los cupones mensuales de ads no son una empresa.
      </p>

      <div className="mt-4 grid gap-[10px] md:grid-cols-3">
        <Card
          nombre="Nuevos de empresa"
          valor={entero(nuevosCerrado)}
          pie={`↓ −12% vs. ${mesCorto(MESES[PREVIO]!)} (${nuevosPrevio})`}
          tono="text-coral"
        />
        <Card
          nombre="Activos de empresa"
          valor={entero(activosCerrado)}
          pie={`↓ −18% vs. ${mesCorto(MESES[PREVIO]!)} (${activosPrevio})`}
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
        titulo="Pacientes nuevos de empresa · por plataforma"
        series={nuevos}
        pie="Nuevo de empresa es el que hizo su primera compra en el mes y esa compra llevaba un cupón de empresa. Hasta agosto Argentina aportaba uno o ninguno por mes; los 14 de septiembre y octubre son Pilay, que arrancó el 24 de septiembre y ya lleva 25 pacientes."
      />

      <Bloque
        titulo="Pacientes activos de empresa · por plataforma"
        series={activos}
        pie="Activo de empresa es el que hizo una sesión en el mes y alguna vez usó un cupón de empresa — el mismo criterio que usa Exterior para sus activos. Uruguay venía en 460 en julio y está en 291 en octubre."
      />

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-wide text-ter">
          Cuántas empresas aparecen cada mes
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
                    style={{ width: `${(EMPRESAS_POR_MES[i]! / 46) * 100}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right tabular-nums text-texto">
                  {EMPRESAS_POR_MES[i]} empresas
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
            <p className="mt-0.5 text-xl text-texto">37 empresas en octubre</p>
            <p className="mt-2 text-sm text-sec">
              Entre 33 y 46 por mes, y la cola es larga: después de las diez
              primeras hay empresas de uno o dos pacientes. Apilada por empresa
              la barra sería ilegible, así que la barra se parte por plataforma
              —como en Exterior— y la empresa va en esta tabla.
            </p>
            <table className="mt-3 w-full text-xs">
              <tbody className="text-sec">
                {TOP_EMPRESAS.map(([nombre, pacientes]) => (
                  <tr key={nombre} className="border-t border-borde">
                    <td className="py-1.5 text-texto">{nombre}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {pacientes} pacientes
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ter">
              Pacientes distintos desde que existe cada cupón, no del mes.
            </p>
          </aside>
        </div>
      </section>

      <Bloque
        titulo="La tercera lectura · compraron con cupón de empresa EN el mes"
        series={lecturas}
        pie="La serie que no depende del pasado: quién usó un cupón de empresa en el mes. En septiembre son 311, contra 388 por el criterio de «alguna vez». Acá incluye Argentina, que en la barra de activos casi no se ve."
      />

      <section className="mt-10 rounded-lg border border-borde bg-surface px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-ter">
          Lo que hay que decidir antes de construirla
        </p>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-sec">
          <li>
            <strong className="text-texto">Qué es un activo de empresa.</strong>{" "}
            «Alguna vez usó cupón» da 388 en septiembre; «compró con cupón ese
            mes» da 311. Es la única decisión que queda.
          </li>
          <li>
            <strong className="text-texto">Qué es un nuevo de empresa.</strong> El
            cupón en el pago de entrada ({NUEVOS.UY[CERRADO]} en septiembre en UY) o alguna vez ({NUEVOS_ALGUNA_VEZ.UY[CERRADO]}). Prefiero el primero: «alguna vez» hace crecer un mes ya
            cerrado cada vez que un paciente viejo se suma a una empresa, y el
            tablero no recalcula meses cerrados. Con empresas la diferencia es
            chica, así que es barato elegir bien.
          </li>
          <li>
            <strong className="text-texto">Cinco cupones que no sé de quién son:</strong>{" "}
            <code>#BienestarMN</code>, <code>#AlianzaRB</code>,{" "}
            <code>#alianzaGA</code>, <code>#N2PMO</code> e{" "}
            <code>#iclos097</code>. Un paciente cada uno, así que no mueven la
            serie, pero si son empresa van en la lista.
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
