/**
 * Errors raised by `@verifactu-js/xml`.
 *
 * Same shape as `VerifactuError` in `@verifactu-js/core` — machine-readable code, Spanish cause
 * and corrective action — but a separate class with its own code union. Sharing the union would
 * mean `core` had to know about every failure mode of every package that builds on it.
 *
 * Per VERIFACTU-BRIEF.md §2 (principle 5): end-user facing text is Spanish, identifiers and
 * TSDoc are English.
 */

/** Stable, machine-readable error codes emitted by `@verifactu-js/xml`. Branch on these, not on prose. */
export type VerifactuXmlErrorCode =
  /** A value that must already be a serialised string arrived as something else. */
  | 'VALOR_NO_SERIALIZADO'
  /** The writer was driven into a state that cannot produce a well-formed document. */
  | 'DOCUMENTO_MAL_FORMADO'
  /** The chaining block contradicts the `Huella` the record was hashed with. */
  | 'ENCADENAMIENTO_INCOHERENTE'
  /** A repeating element appears fewer or more times than the schema allows. */
  | 'CARDINALIDAD_INVALIDA';

/** Base error for every failure raised by `@verifactu-js/xml`. */
export class VerifactuXmlError extends Error {
  /** Stable, machine-readable code. Safe to branch on. */
  readonly code: VerifactuXmlErrorCode;
  /** Probable cause, in Spanish, for the developer integrating the library. */
  readonly causaProbable: string;
  /** Suggested corrective action, in Spanish. */
  readonly accionSugerida: string;
  /** Pointer to the relevant section of `docs/spec-notes.md`, when there is one. */
  readonly referencia: string | undefined;

  constructor(args: {
    code: VerifactuXmlErrorCode;
    message: string;
    causaProbable: string;
    accionSugerida: string;
    referencia?: string;
  }) {
    super(args.message);
    this.name = 'VerifactuXmlError';
    this.code = args.code;
    this.causaProbable = args.causaProbable;
    this.accionSugerida = args.accionSugerida;
    this.referencia = args.referencia;
  }
}

/** Raises `DOCUMENTO_MAL_FORMADO` with a fixed cause and action. */
export function errorDocumento(message: string, accionSugerida: string): VerifactuXmlError {
  return new VerifactuXmlError({
    code: 'DOCUMENTO_MAL_FORMADO',
    message,
    causaProbable:
      'El XmlWriter se ha usado en un orden que no puede producir un documento bien formado.',
    accionSugerida,
  });
}

/**
 * Guards the single most damaging mistake a JavaScript caller can make here: letting a `number`
 * reach the serialiser.
 *
 * The reasoning is the same as in `core`, and so is the consequence. `String(131.40)` is
 * `"131.4"`: written into the XML it would no longer match the literal the hash was computed
 * over, and the AEAT would accept the record and flag it — not reject it
 * (docs/spec-notes.md §8.7). A template literal would have coerced it silently.
 */
export function assertTextoSerializado(
  qualifiedName: string,
  value: unknown,
): asserts value is string {
  if (typeof value === 'string') return;

  const recibido =
    typeof value === 'number' || typeof value === 'bigint'
      ? `${typeof value} (${String(value)})`
      : value === null
        ? 'null'
        : typeof value;

  throw new VerifactuXmlError({
    code: 'VALOR_NO_SERIALIZADO',
    message: `El contenido de «${qualifiedName}» se ha recibido como ${recibido} y debe ser una cadena.`,
    causaProbable:
      'Los importes y demás valores se serializan una sola vez, y esa misma cadena alimenta el ' +
      'XML y la huella. Si aquí llega un número, JavaScript elige la representación por su ' +
      'cuenta: String(131.40) es "131.4". El literal del XML dejaría de coincidir con el que se ' +
      'hasheó, y la AEAT no rechaza ese registro: lo marca como «Aceptado con errores».',
    accionSugerida:
      `Pasa «${qualifiedName}» ya serializado, con la misma cadena que usaste para la huella. ` +
      'Ejemplo: "131.40". Nunca reformatees entre el cálculo de la huella y el XML.',
    referencia: 'docs/spec-notes.md §1.7, §8.7 y §10 (D-1)',
  });
}
