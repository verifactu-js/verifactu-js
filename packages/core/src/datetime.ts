/**
 * `FechaHoraHusoGenRegistro` — generation and inspection.
 *
 * Specification: AEAT "Diseños de registro de facturación" v1.0 (2024-10-28), sheets
 * "2)D. Registro Facturación Alta" and "3)D. Reg. Facturación Anulación":
 *
 * > «DateTime. Formato: YYYY-MM-DDThh:mm:ssTZD (ej: 2024-01-01T19:20:30+01:00) (ISO 8601)»
 * > «El huso horario es el que está usando el sistema informático de facturación en el momento
 * > de generación del registro de facturación.»
 *
 * Analysis and citations: docs/spec-notes.md §5.
 *
 * ## Two modes, on purpose
 *
 * **Generating** and **verifying** are different problems and get different functions:
 *
 * - {@link formatFechaHoraHusoGenRegistro} is strict. It is the only value we are responsible
 *   for, so it always emits `±hh:mm`, never `Z`, never fractional seconds, never an offset
 *   with seconds. That is the mitigation for I-07, I-08 and I-09 while they stay open.
 * - {@link inspectFechaHoraHuso} is lenient. A chain generated years ago by another system —
 *   or by an earlier version of this one — already contains whatever it contains, and its hash
 *   was computed over that exact literal. Rejecting it would make verification useless. So it
 *   reports findings and never throws.
 *
 * Rejecting on read what we refuse to write would break every historic chain we are meant to
 * be able to check.
 */

import { VerifactuError } from './errors.js';

/**
 * A `FechaHoraHusoGenRegistro` in the strict generated form:
 * `YYYY-MM-DDThh:mm:ss` followed by `+hh:mm` or `-hh:mm`.
 */
export type FechaHoraHuso = string;

/** Options for {@link formatFechaHoraHusoGenRegistro}. */
export interface FormatFechaHoraHusoOptions {
  /**
   * IANA time zone identifier, for example `'Atlantic/Canary'` or `'Europe/Madrid'`.
   *
   * **Mandatory. There is no default, and there will never be one.** The specification ties
   * the offset to the machine generating the record, and a library-wide default would silently
   * produce peninsular offsets for a system running in the Canary Islands — one hour wrong,
   * with a hash to match. See docs/spec-notes.md §5.4.
   */
  readonly timeZone: string;
}

/** Something noticed about a stored `FechaHoraHusoGenRegistro` during verification. */
export type FechaHoraHusoWarning =
  /** Uses the `Z` designator rather than an explicit `+00:00` (I-08). */
  | 'HUSO_Z'
  /** Carries no offset at all, so the instant is ambiguous. */
  | 'SIN_HUSO'
  /** Carries fractional seconds, which the documented format does not contemplate (I-07). */
  | 'FRACCION_DE_SEGUNDO'
  /** Offset includes seconds, e.g. `+01:00:00` (I-09). */
  | 'OFFSET_CON_SEGUNDOS'
  /** Does not look like ISO 8601 at all. */
  | 'FORMATO_DESCONOCIDO';

/** Result of inspecting a stored `FechaHoraHusoGenRegistro`. */
export interface FechaHoraHusoInspection {
  /** The literal exactly as stored. Never normalised: the hash was computed over this. */
  readonly value: string;
  /** `true` when the value matches what {@link formatFechaHoraHusoGenRegistro} would emit. */
  readonly ok: boolean;
  /** Everything noticed. Empty when `ok` is `true`. */
  readonly warnings: readonly FechaHoraHusoWarning[];
  /** The instant, when it could be recovered; `null` otherwise. */
  readonly instant: Date | null;
}

/** The strict generated shape. */
const STRICT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/;

/** Loose ISO 8601, used only to classify what a stored value looks like. */
const LOOSE_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:?\d{2}(:\d{2})?)?$/;

/** Cache of formatters: constructing `Intl.DateTimeFormat` is comparatively expensive. */
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function offsetFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(`offset:${timeZone}`);
  if (cached) return cached;

  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' });
  } catch {
    throw new VerifactuError({
      code: 'ZONA_HORARIA_DESCONOCIDA',
      message: `La zona horaria «${timeZone}» no la reconoce este entorno.`,
      causaProbable:
        'No es un identificador IANA válido (por ejemplo «Atlantic/Canary» o «Europe/Madrid»), ' +
        'o el runtime se ha compilado con una ICU reducida y sin base de datos de zonas.',
      accionSugerida:
        'Usa un identificador de la base de datos IANA. En Node, comprueba que el binario no ' +
        'sea small-icu: Intl.DateTimeFormat().resolvedOptions().timeZone debe devolver una zona real.',
      referencia: 'docs/spec-notes.md §5.4',
    });
  }

  formatterCache.set(`offset:${timeZone}`, formatter);
  return formatter;
}

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(`parts:${timeZone}`);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  formatterCache.set(`parts:${timeZone}`, formatter);
  return formatter;
}

function assertValidInstant(instant: Date): void {
  if (instant instanceof Date && !Number.isNaN(instant.getTime())) return;

  throw new VerifactuError({
    code: 'INSTANTE_INVALIDO',
    message: 'El instante recibido no es una fecha válida.',
    causaProbable:
      'Se ha pasado un Date inválido (por ejemplo new Date("texto")), o un valor que no es Date.',
    accionSugerida:
      'Comprueba el origen del instante. Si la hora la inyectas para poder testear, asegúrate ' +
      'de que la función now() devuelve un Date válido.',
    referencia: 'docs/spec-notes.md §5.1',
  });
}

/**
 * Returns the UTC offset in force in `timeZone` at `instant`, as `+hh:mm` or `-hh:mm`.
 *
 * The offset is derived from the instant, never from configuration: `Atlantic/Canary` is
 * `+00:00` in winter and `+01:00` in summer, and it is never the same as `Europe/Madrid`.
 *
 * Implemented with `Intl.DateTimeFormat` and `timeZoneName: 'longOffset'`, which is part of
 * the language: no dependency, works on Node, Bun, Deno, Workers and the browser.
 *
 * @throws {VerifactuError} `ZONA_HORARIA_DESCONOCIDA` if the runtime does not know the zone.
 * @throws {VerifactuError} `INSTANTE_INVALIDO` if `instant` is not a valid `Date`.
 */
export function offsetForInstant(instant: Date, timeZone: string): string {
  assertValidInstant(instant);

  const parts = offsetFormatter(timeZone).formatToParts(instant);
  const raw = parts.find((part) => part.type === 'timeZoneName')?.value ?? '';

  // 'GMT+01:00', 'GMT-05:00', 'GMT+05:30'. Some engines emit a bare 'GMT' for a zero offset.
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(raw);
  if (match) return `${match[1]}${match[2]}:${match[3]}`;
  if (raw === 'GMT' || raw === 'UTC') return '+00:00';

  throw new VerifactuError({
    code: 'ZONA_HORARIA_DESCONOCIDA',
    message: `No se ha podido determinar el huso horario de «${timeZone}» (Intl devolvió «${raw}»).`,
    causaProbable:
      'La implementación de Intl del entorno ha devuelto el nombre de zona en un formato ' +
      'inesperado para timeZoneName: "longOffset".',
    accionSugerida:
      'Comunica el entorno y su versión como incidencia, y mientras tanto pasa el valor de ' +
      'FechaHoraHusoGenRegistro ya construido.',
    referencia: 'docs/spec-notes.md §5.1',
  });
}

/**
 * Builds a `FechaHoraHusoGenRegistro` for `instant` as seen from `timeZone`.
 *
 * Strict by design — see the module note. In particular it emits `+00:00` rather than `Z`, and
 * drops milliseconds, because neither `Z` nor fractional seconds appear in any official
 * example and both would change the hash.
 *
 * TODO(verify: I-07) — fractional seconds: undocumented whether the AEAT accepts them.
 * TODO(verify: I-08) — `Z` versus `+00:00`: undocumented. Relevant for the Canary Islands in
 * winter, where the offset is zero. See docs/spec-notes.md §11.
 * TODO(verify: I-09) — offsets with seconds: undocumented.
 *
 * @example
 * ```ts
 * const now = new Date('2024-01-15T12:00:00Z');
 * formatFechaHoraHusoGenRegistro(now, { timeZone: 'Atlantic/Canary' }); // 2024-01-15T12:00:00+00:00
 * formatFechaHoraHusoGenRegistro(now, { timeZone: 'Europe/Madrid' });   // 2024-01-15T13:00:00+01:00
 * ```
 */
export function formatFechaHoraHusoGenRegistro(
  instant: Date,
  options: FormatFechaHoraHusoOptions,
): FechaHoraHuso {
  assertValidInstant(instant);

  const timeZone = options?.timeZone;
  if (typeof timeZone !== 'string' || timeZone === '') {
    throw new VerifactuError({
      code: 'ZONA_HORARIA_DESCONOCIDA',
      message: 'Falta la zona horaria: «timeZone» es obligatorio.',
      causaProbable:
        'No se ha indicado zona horaria. La librería no asume ninguna por defecto a propósito.',
      accionSugerida:
        'Indica la zona IANA del sistema que genera el registro, por ejemplo ' +
        "{ timeZone: 'Atlantic/Canary' }. Si de verdad quieres la del entorno, pásala " +
        'explícitamente: Intl.DateTimeFormat().resolvedOptions().timeZone.',
      referencia: 'docs/spec-notes.md §5.4',
    });
  }

  const offset = offsetForInstant(instant, timeZone);
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}${offset}`;
}

/**
 * Inspects a stored `FechaHoraHusoGenRegistro` without judging it out of existence.
 *
 * Never throws. Verification runs over data that already exists and whose hash was computed
 * over the literal as stored, so the literal is returned untouched in
 * {@link FechaHoraHusoInspection.value}.
 */
export function inspectFechaHoraHuso(value: string): FechaHoraHusoInspection {
  const warnings: FechaHoraHusoWarning[] = [];

  if (typeof value !== 'string' || !LOOSE_PATTERN.test(value)) {
    return { value, ok: false, warnings: ['FORMATO_DESCONOCIDO'], instant: null };
  }

  const match = LOOSE_PATTERN.exec(value) as RegExpExecArray;
  const fraction = match[7];
  const zone = match[8];
  const offsetSeconds = match[9];

  if (fraction !== undefined) warnings.push('FRACCION_DE_SEGUNDO');
  if (zone === undefined) warnings.push('SIN_HUSO');
  else if (zone === 'Z') warnings.push('HUSO_Z');
  else if (offsetSeconds !== undefined) warnings.push('OFFSET_CON_SEGUNDOS');

  const parsed = Date.parse(offsetSeconds === undefined ? value : value.slice(0, -3));
  const instant = Number.isNaN(parsed) ? null : new Date(parsed);
  if (instant === null) warnings.push('FORMATO_DESCONOCIDO');

  return {
    value,
    ok: warnings.length === 0 && STRICT_PATTERN.test(value),
    warnings,
    instant,
  };
}
