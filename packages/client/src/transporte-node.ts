/**
 * The default transport: Node, over undici, with a client certificate.
 *
 * This is the file that makes `@verifactu-js/client` **not isomorphic**, and it is why the
 * transport is a parameter. `core`, `qr`, `xml` and `validation` run anywhere with Web Crypto;
 * this needs a TLS socket presenting a client certificate, which browsers deliberately do not
 * expose and every runtime models differently.
 *
 * `undici` is a real dependency, and the only third-party one in the whole toolkit. Node's global
 * `fetch` is already undici underneath, but it does not expose the `Agent` needed to set
 * `connect` options per request — so the choice is this package or hand-rolling `node:https`.
 * undici is maintained by the Node.js project itself.
 */

import { Agent, type Dispatcher, request } from 'undici';

import { VerifactuClientError } from './errors.js';
import type { Credenciales, PeticionHttp, RespuestaHttp, Transporte } from './transporte.js';

/** Turns credentials into the TLS options undici hands to `tls.connect`. */
function opcionesTls(credenciales: Credenciales): Record<string, unknown> {
  return credenciales.tipo === 'p12'
    ? { pfx: credenciales.pfx, passphrase: credenciales.passphrase }
    : {
        cert: credenciales.cert,
        key: credenciales.key,
        ...(credenciales.passphrase === undefined ? {} : { passphrase: credenciales.passphrase }),
      };
}

/**
 * Builds a transport that presents `credenciales` on every connection.
 *
 * The agent is created once and reused: the TLS handshake with a qualified certificate is the
 * expensive part of a submission, and the AEAT throttles by time between submissions
 * (`TiempoEsperaEnvio`), not by connection.
 *
 * @param credenciales - Client certificate, from `cargarP12` / `cargarPem` or your own store.
 * @param opciones.conexionesMaximas - Concurrent connections. One is right: submissions to the
 *   same chain are inherently sequential, and the service asks you to wait between them.
 */
export function transporteNode(
  credenciales: Credenciales,
  opciones: { readonly conexionesMaximas?: number } = {},
): Transporte {
  const agent = new Agent({
    connections: opciones.conexionesMaximas ?? 1,
    connect: opcionesTls(credenciales),
  });

  return async (peticion: PeticionHttp): Promise<RespuestaHttp> => {
    let respuesta: Dispatcher.ResponseData;
    try {
      respuesta = await request(peticion.url, {
        method: peticion.metodo,
        headers: peticion.cabeceras,
        body: peticion.cuerpo,
        dispatcher: agent,
        headersTimeout: peticion.timeoutMs,
        bodyTimeout: peticion.timeoutMs,
      });
    } catch (error) {
      throw new VerifactuClientError({
        code: 'SIN_RESPUESTA',
        message: `No ha habido respuesta de ${peticion.url}.`,
        causaProbable: diagnosticarError(error),
        accionSugerida:
          'Reintentar tiene sentido aquí, y solo aquí: no ha llegado respuesta, así que el envío ' +
          'no se ha registrado. Un registro rechazado por la AEAT es otra cosa y no se reintenta.',
        cause: error,
      });
    }

    return {
      estado: respuesta.statusCode,
      cabeceras: normalizarCabeceras(respuesta.headers),
      cuerpo: decodificarXml(Buffer.from(await respuesta.body.arrayBuffer())),
    };
  };
}

/**
 * Decodes an XML response using the encoding the document itself declares.
 *
 * `body.text()` de undici decodifica siempre como UTF-8. Con XML eso es casi siempre correcto y
 * cuando no lo es, falla de la peor manera posible: cada carácter acentuado se convierte en
 * U+FFFD, que es una sustitución **irreversible**. No se corrompe la presentación, se pierde el
 * dato — de un U+FFFD ya no se sabe si era `ó` o `í`.
 *
 * Aquí importa más de lo normal por dos razones. La primera es que la respuesta a un envío es
 * irrepetible: lleva el CSV y la `DescripcionErrorRegistro` de un registro que la AEAT ya ha
 * almacenado, y no se puede volver a pedir. La segunda es que la AEAT ya ha demostrado que no
 * todo lo suyo viene en UTF-8: `errores.properties` es ISO-8859-1, como manda el formato, y
 * leerlo como UTF-8 lo destruyó (ver `scripts/properties.mjs`).
 *
 * La declaración XML es ASCII por obligación de XML 1.0 §4.3.3, así que se puede leer sin saber
 * todavía la codificación del resto. Si no hay declaración, UTF-8 es lo correcto: es el valor por
 * defecto que fija la propia norma.
 *
 * Exportada porque quien escriba su propio {@link Transporte} tiene el mismo problema, y
 * resolverlo distinto cambiaría los acentos de los mensajes de error según el runtime.
 */
export function decodificarXml(bytes: Buffer): string {
  const declaracion = bytes.subarray(0, 200).toString('latin1');
  const etiqueta = /^<\?xml[^>]*\sencoding\s*=\s*["']([\w.:-]+)["']/i.exec(declaracion)?.[1];

  if (etiqueta === undefined) return bytes.toString('utf8');

  const normalizada = etiqueta.toLowerCase();
  if (normalizada === 'utf-8' || normalizada === 'utf8') return bytes.toString('utf8');
  if (normalizada === 'iso-8859-1' || normalizada === 'latin1' || normalizada === 'iso8859-1') {
    return bytes.toString('latin1');
  }

  // Cualquier otra cosa se delega en el decodificador del runtime, que conoce más juegos de
  // caracteres que nosotros. Si tampoco la conoce, se cae a UTF-8: es lo que habría pasado de
  // todas formas sin esta función, así que nunca se está peor que antes.
  try {
    return new TextDecoder(normalizada, { fatal: false }).decode(bytes);
  } catch {
    return bytes.toString('utf8');
  }
}

/**
 * Flattens HTTP headers into plain strings.
 *
 * A header can arrive repeated (undici hands those over as an array) or absent. Exported because
 * anyone writing their own {@link Transporte} has to make the same two decisions, and making them
 * differently would change what the caller sees depending on the runtime.
 */
export function normalizarCabeceras(
  cabeceras: Readonly<Record<string, string | string[] | undefined>>,
): Record<string, string> {
  const salida: Record<string, string> = {};

  for (const [nombre, valor] of Object.entries(cabeceras)) {
    if (valor === undefined) continue;
    salida[nombre] = Array.isArray(valor) ? valor.join(', ') : valor;
  }

  return salida;
}

/**
 * Turns the usual TLS and network failures into something worth reading.
 *
 * Exported because it is the part a user debugging a real certificate will actually read, and
 * because a mapping table deserves tests of its own rather than being exercised by accident.
 */
export function diagnosticarError(error: unknown): string {
  const codigo = (error as { code?: string })?.code ?? '';
  const mensaje = String((error as { message?: string })?.message ?? error);

  const conocidos: ReadonlyArray<readonly [string, string]> = [
    [
      'ENOTFOUND',
      'El host no resuelve. Comprueba el DNS y que la URL sea la del entorno correcto.',
    ],
    ['ECONNREFUSED', 'El host rechaza la conexión.'],
    ['ETIMEDOUT', 'La conexión ha expirado sin respuesta.'],
    ['UND_ERR_HEADERS_TIMEOUT', 'La AEAT no ha enviado cabeceras dentro del plazo.'],
    ['UND_ERR_BODY_TIMEOUT', 'La respuesta se ha cortado a mitad del cuerpo.'],
    [
      'ERR_OSSL_',
      'OpenSSL ha rechazado el certificado o la clave. Suele ser la contraseña del .p12, o un ' +
        'PEM cuya clave no corresponde al certificado.',
    ],
    ['CERT_', 'Problema con la cadena de confianza del certificado del servidor o del cliente.'],
    [
      'ERR_TLS',
      'Ha fallado el handshake TLS. Si el certificado es de sello, recuerda que la AEAT lo ' +
        'atiende en un host distinto (www10 / prewww10).',
    ],
  ];

  for (const [prefijo, explicacion] of conocidos) {
    if (codigo.startsWith(prefijo) || mensaje.includes(prefijo)) {
      return `${explicacion} (${codigo || mensaje})`;
    }
  }

  return mensaje;
}
