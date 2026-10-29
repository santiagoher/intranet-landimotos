-- Leaders operate; administration retains all existing scoped reads only.
-- Existing tasks, memberships, counts and reference balances are not reassigned or changed.
alter table public.inventario_tickets
 add column cierre_con_diferencias boolean not null default false,
 add column justificacion_cierre text,
 add constraint inventario_cierre_justificado check (
  (not cierre_con_diferencias and justificacion_cierre is null) or
  (cierre_con_diferencias and estado='cerrado' and justificacion_cierre is not null and length(btrim(justificacion_cierre)) between 1 and 2000)
 );

-- Membership provisioning is not an operational action for the three application roles.
-- Preserve existing relationships; block the former admin mutation entry points.
revoke execute on function public.inventario_miembro(uuid,uuid,text,boolean),
 inventario_private.guardar_miembro(uuid,uuid,text,boolean) from authenticated;


create or replace function inventario_private.asignar_categoria(
 p_clave uuid, p_bodega uuid, p_categoria uuid, p_operador uuid,
 p_prioridad text, p_vencimiento timestamptz, p_observacion text
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare task_id uuid; role_name text; leader_id uuid; existing public.inventario_tickets; request_hash text;
begin
 if p_vencimiento is not null then raise exception 'La fecha objetivo no se utiliza; la asignacion usa la hora del servidor'; end if;
 role_name:=inventario_private.rol_bodega(p_bodega);
 if role_name is null or role_name<>'lider' then raise exception 'No puedes asignar en esta bodega' using errcode='42501'; end if;
 if p_clave is null or p_categoria is null or p_operador is null or p_prioridad is null then raise exception 'Faltan datos obligatorios'; end if;
 if p_prioridad not in ('baja','normal','alta','urgente') or length(coalesce(p_observacion,''))>2000 then raise exception 'Datos inválidos'; end if;
 request_hash:=md5(jsonb_build_array(p_bodega,p_categoria,p_operador,p_prioridad,p_vencimiento,p_observacion)::text);
 perform pg_advisory_xact_lock(hashtextextended(p_clave::text,0));
 select * into existing from public.inventario_tickets where id=p_clave;
 if found then
  if exists(select 1 from inventario_private.operaciones where clave=p_clave and actor_id=auth.uid() and solicitud_hash=request_hash) then return existing.id; end if;
  raise exception 'La solicitud ya existe con otros datos'; end if;
 if not exists(select 1 from public.inventario_categorias c where c.id=p_categoria and c.bodega_id=p_bodega and c.activa) then raise exception 'Categoría no válida para la bodega'; end if;
 if not exists(select 1 from public.inventario_usuarios_bodegas m join public.perfiles p on p.id=m.perfil_id
  where m.perfil_id=p_operador and m.bodega_id=p_bodega and m.rol='operador' and m.activo and p.estado='activo'
  and (p.rol='Admin' or 'inventarios'=any(coalesce(p.modulos_permitidos,'{}'::text[])))) then raise exception 'El operador no pertenece a esta bodega'; end if;
 select perfil_id into leader_id from public.inventario_usuarios_bodegas where bodega_id=p_bodega and activo and es_responsable;
 insert into public.inventario_tickets(id,numero,bodega_id,categoria_id,modo,asignado_a,asignado_por,lider_id,estado,prioridad,asignado_at,vencimiento_at,observacion_inicial)
 values(p_clave,'OP-'||lpad(nextval('inventario_private.numero_operativo')::text,8,'0'),p_bodega,p_categoria,'categoria',p_operador,auth.uid(),leader_id,'asignado',p_prioridad,now(),p_vencimiento,p_observacion)
 returning id into task_id;
 insert into inventario_private.operaciones(bodega_id,actor_id,clave,comando,solicitud_hash,entidad_resultado_id)
 values(p_bodega,auth.uid(),p_clave,'asignar_categoria',request_hash,task_id);
 insert into public.inventario_auditoria(bodega_id,ticket_id,actor_id,actor_original_id,actor_rol,evento,entidad_tipo,entidad_id,estado_nuevo,motivo,operacion_clave)
 values(p_bodega,task_id,auth.uid(),auth.uid(),role_name,'asignado','ticket',task_id,'asignado',p_observacion,p_clave);
 return task_id;
end $$;

create or replace function inventario_private.asignar_reporte(
 p_clave uuid,p_bodega uuid,p_categoria uuid,p_operador uuid,p_prioridad text,p_observacion text,p_productos jsonb
) returns uuid language plpgsql security definer set search_path=''
as $$
declare task_id uuid; fingerprint text;
begin
 if coalesce(inventario_private.rol_bodega(p_bodega),'') <>'lider' then raise exception 'No puedes asignar en esta bodega' using errcode='42501'; end if;
 if p_clave is null or p_productos is null or jsonb_typeof(p_productos)<>'array' then raise exception 'Reporte inválido'; end if;
 if jsonb_array_length(p_productos) not between 1 and 2000 then raise exception 'Selecciona entre 1 y 2000 productos'; end if;
 if exists(select 1 from jsonb_array_elements(p_productos) x where jsonb_typeof(x)<>'object') then raise exception 'Producto inválido'; end if;
 if exists(select 1 from jsonb_array_elements(p_productos) x where
  length(btrim(coalesce(x->>'code',''))) not between 1 and 300 or length(btrim(coalesce(x->>'name',''))) not between 1 and 300
  or jsonb_typeof(x->'code')<>'string' or jsonb_typeof(x->'name')<>'string'
  or exists(select 1 from jsonb_each(x) entry where entry.key not in ('code','name','family','group','subgroup','brand')
    or jsonb_typeof(entry.value)<>'string' or length(entry.value#>>'{}')>300)
 ) then raise exception 'El reporte solo admite código, nombre, familia, grupo, subgrupo y marca'; end if;
 if (select count(distinct btrim(x->>'code')) from jsonb_array_elements(p_productos) x)<>jsonb_array_length(p_productos) then raise exception 'Hay códigos duplicados'; end if;
 fingerprint:=md5(jsonb_build_array(p_bodega,p_categoria,p_operador,p_prioridad,p_observacion,p_productos)::text);
 perform pg_advisory_xact_lock(hashtextextended(p_clave::text,0));
 if exists(select 1 from inventario_private.operaciones where clave=p_clave) then
  if exists(select 1 from inventario_private.operaciones where clave=p_clave and actor_id=auth.uid() and comando='asignar_reporte' and solicitud_hash=fingerprint) then return p_clave; end if;
  raise exception 'La solicitud ya existe con otros datos';
 end if;
 task_id:=inventario_private.asignar_categoria(p_clave,p_bodega,p_categoria,p_operador,p_prioridad,null,p_observacion);
 insert into public.inventario_tarea_productos(ticket_id,codigo,nombre,familia,grupo,subgrupo,marca)
 select task_id,btrim(x->>'code'),btrim(x->>'name'),coalesce(x->>'family',''),coalesce(x->>'group',''),coalesce(x->>'subgroup',''),coalesce(x->>'brand','')
 from jsonb_array_elements(p_productos) x;
 update public.inventario_tickets set total_productos=jsonb_array_length(p_productos) where id=task_id;
 update inventario_private.operaciones set comando='asignar_reporte',solicitud_hash=fingerprint where clave=p_clave;
 return task_id;
end $$;

create or replace function inventario_private.asignar_con_saldos(
 p_clave uuid,p_bodega uuid,p_categoria uuid,p_operador uuid,p_prioridad text,p_observacion text,p_productos jsonb,p_es_prueba boolean
) returns uuid language plpgsql security definer set search_path=''
as $$
declare fingerprint text; clean_products jsonb; task_id uuid;
begin
 if coalesce(inventario_private.rol_bodega(p_bodega),'') <>'lider' then raise exception 'Solo el líder puede asignar' using errcode='42501'; end if;
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

create or replace function inventario_private.actualizar_tarea(p_ticket uuid,p_version integer,p_accion text,p_avance integer,p_nota text)
returns void language plpgsql security definer set search_path = ''
as $$
declare t public.inventario_tickets; role_name text; next_state text;
begin
 select * into t from public.inventario_tickets where id=p_ticket for update;
 role_name:=inventario_private.rol_bodega(t.bodega_id);
 if t.id is null or role_name is null or not inventario_private.puede_leer_ticket(t.id) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if role_name='administrador' then raise exception 'Administración solo tiene acceso de consulta y seguimiento' using errcode='42501'; end if;
 if t.modo<>'categoria' then raise exception 'Conteo SKU pendiente de integración'; end if;
 if p_version is null or t.version<>p_version then raise exception 'La tarea cambió. Actualiza antes de continuar' using errcode='40001'; end if;
 if p_accion is null or length(coalesce(p_nota,''))>2000 then raise exception 'Datos inválidos'; end if;
 if t.total_productos>0 and p_accion='avance' then raise exception 'El avance se calcula con los productos contados'; end if;
 if t.total_productos>0 and p_accion='finalizar' and t.productos_contados<>t.total_productos then raise exception 'Debes contar todos los productos antes de finalizar'; end if;
 next_state:=t.estado;
 if p_accion in ('iniciar','avance','finalizar') then
  if t.asignado_a is distinct from auth.uid() or role_name<>'operador' then raise exception 'Solo el operador asignado puede registrar el trabajo' using errcode='42501'; end if;
  if p_accion='iniciar' and t.estado='asignado' then next_state:='en_proceso';
  elsif p_accion='avance' and t.estado='en_proceso' and p_avance between 26 and 69 and p_avance>=t.avance_parcial and length(btrim(coalesce(p_nota,'')))>0 then
   update public.inventario_tickets set avance_parcial=p_avance where id=t.id;
  elsif p_accion='finalizar' and t.estado='en_proceso' then next_state:='enviado_verificacion';
  else raise exception 'Transición o avance no válido'; end if;
 else
  if role_name<>'lider' or t.asignado_a=auth.uid() then raise exception 'Se requiere un supervisor distinto del operador' using errcode='42501'; end if;
  if p_accion='revisar' and t.estado='enviado_verificacion' then next_state:='en_verificacion';
  elsif p_accion='verificar' and t.estado='en_verificacion' and length(btrim(coalesce(p_nota,'')))>0 then next_state:='verificado_sin_diferencias';
  elsif p_accion='diferencias' and t.estado='en_verificacion' and length(btrim(coalesce(p_nota,'')))>0 then next_state:='verificado_con_diferencias';
  elsif p_accion='cerrar' and t.estado='verificado_sin_diferencias' then next_state:='cerrado';
  elsif p_accion='cerrar_diferencias' and t.estado='verificado_con_diferencias' and length(btrim(coalesce(p_nota,'')))>0 then next_state:='cerrado';
  elsif p_accion='devolver' and t.estado in ('en_verificacion','verificado_con_diferencias') and length(btrim(coalesce(p_nota,'')))>0 then
   next_state:='en_proceso';
   update public.inventario_tarea_productos set cantidad_contada=null,contado_por=null,contado_at=null where ticket_id=t.id;
   update public.inventario_tickets set productos_contados=0 where id=t.id;
   update public.inventario_tickets set avance_parcial=25,enviado_at=null,verificacion_iniciada_at=null,verificacion_finalizada_at=null where id=t.id;
  else raise exception 'Transición no válida o falta observación'; end if;
 end if;
 update public.inventario_tickets set estado=next_state,version=version+1,
 aceptado_at=case when p_accion='iniciar' then now() else aceptado_at end,
 iniciado_at=case when p_accion='iniciar' then now() else iniciado_at end,
 enviado_at=case when p_accion='finalizar' then now() else enviado_at end,
 verificacion_iniciada_at=case when p_accion='revisar' then now() else verificacion_iniciada_at end,
 recibido_at=case when p_accion='revisar' then now() else recibido_at end,
 verificacion_finalizada_at=case when p_accion in ('verificar','diferencias') then now() else verificacion_finalizada_at end,
 cierre_con_diferencias=case when p_accion='cerrar_diferencias' then true else cierre_con_diferencias end,
 justificacion_cierre=case when p_accion='cerrar_diferencias' then btrim(p_nota) else justificacion_cierre end,
 cerrado_at=case when p_accion in ('cerrar','cerrar_diferencias') then now() else cerrado_at end where id=t.id;
 insert into public.inventario_auditoria(bodega_id,ticket_id,actor_id,actor_original_id,actor_rol,evento,entidad_tipo,entidad_id,estado_anterior,estado_nuevo,motivo,operacion_clave)
 values(t.bodega_id,t.id,auth.uid(),auth.uid(),role_name,p_accion,'ticket',t.id,t.estado,next_state,
 case when p_accion='avance' then p_avance::text||'% — '||p_nota else p_nota end,gen_random_uuid());
end $$;

create or replace function inventario_private.validar_resultado_conteo()
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
 if mismatches and (new.estado='verificado_sin_diferencias' or (new.estado='cerrado' and not (new.cierre_con_diferencias and old.estado='verificado_con_diferencias' and coalesce(inventario_private.rol_bodega(new.bodega_id),'')='lider' and length(btrim(coalesce(new.justificacion_cierre,'')))>0))) then raise exception 'Hay diferencias en el conteo. Regístralas o solicita un reconteo'; end if;
 if not mismatches and new.estado='verificado_con_diferencias' then raise exception 'Las cantidades coinciden; no hay diferencias que registrar'; end if;
 return new;
end $$;
