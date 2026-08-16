/**
 * Canonicalisation: Java trim semantics, field rendering, and the literal values that
 * `@verifactu/xml` must write.
 *
 * Whitespace is expressed as numeric code points and built with `String.fromCharCode`, never
 * pasted as literal characters: an invisible byte in a test file is a test nobody can review.
 *
 * See docs/spec-notes.md §1.3 and §1.3.1.
 */
import { describe, expect, it } from 'vitest';

import {
  buildRegistroAltaHashInput,
  buildRegistroAnulacionHashInput,
  canonicalizeRegistroAlta,
  canonicalizeRegistroAnulacion,
  canonicalizeValue,
  hasAmbiguousEdgeWhitespace,
  renderField,
  trimJava,
  VerifactuError,
} from '../src/index.js';

import {
  V1_ALTA_FIRST,
  V1_ALTA_FIRST_FIELDS,
  V3_ANULACION,
  V3_ANULACION_FIELDS,
} from './fixtures/official-vectors.js';

/** Builds a one-character string from a code point. */
const ch = (codePoint: number): string => String.fromCharCode(codePoint);

/** Renders a code point as `U+00A0` for readable test names. */
const label = (codePoint: number): string =>
  `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;

/** Code units Java's `String.trim()` removes: everything `<= U+0020`. */
const JAVA_TRIMMABLE: ReadonlyArray<readonly [string, number]> = [
  ['null', 0x00],
  ['tab', 0x09],
  ['line feed', 0x0a],
  ['vertical tab', 0x0b],
  ['form feed', 0x0c],
  ['carriage return', 0x0d],
  ['unit separator', 0x1f],
  ['space', 0x20],
].map(([name, cp]) => [`${name as string} ${label(cp as number)}`, cp as number] as const);

/**
 * Code units `String.prototype.trim()` removes but Java's `String.trim()` keeps.
 * This is exactly the set that makes I-01 dangerous.
 */
const AMBIGUOUS_WHITESPACE: ReadonlyArray<readonly [string, number]> = [
  ['no-break space', 0x00a0],
  ['en quad', 0x2000],
  ['em space', 0x2003],
  ['narrow no-break space', 0x202f],
  ['ideographic space', 0x3000],
  ['zero width no-break space', 0xfeff],
].map(([name, cp]) => [`${name as string} ${label(cp as number)}`, cp as number] as const);

describe('trimJava — removes only code units <= U+0020', () => {
  it.each(JAVA_TRIMMABLE)('strips %s from both edges', (_name, codePoint) => {
    expect(trimJava(`${ch(codePoint)}ABC${ch(codePoint)}`)).toBe('ABC');
  });

  it('strips a mixed run of control characters', () => {
    expect(trimJava('\t\n\r  ABC  \r\n\t')).toBe('ABC');
  });

  it.each(AMBIGUOUS_WHITESPACE)(
    'preserves %s, unlike String.prototype.trim',
    (_name, codePoint) => {
      const padded = `${ch(codePoint)}ABC${ch(codePoint)}`;
      expect(trimJava(padded)).toBe(padded);
      expect(padded.trim()).toBe('ABC');
      expect(trimJava(padded)).not.toBe(padded.trim());
    },
  );

  it('preserves interior whitespace (official example: "12345678 / G33")', () => {
    expect(trimJava('    12345678 / G33  ')).toBe('12345678 / G33');
  });

  it('collapses nothing: repeated interior spaces survive', () => {
    expect(trimJava('  A   B  ')).toBe('A   B');
  });

  it('returns the same reference when there is nothing to trim', () => {
    const untouched = 'ABC';
    expect(trimJava(untouched)).toBe(untouched);
  });

  it('handles all-whitespace and empty input', () => {
    expect(trimJava('   ')).toBe('');
    expect(trimJava('')).toBe('');
  });
});

describe('hasAmbiguousEdgeWhitespace — the I-01 danger zone', () => {
  it.each(AMBIGUOUS_WHITESPACE)('flags a leading %s', (_name, codePoint) => {
    expect(hasAmbiguousEdgeWhitespace(`${ch(codePoint)}ABC`)).toBe(true);
  });

  it.each(AMBIGUOUS_WHITESPACE)('flags a trailing %s', (_name, codePoint) => {
    expect(hasAmbiguousEdgeWhitespace(`ABC${ch(codePoint)}`)).toBe(true);
  });

  it('flags an ambiguous character hidden behind ASCII padding', () => {
    expect(hasAmbiguousEdgeWhitespace(`  ${ch(0x00a0)}ABC${ch(0x00a0)}  `)).toBe(true);
  });

  it.each([
    ['clean', 'ABC'],
    ['ASCII padded', '  ABC  '],
    ['tab and newline padded', '\tABC\n'],
    ['interior ASCII space only', 'A B'],
    ['empty', ''],
    ['all ASCII whitespace', '   '],
  ])('does not flag %s', (_name, value) => {
    expect(hasAmbiguousEdgeWhitespace(value)).toBe(false);
  });

  it('does not flag an interior no-break space', () => {
    expect(hasAmbiguousEdgeWhitespace(`A${ch(0x00a0)}B`)).toBe(false);
  });
});

describe('canonicalizeValue', () => {
  it('returns null for absent or empty values', () => {
    expect(canonicalizeValue('Huella', null)).toBeNull();
    expect(canonicalizeValue('Huella', undefined)).toBeNull();
    expect(canonicalizeValue('Huella', '')).toBeNull();
    expect(canonicalizeValue('Huella', '   ')).toBeNull();
  });

  it('returns the Java-trimmed value otherwise', () => {
    expect(canonicalizeValue('NumSerieFactura', '  12345678 / G33 ')).toBe('12345678 / G33');
  });

  it('rejects a value whose edges sit in the I-01 ambiguity zone', () => {
    let captured: unknown;
    try {
      canonicalizeValue('NumSerieFactura', `${ch(0x00a0)}A-1`);
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(VerifactuError);
    expect((captured as VerifactuError).code).toBe('ESPACIO_AMBIGUO_EN_BORDE');
  });
});

describe('renderField', () => {
  it('renders name=value', () => {
    expect(renderField('TipoFactura', 'F1')).toBe('TipoFactura=F1');
  });

  it('renders bare "name=" for null, undefined and empty', () => {
    expect(renderField('Huella', null)).toBe('Huella=');
    expect(renderField('Huella', undefined)).toBe('Huella=');
    expect(renderField('Huella', '')).toBe('Huella=');
  });

  it('trims before rendering', () => {
    expect(renderField('NumSerieFactura', '  12345678 / G33  ')).toBe(
      'NumSerieFactura=12345678 / G33',
    );
  });
});

describe('canonicalize* — the literals @verifactu/xml must write (spec-notes §1.3.1)', () => {
  it('alta: exposes trimmed field values alongside the hashed string', () => {
    const raw = { ...V1_ALTA_FIRST_FIELDS, NumSerieFactura: '    12345678/G33  ' };
    const { fields, hashInput } = canonicalizeRegistroAlta(raw);

    expect(fields.NumSerieFactura).toBe('12345678/G33');
    expect(hashInput).toBe(V1_ALTA_FIRST.canonicalString);
  });

  it('alta: the exposed fields reproduce the hashed string exactly (round trip)', () => {
    const raw = { ...V1_ALTA_FIRST_FIELDS, NumSerieFactura: '  12345678/G33 ' };
    const { fields, hashInput } = canonicalizeRegistroAlta(raw);
    expect(buildRegistroAltaHashInput(fields)).toBe(hashInput);
  });

  it('alta: canonicalisation is idempotent', () => {
    const once = canonicalizeRegistroAlta(V1_ALTA_FIRST_FIELDS);
    const twice = canonicalizeRegistroAlta(once.fields);
    expect(twice.fields).toEqual(once.fields);
    expect(twice.hashInput).toBe(once.hashInput);
  });

  it('alta: preserves a null previous hash as null, not as an empty string', () => {
    const { fields } = canonicalizeRegistroAlta(V1_ALTA_FIRST_FIELDS);
    expect(fields.Huella).toBeNull();
  });

  it('anulacion: exposes trimmed field values alongside the hashed string', () => {
    const raw = { ...V3_ANULACION_FIELDS, NumSerieFacturaAnulada: '\t12345679/G34\n' };
    const { fields, hashInput } = canonicalizeRegistroAnulacion(raw);

    expect(fields.NumSerieFacturaAnulada).toBe('12345679/G34');
    expect(hashInput).toBe(V3_ANULACION.canonicalString);
    expect(buildRegistroAnulacionHashInput(fields)).toBe(hashInput);
  });

  it('anulacion: canonicalisation is idempotent', () => {
    const once = canonicalizeRegistroAnulacion(V3_ANULACION_FIELDS);
    const twice = canonicalizeRegistroAnulacion(once.fields);
    expect(twice.fields).toEqual(once.fields);
    expect(twice.hashInput).toBe(once.hashInput);
  });

  it('anulacion: an empty required field degrades to "" and renders as "name="', () => {
    const { fields, hashInput } = canonicalizeRegistroAnulacion({
      ...V3_ANULACION_FIELDS,
      NumSerieFacturaAnulada: '   ',
    });
    expect(fields.NumSerieFacturaAnulada).toBe('');
    expect(hashInput).toContain('&NumSerieFacturaAnulada=&');
  });

  it('rejects ambiguous edge whitespace anywhere in the record', () => {
    expect(() =>
      canonicalizeRegistroAlta({
        ...V1_ALTA_FIRST_FIELDS,
        NumSerieFactura: `A-1${ch(0x00a0)}`,
      }),
    ).toThrowError(VerifactuError);
  });
});
