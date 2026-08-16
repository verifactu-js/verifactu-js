/**
 * Spanish tax identifier (NIF) checking.
 *
 * ## Why this never throws, and never blocks hashing
 *
 * A wrong NIF still produces a perfectly correct hash — the digest is computed over whatever
 * literal is there. Conflating identity validation with hashing would make the library refuse
 * records it can chain correctly, which is worse than useless. So validation lives here, is
 * opt-in, and returns a report instead of raising.
 *
 * ## What the official sources actually say (docs/spec-notes.md §11, I-25)
 *
 * - The XSD (`SuministroInformacion.xsd`) constrains `NIFType` to `length = 9`. Nothing else.
 * - The AEAT validation document v1.2.2 never checks a control character. It requires the NIF
 *   to "estar identificado en la AEAT" — a census lookup, which an offline library cannot do.
 * - Orden EHA/451/2008 art. 2 defines the composition of an entity's NIF —
 *   «a) Una letra… b) Un número aleatorio de siete dígitos. c) Un carácter de control» — and
 *   arts. 3 to 5 list the entity-type letters. **It does not publish the algorithm that
 *   produces the control character.**
 *
 * So there is no official, citable algorithm for any of these check characters. That asymmetry
 * drives the severity split below.
 *
 * ## Decision
 *
 * | Kind | Severity | Why |
 * |---|---|---|
 * | DNI (`8 digits + letter`) | `error` | The mod-23 letter is deterministic, universal, and has no documented exception. A mismatch is a typo. |
 * | NIE (`X/Y/Z + 7 digits + letter`) | `error` | Same algorithm after mapping X→0, Y→1, Z→2. |
 * | K / L / M (natural persons) | `error` | Same mod-23 rule over the seven digits. |
 * | Entity NIF, "CIF" | `aviso` | The control character algorithm is **not** in the norm that defines the NIF's composition. Enforcing it hard would mean rejecting on an unofficial rule, and legacy identifiers do circulate. |
 * | Anything else | `error` | Cannot be a Spanish NIF in any shape. |
 *
 * The asymmetry is deliberate: we are strict where the rule is certain and advisory where our
 * source is folklore, however well established.
 *
 * TODO(verify: I-25) — If the AEAT ever publishes the control-character algorithm, the entity
 * case can be promoted to `error`. See docs/spec-notes.md §11.
 */

/** Which kind of Spanish tax identifier a value looks like. */
export type TipoIdentificacion =
  /** DNI-based NIF of a natural person: eight digits plus a control letter. */
  | 'nif-persona-fisica'
  /** Special natural-person NIF beginning with K, L or M. */
  | 'nif-persona-fisica-klm'
  /** Foreigner identity number: X, Y or Z plus seven digits plus a control letter. */
  | 'nie'
  /** NIF of a legal entity, historically "CIF". */
  | 'nif-entidad'
  /** Matches no known shape. */
  | 'desconocido';

/** How seriously to take a failure. */
export type NifSeveridad = 'error' | 'aviso';

/** Outcome of checking an identifier. */
export interface NifValidacion {
  /** The value as supplied. */
  readonly value: string;
  /** `true` when the control character checks out. */
  readonly ok: boolean;
  /** The shape recognised. */
  readonly tipo: TipoIdentificacion;
  /** `null` when `ok`. Otherwise how seriously to take it — see the module note. */
  readonly severidad: NifSeveridad | null;
  /** Explanation in Spanish. `null` when `ok`. */
  readonly motivo: string | null;
  /** The control character we computed, when one could be computed. */
  readonly esperado?: string;
}

/** Control letters indexed by remainder modulo 23. */
const LETRAS_MOD23 = 'TRWAGMYFPDXBNJZSQVHLCKE';

/** Control letters for entity NIFs, indexed by the computed control digit. */
const LETRAS_ENTIDAD = 'JABCDEFGHI';

/** Entity-type letters whose control character must be a letter. */
const ENTIDAD_SOLO_LETRA = new Set(['N', 'P', 'Q', 'R', 'S', 'W']);

/** Entity-type letters whose control character must be a digit. */
const ENTIDAD_SOLO_DIGITO = new Set(['A', 'B', 'E', 'H']);

const RE_DNI = /^(\d{8})([A-Z])$/;
const RE_KLM = /^([KLM])(\d{7})([A-Z])$/;
const RE_NIE = /^([XYZ])(\d{7})([A-Z])$/;
const RE_ENTIDAD = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/;

function letraMod23(sieteOchoDigitos: string): string {
  return LETRAS_MOD23[Number(sieteOchoDigitos) % 23] as string;
}

/** Control character of an entity NIF, returned as both admissible representations. */
function controlEntidad(digitos: string): { digito: string; letra: string } {
  let suma = 0;
  for (let i = 0; i < 7; i += 1) {
    const d = Number(digitos[i]);
    if (i % 2 === 0) {
      // Odd position counting from one: double it and add the digits of the result.
      const doubled = d * 2;
      suma += doubled > 9 ? doubled - 9 : doubled;
    } else {
      suma += d;
    }
  }
  const digito = (10 - (suma % 10)) % 10;
  return { digito: String(digito), letra: LETRAS_ENTIDAD[digito] as string };
}

function ok(value: string, tipo: TipoIdentificacion): NifValidacion {
  return { value, ok: true, tipo, severidad: null, motivo: null };
}

/**
 * Checks the control character of a Spanish tax identifier.
 *
 * Never throws. Returns a report; the caller decides what to do with it, guided by
 * {@link NifValidacion.severidad}.
 *
 * @example
 * ```ts
 * validateNif('89890001K').ok;   // true  — the NIF used in the AEAT's own examples
 * validateNif('B72877814').ok;   // true  — entity NIF
 * validateNif('89890001A');      // { ok: false, severidad: 'error', esperado: 'K' }
 * validateNif('B72877810');      // { ok: false, severidad: 'aviso', esperado: '4' }
 * ```
 */
export function validateNif(value: string): NifValidacion {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';

  const dni = RE_DNI.exec(raw);
  if (dni) {
    const esperado = letraMod23(dni[1] as string);
    return dni[2] === esperado
      ? ok(raw, 'nif-persona-fisica')
      : {
          value: raw,
          ok: false,
          tipo: 'nif-persona-fisica',
          severidad: 'error',
          motivo: `La letra de control no corresponde a los dígitos: se esperaba «${esperado}».`,
          esperado,
        };
  }

  const klm = RE_KLM.exec(raw);
  if (klm) {
    const esperado = letraMod23(klm[2] as string);
    return klm[3] === esperado
      ? ok(raw, 'nif-persona-fisica-klm')
      : {
          value: raw,
          ok: false,
          tipo: 'nif-persona-fisica-klm',
          severidad: 'error',
          motivo: `La letra de control no corresponde a los dígitos: se esperaba «${esperado}».`,
          esperado,
        };
  }

  const nie = RE_NIE.exec(raw);
  if (nie) {
    const prefijo = { X: '0', Y: '1', Z: '2' }[nie[1] as 'X' | 'Y' | 'Z'];
    const esperado = letraMod23(`${prefijo}${nie[2]}`);
    return nie[3] === esperado
      ? ok(raw, 'nie')
      : {
          value: raw,
          ok: false,
          tipo: 'nie',
          severidad: 'error',
          motivo: `La letra de control del NIE no corresponde: se esperaba «${esperado}».`,
          esperado,
        };
  }

  const entidad = RE_ENTIDAD.exec(raw);
  if (entidad) {
    const tipoEntidad = entidad[1] as string;
    const { digito, letra } = controlEntidad(entidad[2] as string);
    const actual = entidad[3] as string;

    const admiteLetra = !ENTIDAD_SOLO_DIGITO.has(tipoEntidad);
    const admiteDigito = !ENTIDAD_SOLO_LETRA.has(tipoEntidad);

    if ((admiteDigito && actual === digito) || (admiteLetra && actual === letra)) {
      return ok(raw, 'nif-entidad');
    }

    const esperado = ENTIDAD_SOLO_LETRA.has(tipoEntidad)
      ? letra
      : ENTIDAD_SOLO_DIGITO.has(tipoEntidad)
        ? digito
        : `${digito} o ${letra}`;

    return {
      value: raw,
      ok: false,
      tipo: 'nif-entidad',
      severidad: 'aviso',
      motivo:
        `El carácter de control no corresponde a los dígitos: se esperaba «${esperado}». ` +
        'Se avisa en lugar de rechazar porque el algoritmo del carácter de control no está ' +
        'publicado en la Orden EHA/451/2008, que sí define la composición del NIF de entidades.',
      esperado,
    };
  }

  return {
    value: raw,
    ok: false,
    tipo: 'desconocido',
    severidad: 'error',
    motivo:
      'No corresponde a ninguna forma conocida de NIF español (DNI, NIE, K/L/M o NIF de ' +
      'entidad). Recuerda que a un obligado extranjero le corresponde el bloque IDOtro, no NIF.',
  };
}
