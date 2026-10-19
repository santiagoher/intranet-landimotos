# Sidebar y limpieza visual — segunda fase

Se conserva el diseño y el sistema de temas de la primera fase. Los cambios se limitan a navegación, encabezados y presentación de indicadores.

## Organización según las funcionalidades existentes

| Grupo | Opción | Destino real | Visibilidad |
| --- | --- | --- | --- |
| Operaciones | Despachos → Registros | `/despachos` | Admin y Operativo con acceso; gestión operativa y consulta completa de facturas del mes, filtros, detalles y paginación. |
| Operaciones | Despachos → Reportes | `/despachos#reportes` | Admin; pantalla completa Análisis de Operaciones, con gráficas y filtros/exportación. |
| Operaciones | Mensajeros → Registros | `/mensajeros` | Admin y Operativo con acceso al módulo; disponibilidad, rutas en curso e Historial de Rutas completo del día, con sus acciones y detalles existentes. |
| Operaciones | Mensajeros → Reportes | `/mensajeros#reportes` | Admin; cuatro indicadores de disponibilidad, dashboard analítico, búsqueda por factura y filtros/exportación. |
| Operaciones | Inspecciones Preoperacionales | `/vehiculos` | Mismo permiso existente. |
| Administración | Gestión administrativa → Atención al Cliente | `/admin/atencion` | Según el filtro de enlaces existente. |
| Administración | Gestión administrativa → Conductores | `/admin/mensajeros` | Según el filtro de enlaces existente. |
| Administración | Gestión administrativa → Usuarios | `/admin/usuarios` | Según el filtro de enlaces existente. |
| Administración | Gestión administrativa → Campos | `/admin/configuracion` | Según el filtro de enlaces existente. |

No se añadieron rutas ni reportes administrativos ficticios. Los grupos vacíos no se muestran. La agrupación recibe los enlaces después del filtro de permisos original; tampoco sustituye las validaciones de acceso de cada pantalla.

Los enlaces de Despachos y Mensajeros usan navegación nativa a la ruta o fragmento para admitir acceso directo, recarga y retorno a Registros. Las direcciones base que antes abrían Vista general ahora muestran Registros, sin necesitar redirecciones ni nuevas rutas de servidor. Los enlaces antiguos con `#registros` conservan la misma pantalla operativa completa y desplazan a la tabla de facturas o al historial de rutas cuando termina de montarse después de la comprobación del rol. `#reportes` selecciona el dashboard de Admin. El diálogo de filtros se abre desde Reportes y cerrarlo conserva ese panel.

Ambos módulos reutilizan `NavigationGroup`, con expansión independiente, los mismos iconos, estilos y animaciones. Admin ve únicamente Registros y Reportes, en ese orden. Operativo accede a Registros de sus módulos permitidos; Reportes mantiene su acceso exclusivo de Admin. El enlace activo también se reconoce al entrar mediante los fragmentos antiguos.

## Separación de registros y reportes

- `DespachosPage` reúne la operación y el historial en Registros. Reutiliza `OrderForm`, `ShipmentForm` y `OrderDetailsModal` con sus callbacks y permisos existentes. `DespachosRecordsTable` muestra una sola tabla paginada con todos los pedidos devueltos por `getPedidos()`, incluidos pendientes, enviados y entregados. La búsqueda y los filtros por punto/estado operan sobre esos datos, sin consultas adicionales. Se conserva el alcance mensual y la exclusión de cancelados del servicio.
- `DespachosAdminStats` se monta únicamente en Reportes. Conserva las gráficas anuales, por período, áreas, revisores y horas, los filtros por punto y fechas, búsqueda y exportación. No se consultan facturas/envíos adicionales para montar esta vista.
- `MensajerosPage` reúne la tabla de disponibilidad, las rutas en curso y el historial completo del día en secciones de Registros. Mantiene los controles de almuerzo y los formularios originales. `MensajerosReports` contiene el dashboard analítico existente sin cambiar sus cálculos, filtros, búsquedas o exportación. `MensajerosSummary` contiene las cuatro tarjetas originales, con el mismo diseño y expresiones de conteo, exclusivamente en Reportes.
- `useMensajerosData` es la única carga compartida para disponibilidad, historial y tarjetas. Mantiene el polling de 30 segundos también en Reportes, sin crear otra suscripción ni otro temporizador para los indicadores. Los paneles analíticos consultan sus estadísticas sólo cuando se abre Reportes.
- Los errores de carga se muestran con una acción Reintentar. Las gráficas no aparecen en Registros; los reportes no se montan para roles sin ese acceso.

Operaciones es la primera sección visible. Se retiraron del sidebar el encabezado Principal y el acceso Dashboard Operativo, sin conservar un espacio vacío. El dashboard analítico sigue disponible para Admin en Mensajeros → Reportes, con sus componentes, indicadores y reportes intactos.

Registros reutiliza una única tabla de historial y un diálogo de detalle compartido con las rutas activas. Se muestran todas las rutas devueltas por `getFinishedRoutes()`, sin el antiguo límite de cinco: rutas finalizadas creadas desde el inicio del día, ordenadas por llegada descendente. Se conserva ese alcance diario; no se agregan consultas ni rutas nuevas.

## Recuperación de la disponibilidad de Mensajeros

Se reutiliza la rama operativa original de `MensajerosPage`: tabla de conductores, tarjetas de rutas en curso, `RouteForm`, `RouteDetailsModal` y controles de almuerzo. Admin consulta la disponibilidad; las acciones de asignar/finalizar rutas y registrar almuerzos mantienen la visibilidad que tenían para Operativo.

- El resumen de Reportes cuenta todos los conductores devueltos por `getMensajeros()`, los estados exactos `disponible` y `en_ruta`, y las rutas devueltas por `getActiveRoutes()`. El servicio continúa excluyendo los conductores eliminados. Estas tarjetas no se renderizan en Registros.
- La tabla muestra todos los estados recibidos, incluidos `en_almuerzo` e `inactivo`, con búsqueda por nombre/placa y filtro de estado. La asociación con destinos y horarios usa `mensajero_id`; no se deduce ni se sobrescribe un estado a partir de una ruta.
- `useMensajerosData` extrae la carga original de la página y reutiliza los mismos cinco servicios: conductores, rutas activas, configuraciones, rutas finalizadas e historial de almuerzos. Ningún servicio, consulta, estado oficial o tabla de la base de datos fue modificado.
- La actualización posterior a asignar/finalizar rutas o salir/volver del almuerzo continúa llamando al mismo refresco de datos. Se agrega polling cada 30 segundos mientras la pestaña está visible, refresco al recuperar foco/visibilidad y botón Actualizar. No es una suscripción de Supabase Realtime.
- El polling omite solicitudes si ya hay otra en curso. Las recargas posteriores a acciones tienen prioridad: una respuesta antigua no puede sobrescribir datos más recientes. Los errores conservan los últimos datos y muestran su hora de actualización; durante la primera carga los indicadores no presentan ceros ficticios.
- La carga compartida se pausa sin permiso. En Reportes también alimenta las cuatro tarjetas; las estadísticas analíticas se solicitan únicamente cuando Admin abre esa vista. Los temporizadores y listeners se limpian al salir.

La verificación de la integración original incluyó renderizado con datos de prueba aislados para ambos roles, conteos y estados oficiales, relación conductor/ruta e historial. Se comprobaron también refresco posterior a acciones, polling/foco, pausa en pestañas ocultas, errores/recuperación y rechazo de respuestas antiguas. La simplificación posterior conserva el mismo hook de actualización, los servicios y los callbacks operativos. Estas comprobaciones no modifican datos reales.

## Interacción y apariencia

- Submenús con altura y opacidad animadas mediante CSS Grid durante 220 ms; chevron con rotación de la misma duración.
- Botones semánticos con `aria-expanded` y `aria-controls`, activación con Enter/Espacio y navegación con Tab.
- Enlaces ocultos con `inert` y `aria-hidden`, excluidos del recorrido de foco móvil.
- El grupo padre revela automáticamente el destino activo al navegar. Puede contraerse manualmente mientras se permanece en ese destino.
- Se respeta la regla global existente de `prefers-reduced-motion`.
- Colores y superficies usan los tokens existentes de ambos temas; no se cambia el modo claro predeterminado.
- Se retiraron iconos decorativos de encabezados, conservando los iconos de acciones, estados de acceso, navegación y marca.
- Las tarjetas de pedidos entregados, facturas gestionadas y total de rutas priorizan etiqueta y cifra. Las expresiones de datos y cálculos se conservan.
- El indicador Unicode de duración de ruta se sustituyó por el icono `Clock` de Lucide.

## Archivos de esta fase

Nuevos:

- `src/components/layout/SidebarNavigation.tsx`: grupos, submenús, destinos activos y animación.
- `src/components/layout/useNavigationHash.ts`: sincronización de fragmentos y visibilidad del diálogo de reportes.
- `src/components/layout/NavigationSection.tsx`: destino de navegación disponible después de la carga del rol.
- `docs/sidebar-refinement.md`: documentación de esta fase.

Modificados:

- `src/components/layout/Sidebar.tsx`: integra los grupos sobre los enlaces ya filtrados.
- `src/app/(dashboard)/despachos/page.tsx`: destino de registros y limpieza del encabezado.
- `src/app/(dashboard)/despachos/DespachosAdminStats.tsx`: acceso directo al diálogo existente de reportes y título sin icono.
- `src/app/(dashboard)/mensajeros/page.tsx`: tarjetas, encabezados, icono de duración y navegación del diálogo de reportes.
- `src/app/(dashboard)/admin/atencion/page.tsx`: encabezados sin iconos decorativos.
- `src/app/(dashboard)/admin/configuracion/page.tsx`: encabezado de listado sin icono.
- `src/app/(dashboard)/admin/mensajeros/page.tsx`: título principal sin icono.
- `src/app/(dashboard)/admin/usuarios/page.tsx`: título principal sin icono.
- `src/app/(dashboard)/inventarios/page.tsx`: título principal sin icono.
- `src/app/(dashboard)/vehiculos/page.tsx`: títulos y encabezados sin iconos decorativos.
- `src/app/(dashboard)/vehiculos/AlertResolutionModal.tsx`: encabezado de detalle sin icono decorativo.

## Validación

Simplificación a dos opciones: compilación de producción y TypeScript correctos; renderizado aislado de Registros/Reportes para Admin y Operativo, compatibilidad con `#registros`, historial completo junto a disponibilidad, una sola tabla de facturas, filtros por búsqueda/punto/estado, detalle y enlace activo verificados. La comparación de ESLint no añadió hallazgos: persisten 12 preexistentes en las dos páginas; navegación y tabla de facturas no tienen errores ni advertencias. Se modificaron solamente `SidebarNavigation.tsx`, las páginas de Despachos y Mensajeros, `DespachosRecordsTable.tsx` y este documento. Los servicios, formularios, reportes, hook de actualización y temas se compararon con el estado anterior y permanecen intactos.

Comprobaciones de las fases anteriores:

- Compilación de producción correcta; respuesta HTTP de login y estilos generados de submenús/movimiento reducido verificados.
- TypeScript y ESLint de los componentes de navegación nuevos/modificados.
- Comparación de ESLint con el estado previo a esta fase: sin avisos nuevos; se mantienen errores preexistentes en las pantallas existentes.
- 256 combinaciones de rol y enlaces: sin destinos adicionales ni pérdida de rutas permitidas.
- Renderizado de navegación para verificar los destinos activos, expansión de grupos, controles accesibles y clases de animación, con Operaciones como primera sección y un único enlace activo.
- Comprobaciones de acceso directo a reportes, apertura/cierre, preservación de parámetros y estado de Next.js, evento Atrás y protección ante callbacks de una pantalla que ya no está activa.
- Comparación con la primera fase de funciones de métricas, consultas, exportación, carga de facturas, permisos, cierre de sesión y archivos de servicios/autenticación: sin cambios.

No hubo navegador conectado disponible. Queda pendiente la revisión visual de las transiciones, ambos temas y tamaños de pantalla, además de recorrer los flujos con sesiones reales de Admin y Operativo.

Para revisar, abrir Despachos, desplegar/contraer el grupo, entrar a Registros y Reportes, cerrar el diálogo y usar Atrás. Repetir con el menú móvil y con navegación por teclado. En Admin, comprobar también Mensajeros → Registros y Gestión administrativa.

Para el ajuste de Mensajeros, repetir la expansión y contracción de ambos módulos por separado. En Admin, comprobar Registros y Reportes; en Operativo con permiso de Mensajeros, Registros con disponibilidad, rutas e historial en una sola página. Probar también la entrada directa por URL a los fragmentos permitidos, el detalle de una ruta y el retorno a `/mensajeros`.
