# Operación de inventarios y conteo por reporte

Fecha: 20 de octubre de 2026.

## Estado de entrega

La migración `20261020171451_inventarios_operacion_categorias` está aplicada en Supabase. Instala los permisos globales específicos de Inventarios, la modalidad de tarea por categoría y cuatro RPC públicas autenticadas.

La carga `20261020181155_inventarios_catalogo_excel_inicial` está **aplicada en Supabase**, después de la autorización explícita del usuario para cargar el catálogo y otorgar los permisos indicados. Se verificaron seis bodegas, 793 categorías, un administrador global activo y seis membresías activas del operador. No se crearon tareas ni saldos de ejemplo.

La migración aplicada contiene:

- Seis bodegas y 793 categorías reales del Excel, con `origen='excel'`, sin códigos ERP ficticios ni fecha de confirmación G21.
- Una relación global de Inventarios para el administrador actual, ALEJANDRA TALENTO.
- Relaciones de operador entre PRINCIPAL DESPACHO y esas seis bodegas.
- Ningún saldo, producto, conteo, tarea ni cambio en `perfiles`.

Los nombres se utilizan exclusivamente en la carga inicial, con comprobación de coincidencia única. La aplicación autoriza por UUID y relaciones persistidas; no contiene condiciones especiales para esos nombres.

La migración `20261020185830_inventarios_conteo_reporte` también está aplicada. Añade los productos seleccionados de un reporte CSV a una tarea, conteo ciego persistente y progreso calculado. No se insertaron productos ni tareas de prueba en la base real; se conserva la tarea que ya existía.

Santiago Hernandez Rangel (`santihernandez2005r@gmail.com`) tiene una cuenta activa con acceso a Inventarios y membresía de líder responsable en las seis bodegas. El rol base continúa siendo `Operativo`; la capacidad de líder se obtiene de las membresías, no de metadatos editables del usuario. La cuenta requiere confirmación de correo. No se reasignaron los líderes de tareas existentes ni se retiraron permisos a otros usuarios. PRINCIPAL DESPACHO sigue como operador de las seis bodegas.

Se retiró **Fecha objetivo** de la asignación, el detalle y los indicadores. La fecha y hora de asignación las genera PostgreSQL al confirmar, y se muestran en zona `America/Bogota`, por ejemplo `20/10/2026, 1:21 p. m.`. Los valores históricos de vencimiento permanecen en la base, pero no se solicitan ni utilizan en la interfaz actual.

## Rutas y componentes

El sidebar muestra **Vista general**, **Tareas de inventario** para líderes/Administración (o **Mis inventarios** para operadores), y **Reportes** según el acceso existente. Se conservan las URL del tablero y los reportes. El botón de asignación continúa llamándose **Asignar inventario**, exclusivo del líder.

| Ruta | Contenido |
|---|---|
| `/inventarios` | Vista general: resumen de tareas y estado por bodega, utilizando el mismo alcance autorizado y actualización cada 30 segundos. |
| `/inventarios/registros` | Board operativo, vista de tabla, filtros, agrupaciones, wizard de tres pasos y detalle con acciones e historial. |
| `/inventarios/reportes` | Resultados, tiempos, diferencias y agrupaciones; histórico del Excel conservado en sección desplegable administrativa. |
| `/admin/inventarios` | Consulta de líderes y operadores por bodega para Administración, sin edición de miembros. |

Archivos principales:

- `src/modules/inventarios/operations/OperationsPanel.tsx`: wizard, board, detalle y equipo.
- `src/modules/inventarios/operations/actions.ts`: entradas validadas, sesión, RPC y actualización de rutas.
- `src/modules/inventarios/operations/service.server.ts`: contexto y consultas paginadas bajo RLS.
- `src/modules/inventarios/operations/types.ts`: estados, progreso y tiempos.
- `src/modules/inventarios/access.server.ts` y `types.ts`: reconocimiento del administrador funcional global y catálogos sin código ERP.
- Las páginas de la tabla anterior e `operations/InventoryOverview.tsx`.
- Las migraciones de Inventarios, `scripts/test-inventario-operacion.cjs`, `scripts/prepare-inventario-catalog.cjs` y `operations/operations.test.mjs`.

El panel se actualiza tras cada escritura y cada 30 segundos mientras la pestaña está visible. No depende de activar publicaciones Realtime.

### Historial de asignación

Migración `20261021135334_inventarios_evento_asignacion_unico` aplicada y verificada en Supabase. Se comprobó en PostgreSQL aislado que las nuevas asignaciones generan una sola fila incluso al reintentar, que se conserva el nombre del destinatario y que no se eliminan eventos anteriores.

Una creación con asignación produce un único evento `asignado`, presentado como **Inventario creado y asignado a [operador]**, con autor, rol, fecha, indicaciones y contexto de prueba o reporte. Se conserva el nombre del destinatario al asignar para que un cambio posterior de nombre no reescriba el historial. Las referencias se registran dentro de la misma transacción; no generan una segunda entrada visible ni una segunda fila de auditoría en nuevas asignaciones. Los reintentos idénticos no duplican el evento.

Los registros anteriores se conservan sin eliminaciones: `history.ts` integra la entrada técnica `referencia_registrada` en la asignación del mismo actor y fecha exacta. Los eventos de referencia que no correspondan a esa creación se mantienen visibles. También se traducen las acciones del historial a nombres legibles, como Conteo iniciado, Conteo enviado a revisión o Inventario cerrado con diferencias confirmadas.

## Roles y alcance

`perfiles.rol` conserva `Admin` / `Operativo`. El perfil debe estar activo y tener acceso al módulo.

- **Administrador global de Inventarios:** relación activa en `inventario_administradores`; consulta todas las bodegas activas, informes, integrantes e historial. No asigna, cuenta, verifica, devuelve ni cierra tareas, ni modifica membresías desde este módulo.
- **Líder:** membresía explícita en `inventario_usuarios_bodegas`; solo supervisa sus bodegas y asigna a operadores activos de ellas.
- **Operador:** membresía explícita; consulta sus tareas, las inicia, cuenta sus productos y finaliza. En tareas sin reporte conserva el avance por hitos. No asigna ni verifica su propio trabajo.

Una bodega tiene un único líder responsable activo; puede tener líderes suplentes y varios operadores. Equipo y bodegas es ahora una consulta sin botones de modificación. Las relaciones actuales se conservan. El aprovisionamiento de accesos queda fuera de la operación de estos tres roles; las RPC anteriores de gestión de miembros ya no son ejecutables por clientes autenticados.

Los permisos se comprueban en SQL además de la interfaz. Los clientes no reciben privilegios de INSERT/UPDATE/DELETE sobre tablas. Las RPC públicas son `SECURITY INVOKER`; delegan en funciones privadas con `search_path` vacío y comprobaciones explícitas de identidad, rol, bodega y estado.

## Persistencia reutilizada

`inventario_administradores` controla el permiso global del módulo. `inventario_tarea_productos` guarda código, descripción, clasificación y cantidad contada por el operador; no contiene existencias esperadas. Tiene RLS, lectura limitada al alcance de la tarea y escritura únicamente mediante RPC autorizadas. Las referencias para comparar se guardan por separado en `inventario_private.referencias_producto`, sin acceso directo de clientes. Solo las RPC de supervisión autorizadas pueden leerlas.

Se reutilizan:

- `inventario_bodegas` y `inventario_categorias`, con origen y referencia local. G21 mantiene sus campos obligatorios cuando `origen='g21'`.
- `inventario_usuarios_bodegas`, para líder responsable y operadores.
- `inventario_tickets`, con `modo='categoria'`, categoría, líder y avance parcial. La sesión ERP es nula en esta modalidad; en `modo='sku'` sigue siendo obligatoria.
- `inventario_auditoria`, para acciones, actores, motivos y fechas.
- `inventario_private.operaciones`, para idempotencia al asignar.

Las claves foráneas nuevas cubren bodega, categoría y ticket de auditoría incluso cuando no hay sesión SKU. No se crean fotografías ERP vacías.

RPC:

- `inventario_contexto`: alcance, miembros y nombres de participantes autorizados.
- `inventario_asignar`: valida responsable/categoría/bodega; crea ticket y auditoría en una transacción; reintentos idénticos reutilizan la misma tarea.
- `inventario_actualizar`: bloquea la fila, verifica versión y transición, registra evento y tiempos.
- `inventario_miembro`: RPC anterior de aprovisionamiento; ejecución revocada para clientes autenticados tras separar Administración como consulta.
- `inventario_asignar_reporte`: valida la selección y crea tarea/productos en una transacción idempotente. Rechaza campos de existencias o cualquier otro campo fuera de la lista permitida.
- `inventario_productos_tarea`: código, nombre y cantidad contada de las tareas autorizadas; conserva decimales como texto.
- `inventario_contar_producto`: solo el operador asignado, en proceso y con versión vigente; registra cantidad, fecha, autor y evento de auditoría.

## Reporte y conteo ciego

En **Inventarios → Registros → Asignar inventario**, exclusivamente el líder selecciona bodega/categoría y carga el reporte del sistema en CSV UTF-8.

Encabezado recomendado:

```csv
Código;Nombre;Cantidad;Familia;Grupo;Subgrupo;Marca
```

Se aceptan coma, punto y coma o tabulador como separadores y campos entre comillas. Código y nombre son obligatorios; `Descripción` también se reconoce como nombre. Los códigos conservan ceros iniciales. `Cantidad` es la referencia para comparar; se admiten también los encabezados `Existencias`, `Saldo`, `Cantidad esperada` o `Cantidad sistema`, pero solo uno. Debe contener números no negativos sin separadores de miles, con hasta seis decimales; una cantidad vacía se rechaza. Un archivo sin columna de cantidad permite contar, pero se identifica como **sin referencia**, sin calcular diferencias. Los campos de clasificación son opcionales: los filtros solo ofrecen valores presentes en el archivo. No se infieren clasificaciones a partir del Excel de bodegas.

El asistente filtra en cascada por **Familia, Grupo, Subgrupo y Marca**, muestra una vista previa y asigna todos los productos seleccionados. Permite hasta 2000 productos únicos y 2 MB por archivo. La cantidad de referencia se guarda en el servidor y no se devuelve al operador. Costos y otros campos se descartan. Cambiar de bodega descarta el reporte anterior para evitar asignarlo a otra ubicación accidentalmente.

El operador inicia la tarea y recibe código, nombre y cantidad vacía. Guarda cada conteo; admite cero y hasta seis decimales. Vacío significa pendiente, nunca cero. Puede buscar productos y paginar la lista. El líder y administrador ven cantidades contadas, referencias, diferencias y progreso; no pueden contar en nombre del operador. Los operadores no pueden asignar ni consultar referencias mediante RPC o lectura directa de tablas.

El avance es **productos contados / productos asignados** y se actualiza después de guardar y cada 30 segundos en otras sesiones visibles. El 100% de conteo no implica aprobación: la verificación conserva su estado independiente. No se puede finalizar mientras falte contar un producto. Devolver para reconteo limpia las cantidades del intento actual y conserva sus valores anteriores en los eventos de auditoría.

El reporte manual permite operar mientras se conecta G21. La diferencia es **contado menos referencia al asignar**: negativa para faltante, positiva para sobrante, cero para coincidencia. Un conteo pendiente o un producto sin referencia no se compara. No se descuentan movimientos posteriores ni se modifica el stock; esa conciliación contra el ERP permanece pendiente. El Excel de organigrama no proporciona códigos de producto.

## Prueba completa sin endpoints

1. Como líder de bodega, abrir **Inventarios → Registros → Asignar inventario**.
2. Seleccionar bodega y categoría, y pulsar **Usar productos de prueba**. Son ocho productos supuestos, con códigos `PRUEBA-*` y cantidades de referencia protegidas, procedentes de `operations/catalog.server.ts`.
3. Aplicar los filtros que se quieran probar, elegir al operador y confirmar. La fecha/hora se registra automáticamente. El sistema solo crea la tarea al confirmar; no carga tareas ficticias en segundo plano.
4. Como operador, iniciar la tarea, registrar cantidades y finalizar. No se ven referencias ni diferencias. Sin terminar todos los productos no se puede enviar a revisión.
5. El líder consulta las diferencias y verifica, devuelve para reconteo o cierra con diferencias confirmadas. No se permite marcar como coincidente una tarea que tiene diferencias contra su referencia. Al devolver, se limpia el conteo actual, se conserva la referencia inicial y quedan los conteos anteriores en auditoría. El cierre con diferencias exige justificación y conserva intactos los conteos.
6. ALEJANDRA TALENTO, administradora global ya verificada, abre **Inventarios → Reportes → Informe detallado por tarea → Ver detalle**. Ve el alcance completo, el operador, avance, coincidencias, faltantes, sobrantes y todas las fechas y eventos desde la asignación hasta el cierre. Los líderes solo ven sus bodegas.

Las tareas tienen una etiqueta **Prueba** y el filtro de origen permite incluirlas, ver solo pruebas o excluirlas. Los nombres de las bodegas existentes se reutilizan; los productos y saldos supuestos no se cargan como catálogo ni existencias reales. No se alteran asignaciones previas.

La interfaz conserva el tema y la actualización cada 30 segundos. `inventario_asignar_con_saldos` fija productos y referencias en una transacción idempotente; `inventario_comparacion_tarea` e `inventario_resumen_conciliacion` sirven los resultados solo a supervisores del alcance correspondiente. La migración `20261020204539_inventarios_referencias_conciliacion` está aplicada en Supabase: añade estas funciones, la referencia privada, la marca de prueba y una validación de resultados de verificación. Se verificó que clientes autenticados no pueden leer directamente las referencias ni usuarios anónimos ejecutar la comparación. No se cargaron tareas de prueba remotas durante la validación.

Para conectar la API se sustituirá el proveedor temporal del catálogo en el servidor por consultas autenticadas por bodega. Debe entregar código, nombre, clasificación y referencia decimal consistente, conservando la separación entre datos del operador y datos de supervisión. El contrato de captura de referencia y comparación ya existe; la integración G21 deberá además resolver unidades, corte temporal y movimientos conforme a `inventarios-g21.md`. No basta con cambiar una URL para garantizar una conciliación contra existencias en movimiento.

## Flujo y progreso

| Acción / estado | Actor | Avance |
|---|---|---:|
| Asignar | Líder de la bodega | 10% |
| Iniciar | Operador asignado | 25% |
| Guardar avance con observación | Operador asignado | Declarado entre 26% y 69%, sin retroceder |
| Finalizar trabajo | Operador asignado | 70% |
| Iniciar verificación | Supervisor distinto del operador | 85% |
| Verificar sin diferencias | Supervisor, con observación | 100% |
| Registrar diferencias | Supervisor, con observación | 85% |
| Devolver para revisión | Supervisor, con motivo | Vuelve a 25%; eventos previos conservados |
| Cerrar | Líder, tras verificación sin diferencias | 100% |
| Cerrar con diferencias confirmadas | Líder, desde Con diferencias y con justificación obligatoria | 100% |

La tabla anterior corresponde exclusivamente a tareas sin reporte. Las tareas con productos utilizan el porcentaje de conteos guardados. El detalle y las barras identifican ambas modalidades. Una tarea con diferencias se cierra únicamente mediante la acción explícita **Cerrar con diferencias confirmadas**, nunca como verificada sin diferencias. La verificación es operativa y no constituye conciliación financiera/ERP.

### Separación de operación y seguimiento

La migración `20261020213046_inventarios_roles_cierre_diferencias` está aplicada en Supabase. Restringe todas las asignaciones y revisiones al líder en SQL, y bloquea las escrituras de Administración. Alejandra conserva la lectura global y el detalle de referencias, resultados e historial. Los operadores mantienen únicamente inicio, conteo y envío de sus tareas. Se verificó que OP-00000003 permanece en Con diferencias y que la ejecución de gestión de miembros está revocada para clientes autenticados.

El nuevo comando `cerrar_diferencias` requiere estado `verificado_con_diferencias`, líder autorizado distinto del operador, versión vigente y justificación no vacía. Conserva el estado oficial `cerrado`, con `cierre_con_diferencias=true` y `justificacion_cierre`, además de actor, motivo y fecha en auditoría. En las tarjetas, tablas y detalle se muestra **Cerrado con diferencias** y no se suma a Verificadas sin diferencias. Los saldos y cantidades contadas no cambian. No se cierra ni reasigna automáticamente ninguna tarea existente.

Los tiempos se calculan desde fechas de servidor. El tiempo de ejecución incluye el intervalo desde el inicio hasta el último envío, incluidos eventuales reconteos. El promedio de verificación usa la última ronda completada.

## Comprobaciones

- PostgreSQL 17.5 aislado: creación, idempotencia, rechazo de operador ajeno, categoría de otra bodega, asignación sin rol, lectura por alcance, transiciones completas, versiones obsoletas, avance inválido, auditoría y revocación.
- Catálogo inicial aplicado dos veces en memoria sin duplicados: seis bodegas y 793 categorías.
- Pruebas Node de acceso, Excel, contratos G21, proyección sin existencias, filtros, referencias, catálogo de prueba, progreso, acciones por rol e informe por tarea.
- PostgreSQL aislado: conteos cero/decimales exactos, rechazo de cantidades inválidas, acceso de operador ajeno o supervisor, finalización incompleta, versiones obsoletas, reconteo y cierre.
- PostgreSQL aislado: privacidad de referencias frente al operador, alcance por bodega, faltantes/sobrantes/coincidencias, referencia ausente, idempotencia, referencia conservada en reconteos y bloqueo de verificaciones incompatibles con el resultado.
- PostgreSQL aislado: Administración conserva consultas pero no escribe; asignación y cierre reservados al líder, cierre con justificación obligatoria, rechazo de versiones obsoletas, cierre repetido, operadores y usuarios fuera de alcance; conteos y referencias intactos e historial de cierre legible para Administración.
- TypeScript y ESLint de los archivos afectados.
- Compilación de producción con Webpack en una copia temporal para evitar el archivo `.next` bloqueado del workspace.
- Asesor de seguridad remoto: para Inventarios conserva el aviso informativo [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) en `inventario_private.operaciones` y `inventario_private.referencias_producto`, deliberadamente sin acceso directo de clientes. Las funciones privadas autorizadas son la única vía de acceso. Los avisos preexistentes de autenticación y funciones generales no se modificaron en este ajuste.

No había navegador conectado para probar visualmente el wizard ni sesiones reales de los tres roles. Las pruebas con cuentas sintéticas se ejecutaron únicamente en memoria.

## Pendiente

Confirmar el correo de Santiago si sigue pendiente, iniciar sesión y ejecutar el flujo de prueba o cargar un reporte de productos con referencia.

La integración G21 sigue pendiente: consulta directa del catálogo SKU, unidades, saldos consistentes, movimientos, conciliación con movimientos y ajustes. La arquitectura original de sesiones/ítems/conteos se conserva para esa fase; esta entrega habilita conteo y comparación operativa con una referencia fija sin modificar stock.
