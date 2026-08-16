# @verifactu-js/core

**Huella encadenada SHA-256 y verificación de cadenas para registros de facturación VERI\*FACTU (AEAT).**
Cero dependencias en runtime. Isomórfico.

> Si la huella que calculas está mal, la AEAT **no te rechaza el registro**. Lo acepta, lo
> almacena, y lo marca como «Aceptado con errores». Tu sistema parece funcionar.
> Este paquete existe por eso.

---

## Instalación

```bash
npm i @verifactu-js/core
```

## Uso

```ts
import { createSifChain, verifyChain } from '@verifactu-js/core';

// La zona horaria es obligatoria. No hay valor por defecto, y nunca lo habrá.
const chain = createSifChain({ timeZone: 'Atlantic/Canary' });

const registro = await chain.alta({
  IDEmisorFactura: '89890001K',
  NumSerieFactura: '12345678/G33',
  FechaExpedicionFactura: '01-01-2024',
  TipoFactura: 'F1',
  CuotaTotal: '12.35',    // cadena, no número
  ImporteTotal: '123.45', // cadena, no número
  previous: ultimoRegistroGuardado, // o null si es el primero de la cadena
});

await db.guardar(registro); // el eslabón entero, `fields` incluido

const { ok, brokenAt, issues } = await verifyChain(registrosOrdenados);
```

---

## Por qué existe: «Aceptado con errores»

De las *Especificaciones técnicas para generación de la huella o hash*, v0.1.2, §7:

> «Cuando en una remisión de un sistema «VERI\*FACTU» la huella informada no coincida con el
> cálculo realizado por la AEAT, el registro de facturación se marcará como “Aceptado con errores”.»

Y del documento de *Validaciones* v1.2.2, §23:

> «Se validará que la huella o «hash» generado sea acorde a las especificaciones […]
> En caso contrario, se devolverá un aviso de error (**no generará rechazo**).»

Traducido: **una huella mal calculada no rompe nada visible**. El envío devuelve `Correcto` a
nivel global, el registro queda almacenado, y el problema solo aparece cuando alguien mira el
estado por línea — o cuando llega una inspección.

Un smoke test contra preproducción que «funciona» no demuestra que tu huella sea correcta. Lo
único que lo demuestra son los vectores. Este paquete se valida contra los **tres vectores
oficiales** de la AEAT y uno de terceros reproducido de forma independiente, más 242 tests que
incluyen property-based sobre el encadenado.

---

## Qué lo diferencia

### Cero dependencias, isomórfico de verdad

Usa Web Crypto (`crypto.subtle`) e `Intl`, ambos parte del lenguaje. No `node:crypto`.
El build se hace con `platform: 'neutral'`: si alguna vez entrara un builtin de Node, el build
falla. En CI hay un smoke test contra el bundle publicado en **Node 20, 22 y 24, Bun y Deno**.

| | dependencias en runtime | criptografía |
|---|---|---|
| **`@verifactu-js/core`** | **0** | Web Crypto |
| `@doscientos/verifactu` | 4 | Node |
| `@inoguerols/verifactu` | 8 | Node + polyfill |

### Empaquetado verificado, no supuesto

```
$ npx publint                          →  All good!
$ npx @arethetypeswrong/cli --pack .   →  No problems found 🌟

  node10            🟢
  node16 (from CJS) 🟢 (CJS)
  node16 (from ESM) 🟢 (ESM)
  bundler           🟢
```

El tarball se instala en un directorio limpio fuera del monorepo y se comprueba que reproduce el
vector oficial V1 por `import` **y** por `require`, y que `tsc --moduleResolution node16`
resuelve los tipos por ambas vías con `skipLibCheck: false`.

### El huso sale del instante y de la zona IANA, nunca de configuración fija

`FechaHoraHusoGenRegistro` lleva el huso «que está usando el sistema informático de facturación
en el momento de generación». Eso depende del instante:

| Zona | Enero | Julio |
|---|---|---|
| `Atlantic/Canary` | `+00:00` | `+01:00` |
| `Europe/Madrid` | `+01:00` | `+02:00` |

**Canarias no coincide con la Península en ningún momento del año.** Por eso `timeZone` es
obligatorio: un valor peninsular por defecto estaría mal todo el año para un SIF canario, y la
huella sería coherente con el error.

Ojo con el camino por defecto de JavaScript:

```js
new Date().toISOString(); // '2024-01-15T12:00:00.000Z'
```

Dos infracciones a la vez: designador `Z` en vez de `±hh:mm`, y fracciones de segundo. Ninguna
de las dos aparece en ningún ejemplo oficial.

### Generar y verificar son dos modos distintos

| | Generar | Verificar |
|---|---|---|
| `Z` en vez de `+00:00` | no lo emite | lo acepta y avisa |
| Fracciones de segundo | no las emite | las acepta y avisa |
| Ante lo desconocido | lanza | informa, nunca lanza |

Al generar somos responsables del valor, así que somos estrictos. Al verificar, la cadena ya
existe y su huella se calculó sobre el literal que fuera: rechazarla haría inútil la
verificación.

---

## Dos cosas que hay que entender antes de usarlo

### 1. Los importes son cadenas, nunca números

La huella se calcula sobre el **literal exacto** que aparece en el XML. Si pasas un número,
JavaScript elige la representación por su cuenta:

```js
String(131.40)    // "131.4"   ← un decimal, no dos
String(0.1 + 0.2) // "0.30000000000000004"
```

Esa cadena entra en la huella y deja de coincidir con la que recalcula la AEAT. La librería
lanza `IMPORTE_NO_SERIALIZADO` en vez de convertir en silencio.

**Serializa el importe una sola vez y usa esa misma cadena para el XML y para la huella.**

### 2. Guarda `fields`, no tu entrada original

Es el mismo fallo, desplazado a la capa de persistencia, y el más fácil de cometer.

Antes de calcular la huella, la librería **canonicaliza** cada valor: recorta espacios en los
bordes con la semántica de Java, que es la de la implementación de referencia de la AEAT. Si tu
entrada lleva relleno, el valor con el que se calculó la huella **no es el que tú pasaste**:

```ts
const registro = await chain.alta({ NumSerieFactura: '  A/1  ', /* … */ });
registro.fields.NumSerieFactura; // 'A/1'  ← con esto se calculó la huella
```

```ts
await db.guardar(registro);                                   // ✅
await db.guardar({ ...misDatos, huella: registro.huella });   // ❌ pierde la canonicalización
```

Si guardas tu entrada cruda y más tarde reconstruyes el registro para `verifyChain`, obtendrás
huellas distintas y la cadena parecerá rota.

Desde la `0.2.0` esto no depende de que te acuerdes: **el tipo lo impide**. Lo que devuelve
`canonicalizeRegistroAlta` y `chain.alta()` lleva una marca (`Canonical<…>`) que un objeto
cualquiera no tiene, y `@verifactu-js/xml` solo acepta lo marcado.

### La vuelta desde la base de datos

Lo que recuperas de tu base de datos es un objeto plano, sin marca. **Vuelve a canonicalizarlo**:

```ts
const guardado = await db.cargarRegistro(id);          // sin marca
const { fields } = canonicalizeRegistroAlta(guardado); // Canonical<RegistroAltaHashInput>
```

Canonicalizar es **idempotente** —hay tests que lo demuestran—, así que sobre datos ya canónicos
es una operación nula que se limita a devolverlos marcados. Si no lo eran, los arregla; y si el
problema es de los que no queremos adivinar, lanza.

Ese es el camino de vuelta oficial, y el único. **No hay `asCanonical()`**: un cast sin
comprobar reintroduciría exactamente el fallo que la marca existe para evitar, y volver a
canonicalizar ya es barato, total y seguro.

`verifyChain` **no necesita la marca** y acepta lo que recuperes tal cual: al calcular la huella
se canonicaliza internamente de todas formas. La marca solo hace falta donde el literal importa,
que es al serializar el XML.

---

## Verificación de cadenas

`verifyChain` detecta los tres modos de fallo que importan: **alteración** (un registro ya no
reproduce su propia huella), **rotura** (encadena con algo que no es su predecesor) y **hueco**
(falta un registro).

No supone NIF constante entre eslabones: el diseño de registro contempla expresamente que el NIF
del emisor cambie a mitad de cadena tras una fusión.

```ts
const { ok, brokenAt, issues } = await verifyChain(registros);
// issues: [{ index, code: 'ENCADENAMIENTO_ROTO', message, esperado, encontrado }]
```

Y `verificarEncadenamientoPrevio(ultimo, penultimo, { ahora })`, que es la comprobación **mínima
que exige el artículo 7.i)**: una ventana de dos eslabones, O(1), que es lo que quieres en el
camino de generación de cada factura.

## Validación de NIF

`validateNif` devuelve un informe; **no lanza y no bloquea el cálculo de la huella**. Un NIF mal
puesto produce una huella correcta sobre un NIF mal puesto: son problemas distintos.

| Tipo | Severidad | Por qué |
|---|---|---|
| DNI, NIE, K/L/M | `error` | Módulo 23, determinista, sin excepción documentada |
| NIF de entidad («CIF») | `aviso` | El algoritmo del control **no está publicado** en la Orden EHA/451/2008 |

---

## Comparativa honesta

El ecosistema no está vacío: una búsqueda en el registro devuelve **unos 30 paquetes**
relacionados con VERI\*FACTU. Estos son los que se solapan con lo que hace este:

| Paquete | Huella | Cadena | XML | SOAP | XAdES | QR | Deps | Isomórfico |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **`@verifactu-js/core`** + [`/qr`](https://www.npmjs.com/package/@verifactu-js/qr) | ✅ | ✅ | ❌ *f2* | ❌ *f3* | ❌ *f5* | ✅ | **0** | ✅ |
| `@inoguerols/verifactu` | ✅ | ⚠️ | ✅ | ✅ | ✅ | ✅ | 8 | ❌ |
| `@doscientos/verifactu` | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | 4 | ❌ |
| `verifactu-node-lib` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | 2 | ❌ |
| `@kreyo/verifactu-hash-calculator` | ✅ | ? | ❌ | ❌ | ❌ | ❌ | 0 | ? |

**Cadena** = detectar rotura, hueco y alteración sobre una cadena ya generada, no solo
encadenar al generar. La `⚠️` de `@inoguerols` es que declara un «verificador de cumplimiento»
cuyo alcance no he comprobado.

Además existen al menos `verifactu-tools`, `verifactu-utils`, la familia `facturahub-*` y varios
SDK de proveedores (`@beel_es/sdk`, `@verifacturapi/sdk`, `@gliese710/verifactu-sdk`,
`@factuarea/sdk`, `@calltek/invo-sdk`). **No los he mirado**, así que no aparecen arriba; su
ausencia de la tabla no significa nada sobre ellos.

**Dicho claramente: hoy varios hacen más cosas que nosotros.** `@inoguerols/verifactu` cubre XML,
SOAP, XAdES y QR, que aquí son fases 2, 3 y 5. Si necesitas el flujo completo hoy, es una opción
real. Y `@kreyo/verifactu-hash-calculator` ataca exactamente el mismo problema que este paquete,
también sin dependencias.

Lo que aporta este: la corrección está **demostrada** contra los tres vectores oficiales de la
AEAT y uno de terceros reproducido de forma independiente, más property-based sobre el
encadenado; funciona sin cambios en Node, Bun, Deno, Workers y navegador; y trae `verifyChain`
para auditar cadenas que ya existen.

No he auditado la corrección de ninguna alternativa, y no insinúo que sea peor. La tabla refleja
lo que declaran sus README y sus `package.json`, consultados el 16/08/2026. Las `?` son cosas que
no he comprobado, no defectos.

---

## Estado

**Preestreno.** La huella y el encadenado están verificados contra los tres vectores oficiales de
la AEAT y uno de terceros. Quedan incógnitas de casos borde **no confirmadas en fuente oficial**
que impiden declarar esto estable:

- Semántica exacta del recorte de espacios (I-01) y normalización Unicode (I-03).
- Cómo normaliza la AEAT los decimales al recalcular (I-04); importes con signo (I-05).
- Si acepta `Z` en vez de `+00:00` (I-08), fracciones de segundo (I-07), offsets con segundos (I-09).

Están en [`docs/spec-notes.md`](https://github.com/verifactu-js/verifactu-js/blob/main/docs/spec-notes.md)
§11, cada una con su `TODO(verify: I-XX)` en el código. Se resolverán contra preproducción antes
de marcar la versión como estable.

**No se ha validado todavía ningún envío real contra la AEAT.**

---

## Aviso legal

Esta librería es una **herramienta técnica** que ayuda a generar registros conformes al
Real Decreto 1007/2023. No es, por sí sola, un sistema de facturación.

- El **Sistema Informático de Facturación (SIF)** que exige la norma es la aplicación completa
  que integra esta librería, no la librería.
- La **declaración responsable** que el reglamento exige al productor del software la firma
  **quien distribuye el producto final**, no el mantenedor de esta librería.
- Se ofrece **«tal cual», sin garantía de conformidad fiscal**. El usuario debe validar su
  propia implementación y consultar con un asesor fiscal.

Los autores no responden del incumplimiento normativo de quien la integre.

## Licencia

MIT.
