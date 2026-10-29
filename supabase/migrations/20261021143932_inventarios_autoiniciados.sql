-- REVIEW REQUIRED. No production execution without approval.
-- Depends on 20261021140335_inventarios_prioridades_tres_niveles.sql.
BEGIN;
alter table public.inventario_usuarios_bodegas add column puede_autoiniciar boolean not null default true;
alter table public.inventario_tickets
 add column origen_creacion text check(origen_creacion in ('creado_por_operador')),
 add column creado_por uuid references public.perfiles(id) on delete set null;
create index inventario_ticket_creador on public.inventario_tickets(creado_por);
alter table public.inventario_tarea_productos
 add column codigos_barras text[] not null default '{}',
 add column unidad text;
-- Category tickets do not have an ERP session. Preserve the original session FK.
alter table public.inventario_notificaciones alter column sesion_id drop not null;
alter table public.inventario_notificaciones add constraint inventario_notificacion_ticket_bodega
 foreign key(ticket_id,bodega_id) references public.inventario_tickets(id,bodega_id);

create function inventario_private.puede_autoiniciar(p_bodega uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(inventario_private.rol_bodega(p_bodega)='operador',false) and exists(
 select 1 from public.inventario_usuarios_bodegas where bodega_id=p_bodega and perfil_id=auth.uid()
 and activo and rol='operador' and puede_autoiniciar)
$$;

-- Whitelisted metadata only. No balance, reference or reconciliation joins.
create function inventario_private.catalogo_ciego(p_bodega uuid,p_categoria uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not inventario_private.puede_autoiniciar(p_bodega) then raise exception 'No tienes permiso para iniciar en esta bodega' using errcode='42501'; end if;
 if not exists(select 1 from public.inventario_categorias where id=p_categoria and bodega_id=p_bodega and activa) then raise exception 'Categoría no autorizada'; end if;
 if (select count(*) from public.inventario_productos where bodega_id=p_bodega and categoria_id=p_categoria and activo)>2000 then raise exception 'La categoría supera 2000 referencias; solicita al líder un alcance parcial'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'code',p.sku_erp,'name',p.nombre,'unit',p.unidad_base_erp,
 'barcodes',coalesce((select jsonb_agg(c.codigo_erp order by c.codigo_erp) from public.inventario_codigos_barras c where c.producto_id=p.id and c.activo),'[]'::jsonb)) order by p.sku_erp),'[]'::jsonb)
 from public.inventario_productos p where p.bodega_id=p_bodega and p.categoria_id=p_categoria and p.activo);
end $$;

-- Serialize every new category assignment against self-starts, including the leader RPCs.
-- Full-category self-starts reserve their category through verification and recount.
create function inventario_private.evitar_autoinicio_duplicado()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.estado not in ('cerrado','cancelado') then
  perform pg_advisory_xact_lock(hashtextextended('inventario-alcance:'||new.bodega_id::text,0));
  if exists(select 1 from public.inventario_tickets t where t.id<>new.id and t.bodega_id=new.bodega_id
   and (t.categoria_id=new.categoria_id or t.modo='sku' or new.modo='sku')
   and t.estado not in ('cerrado','cancelado') and (new.origen_creacion='creado_por_operador' or t.origen_creacion='creado_por_operador')) then
   raise exception 'Ya existe un inventario activo para esta categoría. Solicita al líder revisar el ticket o autorizar un reconteo dentro de ese proceso';
  end if;
 end if;
 return new;
end $$;
create trigger inventario_evitar_autoinicio_duplicado before insert on public.inventario_tickets
 for each row execute function inventario_private.evitar_autoinicio_duplicado();

create function inventario_private.autoiniciar(p_clave uuid,p_bodega uuid,p_categoria uuid,p_observacion text,p_ids uuid[])
returns uuid language plpgsql security definer set search_path='' as $$
declare leader_id uuid; fingerprint text; products jsonb; actual_ids uuid[];
begin
 if not inventario_private.puede_autoiniciar(p_bodega) then raise exception 'No tienes permiso para iniciar en esta bodega' using errcode='42501'; end if;
 if p_clave is null or p_categoria is null or length(coalesce(p_observacion,''))>2000 or coalesce(cardinality(p_ids),0) not between 1 and 2000 then raise exception 'Revisa el alcance y la observación'; end if;
 fingerprint:=md5(jsonb_build_array(p_bodega,p_categoria,p_observacion,(select array_agg(x order by x) from unnest(p_ids) x))::text);
 perform pg_advisory_xact_lock(hashtextextended(p_clave::text,0));
 if exists(select 1 from inventario_private.operaciones where clave=p_clave) then
  if exists(select 1 from inventario_private.operaciones where clave=p_clave and actor_id=auth.uid() and comando='autoiniciar' and solicitud_hash=fingerprint) then return p_clave; end if;
  raise exception 'La solicitud ya existe con otros datos';
 end if;
 products:=inventario_private.catalogo_ciego(p_bodega,p_categoria);
 select array_agg((x->>'id')::uuid order by (x->>'id')::uuid) into actual_ids from jsonb_array_elements(products) x;
 if actual_ids is null or actual_ids is distinct from (select array_agg(x order by x) from unnest(p_ids) x) then raise exception 'El catálogo cambió o no está disponible. Vuelve a seleccionar la categoría'; end if;
 select m.perfil_id into leader_id from public.inventario_usuarios_bodegas m join public.perfiles p on p.id=m.perfil_id
 where m.bodega_id=p_bodega and m.activo and m.rol='lider' and m.es_responsable and p.estado='activo'
 and (p.rol='Admin' or 'inventarios'=any(coalesce(p.modulos_permitidos,'{}'::text[])));
 if leader_id is null or leader_id=auth.uid() then raise exception 'La bodega necesita un líder responsable activo'; end if;
 insert into public.inventario_tickets(id,numero,bodega_id,categoria_id,modo,asignado_a,asignado_por,creado_por,lider_id,origen_creacion,estado,prioridad,asignado_at,aceptado_at,iniciado_at,observacion_inicial,total_productos)
 values(p_clave,'OP-'||lpad(nextval('inventario_private.numero_operativo')::text,8,'0'),p_bodega,p_categoria,'categoria',auth.uid(),null,auth.uid(),leader_id,'creado_por_operador','en_proceso','media',now(),now(),now(),p_observacion,jsonb_array_length(products));
 insert into public.inventario_tarea_productos(ticket_id,codigo,nombre,unidad,codigos_barras)
 select p_clave,x->>'code',x->>'name',x->>'unit',array(select jsonb_array_elements_text(x->'barcodes')) from jsonb_array_elements(products) x;
 insert into inventario_private.operaciones(bodega_id,actor_id,clave,comando,solicitud_hash,entidad_resultado_id)
 values(p_bodega,auth.uid(),p_clave,'autoiniciar',fingerprint,p_clave);
 insert into public.inventario_auditoria(bodega_id,ticket_id,actor_id,actor_original_id,actor_rol,evento,entidad_tipo,entidad_id,estado_nuevo,motivo,operacion_clave,contexto)
 values(p_bodega,p_clave,auth.uid(),auth.uid(),'operador','autoiniciado','ticket',p_clave,'en_proceso',p_observacion,p_clave,'Conteo físico propio; pendiente de referencia y conciliación G21.');
 return p_clave;
end $$;

create function inventario_private.notificar_autoinventario()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.origen_creacion='creado_por_operador' and new.lider_id is not null then
  if TG_OP='INSERT' then
   insert into public.inventario_notificaciones(destinatario_id,bodega_id,ticket_id,tipo,evento_clave) values(new.lider_id,new.bodega_id,new.id,'iniciado',gen_random_uuid());
  elsif new.estado='enviado_verificacion' and old.estado is distinct from new.estado then
   insert into public.inventario_notificaciones(destinatario_id,bodega_id,ticket_id,tipo,evento_clave) values(new.lider_id,new.bodega_id,new.id,'verificacion_pendiente',gen_random_uuid());
  end if;
 end if;
 return new;
end $$;
create trigger inventario_notificar_autoinventario after insert or update of estado on public.inventario_tickets
 for each row execute function inventario_private.notificar_autoinventario();

-- Until a confirmed ERP snapshot + movement reconciliation is integrated, no
-- self-start can be declared verified or closed merely because counting ended.
create function inventario_private.proteger_autoinventario_sin_conciliar()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.origen_creacion='creado_por_operador' and new.estado is distinct from old.estado
 and new.estado in ('verificado_sin_diferencias','verificado_con_diferencias','cerrado','pendiente_aprobacion') then
  raise exception 'Pendiente de referencia y conciliación G21. Puedes revisar el conteo o solicitar reconteo; no aprobar ni cerrar aún';
 end if;
 return new;
end $$;
create trigger inventario_proteger_autoinventario before update of estado on public.inventario_tickets
 for each row execute function inventario_private.proteger_autoinventario_sin_conciliar();

create function public.inventario_catalogo_ciego(p_bodega uuid,p_categoria uuid) returns jsonb language sql security invoker set search_path=''
as $$ select inventario_private.catalogo_ciego(p_bodega,p_categoria) $$;
create function public.inventario_autoiniciar(p_clave uuid,p_bodega uuid,p_categoria uuid,p_observacion text,p_ids uuid[]) returns uuid language sql security invoker set search_path=''
as $$ select inventario_private.autoiniciar(p_clave,p_bodega,p_categoria,p_observacion,p_ids) $$;
-- Feature detection and extra ticket metadata use scoped tables. No historical rewrite.
create function public.inventario_autoinicio_contexto() returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('enabled',true,'warehouses',coalesce((select jsonb_agg(bodega_id) from public.inventario_usuarios_bodegas where perfil_id=auth.uid() and inventario_private.puede_autoiniciar(bodega_id)),'[]'::jsonb),
 'tickets',coalesce((select jsonb_agg(jsonb_build_object('id',id,'origen_creacion',origen_creacion,'creado_por',creado_por)) from public.inventario_tickets where origen_creacion is not null),'[]'::jsonb))
$$;
create or replace function public.inventario_productos_tarea(p_ticket uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',codigo,'name',nombre,'quantity',cantidad_contada::text,'countedAt',contado_at,'barcodes',codigos_barras,'unit',unidad) order by codigo),'[]'::jsonb)
 from public.inventario_tarea_productos where ticket_id=p_ticket
$$;
revoke all on function inventario_private.puede_autoiniciar(uuid),inventario_private.catalogo_ciego(uuid,uuid),inventario_private.autoiniciar(uuid,uuid,uuid,text,uuid[]),inventario_private.evitar_autoinicio_duplicado(),inventario_private.notificar_autoinventario(),inventario_private.proteger_autoinventario_sin_conciliar(),public.inventario_catalogo_ciego(uuid,uuid),public.inventario_autoiniciar(uuid,uuid,uuid,text,uuid[]),public.inventario_autoinicio_contexto() from public,anon,authenticated,service_role;
grant execute on function inventario_private.puede_autoiniciar(uuid),inventario_private.catalogo_ciego(uuid,uuid),inventario_private.autoiniciar(uuid,uuid,uuid,text,uuid[]),public.inventario_catalogo_ciego(uuid,uuid),public.inventario_autoiniciar(uuid,uuid,uuid,text,uuid[]),public.inventario_autoinicio_contexto() to authenticated;
COMMIT;
