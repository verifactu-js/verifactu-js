/**
 * `@verifactu-js/xml` — serialisation to the official AEAT schema and the SOAP envelope.
 *
 * Work in progress. Currently exports the namespace constants, the XML writer and the two record
 * serialisers; the batch envelope, the SOAP envelope and the response parser land next.
 *
 * The specification, with a citation per claim, is in `docs/spec-notes.md`.
 */

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
export type {
  DatosAlta,
  DatosAnulacion,
  DetalleDesglose,
  IDFacturaAR,
  IDOtro,
  ImporteRectificacion,
  PersonaFisicaJuridica,
  RegistroAlta,
  RegistroAnulacion,
  SiNo,
  SistemaInformatico,
} from './registro.js';
export { writeRegistroAlta, writeRegistroAnulacion } from './registro.js';
export type { XmlAttribute } from './writer.js';
export { escapeAttribute, escapeText, XmlWriter } from './writer.js';
