# Experiencia visual del operador

Se mejoraron Mis inventarios y el detalle del ticket usando los datos, acciones y permisos existentes. No hay migraciones ni cambios en G21, RLS, conteos, reglas de progreso o almacenamiento.

## Archivos y componentes

Dentro de `src/modules/inventarios/operations`:

- `OperatorTaskList.tsx`: resumen compacto y panel de búsqueda/filtros. Las estadísticas usan únicamente las tareas que `operatorTasks` autoriza al usuario, antes de los filtros de búsqueda. Finalizados comprende entregados, en revisión, verificados y cerrados; Con diferencias es un subconjunto, no una suma adicional.
- `TaskTable.tsx`: jerarquía de ticket/categoría, etiquetas discretas, fechas divididas en fecha/hora y acciones Eye/Play/ArrowRight con nombre accesible y tooltip. Se mantienen ordenamiento, filtros y paginación.
- `TaskPresentation.tsx`: clases visuales de badges, prioridades, avatar y progreso. Se conservan el cálculo y la normalización de prioridades originales.
- `OperationsPanel.tsx`: encabezado, resumen de bodega/operador/asignador/fecha, progreso destacado, secciones de conteo e indicaciones. Las filas de productos se presentan como tarjetas a menos de 640 px. El historial sigue oculto al operador.
- `EvidencePanel.tsx`: galería `EvidenceGallery` con imágenes contenidas sin recortar, captions, controles existentes y un espacio de agregar evidencia con el número de espacios disponibles. En consulta no muestra controles vacíos para agregar; la carga conserva el máximo de tres y sus validaciones.
- `operator-experience.css`: estilos locales bajo `.inventory-operator`, sin cambiar variables globales ni otros módulos.
- `operations.test.mjs`: adaptación del cargador de estilos y pruebas de controles de evidencias y nombres accesibles.

## Diseño y accesibilidad

Se usan las variables de cada tema para texto, superficies y estados; los badges del operador no dependen del tema del sistema operativo. Claro utiliza superficies blancas, bordes definidos y sombras suaves; oscuro utiliza superficies elevadas y tonos de texto legibles. Se mantienen Baja, Media y Alta.

Hay foco visible para teclado y etiquetas para acciones con iconos. Las transiciones de filas, botones y progreso son breves; las tarjetas y el modal tienen entrada suave y el modal del operador tiene salida de 140 ms. `prefers-reduced-motion` desactiva animaciones y transiciones visuales. Se conserva el bloqueo de cierre durante el guardado de la acción del ticket.

## Validación

- TypeScript sin errores y ESLint correcto en los componentes modificados.
- 32 pruebas Node correctas, incluidas restricciones de rol, conteo ciego, carga de evidencias y su límite de tres.
- Ocho capturas locales aisladas: listado/detalle, temas claro/oscuro, escritorio y distribución móvil de 390 px. Se corrigió el conteo móvil para evitar desplazamiento horizontal dentro de cada producto.
- Contraste calculado de texto secundario y estados sobre sus fondos: mínimo 5,18:1 en las combinaciones verificadas. No representa una auditoría completa de accesibilidad de la aplicación.
- Las capturas usan fixtures y gráficos de prueba locales, sin modificar Supabase. No sustituyen una sesión autenticada en un dispositivo real ni una prueba de captura con cámara.
