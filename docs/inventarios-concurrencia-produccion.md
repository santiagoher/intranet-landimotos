# Intervención de concurrencia en producción — 22/10/2026

El usuario autorizó resolver el incidente después de revisar la corrección y los pasos pendientes. Se aplicó únicamente la migración crítica de concurrencia al proyecto Supabase `loajbvlgpsxrkfzyxbui`. No se desplegó el frontend, no se aplicaron índices y no se reinició el proyecto.

## Antes de la corrección

- 10:55–10:56 a. m. (America/Bogota): 5.997 errores PostgreSQL `40001` en un minuto: 2.907 del PID 5374 y 3.090 del PID 6078.
- El contexto del error era `inventario_private.contar_producto(uuid,integer,text) line 8 at RAISE`, invocado por `inventario_contar_producto`.
- A las 10:56:55 a. m. se volvieron a verificar ambos PID, sus fechas de inicio, usuario `authenticator`, aplicación `postgrest` y consulta exacta. Las cuatro funciones seguían utilizando el error personalizado 40001.
- Respaldo de definiciones y permisos: `docs/sql/inventarios-concurrencia-respaldo-20261022.json`. Es evidencia histórica, **no un script de reversión para restaurar 40001**.

## Aplicación y comprobación

- Supabase confirmó la migración `inventarios_conflictos_version`, versión registrada **20261022155724**, a las 10:57 a. m.
- Archivo local: `supabase/migrations/20261022155724_inventarios_conflictos_version.sql`. El preparado `20261022152345` fue renombrado para coincidir con el historial remoto; el contenido SQL se conservó.
- A las 10:57:42 a. m. se compararon las definiciones completas anteriores y posteriores. En las cuatro funciones, el único cambio fue `errcode='40001'` por `errcode='PT409', detail='INVENTORY_VERSION_CONFLICT'`.
- Propietarios, grants, `SECURITY DEFINER` y `search_path` permanecieron idénticos. Los controles de versión, bloqueos y auditoría se conservaron dentro del cuerpo de las funciones.
- Los PID 5374 y 6078 **ya no aparecían** tras aplicar la corrección. No fue necesario ejecutar `pg_terminate_backend` ni intervenir otras conexiones. La desaparición se observó; no se atribuye a una terminación ejecutada por el agente.
- No se ejecutaron pruebas de escritura sobre inventarios reales ni cambios en cantidades, fotografías, usuarios, perfiles, roles o claves.

## Alcance y pendientes

La corrección del bucle en la base de datos es independiente de publicar la interfaz. El frontend mejorado que conserva borradores y muestra el conflicto sigue pendiente de despliegue controlado en Vercel; el frontend anterior puede mostrar un error genérico ante un conflicto, pero el servidor mantiene la protección de versiones.

La migración de índices B sigue sin aplicar. No ejecutar un `db push` general: persisten divergencias históricas anteriores que no forman parte de esta intervención.

Se consultó el asesor de seguridad después del cambio. La comparación exacta de las funciones confirma que esta intervención no amplió sus permisos. Los avisos de seguridad preexistentes siguen siendo una revisión independiente; no se cambiaron políticas para silenciarlos. [Asesor de seguridad de Supabase](https://supabase.com/dashboard/project/loajbvlgpsxrkfzyxbui/advisors/security).

## Resultado observado

- La consulta de correlación **10:56–11:00 a. m.** confirmó el corte al aplicar la migración: el último `40001` del PID 5374 fue a las **10:57:24.342** y el del PID 6078 a las **10:57:24.353**. Inmediatamente después, el PID 6078 registró **un único `PT409` a las 10:57:24.359**, sin repetición en esa ventana. Los recuentos históricos de ese intervalo fueron 4.159 y 4.277 errores `40001`, respectivamente.
- A las **11:00:16 a. m.**: cero PID originales presentes, cero funciones de `inventario_private` con `40001` y ninguna solicitud activa/abortada de `inventario_contar_producto` en `pg_stat_activity`.
- Ventana nueva **10:58–11:00 a. m.**: la consulta al servicio de logs devolvió **0 errores 40001**, 0 entradas de los PID originales y 0 entradas PostgreSQL totales. Es ausencia de nuevos errores registrados en esa ventana; no es una prueba de tráfico de usuarios ni descarta retrasos de ingestión.
- Antes: 5.997 errores/minuto en la ventana 10:55–10:56 a. m. La combinación de código corregido, procesos ausentes y ausencia de nuevos errores es consistente con el fin del bucle observado.
- El archivo aplicado conserva SHA-256 `D9780DB91637F2F2D631D2122A790E09B2E0904453141B41C25B4C28187BCA63`, idéntico al preparado. Las pruebas operacionales locales volvieron a pasar tras alinear el nombre del archivo con Supabase.

Los errores históricos permanecen en el visor; para evaluar el resultado hay que filtrar desde la hora de la corrección. No se afirma una reducción de CPU sin una medición específica. Revisar una jornada de uso normal sigue siendo recomendable; otros errores, como llamadas al RPC de autoinicio ausente desde un frontend anterior, son distintos del bucle 40001 corregido aquí.
