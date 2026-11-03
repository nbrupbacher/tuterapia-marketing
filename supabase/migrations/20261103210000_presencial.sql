-- Cuántos pacientes nuevos entran por cada modalidad, al mes y al día.
--
-- Pedido por el dueño del producto el 2026-11-03: subió el precio presencial
-- de Argentina de 46.000 a 60.000 el 1º de noviembre y quiere ver si eso
-- mueve la cantidad de gente que elige presencial.
--
-- **Nuevo, no comprador.** La modalidad sale del PRIMER pago confirmado del
-- paciente, que es el mismo hecho que todo el tablero llama conversión. Así
-- la suma de las modalidades de un mes da exactamente `pacientes_nuevos` de
-- `metricas_mensuales` —verificado contra septiembre (877) y octubre (760)—,
-- que es la propiedad que hace que las dos pantallas no se contradigan.
--
-- La otra lectura posible, "cualquiera que compró presencial en el mes", da
-- cuatro veces más (527 contra 136 en octubre) y no cierra contra ningún otro
-- número de General. Se descartó a propósito el 2026-11-03.
--
-- `tipo_session` es nullable en MySQL, así que hay una tercera modalidad de
-- hecho, `sin_dato`. Hoy no hay ninguna en catorce meses, pero el camino se
-- deja abierto: el día que aparezca una, ese paciente tiene que contarse y no
-- desaparecer del total.
create table if not exists marketing.presencial_mensual (
  mes            date not null,
  pais           text not null check (pais in ('AR', 'UY')),
  /** 'online' | 'presencial' | 'sin_dato', la del primer pago confirmado. */
  modalidad      text not null,
  nuevos         int  not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (mes, pais, modalidad)
);

comment on table marketing.presencial_mensual is
  'Pacientes nuevos por mes, país y modalidad del primer pago confirmado. La suma de las modalidades de un mes es pacientes_nuevos de metricas_mensuales.';

-- El grano diario, para ver si se mueve ahora y no dentro de un mes.
--
-- Ventana larga a propósito: el gráfico dibuja 45 días, pero el panel del mes
-- proyecta a fin de mes con el peso de cada día de la semana, y ese patrón
-- necesita ocho semanas completas. Son los mismos 120 días que guarda
-- `sesiones_vendidas`, que alimenta al panel gemelo.
create table if not exists marketing.presencial_diario (
  fecha          date not null,
  pais           text not null check (pais in ('AR', 'UY')),
  modalidad      text not null,
  nuevos         int  not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (fecha, pais, modalidad)
);

comment on table marketing.presencial_diario is
  'Pacientes nuevos por día, país y modalidad del primer pago confirmado. Ventana de 120 días: el gráfico muestra 45 y la proyección necesita ocho semanas completas.';

create index if not exists presencial_diario_fecha_idx
  on marketing.presencial_diario (fecha desc);

alter table marketing.presencial_mensual enable row level security;
alter table marketing.presencial_diario enable row level security;
