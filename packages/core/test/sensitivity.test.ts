/**
 * Sensitivity tests: proof that the encoding is exact rather than approximate.
 *
 * The AEAT accepts a record whose hash is wrong — it just flags it as "Aceptado con errores"
 * and stores it anyway (docs/spec-notes.md §8.7). A smoke test against preproduction therefore
 * proves nothing. These tests are the real defence.
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
  type AltaVectorFields,
  type AnulacionVectorFields,
  V1_ALTA_FIRST,
  V1_ALTA_FIRST_FIELDS,
  V1_HASH_LOWERCASE,
  V1_WITH_TRAILING_NEWLINE,
  V3_ANULACION,
  V3_ANULACION_FIELDS,
  V4_MDIAGO,
  V4_MDIAGO_FIELDS,
} from './fixtures/official-vectors.js';

describe('input is not padded or terminated', () => {
  it('appending a trailing newline changes the hash', async () => {
    await expect(sha256HexUpper(V1_WITH_TRAILING_NEWLINE.input)).resolves.toBe(
      V1_WITH_TRAILING_NEWLINE.expectedHash,
    );
    expect(V1_WITH_TRAILING_NEWLINE.expectedHash).not.toBe(V1_ALTA_FIRST.expectedHash);
  });

  it('the canonical string has no trailing "&"', () => {
    expect(buildRegistroAltaHashInput(V1_ALTA_FIRST_FIELDS).endsWith('&')).toBe(false);
    expect(buildRegistroAnulacionHashInput(V3_ANULACION_FIELDS).endsWith('&')).toBe(false);
  });

  it('the canonical string is pure ASCII for the official vector (199 bytes)', () => {
    const s = buildRegistroAltaHashInput(V1_ALTA_FIRST_FIELDS);
    expect(new TextEncoder().encode(s).length).toBe(199);
    expect(s.length).toBe(199);
  });
});

describe('output casing is part of the format', () => {
  it('does not emit lowercase hex', async () => {
    const hash = await hashRegistroAlta(V1_ALTA_FIRST_FIELDS);
    expect(hash).not.toBe(V1_HASH_LOWERCASE);
    expect(hash).toBe(V1_HASH_LOWERCASE.toUpperCase());
  });
});

describe('amounts are hashed verbatim — the "serialise once" rule (spec-notes §1.7, D-1)', () => {
  it('zero-padding an amount to two decimals produces a DIFFERENT hash', async () => {
    const padded: AltaVectorFields = {
      ...V4_MDIAGO_FIELDS,
      CuotaTotal: '21.40',
      ImporteTotal: '131.40',
    };
    const hash = await hashRegistroAlta(padded);
    expect(hash).not.toBe(V4_MDIAGO.expectedHash);
  });

  it('the library never reformats an amount it was given', () => {
    const s = buildRegistroAltaHashInput(V4_MDIAGO_FIELDS);
    expect(s).toContain('&CuotaTotal=21.4&');
    expect(s).toContain('&ImporteTotal=131.4&');
  });
});

describe('every field of RegistroAlta is load-bearing (spec-notes §1.1)', () => {
  const mutations: ReadonlyArray<readonly [keyof AltaVectorFields, string]> = [
    ['IDEmisorFactura', '89890001L'],
    ['NumSerieFactura', '12345678/G34'],
    ['FechaExpedicionFactura', '02-01-2024'],
    ['TipoFactura', 'F2'],
    ['CuotaTotal', '12.36'],
    ['ImporteTotal', '123.46'],
    ['Huella', 'F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97'],
    ['FechaHoraHusoGenRegistro', '2024-01-01T19:20:31+01:00'],
  ];

  it.each(mutations)('changing %s changes the hash', async (field, value) => {
    const mutated = { ...V1_ALTA_FIRST_FIELDS, [field]: value } as AltaVectorFields;
    await expect(hashRegistroAlta(mutated)).resolves.not.toBe(V1_ALTA_FIRST.expectedHash);
  });

  it('covers all eight fields', () => {
    expect(mutations).toHaveLength(8);
    expect(new Set(mutations.map(([f]) => f)).size).toBe(8);
  });
});

describe('every field of RegistroAnulacion is load-bearing (spec-notes §2.1)', () => {
  const mutations: ReadonlyArray<readonly [keyof AnulacionVectorFields, string]> = [
    ['IDEmisorFacturaAnulada', '89890001L'],
    ['NumSerieFacturaAnulada', '12345678/G33'],
    ['FechaExpedicionFacturaAnulada', '02-01-2024'],
    ['Huella', '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60'],
    ['FechaHoraHusoGenRegistro', '2024-01-01T19:20:41+01:00'],
  ];

  it.each(mutations)('changing %s changes the hash', async (field, value) => {
    const mutated = { ...V3_ANULACION_FIELDS, [field]: value } as AnulacionVectorFields;
    await expect(hashRegistroAnulacion(mutated)).resolves.not.toBe(V3_ANULACION.expectedHash);
  });

  it('covers all five fields', () => {
    expect(mutations).toHaveLength(5);
    expect(new Set(mutations.map(([f]) => f)).size).toBe(5);
  });
});

describe('empty previous hash is rendered as "Huella=" (spec-notes §4)', () => {
  it('null previous hash yields the bare field name and "="', () => {
    const s = buildRegistroAltaHashInput(V1_ALTA_FIRST_FIELDS);
    expect(s).toContain('&Huella=&FechaHoraHusoGenRegistro=');
  });

  it('empty string is treated identically to null', () => {
    const withEmpty: AltaVectorFields = { ...V1_ALTA_FIRST_FIELDS, Huella: '' };
    expect(buildRegistroAltaHashInput(withEmpty)).toBe(V1_ALTA_FIRST.canonicalString);
  });

  it('is not 64 zeroes, and not the hash of the empty string', async () => {
    const zeroes: AltaVectorFields = { ...V1_ALTA_FIRST_FIELDS, Huella: '0'.repeat(64) };
    await expect(hashRegistroAlta(zeroes)).resolves.not.toBe(V1_ALTA_FIRST.expectedHash);

    const hashOfEmpty = await sha256HexUpper('');
    const withHashOfEmpty: AltaVectorFields = { ...V1_ALTA_FIRST_FIELDS, Huella: hashOfEmpty };
    await expect(hashRegistroAlta(withHashOfEmpty)).resolves.not.toBe(V1_ALTA_FIRST.expectedHash);
  });
});
