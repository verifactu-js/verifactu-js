/**
 * `@verifactu-js/xml` — serialisation to the official AEAT schema and the SOAP envelope.
 *
 * Covers the whole submission round trip: build the records from the canonical links `core`
 * produces, batch them, wrap them in the SOAP envelope, and read the response back without
 * normalising a single character on the way.
 *
 * The record model (`DatosAlta`, `DetalleDesglose`, `Cabecera`…) is defined in
 * `@verifactu-js/validation` and re-exported here for convenience: the AEAT's rules are the
 * semantics of those types, so type and rule live together. It is imported with `import type`, so
 * this package pays nothing at runtime for the dependency.
 *
 * Deliberately out of scope: `ds:Signature` (XAdES), the `ConsultaFactuSistemaFacturacion` query
 * service, and the event records. Business validations live in `@verifactu-js/validation` and are
 * **not** run when you serialise — see its README for why.
 *
 * The specification, with a citation per claim, is in `docs/spec-notes.md`.
 */

export type {
  Cabecera,
  DatosAlta,
  DatosAnulacion,
  DetalleDesglose,
  IDFacturaAR,
  IDOtro,
  ImporteRectificacion,
  PersonaES,
  PersonaFisicaJuridica,
  RemisionRequerimiento,
  RemisionVoluntaria,
  SiNo,
  SistemaInformatico,
} from '@verifactu-js/validation';

export { writeCabecera } from './cabecera.js';
export type { VerifactuXmlErrorCode } from './errors.js';
export { VerifactuXmlError } from './errors.js';
export {
  NAMESPACES,
  NS_RESPUESTA_SUMINISTRO,
  NS_SOAP_ENVELOPE,
  NS_SUMINISTRO_INFORMACION,
  NS_SUMINISTRO_LR,
  PREFIX,
} from './namespaces.js';
export type { XmlElement } from './parser.js';
export { hijo, hijos, parsearXml, textoDeHijo } from './parser.js';
export type { RegistroAlta, RegistroAnulacion } from './registro.js';
export { writeRegistroAlta, writeRegistroAnulacion } from './registro.js';
export type { RegistroFactura, Remision } from './remision.js';
export { serializarRemision, writeRemision } from './remision.js';
export type {
  DatosPresentacion,
  EstadoEnvio,
  EstadoRegistro,
  EstadoRegistroDuplicado,
  IDFacturaRespuesta,
  OperacionRespuesta,
  RegistroDuplicado,
  RespuestaLinea,
  RespuestaRemision,
} from './respuesta.js';
export { parsearRespuesta } from './respuesta.js';
export type { Destino, Entorno, Servicio, TipoCertificado } from './soap.js';
export { endpoint, SOAP_ACTION, SOAP_CONTENT_TYPE, serializarSobreSoap } from './soap.js';
export type { XmlAttribute } from './writer.js';
export { escapeAttribute, escapeText, XmlWriter } from './writer.js';
