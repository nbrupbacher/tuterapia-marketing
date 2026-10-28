-- Los pacientes del exterior, por mes, plataforma y país de origen.
--
-- Exterior = **pago en dólares**. Lo definió el dueño del producto el
-- 2026-10-28 y es lo único que la base puede contestar: PayPal cobra en USD y
-- no hay ninguna columna que nombre la pasarela —`pacientes_pagos.tipo` vale 1
-- en todos los pagos confirmados (METRICAS.md §9), `mercadopago` está vacía
-- salvo en 86 filas de 2020, y el catálogo del esquema no tiene ninguna otra
-- tabla de pagos—. Los que pagan desde afuera con IP uruguaya cuentan como
-- exterior igual: "a veces pagan desde el exterior y dice uruguay".
--
-- Dos dimensiones y no una, que es lo que pedía la pestaña:
--
--   · `pais` es la PLATAFORMA, `login.paisDominio`, el dominio por el que la
--     persona entró. Es la misma dimensión que usa el resto del tablero y una
--     cuenta tiene exactamente una.
--   · `origen` es el PAÍS DEL PACIENTE, `pacientes.pais`, en código ISO de dos
--     letras. Sale del perfil y no de la IP del pago porque es el único que
--     sirve para las dos series: la IP solo existe cuando hay un pago, y los
--     activos se cuentan por sesiones. Un paciente saltaría de país entre
--     meses si se midiera por IP.
--
-- Se guardan TODOS los orígenes, sin recortar. El gráfico muestra los cinco
-- más grandes y agrupa el resto, pero ese recorte se hace al leer: guardarlo
-- recortado perdería el detalle para siempre y ataría la tabla a la ventana
-- con la que se calculó el recorte.
--
-- Chile queda afuera, como en todo el resto del tablero: son 14 pacientes en
-- trece meses y ninguno desde febrero de 2026.
create table if not exists marketing.exterior_mensual (
  mes     date not null,
  pais    text not null check (pais in ('AR', 'UY')),
  origen  text not null,
  /** Primer pago confirmado en U$S dentro del mes. */
  nuevos  int  not null default 0,
  /** Sesión realizada en el mes, de alguien que alguna vez pagó en U$S. */
  activos int  not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (mes, pais, origen)
);

alter table marketing.exterior_mensual enable row level security;

comment on column marketing.exterior_mensual.pais is
  'Plataforma por la que entró (login.paisDominio), no dónde está la persona.';
comment on column marketing.exterior_mensual.origen is
  'País del perfil (pacientes.pais), ISO2. Estado de hoy, no un dato del mes.';

-- Con qué utm se registró el que después pagó en dólares.
--
-- Tabla aparte y no una columna más de la de arriba: el utm es del registro y
-- el origen es del perfil, así que cruzarlos multiplicaría las filas y haría
-- que `activos` no se pueda sumar sin contar a alguien dos veces.
--
-- Solo `nuevos`: la pregunta es de dónde vino el que compró, y un activo de
-- octubre pudo haberse registrado hace dos años con un utm que ya no existe.
create table if not exists marketing.exterior_utm (
  mes        date not null,
  pais       text not null check (pais in ('AR', 'UY')),
  /** Crudo, como viene de login.utm_source. Vacío = se registró sin utm. */
  utm_source text not null,
  nuevos     int  not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (mes, pais, utm_source)
);

alter table marketing.exterior_utm enable row level security;
