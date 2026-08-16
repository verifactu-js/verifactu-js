/**
 * The four golden vectors. If any of these fails, the library is wrong — full stop.
 * See docs/spec-notes.md §1.8, §2.3, §1.9.
 */
import { describe, expect, it } from 'vitest';

import {
  buildRegistroAltaHashInput,
  buildRegistroAnulacionHashInput,
  hashRegistroAlta,
  hashRegistroAnulacion,
  sha256HexUpper,
} from '../src/index.js';

import {
  ALL_VECTORS,
  V1_ALTA_FIRST,
  V1_ALTA_FIRST_FIELDS,
  V2_ALTA_CHAINED,
  V2_ALTA_CHAINED_FIELDS,
  V3_ANULACION,
  V3_ANULACION_FIELDS,
  V4_MDIAGO,
  V4_MDIAGO_FIELDS,
} from './fixtures/official-vectors.js';

describe('golden vectors — canonical string is byte-exact', () => {
  it('V1: builds the AEAT §6.1 string (alta, first record, empty previous hash)', () => {
    expect(buildRegistroAltaHashInput(V1_ALTA_FIRST_FIELDS)).toBe(V1_ALTA_FIRST.canonicalString);
  });

  it('V2: builds the AEAT §6.2 string (alta, chained)', () => {
    expect(buildRegistroAltaHashInput(V2_ALTA_CHAINED_FIELDS)).toBe(
      V2_ALTA_CHAINED.canonicalString,
    );
  });

  it('V3: builds the AEAT §6.3 string (anulación, five fields, Anulada suffixes)', () => {
    expect(buildRegistroAnulacionHashInput(V3_ANULACION_FIELDS)).toBe(V3_ANULACION.canonicalString);
  });

  it('V4: builds the mdiago cross-check string (one-decimal amounts preserved verbatim)', () => {
    expect(buildRegistroAltaHashInput(V4_MDIAGO_FIELDS)).toBe(V4_MDIAGO.canonicalString);
  });
});

describe('golden vectors — SHA-256 of the canonical string', () => {
  it.each(ALL_VECTORS.map((v) => [v.id, v] as const))('%s hashes correctly', async (_id, v) => {
    await expect(sha256HexUpper(v.canonicalString)).resolves.toBe(v.expectedHash);
  });
});

describe('golden vectors — end to end, fields in, hash out', () => {
  it('V1', async () => {
    await expect(hashRegistroAlta(V1_ALTA_FIRST_FIELDS)).resolves.toBe(V1_ALTA_FIRST.expectedHash);
  });

  it('V2', async () => {
    await expect(hashRegistroAlta(V2_ALTA_CHAINED_FIELDS)).resolves.toBe(
      V2_ALTA_CHAINED.expectedHash,
    );
  });

  it('V3', async () => {
    await expect(hashRegistroAnulacion(V3_ANULACION_FIELDS)).resolves.toBe(
      V3_ANULACION.expectedHash,
    );
  });

  it('V4', async () => {
    await expect(hashRegistroAlta(V4_MDIAGO_FIELDS)).resolves.toBe(V4_MDIAGO.expectedHash);
  });
});

describe('golden vectors — output format', () => {
  it.each(ALL_VECTORS.map((v) => [v.id, v] as const))(
    '%s output is 64 uppercase hex characters',
    async (_id, v) => {
      const hash = await sha256HexUpper(v.canonicalString);
      expect(hash).toMatch(/^[0-9A-F]{64}$/);
    },
  );
});
