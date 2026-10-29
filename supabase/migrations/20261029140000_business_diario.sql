-- El grano diario de Business, para el gráfico de abajo de la mensual.
--
-- Tabla aparte de `business_mensual` y no una clave más fina, por la misma
-- razón que `metricas_diarias` está separada de `metricas_mensuales`: acá solo
-- vive lo que se puede contar en un día. Los activos no: "sesión en el mes de
-- alguien que ya tenía cupón al cierre del mes" no tiene versión diaria que
-- signifique algo.
--
-- Ventana corta, 45 días, la misma que Movimientos en General.
create table if not exists marketing.business_diario (
  fecha          date not null,
  pais           text not null check (pais in ('AR', 'UY')),
  -- Igual que en la mensual: TODAS trae el total del día ya deduplicado.
  empresa        text not null,
  nuevos         int  not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (fecha, pais, empresa)
);

create index if not exists business_diario_fecha_idx
  on marketing.business_diario (fecha desc);

alter table marketing.business_diario enable row level security;
