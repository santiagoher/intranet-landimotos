-- Additive filters exclusively for the existing private DEMO catalogue.
-- No official products, balances, historical tickets, roles or PT409 changes.
begin;
set local lock_timeout='2s';
set local statement_timeout='20s';
alter table inventario_private.demo_productos
 add column subcategoria text check(length(subcategoria) between 1 and 120),
 add column marca text check(length(marca) between 1 and 120);
alter table inventario_private.demo_tickets
 add column subcategoria text,
 add column marca text;
-- Classifications are synthetic, explicitly marked DEMO; never inferred ERP data.
update inventario_private.demo_productos set
 subcategoria=case
 when codigo like 'DEMO-01-001' then 'Control de aceleración (DEMO)'
 when codigo like 'DEMO-01-002' then 'Control de embrague (DEMO)'
 when codigo like 'DEMO-02-%' then 'Transmisión (DEMO)'
 when codigo like 'DEMO-03-001' then 'Aceites de motor (DEMO)'
 when codigo like 'DEMO-03-002' then 'Lubricación de cadena (DEMO)'
 when codigo like 'DEMO-04-001' then 'Motores eléctricos (DEMO)'
 when codigo like 'DEMO-04-002' then 'Relés (DEMO)'
 when codigo like 'DEMO-05-001' then 'Freno de disco (DEMO)'
 when codigo like 'DEMO-05-002' then 'Freno de tambor (DEMO)'
 else 'General (DEMO)' end,
 marca=case when right(codigo,3)='001' then 'Marca A (DEMO)' else 'Marca B (DEMO)' end
where subcategoria is null and marca is null;
create or replace function inventario_private.demo_sembrar(p_bodega uuid) returns void language plpgsql security definer set search_path='' as $$
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
update inventario_private.demo_productos set
 subcategoria=case
 when codigo like 'DEMO-01-001' then 'Control de aceleración (DEMO)'
 when codigo like 'DEMO-01-002' then 'Control de embrague (DEMO)'
 when codigo like 'DEMO-02-%' then 'Transmisión (DEMO)'
 when codigo like 'DEMO-03-001' then 'Aceites de motor (DEMO)'
 when codigo like 'DEMO-03-002' then 'Lubricación de cadena (DEMO)'
 when codigo like 'DEMO-04-001' then 'Motores eléctricos (DEMO)'
 when codigo like 'DEMO-04-002' then 'Relés (DEMO)'
 when codigo like 'DEMO-05-001' then 'Freno de disco (DEMO)'
 when codigo like 'DEMO-05-002' then 'Freno de tambor (DEMO)'
 else 'General (DEMO)' end,
 marca=case when right(codigo,3)='001' then 'Marca A (DEMO)' else 'Marca B (DEMO)' end
where subcategoria is null and marca is null and bodega_id=p_bodega;
end $$;

create or replace function inventario_private.demo_catalogo(p_bodega uuid,p_categoria uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not inventario_private.demo_activo() then raise exception 'DEMO deshabilitado' using errcode='42501'; end if;
 if (not inventario_private.puede_autoiniciar(p_bodega) or not exists(select 1 from inventario_private.demo_bodegas where bodega_id=p_bodega and enabled)) then raise exception 'No tienes permiso para iniciar en esta bodega' using errcode='42501'; end if;
 if not exists(select 1 from public.inventario_categorias where id=p_categoria and bodega_id=p_bodega and activa and origen='demo') then raise exception 'Categoría DEMO no autorizada' using errcode='42501'; end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',codigo,'name',nombre,'unit',unidad,'barcodes',codigos,'subcategory',subcategoria,'brand',marca) order by codigo),'[]'::jsonb)
 from inventario_private.demo_productos where bodega_id=p_bodega and categoria_id=p_categoria);
end $$;

-- One implementation serves both the existing full-category RPC and filtered creation.
create function inventario_private.demo_crear_con_alcance(p_clave uuid,p_bodega uuid,p_categoria uuid,p_observacion text,p_ids uuid[],p_subcategoria text,p_marca text) returns uuid language plpgsql security definer set search_path='' as $$
declare leader_id uuid; fingerprint text; products jsonb; actual_ids uuid[];
begin
 if not inventario_private.demo_activo() or (not inventario_private.puede_autoiniciar(p_bodega) or not exists(select 1 from inventario_private.demo_bodegas where bodega_id=p_bodega and enabled)) then raise exception 'No tienes permiso para iniciar DEMO en esta bodega' using errcode='42501'; end if;
 if p_clave is null or p_categoria is null or length(coalesce(p_observacion,''))>2000 or coalesce(cardinality(p_ids),0) not between 1 and 2000 then raise exception 'Revisa el alcance y la observación'; end if;
 p_subcategoria:=nullif(btrim(p_subcategoria),'');
 p_marca:=nullif(btrim(p_marca),'');
 if length(coalesce(p_subcategoria,''))>120 or length(coalesce(p_marca,''))>120 then raise exception 'Filtros no válidos'; end if;
 fingerprint:=md5(jsonb_build_array('demo-v1',p_bodega,p_categoria,coalesce(p_observacion,''),(select array_agg(x order by x) from unnest(p_ids) x))::text);
 if p_subcategoria is not null or p_marca is not null then
  fingerprint:=md5(jsonb_build_array(fingerprint,p_subcategoria,p_marca)::text);
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_clave::text,0));
 if exists(select 1 from inventario_private.operaciones where clave=p_clave) then
  if exists(select 1 from inventario_private.operaciones where clave=p_clave and actor_id=auth.uid() and comando='demo_autoiniciar' and solicitud_hash=fingerprint) then return p_clave; end if;
  raise exception 'La solicitud ya existe con otros datos';
 end if;
 products:=inventario_private.demo_catalogo(p_bodega,p_categoria);
 select coalesce(jsonb_agg(x order by x->>'code'),'[]'::jsonb) into products from jsonb_array_elements(products) x
 where (p_subcategoria is null or x->>'subcategory'=p_subcategoria)
 and (p_marca is null or x->>'brand'=p_marca);
 select array_agg((x->>'id')::uuid order by (x->>'id')::uuid) into actual_ids from jsonb_array_elements(products) x;
 if actual_ids is null or actual_ids is distinct from (select array_agg(x order by x) from unnest(p_ids) x) then raise exception 'El catálogo cambió. Vuelve a seleccionar la categoría'; end if;
 select m.perfil_id into leader_id from public.inventario_usuarios_bodegas m join public.perfiles p on p.id=m.perfil_id
 where m.bodega_id=p_bodega and m.activo and m.rol='lider' and m.es_responsable and p.estado='activo'
 and (p.rol='Admin' or 'inventarios'=any(coalesce(p.modulos_permitidos,'{}'::text[])));
 if leader_id is null or leader_id=auth.uid() then raise exception 'La bodega necesita un líder responsable activo'; end if;
 insert into public.inventario_tickets(id,numero,bodega_id,categoria_id,modo,asignado_a,asignado_por,creado_por,lider_id,origen_creacion,estado,prioridad,asignado_at,aceptado_at,iniciado_at,observacion_inicial,total_productos,es_prueba)
 values(p_clave,'OP-'||lpad(nextval('inventario_private.numero_operativo')::text,8,'0'),p_bodega,p_categoria,'categoria',auth.uid(),null,auth.uid(),leader_id,'creado_por_operador','en_proceso','normal',now(),now(),now(),coalesce(p_observacion,''),jsonb_array_length(products),true);
 insert into inventario_private.demo_tickets(ticket_id,subcategoria,marca) values(p_clave,p_subcategoria,p_marca);
 insert into public.inventario_tarea_productos(ticket_id,codigo,nombre,unidad,codigos_barras)
 select p_clave,x->>'code',x->>'name',x->>'unit',array(select jsonb_array_elements_text(x->'barcodes')) from jsonb_array_elements(products) x;
 -- Fictional comparison ONLY, private and never sent to the operator. No real stock or adjustments.
 insert into inventario_private.referencias_producto(producto_id,cantidad)
 select t.id,d.referencia_simulada from public.inventario_tarea_productos t join inventario_private.demo_productos d on d.bodega_id=p_bodega and d.categoria_id=p_categoria and d.codigo=t.codigo where t.ticket_id=p_clave;
 insert into inventario_private.operaciones(bodega_id,actor_id,clave,comando,solicitud_hash,entidad_resultado_id)
 values(p_bodega,auth.uid(),p_clave,'demo_autoiniciar',fingerprint,p_clave);
 insert into public.inventario_auditoria(bodega_id,ticket_id,actor_id,actor_original_id,actor_rol,evento,entidad_tipo,entidad_id,estado_nuevo,motivo,operacion_clave,contexto)
 values(p_bodega,p_clave,auth.uid(),auth.uid(),'operador','autoiniciado','ticket',p_clave,'en_proceso',coalesce(p_observacion,''),p_clave,'DEMO: inventario autoiniciado; referencias simuladas, sin modificar existencias reales.' || case when p_subcategoria is not null or p_marca is not null then format(' Subcategoría: %s. Marca: %s.',coalesce(p_subcategoria,'Todas'),coalesce(p_marca,'Todas')) else '' end);
 return p_clave;
end $$;

create or replace function inventario_private.demo_autoiniciar(p_clave uuid,p_bodega uuid,p_categoria uuid,p_observacion text,p_ids uuid[])
returns uuid language sql security invoker set search_path='' as $$
 select inventario_private.demo_crear_con_alcance(p_clave,p_bodega,p_categoria,p_observacion,p_ids,null,null)
$$;
create function public.inventario_demo_autoiniciar_filtrado(p_clave uuid,p_bodega uuid,p_categoria uuid,p_observacion text,p_ids uuid[],p_subcategoria text,p_marca text)
returns uuid language sql security invoker set search_path='' as $$
 select inventario_private.demo_crear_con_alcance(p_clave,p_bodega,p_categoria,p_observacion,p_ids,p_subcategoria,p_marca)
$$;
revoke all on function inventario_private.demo_crear_con_alcance(uuid,uuid,uuid,text,uuid[],text,text),public.inventario_demo_autoiniciar_filtrado(uuid,uuid,uuid,text,uuid[],text,text) from public,anon,authenticated,service_role;
grant execute on function inventario_private.demo_crear_con_alcance(uuid,uuid,uuid,text,uuid[],text,text),public.inventario_demo_autoiniciar_filtrado(uuid,uuid,uuid,text,uuid[],text,text) to authenticated;
notify pgrst,'reload schema';
commit;
