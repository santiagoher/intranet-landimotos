# Validación de la propuesta de Inventarios

Fecha: 20 de octubre de 2026. Resultado: **11 grupos de comprobaciones SQL aprobados y estructura desplegada en Supabase**, tras autorización explícita del usuario. El archivo [SQL propuesto](sql/inventarios-propuesta.sql) conserva `ROLLBACK` como referencia; la [migración aplicada](../supabase/migrations/20261020155954_crear_inventarios_bodegas.sql) contiene el DDL desplegado.

## Despliegue y comprobación remota

 ios_bodegas`. La CLI generó el archivo local y se ajustó su versión al registro devuelto por la herramienta de migraciones remotas.

- 18 tablas creadas: 17 en `public` y `inventario_private.operaciones`.
- 42 claves foráneas; ninguna restricción sin validar.
- RLS habilitado y forzado en las 18 tablas; 17 políticas públicas de lectura.
- Cero privilegios de escritura para `anon`, `authenticated` y `service_role`.
- Funciones internas propiedad de `postgres`, con `search_path` vacío.
- La API respondió `PGRST106` al solicitar `inventario_private`: solo expone `public` y `graphql_public`.
- No se insertaron datos ni se modificaron tablas de otros módulos.

Se ejecutó el asesor de seguridad. Para Inventarios únicamente informa [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) en `inventario_private.operaciones`: es intencional, ya que esa tabla privada no concede acceso a clientes. También informa hallazgos en objetos existentes: funciones públicas con [search_path mutable](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), funciones privilegiadas [ejecutables por anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) y [authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), `contenedores` sin políticas y [protección de contraseñas filtradas deshabilitada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No se alteraron esos objetos ni la configuración de autenticación.

## -

Las consultas remotas fueron exclusivamente de lectura:

- PostgreSQL 17.6; 15 tablas públicas, todas con RLS habilitado, y 40 políticas.
- No existen tablas de Inventarios en producción.
- Se mantienen los roles globales `Admin` y `Operativo`. Los roles de Inventarios son membresías por bodega.
- `perfiles.id` referencia a Auth con eliminación en cascada. La propuesta conserva los registros históricos mediante referencias anulables y la identidad original del actor en auditoría.
- Se comprobaron las políticas de lectura del perfil propio y administración mediante `es_admin()`. Algunas políticas de módulos anteriores tienen predicados amplios; no se copiaron a Inventarios ni se modificaron.
- El rol `postgres` utilizado para la inspección tiene `BYPASSRLS`. Debe verificarse el propietario de las funciones de autorización al desplegar.

La consulta de `pgrst.db_schemas` no devolvió un valor. Posteriormente se comprobó directamente por REST que `inventario_private` no está expuesto, antes de aplicar la migración.

## Pruebas reproducibles

El script [test-inventario-db.cjs](../scripts/test-inventario-db.cjs) usa PGlite 0.3.14, con PostgreSQL 17.5 en memoria. No utiliza credenciales, no consulta servicios remotos y no instala dependencias en la aplicación.

Desde la raíz del proyecto, en PowerShell:

```powershell
npm install --prefix "$env:TEMP\landimotos-db-validation-pg17" --no-audit --no-fund --ignore-scripts --save-exact @electric-sql/pglite@0.3.14
node scripts/test-inventario-db.cjs "$env:TEMP\landimotos-db-validation-pg17"
```

Primero ejecuta el archivo original y comprueba que el rollback no deje tablas. Después sustituye únicamente en memoria el `ROLLBACK` final por `COMMIT` para inspeccionar el modelo y ejecutar las pruebas. El archivo original no se modifica.

| Grupo | Comprobación aprobada |
|---|---|
| 1 | El DDL completo compila y el rollback no deja tablas. |
| 2 | Se crean las 18 tablas y 17 políticas públicas previstas. |
| 3 | El operador solo lee su tarea y alcance; no ve saldos por consulta directa ni por JOIN, verificaciones, diferencias, ajustes o auditoría. |
| 4 | Ser líder de A y operador de B no transfiere permisos superiores a B. |
| 5 | El administrador funcional solo consulta su bodega. |
| 6 | Un Admin global sin membresía y un perfil inactivo no obtienen acceso a datos. |
| 7 | `anon`, `authenticated` y `service_role` no tienen privilegios de escritura; una actualización directa falla. |
| 8 | Revocar membresía o acceso al módulo revoca la lectura SQL. |
| 9 | Se rechazan cancelaciones sin motivo, estados desconocidos, duplicados, fotografías incompletas y cantidades negativas/NaN; cero es válido. |
| 10 | Las claves foráneas rechazan relaciones entre bodegas y conteos de otro producto o sesión. |
| 11 | Cancelar y eliminar una cuenta conserva conteos y la identidad original en auditoría. |

Los datos sintéticos incluyen filas en las tablas sensibles para evitar que una tabla vacía produzca una falsa comprobación de seguridad. Esos datos existen únicamente en el motor en memoria.

## Alcance y pendientes

La versión principal coincide con producción, pero PostgreSQL 17.5 en WebAssembly no reproduce exactamente PostgreSQL 17.6 ni todo Supabase. El script simula `auth.uid()`, usuarios y las políticas de perfiles; no prueba emisión de JWT, sesiones Auth reales, PostgREST ni Realtime.

Los estados y restricciones SQL se probaron; las transiciones de negocio, concurrencia, idempotencia y aprobación requieren las futuras RPC. No se afirma que esas operaciones estén implementadas. Tampoco se probaron rendimiento con volumen real ni integración G21.

## Siguiente paso

1. Confirmar contratos G21 y bodegas oficiales antes de sincronizar catálogos.
2. Confirmar UUID de responsables y preparar las membresías iniciales. No cargar bodegas o usuarios de ejemplo en producción.
3. Implementar los comandos transaccionales necesarios para habilitar la operación y comprobar los flujos con sesiones reales en un entorno de pruebas.
4. Para cambios posteriores, utilizar migraciones revisadas y recuperación compensatoria; no borrar tablas ni auditoría para revertir operaciones.

La ejecución de estas pruebas no habilita conteos, asignaciones ni ajustes de stock en la aplicación.
