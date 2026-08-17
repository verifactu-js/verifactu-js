/**
 * Amount arithmetic.
 *
 * These rules exist to catch discrepancies of a few cents, so the arithmetic that evaluates them
 * cannot introduce any of its own.
 */
import { describe, expect, it } from 'vitest';

import {
  aCentesimas,
  aCentimos,
  aFecha,
  cuotaEsperada,
  deCentimos,
  dentroDelMargen,
  signo,
} from '../src/importes.js';

describe('aCentimos', () => {
  it.each([
    ['121.00', 12100],
    ['121.5', 12150],
    ['121', 12100],
    ['0.01', 1],
    ['0', 0],
    ['-50.25', -5025],
    ['+50.25', 5025],
    ['999999999999.99', 99999999999999],
  ])('reads %s', (texto, esperado) => {
    expect(aCentimos(texto)).toBe(esperado);
  });

  it.each([['1,50'], ['1.234'], [''], ['abc'], ['1e3'], ['1234567890123.00'], [' 1.00']])(
    'rejects %s',
    (texto) => {
      expect(aCentimos(texto)).toBeNull();
    },
  );

  it('reads an absent amount as absent, not as zero', () => {
    expect(aCentimos(undefined)).toBeNull();
  });

  it('does not lose cents the way floating point would', () => {
    // 0.1 + 0.2 === 0.30000000000000004
    const suma = (aCentimos('0.10') ?? 0) + (aCentimos('0.20') ?? 0);
    expect(suma).toBe(30);
    expect(deCentimos(suma)).toBe('0.30');
  });

  it('adds a thousand lines of 0.01 without drifting', () => {
    let total = 0;
    for (let i = 0; i < 1000; i += 1) total += aCentimos('0.01') ?? 0;
    expect(deCentimos(total)).toBe('10.00');
  });
});

describe('aCentesimas', () => {
  it.each([
    ['21', 2100],
    ['7.5', 750],
    ['0.26', 26],
    ['0', 0],
    ['10', 1000],
  ])('reads the rate %s', (texto, esperado) => {
    expect(aCentesimas(texto)).toBe(esperado);
  });

  it.each([['210'], ['7,5'], ['1.234'], ['']])('rejects %s', (texto) => {
    expect(aCentesimas(texto)).toBeNull();
  });

  it('reads an absent rate as absent', () => {
    expect(aCentesimas(undefined)).toBeNull();
  });
});

describe('deCentimos', () => {
  it.each([
    [12100, '121.00'],
    [1, '0.01'],
    [0, '0.00'],
    [-5025, '-50.25'],
    [-1, '-0.01'],
  ])('renders %i as %s', (centimos, esperado) => {
    expect(deCentimos(centimos)).toBe(esperado);
  });
});

describe('cuotaEsperada', () => {
  it('applies the rate in cents', () => {
    expect(cuotaEsperada(10_000, 2100)).toBe(2100);
    expect(cuotaEsperada(11_110, 2100)).toBe(2333);
  });

  it('rounds away from zero on both sides, not towards positive infinity', () => {
    // Math.round(-0.5) is -0, which would make a negative line round differently from its
    // positive mirror image.
    expect(cuotaEsperada(-10_000, 2100)).toBe(-2100);
    expect(cuotaEsperada(1, 5000)).toBe(1);
    expect(cuotaEsperada(-1, 5000)).toBe(-1);
  });

  it('handles a zero rate', () => {
    expect(cuotaEsperada(10_000, 0)).toBe(0);
  });
});

describe('dentroDelMargen', () => {
  it('accepts exactly ten euros of difference, and refuses one cent more', () => {
    expect(dentroDelMargen(0, 1000)).toBe(true);
    expect(dentroDelMargen(0, 1001)).toBe(false);
    expect(dentroDelMargen(0, -1000)).toBe(true);
    expect(dentroDelMargen(0, -1001)).toBe(false);
  });
});

describe('signo', () => {
  it.each([
    [5, 1],
    [-5, -1],
    [0, 0],
  ])('of %i is %i', (valor, esperado) => {
    expect(signo(valor)).toBe(esperado);
  });
});

describe('aFecha', () => {
  it('reads dd-mm-yyyy as a UTC calendar date', () => {
    expect(aFecha('28-10-2024')).toBe(Date.UTC(2024, 9, 28));
  });

  it('does not depend on the local time zone', () => {
    // Read as local time, 01-01-2025 in Madrid would be 31-12-2024 in UTC, and a rule keyed on a
    // year boundary would fire differently depending on where the server is.
    const fecha = aFecha('01-01-2025');
    expect(new Date(fecha ?? 0).getUTCFullYear()).toBe(2025);
    expect(new Date(fecha ?? 0).getUTCMonth()).toBe(0);
    expect(new Date(fecha ?? 0).getUTCDate()).toBe(1);
  });

  it.each([['31-02-2025'], ['00-01-2025'], ['32-01-2025'], ['01-13-2025']])(
    'rejects the impossible date %s instead of rolling it over',
    (texto) => {
      expect(aFecha(texto)).toBeNull();
    },
  );

  it.each([['2025-01-01'], ['1-1-2025'], [''], ['abc']])('rejects the shape %s', (texto) => {
    expect(aFecha(texto)).toBeNull();
  });

  it('reads an absent date as absent', () => {
    expect(aFecha(undefined)).toBeNull();
  });

  it('accepts a leap day in a leap year and rejects it otherwise', () => {
    expect(aFecha('29-02-2024')).not.toBeNull();
    expect(aFecha('29-02-2025')).toBeNull();
  });
});
