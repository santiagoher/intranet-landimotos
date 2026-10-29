# Inventarios: propuesta de persistencia y seguridad

Estado: **estructura desplegada en Supabase el 20 de octubre de 2026**, mediante la [migración aplicada](../supabase/migrations/20261020155954_crear_inventarios_bodegas.sql). La [propuesta original](sql/inventarios-propuesta.sql) conserva su `ROLLBACK` como referencia. La [fase operativa por categoría](inventarios-operacion.md) amplía este modelo con administración global explícita y RPC de seguimiento sin G21; los comandos SKU y conciliación descritos aquí siguen pendientes.

## Evidencia y compatibilidad

Se consultaron mediante MCP, exclusivamente en lectura, columnas y restricciones del proyecto configurado en la aplicación. Se encontraron 15 tablas públicas y ninguna con prefijo `inventario_`. Se verificaron:

- `perfiles.id`: UUID, clave primaria, referencia a `auth.users.id` con borrado en cascada.
- `perfiles.rol`: texto con restricción `Admin` / `Operativo`; no se cambia.
- `perfiles.estado`: `activo` / `inactivo`; autorización de inventarios exige explícitamente `activo`, incluso si el valor admite nulos en el esquema actual.
- `perfiles.modulos_permitidos`: `text[]`; se conserva el control de acceso al módulo (`Admin` o módulo `inventarios` autorizado) y se exige además membresía de bodega. La pertenencia a una bodega no se infiere de este campo.
- Las políticas existentes de perfiles permiten lectura propia y acceso administrativo mediante `es_admin()`. No se copian a inventarios.
- `contenedores` existe y la aplicación ya usa `/inventarios` para ese catálogo. Este nuevo modelo no reutiliza ni transforma sus filas en existencias.

La autenticación continúa en Supabase Auth, con el cliente SSR existente y comprobación de `auth.getUser()`. Los roles de inventarios no se añaden al campo `perfiles.rol` ni se confían a metadatos editables del usuario.

Las referencias históricas a personas usan `ON DELETE SET NULL`: se conserva el evento aunque desaparezca una cuenta, sin impedir los flujos de gestión de usuarios existentes. La auditoría retiene además `actor_original_id`, una copia inmutable del UUID autenticado que no concede permisos, para identificar la intervención después de eliminar un perfil. El registro de membresía sí se elimina al borrar un perfil. Los datos de conteo, verificación, diferencias y auditoría no se borran al cancelar ni tienen cascadas desde tickets.

## Tablas

| Tabla requerida | Función |
|---|---|
| `inventario_bodegas` | Códigos oficiales confirmados por G21; no se precargan los números del Excel. |
| `inventario_usuarios_bodegas` | Un rol por persona y bodega; titular y suplentes explícitos. |
| `inventario_categorias` | Catálogo G21 por bodega. |
| `inventario_productos` | SKU, nombre y unidad del catálogo; nunca saldo oficial mutable. |
| `inventario_sesiones` | Referencia de fotografía completa, corte ERP, alcance y cantidad de SKU. |
| `inventario_tickets` | Asignación, verificación, estado, prioridad, versión y tiempos. |
| `inventario_saldos_base` | Saldo de cada ítem al corte; invisible para operadores. |
| `inventario_conteos` | Revisiones de cantidades físicas, incluidas cantidades cero explícitas. |
| `inventario_verificaciones` | Cantidad revisada por líder, separada del conteo original. |
| `inventario_diferencias` | Comparación por SKU, evidencia de movimientos y conciliación. |
| `inventario_ajustes` | Propuestas y decisiones; no envío a G21. |
| `inventario_notificaciones` | Eventos persistentes dirigidos a destinatarios autorizados. |
| `inventario_auditoria` | Actor, entidad, transición, motivo y operación. |

Cinco auxiliares justificadas:

| Tabla auxiliar | Justificación |
|---|---|
| `inventario_sesion_items` | Separa el alcance visible del saldo protegido. Permite contar sin recibir existencias en JSON. |
| `inventario_codigos_barras` | Múltiples códigos G21 por producto y factores autorizados de empaque. |
| `inventario_parametros` | Umbrales y periodicidad por bodega/categoría. |
| `inventario_sincronizaciones` | Diagnóstico de respuestas completas, incompletas y fallidas, sin cuerpos sensibles. |
| `inventario_private.operaciones` | Idempotencia de comandos; no accesible al cliente. |

Todas tienen UUID y fecha del servidor. Las FKs compuestas mantienen la misma sesión y bodega entre entidades. Se indexan claves de consulta, asignaciones, historial y columnas de relaciones. Hay unicidad de membresía, código ERP, SKU por bodega, fotografía/alcance, revisión de conteo, verificación por ronda, propuesta vigente y clave de idempotencia.

Los catálogos conservan `id_erp` además de `codigo_erp` o `sku_erp`: el identificador opaco usado en endpoints puede ser distinto del código visible. Ninguno sustituye el UUID interno. El adaptador deberá confirmar ambos con G21 antes de persistirlos.

Una sesión representa un alcance con un operador a la vez. Varias personas contando en paralelo requieren sesiones con alcances disjuntos. La implementación de la siguiente fase debe bloquear solapamientos de SKU/ubicación en sesiones abiertas; la unicidad de fotografía/alcance por sí sola no resuelve solapamientos parciales.

## Contrato de membresías para la aplicación

```ts
type RolInventario = 'administrador' | 'lider' | 'operador'

type MembresiaInventario = {
  id: string
  perfil_id: string
  bodega_id: string
  rol: RolInventario
  activo: boolean
  es_responsable: boolean
  created_at: string
  updated_at: string
}
```

`unique(perfil_id, bodega_id)` evita permisos contradictorios dentro de una misma bodega. La misma persona puede ser líder de una y operadora de otra. La interfaz debe calcular capacidades después de seleccionar la bodega, sin elevar todas sus bodegas al rol más alto encontrado.

Un único líder activo puede ser `es_responsable=true` en cada bodega. Otros miembros con rol `lider` actúan como suplentes autorizados. El alta inicial de un administrador funcional exige una decisión explícita que relacione UUID reales de perfiles con bodegas confirmadas. No se asignan personas por nombres.

El rol global `Admin` permite ver la preparación del módulo cuando no hay esquema, pero no concede automáticamente lectura de bodegas, reportes, saldos ni auditoría. Las membresías funcionales son la fuente de autorización de datos.

Para un perfil `Operativo`, retirar `inventarios` de `modulos_permitidos` revoca también su lectura directa por REST aunque todavía tenga una membresía activa. Para `Admin` se conserva el acceso global al módulo existente, pero cada bodega sigue requiriendo membresía explícita. Ambas condiciones se comprueban en RLS además de la interfaz.

## Lectura y conteo ciego

| Recurso | Operador | Líder | Administrador funcional |
|---|---|---|---|
| Bodegas | Las autorizadas y activas | Las autorizadas y activas | Las autorizadas y activas |
| Membresías | La propia | Miembros de sus bodegas | Miembros de sus bodegas |
| Tickets | Conteos asignados a sí mismo | Tickets de sus bodegas | Tickets de sus bodegas |
| Catálogo e ítems | Alcance de sus sesiones asignadas | Catálogo de sus bodegas | Catálogo de sus bodegas |
| Conteos | Propios en tickets autorizados | Conteos de sus bodegas | Conteos de sus bodegas |
| Saldos, diferencias y verificaciones | Sin acceso | Sus bodegas | Sus bodegas |
| Propuestas de ajuste | Sin acceso | Sus bodegas, lectura | Sus bodegas |
| Auditoría y sincronización | Sin acceso | Sin acceso a la auditoría administrativa | Sus bodegas |
| Notificaciones | Propias y de tickets autorizados | Propias y autorizadas | Propias y autorizadas |

La propuesta habilita RLS en todas las tablas y revoca privilegios heredados. Solo concede `SELECT` a `authenticated`, sujeto a esas políticas. No hay políticas ni privilegios `INSERT`, `UPDATE`, `DELETE` para clientes, tampoco privilegios sobre las tablas para `service_role`. La futura escritura se habilitará mediante comandos transaccionales revisados; no basta con cambiar un botón de la interfaz.

Las tres funciones de consulta de autorización están en `inventario_private`, con `SECURITY DEFINER`, identidad obtenida internamente de `auth.uid()`, comprobación de perfil activo, `search_path=''` y sin SQL dinámico. Su único resultado es el rol propio o un booleano de acceso. Evitan la recursión de RLS al consultar membresías. Se revoca `EXECUTE` de `PUBLIC` y se concede únicamente a `authenticated` para evaluar las políticas. **No exponer `inventario_private` en Data API**; la aprobación debe comprobar la configuración de esquemas expuestos y el propietario de estas funciones.

RLS por fila no oculta columnas. Por eso los saldos están en otra tabla, no en una propiedad que el frontend descarte. No hay JSON de respuesta ERP en sesiones, productos, tickets ni notificaciones. El operador tampoco obtiene diferencias mediante joins, reportes, auditoría o notificaciones. Un mismo usuario con rol superior en otra bodega sigue siendo operador en la bodega consultada.

Los servicios futuros deben devolver DTO explícitos, no `select('*')` indiscriminados ni uniones que incluyan tablas restringidas. No usar vistas con permisos del propietario para escapar de RLS. Las observaciones iniciales dirigidas al operador no deben incluir saldos de referencia.

## Máquina de estados propuesta

Los estados se almacenan en formato estable `snake_case`; la interfaz muestra su etiqueta en español. Esta tabla es el contrato de comandos de la siguiente fase. **El SQL actual restringe valores, pero no implementa RPC de transición: ninguna transición está habilitada todavía.** Un `CHECK` de estados válidos no es una máquina de estados.

| Desde | Hacia | Actor y condiciones que deberá verificar el backend |
|---|---|---|
| Pendiente de asignación | Asignado | Líder/administrador de esa bodega; fotografía íntegra, operador activo y sin duplicado/solapamiento. |
| Asignado | Aceptado | Solo el operador asignado; versión esperada vigente. |
| Aceptado | En proceso | Solo operador asignado; registra inicio en servidor. |
| En proceso | Enviado a verificación | Todos los ítems tienen cantidad explícita; bloquea la ronda y crea ticket de verificación. |
| Enviado a verificación | En verificación | Líder de la bodega; recepción/inicio registrados; no verificar el propio conteo. |
| En verificación | Reconteo solicitado | Líder; motivo obligatorio; conserva ronda anterior y crea nueva ronda. |
| Reconteo solicitado | Aceptado | Operador asignado acepta la nueva ronda; inicio anterior se conserva en auditoría. |
| En verificación | Verificado sin diferencias | Líder; verificación por SKU completa y conciliación completa. |
| En verificación | Verificado con diferencias | Líder; evidencia y diferencia confirmada por SKU, conciliación completa. |
| Verificado sin diferencias | Cerrado | Líder/administrador; ausencia de diferencias y tareas pendientes. |
| Verificado con diferencias | Pendiente de aprobación | Líder; propuesta motivada, conciliación completa y destinatario autorizado. |
| Pendiente de aprobación | Cerrado | Administrador de esa bodega, distinto del contador/verificador/proponente; decisión explícita y trazable. No implica ajuste en ERP. |
| Pendiente de aprobación | En verificación | Administrador rechaza/devuelve con motivo; conserva propuesta y decisión anterior. |
| Cualquier no terminal | Cancelado | Líder/administrador de esa bodega; motivo obligatorio; cancela dependientes sin borrar evidencia. |

`Cerrado` y `Cancelado` son terminales. Reabrir implica una nueva sesión con relación de trazabilidad revisada, no editar silenciosamente una cerrada.

El ticket principal de conteo conserva el flujo completo. En cada envío se crea un ticket de tipo `verificacion`, enlazado mediante `ticket_origen_id` y `ronda`, para la bandeja del líder. Su recepción, inicio y cierre se reflejan también en el principal dentro de la misma transacción. La futura RPC debe validar tipo, ronda y relación; no todos los estados son aplicables a ambos tipos. El índice único `(ticket_origen_id, ronda)` impide dos verificaciones de un mismo envío.

Las horas usan `timestamptz`, se generan en servidor y se presentan en `America/Bogota`. Corte ERP, captura, asignación, aceptación, inicio, envío, recepción y verificación son fechas distintas. La duración de cada ronda se obtiene de su inicio/envío registrados y de los eventos persistidos, sin perder rondas anteriores al actualizar el resumen del ticket.

`Pendiente de conciliación` es una condición independiente del estado del ticket. Si faltan movimientos, permanece en revisión y no puede llegar a verificado/aprobación. No se inventa un estado ERP ni se sustituye la conciliación por cero.

## Transacciones, concurrencia e idempotencia

Comandos previstos: crear sesión/asignar, aceptar, iniciar, guardar cantidad, enviar, recibir verificación, registrar verificación, solicitar reconteo, proponer decisión, aprobar/rechazar, cancelar y marcar notificación leída. No se implementan como actualizaciones arbitrarias desde el navegador.

Cada comando deberá:

1. Validar la sesión autenticada en servidor, perfil activo y membresía vigente para la bodega recuperada desde la entidad; no aceptar la bodega enviada por el cliente como autoridad.
2. Validar entrada con esquema estricto; actor y timestamps se obtienen del servidor. Comprobar capacidades de ese rol y separación de funciones.
3. Iniciar transacción corta. Bloquear ticket con `FOR UPDATE`; comparar `version` esperada. Dos dispositivos no pueden sobrescribirse: conflicto devuelve `409` y exige recargar.
4. Insertar clave UUID de idempotencia con hash canónico del comando, actor y bodega. Repetición idéntica devuelve el mismo resultado; misma clave con otro contenido o actor se rechaza sin filtrar resultados.
5. Verificar estado anterior, tipo de ticket, ronda, completitud, pertenencia de cada SKU, factor autorizado y referencias de conteo/verificación.
6. Guardar nueva revisión de conteo o verificación sin modificar la anterior. La revisión más alta de cada ítem/ronda es la actual; al enviar queda congelada.
7. Cambiar estado/versión, guardar auditoría y notificaciones en la misma transacción. Un fallo revierte todo. Nunca notificar antes del commit.

Las consultas HTTP de G21 ocurren **antes de tomar bloqueos**. Se capturan todas las páginas bajo un token/corte consistente; se validan códigos, unidades, cobertura, duplicados, totales y completitud. En la transacción final se revalidan permisos, token, integridad y alcance, y se crean sesión, ítems, saldos, ticket y notificación de forma atómica.

Se requiere acordar con G21 si existe snapshot consistente o lectura a una fecha. Si no puede garantizarse, no se crean asignaciones. Las respuestas parciales se registran como sincronización incompleta. No se consulta “saldo actual” página por página y se presenta como una fotografía consistente.

La implementación deberá usar bloqueo asesor transaccional por bodega y alcance, o una tabla de reservas de ítems si se permite particionar sesiones, para detectar solapamientos parciales entre inventarios activos. La consulta y reserva deben ser atómicas. Esta decisión se validará con el tamaño real de los inventarios antes de añadir otra tabla.

No se registran escrituras en esta fase. Se documentan estas invariantes porque las FKs y restricciones de la propuesta por sí solas no validan toda la lógica de negocio.

## Conciliación y ajustes

Conservar por SKU el saldo al corte, movimientos del intervalo, cantidad física y diferencia. El instante de observación física debe asociarse al último conteo confirmado del ítem, no solo a la hora de envío del ticket. Guardar la referencia/cursor del conjunto de movimientos y la versión del contrato usado.

Como hipótesis a validar con G21: saldo teórico al instante del conteo = saldo al corte + entradas − salidas ± transferencias de la misma bodega, convertidas a unidad base. La dirección de las transferencias, devoluciones, documentos anulados, redondeo y límites inclusivos del intervalo deben definirse con el ERP antes de calcular/aprobar diferencias. La propuesta no aplica esta hipótesis como fórmula definitiva.

Se deben comprobar también movimientos ocurridos entre la primera observación y la verificación. Cada verificación conserva su instante y base de comparación correspondiente. Si no hay datos suficientes, diferencia confirmada permanece nula y el ajuste bloqueado.

La cantidad cero es una captura válida, distinta de una fila ausente. Las cantidades físicas no son negativas; un saldo oficial negativo puede existir si G21 lo admite y no se modifica silenciosamente. Precisión `numeric(20,6)` propuesta: validar escala, magnitudes y factores con el contrato real antes de desplegar.

La tabla de ajustes solo guarda propuestas/decisiones. La restricción `erp_ajuste_id IS NULL` bloquea el envío en esta etapa. Aprobar una propuesta no modifica G21. La fase de envío requerirá otra migración revisada, doble control, idempotencia ERP, confirmación del usuario y comprobación del estado del ajuste remoto.

## Alertas y reportes

Parámetros iniciales propuestos, configurables por bodega/categoría:

- Al día: antigüedad de 0 a menos de 10 días.
- Alerta: desde 10 hasta 30 días, ambos límites incluidos.
- Crítico: más de 30 días.
- Sin inventario verificado: estado independiente “Sin inventario”; no se muestra como 0 días.

La antigüedad se define como días calendario en `America/Bogota` desde el último inventario cerrado y verificado con cobertura completa de esa categoría. Si la cobertura fue parcial, no actualiza toda la categoría a “Al día”. Fechas futuras se marcan como error de datos. Los límites se leen de `inventario_parametros`; ningún cambio de umbral cambia eventos históricos.

Métricas de productividad excluyen cancelados y separan cada ronda de reconteo. Conteo promedio utiliza inicio/envío de rondas completas. Verificación promedio utiliza inicio/fin de verificaciones completas. Cobertura exige denominador de SKU/categorías confirmado y una ventana explícita; sin denominador no se muestra un porcentaje. “Pendiente” y “crítico” deben distinguir estado de ticket, vencimiento y antigüedad de categoría.

## Notificaciones y sincronización

Las notificaciones persisten en la misma transacción que el evento. El cliente obtiene primero su bandeja autorizada al entrar; una futura suscripción Realtime solo invalida/refresca esa consulta. No constituye la fuente única del estado. No se añadió publicación Realtime en el SQL propuesto.

Antes de habilitar Realtime se comprobarán RLS, revocación de membresías y suscripciones de otro usuario. Los eventos de diferencias y aprobación no se entregan a operadores. Marcar como leída será un comando limitado al destinatario, sin permitir alterar el resto de la fila.

No se guardan saldos ni conteos offline en esta fase. El service worker no debe cachear respuestas de inventarios. Lectores HID envían código al buscador; escanear selecciona un producto autorizado y no incrementa cantidades automáticamente. Cámara requiere soporte real y consentimiento; búsqueda manual permanece disponible. El SKU y factor deben volver a validarse en servidor al guardar.

## Históricos de Excel

No se adjuntó el Excel en esta solicitud; no se importaron datos. El procedimiento opcional será:

1. Revisar copia del archivo sin modificar el original y obtener su hash, fecha y hojas.
2. Normalizar categorías, fechas y unidades; listar duplicados y filas inválidas.
3. Mapear bodegas con códigos oficiales de G21 y responsables con UUID verificados manualmente.
4. Presentar un informe de conciliación y obtener validación humana antes de incorporar.
5. Si no hay detalle SKU, mantener historial agregado por categoría en un almacenamiento separado por diseñar; nunca poblar `saldos_base`, inventar SKU ni convertirlo en inventario actual.

La retención de ese origen/histórico debe especificarse en una propuesta posterior. No se añade una tabla vacía de importación sin inspeccionar primero el archivo.

## Validación requerida antes del despliegue

El SQL pasó 11 grupos de comprobaciones ejecutadas en PostgreSQL 17.5 en memoria, con datos sintéticos y roles separados. Se verificaron DDL, rollback, RLS, privilegios, restricciones y conservación del historial. El usuario autorizó crear las tablas y se verificó el despliegue en Supabase PostgreSQL 17.6. El [informe de validación](inventarios-validacion-db.md) incluye reproducción y límites: los flujos con sesiones reales y las futuras RPC de negocio siguen pendientes, al igual que los endpoints G21.

Lista de validación del plan original: las comprobaciones SQL aisladas y la verificación del despliegue ya se realizaron; las pruebas de futuras RPC, G21 y sesiones reales siguen pendientes:

- DDL completo, rollback, integridad FK, unicidad, cantidades, timestamps y conservación al cancelar/eliminar una cuenta.
- Tests pgTAP de lectura permitida/denegada con usuarios sintéticos: operador A no lee ticket de B ni saldo, diferencias, auditoría o joins; líder A no consulta bodega B; administrador funcional sin membresía no ve B; Admin global no obtiene acceso implícito; perfiles inactivos y membresías revocadas pierden acceso.
- Verificar por SQL que `anon`, `authenticated` y `service_role` carecen de privilegios de escritura; no probar solo botones ocultos.
- Probar RPC futuras: saltos de estados, propio ajuste, reconteo, envío incompleto, cero explícito, unidades, repetición idempotente, dos dispositivos, dos asignaciones solapadas, cancelación simultánea y error a mitad de transacción.
- Probar autorización a través de REST, consultas anidadas, función de reportes y Realtime; comprobar que no se exportan saldos al operador.
- Usar contratos de prueba G21 fuera de producción: páginas faltantes, snapshot diferente, código desconocido, movimiento tardío, transferencia, timeout, reintento y unidad ambigua.
- Ejecutar asesores de seguridad y revisar planes/índices con volumen representativo. Confirmar que `inventario_private` no es esquema expuesto.
- Presentar SQL final, resultados de pruebas y plan de recuperación para aprobación antes de cualquier despliegue real. Recuperar mediante migración compensatoria; no borrar auditoría para deshacer operación.

Referencias consultadas: [RLS de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security), [seguridad por columna](https://supabase.com/docs/guides/database/postgres/column-level-security), [funciones de base de datos](https://supabase.com/docs/guides/database/functions) y [changelog](https://supabase.com/changelog). Se revisaron además las guías locales de índices de FK, RLS y transacciones cortas.
