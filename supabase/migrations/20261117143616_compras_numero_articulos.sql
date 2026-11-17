-- Existing invoices remain NULL: unknown counts are never invented or set to zero.
alter table public.compras_revisiones add column numero_articulos integer check(numero_articulos > 0);

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
    if jsonb_typeof(p_datos->'numero_articulos') is distinct from 'number' or coalesce(p_datos->>'numero_articulos','') !~ '^[1-9][0-9]*$' then
      raise exception 'El número de artículos es obligatorio y debe ser un entero mayor que cero';
    end if;
    if (p_datos->>'numero_articulos')::numeric > 2147483647 then
      raise exception 'El número de artículos supera el máximo permitido';
    end if;
    select * into proveedor from public.compras_proveedores p where p.id=(p_datos->>'proveedor_id')::uuid and p.activo;
    if not found then raise exception 'Proveedor no válido'; end if;
    insert into public.compras_revisiones(numero_articulos,factura,proveedor_id,proveedor_nombre,mesa_id,encargado_id,encargado_nombre,encargado_persona_id,asignado_por,asignador_nombre)
    values((p_datos->>'numero_articulos')::integer,trim(p_datos->>'factura'),proveedor.id,proveedor.nombre,mesa,operador.id,coalesce(persona.nombre,operador.nombre,operador.email),persona.id,u,nombre) returning * into r;
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
    'total',count(*),'total_articulos',coalesce(sum(numero_articulos),0),'sin_numero_articulos',count(*) filter(where numero_articulos is null),'asignado',count(*) filter(where estado='asignado'),'en_revision',count(*) filter(where estado='en_revision'),
    'pendiente_cierre',count(*) filter(where estado='pendiente_cierre'),'devuelto',count(*) filter(where estado='devuelto'),'cerrado',count(*) filter(where estado='cerrado'),
    'promedio_segundos',coalesce(avg(segundos_revision) filter(where estado in ('pendiente_cierre','cerrado')),0),
    'por_mesa',(select coalesce(jsonb_agg(to_jsonb(m) order by m.mesa_id),'[]') from (select mesa_id,count(*) cantidad from filtrados group by mesa_id) m),
    'por_operador',(select coalesce(jsonb_agg(to_jsonb(o) order by o.nombre),'[]') from (select encargado_id,encargado_persona_id,max(encargado_nombre) nombre,count(*) cantidad from filtrados group by encargado_id,encargado_persona_id) o))
  into resultado from filtrados;
  return resultado;
end $$;
