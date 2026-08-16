/**
 * Canonicalisation of field values for the record hash.
 *
 * Specification: AEAT, "Detalle de las especificaciones técnicas para generación de la huella o
 * hash de los registros de facturación", v0.1.2 (2024-08-27), §3.
 * Analysis and citations: docs/spec-notes.md §1.2, §1.3 and §1.3.1.
 */

import { assertNoAmbiguousEdgeWhitespace, assertSerialisedString } from './errors.js';

/**
 * Trims a value using **Java's** `String.trim()` semantics: it removes leading and trailing
 * UTF-16 code units whose value is `<= U+0020`, and nothing else.
 *
 * This deliberately differs from `String.prototype.trim()`, which also strips Unicode
 * whitespace such as NBSP (U+00A0), U+FEFF and U+2000–U+200A. The AEAT's own reference
 * implementation (published as a code listing in §4 of the hash specification) uses
 * `valor.trim()` in Java, so a value carrying an NBSP at its edge would be canonicalised
 * differently by the two runtimes and produce a different hash.
 *
 * We replicate Java because that is what the published reference does. Values that land in
 * that divergence are rejected outright by {@link canonicalizeValue}.
 *
 * TODO(verify: I-01) — It is not documented whether the AEAT applies these same semantics when
 * it recomputes the hash on its side. See docs/spec-notes.md §11, I-01 (`BLOQUEA-ESTABLE`).
 *
 * TODO(verify: I-02) — Interior whitespace is preserved (the official example yields
 * `"12345678 / G33"`), but it is not documented whether the AEAT collapses repeated interior
 * spaces when recomputing. See docs/spec-notes.md §11, I-02 (`BLOQUEA-ESTABLE`).
 *
 * TODO(verify: I-03) — No source states whether the string must be Unicode-normalised (NFC)
 * before UTF-8 encoding. We do not normalise. See docs/spec-notes.md §11, I-03
 * (`BLOQUEA-ESTABLE`).
 *
 * @param value - Raw value, exactly as it appears in the XML element.
 * @returns The value with leading/trailing code units `<= U+0020` removed.
 */
export function trimJava(value: string): string {
  let start = 0;
  let end = value.length;

  while (start < end && value.charCodeAt(start) <= 0x20) start += 1;
  while (end > start && value.charCodeAt(end - 1) <= 0x20) end -= 1;

  return start === 0 && end === value.length ? value : value.slice(start, end);
}

/**
 * Reports whether a value's edges carry whitespace that `trimJava` keeps but
 * `String.prototype.trim()` would remove — the exact set that makes I-01 dangerous.
 *
 * Interior occurrences are irrelevant and are not flagged: both trims leave them alone.
 */
export function hasAmbiguousEdgeWhitespace(value: string): boolean {
  const javaTrimmed = trimJava(value);
  return javaTrimmed !== javaTrimmed.trim();
}

/**
 * Canonicalises one field value: the exact literal that must be written to the XML **and**
 * hashed.
 *
 * @param name - Literal field name, used only for error messages.
 * @param value - Raw value, or `null`/`undefined` when the field is absent.
 * @returns The Java-trimmed value, or `null` when the field is absent or trims to empty.
 * @throws {VerifactuError} `IMPORTE_NO_SERIALIZADO` if a number or bigint was passed.
 * @throws {VerifactuError} `ESPACIO_AMBIGUO_EN_BORDE` if the edges land in the I-01 grey zone.
 */
export function canonicalizeValue(name: string, value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  assertSerialisedString(name, value);

  const trimmed = trimJava(value);
  if (trimmed === '') return null;

  assertNoAmbiguousEdgeWhitespace(name, trimmed);
  return trimmed;
}

/**
 * Renders one `nombreCampo=valorCampo` pair.
 *
 * Per §3 of the specification, a field that is absent from the record, or present but empty,
 * contributes only its name and the `=` character, with no value after it. The reference
 * implementation expresses this as `nombre + "=" + ((valor == null) ? "" : valor.trim())`.
 */
export function renderField(name: string, value: string | null | undefined): string {
  return `${name}=${canonicalizeValue(name, value) ?? ''}`;
}

/**
 * Joins rendered pairs with `&`.
 *
 * There is no trailing separator: the reference implementation appends the final field with
 * its `separador` flag set to `false`.
 */
export function joinFields(pairs: readonly string[]): string {
  return pairs.join('&');
}
