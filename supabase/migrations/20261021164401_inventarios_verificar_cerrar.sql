begin;
-- Both decisions run in one transaction and emit one business audit event.
create function inventario_private.revisar_conteo(p_ticket uuid,p_version integer,p_accion text,p_nota text)
returns void language plpgsql security definer set search_path='' as $$
declare t public.inventario_tickets; diferencias boolean; destino text;
begin
 select * into t from public.inventario_tickets where id=p_ticket for update;
 if t.id is null or coalesce(inventario_private.rol_bodega(t.bodega_id),'')<>'lider'
 or not inventario_private.puede_leer_ticket(t.id) or t.asignado_a=auth.uid() then
  raise exception 'Solo un líder distinto del operador puede revisar este inventario' using errcode='42501';
 end if;
 if p_version is null or p_version<>t.version then raise exception 'La tarea cambió. Actualiza antes de continuar' using errcode='40001'; end if;
 if t.modo<>'categoria' or t.estado not in ('enviado_verificacion','en_verificacion','verificado_sin_diferencias','verificado_con_diferencias') then raise exception 'Este inventario no está pendiente de revisión'; end if;
 if p_accion is null or p_accion not in ('verificar_cerrar','devolver') or length(btrim(coalesce(p_nota,'')))=0 or length(p_nota)>2000 then raise exception 'Indica una observación de revisión de hasta 2000 caracteres'; end if;
 if p_accion='verificar_cerrar' then
  if not exists(select 1 from public.inventario_tarea_productos where ticket_id=t.id)
  or exists(select 1 from public.inventario_tarea_productos p left join inventario_private.referencias_producto r on r.producto_id=p.id
   where p.ticket_id=t.id and (p.cantidad_contada is null or r.producto_id is null)) then
   raise exception 'Faltan conteos o cantidades de referencia. No se puede determinar el resultado todavía';
  end if;
  select exists(select 1 from public.inventario_tarea_productos p join inventario_private.referencias_producto r on r.producto_id=p.id
   where p.ticket_id=t.id and p.cantidad_contada<>r.cantidad) into diferencias;
  -- Preserve existing result and evidence triggers. Intermediate state is never committed separately.
  update public.inventario_tickets set estado=case when diferencias then 'verificado_con_diferencias' else 'verificado_sin_diferencias' end where id=t.id;
  destino:='cerrado';
  update public.inventario_tickets set estado=destino,version=version+1,lider_id=auth.uid(),
   recibido_at=coalesce(recibido_at,now()),verificacion_iniciada_at=coalesce(verificacion_iniciada_at,now()),
   verificacion_finalizada_at=now(),cerrado_at=now(),cierre_con_diferencias=diferencias,justificacion_cierre=case when diferencias then btrim(p_nota) else null end where id=t.id;
 else
  destino:='en_proceso';
  update public.inventario_tarea_productos set cantidad_contada=null,contado_por=null,contado_at=null where ticket_id=t.id;
  update public.inventario_tickets set estado=destino,version=version+1,lider_id=auth.uid(),productos_contados=0,avance_parcial=25,
   enviado_at=null,verificacion_iniciada_at=null,verificacion_finalizada_at=null,cerrado_at=null,
   cierre_con_diferencias=false,justificacion_cierre=null where id=t.id;
 end if;
 insert into public.inventario_auditoria(bodega_id,ticket_id,actor_id,actor_original_id,actor_rol,evento,entidad_tipo,entidad_id,estado_anterior,estado_nuevo,motivo,operacion_clave)
 values(t.bodega_id,t.id,auth.uid(),auth.uid(),'lider',
  case when p_accion='devolver' then 'devolver' when diferencias then 'verificado_cerrado_con_diferencias' else 'verificado_cerrado_sin_diferencias' end,
  'ticket',t.id,t.estado,destino,btrim(p_nota),gen_random_uuid());
end $$;
create function public.inventario_revisar_conteo(p_ticket uuid,p_version integer,p_accion text,p_nota text)
returns void language sql security invoker set search_path='' as $$ select inventario_private.revisar_conteo(p_ticket,p_version,p_accion,p_nota) $$;
revoke all on function inventario_private.revisar_conteo(uuid,integer,text,text),public.inventario_revisar_conteo(uuid,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function inventario_private.revisar_conteo(uuid,integer,text,text),public.inventario_revisar_conteo(uuid,integer,text,text) to authenticated;
commit;
