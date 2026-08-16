/**
 * Construction of the exact string the record hash is computed over, and of the literal field
 * values that must accompany it in the XML.
 *
 * These functions are pure, synchronous and exported on purpose: the canonical string is the
 * contract with the AEAT, so it must be inspectable and diffable, never an internal detail.
 *
 * Specification: AEAT hash spec v0.1.2 (2024-08-27) §3.
 * Analysis and citations: docs/spec-notes.md §1.1, §1.2, §1.3.1, §2.1.
 */

import { canonicalizeValue, joinFields, renderField } from './canonicalize.js';

declare const canonicalBrand: unique symbol;

/**
 * A value that has been through {@link canonicalizeRegistroAlta} or
 * {@link canonicalizeRegistroAnulacion}.
 *
 * The brand exists because canonical and raw field objects are structurally identical, so
 * without it TypeScript would happily let `@verifactu-js/xml` serialise the caller's raw input —
 * and then the literal in the XML would not be the literal the hash was computed over
 * (docs/spec-notes.md §1.3.1). A comment cannot prevent that; a nominal type can.
 *
 * `Canonical<T>` is assignable to `T`, so anything that merely reads the fields — `verifyChain`,
 * your database layer — keeps working with either.
 *
 * ## Coming back from storage
 *
 * A record read back from a database is a plain object with no brand. **Re-canonicalise it.**
 * Canonicalisation is idempotent — proven by test — so on already-canonical data it is a no-op
 * that returns the same values, branded:
 *
 * ```ts
 * const guardado = await db.cargarRegistro(id);            // RegistroAltaHashInput, sin marca
 * const { fields } = canonicalizeRegistroAlta(guardado);   // Canonical<RegistroAltaHashInput>
 * ```
 *
 * That is the official route back, and the only one. There is deliberately no `asCanonical()`
 * escape hatch: an unchecked cast would reintroduce exactly the bug the brand exists to prevent,
 * and re-canonicalising is cheap, total and already safe. If the stored data was *not* canonical,
 * this fixes it — or throws, if the problem is one we refuse to guess at.
 */
export type Canonical<T> = T & { readonly [canonicalBrand]: 'verifactu-canonical' };

/**
 * The eight fields of a `RegistroAlta` that feed the hash, in the order the specification
 * enumerates them — which is also their order of appearance in the record design.
 *
 * Every value must be the **exact literal** that will appear in the corresponding XML element.
 *
 * ## Amounts are strings, never numbers
 *
 * `CuotaTotal` and `ImporteTotal` are serialised once by the caller, and that same string feeds
 * both the XML and the hash. Passing a number throws: `String(131.40)` is `"131.4"`, which
 * would be hashed verbatim and silently disagree with the AEAT (docs/spec-notes.md §1.7, D-1).
 *
 * ## Whitespace: who owns the literal
 *
 * The specification hashes the value *after* trimming, while the XML may legitimately carry
 * padding — its own example hashes `"12345678 / G33"` for an element written as
 * `<NumSerieFactura>    12345678 / G33  </NumSerieFactura>`. That opens a gap between "what is
 * in the XML" and "what was hashed".
 *
 * **This package closes the gap rather than tolerating it.** `@verifactu-js/xml` must write the
 * values returned by {@link canonicalizeRegistroAlta}, not the caller's raw input. After
 * canonicalisation the XML literal and the hashed value are the same string by construction,
 * so trimming becomes a no-op on the AEAT's side and cannot diverge from ours.
 *
 * Values whose edges carry whitespace outside that guarantee — characters Java keeps but
 * JavaScript strips, such as NBSP — are **rejected**, because there the correct digest is
 * unknowable until I-01 is resolved.
 *
 * See docs/spec-notes.md §1.3.1 for the full decision.
 */
export interface RegistroAltaHashInput {
  /** `RegistroAlta/IDFactura/IDEmisorFactura` — NIF of the party obliged to issue the invoice. */
  readonly IDEmisorFactura: string;
  /** `RegistroAlta/IDFactura/NumSerieFactura` — series + invoice number. */
  readonly NumSerieFactura: string;
  /** `RegistroAlta/IDFactura/FechaExpedicionFactura` — issue date, `dd-mm-yyyy`. */
  readonly FechaExpedicionFactura: string;
  /** `RegistroAlta/TipoFactura` — invoice type key (list L2): F1, F2, F3, R1…R5. */
  readonly TipoFactura: string;
  /** `RegistroAlta/CuotaTotal` — serialised exactly as in the XML. Never a number. */
  readonly CuotaTotal: string;
  /** `RegistroAlta/ImporteTotal` — serialised exactly as in the XML. Never a number. */
  readonly ImporteTotal: string;
  /**
   * `RegistroAlta/Encadenamiento/RegistroAnterior/Huella` — hash of the previous record.
   *
   * `null` when this is the first record of the chain, which renders as `Huella=` with no
   * value. It is **not** 64 zeroes and **not** the hash of the empty string
   * (docs/spec-notes.md §4).
   */
  readonly Huella: string | null;
  /**
   * `RegistroAlta/FechaHoraHusoGenRegistro` — ISO 8601 with an explicit offset,
   * `YYYY-MM-DDThh:mm:ss±hh:mm`.
   */
  readonly FechaHoraHusoGenRegistro: string;
}

/**
 * The five fields of a `RegistroAnulacion` that feed the hash.
 *
 * Note the `Anulada` suffix on the first three field names: they are different literals from
 * their `RegistroAlta` counterparts, and they appear as such inside the hashed string.
 * `TipoFactura`, `CuotaTotal` and `ImporteTotal` do **not** take part
 * (docs/spec-notes.md §2.1).
 *
 * The whitespace contract is identical to {@link RegistroAltaHashInput}.
 */
export interface RegistroAnulacionHashInput {
  /** `RegistroAnulacion/IDFactura/IDEmisorFacturaAnulada`. */
  readonly IDEmisorFacturaAnulada: string;
  /** `RegistroAnulacion/IDFactura/NumSerieFacturaAnulada`. */
  readonly NumSerieFacturaAnulada: string;
  /** `RegistroAnulacion/IDFactura/FechaExpedicionFacturaAnulada` — `dd-mm-yyyy`. */
  readonly FechaExpedicionFacturaAnulada: string;
  /** `RegistroAnulacion/Encadenamiento/RegistroAnterior/Huella`, or `null` if first in chain. */
  readonly Huella: string | null;
  /** `RegistroAnulacion/FechaHoraHusoGenRegistro`. */
  readonly FechaHoraHusoGenRegistro: string;
}

/**
 * A canonicalised record: the literals to write to the XML, and the string that is hashed.
 *
 * `buildRegistroAltaHashInput(fields)` always equals `hashInput`. That identity is what makes
 * the XML and the hash agree by construction.
 */
export interface CanonicalRegistroAlta {
  /** Exact literals `@verifactu-js/xml` must write. Branded; see {@link Canonical}. */
  readonly fields: Canonical<RegistroAltaHashInput>;
  /** Exact string that is hashed. */
  readonly hashInput: string;
}

/** Canonicalised `RegistroAnulacion`. See {@link CanonicalRegistroAlta}. */
export interface CanonicalRegistroAnulacion {
  /** Exact literals `@verifactu-js/xml` must write. Branded; see {@link Canonical}. */
  readonly fields: Canonical<RegistroAnulacionHashInput>;
  /** Exact string that is hashed. */
  readonly hashInput: string;
}

/** Canonicalises a required field, collapsing "absent" to the empty string. */
function required(name: string, value: string): string {
  return canonicalizeValue(name, value) ?? '';
}

/**
 * Builds the canonical string hashed for a `RegistroAlta`.
 *
 * @example
 * ```ts
 * buildRegistroAltaHashInput({
 *   IDEmisorFactura: '89890001K',
 *   NumSerieFactura: '12345678/G33',
 *   FechaExpedicionFactura: '01-01-2024',
 *   TipoFactura: 'F1',
 *   CuotaTotal: '12.35',
 *   ImporteTotal: '123.45',
 *   Huella: null,
 *   FechaHoraHusoGenRegistro: '2024-01-01T19:20:30+01:00',
 * });
 * // 'IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&…&Huella=&FechaHoraHusoGenRegistro=…'
 * ```
 */
export function buildRegistroAltaHashInput(input: RegistroAltaHashInput): string {
  return joinFields([
    renderField('IDEmisorFactura', input.IDEmisorFactura),
    renderField('NumSerieFactura', input.NumSerieFactura),
    renderField('FechaExpedicionFactura', input.FechaExpedicionFactura),
    renderField('TipoFactura', input.TipoFactura),
    renderField('CuotaTotal', input.CuotaTotal),
    renderField('ImporteTotal', input.ImporteTotal),
    renderField('Huella', input.Huella),
    renderField('FechaHoraHusoGenRegistro', input.FechaHoraHusoGenRegistro),
  ]);
}

/** Builds the canonical string hashed for a `RegistroAnulacion`. */
export function buildRegistroAnulacionHashInput(input: RegistroAnulacionHashInput): string {
  return joinFields([
    renderField('IDEmisorFacturaAnulada', input.IDEmisorFacturaAnulada),
    renderField('NumSerieFacturaAnulada', input.NumSerieFacturaAnulada),
    renderField('FechaExpedicionFacturaAnulada', input.FechaExpedicionFacturaAnulada),
    renderField('Huella', input.Huella),
    renderField('FechaHoraHusoGenRegistro', input.FechaHoraHusoGenRegistro),
  ]);
}

/**
 * Canonicalises a `RegistroAlta`, returning both the literals for the XML and the hashed string.
 *
 * Use this — not the raw caller input — as the source of truth for serialisation.
 * See {@link RegistroAltaHashInput} and docs/spec-notes.md §1.3.1.
 */
export function canonicalizeRegistroAlta(input: RegistroAltaHashInput): CanonicalRegistroAlta {
  const fields: RegistroAltaHashInput = {
    IDEmisorFactura: required('IDEmisorFactura', input.IDEmisorFactura),
    NumSerieFactura: required('NumSerieFactura', input.NumSerieFactura),
    FechaExpedicionFactura: required('FechaExpedicionFactura', input.FechaExpedicionFactura),
    TipoFactura: required('TipoFactura', input.TipoFactura),
    CuotaTotal: required('CuotaTotal', input.CuotaTotal),
    ImporteTotal: required('ImporteTotal', input.ImporteTotal),
    Huella: canonicalizeValue('Huella', input.Huella),
    FechaHoraHusoGenRegistro: required('FechaHoraHusoGenRegistro', input.FechaHoraHusoGenRegistro),
  };

  return {
    fields: fields as Canonical<RegistroAltaHashInput>,
    hashInput: buildRegistroAltaHashInput(fields),
  };
}

/** Canonicalises a `RegistroAnulacion`. See {@link canonicalizeRegistroAlta}. */
export function canonicalizeRegistroAnulacion(
  input: RegistroAnulacionHashInput,
): CanonicalRegistroAnulacion {
  const fields: RegistroAnulacionHashInput = {
    IDEmisorFacturaAnulada: required('IDEmisorFacturaAnulada', input.IDEmisorFacturaAnulada),
    NumSerieFacturaAnulada: required('NumSerieFacturaAnulada', input.NumSerieFacturaAnulada),
    FechaExpedicionFacturaAnulada: required(
      'FechaExpedicionFacturaAnulada',
      input.FechaExpedicionFacturaAnulada,
    ),
    Huella: canonicalizeValue('Huella', input.Huella),
    FechaHoraHusoGenRegistro: required('FechaHoraHusoGenRegistro', input.FechaHoraHusoGenRegistro),
  };

  return {
    fields: fields as Canonical<RegistroAnulacionHashInput>,
    hashInput: buildRegistroAnulacionHashInput(fields),
  };
}
