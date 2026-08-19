/**
 * Errors raised by `@verifactu-js/client`.
 *
 * Same shape as the other packages: a machine-readable code, plus a probable cause and a
 * corrective action in Spanish.
 */

/** Stable, machine-readable error codes. Branch on these, not on prose. */
export type VerifactuClientErrorCode =
  /** The certificate or key could not be read, or is unusable as given. */
  | 'CREDENCIALES_INVALIDAS'
  /** The submission was aimed at production, which this client refuses to do. */
  | 'PRODUCCION_NO_HABILITADA'
  /** No answer arrived: DNS, TLS, timeout, connection reset. */
  | 'SIN_RESPUESTA'
  /** An answer arrived, but not one that can be read as a VERI*FACTU response. */
  | 'RESPUESTA_HTTP_INESPERADA';

/** Base error for every failure raised by `@verifactu-js/client`. */
export class VerifactuClientError extends Error {
  readonly code: VerifactuClientErrorCode;
  readonly causaProbable: string;
  readonly accionSugerida: string;
  /** HTTP status, when there was one. */
  readonly estado: number | undefined;
  /**
   * The AEAT's own error code, when the failure carried one.
   *
   * Un error de cabecera **no llega como respuesta de negocio**: llega como SOAP Fault, con el
   * código embebido en el `faultstring` (`Codigo[4126]`). Medido en la sonda S-4 el 19/08/2026.
   *
   * Se propaga hasta aquí para que los dos caminos se traten igual: `explicarCodigo()` devuelve la
   * misma explicación venga de `RespuestaLinea.CodigoErrorRegistro` o de un fault. Quien integra no
   * debería tener que saber por cuál de los dos llegó.
   */
  readonly codigoAeat: string | undefined;
  /**
   * The raw response body, when one arrived and could not be understood.
   *
   * Va aquí porque es justo cuando más falta hace y cuando más fácil es perderlo: si el cuerpo no
   * se puede parsear, se descarta al salir del `try` y quien depura se queda con la frase del
   * error. En la sonda S-4 pasó exactamente eso — el SOAP Fault se perdió y la conclusión se salvó
   * de milagro, porque el mensaje llevaba el texto dentro.
   *
   * Una respuesta de la AEAT a un registro real **no se puede volver a pedir**.
   */
  readonly cuerpo: string | undefined;

  constructor(args: {
    code: VerifactuClientErrorCode;
    message: string;
    causaProbable: string;
    accionSugerida: string;
    estado?: number;
    codigoAeat?: string;
    cuerpo?: string;
    cause?: unknown;
  }) {
    super(args.message);
    this.name = 'VerifactuClientError';
    this.code = args.code;
    this.causaProbable = args.causaProbable;
    this.accionSugerida = args.accionSugerida;
    this.estado = args.estado;
    this.codigoAeat = args.codigoAeat ?? codigoAeatDe(args.cause);
    this.cuerpo = args.cuerpo;
    if (args.cause !== undefined) this.cause = args.cause;
  }
}

/**
 * Reads `codigoAeat` off whatever was thrown underneath.
 *
 * El código lo extrae `@verifactu-js/xml` al parsear el fault, y aquí solo se hereda. Se lee por
 * forma y no por `instanceof`: dos copias del paquete en el árbol de dependencias romperían la
 * comprobación de clase, y perder el código por un problema de instalación sería absurdo.
 */
function codigoAeatDe(causa: unknown): string | undefined {
  const codigo = (causa as { codigoAeat?: unknown } | null | undefined)?.codigoAeat;
  return typeof codigo === 'string' ? codigo : undefined;
}
