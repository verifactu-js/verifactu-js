/**
 * `@verifactu-js/xml` — serialisation to the official AEAT schema and the SOAP envelope.
 *
 * Work in progress. Currently exports the namespace constants and the XML writer; the record
 * serialisers land next.
 *
 * The specification, with a citation per claim, is in `docs/spec-notes.md`.
 */

export {
  NAMESPACES,
  NS_RESPUESTA_SUMINISTRO,
  NS_SOAP_ENVELOPE,
  NS_SUMINISTRO_INFORMACION,
  NS_SUMINISTRO_LR,
  PREFIX,
} from './namespaces.js';
export type { XmlAttribute } from './writer.js';
export { escapeAttribute, escapeText, XmlWriter } from './writer.js';
