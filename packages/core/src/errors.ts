/**
 * Errors carry a machine-readable code plus, in Spanish, a probable cause and a corrective
 * action. Per VERIFACTU-BRIEF.md §2 (principle 5), end-user facing text is Spanish; identifiers
 * and TSDoc are English.
 */

/** Stable, machine-readable error codes emitted by `@verifactu/core`. Branch on these, not on prose. */
export type VerifactuErrorCode =
  /** A field that must already be a serialised string was given another type. */
  | 'IMPORTE_NO_SERIALIZADO'
  /** A required field was missing, `null` or of an unusable type. */
  | 'CAMPO_REQUERIDO'
  /** A value carries edge whitespace whose correct treatment is undocumented (I-01). */
  | 'ESPACIO_AMBIGUO_EN_BORDE'
  /** A series/invoice number carries a character the AEAT forbids there. */
  | 'CARACTER_NO_PERMITIDO'
  /** A digest is not 64 uppercase hexadecimal characters. */
  | 'HUELLA_FORMATO_INVALIDO'
  /** The runtime does not recognise the IANA time zone, or none was given. */
  | 'ZONA_HORARIA_DESCONOCIDA'
  /** The `Date` handed in is not a valid instant. */
  | 'INSTANTE_INVALIDO'
  /** No Web Crypto implementation is reachable in this runtime. */
  | 'WEBCRYPTO_NO_DISPONIBLE';

/** Base error for every failure raised by `@verifactu/core`. */
export class VerifactuError extends Error {
  /** Stable, machine-readable code. Safe to branch on. */
  readonly code: VerifactuErrorCode;
  /** Probable cause, in Spanish, for the developer integrating the library. */
  readonly causaProbable: string;
  /** Suggested corrective action, in Spanish. */
  readonly accionSugerida: string;
  /** Pointer to the relevant section of `docs/spec-notes.md`, when there is one. */
  readonly referencia: string | undefined;

  constructor(args: {
    code: VerifactuErrorCode;
    message: string;
    causaProbable: string;
    accionSugerida: string;
    referencia?: string;
  }) {
    super(args.message);
    this.name = 'VerifactuError';
    this.code = args.code;
    this.causaProbable = args.causaProbable;
    this.accionSugerida = args.accionSugerida;
    this.referencia = args.referencia;
  }
}

/**
 * Guards against the single most damaging mistake a JavaScript caller can make: passing an
 * amount as a `number`.
 *
 * `String(131.40)` is `"131.4"`, and `String(0.1 + 0.2)` is `"0.30000000000000004"`. Either
 * would be hashed verbatim and silently produce a record the AEAT accepts but flags as
 * "Aceptado con errores" (docs/spec-notes.md §8.7). Amounts must be serialised exactly once,
 * by the caller, and that same string must feed both the XML and the hash
 * (docs/spec-notes.md §1.7, D-1).
 */
export function assertSerialisedString(fieldName: string, value: unknown): asserts value is string {
  if (typeof value === 'string') return;

  if (typeof value === 'number' || typeof value === 'bigint') {
    throw new VerifactuError({
      code: 'IMPORTE_NO_SERIALIZADO',
      message:
        `El campo «${fieldName}» se ha recibido como ${typeof value} (${String(value)}) ` +
        'y debe ser una cadena de texto ya serializada.',
      causaProbable:
        'La huella se calcula sobre el literal exacto que aparece en el XML. Si se pasa un ' +
        'número, JavaScript elige la representación por su cuenta: String(131.40) es "131.4" ' +
        'y String(0.1 + 0.2) es "0.30000000000000004". Esa cadena entraría en la huella y ' +
        'dejaría de coincidir con la que recalcula la AEAT.',
      accionSugerida:
        `Serializa el importe una sola vez y usa esa MISMA cadena para el XML y para la ` +
        `huella. Ejemplo: { ${fieldName}: "131.40" }. Nunca reformatees entre ambos pasos.`,
      referencia: 'docs/spec-notes.md §1.7 y §10 (D-1)',
    });
  }

  throw new VerifactuError({
    code: 'CAMPO_REQUERIDO',
    message: `El campo «${fieldName}» es obligatorio y debe ser una cadena de texto.`,
    causaProbable: `Se ha recibido ${value === null ? 'null' : typeof value}.`,
    accionSugerida: `Informa «${fieldName}» con su valor exacto tal y como aparecerá en el XML del registro.`,
    referencia: 'docs/spec-notes.md §1.1 y §2.1',
  });
}

/**
 * Rejects a value whose first or last character is whitespace that Java's `String.trim()`
 * keeps but `String.prototype.trim()` removes — no-break space, ideographic space, BOM and
 * friends.
 *
 * For those characters we cannot know which digest the AEAT will compute, because the trim
 * semantics it applies when recomputing are undocumented (I-01). Rather than guess, we refuse.
 * The project's rule is correctness over progress.
 */
export function assertNoAmbiguousEdgeWhitespace(fieldName: string, value: string): void {
  if (value === value.trim()) return;

  throw new VerifactuError({
    code: 'ESPACIO_AMBIGUO_EN_BORDE',
    message:
      `El campo «${fieldName}» empieza o acaba con un espacio Unicode que no es un espacio ` +
      'ASCII (por ejemplo NBSP U+00A0, U+2003 o el BOM U+FEFF).',
    causaProbable:
      'La AEAT especifica «eliminando los espacios al inicio y al final de cada valor», y su ' +
      'implementación de referencia en Java recorta solo los caracteres <= U+0020, por lo que ' +
      'conservaría ese carácter. Un recorte estilo JavaScript lo eliminaría. Las dos opciones ' +
      'dan huellas distintas y no está documentado cuál aplica la AEAT al recalcular.',
    accionSugerida:
      `Limpia «${fieldName}» antes de pasarlo: decide tú si ese carácter forma parte del valor ` +
      'y, si no, elimínalo. Así el literal del XML y la huella quedan sin ambigüedad.',
    referencia: 'docs/spec-notes.md §11, I-01 (BLOQUEA-ESTABLE)',
  });
}

/**
 * Characters the AEAT forbids inside a series + invoice number, with their ASCII codes.
 *
 * Validaciones v1.2.2 §3.1.3.1: «NumSerieFactura solo puede contener caracteres ASCII del 32 a
 * 126 (caracteres imprimibles), no permitiéndose la existencia de los siguientes caracteres».
 */
const CARACTERES_PROHIBIDOS_SERIE: ReadonlyArray<readonly [string, number]> = [
  ['"', 34],
  ["'", 39],
  ['<', 60],
  ['>', 62],
  ['=', 61],
];

/**
 * Validates a series + invoice number against the AEAT's character rules.
 *
 * The `=` prohibition is what keeps the canonical hash string unforgeable. That string uses `&`
 * and `=` as separators and escapes nothing, so forging a field boundary would need the
 * sequence `&Nombre=` inside a value — and `=` cannot appear. `&` on its own is harmless and is
 * *not* rejected: the AEAT permits it, and refusing it would block legitimate invoices.
 *
 * See docs/spec-notes.md §18 for the full analysis (I-28).
 *
 * TODO(verify: I-28) — §3.1.3.1 documents this for `NumSerieFactura` only. We apply it to
 * `NumSerieFacturaAnulada` as well: an anulación cancels an invoice whose series had to pass the
 * alta validation, so a series with `=` could not legitimately exist. That is reasoning, not a
 * citation. Also undocumented: whether a breach rejects the record or merely flags it.
 */
export function assertSerieValida(fieldName: string, value: string): void {
  for (const [character, code] of CARACTERES_PROHIBIDOS_SERIE) {
    if (!value.includes(character)) continue;

    throw new VerifactuError({
      code: 'CARACTER_NO_PERMITIDO',
      message: `El campo «${fieldName}» contiene el carácter «${character}» (ASCII ${code}), que la AEAT no admite ahí.`,
      causaProbable:
        'El documento de validaciones de la AEAT (v1.2.2, §3.1.3.1) prohíbe " \' < > y = en el ' +
        'número de serie y factura. La prohibición del «=» no es cosmética: la cadena sobre la ' +
        'que se calcula la huella usa «=» y «&» como separadores y no escapa nada, así que un ' +
        '«=» dentro del valor permitiría fabricar dos registros distintos con la misma huella.',
      accionSugerida:
        `Elimina el carácter «${character}» de «${fieldName}». Si tu numeración lo usa, tendrás ` +
        'que cambiarla: la AEAT rechazará esa serie. El «&» sí está permitido.',
      referencia: 'docs/spec-notes.md §18 (I-28); AEAT Validaciones v1.2.2 §3.1.3.1',
    });
  }

  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 32 && code <= 126) continue;

    throw new VerifactuError({
      code: 'CARACTER_NO_PERMITIDO',
      message:
        `El campo «${fieldName}» contiene un carácter fuera de ASCII 32-126 ` +
        `(código ${code}, posición ${i}).`,
      causaProbable:
        'La AEAT solo admite caracteres ASCII imprimibles en el número de serie y factura ' +
        '(Validaciones v1.2.2, §3.1.3.1). Suelen colarse acentos, la Ñ, o un guion tipográfico ' +
        'copiado desde un procesador de textos.',
      accionSugerida:
        `Sustituye ese carácter en «${fieldName}» por su equivalente ASCII. Ojo con los guiones ` +
        'largos (–, —) y las comillas tipográficas, que se parecen mucho a los ASCII.',
      referencia: 'docs/spec-notes.md §18 (I-28); AEAT Validaciones v1.2.2 §3.1.3.1',
    });
  }
}

/** A digest as the specification defines it: 64 uppercase hexadecimal characters. */
const HUELLA_PATTERN = /^[0-9A-F]{64}$/;

/**
 * Asserts that `value` is a well-formed digest.
 *
 * The AEAT does not reject a record whose hash is wrong: it stores it and flags it as
 * "Aceptado con errores" (docs/spec-notes.md §8.7). A malformed digest would therefore travel
 * all the way to production without anything failing loudly, so we check it here.
 *
 * @param source - Where the digest came from, so the message can point at the real culprit.
 */
export function assertHuellaFormat(value: string, source: 'webcrypto' | 'inyectada'): void {
  if (HUELLA_PATTERN.test(value)) return;

  const injected = source === 'inyectada';

  throw new VerifactuError({
    code: 'HUELLA_FORMATO_INVALIDO',
    message:
      `La huella obtenida no tiene el formato exigido (64 caracteres hexadecimales en ` +
      `mayúsculas). Se han recibido ${value.length} caracteres: «${value.slice(0, 80)}».`,
    causaProbable: injected
      ? 'La función pasada en la opción { sha256 } no ha devuelto un SHA-256 en hexadecimal. ' +
        'Suele ocurrir al devolver base64, un Buffer/Uint8Array convertido con toString(), o ' +
        'el resultado de otro algoritmo.'
      : 'La implementación de Web Crypto del entorno ha devuelto un valor inesperado.',
    accionSugerida: injected
      ? 'Haz que { sha256 } devuelva 64 caracteres hexadecimales. En Node: ' +
        "createHash('sha256').update(s, 'utf8').digest('hex')."
      : 'Comunica el entorno y su versión como incidencia: no debería poder ocurrir.',
    referencia: 'docs/spec-notes.md §1.6',
  });
}
