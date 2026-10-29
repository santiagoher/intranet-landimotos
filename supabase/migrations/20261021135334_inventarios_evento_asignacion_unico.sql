-- One assignment event, enriched inside the original transaction. Historical rows are preserved.
alter table public.inventario_auditoria add column destinatario_nombre text, add column contexto text;

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
 insert into public.inventario_auditoria(bodega_id,ticket_id,actor_id,actor_original_id,actor_rol,evento,entidad_tipo,entidad_id,estado_nuevo,motivo,operacion_clave,destinatario_nombre)
 values(p_bodega,task_id,auth.uid(),auth.uid(),role_name,'asignado','ticket',task_id,'asignado',p_observacion,p_clave,(select nombre from public.perfiles where id=p_operador));
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
 update public.inventario_auditoria set contexto=
 case when p_es_prueba then 'Inventario de prueba: datos supuestos, sin modificar existencias reales.' else 'Referencia del reporte registrada al asignar.' end
 where ticket_id=task_id and evento='asignado' and operacion_clave=p_clave and actor_id=auth.uid();
 return task_id;
end $$;
