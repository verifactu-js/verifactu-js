/**
 * `@verifactu-js/client` — sending records to the AEAT with a client certificate.
 *
 * **This is the one package that is not isomorphic.** `core`, `qr`, `xml` and `validation` run
 * anywhere with Web Crypto; this one needs a TLS socket presenting a qualified certificate, which
 * browsers deliberately do not expose and every runtime models differently. The HTTP layer is
 * therefore a parameter: the default is Node over undici, and anything else is a function you
 * pass in.
 *
 * Current state: **minimal, and pointed at preproduction only**. It builds the envelope, sends
 * it, parses the answer, and explains the AEAT's error codes. The queue and the backoff come
 * after the probes measure what the service actually does.
 */

export type { Cliente, ConfiguracionCliente, ResultadoEnvio } from './cliente.js';
export { crearClientePruebas } from './cliente.js';
export { cargarP12, cargarPem } from './credenciales.js';
export type { CategoriaError, CodigoAeat, ExplicacionCodigo } from './errores-aeat.js';
export { CODIGOS_AEAT, explicarCodigo, FUENTE_CODIGOS } from './errores-aeat.js';
export type { VerifactuClientErrorCode } from './errors.js';
export { VerifactuClientError } from './errors.js';
export type { Credenciales, PeticionHttp, RespuestaHttp, Transporte } from './transporte.js';
export {
  decodificarXml,
  diagnosticarError,
  normalizarCabeceras,
  transporteNode,
} from './transporte-node.js';
