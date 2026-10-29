# Inventarios y control de bodegas — primera etapa

Actualización: la [fase operativa por categoría](inventarios-operacion.md) incorpora asignación, board, detalle, membresías y progreso por hitos. Su estructura SQL, las seis bodegas, las 793 categorías y los permisos iniciales ya están desplegados con autorización explícita del usuario. El resto de este documento describe la primera etapa y debe leerse con esa actualización.

Estado al 20 de octubre de 2026: base visual y estructural integrada, **Integración pendiente**. Las 18 tablas ya están desplegadas en Supabase; G21 todavía no está conectado. La creación de inventarios, los conteos y las modificaciones de stock no están habilitados.

## Auditoría técnica

La aplicación usa Next.js 16.2.4 App Router, React 19, TypeScript y Tailwind CSS 4. El backend existente se organiza en Server Actions por módulo; Supabase Auth/Postgres usa los clientes de `src/utils/supabase`. Se leyeron las guías locales de la versión instalada de Next.js antes de introducir rutas y componentes.

El layout autenticado verifica `auth.getUser()` y carga `perfiles`. Los roles existentes siguen siendo `Admin` y `Operativo`; `modulos_permitidos` concede acceso a módulos. El sidebar usa `SidebarNavigation` y un único `NavigationGroup`, con animaciones de 220 ms, estados activos, navegación responsive y menú de usuario. Los estilos compartidos están en `globals.css`, con tokens claro/oscuro y componentes de tema existentes.

Se consultaron en modo lectura las columnas y restricciones del proyecto Supabase configurado. Hay 15 tablas públicas; ninguna `inventario_*`. `perfiles.id` es UUID y referencia a Auth; se confirmaron las restricciones de rol y estado. La lista de Edge Functions y de migraciones registradas está vacía. El archivo local `supabase_schema.sql` cubre principalmente inspecciones, no representa todo el esquema real. No se encontraron tipos generados de toda la base ni una infraestructura general de notificaciones; `vehiculo_alertas` pertenece a inspecciones.

`/inventarios` ya contenía la gestión de `contenedores`. Se conservó el componente completo como `ContainersView.tsx`, sin cambiar sus formularios ni acciones, y ahora se accede mediante `/inventarios/contenedores`. No se transformaron contenedores en productos ni en bodegas G21.

La PWA existente solo cachea la página offline; no cachea páginas autenticadas, respuestas API ni mutaciones. Esta etapa no añade almacenamiento local de inventarios ni sincronización offline.

## Rutas y navegación

| Ruta | Contenido y autorización |
|---|---|
| `/inventarios` | Redirige a Registros. |
| `/inventarios/registros` | Preparación del módulo; interfaz de trabajo por membresía de bodega cuando exista el esquema aprobado. |
| `/inventarios/reportes` | Espacio de análisis para líderes y administradores de sus bodegas. Admin sin membresías solo ve preparación. |
| `/admin/inventarios` | Configuración para administradores funcionales de sus bodegas; preparación para Admin de plataforma. |
| `/inventarios/contenedores` | Gestión previa conservada. Requiere acceso al módulo. |

Inventarios aparece en Operaciones entre Mensajeros e Inspecciones, con Registros y Reportes según permisos. La configuración se agrega a Gestión administrativa. No existe Vista general. Se reutiliza el mismo desplegable, sin cambiar el diseño de los otros módulos.

El inicio conserva sus destinos habituales; un Operativo con Inventarios y sin Despachos, Mensajeros o Vehículos entra en Registros de Inventarios.

## Acceso y vistas

`getInventoryAccess()` es exclusivo del servidor. Verifica usuario autenticado, perfil activo y acceso al módulo; carga solo las membresías activas del usuario y sus bodegas activas. React `cache` deduplica por petición, no entre usuarios. No usa `service_role` ni metadatos editables del usuario. Cada página vuelve a exigir su capacidad; ocultar enlaces no es la barrera de seguridad.

La autorización combina dos niveles: permiso del módulo y membresía real en `inventario_usuarios_bodegas`. Los roles funcionales son `administrador`, `lider` y `operador`. Admin de plataforma puede preparar la configuración, pero no recibe acceso implícito a datos de ninguna bodega.

- Operador: pestañas Pendientes, En proceso y Finalizados; columnas de asignación, responsable, progreso y estado. Conteo ciego previsto.
- Líder/administrador: Asignaciones, En ejecución, Por verificar e Historial; corte ERP separado de asignación, tiempos y progreso.
- Reportes: filtra únicamente bodegas con rol de líder/administrador; reserva métricas, cobertura y productividad sin valores ficticios.
- Configuración: Bodegas, Permisos, Alertas e Integración. Admin puede inspeccionar estas pestañas en preparación aunque no existan membresías.

Al cambiar bodega, la vista usa el rol de esa membresía, no el rol más alto del usuario en otra bodega. No hay selector libre para suplantar roles. Las pestañas admiten teclado y las tablas desplazamiento horizontal; se mantienen tokens de tema y controles táctiles.

La ausencia de tablas se presenta como preparación pendiente. Un error de permisos o de conexión no se interpreta como una base vacía ni como autorización. No se muestran ceros, bodegas de ejemplo, tickets simulados o saldos de Excel. Los indicadores desconocidos usan «—». Nuevo inventario permanece deshabilitado; no hay acciones de escritura nuevas expuestas.

## Componentes y archivos

Modificados:

- `src/components/layout/Sidebar.tsx`: acceso al módulo y configuración según capacidades calculadas en servidor.
- `src/components/layout/SidebarNavigation.tsx`: Inventarios reutiliza el grupo desplegable actual.
- `src/app/(dashboard)/layout.tsx`: pasa las capacidades de inventarios al sidebar.
- `src/app/(dashboard)/page.tsx`: destino inicial de usuarios cuyo módulo es Inventarios.
- `src/app/(dashboard)/inventarios/page.tsx`: entrada a Registros; el contenido anterior se preservó en `ContainersView.tsx`.
- `src/modules/inventarios/g21/adapter.server.ts`: completa el adaptador pendiente que se había comenzado.

Nuevos en esta etapa:

- Rutas `inventarios/registros`, `inventarios/reportes`, `inventarios/contenedores`, `admin/inventarios`; estados `inventarios/loading.tsx` y `error.tsx`.
- `src/modules/inventarios/types.ts`, `permissions.ts`, `access.server.ts`, `access.test.mjs`.
- Componentes `InventoryRecords`, `InventoryReports`, `InventoryConfiguration`, `InventoryPrimitives`, `InventoryAccessState`.
- Validaciones y pruebas de G21 en `src/modules/inventarios/g21/validation.server.ts` y `validation.test.mjs`; contratos en `contracts.ts` conservados y completados en esta entrega.
- Este documento, [contratos G21](inventarios-g21.md), [modelo y seguridad](inventarios-schema.md), [SQL propuesto](sql/inventarios-propuesta.sql).

Se reutilizan `SidebarProvider`, `SidebarNavigation`/`NavigationGroup`, `Navbar`, `UserMenu`, el cliente SSR de Supabase, los tokens y botones del diseño existente. La gestión conservada de contenedores sigue usando `ContainerForm`, `TablePagination`, `usePagination` y sus Server Actions originales. Los nuevos componentes compartidos cubren selector de bodega, pestañas, integración pendiente y estados vacíos.

No se cambiaron Despachos, Mensajeros, Inspecciones, gestión de usuarios, lógica de login, servicios de contenedores ni sistema de temas. Posteriormente se añadieron las tablas, funciones y políticas nuevas de Inventarios a la base de datos. Los cambios concurrentes del usuario en `globals.css` y el archivo de login se conservaron.

## Persistencia e integración pendientes

El modelo incluye las 13 tablas solicitadas y cinco auxiliares justificadas. El detalle de relaciones, RLS, estados, auditoría, concurrencia, idempotencia, notificaciones y retención está en [inventarios-schema.md](inventarios-schema.md). Se desplegó mediante la migración `20261020155954_crear_inventarios_bodegas`, registrada en el historial remoto. La propuesta original conserva `ROLLBACK` como referencia. No concede escrituras a clientes. Las transiciones se documentan para futuras RPC transaccionales, no se simulan en el frontend.

G21 requiere confirmar seis contratos de lectura: bodegas, categorías, productos, saldos, movimientos y códigos de barras. Las rutas propuestas por el requerimiento no se consideran existentes. Los adaptadores actuales devuelven integración pendiente y no realizan solicitudes. Se prepararon validaciones de completitud, corte consistente, paginación, unidades/códigos, decimales exactos y selección de campos para conteo ciego. No existe método para enviar ajustes ERP.

Los identificadores reales de bodegas y usuarios no se infieren del Excel. No se recibió ni importó el archivo de históricos. El procedimiento de futura importación exige revisión humana y mantiene datos agregados separados de existencias oficiales.

## Validación

- Compilación de producción y TypeScript correctos; Next.js reconoce las rutas nuevas.
- ESLint de los archivos nuevos/modificados de esta etapa sin hallazgos tras corregir el helper de pruebas. El componente de contenedores se conserva tal como estaba; no se declara limpio el lint de todo el repositorio.
- 13 pruebas Node: autorización, perfiles inactivos, módulo revocado, alcance de membresías, esquema pendiente frente a errores, adaptador bloqueado, cortes incompletos/inconsistentes, decimales, cero explícito, códigos/unidades y DTO ciego.
- Renderizado aislado de operador/líder/administrador y cambios de bodega: pestañas y filtros de alcance correctos, acciones bloqueadas y métricas desconocidas. Posteriormente se retiró el acceso visual a «Inventario de contenedores» por solicitud del usuario; su ruta y funcionalidad se conservan.
- La propuesta SQL pasó 11 grupos de comprobaciones en PostgreSQL 17.5 en memoria: DDL, rollback, permisos y RLS por bodega, integridad y conservación del historial. Se contrastó con el esquema y las políticas reales mediante consultas de solo lectura. Véanse [resultados y límites](inventarios-validacion-db.md). REST, Realtime y las futuras transacciones de negocio siguen pendientes de pruebas en Supabase aislado.
- No hay navegador conectado para validar visualmente temas, móvil y teclado con sesiones reales. Se conservaron las clases responsive y los estilos existentes; esa revisión visual queda pendiente.

## Siguiente fase

El modelo ya está desplegado. Obtener del proveedor G21 los contratos y un entorno de pruebas de lectura. Después implementar sincronización de catálogos, asignaciones y comandos de tickets con persistencia atómica, auditoría y notificaciones; verificar los flujos con sesiones reales y membresías oficiales. Habilitar conteos y verificación solo cuando los saldos y movimientos estén confirmados. El envío de ajustes al ERP seguirá siendo una fase posterior con aprobación específica.
