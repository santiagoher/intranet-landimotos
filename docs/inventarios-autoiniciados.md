# Inventarios propios del operador

> Actualización 22/10/2026: la nueva fase DEMO, sus bloqueos de producción y las pruebas aisladas están documentados en [inventarios-demo.md](inventarios-demo.md). El contenido siguiente conserva el contexto de la implementación previa; ya no describe la fuente usada por Nuevo inventario en esta fase.

## Estado de entrega

Implementación local preparada. No se ejecutaron migraciones en producción. Se consultó la base: `inventario_productos` y `inventario_codigos_barras` tienen cero registros; el adaptador G21 sigue pendiente. La pantalla no sustituye ese catálogo por productos o cantidades supuestos.

Antes de crear tickets reales se necesitan la aprobación de las migraciones y metadatos auténticos de productos vinculados a sus categorías y bodegas. La ausencia de catálogo muestra un estado informativo y bloquea la creación de tickets vacíos.

## Navegación y experiencia

- Operador: **Mis inventarios** (`/inventarios/registros`) y **Nuevo inventario** (`/inventarios`).
- Líder y Administración: conservan Vista general, Tareas de inventario y Reportes.
- Formulario por pasos: bodega autorizada, categoría completa y confirmación con operador/líder/observaciones. Una única bodega se selecciona automáticamente.
- Alcance inicial: categoría completa, entre 1 y 2000 SKU reales. No se ofrece alcance abierto ni parcial sin soporte. El servidor comprueba que los ID confirmados coinciden con el catálogo actual; no acepta nombres ni existencias enviados por el navegador.
- Al crear se abre el ticket en el detalle existente. Los conteos se guardan en la base, sobreviven a la navegación y permanecen vacíos hasta que se confirman; cero es válido.
- La búsqueda admite SKU, nombre y códigos de barras guardados con el ticket. Compatible con lectores que escriben como teclado; no incorpora escaneo por cámara. La cantidad se registra en la unidad base indicada, sin conversiones implícitas por escaneo.

## Origen y permisos

La migración agrega `origen_creacion` y `creado_por` sin reescribir históricos. En un ticket propio:

- `origen_creacion = creado_por_operador`.
- `creado_por = auth.uid()` y `asignado_a = auth.uid()`.
- `asignado_por = NULL`: no se atribuye la asignación al líder.
- `lider_id` corresponde al responsable activo y autorizado de la bodega.
- Tiempos de creación, aceptación e inicio se generan en PostgreSQL.

La lista identifica «Creado por mí»; supervisores ven «Creado por operador». La columna de asignador indica «Autoiniciado». Los históricos conservan su asignador real y se identifican como «Asignado», sin afirmar que todos fueron creados por un líder.

`puede_autoiniciar` se añade a la membresía de bodega, inicialmente habilitado; solo permite la nueva operación si el rol efectivo es operador y el perfil/módulo/bodega/membresía siguen activos. No concede asignación a terceros ni verificación. No se agrega una pantalla de gestión de permisos ni se amplían otras capacidades administrativas.

La seguridad reutiliza RLS de tickets, productos de tarea, auditoría y notificaciones. Las funciones privadas validan el rol real; las públicas son `SECURITY INVOKER`. Referencia: [funciones de base de datos de Supabase](https://supabase.com/docs/guides/database/functions).

## Conteo ciego y conciliación pendiente

`inventario_catalogo_ciego` devuelve exclusivamente ID, SKU, nombre, unidad y códigos de barras. No consulta saldos. La acción de servidor vuelve a proyectar explícitamente esos campos. `inventario_productos_tarea` devuelve metadatos y conteos propios, sin referencias teóricas. Los RPC de comparación y las tablas de saldos mantienen su restricción para supervisores.

No se captura un saldo inventado ni se integra un endpoint no confirmado. Los inventarios propios quedan pendientes de referencia y conciliación G21: pueden contarse, entregarse, revisarse y devolverse. Un trigger impide declararlos verificados/cerrados hasta implementar la integración confirmada y revisar ese bloqueo. Los flujos anteriores no cambian. No se crean ajustes ERP.

## Duplicados, board y notificaciones

La creación usa clave idempotente y un bloqueo transaccional por bodega. Un trigger comprueba los inventarios activos de la misma categoría, tanto al autoiniciar como al asignar posteriormente desde el líder. Ante sesiones SKU cuyo alcance no se resuelve en esta fase, bloquea conservadoramente el cruce en la bodega. No modifica ni elimina tickets anteriores.

El reconteo reutiliza el ticket existente; no hay un botón para saltarse el conflicto. El ticket propio usa el mismo board, consultas y estados que los asignados. Aparece inicialmente en **En proceso** y después en **Finalizado por operador** para revisión del líder.

Se reutiliza `inventario_notificaciones`: se permite `sesion_id` nulo para tareas por categoría y se agrega una FK directa ticket/bodega conservando la FK de sesiones. Se registra un aviso para el líder al crear y otro por cada entrega efectiva. Los reintentos no duplican avisos. El panel muestra sus 20 avisos recientes, respetando la RLS de destinatario. Son avisos internos; no se enviaron correos ni mensajes externos.

## Migraciones para aprobar, en orden

1. `20261021140335_inventarios_prioridades_tres_niveles.sql`: pendiente de la tarea anterior; normaliza Urgente→Alta y Normal→Media.
2. `20261021143932_inventarios_autoiniciados.sql`: origen/creador, permiso por membresía, metadatos de conteo, RPC de catálogo y creación, prevención de duplicados, avisos y bloqueo de aprobación sin conciliación.

Ambas permanecen pendientes en producción. El frontend detecta únicamente el RPC ausente como funcionalidad pendiente; otros errores no se convierten silenciosamente en autorización.

## Archivos de esta entrega

- `src/components/layout/SidebarNavigation.tsx` y su prueba: navegación por permisos.
- `src/app/(dashboard)/inventarios/page.tsx`: nueva pantalla para operadores y resumen conservado para supervisores.
- `src/app/(dashboard)/inventarios/registros/page.tsx`: apertura del ticket recién creado mediante parámetro, siempre dentro del conjunto autorizado.
- `src/modules/inventarios/operations/NewInventory.tsx`: formulario por pasos.
- `src/modules/inventarios/operations/self-start.actions.ts`: catálogo ciego y creación validada.
- En la misma carpeta: `service.server.ts`, `types.ts`, `task-list.ts`, `TaskTable.tsx`, `OperationsPanel.tsx`, `history.ts`: origen, metadatos, avisos, escáner y reutilización del conteo.
- `operations.test.mjs`, `scripts/test-inventario-operacion.cjs`: cobertura de interfaz, roles y SQL aislado.
- Nueva migración y este documento.

## Pruebas

22 pruebas Node de permisos, navegación y operaciones correctas; TypeScript y ESLint correctos. Pruebas SQL en PGlite: autor/operador autenticado, pertenencia, permiso revocado, catálogo sin saldos, ausencia de datos ficticios, clave idempotente, duplicados entre líder y operador, notificación inicial/entrega, conteo cero, bloqueo al finalizar y bloqueo de aprobación sin conciliación. No se crearon datos de prueba en producción.

La serialización está implementada con bloqueos transaccionales; la prueba aislada verifica rechazos de duplicados secuenciales, no constituye una prueba de carga con conexiones concurrentes.

Pendiente la comprobación visual e interactiva de claro/oscuro, móvil/tablet, lector físico y permanencia de filtros tras 30 segundos: esta sesión no dispone de navegador conectado.
