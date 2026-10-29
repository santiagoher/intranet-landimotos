# Conteo y evidencias fotográficas

## Estado

Implementación local terminada y compilada. El 21/10/2026, con autorización expresa del usuario, se aplicó la migración de evidencias al proyecto `loajbvlgpsxrkfzyxbui`. Supabase la registró con versión `20261021161517` y nombre `inventarios_evidencias_conteo`; corresponde al SQL local `20261021153718_inventarios_evidencias_conteo.sql`. No volver a ejecutarla: las tablas, funciones, políticas y el bucket ya existen.

Se crearon `inventario_evidencias`, `inventario_observaciones_conteo` y el bucket privado `inventario-evidencias`. La restricción directa de auditoría ya está activa. No se cargaron fotografías ni se modificaron tickets existentes.

**Pendiente para habilitar fotografías:** el entorno local no tiene `SUPABASE_SERVICE_ROLE_KEY`. La conexión de herramientas solo permite obtener claves públicas y no hay una sesión de CLI disponible para recuperar la privada. Debe configurarse exclusivamente en el servidor, nunca con prefijo `NEXT_PUBLIC_`, en el cliente o en el repositorio. `.env.local` está excluido de Git. No compartir la clave por chat.

## Modal y acceso

- Detalle ampliado hasta 1080 px con ancho adaptable, encabezado fijo y progreso visible.
- Operador: estado/prioridad, bodega/categoría, conteo, observaciones/fotos y acciones. Se omiten historial, información interna del cierre y tiempos de verificación.
- Líder/Administración: conservan comparación autorizada, fotografías, observaciones y secciones desplegables de tiempos e historial.
- El operador no llama al historial. `getTaskEvents` comprueba ticket y rol real antes de consultar auditoría. La migración restringe también la lectura directa de `inventario_auditoria` mediante RLS a líderes/administradores autorizados; no elimina eventos.
- La protección de auditoría está aplicada tanto en la aplicación como en la base. Se comprobó mediante consultas de solo lectura con el rol autenticado y los perfiles existentes: PRINCIPAL DESPACHO conserva acceso a sus tickets, pero ve cero eventos de auditoría; Santiago conserva acceso al historial autorizado.
- Cantidades: se quitan exclusivamente ceros decimales finales, trabajando con strings; `9.000000` se presenta como `9` y `0.000001` conserva su precisión. No se actualizan ni redondean valores almacenados.

## Tablas y bucket creados

Migración: `supabase/migrations/20261021153718_inventarios_evidencias_conteo.sql`.

1. `inventario_evidencias`: UUID, ticket, autor, ruta, nombre saneado, MIME, tamaño, SHA-256, tipo de evidencia, estado y fechas. Estados técnicos: pendiente, vigente, eliminando y eliminado. No cambian los estados del ticket.
2. `inventario_observaciones_conteo`: observación actual, autor, fecha y versión para evitar sobrescribir cambios desde otra pestaña. Cada modificación genera auditoría; la observación inicial de la asignación se conserva por separado.
3. Bucket privado `inventario-evidencias`, máximo 5 MiB por archivo almacenado, MIME permitido `image/webp`. La aplicación acepta JPEG/PNG/WebP y los normaliza antes de subir.

Ruta: `inventarios/{ticket_uuid}/{usuario_uuid}/{archivo_uuid}.webp`.

El bucket no admite acceso directo desde credenciales del navegador: una política restrictiva lo aísla incluso frente a futuras políticas permisivas generales. El servidor usa la API de Storage para subir, firmar y retirar objetos, después de validar la sesión y el acceso al ticket. Nunca se eliminan filas de `storage.objects` directamente en producción. Referencia: [control de acceso de Supabase Storage](https://supabase.com/docs/guides/storage/security/access-control).

Las URLs de visualización están firmadas por 300 segundos. El modal renueva la consulta cada 240 segundos mientras la página está visible. La lista de metadatos se obtiene con el cliente autenticado y RLS antes de firmar las rutas. No hay URLs públicas ni base64 en PostgreSQL.

## Validación, máximo y limpieza

- Se acepta un archivo por petición, de hasta 5 MiB. El servidor decodifica el contenido con Sharp; no confía en extensión ni MIME del navegador. Rechaza formatos diferentes, imágenes inválidas/animadas y más de 24 megapíxeles.
- Reencodificación a WebP, calidad 90, sin reducir dimensiones; corrige orientación y elimina EXIF/GPS. Se comprueba de nuevo el tamaño final. Referencia: [constructor de Sharp](https://sharp.pixelplumbing.com/api-constructor/).
- La reserva bloquea la fila del ticket. Cuenta fotografías `conteo_operador` pendientes, vigentes o en eliminación: máximo tres para todo el ticket, no por carga. Las evidencias futuras `verificacion_lider` quedan separadas y no consumen esos espacios; esta entrega no habilita cargas del líder.
- Un índice y el hash del archivo normalizado impiden duplicados. La misma reserva pendiente no inicia dos cargas; una reserva ya confirmada permite reconocer un reintento completado.
- El navegador no puede subir bytes directamente ni marcar la carga como vigente. La confirmación solo se concede a `service_role` después de procesar y almacenar el archivo desde el servidor.
- Si falla el registro final, se consulta primero su estado: una evidencia que ya quedó vigente se conserva. Si no fue confirmada, se intenta limpiar Storage y retirar la reserva. Si la limpieza falla, quedan el registro y la ruta pendientes para reintento explícito; no se declara éxito.
- Eliminar una foto requiere operador asignado y ticket en proceso. Se marca eliminando, se retira mediante Storage API y se confirma eliminado conservando metadatos/auditoría. Un fallo se presenta para reintentar, sin liberar prematuramente el espacio.
- La entrega se bloquea en la base si hay cargas/eliminaciones pendientes. Después de entregar, el operador no puede modificar fotos ni observaciones. El líder no puede sobrescribir los originales.
- No hay limpieza automática de fotografías vigentes. Ante una caída prolongada del servidor, el operador puede retirar una reserva pendiente al reabrir el ticket; si faltan permisos/configuración, se requiere intervención de soporte conservando su trazabilidad.

## Experiencia

Tres espacios con miniaturas, contador, botón de cámara cuando el navegador lo soporte, visor ampliado, eliminación y sustitución mediante eliminar/agregar. La carga usa un indicador indeterminado real: no inventa porcentajes de transferencia.

Las fotos se guardan al subirlas; las observaciones con «Guardar observaciones». Los cambios de texto sin guardar bloquean la finalización en el modal. Ambos se recuperan desde Supabase al reabrir, no desde almacenamiento temporal del navegador. Una vista previa local existe únicamente durante la carga y se libera después.

El conteo ciego y sus cálculos siguen intactos. Las consultas de evidencias no unen tablas de saldos, precios ni diferencias.

## Configuración pendiente y prueba final

1. Migración de evidencias aplicada y verificada. Las migraciones pendientes de prioridades y autoinicios no se aplicaron como parte de esta activación.
2. Abrir **Settings → API Keys** del proyecto en Supabase y copiar la clave privada exclusivamente a `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`. Esta es la variable que lee el código actual; acepta la clave de servidor compatible con `createClient`, incluida una Secret key moderna. No usar la clave `anon` ni `publishable`. Consultar la [documentación de claves de Supabase](https://supabase.com/docs/guides/getting-started/api-keys).
3. Detener el servidor de desarrollo con `Ctrl+C` y volver a ejecutar `npm run dev`. En el alojamiento de producción, configurar la misma variable privada y desplegar/reiniciar allí; el archivo local no configura el alojamiento.
4. Verificar en un ticket autorizado: subir una imagen, reabrir, consultar como líder, retirar antes de entregar y comprobar la denegación tras finalizar. Confirmar cámara y temas en móvil/tablet.

Con las tablas ya disponibles, el componente permite guardar observaciones durante el conteo. Las fotografías siguen pendientes de la credencial privada de Storage y de la prueba completa desde la aplicación.

## Archivos de esta entrega

- `src/modules/inventarios/operations/OperationsPanel.tsx`: modal, rol, conteo y presentación.
- `EvidencePanel.tsx`: observaciones, fotos, cámara, visor y estados de carga.
- `evidence.actions.ts`: autorización, metadatos, URLs firmadas y operaciones de Storage.
- `evidence-image.server.ts`: validación y normalización real de imágenes.
- `evidence-types.ts`, `quantity.ts`: contratos y formato decimal.
- `actions.ts`: protección del endpoint de historial.
- `operations.test.mjs`, `evidence-actions.test.mjs`, `scripts/test-inventario-operacion.cjs`: pruebas.
- `next.config.ts`: petición de Server Actions de hasta 6 MiB, para un archivo de 5 MiB y el envoltorio del formulario.
- `package.json`, `package-lock.json`: Sharp 0.34.5 fijado como dependencia directa (ya estaba instalado como dependencia de Next).
- Migración y este documento. Los nombres sin ruta de esta lista pertenecen a `src/modules/inventarios/operations`.

## Validaciones y límites de lo comprobado

- Base remota: RLS habilitado y forzado en ambas tablas; bucket privado de 5 MiB y MIME `image/webp`; política restrictiva de Storage para `anon`/`authenticated`; confirmación de evidencia permitida a `service_role` y denegada a `anon`/`authenticated`; inserción directa de evidencias denegada al cliente; trigger de bloqueo de entrega habilitado. Comprobaciones de auditoría por rol realizadas en transacciones de solo lectura con rollback.
- El asesor automático de seguridad de Supabase agotó el tiempo de consulta. Se verificaron directamente los controles anteriores; no se declara una revisión automática completa del proyecto.
- Compilación de producción en copia temporal, TypeScript y ESLint: correctos.
- 32 pruebas Node: roles, historial oculto, conteo, navegación, precisión decimal, decodificación/rechazo de imágenes y simulación de fallos de Storage. Se verifica que una confirmación ya guardada no elimine su imagen aunque se pierda la respuesta, y que una limpieza fallida conserve la reserva sin anunciar éxito.
- SQL en PostgreSQL aislado con PGlite: máximo de tres reservas, duplicados, permisos por ticket, confirmación exclusiva de servidor, bloqueo de entrega, observaciones persistentes, control de versiones y restricción de cambios tras entregar.
- Las pruebas SQL usan una representación local mínima del esquema Storage. No sustituyen la prueba contra el servicio HTTP de Supabase: no se cargaron ni eliminaron archivos reales en producción.
- El bloqueo transaccional serializa el límite; no se ejecutó una prueba de carga con conexiones concurrentes independientes.
- Revisión visual e interacción con cámara/lector en dispositivos reales pendiente: no hay navegador conectado en esta sesión.
