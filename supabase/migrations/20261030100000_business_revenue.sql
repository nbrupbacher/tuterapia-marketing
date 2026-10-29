-- Business: cuánto entra y cuánto queda de cada empresa, por mes.
--
-- Una fila por (mes, plataforma, empresa, tipo). `tipo` separa las dos formas
-- de pagar: 'fee' es el fijo mensual de la empresa, 'cupon' todo lo que entra
-- por sesión con un cupón de empresa (la parte de la empresa, si la hay, y lo
-- que pagó el paciente). Una empresa puede tener las dos: Nodum tiene fee y un
-- cupón especial.
--
-- Lo escribe /api/cron/funnel con la misma ventana de trece meses que
-- business_mensual. Los planes y los fees viven en lib/planes-business.ts.
create table if not exists marketing.business_revenue (
  mes            date    not null,
  pais           text    not null check (pais in ('AR', 'UY')),
  -- El nombre de la EMPRESA, nunca el del cupón (ver business_mensual).
  empresa        text    not null,
  tipo           text    not null check (tipo in ('fee', 'cupon')),
  sesiones       int     not null default 0,
  ingreso_usd    numeric not null default 0,
  ganancia_usd   numeric not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (mes, pais, empresa, tipo)
);

alter table marketing.business_revenue enable row level security;

comment on column marketing.business_revenue.ingreso_usd is
  'Lo que pagó la empresa (plan o fee) más lo que pagaron los pacientes, con IVA, en USD al tipo de cambio del mes.';
comment on column marketing.business_revenue.ganancia_usd is
  'ingreso_usd × pct_comision del país: lo que se queda Tu Terapia, el mismo margen que General.';
