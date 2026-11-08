-- La provincia del paciente en la tabla mensual de modalidad.
--
-- Pedido por el dueño del producto el 2026-11-08: ver los presenciales
-- nuevos partidos por ciudad, CABA / Mendoza / Córdoba, y no solo por país.
--
-- Sale de `zonas_pacientes`, que ata al paciente con un departamento y una
-- zona adentro. Lo que el paciente carga es una lista de preferencias y no un
-- domicilio —el 57% de los presenciales argentinos tiene más de una zona—,
-- pero medido el 2026-11-08 esas zonas de más caen siempre en el MISMO
-- departamento, así que al nivel de provincia cada persona se cuenta una vez.
-- El nombre crudo lo limpia `lib/zonas.ts`, porque el catálogo está escrito a
-- mano y tiene a CABA tres veces.
--
-- **Solo el mensual.** Argentina hace un presencial por día: una barra diaria
-- partida por ciudad es, casi todos los días, una persona identificable en una
-- pantalla compartida. El diario sigue partido por país.
--
-- `zonas_pacientes` no tiene fecha, así que la provincia es un estado de hoy y
-- no un hecho del mes, igual que `eligieron_terapeuta` (§6 quinquies). Si un
-- paciente cambia su zona, los meses viejos se reescriben solos en la próxima
-- corrida.
alter table marketing.presencial_mensual
  add column if not exists provincia text not null default 'sin zona';

comment on column marketing.presencial_mensual.provincia is
  'Provincia o departamento del paciente, ya canonizada por lib/zonas.ts. "sin zona" cuando no cargó ninguna. Estado de hoy: la tabla de origen no tiene fecha.';

-- La clave crece con la dimensión nueva. Las filas viejas quedan en
-- 'sin zona' hasta la próxima corrida, que reescribe la tabla entera.
alter table marketing.presencial_mensual
  drop constraint if exists presencial_mensual_pkey;

alter table marketing.presencial_mensual
  add primary key (mes, pais, modalidad, provincia);
