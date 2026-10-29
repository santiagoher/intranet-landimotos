# Nuevo inventario DEMO del operador

> Habilitado en el servidor local sobre el proyecto actual, con autorización del usuario y clave privada adicional. El estado aplicado, las migraciones y las comprobaciones están en [inventarios-demo-compartido.md](inventarios-demo-compartido.md).

## Estado real — 22 de octubre de 2026

Código implementado y probado en PostgreSQL aislado y navegador con acciones simuladas. **Habilitado localmente sobre la base compartida `loajbvlgpsxrkfzyxbui`.** Se aplicaron las migraciones de compatibilidad y de protección mediante clave privada. Se cargaron 30 categorías y 60 productos DEMO en seis bodegas existentes, preservando los 8 tickets y las 793 categorías anteriores. No se crearon usuarios ni tickets de ejemplo. No se desplegó Vercel.

Las credenciales Supabase existentes se conservaron. `.env.development.local` habilita DEMO con una clave privada que el servidor adjunta a las solicitudes autorizadas; la base guarda solo su hash y rechaza solicitudes sin esa clave. Se debe reiniciar `npm run dev` para probar con una sesión de operador. No existe un staging independiente: los registros de prueba se guardan en la misma base y pueden aparecer en totales compartidos. Las pruebas automatizadas del ciclo completo se ejecutaron en PostgreSQL WASM aislado; la comprobación final con la sesión real queda para la prueba local del usuario.

## Flujo y reutilización

- `/inventarios`: operador → formulario de tres pasos, bodega autorizada, categoría DEMO con filtros opcionales de subcategoría/marca y resumen. Líder/administración conservan su vista actual. Ver [filtros del operador](inventarios-filtros-operador.md).
- `/inventarios/registros`: conserva Mis inventarios y el detalle de conteo. Tras confirmar realmente el RPC, se abre `?ticket=<uuid>` sobre esta ruta.
- La tabla y el board existentes reciben los mismos tickets. El origen se presenta como **Asignado / Autoiniciado**, con filtro por origen en Mis inventarios y distintivo **DEMO · Prueba**.
- `OperationsPanel`, `CountRow`, evidencias, notas, historial, progreso, PT409 y polling existentes se reutilizan. Cero es contado; vacío sigue pendiente. El 100 % cuenta referencias SKU, no unidades ni aprobación administrativa.
- El servidor genera creación/inicio/entrega/cierre. El resumen explica que la fecha se registra al crear, sin fabricar una fecha anterior al guardado.
- La interfaz usa los tokens actuales, claro por defecto y oscuro según la preferencia existente; Lucide, transiciones con `prefers-reduced-motion`, móvil/tablet/escritorio.

## Fuente DEMO y G21

La base compartida usa las migraciones descritas en el documento de habilitación local. Como alternativa para un futuro ambiente independiente, `supabase/testing/inventarios-demo.sql` contiene un instalador **exclusivo para una base de pruebas nueva**, fuera de la cadena automática de migraciones. No aplicarlo encima de la instalación compartida. El propietario puede sembrar explícitamente una bodega de pruebas con `inventario_private.demo_sembrar(uuid)`.

Genera diez productos: dos por categoría en Guayas, Cadenas, Lubricantes, Arranque y Sistema de frenos. Incluyen UUID, SKU `DEMO-*`, códigos de barras alfanuméricos `DEMO-BAR-*` para lectores tipo teclado, nombre, unidad y relación categoría/bodega. No proceden del Excel de producción ni del ERP. Los códigos de ejemplo no se presentan como EAN oficiales.

Las categorías tienen `origen='demo'`. Los productos viven en `inventario_private.demo_productos`, separados de `inventario_productos` y sus códigos ERP. Las referencias simuladas 10/0 sirven únicamente para probar coincidencias, diferencias y cierre por el líder: permanecen en tablas privadas y **no aparecen en el DTO del operador**, ni rellenan sus casillas. No se consultan ni ajustan saldos oficiales.

`demo-source.server.ts` es el proveedor de esta fase. G21 conserva su adaptador pendiente, con contratos para bodegas, categorías, productos, códigos, resolución de un código por bodega, fotografía de saldos y movimientos. Ninguno se invoca desde el wizard DEMO. La futura integración requiere revisar el contrato ERP y validar referencias/conciliación; no basta cambiar un indicador de frontend.

## Persistencia, permisos y avisos

`inventario_demo_autoiniciar` valida en PostgreSQL:

1. Entorno DEMO habilitado y membresía real del operador, perfil, módulo y bodega activos, incluido `puede_autoiniciar`.
2. Categoría DEMO activa de esa bodega y coincidencia exacta de los ID con la categoría completa o el grupo filtrado validado en la base; no acepta existencias ni nombres enviados desde el navegador.
3. Líder responsable activo, distinto del operador.
4. Clave idempotente, huella de la solicitud y bloqueo transaccional; reutiliza la prevención de solapamientos con inventarios activos del líder u operador.

En una transacción crea el ticket `OP-*` con `es_prueba=true`, autor/operador autenticados, líder independiente, fechas del servidor, productos sin contar, procedencia privada DEMO, referencias privadas de prueba y **un solo evento de creación**. Reintentar la misma clave devuelve el mismo ticket. Otra carga con esa clave o un alcance activo duplicado se rechaza.

El trigger existente registra una notificación interna para el líder al crear y al finalizar cada entrega efectiva. No se envían correos ni mensajes externos. El líder ve el aviso y el ticket mediante las consultas y polling actuales; RLS mantiene fuera las bodegas ajenas. Administración sigue con seguimiento de solo lectura y el operador no se verifica a sí mismo.

El cierre reutiliza `inventario_revisar_conteo`: únicamente los autoiniciados con procedencia DEMO privada y `es_prueba=true` pueden pasar el bloqueo de conciliación en el entorno de pruebas. Los autoiniciados ordinarios siguen bloqueados hasta integrar G21. No se eliminan ni cambian políticas RLS existentes. Las funciones públicas nuevas son `SECURITY INVOKER`; las privadas tienen `search_path` vacío y concesiones explícitas. Siembra y configuración solo son accesibles al propietario de la base.

## Activación futura en staging

No ejecutar estas instrucciones sobre producción ni lanzar un `db push` general sobre su historial divergente.

1. Disponer de Supabase local o un proyecto independiente vacío. Crear solo identidades de prueba y las relaciones de bodega/líder/operador necesarias, sin copiar personas ni información sensible de producción.
2. Instalar el esquema y revisar las migraciones operacionales hasta `20261022155724_inventarios_conflictos_version.sql`, incluyendo autoiniciados y evidencias. **Excluir la migración `inventarios_catalogo_excel_inicial`**, que contiene el catálogo importado anteriormente. El ejecutor aislado `scripts/test-inventario-demo.cjs` muestra el orden exacto y crea sus propias identidades sintéticas.
3. Como propietario, declarar `landimotos.demo_target_host` en la misma conexión SQL antes de revisar/ejecutar el instalador DEMO. Ejemplo para Supabase local: `select set_config('landimotos.demo_target_host','localhost:54321',false);`. El instalador rechaza el host de producción conocido, un destino no declarado, cualquier ticket previo, productos ERP o bodegas de origen G21. No crea roles de usuarios globales.
4. Crear las bodegas de prueba con la estructura existente, configurar sus miembros de prueba y ejecutar `select inventario_private.demo_sembrar('<UUID_BODEGA_PRUEBAS>');` por cada una. La siembra es idempotente; no modifica referencias previas. Nunca usar un UUID real de producción.
5. Completar `.env.development.local` desde `.env.development.example` con URL/clave pública del destino independiente, `APP_ENV=development` (o `staging`), `SUPABASE_PRODUCTION_PROJECT_REF`, `INVENTORY_CATALOG_SOURCE=demo` e `INVENTORY_DEMO_TARGET_HOST` idéntico al host autorizado. La clave privada, si se prueban fotos, debe pertenecer exclusivamente a staging y permanecer en servidor. Mantener el indicador de autoinicio apagado durante la preparación.
6. Validar permisos, RPC, datos ciegos y ciclo completo en ese destino. Solo entonces establecer `INVENTORY_SELF_START_ENABLED=true` en staging y reiniciar el servidor. La acción valida sesión y exige que el marcador privado del RPC coincida con el destino configurado. `VERCEL_ENV=production` y el host conocido de producción bloquean DEMO aunque se active el indicador por error.

## Archivos principales

| Archivo | Responsabilidad |
| --- | --- |
| `operations/NewInventory.tsx`, `new-inventory.css` | Wizard reutilizado, bloqueo, pasos, confirmación, protección de doble clic/reintentos y responsive |
| `operations/demo-environment.ts`, `features.server.ts` | Aislamiento y habilitación solo en servidor |
| `operations/demo-source.server.ts`, `self-start.actions.ts` | Proveedor, autenticación, DTO ciego, RPC sin reintentos automáticos |
| `operations/service.server.ts`, `types.ts` | Contexto DEMO y metadatos integrados en consultas existentes |
| `operations/OperatorTaskList.tsx`, `task-list.ts`, `TaskTable.tsx`, `LeaderMonitor.tsx`, `OperationsPanel.tsx` | Origen, filtro y distintivos durante el ciclo |
| `g21/contracts.ts`, `g21/adapter.server.ts` | Contrato de resolución de código preparado, implementación ERP pendiente |
| `supabase/testing/inventarios-demo.sql` | Instalador y semillas exclusivamente de pruebas; permisos, catálogo y creación atómica |
| `.env.development.example` | Plantilla segura, sin credenciales |
| `operations/demo.test.mjs`, `operations/operations.test.mjs`, `utils/supabase/stability.test.mjs` | Pruebas de aislamiento, proveedor, listas y compatibilidad |
| `scripts/test-inventario-demo.cjs`, `scripts/test-inventario-demo-ui.cjs` | Ciclo SQL aislado y navegador con acciones simuladas |

Los paths `operations/` y `g21/` anteriores son relativos a `src/modules/inventarios/`.

## Verificación y pendientes

- 78 pruebas Node pasan, incluidas las nuevas guardas y las regresiones de estabilidad.
- Pruebas PostgreSQL aisladas del flujo DEMO y suite operacional anterior pasan: roles, bodegas ajenas, idempotencia, un único evento inicial, avisos, conteo ciego, cero/vacío, PT409, entrega, reconteo, cierre y referencias sin tocar ERP.
- TypeScript y compilación Next completados. El primer build falló por descarga de Google Fonts y el siguiente por un archivo bloqueado en `.next`; el build de validación pasó con acceso a las fuentes y salida temporal `.next/inventory-demo-validation`. La configuración original fue restaurada.
- Navegador: React real con acciones simuladas, tres pasos, selección automática, respuesta incierta sin éxito, doble clic, reintento con la misma clave, apertura de la ruta existente y bloqueo de entorno. Claro/oscuro a 390/768/1280 px; capturas inspeccionadas y sin desbordamiento horizontal.

Pendiente: crear/configurar el staging persistente y validar allí Auth + PostgREST + Storage con dos sesiones reales, incluyendo fotos y lector físico. Las pruebas SQL usan PostgreSQL WASM y no sustituyen una prueba de carga de PostgREST con varias conexiones. No hay integración ERP, ajuste de existencias ni despliegue de producción en esta entrega.
