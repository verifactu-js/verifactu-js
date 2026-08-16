/**
 * NIF checking. See docs/spec-notes.md §11, I-25 for the decision and its justification.
 */
import { describe, expect, it } from 'vitest';

import { validateNif } from '../src/index.js';

describe('DNI-based NIF of a natural person — hard error', () => {
  it('accepts 89890001K, the NIF used throughout the AEAT documentation', () => {
    const result = validateNif('89890001K');
    expect(result.ok).toBe(true);
    expect(result.tipo).toBe('nif-persona-fisica');
    expect(result.severidad).toBeNull();
  });

  it('rejects a wrong control letter as an error, naming the expected one', () => {
    const result = validateNif('89890001A');
    expect(result.ok).toBe(false);
    expect(result.severidad).toBe('error');
    expect(result.esperado).toBe('K');
  });

  it.each(['00000000T', '12345678Z', '99999999R'])('accepts %s', (nif) => {
    expect(validateNif(nif).ok).toBe(true);
  });
});

describe('NIE — hard error', () => {
  it.each([
    ['X0000000T', true],
    ['Z0000000M', true],
    ['X0000000A', false],
  ])('%s -> ok=%s', (nie, expected) => {
    const result = validateNif(nie);
    expect(result.ok).toBe(expected);
    expect(result.tipo).toBe('nie');
    if (!expected) expect(result.severidad).toBe('error');
  });

  it('maps the prefix X/Y/Z to 0/1/2 rather than treating it as a letter', () => {
    // Y1234567 must behave like 11234567.
    expect(validateNif('Y1234567').tipo).toBe('desconocido'); // 8 chars, not a NIE
    expect(validateNif('X0000000T').ok).toBe(true);
  });
});

describe('K / L / M natural-person NIF — hard error', () => {
  it('accepts a correct one', () => {
    // 0000000 % 23 = 0 -> 'T'
    const result = validateNif('K0000000T');
    expect(result.ok).toBe(true);
    expect(result.tipo).toBe('nif-persona-fisica-klm');
  });

  it('rejects a wrong one as an error', () => {
    const result = validateNif('K0000000A');
    expect(result.ok).toBe(false);
    expect(result.severidad).toBe('error');
  });
});

describe('entity NIF ("CIF") — warning, not error', () => {
  it('accepts B72877814', () => {
    const result = validateNif('B72877814');
    expect(result.ok).toBe(true);
    expect(result.tipo).toBe('nif-entidad');
  });

  it('accepts B44531218', () => {
    expect(validateNif('B44531218').ok).toBe(true);
  });

  it('downgrades a wrong control character to a warning, with justification', () => {
    const result = validateNif('B72877810');
    expect(result.ok).toBe(false);
    expect(result.severidad).toBe('aviso');
    expect(result.esperado).toBe('4');
    expect(result.motivo).toContain('EHA/451/2008');
  });

  // For the seven digits 0000000 the computed control is digit 0, letter 'J'.
  it('requires a letter for entity types N, P, Q, R, S and W', () => {
    expect(validateNif('P0000000J').ok).toBe(true);
    const conDigito = validateNif('P00000000');
    expect(conDigito.ok).toBe(false);
    expect(conDigito.severidad).toBe('aviso');
    expect(conDigito.esperado).toBe('J');
  });

  it('requires a digit for entity types A, B, E and H', () => {
    expect(validateNif('B00000000').ok).toBe(true);
    const conLetra = validateNif('B0000000J');
    expect(conLetra.ok).toBe(false);
    expect(conLetra.esperado).toBe('0');
  });

  it('accepts either representation for the remaining entity types', () => {
    // J is neither letter-only nor digit-only, so both spellings are admissible.
    expect(validateNif('J00000000').ok).toBe(true);
    expect(validateNif('J0000000J').ok).toBe(true);
  });
});

describe('unrecognised shapes', () => {
  it.each(['', '1234', 'ABCDEFGHI', '891K', '123456789', 'I0000000J'])(
    'reports %j as an unknown shape, with error severity',
    (value) => {
      const result = validateNif(value);
      expect(result.ok).toBe(false);
      expect(result.tipo).toBe('desconocido');
      expect(result.severidad).toBe('error');
    },
  );

  it('points foreign parties at IDOtro instead of NIF', () => {
    expect(validateNif('NOT-A-NIF').motivo).toContain('IDOtro');
  });

  it('never throws, whatever it is handed', () => {
    for (const value of [undefined, null, 42, {}, []] as unknown[]) {
      expect(() => validateNif(value as string)).not.toThrow();
      expect(validateNif(value as string).ok).toBe(false);
    }
  });
});

describe('normalisation', () => {
  it('is case-insensitive and tolerates surrounding whitespace', () => {
    expect(validateNif('  89890001k  ').ok).toBe(true);
    expect(validateNif('  89890001k  ').value).toBe('89890001K');
  });

  it('does not mutate the caller value beyond trim and upper-casing', () => {
    expect(validateNif('b72877814').value).toBe('B72877814');
  });
});

describe('validation is decoupled from hashing', () => {
  it('a NIF that fails validation is still hashable — that is the point', async () => {
    const { hashRegistroAlta } = await import('../src/index.js');
    const invalid = '89890001A';
    expect(validateNif(invalid).ok).toBe(false);

    await expect(
      hashRegistroAlta({
        IDEmisorFactura: invalid,
        NumSerieFactura: '12345678/G33',
        FechaExpedicionFactura: '01-01-2024',
        TipoFactura: 'F1',
        CuotaTotal: '12.35',
        ImporteTotal: '123.45',
        Huella: null,
        FechaHoraHusoGenRegistro: '2024-01-01T19:20:30+01:00',
      }),
    ).resolves.toMatch(/^[0-9A-F]{64}$/);
  });
});
