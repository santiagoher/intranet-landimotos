-- Shared-project DEMO explicitly authorized by owner on 2026-10-22.
-- Targets the deployed schema WITHOUT the older draft priority/self-start migrations.
-- Preserves legacy priorities, existing tickets, users, RLS and PT409 routines.
begin;
set local lock_timeout='2s';
set local statement_timeout='20s';

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

-- Serialize every new category assignment against self-starts, including the leader RPCs.
-- Full-category self-starts reserve their category through verification and recount.
create function inventario_private.evitar_autoinicio_duplicado()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.estado not in ('cerrado','cancelado') then
  perform pg_advisory_xact_lock(hashtextextended('inventario-alcance:'||new.bodega_id::text,0));
  if exists(select 1 from public.inventario_tickets t where t.id<>new.id and t.bodega_id=new.bodega_id
   and (t.categoria_id=new.categoria_id or t.modo='sku' or new.modo='sku')
   and t.es_prueba=new.es_prueba and t.estado not in ('cerrado','cancelado') and (new.origen_creacion='creado_por_operador' or t.origen_creacion='creado_por_operador')) then
   raise exception 'Ya existe un inventario activo para esta categoría. Solicita al líder revisar el ticket o autorizar un reconteo dentro de ese proceso';
  end if;
 end if;
 return new;
end $$;
create trigger inventario_evitar_autoinicio_duplicado before insert on public.inventario_tickets
 for each row execute function inventario_private.evitar_autoinicio_duplicado();

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

create or replace function public.inventario_productos_tarea(p_ticket uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',codigo,'name',nombre,'quantity',cantidad_contada::text,'countedAt',contado_at,'barcodes',codigos_barras,'unit',unidad) order by codigo),'[]'::jsonb)
 from public.inventario_tarea_productos where ticket_id=p_ticket
$$;
revoke all on function inventario_private.puede_autoiniciar(uuid),inventario_private.evitar_autoinicio_duplicado(),inventario_private.notificar_autoinventario(),inventario_private.proteger_autoinventario_sin_conciliar() from public,anon,authenticated,service_role;
grant execute on function inventario_private.puede_autoiniciar(uuid) to authenticated;

create table inventario_private.demo_bodegas(bodega_id uuid primary key references public.inventario_bodegas(id),enabled boolean not null default true);
alter table inventario_private.demo_bodegas enable row level security;
alter table inventario_private.demo_bodegas force row level security;
revoke all on inventario_private.demo_bodegas from public,anon,authenticated,service_role;
create table inventario_private.demo_entorno(singleton boolean primary key default true check(singleton),host text not null,enabled boolean not null default true);
insert into inventario_private.demo_entorno(host,enabled) values('loajbvlgpsxrkfzyxbui.supabase.co',false);
create table inventario_private.demo_productos(
 id uuid primary key default gen_random_uuid(),bodega_id uuid not null,categoria_id uuid not null,
 codigo text not null,nombre text not null,unidad text not null,codigos text[] not null,
 referencia_simulada numeric(20,6) not null check(referencia_simulada>=0),
 unique(bodega_id,codigo), foreign key(categoria_id,bodega_id) references public.inventario_categorias(id,bodega_id));
create table inventario_private.demo_tickets(ticket_id uuid primary key references public.inventario_tickets(id),fuente text not null default 'demo-v1' check(fuente='demo-v1'));
alter table inventario_private.demo_entorno enable row level security;
alter table inventario_private.demo_entorno force row level security;
alter table inventario_private.demo_productos enable row level security;
alter table inventario_private.demo_productos force row level security;
alter table inventario_private.demo_tickets enable row level security;
alter table inventario_private.demo_tickets force row level security;
revoke all on inventario_private.demo_entorno,inventario_private.demo_productos,inventario_private.demo_tickets from public,anon,authenticated,service_role;

-- Explicit source: do not masquerade as an Excel import or official G21 catalogue.
alter table public.inventario_categorias drop constraint inventario_categorias_origen_check;
alter table public.inventario_categorias add constraint inventario_categorias_origen_check check(origen in ('excel','g21','demo'));
alter table public.inventario_categorias drop constraint inventario_categoria_origen;
alter table public.inventario_categorias add constraint inventario_categoria_origen check(
 (origen='g21' and id_erp is not null and codigo_erp is not null and sincronizada_at is not null)
 or (origen in ('excel','demo') and referencia_local is not null and id_erp is null and codigo_erp is null and sincronizada_at is null));

create function inventario_private.demo_activo() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select enabled from inventario_private.demo_entorno where singleton),false)
$$;

-- Owner-only seed for an explicitly selected test warehouse. No profiles or balances in public ERP tables.
create function inventario_private.demo_sembrar(p_bodega uuid) returns void language plpgsql security definer set search_path='' as $$
declare category_id uuid; item record; n integer:=0; sku text;
begin
 -- Owner-only preparation can seed while creation remains disabled.
 insert into inventario_private.demo_bodegas(bodega_id) values(p_bodega) on conflict do nothing;
 if not exists(select 1 from public.inventario_bodegas where id=p_bodega and activa and origen<>'g21') then raise exception 'Bodega de pruebas no válida'; end if;
 for item in select * from (values
 ('Guayas','Guaya de acelerador DEMO','Guaya de embrague DEMO','UN'),
 ('Cadenas','Cadena de transmisión 428 DEMO','Cadena de transmisión 520 DEMO','UN'),
 ('Lubricantes','Aceite de motor 1 L DEMO','Lubricante de cadena 400 ml DEMO','UN'),
 ('Arranque','Motor de arranque DEMO','Relé de arranque DEMO','UN'),
 ('Sistema de frenos','Pastillas delanteras DEMO','Banda de freno trasero DEMO','PAR')) as fixtures(categoria,primero,segundo,unidad)
 loop
  n:=n+1;
  insert into public.inventario_categorias(bodega_id,nombre,origen,referencia_local)
  values(p_bodega,'DEMO / '||item.categoria,'demo','DEMO-V1-'||n) on conflict(bodega_id,referencia_local) do nothing;
  select id into category_id from public.inventario_categorias where bodega_id=p_bodega and referencia_local='DEMO-V1-'||n and origen='demo';
  if category_id is null then raise exception 'Conflicto con una categoría no DEMO'; end if;
  for i in 1..2 loop
   sku:='DEMO-'||lpad(n::text,2,'0')||'-'||lpad(i::text,3,'0');
   insert into inventario_private.demo_productos(bodega_id,categoria_id,codigo,nombre,unidad,codigos,referencia_simulada)
   values(p_bodega,category_id,sku,case when i=1 then item.primero else item.segundo end,item.unidad,array['DEMO-BAR-'||n||'-'||i],case when i=1 then 10 else 0 end)
   on conflict(bodega_id,codigo) do nothing;
  end loop;
 end loop;
end $$;

create function inventario_private.demo_catalogo(p_bodega uuid,p_categoria uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not inventario_private.demo_activo() then raise exception 'DEMO deshabilitado' using errcode='42501'; end if;
 if (not inventario_private.puede_autoiniciar(p_bodega) or not exists(select 1 from inventario_private.demo_bodegas where bodega_id=p_bodega and enabled)) then raise exception 'No tienes permiso para iniciar en esta bodega' using errcode='42501'; end if;
 if not exists(select 1 from public.inventario_categorias where id=p_categoria and bodega_id=p_bodega and activa and origen='demo') then raise exception 'Categoría DEMO no autorizada' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',codigo,'name',nombre,'unit',unidad,'barcodes',codigos) order by codigo),'[]'::jsonb)
 from inventario_private.demo_productos where bodega_id=p_bodega and categoria_id=p_categoria);
end $$;

create function inventario_private.demo_contexto() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión' using errcode='42501'; end if;
 return jsonb_build_object('enabled',inventario_private.demo_activo(),'host',(select host from inventario_private.demo_entorno),
 'warehouses',coalesce((select jsonb_agg(b.id) from public.inventario_bodegas b where inventario_private.puede_autoiniciar(b.id) and exists(select 1 from inventario_private.demo_bodegas d where d.bodega_id=b.id and d.enabled)),'[]'::jsonb),
 'categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'bodega_id',c.bodega_id,'nombre',c.nombre)) from public.inventario_categorias c where c.activa and c.origen='demo' and inventario_private.puede_autoiniciar(c.bodega_id) and exists(select 1 from inventario_private.demo_bodegas d where d.bodega_id=c.bodega_id and d.enabled)),'[]'::jsonb),
 'tickets',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'origen_creacion',t.origen_creacion,'creado_por',t.creado_por)) from public.inventario_tickets t where t.origen_creacion is not null and inventario_private.puede_leer_ticket(t.id)),'[]'::jsonb));
end $$;

create function inventario_private.demo_autoiniciar(p_clave uuid,p_bodega uuid,p_categoria uuid,p_observacion text,p_ids uuid[]) returns uuid language plpgsql security definer set search_path='' as $$
declare leader_id uuid; fingerprint text; products jsonb; actual_ids uuid[];
begin
 if not inventario_private.demo_activo() or (not inventario_private.puede_autoiniciar(p_bodega) or not exists(select 1 from inventario_private.demo_bodegas where bodega_id=p_bodega and enabled)) then raise exception 'No tienes permiso para iniciar DEMO en esta bodega' using errcode='42501'; end if;
 if p_clave is null or p_categoria is null or length(coalesce(p_observacion,''))>2000 or coalesce(cardinality(p_ids),0) not between 1 and 2000 then raise exception 'Revisa el alcance y la observación'; end if;
 fingerprint:=md5(jsonb_build_array('demo-v1',p_bodega,p_categoria,coalesce(p_observacion,''),(select array_agg(x order by x) from unnest(p_ids) x))::text);
 perform pg_advisory_xact_lock(hashtextextended(p_clave::text,0));
 if exists(select 1 from inventario_private.operaciones where clave=p_clave) then
  if exists(select 1 from inventario_private.operaciones where clave=p_clave and actor_id=auth.uid() and comando='demo_autoiniciar' and solicitud_hash=fingerprint) then return p_clave; end if;
  raise exception 'La solicitud ya existe con otros datos';
 end if;
 products:=inventario_private.demo_catalogo(p_bodega,p_categoria);
 select array_agg((x->>'id')::uuid order by (x->>'id')::uuid) into actual_ids from jsonb_array_elements(products) x;
 if actual_ids is null or actual_ids is distinct from (select array_agg(x order by x) from unnest(p_ids) x) then raise exception 'El catálogo cambió. Vuelve a seleccionar la categoría'; end if;
 select m.perfil_id into leader_id from public.inventario_usuarios_bodegas m join public.perfiles p on p.id=m.perfil_id
 where m.bodega_id=p_bodega and m.activo and m.rol='lider' and m.es_responsable and p.estado='activo'
 and (p.rol='Admin' or 'inventarios'=any(coalesce(p.modulos_permitidos,'{}'::text[])));
 if leader_id is null or leader_id=auth.uid() then raise exception 'La bodega necesita un líder responsable activo'; end if;
 insert into public.inventario_tickets(id,numero,bodega_id,categoria_id,modo,asignado_a,asignado_por,creado_por,lider_id,origen_creacion,estado,prioridad,asignado_at,aceptado_at,iniciado_at,observacion_inicial,total_productos,es_prueba)
 values(p_clave,'OP-'||lpad(nextval('inventario_private.numero_operativo')::text,8,'0'),p_bodega,p_categoria,'categoria',auth.uid(),null,auth.uid(),leader_id,'creado_por_operador','en_proceso','normal',now(),now(),now(),coalesce(p_observacion,''),jsonb_array_length(products),true);
 insert into inventario_private.demo_tickets(ticket_id) values(p_clave);
 insert into public.inventario_tarea_productos(ticket_id,codigo,nombre,unidad,codigos_barras)
 select p_clave,x->>'code',x->>'name',x->>'unit',array(select jsonb_array_elements_text(x->'barcodes')) from jsonb_array_elements(products) x;
 -- Fictional comparison ONLY, private and never sent to the operator. No real stock or adjustments.
 insert into inventario_private.referencias_producto(producto_id,cantidad)
 select t.id,d.referencia_simulada from public.inventario_tarea_productos t join inventario_private.demo_productos d on d.bodega_id=p_bodega and d.categoria_id=p_categoria and d.codigo=t.codigo where t.ticket_id=p_clave;
 insert into inventario_private.operaciones(bodega_id,actor_id,clave,comando,solicitud_hash,entidad_resultado_id)
 values(p_bodega,auth.uid(),p_clave,'demo_autoiniciar',fingerprint,p_clave);
 insert into public.inventario_auditoria(bodega_id,ticket_id,actor_id,actor_original_id,actor_rol,evento,entidad_tipo,entidad_id,estado_nuevo,motivo,operacion_clave,contexto)
 values(p_bodega,p_clave,auth.uid(),auth.uid(),'operador','autoiniciado','ticket',p_clave,'en_proceso',coalesce(p_observacion,''),p_clave,'DEMO: inventario autoiniciado; referencias simuladas, sin modificar existencias reales.');
 return p_clave;
end $$;

-- Only tickets with private DEMO provenance can use the existing leader review to close.
-- Ordinary self-starts still require the future G21 reconciliation.
create or replace function inventario_private.proteger_autoinventario_sin_conciliar()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.origen_creacion='creado_por_operador' and new.estado is distinct from old.estado
 and new.estado in ('verificado_sin_diferencias','verificado_con_diferencias','cerrado','pendiente_aprobacion')
 and not (new.es_prueba and inventario_private.demo_activo() and exists(select 1 from inventario_private.demo_tickets where ticket_id=new.id)) then
  raise exception 'Pendiente de referencia y conciliación G21. Puedes revisar el conteo o solicitar reconteo; no aprobar ni cerrar aún';
 end if;
 return new;
end $$;

create function public.inventario_demo_catalogo(p_bodega uuid,p_categoria uuid) returns jsonb language sql security invoker set search_path='' as $$select inventario_private.demo_catalogo(p_bodega,p_categoria)$$;
create function public.inventario_demo_contexto() returns jsonb language sql security invoker set search_path='' as $$select inventario_private.demo_contexto()$$;
create function public.inventario_demo_autoiniciar(p_clave uuid,p_bodega uuid,p_categoria uuid,p_observacion text,p_ids uuid[]) returns uuid language sql security invoker set search_path='' as $$select inventario_private.demo_autoiniciar(p_clave,p_bodega,p_categoria,p_observacion,p_ids)$$;
revoke all on function inventario_private.demo_activo(),inventario_private.demo_sembrar(uuid),inventario_private.demo_catalogo(uuid,uuid),inventario_private.demo_contexto(),inventario_private.demo_autoiniciar(uuid,uuid,uuid,text,uuid[]),public.inventario_demo_catalogo(uuid,uuid),public.inventario_demo_contexto(),public.inventario_demo_autoiniciar(uuid,uuid,uuid,text,uuid[]) from public,anon,authenticated,service_role;
grant execute on function inventario_private.demo_catalogo(uuid,uuid),inventario_private.demo_contexto(),inventario_private.demo_autoiniciar(uuid,uuid,uuid,text,uuid[]),public.inventario_demo_catalogo(uuid,uuid),public.inventario_demo_contexto(),public.inventario_demo_autoiniciar(uuid,uuid,uuid,text,uuid[]) to authenticated;

-- Does not install or change the ordinary G21 self-start RPC.
create function inventario_private.proteger_origen_demo() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and exists(select 1 from inventario_private.demo_tickets where ticket_id=old.id)
 and (not new.es_prueba or new.bodega_id<>old.bodega_id or new.categoria_id is distinct from old.categoria_id or new.modo<>'categoria' or new.sesion_id is not null or new.origen_creacion is distinct from 'creado_por_operador') then
  raise exception 'Un inventario DEMO no puede convertirse en inventario oficial';
 end if;
 if exists(select 1 from public.inventario_categorias where id=new.categoria_id and origen='demo')
 and (not new.es_prueba or new.origen_creacion is distinct from 'creado_por_operador' or new.modo<>'categoria' or new.sesion_id is not null) then
  raise exception 'Esta categoria DEMO se inicia desde Nuevo inventario';
 end if;
 return new;
end $$;
revoke all on function inventario_private.proteger_origen_demo() from public,anon,authenticated,service_role;
create trigger inventario_proteger_origen_demo before insert or update on public.inventario_tickets for each row execute function inventario_private.proteger_origen_demo();
create index inventario_demo_productos_categoria on inventario_private.demo_productos(categoria_id,bodega_id);
-- No seed, global users, historical updates, or activation in this schema migration.
notify pgrst,'reload schema';
commit;
