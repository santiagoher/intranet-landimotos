# Intranet Landimotos — Documentación comercial y empresarial

**Fecha:** 29 de octubre de 2026. **Base:** código local, documentación histórica y metadatos de Supabase consultados sin modificar datos. Este documento describe capacidades encontradas; no constituye una certificación de producción ni un estudio de retorno económico.

Lecturas relacionadas: [resumen ejecutivo](RESUMEN_EJECUTIVO.md), [documentación técnica](DOCUMENTACION_TECNICA.md), [inventario de evidencias](INVENTARIO_PROYECTO.md).

## 1. Resumen ejecutivo del software

### Descripción corta

Intranet Landimotos es una plataforma web interna que reúne el registro de despachos, la disponibilidad de mensajeros, las inspecciones de vehículos, el seguimiento de atención y las tareas de inventario por bodega. Permite organizar responsables, consultar pendientes y revisar resultados desde un mismo portal. En inventarios, separa la asignación del líder, el conteo del operador y la supervisión administrativa, con historial, evidencias y comparación de cantidades. Su valor está en dar continuidad y visibilidad al trabajo diario. La integración con G21 y la preparación como producto comercial siguen pendientes; los beneficios económicos requieren medirse en una operación real.

### Explicación ejecutiva

El software responde a una operación de distribución que necesita coordinar personas, documentos de despacho, vehículos y bodegas. Sus registros permiten consultar qué se registró, a qué conductor se vinculó una ruta, qué novedades se reportaron en la flota y en qué etapa se encuentra un conteo.

La propuesta de valor es **centralizar el seguimiento operativo y hacer explícitos los responsables y las decisiones**. El sistema aporta formularios, estados, búsquedas, reportes y un flujo de inventario con separación de funciones. No reemplaza por completo un ERP: el registro de números de factura no es emisión fiscal, el seguimiento de rutas no es GPS y la comparación con un CSV no considera movimientos posteriores del inventario.

El proyecto muestra mayor profundidad de controles en inventarios que en los módulos tradicionales. Para una presentación comercial responsable, debe ofrecerse como una solución interna en consolidación, con oportunidades de adaptación y un plan explícito de validación. Hay componentes implementados, mecanismos de prueba y conexión real a Supabase, pero también riesgos de permisos y diferencias entre el código local y el historial de despliegue.

## 2. Problemática empresarial

Los siguientes problemas se deducen de los procesos que el software aborda. No se verificó que todos hayan ocurrido históricamente en Landimotos:

- **Información dispersa de despachos:** el número de factura, punto, área, mesa y revisor necesitan quedar vinculados y ser localizables.
- **Disponibilidad poco visible:** los responsables deben distinguir conductores disponibles, en ruta, en almuerzo o inactivos y consultar sus movimientos registrados.
- **Novedades de vehículos sin seguimiento:** una inspección necesita registrar el hallazgo y permitir una resolución administrativa posterior.
- **Conteos sin responsable o revisión clara:** una tarea debe tener alcance, operador, líder, estado y resultados separados de la simple captura de cantidades.
- **Dificultad para justificar diferencias:** se requieren comparación, observaciones, evidencias y un historial de decisiones.
- **Registros de atención difíciles de consolidar:** los totales diarios por asesor y categoría necesitan una estructura común.
- **Accesos administrados de forma informal:** roles, módulos y estado de las cuentas deben ser visibles y gestionables.

La trazabilidad es más detallada en inventarios. No se encontró un registro de auditoría equivalente para todas las modificaciones de despachos, mensajeros, vehículos o atención.

## 3. Solución tecnológica

| Problema empresarial | Solución implementada | Beneficio para la empresa |
|---|---|---|
| Localizar información de una factura | Registro, búsqueda y detalle de pedidos; asociación opcional de envío | Facilita responder consultas operativas y reconstruir el registro |
| Desconocer disponibilidad del personal | Estados de mensajero, rutas activas e historial de almuerzos; actualización periódica | Apoya la coordinación de salidas y retornos |
| Novedades mecánicas dispersas | Checklist con evaluación, observación, kilometraje y alertas | Mantiene un punto de consulta para priorizar revisión de vehículos |
| Conteos sin distribución clara del trabajo | Tickets por categoría con operador, líder y prioridad | Permite supervisar carga y pendientes por bodega |
| Sesgo al conocer la cantidad esperada | Conteo ciego; referencias guardadas por separado | Favorece un registro independiente de la cantidad física |
| Diferencias difíciles de revisar | Comparación, devolución para reconteo, cierre con motivo e impresión | Proporciona soporte para verificar y documentar la decisión |
| Cambios simultáneos que se pisan | Versión de tarea y aviso de conflicto, con borrador preservado en la interfaz | Reduce sobrescrituras silenciosas dentro del flujo de inventario |
| Totales de atención sin estructura uniforme | Registro diario único por asesor/fecha, etiquetas y gráficos | Facilita revisar actividad registrada y distribución por categorías |
| Programación comercial informal | Calendario manual de temáticas y estados de WhatsApp | Ordena compromisos y cumplimiento declarado; no publica mensajes |

Evidencia: acciones y pantallas de `src/app/(dashboard)`, y servicios/componentes de `src/modules/inventarios/operations`. La [matriz de riesgos](DOCUMENTACION_TECNICA.md#12-seguridad) explica las restricciones que impiden prometer control completo de todos los accesos.

## 4. Funcionalidades y módulos

### 4.1. Despachos y registro de facturas

**Objetivo y usuarios.** Personal operativo registra facturas y asigna un envío; administración consulta registros y reportes. La interfaz oculta el botón principal de registro a Admin y reserva la anulación visible a este rol; los permisos reales de datos requieren endurecimiento.

**Información y funcionamiento.** Guarda punto Principal/Sucursal, número de factura, área, mesa, revisor, detalles y estado. El usuario registra el pedido, puede asociar mensajero/dirección y consulta el detalle. La lista normal muestra el mes actual sin cancelados; los reportes incluyen consultas por rango y año, gráficos y CSV. Es registro de documentos existentes: no se encontraron precios, cálculo tributario, cobro o emisión de factura electrónica.

**Valor.** Operativamente facilita localizar un registro y reducir recaptura de campos mediante catálogos. Administrativamente permite revisar actividad por punto, área y revisor. Para decisiones proporciona volumen registrado por período, sujeto a revisar el tratamiento de cancelados y las fechas. No acredita una entrega física ni garantiza que el envío y su cambio de estado se hayan guardado juntos.

**Evidencia:** [acciones](../src/app/%28dashboard%29/despachos/actions.ts), [pantalla](../src/app/%28dashboard%29/despachos/page.tsx), `OrderForm.tsx`, `ShipmentForm.tsx`, `DespachosAdminStats.tsx`.

### 4.2. Mensajería, rutas y conductores

**Objetivo y usuarios.** El personal autorizado coordina la disponibilidad y registra salidas, retornos y almuerzos. Administración mantiene datos de conductores y consulta el análisis de rutas.

**Información y funcionamiento.** Maneja nombre, placa, documento, cargo, fotografía y vencimientos de documentación; rutas con destino textual, número de pedidos, facturas, revisor y horas; registros de almuerzo. Las acciones actualizan estados y la pantalla vuelve a consultar periódicamente mientras está visible. Los reportes de rutas finalizadas se filtran por período y permiten búsqueda por factura y descarga CSV.

**Valor.** Operativamente proporciona un estado compartido del personal. Administrativamente reúne documentación y movimientos registrados. Para decisiones permite observar volúmenes por conductor, destino y horario. La información depende del registro manual; no existe ubicación GPS ni cálculo de recorridos. El CSV actual tiene columnas que la consulta no devuelve, por lo que requiere corrección antes de utilizarlo como reporte completo.

**Evidencia:** [acciones](../src/app/%28dashboard%29/mensajeros/actions.ts), `useMensajerosData.ts`, `RouteForm.tsx`, `MensajerosReports.tsx`, [administración de conductores](../src/app/%28dashboard%29/admin/mensajeros/page.tsx).

### 4.3. Vehículos e inspección preoperacional

**Objetivo y usuarios.** Operadores registran inspecciones y administración mantiene vehículos, revisa novedades y documenta resolución de alertas.

**Información y funcionamiento.** El catálogo incluye placa, marca, modelo, tipo, kilometraje y estado. La inspección guarda conductor, evaluación de componentes y documentos, observaciones y kilometraje. Un resultado «mal» obliga a introducir observación y genera una alerta. El servidor rechaza un kilometraje inferior al consultado. La resolución registra comentario y fecha.

**Valor.** Operativamente sistematiza el registro de revisión. Administrativamente permite consultar hallazgos pendientes y su resolución. Para decisiones ofrece conteos de alertas e inspecciones y revisión del historial. No demuestra cumplimiento normativo, reparación efectiva ni seguridad mecánica; tampoco se encontró bloqueo servidor que impida crear una ruta sin checklist o cambio automático del vehículo a mantenimiento al reportar una novedad.

**Evidencia:** [acciones](../src/app/%28dashboard%29/vehiculos/actions.ts), `ChecklistForm.tsx`, `ChecklistDetailsModal.tsx`, `AlertResolutionModal.tsx` y [esquema histórico](../supabase_schema.sql).

### 4.4. Inventarios por bodega

**Objetivo y usuarios.** Distribuir, ejecutar y revisar conteos. El líder asigna y toma decisiones; el operador registra cantidades; el administrador de inventarios observa resultados. Ser Admin de la plataforma no concede automáticamente el rol operativo de líder.

**Información y funcionamiento.** Una tarea identifica bodega, categoría, operador, líder, prioridad y tiempos. El líder puede importar productos desde CSV, con clasificación y referencia opcional, o utilizar un catálogo identificado como prueba. El operador recibe los productos sin cantidades esperadas, inicia, cuenta y entrega. El líder compara y elige verificar/cerrar o devolver para reconteo. El cierre conserva si hubo diferencias; no ajusta stock. Las tareas sin productos permiten seguimiento por hitos, pero la revisión combinada actual exige productos y referencias para cerrar.

**Evidencias y seguimiento.** Se implementaron observación versionada, hasta tres fotografías de conteo por tarea, historial de eventos, reportes y vista de impresión A5/A4. Las fotografías se procesan en servidor y se visualizan mediante enlaces temporales autorizados. La subida real a Storage no se ensayó en esta auditoría.

**Fuentes que deben distinguirse.** El histórico Excel es una consulta administrativa, no un catálogo de existencias. El CSV aporta una referencia fija declarada por el líder. El catálogo de prueba del líder es sintético. El autoinicio del operador utiliza un catálogo DEMO separado con habilitación del servidor. Ninguna de esas fuentes acredita una conexión a G21.

**Valor.** Operativamente organiza la tarea y evita confundir cero con pendiente. Administrativamente separa captura, revisión y supervisión y conserva decisiones. Para decisiones muestra avance, pendientes, diferencias y tiempos registrados. La comparación mide contra la referencia de asignación; no concilia movimientos del período ni genera una valoración económica de pérdidas.

**Evidencia:** [acciones](../src/modules/inventarios/operations/actions.ts), [panel operativo](../src/modules/inventarios/operations/OperationsPanel.tsx), [servicio](../src/modules/inventarios/operations/service.server.ts), [evidencias](../src/modules/inventarios/operations/evidence.actions.ts), [impresión](../src/modules/inventarios/operations/difference-print.server.ts).

### 4.5. Contenedores

**Objetivo y usuarios.** Registrar elementos reutilizables por código y descripción, consultar disponibilidad y retirarlos de circulación. La interfaz permite registro y reserva edición/baja visible a administración.

**Información y funcionamiento.** Maneja disponible, en uso y mantenimiento; la baja lógica cambia a mantenimiento y la consulta normal los excluye. Existe pantalla, formulario y acciones. Sin embargo, la tabla remota tiene RLS sin políticas: el cliente autenticado normal no dispone de acceso efectivo a sus filas. Se clasifica como **parcial**, no como una capacidad operativa comprobada.

**Valor condicionado.** Podría organizar activos reutilizables y apoyar decisiones sobre disponibilidad una vez resueltos permisos y validado el circuito. No existe trazabilidad de préstamos, responsables por movimiento o ubicación de cada contenedor.

**Evidencia:** [pantalla](../src/app/%28dashboard%29/inventarios/ContainersView.tsx), [acciones](../src/app/%28dashboard%29/inventarios/actions.ts) y metadatos de `public.contenedores` en el inventario.

### 4.6. Atención al cliente y programación de contenido

**Objetivo y usuarios.** Administración registra y analiza actividad por asesor y organiza tareas de contenido.

**Información y funcionamiento.** Mantiene asesores y etiquetas, cantidades diarias por categoría, total de clientes y observaciones. El total se toma de una etiqueta de clientes atendidos si existe o del sumatorio; esto requiere una definición empresarial para evitar contar varias veces una interacción. Un calendario asigna fecha, temática, cantidad requerida y cumplimiento de estados de WhatsApp. El cumplimiento se registra manualmente.

**Valor.** Operativamente ordena la captura diaria y los compromisos. Administrativamente permite comparar actividad declarada y revisar pendientes. Para decisiones ofrece gráficos y distribución por asesor/categoría. No captura mensajes, contactos individuales, oportunidades de venta o tiempos de conversación; no es una integración con WhatsApp Business ni un CRM completo.

**Evidencia:** [acciones](../src/app/%28dashboard%29/admin/atencion/actions.ts), [pantalla](../src/app/%28dashboard%29/admin/atencion/page.tsx).

### 4.7. Usuarios, permisos y catálogos

**Objetivo y usuarios.** Administración edita perfiles existentes, rol Admin/Operativo, estado activo/inactivo y módulos permitidos. También mantiene áreas, mesas y revisores por punto.

**Información y funcionamiento.** El inicio de sesión utiliza correo/contraseña. El perfil almacenado determina la navegación. La actualización de usuarios vuelve a exigir Admin activo en servidor. La función de alta de perfiles asigna Operativo sin módulos a cuentas nuevas de Auth; no se encontró una pantalla de alta de cuentas, recuperación de contraseña o gestión de MFA. La página de equipos de inventarios consulta relaciones existentes; no aprovisiona miembros.

**Valor.** Operativamente reduce inconsistencias de campos y organiza accesos visibles. Administrativamente permite mantener perfiles y catálogos desde el portal. Para decisiones aporta una vista del personal habilitado, aunque no sustituye una auditoría completa de permisos. Las políticas amplias de otros módulos limitan la efectividad del aislamiento que sugiere la interfaz.

**Evidencia:** [usuarios](../src/app/%28dashboard%29/admin/usuarios/actions.ts), [campos](../src/app/%28dashboard%29/admin/configuracion/actions.ts), [proxy](../src/utils/supabase/middleware.ts).

### 4.8. Portal e instalación

El portal reúne navegación por módulos, temas claro/oscuro, vistas adaptables y una PWA instalable. Su pantalla sin conexión informa al usuario; no conserva datos privados para trabajar offline. Esto facilita acceso desde navegador o acceso instalado, sujeto a conectividad y compatibilidad del dispositivo. No se verificaron hoy dispositivos físicos, cámara, lectores o impresoras. Evidencia: `src/components/layout`, `src/components/theme`, `src/app/manifest.ts`, `public/sw.js`.

## 5. Optimización de procesos empresariales

| Dimensión | Mecanismo concreto | Condición o límite |
|---|---|---|
| Productividad | Formularios, catálogos y búsquedas reutilizables | Medir tiempo real; no se cuantificó ahorro |
| Eficiencia operativa | Lista de rutas y tareas por estado/prioridad | Depende de actualización oportuna de los usuarios |
| Organización de información | Registros relacionados en una base común | Las facturas de rutas siguen siendo texto; no hay relación referencial completa entre ambos circuitos |
| Comunicación interna | Panel compartido y avisos internos de inventarios | No hay mensajería instantánea ni notificaciones externas |
| Control de actividades | Actor, estado, tiempos y auditoría de inventarios | Auditoría integral pendiente en los demás módulos |
| Automatización | Alertas de checklist, cálculo de avance y diferencias, actualización periódica | No se identificaron tareas de negocio programadas en segundo plano |
| Reducción de errores | Validaciones, cero explícito, claves idempotentes y versiones | Aplicación desigual entre módulos |
| Supervisión y resultados | Reportes de rutas, despachos, atención e inventarios | Requieren definiciones de KPI, filtros consistentes y exclusión de pruebas |
| Trazabilidad | Referencias de origen, historial de ticket y evidencias | Cuentas compartidas debilitan atribución individual |
| Crecimiento | Servicios y persistencia centralizados; separación por bodega en inventarios | No equivale a aislamiento multiempresa o capacidad de carga validada |

En inventarios, un proceso digital concreto es: definir alcance → asignar → contar → entregar → comparar → cerrar o devolver. En inspecciones: seleccionar vehículo → evaluar → registrar observación → consultar alerta → documentar resolución. Las etapas de despacho y mensajería siguen siendo circuitos relacionados por uso empresarial, no una única transacción automatizada de extremo a extremo.

## 6. Beneficios comerciales y empresariales

| Clase | Beneficio potencial | Funcionalidad habilitante | Cómo medirlo |
|---|---|---|---|
| Operativo | Menor tiempo de localización | Búsqueda de factura y detalle | Mediana de minutos para responder una consulta antes/después |
| Operativo | Distribución visible del trabajo | Asignación y monitor por bodega | Tareas pendientes, antigüedad y distribución por operador |
| Operativo | Menos conteos incompletos enviados | Validación de todos los productos | Intentos rechazados y devoluciones por incompletitud; requiere instrumentar intentos |
| Económico | Menos tiempo destinado a reprocesos | Reconteo motivado e historial | Horas de reproceso × costo por hora validado por la empresa |
| Económico | Mejor uso de recursos de reparto | Estados, rutas y tiempos registrados | Tiempo disponible/en ruta y carga de pedidos; validar calidad de registros |
| Administrativo | Seguimiento de novedades | Alertas y resolución | Número de pendientes y tiempo hasta `resolved_at` |
| Administrativo | Claridad de responsables | Perfiles, tickets y líderes | Porcentaje de tareas con responsable vigente y cuenta individual |
| Estratégico | Visibilidad de actividad | Gráficos por punto, asesor, conductor y bodega | Uso de reportes en reuniones y decisiones documentadas |
| Tecnológico | Continuidad del mantenimiento | TypeScript, lockfile, pruebas y documentación | Tiempo de incorporación, defectos y tiempo de recuperación |
| Tecnológico | Protección del conteo y sus evidencias | DTO ciego, RLS, control de versiones, Storage privado | Pruebas de acceso negativas y conflictos recuperados correctamente |

No se puede atribuir disminución de pérdidas de inventario solo a la existencia de una diferencia registrada. Es necesario investigar su causa, conciliar movimientos y valorar cantidades con datos financieros autorizados.

## 7. Comparativa antes y después

**El proceso tradicional de esta tabla es hipotético**, utilizado para explicar el cambio de trabajo; no es una reconstrucción confirmada de la historia de Landimotos.

| Aspecto | Proceso tradicional | Proceso con el software | Valor obtenido |
|---|---|---|---|
| Consulta de factura | Buscar mensajes o planillas | Buscar referencia y abrir detalle | Información organizada en una consulta |
| Disponibilidad de conductor | Preguntar individualmente | Consultar estado y ruta registrada | Visibilidad compartida con actualización periódica |
| Inspección | Registrar una novedad sin seguimiento uniforme | Checklist, alerta y comentario de resolución | Continuidad entre hallazgo y gestión |
| Asignación de conteo | Comunicar un alcance verbalmente | Ticket por bodega/categoría y operador | Responsabilidad y alcance explícitos |
| Captura de cantidad | Copiar una cantidad esperada en una hoja | Conteo ciego con cero diferenciado de pendiente | Registro físico más independiente |
| Revisión | Comparar archivos sin historial | Comparar referencia fija, justificar decisión y conservar eventos | Decisión consultable y reconteo controlado |
| Evidencias | Fotos en dispositivos o chats | Archivos privados vinculados al ticket | Consulta contextualizada por usuarios autorizados |
| Atención | Totales aislados por asesor | Registro diario y gráficos | Consolidación de actividad declarada |

## 8. Público objetivo

| Participante | Necesidad | Papel en adopción |
|---|---|---|
| Operario de despacho | Registrar documentos con campos consistentes | Usuario operativo; valida rapidez y facilidad |
| Coordinador de mensajería | Conocer salidas, retornos y disponibilidad | Usuario operativo/responsable del proceso |
| Conductor u operador de flota | Registrar inspección y novedades | Usuario operativo; requiere acceso y conectividad |
| Operador de bodega | Contar un alcance claro sin referencias visibles | Usuario operativo; valida trabajo móvil y cantidades |
| Líder de bodega | Asignar, revisar y documentar diferencias | Responsable funcional y patrocinador del piloto |
| Administración de operaciones | Consolidar pendientes y resultados | Responsable de compra o evaluación |
| Gerencia/propietario | Evaluar control, costo y continuidad | Responsable de decisión y presupuesto |
| Tecnología/soporte | Mantener acceso, datos y disponibilidad | Evaluador técnico y responsable de operación |

No se encontró segmentación comercial validada, entrevistas de mercado o estudio competitivo. La adaptación a otras empresas es una oportunidad propuesta, no un mercado demostrado.

## 9. Propuesta de valor y ventajas competitivas

**Propuesta principal:** reunir el seguimiento de distribución, flota y conteos por bodega en un portal que permita conocer responsables, pendientes y resultados registrados.

Cinco beneficios fundamentales:

1. Localización centralizada de registros operativos.
2. Visibilidad de disponibilidad y carga de trabajo.
3. Separación de captura y revisión en inventarios.
4. Soporte documental para novedades y diferencias.
5. Información estructurada para evaluar y mejorar procesos.

Los diferenciadores comprobables son su adaptación a puntos/bodegas, el conteo ciego, la referencia protegida, el cierre con diferencias explícitas y el control de conflictos. La decisión de adopción se justifica si esos procesos coinciden con la operación de la empresa y el piloto demuestra utilidad.

Limitan su comercialización los permisos amplios en módulos tradicionales, el entorno compartido, la cadena de instalación incompleta, la ausencia de integración ERP operativa, los reportes que requieren corrección y la falta de soporte/SLA y respaldo ensayado. No hay evidencia para declarar superioridad de precio, seguridad, rapidez o facilidad frente a otros productos.

## 10. Casos de uso comerciales

### Consultar una factura durante la operación

Un encargado necesita ubicar un documento. Abre Despachos, busca su referencia y consulta punto, revisión y detalle. Si se asignó envío, el circuito permite vincular mensajero y dirección. El resultado es una consulta del registro; no una prueba de recepción por el cliente. La búsqueda parcial devuelve la coincidencia más reciente y debe verificarse cuando existen referencias similares.

### Coordinar una salida y su retorno

Un operador consulta mensajeros disponibles, registra destino, pedidos, facturas y revisor y confirma la salida. Al regresar, finaliza la ruta; quedan horas y estado. El responsable puede revisar actividad finalizada. Las escrituras de ruta y mensajero requieren reforzar atomicidad para evitar estados inconsistentes ante errores.

### Dar seguimiento a una novedad del vehículo

Un operador registra checklist y marca una falla. El formulario exige observación; la aplicación intenta crear la alerta vinculada. Administración consulta el hallazgo y registra la resolución. El resultado esperado es un registro de gestión; debe comprobarse que la alerta se creó, ya que su fallo secundario actualmente puede no impedir el éxito del checklist.

### Contar una categoría y revisar diferencias

El líder importa un CSV con productos y referencia fija, selecciona alcance y operador. El operador cuenta sin ver la referencia y entrega cuando todos los productos tienen cantidad. El líder consulta faltantes/sobrantes, revisa evidencia y cierra con observación o devuelve para reconteo. El resultado es una decisión operativa trazable; el ERP no recibe ajustes.

### Ensayar el flujo sin atribuir saldos oficiales

En un entorno habilitado para DEMO, un operador elige categoría y filtros, confirma el alcance y realiza el mismo conteo. El líder practica la revisión. Las tareas quedan marcadas como prueba. El ensayo sirve para capacitación; sobre la base compartida debe controlarse su carga y excluirse de reportes reales. No se ejecutó este caso contra datos remotos durante la auditoría.

### Revisar actividad de atención

Administración registra totales por asesor/fecha, consulta gráficos y revisa compromisos del calendario. Obtiene una visión de actividad declarada. Para convertirla en medición de calidad o conversión comercial necesita datos adicionales de conversaciones, resultados y tiempos.

## 11. Indicadores y retorno potencial

### Disponibilidad de indicadores

| Indicador | Situación actual | Precaución o instrumentación necesaria |
|---|---|---|
| Facturas/pedidos registrados por período, punto, área y revisor | Consultas y gráficos implementados | Un registro puede contener varias referencias; revisar cancelados |
| Pedidos declarados en rutas finalizadas | Suma de `numero_pedidos` en reportes | No equivale a entrega confirmada por destinatario |
| Conductores disponibles/en ruta y rutas activas | Tarjetas y listas existentes | Información manual; pausa de consulta si no hay conexión |
| Checklists del día y alertas pendientes | Contadores existentes | Algunas consultas de estadísticas convierten error en cero |
| Tiempo de resolución de alertas | Fechas almacenadas | Requiere indicador derivado y control de calidad de fechas |
| Clientes atendidos y distribución por asesor | Registro y gráficos existentes | Definir si etiquetas son excluyentes; evitar duplicación |
| Cumplimiento del calendario de contenido | Estados registrados | Declaración manual, sin verificación en WhatsApp |
| Inventarios finalizados, revisados y con diferencias | Panel y reportes existentes | Excluir DEMO; distinguir conteo completo de cierre |
| Tiempo de ejecución y verificación | Cálculos a partir de fechas del ticket | Puede incluir esperas/reconteos; no mide horas laborales efectivas |
| Productividad por persona | Derivable parcialmente | Cuentas compartidas y distinta dificultad invalidan comparación directa |
| Errores, intentos fallidos y tiempo de respuesta | Sin tablero integral de negocio | Instrumentar eventos y latencias, sin registrar datos sensibles |
| Costo operativo y retorno | No implementados | Recoger costos de personal, infraestructura, soporte y adopción |

### Metodología de retorno

1. Elegir dos o tres procesos y definir inicio, final, volumen y unidad comparable.
2. Medir una línea base representativa: tiempos, errores, reprocesos y costos por actividad; conservar fuente y responsable.
3. Realizar un piloto con cuentas individuales, datos de prueba separados y procesos equivalentes. Registrar adopción y errores, además de tiempos.
4. Comparar por complejidad, turno y volumen. No atribuir al software cambios debidos a personal, demanda o reorganización.
5. Valorar horas efectivamente liberadas usando un costo acordado. Separar capacidad disponible de ahorro de caja realizado.
6. Incluir implementación, capacitación, conectividad, alojamiento, soporte, integración y mantenimiento en el costo total.
7. Calcular `ROI = (beneficio monetario validado − costo total) / costo total`, para el mismo período y solo si el costo es positivo. Calcular recuperación con flujos netos observados, no con porcentajes supuestos.

## 12. Discurso comercial

### Elevator pitch — aproximadamente 30 segundos

Landimotos reúne el seguimiento de despachos, mensajeros, vehículos e inventarios en un portal interno. Ayuda a conocer responsables, pendientes y resultados sin depender de registros dispersos. En inventarios separa el conteo del operador de la revisión del líder y conserva evidencias. La propuesta es validar su utilidad mediante un piloto medido, consolidar sus controles y después ampliar las integraciones que necesita la empresa.

### Presentación comercial — aproximadamente 2 minutos

Cuando una empresa distribuye productos, coordina conductores y administra varias bodegas, necesita saber qué está ocurriendo y quién debe actuar. La Intranet Landimotos organiza esa información en un mismo portal.

El equipo puede registrar referencias de facturas y consultar sus detalles, conocer la disponibilidad declarada de los mensajeros y registrar salidas, retornos y almuerzos. Las inspecciones de vehículos permiten conservar evaluaciones, kilometraje y novedades, con una lista de alertas para seguimiento administrativo. El módulo de atención reúne actividad diaria por asesor y organiza un calendario de compromisos de contenido.

En inventarios, el líder define el alcance y asigna al operador. Este cuenta sin ver las cantidades esperadas y entrega su trabajo. El líder revisa la comparación, consulta observaciones y fotografías y decide cerrar o devolver para un nuevo conteo. La administración puede observar avance y resultados sin intervenir en la captura del operador.

El beneficio esperado es una operación más visible y ordenada. Para demostrarlo, proponemos medir tiempos de consulta, tareas pendientes y reprocesos en un piloto. El sistema aún necesita consolidar permisos, instalación y validación de producción. La conexión con G21 es una siguiente etapa: hoy las referencias de conteo proceden de reportes manuales o pruebas identificadas. Así, la adopción puede avanzar con un alcance claro, resultados medibles y decisiones de inversión respaldadas por evidencia.

### Presentación ejecutiva — aproximadamente 5 minutos

La pregunta empresarial que atiende Landimotos es cómo dar continuidad a la información que se genera cada día entre despachos, conductores, vehículos y bodegas. Cada área registra actividades diferentes, pero la gerencia necesita comprender pendientes, responsables y resultados sin reconstruirlos desde múltiples conversaciones o archivos.

La intranet ofrece un punto común para ese seguimiento. En despachos se registran las referencias de factura, el punto de operación, el área y la revisión. En mensajería se conserva el destino de una ruta, su carga declarada, las horas de salida y regreso y el estado del conductor. En vehículos se registra la inspección, el kilometraje y las novedades, con un mecanismo para documentar su resolución. En atención se reúnen cantidades diarias y compromisos de contenido. Esto aporta una estructura compartida para consultar y supervisar el trabajo.

El proceso de inventarios merece una atención especial. Un conteo útil necesita algo más que una lista de números: requiere alcance, responsable, comparación y una decisión posterior. El líder selecciona bodega y categoría y puede cargar un reporte de productos. El operador recibe la tarea sin conocer las referencias esperadas, registra las cantidades físicas y entrega cuando el alcance está completo. El líder puede consultar diferencias, revisar evidencia y cerrar con una observación, o devolver la tarea para reconteo. Administración conserva una función de seguimiento.

Esta separación ayuda a distinguir tres situaciones que suelen mezclarse: haber contado, haber revisado y haber cerrado. El sistema también diferencia una cantidad cero de un dato pendiente y conserva un historial de acciones. Las fotografías quedan vinculadas al inventario y la impresión permite llevar las diferencias a una verificación física. Son capacidades concretas para mejorar la disciplina del proceso; no reemplazan la responsabilidad del personal ni una conciliación contable.

El alcance actual tiene límites que deben entrar en la decisión. G21 todavía no está integrado. Las comparaciones usan referencias fijas de reportes o datos identificados como prueba. No se envían ajustes al ERP ni se concilian movimientos posteriores. El calendario de WhatsApp organiza tareas, pero no envía mensajes. Las rutas se siguen mediante registros, sin ubicación GPS. La aplicación requiere conexión para operar.

La revisión técnica encontró una base de desarrollo que permite seguir avanzando, con pruebas automatizadas y controles específicos de inventario. También identificó prioridades: reforzar permisos de datos en otros módulos, separar los entornos de prueba y producción, reconciliar el historial de migraciones y validar los flujos completos con usuarios. Estas tareas deben formar parte del plan de consolidación y de su presupuesto.

La recomendación de negocio es realizar un piloto con objetivos concretos. Podemos medir cuánto tarda una consulta de factura, cuánto permanece pendiente una tarea, cuántos conteos regresan a revisión y cuánto tiempo se dedica a reprocesos. Para comparar resultados necesitamos una línea base, procesos equivalentes y cuentas individuales. También deben incluirse costos de capacitación, soporte, infraestructura y mantenimiento. Solo después corresponde afirmar un ahorro o calcular retorno.

Para gerencia, la oportunidad consiste en disponer de una herramienta ajustada a su operación y de información más organizada para dirigirla. La decisión inmediata es consolidar un alcance confiable y medir su adopción. Con esa evidencia se podrá decidir si conviene ampliar la integración con G21, extenderla a más áreas o preparar una oferta para otras empresas. El crecimiento debe responder a resultados comprobados y a una operación de soporte sostenible.

## 13. Potencial comercial y evolución

| Horizonte | Acción propuesta | Criterio para avanzar |
|---|---|---|
| Consolidar el producto interno | Revisar permisos, atomicidad, reportes y contenedores; separar pruebas | Matriz de acceso y flujos críticos aprobados en entorno aislado |
| Hacer reproducible la entrega | Reconciliar migraciones, documentar configuración y automatizar calidad | Instalación desde cero y recuperación ensayadas |
| Validar valor | Piloto con responsables, cuentas individuales y KPI acordados | Evidencia de uso, calidad de datos y efecto operativo |
| Integrar G21 | Confirmar contratos, catálogos, unidades, saldos, movimientos e idempotencia | Pruebas de contrato y conciliación con datos autorizados |
| Escalar el uso | Medir consultas, paginar en servidor, definir monitoreo y capacidad | Pruebas de carga y objetivos de respuesta/recuperación aceptados |
| Comercializar | Parametrización de marca/procesos, aislamiento por cliente, soporte, costos y condiciones de servicio | Oferta y capacidad operativa verificadas, no solo una demostración |

Como integraciones futuras pueden evaluarse un proveedor autorizado de WhatsApp, recordatorios de vencimientos, un sistema empresarial de identidades y herramientas analíticas. No están implementadas. Su conveniencia depende de volumen, costo, disponibilidad de API y necesidades del usuario.

Los principales desafíos de adopción son conectividad, disciplina de registro, capacitación, resistencia a cambiar hábitos y definición de responsables. Si se mantienen cuentas compartidas, el historial identifica una cuenta y no necesariamente una persona. Una implantación gradual, acompañada de medición y soporte, permite evaluar la solución sin atribuirle resultados que todavía no se han demostrado.
