# Intranet Landimotos — Resumen ejecutivo

**Fecha de auditoría:** 29 de octubre de 2026, America/Bogota.  
**Alcance:** árbol de trabajo local, documentación previa y metadatos del proyecto Supabase coincidente con la conexión local. No se modificaron código, configuración, usuarios ni datos. El árbol contiene cambios anteriores a esta auditoría; no equivale necesariamente a la versión publicada.

## 1. Qué es el software

Intranet Landimotos es una aplicación web interna para coordinar despachos, mensajeros, inspecciones de vehículos, seguimiento de atención al cliente e inventarios por bodega. Reúne registros, responsables, estados y reportes en una interfaz con acceso por perfil. Es un desarrollo adaptado a una organización; no se identificó una plataforma SaaS multiempresa con contratación, cobro o aprovisionamiento de clientes.

El nombre funcional utiliza «v2.1», mientras que `package.json` declara versión `0.1.0`; conviene establecer una versión de entrega única.

## 2. Problema principal

La solución aborda la dispersión de información operativa: facturas registradas por punto, disponibilidad de conductores, novedades de vehículos y avance de conteos. La necesidad de centralización se desprende de los módulos existentes. No se hizo una investigación de campo que permita afirmar cómo se trabajaba antes o cuánto costaban esos procesos.

## 3. Solución proporcionada

Los operadores registran actividades; los responsables consultan estados y resultados. En inventarios existe una separación más precisa: el líder asigna y revisa, el operador cuenta sin ver cantidades de referencia y la administración supervisa. Las decisiones de revisión quedan asociadas a un ticket y a eventos de auditoría. Comparar un conteo con un reporte manual no actualiza existencias ni constituye conciliación con movimientos del ERP.

## 4. Público objetivo

Su ajuste más directo es una empresa de distribución con puntos de despacho, conductores y varias bodegas. Usuarios: personal operativo, líderes de bodega y administradores. Compradores potenciales: responsables de operaciones o tecnología. Decisores: gerencia y propietarios. La expansión a otras empresas exige parametrización, revisión de seguridad y una entrega reproducible antes de ofrecerla como servicio comercial.

## 5. Funcionalidades principales

| Área | Capacidad encontrada | Límite relevante |
|---|---|---|
| Despachos | Registro de referencias de facturas, asignación de envío, búsqueda, consulta mensual y reportes CSV | No emite facturas fiscales ni acredita entrega al destinatario |
| Mensajería | Conductores, rutas, salida/llegada, almuerzos, disponibilidad, documentos y reportes | Seguimiento por registros; no geolocalización ni optimización de recorridos |
| Vehículos | Catálogo, checklist, kilometraje, novedades, alertas y resolución | No se encontró bloqueo de creación de ruta por ausencia de checklist |
| Atención | Totales diarios por asesor/etiqueta y calendario de estados de WhatsApp | Captura manual; sin integración de conversaciones ni publicación automática |
| Inventarios | Asignación por categoría, importación CSV, conteo ciego, revisión/devolución, evidencias, historial y diferencias imprimibles | Referencia fija de reporte o prueba; integración G21 pendiente |
| Inventarios DEMO | Autoinicio por operador con filtros de subcategoría/marca | Experimental; habilitación especial del servidor de desarrollo sobre base compartida |
| Contenedores | Formularios y acciones de registro/estado | RLS habilitado sin políticas en la base consultada: operación ordinaria bloqueada |
| Administración | Edición de perfiles, roles, módulos y catálogos de campos | Gestión de miembros de inventarios es de consulta; RPC de modificación revocada |
| Experiencia | Temas claro/oscuro, navegación adaptable, instalación PWA | Sin captura ni consulta privada offline |

## 6. Beneficios empresariales

La centralización puede reducir consultas dispersas y facilita supervisar pendientes. El registro de responsables y tiempos ayuda a organizar cargas de trabajo. Los conteos ciegos, las referencias separadas y la revisión por otro rol favorecen un control de inventario más consistente. Los reportes y la impresión de diferencias apoyan reuniones operativas y verificación física.

Son beneficios potenciales fundamentados en capacidades concretas, no resultados económicos medidos. Deben evaluarse con tiempos de proceso, errores, reprocesos, pendientes y uso efectivo. Las cuentas compartidas mencionadas en antecedentes limitan la atribución individual de actividades; no se inspeccionaron registros personales para verificar su uso actual.

## 7. Diferenciadores sustentados

La combinación de distribución, flota y conteos por bodega en un mismo portal responde al contexto de Landimotos. El subsistema de inventarios incorpora cantidades decimales exactas, control de versiones para conflictos, idempotencia de asignaciones, auditoría y fotografías privadas procesadas en servidor. Esto diferencia su diseño interno; no demuestra superioridad frente a productos competidores.

## 8. Arquitectura resumida

Aplicación Next.js 16.2.4 con React 19.2.4 y TypeScript, estilos Tailwind CSS 4.2.4, componentes de servidor y cliente y Server Actions. Supabase proporciona autenticación, PostgreSQL 17 y Storage. La lógica operativa tradicional vive principalmente en acciones de servidor; inventarios combina servicios TypeScript con funciones transaccionales de PostgreSQL, permisos por bodega y RLS.

Se identificaron **15 páginas, un Route Handler propio, 36 tablas públicas y 6 tablas privadas de inventarios**. La existencia de tablas no significa que todos sus procesos estén disponibles en la interfaz.

## 9. Integraciones

Supabase está conectado y sus metadatos se consultaron en lectura. El histórico Excel se conserva con trazabilidad de archivo/filas; su normalización produce seis bodegas, 184 registros y 793 categorías. El CSV de productos es otra fuente, utilizada por el líder para asignar conteos. Vercel Analytics y Speed Insights están incorporados en el layout; su recepción de datos y la configuración del alojamiento no se comprobaron. El adaptador G21 devuelve explícitamente integración pendiente.

## 10. Estado actual y validación

Hay una implementación funcional amplia, con diferente madurez entre módulos. Durante esta auditoría:

- **95 pruebas Node aprobaron**, en 11 archivos, con datos locales o transporte simulado.
- **TypeScript aprobó** con `--noEmit --incremental false`.
- **ESLint falló:** 51 errores y 8 advertencias; buena parte corresponde a scripts CommonJS y otra parte a tipos/advertencias de componentes.
- El control de entorno detectó que desarrollo utiliza la base declarada como producción.
- Se consultaron tablas, restricciones, políticas, grants, funciones, triggers, índices, buckets, migraciones y asesores de Supabase. No se ejecutaron operaciones del negocio ni pruebas de escritura remota.

No se repitió un build, una prueba de navegador autenticada, una prueba de carga ni las suites SQL que dependen de PGlite externo. Los resultados históricos se conservan como antecedentes, no como pruebas ejecutadas hoy.

## 11. Limitaciones y riesgos principales

1. **Permisos de datos:** pedidos, mensajeros y rutas tienen políticas amplias para cualquier autenticado. Almuerzos tiene políticas públicas y grants a `anon`. Ocultar módulos en el menú no restringe por sí mismo la Data API. Esta combinación se comprobó en metadatos; no se hizo una prueba HTTP de acceso anónimo.
2. **Entornos e historial de esquema:** hay 17 migraciones locales y 14 entradas remotas, con tres archivos sin entrada equivalente y dos versiones distintas para nombres coincidentes. No corresponde ejecutar toda la carpeta de migraciones indiscriminadamente.
3. **Operaciones parciales:** varios flujos tradicionales hacen escrituras consecutivas sin transacción; algunas respuestas secundarias se ignoran. Puede quedar un envío o ruta registrado sin su estado asociado actualizado.
4. **Alcance comercial:** faltan validación integral de producción, operación de soporte, respaldo/restauración ensayados, instrumentación de costos y preparación multiempresa.
5. **Integración pendiente:** sin G21 no hay existencias oficiales, conciliación de movimientos ni envío de ajustes. Los datos DEMO deben excluirse de indicadores reales.

## 12. Evolución prioritaria

Primero, acordar y aplicar una matriz de autorización en la base y en las acciones, resolver contenedores y separar el entorno cotidiano de pruebas. Después, reconciliar el historial de migraciones, completar controles de calidad y validar los flujos con usuarios y datos de prueba. Corregir operaciones no atómicas, reportes y límites de carga. Finalmente, integrar G21 con contratos verificados y medir beneficios antes de decidir comercialización o expansión.

## 13. Conclusión ejecutiva

Landimotos dispone de una base útil para gestionar operaciones internas y de un subsistema de inventarios con controles de negocio especialmente desarrollados. La recomendación es consolidarlo como solución interna verificable y preparar un piloto medido. La evidencia disponible no permite presentarlo como SaaS listo para venta, sistema integrado al ERP o plataforma con seguridad y disponibilidad certificadas.

**Documentos de apoyo:** [documentación comercial](DOCUMENTACION_COMERCIAL.md), [documentación técnica](DOCUMENTACION_TECNICA.md) e [inventario verificable](INVENTARIO_PROYECTO.md). Las referencias detalladas del código y de las consultas están en los dos últimos documentos.
