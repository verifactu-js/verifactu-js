/**
 * The canonical brand, and the route back from a database.
 *
 * The brand stops `@verifactu-js/xml` from serialising raw caller input, which would decouple
 * the XML literal from the hashed value (docs/spec-notes.md §1.3.1). The cost is that a record
 * read back from storage arrives unbranded — so there has to be a way back, and it has to be
 * safe. That way is re-canonicalisation, which is idempotent.
 */
import { describe, expect, it } from 'vitest';

import {
  type Canonical,
  canonicalizeRegistroAlta,
  canonicalizeRegistroAnulacion,
  createSifChain,
  type EslabonAlta,
  type RegistroAltaHashInput,
  verifyChain,
} from '../src/index.js';

import {
  V1_ALTA_FIRST,
  V1_ALTA_FIRST_FIELDS,
  V3_ANULACION_FIELDS,
} from './fixtures/official-vectors.js';

/** Stands in for `@verifactu-js/xml`: only accepts canonical fields. */
function serialiseLikeXmlPackage(fields: Canonical<RegistroAltaHashInput>): string {
  return fields.NumSerieFactura;
}

describe('the brand is required where the literal matters', () => {
  it('accepts what canonicalizeRegistroAlta returns', () => {
    const { fields } = canonicalizeRegistroAlta(V1_ALTA_FIRST_FIELDS);
    expect(serialiseLikeXmlPackage(fields)).toBe('12345678/G33');
  });

  it('accepts what createSifChain produced', async () => {
    const chain = createSifChain({
      timeZone: 'Europe/Madrid',
      now: () => new Date('2024-01-01T18:20:30Z'),
    });
    const link = await chain.alta({
      IDEmisorFactura: '89890001K',
      NumSerieFactura: '12345678/G33',
      FechaExpedicionFactura: '01-01-2024',
      TipoFactura: 'F1',
      CuotaTotal: '12.35',
      ImporteTotal: '123.45',
      previous: null,
    });

    expect(serialiseLikeXmlPackage(link.fields)).toBe('12345678/G33');
    expect(link.huella).toBe(V1_ALTA_FIRST.expectedHash);
  });

  it('rejects a plain object at compile time', () => {
    // @ts-expect-error a raw field object has no brand: this is the whole point.
    expect(() => serialiseLikeXmlPackage(V1_ALTA_FIRST_FIELDS)).not.toThrow();
  });
});

describe('the way back from storage', () => {
  /** Simulates a database round trip: structure survives, brand does not. */
  const fromDatabase = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

  it('re-canonicalising recovered data returns it branded', () => {
    const stored: RegistroAltaHashInput = fromDatabase(V1_ALTA_FIRST_FIELDS);
    const { fields } = canonicalizeRegistroAlta(stored);
    expect(serialiseLikeXmlPackage(fields)).toBe('12345678/G33');
  });

  it('is a no-op on data that was already canonical', () => {
    const original = canonicalizeRegistroAlta(V1_ALTA_FIRST_FIELDS);
    const recovered = canonicalizeRegistroAlta(fromDatabase(original.fields));

    expect(recovered.fields).toEqual(original.fields);
    expect(recovered.hashInput).toBe(original.hashInput);
  });

  it('the recovered record still reproduces the stored hash', async () => {
    const chain = createSifChain({
      timeZone: 'Europe/Madrid',
      now: () => new Date('2024-01-01T18:20:30Z'),
    });
    const generated = await chain.alta({
      IDEmisorFactura: '89890001K',
      NumSerieFactura: '12345678/G33',
      FechaExpedicionFactura: '01-01-2024',
      TipoFactura: 'F1',
      CuotaTotal: '12.35',
      ImporteTotal: '123.45',
      previous: null,
    });

    const stored: EslabonAlta = fromDatabase(generated);
    const { fields, hashInput } = canonicalizeRegistroAlta(stored.fields);

    expect(fields).toEqual(generated.fields);
    expect(hashInput).toBe(V1_ALTA_FIRST.canonicalString);
    await expect(verifyChain([stored])).resolves.toMatchObject({ ok: true });
  });

  it('works for anulación too', () => {
    const stored = fromDatabase(V3_ANULACION_FIELDS);
    const once = canonicalizeRegistroAnulacion(stored);
    const twice = canonicalizeRegistroAnulacion(fromDatabase(once.fields));
    expect(twice.fields).toEqual(once.fields);
    expect(twice.hashInput).toBe(once.hashInput);
  });
});

describe('verification does not need the brand', () => {
  it('verifyChain accepts unbranded links read back from storage', async () => {
    const chain = createSifChain({
      timeZone: 'Atlantic/Canary',
      now: () => new Date('2024-01-15T12:00:00Z'),
    });
    const link = await chain.alta({
      IDEmisorFactura: '89890001K',
      NumSerieFactura: 'A/1',
      FechaExpedicionFactura: '15-01-2024',
      TipoFactura: 'F1',
      CuotaTotal: '0.00',
      ImporteTotal: '0.00',
      previous: null,
    });

    const stored: EslabonAlta = JSON.parse(JSON.stringify(link));
    await expect(verifyChain([stored])).resolves.toMatchObject({ ok: true });
  });

  it('a canonical link is assignable to the plain link type', async () => {
    const chain = createSifChain({ timeZone: 'UTC', now: () => new Date('2024-01-15T12:00:00Z') });
    const link = await chain.alta({
      IDEmisorFactura: '89890001K',
      NumSerieFactura: 'A/1',
      FechaExpedicionFactura: '15-01-2024',
      TipoFactura: 'F1',
      CuotaTotal: '0.00',
      ImporteTotal: '0.00',
      previous: null,
    });

    const asPlain: EslabonAlta = link;
    expect(asPlain.huella).toBe(link.huella);
  });
});
