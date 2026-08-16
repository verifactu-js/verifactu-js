/**
 * Chaining: generation (`createSifChain`), full-chain verification (`verifyChain`) and the
 * minimum check the regulation demands before generating a record (art. 7.i).
 *
 * The three worked examples of the AEAT hash specification are not three isolated vectors:
 * they are a real chain of three links, alta -> alta -> anulación. They are used here as such.
 * See docs/spec-notes.md §2.3, §4.3 and §4.4.
 */
import { describe, expect, it } from 'vitest';

import {
  createSifChain,
  type Eslabon,
  type EslabonAlta,
  verificarEncadenamientoPrevio,
  verifyChain,
} from '../src/index.js';

import {
  V1_ALTA_FIRST,
  V1_ALTA_FIRST_FIELDS,
  V2_ALTA_CHAINED,
  V2_ALTA_CHAINED_FIELDS,
  V2_REGISTRO_ANTERIOR,
  V3_ANULACION,
  V3_ANULACION_FIELDS,
  V3_REGISTRO_ANTERIOR,
} from './fixtures/official-vectors.js';

/** The official three-link chain, expressed as stored records. */
const OFFICIAL_CHAIN: Eslabon[] = [
  {
    tipo: 'alta',
    fields: V1_ALTA_FIRST_FIELDS,
    huella: V1_ALTA_FIRST.expectedHash,
    registroAnterior: null,
  },
  {
    tipo: 'alta',
    fields: V2_ALTA_CHAINED_FIELDS,
    huella: V2_ALTA_CHAINED.expectedHash,
    registroAnterior: V2_REGISTRO_ANTERIOR,
  },
  {
    tipo: 'anulacion',
    fields: V3_ANULACION_FIELDS,
    huella: V3_ANULACION.expectedHash,
    registroAnterior: V3_REGISTRO_ANTERIOR,
  },
];

const clone = (): Eslabon[] => OFFICIAL_CHAIN.map((link) => ({ ...link }));

describe('verifyChain — the official three-link chain', () => {
  it('accepts it', async () => {
    const result = await verifyChain(OFFICIAL_CHAIN);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.brokenAt).toBeNull();
  });

  it('accepts a single-link chain', async () => {
    const result = await verifyChain([OFFICIAL_CHAIN[0] as Eslabon]);
    expect(result.ok).toBe(true);
  });

  it('reports an empty chain rather than silently passing', async () => {
    const result = await verifyChain([]);
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.code).toBe('CADENA_VACIA');
  });
});

describe('verifyChain — detects alteration', () => {
  it('catches a mutated field in the middle link', async () => {
    const chain = clone();
    chain[1] = {
      ...(chain[1] as EslabonAlta),
      fields: { ...V2_ALTA_CHAINED_FIELDS, ImporteTotal: '999.99' },
    };

    const result = await verifyChain(chain);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(1);
    expect(result.issues.some((i) => i.code === 'HUELLA_NO_COINCIDE')).toBe(true);
  });

  it('catches a mutated field in the first link', async () => {
    const chain = clone();
    chain[0] = {
      ...(chain[0] as EslabonAlta),
      fields: { ...V1_ALTA_FIRST_FIELDS, CuotaTotal: '12.36' },
    };

    const result = await verifyChain(chain);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(0);
  });

  it('catches a tampered stored hash', async () => {
    const chain = clone();
    chain[2] = { ...chain[2]!, huella: 'A'.repeat(64) };

    const result = await verifyChain(chain);
    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(2);
    expect(result.issues.some((i) => i.code === 'HUELLA_NO_COINCIDE')).toBe(true);
  });
});

describe('verifyChain — detects breaks and gaps', () => {
  it('catches a removed link (gap)', async () => {
    const chain = [OFFICIAL_CHAIN[0] as Eslabon, OFFICIAL_CHAIN[2] as Eslabon];
    const result = await verifyChain(chain);

    expect(result.ok).toBe(false);
    expect(result.brokenAt).toBe(1);
    expect(result.issues.some((i) => i.code === 'ENCADENAMIENTO_ROTO')).toBe(true);
  });

  it('catches a reordered chain', async () => {
    const chain = [OFFICIAL_CHAIN[0], OFFICIAL_CHAIN[2], OFFICIAL_CHAIN[1]] as Eslabon[];
    const result = await verifyChain(chain);
    expect(result.ok).toBe(false);
  });

  it('catches a first link that claims a predecessor', async () => {
    const chain = [{ ...(OFFICIAL_CHAIN[1] as EslabonAlta) }, ...clone().slice(1)] as Eslabon[];

    const result = await verifyChain(chain);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'PRIMER_REGISTRO_INCOHERENTE')).toBe(true);
  });

  it('catches a non-first link declared as first', async () => {
    const chain = clone();
    chain[1] = { ...(chain[1] as EslabonAlta), registroAnterior: null };

    const result = await verifyChain(chain);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'PRIMER_REGISTRO_INCOHERENTE')).toBe(true);
  });

  it('catches an inconsistent RegistroAnterior identity', async () => {
    const chain = clone();
    chain[2] = {
      ...chain[2]!,
      registroAnterior: { ...V3_REGISTRO_ANTERIOR, NumSerieFactura: 'OTRA/SERIE' },
    };

    const result = await verifyChain(chain);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'ANTERIOR_NO_COINCIDE')).toBe(true);
  });
});

describe('verifyChain — the NIF may legitimately change between links (spec-notes §4.3)', () => {
  it('does not assume a constant NIF', async () => {
    // A merger changes the issuer's NIF mid-chain. The record design contemplates this
    // explicitly: RegistroAnterior/IDEmisorFactura exists precisely for these cases.
    const chain = await buildChainWithNifChange();
    const result = await verifyChain(chain);

    expect(result.ok).toBe(true);
    expect((chain[0] as EslabonAlta).fields.IDEmisorFactura).not.toBe(
      (chain[1] as EslabonAlta).fields.IDEmisorFactura,
    );
  });
});

async function buildChainWithNifChange(): Promise<Eslabon[]> {
  const chain = createSifChain({
    timeZone: 'Atlantic/Canary',
    now: () => new Date('2024-01-15T12:00:00Z'),
  });

  const first = await chain.alta({
    IDEmisorFactura: '89890001K',
    NumSerieFactura: 'A/1',
    FechaExpedicionFactura: '15-01-2024',
    TipoFactura: 'F1',
    CuotaTotal: '21.00',
    ImporteTotal: '121.00',
    previous: null,
  });

  const second = await chain.alta({
    IDEmisorFactura: 'B72877814', // different NIF after a merger
    NumSerieFactura: 'A/2',
    FechaExpedicionFactura: '15-01-2024',
    TipoFactura: 'F1',
    CuotaTotal: '21.00',
    ImporteTotal: '121.00',
    previous: first,
  });

  return [first, second];
}

describe('createSifChain — generation', () => {
  const fixedNow = new Date('2024-01-15T12:00:00Z');

  it('produces a first link with PrimerRegistro semantics and an empty previous hash', async () => {
    const chain = createSifChain({ timeZone: 'Atlantic/Canary', now: () => fixedNow });
    const link = await chain.alta({
      IDEmisorFactura: '89890001K',
      NumSerieFactura: '12345678/G33',
      FechaExpedicionFactura: '01-01-2024',
      TipoFactura: 'F1',
      CuotaTotal: '12.35',
      ImporteTotal: '123.45',
      previous: null,
    });

    expect(link.registroAnterior).toBeNull();
    expect(link.fields.Huella).toBeNull();
    expect(link.fields.FechaHoraHusoGenRegistro).toBe('2024-01-15T12:00:00+00:00');
    expect(link.huella).toMatch(/^[0-9A-F]{64}$/);
  });

  it('reproduces the official V1 hash when fed the official inputs and instant', async () => {
    const chain = createSifChain({
      timeZone: 'Europe/Madrid',
      now: () => new Date('2024-01-01T18:20:30Z'), // 19:20:30+01:00 in Madrid
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

    expect(link.fields.FechaHoraHusoGenRegistro).toBe('2024-01-01T19:20:30+01:00');
    expect(link.huella).toBe(V1_ALTA_FIRST.expectedHash);
  });

  it('chains a second link to the first, carrying its identity and hash', async () => {
    const chain = createSifChain({
      timeZone: 'Europe/Madrid',
      now: () => new Date('2024-01-01T18:20:35Z'),
    });
    const first: EslabonAlta = {
      tipo: 'alta',
      fields: V1_ALTA_FIRST_FIELDS,
      huella: V1_ALTA_FIRST.expectedHash,
      registroAnterior: null,
    };

    const second = await chain.alta({
      IDEmisorFactura: '89890001K',
      NumSerieFactura: '12345679/G34',
      FechaExpedicionFactura: '01-01-2024',
      TipoFactura: 'F1',
      CuotaTotal: '12.35',
      ImporteTotal: '123.45',
      previous: first,
    });

    expect(second.registroAnterior).toEqual(V2_REGISTRO_ANTERIOR);
    expect(second.fields.Huella).toBe(V1_ALTA_FIRST.expectedHash);
    expect(second.huella).toBe(V2_ALTA_CHAINED.expectedHash);
  });

  it('reproduces the official V3 anulación hash', async () => {
    const chain = createSifChain({
      timeZone: 'Europe/Madrid',
      now: () => new Date('2024-01-01T18:20:40Z'),
    });
    const previous: EslabonAlta = {
      tipo: 'alta',
      fields: V2_ALTA_CHAINED_FIELDS,
      huella: V2_ALTA_CHAINED.expectedHash,
      registroAnterior: V2_REGISTRO_ANTERIOR,
    };

    const link = await chain.anulacion({
      IDEmisorFacturaAnulada: '89890001K',
      NumSerieFacturaAnulada: '12345679/G34',
      FechaExpedicionFacturaAnulada: '01-01-2024',
      previous,
    });

    expect(link.huella).toBe(V3_ANULACION.expectedHash);
    expect(link.registroAnterior).toEqual(V3_REGISTRO_ANTERIOR);
  });

  it('generating the whole official chain end to end reproduces all three hashes', async () => {
    const instants = [
      new Date('2024-01-01T18:20:30Z'),
      new Date('2024-01-01T18:20:35Z'),
      new Date('2024-01-01T18:20:40Z'),
    ];
    let index = 0;
    const chain = createSifChain({
      timeZone: 'Europe/Madrid',
      now: () => instants[index++] as Date,
    });

    const first = await chain.alta({
      IDEmisorFactura: '89890001K',
      NumSerieFactura: '12345678/G33',
      FechaExpedicionFactura: '01-01-2024',
      TipoFactura: 'F1',
      CuotaTotal: '12.35',
      ImporteTotal: '123.45',
      previous: null,
    });
    const second = await chain.alta({
      IDEmisorFactura: '89890001K',
      NumSerieFactura: '12345679/G34',
      FechaExpedicionFactura: '01-01-2024',
      TipoFactura: 'F1',
      CuotaTotal: '12.35',
      ImporteTotal: '123.45',
      previous: first,
    });
    const third = await chain.anulacion({
      IDEmisorFacturaAnulada: '89890001K',
      NumSerieFacturaAnulada: '12345679/G34',
      FechaExpedicionFacturaAnulada: '01-01-2024',
      previous: second,
    });

    expect([first.huella, second.huella, third.huella]).toEqual([
      V1_ALTA_FIRST.expectedHash,
      V2_ALTA_CHAINED.expectedHash,
      V3_ANULACION.expectedHash,
    ]);
    await expect(verifyChain([first, second, third])).resolves.toMatchObject({ ok: true });
  });

  it('requires an explicit time zone', () => {
    // @ts-expect-error timeZone is mandatory by design.
    expect(() => createSifChain({})).toThrowError();
    // Type-legal but empty: caught at runtime rather than by the compiler.
    expect(() => createSifChain({ timeZone: '' })).toThrowError();
  });

  it('defaults the clock to the real one when none is injected', async () => {
    const before = Date.now();
    const chain = createSifChain({ timeZone: 'UTC' });
    const link = await chain.alta({
      IDEmisorFactura: '89890001K',
      NumSerieFactura: 'REL/1',
      FechaExpedicionFactura: '01-01-2024',
      TipoFactura: 'F1',
      CuotaTotal: '0.00',
      ImporteTotal: '0.00',
      previous: null,
    });

    const generated = Date.parse(link.fields.FechaHoraHusoGenRegistro);
    expect(generated).toBeGreaterThanOrEqual(Math.floor(before / 1000) * 1000);
    expect(generated).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('honours an injected digest implementation', async () => {
    const chain = createSifChain({
      timeZone: 'UTC',
      now: () => fixedNow,
      sha256: () => 'D'.repeat(64),
    });
    const link = await chain.alta({
      IDEmisorFactura: '89890001K',
      NumSerieFactura: 'INY/1',
      FechaExpedicionFactura: '01-01-2024',
      TipoFactura: 'F1',
      CuotaTotal: '0.00',
      ImporteTotal: '0.00',
      previous: null,
    });
    expect(link.huella).toBe('D'.repeat(64));
  });

  it('chains an anulación onto an anulación', async () => {
    const chain = createSifChain({ timeZone: 'UTC', now: () => fixedNow });
    const first = await chain.anulacion({
      IDEmisorFacturaAnulada: '89890001K',
      NumSerieFacturaAnulada: 'ANU/1',
      FechaExpedicionFacturaAnulada: '01-01-2024',
      previous: null,
    });
    const second = await chain.anulacion({
      IDEmisorFacturaAnulada: '89890001K',
      NumSerieFacturaAnulada: 'ANU/2',
      FechaExpedicionFacturaAnulada: '01-01-2024',
      previous: first,
    });

    expect(second.registroAnterior?.NumSerieFactura).toBe('ANU/1');
    expect(second.registroAnterior?.Huella).toBe(first.huella);
    await expect(verifyChain([first, second])).resolves.toMatchObject({ ok: true });
  });

  it('flags a record whose own previous hash contradicts its RegistroAnterior block', async () => {
    const link: EslabonAlta = {
      tipo: 'alta',
      fields: { ...V2_ALTA_CHAINED_FIELDS, Huella: 'E'.repeat(64) },
      huella: V2_ALTA_CHAINED.expectedHash,
      registroAnterior: V2_REGISTRO_ANTERIOR,
    };
    const result = await verifyChain([OFFICIAL_CHAIN[0] as Eslabon, link]);
    expect(result.issues.some((i) => i.code === 'HUELLA_PREVIA_INCOHERENTE')).toBe(true);
  });
});

describe('verificarEncadenamientoPrevio — the minimum check of art. 7.i (spec-notes §4.4)', () => {
  const ahora = new Date('2024-01-01T18:21:00Z');

  it('accepts a correctly chained pair (n-1 verified against n-2)', async () => {
    const result = await verificarEncadenamientoPrevio(
      OFFICIAL_CHAIN[2] as Eslabon,
      OFFICIAL_CHAIN[1] as Eslabon,
      { ahora },
    );
    expect(result.ok).toBe(true);
  });

  it('accepts a first record with no predecessor', async () => {
    const result = await verificarEncadenamientoPrevio(OFFICIAL_CHAIN[0] as Eslabon, null, {
      ahora,
    });
    expect(result.ok).toBe(true);
  });

  it('only looks at two links — it does not walk the whole chain', async () => {
    // Corrupt the first link. A two-link window over links 1 and 2 must still pass, because
    // that is exactly what the regulation asks for.
    const corruptedFirst: Eslabon = {
      ...(OFFICIAL_CHAIN[0] as EslabonAlta),
      huella: 'B'.repeat(64),
    };
    const window = await verificarEncadenamientoPrevio(
      OFFICIAL_CHAIN[2] as Eslabon,
      OFFICIAL_CHAIN[1] as Eslabon,
      { ahora },
    );
    expect(window.ok).toBe(true);

    // The full check does catch it.
    const full = await verifyChain([corruptedFirst, ...clone().slice(1)]);
    expect(full.ok).toBe(false);
  });

  it('rejects when the last record is more than a minute ahead of now', async () => {
    const result = await verificarEncadenamientoPrevio(
      OFFICIAL_CHAIN[2] as Eslabon,
      OFFICIAL_CHAIN[1] as Eslabon,
      { ahora: new Date('2024-01-01T18:19:00Z') }, // record is 1m40s in the future
    );
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'RELOJ_DESFASADO')).toBe(true);
  });

  it('tolerates a record up to one minute ahead', async () => {
    const result = await verificarEncadenamientoPrevio(
      OFFICIAL_CHAIN[2] as Eslabon,
      OFFICIAL_CHAIN[1] as Eslabon,
      { ahora: new Date('2024-01-01T18:19:41Z') }, // exactly 59s in the future
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a record that declares a predecessor when none was supplied', async () => {
    const result = await verificarEncadenamientoPrevio(OFFICIAL_CHAIN[2] as Eslabon, null, {
      ahora,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'PRIMER_REGISTRO_INCOHERENTE')).toBe(true);
  });

  it('rejects a record declared first when a predecessor was supplied', async () => {
    const result = await verificarEncadenamientoPrevio(
      OFFICIAL_CHAIN[0] as Eslabon,
      OFFICIAL_CHAIN[1] as Eslabon,
      { ahora },
    );
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'PRIMER_REGISTRO_INCOHERENTE')).toBe(true);
  });

  it('detects a predecessor whose hash matches but whose identity does not', async () => {
    // Same hash, different invoice: the chain looks intact until you check the identity.
    const impostor: Eslabon = {
      ...(OFFICIAL_CHAIN[1] as EslabonAlta),
      fields: { ...V2_ALTA_CHAINED_FIELDS, NumSerieFactura: 'OTRA/SERIE' },
    };
    const result = await verificarEncadenamientoPrevio(OFFICIAL_CHAIN[2] as Eslabon, impostor, {
      ahora,
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'ANTERIOR_NO_COINCIDE')).toBe(true);
  });

  it('ignores an unparseable timestamp instead of reporting a bogus clock drift', async () => {
    const weird: Eslabon = {
      ...(OFFICIAL_CHAIN[0] as EslabonAlta),
      fields: { ...V1_ALTA_FIRST_FIELDS, FechaHoraHusoGenRegistro: 'ayer' },
    };
    const result = await verificarEncadenamientoPrevio(weird, null, { ahora });
    expect(result.issues.some((i) => i.code === 'RELOJ_DESFASADO')).toBe(false);
  });

  it('detects a broken link in the two-link window', async () => {
    const tampered: Eslabon = {
      ...(OFFICIAL_CHAIN[1] as EslabonAlta),
      huella: 'C'.repeat(64),
    };
    const result = await verificarEncadenamientoPrevio(OFFICIAL_CHAIN[2] as Eslabon, tampered, {
      ahora,
    });
    expect(result.ok).toBe(false);
  });
});
