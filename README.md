# verifactu-js

**Toolkit TypeScript para VERI\*FACTU (AEAT).** Huella encadenada, QR de cotejo, XML y SOAP.
Núcleo sin dependencias en runtime e isomórfico.

> Si la huella que calculas está mal, la AEAT **no te rechaza el registro**. Lo acepta, lo
> almacena, y lo marca como «Aceptado con errores». Tu sistema parece funcionar.
> Este proyecto existe por eso.

| Paquete | Versión | Qué hace |
|---|---|---|
| [`@verifactu-js/core`](https://www.npmjs.com/package/@verifactu-js/core) | `0.2.0` | Huella SHA-256, encadenado, `verifyChain`, fechas con huso, validación de NIF |
| [`@verifactu-js/qr`](https://www.npmjs.com/package/@verifactu-js/qr) | `0.1.0` | URL de cotejo, validación, literales del art. 20, constantes del art. 21 |
| [`@verifactu-js/xml`](https://www.npmjs.com/package/@verifactu-js/xml) | `0.1.0` | Serialización al esquema oficial, envoltorio SOAP y lectura de la respuesta |
| [`@verifactu-js/validation`](https://www.npmjs.com/package/@verifactu-js/validation) | `0.1.0` | Validaciones de negocio de la AEAT, cada regla citada y versionada |
| `@verifactu-js/client` | en curso | Envío con mTLS, cola de `TiempoEsperaEnvio`, mapa de errores |

Los cuatro publicados son **isomórficos y sin dependencias de terceros**. `client` no lo será:
necesita un socket TLS con certificado cliente, y eso no existe igual en todas partes.

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
- Diecisiete discrepancias detectadas entre fuentes oficiales, y cuál gana en cada caso: desde
  el XSD que admite lo que las validaciones prohíben hasta el mismo bloque viajando bajo tres
  prefijos de namespace distintos.
- 28 incógnitas clasificadas por qué bloquean (`BLOQUEA-ESTABLE`, `BLOQUEA-FASE-N`, `ABIERTA`),
  cada una con su `TODO(verify: I-XX)` en el código.
- Los ocho endpoints SOAP, incluida la variante por certificado de sello que nadie modela.
- La trampa de los namespaces: se descargan de `…/tikeV1.0/…` pero declaran `…/tike/…`.

Las fuentes oficiales están descargadas en [`docs/reference/`](docs/reference/).

## Estado por fases

| Fase | Qué es | Estado |
|---|---|---|
| 0 | Investigación: fuentes oficiales, vectores, discrepancias | ✅ cerrada |
| 1 | `core`: huella, cadena, fechas | ✅ publicada |
| 1b | `qr`: URL de cotejo, medida contra el servicio real | ✅ publicada |
| 2 | `xml` + `validation`: esquema oficial, SOAP, respuesta, reglas de negocio | ✅ publicada |
| 3 | `client`: envío con mTLS y sondas contra preproducción | 🔧 en curso |
| 4 | Consulta, eventos | no empezada |
| 5 | XAdES para el flujo no VERI\*FACTU | no empezada |

**No se ha validado todavía ningún envío real contra la AEAT.** Eso es la fase 3, y es lo que
convierte varias incógnitas de `spec-notes.md` §11 en hechos medidos. Hasta entonces esto sigue
siendo preestreno, por muy verdes que estén los tests.

## Lo que `validation` no comprueba

Decirlo es lo que hace creíble el resto de la lista.

**Las reglas que exigen consultar el censo de la AEAT.** «El NIF debe estar identificado» aparece
en §3.1.1, §3.1.3.4, §3.1.3.12 y §3.1.3.13 del documento de validaciones. No es una propiedad del
documento: es una consulta contra un sistema remoto. Ninguna librería local puede responderla, y
una que dijera que sí estaría mintiendo.

**Las once subreglas de `ClaveRegimen`** (§15.6.1 a §15.6.11) y **la lista L10 de
`OperacionExenta`** (§15.5). Son once mini-especificaciones y dos listas que viven en el diseño de
registro, no en el documento de validaciones. Implementarlas a medias sería peor que no
implementarlas: daría sensación de cobertura donde no la hay.

Lo estructural —longitudes, enumeraciones, orden de elementos— no lo comprueba `validation` sino
el XSD oficial, contra el que `xml` valida en su suite de tests.

## Comparativa

El registro devuelve unos 30 paquetes relacionados con VERI\*FACTU. Estos son los que se solapan:

| Paquete | Huella | Cadena | XML | SOAP | Reglas AEAT | XAdES | QR | Deps | Isomórfico |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **`@verifactu-js/*`** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ *f5* | ✅ | **0** | ✅ |
| `@inoguerols/verifactu` | ✅ | ⚠️ | ✅ | ✅ | ? | ✅ | ✅ | 8 | ❌ |
| `@doscientos/verifactu` | ✅ | ❌ | ✅ | ✅ | ? | ❌ | ✅ | 4 | ❌ |
| `verifactu-node-lib` | ✅ | ✅ | ✅ | ❌ | ? | ❌ | ✅ | 2 | ❌ |
| `@kreyo/verifactu-hash-calculator` | ✅ | ? | ❌ | ❌ | ❌ | ❌ | ❌ | 0 | ? |

**Cadena** = detectar rotura, hueco y alteración sobre una cadena ya generada, no solo encadenar
al generar. Los `?` son cosas que **no he comprobado**, no valoraciones.

Además existen al menos `verifactu-tools`, `verifactu-utils`, la familia `facturahub-*` y varios
SDK de proveedores (`@beel_es/sdk`, `@verifacturapi/sdk`, `@gliese710/verifactu-sdk`,
`@factuarea/sdk`, `@calltek/invo-sdk`). No los he mirado; su ausencia de la tabla no dice nada
sobre ellos.

**`@inoguerols/verifactu` sigue cubriendo XAdES y el envío, que aquí son fases 3 y 5.** Si
necesitas el flujo completo hoy, es una opción real.

Lo que aporta este: la corrección está **demostrada** contra los vectores oficiales, cada
afirmación técnica lleva su cita, y lo que no se sabe está escrito como incógnita en vez de
resuelto a ojo.

## Desarrollo

```bash
pnpm install
pnpm test          # 725 tests
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
