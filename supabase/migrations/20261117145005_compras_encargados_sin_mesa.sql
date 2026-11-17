create or replace function compras_private.operadores() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not compras_private.admin() then raise exception 'Solo un administrador puede consultar encargados' using errcode='42501'; end if;
  return (select coalesce(jsonb_agg(to_jsonb(t) order by t.nombre),'[]') from (
    select p.id,e.nombre,p.email,e.id persona_id,e.mesa_id from public.compras_encargados e join public.perfiles p on p.id=e.perfil_id
    where e.activo and p.estado='activo' and p.rol='Operativo' and 'compras'=any(coalesce(p.modulos_permitidos,'{}'::text[]))
    union all
    select p.id,coalesce(p.nombre,p.email),p.email,null::uuid,null::smallint from public.perfiles p
    where p.estado='activo' and p.rol='Operativo' and 'compras'=any(coalesce(p.modulos_permitidos,'{}'::text[]))
      and not exists(select 1 from public.compras_encargados e where e.perfil_id=p.id)
      and not exists(select 1 from public.compras_administradores a where a.perfil_id=p.id and a.activo)
  ) t);
end $$;

