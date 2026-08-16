# @verifactu-js/qr

**URL de cotejo y especificación del código QR tributario VERI\*FACTU (AEAT).**
Cero dependencias en runtime. Isomórfico.

```bash
npm i @verifactu-js/qr
```

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
que ha decodificado** ([`scripts/probe-qr-encoding.mjs`](../../scripts/probe-qr-encoding.mjs),
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
se manifiesta como «Factura no encontrada» al cotejar. Ver `docs/spec-notes.md` §17.

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

## Qué NO incluye todavía

**No rasteriza el símbolo QR.** Este paquete construye y valida la URL; para dibujarla usa
cualquier codificador (`qrcode`, `qr-creator`…) con nivel de corrección `M`. El render a SVG y
PNG está pendiente.

## Aviso legal

Herramienta técnica. El SIF que exige la norma es la aplicación completa que la integra, no esta
librería, y la declaración responsable la firma quien distribuye el producto final. Se ofrece
«tal cual», sin garantía de conformidad fiscal.

## Licencia

MIT.
