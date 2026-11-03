import { GraficoSerie, type Serie } from "@/components/grafico-serie";
import { GraficoDiario } from "@/components/grafico-diario";
import { PanelSesiones } from "@/components/panel-sesiones";
import { identidadDe } from "@/components/identidad";
import { RELLENO_SEGMENTO, FONDO_SEGMENTO } from "@/lib/sesiones-ui";
import { DIAS_DE_PRESENCIAL_UI, type VistaPresencial } from "@/lib/presencial";

/**
 * Cuántos pacientes entran presencial, por mes y por día.
 *
 * Va entre el diario de pacientes nuevos y el de sesiones vendidas: arriba
 * queda junto todo lo que son personas, y abajo empalma con las sesiones, que
 * usan exactamente estos colores para las mismas cuatro bandas.
 *
 * Pedido el 2026-11-03, cuando subió el precio presencial de Argentina de
 * 46.000 a 60.000. El mensual contesta si el nivel se mueve; el diario, si se
 * está moviendo ahora, que con un mes recién empezado es la única pregunta
 * que tiene respuesta.
 *
 * **Presencial es lo único que dibuja el mensual.** El online está en el
 * diario, abajo, porque ahí la pregunta es la mezcla del día; arriba la
 * pregunta es el nivel de una serie sola, y apilarle el online encima la
 * movería por razones ajenas —en 2026 el online de Argentina se triplicó—.
 * La parte presencial del total la dice la frase, que para eso está.
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

  const series: Serie[] = vista.porPais.map((p) => ({
    nombre: p.pais,
    puntos: vista.meses.map((m, i) => ({
      mes: m,
      valor: p.valores[i] ?? null,
      enCurso: vista.enCurso[i] ?? false,
    })),
    trazo: COLOR[p.pais]?.trazo ?? "stroke-orange",
    relleno: COLOR[p.pais]?.relleno ?? "fill-orange",
  }));

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
        />
        {vista.lectura === null ? null : (
          <p className="mt-3 text-sm text-sec">{vista.lectura}</p>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-wide text-ter">
          Pacientes nuevos por país y modalidad · {DIAS_DE_PRESENCIAL_UI} días
        </h2>
        <div className="mt-1 flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="flex-1">
            <GraficoDiario
              datos={vista.desglose}
              rate={false}
              titulo="Pacientes nuevos por modalidad"
              clavesMono={false}
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
