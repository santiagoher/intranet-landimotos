# Corrección crítica de concurrencia y entregas A/B

Fecha: 22/10/2026, America/Bogota. **Actualización: la corrección SQL fue aplicada en producción a las 10:57 a. m., tras la autorización del usuario de solucionar el incidente. No se desplegó el frontend ni se terminó ninguna conexión.** El procedimiento original y las pruebas previas se conservan debajo; el resultado de la intervención está en `inventarios-concurrencia-produccion.md`.

## Diagnóstico verificado

Se inspeccionaron las definiciones completas de las funciones remotas y sus permisos. La consulta de `pg_stat_activity` del **22/10/2026 a las 10:21:19 a. m.** encontró:

| PID | Usuario / aplicación | Estado observado | Inicio del backend, UTC | Consulta |
|---|---|---|---|---|
| 5374 | authenticator / postgrest | active | 2026-10-21 19:49:41.948750+00 | public.inventario_contar_producto |
| 6078 | authenticator / postgrest | idle in transaction (aborted) | 2026-10-21 19:54:47.014255+00 | public.inventario_contar_producto |

En el intervalo **10:20–10:21 a. m.**, los registros PostgreSQL contabilizaron **3.004 errores `40001` del PID 5374 y 2.996 del PID 6078: 6.000 en un minuto**. Las consultas de ambos procesos corresponden al RPC del conteo. La identidad es una observación histórica, no una autorización para terminar esos PID después: pueden cambiar o reutilizarse.

La guía oficial confirma que un `40001` lanzado manualmente puede provocar este bucle en PostgREST 14, y señala la corrección en PostgREST 16. El patrón encontrado coincide con el incidente descrito. La consulta de lectura al documento OpenAPI respondió 401; **no se confirmó la versión exacta del PostgREST instalado** ni se cambió su configuración para averiguarla. No se atribuye cada pico de CPU exclusivamente a este problema. [Diagnóstico oficial de Supabase](https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b).

## Entrega A: migración mínima

Archivo aplicado: `supabase/migrations/20261022155724_inventarios_conflictos_version.sql`. Se renombró el archivo preparado `20261022152345` para coincidir con la versión registrada por Supabase, conservando exactamente su SQL.

| Función privada | Condición que conserva | Excepción sustituida |
|---|---|---|
| actualizar_tarea(uuid,integer,text,integer,text) | versión nula o `t.version <> p_version`, después de controles de acceso/modo | La tarea cambió… |
| contar_producto(uuid,integer,text) | versión nula o `t.version <> p_version`, después del control de operador | La tarea cambió… |
| revisar_conteo(uuid,integer,text,text) | versión nula o `p_version <> t.version`, después del control de líder | La tarea cambió… |
| observacion_guardar(uuid,text,integer) | `p_version is distinct from coalesce(o.version,0)` | La observación cambió… |

La cuarta función se encontró durante la inspección: tenía el mismo uso manual de `40001`, aunque no figuraba en la lista inicial. Se incluye para cerrar esa misma vía de reintentos al guardar notas. No se cambia el manejo de fotografías.

El resultado es `SQLSTATE PT409`, con detalle `INVENTORY_VERSION_CONFLICT`. PostgREST lo traduce a HTTP 409 y el cliente lo distingue de una serialización real o de un fallo transitorio. `P0001` también evita el bucle, pero devuelve un error de negocio genérico; se elige `PT409` para expresar el conflicto explícitamente. [Errores personalizados de PostgREST](https://docs.postgrest.org/en/stable/references/errors.html#raise-errors-with-http-status-codes).

La migración enumera las cuatro firmas y reemplaza **una sentencia RAISE exacta por función** obtenida mediante `pg_get_functiondef`. Si la firma falta o el fragmento esperado cambió, falla y revierte toda la transacción. Puede volver a ejecutarse si ya está aplicada. No realiza sustituciones globales de `40001`, no edita migraciones históricas y no toca excepciones reales de serialización.

Se conservan el resto del cuerpo de cada función, `FOR UPDATE`, control de versiones, estados, restricciones, propietario, `SECURITY DEFINER`, `search_path`, grants y auditoría. No hay INSERT/UPDATE/DELETE sobre datos del negocio. Los índices de la entrega B no forman parte de esta migración. Timeouts de bloqueo/ejecución: 2/15 segundos; no reintentar automáticamente si fallan.

## Entrega A: interfaz y cliente

- `actions.ts` devuelve un conflicto estructurado y usa `.retry(false)` en mutaciones. La versión instalada de `postgrest-js` ya limita sus reintentos automáticos a métodos idempotentes; aun así se deshabilitan explícitamente en estas escrituras. El bucle observado era interno al servidor, no un `while` del formulario.
- `conflicts.ts` reconoce `PT409` con marcador y, durante la transición, los mensajes exactos antiguos con `40001`/`P0001`. Un `40001` real con otro mensaje no se clasifica como conflicto de negocio.
- `getTaskSnapshot` autentica, lee la tarea bajo RLS, consulta el RPC existente de conteos/comparación y vuelve a comprobar la versión. Si cambió entre lecturas, no entrega una mezcla de datos: exige una nueva consulta manual. El parámetro de vista no concede acceso a comparaciones; el RPC mantiene su autorización.
- `OperationsPanel.tsx` mantiene los borradores por ID de producto en el detalle, conserva su versión original y evita guardados simultáneos desde el mismo detalle. Al recibir conflicto realiza una lectura, **sin volver a enviar la escritura**. Los borradores sobreviven a cambios de filtro, página y actualizaciones de datos del detalle.
- `CountRow.tsx` muestra el valor introducido y el último conteo guardado. El operador puede usar el guardado o conservar su borrador para reintentar. Conservarlo **no guarda**: después debe pulsar Guardar, con la versión revisada. Si vuelve a cambiar, se vuelve a bloquear. No se muestra el saldo esperado.
- Finalizar/verificar/devolver conservan la observación escrita ante conflictos y requieren revisar los datos actualizados antes de repetir la acción. Se impide finalizar con borradores de cantidades pendientes.
- `EvidencePanel.tsx` conserva también la versión base y el borrador de una observación mientras llegan actualizaciones; un refresco no adopta silenciosamente una versión nueva para sobrescribir otro texto. Un conflicto exige consultar y aceptar la revisión antes de guardar otra vez.
- Los borradores son **temporales en memoria**, no saldos ni datos confirmados. Al cerrar el detalle se advierte si hay cantidades pendientes; también se añade aviso del navegador al recargar/salir. No se promete recuperación tras cerrar la pestaña, cambiar de cuenta o descartar el aviso. No se almacenan cantidades sensibles en almacenamiento compartido.
- Se usan los tokens y componentes actuales; no se rediseñaron los módulos ni el sistema de temas.

Se mantienen las correcciones anteriores: logout local, validación segura de sesión, conservación ante errores transitorios, cookies, rol visual desde servidor, polling controlado/cancelable y autoinicio deshabilitado mientras falta su RPC.

## Pruebas y límites

1. **74 pruebas Node aprobadas**: las de estabilidad/permisos anteriores y siete casos nuevos de clasificación, borradores, renderizado, una sola mutación, observaciones y lectura consistente. SDK Supabase/PostgREST real con transporte simulado: un único POST ante PT409, 40001 y 503; no se reintenta la escritura.
2. **PostgreSQL local en memoria (PGlite)**: se ejecutó el esquema y la suite operacional. La migración se aplicó dos veces y se compararon cuerpos completos: solamente cambian las cuatro excepciones. Mismos propietarios, configuración, grants y políticas RLS.
3. Dos guardados con la misma versión: uno aceptado y uno rechazado con PT409. Se conserva el conteo ganador; ningún otro producto cambia. Los rechazos por contar/actualizar/revisar/observar no alteran la tarea ni agregan auditoría. Se conservan notas, cero y decimales; finalización y revisión del líder funcionan. Tickets ajenos, acceso de otro operador y escrituras directas siguen protegidos.
4. **Interacción real en Edge aislado**, con componentes React actuales y acciones simuladas: se introduce 19, otra escritura deja 7, aparece el conflicto y el borrador 19 se conserva al filtrar. No hay nuevo envío al resolver; solo el siguiente Guardar envía una vez con versión 2. El segundo producto permanece intacto.
5. Tema claro/oscuro mediante el atributo real `data-theme`, anchos 1.280 y 390 px: sin desbordamiento horizontal de página; contraste del aviso al menos 4,5:1. Capturas revisadas visualmente.
6. Compilación de producción y ESLint de código afectado verificados. La prueba de sesión transitoria de la fase anterior sigue pasando.

PGlite serializa el acceso de su conexión local: la prueba reproduce dos intentos con la misma versión, pero **no sustituye una prueba con dos conexiones PostgREST reales**. La ausencia del bucle del servidor se apoya en eliminar el código que lo activa y en la guía oficial; deberá confirmarse con logs tras la aplicación aprobada. Todas las escrituras de prueba fueron aisladas, sin datos de producción.

Comandos (PowerShell):

```powershell
$tests = Get-ChildItem src -Recurse -Filter '*.test.mjs' | ForEach-Object FullName
node --test --test-reporter=dot $tests
node scripts/test-inventario-operacion.cjs "$env:TEMP/landimotos-db-validation-pg17"
npm run build
node scripts/test-inventario-concurrency-ui.cjs
```

El script SQL requiere `@electric-sql/pglite` en la carpeta indicada. El de interfaz requiere Edge, Node con WebSocket y una compilación `.next`; crea un perfil temporal independiente y simula todas las acciones del servidor. No abre el perfil habitual ni utiliza credenciales.

## Conexiones atrapadas: procedimiento pendiente de aprobación

Archivo revisable: `docs/sql/inventarios-conexiones-atrapadas.sql`. **No se ejecutó su bloque de terminación.**

1. Aprobar explícitamente la intervención y pausar nuevos guardados de inventario durante la ventana. No reiniciar Supabase ni detener los otros módulos.
2. Aplicar primero la migración crítica aprobada. Esto evita nuevos bucles; no garantiza detener transacciones que ya estaban atrapadas.
3. Consultar otra vez ambos PID y correlacionar los errores 40001 **recientes** por `parsed.process_id`, consulta y contexto. Si ya no existen, dejaron de producir el error o ejecutan otra consulta, no terminarlos.
4. Para cada objetivo confirmado, copiar desde esa lectura `backend_start` y `md5(query)` al bloque manual. Requiere habilitar expresamente su confirmación; los valores iniciales NULL impiden ejecutar una terminación accidental.
5. El bloque vuelve a validar inmediatamente PID, inicio del backend, base actual, usuario, aplicación, tipo de backend, estado y huella de consulta. Solo entonces envía `pg_terminate_backend` a **ese único PID**. Repetir la verificación completa antes del segundo; no usar un filtro masivo por usuario o aplicación.
6. Confirmar desaparición del proceso y descenso de nuevos errores. Informar a los operadores de una petición interrumpida y pedir consultar el conteo antes de reenviarlo. Terminar el backend aborta trabajo no confirmado en esa conexión; no borra transacciones ya confirmadas ni fotografías.

Un PID puede reutilizarse y la consulta puede cambiar; no hay autorización permanente basada en este informe. La comprobación reduce el riesgo, pero exige la correlación humana con logs y la pausa de nuevas escrituras indicada arriba.

## Revisión de Git y separación de entregas

HEAD local inspeccionado: `aa0bf5474ca9aabc06574a2c28d25190324b40b6`. No se ha demostrado que sea el commit actualmente desplegado en Vercel.

El árbol contiene archivos modificados y **gran parte de Inventarios sin seguimiento de Git**, además de G21, datos Excel, navegación, diseño y migraciones anteriores. `git diff` solo no muestra el contenido de los archivos nuevos. No se hizo `git add .`, commit, push, reparación del historial ni despliegue.

**A — Alcance funcional autorizado:** la migración de conflictos, `operations/{actions,conflicts,evidence.actions}.ts`, `operations/{OperationsPanel,CountRow,EvidencePanel}.tsx`, pruebas de conflictos/evidencias/SQL/interfaz y este procedimiento. Añadir las correcciones de autenticación y actualización enumeradas en `estabilizacion-produccion.md`, con sus dependencias revisadas.

**Excluir de A salvo dependencia comprobada contra la base desplegada:** mejoras visuales de fases anteriores, G21/importaciones, cargas Excel, nuevos roles/usuarios, activación de autoinicio, migraciones históricas y cambios generales de dependencias. `Sidebar.tsx` mezcla diseño previo y logout local: revisar por fragmentos. No sustituirlo entero sin comparar. Las carpetas nuevas necesarias deben contrastarse con el artefacto realmente desplegado, no omitirse arbitrariamente.

**B — Mantener separado y sin aplicar:** `supabase/migrations/20261022144854_estabilidad_indices_lectura.sql` y su prueba `scripts/test-stability-db.cjs`. Antes de B revisar tamaño, planes con roles representativos, bloqueos y ventana operativa. No incluir esta migración al aplicar A aunque tenga una fecha anterior en el directorio.

No se construyó un commit de publicación a partir del workspace mezclado. Antes de publicar, identificar en Vercel el commit/artefacto base, preparar una rama limpia desde él y portar solo A; ejecutar allí nuevamente build y pruebas. Hasta comparar esa base, la compilación de todo el workspace **no certifica un paquete A aislado listo para publicar**.

## Orden exacto de aplicación y despliegue

1. Identificar la base real de Vercel, revisar el diff de A y reconciliar la divergencia del historial SQL descrita en el informe anterior. Separar B y no ejecutar `supabase db push` sobre todo el directorio.
2. En pruebas independientes, aplicar únicamente la migración A, desplegar la interfaz A y probar dos navegadores/conexiones reales con la misma cuenta y versiones antiguas. Probar también líder, operador, acceso revocado y autenticación transitoria. No usar datos simulados en producción.
3. Obtener aprobación explícita para la migración A, eventual terminación selectiva y publicación. Conservar definiciones/ACL previas y el identificador del despliegue anterior para revisión; nunca restaurar automáticamente el error 40001.
4. Pausar brevemente nuevos guardados de Inventarios. Aplicar **solo** `20261022155724_inventarios_conflictos_version.sql` mediante una migración individual revisada, registrando nombre/versión conforme al historial reconciliado. **Corrección SQL ya aplicada; no repetir este paso.**
5. Verificar las cuatro definiciones resultantes y permisos. Reidentificar los PID y, solo si siguen atrapados y está autorizada la intervención, ejecutar el procedimiento selectivo. No reiniciar todo el proyecto.
6. Publicar A en Vercel con autoinicio deshabilitado. El orden SQL primero es compatible con el frontend anterior: este puede mostrar un error genérico ante PT409, pero no pierde la protección de versión ni crea el bucle nuevo.
7. Reabrir guardados para un grupo pequeño, observar 30–60 minutos y después una jornada. Los operadores deben refrescar la pestaña para recibir la nueva interfaz. Medir errores, latencias, CPU, sesiones, conteos y auditoría; luego ampliar al resto.
8. Solo una vez estabilizado, evaluar B en una revisión y ventana separadas. Esta fase no solicita ampliar infraestructura.

## Confirmar que el incidente desapareció

- Revisar `pg_get_functiondef` de las cuatro firmas: el RAISE personalizado debe tener `PT409` y el marcador. Ninguna debe conservar el RAISE de versión con 40001. No exigir que desaparezca todo 40001 legítimo de PostgreSQL.
- En Logs Explorer, agrupar `postgres_logs` por `parsed.process_id`, `parsed.sql_state_code` y `parsed.context`, en ventanas nuevas de un minuto: el patrón de miles de errores de las funciones debe cesar. La referencia previa es 6.000/minuto entre ambos PID.
- Confirmar que los backend atrapados terminaron o dejaron el bucle; no basta con que el frontend muestre menos errores.
- En pruebas, una solicitud RPC con versión obsoleta debe producir una sola respuesta HTTP 409/PT409; la interfaz debe hacer lectura de recuperación y ninguna escritura nueva sin intervención del usuario. Las Server Actions encapsulan el resultado: no exigir HTTP 409 en la petición del navegador a Next.js, sino en el RPC PostgREST.
- Comprobar que un guardado exitoso genera solo el cambio/auditoría esperados y que el conflicto no cambia cantidades, notas ni tickets ajenos. Verificar también los conteos que estaban guardados antes de la ventana.
- Comparar CPU y latencias con la misma carga; no declarar un porcentaje de mejora antes de medirlo.

## Riesgos y reversión

- Si la definición remota cambió, la migración falla cerrada y revierte; inspeccionar en lugar de forzar un reemplazo global.
- Si falla el frontend A, volver al despliegue anterior **conservando la corrección SQL PT409**. No restaurar 40001 personalizado, pues reintroduce el incidente. Los clientes antiguos mantienen la validación aunque su mensaje sea genérico.
- Si se detectara incompatibilidad de PT409 en el servicio real, preparar y aprobar una corrección mínima hacia `P0001` conservando mensaje, marcador y guardas. No retirar el control de versiones ni reintentar escrituras automáticamente.
- Si la migración encuentra bloqueo/timeout, detener la aplicación y revisar la actividad. No repetir en bucle ni aplicar los índices como supuesto remedio.
- Ante una respuesta de red perdida, no asumir que el conteo falló: consultar primero el guardado. La conservación del borrador no equivale a una confirmación del servidor.

Estado actualizado: la migración crítica ya está aplicada. Ambos PID dejaron de aparecer tras la aplicación y no se ejecutó `pg_terminate_backend`. La publicación del frontend en Vercel y B continúan pendientes. No se borraron datos, fotos, tablas, perfiles o usuarios, ni se cambiaron claves o roles.
