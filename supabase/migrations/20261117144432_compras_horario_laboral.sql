-- Pure calendar calculation in Bogota. Saturdays count as one shorter workday.
create function compras_private.tramo_laboral(inicio timestamptz, fin timestamptz)
returns table(segundos numeric, jornadas numeric)
language sql stable security invoker set search_path='' as $$
  with dias as (
    select (inicio at time zone 'America/Bogota')::date + n as dia
    from generate_series(0,(fin at time zone 'America/Bogota')::date-(inicio at time zone 'America/Bogota')::date) n
    where inicio is not null and fin > inicio
  ), ventanas as (
    select dia, extract(isodow from dia) dow, t.* from dias
    cross join lateral (values
      (time '08:20',time '12:00'),
      (case when extract(isodow from dia)=6 then time '13:00' else time '13:30' end,
       case when extract(isodow from dia)=6 then time '15:00' else time '17:00' end)
    ) t(desde,hasta) where extract(isodow from dia)<>7
  ), partes as (
    select dow,greatest(0,extract(epoch from
      least(fin,(dia+hasta) at time zone 'America/Bogota')-
      greatest(inicio,(dia+desde) at time zone 'America/Bogota'))) s from ventanas
  ) select coalesce(sum(s),0),coalesce(sum(s/case when dow=6 then 20400 else 25800 end),0) from partes
$$;
revoke all on function compras_private.tramo_laboral(timestamptz,timestamptz) from public,anon;
grant execute on function compras_private.tramo_laboral(timestamptz,timestamptz) to authenticated;

-- Reconstruct completed work from immutable events; never rewrite old audit data.
create function compras_private.tiempo_revision(r public.compras_revisiones)
returns jsonb language sql stable security invoker set search_path='' as $$
  with eventos as (
    select evento,creado_at,
      lead(evento) over(order by (datos->>'version')::int) siguiente,
      lead(creado_at) over(order by (datos->>'version')::int) fin
    from public.compras_historial where revision_id=r.id and evento in ('iniciar','finalizar')
  ), tramos as (
    select creado_at inicio,fin from eventos where evento='iniciar' and siguiente='finalizar'
    union all select r.tramo_inicio,now() where r.estado='en_revision' and r.tramo_inicio is not null
  ), totales as (
    select coalesce(sum(t.segundos),0) segundos,coalesce(sum(t.jornadas),0) jornadas
    from tramos cross join lateral compras_private.tramo_laboral(inicio,fin) t
  ) select jsonb_build_object('segundos_laborales',segundos,'jornadas_laborales',jornadas,
      'vencida',round(jornadas,10)>2) from totales
$$;
revoke all on function compras_private.tiempo_revision(public.compras_revisiones) from public,anon;
grant execute on function compras_private.tiempo_revision(public.compras_revisiones) to authenticated;

create function public.compras_tiempo(p_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select compras_private.tiempo_revision(r) from public.compras_revisiones r
  where r.id=p_id and compras_private.permitido()
$$;
revoke all on function public.compras_tiempo(uuid) from public,anon;
grant execute on function public.compras_tiempo(uuid) to authenticated;

create or replace function public.compras_consultar(p_filtros jsonb default '{}',p_pagina integer default 1,p_tamano integer default 25)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare resultado jsonb;
begin
  if not compras_private.permitido() then raise exception 'Sin permiso para Compras' using errcode='42501'; end if;
  if p_pagina is null or p_pagina<1 or p_tamano is null or p_tamano not between 1 and 500 then raise exception 'Paginación no válida'; end if;
  with filtrados as materialized (
    select r.*,compras_private.tiempo_revision(r) tiempo from compras_private.filtrados(p_filtros) r
  ), pagina as (select * from filtrados order by creado_at desc,id limit p_tamano offset (p_pagina-1)::bigint*p_tamano)
  select jsonb_build_object('registros',(select coalesce(jsonb_agg((to_jsonb(p)-'tiempo'||p.tiempo) order by p.creado_at desc,p.id),'[]') from pagina p),
    'total',count(*),'total_articulos',coalesce(sum(numero_articulos),0),'sin_numero_articulos',count(*) filter(where numero_articulos is null),'asignado',count(*) filter(where estado='asignado'),'en_revision',count(*) filter(where estado='en_revision'),
    'pendiente_cierre',count(*) filter(where estado='pendiente_cierre'),'devuelto',count(*) filter(where estado='devuelto'),'cerrado',count(*) filter(where estado='cerrado'),
    'vencidas',count(*) filter(where (tiempo->>'vencida')::boolean),'promedio_segundos',coalesce(avg((tiempo->>'segundos_laborales')::numeric) filter(where estado in ('pendiente_cierre','cerrado')),0),
    'por_mesa',(select coalesce(jsonb_agg(to_jsonb(m) order by m.mesa_id),'[]') from (select mesa_id,count(*) cantidad from filtrados group by mesa_id) m),
    'por_operador',(select coalesce(jsonb_agg(to_jsonb(o) order by o.nombre),'[]') from (select encargado_id,encargado_persona_id,max(encargado_nombre) nombre,count(*) cantidad from filtrados group by encargado_id,encargado_persona_id) o))
  into resultado from filtrados;
  return resultado;
end $$;

create or replace function public.compras_exportar(p_filtros jsonb default '{}') returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare resultado jsonb;
begin
  if not compras_private.admin() then raise exception 'Solo un administrador puede exportar reportes' using errcode='42501'; end if;
  with registros as materialized (select r.*,compras_private.tiempo_revision(r) tiempo from compras_private.filtrados(p_filtros) r)
  select jsonb_build_object(
    'registros',(select coalesce(jsonb_agg((to_jsonb(r)-'tiempo'||r.tiempo) order by r.creado_at,r.id),'[]') from registros r),
    'observaciones',(select coalesce(jsonb_agg(to_jsonb(o) order by o.creado_at,o.id),'[]') from public.compras_observaciones o join registros r on r.id=o.revision_id),
    'historial',(select coalesce(jsonb_agg(to_jsonb(h) order by h.creado_at,h.id),'[]') from public.compras_historial h join registros r on r.id=h.revision_id)
  ) into resultado;
  return resultado;
end $$;
