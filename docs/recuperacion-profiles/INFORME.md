# Investigación de recuperación selectiva de perfiles — 22 de octubre de 2026

## Resultado

**No se encontró una copia de la estructura ni de los registros originales de `public.profiles` en las fuentes examinadas.** No es posible preparar una restauración fiel de esa tabla con esta evidencia. Los cuatro nombres de columnas indicados por el usuario no permiten establecer sus tipos, restricciones, relaciones ni permisos originales.

Hay una diferencia de nombre que debe aclararse antes de restaurar: este repositorio utiliza **`public.perfiles`**, no `public.profiles`. En el proyecto Supabase conectado, `loajbvlgpsxrkfzyxbui`, `to_regclass('public.profiles')` devuelve NULL; `public.perfiles` existe y tiene **4 filas**. Esto no demuestra que una tabla separada `profiles` nunca haya existido, ni permite tratar ambas tablas como equivalentes.

La huella de las filas actuales de `perfiles`, calculada con el mismo método que las comprobaciones anteriores, es `380d2a3d2a8ae0f8ec8cf23652d4807b`. Coincide con los JSON de verificación anteriores del 22 de octubre. Es evidencia de coincidencia con esas comprobaciones, **no un respaldo reversible ni una prueba sobre las filas de `profiles`**. No se exportaron nombres, correos o registros personales durante esta investigación.

Solo se ejecutaron consultas SELECT en producción. No se ejecutaron DROP, CREATE, INSERT, UPDATE, migraciones, restauraciones ni cambios de permisos. Los únicos archivos creados son los de esta investigación local.

## Alcance de búsqueda

- Archivos actuales, incluidos no versionados e ignorados del repositorio: SQL, CSV, JSON/JSONL y posibles extensiones de respaldo (`dump`, `backup`, `bak`, `zip`, `gz`, `tar`, `7z`). Se excluyeron los árboles generados/de dependencias `.next`, `node_modules`, `.vercel` y el contenido binario de `.git` de este recorrido; Git se inspeccionó por separado. No se encontraron archivos CSV ni dumps/archivos comprimidos de base en este alcance.
- Todos los **27 commits** alcanzables desde ramas y reflogs. El repositorio no es shallow. Solo existe la rama main y no hay stashes.
- El remoto se consultó con `git ls-remote --heads --tags origin`: solo anuncia main en `aa0bf5474ca9aabc06574a2c28d25190324b40b6`, igual a HEAD. No se modificaron referencias ni se hizo checkout/reset.
- `git fsck --full --no-reflogs --unreachable`: **557 objetos no alcanzables**, incluidos **209 blobs**, todos inspeccionados; no hay commits adicionales no alcanzables. Las 14 coincidencias de DDL/inserciones de perfiles son versiones de pruebas aisladas con PGlite y usuarios sintéticos TEST/DEMO USER.
- Las dos versiones históricas de `supabase_schema.sql`, en `a4a0b3ba439e9eafa77218cc502dccf94bbb0aec` y `62c6a5595018d0f047d61104aa15c1075c1dfacc`.
- El esquema aportado previamente por el usuario en el adjunto `ac0c6916-a838-4136-a909-e12348556702/Texto pegado.txt`.
- Catálogos actuales de PostgreSQL e historial registrado en `supabase_migrations.schema_migrations`, solo en lectura. No se encontraron definiciones de `profiles` en las migraciones registradas ni menciones en cuerpos de funciones de `public`/`inventario_private`.

No se examinó todo el disco, otros repositorios, copias históricas de OneDrive/Papelera, respaldos de terceros ni el contenido de backups alojados por Supabase. La conclusión se limita a las fuentes anteriores; no afirma que una copia no pueda existir fuera de ellas.

## Archivos y evidencias

| Fuente | Qué contiene | ¿Recupera `public.profiles`? |
| --- | --- | --- |
| `supabase_schema.sql` y sus dos versiones Git | Referencias y claves foráneas a `public.perfiles`, por ejemplo desde checklists, alertas y atención. No contiene CREATE TABLE de perfiles ni sus filas. | No |
| `docs/sql/inventarios-propuesta.sql` | Presupone `perfiles.id` y define relaciones de inventarios hacia esa tabla. | No |
| `supabase/migrations/20261020155954_crear_inventarios_bodegas.sql` y demás migraciones de inventarios | Consumen `public.perfiles`; no son una copia de esa tabla. | No |
| `supabase/migrations/20261020181155_inventarios_catalogo_excel_inicial.sql` | Catálogo de bodegas/categorías y relaciones con perfiles existentes; no respaldo de filas de perfiles. | No |
| `scripts/test-inventario-demo.cjs` y otros tests de inventarios; 14 blobs huérfanos identificados | Esquemas mínimos y usuarios artificiales para pruebas aisladas. Nunca usarlos como registros originales. | No |
| `docs/sql/inventarios-concurrencia-respaldo-20261022.json` | Definiciones, propietarios y permisos de funciones operacionales; no filas de perfiles. | No |
| `docs/sql/inventarios-demo-compartido-antes.json`, `inventarios-demo-compartido-aplicado.json`, `inventarios-demo-filtros-verificacion.json` | Huellas y verificaciones, incluido `profiles_hash`, que en estas comprobaciones se calculó sobre `public.perfiles`. No contienen las filas originales; el nombre de la clave JSON no identifica una tabla `profiles`. | No |
| `carrucel-categorias .json`, `src/modules/inventarios/local/excel-source.json` | Catálogos/productos y datos de Excel, sin perfiles. | No |
| `src/utils/supabase/session.server.ts` y `src/app/(dashboard)/admin/usuarios/actions.ts` | Consultas de aplicación a `.from('perfiles')`. | Evidencia del nombre usado; no respaldo |
| Adjunto de esquema aportado por el usuario | CREATE TABLE de `public.perfiles`, sin filas, RLS ni GRANT originales. Extracto conservado en `esquema-perfiles-aportado.md`. | No acredita la estructura de `profiles` |
| `perfiles-metadatos-actuales.json` (nuevo) | Metadatos actuales de la tabla existente: columnas, constraints entrantes/salientes, índices, RLS, ACL, propietario y trigger relacionado. | Solo describe `perfiles` actual |
| `dependencias-actuales.json` (nuevo) | Definiciones y ACL actuales de `es_admin` y `handle_new_user`, más resultados negativos de búsqueda remota. | Solo dependencias de `perfiles` |
| `git-investigacion.json` (nuevo) | Commits, objetos huérfanos candidatos, identificación como tests y versiones del esquema. | Evidencia del alcance de búsqueda |

Las menciones a la palabra inglesa `profiles` en archivos actuales y blobs huérfanos están en comentarios sobre pruebas; no son SQL de `public.profiles`.

## Estructura comprobable: `public.perfiles`, no `public.profiles`

| Columna | Tipo actual | Restricciones/default |
| --- | --- | --- |
| `id` | `uuid` | NOT NULL, PK, FK a `auth.users(id)` con ON DELETE CASCADE; sin default |
| `email` | `text` | NOT NULL, UNIQUE; sin default |
| `nombre` | `text` | Admite NULL |
| `rol` | `text` | Admite NULL; default `Operativo`; CHECK Admin/Operativo |
| `estado` | `text` | Admite NULL; default `activo`; CHECK activo/inactivo |
| `created_at` | `timestamp with time zone` | Admite NULL; default `now()` |
| `modulos_permitidos` | `text[]` | Admite NULL; default arreglo vacío |

El esquema del adjunto coincide en esas columnas, pero su FK no incluye la cláusula ON DELETE CASCADE que sí aparece actualmente. No debe aplicarse ese texto sin revisión.

Metadatos actuales de `perfiles`:

- Dos índices únicos B-tree: `perfiles_pkey` sobre id y `perfiles_email_key` sobre email.
- Propietario postgres; RLS habilitado, FORCE RLS deshabilitado.
- Política permisiva ALL para public: `Admins ven todos los perfiles`, USING `es_admin()`, sin WITH CHECK explícito. Política permisiva SELECT para public: `Usuarios pueden ver su propio perfil`, USING `auth.uid() = id`.
- ACL exactas conservadas en el JSON, para postgres, anon, authenticated y service_role. Son evidencia de la configuración actual, no una recomendación de ampliar permisos.
- Trigger `on_auth_user_created`, en `auth.users`, invoca `handle_new_user()` e inserta en `perfiles` al crear usuarios. No se ejecutó ni se modificó.
- Existen relaciones entrantes desde vehículos, atención e inventarios, incluidas tablas privadas de operación. Sus nombres, acciones ON DELETE y definiciones están en el JSON; no deben recrearse ni duplicarse porque actualmente existen.

**Para `public.profiles` siguen desconocidos:** tipos y defaults originales, PK/UNIQUE, índices, FK entrantes/salientes, políticas RLS, ACL, triggers, propietario, cantidad original de filas y valores de cada registro. No se puede derivar esa información de `perfiles` sin confirmar que se trata de la misma entidad y localizar evidencia del cambio de nombre.

## Procedimiento propuesto de recuperación selectiva, no ejecutado

1. **Resolver la identidad del objeto.** Confirmar proyecto, nombre exacto y hora aproximada de eliminación. Si el objeto pretendido era `public.perfiles`, la tabla existe actualmente y no corresponde recrearla. Investigar cualquier fila concreta que falte contrastando UUID y una fuente original, sin reemplazar la tabla completa.
2. **Obtener una fuente auténtica anterior al incidente.** Buscar un dump lógico SQL/custom/directory o exportación original en OneDrive con historial de versiones, respaldos de equipo o del responsable anterior. Un CSV/JSON de filas solo recupera datos; requiere por separado DDL, índices, constraints, RLS y privilegios. Git no contiene las filas de la base por el hecho de versionar su código. `auth.users` no permite reconstruir fielmente nombres, roles o fechas de una tabla eliminada: no asignar valores a partir de supuestos ni usar metadata editable del usuario como autorización.
3. **Preparar una base local desechable, sin otra instancia Supabase de pago.** Conservar el respaldo original intacto, registrar fecha y SHA-256. Inspeccionar el dump y usar PostgreSQL local/Docker compatible; si necesita funciones de Supabase Auth, usar un entorno Supabase local o preparar esas dependencias exclusivamente en el entorno desechable. No ejecutar el dump completo contra producción.
4. **Extraer la tabla y todos sus objetos asociados.** Para un archivo custom/directory, generar el índice con `pg_restore --list respaldo.dump`. Seleccionar en una lista revisada la tabla, TABLE DATA, constraints, índices, secuencias/defaults si existen, triggers, funciones necesarias, propietario, ACL, políticas y estado RLS. Revisar también claves foráneas entrantes: pueden pertenecer a otras tablas y no aparecer al filtrar solamente el nombre de la tabla objetivo. Las dependencias existentes no deben sobrescribirse sin comparar. Generar un SQL local mediante `pg_restore --use-list seleccion.list --file restauracion-selectiva.sql respaldo.dump`, sin parámetro de conexión. **No basta `pg_restore -t profiles`: ese filtro no incluye automáticamente índices u otros objetos subsidiarios y tampoco resuelve dependencias.** [Documentación de pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html).
5. **Ensayar y validar localmente.** Restaurar el alcance seleccionado solo en la base local. Comprobar conteo y valores contra el respaldo, UUID duplicados, correos únicos si aplica, fechas originales, valores NULL y huérfanos de FK. Comparar DDL/ACL/propietarios/índices/triggers/RLS contra la fuente original. Probar lectura/escritura como anon, usuario propietario, usuario ajeno y administrador. No reemplazar las reglas originales por una política genérica permisiva. Si falta cualquier componente de seguridad, declararlo faltante y completar evidencia antes de una restauración fiel.
6. **Preparar el cambio mínimo para revisión.** Solo con evidencia completa y autorización posterior: respaldar el estado actual de las tablas relacionadas; preparar una transacción que reconstruya únicamente el objeto confirmado como ausente, cargue las filas originales y restituya exactamente sus índices, restricciones, relaciones, triggers, propietario, GRANT/REVOKE y RLS. Mantener RLS y permisos finales preparados antes de COMMIT. No usar DROP/--clean, no restaurar toda la base, no deshabilitar triggers globalmente, no regenerar UUID ni fechas y no sustituir `auth.users`. Ante conflictos o huérfanos, detenerse; no inventar filas ni borrar referencias para hacer pasar la validación.
7. **Verificar antes de confirmar y después.** Validar constraints, índices y matriz de acceso con las mismas pruebas del ensayo; ante error, rollback de la transacción completa. Tras confirmar el cambio autorizado, comparar conteos y comportamiento de las rutas consumidoras y actualizar el caché de esquema de la API si corresponde. No modificar tablas ajenas por conveniencia.

Los comandos anteriores describen un procedimiento futuro; no se ejecutaron. No se generó una migración de restauración porque faltan la estructura y los datos originales de `profiles`.

## Límites de los backups administrados

La vía local/selectiva depende de disponer de un respaldo lógico accesible. Supabase documenta que los backups físicos no son descargables directamente; no se debe asumir que un snapshot administrado puede convertirse automáticamente en un SQL de una sola tabla. No se activó PITR ni se inició una restauración o un proyecto adicional. Si solo existe un backup físico administrado, se puede consultar a soporte por las opciones disponibles, sin prometer recuperación selectiva gratuita. [Documentación de backups de Supabase](https://supabase.com/docs/guides/platform/backups).

**Decisión con la evidencia actual:** conservar `perfiles` existente. Para una tabla distinta llamada `profiles`, la recuperación de sus registros originales queda pendiente de encontrar un respaldo auténtico o confirmar que se indicó un nombre diferente al real. No hay registros originales recuperados que se puedan insertar con seguridad.
