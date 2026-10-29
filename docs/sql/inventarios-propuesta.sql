-- PROPUESTA REVISABLE. NO APLICADA. NO ES UNA MIGRACION DE PRODUCCION.
-- Esquema real inspeccionado por MCP (solo lectura), octubre de 2026:
-- perfiles.id uuid PK -> auth.users; rol Admin/Operativo; estado activo/inactivo.
-- No existen tablas inventario_* en el esquema inspeccionado.
--
-- Este archivo termina en ROLLBACK deliberadamente. No cambiarlo por COMMIT
-- sin aprobar el plan, validar en una base aislada y generar una migracion
-- mediante supabase migration new. No ejecutar contra produccion para probar.
-- No hay semillas de bodegas, personas, productos, saldos ni tickets.
-- No hay RPC de escritura ni ajuste ERP habilitado en esta primera etapa.
-- Leer docs/inventarios-schema.md para invariantes y pruebas pendientes.

begin;

-- Nombres nuevos deliberadamente sin IF NOT EXISTS: un conflicto debe abortar.
create schema inventario_private;
revoke all on schema inventario_private from public, anon, authenticated, service_role;

create table public.inventario_bodegas (
  id uuid primary key default gen_random_uuid(),
  id_erp text not null unique check (length(btrim(id_erp)) > 0),
  codigo_erp text not null unique check (length(btrim(codigo_erp)) > 0),
  nombre text not null check (length(btrim(nombre)) > 0),
  activa boolean not null default true,
  erp_confirmada_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inventario_usuarios_bodegas (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  bodega_id uuid not null references public.inventario_bodegas(id) on delete restrict,
  rol text not null check (rol in ('administrador', 'lider', 'operador')),
  activo boolean not null default true,
  es_responsable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (perfil_id, bodega_id),
  check (not es_responsable or rol = 'lider')
);
create unique index inventario_un_responsable_activo
  on public.inventario_usuarios_bodegas (bodega_id)
  where activo and es_responsable;
create index inventario_miembros_bodega
  on public.inventario_usuarios_bodegas (bodega_id, rol) where activo;

-- Catalogo confirmado por G21, con alcance de bodega. No guarda existencias.
create table public.inventario_categorias (
  id uuid primary key default gen_random_uuid(),
  bodega_id uuid not null references public.inventario_bodegas(id) on delete restrict,
  id_erp text not null check (length(btrim(id_erp)) > 0),
  codigo_erp text not null check (length(btrim(codigo_erp)) > 0),
  nombre text not null check (length(btrim(nombre)) > 0),
  activa boolean not null default true,
  sincronizada_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bodega_id, codigo_erp),
  unique (bodega_id, id_erp),
  unique (id, bodega_id)
);

create table public.inventario_productos (
  id uuid primary key default gen_random_uuid(),
  bodega_id uuid not null references public.inventario_bodegas(id) on delete restrict,
  id_erp text not null check (length(btrim(id_erp)) > 0),
  categoria_id uuid not null,
  sku_erp text not null check (length(btrim(sku_erp)) > 0),
  nombre text not null check (length(btrim(nombre)) > 0),
  unidad_base_erp text not null check (length(btrim(unidad_base_erp)) > 0),
  activo boolean not null default true,
  sincronizado_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bodega_id, sku_erp),
  unique (bodega_id, id_erp),
  unique (id, bodega_id),
  foreign key (categoria_id, bodega_id)
    references public.inventario_categorias(id, bodega_id) on delete restrict
);
create index inventario_productos_categoria
  on public.inventario_productos (categoria_id, bodega_id);

-- Auxiliar: multiples codigos oficiales y conversiones expresamente confirmadas.
create table public.inventario_codigos_barras (
  id uuid primary key default gen_random_uuid(),
  bodega_id uuid not null references public.inventario_bodegas(id) on delete restrict,
  producto_id uuid not null,
  codigo_erp text not null check (length(btrim(codigo_erp)) > 0),
  unidad_lectura_erp text not null check (length(btrim(unidad_lectura_erp)) > 0),
  factor_unidades_base numeric(20, 6) not null
    check (factor_unidades_base > 0 and factor_unidades_base <> 'NaN'::numeric),
  confirmado_at timestamptz not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bodega_id, codigo_erp),
  foreign key (producto_id, bodega_id)
    references public.inventario_productos(id, bodega_id) on delete restrict
);
create index inventario_codigos_producto
  on public.inventario_codigos_barras (producto_id, bodega_id);

-- Solo una fotografia completa, validada y consistente puede crear una sesion.
-- Los intentos incompletos permanecen en sincronizaciones, nunca como asignacion.
create table public.inventario_sesiones (
  id uuid primary key default gen_random_uuid(),
  bodega_id uuid not null references public.inventario_bodegas(id) on delete restrict,
  categoria_id uuid not null,
  creada_por uuid references public.perfiles(id) on delete set null,
  alcance_descripcion text not null check (length(btrim(alcance_descripcion)) > 0),
  alcance_hash text not null check (length(btrim(alcance_hash)) > 0),
  erp_snapshot_id text not null check (length(btrim(erp_snapshot_id)) > 0),
  erp_corte_at timestamptz not null,
  capturada_at timestamptz not null default now(),
  total_sku integer not null check (total_sku > 0),
  snapshot_completo boolean not null check (snapshot_completo),
  conciliacion_estado text not null default 'pendiente'
    check (conciliacion_estado in ('pendiente', 'completa', 'no_disponible')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, bodega_id),
  unique (bodega_id, erp_snapshot_id, alcance_hash),
  foreign key (categoria_id, bodega_id)
    references public.inventario_categorias(id, bodega_id) on delete restrict,
  check (erp_corte_at <= capturada_at)
);
create index inventario_sesiones_categoria
  on public.inventario_sesiones (categoria_id, bodega_id, erp_corte_at desc);
create index inventario_sesiones_creador on public.inventario_sesiones (creada_por);

-- Auxiliar indispensable: alcance visible durante conteo, SIN saldos o diferencias.
-- Ubicacion es un codigo validado del alcance; permite estante/pasillo despues.
create table public.inventario_sesion_items (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null,
  bodega_id uuid not null,
  producto_id uuid not null,
  sku_erp text not null check (length(btrim(sku_erp)) > 0),
  nombre_producto text not null check (length(btrim(nombre_producto)) > 0),
  unidad_base_erp text not null check (length(btrim(unidad_base_erp)) > 0),
  ubicacion_codigo text not null default '',
  created_at timestamptz not null default now(),
  unique (sesion_id, producto_id, ubicacion_codigo),
  unique (id, sesion_id, bodega_id),
  foreign key (sesion_id, bodega_id)
    references public.inventario_sesiones(id, bodega_id) on delete restrict,
  foreign key (producto_id, bodega_id)
    references public.inventario_productos(id, bodega_id) on delete restrict
);
create index inventario_items_producto
  on public.inventario_sesion_items (producto_id, bodega_id);
create index inventario_items_bodega on public.inventario_sesion_items (bodega_id);

create table public.inventario_tickets (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique check (length(btrim(numero)) > 0),
  sesion_id uuid not null,
  bodega_id uuid not null,
  tipo text not null default 'conteo' check (tipo in ('conteo', 'verificacion')),
  ticket_origen_id uuid,
  asignado_a uuid references public.perfiles(id) on delete set null,
  asignado_por uuid references public.perfiles(id) on delete set null,
  estado text not null default 'pendiente_asignacion' check (estado in (
    'pendiente_asignacion', 'asignado', 'aceptado', 'en_proceso',
    'enviado_verificacion', 'en_verificacion', 'reconteo_solicitado',
    'verificado_sin_diferencias', 'verificado_con_diferencias',
    'pendiente_aprobacion', 'cerrado', 'cancelado'
  )),
  prioridad text not null default 'normal'
    check (prioridad in ('baja', 'normal', 'alta', 'urgente')),
  ronda integer not null default 1 check (ronda > 0),
  version integer not null default 1 check (version > 0),
  asignado_at timestamptz,
  aceptado_at timestamptz,
  iniciado_at timestamptz,
  enviado_at timestamptz,
  recibido_at timestamptz,
  verificacion_iniciada_at timestamptz,
  verificacion_finalizada_at timestamptz,
  cerrado_at timestamptz,
  cancelado_at timestamptz,
  vencimiento_at timestamptz,
  observacion_inicial text,
  cancelacion_motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, sesion_id, bodega_id),
  foreign key (sesion_id, bodega_id)
    references public.inventario_sesiones(id, bodega_id) on delete restrict,
  foreign key (ticket_origen_id, sesion_id, bodega_id)
    references public.inventario_tickets(id, sesion_id, bodega_id) on delete restrict,
  check (ticket_origen_id is distinct from id),
  check ((tipo = 'conteo' and ticket_origen_id is null)
    or (tipo = 'verificacion' and ticket_origen_id is not null)),
  check (estado <> 'cancelado' or (
    cancelado_at is not null and cancelacion_motivo is not null
    and length(btrim(cancelacion_motivo)) > 0
  )),
  check (estado <> 'cerrado' or cerrado_at is not null),
  check (aceptado_at is null or (asignado_at is not null and aceptado_at >= asignado_at)),
  check (iniciado_at is null or (aceptado_at is not null and iniciado_at >= aceptado_at)),
  check (enviado_at is null or (iniciado_at is not null and enviado_at >= iniciado_at)),
  check (verificacion_iniciada_at is null
    or (recibido_at is not null and verificacion_iniciada_at >= recibido_at)),
  check (verificacion_finalizada_at is null
    or (verificacion_iniciada_at is not null
      and verificacion_finalizada_at >= verificacion_iniciada_at))
);
create unique index inventario_un_conteo_activo_por_sesion
  on public.inventario_tickets (sesion_id)
  where tipo = 'conteo' and estado not in ('cerrado', 'cancelado');
create unique index inventario_verificacion_por_ronda
  on public.inventario_tickets (ticket_origen_id, ronda) where tipo = 'verificacion';
create index inventario_tickets_bandeja
  on public.inventario_tickets (bodega_id, estado, created_at desc);
create index inventario_tickets_asignado
  on public.inventario_tickets (asignado_a, estado, created_at desc);
create index inventario_tickets_asignador on public.inventario_tickets (asignado_por);

-- Saldos aislados fisicamente: el operador no obtiene esta fila ni por joins.
create table public.inventario_saldos_base (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique,
  sesion_id uuid not null,
  bodega_id uuid not null,
  cantidad_erp numeric(20, 6) not null check (cantidad_erp <> 'NaN'::numeric),
  referencia_erp text not null check (length(btrim(referencia_erp)) > 0),
  created_at timestamptz not null default now(),
  foreign key (item_id, sesion_id, bodega_id)
    references public.inventario_sesion_items(id, sesion_id, bodega_id) on delete restrict
);
create index inventario_saldos_bodega on public.inventario_saldos_base (bodega_id);
create index inventario_saldos_sesion on public.inventario_saldos_base (sesion_id);

-- Revisiones append-only, cero es un valor explicito; ausencia de fila = no contado.
-- Cada guardado usa cantidad absoluta, nunca incremento implicito por escaneo.
create table public.inventario_conteos (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null,
  item_id uuid not null,
  sesion_id uuid not null,
  bodega_id uuid not null,
  contado_por uuid references public.perfiles(id) on delete set null,
  ronda integer not null check (ronda > 0),
  revision integer not null check (revision > 0),
  cantidad_unidad_lectura numeric(20, 6) not null
    check (cantidad_unidad_lectura >= 0 and cantidad_unidad_lectura <> 'NaN'::numeric),
  unidad_lectura_erp text not null check (length(btrim(unidad_lectura_erp)) > 0),
  factor_unidades_base numeric(20, 6) not null
    check (factor_unidades_base > 0 and factor_unidades_base <> 'NaN'::numeric),
  cantidad_base numeric(20, 6) generated always as
    (cantidad_unidad_lectura * factor_unidades_base) stored,
  observado_at timestamptz not null default now(),
  origen text not null check (origen in ('manual', 'hid', 'camara')),
  observacion text,
  created_at timestamptz not null default now(),
  unique (ticket_id, item_id, ronda, revision),
  unique (id, sesion_id, bodega_id),
  unique (id, item_id, sesion_id, bodega_id),
  foreign key (ticket_id, sesion_id, bodega_id)
    references public.inventario_tickets(id, sesion_id, bodega_id) on delete restrict,
  foreign key (item_id, sesion_id, bodega_id)
    references public.inventario_sesion_items(id, sesion_id, bodega_id) on delete restrict
);
create index inventario_conteos_item on public.inventario_conteos (item_id);
create index inventario_conteos_bodega on public.inventario_conteos (bodega_id);
create index inventario_conteos_actor on public.inventario_conteos (contado_por);
create index inventario_conteos_sesion on public.inventario_conteos (sesion_id);

create table public.inventario_verificaciones (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null,
  item_id uuid not null,
  conteo_id uuid not null,
  sesion_id uuid not null,
  bodega_id uuid not null,
  verificado_por uuid references public.perfiles(id) on delete set null,
  cantidad_verificada numeric(20, 6) not null
    check (cantidad_verificada >= 0 and cantidad_verificada <> 'NaN'::numeric),
  revision integer not null default 1 check (revision > 0),
  observacion text not null check (length(btrim(observacion)) > 0),
  verificada_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (ticket_id, item_id, revision),
  unique (id, sesion_id, bodega_id),
  unique (id, conteo_id, item_id, sesion_id, bodega_id),
  foreign key (ticket_id, sesion_id, bodega_id)
    references public.inventario_tickets(id, sesion_id, bodega_id) on delete restrict,
  foreign key (item_id, sesion_id, bodega_id)
    references public.inventario_sesion_items(id, sesion_id, bodega_id) on delete restrict,
  foreign key (conteo_id, item_id, sesion_id, bodega_id)
    references public.inventario_conteos(id, item_id, sesion_id, bodega_id) on delete restrict
);
create index inventario_verificaciones_conteo on public.inventario_verificaciones (conteo_id);
create index inventario_verificaciones_item on public.inventario_verificaciones (item_id);
create index inventario_verificaciones_bodega on public.inventario_verificaciones (bodega_id);
create index inventario_verificaciones_actor on public.inventario_verificaciones (verificado_por);
create index inventario_verificaciones_sesion on public.inventario_verificaciones (sesion_id);

-- No se fija una formula ERP no confirmada como columna calculada.
-- Importes separados; contrato y cursor de movimientos sostienen la evidencia.
create table public.inventario_diferencias (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  conteo_id uuid not null,
  verificacion_id uuid,
  sesion_id uuid not null,
  bodega_id uuid not null,
  saldo_al_corte numeric(20, 6) not null check (saldo_al_corte <> 'NaN'::numeric),
  movimientos_netos numeric(20, 6) check (movimientos_netos <> 'NaN'::numeric),
  saldo_teorico_conciliado numeric(20, 6) check (saldo_teorico_conciliado <> 'NaN'::numeric),
  cantidad_fisica numeric(20, 6) not null
    check (cantidad_fisica >= 0 and cantidad_fisica <> 'NaN'::numeric),
  diferencia_inicial numeric(20, 6) check (diferencia_inicial <> 'NaN'::numeric),
  diferencia_confirmada numeric(20, 6) check (diferencia_confirmada <> 'NaN'::numeric),
  conciliacion_estado text not null default 'pendiente'
    check (conciliacion_estado in ('pendiente', 'completa', 'no_disponible')),
  movimientos_desde timestamptz not null,
  movimientos_hasta timestamptz not null,
  movimientos_referencia_erp text,
  contrato_conciliacion_version text,
  estado_aprobacion text not null default 'sin_propuesta'
    check (estado_aprobacion in ('sin_propuesta', 'pendiente', 'aprobada', 'rechazada')),
  motivo text,
  observacion text,
  created_at timestamptz not null default now(),
  unique (conteo_id),
  unique (id, bodega_id),
  foreign key (item_id, sesion_id, bodega_id)
    references public.inventario_sesion_items(id, sesion_id, bodega_id) on delete restrict,
  foreign key (conteo_id, item_id, sesion_id, bodega_id)
    references public.inventario_conteos(id, item_id, sesion_id, bodega_id) on delete restrict,
  foreign key (verificacion_id, conteo_id, item_id, sesion_id, bodega_id)
    references public.inventario_verificaciones(id, conteo_id, item_id, sesion_id, bodega_id)
    on delete restrict,
  check (movimientos_hasta >= movimientos_desde),
  check (conciliacion_estado <> 'completa' or (
    movimientos_netos is not null and saldo_teorico_conciliado is not null
    and diferencia_inicial is not null and movimientos_referencia_erp is not null
    and contrato_conciliacion_version is not null
  )),
  check (diferencia_confirmada is null
    or (verificacion_id is not null and conciliacion_estado = 'completa')),
  check (estado_aprobacion not in ('pendiente', 'aprobada')
    or (conciliacion_estado = 'completa' and diferencia_confirmada is not null))
);
create index inventario_diferencias_item on public.inventario_diferencias (item_id);
create index inventario_diferencias_verificacion on public.inventario_diferencias (verificacion_id);
create index inventario_diferencias_bodega
  on public.inventario_diferencias (bodega_id, estado_aprobacion);
create index inventario_diferencias_sesion on public.inventario_diferencias (sesion_id);

create table public.inventario_ajustes (
  id uuid primary key default gen_random_uuid(),
  bodega_id uuid not null references public.inventario_bodegas(id) on delete restrict,
  diferencia_id uuid not null,
  propuesto_por uuid references public.perfiles(id) on delete set null,
  aprobado_por uuid references public.perfiles(id) on delete set null,
  estado text not null default 'propuesto'
    check (estado in ('propuesto', 'aprobado', 'rechazado', 'cancelado')),
  motivo text not null check (length(btrim(motivo)) > 0),
  decision_motivo text,
  aprobado_at timestamptz,
  erp_ajuste_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (diferencia_id, bodega_id)
    references public.inventario_diferencias(id, bodega_id) on delete restrict,
  check (aprobado_por is null or aprobado_por is distinct from propuesto_por),
  check (estado <> 'aprobado' or aprobado_at is not null),
  -- Bloqueo explicito del envio ERP en esta etapa, incluso si se aprueba propuesta.
  check (erp_ajuste_id is null)
);
create unique index inventario_un_ajuste_vigente
  on public.inventario_ajustes (diferencia_id)
  where estado in ('propuesto', 'aprobado');
create index inventario_ajustes_bodega on public.inventario_ajustes (bodega_id, estado);
create index inventario_ajustes_proponente on public.inventario_ajustes (propuesto_por);
create index inventario_ajustes_aprobador on public.inventario_ajustes (aprobado_por);

create table public.inventario_notificaciones (
  id uuid primary key default gen_random_uuid(),
  destinatario_id uuid references public.perfiles(id) on delete set null,
  bodega_id uuid not null,
  sesion_id uuid not null,
  ticket_id uuid not null,
  tipo text not null check (tipo in (
    'asignado', 'iniciado', 'finalizado', 'verificacion_pendiente',
    'reconteo_solicitado', 'diferencias_confirmadas',
    'aprobacion_pendiente', 'cerrado', 'vencido'
  )),
  evento_clave uuid not null,
  leida_at timestamptz,
  created_at timestamptz not null default now(),
  unique (destinatario_id, evento_clave),
  foreign key (ticket_id, sesion_id, bodega_id)
    references public.inventario_tickets(id, sesion_id, bodega_id) on delete restrict
  -- Sin payload JSON ni saldos: el mensaje se compone de tipo/ticket autorizados.
);
create index inventario_notificaciones_bandeja
  on public.inventario_notificaciones (destinatario_id, created_at desc);
create index inventario_notificaciones_ticket on public.inventario_notificaciones (ticket_id);
create index inventario_notificaciones_bodega on public.inventario_notificaciones (bodega_id);

create table public.inventario_auditoria (
  id uuid primary key default gen_random_uuid(),
  bodega_id uuid not null references public.inventario_bodegas(id) on delete restrict,
  sesion_id uuid,
  ticket_id uuid,
  actor_id uuid references public.perfiles(id) on delete set null,
  -- Copia inmutable del UUID autenticado para no perder identidad historica
  -- cuando la cuenta se elimina. No otorga ningun permiso.
  actor_original_id uuid,
  actor_rol text not null check (actor_rol in ('administrador', 'lider', 'operador', 'sistema')),
  evento text not null check (length(btrim(evento)) > 0),
  entidad_tipo text not null,
  entidad_id uuid not null,
  estado_anterior text,
  estado_nuevo text,
  motivo text,
  operacion_clave uuid not null,
  created_at timestamptz not null default now(),
  foreign key (sesion_id, bodega_id)
    references public.inventario_sesiones(id, bodega_id) on delete restrict,
  foreign key (ticket_id, sesion_id, bodega_id)
    references public.inventario_tickets(id, sesion_id, bodega_id) on delete restrict,
  check (ticket_id is null or sesion_id is not null),
  check (actor_rol = 'sistema' or actor_original_id is not null),
  check (actor_id is null
    or (actor_original_id is not null and actor_original_id = actor_id))
);
create index inventario_auditoria_bodega
  on public.inventario_auditoria (bodega_id, created_at desc);
create index inventario_auditoria_ticket on public.inventario_auditoria (ticket_id);
create index inventario_auditoria_sesion on public.inventario_auditoria (sesion_id);
create index inventario_auditoria_actor on public.inventario_auditoria (actor_id);
create index inventario_auditoria_operacion on public.inventario_auditoria (operacion_clave);

-- Auxiliar: parametros modificables por bodega/categoria, sin dias sin clasificar.
create table public.inventario_parametros (
  id uuid primary key default gen_random_uuid(),
  bodega_id uuid not null,
  categoria_id uuid not null,
  alerta_desde_dias integer not null default 10 check (alerta_desde_dias > 0),
  critico_despues_dias integer not null default 30,
  periodicidad_dias integer not null default 10 check (periodicidad_dias > 0),
  modificado_por uuid references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (categoria_id, bodega_id),
  foreign key (categoria_id, bodega_id)
    references public.inventario_categorias(id, bodega_id) on delete restrict,
  check (critico_despues_dias >= alerta_desde_dias)
);
create index inventario_parametros_bodega on public.inventario_parametros (bodega_id);
create index inventario_parametros_actor on public.inventario_parametros (modificado_por);

-- Auxiliar: diagnostico saneado; nunca credenciales, cuerpos HTTP ni saldos.
-- Un intento global sin bodega queda privado hasta mapear codigos oficiales.
create table public.inventario_sincronizaciones (
  id uuid primary key default gen_random_uuid(),
  bodega_id uuid references public.inventario_bodegas(id) on delete restrict,
  recurso text not null check (recurso in (
    'bodegas', 'categorias', 'productos', 'saldos', 'movimientos', 'codigos_barras'
  )),
  estado text not null check (estado in ('iniciada', 'completa', 'incompleta', 'error')),
  correlation_id uuid not null,
  iniciada_at timestamptz not null default now(),
  finalizada_at timestamptz,
  pagina_count integer check (pagina_count >= 0),
  registro_count integer check (registro_count >= 0),
  error_codigo text,
  created_at timestamptz not null default now(),
  check (finalizada_at is null or finalizada_at >= iniciada_at)
);
create index inventario_sincronizaciones_bodega
  on public.inventario_sincronizaciones (bodega_id, iniciada_at desc);

-- Auxiliar PRIVADA: clave de idempotencia + hash del comando, sin datos en cliente.
create table inventario_private.operaciones (
  id uuid primary key default gen_random_uuid(),
  bodega_id uuid not null references public.inventario_bodegas(id) on delete restrict,
  actor_id uuid references public.perfiles(id) on delete set null,
  clave uuid not null unique,
  comando text not null,
  solicitud_hash text not null,
  entidad_resultado_id uuid,
  created_at timestamptz not null default now()
);
create index inventario_operaciones_bodega on inventario_private.operaciones (bodega_id);
create index inventario_operaciones_actor on inventario_private.operaciones (actor_id);

-- Lecturas de autorizacion muy acotadas para evitar recursion RLS en membresias.
-- SECURITY DEFINER solo aqui, esquema NO expuesto, search_path vacio,
-- sin SQL dinamico, sin parametro de usuario y sin perfiles.rol como bypass.
-- Debe revisarse la lista de esquemas expuestos antes de desplegar.
create function inventario_private.rol_bodega(p_bodega_id uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select m.rol
  from public.inventario_usuarios_bodegas m
  join public.perfiles p on p.id = m.perfil_id
  join public.inventario_bodegas b on b.id = m.bodega_id
  where (select auth.uid()) is not null
    and m.perfil_id = (select auth.uid())
    and m.bodega_id = p_bodega_id and m.activo
    and p.estado = 'activo' and b.activa
    and (
      p.rol = 'Admin'
      or 'inventarios' = any(coalesce(p.modulos_permitidos, '{}'::text[]))
    )
$$;

create function inventario_private.puede_leer_ticket(p_ticket_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.inventario_tickets t
    where t.id = p_ticket_id and (
      inventario_private.rol_bodega(t.bodega_id) in ('administrador', 'lider')
      or (
        inventario_private.rol_bodega(t.bodega_id) = 'operador'
        and t.tipo = 'conteo' and t.asignado_a = (select auth.uid())
      )
    )
  )
$$;

create function inventario_private.puede_leer_sesion(p_sesion_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.inventario_sesiones s
    where s.id = p_sesion_id and (
      inventario_private.rol_bodega(s.bodega_id) in ('administrador', 'lider')
      or exists (
        select 1 from public.inventario_tickets t
        where t.sesion_id = s.id
          and inventario_private.rol_bodega(s.bodega_id) = 'operador'
          and t.tipo = 'conteo' and t.asignado_a = (select auth.uid())
      )
    )
  )
$$;

create function inventario_private.actualizar_timestamp()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- Revocar privilegios automaticos, aun si public tiene default privileges amplios.
-- Todos los clientes, incluido service_role, carecen de escritura en esta etapa.
do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'inventario_bodegas', 'inventario_usuarios_bodegas', 'inventario_categorias',
    'inventario_productos', 'inventario_codigos_barras', 'inventario_sesiones',
    'inventario_sesion_items', 'inventario_tickets', 'inventario_saldos_base',
    'inventario_conteos', 'inventario_verificaciones', 'inventario_diferencias',
    'inventario_ajustes', 'inventario_notificaciones', 'inventario_auditoria',
    'inventario_parametros', 'inventario_sincronizaciones'
  ] loop
    execute format('alter table public.%I enable row level security', tabla);
    execute format('alter table public.%I force row level security', tabla);
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', tabla);
    execute format('grant select on table public.%I to authenticated', tabla);
  end loop;

  foreach tabla in array array[
    'inventario_bodegas', 'inventario_usuarios_bodegas', 'inventario_categorias',
    'inventario_productos', 'inventario_codigos_barras', 'inventario_sesiones',
    'inventario_tickets', 'inventario_ajustes', 'inventario_parametros'
  ] loop
    execute format(
      'create trigger inventario_updated_at before update on public.%I for each row execute function inventario_private.actualizar_timestamp()',
      tabla
    );
  end loop;
end;
$$;

alter table inventario_private.operaciones enable row level security;
alter table inventario_private.operaciones force row level security;
revoke all on table inventario_private.operaciones from public, anon, authenticated, service_role;
revoke all on all functions in schema inventario_private from public, anon, authenticated, service_role;
grant usage on schema inventario_private to authenticated;
grant execute on function inventario_private.rol_bodega(uuid) to authenticated;
grant execute on function inventario_private.puede_leer_ticket(uuid) to authenticated;
grant execute on function inventario_private.puede_leer_sesion(uuid) to authenticated;

create policy inventario_bodegas_lectura on public.inventario_bodegas
  for select to authenticated
  using (inventario_private.rol_bodega(id) is not null);

create policy inventario_miembros_lectura on public.inventario_usuarios_bodegas
  for select to authenticated using (
    inventario_private.rol_bodega(bodega_id) is not null
    and (
      perfil_id = (select auth.uid())
      or inventario_private.rol_bodega(bodega_id) in ('administrador', 'lider')
    )
  );

create policy inventario_categorias_lectura on public.inventario_categorias
  for select to authenticated using (
    inventario_private.rol_bodega(bodega_id) in ('administrador', 'lider')
    or exists (
      select 1 from public.inventario_sesiones s
      where s.categoria_id = inventario_categorias.id
        and inventario_private.puede_leer_sesion(s.id)
    )
  );

create policy inventario_productos_lectura on public.inventario_productos
  for select to authenticated using (
    inventario_private.rol_bodega(bodega_id) in ('administrador', 'lider')
    or exists (
      select 1 from public.inventario_sesion_items i
      where i.producto_id = inventario_productos.id
        and inventario_private.puede_leer_sesion(i.sesion_id)
    )
  );

create policy inventario_codigos_lectura on public.inventario_codigos_barras
  for select to authenticated using (
    inventario_private.rol_bodega(bodega_id) in ('administrador', 'lider')
    or exists (
      select 1 from public.inventario_sesion_items i
      where i.producto_id = inventario_codigos_barras.producto_id
        and inventario_private.puede_leer_sesion(i.sesion_id)
    )
  );

create policy inventario_sesiones_lectura on public.inventario_sesiones
  for select to authenticated
  using (inventario_private.puede_leer_sesion(id));
create policy inventario_items_lectura on public.inventario_sesion_items
  for select to authenticated
  using (inventario_private.puede_leer_sesion(sesion_id));
create policy inventario_tickets_lectura on public.inventario_tickets
  for select to authenticated
  using (inventario_private.puede_leer_ticket(id));
create policy inventario_conteos_lectura on public.inventario_conteos
  for select to authenticated using (
    inventario_private.rol_bodega(bodega_id) in ('administrador', 'lider')
    or (
      contado_por = (select auth.uid())
      and inventario_private.puede_leer_ticket(ticket_id)
    )
  );

create policy inventario_saldos_lectura on public.inventario_saldos_base
  for select to authenticated
  using (inventario_private.rol_bodega(bodega_id) in ('administrador', 'lider'));
create policy inventario_verificaciones_lectura on public.inventario_verificaciones
  for select to authenticated
  using (inventario_private.rol_bodega(bodega_id) in ('administrador', 'lider'));
create policy inventario_diferencias_lectura on public.inventario_diferencias
  for select to authenticated
  using (inventario_private.rol_bodega(bodega_id) in ('administrador', 'lider'));
create policy inventario_ajustes_lectura on public.inventario_ajustes
  for select to authenticated
  using (inventario_private.rol_bodega(bodega_id) in ('administrador', 'lider'));
create policy inventario_parametros_lectura on public.inventario_parametros
  for select to authenticated
  using (inventario_private.rol_bodega(bodega_id) in ('administrador', 'lider'));
create policy inventario_auditoria_lectura on public.inventario_auditoria
  for select to authenticated
  using (inventario_private.rol_bodega(bodega_id) = 'administrador');
create policy inventario_sync_lectura on public.inventario_sincronizaciones
  for select to authenticated
  using (inventario_private.rol_bodega(bodega_id) = 'administrador');
create policy inventario_notificaciones_lectura on public.inventario_notificaciones
  for select to authenticated using (
    destinatario_id = (select auth.uid())
    and inventario_private.puede_leer_ticket(ticket_id)
    and (
      tipo not in ('diferencias_confirmadas', 'aprobacion_pendiente')
      or inventario_private.rol_bodega(bodega_id) in ('administrador', 'lider')
    )
  );

-- NO policies INSERT / UPDATE / DELETE. NO grants de escritura. NO publicaciones
-- Realtime ni vistas. RPC transaccionales y sus pruebas son otra etapa revisable.
-- NO modifica public.perfiles, public.contenedores ni tablas de otros modulos.
rollback;
