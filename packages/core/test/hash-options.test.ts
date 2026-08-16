/**
 * Web Crypto access and the injectable digest.
 *
 * `options.sha256` is the only door through which a malformed hash could enter the package,
 * so its output is validated as strictly as our own.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  hashRegistroAlta,
  hashRegistroAnulacion,
  sha256HexUpper,
  TIPO_HUELLA_SHA256,
  VerifactuError,
} from '../src/index.js';

import {
  V1_ALTA_FIRST,
  V1_ALTA_FIRST_FIELDS,
  V3_ANULACION,
  V3_ANULACION_FIELDS,
} from './fixtures/official-vectors.js';

const VALID_LOWERCASE = V1_ALTA_FIRST.expectedHash.toLowerCase();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TIPO_HUELLA_SHA256', () => {
  it('is "01", the only value of list L12', () => {
    expect(TIPO_HUELLA_SHA256).toBe('01');
  });
});

describe('injected digest (HashOptions.sha256)', () => {
  it('is used instead of Web Crypto', async () => {
    const sha256 = vi.fn(() => V1_ALTA_FIRST.expectedHash);
    const result = await sha256HexUpper('anything at all', { sha256 });

    expect(sha256).toHaveBeenCalledOnce();
    expect(sha256).toHaveBeenCalledWith('anything at all');
    expect(result).toBe(V1_ALTA_FIRST.expectedHash);
  });

  it('receives the canonical string, not the raw fields', async () => {
    const sha256 = vi.fn(() => V1_ALTA_FIRST.expectedHash);
    await hashRegistroAlta(V1_ALTA_FIRST_FIELDS, { sha256 });
    expect(sha256).toHaveBeenCalledWith(V1_ALTA_FIRST.canonicalString);
  });

  it('is awaited when it returns a promise', async () => {
    const sha256 = () => Promise.resolve(V1_ALTA_FIRST.expectedHash);
    await expect(sha256HexUpper('x', { sha256 })).resolves.toBe(V1_ALTA_FIRST.expectedHash);
  });

  it('has its lowercase output upper-cased', async () => {
    const sha256 = () => VALID_LOWERCASE;
    await expect(sha256HexUpper('x', { sha256 })).resolves.toBe(V1_ALTA_FIRST.expectedHash);
  });

  it('is honoured by hashRegistroAnulacion too', async () => {
    const sha256 = vi.fn(() => V3_ANULACION.expectedHash);
    await expect(hashRegistroAnulacion(V3_ANULACION_FIELDS, { sha256 })).resolves.toBe(
      V3_ANULACION.expectedHash,
    );
    expect(sha256).toHaveBeenCalledWith(V3_ANULACION.canonicalString);
  });
});

describe('injected digest output is validated (spec-notes §1.6)', () => {
  async function expectRejection(sha256: () => string): Promise<VerifactuError> {
    try {
      await sha256HexUpper('x', { sha256 });
    } catch (error) {
      expect(error).toBeInstanceOf(VerifactuError);
      return error as VerifactuError;
    }
    return expect.unreachable('expected the call to reject');
  }

  it.each([
    ['too short', 'ABC'],
    ['63 characters', '0'.repeat(63)],
    ['65 characters', '0'.repeat(65)],
    ['empty', ''],
    ['non-hex characters', 'Z'.repeat(64)],
    ['base64-looking', `${'A'.repeat(43)}=`],
    ['hex with spaces', ` ${'A'.repeat(63)}`],
  ])('rejects %s with code HUELLA_FORMATO_INVALIDO', async (_label, value) => {
    const error = await expectRejection(() => value);
    expect(error.code).toBe('HUELLA_FORMATO_INVALIDO');
  });

  it('explains that the injected function is at fault', async () => {
    const error = await expectRejection(() => 'nope');
    expect(error.causaProbable).toContain('sha256');
  });

  it('accepts a correctly formatted digest of either case', async () => {
    await expect(sha256HexUpper('x', { sha256: () => VALID_LOWERCASE })).resolves.toMatch(
      /^[0-9A-F]{64}$/,
    );
  });
});

describe('Web Crypto availability', () => {
  it('produces 64 uppercase hex characters on this runtime', async () => {
    await expect(sha256HexUpper('')).resolves.toMatch(/^[0-9A-F]{64}$/);
  });

  it('throws WEBCRYPTO_NO_DISPONIBLE when globalThis.crypto is missing', async () => {
    vi.stubGlobal('crypto', undefined);
    try {
      await sha256HexUpper('x');
      expect.unreachable('expected the call to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(VerifactuError);
      expect((error as VerifactuError).code).toBe('WEBCRYPTO_NO_DISPONIBLE');
      expect((error as VerifactuError).accionSugerida).toContain('sha256');
    }
  });

  it('throws WEBCRYPTO_NO_DISPONIBLE when crypto exists without subtle', async () => {
    vi.stubGlobal('crypto', {} as Crypto);
    await expect(sha256HexUpper('x')).rejects.toMatchObject({
      code: 'WEBCRYPTO_NO_DISPONIBLE',
    });
  });

  it('rejects a malformed digest coming from Web Crypto itself', async () => {
    // A 16-byte digest would render as 32 hex characters. Defensive path: it should not be
    // possible, but if the runtime ever misbehaves we must not emit a short hash.
    vi.stubGlobal('crypto', {
      subtle: { digest: () => Promise.resolve(new Uint8Array(16).buffer) },
    } as unknown as Crypto);

    try {
      await sha256HexUpper('x');
      expect.unreachable('expected the call to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(VerifactuError);
      expect((error as VerifactuError).code).toBe('HUELLA_FORMATO_INVALIDO');
      // Blames the runtime, not the caller's injected function.
      expect((error as VerifactuError).causaProbable).toContain('Web Crypto');
      expect((error as VerifactuError).causaProbable).not.toContain('sha256');
    }
  });

  it('an injected digest still works when Web Crypto is absent', async () => {
    vi.stubGlobal('crypto', undefined);
    await expect(sha256HexUpper('x', { sha256: () => V1_ALTA_FIRST.expectedHash })).resolves.toBe(
      V1_ALTA_FIRST.expectedHash,
    );
  });
});
