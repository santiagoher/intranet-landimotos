-- Reference balances stay outside the exposed schema and all operator DTOs.
alter table public.inventario_tickets add column es_prueba boolean not null default false;
create table inventario_private.referencias_producto (
 producto_id uuid primary key references public.inventario_tarea_productos(id) on delete restrict,
 cantidad numeric(20,6) not null check(cantidad>=0 and cantidad<>'NaN'::numeric),
 capturada_at timestamptz not null default now()
);
alter table inventario_private.referencias_producto enable row level security;
alter table inventario_private.referencias_producto force row level security;
revoke all on inventario_private.referencias_producto from public,anon,authenticated,service_role;

create function inventario_private.asignar_con_saldos(
 p_clave uuid,p_bodega uuid,p_categoria uuid,p_operador uuid,p_prioridad text,p_observacion text,p_productos jsonb,p_es_prueba boolean
) returns uuid language plpgsql security definer set search_path=''
as $$
declare fingerprint text; clean_products jsonb; task_id uuid;
begin
 if coalesce(inventario_private.rol_bodega(p_bodega),'') not in ('administrador','lider') then raise exception 'Solo el líder o administrador puede asignar' using errcode='42501'; end if;
 if p_clave is null or p_es_prueba is null or p_productos is null or jsonb_typeof(p_productos)<>'array' then raise exception 'Reporte inválido'; end if;
 if jsonb_array_length(p_productos) not between 1 and 2000 then raise exception 'Selecciona entre 1 y 2000 productos'; end if;
 if exists(select 1 from jsonb_array_elements(p_productos) x where jsonb_typeof(x)<>'object') then raise exception 'Producto inválido'; end if;
 if exists(select 1 from jsonb_array_elements(p_productos) x where jsonb_typeof(x->'expectedQuantity') is distinct from 'string'
  or coalesce(x->>'expectedQuantity','')!~'^[0-9]{1,14}(\.[0-9]{1,6})?$') then raise exception 'Cada producto requiere una cantidad de referencia válida; vacío no equivale a cero'; end if;
 fingerprint:=md5(jsonb_build_array(p_bodega,p_categoria,p_operador,p_prioridad,p_observacion,p_productos,p_es_prueba)::text);
 perform pg_advisory_xact_lock(hashtextextended(p_clave::text,0));
 if exists(select 1 from inventario_private.operaciones where clave=p_clave) then
  if exists(select 1 from inventario_private.operaciones where clave=p_clave and actor_id=auth.uid() and comando='asignar_con_saldos' and solicitud_hash=fingerprint) then return p_clave; end if;
  raise exception 'La solicitud ya existe con otros datos';
 end if;
 select jsonb_agg(x-'expectedQuantity' order by n) into clean_products from jsonb_array_elements(p_productos) with ordinality a(x,n);
 task_id:=inventario_private.asignar_reporte(p_clave,p_bodega,p_categoria,p_operador,p_prioridad,p_observacion,clean_products);
 insert into inventario_private.referencias_producto(producto_id,cantidad)
 select p.id,(x->>'expectedQuantity')::numeric(20,6) from jsonb_array_elements(p_productos) x
 join public.inventario_tarea_productos p on p.ticket_id=task_id and p.codigo=btrim(x->>'code');
 update public.inventario_tickets set es_prueba=p_es_prueba where id=task_id;
 update inventario_private.operaciones set comando='asignar_con_saldos',solicitud_hash=fingerprint where clave=p_clave;
 insert into public.inventario_auditoria(bodega_id,ticket_id,actor_id,actor_original_id,actor_rol,evento,entidad_tipo,entidad_id,motivo,operacion_clave)
 values(p_bodega,task_id,auth.uid(),auth.uid(),inventario_private.rol_bodega(p_bodega),'referencia_registrada','ticket',task_id,
 case when p_es_prueba then 'Inventario de prueba: datos supuestos, sin modificar existencias reales.' else 'Referencia del reporte registrada al asignar.' end,gen_random_uuid());
 return task_id;
end $$;

create function inventario_private.comparacion_tarea(p_ticket uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare warehouse_id uuid; result jsonb;
begin
 select bodega_id into warehouse_id from public.inventario_tickets where id=p_ticket;
 if coalesce(inventario_private.rol_bodega(warehouse_id),'') not in ('administrador','lider') then raise exception 'Comparación reservada al líder y administrador' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'code',p.codigo,'name',p.nombre,
  'expected',r.cantidad::text,'counted',p.cantidad_contada::text,'difference',(p.cantidad_contada-r.cantidad)::text,
  'result',case when p.cantidad_contada is null then 'pendiente' when r.producto_id is null then 'sin_referencia'
   when p.cantidad_contada=r.cantidad then 'coincide' when p.cantidad_contada<r.cantidad then 'faltante' else 'sobrante' end) order by p.codigo),'[]'::jsonb)
 into result from public.inventario_tarea_productos p left join inventario_private.referencias_producto r on r.producto_id=p.id where p.ticket_id=p_ticket;
 return result;
end $$;

create function inventario_private.resumen_conciliacion()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare result jsonb;
begin
 if not exists(select 1 from public.inventario_bodegas b where inventario_private.rol_bodega(b.id) in ('administrador','lider')) then raise exception 'Resumen reservado al líder y administrador' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('ticketId',s.id,'total',s.total,'pending',s.pending,'missingReference',s.missing_reference,
  'matched',s.matched,'shortages',s.shortages,'surpluses',s.surpluses)),'[]'::jsonb) into result from (
 select t.id,count(p.id) as total,count(p.id) filter(where p.cantidad_contada is null) as pending,
 count(p.id) filter(where r.producto_id is null) as missing_reference,
 count(p.id) filter(where p.cantidad_contada=r.cantidad) as matched,
 count(p.id) filter(where p.cantidad_contada<r.cantidad) as shortages,
 count(p.id) filter(where p.cantidad_contada>r.cantidad) as surpluses
 from public.inventario_tickets t join public.inventario_tarea_productos p on p.ticket_id=t.id
 left join inventario_private.referencias_producto r on r.producto_id=p.id
 where inventario_private.rol_bodega(t.bodega_id) in ('administrador','lider') group by t.id
 ) s;
 return result;
end $$;

-- Preserve the established workflow; a supervisor cannot label a discrepancy as matching.
create function inventario_private.validar_resultado_conteo()
returns trigger language plpgsql security definer set search_path=''
as $$
declare mismatches boolean;
begin
 if new.estado=old.estado or new.estado not in ('verificado_sin_diferencias','verificado_con_diferencias','cerrado') then return new; end if;
 if not exists(select 1 from public.inventario_tarea_productos p join inventario_private.referencias_producto r on r.producto_id=p.id where p.ticket_id=new.id) then return new; end if;
 if exists(select 1 from public.inventario_tarea_productos p left join inventario_private.referencias_producto r on r.producto_id=p.id
  where p.ticket_id=new.id and (p.cantidad_contada is null or r.producto_id is null)) then raise exception 'La comparación está incompleta'; end if;
 select exists(select 1 from public.inventario_tarea_productos p join inventario_private.referencias_producto r on r.producto_id=p.id
  where p.ticket_id=new.id and p.cantidad_contada<>r.cantidad) into mismatches;
 if mismatches and new.estado in ('verificado_sin_diferencias','cerrado') then raise exception 'Hay diferencias en el conteo. Regístralas o solicita un reconteo'; end if;
 if not mismatches and new.estado='verificado_con_diferencias' then raise exception 'Las cantidades coinciden; no hay diferencias que registrar'; end if;
 return new;
end $$;
create trigger inventario_validar_resultado before update of estado on public.inventario_tickets
for each row execute function inventario_private.validar_resultado_conteo();
revoke all on function inventario_private.validar_resultado_conteo() from public,anon,authenticated,service_role;

create function public.inventario_asignar_con_saldos(p_clave uuid,p_bodega uuid,p_categoria uuid,p_operador uuid,p_prioridad text,p_observacion text,p_productos jsonb,p_es_prueba boolean)
returns uuid language sql security invoker set search_path=''
as $$ select inventario_private.asignar_con_saldos(p_clave,p_bodega,p_categoria,p_operador,p_prioridad,p_observacion,p_productos,p_es_prueba) $$;
create function public.inventario_comparacion_tarea(p_ticket uuid)
returns jsonb language sql stable security invoker set search_path=''
as $$ select inventario_private.comparacion_tarea(p_ticket) $$;
create function public.inventario_resumen_conciliacion()
returns jsonb language sql stable security invoker set search_path=''
as $$ select inventario_private.resumen_conciliacion() $$;
revoke all on function inventario_private.asignar_con_saldos(uuid,uuid,uuid,uuid,text,text,jsonb,boolean),
 inventario_private.comparacion_tarea(uuid),inventario_private.resumen_conciliacion(),
 public.inventario_asignar_con_saldos(uuid,uuid,uuid,uuid,text,text,jsonb,boolean),
 public.inventario_comparacion_tarea(uuid),public.inventario_resumen_conciliacion() from public,anon,authenticated,service_role;
grant execute on function inventario_private.asignar_con_saldos(uuid,uuid,uuid,uuid,text,text,jsonb,boolean),
 inventario_private.comparacion_tarea(uuid),inventario_private.resumen_conciliacion(),
 public.inventario_asignar_con_saldos(uuid,uuid,uuid,uuid,text,text,jsonb,boolean),
 public.inventario_comparacion_tarea(uuid),public.inventario_resumen_conciliacion() to authenticated;
