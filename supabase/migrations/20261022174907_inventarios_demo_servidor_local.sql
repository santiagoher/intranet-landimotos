-- Restrict shared-project DEMO to requests signed by the authorized local server.
-- No secret or activation is embedded in this migration.
begin;
set local lock_timeout='2s';
set local statement_timeout='15s';
alter table inventario_private.demo_entorno add column server_key_sha256 text
 check(server_key_sha256 is null or server_key_sha256 ~ '^[a-f0-9]{64}$');
create or replace function inventario_private.demo_activo() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select enabled and server_key_sha256 is not null
 and server_key_sha256=encode(sha256(convert_to(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-inventory-demo-key',''),'UTF8')),'hex')
 from inventario_private.demo_entorno where singleton),false)
$$;
revoke all on function inventario_private.demo_activo() from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
