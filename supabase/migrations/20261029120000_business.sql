-- La pestaña Business: pacientes que llegan con el cupón de una empresa.
--
-- Una fila por (mes, plataforma, empresa), más una fila con empresa = 'TODAS'
-- que trae el total DEDUPLICADO del mes.
--
-- Esa fila no es la suma de las otras y tiene que estar: un paciente puede
-- haber usado cupones de dos empresas, y entonces aparece en las dos filas.
-- Sumar las empresas lo contaría dos veces. El tablero muestra el total de la
-- fila 'TODAS' y el desglose de las otras, nunca uno derivado del otro
-- (METRICAS.md §8).
create table if not exists marketing.business_mensual (
  mes            date not null,
  pais           text not null check (pais in ('AR', 'UY')),
  -- El nombre de la EMPRESA, nunca el del cupón: varias emiten uno por
  -- empleado y le ponen el nombre de esa persona, que es un paciente en
  -- tratamiento. La traducción pasa dentro de MySQL (lib/empresas.ts).
  empresa        text not null,
  nuevos         int  not null default 0,
  activos        int  not null default 0,
  actualizado_en timestamptz not null default now(),
  primary key (mes, pais, empresa)
);

alter table marketing.business_mensual enable row level security;

comment on column marketing.business_mensual.pais is
  'Plataforma por la que entró (login.paisDominio), no dónde está la persona.';
comment on column marketing.business_mensual.empresa is
  'Nombre de la empresa (lib/empresas.ts). TODAS = total del mes sin duplicar.';
comment on column marketing.business_mensual.activos is
  'Sesión en el mes, de quien ya tenía cupón de esa empresa AL CIERRE del mes.';
