-- ARCHIVO HISTORICO DE LA PROPUESTA REVISADA.
-- Aplicada tras autorizacion como 20261022210543_perfiles_alta_segura_revision.
-- No aplicar este duplicado; consultar supabase/migrations y APLICACION.md.
-- Generated with Supabase CLI; kept outside migrations to prevent automatic rollout.
-- Existing profiles, identities, roles, modules and warehouse memberships are untouched.
begin;
set local lock_timeout='2s';
set local statement_timeout='15s';
do $$
begin
 if to_regclass('public.perfiles') is null then raise exception 'Falta public.perfiles; detener y revisar el esquema'; end if;
 if not exists(select 1 from pg_trigger where tgname='on_auth_user_created'
  and tgrelid='auth.users'::regclass and not tgisinternal and tgenabled='O'
  and tgfoid=to_regprocedure('public.handle_new_user()')) then
  raise exception 'El trigger de perfiles no coincide con el revisado';
 end if;
end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 -- A display name may come from metadata; authorization never does.
 -- New accounts receive no modules. An existing authorized administrator must
 -- assign any role/module through the established administration workflow.
 insert into public.perfiles(id,email,nombre,rol,estado,modulos_permitidos)
 values(new.id,new.email,new.raw_user_meta_data->>'nombre','Operativo','activo','{}'::text[])
 on conflict(id) do nothing;
 return new;
end $$;
revoke all on function public.handle_new_user() from public,anon,authenticated,service_role;
commit;
