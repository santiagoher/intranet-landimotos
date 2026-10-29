-- Pendiente de revision y aplicacion controlada. No contiene cambios de datos.
-- Indices normales: ejecutar en ventana de baja actividad; abortar ante bloqueos.
-- No aplicar todo el historial local: hay versiones con nombres/fechas divergentes.
begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

create index if not exists pedidos_created_at_lectura_idx
  on public.pedidos (created_at desc);
create index if not exists mensajeros_rutas_mensajero_lectura_idx
  on public.mensajeros_rutas (mensajero_id);
create index if not exists mensajeros_rutas_estado_fecha_lectura_idx
  on public.mensajeros_rutas (estado, created_at desc);
create index if not exists mensajeros_almuerzos_mensajero_lectura_idx
  on public.mensajeros_almuerzos (mensajero_id);
create index if not exists mensajeros_almuerzos_fecha_lectura_idx
  on public.mensajeros_almuerzos (created_at desc);

-- Misma politica, roles y condicion; auth.uid() se evalua una vez por sentencia.
alter policy "Usuarios pueden ver su propio perfil" on public.perfiles
  using ((select auth.uid()) = id);
commit;
