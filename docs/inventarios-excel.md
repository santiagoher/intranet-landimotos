# Fuente temporal de Inventarios

Se integró el archivo entregado por el usuario para consulta histórica y control por categoría. El original está en `data/inventarios/ORGANIGRANA BODEGAS.xlsx`, fuera de `public`. No se modificó su contenido ni se insertaron datos en Supabase.

## Información importada

| Hoja | Registros históricos | Categorías únicas en la bodega |
|---|---:|---:|
| BODEGA 1 | 3 | 13 |
| BODEGA 2 | 1 | 265 |
| BODEGA 3 | 38 | 248 |
| BODEGA 4 | 48 | 59 |
| BODEGA 21 | 84 | 154 |
| BODEGA 22 | 10 | 54 |
| Total | 184 | 793 |

Las categorías se agrupan únicamente por nombre exacto normalizado en espacios y mayúsculas, dentro de cada hoja. No se combinan sinónimos como CADENILLA/CADENILLAS ni bodegas distintas. Se conservan las filas de origen, nombres de responsables y valores originales.

La tabla dinámica de BODEGA 1 no es un catálogo: se excluye del control. Los resultados cacheados de fórmulas y gráficos del Excel no son fuente de indicadores; se recalcula el último inventario desde las filas históricas A:H. Algunas listas de control son más largas que los rangos considerados por los resúmenes del archivo, por lo que los indicadores pueden diferir.

Las fechas se interpretan con el sistema de fechas declarado en el libro. El control utiliza días calendario de Bogotá: menos de 10 al día, 10–30 por realizar, más de 30 crítico; ausencia de fecha significa sin inventario y fecha futura exige revisión.

Los blancos no son cero. No se suman totales de categorías como existencias. El usuario corrigió dos cantidades físicas de BODEGA 22: LUBRICANTES GRAV, celda C8, de 8806000 a **1998 unidades**; MANIGUETAS, celda C10, de 4289000 a **4617 unidades**. La vista muestra los valores corregidos y su indicación; el Excel y el JSON original se conservan intactos. Las correcciones solo se aplican si coinciden hoja, fila, categoría y valor anterior, para no sobrescribir datos distintos en una reimportación. COMANDOS y otros valores no se modificaron.

## Vistas y acceso

- `/inventarios/registros`: historial del Excel, filtro por bodega, categoría, responsable y fechas; paginación y fila de origen.
- `/inventarios/reportes`: control por categoría y filtro por estado; acceso al mismo historial.
- La fuente temporal es una consulta administrativa de importación, disponible solo para un perfil activo `Admin` con acceso al módulo, comprobado en servidor. No concede permisos operativos sobre bodegas de G21.
- Los operadores y líderes mantienen sus permisos existentes y sus pantallas originales. No se enlazan nombres del Excel a usuarios ni números de hojas a códigos ERP.
- El JSON original se importa únicamente desde un módulo `server-only`; el servidor entrega los datos normalizados después de autorizar.

## Reimportar

Desde la raíz del proyecto:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/import-inventario-excel.ps1
```

La salida `src/modules/inventarios/local/excel-source.json` conserva SHA-256 del original y coordenadas de filas. La lectura del XLSX usa ZIP/XML, no ejecuta fórmulas ni macros. Los cambios de estructura del archivo requieren revisión del importador antes de reemplazar el conjunto de datos.

## Verificación y próximos pasos

Pasaron las cuatro pruebas de la fuente temporal y las cinco pruebas de autorización existentes; TypeScript y ESLint de los archivos modificados pasaron. La compilación completa se intentó, pero Windows bloqueó el reemplazo de un archivo existente en `.next/static` con `EPERM`. No se declara una compilación de producción exitosa ni una verificación visual en navegador.

Este Excel no contiene SKU, unidades base por producto, movimientos ni una fotografía consistente de saldos. Se necesita un catálogo plano adicional con esos campos para probar conteos por producto antes de conectar G21. También falta confirmar las cuentas reales de los responsables. Asignaciones, captura, verificación, aprobación y sus comandos transaccionales continúan pendientes: la consulta histórica no sustituye esos flujos.
