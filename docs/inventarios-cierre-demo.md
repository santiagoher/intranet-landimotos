# Cierre de inventarios de prueba creados por operadores

La operación OP-00000009 se consultó en lectura: está enviada a verificación, tiene 2/2 productos contados, 2 referencias y procedencia registrada en `inventario_private.demo_tickets`.

El bloqueo estaba en `OperationsPanel.tsx`: excluía del cierre cualquier tarea con `origen_creacion=creado_por_operador`, aunque fuera DEMO y tuviera comparación completa. La base ya permite que un líder autorizado cierre un DEMO registrado con la clave de servidor correspondiente.

La condición ahora utiliza `hasCompleteReviewComparison` de `types.ts`: permite tareas de prueba creadas por operadores cuando todos sus productos tienen conteo y referencia. Mantiene el bloqueo de autoinventarios oficiales pendientes de integración, comparaciones parciales o no cargadas. Cero sigue siendo una cantidad válida. No cambia los controles del servidor sobre rol, bodega, versión y procedencia privada DEMO.

Archivos modificados: `OperationsPanel.tsx`, `types.ts` y `operations.test.mjs` en `src/modules/inventarios/operations`.

Validación: 29 pruebas de operaciones aprobadas; prueba aislada `test-inventario-demo.cjs --shared` aprobada, incluyendo revisión/cierre por líder y rechazo a otros roles. ESLint de los componentes modificados y la comprobación final de TypeScript aprobaron.

No se cerró la tarea en nombre del líder ni se modificaron registros en producción. Recargar el desarrollo local, abrir la operación, revisar la comparación y escribir la observación permite probar «Verificar y cerrar». Para Vercel se necesita desplegar este cambio de interfaz.
