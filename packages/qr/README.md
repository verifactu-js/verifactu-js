# @verifactu-js/qr

**URL de cotejo y especificación del código QR tributario VERI\*FACTU (AEAT).**
Cero dependencias en runtime. Isomórfico.

> **Para rasterizar el símbolo hace falta instalar `qrcode` aparte.** Es una `peerDependency`
> **opcional**: sin ella tienes la URL de cotejo, la validación, los literales del art. 20 y las
> constantes del art. 21 — todo lo que exige criterio. Con ella, además, `renderSvg()` y
> `renderPngDataUrl()`. Si la llamas sin tenerla, el error dice exactamente eso y cómo
> arreglarlo.

```bash
npm i @verifactu-js/qr          # URL, validación, literales
npm i @verifactu-js/qr qrcode   # …y además SVG/PNG
```

No reimplementamos un codificador QR a propósito: Reed-Solomon y la selección de máscara son
sutiles, y un símbolo que escanea en un lector y no en otro es un mal fallo del que ser dueño.
Tampoco hay nada que diferenciar ahí. El valor de este paquete está en la URL, que está medida
contra el servicio real de la AEAT.

```ts
import { buildQrUrl, textosFactura } from '@verifactu-js/qr';

const url = buildQrUrl(
  { nif: '89890001K', numserie: '12345678-G33', fecha: '01-09-2024', importe: '241.40' },
  { entorno: 'produccion', modo: 'verificable' },
);

const { encima, debajo } = textosFactura('verificable');
// encima: 'QR tributario:'
// debajo: 'Factura verificable en la sede electrónica de la AEAT'
```

---

## La codificación está medida, no supuesta

La documentación de la AEAT dice «siguiendo los estándares generales de las aplicaciones en
entorno web («URL encoding»)», y su ejemplo de referencia usa `java.net.URLEncoder`, que es
*form-urlencoded* y no coincide con `encodeURIComponent` en `espacio ! ' ( ) ~`.

Lo medimos contra el servicio real, aprovechando que con `formato=json` **devuelve el `numserie`
que ha decodificado**
([`scripts/probe-qr-encoding.mjs`](https://github.com/verifactu-js/verifactu-js/blob/main/scripts/probe-qr-encoding.mjs),
16/08/2026):

| Enviado | Devuelto | |
|---|---|---|
| `A%20B` | `A B` | espacio como `%20` ✅ |
| `A+B` | `A B` | **`+` crudo se lee como espacio** ⚠️ |
| `A%2BB` | `A+B` | `+` escapado se conserva ✅ |
| `A~B` | `A~B` | pass-through ✅ |
| `A(B)'C` | `A(B)'C` | pass-through ✅ |

**Conclusión: `encodeURIComponent` es correcto**, porque escapa `+` a `%2B`. El peligro nunca
fue usarlo: era concatenar sin codificar.

```ts
`...?numserie=${serie}`                        // ❌ un "+" se convierte en espacio
`...?numserie=${encodeURIComponent(serie)}`    // ✅
```

Y esto no lo detecta nadie: **el QR no lleva la huella**, así que un error de codificación solo
se manifiesta como «Factura no encontrada» al cotejar. Ver
[`docs/spec-notes.md`](https://github.com/verifactu-js/verifactu-js/blob/main/docs/spec-notes.md) §17.

## Falla en tu máquina, no en la factura impresa

`buildQrUrl` valida los cuatro parámetros contra las reglas del servicio antes de construir
nada, y lanza si los rechazaría. `validarParametrosQR` hace lo mismo sin lanzar, devolviendo los
**códigos de error de la propia AEAT** (`1001`–`1004`, `2001`–`2006`).

## Qué incluye

- Las **cuatro URL base** (verificable / no verificable × producción / pruebas).
- Los cuatro parámetros obligatorios, en orden, correctamente codificados.
- `buildCotejoUrl` para consultar el servicio con `idioma` y `formato=json`.
  `buildQrUrl` **no admite `formato`**: «este parámetro nunca podrá incorporarse en la «URL» que
  va en el código «QR» de la factura».
- Los literales exactos: `QR tributario:`, `Factura verificable en la sede electrónica de la AEAT`,
  `VERI*FACTU`.
- Las constantes físicas del art. 21: tamaño 30–40 mm, nivel de corrección **M**,
  ISO/IEC 18004:2015, margen mínimo 2 mm (recomendado 6 mm).

## Rasterización

Con `qrcode` instalado:

```ts
import { buildQrUrl, renderSvg, renderPngDataUrl, isRenderAvailable } from '@verifactu-js/qr';

const url = buildQrUrl(params, { entorno: 'produccion', modo: 'verificable' });

const svg = await renderSvg(url);                       // string SVG
const png = await renderPngDataUrl(url, { width: 512 }); // data:image/png;base64,...
```

**El nivel de corrección de errores está fijado a `M` y no es configurable.** El artículo 21.1
lo impone: «Para la generación del código «QR» se empleará el nivel M (medio) de corrección de
errores». Subirlo a Q o H produce una factura no conforme, y no hay motivo legítimo para
quererlo.

SVG es lo razonable para una factura: el símbolo se imprime a un tamaño físico de 30×30 a 40×40 mm
y el vector sobrevive al DPI que use tu pipeline de PDF.

Sobre el margen: la Orden expresa la zona de silencio en **milímetros** (mínimo 2, recomendado 6),
que es una propiedad del resultado impreso, no del bitmap. El valor por defecto son 4 módulos —el
mínimo del estándar—, que a 30–40 mm de ancho cae en torno a 2–3 mm. Para los 6 mm recomendados,
añade el hueco en la maquetación en vez de inflar el símbolo.

Si no la tienes instalada:

```
QrRenderDependencyError: Para rasterizar el código QR hace falta el paquete «qrcode», que es
una dependencia opcional de @verifactu-js/qr y no está instalada.

  code: 'QRCODE_NO_INSTALADO'
  accionSugerida: Instálalo:  npm i qrcode
                  Si solo necesitas la URL de cotejo, la validación o los literales de la
                  factura, no hace falta: buildQrUrl, validarParametrosQR y textosFactura
                  funcionan sin ella.
```

`isRenderAvailable()` lo comprueba sin lanzar, por si quieres degradar con elegancia.

## Aviso legal

Herramienta técnica. El SIF que exige la norma es la aplicación completa que la integra, no esta
librería, y la declaración responsable la firma quien distribuye el producto final. Se ofrece
«tal cual», sin garantía de conformidad fiscal.

## Licencia

MIT.
