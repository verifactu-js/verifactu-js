/**
 * XML namespaces of the AEAT schemas.
 *
 * ## The trap
 *
 * These are **not** the URLs the schemas are downloaded from. The files live at paths containing
 * `tikeV1.0` on `prewww2.aeat.es`:
 *
 * ```
 * https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SuministroLR.xsd
 * ```
 *
 * but the `targetNamespace` each file declares inside itself uses `tike` — no version — and the
 * host `www2.agenciatributaria.gob.es`. Copying the download URL into the XML produces a
 * document the AEAT rejects, and the error message points at the element rather than at the
 * namespace, so it reads like a schema problem.
 *
 * There is a test asserting that the `tikeV1.0` form fails XSD validation. See
 * `docs/spec-notes.md` §8.3.
 */

/** Root of every AEAT namespace in this package. Note `tike`, without a version. */
const BASE =
  'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws';

/** `SuministroLR.xsd` — the submission envelope: `RegFactuSistemaFacturacion`, `Cabecera`. */
export const NS_SUMINISTRO_LR = `${BASE}/SuministroLR.xsd`;

/** `SuministroInformacion.xsd` — common types: `RegistroAlta`, `RegistroAnulacion` and friends. */
export const NS_SUMINISTRO_INFORMACION = `${BASE}/SuministroInformacion.xsd`;

/** `RespuestaSuministro.xsd` — the response document. */
export const NS_RESPUESTA_SUMINISTRO = `${BASE}/RespuestaSuministro.xsd`;

/** SOAP 1.1 envelope. The WSDL binds `transport="http://schemas.xmlsoap.org/soap/http"`. */
export const NS_SOAP_ENVELOPE = 'http://schemas.xmlsoap.org/soap/envelope/';

/** Prefixes used on output. Arbitrary but stable, so fixtures stay diffable. */
export const PREFIX = {
  /** `SuministroLR.xsd` */
  sfLR: 'sfLR',
  /** `SuministroInformacion.xsd` */
  sf: 'sf',
  /** `RespuestaSuministro.xsd` */
  sfR: 'sfR',
  /** SOAP envelope */
  soapenv: 'soapenv',
} as const;

/**
 * Every namespace this package emits or parses, keyed by prefix.
 *
 * Exported so a consumer can point an external validator at exactly what we use, and so the
 * test suite can assert the values rather than trusting a string literal copied by hand.
 */
export const NAMESPACES = {
  [PREFIX.sfLR]: NS_SUMINISTRO_LR,
  [PREFIX.sf]: NS_SUMINISTRO_INFORMACION,
  [PREFIX.sfR]: NS_RESPUESTA_SUMINISTRO,
  [PREFIX.soapenv]: NS_SOAP_ENVELOPE,
} as const;
