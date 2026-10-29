# Panel de monitoreo de inventarios

Actualización: 22/10/2026.

## Pantalla y alcance

El panel de líderes y administración en `/inventarios/registros` usa `LeaderMonitor`, integrado desde `OperationsPanel`. Los operadores conservan `OperatorTaskList`. El detalle, la asignación, la revisión, las evidencias y el historial reutilizan sus componentes y acciones existentes.

No se modificaron servicios, consultas, base de datos, permisos, reglas G21 ni estados oficiales. El cliente muestra únicamente tareas de las bodegas de supervisión incluidas en el contexto autorizado; la seguridad del servidor y RLS permanece vigente. Administración mantiene el seguimiento global de su alcance y no recibe acciones operativas nuevas.

## Nueva estructura

- Encabezado con asignación para líderes y consulta de equipo para administración.
- Seis indicadores: asignados, en proceso, finalizados por operador, en verificación, con diferencias y cerrados hoy. Responden a los filtros aplicados.
- Búsqueda por ticket, categoría u operador; filtros combinables por estado, prioridad, operador, bodega y origen de prueba. Orden por asignación reciente, antigua o actividad conocida.
- Vista por estado: grupos plegables sin columnas vacías ni desplazamiento horizontal. Los grupos comparten filas según su número de tareas y el ancho disponible. Los estados sin tareas no ocupan un bloque; los indicadores superiores siguen mostrando cero.
- Vista por operador: agrupación por el identificador del responsable, con total de tareas y tareas en curso. Un mismo operador en varias bodegas aparece una sola vez cuando el alcance incluye ambas.
- Se conserva la tabla anterior como tercera opción, con paginación.
- Cada grupo muestra inicialmente hasta seis tarjetas; permite mostrar las restantes y volver a compactarlo.
- Tarjetas con ticket, categoría, bodega, responsable, autor de asignación, estado, prioridad, avance real, fechas y botón de detalle con icono de ojo. En la vista por operador el responsable aparece en el encabezado del grupo.
- Zona plegable de atención con pendientes de revisión, avisos recientes y vencimientos cuando existe una fecha real en el registro.

## Criterios de los indicadores

- **Con diferencias:** incluye el estado `verificado_con_diferencias` y los cierres marcados con diferencias. El filtro «Todas las diferencias» reúne ambos casos, sin cambiar su estado; los cierres siguen agrupados bajo Cerrado.
- **Cerrados hoy:** usa `cerrado_at`, el estado Cerrado y la fecha local de `America/Bogota`; finalizar el conteo no equivale a cerrar.
- **Operadores contando:** responsables distintos de tareas en proceso dentro de los filtros. No representa presencia en línea ni una sesión conectada.
- **Actividad conocida:** fecha más reciente entre asignación, inicio, envío, hitos de verificación, cierre y avisos ya disponibles. No se presenta como la hora exacta del último guardado de productos o evidencias.
- No se generan alertas de «sin movimiento» basándose en la asignación: los datos disponibles no permiten afirmar que no se hayan guardado conteos recientes.
- Prioridades visibles: Baja, Media y Alta. Se reutiliza la compatibilidad existente para Normal → Media y Urgente → Alta.

## Actualización y presentación

Se conserva el refresco existente cada 30 segundos con la pestaña visible. No se agregan consultas ni suscripciones. Los filtros se conservan al refrescar los datos; cambiar de bodega limpia el operador seleccionado para evitar combinaciones fuera de alcance.

Los estilos están limitados a `.inventory-monitor`, con variables de los temas actuales. Hay colores semánticos para proceso, verificación, resultados y prioridades; foco visible, controles accesibles, transiciones suaves y soporte de movimiento reducido. En móvil los filtros secundarios se despliegan a petición del usuario.

## Archivos

- `src/modules/inventarios/operations/LeaderMonitor.tsx`: panel, tarjetas y grupos.
- `src/modules/inventarios/operations/leader-monitor.css`: estilos adaptables y temas.
- `src/modules/inventarios/operations/monitor.ts`: selección del alcance, filtros, orden, grupos, fechas y tonos visuales.
- `src/modules/inventarios/operations/OperationsPanel.tsx`: integración y retirada del board anterior; conserva detalles, acciones y reportes.
- `src/modules/inventarios/operations/operations.test.mjs`: cobertura de alcance, filtros, estados, prioridades y límites de fecha.

## Validaciones

- TypeScript sin emisión y ESLint sobre los archivos de implementación.
- 35 pruebas del módulo y de acciones de evidencias: pasan, incluidas las restricciones de operadores y administración y las dos decisiones de revisión del líder.
- Navegador local aislado con datos de prueba: 30 comprobaciones de filtros, cambio de vista, agrupaciones, acción de detalle, recuperación de búsquedas vacías y tabla.
- Capturas revisadas en claro/oscuro a 1440, 820 y 390 px, sin desbordamiento horizontal. Contraste de los textos muestreados igual o superior a 4,5:1.
- La prueba de navegador usa componentes reales montados con datos aislados; no inicia sesiones ni ejecuta asignaciones o cierres en producción.
