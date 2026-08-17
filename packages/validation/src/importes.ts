/**
 * Arithmetic on amounts, in integer cents.
 *
 * Several rules are sums with a ±10,00 € tolerance (F3 §15.7, §15.8, §16, §17). Doing them in
 * floating point would be the obvious mistake: `0.1 + 0.2` is `0.30000000000000004`, and a rule
 * that exists to catch a discrepancy of a few cents cannot be evaluated with an operator that
 * introduces its own.
 *
 * The schema types every amount as `ImporteSgn12.2Type` — at most 12 integer digits and 2
 * decimals — so the largest value in cents is 10^14, comfortably inside `Number.MAX_SAFE_INTEGER`
 * (~9·10^15). Integer cents are therefore exact here, with no big-integer library and no
 * dependency.
 *
 * Percentages (`TipoImpositivo`, `TipoRecargoEquivalencia`) are `Tipo2.2Type`, so they get the
 * same treatment in hundredths.
 */

/** An amount parsed into cents, or `null` when the text is not a well-formed amount. */
export function aCentimos(valor: string | undefined): number | null {
  if (valor === undefined) return null;

  const coincide = /^([+-]?)(\d{1,12})(?:\.(\d{1,2}))?$/.exec(valor);
  if (coincide === null) return null;

  const [, signo, entera, decimal = ''] = coincide;
  const centimos = Number(entera) * 100 + Number(decimal.padEnd(2, '0'));
  return signo === '-' ? -centimos : centimos;
}

/** A percentage parsed into hundredths of a point: `21` → 2100, `7.5` → 750. */
export function aCentesimas(valor: string | undefined): number | null {
  if (valor === undefined) return null;

  const coincide = /^([+-]?)(\d{1,2})(?:\.(\d{1,2}))?$/.exec(valor);
  if (coincide === null) return null;

  const [, signo, entera, decimal = ''] = coincide;
  const centesimas = Number(entera) * 100 + Number(decimal.padEnd(2, '0'));
  return signo === '-' ? -centesimas : centesimas;
}

/** Renders cents back as the AEAT writes them, for error messages. */
export function deCentimos(centimos: number): string {
  const signo = centimos < 0 ? '-' : '';
  const absoluto = Math.abs(centimos);
  return `${signo}${Math.floor(absoluto / 100)}.${String(absoluto % 100).padStart(2, '0')}`;
}

/** The ±10,00 € margin F3 allows on its sum checks, in cents. */
export const MARGEN = 1000;

/** Whether two amounts agree within the margin the rule allows. */
export function dentroDelMargen(a: number, b: number, margen = MARGEN): boolean {
  return Math.abs(a - b) <= margen;
}

/**
 * `base * tipo / 100`, in cents, rounded half away from zero.
 *
 * The rounding barely matters against a ±10,00 € margin, but leaving it to chance would make the
 * boundary cases of the test suite depend on the platform's `Math.round` behaviour for negatives
 * (`Math.round(-0.5)` is `-0`).
 */
export function cuotaEsperada(baseCentimos: number, tipoCentesimas: number): number {
  const producto = (baseCentimos * tipoCentesimas) / 10_000;
  return producto < 0 ? -Math.round(-producto) : Math.round(producto);
}

/** `-1`, `0` or `1`. Used where a rule requires two amounts to share a sign. */
export function signo(centimos: number): number {
  return centimos === 0 ? 0 : centimos > 0 ? 1 : -1;
}

/**
 * Parses `dd-mm-yyyy` into a UTC timestamp, or `null` if it is not that shape.
 *
 * UTC on purpose: these are calendar dates being compared against calendar boundaries, and
 * pulling the runtime's local zone into that comparison would make a rule fire differently in
 * Madrid and in the Canaries.
 */
export function aFecha(valor: string | undefined): number | null {
  if (valor === undefined) return null;

  const coincide = /^(\d{2})-(\d{2})-(\d{4})$/.exec(valor);
  if (coincide === null) return null;

  const [, dia, mes, anio] = coincide;
  const tiempo = Date.UTC(Number(anio), Number(mes) - 1, Number(dia));
  const fecha = new Date(tiempo);

  // Date.UTC rolls 31-02 over into March; reject instead of silently accepting it.
  return fecha.getUTCDate() === Number(dia) && fecha.getUTCMonth() === Number(mes) - 1
    ? tiempo
    : null;
}
