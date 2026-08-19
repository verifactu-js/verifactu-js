# @verifactu-js/qr

Las versiones siguen [semver](https://semver.org/lang/es/). Mientras el paquete esté en `0.x`, un
cambio incompatible sube la versión menor.

## 0.1.1 — 2026-08-19

- `author` en el `package.json`. Sin él, la página de npm no decía quién ha escrito esto.
  No cambia nada del código: es una versión de metadatos.

## 0.1.0 — 2026-08-17

Primera versión.

- `buildQrUrl()` y `buildCotejoUrl()` para la URL de cotejo, verificable y no verificable, en
  producción y en pruebas.
- **La codificación, medida contra el servicio real.** La documentación de la AEAT dice «URL
  encoding» y su ejemplo usa `java.net.URLEncoder`, que es *form-urlencoded*; eso no coincide con
  `encodeURIComponent` en `espacio ! ' ( ) ~`. Seis peticiones espaciadas contra preproducción
  dejaron claro que el servicio decodifica `application/x-www-form-urlencoded` — y que
  `encodeURIComponent` **es correcto**, porque escapa `+` a `%2B`. El peligro nunca fue usarlo:
  era concatenar sin codificar.
- `validarParametrosQR()` con los códigos de error del art. 20, y los literales y constantes del
  art. 21 (tamaño, nivel de corrección, margen y textos).
- Cero dependencias en runtime. El rasterizado a PNG o SVG es opcional y va aparte.
