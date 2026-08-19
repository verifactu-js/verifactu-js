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
 *
 * ## Antes de escribir una cola sobre esto
 *
 * **La cadena se construye al enviar, no al encolar.** `FechaHoraHusoGenRegistro` entra en la
 * huella, y la huella de cada registro es un campo del siguiente: re-sellar un registro para
 * ponerlo al día invalida toda la cadena que cuelgue detrás. Un registro encolado con su huella ya
 * calculada es inmutable, y la AEAT lo compara contra su reloj con un margen de 240 s —pasarse no
 * lo rechaza, lo **acepta con errores** y hay que subsanarlo—.
 *
 * De ahí que la cola sea estrictamente secuencial: no se puede preparar el registro siguiente sin
 * la huella del anterior, y no se conoce hasta haberlo enviado.
 *
 * El contrato completo que tiene que cumplir la cola está en `docs/diseno-cola-3d.md`, escrito
 * antes de implementarla y con la medición de la que sale cada restricción.
 */

export type { Cliente, ConfiguracionCliente, ResultadoEnvio } from './cliente.js';
export { crearClientePruebas } from './cliente.js';
export { cargarP12, cargarPem } from './credenciales.js';
export type { CategoriaError, CodigoAeat, ExplicacionCodigo } from './errores-aeat.js';
export { CODIGOS_AEAT, explicarCodigo, FUENTE_CODIGOS } from './errores-aeat.js';
export type { VerifactuClientErrorCode } from './errors.js';
export { VerifactuClientError } from './errors.js';
export type { DesfaseReloj } from './medido.js';
export {
  desfaseDeReloj,
  MARGEN_RELOJ_AEAT_SEGUNDOS,
  TIEMPO_ESPERA_ENVIO_INICIAL_SEGUNDOS,
} from './medido.js';
export type { Credenciales, PeticionHttp, RespuestaHttp, Transporte } from './transporte.js';
export {
  decodificarXml,
  diagnosticarError,
  normalizarCabeceras,
  transporteNode,
} from './transporte-node.js';
