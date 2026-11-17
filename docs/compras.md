# Compras

## Diseño e integración

Se reutilizan sesiones de Supabase, perfiles, gestión administrativa, navegación,
tokens visuales y paginación. Admin activo administra Compras. Un Operativo activo
necesita `compras` en `perfiles.modulos_permitidos`; puede administrar exclusivamente
este módulo si aparece activo en `compras_administradores`. Este permiso no concede
administración global ni acceso a otros módulos.

Desde el cambio autorizado del 17 de noviembre, los cuatro encargados comparten
una cuenta. `compras_encargados` representa sus nombres y mesas; `encargado_id`
conserva el UUID real de la cuenta y `encargado_persona_id` identifica la persona
asignada. La identidad de cada acción sigue siendo la cuenta autenticada: no se
presenta el nombre del encargado como una identificación individual comprobada.

## Modelo y seguridad

- `compras_mesas`: catálogo fijo Mesa 1–5, sin relación fija con personas.
- `compras_proveedores`: catálogo administrado desde Nueva revisión.
- `compras_revisiones`: factura, proveedor, mesa, encargado, asignador, fechas,
  CPM, estado y versión. UUID de responsables y nombres históricos conservados.
- `compras_observaciones`: entradas inmutables con autor y fecha.
- `compras_historial`: eventos inmutables, versión y fotografía del registro;
  también conserva asignaciones previas, motivos y notificaciones emitidas.
- `compras_notificaciones`: destinatario real, evento, contexto y fecha de lectura.

RLS limita lectura a Admin o al encargado actual, siempre con módulo habilitado.
No hay escritura directa del cliente sobre las tablas. Las RPC públicas usan
security invoker y delegan las mutaciones a una función privada que valida
sesión, perfil, propiedad, transición y versión antes de escribir atómicamente.
Las consultas y los reportes respetan RLS; solo Admin accede a reportes/exportación.

## Transiciones

| Origen | Acción | Destino | Responsable |
|---|---|---|---|
| — | Crear | Asignado | Admin |
| Asignado / Devuelto | Iniciar | En revisión | Encargado |
| En revisión | Observar | En revisión | Encargado |
| En revisión | Finalizar | Pendiente de cierre | Encargado |
| Pendiente de cierre | Devolver con motivo | Devuelto | Admin |
| Pendiente de cierre | Cerrar con CPM | Cerrado | Admin |
| Asignado / Devuelto | Reasignar con motivo | Asignado | Admin |

Pendiente de cierre y Cerrado bloquean observaciones y cambios normales. No hay
borrado ni reapertura de cerrados. Reasignar una revisión iniciada requiere primero
finalizarla y devolverla; así no se cambia el responsable durante un trabajo activo.
La duración suma los tramos activos de revisión, incluyendo correcciones, sin
contar esperas de validación. Las fechas de filtros y presentación usan Bogotá.

## Pantallas y etapas

1. Migración aditiva, funciones, RLS, índices y pruebas SQL aisladas.
2. `/compras/registros`: mesa inicial para operadores, filtros, indicadores,
   tabla, creación y notificaciones con enlaces al detalle.
3. `/compras/registros/[id]`: ficha, observaciones, acciones e historial.
4. `/compras/reportes`: filtros, indicadores, distribución por mesa/operador,
   tabla y Excel con registros, observaciones e historial.
5. Integración del permiso en Usuarios y del grupo Compras en el menú;
   comprobaciones de TypeScript, compilación y regresión.

Las notificaciones se consultan periódicamente mientras Compras está abierto;
persisten entre sesiones. La selección de mesa nunca amplía permisos.
Los reportes usan paginación de servidor y agregados sobre todos los resultados.

## Instalación y validación

Migración aplicada, con autorización del usuario, al proyecto
`loajbvlgpsxrkfzyxbui`: `20261110183815_compras_revisiones.sql`.
La verificación remota confirmó seis tablas con RLS, cinco mesas, ninguna
escritura directa para authenticated y ninguna ejecución anónima de mutaciones.
La consulta, los catálogos y la exportación se comprobaron con rol authenticated
y contexto de administrador, dentro de una transacción revertida. No se crearon
facturas de prueba ni se cambiaron permisos de usuarios en el proyecto real.

Para comenzar:

1. Publicar la versión de la aplicación que contiene estas rutas.
2. Camilo ingresa con `admincompras@gmail.com` y configura las mesas desde
   Gestión administrativa → Equipo y mesas de Compras (`/compras/equipo`).
   Ángel Pachón, Holman Rojas, Juan Carlos Mosquera y Nelson Pérez comparten
   `registrocompras@gmail.com`, según la decisión expresa del usuario.
3. Como Admin, abrir Compras → Registros → Nueva revisión, agregar los
   proveedores necesarios y crear las primeras asignaciones.

Comprobaciones reproducibles:

```text
node scripts/test-compras-db.cjs
node scripts/test-compras-equipo.cjs
node --test src/modules/compras/compras.test.mjs src/utils/supabase/profiles.test.mjs src/modules/inventarios/access.test.mjs
npx tsc --noEmit
node scripts/build-compras-isolated.cjs
```

La compilación completa con webpack pasó en una copia temporal fuera de
OneDrive; la compilación en el checkout encontró un bloqueo EPERM en `.next`.
El script aislado usa credenciales ficticias solo para compilación, nunca copia
archivos `.env` y no conecta con datos reales.

La prueba SQL aislada verifica el ciclo completo y rechaza acceso cruzado,
permisos revocados, modificaciones directas, versiones obsoletas, cierre sin CPM
y cambios posteriores al cierre. La prueba Excel vuelve a abrir el XLSX para
verificar hojas, valores de texto y protección frente a fórmulas inyectadas.

Revisión visual pendiente: la herramienta de navegador detuvo el acceso al no
poder identificar con seguridad la URL de Chrome. Se preparó una vista local
reproducible con datos ficticios (`node scripts/preview-compras.cjs`); esta vista
no es una prueba de integración con Supabase ni prueba la autenticación real.

## Proveedores y equipo — 17 de noviembre de 2026

La migración `20261117142318_compras_equipo_proveedores.sql` agrega NIT único como
texto, estado activo y origen de importación a proveedores. Se importaron los 69
registros de `data/compras-proveedores-activos.json`; se preservó el proveedor
anterior y las tres revisiones existentes. Los nombres y NIT proporcionados se
conservaron, normalizando únicamente los espacios repetidos.

Las cuentas se crearon mediante Supabase Auth Admin API; sus contraseñas aleatorias
están en `.local-backups/compras-cuentas-20261117.json`, excluido de Git. El script
`scripts/provision-compras-users.cjs` no imprime contraseñas, no restablece cuentas
existentes y puede verificar los accesos mediante `--verify`.

`docs/sql/compras-cuentas-config.sql` documenta la configuración aplicada: las dos
cuentas tienen rol global Operativo y solo el módulo Compras. Camilo tiene además
el permiso de administrador de Compras. Las cuatro personas quedaron activas,
sin mesa inicial; Camilo debe asignarlas. La base de datos verifica que las nuevas
facturas usen la mesa configurada para el encargado. Cambiar la mesa no reasigna
facturas anteriores. Los cambios de equipo tienen versión e historial inmutable.

El inicio de sesión de ambas cuentas se verificó mediante Auth. Se comprobaron
los permisos efectivos, los cuatro encargados, los 69 NIT importados sin duplicados
y la conservación de los registros. La compilación aislada y las pruebas SQL de
roles, asignación, notificaciones y filtros por persona pasaron. No se asignaron
mesas ni se crearon facturas de prueba en la base real.

## Tiempo laboral y plazo

El selector muestra también encargados activos sin mesa con la etiqueta Sin mesa asignada y los mantiene deshabilitados hasta configurar su mesa. Encargado de revisar identifica al responsable de revisar; el asignador se registra automáticamente a partir de la sesión. No se asignaron mesas iniciales. La migración `20261117145005_compras_encargados_sin_mesa.sql` conserva los permisos y la validación de mesa al crear o reasignar.

El nombre visible de la cuenta de registro es Registro Compras. La migración de horario laboral calcula el tiempo a partir de los eventos inmutables de inicio y finalización, incluyendo correcciones y el tramo abierto. Conserva los tiempos originales y el historial; no cuenta esperas de validación ni tiempo antes de iniciar.

En America/Bogota, lunes a viernes se cuentan 08:20–12:00 y 13:30–17:00 (25.800 segundos por jornada); sábados 08:20–12:00 y 13:00–15:00 (20.400 segundos). Los domingos no cuentan. Se aplica este horario semanal, sin calendario adicional de festivos. Cada tramo aporta su fracción de la jornada correspondiente. Más de dos jornadas acumuladas marca la revisión como vencida y permite finalizarla. Los cálculos se actualizan al consultar; la marca permanece en revisiones terminadas que excedieron el plazo.

Registros, detalle, promedio de reportes y Excel usan el mismo cálculo SQL con permisos del usuario. El Excel identifica minutos laborales, jornadas y cumplimiento del plazo. Los valores históricos de auditoría permanecen intactos.

## Artículos y autoasignación

La migración `20261117143616_compras_numero_articulos.sql` agrega Número de artículos, obligatorio y entero positivo al crear una factura. Se conserva en el historial y aparece en registros, detalle, reportes y Excel. Los registros anteriores quedan sin cantidad registrada; los reportes distinguen esas facturas del total conocido.

Camilo Pulido también pertenece al equipo de encargados con su cuenta propia. Puede configurar su mesa, asignarse facturas e iniciar, observar y finalizar sus revisiones, conservando la administración de Compras. El enlace Mis revisiones filtra sus asignaciones. El equipo tiene cinco personas: Camilo y las cuatro personas de la cuenta compartida. No se asignó una mesa inicial ni se modificaron facturas existentes.
