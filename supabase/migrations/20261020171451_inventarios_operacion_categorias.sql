-- Operational category tasks reuse tickets and audit. No ERP balances are invented.
create table public.inventario_administradores (
  perfil_id uuid primary key references public.perfiles(id) on delete cascade,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.inventario_administradores enable row level security;
alter table public.inventario_administradores force row level security;
revoke all on public.inventario_administradores from public, anon, authenticated, service_role;
grant select on public.inventario_administradores to authenticated;
create policy inventario_admin_propio on public.inventario_administradores for select to authenticated
  using (perfil_id = (select auth.uid()));

create function inventario_private.es_administrador()
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists(select 1 from public.inventario_administradores a
 join public.perfiles p on p.id=a.perfil_id
 where a.perfil_id=(select auth.uid()) and a.activo and p.estado='activo'
 and (p.rol='Admin' or 'inventarios'=any(coalesce(p.modulos_permitidos,'{}'::text[]))))
$$;
revoke all on function inventario_private.es_administrador() from public,anon,authenticated,service_role;
grant execute on function inventario_private.es_administrador() to authenticated;

create or replace function inventario_private.rol_bodega(p_bodega_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
 select case when inventario_private.es_administrador() then 'administrador'
 else (select m.rol from public.inventario_usuarios_bodegas m join public.perfiles p on p.id=m.perfil_id
 where m.bodega_id=b.id and m.perfil_id=(select auth.uid()) and m.activo and p.estado='activo'
 and (p.rol='Admin' or 'inventarios'=any(coalesce(p.modulos_permitidos,'{}'::text[])))) end
 from public.inventario_bodegas b where b.id=p_bodega_id and b.activa
$$;

alter table public.inventario_bodegas
 add column origen text not null default 'g21' check (origen in ('excel','g21')),
 add column referencia_local text unique,
 alter column id_erp drop not null,
 alter column codigo_erp drop not null,
 alter column erp_confirmada_at drop not null,
 add constraint inventario_bodega_origen check (
   (origen='g21' and id_erp is not null and codigo_erp is not null and erp_confirmada_at is not null)
   or (origen='excel' and referencia_local is not null and id_erp is null and codigo_erp is null and erp_confirmada_at is null));
alter table public.inventario_categorias
 add column origen text not null default 'g21' check (origen in ('excel','g21')),
 add column referencia_local text,
 alter column id_erp drop not null,
 alter column codigo_erp drop not null,
 alter column sincronizada_at drop not null,
 add constraint inventario_categoria_local unique(bodega_id,referencia_local),
 add constraint inventario_categoria_origen check (
  (origen='g21' and id_erp is not null and codigo_erp is not null and sincronizada_at is not null)
  or (origen='excel' and referencia_local is not null and id_erp is null and codigo_erp is null and sincronizada_at is null));

alter table public.inventario_tickets
 alter column sesion_id drop not null,
 add column modo text not null default 'sku' check (modo in ('sku','categoria')),
 add column categoria_id uuid,
 add column lider_id uuid references public.perfiles(id) on delete set null,
 add column avance_parcial integer not null default 0 check (avance_parcial between 0 and 69),
 add constraint inventario_ticket_bodega_fk foreign key(bodega_id) references public.inventario_bodegas(id),
 add constraint inventario_ticket_categoria_fk foreign key(categoria_id,bodega_id) references public.inventario_categorias(id,bodega_id),
 add constraint inventario_ticket_id_bodega unique(id,bodega_id),
 add constraint inventario_ticket_modo check (
  (modo='sku' and sesion_id is not null) or
  (modo='categoria' and sesion_id is null and categoria_id is not null and tipo='conteo'));
create index inventario_ticket_categoria on public.inventario_tickets(categoria_id,bodega_id);
create index inventario_ticket_lider on public.inventario_tickets(lider_id);
-- Existing composite FK is retained for SKU sessions. The direct FK covers category tasks.
do $$
declare c record;
begin
 for c in select conname from pg_constraint where conrelid='public.inventario_auditoria'::regclass
 and contype='c' and pg_get_constraintdef(oid) like '%ticket_id IS NULL%sesion_id IS NOT NULL%'
 loop execute format('alter table public.inventario_auditoria drop constraint %I',c.conname); end loop;
end $$;
alter table public.inventario_auditoria add constraint inventario_audit_ticket_bodega
 foreign key(ticket_id,bodega_id) references public.inventario_tickets(id,bodega_id);
create policy inventario_audit_operacion on public.inventario_auditoria for select to authenticated using (
 exists(select 1 from public.inventario_tickets t where t.id=ticket_id and t.modo='categoria'
 and inventario_private.puede_leer_ticket(t.id)));
create policy inventario_catalogo_operativo on public.inventario_categorias for select to authenticated using (
 exists(select 1 from public.inventario_tickets t where t.categoria_id=inventario_categorias.id
 and inventario_private.puede_leer_ticket(t.id)));

-- Authenticated read facade returns only names/roles needed by the scoped board.
create function inventario_private.contexto_operacion()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare result jsonb;
begin
 if not exists(select 1 from public.perfiles p where p.id=auth.uid() and p.estado='activo'
 and (p.rol='Admin' or 'inventarios'=any(coalesce(p.modulos_permitidos,'{}'::text[])))) then
 raise exception 'Acceso denegado' using errcode='42501'; end if;
 select jsonb_build_object(
  'userId',auth.uid(), 'globalAdmin',inventario_private.es_administrador(),
  'people',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.nombre)) from public.perfiles p
    where exists(select 1 from public.inventario_tickets t where t.modo='categoria'
    and inventario_private.puede_leer_ticket(t.id) and (p.id in (t.asignado_a,t.asignado_por,t.lider_id)
      or exists(select 1 from public.inventario_auditoria a where a.ticket_id=t.id and a.actor_id=p.id)))),'[]'::jsonb),
  'warehouses',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.nombre,'role',inventario_private.rol_bodega(b.id),'origin',b.origen))
    from public.inventario_bodegas b where inventario_private.rol_bodega(b.id) is not null),'[]'::jsonb),
  'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.perfil_id,'warehouseId',m.bodega_id,'name',p.nombre,'role',m.rol,'leader',m.es_responsable))
    from public.inventario_usuarios_bodegas m join public.perfiles p on p.id=m.perfil_id
    where m.activo and p.estado='activo'
    and (p.rol='Admin' or 'inventarios'=any(coalesce(p.modulos_permitidos,'{}'::text[])))
    and (inventario_private.rol_bodega(m.bodega_id) in ('administrador','lider') or m.perfil_id=auth.uid())),'[]'::jsonb),
  'users',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.nombre,'eligible',
    p.rol='Admin' or 'inventarios'=any(coalesce(p.modulos_permitidos,'{}'::text[]))))
    from public.perfiles p where inventario_private.es_administrador() and p.estado='activo'),'[]'::jsonb)
 ) into result;
 return result;
end $$;

create sequence inventario_private.numero_operativo;
revoke all on sequence inventario_private.numero_operativo from public,anon,authenticated,service_role;
create function inventario_private.asignar_categoria(
 p_clave uuid, p_bodega uuid, p_categoria uuid, p_operador uuid,
 p_prioridad text, p_vencimiento timestamptz, p_observacion text
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare task_id uuid; role_name text; leader_id uuid; existing public.inventario_tickets; request_hash text;
begin
 role_name:=inventario_private.rol_bodega(p_bodega);
 if role_name is null or role_name not in ('administrador','lider') then raise exception 'No puedes asignar en esta bodega' using errcode='42501'; end if;
 if p_clave is null or p_categoria is null or p_operador is null or p_prioridad is null then raise exception 'Faltan datos obligatorios'; end if;
 if p_prioridad not in ('baja','normal','alta','urgente') or length(coalesce(p_observacion,''))>2000 then raise exception 'Datos inválidos'; end if;
 request_hash:=md5(jsonb_build_array(p_bodega,p_categoria,p_operador,p_prioridad,p_vencimiento,p_observacion)::text);
 perform pg_advisory_xact_lock(hashtextextended(p_clave::text,0));
 select * into existing from public.inventario_tickets where id=p_clave;
 if found then
  if exists(select 1 from inventario_private.operaciones where clave=p_clave and actor_id=auth.uid() and solicitud_hash=request_hash) then return existing.id; end if;
  raise exception 'La solicitud ya existe con otros datos'; end if;
 if p_vencimiento is not null and p_vencimiento<=now() then raise exception 'La fecha objetivo debe ser futura'; end if;
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

create function inventario_private.actualizar_tarea(p_ticket uuid,p_version integer,p_accion text,p_avance integer,p_nota text)
returns void language plpgsql security definer set search_path = ''
as $$
declare t public.inventario_tickets; role_name text; next_state text;
begin
 select * into t from public.inventario_tickets where id=p_ticket for update;
 role_name:=inventario_private.rol_bodega(t.bodega_id);
 if t.id is null or role_name is null or not inventario_private.puede_leer_ticket(t.id) then raise exception 'Acceso denegado' using errcode='42501'; end if;
 if t.modo<>'categoria' then raise exception 'Conteo SKU pendiente de integración'; end if;
 if p_version is null or t.version<>p_version then raise exception 'La tarea cambió. Actualiza antes de continuar' using errcode='40001'; end if;
 if p_accion is null or length(coalesce(p_nota,''))>2000 then raise exception 'Datos inválidos'; end if;
 next_state:=t.estado;
 if p_accion in ('iniciar','avance','finalizar') then
  if t.asignado_a is distinct from auth.uid() or role_name<>'operador' then raise exception 'Solo el operador asignado puede registrar el trabajo' using errcode='42501'; end if;
  if p_accion='iniciar' and t.estado='asignado' then next_state:='en_proceso';
  elsif p_accion='avance' and t.estado='en_proceso' and p_avance between 26 and 69 and p_avance>=t.avance_parcial and length(btrim(coalesce(p_nota,'')))>0 then
   update public.inventario_tickets set avance_parcial=p_avance where id=t.id;
  elsif p_accion='finalizar' and t.estado='en_proceso' then next_state:='enviado_verificacion';
  else raise exception 'Transición o avance no válido'; end if;
 else
  if role_name not in ('administrador','lider') or t.asignado_a=auth.uid() then raise exception 'Se requiere un supervisor distinto del operador' using errcode='42501'; end if;
  if p_accion='revisar' and t.estado='enviado_verificacion' then next_state:='en_verificacion';
  elsif p_accion='verificar' and t.estado='en_verificacion' and length(btrim(coalesce(p_nota,'')))>0 then next_state:='verificado_sin_diferencias';
  elsif p_accion='diferencias' and t.estado='en_verificacion' and length(btrim(coalesce(p_nota,'')))>0 then next_state:='verificado_con_diferencias';
  elsif p_accion='cerrar' and t.estado='verificado_sin_diferencias' then next_state:='cerrado';
  elsif p_accion='devolver' and t.estado in ('en_verificacion','verificado_con_diferencias') and length(btrim(coalesce(p_nota,'')))>0 then
   next_state:='en_proceso';
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
 cerrado_at=case when p_accion='cerrar' then now() else cerrado_at end where id=t.id;
 insert into public.inventario_auditoria(bodega_id,ticket_id,actor_id,actor_original_id,actor_rol,evento,entidad_tipo,entidad_id,estado_anterior,estado_nuevo,motivo,operacion_clave)
 values(t.bodega_id,t.id,auth.uid(),auth.uid(),role_name,p_accion,'ticket',t.id,t.estado,next_state,
 case when p_accion='avance' then p_avance::text||'% — '||p_nota else p_nota end,gen_random_uuid());
end $$;

create function inventario_private.guardar_miembro(p_bodega uuid,p_perfil uuid,p_rol text,p_activo boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare before_role text;
begin
 if not inventario_private.es_administrador() then raise exception 'Solo administrador de Inventarios' using errcode='42501'; end if;
 if p_rol is null or p_rol not in ('lider','operador') or p_activo is null then raise exception 'Rol inválido'; end if;
 perform 1 from public.inventario_bodegas where id=p_bodega and activa for update;
 if not found then raise exception 'Bodega no válida'; end if;
 if not exists(select 1 from public.perfiles p where p.id=p_perfil and p.estado='activo'
 and (p.rol='Admin' or 'inventarios'=any(coalesce(p.modulos_permitidos,'{}'::text[])))) then raise exception 'El usuario necesita acceso al módulo Inventarios'; end if;
 select rol into before_role from public.inventario_usuarios_bodegas where bodega_id=p_bodega and perfil_id=p_perfil;
 if (not p_activo or p_rol<>'operador') and exists(select 1 from public.inventario_tickets where bodega_id=p_bodega and asignado_a=p_perfil
 and estado not in ('cerrado','cancelado')) then raise exception 'Resuelve las tareas del operador antes de cambiar su acceso'; end if;
 if p_rol='lider' and p_activo then
  update public.inventario_usuarios_bodegas set es_responsable=false where bodega_id=p_bodega and es_responsable;
 end if;
 insert into public.inventario_usuarios_bodegas(bodega_id,perfil_id,rol,activo,es_responsable)
 values(p_bodega,p_perfil,p_rol,p_activo,p_rol='lider' and p_activo)
 on conflict(perfil_id,bodega_id) do update set rol=excluded.rol,activo=excluded.activo,es_responsable=excluded.es_responsable;
 if (p_rol='lider' and p_activo) or before_role='lider' then
  insert into public.inventario_auditoria(bodega_id,ticket_id,actor_id,actor_original_id,actor_rol,evento,entidad_tipo,entidad_id,motivo,operacion_clave)
  select p_bodega,t.id,auth.uid(),auth.uid(),'administrador','cambio_lider','ticket',t.id,
   case when p_rol='lider' and p_activo then 'Nuevo líder: '||p_perfil::text else 'Líder desvinculado: '||p_perfil::text end,gen_random_uuid()
  from public.inventario_tickets t where t.bodega_id=p_bodega and t.modo='categoria' and t.estado not in ('cerrado','cancelado')
    and ((p_rol='lider' and p_activo) or t.lider_id=p_perfil);
 end if;
 if p_rol='lider' and p_activo then
  update public.inventario_tickets set lider_id=p_perfil,version=version+1 where bodega_id=p_bodega and modo='categoria' and estado not in ('cerrado','cancelado');
 elsif before_role='lider' then
  update public.inventario_tickets set lider_id=null,version=version+1 where bodega_id=p_bodega and lider_id=p_perfil and modo='categoria' and estado not in ('cerrado','cancelado');
 end if;
 insert into public.inventario_auditoria(bodega_id,actor_id,actor_original_id,actor_rol,evento,entidad_tipo,entidad_id,estado_anterior,estado_nuevo,operacion_clave)
 values(p_bodega,auth.uid(),auth.uid(),'administrador','membresia','perfil',p_perfil,before_role,p_rol||case when p_activo then ':activo' else ':inactivo' end,gen_random_uuid());
end $$;

-- Invoker facades: all authorization and transactional writes live in private functions.
create function public.inventario_contexto() returns jsonb language sql security invoker set search_path=''
 as $$ select inventario_private.contexto_operacion() $$;
create function public.inventario_asignar(p_clave uuid,p_bodega uuid,p_categoria uuid,p_operador uuid,p_prioridad text,p_vencimiento timestamptz,p_observacion text)
returns uuid language sql security invoker set search_path=''
as $$ select inventario_private.asignar_categoria(p_clave,p_bodega,p_categoria,p_operador,p_prioridad,p_vencimiento,p_observacion) $$;
create function public.inventario_actualizar(p_ticket uuid,p_version integer,p_accion text,p_avance integer,p_nota text)
returns void language sql security invoker set search_path=''
as $$ select inventario_private.actualizar_tarea(p_ticket,p_version,p_accion,p_avance,p_nota) $$;
create function public.inventario_miembro(p_bodega uuid,p_perfil uuid,p_rol text,p_activo boolean)
returns void language sql security invoker set search_path=''
as $$ select inventario_private.guardar_miembro(p_bodega,p_perfil,p_rol,p_activo) $$;

revoke all on function inventario_private.contexto_operacion(),inventario_private.asignar_categoria(uuid,uuid,uuid,uuid,text,timestamptz,text),
 inventario_private.actualizar_tarea(uuid,integer,text,integer,text),inventario_private.guardar_miembro(uuid,uuid,text,boolean)
 from public,anon,authenticated,service_role;
grant execute on function inventario_private.contexto_operacion(),inventario_private.asignar_categoria(uuid,uuid,uuid,uuid,text,timestamptz,text),
 inventario_private.actualizar_tarea(uuid,integer,text,integer,text),inventario_private.guardar_miembro(uuid,uuid,text,boolean) to authenticated;
revoke all on function public.inventario_contexto(),public.inventario_asignar(uuid,uuid,uuid,uuid,text,timestamptz,text),
 public.inventario_actualizar(uuid,integer,text,integer,text),public.inventario_miembro(uuid,uuid,text,boolean) from public,anon,authenticated,service_role;
grant execute on function public.inventario_contexto(),public.inventario_asignar(uuid,uuid,uuid,uuid,text,timestamptz,text),
 public.inventario_actualizar(uuid,integer,text,integer,text),public.inventario_miembro(uuid,uuid,text,boolean) to authenticated;
