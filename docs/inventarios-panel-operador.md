# Panel del operador y prioridades

## Comportamiento

- `/inventarios/registros`: los operadores ven sus tareas en tabla, sin estadísticas ni board. En móvil se muestran tarjetas compactas.
- Buscador por ticket/categoría, estado, prioridad, fecha y ordenamiento por columnas. El filtro de bodega aparece solo con más de una bodega autorizada.
- Actualización existente cada 30 segundos; los filtros y el orden viven en estado React independiente de los datos recibidos, sin una clave que remonte el panel al refrescar.
- Líderes conservan asignación, board, métricas y verificación. Administración conserva consulta global y seguimiento, sin habilitar nuevas escrituras.
- Progreso: SKU contados / SKU asignados. Un conteo de cero confirmado cuenta como completado según la lógica existente. Sin productos se indica «Progreso por etapas». El estado de verificación se muestra por separado.
- No se modificó el sidebar, los estados, cantidades, permisos ni autenticación.

## Autor real

Se incorpora `inventario_tickets.asignado_por` al loader. Ya tiene relación con `perfiles(id)` mediante `inventario_tickets_asignado_por_fkey`; el RPC de asignación lo escribe con `auth.uid()`. `inventario_contexto` proporciona los nombres autorizados en `people`.

«Asignado por» identifica ese perfil, independientemente del operador (`asignado_a`) y líder responsable (`lider_id`). Si falta el perfil o autor se muestra «No registrado». Las tablas de supervisión muestran también «Asignado a».

## Migración pendiente de autorización

`supabase/migrations/20261021140335_inventarios_prioridades_tres_niveles.sql` está preparada, NO aplicada en producción.

En una transacción, normaliza `urgente` a `alta` y `normal` a `media`, cambia el valor predeterminado a `media` y restringe las prioridades persistidas a `alta`, `media`, `baja`. Actualiza el RPC privado conservando comprobaciones de rol, autor autenticado, idempotencia y evento único de asignación.

La interfaz y validación de entrada solo permiten Alta, Media, Baja, en ese orden. Hasta aprobar la migración, `priorityForRpc` traduce Media al valor antiguo `normal`; el SQL preparado acepta ese alias y lo guarda como `media`. Los registros antiguos se presentan normalizados sin modificar producción. Una futura retirada del alias requiere desplegar primero clientes que envíen `media`.

La migración no elimina registros ni modifica estados, productos, cantidades o auditoría. El trigger existente puede actualizar la fecha técnica `updated_at` en los tickets cuya prioridad cambia.

## Archivos

- `operations/OperationsPanel.tsx`: integración por rol, prioridades y autor en detalle/board/reportes.
- `operations/OperatorTaskList.tsx`: tabla directa, filtros y paginación del operador.
- `operations/TaskTable.tsx`: tabla de escritorio y tarjetas móviles reutilizables.
- `operations/TaskPresentation.tsx`: estado, prioridad, avatar y progreso.
- `operations/task-list.ts`: búsqueda, alcance del operador, ordenamiento y compatibilidad de prioridades.
- `operations/types.ts`, `operations/service.server.ts`, `operations/actions.ts`: autor y prioridades tipadas/validadas.
- `operations/operations.test.mjs`, `scripts/test-inventario-operacion.cjs`: pruebas de UI, reglas y migración aislada.

Las rutas anteriores de `operations` son relativas a `src/modules/inventarios`.

## Validación

- TypeScript y ESLint de los archivos modificados: correctos.
- 20 pruebas Node de operaciones, permisos y navegación: correctas.
- Migración ejecutada exclusivamente en PostgreSQL aislado mediante PGlite: normalización, rechazo de Urgente, alias temporal, autor autenticado, restricciones por rol y conservación de conteos/auditoría correctos.
- Diseño con tokens de tema y variantes claras/oscuras; tabla desde `md` y tarjetas por debajo. Revisión visual interactiva pendiente: no hay navegador conectado a esta sesión.
- Verificación manual pendiente: probar claro/oscuro en escritorio y móvil; ordenar y filtrar, esperar 30 segundos y confirmar que las selecciones se mantienen; abrir un ticket con cada rol autorizado.
