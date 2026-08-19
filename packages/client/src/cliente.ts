/**
 * The minimal client: build the envelope, send it, read the answer.
 *
 * Nothing else, on purpose. This is the primitive: one batch in, one parsed answer out, no
 * waiting and no retrying. The queue that sequences batches, honours `TiempoEsperaEnvio` and
 * decides when a retry is legitimate is {@link crearCola} in `cola.ts`, and it is built on top of
 * this — so a caller who wants to drive the timing themselves still can.
 *
 * ## It refuses to talk to production
 *
 * On purpose, and not as a formality. A submission to production is a **real tax filing** under a
 * real NIF that cannot be taken back, and nothing here has ever been sent to production. Every
 * measurement this package carries was taken against preproduction.
 */

import {
  endpoint,
  parsearRespuesta,
  type Remision,
  type RespuestaRemision,
  SOAP_ACTION,
  SOAP_CONTENT_TYPE,
  serializarSobreSoap,
  type TipoCertificado,
} from '@verifactu-js/xml';

import { VerifactuClientError } from './errors.js';
import type { RespuestaHttp, Transporte } from './transporte.js';

/** How to reach the service. `entorno` is fixed: see the note above. */
export interface ConfiguracionCliente {
  readonly transporte: Transporte;
  /** Personal/representative certificate, or a seal certificate. Different hosts. */
  readonly certificado: TipoCertificado;
  /** `verifactu` for verifiable invoices, `requerimiento` when answering an AEAT requirement. */
  readonly servicio?: 'verifactu' | 'requerimiento';
  /** Milliseconds. The AEAT is not fast; 60 s is not paranoid. */
  readonly timeoutMs?: number;
}

/** What a submission returns: the parsed answer plus what it took to get it. */
export interface ResultadoEnvio {
  readonly respuesta: RespuestaRemision;
  /** The envelope that was sent, kept for the record. A submission is a tax filing. */
  readonly peticion: string;
  /** The raw body, before parsing. */
  readonly cuerpoRespuesta: string;
  readonly estadoHttp: number;
  readonly duracionMs: number;
}

/** A client bound to one certificate and one environment. */
export interface Cliente {
  /** Sends one batch and parses the answer. Does not queue, wait or retry. */
  enviar(remision: Remision): Promise<ResultadoEnvio>;
  /** The URL this client posts to. Exposed so a probe can log exactly where it went. */
  readonly url: string;
}

/**
 * Creates a client aimed at **preproduction**.
 *
 * @throws {VerifactuClientError} `PRODUCCION_NO_HABILITADA` — there is no way to point this at
 *   production yet, and that is the point.
 */
export function crearClientePruebas(configuracion: ConfiguracionCliente): Cliente {
  const url = endpoint({
    entorno: 'pruebas',
    certificado: configuracion.certificado,
    servicio: configuracion.servicio ?? 'verifactu',
  });

  const timeoutMs = configuracion.timeoutMs ?? 60_000;

  return {
    url,
    async enviar(remision: Remision): Promise<ResultadoEnvio> {
      // Serialising first means a malformed batch never reaches the network: the checks in
      // `xml` (chaining, contiguity, obligado) run before a socket is opened.
      const peticion = serializarSobreSoap(remision);
      const comienzo = Date.now();

      const respuestaHttp = await configuracion.transporte({
        url,
        metodo: 'POST',
        cabeceras: { 'Content-Type': SOAP_CONTENT_TYPE, SOAPAction: SOAP_ACTION },
        cuerpo: peticion,
        timeoutMs,
      });

      const duracionMs = Date.now() - comienzo;
      const respuesta = leer(respuestaHttp, url);

      return {
        respuesta,
        peticion,
        cuerpoRespuesta: respuestaHttp.cuerpo,
        estadoHttp: respuestaHttp.estado,
        duracionMs,
      };
    },
  };
}

/**
 * What to do about a body that could not be parsed.
 *
 * El orden importa. Un SOAP Fault con código de la AEAT es un diagnóstico concreto y gana a
 * cualquier consejo genérico: los errores de cabecera llegan por ahí y no por `RespuestaLinea`.
 */
function accionPara(estado: number, error: unknown): string {
  const codigoAeat = (error as { codigoAeat?: unknown } | null)?.codigoAeat;
  if (typeof codigoAeat === 'string') {
    return (
      `La AEAT ha contestado con un SOAP Fault que trae su código ${codigoAeat}, disponible en ` +
      '«codigoAeat». Pásalo por explicarCodigo(): la explicación es la misma que si hubiera ' +
      'llegado en una RespuestaLinea.'
    );
  }

  if (estado === 401 || estado === 403) {
    return (
      'Ese estado con certificado cliente casi siempre es el certificado: caducado, no admitido ' +
      'por el endpoint, o de sello enviado al host que no es.'
    );
  }

  return (
    'Guarda el cuerpo entero antes de reintentar nada. Si es HTML, es una página de error de la ' +
    'sede y el problema no está en el XML.'
  );
}

/**
 * Parses the body, or explains why it could not be.
 *
 * A non-2xx status is **not** short-circuited: a SOAP Fault arrives with a 500 and carries the
 * only useful diagnosis there is. It is only when the body turns out not to be a response at all
 * that the status becomes worth reporting.
 */
function leer(http: RespuestaHttp, url: string): RespuestaRemision {
  try {
    return parsearRespuesta(http.cuerpo);
  } catch (error) {
    throw new VerifactuClientError({
      code: 'RESPUESTA_HTTP_INESPERADA',
      message: `${url} ha contestado ${http.estado} con algo que no es una respuesta de VERI*FACTU.`,
      // `String(error)` rather than reading `.message`: it keeps the error's name, and it cannot
      // produce `undefined` for something thrown that is not an Error.
      causaProbable: String(error),
      accionSugerida: accionPara(http.estado, error),
      estado: http.estado,
      // El cuerpo entero, no un resumen: es lo que hay que poder releer sin volver a enviar.
      cuerpo: http.cuerpo,
      cause: error,
    });
  }
}
