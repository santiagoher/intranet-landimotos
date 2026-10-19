# PWA de Landimotos

La intranet incluye un manifiesto, iconos de instalación, metadatos para Apple y un service worker sin dependencias adicionales.

## Probar e instalar

1. Ejecuta `npm run build` y `npm start`.
2. Abre `http://localhost:3000` o el sitio publicado con HTTPS. El service worker se registra solo en producción.
3. En Chrome/Edge, usa la opción de instalar aplicación del navegador cuando esté disponible. En iPhone/iPad, abre el sitio en Safari y selecciona Compartir → Agregar a pantalla de inicio.
4. En DevTools → Application, comprueba el manifiesto, los iconos y que `/sw.js` esté activado.
5. Después de una primera visita con conexión y la activación del worker, activa Offline en DevTools y recarga la página: debe aparecer «No hay conexión». Desactiva Offline y pulsa «Volver a intentar».
6. Comprueba el inicio y cierre de sesión desde la aplicación instalada.

Las direcciones HTTP de la red local (por ejemplo, una IP del equipo) requieren HTTPS para probar el service worker desde un teléfono.

## Alcance

Solo se guarda `/offline.html` en Cache Storage. Las páginas privadas, consultas y operaciones no se almacenan en el service worker. No se pueden guardar cambios ni consultar datos sin conexión. Los fallos en consultas dentro de una pantalla ya abierta mantienen el manejo de errores existente; la pantalla offline aparece al navegar o recargar sin red.

El manifiesto, los iconos, el worker y la pantalla offline son públicos para permitir instalación antes de iniciar sesión. El acceso a las demás rutas conserva su autenticación.

## Mantenimiento

- Incrementa la versión de `CACHE_NAME` en `public/sw.js` cada vez que cambies `public/offline.html`.
- Los iconos usan el símbolo de paquete del portal. El original está en `public/icons/icon.svg`; al sustituirlos, conserva los tamaños PNG de 192, 512 y 180 píxeles y el margen seguro del icono maskable.
- Las notificaciones push y la sincronización de cambios sin conexión no están implementadas.
