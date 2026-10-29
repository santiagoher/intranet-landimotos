-- DRAFT: requires explicit production approval. Execute atomically.
-- Preserve authors, states, counts, audit and idempotency fingerprints.
BEGIN;
LOCK TABLE public.inventario_tickets IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.inventario_tickets DROP CONSTRAINT inventario_tickets_prioridad_check;
UPDATE public.inventario_tickets SET prioridad=CASE prioridad WHEN 'urgente' THEN 'alta' WHEN 'normal' THEN 'media' ELSE prioridad END WHERE prioridad IN ('urgente','normal');
ALTER TABLE public.inventario_tickets ALTER COLUMN prioridad SET DEFAULT 'media';
ALTER TABLE public.inventario_tickets ADD CONSTRAINT inventario_tickets_prioridad_check CHECK (prioridad IN ('alta','media','baja'));
-- 'normal' remains an input alias for the currently deployed client; never persisted.
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
 if p_prioridad not in ('baja','media','alta','normal') or length(coalesce(p_observacion,''))>2000 then raise exception 'Datos inválidos'; end if;
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
 values(p_clave,'OP-'||lpad(nextval('inventario_private.numero_operativo')::text,8,'0'),p_bodega,p_categoria,'categoria',p_operador,auth.uid(),leader_id,'asignado',case when p_prioridad='normal' then 'media' else p_prioridad end,now(),p_vencimiento,p_observacion)
 returning id into task_id;
 insert into inventario_private.operaciones(bodega_id,actor_id,clave,comando,solicitud_hash,entidad_resultado_id)
 values(p_bodega,auth.uid(),p_clave,'asignar_categoria',request_hash,task_id);
 insert into public.inventario_auditoria(bodega_id,ticket_id,actor_id,actor_original_id,actor_rol,evento,entidad_tipo,entidad_id,estado_nuevo,motivo,operacion_clave,destinatario_nombre)
 values(p_bodega,task_id,auth.uid(),auth.uid(),role_name,'asignado','ticket',task_id,'asignado',p_observacion,p_clave,(select nombre from public.perfiles where id=p_operador));
 return task_id;
end $$;


COMMIT;
