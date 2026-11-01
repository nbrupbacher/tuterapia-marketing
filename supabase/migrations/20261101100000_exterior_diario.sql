-- El grano diario del Exterior, para el gráfico entre las dos mensuales.
--
-- Tabla aparte, por lo mismo que `business_diario`: acá solo vive lo que se
-- puede contar en un día. Los activos no, porque "sesión en el mes de alguien
-- que alguna vez pagó en dólares" no tiene versión diaria que signifique algo.
--
-- Lleva las DOS dimensiones en la misma fila —el país del perfil y el utm con
-- el que se registró— porque el tooltip muestra las dos juntas: de dónde es y
-- de dónde vino. En la mensual están separadas en dos tablas porque `activos`
-- no se puede cruzar con utm sin contar a alguien dos veces; acá no hay
-- activos, así que el cruce es seguro.
--
-- Ventana corta, 45 días, la misma que Movimientos y que Business.
create table if not exists marketing.exterior_diario (
  fecha          date not null,
  pais           text not null check (pais in ('AR', 'UY')),
  /** País del perfil (pacientes.pais), ISO2, o '??' si no tiene. */
  origen         text not null,
  /** Crudo, como viene de login.utm_source. Vacío = se registró sin utm. */
  utm_source     text not null,
  nuevos         int  not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (fecha, pais, origen, utm_source)
);

create index if not exists exterior_diario_fecha_idx
  on marketing.exterior_diario (fecha desc);

alter table marketing.exterior_diario enable row level security;
