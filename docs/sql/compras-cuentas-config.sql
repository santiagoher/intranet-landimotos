-- Requested on 2026-11-17. Auth accounts must be created using the Auth Admin API.
-- The named staff share one login; names identify assignments, not authentication.
begin;
do $$ begin
  if (select count(*) from public.perfiles where lower(email) in ('admincompras@gmail.com','registrocompras@gmail.com'))<>2 then
    raise exception 'Primero deben existir las dos cuentas solicitadas';
  end if;
end $$;
update public.perfiles set nombre='Camilo Pulido',rol='Operativo',estado='activo',modulos_permitidos=array['compras']
  where lower(email)='admincompras@gmail.com';
update public.perfiles set nombre='Registro Compras',rol='Operativo',estado='activo',modulos_permitidos=array['compras']
  where lower(email)='registrocompras@gmail.com';
insert into public.compras_administradores(perfil_id,activo)
  select id,true from public.perfiles where lower(email)='admincompras@gmail.com'
  on conflict(perfil_id) do update set activo=true;
insert into public.compras_encargados(perfil_id,nombre)
  select p.id,e.nombre from public.perfiles p cross join (values
    ('Ángel Pachón'),('Holman Rojas'),('Juan Carlos Mosquera'),('Nelson Pérez')
  ) e(nombre) where lower(p.email)='registrocompras@gmail.com'
  on conflict(perfil_id,nombre) do nothing;
insert into public.compras_encargados(perfil_id,nombre)
  select id,'Camilo Pulido' from public.perfiles where lower(email)='admincompras@gmail.com'
  on conflict(perfil_id,nombre) do nothing;
commit;
