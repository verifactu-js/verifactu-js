/**
 * The SOAP envelope, and the endpoints it is sent to.
 *
 * `SistemaFacturacion.wsdl` binds `style="document"` and `use="literal"` with a single message
 * part, `sfLR:RegFactuSistemaFacturacion`. Document/literal with one part means the submission
 * element goes **straight into the Body** — there is no operation wrapper element, and nothing is
 * renamed. The envelope is SOAP 1.1: the binding transport is
 * `http://schemas.xmlsoap.org/soap/http`.
 *
 * See docs/spec-notes.md §8.
 */

import { NS_SOAP_ENVELOPE, PREFIX } from './namespaces.js';
import type { Remision } from './remision.js';
import { writeRemision } from './remision.js';
import { XmlWriter } from './writer.js';

const { soapenv } = PREFIX;

/**
 * Value of the `SOAPAction` HTTP header.
 *
 * The WSDL declares `soapAction=""` for every operation. SOAP 1.1 requires the header to be
 * **present**, so it must be sent as an empty quoted string — omitting it is not the same thing,
 * and some stacks reject the request.
 */
export const SOAP_ACTION = '""';

/** `Content-Type` for a SOAP 1.1 request. */
export const SOAP_CONTENT_TYPE = 'text/xml; charset=utf-8';

/** Which set of endpoints to use. */
export type Entorno = 'produccion' | 'pruebas';

/**
 * How the client authenticates.
 *
 * The AEAT publishes two hosts per environment for the same binding: one for a personal or
 * representative certificate and a separate one for a **seal** certificate (`certificado de
 * sello`). They are not interchangeable.
 */
export type TipoCertificado = 'representante' | 'sello';

/** Whether the sender issues verifiable invoices, or is answering a requirement. */
export type Servicio = 'verifactu' | 'requerimiento';

const HOSTS = {
  produccion: {
    representante: 'www1.agenciatributaria.gob.es',
    sello: 'www10.agenciatributaria.gob.es',
  },
  pruebas: { representante: 'prewww1.aeat.es', sello: 'prewww10.aeat.es' },
} as const;

const RUTA = {
  verifactu: 'VerifactuSOAP',
  requerimiento: 'RequerimientoSOAP',
} as const;

/** How to reach the service. */
export interface Destino {
  readonly entorno: Entorno;
  readonly certificado: TipoCertificado;
  readonly servicio: Servicio;
}

/**
 * Returns the endpoint URL for a destination.
 *
 * The eight combinations are exactly the eight `soap:address` entries in the WSDL; none is
 * derived by guesswork.
 */
export function endpoint(destino: Destino): string {
  const host = HOSTS[destino.entorno][destino.certificado];
  return `https://${host}/wlpl/TIKE-CONT/ws/SistemaFacturacion/${RUTA[destino.servicio]}`;
}

/**
 * Wraps a submission in a SOAP 1.1 envelope and returns the request body.
 *
 * The submission element is written directly into `soapenv:Body`, with no wrapper: that is what
 * document/literal with a single part means.
 *
 * @throws {VerifactuXmlError} Everything {@link writeRemision} throws — the batch is validated
 *   before a single byte is emitted.
 */
export function serializarSobreSoap(remision: Remision): string {
  const w = new XmlWriter();

  w.declaration();
  w.open(`${soapenv}:Envelope`, [{ name: `xmlns:${soapenv}`, value: NS_SOAP_ENVELOPE }]);
  // No `soapenv:Header`: the AEAT authenticates with the TLS client certificate, not with a
  // WS-Security header. An empty Header element would be legal and pointless.
  w.open(`${soapenv}:Body`);
  writeRemision(w, remision);
  w.close();
  w.close();

  return w.toString();
}
