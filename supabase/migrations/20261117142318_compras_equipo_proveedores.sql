-- Purchases-only administrators; platform Admin keeps its existing authority.
create table public.compras_administradores (
  perfil_id uuid primary key references public.perfiles(id), activo boolean not null default true,
  creado_at timestamptz not null default now()
);
alter table public.compras_administradores enable row level security;
revoke all on public.compras_administradores from anon, authenticated;
grant select on public.compras_administradores to authenticated;
create policy compras_admin_lectura on public.compras_administradores for select to authenticated
  using (perfil_id=(select auth.uid()) or (select compras_private.admin()));

create or replace function compras_private.admin() returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.perfiles p where p.id=auth.uid() and p.estado='activo'
    and (p.rol='Admin' or ('compras'=any(coalesce(p.modulos_permitidos,'{}'::text[])) and exists(
      select 1 from public.compras_administradores a where a.perfil_id=p.id and a.activo))))
$$;
create function public.compras_es_admin() returns boolean language sql stable security invoker set search_path='' as $$ select compras_private.admin() $$;
revoke all on function public.compras_es_admin() from public,anon;
grant execute on function public.compras_es_admin() to authenticated;

alter table public.compras_proveedores add column nit text check(nit ~ '^[0-9]{5,15}$');
alter table public.compras_proveedores add column activo boolean not null default true;
alter table public.compras_proveedores add column origen text not null default 'manual' check(origen in ('manual','importacion'));
alter table public.compras_proveedores alter column creado_por drop not null;
alter table public.compras_proveedores add constraint compras_proveedor_autor check(creado_por is not null or origen='importacion');
create unique index compras_proveedores_nit on public.compras_proveedores(nit) where nit is not null;

-- Named assignees are not authentication identities. Several may share a login.
create table public.compras_encargados (
  id uuid primary key default gen_random_uuid(), perfil_id uuid not null references public.perfiles(id),
  nombre text not null check(length(trim(nombre)) between 2 and 150),
  mesa_id smallint references public.compras_mesas(id), activo boolean not null default true,
  version integer not null default 1, actualizado_at timestamptz not null default now(),
  actualizado_por uuid references public.perfiles(id), unique(perfil_id,nombre)
);
create index compras_encargados_mesa on public.compras_encargados(mesa_id);
create index compras_encargados_actualizador on public.compras_encargados(actualizado_por);
alter table public.compras_encargados enable row level security;
revoke all on public.compras_encargados from anon,authenticated;
grant select on public.compras_encargados to authenticated;
create policy compras_equipo_lectura on public.compras_encargados for select to authenticated
  using ((select compras_private.permitido()) and ((select compras_private.admin()) or perfil_id=(select auth.uid())));
alter table public.compras_revisiones add column encargado_persona_id uuid references public.compras_encargados(id);
create index compras_revisiones_persona on public.compras_revisiones(encargado_persona_id,creado_at desc);

create table public.compras_equipo_historial (
  id uuid primary key default gen_random_uuid(), encargado_id uuid not null references public.compras_encargados(id),
  actor_id uuid not null references public.perfiles(id), anterior jsonb not null, nuevo jsonb not null,
  creado_at timestamptz not null default now()
);
create index compras_equipo_historial_encargado on public.compras_equipo_historial(encargado_id,creado_at);
create index compras_equipo_historial_actor on public.compras_equipo_historial(actor_id);
alter table public.compras_equipo_historial enable row level security;
revoke all on public.compras_equipo_historial from anon,authenticated;
grant select on public.compras_equipo_historial to authenticated;
create policy compras_equipo_historial_lectura on public.compras_equipo_historial for select to authenticated using ((select compras_private.admin()));

create function compras_private.guardar_mesa(p_id uuid,p_mesa smallint,p_activo boolean,p_version integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare anterior public.compras_encargados; nuevo public.compras_encargados;
begin
  if not compras_private.admin() then raise exception 'Solo un administrador de Compras puede asignar mesas' using errcode='42501'; end if;
  if p_activo is null or (p_mesa is not null and not exists(select 1 from public.compras_mesas where id=p_mesa)) then raise exception 'Mesa no válida'; end if;
  select * into anterior from public.compras_encargados where id=p_id for update;
  if not found then raise exception 'Encargado no disponible'; end if;
  if anterior.version is distinct from p_version then raise exception 'La asignación cambió. Actualiza antes de guardar.' using errcode='40001'; end if;
  update public.compras_encargados set mesa_id=p_mesa,activo=p_activo,version=version+1,actualizado_at=now(),actualizado_por=auth.uid()
    where id=p_id returning * into nuevo;
  insert into public.compras_equipo_historial(encargado_id,actor_id,anterior,nuevo) values(p_id,auth.uid(),to_jsonb(anterior),to_jsonb(nuevo));
  return p_id;
end $$;
create function public.compras_guardar_mesa(p_id uuid,p_mesa smallint,p_activo boolean,p_version integer) returns uuid language sql security invoker set search_path='' as $$
  select compras_private.guardar_mesa(p_id,p_mesa,p_activo,p_version)
$$;
revoke all on function compras_private.guardar_mesa(uuid,smallint,boolean,integer),public.compras_guardar_mesa(uuid,smallint,boolean,integer) from public,anon;
grant execute on function compras_private.guardar_mesa(uuid,smallint,boolean,integer),public.compras_guardar_mesa(uuid,smallint,boolean,integer) to authenticated;

create or replace function compras_private.operadores() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not compras_private.admin() then raise exception 'Solo un administrador puede consultar encargados' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(t) order by t.nombre),'[]') from (
    select p.id,e.nombre,p.email,e.id persona_id,e.mesa_id from public.compras_encargados e join public.perfiles p on p.id=e.perfil_id
    where e.activo and e.mesa_id is not null and p.estado='activo' and p.rol='Operativo' and 'compras'=any(coalesce(p.modulos_permitidos,'{}'::text[]))
    union all
    select p.id,coalesce(p.nombre,p.email),p.email,null::uuid,null::smallint from public.perfiles p
    where p.estado='activo' and p.rol='Operativo' and 'compras'=any(coalesce(p.modulos_permitidos,'{}'::text[]))
      and not exists(select 1 from public.compras_encargados e where e.perfil_id=p.id)
      and not exists(select 1 from public.compras_administradores a where a.perfil_id=p.id and a.activo)
  ) t);
end $$;

create or replace function compras_private.mutar(p_accion text, p_datos jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  u uuid := auth.uid(); es_admin boolean; nombre text; r public.compras_revisiones;
  anterior text; detalle text; destinatarios uuid[] := '{}'; resultado uuid;
  operador public.perfiles; proveedor public.compras_proveedores; mesa smallint; persona public.compras_encargados;
begin
  if u is null or not compras_private.permitido() then raise exception 'Sin permiso para Compras' using errcode='42501'; end if;
  es_admin := compras_private.admin();
  select coalesce(nullif(p.nombre,''),p.email,'Usuario') into nombre from public.perfiles p where p.id=u;
  if p_accion='proveedor' then
    if not es_admin then raise exception 'Solo un administrador puede crear proveedores' using errcode='42501'; end if;
    insert into public.compras_proveedores(nombre,nit,creado_por) values(trim(p_datos->>'nombre'),nullif(trim(p_datos->>'nit'),''),u) returning id into resultado;
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
    if nullif(p_datos->>'encargado_persona_id','') is not null then
      select * into persona from public.compras_encargados e where e.id=(p_datos->>'encargado_persona_id')::uuid and e.activo for share;
      if not found or persona.mesa_id is null or persona.perfil_id is distinct from (p_datos->>'encargado_id')::uuid or persona.mesa_id is distinct from (p_datos->>'mesa_id')::smallint then
        raise exception 'El encargado y la mesa deben coincidir con la configuracion del equipo';
      end if;
    elsif exists(select 1 from public.compras_encargados e where e.perfil_id=(p_datos->>'encargado_id')::uuid) then
      raise exception 'Selecciona un encargado del equipo para esta cuenta compartida';
    end if;
    select * into operador from public.perfiles p where p.id=(p_datos->>'encargado_id')::uuid
      and p.estado='activo' and p.rol='Operativo' and 'compras'=any(coalesce(p.modulos_permitidos,'{}'::text[])) for share;
    if not found then raise exception 'El encargado debe ser un usuario operativo activo con Compras habilitado'; end if;
    mesa := (p_datos->>'mesa_id')::smallint;
    if mesa is null or not exists(select 1 from public.compras_mesas m where m.id=mesa) then raise exception 'Mesa no válida'; end if;
  end if;
  if p_accion='crear' then
    select * into proveedor from public.compras_proveedores p where p.id=(p_datos->>'proveedor_id')::uuid and p.activo;
    if not found then raise exception 'Proveedor no válido'; end if;
    insert into public.compras_revisiones(factura,proveedor_id,proveedor_nombre,mesa_id,encargado_id,encargado_nombre,encargado_persona_id,asignado_por,asignador_nombre)
    values(trim(p_datos->>'factura'),proveedor.id,proveedor.nombre,mesa,operador.id,coalesce(persona.nombre,operador.nombre,operador.email),persona.id,u,nombre) returning * into r;
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
        select coalesce(array_agg(p.id),'{}'::uuid[]) into destinatarios from public.perfiles p where p.estado='activo' and (p.rol='Admin' or ('compras'=any(coalesce(p.modulos_permitidos,'{}'::text[])) and exists(select 1 from public.compras_administradores a where a.perfil_id=p.id and a.activo)));
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
        r.encargado_id:=operador.id; r.encargado_nombre:=coalesce(persona.nombre,operador.nombre,operador.email); r.encargado_persona_id:=persona.id; r.mesa_id:=mesa; r.estado:='asignado';
        destinatarios:=array[r.encargado_id];
      else raise exception 'Acción no válida';
    end case;
    r.version:=r.version+1; r.actualizado_at:=now();
    update public.compras_revisiones set estado=r.estado,version=r.version,actualizado_at=r.actualizado_at,
      encargado_id=r.encargado_id,encargado_nombre=r.encargado_nombre,encargado_persona_id=r.encargado_persona_id,mesa_id=r.mesa_id,
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

create or replace function compras_private.filtrados(p_filtros jsonb) returns setof public.compras_revisiones
language sql stable security invoker set search_path='' as $$
    select r.* from public.compras_revisiones r where
    (coalesce(p_filtros->>'factura','')='' or strpos(lower(r.factura),lower(p_filtros->>'factura'))>0)
    and (coalesce(p_filtros->>'cpm','')='' or strpos(lower(r.cpm),lower(p_filtros->>'cpm'))>0)
    and (nullif(p_filtros->>'proveedor_id','') is null or r.proveedor_id=(p_filtros->>'proveedor_id')::uuid)
    and (nullif(p_filtros->>'encargado_id','') is null or r.encargado_id=(p_filtros->>'encargado_id')::uuid)
    and (nullif(p_filtros->>'encargado_persona_id','') is null or r.encargado_persona_id=(p_filtros->>'encargado_persona_id')::uuid)
    and (nullif(p_filtros->>'mesa_id','') is null or r.mesa_id=(p_filtros->>'mesa_id')::smallint)
    and (nullif(p_filtros->>'estado','') is null or r.estado=p_filtros->>'estado')
    and (nullif(p_filtros->>'desde','') is null or r.creado_at>=(p_filtros->>'desde')::date::timestamp at time zone 'America/Bogota')
    and (nullif(p_filtros->>'hasta','') is null or r.creado_at<((p_filtros->>'hasta')::date+1)::timestamp at time zone 'America/Bogota')
$$;

create or replace function public.compras_consultar(p_filtros jsonb default '{}',p_pagina integer default 1,p_tamano integer default 25)
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
    'por_operador',(select coalesce(jsonb_agg(to_jsonb(o) order by o.nombre),'[]') from (select encargado_id,encargado_persona_id,max(encargado_nombre) nombre,count(*) cantidad from filtrados group by encargado_id,encargado_persona_id) o))
  into resultado from filtrados;
  return resultado;
end $$;

-- Import only the supplied active list. Preserve existing IDs and invoices.
with incoming(nit,nombre) as (values ('7698579','CARRILLO MOSQUERA JOHN ROBERTO'),
('14229583','ALMACEN EXPOMOTO*'),
('71274780','MOLINA PELAEZ CARLOS ANDRES'),
('800020772','EMPAQUETADURAS DARROW S.A.S.'),
('800128680','REENCAFE S.A.S'),
('800186960','ALTIPAL S.A.S.'),
('800203984','SIMONIZCO'),
('800215562','LUBRIRETENES Y RODAMENTOS S.A'),
('810002278','PLASTIGOMA S.A.S'),
('811011909','IGB MOTORCYCLE PARTS S.A.S'),
('811022876','OSAKA S.A.S.'),
('816008064','DUNA S.A.S'),
('822004416','TECNOLUBRICANTES DEL LLANO LTDA'),
('830115250','RODAMUNDI SAS'),
('830143066','CHOHO COLOMBIA S.A.S'),
('860051404','INDUMMELBRA S.A,S.INDUSTRIAS METALMECANICAS BRA'),
('860076279','OMNIPARTS S.A.S.'),
('860080144','COMPAÑIA DE LUBRICANTES S.A'),
('860350170','PROMOTORA INTERNACIONAL DE PARTES S A S PROPARTES'),
('860524955','INDUSTRIAS JAPAN S.A'),
('890201311','LEN IMPORTACIONES LIMITADA'),
('890300225','COEXITO S.A.S.'),
('890301886','FABRICA NACIONAL DE AUTOPARTES S.A. FANALCA S.A.'),
('890304140','IMPORTADORA CALI S.A'),
('890900317','AUTOTECNICA COLOMBIANA S.A.S.'),
('890900943','COLOMBIANA DE COMERCIO S.A / AKT MOTOS'),
('890905360','HA BICICLETAS SA'),
('890916911','INDUSTRIA COLOMBIANA DE MOTOCICLETAS YAMAHA S.A.'),
('890920782','ALMACENES Y TALLERES MOTO PRECISION S.A. / ATMOPEL'),
('891409006','GERMAN GAVIRIA S.A.S. DISTRIMOTOS'),
('891409088','AYCO LTDA'),
('891411213','INTEGRANDO S.A.S.'),
('900051824','A.R. EXPORTING QUALITY E.U.'),
('900067275','MEGACOMERCIAL S.A.S'),
('900153867','IMPORTADORA OKLA S.A.S.'),
('900157856','REYPAR MOTOS S.A.S'),
('900164838','FP MOTO SAS'),
('900297227','GRUPO EMPRESARIAL DISCOVERY S.A.S.'),
('900440961','COMERCIALIZADORA YOKOMAR S.A.S.'),
('900463324','INDUSTRIAS OVI & PROTAPER S.A.S'),
('900482123','DISANMOTOS S.A.S'),
('900555677','LOGISPART S.A.S'),
('900576528','IMPORTADORA JOTAPARTES S.A.S'),
('900690999','REDPLAS S.A.S'),
('900732297','SWISSLUB S.A.S'),
('900940814','PARTNECOL S.A.S'),
('900956384','DURAMAX'),
('901017204','VAOX GROUP COLOMBIA S.A.S'),
('901059786','VICAL GROUP S.A.S'),
('901249413','AUTECO MOBILITY S.A.S.'),
('901261048','GRUPO UMA S.A.S (SI)'),
('901298088','IMPORTADORA MOTOFOX SAS'),
('901311079','KALCOS COLOMBIA JYK PARTS SAS'),
('901319991','IMPORTADORA LA SAGRADA FAMILIA S.A.S'),
('901345675','ROLPARTS SAS'),
('901368337','GEES GLOBAL S.A.S'),
('901465474','SOCIEDAD IMPORTADORA Y DISTRIBUIDORA JAPAN Y RACING S.A.S.'),
('901528333','REPUESTOS UMA SAS'),
('901545125','MOTOPARTS SOLUTIONS S.A.S'),
('901563921','MOTOSHOPPER COLOMBIA SAS'),
('901570033','MOTORAMAX SAS'),
('901622583','SISTEMAS ELECTRICOS M&M SAS'),
('901655967','ANDINA SERVICIOS Y SUMINISTROS SAS'),
('901718922','SUN PARTS A.R SAS'),
('901785148','GLOBAL LUJOS Y ACCESORIOS S.A.S'),
('901806288','MOTOS DE OCCIDENTE MDO SAS'),
('901953530','ACRIMOTOS W & A SAS'),
('902061872','IMPORTADORA ONLYPARTS JH SAS'),
('1033680488','ORTIZ MONTEALEGRE YEISSON ANDRES'))
update public.compras_proveedores p set nit=i.nit,activo=true from incoming i where lower(trim(p.nombre))=lower(trim(i.nombre)) and p.nit is null;
with incoming(nit,nombre) as (values ('7698579','CARRILLO MOSQUERA JOHN ROBERTO'),
('14229583','ALMACEN EXPOMOTO*'),
('71274780','MOLINA PELAEZ CARLOS ANDRES'),
('800020772','EMPAQUETADURAS DARROW S.A.S.'),
('800128680','REENCAFE S.A.S'),
('800186960','ALTIPAL S.A.S.'),
('800203984','SIMONIZCO'),
('800215562','LUBRIRETENES Y RODAMENTOS S.A'),
('810002278','PLASTIGOMA S.A.S'),
('811011909','IGB MOTORCYCLE PARTS S.A.S'),
('811022876','OSAKA S.A.S.'),
('816008064','DUNA S.A.S'),
('822004416','TECNOLUBRICANTES DEL LLANO LTDA'),
('830115250','RODAMUNDI SAS'),
('830143066','CHOHO COLOMBIA S.A.S'),
('860051404','INDUMMELBRA S.A,S.INDUSTRIAS METALMECANICAS BRA'),
('860076279','OMNIPARTS S.A.S.'),
('860080144','COMPAÑIA DE LUBRICANTES S.A'),
('860350170','PROMOTORA INTERNACIONAL DE PARTES S A S PROPARTES'),
('860524955','INDUSTRIAS JAPAN S.A'),
('890201311','LEN IMPORTACIONES LIMITADA'),
('890300225','COEXITO S.A.S.'),
('890301886','FABRICA NACIONAL DE AUTOPARTES S.A. FANALCA S.A.'),
('890304140','IMPORTADORA CALI S.A'),
('890900317','AUTOTECNICA COLOMBIANA S.A.S.'),
('890900943','COLOMBIANA DE COMERCIO S.A / AKT MOTOS'),
('890905360','HA BICICLETAS SA'),
('890916911','INDUSTRIA COLOMBIANA DE MOTOCICLETAS YAMAHA S.A.'),
('890920782','ALMACENES Y TALLERES MOTO PRECISION S.A. / ATMOPEL'),
('891409006','GERMAN GAVIRIA S.A.S. DISTRIMOTOS'),
('891409088','AYCO LTDA'),
('891411213','INTEGRANDO S.A.S.'),
('900051824','A.R. EXPORTING QUALITY E.U.'),
('900067275','MEGACOMERCIAL S.A.S'),
('900153867','IMPORTADORA OKLA S.A.S.'),
('900157856','REYPAR MOTOS S.A.S'),
('900164838','FP MOTO SAS'),
('900297227','GRUPO EMPRESARIAL DISCOVERY S.A.S.'),
('900440961','COMERCIALIZADORA YOKOMAR S.A.S.'),
('900463324','INDUSTRIAS OVI & PROTAPER S.A.S'),
('900482123','DISANMOTOS S.A.S'),
('900555677','LOGISPART S.A.S'),
('900576528','IMPORTADORA JOTAPARTES S.A.S'),
('900690999','REDPLAS S.A.S'),
('900732297','SWISSLUB S.A.S'),
('900940814','PARTNECOL S.A.S'),
('900956384','DURAMAX'),
('901017204','VAOX GROUP COLOMBIA S.A.S'),
('901059786','VICAL GROUP S.A.S'),
('901249413','AUTECO MOBILITY S.A.S.'),
('901261048','GRUPO UMA S.A.S (SI)'),
('901298088','IMPORTADORA MOTOFOX SAS'),
('901311079','KALCOS COLOMBIA JYK PARTS SAS'),
('901319991','IMPORTADORA LA SAGRADA FAMILIA S.A.S'),
('901345675','ROLPARTS SAS'),
('901368337','GEES GLOBAL S.A.S'),
('901465474','SOCIEDAD IMPORTADORA Y DISTRIBUIDORA JAPAN Y RACING S.A.S.'),
('901528333','REPUESTOS UMA SAS'),
('901545125','MOTOPARTS SOLUTIONS S.A.S'),
('901563921','MOTOSHOPPER COLOMBIA SAS'),
('901570033','MOTORAMAX SAS'),
('901622583','SISTEMAS ELECTRICOS M&M SAS'),
('901655967','ANDINA SERVICIOS Y SUMINISTROS SAS'),
('901718922','SUN PARTS A.R SAS'),
('901785148','GLOBAL LUJOS Y ACCESORIOS S.A.S'),
('901806288','MOTOS DE OCCIDENTE MDO SAS'),
('901953530','ACRIMOTOS W & A SAS'),
('902061872','IMPORTADORA ONLYPARTS JH SAS'),
('1033680488','ORTIZ MONTEALEGRE YEISSON ANDRES'))
insert into public.compras_proveedores(nit,nombre,activo,origen,creado_por) select nit,nombre,true,'importacion',null from incoming
on conflict(nit) where nit is not null do update set nombre=excluded.nombre,activo=true;
