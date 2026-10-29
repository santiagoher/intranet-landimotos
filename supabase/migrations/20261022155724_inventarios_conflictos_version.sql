-- Entrega A. Revisar/aprobar antes de aplicar. No modifica datos, roles ni RLS.
-- Sustituye SOLO las cuatro excepciones de version inspeccionadas.
-- Conserva cuerpos, bloqueo FOR UPDATE, firma, propietario y grants existentes.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '15s';
do $migration$
declare target record; function_oid regprocedure; definition text; old_raise text; new_raise text;
begin
  for target in select * from (values
    ('inventario_private.actualizar_tarea(uuid,integer,text,integer,text)', 'La tarea cambió. Actualiza antes de continuar'),
    ('inventario_private.contar_producto(uuid,integer,text)', 'La tarea cambió. Actualiza antes de continuar'),
    ('inventario_private.revisar_conteo(uuid,integer,text,text)', 'La tarea cambió. Actualiza antes de continuar'),
    ('inventario_private.observacion_guardar(uuid,text,integer)', 'La observación cambió. Recarga antes de guardar')
  ) as functions(signature,message)
  loop
    function_oid:=to_regprocedure(target.signature);
    if function_oid is null then raise exception 'Falta la función requerida: %',target.signature; end if;
    definition:=pg_get_functiondef(function_oid);
    old_raise:=format('raise exception %L using errcode=''40001'';',target.message);
    new_raise:=format('raise exception %L using errcode=''PT409'', detail=''INVENTORY_VERSION_CONFLICT'';',target.message);
    if strpos(definition,old_raise)=0 and strpos(definition,new_raise)>0 then continue; end if;
    if (length(definition)-length(replace(definition,old_raise,'')))/length(old_raise)<>1 then
      raise exception 'Definición inesperada en %. Revisar manualmente; no se cambia nada.',target.signature;
    end if;
    execute replace(definition,old_raise,new_raise);
  end loop;
end $migration$;
commit;
