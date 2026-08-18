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

## Estado: mínimo, y solo contra preproducción

Construye el sobre, lo envía y parsea la respuesta. Nada más.

No hay cola, ni backoff, ni reintentos, ni mapa de códigos de error. Eso llega cuando las sondas
contra preproducción hayan medido qué hace el servicio de verdad; escribirlo antes sería
inventarse el comportamiento.

**Y no hay forma de apuntarlo a producción.** No es una formalidad: aquí todavía no se ha enviado
nada nunca a la AEAT, `TiempoEsperaEnvio` no está implementado, y un envío a producción es una
**declaración tributaria real** bajo un NIF real que no se puede retirar. El candado se quita en el
paso siguiente a las sondas, a propósito y con la cola puesta.

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
