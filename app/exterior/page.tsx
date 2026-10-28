import { Nav, Selectores, contexto } from "@/components/nav";
import { GraficoSerie, type Serie } from "@/components/grafico-serie";
import { identidadDe } from "@/components/identidad";
import {
  leerExterior,
  PAISES_NOMBRADOS,
  type SerieExterior,
  type VistaExterior,
} from "@/lib/exterior";
import { entero, porcentaje, mesCorto } from "@/lib/ui/format";

export const dynamic = "force-dynamic";

/**
 * Exterior: los pacientes que pagan en dólares.
 *
 * Dos dimensiones, y cuál se dibuja la decide el selector de país de arriba,
 * que es el mismo de todas las pestañas:
 *
 *   TOTAL   → las barras se parten por PLATAFORMA (login.paisDominio)
 *   AR o UY → las barras se parten por el PAÍS DEL PACIENTE (pacientes.pais)
 *
 * Es el patrón de General dado vuelta. Allá el TOTAL apila por país y un país
 * elegido apila por plataforma de ads; acá la plataforma es el afuera y el
 * país es el adentro, que es lo que esta pestaña vino a contestar.
 */

/**
 * Los colores del apilado, escritos literales.
 *
 * Tailwind escanea el fuente y una clase armada en tiempo de ejecución nunca
 * llega a la hoja de estilos — por eso `fill-orange-lt` no existe aunque el
 * token sí, y por eso esta lista no se construye con un template.
 *
 * Son seis porque el apilado tiene como mucho seis franjas: cinco países con
 * nombre y el resto agrupado.
 */
const PALETA = [
  { relleno: "fill-orange", trazo: "stroke-orange" },
  { relleno: "fill-teal", trazo: "stroke-teal" },
  { relleno: "fill-gold", trazo: "stroke-gold" },
  { relleno: "fill-orange-dk", trazo: "stroke-orange-dk" },
  { relleno: "fill-coral", trazo: "stroke-coral" },
  { relleno: "fill-dim", trazo: "stroke-dim" },
];

/** En TOTAL cada plataforma lleva su color de identidad, como en General. */
const COLOR_PLATAFORMA: Record<string, number> = { AR: 1, UY: 2 };

function aSeries(series: SerieExterior[], esTotal: boolean): Serie[] {
  return series.map((s, i) => {
    const color = PALETA[esTotal ? (COLOR_PLATAFORMA[s.nombre] ?? i) : i] ?? PALETA[5]!;
    return {
      nombre: s.nombre,
      trazo: color.trazo,
      relleno: color.relleno,
      puntos: s.puntos,
    };
  });
}

export default async function Exterior({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const ctx = await contexto(params);
  const vista = await leerExterior(ctx.pais, ctx.rango);
  const esTotal = ctx.pais === "TOTAL";

  return (
    <>
      <Nav activa="/exterior" ctx={ctx} />
      <Selectores activa="/exterior" ctx={ctx} conRango />

      <main className="contenedor pb-10 pt-6">
        {vista.vacia ? (
          <p className="text-sm text-sec">
            No hay datos del exterior sincronizados. Los escribe
            /api/cron/funnel; corrélo y volvé.
          </p>
        ) : (
          <>
            <p className="border-l-2 border-gold bg-warn-bg px-3 py-2 text-sm text-texto">
              Exterior son los pacientes que <strong>pagan en dólares</strong>,
              que es como cobra PayPal — los que pagan desde afuera con IP
              uruguaya cuentan igual.{" "}
              {esTotal ? (
                <>
                  Las barras se parten por <strong>plataforma</strong>; eligiendo
                  AR o UY se parten por el <strong>país del paciente</strong>.
                </>
              ) : (
                <>
                  Dentro de la plataforma {ctx.pais}, las barras se parten por el{" "}
                  <strong>país que el paciente tiene en el perfil</strong>.
                </>
              )}
            </p>

            <Tarjetas vista={vista} pais={ctx.pais} />

            <Bloque
              titulo={`Pacientes nuevos del exterior · ${
                esTotal ? "por plataforma" : `plataforma ${ctx.pais}, por país`
              }`}
              series={aSeries(vista.nuevos, esTotal)}
              pais={ctx.pais}
              pie="Nuevo es el que hizo su primera compra en el mes, y es del exterior porque esa compra fue en dólares."
            />

            <Bloque
              titulo={`Pacientes activos del exterior · ${
                esTotal ? "por plataforma" : `plataforma ${ctx.pais}, por país`
              }`}
              series={aSeries(vista.activos, esTotal)}
              pais={ctx.pais}
              pie="Activo es el que hizo una sesión en el mes, de alguien que alguna vez pagó en dólares — un activo de octubre puede haber comprado hace dos años."
            />

            {esTotal ? null : (
              <p className="mt-2 text-xs text-ter">
                Se nombran los {PAISES_NOMBRADOS} países más grandes del rango y
                el resto va junto. La cola son unos veinte países con uno o dos
                pacientes cada uno.
              </p>
            )}

            <Utm vista={vista} />
          </>
        )}
      </main>
    </>
  );
}

function Tarjetas({ vista, pais }: { vista: VistaExterior; pais: string }) {
  const { resumen, parte } = vista;
  const sufijo = pais === "TOTAL" ? "" : ` · ${pais}`;

  return (
    <div className="mt-4 grid gap-[10px] md:grid-cols-3">
      <Card
        nombre={`Nuevos del exterior${sufijo}`}
        valor={entero(resumen.nuevos)}
        pie={movimiento(resumen.nuevos, resumen.nuevosPrevio, resumen.mesPrevio)}
        tono={tono(resumen.nuevos, resumen.nuevosPrevio)}
      />
      <Card
        nombre={`Activos del exterior${sufijo}`}
        valor={entero(resumen.activos)}
        pie={movimiento(
          resumen.activos,
          resumen.activosPrevio,
          resumen.mesPrevio,
        )}
        tono={tono(resumen.activos, resumen.activosPrevio)}
      />
      {/* Siempre sobre el total del negocio, nunca sobre la plataforma
          elegida: la pregunta es cuánto pesa el exterior, y con AR elegido un
          porcentaje sobre AR diría otra cosa con el mismo nombre. */}
      <Card
        nombre="Parte de los pacientes nuevos"
        valor={parte.total > 0 ? porcentaje(parte.exterior / parte.total) : "—"}
        pie={
          parte.mes === null
            ? "sin mes cerrado todavía"
            : `${entero(parte.exterior)} de ${entero(parte.total)} en ${mesCorto(parte.mes)}`
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
}: {
  titulo: string;
  series: Serie[];
  pais: string;
  pie: string;
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
      />
      <p className="mt-3 text-sm text-sec">{pie}</p>
    </section>
  );
}

/**
 * De dónde vinieron: el utm con el que se registró el que después pagó en
 * dólares.
 *
 * Las dos plataformas siempre, sin importar el selector, porque la diferencia
 * entre una y otra ES el hallazgo: con una sola columna no se ve.
 */
function Utm({ vista }: { vista: VistaExterior }) {
  const filas = vista.utm;
  if (filas.length === 0) return null;

  const sinUtm = filas.find((f) => f.fuente === "Sin utm");
  const paises = filas[0]!.porPais.map((p) => p.pais);
  const totalPorPais = paises.map((p) => ({
    pais: p,
    n: filas.reduce(
      (a, f) => a + (f.porPais.find((x) => x.pais === p)?.pacientes ?? 0),
      0,
    ),
  }));

  return (
    <section className="mt-8">
      <h2 className="text-xs uppercase tracking-wide text-ter">
        De dónde vinieron · utm con el que se registraron
      </h2>

      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2 pb-1 text-[11px] text-ter">
            <span>fuente</span>
            <span className="flex gap-6">
              {paises.map((p) => (
                <span key={p} className="w-20 text-right">
                  {p}
                </span>
              ))}
            </span>
          </div>

          {filas.map((f) => (
            <div key={f.fuente} className="border-t border-borde py-2">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={`inline-block h-2 w-2 shrink-0 rounded-sm ${
                      f.fuente === "Sin utm" ? "bg-dim" : "bg-orange"
                    }`}
                  />
                  <span className="truncate text-texto">{f.fuente}</span>
                </span>
                <span className="flex gap-6 tabular-nums">
                  {f.porPais.map((p) => (
                    <span key={p.pais} className="w-20 text-right text-sec">
                      {p.pacientes === 0 ? "—" : entero(p.pacientes)}
                      {p.pacientes === 0 ? null : (
                        <span className="ml-1.5 text-ter">
                          {porcentaje(p.parte, 0)}
                        </span>
                      )}
                    </span>
                  ))}
                </span>
              </div>
              <div className="mt-1.5 flex justify-end gap-6">
                {f.porPais.map((p) => (
                  <Barra
                    key={p.pais}
                    parte={p.parte}
                    apagada={f.fuente === "Sin utm"}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <aside className="rounded-lg border border-borde bg-surface px-4 py-3 lg:w-[420px] lg:shrink-0">
          <p className="text-xs uppercase tracking-wide text-ter">
            La respuesta corta
          </p>
          <p className="mt-0.5 text-xl text-texto">Casi todo llega sin marcar</p>
          <p className="mt-2 text-sm text-sec">
            {sinUtm
              ? sinUtm.porPais
                  .map(
                    (p) =>
                      `${p.pais}: ${porcentaje(p.parte, 0)} sin utm (${entero(
                        p.pacientes,
                      )} de ${entero(
                        totalPorPais.find((t) => t.pais === p.pais)?.n ?? 0,
                      )})`,
                  )
                  .join(" · ")
              : "Todos los registros del exterior traen utm."}
          </p>
          <p className="mt-2 text-sm text-sec">
            Ninguna campaña apunta al exterior, así que lo poco que viene
            marcado es derrame de campañas de AR y UY. Mientras siga así, este
            bloque no puede decir de dónde vienen; lo que sí dice es que{" "}
            <strong className="text-texto">no se los está yendo a buscar</strong>.
          </p>
        </aside>
      </div>
    </section>
  );
}

function Barra({ parte, apagada }: { parte: number; apagada: boolean }) {
  return (
    <div className="h-1.5 w-20 rounded-sm bg-surface-2">
      <div
        className={`h-1.5 rounded-sm ${apagada ? "bg-dim" : "bg-orange"}`}
        style={{
          width: `${Math.min(100, Math.max(parte > 0 ? 4 : 0, parte * 100))}%`,
        }}
      />
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

/**
 * El movimiento entre los dos últimos meses CERRADOS, con los dos nombrados.
 *
 * Nunca contra el mes en curso: medio octubre contra todo septiembre dice que
 * el mes se derrumbó, y eso solo es cierto del calendario.
 */
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
