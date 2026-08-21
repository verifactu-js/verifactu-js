# @verifactu-js/qr

Las versiones siguen [semver](https://semver.org/lang/es/). Mientras el paquete esté en `0.x`, un
cambio incompatible sube la versión menor.

## Sin publicar

- `validarParametrosQR` devolvía **2005** («El importe tiene un formato incorrecto») cuando el
  importe traía más de dos decimales. La AEAT devuelve **2006** («excede el número máximo de
  caracteres»): trata los decimales de más como un problema de longitud, no de forma. Medido
  contra el servicio de cotejo el 19/08/2026. Si el código de error no coincide con el que daría
  la AEAT, el mapa de errores deja de servir para diagnosticar.
- Documentado, con la medición: un decimal vale, cero decimales también, y el importe negativo de
  una rectificativa viaja tal cual. Y que **el cotejo normaliza el importe mientras que la huella
  no**, así que encontrar la factura no demuestra que la huella esté bien.

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
