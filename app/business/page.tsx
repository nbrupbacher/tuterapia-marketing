import Link from "next/link";
import { Nav, Selectores, contexto, conContexto } from "@/components/nav";
import { GraficoSerie, type Serie } from "@/components/grafico-serie";
import { GraficoDiario } from "@/components/grafico-diario";
import { identidadDe } from "@/components/identidad";
import {
  leerBusiness,
  type SerieBusiness,
  type VistaBusiness,
} from "@/lib/business";
import {
  leerRevenueBusiness,
  type Monto,
  type VistaRevenue,
} from "@/lib/business-revenue";
import {
  leerEmpresa,
  veredicto,
  type DetalleEmpresa,
} from "@/lib/empresa";
import type { Punto } from "@/lib/desglose";
import { SIN_AGRUPAR } from "@/components/composicion";
import { entero, porcentaje, mesCorto, nombreDeMes, usd } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

/**
 * Business: los pacientes que llegan con el cupón de una empresa.
 *
 * El patrón de Exterior: en TOTAL las barras se parten por plataforma, y
 * eligiendo AR o UY se parten por empresa, tanto los nuevos como los activos.
 *
 * En los activos las franjas pueden sumar más que la tarjeta: un paciente que
 * usó cupones de dos empresas cuenta en las dos (en septiembre, 373 contra 366
 * personas). Lo eligió el dueño del producto sobre achicar las franjas, y el
 * pie lo avisa. Los nuevos no tienen ese problema porque se entra con el cupón
 * de una sola empresa.
 *
 * Al final, cuánto aporta cada empresa: lo que entra por fee y por cupón, y lo
 * que queda de eso.
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

/** Los dos colores del revenue: lo que entra por fee y lo que entra por cupón. */
const COLOR_FEE = { relleno: "fill-teal", trazo: "stroke-teal", punto: "bg-teal" };
const COLOR_CUPON = { relleno: "fill-orange", trazo: "stroke-orange", punto: "bg-orange" };

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
  revenue,
  pais,
  detalle,
  enlace,
}: {
  vista: VistaBusiness;
  revenue: VistaRevenue;
  pais: string;
  /** La empresa abierta, cuando hay una en la URL. */
  detalle?: DetalleEmpresa | null;
  /** Cómo se arma el enlace de una fila. Sin esto la tabla no es clickeable. */
  enlace?: (empresa: string | null) => string;
}) {
  const esTotal = pais === "TOTAL";
  const corte = esTotal ? "por plataforma" : `plataforma ${pais}, por empresa`;

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
        titulo={`Pacientes nuevos de empresa · ${corte}`}
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
        titulo={`Pacientes activos de empresa · ${corte}`}
        series={aSeries(vista.activos, esTotal)}
        pais={pais}
        pie={
          esTotal
            ? "Activo de empresa es el que hizo una sesión en el mes y ya tenía un cupón de empresa al cierre de ese mes. Pasando el mouse por un mes se ven sus empresas; eligiendo AR o UY arriba, la barra se abre por empresa."
            : "Activo de empresa es el que hizo una sesión en el mes y ya tenía un cupón de empresa al cierre de ese mes. La barra suma las empresas y puede quedar un poco más alta que la tarjeta de arriba, que cuenta personas: quien usó cupones de dos empresas está en las dos franjas."
        }
        recorte={esTotal ? undefined : SIN_AGRUPAR}
        utm={vista.activosEmpresa}
        solapa
      />

      <Empresas vista={vista} detalle={detalle} enlace={enlace} />

      <Revenue revenue={revenue} pais={pais} />
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
  const elegida = params.empresa?.trim() || null;

  // El detalle solo se pide cuando hay una empresa en la URL: cargarlo siempre
  // sería traer trece meses de todas para mostrar una.
  const [vista, revenue, detalle] = await Promise.all([
    leerBusiness(ctx.pais, ctx.rango),
    leerRevenueBusiness(ctx.pais, ctx.rango),
    elegida ? leerEmpresa(elegida, ctx.pais, ctx.rango) : Promise.resolve(null),
  ]);

  return (
    <>
      <Nav activa="/business" ctx={ctx} />
      <Selectores activa="/business" ctx={ctx} conRango />

      <main className="contenedor pb-10 pt-6">
        <PantallaBusiness
          vista={vista}
          revenue={revenue}
          pais={ctx.pais}
          detalle={detalle}
          enlace={(empresa) =>
            empresa === null
              ? conContexto("/business", ctx)
              : conContexto("/business", ctx, { empresa })
          }
        />
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
  utm,
  solapa = false,
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
  /** Las empresas de cada mes, para el tooltip. */
  utm?: Punto[];
  /** Si las filas del tooltip pueden contar dos veces a una persona. */
  solapa?: boolean;
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
        utm={utm}
        clavesMono={false}
        solapa={solapa}
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
        clavesMono={false}
      />
      <p className="mt-3 text-sm text-sec">
        El mismo número que la barra mensual de arriba, día por día. Son pocos
        por día —entre cero y unos pocos—, así que lo que se lee es el ritmo y
        los huecos, no la altura de un día suelto. Pasando el mouse por un día
        se ven sus empresas.
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
/**
 * Las empresas del rango, con su tendencia y el detalle de la elegida.
 *
 * La serie en miniatura va en la fila, no solo adentro del panel: son casi
 * sesenta empresas y una cuenta que se cae tiene que verse al pasar la vista,
 * sin abrir cincuenta y siete paneles para encontrarla.
 */
function Empresas({
  vista,
  detalle,
  enlace,
}: {
  vista: VistaBusiness;
  detalle?: DetalleEmpresa | null;
  enlace?: (empresa: string | null) => string;
}) {
  const { empresas, porMes } = vista;
  if (empresas.length === 0) return null;

  const ultimoCerrado = porMes.filter((m) => !m.enCurso).at(-1);
  const mesPrevio = porMes.filter((m) => !m.enCurso).at(-2);

  return (
    <section className="mt-8">
      <h2 className="text-xs uppercase tracking-wide text-ter">
        Las empresas del rango
      </h2>

      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 pb-1 text-[11px] text-ter">
            <span className="flex-1">empresa</span>
            <span className="w-24 text-center">activos · el rango</span>
            <span className="w-14 text-right">activos</span>
            <span className="w-20 text-right">
              {mesPrevio ? `vs. ${mesCorto(mesPrevio.mes)}` : "vs. anterior"}
            </span>
            <span className="w-14 text-right">meses</span>
          </div>

          {empresas.map((e) => {
            const abierta = detalle?.empresa === e.empresa;
            const fila = (
              <>
                <span className="flex-1 truncate text-texto">
                  {abierta ? "▸ " : ""}
                  {e.empresa}
                </span>
                <span className="w-24">
                  <Chispa
                    valores={e.serie}
                    enCurso={porMes.map((m) => m.enCurso)}
                    color={abierta ? "bg-orange" : "bg-dim"}
                  />
                </span>
                <span className="w-14 text-right tabular-nums text-sec">
                  {e.ahora === 0 ? "—" : entero(e.ahora)}
                </span>
                <Movimiento ahora={e.ahora} antes={e.antes} />
                <span className="w-14 text-right tabular-nums text-ter">
                  {e.meses}
                </span>
              </>
            );

            const clases = `flex items-center gap-2 border-t border-borde py-2 text-xs ${
              abierta ? "bg-surface-2" : "hover:bg-surface"
            }`;

            return enlace ? (
              <Link
                key={e.empresa}
                href={enlace(abierta ? null : e.empresa)}
                className={clases}
                scroll={false}
              >
                {fila}
              </Link>
            ) : (
              <div key={e.empresa} className={clases}>
                {fila}
              </div>
            );
          })}

          <p className="mt-3 text-sm text-sec">
            La columna del medio es la serie de activos del rango, para que una
            cuenta que se está yendo se vea sin abrir nada. Clic en una fila
            para el detalle.
          </p>
        </div>

        {detalle && !detalle.vacia ? (
          <Detalle d={detalle} cerrar={enlace?.(null)} />
        ) : (
          <PorMes porMes={porMes} ultimoCerrado={ultimoCerrado} />
        )}
      </div>
    </section>
  );
}

/** El movimiento del mes, callado cuando los números son demasiado chicos. */
function Movimiento({ ahora, antes }: { ahora: number; antes: number }) {
  // Tres activos contra dos es "+50%" y es una persona. Con la cola de
  // empresas de uno o dos pacientes, mostrar ese número sería llenar la tabla
  // de flechas de colores que no significan nada.
  if (Math.max(ahora, antes) < 5 || antes === 0) {
    return <span className="w-20 text-right tabular-nums text-ter">—</span>;
  }

  const delta = ahora / antes - 1;
  const tono =
    delta < -0.1 ? "text-coral" : delta > 0.1 ? "text-green" : "text-sec";
  const flecha = delta > 0 ? "↑ +" : "↓ −";

  return (
    <span className={`w-20 text-right tabular-nums ${tono}`}>
      {Math.abs(delta) < 0.005
        ? "igual"
        : `${flecha}${Math.abs(delta * 100).toFixed(0)}%`}
    </span>
  );
}

/** La serie en miniatura: una barrita por mes, el mes en curso apagado. */
function Chispa({
  valores,
  enCurso,
  color,
}: {
  valores: number[];
  enCurso: boolean[];
  color: string;
}) {
  const max = Math.max(...valores, 1);
  return (
    <span className="flex h-5 items-end gap-[2px]">
      {valores.map((v, i) => (
        <span
          key={i}
          className={`flex-1 rounded-[1px] ${enCurso[i] ? "bg-dim" : color}`}
          style={{ height: `${Math.max((v / max) * 100, v > 0 ? 8 : 2)}%` }}
        />
      ))}
    </span>
  );
}

/** El panel de siempre, cuando no hay ninguna empresa abierta. */
function PorMes({
  porMes,
  ultimoCerrado,
}: {
  porMes: VistaBusiness["porMes"];
  ultimoCerrado?: { mes: string; empresas: number };
}) {
  const maximo = Math.max(...porMes.map((m) => m.empresas), 1);

  return (
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
        Una empresa cuenta en un mes si tuvo algún paciente ese mes. El último
        lleva punto porque todavía no cerró.
      </p>
    </aside>
  );
}

/** El detalle de la empresa elegida. */
function Detalle({ d, cerrar }: { d: DetalleEmpresa; cerrar?: string }) {
  const i = d.mes === null ? -1 : d.meses.findIndex((m) => m.mes === d.mes);
  const ahora = i >= 0 ? d.activos[i]! : 0;
  const antes = i >= 1 ? d.activos[i - 1]! : 0;
  const juicio = veredicto(d);
  const enCurso = d.meses.map((m) => m.enCurso);
  const max = Math.max(...d.activos, 1);

  const trimestre = (v: number[], fin: number) =>
    fin >= 2 ? v[fin]! + v[fin - 1]! + v[fin - 2]! : 0;
  const ult3 = trimestre(d.activos, i);
  const prev3 = trimestre(d.activos, i - 3);

  const borde =
    juicio?.tono === "mal"
      ? "border-coral"
      : juicio?.tono === "bien"
        ? "border-green"
        : "border-dim";

  return (
    <aside className="rounded-lg border border-borde bg-surface px-4 py-3 lg:w-[460px] lg:shrink-0">
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-base text-texto">{d.empresa}</p>
        <p className="shrink-0 text-xs text-ter">
          {d.plataformas.join(" + ") || "—"}
          {d.tipos.length > 0 ? ` · ${d.tipos.join(" + ")}` : ""}
          {cerrar ? (
            <>
              {" · "}
              <Link href={cerrar} className="text-sec hover:text-texto" scroll={false}>
                cerrar
              </Link>
            </>
          ) : null}
        </p>
      </div>

      <p className="mt-3 text-xs uppercase tracking-wide text-ter">
        Pacientes activos{d.mes ? ` · ${mesCorto(d.mes)}` : ""}
      </p>
      <p className="mt-0.5 flex items-baseline gap-2">
        <span className="text-3xl text-texto">{entero(ahora)}</span>
        <Movimiento ahora={ahora} antes={antes} />
        {antes > 0 ? (
          <span className="text-xs text-ter">
            {entero(antes)} en {d.mesPrevio ? mesCorto(d.mesPrevio) : "—"}
          </span>
        ) : null}
      </p>

      {/* El veredicto en palabras: un porcentaje solo no distingue un mes
          flojo de una cuenta perdida. */}
      {juicio ? (
        <p className={`mt-2 border-l-2 ${borde} bg-surface-2 px-3 py-2 text-sm text-texto`}>
          <strong>{juicio.titulo}</strong> {juicio.texto}
        </p>
      ) : null}

      <div className="mt-4">
        <p className="text-xs uppercase tracking-wide text-ter">
          Activos por mes
        </p>
        <div className="mt-2 flex h-20 items-end gap-[3px]">
          {d.activos.map((v, k) => (
            <div
              key={d.meses[k]!.mes}
              className={`flex-1 rounded-sm ${enCurso[k] ? "bg-dim" : "bg-orange"}`}
              style={{ height: `${Math.max((v / max) * 100, v > 0 ? 4 : 1)}%` }}
            />
          ))}
        </div>
        <div className="mt-1 flex gap-[3px] text-[9px] text-ter">
          {d.meses.map((m, k) => (
            <span key={m.mes} className="flex-1 text-center">
              {k % 2 === 0 ? mesCorto(m.mes).slice(0, 3) : ""}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
        <Metrica
          nombre="Pacientes nuevos"
          valor={entero(i >= 0 ? d.nuevos[i]! : 0)}
          pie={i >= 1 ? `${entero(d.nuevos[i - 1]!)} el mes anterior` : "—"}
          serie={d.nuevos}
          enCurso={enCurso}
        />
        <Metrica
          nombre="Sesiones"
          valor={entero(i >= 0 ? d.sesiones[i]! : 0)}
          pie={i >= 1 ? `${entero(d.sesiones[i - 1]!)} el mes anterior` : "—"}
          serie={d.sesiones}
          enCurso={enCurso}
        />
        <Metrica
          nombre="Ingreso del mes"
          valor={i >= 0 && d.ingreso[i]! > 0 ? usd(d.ingreso[i]!, 0) : "—"}
          pie="con IVA, al cambio del mes"
          serie={d.ingreso}
          enCurso={enCurso}
        />
        <Metrica
          nombre="Últimos 3 meses"
          valor={entero(ult3)}
          pie={
            prev3 > 0
              ? `${entero(prev3)} los 3 previos · ${porcentaje(ult3 / prev3 - 1, 0)}`
              : "sin trimestre previo"
          }
          serie={d.activos}
          enCurso={enCurso}
        />
      </div>

      <p className="mt-4 border-t border-borde pt-2 text-xs text-ter">
        Aparece en {d.mesesVivos} de los {d.meses.length} meses del rango
        {d.pico
          ? ` · máximo ${entero(d.pico.valor)} activos en ${mesCorto(d.pico.mes)}`
          : ""}
        . El rango lo decide el selector de arriba.
      </p>
    </aside>
  );
}

function Metrica({
  nombre,
  valor,
  pie,
  serie,
  enCurso,
}: {
  nombre: string;
  valor: string;
  pie: string;
  serie: number[];
  enCurso: boolean[];
}) {
  return (
    <div>
      <p className="text-[11px] text-ter">{nombre}</p>
      <p className="mt-0.5 flex items-baseline gap-2">
        <span className="text-lg text-texto">{valor}</span>
        <Chispa valores={serie} enCurso={enCurso} color="bg-teal" />
      </p>
      <p className="text-[11px] text-sec">{pie}</p>
    </div>
  );
}

/**
 * Cuánto aporta cada empresa, al final de la pestaña.
 *
 * Dos colores y nada más, a pedido del dueño del producto: lo que entra por
 * fee y lo que entra por cupón. Las alianzas y demos son cupón y entran con
 * ingreso cero. "Ganancia" es el mismo margen que General —la comisión del
 * país sobre lo cobrado—, así que una sesión deja unos US$10 en Uruguay y
 * US$6 en Argentina (lib/metrics).
 */
function Revenue({ revenue, pais }: { revenue: VistaRevenue; pais: string }) {
  if (revenue.falta) {
    return (
      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-wide text-ter">
          Revenue de empresas
        </h2>
        <p className="mt-3 text-sm text-sec">{revenue.falta}</p>
      </section>
    );
  }

  const { mes, mesPrevio, total, totalPrevio, fee, cupon } = revenue;
  const series: Serie[] = [
    {
      nombre: "Fee",
      ...COLOR_FEE,
      puntos: revenue.meses.map((m) => ({ mes: m.mes, valor: m.fee, enCurso: m.enCurso })),
    },
    {
      nombre: "Cupón",
      ...COLOR_CUPON,
      puntos: revenue.meses.map((m) => ({ mes: m.mes, valor: m.cupon, enCurso: m.enCurso })),
    },
  ];

  return (
    <section className="mt-10">
      <h2 className="text-xs uppercase tracking-wide text-ter">
        Revenue de empresas{mes ? ` · ${nombreDeMes(mes)}` : ""}
      </h2>

      <div className="mt-3 grid gap-[10px] md:grid-cols-3">
        <CardMonto
          nombre="Total Business"
          monto={total}
          pie={movimiento(total.ganancia, totalPrevio.ganancia, mesPrevio)}
          tono={tono(total.ganancia, totalPrevio.ganancia)}
        />
        <CardMonto
          nombre="Por fee"
          punto={COLOR_FEE.punto}
          monto={fee}
          pie={`${fee.empresas} ${fee.empresas === 1 ? "empresa" : "empresas"}`}
          tono="text-ter"
        />
        <CardMonto
          nombre="Por cupón"
          punto={COLOR_CUPON.punto}
          monto={cupon}
          pie={`${cupon.empresas} ${cupon.empresas === 1 ? "empresa" : "empresas"}`}
          tono="text-ter"
        />
      </div>

      <h3 className="mt-6 text-xs uppercase tracking-wide text-ter">
        Ganancia por mes
      </h3>
      <GraficoSerie
        series={series}
        tipo="barras"
        formatoId="usd"
        identidad={identidadDe(pais)}
        apiladas
        leyendaEnCurso="mes sin cerrar"
        utm={revenue.porEmpresa}
        clavesMono={false}
      />
      <p className="mt-3 text-sm text-sec">
        Ingreso es lo que pagó la empresa —su fee, o su parte de cada sesión—
        más lo que pagaron los pacientes con el cupón, con IVA. Ganancia es lo
        que se queda Tu Terapia: la comisión del país sobre ese ingreso, igual
        que en General. Pasando el mouse por un mes se ve la ganancia de cada
        empresa, en dólares. El fee cuenta en los meses en que la empresa tuvo
        alguna sesión.
      </p>

      {revenue.empresas.length > 0 && mes ? (
        <div className="mt-6">
          <h3 className="text-xs uppercase tracking-wide text-ter">
            Aporte por empresa · {nombreDeMes(mes)}
          </h3>
          <div className="mt-2 flex items-baseline justify-between gap-2 pb-1 text-[11px] text-ter">
            <span>empresa</span>
            <span className="flex gap-6">
              <span className="w-16">entró por</span>
              <span className="w-16 text-right">sesiones</span>
              <span className="w-24 text-right">ingreso</span>
              <span className="w-24 text-right">ganancia</span>
            </span>
          </div>
          {revenue.empresas.map((e) => (
            <div
              key={`${e.empresa}|${e.tipo}`}
              className="flex items-baseline justify-between gap-2 border-t border-borde py-2 text-xs"
            >
              <span className="truncate text-texto">{e.empresa}</span>
              <span className="flex gap-6 tabular-nums">
                <span className="flex w-16 items-center gap-1.5 text-sec">
                  <span
                    className={`inline-block h-2 w-2 rounded-sm ${
                      e.tipo === "fee" ? COLOR_FEE.punto : COLOR_CUPON.punto
                    }`}
                  />
                  {e.tipo === "fee" ? "fee" : "cupón"}
                </span>
                <span className="w-16 text-right text-ter">{entero(e.sesiones)}</span>
                <span className="w-24 text-right text-sec">{usd(e.ingreso)}</span>
                <span className="w-24 text-right text-texto">{usd(e.ganancia)}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function CardMonto({
  nombre,
  punto,
  monto,
  pie,
  tono,
}: {
  nombre: string;
  punto?: string;
  monto: Monto;
  pie: string;
  tono: string;
}) {
  return (
    <div className="rounded-lg border border-borde bg-surface px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs text-sec">
        {punto ? <span className={`inline-block h-2 w-2 rounded-sm ${punto}`} /> : null}
        {nombre}
      </p>
      <p className="mt-1 flex items-baseline justify-between gap-2 text-xs text-ter">
        <span>ingreso</span>
        <span className="tabular-nums text-sec">{usd(monto.ingreso)}</span>
      </p>
      <p className="mt-0.5 flex items-baseline justify-between gap-2 text-xs text-ter">
        <span>ganancia</span>
        <span className="text-xl tabular-nums text-texto">{usd(monto.ganancia)}</span>
      </p>
      <p className={`mt-0.5 truncate text-xs ${tono}`}>{pie}</p>
    </div>
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
