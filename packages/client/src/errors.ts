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

  constructor(args: {
    code: VerifactuClientErrorCode;
    message: string;
    causaProbable: string;
    accionSugerida: string;
    estado?: number;
    cause?: unknown;
  }) {
    super(args.message);
    this.name = 'VerifactuClientError';
    this.code = args.code;
    this.causaProbable = args.causaProbable;
    this.accionSugerida = args.accionSugerida;
    this.estado = args.estado;
    if (args.cause !== undefined) this.cause = args.cause;
  }
}
