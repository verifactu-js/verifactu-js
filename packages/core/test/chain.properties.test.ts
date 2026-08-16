/**
 * Property-based tests over chaining.
 *
 * Two invariants, stated as the brief does:
 *   1. Any chain this library generates verifies.
 *   2. Any mutation of any hashed field of any link is detected.
 *
 * Example-based tests prove the official vectors work. These prove nothing else was smuggled in.
 */
import fc from 'fast-check';
import { describe, it } from 'vitest';

import {
  createSifChain,
  type Eslabon,
  type EslabonAlta,
  type EslabonAnulacion,
  type RegistroAltaHashInput,
  type RegistroAnulacionHashInput,
  verifyChain,
} from '../src/index.js';

/**
 * Characters the AEAT forbids in a series + invoice number (Validaciones v1.2.2 §3.1.3.1).
 * Note that `&` is **not** among them: it is legal, and the generator must keep producing it.
 * See docs/spec-notes.md §18.
 */
const PROHIBIDOS_EN_SERIE = new Set(['"', "'", '<', '>', '=']);

/**
 * Maps a generated string onto something a series number may legally contain.
 *
 * Replaces every code unit Java's `trim()` would remove (everything `<= U+0020`), everything
 * outside printable ASCII, and the five characters the AEAT forbids.
 *
 * Done by inspecting code units rather than with a regex: a character class covering the
 * control range needs literal control characters in the source, which is both unreviewable and
 * a lint error.
 */
const asSerieLegal = (value: string): string =>
  Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    if (code < 0x21 || code > 0x7e) return '.';
    return PROHIBIDOS_EN_SERIE.has(character) ? '.' : character;
  }).join('');

/** Field values that survive canonicalisation unchanged: no edge whitespace, non-empty. */
const safeText = (maxLength: number) =>
  fc
    .string({ minLength: 1, maxLength, unit: 'grapheme-ascii' })
    .map(asSerieLegal)
    .filter((s) => s.length > 0);

/** An amount already serialised, as the caller would supply it. */
const importe = fc
  .tuple(fc.integer({ min: 0, max: 999_999 }), fc.integer({ min: 0, max: 99 }))
  .map(([whole, cents]) => `${whole}.${String(cents).padStart(2, '0')}`);

const fechaExpedicion = fc
  .date({ min: new Date('2024-01-01T00:00:00Z'), max: new Date('2030-12-31T00:00:00Z') })
  .map((d) => {
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}-${mm}-${d.getUTCFullYear()}`;
  });

const tipoFactura = fc.constantFrom('F1', 'F2', 'F3', 'R1', 'R2', 'R3', 'R4', 'R5');

/** NIFs are opaque to the hash, so any nine-character token is representative. */
const nif = fc.stringMatching(/^[0-9A-Z]{9}$/);

const timeZone = fc.constantFrom(
  'Atlantic/Canary',
  'Europe/Madrid',
  'UTC',
  'Asia/Kolkata',
  'America/New_York',
);

interface AltaStep {
  readonly kind: 'alta';
  readonly IDEmisorFactura: string;
  readonly NumSerieFactura: string;
  readonly FechaExpedicionFactura: string;
  readonly TipoFactura: string;
  readonly CuotaTotal: string;
  readonly ImporteTotal: string;
}

interface AnulacionStep {
  readonly kind: 'anulacion';
  readonly IDEmisorFacturaAnulada: string;
  readonly NumSerieFacturaAnulada: string;
  readonly FechaExpedicionFacturaAnulada: string;
}

type Step = AltaStep | AnulacionStep;

const altaStep: fc.Arbitrary<AltaStep> = fc.record({
  kind: fc.constant('alta' as const),
  IDEmisorFactura: nif,
  NumSerieFactura: safeText(60),
  FechaExpedicionFactura: fechaExpedicion,
  TipoFactura: tipoFactura,
  CuotaTotal: importe,
  ImporteTotal: importe,
});

const anulacionStep: fc.Arbitrary<AnulacionStep> = fc.record({
  kind: fc.constant('anulacion' as const),
  IDEmisorFacturaAnulada: nif,
  NumSerieFacturaAnulada: safeText(60),
  FechaExpedicionFacturaAnulada: fechaExpedicion,
});

const steps = fc.array(fc.oneof(altaStep, anulacionStep), { minLength: 1, maxLength: 8 });

/** Builds a chain from a script of steps, advancing the injected clock one second per record. */
async function buildChain(script: readonly Step[], tz: string): Promise<Eslabon[]> {
  let tick = 0;
  const chain = createSifChain({
    timeZone: tz,
    now: () => new Date(Date.UTC(2024, 0, 15, 12, 0, tick++)),
  });

  const links: Eslabon[] = [];
  let previous: Eslabon | null = null;

  for (const step of script) {
    const link: Eslabon =
      step.kind === 'alta'
        ? await chain.alta({ ...step, previous })
        : await chain.anulacion({ ...step, previous });
    links.push(link);
    previous = link;
  }

  return links;
}

describe('property: every generated chain verifies', () => {
  it('holds for any sequence of altas and anulaciones in any zone', async () => {
    await fc.assert(
      fc.asyncProperty(steps, timeZone, async (script, tz) => {
        const chain = await buildChain(script, tz);
        const result = await verifyChain(chain);
        return result.ok === true && result.issues.length === 0;
      }),
      { numRuns: 120 },
    );
  });

  it('holds regardless of where anulaciones fall in the sequence', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(anulacionStep, { minLength: 2, maxLength: 5 }), async (script) => {
        const chain = await buildChain(script, 'Atlantic/Canary');
        return (await verifyChain(chain)).ok === true;
      }),
      { numRuns: 40 },
    );
  });
});

const ALTA_HASHED_FIELDS: ReadonlyArray<keyof RegistroAltaHashInput> = [
  'IDEmisorFactura',
  'NumSerieFactura',
  'FechaExpedicionFactura',
  'TipoFactura',
  'CuotaTotal',
  'ImporteTotal',
  'Huella',
  'FechaHoraHusoGenRegistro',
];

const ANULACION_HASHED_FIELDS: ReadonlyArray<keyof RegistroAnulacionHashInput> = [
  'IDEmisorFacturaAnulada',
  'NumSerieFacturaAnulada',
  'FechaExpedicionFacturaAnulada',
  'Huella',
  'FechaHoraHusoGenRegistro',
];

/** Returns a value different from the current one, valid for that field. */
function mutate(current: string | null): string {
  return current === null ? 'X' : `${current}#`;
}

describe('property: any mutation of any hashed field is detected', () => {
  it('holds for any link and any field of the chain', async () => {
    await fc.assert(
      fc.asyncProperty(
        steps,
        timeZone,
        fc.nat({ max: 1000 }),
        fc.nat({ max: 1000 }),
        async (script, tz, linkPick, fieldPick) => {
          const chain = await buildChain(script, tz);

          const index = linkPick % chain.length;
          const link = chain[index] as Eslabon;

          const names = link.tipo === 'alta' ? ALTA_HASHED_FIELDS : ANULACION_HASHED_FIELDS;
          const field = names[fieldPick % names.length] as string;

          const currentFields = link.fields as unknown as Record<string, string | null>;
          const tampered = [...chain];
          tampered[index] = {
            ...link,
            fields: { ...currentFields, [field]: mutate(currentFields[field] ?? null) },
          } as unknown as Eslabon;

          const result = await verifyChain(tampered);
          return result.ok === false && result.brokenAt !== null;
        },
      ),
      { numRuns: 150 },
    );
  });

  it('detects a tampered stored hash on any link', async () => {
    await fc.assert(
      fc.asyncProperty(steps, fc.nat({ max: 1000 }), async (script, linkPick) => {
        const chain = await buildChain(script, 'Europe/Madrid');
        const index = linkPick % chain.length;

        const tampered = [...chain];
        tampered[index] = { ...(chain[index] as Eslabon), huella: 'F'.repeat(64) } as Eslabon;

        return (await verifyChain(tampered)).ok === false;
      }),
      { numRuns: 80 },
    );
  });
});

describe('property: removing or reordering links is detected', () => {
  it('detects the removal of any single link from a chain of three or more', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.oneof(altaStep, anulacionStep), { minLength: 3, maxLength: 6 }),
        fc.nat({ max: 1000 }),
        async (script, pick) => {
          const chain = await buildChain(script, 'Atlantic/Canary');
          // Removing the last link leaves a shorter but still valid chain, so exclude it.
          const index = pick % (chain.length - 1);

          const gapped = chain.filter((_link, i) => i !== index);
          return (await verifyChain(gapped)).ok === false;
        },
      ),
      { numRuns: 80 },
    );
  });

  it('accepts truncation from the end — a prefix of a valid chain is a valid chain', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.oneof(altaStep, anulacionStep), { minLength: 2, maxLength: 6 }),
        fc.nat({ max: 1000 }),
        async (script, pick) => {
          const chain = await buildChain(script, 'Europe/Madrid');
          const keep = 1 + (pick % chain.length);
          return (await verifyChain(chain.slice(0, keep))).ok === true;
        },
      ),
      { numRuns: 60 },
    );
  });

  it('detects swapping two adjacent links', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.oneof(altaStep, anulacionStep), { minLength: 2, maxLength: 5 }),
        fc.nat({ max: 1000 }),
        async (script, pick) => {
          const chain = await buildChain(script, 'UTC');
          const i = pick % (chain.length - 1);

          const swapped = [...chain];
          swapped[i] = chain[i + 1] as Eslabon;
          swapped[i + 1] = chain[i] as Eslabon;

          return (await verifyChain(swapped)).ok === false;
        },
      ),
      { numRuns: 80 },
    );
  });
});

describe('property: the chain never assumes a constant NIF', () => {
  it('verifies chains whose issuer NIF changes at every link', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.tuple(nif, safeText(30)), { minLength: 2, maxLength: 6 }),
        async (pairs) => {
          const script: Step[] = pairs.map(([n, serie]) => ({
            kind: 'alta' as const,
            IDEmisorFactura: n,
            NumSerieFactura: serie,
            FechaExpedicionFactura: '15-01-2024',
            TipoFactura: 'F1',
            CuotaTotal: '21.00',
            ImporteTotal: '121.00',
          }));

          const chain = await buildChain(script, 'Atlantic/Canary');
          return (await verifyChain(chain)).ok === true;
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe('property: generation is deterministic', () => {
  it('the same script and the same clock always yield the same hashes', async () => {
    await fc.assert(
      fc.asyncProperty(steps, timeZone, async (script, tz) => {
        const first = await buildChain(script, tz);
        const second = await buildChain(script, tz);
        return first.map((l) => l.huella).join(',') === second.map((l) => l.huella).join(',');
      }),
      { numRuns: 60 },
    );
  });

  it('a different zone yields different hashes for the same instant', async () => {
    await fc.assert(
      fc.asyncProperty(altaStep, async (step) => {
        const canary = await buildChain([step], 'Atlantic/Canary');
        const madrid = await buildChain([step], 'Europe/Madrid');
        // In January the two zones differ by one hour, so the timestamps — and therefore the
        // hashes — must differ. This is the Canary Islands trap, asserted.
        return (canary[0] as EslabonAlta).huella !== (madrid[0] as EslabonAlta).huella;
      }),
      { numRuns: 40 },
    );
  });
});

describe('property: anulación links carry the five-field shape', () => {
  it('never has TipoFactura, CuotaTotal or ImporteTotal in its hashed fields', async () => {
    await fc.assert(
      fc.asyncProperty(anulacionStep, async (step) => {
        const [link] = await buildChain([step], 'Europe/Madrid');
        const fields = (link as EslabonAnulacion).fields as unknown as Record<string, unknown>;
        return (
          Object.keys(fields).length === 5 &&
          !('TipoFactura' in fields) &&
          !('CuotaTotal' in fields) &&
          !('ImporteTotal' in fields)
        );
      }),
      { numRuns: 40 },
    );
  });
});
