# Impresión de diferencias de inventario

## Uso

Inventarios → Registros → abrir inventario → Comparación de cantidades → **Imprimir diferencias**. Se abre una pestaña con vista previa y selección A5/A4. El detalle original conserva su estado. **Imprimir** abre el diálogo del navegador, donde también se puede guardar como PDF. Desactivar los encabezados/pies automáticos del navegador y seleccionar el papel correcto en la impresora.

El documento muestra identidad del ticket, bodega, categoría, operador, líder, fecha del último conteo guardado y fecha/hora de impresión en Colombia. Incluye SKU, nombre completo, unidad registrada, referencia ERP, físico, diferencia con signo y casilla vacía para verificación manual. Incluye resumen por referencias y observaciones con líneas; no contiene campos de firmas.

Solo aparecen diferencias calculadas distintas de cero. No se convierten cantidades a Number ni se vuelve a calcular la resta: se utiliza la diferencia exacta del RPC existente. Los ceros válidos no se confunden con valores ausentes. Cuando faltan referencias/conteos se muestra comparación pendiente, y un documento parcial nunca se presenta como «sin diferencias». Un ticket DEMO lleva **DOCUMENTO DE PRUEBA — NO OFICIAL** y aclara que sus referencias no son existencias de G21.

La vista previa es una fotografía de la consulta. **Actualizar datos** vuelve a comprobar permisos y cargar información. El pie identifica cuándo se consultó y la versión; la fecha de impresión se actualiza al imprimir, incluso mediante el evento `beforeprint` del navegador.

## Integración y permisos

La ruta `/inventarios/registros/[ticket]/imprimir` usa un grupo de rutas separado del layout del dashboard, por lo que no monta sidebar ni navegación. Es dinámica, no indexable, y no almacena documentos en base de datos. La PWA existente tampoco cachea navegaciones autenticadas.

`getDifferencePrintData` es exclusivamente servidor. Valida UUID y sesión, consulta `inventario_contexto` para reutilizar la comprobación de perfil activo, módulo y membresías, y comprueba el rol líder/administrador de **la bodega del ticket** antes de solicitar referencias. Un operador o un líder de otra bodega recibe una respuesta sin cantidades, incluso accediendo directamente a la URL.

Reutiliza `getTaskSnapshot` y el RPC de comparación con RLS/permisos existentes. `getCountProducts` aporta unidades y fechas sin otra lógica de diferencias. Los RPC devuelven el conjunto completo; la impresión no depende del filtro ni de la página de 15 filas de la tabla visual. Comprueba cardinalidad e IDs y vuelve a validar la versión tras las lecturas para rechazar documentos truncados o mezclados con otra versión.

No se usa service_role, no se amplían permisos y no se altera autenticación. No hay escrituras, aprobación, cierre, ajustes, cambios de estados ni nuevos eventos de auditoría. La identificación procede de los mismos datos de ticket/contexto utilizados por supervisión; se conserva la auditoría existente.

Cuando G21 suministre la referencia correspondiente al corte y sus movimientos, el flujo de conciliación existente debe guardar esa referencia para el conteo. La impresión consumirá el resultado de ese flujo; no consulta saldos vivos de G21 ni realiza ajustes.

## Archivos

- `src/modules/inventarios/operations/OperationsPanel.tsx`: acceso con icono Printer para supervisión autorizada.
- `src/app/(print)/inventarios/registros/[ticket]/imprimir/page.tsx`: ruta dinámica y respuesta ante acceso denegado/error.
- `src/modules/inventarios/operations/difference-print.server.ts`: lectura autorizada y comprobaciones de integridad/versión.
- `src/modules/inventarios/operations/difference-print.ts`: contrato de impresión, filtrado/resumen y formato de signos sin pérdida decimal.
- `src/modules/inventarios/operations/DifferencePrintDocument.tsx`: documento completo sin controles de aplicación ni firmas.
- `src/modules/inventarios/operations/DifferencePrintPreview.tsx`: papel, actualización, fecha y diálogo nativo.
- `src/modules/inventarios/operations/difference-print.css`: vista previa, papel blanco, A5/A4, tabla multipágina con encabezados repetidos y filas indivisibles.
- `src/modules/inventarios/operations/difference-print.test.mjs`: pruebas funcionales y de permisos.
- `scripts/test-inventory-difference-print.cjs`: navegador aislado, PDF y capturas con datos sintéticos; no carga credenciales ni conecta a Supabase.

## Validaciones

La suite completa de aplicación pasó: **95 pruebas, 0 fallos**, incluidas siete pruebas nuevas de impresión. TypeScript y ESLint de los archivos de aplicación modificados aprobaron.

| Escenario | Validación |
| --- | --- |
| Faltantes, sobrantes y ambos | Filtrado y signo exacto; incluye fracciones y cantidades grandes sin conversión numérica. |
| Sin diferencias | Mensaje y resumen cero, sin filas coincidentes. |
| Sin referencia teórica | Aviso pendiente; datos parciales identificados, sin cantidades inventadas. |
| Muchas referencias | Render de 120 filas sin truncamiento; PDF real de 80 referencias con nombres/SKU largos. |
| A5/A4 | PDF compacto de una página en ambos tamaños. Documento largo: 11 páginas A5 y 6 A4. Dimensiones de papel comprobadas en los PDF. |
| Encabezados y filas | Se extrajo el texto de los PDF: encabezado repetido en páginas con filas y cada SKU completo en una sola página. |
| Modo oscuro | Navegador con tema oscuro: documento blanco, texto oscuro y captura revisada. |
| Operadores/anónimos | Servicio rechaza antes de consultar comparación. |
| Líder de otra bodega | Rechazo antes de solicitar cantidades; errores RLS también impiden el documento. |
| Administrador autorizado | Acceso con membresía/rol devueltos por el contexto existente. |
| Datos del ticket/productos | Identidad, nombres, unidades y fecha; cambio concurrente o comparación truncada rechazan el resultado. |
| Sin firmas/controles | HTML y texto del PDF revisados; no se imprimen barra de herramientas, filtros ni navegación. |

Comandos (PowerShell, desde la raíz):

```powershell
$printTestFiles = @(rg --files src -g '*.test.mjs')
node --test @printTestFiles
node node_modules/typescript/bin/tsc --noEmit
node scripts/test-inventory-difference-print.cjs
```

La prueba de navegador necesita permiso para iniciar Edge y sus procesos gráficos; en este entorno el sandbox los impedía, por lo que se ejecutó con la autorización de herramientas correspondiente. Los artefactos se escriben en una carpeta temporal `landimotos-difference-print-*` y contienen únicamente datos de prueba locales.

No se probó una impresora física ni una sesión real de producción de extremo a extremo. No se ejecutaron migraciones ni escrituras en producción y **no se desplegó a Vercel**. Los cambios quedan disponibles en el proyecto local.
