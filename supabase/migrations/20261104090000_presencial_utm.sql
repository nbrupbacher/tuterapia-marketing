-- El utm del paciente nuevo presencial, para el tooltip del gráfico diario.
--
-- Pedido por el dueño del producto el 2026-11-04: pasando el mouse por una
-- barra quiere ver de dónde vinieron esos pacientes, igual que en el gráfico
-- diario de General.
--
-- El utm es del REGISTRO (`login.utm_source`) y la modalidad es del PAGO. Son
-- dos momentos distintos del mismo paciente, así que cruzarlos no cuenta a
-- nadie dos veces: cada paciente nuevo tiene exactamente un primer pago y
-- exactamente un utm. Es el mismo criterio que usa `exterior_diario`, que
-- lleva el país del perfil y el utm en la misma fila por la misma razón.
--
-- Solo el diario. El mensual tiene su panel de composición al costado, que ya
-- contesta de qué está hecho el mes; el diario no tiene panel y el tooltip es
-- su única forma de contestarlo.
alter table marketing.presencial_diario
  add column if not exists utm_source text not null default '';

comment on column marketing.presencial_diario.utm_source is
  'Crudo, como viene de login.utm_source. Vacío = se registró sin utm.';

-- La clave crece con la dimensión nueva. Las filas viejas quedan con
-- utm_source = '' hasta la próxima corrida, que reescribe la tabla entera.
alter table marketing.presencial_diario
  drop constraint if exists presencial_diario_pkey;

alter table marketing.presencial_diario
  add primary key (fecha, pais, modalidad, utm_source);
