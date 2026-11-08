import { GraficoSerie, type Serie } from "@/components/grafico-serie";
import { GraficoDiario } from "@/components/grafico-diario";
import { PanelSesiones } from "@/components/panel-sesiones";
import { SIN_AGRUPAR } from "@/components/composicion";
import { identidadDe, PALETA_LARGA } from "@/components/identidad";
import { RELLENO_SEGMENTO, FONDO_SEGMENTO } from "@/lib/sesiones-ui";
import { DIAS_DE_PRESENCIAL_UI, type VistaPresencial } from "@/lib/presencial";

/**
 * Cuántos pacientes entran presencial, por mes y por día.
 *
 * Va entre el diario de pacientes nuevos y el de sesiones vendidas: arriba
 * queda junto todo lo que son personas, y abajo empalma con las sesiones,
 * que parten las mismas modalidades con estos mismos colores.
 *
 * Pedido el 2026-11-03, cuando subió el precio presencial de Argentina de
 * 46.000 a 60.000. El mensual contesta si el nivel se mueve; el diario, si se
 * está moviendo ahora, que con un mes recién empezado es la única pregunta
 * que tiene respuesta.
 *
 * **Los dos dibujan solo presencial.** El online no se apila ni arriba ni
 * abajo: arriba movería la serie por razones ajenas —en 2026 el online de
 * Argentina se triplicó— y abajo, con 45 barras en media pantalla, dejaba al
 * presencial como una lámina de dos píxeles tapada por la banda de Argentina
 * online. Y el gráfico decía 39 mientras el panel pegado a su derecha decía
 * 11. Qué parte de los nuevos entró presencial lo dice la frase.
 */

/** El color de cada país, el mismo que su banda presencial de abajo. */
const COLOR: Record<string, { trazo: string; relleno: string }> = {
  UY: { trazo: "stroke-ses-uy-pre", relleno: "fill-ses-uy-pre" },
  AR: { trazo: "stroke-ses-ar-pre", relleno: "fill-ses-ar-pre" },
};

export function SeccionPresencial({
  vista,
  pais,
  mes,
}: {
  vista: VistaPresencial;
  pais: string;
  mes: string;
}) {
  if (vista.meses.length === 0) {
    return (
      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-wide text-ter">
          Pacientes nuevos presenciales
        </h2>
        <p className="mt-3 text-sm text-sec">
          Todavía no hay nada sincronizado. El job las escribe junto con el
          funnel.
        </p>
      </section>
    );
  }

  // En TOTAL las franjas son los dos países y llevan el color que esos
  // mismos países tienen abajo, en el apilado diario. Con un país elegido
  // son sus provincias y ahí no hay color propio que respetar: va la paleta
  // larga, la misma que usa Exterior para sus países.
  const series: Serie[] = vista.series.map((p, i) => {
    const color = vista.porProvincia
      ? PALETA_LARGA[i % PALETA_LARGA.length]!
      : (COLOR[p.nombre] ?? PALETA_LARGA[i % PALETA_LARGA.length]!);
    return {
      nombre: p.nombre,
      puntos: vista.meses.map((m, k) => ({
        mes: m,
        valor: p.valores[k] ?? null,
        enCurso: vista.enCurso[k] ?? false,
      })),
      trazo: color.trazo,
      relleno: color.relleno,
    };
  });

  const colores = vista.claves.map((clave) => ({
    relleno: RELLENO_SEGMENTO[clave] ?? "fill-ses-nd",
    fondo: FONDO_SEGMENTO[clave] ?? "bg-ses-nd",
  }));

  return (
    <>
      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-wide text-ter">
          Pacientes nuevos presenciales · {vista.meses.length} meses
        </h2>
        <GraficoSerie
          series={series}
          tipo="barras"
          formatoId="entero"
          identidad={identidadDe(pais)}
          apiladas={series.length > 1}
          /* Sin agrupar la cola: el dueño del producto ya pidió eso para
             Exterior —"prefiero que los muestres que decir resto"— y acá
             la cola son provincias de uno o dos pacientes, que es
             justamente lo que se vino a mirar. */
          recortePanel={vista.porProvincia ? SIN_AGRUPAR : undefined}
        />
        {vista.lectura === null ? null : (
          <p className="mt-3 text-sm text-sec">{vista.lectura}</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-wide text-ter">
          Pacientes nuevos presenciales
          {pais === "TOTAL" ? " por país" : ""} · {DIAS_DE_PRESENCIAL_UI} días
        </h2>
        <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex-1">
            {/* `clavesMono` queda en su default: el tooltip lista utm_source
                crudos, que son códigos escritos a mano y se leen mejor en
                monoespaciada, igual que en el diario de arriba. */}
            <GraficoDiario
              datos={vista.desglose}
              rate={false}
              titulo="Pacientes nuevos presenciales"
              colores={colores}
            />
          </div>
          <PanelSesiones
            vista={vista.panel}
            mes={mes}
            leyenda="nuevos presenciales"
            corto="presenciales"
          />
        </div>
      </section>
    </>
  );
}
