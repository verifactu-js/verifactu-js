# @verifactu-js/client

Envío de registros VERI\*FACTU a la AEAT con certificado cliente.

> **Este es el único paquete del toolkit que NO es isomórfico.**
>
> `core`, `qr`, `xml` y `validation` funcionan en cualquier sitio con Web Crypto: Node, Deno, Bun,
> Workers, navegador. Éste necesita un socket TLS que presente un certificado cualificado, y eso
> el navegador no lo expone a propósito y cada runtime lo modela distinto.
>
> Por eso **la capa HTTP es un parámetro, no un import**. Por defecto va Node sobre `undici`; para
> cualquier otra cosa, pasas una función.

## Estado: completo para preproducción, y solo para preproducción

Construye el sobre, lo envía, parsea la respuesta, **encola, espera, reintenta y encadena**.

Lleva el **mapa de los 247 códigos de error** de la AEAT (`explicarCodigo`) con el texto oficial y
qué hacer con cada uno, y las **constantes medidas** contra el servicio, con su procedencia. Ninguna
de esas constantes está publicada por la AEAT: salen de dieciocho registros enviados contra
preproducción con un certificado cualificado real.

**Y no hay forma de apuntarlo a producción.** No es una formalidad: un envío a producción es una
**declaración tributaria real** bajo un NIF real que no se puede retirar, y aquí no se ha enviado
nunca nada a producción.

```ts
import { cargarP12, crearClientePruebas, transporteNode } from '@verifactu-js/client';

const credenciales = await cargarP12('/ruta/certificado.p12', process.env.P12_PASSPHRASE!);

const cliente = crearClientePruebas({
  transporte: transporteNode(credenciales),
  certificado: 'representante',
});

const { respuesta, estadoHttp, duracionMs } = await cliente.enviar(remision);

console.log(respuesta.EstadoEnvio, respuesta.TiempoEsperaEnvio, estadoHttp, duracionMs);
```

## La cadena se construye al enviar, no al encolar

**Es la restricción de diseño más importante del paquete**, no se deduce de la documentación de la
AEAT, y descubrirla en producción sale caro. La cola de este paquete la respeta por construcción,
pero conviene entenderla aunque no la uses: si generas los registros en otro proceso, es tuya.

`FechaHoraHusoGenRegistro` se sella cuando se **genera** el registro, pero la AEAT no lo compara
contra la fecha de la factura: lo compara contra **su propio reloj**, con un margen de **240
segundos** ([medido](https://github.com/verifactu-js/verifactu-js/blob/main/docs/spec-notes.md),
no publicado). Un registro correcto al generarse deja de serlo por el mero paso del tiempo.

Y falla en silencio. El código **2004** es de categoría *aceptado con errores*: el registro **queda
almacenado**, cuenta a efectos del RD 1007/2023, y hay que subsanarlo uno a uno.

### No se puede «poner al día» un registro encolado

La reacción natural es re-sellar el registro antes de mandarlo. No se puede:
`FechaHoraHusoGenRegistro` **entra en la huella**.

```
2026-08-19T12:00:00+02:00  →  6172DDF8744FEA88…
2026-08-19T12:05:00+02:00  →  F5AB113C5911A072…
```

El mismo registro, cinco minutos después, otra huella. Y como la huella de cada registro es un
campo del siguiente, re-sellar uno **invalida toda la cadena que cuelgue detrás**. Un registro
encolado con su huella ya calculada es, a efectos prácticos, inmutable.

### La regla

> **Encola datos de factura, no registros firmados.** El sello temporal, la huella y el eslabón con
> el registro anterior se calculan justo antes de enviar.

De ahí salen dos consecuencias que conviene aceptar de entrada:

1. **La cola es estrictamente secuencial.** No se puede preparar el registro *n+1* sin la huella del
   *n*, y esa huella no se conoce hasta haber enviado el *n*. No hay paralelismo posible dentro de
   una cadena, y no es una limitación de esta librería: es la forma del problema.
2. **Si tu SIF genera los registros en otro proceso** y te llegan ya firmados —que es un caso real—,
   entonces mide su antigüedad antes de enviarlos y decide a conciencia: mandarlo sabiendo que
   volverá 2004 y subsanarlo después, o rehacer la cadena desde ese punto. Lo que no vale es
   mandarlo sin mirar.

```ts
import { desfaseDeReloj, MARGEN_RELOJ_AEAT_SEGUNDOS } from '@verifactu-js/client';

// ¿Va bien el reloj de esta máquina? Contra el sello de la AEAT, gratis en cada respuesta.
const reloj = desfaseDeReloj(respuesta.DatosPresentacion?.TimestampPresentacion ?? '');
if (!reloj.dentroDelMargen) console.warn(reloj.aviso);

// ¿Ha envejecido el registro esperando en la cola? Misma resta, mismo margen.
const antiguedad = desfaseDeReloj(eslabon.fields.FechaHoraHusoGenRegistro);
if (!antiguedad.dentroDelMargen) {
  // No lo re-selles: cambiarías la huella y romperías la cadena. Ver arriba.
}
```

El razonamiento completo, con lo que se midió y cómo, está en
[`docs/spec-notes.md`](https://github.com/verifactu-js/verifactu-js/blob/main/docs/spec-notes.md) §22.9.

## La cola

Encolas **datos de factura**. La cola llama a la cadena por ti, en el momento del envío y sobre el
eslabón que la AEAT aceptó de verdad.

```ts
import { crearCola } from '@verifactu-js/client';
import { createSifChain } from '@verifactu-js/core';

const cola = crearCola({
  cliente,
  cadena: createSifChain({ timeZone: 'Atlantic/Canary' }),
  cabecera: { ObligadoEmision: { NombreRazon: 'EMPRESA SL', NIF: '89890001K' } },
  ultimoEslabon: await db.ultimoEslabonGuardado(),   // null si la cadena empieza aquí
});

cola.encolar(
  { tipo: 'alta', factura: { IDEmisorFactura, NumSerieFactura, ... }, datos },
  { tipo: 'alta', factura: { ... }, datos },
);

const { aceptados, pendientes, ultimoEslabon, parada, avisos } = await cola.procesar();

await db.guardar(ultimoEslabon);          // lo que la AEAT aceptó, y nada más
if (parada) console.warn(parada.motivo, parada.explicacion);
for (const aviso of avisos) console.warn(aviso);
```

`encolar` **rechaza** una entrada que traiga un eslabón ya firmado. No es celo: es que aceptarlo
produce el fallo silencioso de arriba.

### Lo que hace, y por qué

| | Qué hace | De dónde sale |
|---|---|---|
| **Sella al enviar** | El sello, la huella y el eslabón se calculan justo antes de abrir el socket, nunca al encolar | Medido: el sello envejece y la AEAT lo compara contra su reloj |
| **Va en serie** | Un `procesar()` a la vez por cadena. Dos concurrentes se rechazan | No se puede preparar el registro *n+1* sin la huella del *n* |
| **Respeta la espera** | Aplica el `TiempoEsperaEnvio` de la última respuesta. Una cadena vacía es «no hay dato», nunca cero | El XSD lo declara `\d{0,4}`, así que puede venir vacío |
| **Vigila la ventana** | Deja de reintentar cuando el sello se saldría de los 240 s, en vez de mandar algo que volverá 2004 | Con 60 s de espera, cuatro reintentos agotan el margen |
| **Reintenta poco** | Solo si no llegó respuesta, si fue un 5xx, o si el código es uno de los 13 técnicos de la AEAT | Un error de datos llega en un HTTP 200 bien formado: reenviarlo da lo mismo |
| **Avanza lo justo** | La cadena avanza hasta el último registro que la AEAT **almacenó**, y para ahí | Lo que iba detrás cuelga de una huella que la AEAT no tiene |
| **Comprueba el reloj** | Compara con `TimestampPresentacion` en cada respuesta y avisa | Sale gratis, y un reloj desviado estropea todo lo que generes después |

`AceptadoConErrores` **hace avanzar la cadena**: el registro está almacenado. Reenviarlo lo
duplicaría; se subsana.

### Lo que NO decide

**Dónde vive la cola.** En memoria, en disco o en una base de datos es cosa tuya: `procesar()`
devuelve el último eslabón aceptado y lo que quedó pendiente, y tú los guardas donde quieras.

**Qué hacer ante un 2004.** Te da el dato —`antiguedadSelloSegundos` y `parada`— y decides:
mandarlo a sabiendas y subsanarlo, o rehacer la cadena desde ahí.

El contrato completo, escrito **antes** que el código y con la medición de la que sale cada
restricción, está en
[`docs/diseno-cola-3d.md`](https://github.com/verifactu-js/verifactu-js/blob/main/docs/diseno-cola-3d.md).

## Los dos formatos de certificado

La FNMT entrega un `.p12`; un certificado exportado del navegador o convertido con OpenSSL suele
acabar en un par PEM. Los dos valen:

```ts
const p12 = await cargarP12('cert.p12', passphrase);
const pem = await cargarPem('cert.pem', 'clave.pem');          // clave sin cifrar
const pemCifrado = await cargarPem('cert.pem', 'clave.pem', passphrase);
```

**El `.p12` no se parsea.** La pila TLS de Node acepta PKCS#12 directamente por la opción `pfx`,
así que el fichero va al socket tal cual. Parsearlo nosotros significaría una dependencia de
criptografía o ASN.1 a mano, y para nada.

Si prefieres no tocar el disco —secret manager, KMS, variable de entorno— construye el objeto
`Credenciales` tú y sáltate `cargarP12` / `cargarPem`.

## Cambiar la capa HTTP

`Transporte` es una función. Recibe la petición y devuelve la respuesta:

```ts
import type { Transporte } from '@verifactu-js/client';

const miTransporte: Transporte = async (peticion) => {
  const r = await miClienteHttp.post(peticion.url, peticion.cuerpo, peticion.cabeceras);
  return { estado: r.status, cabeceras: r.headers, cuerpo: r.text };
};
```

Dos reglas:

- **No lances por un estado HTTP de error.** Un `500` con un SOAP Fault dentro es una respuesta
  perfectamente normal, y el cuerpo es el único diagnóstico que hay. Lanza solo si no llegó nada.
- **Devuelve el cuerpo como texto, sin parsear.** De eso se encarga `@verifactu-js/xml`, que no
  normaliza nada — y si algo normalizara el `xs:dateTime`, la huella dejaría de reproducirse.

`normalizarCabeceras` está exportada porque cualquier transporte tiene que decidir lo mismo sobre
cabeceras repetidas y ausentes, y decidirlo distinto cambiaría lo que ve quien llama según el
runtime.

## Por qué `undici`

Es la única dependencia de terceros de todo el toolkit. El `fetch` global de Node ya es undici por
dentro, pero no expone el `Agent` que hace falta para poner opciones de `connect` por petición
—que es donde van el certificado y la clave—, así que la alternativa era escribir `node:https` a
mano. undici lo mantiene el propio proyecto Node.js.

## Diagnóstico de errores de TLS

`SIN_RESPUESTA` significa que no llegó respuesta, y por tanto que **el envío no se ha registrado**:
es el único caso en el que reintentar tiene sentido. Un registro rechazado por la AEAT es otra cosa
y no se reintenta.

`diagnosticarError` traduce los códigos que salen con un certificado real:

| Código | Qué suele ser |
|---|---|
| `ERR_OSSL_*` | La contraseña del `.p12`, o un PEM cuya clave no corresponde al certificado |
| `CERT_*` | Cadena de confianza |
| `ERR_TLS*` | Handshake. Si el certificado es de sello, la AEAT lo atiende en otro host (`www10` / `prewww10`) |
| `ENOTFOUND` | DNS, o la URL del entorno equivocado |
| `UND_ERR_*_TIMEOUT` | La AEAT no contestó a tiempo |

## Licencia

MIT.
