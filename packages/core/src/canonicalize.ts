/**
 * Canonicalisation of field values for the record hash.
 *
 * Specification: AEAT, "Detalle de las especificaciones técnicas para generación de la huella o
 * hash de los registros de facturación", v0.1.2 (2024-08-27), §3.
 * Analysis and citations: docs/spec-notes.md §1.2, §1.3 and §1.3.1.
 */

import {
  assertNoAmbiguousEdgeWhitespace,
  assertSerialisedString,
  assertSerieValida,
} from './errors.js';

/**
 * Fields the AEAT restricts to a subset of ASCII (Validaciones v1.2.2 §3.1.3.1).
 *
 * These are the only free-text fields that enter the hash, which is exactly why the restriction
 * matters: forbidding `=` there is what stops the canonical string from being forgeable.
 * See docs/spec-notes.md §18.
 */
const CAMPOS_SERIE: ReadonlySet<string> = new Set(['NumSerieFactura', 'NumSerieFacturaAnulada']);

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
 * ## Medido contra preproducción el 19/08/2026 (sonda S-5)
 *
 * **I-02, cerrada.** Se envió una serie con dos espacios interiores seguidos y volvió `Correcto`:
 * la AEAT calculó la misma huella, luego **no los colapsa**. Se conservan, como ya hacemos.
 *
 * **I-01 e I-03, inalcanzables por construcción.** Las dos preguntan qué hace la AEAT con
 * caracteres que aquí no pueden llegar a una huella. `NumSerieFactura` y `NumSerieFacturaAnulada`
 * son los **únicos** campos de texto libre que entran en las huellas del alta y de la anulación
 * —los demás son NIF, fecha, enum, decimal y hex—, y los dos están restringidos a ASCII 32-126
 * por {@link assertSerieValida}. La AEAT restringe igual: rechazó con el código 1130 tanto un
 * NBSP (`U+00A0`) como un acento combinante (`U+0301`).
 *
 * Es decir, ni la semántica de recorte (I-01) ni la normalización Unicode (I-03) pueden cambiar
 * una huella producida o verificada por esta librería: el carácter que haría la pregunta
 * interesante no llega. Las dos siguen abiertas en el papel y ninguna bloquea nada. Ver
 * docs/spec-notes.md §24.
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
  if (CAMPOS_SERIE.has(name)) assertSerieValida(name, trimmed);
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
