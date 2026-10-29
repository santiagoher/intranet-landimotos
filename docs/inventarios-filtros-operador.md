# Filtros de Nuevo inventario

Aplicado el 22 de octubre de 2026. Ruta del operador: `/inventarios` → Nuevo inventario.

Después de elegir la bodega autorizada, el operador selecciona una categoría y puede reducir el grupo mediante **Subcategoría** y **Marca**. Los dos filtros son opcionales: “Todas las subcategorías” y “Todas las marcas” incluyen la categoría completa. También se puede filtrar solo por marca, sin elegir una subcategoría concreta.

- Las opciones se obtienen del catálogo de esa categoría y bodega. Las marcas corresponden a la subcategoría elegida.
- Al cambiar categoría se limpian ambos filtros; al cambiar subcategoría se limpia marca. “Quitar filtros” vuelve a la categoría completa.
- El contador, la tabla y el resumen de confirmación corresponden exactamente a los productos que se crearán. No se pueden enviar grupos vacíos.
- No se muestran cantidades esperadas ni se rellenan conteos. Cada cantidad sigue siendo digitada por el operador.
- El contexto del operador solo incluye su propia membresía: no encontrar al líder en esa lista no bloquea el botón ni se interpreta como ausencia de responsable. La base valida y asigna al líder durante la creación. Si realmente no hay uno activo, rechaza la operación sin crear el ticket.
- La primera confirmación fija el alcance y la clave idempotente. Los reintentos conservan filtros e identificadores para evitar tickets duplicados.

## Persistencia y permisos

Migración aplicada: `supabase/migrations/20261022195318_inventarios_demo_filtros.sql`.

Añade clasificación de subcategoría y marca a los 60 productos del catálogo privado DEMO, sin agregar productos, categorías ni tickets. Las clasificaciones y las dos marcas tienen nombres explícitos de prueba; no representan información de G21.

El catálogo ciego devuelve esos metadatos sin referencias de cantidades. El RPC `inventario_demo_autoiniciar_filtrado` valida los filtros contra la base y exige que los identificadores recibidos coincidan exactamente con el grupo resultante. Los productos del ticket se copian desde la base, no desde nombres ni cantidades enviados por el navegador.

El RPC anterior de categoría completa conserva su firma y delega en la misma implementación privada. El alcance se conserva en `inventario_private.demo_tickets` y en el contexto del único evento de creación, visible en el historial del líder. Continúan la clave privada del servidor local, los permisos por bodega y el bloqueo existente de inventarios activos sobre una misma categoría; este cambio no permite abrir en paralelo alcances de una categoría ya ocupada.

## Verificación

- PostgreSQL aislado: categoría completa y grupo filtrado, rechazo de IDs ajenos/duplicados y filtros inexistentes, roles, clave privada, idempotencia, un solo evento inicial, conteo ciego y ciclo de revisión existente.
- Formulario real con acciones simuladas: selección y reinicio de filtros, marcas dependientes, envío del grupo seleccionado, reintento con la misma clave y temas claro/oscuro en 390, 768 y 1280 px.
- TypeScript y ESLint de los archivos modificados aprobados.
- Comparación remota antes/después: tickets, conteos anteriores, historial, perfiles, categorías, RLS y funciones PT409 conservados. Ver `docs/sql/inventarios-demo-filtros-verificacion.json`.
- No se desplegó Vercel ni se conectó G21. La prueba del formulario usa acciones simuladas; no se crearon tickets de prueba en la base compartida durante la validación.

La integración futura de G21 debe proporcionar las clasificaciones reales y sus identificadores. No convertir automáticamente las etiquetas DEMO en categorías o marcas oficiales.
