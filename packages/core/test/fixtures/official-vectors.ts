/**
 * Golden test vectors for the VERI*FACTU record hash.
 *
 * These are FACTS transcribed from official / published sources, not derived from any
 * implementation. Do not "fix" a value here to make a test pass: if a test fails, the
 * implementation is wrong.
 *
 * Sources — see `docs/spec-notes.md` §1.8, §2.3 and §1.9 (consulted 2026-08-16):
 *
 *  - V1..V3: AEAT, "Detalle de las especificaciones técnicas para generación de la huella o
 *    hash de los registros de facturación", v0.1.2 (2024-08-27), §6.1, §6.2 and §6.3.
 *    Local copy: docs/reference/AEAT_huella_hash.pdf
 *
 *  - V4: README of https://github.com/mdiago/VeriFactu (lines 269-309, consulted 2026-08-16).
 *    Reproduced independently from the specification; used only as a third-party cross-check.
 *    That project is AGPL-3.0: no code is taken from it. Input/output pairs are facts, and
 *    are cited.
 */

/** A record-hash test vector: the exact canonical string and its expected SHA-256. */
export interface HashVector {
  /** Stable identifier used in test names. */
  readonly id: string;
  /** Human-readable provenance, printed on failure. */
  readonly source: string;
  /** The exact canonical input string the hash is computed over. */
  readonly canonicalString: string;
  /** Expected SHA-256, hex, uppercase, 64 chars. */
  readonly expectedHash: string;
}

/** Field values of a `RegistroAlta` as they appear in the XML, already serialised. */
export interface AltaVectorFields {
  readonly IDEmisorFactura: string;
  readonly NumSerieFactura: string;
  readonly FechaExpedicionFactura: string;
  readonly TipoFactura: string;
  readonly CuotaTotal: string;
  readonly ImporteTotal: string;
  /** Hash of the previous record; `null` when this is the first record of the chain. */
  readonly Huella: string | null;
  readonly FechaHoraHusoGenRegistro: string;
}

/** Field values of a `RegistroAnulacion` as they appear in the XML, already serialised. */
export interface AnulacionVectorFields {
  readonly IDEmisorFacturaAnulada: string;
  readonly NumSerieFacturaAnulada: string;
  readonly FechaExpedicionFacturaAnulada: string;
  readonly Huella: string | null;
  readonly FechaHoraHusoGenRegistro: string;
}

// ---------------------------------------------------------------------------------------------
// V1 — AEAT §6.1: first record of a chain (alta). Previous hash is absent.
// ---------------------------------------------------------------------------------------------

export const V1_ALTA_FIRST_FIELDS: AltaVectorFields = {
  IDEmisorFactura: '89890001K',
  NumSerieFactura: '12345678/G33',
  FechaExpedicionFactura: '01-01-2024',
  TipoFactura: 'F1',
  CuotaTotal: '12.35',
  ImporteTotal: '123.45',
  Huella: null,
  FechaHoraHusoGenRegistro: '2024-01-01T19:20:30+01:00',
};

export const V1_ALTA_FIRST: HashVector = {
  id: 'V1',
  source: 'AEAT huella v0.1.2 §6.1 — alta, first record of the SIF',
  canonicalString:
    'IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024' +
    '&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=' +
    '&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00',
  expectedHash: '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60',
};

// ---------------------------------------------------------------------------------------------
// V2 — AEAT §6.2: second (or subsequent) record, chained to V1.
// ---------------------------------------------------------------------------------------------

export const V2_ALTA_CHAINED_FIELDS: AltaVectorFields = {
  IDEmisorFactura: '89890001K',
  NumSerieFactura: '12345679/G34',
  FechaExpedicionFactura: '01-01-2024',
  TipoFactura: 'F1',
  CuotaTotal: '12.35',
  ImporteTotal: '123.45',
  Huella: V1_ALTA_FIRST.expectedHash,
  FechaHoraHusoGenRegistro: '2024-01-01T19:20:35+01:00',
};

export const V2_ALTA_CHAINED: HashVector = {
  id: 'V2',
  source: 'AEAT huella v0.1.2 §6.2 — alta, chained to a previous record',
  canonicalString:
    'IDEmisorFactura=89890001K&NumSerieFactura=12345679/G34&FechaExpedicionFactura=01-01-2024' +
    '&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45' +
    '&Huella=3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60' +
    '&FechaHoraHusoGenRegistro=2024-01-01T19:20:35+01:00',
  expectedHash: 'F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97',
};

// ---------------------------------------------------------------------------------------------
// V3 — AEAT §6.3: anulación, chained to V2. Five fields, `Anulada` suffix on the first three.
// ---------------------------------------------------------------------------------------------

export const V3_ANULACION_FIELDS: AnulacionVectorFields = {
  IDEmisorFacturaAnulada: '89890001K',
  NumSerieFacturaAnulada: '12345679/G34',
  FechaExpedicionFacturaAnulada: '01-01-2024',
  Huella: V2_ALTA_CHAINED.expectedHash,
  FechaHoraHusoGenRegistro: '2024-01-01T19:20:40+01:00',
};

export const V3_ANULACION: HashVector = {
  id: 'V3',
  source: 'AEAT huella v0.1.2 §6.3 — anulación, chained to a previous record',
  canonicalString:
    'IDEmisorFacturaAnulada=89890001K&NumSerieFacturaAnulada=12345679/G34' +
    '&FechaExpedicionFacturaAnulada=01-01-2024' +
    '&Huella=F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97' +
    '&FechaHoraHusoGenRegistro=2024-01-01T19:20:40+01:00',
  expectedHash: '177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68',
};

// ---------------------------------------------------------------------------------------------
// V4 — third-party cross-check (mdiago/VeriFactu README).
//
// Different NIF, serial with hyphens, different date, previous hash present, and — critically —
// amounts serialised with ONE decimal (21.4 / 131.4), not zero-padded to two. The same vector
// with 21.40 / 131.40 does NOT reproduce the published hash. This is the regression guard for
// the "serialise once" rule (docs/spec-notes.md §1.7, D-1).
// ---------------------------------------------------------------------------------------------

export const V4_MDIAGO_FIELDS: AltaVectorFields = {
  IDEmisorFactura: 'B72877814',
  NumSerieFactura: 'GITHUB-EJ-003',
  FechaExpedicionFactura: '04-11-2024',
  TipoFactura: 'F1',
  CuotaTotal: '21.4',
  ImporteTotal: '131.4',
  Huella: '8C8DCEFB120522E0C71BC19902F44D5334FF6C98E74F0E3AC1D1E5A30C2EA836',
  FechaHoraHusoGenRegistro: '2024-11-04T12:36:39+01:00',
};

export const V4_MDIAGO: HashVector = {
  id: 'V4',
  source: 'mdiago/VeriFactu README (third-party cross-check) — alta, one-decimal amounts',
  canonicalString:
    'IDEmisorFactura=B72877814&NumSerieFactura=GITHUB-EJ-003&FechaExpedicionFactura=04-11-2024' +
    '&TipoFactura=F1&CuotaTotal=21.4&ImporteTotal=131.4' +
    '&Huella=8C8DCEFB120522E0C71BC19902F44D5334FF6C98E74F0E3AC1D1E5A30C2EA836' +
    '&FechaHoraHusoGenRegistro=2024-11-04T12:36:39+01:00',
  expectedHash: '4EECCE4DD48C0539665385D61D451BA921B7160CA6FEF46CD3C2E2BC5C778E14',
};

/** The four golden vectors. Every one of these must pass before anything else ships. */
export const ALL_VECTORS: readonly HashVector[] = [
  V1_ALTA_FIRST,
  V2_ALTA_CHAINED,
  V3_ANULACION,
  V4_MDIAGO,
];

// ---------------------------------------------------------------------------------------------
// Sensitivity vectors — proof that the encoding is exact, not approximate.
// docs/spec-notes.md §1.9.
// ---------------------------------------------------------------------------------------------

/**
 * V1's canonical string with a trailing newline appended. Verified locally on 2026-08-16:
 * appending "\n" changes the hash, which proves no line terminator is added to the input.
 */
export const V1_WITH_TRAILING_NEWLINE = {
  input: `${V1_ALTA_FIRST.canonicalString}\n`,
  expectedHash: '31AED1A12718F6A86C9C4BB24AF6B6E138D880DE843FB4EA818C03EBB17638AA',
} as const;

/** V1's expected hash in lowercase — the value a naive implementation would produce. */
export const V1_HASH_LOWERCASE = '3c464daf61acb827c65fda19f352a4e3bdc2c640e9e9fc4cc058073f38f12f60';

// ---------------------------------------------------------------------------------------------
// Chain fixture — V1 -> V2 -> V3 form a REAL three-link chain in the AEAT document.
// Used to exercise chain verification, not just single-record hashing.
// docs/spec-notes.md §2.3, §4.3, §4.4.
// ---------------------------------------------------------------------------------------------

/** Identity of the invoice a record chains to (`Encadenamiento/RegistroAnterior`). */
export interface PreviousRecordRef {
  readonly IDEmisorFactura: string;
  readonly NumSerieFactura: string;
  readonly FechaExpedicionFactura: string;
  readonly Huella: string;
}

/** `RegistroAnterior` of V2: identifies V1's invoice plus V1's hash. */
export const V2_REGISTRO_ANTERIOR: PreviousRecordRef = {
  IDEmisorFactura: V1_ALTA_FIRST_FIELDS.IDEmisorFactura,
  NumSerieFactura: V1_ALTA_FIRST_FIELDS.NumSerieFactura,
  FechaExpedicionFactura: V1_ALTA_FIRST_FIELDS.FechaExpedicionFactura,
  Huella: V1_ALTA_FIRST.expectedHash,
};

/** `RegistroAnterior` of V3: identifies V2's invoice plus V2's hash. */
export const V3_REGISTRO_ANTERIOR: PreviousRecordRef = {
  IDEmisorFactura: V2_ALTA_CHAINED_FIELDS.IDEmisorFactura,
  NumSerieFactura: V2_ALTA_CHAINED_FIELDS.NumSerieFactura,
  FechaExpedicionFactura: V2_ALTA_CHAINED_FIELDS.FechaExpedicionFactura,
  Huella: V2_ALTA_CHAINED.expectedHash,
};
