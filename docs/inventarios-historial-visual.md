# Historial visual de inventarios

El historial se presenta en dos bloques: **Proceso del inventario** y **Actividad en la app**. Es una representación de los tickets y eventos existentes; no cambia estados, cantidades, permisos ni registros de auditoría. No requiere migraciones.

## Componentes y archivos

- `src/modules/inventarios/operations/InventoryHistory.tsx`: nuevo componente de etapas y timeline, etiquetas, cambios antes/ahora, detalles expandibles y acceso a evidencias.
- `history.ts`: clasificación, formato exacto de cantidades y agrupación; proyección del ciclo actual con reconteos y cierre con diferencias.
- `OperationsPanel.tsx`: integra el historial para supervisión y separa sus errores de los errores de las acciones.
- `EvidencePanel.tsx`: reutiliza el visor existente al abrir una evidencia desde su evento. Consulta la URL privada vigente bajo los controles existentes; informa si la foto fue retirada o no está disponible.
- `actions.ts` y `types.ts`: incorporan a la lectura autorizada campos ya existentes de la auditoría (`entidad_id`, `entidad_tipo`, `estado_anterior`, `estado_nuevo`). No se cambia cómo se escriben los eventos.
- `operations.test.mjs`: pruebas del historial, formato, agrupación, reconteos y presentación por rol.

## Clasificación y agrupación

Etiquetas: Proceso, Conteo, Revisión, Evidencia, Observación y Sistema. Los eventos no reconocidos conservan su texto y se identifican como Sistema.

Solo se agrupan eventos consecutivos `producto_contado` del mismo actor y rol, dentro de cinco minutos desde el primero. Cualquier acción intercalada, cambio de actor/rol o vencimiento del intervalo inicia otro grupo. Al expandir se conserva cada cambio y su fecha; se distinguen la primera cantidad registrada y sus actualizaciones. No se suman cantidades ni se descartan revisiones intermedias.

Se mantiene la compatibilidad anterior con asignaciones que generaban dos registros simultáneos: se muestran juntas sin borrar filas ni perder su contexto. Administración puede expandir los datos originales de ambos registros.

El formato de cantidades trabaja con texto, sin conversión a números de punto flotante: `10.000000` se muestra como `10`; `0.000001` conserva su precisión. Los mensajes cuyo formato no se reconoce se presentan completos.

En un reconteo, las entregas/verificaciones anteriores siguen en la actividad, pero no completan las etapas del nuevo ciclo. No se inventa una nueva fecha de inicio a partir de la devolución del líder.

## Roles

- Operador: la auditoría interna sigue oculta y no se solicita desde su detalle.
- Líder: proceso, actividad, observaciones, cambios y apertura autorizada de evidencias.
- Administración: lo anterior más un desplegable con los datos originales de cada registro.

## Validación

- 30 pruebas Node correctas, incluidas las pruebas de seguridad y manejo de fallos de evidencias.
- TypeScript y ESLint sobre los archivos modificados.
- Capturas locales del componente con datos de prueba aislados: escritorio claro y distribución de 390 px en claro/oscuro. Se revisaron legibilidad, saltos de línea, etiquetas y conectores. La vista usa las variables de tema existentes.
- No se subieron fotografías ni se modificaron tareas reales. La apertura de una fotografía real desde una sesión autenticada queda como comprobación de integración en la aplicación; las capturas son de una vista aislada, no de una sesión de producción.
