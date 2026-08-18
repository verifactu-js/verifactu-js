/**
 * `FechaHoraHusoGenRegistro`: generation (strict) and inspection (lenient).
 *
 * The AEAT requires ISO 8601 with an explicit offset, `YYYY-MM-DDThh:mm:ssTZD`
 * (docs/spec-notes.md §5.1). The offset is "el que está usando el sistema informático de
 * facturación en el momento de generación", so it depends on the instant, never on a fixed
 * configured value.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  formatFechaHoraHusoGenRegistro,
  inspectFechaHoraHuso,
  offsetForInstant,
  VEREDICTO_AEAT,
  VerifactuError,
} from '../src/index.js';

/** Strict shape the generator must always emit. */
const STRICT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

/** Winter and summer instants, chosen well away from any transition. */
const WINTER = new Date('2024-01-15T12:00:00Z');
const SUMMER = new Date('2024-07-15T12:00:00Z');

describe('offsetForInstant — the offset comes from the instant, not from configuration', () => {
  it('Atlantic/Canary is +00:00 in winter and +01:00 in summer', () => {
    expect(offsetForInstant(WINTER, 'Atlantic/Canary')).toBe('+00:00');
    expect(offsetForInstant(SUMMER, 'Atlantic/Canary')).toBe('+01:00');
  });

  it('Europe/Madrid is +01:00 in winter and +02:00 in summer', () => {
    expect(offsetForInstant(WINTER, 'Europe/Madrid')).toBe('+01:00');
    expect(offsetForInstant(SUMMER, 'Europe/Madrid')).toBe('+02:00');
  });

  it('Canary and Madrid never agree — a peninsular default would be wrong all year', () => {
    expect(offsetForInstant(WINTER, 'Atlantic/Canary')).not.toBe(
      offsetForInstant(WINTER, 'Europe/Madrid'),
    );
    expect(offsetForInstant(SUMMER, 'Atlantic/Canary')).not.toBe(
      offsetForInstant(SUMMER, 'Europe/Madrid'),
    );
  });

  it('handles UTC, half-hour and quarter-hour zones', () => {
    expect(offsetForInstant(WINTER, 'UTC')).toBe('+00:00');
    expect(offsetForInstant(WINTER, 'Asia/Kolkata')).toBe('+05:30');
    expect(offsetForInstant(WINTER, 'Pacific/Chatham')).toBe('+13:45');
  });

  it('handles negative offsets', () => {
    expect(offsetForInstant(WINTER, 'America/New_York')).toBe('-05:00');
  });

  it('rejects an unknown time zone', () => {
    try {
      offsetForInstant(WINTER, 'Not/AZone');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(VerifactuError);
      expect((error as VerifactuError).code).toBe('ZONA_HORARIA_DESCONOCIDA');
    }
  });
});

describe('DST transitions (spec-notes §5.4)', () => {
  // In 2024 European summer time began at 01:00 UTC on Sunday 31 March.
  const BEFORE = new Date('2024-03-31T00:59:59Z');
  const AFTER = new Date('2024-03-31T01:00:00Z');

  it('Europe/Madrid flips +01:00 -> +02:00 across the boundary', () => {
    expect(offsetForInstant(BEFORE, 'Europe/Madrid')).toBe('+01:00');
    expect(offsetForInstant(AFTER, 'Europe/Madrid')).toBe('+02:00');
  });

  it('Atlantic/Canary flips +00:00 -> +01:00 across the same instant', () => {
    expect(offsetForInstant(BEFORE, 'Atlantic/Canary')).toBe('+00:00');
    expect(offsetForInstant(AFTER, 'Atlantic/Canary')).toBe('+01:00');
  });

  it('one second apart, two records generated in Canary carry different offsets', () => {
    expect(formatFechaHoraHusoGenRegistro(BEFORE, { timeZone: 'Atlantic/Canary' })).toBe(
      '2024-03-31T00:59:59+00:00',
    );
    expect(formatFechaHoraHusoGenRegistro(AFTER, { timeZone: 'Atlantic/Canary' })).toBe(
      '2024-03-31T02:00:00+01:00',
    );
  });

  // Autumn 2024: European summer time ended at 01:00 UTC on Sunday 27 October.
  it('handles the autumn transition, where local wall-clock time repeats', () => {
    const beforeFallBack = new Date('2024-10-27T00:59:59Z');
    const afterFallBack = new Date('2024-10-27T01:00:00Z');

    expect(formatFechaHoraHusoGenRegistro(beforeFallBack, { timeZone: 'Atlantic/Canary' })).toBe(
      '2024-10-27T01:59:59+01:00',
    );
    expect(formatFechaHoraHusoGenRegistro(afterFallBack, { timeZone: 'Atlantic/Canary' })).toBe(
      '2024-10-27T01:00:00+00:00',
    );
  });

  it('the repeated wall-clock hour stays unambiguous thanks to the offset', () => {
    const first = formatFechaHoraHusoGenRegistro(new Date('2024-10-27T00:30:00Z'), {
      timeZone: 'Europe/Madrid',
    });
    const second = formatFechaHoraHusoGenRegistro(new Date('2024-10-27T01:30:00Z'), {
      timeZone: 'Europe/Madrid',
    });
    expect(first).toBe('2024-10-27T02:30:00+02:00');
    expect(second).toBe('2024-10-27T02:30:00+01:00');
    // Same wall clock, different offsets: the instants remain distinguishable.
    expect(first.slice(0, 19)).toBe(second.slice(0, 19));
    expect(first).not.toBe(second);
  });
});

describe('formatFechaHoraHusoGenRegistro — generation is strict', () => {
  it('emits exactly YYYY-MM-DDThh:mm:ss±hh:mm', () => {
    const value = formatFechaHoraHusoGenRegistro(WINTER, { timeZone: 'Europe/Madrid' });
    expect(value).toBe('2024-01-15T13:00:00+01:00');
    expect(value).toMatch(STRICT);
  });

  it('never emits fractional seconds, even when the instant has milliseconds', () => {
    const value = formatFechaHoraHusoGenRegistro(new Date('2024-01-15T12:00:00.789Z'), {
      timeZone: 'Atlantic/Canary',
    });
    expect(value).toBe('2024-01-15T12:00:00+00:00');
    expect(value).toMatch(STRICT);
  });

  it('pads midnight as 00, not 24', () => {
    const value = formatFechaHoraHusoGenRegistro(new Date('2024-01-15T00:00:00Z'), {
      timeZone: 'UTC',
    });
    expect(value).toBe('2024-01-15T00:00:00+00:00');
  });

  it('emits +00:00 for a zero offset, never "Z" (mitigation of I-08)', () => {
    const value = formatFechaHoraHusoGenRegistro(WINTER, { timeZone: 'Atlantic/Canary' });
    expect(value).toBe('2024-01-15T12:00:00+00:00');
    expect(value).not.toContain('Z');
  });

  it('rejects an invalid Date', () => {
    try {
      formatFechaHoraHusoGenRegistro(new Date('nonsense'), { timeZone: 'UTC' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as VerifactuError).code).toBe('INSTANTE_INVALIDO');
    }
  });

  it('requires an explicit time zone — there is no default', () => {
    // @ts-expect-error timeZone is mandatory by design (spec-notes §5.4).
    expect(() => formatFechaHoraHusoGenRegistro(WINTER, {})).toThrowError(VerifactuError);
  });
});

describe('the JavaScript default path is the forbidden one', () => {
  it('Date.prototype.toISOString() produces the "Z" form the spec does not use', () => {
    const iso = WINTER.toISOString();
    expect(iso).toBe('2024-01-15T12:00:00.000Z');
    // Two separate problems in one call: a "Z" designator and fractional seconds.
    expect(iso).not.toMatch(STRICT);
    expect(iso.endsWith('Z')).toBe(true);
    expect(iso).toContain('.000');
  });

  it('inspecting that value reports both problems', () => {
    const report = inspectFechaHoraHuso(WINTER.toISOString());
    expect(report.ok).toBe(false);
    expect(report.warnings).toContain('HUSO_Z');
    expect(report.warnings).toContain('FRACCION_DE_SEGUNDO');
  });

  it('the correct call is never shorter than the wrong one — hence the test', () => {
    expect(formatFechaHoraHusoGenRegistro(WINTER, { timeZone: 'Atlantic/Canary' })).not.toBe(
      WINTER.toISOString(),
    );
  });
});

describe('inspectFechaHoraHuso — verification is lenient (spec-notes §5.2)', () => {
  it('accepts a conforming value with no warnings', () => {
    const report = inspectFechaHoraHuso('2024-01-01T19:20:30+01:00');
    expect(report.ok).toBe(true);
    expect(report.warnings).toEqual([]);
    expect(report.instant?.toISOString()).toBe('2024-01-01T18:20:30.000Z');
  });

  it('accepts a negative offset', () => {
    const report = inspectFechaHoraHuso('2024-01-01T19:20:30-05:00');
    expect(report.ok).toBe(true);
    expect(report.instant?.toISOString()).toBe('2024-01-02T00:20:30.000Z');
  });

  it.each([
    ['HUSO_Z', '2024-01-01T19:20:30Z'],
    ['SIN_HUSO', '2024-01-01T19:20:30'],
    ['FRACCION_DE_SEGUNDO', '2024-01-01T19:20:30.123+01:00'],
    ['OFFSET_CON_SEGUNDOS', '2024-01-01T19:20:30+01:00:00'],
    ['OFFSET_SIN_DOS_PUNTOS', '2024-01-01T19:20:30+0100'],
  ])('flags %s without throwing', (warning, value) => {
    const report = inspectFechaHoraHuso(value);
    expect(report.ok).toBe(false);
    expect(report.warnings).toContain(warning);
  });

  it('still recovers the instant from a non-conforming but parseable value', () => {
    const report = inspectFechaHoraHuso('2024-01-01T19:20:30Z');
    expect(report.instant?.toISOString()).toBe('2024-01-01T19:20:30.000Z');
  });

  it('reports an unparseable value instead of throwing', () => {
    const report = inspectFechaHoraHuso('ayer por la tarde');
    expect(report.ok).toBe(false);
    expect(report.warnings).toContain('FORMATO_DESCONOCIDO');
    expect(report.instant).toBeNull();
  });

  it('never throws, whatever it is handed — historic data is not negotiable', () => {
    for (const value of ['', '   ', '0000-00-00T00:00:00+00:00', 'Z', '2024-13-45T99:99:99']) {
      expect(() => inspectFechaHoraHuso(value)).not.toThrow();
    }
  });

  it('preserves the original literal so the hash can be recomputed verbatim', () => {
    const stored = '2024-01-01T19:20:30.123+01:00';
    expect(inspectFechaHoraHuso(stored).value).toBe(stored);
  });
});

describe('aceptadoPorLaAeat — lo medido en preproducción, no lo supuesto (spec-notes §22)', () => {
  it('acepta el huso Z, que es el hallazgo de S-2', () => {
    // Volvió `Correcto`, luego la AEAT calculó la misma huella sobre el literal con la `Z`
    // dentro. Si hubiera normalizado a +00:00 antes de hashear habría contestado 2000.
    const report = inspectFechaHoraHuso('2024-01-01T19:20:30Z');

    expect(report.warnings).toEqual(['HUSO_Z']);
    expect(report.aceptadoPorLaAeat).toBe(true);
    // `ok` sigue siendo false: no es la forma que generamos. Son preguntas distintas, y
    // confundirlas haría que una cadena histórica válida pareciese rota.
    expect(report.ok).toBe(false);
  });

  it.each([
    ['fracción de segundo (I-07)', '2024-01-01T19:20:30.123+01:00'],
    ['offset con segundos (I-09)', '2024-01-01T19:20:30+01:00:00'],
    ['offset sin dos puntos (I-09)', '2024-01-01T19:20:30+0100'],
  ])('rechaza %s, medido con el código 1244', (_etiqueta, value) => {
    expect(inspectFechaHoraHuso(value).aceptadoPorLaAeat).toBe(false);
  });

  it('dice null, y no true, cuando no se ha medido', () => {
    // Un literal sin huso no se ha enviado nunca. Afirmar que se acepta sería inventárselo.
    expect(inspectFechaHoraHuso('2024-01-01T19:20:30').aceptadoPorLaAeat).toBeNull();
    expect(inspectFechaHoraHuso('ayer por la tarde').aceptadoPorLaAeat).toBeNull();
  });

  it('un solo aviso rechazado manda sobre los demás', () => {
    // Fracción de segundo Y huso Z: el rechazo pesa más que la aceptación.
    const report = inspectFechaHoraHuso('2024-01-01T19:20:30.123Z');

    expect(report.warnings).toEqual(expect.arrayContaining(['FRACCION_DE_SEGUNDO', 'HUSO_Z']));
    expect(report.aceptadoPorLaAeat).toBe(false);
  });

  it('la forma estricta se da por aceptada sin avisos', () => {
    expect(inspectFechaHoraHuso('2024-01-01T19:20:30+01:00').aceptadoPorLaAeat).toBe(true);
  });

  it('VEREDICTO_AEAT solo contiene lo que se ha enviado de verdad', () => {
    expect(VEREDICTO_AEAT).toEqual({
      HUSO_Z: true,
      FRACCION_DE_SEGUNDO: false,
      OFFSET_CON_SEGUNDOS: false,
      OFFSET_SIN_DOS_PUNTOS: false,
    });
    // Sin medir: no aparecen. Que falten es la información.
    expect(VEREDICTO_AEAT).not.toHaveProperty('SIN_HUSO');
    expect(VEREDICTO_AEAT).not.toHaveProperty('FORMATO_DESCONOCIDO');
  });
});

describe('tolerating engine quirks in Intl output', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * Replaces `Intl.DateTimeFormat` so the `longOffset` lookup returns `value`.
   * A distinct time zone id is used per test because formatters are cached by zone.
   */
  function stubLongOffset(value: string): void {
    const RealDateTimeFormat = Intl.DateTimeFormat;

    // A class, not a function expression: the production code calls `new Intl.DateTimeFormat`,
    // and a linter that rewrites function expressions into arrow functions would silently turn
    // this stub into something `new` cannot construct.
    class FakeDateTimeFormat {
      private readonly delegate: Intl.DateTimeFormat | null;

      constructor(locale?: string, options?: Intl.DateTimeFormatOptions) {
        this.delegate =
          options?.timeZoneName === 'longOffset'
            ? null
            : new RealDateTimeFormat(locale, { ...options, timeZone: 'UTC' });
      }

      formatToParts(date?: Date): Intl.DateTimeFormatPart[] {
        if (this.delegate) return this.delegate.formatToParts(date);
        return [{ type: 'timeZoneName', value } as Intl.DateTimeFormatPart];
      }

      format(date?: Date): string {
        return this.delegate?.format(date) ?? '';
      }
    }

    vi.stubGlobal('Intl', {
      ...Intl,
      DateTimeFormat: FakeDateTimeFormat as unknown as typeof Intl.DateTimeFormat,
    });
  }

  it('accepts a bare "GMT", which some engines emit for a zero offset', () => {
    stubLongOffset('GMT');
    expect(offsetForInstant(WINTER, 'Etc/Quirk-GMT')).toBe('+00:00');
  });

  it('accepts a bare "UTC" as a zero offset', () => {
    stubLongOffset('UTC');
    expect(offsetForInstant(WINTER, 'Etc/Quirk-UTC')).toBe('+00:00');
  });

  it('refuses to guess when Intl returns something unrecognised', () => {
    stubLongOffset('Hora de Canarias');
    try {
      offsetForInstant(WINTER, 'Etc/Quirk-Unknown');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as VerifactuError).code).toBe('ZONA_HORARIA_DESCONOCIDA');
      expect((error as VerifactuError).message).toContain('Hora de Canarias');
    }
  });
});

describe('input guards', () => {
  it('offsetForInstant rejects an invalid Date before touching Intl', () => {
    try {
      offsetForInstant(new Date('nonsense'), 'UTC');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as VerifactuError).code).toBe('INSTANTE_INVALIDO');
    }
  });

  it('formatFechaHoraHusoGenRegistro rejects an empty time zone', () => {
    try {
      formatFechaHoraHusoGenRegistro(WINTER, { timeZone: '' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as VerifactuError).code).toBe('ZONA_HORARIA_DESCONOCIDA');
    }
  });

  it('inspectFechaHoraHuso handles a non-string input', () => {
    const report = inspectFechaHoraHuso(undefined as unknown as string);
    expect(report.ok).toBe(false);
    expect(report.warnings).toContain('FORMATO_DESCONOCIDO');
  });

  it('accepts a space instead of "T" but flags the value as non-conforming', () => {
    const report = inspectFechaHoraHuso('2024-01-01 19:20:30+01:00');
    expect(report.ok).toBe(false);
    expect(report.instant).not.toBeNull();
  });
});

describe('generation and inspection agree', () => {
  it.each([
    ['Atlantic/Canary', WINTER],
    ['Atlantic/Canary', SUMMER],
    ['Europe/Madrid', WINTER],
    ['Europe/Madrid', SUMMER],
    ['Asia/Kolkata', WINTER],
    ['America/New_York', SUMMER],
  ])('round trip in %s', (timeZone, instant) => {
    const value = formatFechaHoraHusoGenRegistro(instant, { timeZone });
    const report = inspectFechaHoraHuso(value);

    expect(report.ok).toBe(true);
    expect(report.warnings).toEqual([]);
    // Milliseconds are dropped on generation, so compare at second resolution.
    expect(report.instant?.getTime()).toBe(Math.floor(instant.getTime() / 1000) * 1000);
  });
});
