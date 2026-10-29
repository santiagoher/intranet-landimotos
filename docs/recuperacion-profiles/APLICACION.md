# Aplicación aprobada — 22 de octubre de 2026

La autorización del usuario («apliquemos los cambios entonces ahora») permitió aplicar la propuesta revisada al proyecto `loajbvlgpsxrkfzyxbui`.

Se aplicó y registró únicamente `20261022210543_perfiles_alta_segura_revision`. El archivo local en `supabase/migrations` reproduce el SQL ejecutado y usa la versión registrada por Supabase. La propuesta anterior se conserva como evidencia y no debe ejecutarse como otra migración.

## Resultado comprobado

- `public.handle_new_user()` conserva propietario y firma, usa `search_path` vacío y solo su propietario mantiene EXECUTE directo.
- Las futuras altas reciben rol Operativo y módulos vacíos, ignorando solicitudes de permisos en metadata. El nombre puede proceder de metadata como dato descriptivo.
- El trigger de Auth sigue habilitado y conserva su definición.
- Permanecen los mismos 4 perfiles y 4 usuarios de Auth; cero usuarios sin perfil y cero perfiles huérfanos.
- La comparación completa anterior/posterior de las filas de perfiles, las 12 membresías de bodega y el administrador de Inventarios dio igualdad.
- También coincidieron las restricciones entrantes/salientes de perfiles, sus índices, políticas, propietario, ACL y configuración RLS.
- No se creó `public.profiles`, no se insertaron usuarios ficticios en producción y no se ejecutaron cambios de contraseñas, pedidos, rutas o inventarios.

Evidencia sin filas personales: [aplicacion-verificada.json](./aplicacion-verificada.json).

Se guardó un respaldo selectivo anterior con las filas de perfiles/membresías, metadatos y función en `.local-backups/perfiles-antes-alta-segura-20261022.json`. Esta carpeta está excluida de Git y contiene datos personales: no incorporarla a commits, paquetes o despliegues. No incluye contraseñas de Auth ni es un respaldo completo de la base. La exclusión de Git no cifra el archivo ni evita la sincronización de OneDrive.

## Validación

Antes de aplicar volvió a aprobar la prueba PGlite aislada, incluyendo conservación de perfiles y funcionamiento del trigger bajo el rol de Auth. Después de aplicar aprobaron las seis pruebas de `src/utils/supabase/profiles.test.mjs`. Se verificó en lectura la función remota y el registro de migración. No se creó una cuenta real para probar un alta completa de extremo a extremo.

El asesor de seguridad dejó de señalar `handle_new_user` por search_path mutable o ejecución directa pública. Persisten avisos anteriores para otras funciones y políticas, fuera de esta migración. Referencias de corrección: [search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable) y [ejecución pública de SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

## Estado de aplicación web y pendientes

La protección de las acciones de administración ya está implementada en el código local de `src/app/(dashboard)/admin/usuarios/actions.ts`. **No se desplegó la aplicación en Vercel**: el árbol de trabajo contiene numerosos cambios acumulados de otros módulos, y esta operación aplicó la migración selectiva aprobada, sin publicar todo ese trabajo.

Para activar también esa protección web en producción falta preparar una entrega revisada de la aplicación y desplegarla. Las políticas amplias de Despachos/Mensajeros, la revisión del estado inactivo en `es_admin` y las pruebas interactivas con las cuentas existentes siguen pendientes según el informe funcional. No se afirma aislamiento completo de operadores en todos los módulos ni recuperación de registros históricos de `profiles`.
