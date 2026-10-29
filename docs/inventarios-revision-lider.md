# Revisión del líder: dos acciones

La revisión ofrece únicamente **Verificar y cerrar** y **Devolver al operador**, desde la entrega del operador y también para inventarios que quedaron en los estados antiguos de verificación.

- Verificar y cerrar compara las cantidades contadas con las referencias guardadas. Cierra la tarea y registra automáticamente si hay diferencias, con fechas de revisión/cierre y una observación obligatoria. No cambia existencias. La interfaz muestra el resultado antes de confirmar.
- Devolver requiere un motivo y devuelve la tarea a En proceso para un nuevo conteo. Conserva el historial y reinicia los campos de conteo, como hacía la devolución anterior.
- Administración mantiene acceso de consulta. Solo un líder autorizado, diferente del operador, puede ejecutar estas decisiones.
- Si faltan conteos o referencias, el cierre se bloquea; no se interpreta una referencia ausente como cero. Los inventarios autoiniciados conservan la restricción existente de integración/conciliación G21.

La RPC `inventario_revisar_conteo` aplica la decisión en una transacción, bloquea el ticket y comprueba su versión. Reutiliza las validaciones existentes de resultado y evidencias. La verificación y el cierre dejan un solo evento de auditoría; los estados intermedios no se confirman por separado.

Migración local: `supabase/migrations/20261021164401_inventarios_verificar_cerrar.sql`, aplicada al proyecto `loajbvlgpsxrkfzyxbui` el 21/10/2026 y registrada remotamente con versión `20261021164715`. No se modificaron tareas existentes durante la activación. No volver a ejecutar el SQL.

Validación: pruebas de interfaz/roles, TypeScript y pruebas SQL aisladas de cierre con y sin diferencias, cantidades cero, versiones desactualizadas, observación obligatoria, comparación incompleta, devolución y evento único. La función remota y sus permisos se comprobaron sin cerrar inventarios reales.

El asesor de seguridad no señaló las funciones nuevas. Sí mantiene hallazgos ajenos a este cambio: [search_path de funciones existentes](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [ejecución de funciones SECURITY DEFINER existentes](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [tablas con RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) y [protección de contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No se modificaron autenticación ni permisos de otros módulos.
