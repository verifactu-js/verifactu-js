# verifactu-js

**Toolkit TypeScript para VERI\*FACTU (AEAT).** Huella encadenada, QR de cotejo, XML y SOAP.
Núcleo sin dependencias en runtime e isomórfico.

> Si la huella que calculas está mal, la AEAT **no te rechaza el registro**. Lo acepta, lo
> almacena, y lo marca como «Aceptado con errores». Tu sistema parece funcionar.
> Este proyecto existe por eso.

| Paquete | Estado | Qué hace |
|---|---|---|
| [`@verifactu-js/core`](packages/core) | `0.1.0` preestreno | Huella SHA-256, encadenado, `verifyChain`, fechas con huso, validación de NIF |
| [`@verifactu-js/qr`](packages/qr) | pendiente de nombre | URL de cotejo, validación, literales del art. 20, constantes del art. 21 |
| `@verifactu-js/xml` | no empezado | Serialización al esquema oficial + envoltorio SOAP |
| `@verifactu-js/client` | no empezado | SOAP con mTLS, cola de `TiempoEsperaEnvio`, mapa de errores |

---

## Lo que nadie más ha publicado

### 1. Una huella mal calculada no produce rechazo

*Especificaciones técnicas para generación de la huella*, v0.1.2, §7:

> «Cuando en una remisión de un sistema «VERI\*FACTU» la huella informada no coincida con el
> cálculo realizado por la AEAT, el registro de facturación se marcará como
> “Aceptado con errores”.»

El envío devuelve `Correcto` a nivel global. El registro queda almacenado. El problema solo
aparece mirando el estado por línea, o cuando llega una inspección.

**Consecuencia:** un smoke test contra preproducción que «funciona» no demuestra nada. Lo único
que demuestra corrección son los vectores. `@verifactu-js/core` se valida contra los **tres
vectores oficiales** de la AEAT más uno de terceros reproducido de forma independiente.

### 2. La codificación del QR, medida contra el servicio real

La documentación de la AEAT dice «siguiendo los estándares generales de las aplicaciones en
entorno web («URL encoding»)» y su ejemplo de referencia usa `java.net.URLEncoder`, que es
*form-urlencoded*. Eso **no** coincide con `encodeURIComponent` en `espacio ! ' ( ) ~`. El único
ejemplo oficial con carácter especial (`&` → `%26`) no discrimina entre las dos.

Así que lo medimos. El servicio de cotejo, con `formato=json`, **devuelve el `numserie` que ha
decodificado**: es un oráculo. Seis peticiones espaciadas contra preproducción
([`scripts/probe-qr-encoding.mjs`](scripts/probe-qr-encoding.mjs), 16/08/2026):

| Enviado como `numserie=` | Devuelto | Conclusión |
|---|---|---|
| `A%20B` | `A B` | `%20` se decodifica como espacio |
| **`A+B`** | **`A B`** | **un `+` sin escapar se lee como ESPACIO** |
| `A%2BB` | `A+B` | `%2B` se conserva como `+` literal |
| `A~B` | `A~B` | pass-through |
| `A%7EB` | `A~B` | pass-through |
| `A(B)'C` | `A(B)'C` | pass-through |

**El servicio decodifica `application/x-www-form-urlencoded`.**

Y aquí está el matiz que importa, porque es contraintuitivo: la conclusión **no** es «hay que
codificar como Java». Es que `encodeURIComponent` **es correcto**, porque escapa `+` a `%2B`. El
peligro nunca fue usarlo; era concatenar sin codificar:

```js
`...?numserie=${serie}`                      // ❌ una serie "A+B" llega a la AEAT como "A B"
`...?numserie=${encodeURIComponent(serie)}`  // ✅
```

Y esto **no lo detecta nadie**, porque [el QR no lleva la huella](docs/spec-notes.md#79-la-huella-no-va-en-el-qr)
— a diferencia de TicketBAI. Un error de codificación se manifiesta únicamente como
«Factura no encontrada» al cotejar, meses después.

Detalle completo en [`docs/spec-notes.md`](docs/spec-notes.md) §17.

### 3. Canarias no es la Península en ningún momento del año

`FechaHoraHusoGenRegistro` lleva el huso «que está usando el sistema informático de facturación
en el momento de generación». Eso depende del instante:

| Zona | Enero | Julio |
|---|---|---|
| `Atlantic/Canary` | `+00:00` | `+01:00` |
| `Europe/Madrid` | `+01:00` | `+02:00` |

Por eso `timeZone` es obligatorio y no hay valor por defecto. Un valor peninsular estaría mal
todo el año para un SIF canario, con una huella coherente con el error.

Ah, y el camino por defecto de JavaScript es el prohibido:

```js
new Date().toISOString(); // '2024-01-15T12:00:00.000Z'  ← designador Z Y fracciones de segundo
```

---

## La especificación, citada

[`docs/spec-notes.md`](docs/spec-notes.md) es el contrato interno del proyecto: **cada afirmación
técnica lleva cita textual, documento, versión y fecha de consulta**. Incluye:

- Las cadenas exactas de la huella para alta y anulación, con los vectores verificados.
- Ocho discrepancias detectadas entre fuentes oficiales, y cuál gana en cada caso.
- 27 incógnitas clasificadas por qué bloquean (`BLOQUEA-ESTABLE`, `BLOQUEA-FASE-N`, `ABIERTA`),
  cada una con su `TODO(verify: I-XX)` en el código.
- Los ocho endpoints SOAP, incluida la variante por certificado de sello que nadie modela.
- La trampa de los namespaces: se descargan de `…/tikeV1.0/…` pero declaran `…/tike/…`.

Las fuentes oficiales están descargadas en [`docs/reference/`](docs/reference/).

## Estado

**Preestreno. No se ha validado todavía ningún envío real contra la AEAT.** Quedan incógnitas de
casos borde sin confirmar en fuente oficial que impiden declarar `0.1.0` estable; están todas
listadas en `spec-notes.md` §11 y resumidas en el README de cada paquete.

## Desarrollo

```bash
pnpm install
pnpm test          # 282 tests
pnpm test:coverage # umbrales al 95%
pnpm typecheck
pnpm lint
pnpm build
pnpm probe:qr      # sonda contra el servicio de cotejo (6 peticiones, no lo conviertas en un fuzzer)
```

Requiere [gitleaks](https://github.com/gitleaks/gitleaks) para commitear: el hook de pre-commit
escanea el stage y **bloquea**, no avisa. Un certificado cualificado filtrado no se parchea, se
revoca.

## Aviso legal

Estas librerías son **herramientas técnicas** que ayudan a generar registros conformes al
Real Decreto 1007/2023. No son, por sí solas, un sistema de facturación.

- El **Sistema Informático de Facturación (SIF)** que exige la norma es la aplicación completa
  que las integra, no la librería.
- La **declaración responsable** que el reglamento exige al productor del software la firma
  **quien distribuye el producto final**, no el mantenedor de estas librerías.
- Se ofrecen **«tal cual», sin garantía de conformidad fiscal**. El usuario debe validar su
  propia implementación y consultar con un asesor fiscal.

## Licencia

MIT.
