-- PROCEDIMIENTO MANUAL. No ejecutar terminacion sin aprobacion expresa.
-- Paso 1: solo lectura. Volver a consultar justo antes de intervenir.
select clock_timestamp() as observado_at, pid, usename, datname,
       application_name, backend_start, state, xact_start, query_start,
       wait_event_type, wait_event, md5(query) as query_md5, query
from pg_stat_activity
where pid in (6078,5374)
order by pid;

-- Paso 2: SOLO tras aprobar, aplicar la migracion critica, pausar nuevos
-- guardados y correlacionar logs 40001 recientes con el PID y consulta exactos.
-- Completar UN objetivo con la lectura reciente. NULL impide ejecutar por error.
-- No reutilizar una huella historica. Si desaparecio/cambio, no intervenir.
do $manual$
declare
  aprobacion_confirmada boolean := false;
  objetivo integer := null;
  inicio_verificado timestamptz := null;
  consulta_md5_verificada text := null;
  actual record;
begin
  if not aprobacion_confirmada or objetivo is null or inicio_verificado is null or consulta_md5_verificada is null then
    raise exception 'Procedimiento bloqueado: requiere aprobacion y verificacion reciente de un unico proceso';
  end if;
  if objetivo not in (6078,5374) then raise exception 'PID fuera del alcance revisado'; end if;
  select * into actual from pg_stat_activity where pid=objetivo;
  if not found then raise exception 'El proceso ya no existe'; end if;
  if actual.backend_start is distinct from inicio_verificado
     or actual.datname is distinct from current_database()
     or actual.usename is distinct from 'authenticator'
     or actual.application_name is distinct from 'postgrest'
     or actual.backend_type is distinct from 'client backend'
     or actual.state not in ('active','idle in transaction (aborted)')
     or md5(actual.query) is distinct from consulta_md5_verificada
     or position('inventario_contar_producto' in actual.query)=0 then
    raise exception 'La identidad, consulta o estado cambio. No se termina ninguna conexion';
  end if;
  if not pg_terminate_backend(objetivo) then raise exception 'PostgreSQL no confirmo la terminacion'; end if;
  raise notice 'Senal de terminacion enviada a %. Verificar desaparicion y logs.',objetivo;
end $manual$;

-- Paso 3: volver a ejecutar SOLO la consulta inicial y revisar nuevos errores.
-- Una terminacion aborta trabajo no confirmado de esa conexion, no borra
-- transacciones confirmadas, usuarios, inventarios, fotos ni otras sesiones.
