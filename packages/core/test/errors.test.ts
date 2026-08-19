/**
 * Error contract. The `code` is the stable API; the Spanish prose is for humans.
 * Branching on message text is a bug, so every assertion here checks `code`.
 */
import { describe, expect, it } from 'vitest';

import { assertSerialisedString, renderField, VerifactuError } from '../src/index.js';

/** Runs `fn`, asserts it threw a `VerifactuError`, and returns it. */
function captureVerifactuError(fn: () => unknown): VerifactuError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(VerifactuError);
    return error as VerifactuError;
  }
  return expect.unreachable('expected the call to throw a VerifactuError');
}

describe('assertSerialisedString', () => {
  it('accepts a string and narrows the type', () => {
    const value: unknown = '131.40';
    expect(() => {
      assertSerialisedString('ImporteTotal', value);
    }).not.toThrow();
  });

  it.each([
    ['number', 131.4],
    ['number with float error', 0.1 + 0.2],
    ['integer', 42],
  ])('rejects a %s with code IMPORTE_NO_SERIALIZADO', (_label, value) => {
    const error = captureVerifactuError(() => {
      assertSerialisedString('ImporteTotal', value);
    });
    expect(error.code).toBe('IMPORTE_NO_SERIALIZADO');
  });

  it('rejects a bigint with code IMPORTE_NO_SERIALIZADO', () => {
    const error = captureVerifactuError(() => {
      assertSerialisedString('ImporteTotal', 131n);
    });
    expect(error.code).toBe('IMPORTE_NO_SERIALIZADO');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an object', { toString: () => '131.40' }],
    ['an array', ['131.40']],
    ['a boolean', true],
  ])('rejects %s with code CAMPO_REQUERIDO', (_label, value) => {
    const error = captureVerifactuError(() => {
      assertSerialisedString('ImporteTotal', value);
    });
    expect(error.code).toBe('CAMPO_REQUERIDO');
  });

  it('names the offending field and points at the specification', () => {
    const error = captureVerifactuError(() => {
      assertSerialisedString('CuotaTotal', 21.4);
    });
    expect(error.message).toContain('CuotaTotal');
    expect(error.causaProbable).toContain('131.4');
    expect(error.accionSugerida).toContain('CuotaTotal');
    expect(error.referencia).toContain('spec-notes');
  });

  it('is a real Error subclass with a stable name', () => {
    const error = captureVerifactuError(() => {
      assertSerialisedString('CuotaTotal', 1);
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('VerifactuError');
    expect(typeof error.stack).toBe('string');
  });

  it('leaves referencia undefined when there is nothing to cite', () => {
    const bare = new VerifactuError({
      code: 'CAMPO_REQUERIDO',
      message: 'x',
      causaProbable: 'y',
      accionSugerida: 'z',
    });
    expect(bare.referencia).toBeUndefined();
  });
});

describe('renderField surfaces the same errors', () => {
  it('a numeric amount reaching renderField is rejected, not stringified', () => {
    const error = captureVerifactuError(() =>
      // Simulates an untyped JavaScript caller.
      renderField('ImporteTotal', 131.4 as unknown as string),
    );
    expect(error.code).toBe('IMPORTE_NO_SERIALIZADO');
  });

  it('ambiguous edge whitespace is rejected with ESPACIO_AMBIGUO_EN_BORDE', () => {
    // El NBSP va con escape: pegado en crudo es indistinguible de un espacio normal, y este
    // test dejaría de probar lo que dice en cuanto alguien 'normalizara los espacios'.
    const serieConNbsp = 'A-1\u00a0';
    const error = captureVerifactuError(() => renderField('NumSerieFactura', serieConNbsp));
    expect(error.code).toBe('ESPACIO_AMBIGUO_EN_BORDE');
    expect(error.referencia).toContain('I-01');
  });
});
