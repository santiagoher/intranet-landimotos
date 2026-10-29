# Estabilización de Landimotos Operativo

Auditoría del 22/10/2026. Producción informada: https://intranet-landimotos.vercel.app/ (Vercel). Los trabajadores comparten cuentas, según confirmación del responsable.

**Actualización posterior:** el 22/10/2026 a las 10:57 a. m. se aplicó en Supabase la corrección del bucle `40001`, con autorización del usuario. El resultado está en [inventarios-concurrencia-produccion.md](inventarios-concurrencia-produccion.md); el plan de frontend A/B está en [inventarios-concurrencia-despliegue.md](inventarios-concurrencia-despliegue.md). El frontend y la migración de índices siguen pendientes.

## Estado de esta entrega

En esta fase inicial se implementaron y verificaron correcciones localmente, sin despliegue ni migraciones. La aplicación posterior de la corrección crítica SQL queda registrada en el informe enlazado arriba. Las pruebas de escritura se ejecutaron exclusivamente con respuestas simuladas o PostgreSQL local en memoria; no se modificaron variables, usuarios o datos del negocio en producción.

No se puede afirmar todavía que la CPU o los cierres de sesión en producción hayan mejorado. Falta desplegar de forma controlada y medir. Tampoco se ha realizado una jornada real de ocho horas con usuarios: la prueba de ocho horas es una simulación del planificador de consultas.

## Hallazgos confirmados

1. **Cierre global con cuentas compartidas.** El cierre voluntario usaba `signOut()` sin alcance. Su valor predeterminado es global, por lo que podía invalidar las sesiones de otros dispositivos de la misma cuenta. Se cambió a `scope: 'local'`. La pestaña y otras pestañas del mismo perfil de navegador siguen compartiendo la sesión local; los otros dispositivos no deben perderla. Esto explica un riesgo concreto, pero no demuestra que todos los incidentes históricos tengan esa causa. [Referencia de signOut](https://supabase.com/docs/reference/javascript/auth-signout).
2. **Errores temporales e invalidez real coexistían.** Los registros consultados mostraron 503 en perfiles/tickets, 504 en autenticación/conteo y errores `session_not_found` y `refresh_token_not_found`. Los primeros no deben convertirse en un logout; los últimos deben seguir rechazándose.
3. **RPC ausente.** `public.inventario_autoinicio_contexto` no existe en el esquema remoto consultado; los registros muestran cientos de 404. La interfaz intentaba consultar una funcionalidad cuya migración local no está aplicada. El autoinicio queda deshabilitado por defecto y sus acciones también están bloqueadas. Las tareas ya asignadas conservan su flujo.
4. **Historial de migraciones divergente.** Las migraciones locales de prioridades y autoinicio no aparecen en el historial remoto. Evidencias y verificación figuran con versiones remotas `20261021161517` y `20261021164715`, distintas de sus archivos locales. No ejecutar `supabase db push` indiscriminadamente: primero reconciliar el historial y comparar definiciones, sin repetir cargas del catálogo.
5. **Lecturas repetidas.** Había consultas de perfil desde los consumidores de `useRole`, actualizaciones completas del servidor para refrescar Inventarios y lectura del resumen de conciliación fuera de Reportes. El catálogo completo de categorías se consultaba en cada actualización.
6. **Desarrollo no está aislado.** `.env.local` apunta al proyecto `loajbvlgpsxrkfzyxbui`, donde se observaron solicitudes desde Vercel. No se leyeron las variables de Vercel ni se pudo comprobar directamente su panel de configuración; la coincidencia se basa en la URL local y los registros del proyecto compartido. No se copiaron ni imprimieron claves.

Las estadísticas acumuladas de PostgreSQL al momento de consultar mostraban aproximadamente 281 ms de media para la consulta de categorías (1.244 llamadas), 135 ms para contexto (892 llamadas) y 39 ms para tickets (490 llamadas). Son estadísticas acumuladas, no un ensayo comparativo ni una medición de una única jornada. El costo de RLS y las llamadas repetidas son candidatos de optimización; **no se aisló la causa completa del pico de CPU del 99 %**.

## Correcciones de autenticación

- Se conserva el cliente de navegador singleton de `@supabase/ssr`, persistencia y renovación automática. No se reemplazó la validación del servidor por la lectura local de una sesión.
- Se reutilizan cliente, usuario y perfil dentro de la petición de render mediante `React.cache`, sin caché global entre usuarios. El rol visual llega desde el layout; los permisos reales siguen verificándose en servidor y RLS.
- Los fallos temporales de autenticación o perfil devuelven 503 sin borrar la sesión. No se entrega contenido protegido cuando no se puede verificar el acceso. Una sesión revocada exige autenticarse; las lecturas API reciben 401.
- Un wrapper convierte respuestas **5xx de Auth** en errores de transporte recuperables para el SDK. Evita que un 500 JSON sea tratado como error definitivo de renovación y borre el token. No reintenta mutaciones ordinarias ni transforma los 400/403 de Auth o los errores de tablas.
- Las cookies renovadas o eliminadas se conservan también al redirigir y al devolver errores. Respuestas de autenticación y monitoreo: `private, no-store`.
- El cierre voluntario es local, muestra errores y bloquea clics repetidos. Las cuentas inactivas siguen bloqueadas.
- `src/middleware.ts` pasa a `src/proxy.ts`, conservando el matcher y los controles, conforme a Next.js 16 instalado.

Pendiente en el panel de Supabase: comprobar duración máxima de sesión, inactividad y opción de sesión única. No se cambiaron esas opciones. Una cuenta por persona daría mejor trazabilidad y evitaría interferencias operativas; no se crearon usuarios en esta fase. [Sesiones de Supabase](https://supabase.com/docs/guides/auth/sessions).

## Actualización y rendimiento

- Inventarios utiliza una lectura GET cancelable, `/api/inventarios/monitor`, cada 30 segundos cuando la pestaña está visible y hay conexión. No reconstruye toda la página en cada ciclo. Los cambios guardados mantienen su actualización habitual.
- Un único ciclo por panel; las señales de foco/conexión no disparan ráfagas. Al desmontar se aborta la lectura GET y se ignoran resultados obsoletos.
- Tras errores: esperas de 60 y 120 segundos; al tercer fallo se pausa y se ofrece reintento manual. Se conserva la última consulta. Acceso revocado o cambio de cuenta bloquea el panel.
- El catálogo completo se carga al abrir y cada diez actualizaciones exitosas; las demás consultan solo las categorías de las tareas. La combinación descarta categorías de bodegas cuyo acceso se revocó. Se mantiene paginación explícita de 500 filas y lotes de 200 identificadores.
- La conciliación se solicita únicamente en Reportes. El monitor no necesita ese cálculo en cada ciclo.
- Mensajeros conserva el cargador operativo, con un solo trabajo simultáneo, pausa en segundo plano y reintentos limitados. Si una acción termina durante una lectura, se solicita una actualización posterior sin solapar trabajos. Un fallo del historial de almuerzos ya no se presenta como lista vacía.
- Evidencias conserva actualización cada cuatro minutos, pausa en segundo plano y reintentos limitados. Las Server Actions ya enviadas de Mensajeros/Evidencias no ofrecen cancelación de transporte desde el cliente: se descartan resultados de componentes desmontados; no se promete cancelar trabajo que ya recibió el servidor.
- No se encontraron suscripciones Realtime ni intervalos `setInterval` restantes en `src`. Despachos no tenía polling periódico; mantiene su consulta del mes y paginación existente. No se truncaron sus datos.
- El gate `INVENTORY_SELF_START_ENABLED` debe permanecer `false`. Si se habilita accidentalmente y el RPC falta, se desactiva en esa instancia del servidor. Este mecanismo en memoria no se comparte entre instancias de Vercel: el bloqueo principal es la variable desactivada.

Estas medidas reducen lecturas evitables. El ahorro real de CPU y latencia requiere medición tras el despliegue.

## Base de datos: propuesta pendiente

Archivo: `supabase/migrations/20261022144854_estabilidad_indices_lectura.sql`.

- Índice de fecha para pedidos.
- Índices de mensajero y de estado/fecha para rutas.
- Índices de mensajero y fecha para almuerzos.
- Misma política de lectura del perfil propio, usando `(select auth.uid())` para evitar evaluación repetida por fila. No cambia roles, condiciones de acceso ni políticas de administradores.

Es una transacción con `lock_timeout = 2s` y `statement_timeout = 30s`. La creación normal de índices puede bloquear escrituras brevemente: aplicar en baja actividad, tras revisar tamaño y carga; ante timeout, investigar y no insistir automáticamente. Para tablas grandes preparar una variante concurrente fuera de transacción. No se aplicó a producción. El ensayo local verifica sintaxis, idempotencia, filas conservadas y visibilidad RLS equivalente; no mide bloqueos ni planes del servidor real.

Los asesores también detectaron claves foráneas sin índices, políticas permisivas superpuestas y funciones con configuración de seguridad revisable. Se mantuvieron los permisos actuales. En particular, `pedidos` tiene una política `ALL` para autenticados con condición `true`, además de otra llamada “Solo admin puede editar o borrar pedidos”: esta última no restringe por sí sola la política amplia. Su corrección exige revisar el acceso funcional y probarlo por separado. No eliminar índices solo porque aparezcan como no utilizados.

`inventario_contexto` reúne personas, membresías y permisos con subconsultas correlacionadas; queda pendiente perfilar planes con identidades representativas en pruebas antes de reescribirlo. No se modificó la lógica de `inventario_contar_producto`, concurrencia de conteos ni transiciones del inventario. [Rendimiento de RLS](https://supabase.com/docs/guides/database/postgres/row-level-security#rls-performance-recommendations).

## Separación de ambientes

1. Crear un proyecto Supabase de pruebas o una instancia local independiente. Aplicar allí el esquema revisado y usar usuarios/datos de prueba, sin copiar datos sensibles de producción.
2. Completar `.env.development.example` y guardarlo como `.env.development.local`. Usa URL y clave pública de pruebas. `SUPABASE_SERVICE_ROLE_KEY` debe ser la clave de pruebas o quedar **explícitamente vacía** para no heredar la de `.env.local`. Nunca añadirle `NEXT_PUBLIC_`.
3. Revisar y retirar la configuración de producción del entorno cotidiano de desarrollo. No se modificó el `.env.local` existente automáticamente.
4. Ejecutar `npm run check:env -- development`. Actualmente falla por falta de declaraciones de ambiente/proyecto: esto es un bloqueo de validación esperado, no una configuración independiente ya activada. El comando no se conectará a Supabase ni mostrará claves.
5. Vercel Preview debe apuntar a pruebas, con `APP_ENV=staging`; Vercel Production, al proyecto de producción con `APP_ENV=production`. Ejecutar `npm run check:env -- staging` o `-- production` en el ambiente correspondiente. Las plantillas son referencias; no contienen claves ni reemplazan variables automáticamente.

El verificador comprueba URL, ambiente declarado y prefijos públicos peligrosos; no puede demostrar por sí solo que una clave opaca pertenece al proyecto ni validar permisos remotos. Añadirlo al proceso de Preview/CI después de configurar las variables. Las variables `NEXT_PUBLIC_` requieren nueva compilación para cambiar en el navegador.

## Pruebas realizadas

- `npm run build`: correcto, incluida compilación TypeScript y generación de rutas. La primera ejecución sin acceso de red falló descargando Google Fonts; la ejecución con acceso autorizado finalizó correctamente.
- ESLint de los archivos de aplicación afectados: correcto, sin avisos.
- Pruebas `src/**/*.test.mjs`: **67 aprobadas** (66 en la ejecución completa y un caso adicional del cargador, validado al repetir los 13 casos de estabilidad). Incluyen permisos, conteo ciego, evidencias, roles, estados, historial y estabilidad.
- SDK Supabase real instalado con transporte simulado: ocho renovaciones, recuperación tras 500 y eliminación de sesión con token revocado. No son ocho horas reales de autenticación.
- Planificador con reloj simulado: ocho horas, 960 ciclos sin solapamiento, pausa por invisibilidad, backoff y cancelación al desmontar.
- `scripts/test-inventario-operacion.cjs`: aprobado en PostgreSQL local en memoria; asignación idempotente, conteos persistidos, versiones, devolución, revisión, auditoría, evidencias y acceso revocado.
- `scripts/test-stability-db.cjs`: aprobado en PostgreSQL local en memoria; nueva migración aplicada dos veces sin pérdida de filas y con mismo aislamiento de perfiles.
- La revisión global `git diff --check` señaló espacios finales preexistentes en archivos de interfaz ajenos a esta fase; no se mezcló su limpieza con esta corrección.

Comandos reproducibles en PowerShell (el argumento de los scripts SQL debe contener una instalación de `@electric-sql/pglite`):

```powershell
$tests = Get-ChildItem src -Recurse -Filter '*.test.mjs' | ForEach-Object FullName
node --test $tests
node scripts/test-inventario-operacion.cjs "$env:TEMP/landimotos-db-validation-pg17"
node scripts/test-stability-db.cjs "$env:TEMP/landimotos-db-validation-pg17"
npm run build
```

## Despliegue controlado y pendientes de autorización

1. Revisar el diff: este workspace contiene cambios de fases anteriores; no incluirlos sin revisión en una entrega de estabilización.
2. Configurar pruebas aisladas. Probar en dos perfiles de navegador con la misma cuenta: cerrar uno y comprobar que el otro continúa; probar también cuentas distintas y cambio de cuenta en otra pestaña.
3. En pruebas, recorrer Inventarios, Despachos y Mensajeros: asignar, contar, guardar, recargar, finalizar, verificar/devolver y consultar informes/evidencias. Provocar desconexión y 503; comprobar conservación de sesión/datos y recuperación. Revocar una sesión de prueba y comprobar bloqueo. Cambiar repetidamente de ruta y comprobar que no aumentan los ciclos activos.
4. Verificar las opciones de Auth y preparar una jornada real de prueba con renovación y varias pestañas. Las pruebas automatizadas no sustituyen esta validación operativa ni acreditan ausencia de regresiones en producción.
5. Con aprobación de despliegue, publicar primero la corrección de código con autoinicio deshabilitado. Observar un grupo pequeño durante 30–60 minutos y después una jornada: CPU, tiempos de consultas, errores por ruta, renovaciones y ausencia de llamadas al RPC ausente. No establecer un porcentaje de mejora sin medirlo.
6. Revisar/aprobar por separado la migración de índices, aplicar en baja actividad y comparar latencias/planes. Reconciliar el historial de migraciones antes de activar autoinicio.
7. Si aparecen regresiones, volver al despliegue anterior desde Vercel; no borrar tareas ni revertir datos. Mantener el autoinicio deshabilitado y recordar que volver al código anterior también devuelve sus problemas de logout/polling. Los índices son independientes del código y no requieren eliminación automática.

Pendientes: crear/configurar el ambiente independiente; prueba funcional con usuarios en ese ambiente; revisión de opciones de Auth; revisión/aplicación de migración; aprobación/publicación en Vercel; observación de una jornada. No se solicitó subir el tamaño de Supabase ni se cambió infraestructura.

## Archivos de esta fase

- Autenticación: `src/proxy.ts` (reemplaza `src/middleware.ts`), `src/utils/supabase/{client,server,middleware,auth-errors,fetch,session.server}.ts`, `src/components/layout/{RoleProvider,UserMenu,Sidebar}.tsx`, `src/hooks/useRole.ts`, `src/app/(dashboard)/{layout,page}.tsx`, `src/app/error.tsx`.
- Inventarios: `src/modules/inventarios/access.server.ts`, `access.test.mjs`, `operations/{service.server,features.server,self-start.actions,types,useInventoryMonitor,monitor-snapshot}.ts`, `operations/{OperationsPanel,InventoryOverview,EvidencePanel}.tsx`, `src/app/(dashboard)/inventarios/reportes/page.tsx`, `src/app/api/inventarios/monitor/route.ts`.
- Actualización de Mensajeros: `src/app/(dashboard)/mensajeros/{useMensajerosData,actions}.ts`; planificador compartido `src/utils/polling.ts`.
- Validación y configuración: `src/utils/supabase/stability.test.mjs`, `scripts/{check-environment,test-stability-db}.cjs`, `.env.development.example`, `.env.production.example`, `.gitignore`, `package.json`, migración de índices y este documento.

La lista corresponde a esta fase; el estado de Git también incluye trabajo previo del proyecto.
