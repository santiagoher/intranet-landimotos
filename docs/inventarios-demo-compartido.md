# DEMO en la base actual — habilitación local aplicada

El usuario solicitó continuar usando el proyecto Supabase actual en lugar de crear staging. Proyecto: `loajbvlgpsxrkfzyxbui`. La preparación anterior exclusiva de staging se conserva; esta propuesta es una habilitación distinta y explícita.

**Estado: APLICADO el 22 de octubre de 2026**, después de la autorización explícita del usuario para trabajar en la base actual intentando preservar producción. Se instalaron las dos migraciones indicadas abajo, se cargaron 30 categorías y 60 productos DEMO y se habilitó exclusivamente el servidor local mediante una clave privada adicional. No se desplegó Vercel ni se cambiaron sus variables. No se conectó G21.

La activación general fue rechazada por la revisión automática porque también habría permitido solicitudes desde otros clientes. Se sustituyó por una protección adicional en PostgreSQL: el marcador habilitado no basta; cada solicitud DEMO necesita la clave privada del servidor local y la sesión y permisos normales del usuario.

## Alcance exacto

Migraciones aplicadas, con versiones confirmadas en el historial remoto:

- `supabase/migrations/20261022174353_inventarios_demo_compartido.sql`: esquema compatible con la estructura desplegada, sin aplicar los borradores anteriores de prioridades/autoinicio.
- `supabase/migrations/20261022174907_inventarios_demo_servidor_local.sql`: exige la clave privada local, conserva únicamente su hash SHA-256 y rechaza las solicitudes sin clave o con una incorrecta.
- `supabase/migrations/20261022195318_inventarios_demo_filtros.sql`: clasificación de los productos DEMO y creación por subcategoría/marca. Ver [filtros del operador](inventarios-filtros-operador.md).

- Agregar `puede_autoiniciar` a las membresías actuales, sin cambiar sus roles, usuarios ni relaciones de bodega; la creación también exige el permiso del módulo, perfil/bodega activos y habilitación privada DEMO.
- Agregar origen y creador al ticket, vinculando el creador con `perfiles`; los tickets anteriores conservan los valores existentes y quedan con esos campos nuevos nulos.
- Agregar unidad y códigos de barras a los productos contados, y ampliar su RPC de lectura para devolver esos metadatos sin saldos.
- Permitir notificaciones por ticket de categoría sin sesión ERP y agregar la relación directa ticket/bodega, conservando la relación anterior de sesiones.
- Agregar tablas privadas de configuración DEMO, bodegas autorizadas, productos sintéticos y procedencia de tickets. Todas tienen RLS y acceso directo revocado para clientes.
- Ampliar las restricciones de origen de categorías para aceptar `demo`, conservando las condiciones de Excel y G21.
- Agregar los tres RPC DEMO de contexto, catálogo ciego y creación, con permisos autenticados y validación de rol/bodega dentro de las funciones privadas.
- Agregar triggers de prevención de duplicados, avisos al líder, protección del origen DEMO y bloqueo de cierre oficial sin conciliación. La comprobación de duplicados separa `es_prueba` para no reservar un alcance real por un inventario de prueba.
- No instalar ni revocar el RPC genérico `inventario_autoiniciar`; no habilitar una ruta alternativa de creación oficial pendiente de G21.

La migración **no** carga datos ni activa la creación. No modifica prioridades históricas, cantidades contadas, evidencias, auditoría existente, perfiles, políticas RLS existentes ni las cuatro funciones corregidas con PT409. El instalador anterior de staging NO debe ejecutarse aquí y los borradores antiguos no deben aplicarse encima de esta migración.

## Carga y activación realizadas

1. BODEGA 1, 2, 3, 4, 21 y 22: cinco categorías con prefijo `DEMO /` y diez productos por bodega, **30 categorías y 60 productos sintéticos** en total. Se verificaron operador y líder activos en cada bodega.
2. Las **793 categorías anteriores se conservaron**; ahora hay 823 en total. Los productos DEMO están en tablas privadas distintas de `inventario_productos`, que continúa sin productos ERP cargados. Sus referencias simuladas son exclusivamente para probar comparación y cierre, nunca saldos G21.
3. El marcador privado y esas seis bodegas quedaron habilitados con la condición adicional de la clave privada. No se crearon tickets durante la carga; los futuros tickets requieren confirmación del operador.
4. `.env.development.local`, excluido de Git, contiene `APP_ENV=development`, el destino compartido explícito, el host coincidente, fuente `demo`, `INVENTORY_SELF_START_ENABLED=true` y una clave aleatoria `INVENTORY_DEMO_SERVER_KEY` exclusiva del servidor. No copiar esta clave a una variable `NEXT_PUBLIC_`, al navegador ni a Vercel. Las guardas siguen rechazando `VERCEL_ENV=production` y `APP_ENV=production`.

El servidor agrega `x-inventory-demo-key` únicamente a los RPC DEMO y a la revisión del líder cuando la configuración local está habilitada. PostgreSQL compara su hash y después siguen vigentes los controles de usuario, rol y bodega. Una llamada directa desde el cliente de producción, sin esta clave, no puede habilitar DEMO.

Para probar: reiniciar `npm run dev`, entrar como operador autorizado y abrir **Inventarios → Nuevo inventario** (`/inventarios`). El líder revisa el ticket desde su panel local y administración conserva el seguimiento. Para detener nuevas creaciones, establecer `INVENTORY_SELF_START_ENABLED=false` y reiniciar. Un propietario de la base también puede desactivar `inventario_private.demo_entorno.enabled`; esto bloquea además la verificación/cierre DEMO y debe coordinarse con las pruebas en curso. No borrar registros históricos para deshabilitar la función.

Los operadores y líderes actuales podrán usar sus mismas relaciones autorizadas. No se crean usuarios globales ni se cambian contraseñas. No se envían correos ni comunicaciones externas: únicamente notificaciones internas por ticket.

## Riesgo y controles

Es el mismo servidor de producción: el aislamiento es lógico, no un ambiente independiente. Los tickets DEMO tendrán distintivo y las consultas existentes pueden incluirlos en sus totales; los reportes ya disponen de filtro de prueba. Las modificaciones de tablas/triggers/funciones pueden afectar el flujo si aparece una incompatibilidad no detectada. La migración es transaccional, con límite de espera de bloqueo de 2 segundos y de sentencia de 20 segundos; un fallo revierte el conjunto. No se ejecutará un `db push` general ni se tocarán datos históricos para forzar compatibilidad.

## Verificación realizada

- Prueba PostgreSQL aislada con la misma cadena de migraciones instalada en producción, omitiendo los dos borradores no desplegados.
- Un ticket histórico sintético con prioridad `urgente` conserva todos sus valores tras la migración; políticas RLS y definiciones PT409 permanecen idénticas.
- Ciclo DEMO completo: permisos, categorías por bodega, DTO ciego, idempotencia, auditoría inicial única, notificaciones, cero/vacío, PT409, entrega, devolución y cierre por el líder.
- TypeScript y pruebas de configuración: el proyecto compartido necesita autorización explícita de servidor y nunca queda habilitado por esa autorización en Vercel Production.
- Comparación remota antes/después: los 8 tickets, el hash de sus valores anteriores, los productos contados, los 65 eventos de auditoría, los perfiles, las políticas RLS existentes y las cuatro funciones PT409 permanecen iguales.
- Se verificaron las relaciones del catálogo, permisos de RPC y ausencia de acceso directo de clientes a las tablas privadas. La configuración final no permite acceso DEMO sin la clave de servidor.
- Evidencia sin datos personales ni claves: `docs/sql/inventarios-demo-compartido-aplicado.json` contiene la comparación antes/después. `inventarios-demo-compartido-antes.json` conserva la referencia de la preparación anterior.
- 79 pruebas de aplicación, TypeScript y ESLint del módulo aprobados. El ciclo completo con roles, clave correcta/incorrecta y conservación de datos se probó en PostgreSQL aislado; no se creó un ticket real para probarlo en producción. Falta que el usuario complete una prueba con su sesión local tras reiniciar.
- El asesor de seguridad mantiene avisos anteriores en funciones de autenticación y protección de contraseñas; no se modificaron esas configuraciones ajenas a este alcance. Las tablas DEMO privadas tienen RLS sin políticas de cliente intencionalmente: se consultan mediante funciones controladas.

## Integración G21 posterior

La base ya dispone de tablas relacionadas para productos, códigos, sesiones, saldos, conteos, diferencias, ajustes, auditoría y sincronizaciones. Esta entrega prepara el flujo propio del operador sin poblarlas con un catálogo ERP supuesto. Para conectar G21 aún se necesita validar el contrato de endpoints, identificadores, unidades, movimientos, captura consistente de saldos y conciliación. Los inventarios DEMO no se convierten en registros oficiales al conectar la API.
