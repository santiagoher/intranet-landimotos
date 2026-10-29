-- REVIEW REQUIRED: private Storage + metadata + audit access. No remote execution.
BEGIN;
drop policy inventario_audit_operacion on public.inventario_auditoria;
create policy inventario_audit_operacion on public.inventario_auditoria for select to authenticated using (
 inventario_private.rol_bodega(bodega_id) in ('lider','administrador')
 and (ticket_id is null or inventario_private.puede_leer_ticket(ticket_id)));

create table public.inventario_evidencias (
 id uuid primary key,
 ticket_id uuid not null references public.inventario_tickets(id) on delete restrict,
 usuario_id uuid not null references public.perfiles(id) on delete restrict,
 storage_path text not null unique,
 nombre_original text not null check(length(nombre_original) between 1 and 150),
 mime_type text not null default 'image/webp' check(mime_type='image/webp'),
 tamanio_bytes integer not null check(tamanio_bytes between 1 and 5242880),
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 tipo_evidencia text not null check(tipo_evidencia in ('conteo_operador','verificacion_lider')),
 estado text not null default 'pendiente' check(estado in ('pendiente','vigente','eliminando','eliminado')),
 created_at timestamptz not null default now(), uploaded_at timestamptz, eliminado_at timestamptz,
 check(storage_path='inventarios/'||ticket_id::text||'/'||usuario_id::text||'/'||id::text||'.webp')
);
create index inventario_evidencias_ticket on public.inventario_evidencias(ticket_id,estado);
create index inventario_evidencias_usuario on public.inventario_evidencias(usuario_id);
create unique index inventario_evidencias_hash on public.inventario_evidencias(ticket_id,usuario_id,sha256,tipo_evidencia) where estado<>'eliminado';
alter table public.inventario_evidencias enable row level security;
alter table public.inventario_evidencias force row level security;
revoke all on public.inventario_evidencias from public,anon,authenticated,service_role;
grant select on public.inventario_evidencias to authenticated,service_role;
create policy inventario_evidencias_lectura on public.inventario_evidencias for select to authenticated using (
 inventario_private.puede_leer_ticket(ticket_id) and estado<>'eliminado' and
 (tipo_evidencia='conteo_operador' or exists(select 1 from public.inventario_tickets t where t.id=ticket_id and inventario_private.rol_bodega(t.bodega_id) in ('lider','administrador'))));

create table public.inventario_observaciones_conteo (
 ticket_id uuid primary key references public.inventario_tickets(id) on delete restrict,
 usuario_id uuid not null references public.perfiles(id) on delete restrict,
 texto text not null check(length(texto)<=2000), version integer not null default 1,
 updated_at timestamptz not null default now()
);
create index inventario_observaciones_usuario on public.inventario_observaciones_conteo(usuario_id);
alter table public.inventario_observaciones_conteo enable row level security;
alter table public.inventario_observaciones_conteo force row level security;
revoke all on public.inventario_observaciones_conteo from public,anon,authenticated,service_role;
grant select on public.inventario_observaciones_conteo to authenticated;
create policy inventario_observaciones_lectura on public.inventario_observaciones_conteo for select to authenticated using(inventario_private.puede_leer_ticket(ticket_id));

-- Rows are locked in ticket -> evidence order everywhere, including finalization.
create function inventario_private.evidencia_editar(p_ticket uuid,p_id uuid,p_accion text,p_nombre text,p_hash text,p_bytes integer)
returns public.inventario_evidencias language plpgsql security definer set search_path='' as $$
declare t public.inventario_tickets; e public.inventario_evidencias;
begin
 select * into t from public.inventario_tickets where id=p_ticket for update;
 if t.id is null or t.asignado_a is distinct from auth.uid() or coalesce(inventario_private.rol_bodega(t.bodega_id),'')<>'operador' then raise exception 'Solo el operador asignado puede editar evidencias' using errcode='42501'; end if;
 if t.estado<>'en_proceso' then raise exception 'Las evidencias solo se editan durante el conteo'; end if;
 if p_accion='reservar' then
  select * into e from public.inventario_evidencias where id=p_id;
  if found then
   if e.ticket_id=p_ticket and e.usuario_id=auth.uid() and e.sha256=p_hash and e.estado='vigente' then return e; end if;
   raise exception 'La carga ya existe con otros datos';
  end if;
  if (select count(*) from public.inventario_evidencias where ticket_id=p_ticket and tipo_evidencia='conteo_operador' and estado<>'eliminado')>=3 then raise exception 'Máximo 3 fotografías por inventario'; end if;
  if exists(select 1 from public.inventario_evidencias where ticket_id=p_ticket and usuario_id=auth.uid() and sha256=p_hash and estado<>'eliminado') then raise exception 'Esta fotografía ya está adjunta o cargándose'; end if;
  insert into public.inventario_evidencias(id,ticket_id,usuario_id,storage_path,nombre_original,tamanio_bytes,sha256,tipo_evidencia)
  values(p_id,p_ticket,auth.uid(),'inventarios/'||p_ticket::text||'/'||auth.uid()::text||'/'||p_id::text||'.webp',p_nombre,p_bytes,p_hash,'conteo_operador') returning * into e;
 elsif p_accion='eliminar' then
  select * into e from public.inventario_evidencias where id=p_id and ticket_id=p_ticket and usuario_id=auth.uid() and tipo_evidencia='conteo_operador' for update;
  if e.id is null then raise exception 'Evidencia no autorizada' using errcode='42501'; end if;
  if e.estado<>'eliminado' then update public.inventario_evidencias set estado='eliminando' where id=e.id returning * into e; end if;
 else raise exception 'Acción inválida'; end if;
 return e;
end $$;

-- Service-only completion: browser credentials cannot mark arbitrary bytes valid.
create function inventario_private.evidencia_confirmar(p_id uuid,p_accion text)
returns void language plpgsql security definer set search_path='' as $$
declare e public.inventario_evidencias; t public.inventario_tickets;
begin
 select * into e from public.inventario_evidencias where id=p_id;
 select * into t from public.inventario_tickets where id=e.ticket_id for update;
 select * into e from public.inventario_evidencias where id=p_id for update;
 if e.id is null then raise exception 'Evidencia no encontrada'; end if;
 if p_accion='confirmar' then
  if e.estado='vigente' then return; end if;
  if t.estado<>'en_proceso' or e.estado<>'pendiente' or t.asignado_a is distinct from e.usuario_id then raise exception 'El conteo ya no permite esta carga'; end if;
  if not exists(select 1 from public.inventario_usuarios_bodegas m join public.perfiles p on p.id=m.perfil_id
   where m.perfil_id=e.usuario_id and m.bodega_id=t.bodega_id and m.activo and m.rol='operador' and p.estado='activo'
   and (p.rol='Admin' or 'inventarios'=any(coalesce(p.modulos_permitidos,'{}'::text[])))) then raise exception 'Permiso de operador revocado'; end if;
  if not exists(select 1 from storage.objects where bucket_id='inventario-evidencias' and name=e.storage_path) then raise exception 'El archivo no está almacenado'; end if;
  update public.inventario_evidencias set estado='vigente',uploaded_at=now() where id=e.id;
 elsif p_accion='retirar' then
  if e.estado='eliminado' then return; end if;
  if e.estado not in ('eliminando','pendiente') then raise exception 'Primero solicita eliminar la evidencia'; end if;
  if exists(select 1 from storage.objects where bucket_id='inventario-evidencias' and name=e.storage_path) then raise exception 'Falta retirar el archivo de Storage'; end if;
  update public.inventario_evidencias set estado='eliminado',eliminado_at=now() where id=e.id;
 else raise exception 'Acción inválida'; end if;
 insert into public.inventario_auditoria(bodega_id,ticket_id,actor_id,actor_original_id,actor_rol,evento,entidad_tipo,entidad_id,motivo,operacion_clave)
 values(t.bodega_id,t.id,e.usuario_id,e.usuario_id,'operador',case when p_accion='confirmar' then 'evidencia_adjunta' else 'evidencia_retirada' end,'evidencia',e.id,e.nombre_original,gen_random_uuid());
end $$;

create function inventario_private.observacion_guardar(p_ticket uuid,p_texto text,p_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare t public.inventario_tickets; o public.inventario_observaciones_conteo;
begin
 select * into t from public.inventario_tickets where id=p_ticket for update;
 if t.asignado_a is distinct from auth.uid() or coalesce(inventario_private.rol_bodega(t.bodega_id),'')<>'operador' then raise exception 'No puedes editar esta observación' using errcode='42501'; end if;
 if t.estado<>'en_proceso' or p_texto is null or length(p_texto)>2000 then raise exception 'Revisa el estado y la observación'; end if;
 select * into o from public.inventario_observaciones_conteo where ticket_id=p_ticket;
 if p_version is distinct from coalesce(o.version,0) then raise exception 'La observación cambió. Recarga antes de guardar' using errcode='40001'; end if;
 insert into public.inventario_observaciones_conteo(ticket_id,usuario_id,texto) values(p_ticket,auth.uid(),p_texto)
 on conflict(ticket_id) do update set texto=excluded.texto,usuario_id=excluded.usuario_id,version=inventario_observaciones_conteo.version+1,updated_at=now();
 insert into public.inventario_auditoria(bodega_id,ticket_id,actor_id,actor_original_id,actor_rol,evento,entidad_tipo,entidad_id,motivo,operacion_clave)
 values(t.bodega_id,t.id,auth.uid(),auth.uid(),'operador','observacion_guardada','ticket',t.id,coalesce(o.texto,'')||' → '||p_texto,gen_random_uuid());
end $$;

create function inventario_private.evidencia_bloquear_entrega() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.estado is distinct from old.estado and new.estado<>'en_proceso' and exists(select 1 from public.inventario_evidencias where ticket_id=new.id and estado in ('pendiente','eliminando')) then
  raise exception 'Hay fotografías pendientes. Completa o retira esas cargas antes de continuar';
 end if;
 return new;
end $$;
create trigger inventario_evidencia_entrega before update of estado on public.inventario_tickets for each row execute function inventario_private.evidencia_bloquear_entrega();

create function public.inventario_evidencia_editar(p_ticket uuid,p_id uuid,p_accion text,p_nombre text,p_hash text,p_bytes integer)
returns public.inventario_evidencias language sql security invoker set search_path='' as $$ select inventario_private.evidencia_editar(p_ticket,p_id,p_accion,p_nombre,p_hash,p_bytes) $$;
create function public.inventario_evidencia_confirmar(p_id uuid,p_accion text) returns void language sql security invoker set search_path='' as $$ select inventario_private.evidencia_confirmar(p_id,p_accion) $$;
create function public.inventario_observacion_guardar(p_ticket uuid,p_texto text,p_version integer) returns void language sql security invoker set search_path='' as $$ select inventario_private.observacion_guardar(p_ticket,p_texto,p_version) $$;
revoke all on function inventario_private.evidencia_editar(uuid,uuid,text,text,text,integer),inventario_private.evidencia_confirmar(uuid,text),inventario_private.observacion_guardar(uuid,text,integer),inventario_private.evidencia_bloquear_entrega(),public.inventario_evidencia_editar(uuid,uuid,text,text,text,integer),public.inventario_evidencia_confirmar(uuid,text),public.inventario_observacion_guardar(uuid,text,integer) from public,anon,authenticated,service_role;
grant execute on function inventario_private.evidencia_editar(uuid,uuid,text,text,text,integer),inventario_private.observacion_guardar(uuid,text,integer),public.inventario_evidencia_editar(uuid,uuid,text,text,text,integer),public.inventario_observacion_guardar(uuid,text,integer) to authenticated;
grant usage on schema inventario_private to service_role;
grant execute on function inventario_private.evidencia_confirmar(uuid,text),public.inventario_evidencia_confirmar(uuid,text) to service_role;

-- Explicitly isolated from the existing public profile bucket. Storage API only
-- performs object upload/removal; never delete storage.objects rows directly.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('inventario-evidencias','inventario-evidencias',false,5242880,array['image/webp']);
-- Defense against unrelated broad policies added later: no direct client writes
-- or downloads; the server authorizes each short-lived signed URL via ticket RLS.
create policy inventario_evidencias_storage_cerrado on storage.objects as restrictive for all to anon,authenticated
 using(bucket_id<>'inventario-evidencias') with check(bucket_id<>'inventario-evidencias');
COMMIT;
