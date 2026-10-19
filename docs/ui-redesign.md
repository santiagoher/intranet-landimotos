# Rediseño visual de Landimotos Operativo

## Resultado

Tema claro predeterminado, sidebar compacto con navegación neutra, cuenta al pie, encabezado de página sin barra superior permanente en escritorio y tablas con bordes suaves. El menú móvil conserva las mismas rutas y reglas de visibilidad. La cuenta utiliza nombre, correo y rol de la sesión existente.

El menú de usuario incluye información de cuenta, apariencia y cierre de sesión. No agrega una página de edición de perfil ni acciones que no existían.

## Apariencia

- Abre el bloque del usuario al pie del sidebar y selecciona **Claro** u **Oscuro**.
- La preferencia se guarda en `localStorage`, clave `landimotos-theme`, y se sincroniza entre pestañas del mismo origen.
- Sin preferencia guardada, se usa claro aunque el sistema operativo esté en oscuro.
- Un script en el `<head>` aplica la preferencia antes de mostrar el contenido. Si el navegador bloquea el almacenamiento, el cambio sigue funcionando durante la sesión.
- Los tokens de superficies, texto, bordes, estados y acento viven en `src/app/globals.css`. Los gráficos Canvas resuelven estos tokens mediante `useChartColors`; los gráficos SVG usan variables CSS.
- La pantalla offline de la PWA conserva la misma preferencia. Se incrementó su caché a `landimotos-pwa-v2`.

## Archivos principales

| Archivo | Cambio |
| --- | --- |
| `src/app/globals.css` | Tokens de ambos temas, tipografía, foco, botones, badges y tabla. |
| `src/app/layout.tsx` | Inicialización y sincronización del tema. |
| `src/components/theme/ThemeScript.tsx` | Aplicación inicial antes de mostrar la página. |
| `src/components/theme/ThemeSync.tsx` | Sincronización global y color del navegador. |
| `src/components/theme/useTheme.ts` | Preferencia persistente y colores de gráficos. |
| `src/app/(dashboard)/layout.tsx` | Layout compacto, traslado de datos de cuenta, enlace para saltar al contenido. |
| `src/components/layout/Sidebar.tsx` | Navegación, apertura móvil, manejo de foco y cuenta al pie. |
| `src/components/layout/Navbar.tsx` | Acceso al menú solo en móvil/tablet. |
| `src/components/layout/UserMenu.tsx` | Cuenta real, selección de apariencia y cierre de sesión existente. |
| `src/components/TablePagination.tsx` | Controles neutros, objetivos táctiles y página actual accesible. |
| `src/components/Modal.tsx` | Diálogo nativo con foco contenido, Escape y devolución del foco. |
| `src/app/(dashboard)/despachos/page.tsx` | Encabezado, tabla, badges, estado vacío y acciones. |
| `src/app/(dashboard)/despachos/OrderForm.tsx` | Apariencia, etiquetas accesibles y contenedor modal. |
| `src/app/(dashboard)/despachos/OrderDetailsModal.tsx` | Apariencia y detalle adaptable a pantallas pequeñas. |
| `src/app/(dashboard)/despachos/ShipmentForm.tsx` | Apariencia y contenedor modal. |
| `src/app/manifest.ts` | Fondo y color inicial de la PWA claros. |
| `public/offline.html` | Apariencia clara/oscura sin conexión. |
| `public/sw.js` | Nueva versión de caché para actualizar la pantalla offline. |

Se adaptaron los colores de estos componentes existentes para que respondan al tema, conservando sus consultas y flujos:

- `src/app/(auth)/login/page.tsx`
- `src/app/(dashboard)/GlobalAdminStats.tsx`
- `src/app/(dashboard)/despachos/DespachosAdminStats.tsx`
- `src/app/(dashboard)/admin/atencion/page.tsx`
- `src/app/(dashboard)/admin/configuracion/page.tsx`
- `src/app/(dashboard)/admin/mensajeros/page.tsx`
- `src/app/(dashboard)/admin/usuarios/page.tsx`
- `src/app/(dashboard)/admin/usuarios/UserEditModal.tsx`
- `src/app/(dashboard)/inventarios/page.tsx`
- `src/app/(dashboard)/inventarios/ContainerForm.tsx`
- `src/app/(dashboard)/mensajeros/page.tsx`
- `src/app/(dashboard)/mensajeros/MessengerForm.tsx`
- `src/app/(dashboard)/mensajeros/RouteForm.tsx`
- `src/app/(dashboard)/mensajeros/RouteDetailsModal.tsx`
- `src/app/(dashboard)/vehiculos/page.tsx`
- `src/app/(dashboard)/vehiculos/VehicleForm.tsx`
- `src/app/(dashboard)/vehiculos/VehicleStats.tsx`
- `src/app/(dashboard)/vehiculos/ChecklistForm.tsx`
- `src/app/(dashboard)/vehiculos/ChecklistDetailsModal.tsx`
- `src/app/(dashboard)/vehiculos/AlertResolutionModal.tsx`

## Verificaciones

- Compilación de producción y comprobación de TypeScript.
- Comprobaciones HTTP de login, script inicial del tema dentro del `<head>`, CSS generado, redirección de una ruta protegida sin sesión y recursos públicos de la PWA.
- ESLint de los componentes nuevos y del layout compartido sin errores. La comparación con HEAD de las pantallas modificadas no añadió avisos: esas pantallas ya tenían 93 errores de lint y conservan 91; no se modificó lógica ajena al rediseño para resolverlos.
- Comprobación de inicialización del tema con preferencia clara, oscura, ausente, inválida y almacenamiento bloqueado.
- Contraste de los tokens de texto y badges de al menos 4.5:1 sobre sus superficies en ambos temas. Esto no sustituye una auditoría de accesibilidad de toda la aplicación.
- Comparación de esquemas y funciones de registro de facturas, envío, carga de opciones, permisos del sidebar, cierre de sesión y paginación con la versión anterior.
- Sin cambios en archivos de acciones, servicios, base de datos, middleware, autenticación o hook de roles. Sin dependencias nuevas.

## Revisión manual pendiente

No hubo un navegador conectado disponible durante la implementación. Se requiere revisar las pantallas con sesiones reales de Admin y Operativo:

1. Abrir con `npm run dev` y comprobar escritorio, tablet y móvil (por ejemplo 1440, 1024, 768 y 390 px).
2. Verificar que solo se muestran los módulos permitidos y que las columnas y acciones de cada tabla se conservan.
3. Cambiar apariencia, recargar, abrir otra pestaña y comprobar que se conserva la selección. Probar una sesión sin preferencia con el sistema operativo oscuro: debe comenzar clara.
4. Abrir/cerrar el sidebar móvil con el botón y Escape; recorrerlo con Tab. Verificar que el contenido de fondo no recibe el foco mientras está abierto.
5. Abrir registro y detalle de factura; revisar scroll del modal, campos, foco, Escape y retorno al botón de origen. Comprobar los flujos operativos habituales en un entorno de pruebas.
6. Revisar tablas extensas, gráficos, badges y mensajes de validación en ambos temas.
7. Para la PWA, usar `npm run build` y `npm start`, comprobar la actualización del worker y la pantalla offline después de una visita con conexión.

El cambio no se ha publicado ni se han creado registros operativos de prueba.
