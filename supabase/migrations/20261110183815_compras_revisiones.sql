-- Additive schema. No existing permissions, accounts or modules are changed.
create schema compras_private;
revoke all on schema compras_private from public, anon;
grant usage on schema compras_private to authenticated;

create table public.compras_mesas (
  id smallint primary key check (id between 1 and 5), nombre text not null unique
);
insert into public.compras_mesas select n, 'Mesa ' || n from generate_series(1,5) n;
create table public.compras_proveedores (
  id uuid primary key default gen_random_uuid(), nombre text not null check(length(trim(nombre)) between 2 and 200),
  creado_por uuid not null references public.perfiles(id), creado_at timestamptz not null default now()
);
create unique index compras_proveedor_nombre on public.compras_proveedores(lower(trim(nombre)));
create index compras_proveedor_creador on public.compras_proveedores(creado_por);

create table public.compras_revisiones (
  id uuid primary key default gen_random_uuid(), factura text not null check(length(trim(factura)) between 1 and 100),
  proveedor_id uuid not null references public.compras_proveedores(id), proveedor_nombre text not null,
  mesa_id smallint not null references public.compras_mesas(id),
  encargado_id uuid not null references public.perfiles(id), encargado_nombre text not null,
  asignado_por uuid not null references public.perfiles(id), asignador_nombre text not null,
  estado text not null default 'asignado' check(estado in ('asignado','en_revision','pendiente_cierre','devuelto','cerrado')),
  version integer not null default 1 check(version > 0),
  creado_at timestamptz not null default now(), actualizado_at timestamptz not null default now(),
  iniciado_at timestamptz, iniciado_por uuid references public.perfiles(id), tramo_inicio timestamptz,
  finalizado_at timestamptz, finalizado_por uuid references public.perfiles(id),
  cerrado_at timestamptz, cerrado_por uuid references public.perfiles(id), cerrador_nombre text,
  cpm text check(cpm is null or length(trim(cpm)) between 1 and 100),
  segundos_revision numeric not null default 0 check(segundos_revision >= 0),
  constraint compras_cierre_completo check (
    (estado = 'cerrado' and cpm is not null and cerrado_at is not null and cerrado_por is not null)
    or (estado <> 'cerrado' and cpm is null and cerrado_at is null and cerrado_por is null)
  ),
  constraint compras_tramo check ((estado='en_revision') = (tramo_inicio is not null))
);
create unique index compras_factura_proveedor on public.compras_revisiones(proveedor_id,lower(trim(factura)));
create index compras_registros_encargado on public.compras_revisiones(encargado_id,creado_at desc,id);
create index compras_registros_estado on public.compras_revisiones(estado,creado_at desc,id);
create index compras_registros_mesa on public.compras_revisiones(mesa_id,creado_at desc,id);
create index compras_registros_fecha on public.compras_revisiones(creado_at desc,id);
create index compras_registros_cpm on public.compras_revisiones(cpm) where cpm is not null;
create index compras_registros_asignador on public.compras_revisiones(asignado_por);
create index compras_registros_iniciador on public.compras_revisiones(iniciado_por);
create index compras_registros_finalizador on public.compras_revisiones(finalizado_por);
create index compras_registros_cerrador on public.compras_revisiones(cerrado_por);

create table public.compras_observaciones (
  id uuid primary key default gen_random_uuid(), revision_id uuid not null references public.compras_revisiones(id),
  contenido text not null check(length(trim(contenido)) between 1 and 4000),
  autor_id uuid not null references public.perfiles(id), autor_nombre text not null, creado_at timestamptz not null default now()
);
create index compras_observaciones_revision on public.compras_observaciones(revision_id,creado_at,id);
create index compras_observaciones_autor on public.compras_observaciones(autor_id);
create table public.compras_historial (
  id uuid primary key default gen_random_uuid(), revision_id uuid not null references public.compras_revisiones(id),
  evento text not null, estado_anterior text, estado_nuevo text not null,
  actor_id uuid not null references public.perfiles(id), actor_nombre text not null,
  detalle text, datos jsonb not null, creado_at timestamptz not null default now()
);
create index compras_historial_revision on public.compras_historial(revision_id,creado_at,id);
create index compras_historial_actor on public.compras_historial(actor_id);
create table public.compras_notificaciones (
  id uuid primary key default gen_random_uuid(), revision_id uuid not null references public.compras_revisiones(id),
  destinatario_id uuid not null references public.perfiles(id), tipo text not null,
  contexto jsonb not null, creado_at timestamptz not null default now(), leido_at timestamptz
);
create index compras_notificaciones_usuario on public.compras_notificaciones(destinatario_id,creado_at desc,id);
create index compras_notificaciones_revision on public.compras_notificaciones(revision_id);

-- Live profile checks; never trust editable user_metadata or stale JWT roles.
create function compras_private.permitido() returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.perfiles p where p.id=auth.uid() and p.estado='activo'
    and (p.rol='Admin' or (p.rol='Operativo' and 'compras'=any(coalesce(p.modulos_permitidos,'{}'::text[])))))
$$;
create function compras_private.admin() returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.perfiles p where p.id=auth.uid() and p.estado='activo' and p.rol='Admin')
$$;

alter table public.compras_mesas enable row level security;
alter table public.compras_proveedores enable row level security;
alter table public.compras_revisiones enable row level security;
alter table public.compras_observaciones enable row level security;
alter table public.compras_historial enable row level security;
alter table public.compras_notificaciones enable row level security;
create policy compras_mesas_lectura on public.compras_mesas for select to authenticated using ((select compras_private.permitido()));
create policy compras_proveedores_lectura on public.compras_proveedores for select to authenticated using ((select compras_private.permitido()));
create policy compras_revisiones_lectura on public.compras_revisiones for select to authenticated
  using ((select compras_private.permitido()) and ((select compras_private.admin()) or encargado_id=(select auth.uid())));
create policy compras_observaciones_lectura on public.compras_observaciones for select to authenticated
  using (exists(select 1 from public.compras_revisiones r where r.id=revision_id));
create policy compras_historial_lectura on public.compras_historial for select to authenticated
  using (exists(select 1 from public.compras_revisiones r where r.id=revision_id));
create policy compras_notificaciones_lectura on public.compras_notificaciones for select to authenticated
  using (destinatario_id=(select auth.uid()) and exists(select 1 from public.compras_revisiones r where r.id=revision_id));
revoke all on public.compras_mesas, public.compras_proveedores, public.compras_revisiones,
  public.compras_observaciones, public.compras_historial, public.compras_notificaciones from anon, authenticated;
grant select on public.compras_mesas, public.compras_proveedores, public.compras_revisiones,
  public.compras_observaciones, public.compras_historial, public.compras_notificaciones to authenticated;

-- Definer is confined to the private schema: atomic writes and immutable audit,
-- with explicit authorization for every action; no general client table writes.
create function compras_private.mutar(p_accion text, p_datos jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  u uuid := auth.uid(); es_admin boolean; nombre text; r public.compras_revisiones;
  anterior text; detalle text; destinatarios uuid[] := '{}'; resultado uuid;
  operador public.perfiles; proveedor public.compras_proveedores; mesa smallint;
begin
  if u is null or not compras_private.permitido() then raise exception 'Sin permiso para Compras' using errcode='42501'; end if;
  es_admin := compras_private.admin();
  select coalesce(nullif(p.nombre,''),p.email,'Usuario') into nombre from public.perfiles p where p.id=u;
  if p_accion='proveedor' then
    if not es_admin then raise exception 'Solo un administrador puede crear proveedores' using errcode='42501'; end if;
    insert into public.compras_proveedores(nombre,creado_por) values(trim(p_datos->>'nombre'),u) returning id into resultado;
    return resultado;
  end if;
  if p_accion='leer_notificacion' then
    update public.compras_notificaciones n set leido_at=coalesce(n.leido_at,now())
    where n.id=(p_datos->>'id')::uuid and n.destinatario_id=u
      and exists(select 1 from public.compras_revisiones t where t.id=n.revision_id and (es_admin or t.encargado_id=u))
    returning n.id into resultado;
    if resultado is null then raise exception 'Notificación no disponible' using errcode='42501'; end if;
    return resultado;
  end if;
  if p_accion in ('crear','reasignar') then
    if not es_admin then raise exception 'Solo un administrador puede asignar revisiones' using errcode='42501'; end if;
    select * into operador from public.perfiles p where p.id=(p_datos->>'encargado_id')::uuid
      and p.estado='activo' and p.rol='Operativo' and 'compras'=any(coalesce(p.modulos_permitidos,'{}'::text[])) for share;
    if not found then raise exception 'El encargado debe ser un usuario operativo activo con Compras habilitado'; end if;
    mesa := (p_datos->>'mesa_id')::smallint;
    if mesa is null or not exists(select 1 from public.compras_mesas m where m.id=mesa) then raise exception 'Mesa no válida'; end if;
  end if;
  if p_accion='crear' then
    select * into proveedor from public.compras_proveedores p where p.id=(p_datos->>'proveedor_id')::uuid;
    if not found then raise exception 'Proveedor no válido'; end if;
    insert into public.compras_revisiones(factura,proveedor_id,proveedor_nombre,mesa_id,encargado_id,encargado_nombre,asignado_por,asignador_nombre)
    values(trim(p_datos->>'factura'),proveedor.id,proveedor.nombre,mesa,operador.id,coalesce(operador.nombre,operador.email),u,nombre) returning * into r;
    destinatarios := array[r.encargado_id];
  else
    select * into r from public.compras_revisiones t where t.id=(p_datos->>'id')::uuid for update;
    if not found or (not es_admin and r.encargado_id<>u) then raise exception 'Revisión no disponible' using errcode='42501'; end if;
    if (p_datos->>'version')::integer is distinct from r.version then raise exception 'El registro cambió. Actualiza la página antes de continuar.' using errcode='40001'; end if;
    if r.estado='cerrado' then raise exception 'El registro está cerrado y no admite cambios'; end if;
    anterior := r.estado;
    if p_accion in ('iniciar','observar','finalizar') and r.encargado_id<>u then raise exception 'Solo el encargado puede realizar esta acción' using errcode='42501'; end if;
    if p_accion in ('devolver','cerrar','reasignar') and not es_admin then raise exception 'Solo un administrador puede realizar esta acción' using errcode='42501'; end if;
    case p_accion
      when 'iniciar' then
        if r.estado not in ('asignado','devuelto') then raise exception 'La revisión no se puede iniciar en este estado'; end if;
        r.estado:='en_revision'; r.iniciado_at:=coalesce(r.iniciado_at,now()); r.iniciado_por:=coalesce(r.iniciado_por,u); r.tramo_inicio:=now();
      when 'observar' then
        if r.estado<>'en_revision' then raise exception 'Las observaciones solo se agregan durante la revisión'; end if;
        detalle:=trim(p_datos->>'contenido');
        insert into public.compras_observaciones(revision_id,contenido,autor_id,autor_nombre) values(r.id,detalle,u,nombre);
      when 'finalizar' then
        if r.estado<>'en_revision' then raise exception 'Debes iniciar la revisión antes de finalizar'; end if;
        r.estado:='pendiente_cierre'; r.finalizado_at:=now(); r.finalizado_por:=u;
        r.segundos_revision:=r.segundos_revision+greatest(0,extract(epoch from now()-r.tramo_inicio)); r.tramo_inicio:=null;
        select coalesce(array_agg(p.id),'{}'::uuid[]) into destinatarios from public.perfiles p where p.rol='Admin' and p.estado='activo';
      when 'devolver' then
        if r.estado<>'pendiente_cierre' then raise exception 'Solo se pueden devolver revisiones pendientes de cierre'; end if;
        detalle:=trim(p_datos->>'motivo');
        if detalle is null or length(detalle) not between 1 and 4000 then raise exception 'Debes indicar el motivo de devolución'; end if;
        r.estado:='devuelto'; r.finalizado_at:=null; r.finalizado_por:=null; destinatarios:=array[r.encargado_id];
      when 'cerrar' then
        if r.estado<>'pendiente_cierre' then raise exception 'Solo se pueden cerrar revisiones pendientes de cierre'; end if;
        r.cpm:=trim(p_datos->>'cpm');
        if r.cpm is null or length(r.cpm) not between 1 and 100 then raise exception 'El número CPM es obligatorio para cerrar'; end if;
        r.estado:='cerrado'; r.cerrado_at:=now(); r.cerrado_por:=u; r.cerrador_nombre:=nombre;
      when 'reasignar' then
        if r.estado not in ('asignado','devuelto') then raise exception 'Solo se pueden reasignar revisiones asignadas o devueltas'; end if;
        detalle:=trim(p_datos->>'motivo');
        if detalle is null or length(detalle) not between 1 and 4000 then raise exception 'Debes indicar el motivo de reasignación'; end if;
        r.encargado_id:=operador.id; r.encargado_nombre:=coalesce(operador.nombre,operador.email); r.mesa_id:=mesa; r.estado:='asignado';
        destinatarios:=array[r.encargado_id];
      else raise exception 'Acción no válida';
    end case;
    r.version:=r.version+1; r.actualizado_at:=now();
    update public.compras_revisiones set estado=r.estado,version=r.version,actualizado_at=r.actualizado_at,
      encargado_id=r.encargado_id,encargado_nombre=r.encargado_nombre,mesa_id=r.mesa_id,
      iniciado_at=r.iniciado_at,iniciado_por=r.iniciado_por,tramo_inicio=r.tramo_inicio,finalizado_at=r.finalizado_at,finalizado_por=r.finalizado_por,
      cerrado_at=r.cerrado_at,cerrado_por=r.cerrado_por,cerrador_nombre=r.cerrador_nombre,cpm=r.cpm,segundos_revision=r.segundos_revision where id=r.id;
  end if;
  insert into public.compras_notificaciones(revision_id,destinatario_id,tipo,contexto)
    select r.id,d,p_accion,jsonb_build_object('factura',r.factura,'proveedor',r.proveedor_nombre,'mesa',r.mesa_id,'encargado',r.encargado_nombre,'fecha',now(),'motivo',detalle,
      'observaciones',(select coalesce(jsonb_agg(jsonb_build_object('contenido',o.contenido,'autor',o.autor_nombre,'fecha',o.creado_at) order by o.creado_at),'[]') from public.compras_observaciones o where o.revision_id=r.id))
    from unnest(destinatarios) d;
  insert into public.compras_historial(revision_id,evento,estado_anterior,estado_nuevo,actor_id,actor_nombre,detalle,datos)
    values(r.id,p_accion,anterior,r.estado,u,nombre,detalle,to_jsonb(r)||jsonb_build_object('notificados',destinatarios));
  return r.id;
end $$;

create function public.compras_mutar(p_accion text,p_datos jsonb) returns uuid language sql security invoker set search_path='' as $$
  select compras_private.mutar(p_accion,p_datos)
$$;

create function compras_private.operadores() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not compras_private.admin() then raise exception 'Solo un administrador puede consultar encargados' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'nombre',coalesce(nombre,email),'email',email) order by nombre),'[]')
    from public.perfiles where estado='activo' and rol='Operativo' and 'compras'=any(coalesce(modulos_permitidos,'{}'::text[])));
end $$;
create function public.compras_operadores() returns jsonb language sql stable security invoker set search_path='' as $$ select compras_private.operadores() $$;

create function compras_private.filtrados(p_filtros jsonb) returns setof public.compras_revisiones
language sql stable security invoker set search_path='' as $$
    select r.* from public.compras_revisiones r where
    (coalesce(p_filtros->>'factura','')='' or strpos(lower(r.factura),lower(p_filtros->>'factura'))>0)
    and (coalesce(p_filtros->>'cpm','')='' or strpos(lower(r.cpm),lower(p_filtros->>'cpm'))>0)
    and (nullif(p_filtros->>'proveedor_id','') is null or r.proveedor_id=(p_filtros->>'proveedor_id')::uuid)
    and (nullif(p_filtros->>'encargado_id','') is null or r.encargado_id=(p_filtros->>'encargado_id')::uuid)
    and (nullif(p_filtros->>'mesa_id','') is null or r.mesa_id=(p_filtros->>'mesa_id')::smallint)
    and (nullif(p_filtros->>'estado','') is null or r.estado=p_filtros->>'estado')
    and (nullif(p_filtros->>'desde','') is null or r.creado_at>=(p_filtros->>'desde')::date::timestamp at time zone 'America/Bogota')
    and (nullif(p_filtros->>'hasta','') is null or r.creado_at<((p_filtros->>'hasta')::date+1)::timestamp at time zone 'America/Bogota')
$$;

create function public.compras_consultar(p_filtros jsonb default '{}',p_pagina integer default 1,p_tamano integer default 25)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare resultado jsonb;
begin
  if not compras_private.permitido() then raise exception 'Sin permiso para Compras' using errcode='42501'; end if;
  if p_pagina is null or p_pagina<1 or p_tamano is null or p_tamano not between 1 and 500 then raise exception 'Paginación no válida'; end if;
  with filtrados as materialized (
    select * from compras_private.filtrados(p_filtros)
  ), pagina as (select * from filtrados order by creado_at desc,id limit p_tamano offset (p_pagina-1)::bigint*p_tamano)
  select jsonb_build_object('registros',(select coalesce(jsonb_agg(to_jsonb(p) order by p.creado_at desc,p.id),'[]') from pagina p),
    'total',count(*),'asignado',count(*) filter(where estado='asignado'),'en_revision',count(*) filter(where estado='en_revision'),
    'pendiente_cierre',count(*) filter(where estado='pendiente_cierre'),'devuelto',count(*) filter(where estado='devuelto'),'cerrado',count(*) filter(where estado='cerrado'),
    'promedio_segundos',coalesce(avg(segundos_revision) filter(where estado in ('pendiente_cierre','cerrado')),0),
    'por_mesa',(select coalesce(jsonb_agg(to_jsonb(m) order by m.mesa_id),'[]') from (select mesa_id,count(*) cantidad from filtrados group by mesa_id) m),
    'por_operador',(select coalesce(jsonb_agg(to_jsonb(o) order by o.nombre),'[]') from (select encargado_id,max(encargado_nombre) nombre,count(*) cantidad from filtrados group by encargado_id) o))
  into resultado from filtrados;
  return resultado;
end $$;

revoke all on all functions in schema compras_private from public, anon;
grant execute on function compras_private.permitido(), compras_private.admin(), compras_private.mutar(text,jsonb), compras_private.operadores() to authenticated;
revoke all on function public.compras_mutar(text,jsonb), public.compras_operadores(), public.compras_consultar(jsonb,integer,integer) from public,anon;
grant execute on function public.compras_mutar(text,jsonb), public.compras_operadores(), public.compras_consultar(jsonb,integer,integer) to authenticated;

-- Single statement snapshot: export all matching records and their audit trail.
create function public.compras_exportar(p_filtros jsonb default '{}') returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare resultado jsonb;
begin
  if not compras_private.admin() then raise exception 'Solo un administrador puede exportar reportes' using errcode='42501'; end if;
  with registros as materialized (select * from compras_private.filtrados(p_filtros))
  select jsonb_build_object(
    'registros',(select coalesce(jsonb_agg(to_jsonb(r) order by r.creado_at,r.id),'[]') from registros r),
    'observaciones',(select coalesce(jsonb_agg(to_jsonb(o) order by o.creado_at,o.id),'[]') from public.compras_observaciones o join registros r on r.id=o.revision_id),
    'historial',(select coalesce(jsonb_agg(to_jsonb(h) order by h.creado_at,h.id),'[]') from public.compras_historial h join registros r on r.id=h.revision_id)
  ) into resultado;
  return resultado;
end $$;
revoke all on function public.compras_exportar(jsonb) from public,anon;
grant execute on function public.compras_exportar(jsonb) to authenticated;
revoke all on function compras_private.filtrados(jsonb) from public,anon;
grant execute on function compras_private.filtrados(jsonb) to authenticated;
