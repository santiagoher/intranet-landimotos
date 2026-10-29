# Contratos G21 para inventarios

Estado: **Integración pendiente**. Las rutas HTTP de este documento son propuestas del requerimiento, no endpoints verificados. No se consultó el ERP, no se añadieron credenciales, no hay datos de demostración en la interfaz y no se implementó ninguna escritura de stock.

## Estructura implementada

| Archivo | Responsabilidad |
| --- | --- |
| `src/modules/inventarios/g21/contracts.ts` | Contratos internos tipados de bodegas, categorías, productos, unidades, códigos, paginación, saldos, movimientos, errores, DTO ciego y captura futura de escaneo. Estado público de integración. |
| `src/modules/inventarios/g21/adapter.server.ts` | Puerto de lectura exclusivo del servidor. Todos sus métodos devuelven `G21_INTEGRATION_PENDING`; no ejecutan `fetch`. Tipo de configuración futura de rutas reales y autenticación. |
| `src/modules/inventarios/g21/validation.server.ts` | Validaciones de frontera con Zod; armado de una fotografía consistente e inmutable; selección explícita de campos para conteo ciego. |
| `src/modules/inventarios/g21/validation.test.mjs` | Pruebas aisladas de integridad y privacidad, con datos identificados como pruebas y sin red. |

Se utilizan TypeScript, Zod y la frontera `server-only` ya soportados por el Next.js instalado. No se añadieron dependencias ni se cambió la autenticación existente.

`getG21ReadAdapter()` es una dependencia de futuros servicios del servidor. No es una Server Action pública ni un endpoint. Antes de llamar a un adaptador real, cada servicio deberá verificar la sesión, el estado del perfil, la membresía de bodega y la operación autorizada. El tipo del contrato no sustituye esa autorización ni la RLS.

## Mapeo que debe confirmar el proveedor

| Propuesta HTTP | Operación interna | Entrada requerida | Respuesta normalizada |
| --- | --- | --- | --- |
| `GET /api/bodegas` | `listWarehouses` | Cursor y límite | ID y código oficiales, nombre, estado activo, paginación completa. |
| `GET /api/categorias` | `listCategories` | Bodega autorizada, cursor y límite | ID/código oficial y nombre de categoría. Confirmar si el catálogo depende de bodega. |
| `GET /api/productos` | `listProducts` | Bodega, categoría y alcance opcional por producto/ubicación | ID oficial, SKU, nombre, categoría, unidad base y conversiones autorizadas. |
| `GET /api/inventario/saldos` | `captureStockSnapshot` | Alcance exacto y todas las páginas del mismo corte | Saldo por producto/ubicación, token consistente, fecha ERP y completitud verificable. |
| `GET /api/inventario/movimientos` | `listMovements` | Alcance y período `(desde, hasta]` UTC | Movimientos únicos, cantidades con signo en unidad base, referencias, watermark y token de conciliación. |
| `GET /api/productos/codigos-barras` | `listBarcodes` | IDs oficiales de producto, cursor y límite | Uno o varios códigos por producto, unidad de lectura y simbología si existe. |
| `POST /api/inventario/ajustes` | Fase posterior, sin método ejecutable | Propuesta aprobada, conciliación y clave de idempotencia | ID externo, estado verificable y recibo de aplicación; por acordar. |
| `GET /api/inventario/ajustes/{id}` | Fase posterior | ID oficial del ajuste | Resultado final para recuperar timeouts sin reenviar a ciegas. |

Los identificadores G21 se tratan como cadenas opacas. No se derivan de nombres como “Bodega 3”, ni de números de hojas de Excel. Los UUID internos de Supabase y los códigos/IDs del ERP son campos distintos.

`G21VerifiedTransportConfig` reserva la URL de origen, rutas por operación, versión del contrato, timeout y un proveedor de cabeceras autorizado. Aún no se acepta configuración de usuario ni se activa transporte alguno. El futuro adaptador debe validar HTTPS, origen permitido, rutas relativas y redirecciones; no debe aceptar una URL arbitraria del navegador. Las credenciales estarán en secretos del backend y nunca en variables `NEXT_PUBLIC_*`, props, respuestas o logs.

La autenticación concreta (OAuth, API key u otra), scopes de lectura, renovación, límites y cabeceras de idempotencia requieren confirmación de G21. No se ha supuesto un método.

## Cantidades, unidades, fechas y paginación

- Cantidades y factores son cadenas decimales exactas. Se admiten saldos negativos del ERP; cero debe llegar explícitamente. Se rechazan floats JSON, notación exponencial y factores de conversión no positivos. La conciliación posterior usará aritmética decimal exacta o `numeric` en servidor, no `Number`.
- Una conversión indica `baseUnitsPerUnit` y una referencia de autorización ERP. No se deducen factores por nombre de empaque. Cada código de barras identifica producto y unidad autorizada; códigos ambiguos bloquean la fotografía.
- El contrato interno usa ISO 8601 UTC terminado en `Z`. Fechas con otra zona deben normalizarse en el futuro mapeador, una vez confirmado el origen. `stockAsOf` es el corte del ERP; `capturedAt` lo genera el servidor; `assignedAt` lo generará la transacción de asignación. Son tres fechas distintas. La UI presentará `America/Bogota`.
- La paginación normalizada contiene cursor actual, siguiente cursor, límite y número total de registros. El límite normalizado máximo es 1.000; el adaptador debe respetar un máximo inferior si lo exige G21. Una API de páginas numéricas puede mapearse a este contrato solo si mantiene un corte estable entre páginas.
- El adaptador deberá devolver todas las páginas de un mismo `snapshotId` y `stockAsOf`. No basta con que la última página sea corta. Si G21 no ofrece un mecanismo verificable de corte consistente y completitud, no se creará una asignación.

`assembleStockSnapshot` comprueba formato, alcance, token, fecha, totales, cadena de cursores, duplicados por producto/ubicación, categorías, conversiones y códigos. Rechaza cortes vacíos y productos solicitados que no aparecen, en vez de interpretarlos como cero. Una respuesta parcial nunca produce una fotografía utilizable. El resultado válido se copia, se sella recursivamente y conserva decimales sin pérdida. La persistencia futura también deberá impedir actualizaciones y borrados de la fotografía: `Object.freeze` protege memoria, no una base de datos.

El catálogo de productos y los saldos deben permitir demostrar qué SKU integran el alcance, incluidos saldos cero. La marca `completeness: complete` solo podrá establecerse por el mapeador a partir de garantías reales de G21, no como valor por defecto.

## Conciliación y ajustes

La ventana propuesta es `(fecha del saldo, fecha efectiva del conteo del SKU]`: se excluye el corte inicial y se incluye el final para evitar doble conteo. Debe confirmarse con G21 si sus marcas corresponden a fecha efectiva, contabilización o ambas, cómo maneja movimientos tardíos y cuál es la semántica del saldo disponible frente a existencias físicas.

La fórmula candidata, pendiente de validar con los contratos reales, es `teórico = saldo al corte + suma de movimientos firmados en unidad base` y `diferencia = físico - teórico`. Entradas y transferencias recibidas tienen signo positivo; salidas y transferencias enviadas, negativo; ajustes conservan el signo confirmado. Cada transferencia necesita referencia para no duplicar sus dos lados.

La validación implementada revisa cada página de movimientos, su intervalo, bodega, signos y confirmación de cobertura. **No calcula ni declara una conciliación completa**: el futuro coordinador debe recoger todas las páginas, deduplicar IDs globalmente, comprobar unidades/catálogo, cobertura hasta cada conteo, tokens estables y movimientos tardíos. Si falta alguna garantía, se mantendrá “Pendiente de conciliación” y se bloqueará el ajuste.

`G21ApprovedAdjustment` describe únicamente una propuesta futura con aprobador, hora de aprobación, corte, token de conciliación, líneas y clave de idempotencia. No existe función para enviarla. Los datos recibidos del navegador nunca acreditan por sí solos una aprobación: el servidor deberá recuperar y validar el registro persistido, separar solicitante y aprobador, bloquear repeticiones concurrentes y auditar el resultado. La misma clave y payload deben recuperar la misma respuesta; una clave con payload diferente debe producir conflicto. Ante timeout se consultará el ID externo antes de cualquier reintento.

## Conteo ciego y lectores

`toBlindCountProducts` selecciona solo identidad, SKU, nombre, ubicación, códigos y conversiones. Excluye saldos, movimientos, diferencias y metadatos del corte. Debe ejecutarse después de autorizar el ticket y nunca enviarse al operador el objeto de fotografía completo, aunque la UI oculte columnas.

`ScanCapture` prepara entrada HID, cámara o manual, ticket y clave idempotente. No hay lector ni persistencia de conteos habilitados en esta fase. El futuro servidor validará el SKU dentro de la tarea, el estado editable, la unidad autorizada y la revisión concurrente; distinguirá cantidad `0` de ausencia de conteo. La interfaz distinguirá una lectura repetida accidental de un incremento intencional. No se generarán códigos oficiales y la primera fase de conteo será online.

## Errores y operación

Todos los resultados usan la unión `G21Result<T>`: éxito con datos o error seguro con código, mensaje y posibilidad de reintento. Se reservan errores de integración pendiente, autenticación, permisos, indisponibilidad, límite de solicitudes, formato, incompletitud, corte inconsistente, conciliación e idempotencia. No se devuelven cuerpos originales del proveedor ni secretos. La integración pendiente no es un conjunto vacío de inventario ni un saldo cero.

Un futuro transporte debe imponer timeout, limitar reintentos de lectura, respetar `Retry-After`, emitir un ID de correlación y guardar auditoría técnica saneada. No se permiten reintentos automáticos de ajustes sin confirmación de idempotencia y consulta posterior.

## Validación y siguiente fase

Ejecutar `node --test src/modules/inventarios/g21/validation.test.mjs`. Las pruebas cubren adaptador bloqueado, decimales exactos, cero explícito, paginación parcial, corte/bodega incorrectos, SKU faltantes, duplicados, unidades/códigos ambiguos, fotografía inmutable, DTO ciego y límites de movimientos.

Antes de implementar el transporte: obtener documentación y credenciales de un entorno de pruebas G21, confirmar los contratos de esta tabla y capturar respuestas representativas autorizadas. Después implementar el mapeador y pruebas de contrato, validar permisos por bodega y concurrencia contra el esquema aprobado, y habilitar asignaciones únicamente tras comprobar corte completo y persistencia transaccional. Esta etapa no habilita ajustes ERP.
