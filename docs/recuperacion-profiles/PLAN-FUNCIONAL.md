# Continuidad funcional de perfiles — 22 de octubre de 2026

> **Actualización posterior a la revisión:** el usuario autorizó aplicar los cambios. La migración selectiva `20261022210543_perfiles_alta_segura_revision` se aplicó en Supabase y quedó verificada. Ver [resultado de aplicación](./APLICACION.md). El resto de este documento conserva el plan previo como registro; sus menciones a SQL pendiente corresponden a ese momento.

## Decisión y alcance

**Alternativa A: conservar `public.perfiles` como única fuente de perfiles.** El código examinado ya utiliza esta tabla. No se encontraron consultas funcionales a `public.profiles` que deban reemplazarse, ni una necesidad demostrada de una vista de compatibilidad o de una tabla física adicional. No se recrea `profiles`.

Esta fase prepara cambios locales y una propuesta SQL para revisión. En producción solo se ejecutaron consultas de lectura: no se modificaron tablas, funciones, políticas, usuarios, credenciales, módulos, membresías de bodega, inventarios, evidencias, pedidos ni G21. No hubo despliegue, nuevas instancias ni cargos de restauración.

No se recuperaron registros históricos de la tabla eliminada. Sin un catálogo anterior al incidente tampoco se puede demostrar que se han identificado todas las dependencias eliminadas por `CASCADE`. La investigación histórica y sus límites están en [INFORME.md](./INFORME.md).

## Evidencia actual

- Existen 4 usuarios de Auth y 4 perfiles. No hay usuarios sin perfil ni perfiles huérfanos.
- La huella de las filas de `perfiles` coincide con las comprobaciones anteriores: `380d2a3d2a8ae0f8ec8cf23652d4807b`. Es una comparación, no un respaldo recuperable.
- Existen las 23 tablas consultadas literalmente mediante `.from()` en el código revisado.
- Existen las 17 funciones RPC identificadas en las operaciones de Inventarios. La comprobación de catálogo acredita existencia, no ejecuta sus operaciones en producción.
- El trigger `on_auth_user_created` está habilitado y llama a `public.handle_new_user()`, que inserta en `perfiles`.
- Las relaciones revisadas entre envíos, pedidos, mensajeros, rutas y almuerzos siguen presentes.
- No se identificaron funciones, vistas o restricciones actuales que necesiten reconstruirse por una dependencia comprobada de `profiles`.

Fuentes: [auditoría funcional](./auditoria-funcional-actual.json), [RPC de Inventarios](./rpc-inventarios-actuales.json), [metadatos de perfiles](./perfiles-metadatos-actuales.json), [funciones y dependencias](./dependencias-actuales.json).

## Funcionalidad identificada

| Operación | Fuente y componentes reales | Resultado |
| --- | --- | --- |
| Login | `src/app/(auth)/login/actions.ts`, Supabase Auth | Autentica usuarios existentes; no crea perfiles al iniciar sesión. |
| Sesión y perfil | `src/utils/supabase/session.server.ts`, middleware de Supabase y `src/proxy.ts` | Consulta `perfiles` por UUID autenticado; usa rol, estado, nombre y módulos almacenados. |
| Navegación | `RoleProvider`, `useRole`, sidebar y páginas | Usa el perfil y módulos permitidos. Ocultar navegación no sustituye autorización en servidor/RLS. |
| Administración de usuarios | `src/app/(dashboard)/admin/usuarios/actions.ts` | Consulta y actualiza `perfiles`; ahora verifica administrador activo dentro de cada acción. |
| Alta de perfil | Trigger de `auth.users` y `handle_new_user()` | El mecanismo sigue existiendo; se propone proteger las futuras altas frente a roles enviados por metadata. |
| Despachos | Acciones de pedidos/envíos y sus relaciones | Las consultas revisadas no necesitan `profiles`; existen las tablas y relaciones. |
| Mensajeros | Acciones de mensajeros/rutas/almuerzos | Las consultas revisadas no necesitan `profiles`. La referencia `storage.from('perfiles')` corresponde a un bucket de imágenes, no a la tabla. |
| Inventarios | `access.server.ts`, operaciones/RPC, `inventario_administradores`, `inventario_usuarios_bodegas` | Mantiene la jerarquía global, líder y operador, junto con las asignaciones por bodega. No se convierten líderes en administradores globales. |

La estructura conservada es `id uuid` (PK y FK a Auth con borrado en cascada), `email text` único y obligatorio, `nombre text`, `rol text`, `estado text`, `created_at timestamptz`, `modulos_permitidos text[]`. Se conservan sus índices, CHECK, valores predeterminados, ACL y RLS; los detalles exactos están en el archivo de metadatos.

## Cambios preparados

### Código de aplicación

Archivo modificado en esta fase: `src/app/(dashboard)/admin/usuarios/actions.ts`.

- Verifica sesión y perfil almacenado antes de listar o actualizar usuarios. Exige `rol=Admin` y `estado=activo`.
- No toma permisos de metadata editable del usuario.
- Valida UUID y campos admitidos. No permite escribir email, id o fecha de creación desde el formulario.
- Comprueba que la actualización devolvió una fila. Un rechazo RLS o usuario inexistente ya no produce un éxito aparente.

El árbol de trabajo contiene otros cambios de fases anteriores; no forman parte de este ajuste y no se deben desplegar automáticamente como si lo fueran.

### SQL separado, pendiente de revisión

[20261022204950_perfiles_alta_segura_revision.sql](./propuestas/20261022204950_perfiles_alta_segura_revision.sql) está deliberadamente fuera de `supabase/migrations` para evitar su aplicación accidental.

No reconstruye una tabla ni migra usuarios. Reemplaza únicamente el cuerpo del trigger existente para que las futuras altas reciban `Operativo`, estado activo y módulos vacíos, independientemente de metadata enviada por el usuario. Conserva el nombre como dato descriptivo y no sobrescribe un perfil existente. Fija `search_path` y retira permisos de invocación directa de la función de trigger. El administrador autorizado debe asignar después los módulos/roles mediante el flujo existente.

Antes de cualquier cambio comprueba la existencia de `perfiles` y del trigger esperado. Se ejecuta en transacción con límites de espera. No altera filas existentes, índices, relaciones, políticas ni membresías. El nombre y la firma de la función permanecen iguales, por lo que no se recrea el trigger.

Esta propuesta corrige un riesgo encontrado durante la revisión: la definición actual acepta `raw_user_meta_data.rol` en altas. No hay evidencia de que ese comportamiento proceda del incidente. La [documentación de RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security) advierte que la metadata editable por el usuario no es una fuente segura de autorización. Los triggers de perfil deben probarse porque un error puede bloquear nuevas altas; véase [gestión de datos de usuarios](https://supabase.com/docs/guides/auth/managing-user-data).

## Pruebas realizadas y límites

**87 pruebas de aplicación aprobadas, 0 fallidas**, más dos validaciones aisladas de base. TypeScript y ESLint del archivo modificado aprobaron. No se ejecutó una compilación de producción ni un login interactivo real con las cuatro cuentas.

| Comprobación solicitada | Evidencia | Límite |
| --- | --- | --- |
| Inicio de sesión | Prueba de la acción real con transporte simulado: credenciales, error y redirección. | Pendiente prueba interactiva con usuario real. |
| Persistencia de sesión | Suite existente de SDK/renovación/revocación, fallos temporales y cookies. | No reproduce todas las condiciones de navegador de producción. |
| Lectura del perfil | UUID autenticado y consulta a `perfiles` comprobados. | Transporte de aplicación simulado. |
| Nombre y rol | Prueba ignora metadata con rol Admin y usa perfil almacenado. | No se publican datos personales de las cuatro cuentas. |
| Administración | Admin activo, operador, inactivo, sesión/perfil fallidos, validación y actualización de cero filas. | No se modificaron usuarios reales. |
| Módulos | Pruebas existentes de revocación, perfiles inactivos y navegación/permisos de Inventarios. | Los filtros de interfaz no garantizan aislamiento de API en otros módulos. |
| Despachos | Consulta de acción real con transporte simulado y revisión de tablas/FK actuales. | No se crearon ni alteraron pedidos/envíos. |
| Mensajeros | Lectura de mensajeros/rutas en prueba y tablas/FK actuales. | No se iniciaron/finalizaron rutas reales. |
| Inventarios | Suite aislada: catálogo, asignación/autoinicio, conteo cero, concurrencia, revisión/cierre y permisos. | Base local con datos sintéticos; no prueba G21. |
| Líder y operador | Pruebas de asignaciones por bodega, DTO de conteo ciego, roles y recursos autorizados. | No acredita aislamiento universal fuera de Inventarios. |
| RLS | Operador lee su perfil, admin lee perfiles, anónimo no; operador no escala rol ni edita otro perfil. | Se detectaron políticas amplias en módulos operativos, descritas abajo. |
| Esquema | Metadatos reales, tablas/RPC/FK presentes; propuesta aplicada dos veces localmente sin cambiar perfiles, esquema o RLS. | No existe una instantánea completa anterior al DROP. |

Archivos de pruebas nuevos:

- `src/utils/supabase/profiles.test.mjs`: seis pruebas de autorización, actualización, sesión, login y consultas operativas.
- `scripts/test-perfiles-compatibilidad.cjs`: PGlite aislado con cuatro identidades sintéticas, esquema y políticas basados en los metadatos actuales. Comprueba la propuesta, integridad de filas, idempotencia, RLS y funcionamiento del trigger bajo el rol de Auth después de retirar EXECUTE. Reproduce también la permisividad de las políticas operativas como riesgo conocido.
- [pruebas-aplicacion.txt](./pruebas-aplicacion.txt): salida de las 87 pruebas.

Comandos utilizados (PowerShell; la dependencia PGlite ya está instalada en la carpeta temporal indicada):

```powershell
$testFiles = @(rg --files src -g '*.test.mjs')
node --test @testFiles
node scripts/test-perfiles-compatibilidad.cjs "$env:TEMP/landimotos-db-validation-pg17"
node scripts/test-inventario-demo.cjs "$env:TEMP/landimotos-db-validation-pg17" --shared
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js 'src/app/(dashboard)/admin/usuarios/actions.ts'
```

Las pruebas PGlite no cargan credenciales ni escriben en Supabase. Sus identidades sintéticas no son registros recuperados.

## Riesgos pendientes

1. **RLS de otros módulos:** `pedidos`, `mensajeros` y `mensajeros_rutas` tienen políticas permisivas ALL para authenticated con `USING true` y `WITH CHECK true`. Un operador autenticado puede acceder a recursos compartidos mediante API aunque la interfaz oculte módulos. Las políticas más restrictivas coexistentes no anulan esos permisos. Se reprodujo localmente; no se corrigió silenciosamente porque cambiarlo requiere definir qué datos operativos son compartidos. No podemos afirmar que todos los operadores solo accedan a recursos propios.
2. `mensajeros_almuerzos` muestra políticas públicas de lectura, inserción y actualización; se requiere revisar también ACL y exposición API antes de afirmar su alcance externo. No se cambió.
3. `es_admin()` basa su decisión en el rol, no en `estado`. La nueva acción rechaza administradores inactivos, pero eso no sustituye una revisión de las políticas para llamadas directas con sesiones existentes.
4. Hasta revisar y aplicar la propuesta, el trigger de altas conserva el riesgo de metadata descrito. La corrección local de acciones no cambia esa función remota.
5. El asesor de seguridad señala funciones con `search_path` mutable y funciones SECURITY DEFINER ejecutables por roles amplios. La propuesta solo endurece `handle_new_user`; no resuelve todos esos hallazgos.
6. No se conoce la estructura completa ni el contenido original de `profiles`. La continuidad de los flujos conocidos no equivale a una restauración histórica completa.

## Plan de aplicación segura, todavía no ejecutado

1. Revisar este informe y la propuesta. Acordar la matriz de acceso de Despachos/Mensajeros antes de endurecer sus RLS; mantener esa decisión separada de perfiles.
2. Guardar de forma privada un respaldo selectivo actualizado de `perfiles`, sus metadatos, definición/propietario/ACL de `handle_new_user` y trigger, además de las membresías de inventario. Los JSON actuales son evidencia de estructura, no una copia de las filas.
3. Repetir las lecturas de conteos, usuarios huérfanos, esquema, función, ACL y trigger. Comparar con la evidencia y detenerse ante cambios inesperados. Revisar el hash con el mismo método utilizado en la auditoría.
4. Tras aprobación explícita, incorporar únicamente los cambios revisados de la acción a una entrega controlada. No desplegar todo el árbol de trabajo acumulado ni ejecutar `supabase db push` indiscriminadamente.
5. Aplicar separadamente la propuesta SQL aprobada como migración registrada, con su transacción y límites. Revalidar que la definición y propietario originales siguen siendo los revisados antes de sustituirla. Si falla antes del commit, la transacción revierte. Después del commit, cualquier corrección/retroceso de la función necesita revisión: no restaurar automáticamente el comportamiento inseguro de metadata.
6. Verificar en lectura que permanecen 4 perfiles/4 usuarios, las mismas filas, UUID, roles, módulos, membresías, índices, ACL y políticas. Solo la definición/ACL de la función de altas debe cambiar en la etapa SQL.
7. Comprobar sesiones reales de administrador, líder y operador con sus cuentas existentes: perfil, menús, bodegas y consultas. No compartir contraseñas ni crear usuarios ficticios en producción. Las pruebas de escritura o altas deben tener autorización y alcance definidos; usar el entorno aislado para la matriz negativa.
8. Observar errores de Auth, consultas y acciones tras la entrega. Un fallo de interfaz puede revertirse con la entrega anterior; cualquier cambio de base se trata por separado, conservando los perfiles existentes.

La aprobación de aplicación queda pendiente de la revisión solicitada por el usuario. La solución preparada no necesita recrear `profiles` ni pagar otra instancia.
