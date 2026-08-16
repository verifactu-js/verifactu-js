/**
 * Characters allowed in a series + invoice number, and why `&` is not among the forbidden ones.
 *
 * See docs/spec-notes.md §18 (I-28) and AEAT Validaciones v1.2.2 §3.1.3.1.
 */
import { describe, expect, it } from 'vitest';

import {
  buildRegistroAltaHashInput,
  canonicalizeRegistroAlta,
  canonicalizeRegistroAnulacion,
  hashRegistroAlta,
  VerifactuError,
  type VerifactuErrorCode,
} from '../src/index.js';

import { V1_ALTA_FIRST_FIELDS, V3_ANULACION_FIELDS } from './fixtures/official-vectors.js';

function codeOf(fn: () => unknown): VerifactuErrorCode | 'NO_LANZO' {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(VerifactuError);
    return (error as VerifactuError).code;
  }
  return 'NO_LANZO';
}

describe('the five characters the AEAT forbids (Validaciones v1.2.2 §3.1.3.1)', () => {
  it.each([
    ['comilla doble', '"', 34],
    ['comilla simple', "'", 39],
    ['menor que', '<', 60],
    ['mayor que', '>', 62],
    ['igual', '=', 61],
  ])('rejects %s (ASCII %i) in NumSerieFactura', (_label, character) => {
    const code = codeOf(() =>
      canonicalizeRegistroAlta({ ...V1_ALTA_FIRST_FIELDS, NumSerieFactura: `A${character}B` }),
    );
    expect(code).toBe('CARACTER_NO_PERMITIDO');
  });

  it.each([['"'], ["'"], ['<'], ['>'], ['=']])(
    'rejects %s in NumSerieFacturaAnulada too',
    (character) => {
      const code = codeOf(() =>
        canonicalizeRegistroAnulacion({
          ...V3_ANULACION_FIELDS,
          NumSerieFacturaAnulada: `A${character}B`,
        }),
      );
      expect(code).toBe('CARACTER_NO_PERMITIDO');
    },
  );

  it('names the character and its ASCII code, and cites the source', () => {
    try {
      canonicalizeRegistroAlta({ ...V1_ALTA_FIRST_FIELDS, NumSerieFactura: 'A=B' });
      expect.unreachable('should have thrown');
    } catch (error) {
      const e = error as VerifactuError;
      expect(e.message).toContain('ASCII 61');
      expect(e.causaProbable).toContain('misma huella');
      expect(e.referencia).toContain('§18');
      expect(e.accionSugerida).toContain('«&» sí está permitido');
    }
  });
});

describe('"&" is legal and must stay legal', () => {
  it('is accepted in NumSerieFactura', () => {
    const { fields } = canonicalizeRegistroAlta({
      ...V1_ALTA_FIRST_FIELDS,
      NumSerieFactura: 'A&B',
    });
    expect(fields.NumSerieFactura).toBe('A&B');
  });

  it('is accepted in NumSerieFacturaAnulada', () => {
    const { fields } = canonicalizeRegistroAnulacion({
      ...V3_ANULACION_FIELDS,
      NumSerieFacturaAnulada: 'A&B',
    });
    expect(fields.NumSerieFacturaAnulada).toBe('A&B');
  });

  it('appears unescaped in the canonical string, as the AEAT specifies', () => {
    const s = buildRegistroAltaHashInput({ ...V1_ALTA_FIRST_FIELDS, NumSerieFactura: 'A&B' });
    expect(s).toContain('&NumSerieFactura=A&B&FechaExpedicionFactura=');
  });

  it('still produces a distinct hash from a series without it', async () => {
    const conAmpersand = await hashRegistroAlta({
      ...V1_ALTA_FIRST_FIELDS,
      NumSerieFactura: 'A&B',
    });
    const sinAmpersand = await hashRegistroAlta({
      ...V1_ALTA_FIRST_FIELDS,
      NumSerieFactura: 'AB',
    });
    expect(conAmpersand).not.toBe(sinAmpersand);
  });

  it('cannot be used to forge a field boundary, because "=" is rejected', () => {
    // The forgery would need the sequence "&Nombre=" inside the value. Without "=", it cannot
    // be written at all — which is the whole reason the AEAT forbids "=" and not "&".
    const code = codeOf(() =>
      canonicalizeRegistroAlta({
        ...V1_ALTA_FIRST_FIELDS,
        NumSerieFactura: 'A&FechaExpedicionFactura=01-01-2024',
      }),
    );
    expect(code).toBe('CARACTER_NO_PERMITIDO');
  });
});

describe('printable ASCII only', () => {
  it.each([
    ['acento', 'SERIE-Ñ'],
    ['guion largo', 'SERIE—A'],
    ['comilla tipografica', 'SERIE“A'],
  ])('rejects %s', (_label, value) => {
    expect(
      codeOf(() => canonicalizeRegistroAlta({ ...V1_ALTA_FIRST_FIELDS, NumSerieFactura: value })),
    ).toBe('CARACTER_NO_PERMITIDO');
  });

  it('reports the offending position', () => {
    try {
      canonicalizeRegistroAlta({ ...V1_ALTA_FIRST_FIELDS, NumSerieFactura: 'ABCÑ' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as VerifactuError).message).toContain('posición 3');
    }
  });

  it('accepts the whole legal printable range', () => {
    // ASCII 33..126 minus the five forbidden characters. Space is excluded only because a
    // leading/trailing one would be trimmed; interior spaces are fine and tested elsewhere.
    const forbidden = new Set(['"', "'", '<', '>', '=']);
    let legal = '';
    for (let code = 33; code <= 126; code += 1) {
      const ch = String.fromCharCode(code);
      if (!forbidden.has(ch)) legal += ch;
    }
    // 94 printable characters minus the five forbidden ones.
    expect(legal.length).toBe(89);

    // NumSerieFactura tops out at 60 characters, so feed it in two halves and accept both.
    for (const chunk of [legal.slice(0, 45), legal.slice(45)]) {
      const { fields } = canonicalizeRegistroAlta({
        ...V1_ALTA_FIRST_FIELDS,
        NumSerieFactura: chunk,
      });
      expect(fields.NumSerieFactura).toBe(chunk);
    }
  });
});

describe('the restriction applies only to the series fields', () => {
  it('does not reject "=" in other fields', () => {
    // Nothing else in the hash input is free text, but the check must not leak into them:
    // DescripcionOperacion and friends are not restricted by §3.1.3.1.
    expect(() =>
      canonicalizeRegistroAlta({ ...V1_ALTA_FIRST_FIELDS, TipoFactura: 'F1' }),
    ).not.toThrow();
  });
});
