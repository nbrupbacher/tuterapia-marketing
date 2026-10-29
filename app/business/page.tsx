import { Nav, Selectores, contexto } from "@/components/nav";
import { GraficoSerie, type Serie } from "@/components/grafico-serie";
import { GraficoDiario } from "@/components/grafico-diario";
import { identidadDe } from "@/components/identidad";
import {
  leerBusiness,
  type SerieBusiness,
  type VistaBusiness,
} from "@/lib/business";
import { SIN_AGRUPAR } from "@/components/composicion";
import { entero, porcentaje, mesCorto } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

/**
 * Business: los pacientes que llegan con el cupón de una empresa.
 *
 * El patrón de Exterior: en TOTAL las barras se parten por plataforma, y
 * eligiendo AR o UY los **nuevos** se parten por empresa.
 *
 * Los activos se quedan por plataforma. Un paciente puede haber usado cupones
 * de dos empresas y cuenta en las dos, así que apilarlos daría una barra más
 * alta que la tarjeta: en septiembre, 373 contra 366 personas. Los nuevos no
 * tienen ese problema porque se entra con el cupón de una sola empresa.
 */

/**
 * Los colores del apilado, escritos literales.
 *
 * Tailwind escanea el fuente y una clase armada en tiempo de ejecución nunca
 * llega a la hoja de estilos, así que esta lista no se construye con un
 * template. Son los mismos doce que usa Exterior.
 */
const PALETA = [
  { relleno: "fill-orange", trazo: "stroke-orange" },
  { relleno: "fill-teal", trazo: "stroke-teal" },
  { relleno: "fill-gold", trazo: "stroke-gold" },
  { relleno: "fill-orange-dk", trazo: "stroke-orange-dk" },
  { relleno: "fill-coral", trazo: "stroke-coral" },
  { relleno: "fill-e1", trazo: "stroke-e1" },
  { relleno: "fill-e3", trazo: "stroke-e3" },
  { relleno: "fill-e5", trazo: "stroke-e5" },
  { relleno: "fill-e2", trazo: "stroke-e2" },
  { relleno: "fill-e4", trazo: "stroke-e4" },
  { relleno: "fill-e6", trazo: "stroke-e6" },
  { relleno: "fill-dim", trazo: "stroke-dim" },
];

/** En TOTAL cada plataforma lleva su color de identidad, como en General. */
const COLOR_PLATAFORMA: Record<string, number> = { AR: 1, UY: 2 };

function aSeries(series: SerieBusiness[], porPlataforma: boolean): Serie[] {
  return series.map((s, i) => {
    const color =
      PALETA[
        porPlataforma ? (COLOR_PLATAFORMA[s.nombre] ?? i) : i % PALETA.length
      ]!;
    return {
      nombre: s.nombre,
      trazo: color.trazo,
      relleno: color.relleno,
      puntos: s.puntos,
    };
  });
}

export function PantallaBusiness({
  vista,
  pais,
}: {
  vista: VistaBusiness;
  pais: string;
}) {
  const esTotal = pais === "TOTAL";

  if (vista.vacia) {
    return (
      <p className="text-sm text-sec">
        No hay datos de empresas sincronizados. Los escribe /api/cron/funnel;
        corrélo y volvé.
      </p>
    );
  }

  return (
    <>
      <p className="border-l-2 border-gold bg-warn-bg px-3 py-2 text-sm text-texto">
        Business son los pacientes que llegan con el{" "}
        <strong>cupón de una empresa</strong>. La base no tiene columna que lo
        diga, así que la empresa sale del nombre del cupón, con un mapeo
        revisado a mano. Las campañas —Black Friday, cyber, cumpleaños, los
        cupones mensuales de ads— <strong>no</strong> son una empresa y quedan
        afuera.
      </p>

      <Tarjetas vista={vista} pais={pais} />

      <Bloque
        titulo={`Pacientes nuevos de empresa · ${
          esTotal ? "por plataforma" : `plataforma ${pais}, por empresa`
        }`}
        series={aSeries(vista.nuevos, esTotal)}
        pais={pais}
        pie={
          esTotal
            ? "Nuevo de empresa es el que hizo su primera compra en el mes y esa compra llevaba un cupón de empresa. Eligiendo AR o UY arriba, la barra se abre por empresa."
            : "Nuevo de empresa es el que hizo su primera compra en el mes y esa compra llevaba un cupón de empresa. Las franjas suman exacto: se entra con el cupón de una sola empresa."
        }
        recorte={esTotal ? undefined : SIN_AGRUPAR}
      />

      <Diario vista={vista} esTotal={esTotal} pais={pais} />

      <Bloque
        titulo="Pacientes activos de empresa · por plataforma"
        series={aSeries(vista.activos, true)}
        pais={pais}
        pie="Activo de empresa es el que hizo una sesión en el mes y ya tenía un cupón de empresa al cierre de ese mes. Esta barra no se abre por empresa: alguien que usó cupones de dos cuenta en las dos, y la barra quedaría más alta que la tarjeta de arriba."
      />

      <Empresas vista={vista} />
    </>
  );
}

export default async function Business({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const ctx = await contexto(params);
  const vista = await leerBusiness(ctx.pais, ctx.rango);

  return (
    <>
      <Nav activa="/business" ctx={ctx} />
      <Selectores activa="/business" ctx={ctx} conRango />

      <main className="contenedor pb-10 pt-6">
        <PantallaBusiness vista={vista} pais={ctx.pais} />
      </main>
    </>
  );
}

function Tarjetas({ vista, pais }: { vista: VistaBusiness; pais: string }) {
  const { resumen, parte } = vista;
  const sufijo = pais === "TOTAL" ? "" : ` · ${pais}`;

  return (
    <div className="mt-4 grid gap-[10px] md:grid-cols-3">
      <Card
        nombre={`Nuevos de empresa${sufijo}`}
        valor={entero(resumen.nuevos)}
        pie={movimiento(resumen.nuevos, resumen.nuevosPrevio, resumen.mesPrevio)}
        tono={tono(resumen.nuevos, resumen.nuevosPrevio)}
      />
      <Card
        nombre={`Activos de empresa${sufijo}`}
        valor={entero(resumen.activos)}
        pie={movimiento(
          resumen.activos,
          resumen.activosPrevio,
          resumen.mesPrevio,
        )}
        tono={tono(resumen.activos, resumen.activosPrevio)}
      />
      {/* Siempre sobre el total del negocio, nunca sobre la plataforma
          elegida: la pregunta es cuánto pesan las empresas, y con AR elegido
          un porcentaje sobre AR diría otra cosa con el mismo nombre. */}
      <Card
        nombre="Parte de los pacientes nuevos"
        valor={parte.total > 0 ? porcentaje(parte.empresa / parte.total) : "—"}
        pie={
          parte.mes === null
            ? "sin mes cerrado todavía"
            : `${entero(parte.empresa)} de ${entero(parte.total)} en ${mesCorto(parte.mes)}`
        }
        tono="text-sec"
      />
    </div>
  );
}

function Bloque({
  titulo,
  series,
  pais,
  pie,
  recorte,
}: {
  titulo: string;
  series: Serie[];
  pais: string;
  pie: string;
  /**
   * Sin recorte cuando las franjas son empresas: el panel es lo único que las
   * nombra, y con "otras" la mitad de la barra queda sin nombre. Es el mismo
   * pedido que en Exterior —"prefiero que los muestres que decir resto"—, y
   * acá pesa más todavía porque un color repetido entre doce es menos malo
   * que una franja de la que no se sabe de qué empresa es.
   */
  recorte?: { minimo: number; filas: number };
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xs uppercase tracking-wide text-ter">{titulo}</h2>
      <GraficoSerie
        series={series}
        tipo="barras"
        formatoId="entero"
        identidad={identidadDe(pais)}
        apiladas
        leyendaEnCurso="mes sin cerrar"
        recortePanel={recorte}
      />
      <p className="mt-3 text-sm text-sec">{pie}</p>
    </section>
  );
}

/**
 * Los últimos 45 días, debajo de la mensual.
 *
 * La misma ventana que Movimientos en General, para que las dos pestañas se
 * lean una contra otra sin recalibrar el ojo.
 *
 * Solo pacientes nuevos. Los activos no tienen versión diaria que signifique
 * algo: su definición es "sesión en el mes, de alguien que ya tenía cupón al
 * cierre del mes", y un día no tiene cierre de mes.
 */
function Diario({
  vista,
  esTotal,
  pais,
}: {
  vista: VistaBusiness;
  esTotal: boolean;
  pais: string;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-xs uppercase tracking-wide text-ter">
        Pacientes nuevos de empresa ·{" "}
        {esTotal ? "por plataforma" : `plataforma ${pais}, por empresa`} · 45
        días
      </h2>
      <GraficoDiario
        datos={vista.diario}
        rate={false}
        titulo="Pacientes nuevos de empresa"
      />
      <p className="mt-3 text-sm text-sec">
        El mismo número que la barra mensual de arriba, día por día. Son pocos
        por día —entre cero y unos pocos—, así que lo que se lee es el ritmo y
        los huecos, no la altura de un día suelto.
      </p>
    </section>
  );
}

/**
 * Las empresas del rango que se está mirando.
 *
 * `activos` es volumen, no gente distinta: una empresa con el mismo paciente
 * doce meses seguidos suma doce. Por eso va la cantidad de meses al lado — una
 * empresa de un mes y ciento veinte activos no existe.
 */
function Empresas({ vista }: { vista: VistaBusiness }) {
  const { empresas, porMes } = vista;
  if (empresas.length === 0) return null;

  const maximo = Math.max(...porMes.map((m) => m.empresas), 1);
  const ultimoCerrado = porMes.filter((m) => !m.enCurso).at(-1);

  return (
    <section className="mt-8">
      <h2 className="text-xs uppercase tracking-wide text-ter">
        Las empresas del rango
      </h2>

      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2 pb-1 text-[11px] text-ter">
            <span>empresa</span>
            <span className="flex gap-6">
              <span className="w-20 text-right">nuevos</span>
              <span className="w-24 text-right">activos</span>
              <span className="w-16 text-right">meses</span>
            </span>
          </div>

          {empresas.map((e) => (
            <div
              key={e.empresa}
              className="flex items-baseline justify-between gap-2 border-t border-borde py-2 text-xs"
            >
              <span className="truncate text-texto">{e.empresa}</span>
              <span className="flex gap-6 tabular-nums">
                <span className="w-20 text-right text-sec">
                  {e.nuevos === 0 ? "—" : entero(e.nuevos)}
                </span>
                <span className="w-24 text-right text-sec">
                  {e.activos === 0 ? "—" : entero(e.activos)}
                </span>
                <span className="w-16 text-right text-ter">{e.meses}</span>
              </span>
            </div>
          ))}
        </div>

        <aside className="rounded-lg border border-borde bg-surface px-4 py-3 lg:w-[380px] lg:shrink-0">
          <p className="text-xs uppercase tracking-wide text-ter">
            Cuántas empresas por mes
          </p>
          <p className="mt-0.5 text-xl text-texto">
            {ultimoCerrado
              ? `${ultimoCerrado.empresas} en ${mesCorto(ultimoCerrado.mes)}`
              : "—"}
          </p>

          <div className="mt-3">
            {porMes.map((m) => (
              <div
                key={m.mes}
                className="flex items-center gap-3 border-t border-borde py-1 text-xs"
              >
                <span className="w-14 shrink-0 text-sec">
                  {mesCorto(m.mes)}
                  {m.enCurso ? " ·" : ""}
                </span>
                <div className="h-1.5 flex-1 rounded-sm bg-surface-2">
                  <div
                    className={`h-1.5 rounded-sm ${m.enCurso ? "bg-dim" : "bg-orange"}`}
                    style={{ width: `${(m.empresas / maximo) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right tabular-nums text-texto">
                  {m.empresas}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-2 text-xs text-ter">
            Una empresa cuenta en un mes si tuvo algún paciente ese mes. El
            último lleva punto porque todavía no cerró.
          </p>
        </aside>
      </div>
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

/** El movimiento entre los dos últimos meses CERRADOS, con los dos nombrados. */
function movimiento(
  ahora: number,
  antes: number,
  mesPrevio: string | null,
): string {
  if (mesPrevio === null || antes <= 0) return "sin mes anterior para comparar";
  const relativo = ahora / antes - 1;
  if (Math.abs(relativo) < 0.005) return `igual vs. ${mesCorto(mesPrevio)}`;
  const flecha = relativo > 0 ? "↑ +" : "↓ −";
  return `${flecha}${Math.abs(relativo * 100).toFixed(0)}% vs. ${mesCorto(mesPrevio)}`;
}

function tono(ahora: number, antes: number): string {
  if (antes <= 0 || ahora === antes) return "text-sec";
  return ahora > antes ? "text-green" : "text-coral";
}
