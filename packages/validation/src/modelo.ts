/**
 * The record model: every field of a `RegistroAlta` / `RegistroAnulacion` that is **not** part of
 * the hash, plus the header.
 *
 * These types live here rather than in `@verifactu-js/xml` because the AEAT's business rules
 * (F3 §3.1) *are* the semantics of this model — which combinations of these fields are legal.
 * Type and rule belong together. `xml` imports them with `import type`, so depending on this
 * package costs it nothing at runtime.
 *
 * The eight hashed fields of an alta and the five of an anulación are **not** here: they belong
 * to `@verifactu-js/core`, which owns the digest and the chain.
 *
 * Amounts are always `string`, never `number`, for the same reason as in `core`: they are
 * serialised once by the caller and that same string feeds the XML and the hash. `String(131.40)`
 * is `"131.4"` (docs/spec-notes.md §1.7, D-1).
 */

/** `SiNoType`: the AEAT's boolean. */
export type SiNo = 'S' | 'N';

/** Invoice type keys (list L2). */
export type TipoFactura = 'F1' | 'F2' | 'F3' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';

/** Corrective invoice types: `S` sustitutiva, `I` por diferencias (list L3). */
export type TipoRectificativa = 'S' | 'I';

/** Party identified by something other than a Spanish NIF (`IDOtroType`). */
export interface IDOtro {
  /** ISO 3166-1 alpha-2. Not required when `IDType` is 02 (F3 §3.1.3.12). */
  readonly CodigoPais?: string;
  /** 02 NIF-IVA, 03 pasaporte, 04 documento oficial, 05 certificado de residencia, 06 otro, 07 no censado. */
  readonly IDType: string;
  /** The identifier itself, up to 20 characters. */
  readonly ID: string;
}

/** `PersonaFisicaJuridicaType`: a name plus either a NIF or an `IDOtro`, never both. */
export type PersonaFisicaJuridica = {
  readonly NombreRazon: string;
} & (
  | { readonly NIF: string; readonly IDOtro?: never }
  | { readonly NIF?: never; readonly IDOtro: IDOtro }
);

/**
 * `PersonaFisicaJuridicaESType`: name plus a Spanish NIF.
 *
 * Deliberately **not** {@link PersonaFisicaJuridica}: the header's two parties have no `IDOtro`
 * alternative in the schema. The party obliged to issue invoices, and their representative, are
 * necessarily Spanish.
 */
export interface PersonaES {
  readonly NombreRazon: string;
  readonly NIF: string;
}

/** `IDFacturaARType`: identifies an invoice being rectified or replaced. */
export interface IDFacturaAR {
  readonly IDEmisorFactura: string;
  readonly NumSerieFactura: string;
  /** `dd-mm-yyyy`. */
  readonly FechaExpedicionFactura: string;
}

/** `DesgloseRectificacionType`: what the rectified invoice used to say. */
export interface ImporteRectificacion {
  readonly BaseRectificada: string;
  readonly CuotaRectificada: string;
  readonly CuotaRecargoRectificado?: string;
}

/** `DetalleType`: one line of the tax breakdown. */
export interface DetalleDesglose {
  /** `01` IVA, `02` IPSI, `03` IGIC, `05` otros. Omitted means IVA (F3 §3.1.3.15). */
  readonly Impuesto?: string;
  /** Régimen key (list L8A for IVA, L8B for IGIC). */
  readonly ClaveRegimen?: string;
  /** `S1` sujeta no exenta, `S2` con inversión del sujeto pasivo, `N1`/`N2` no sujeta. Mutually exclusive with `OperacionExenta`. */
  readonly CalificacionOperacion?: string;
  /** `E1`…`E6`, the exemption cause (list L10). Mutually exclusive with `CalificacionOperacion`. */
  readonly OperacionExenta?: string;
  readonly TipoImpositivo?: string;
  readonly BaseImponibleOimporteNoSujeto: string;
  readonly BaseImponibleACoste?: string;
  readonly CuotaRepercutida?: string;
  readonly TipoRecargoEquivalencia?: string;
  readonly CuotaRecargoEquivalencia?: string;
}

/**
 * `SistemaInformaticoType`: the producer's declaration about the software itself.
 *
 * Present in **every** record, not once per batch (docs/spec-notes.md §6).
 *
 * The identification half is a {@link PersonaFisicaJuridica} because that is how the schema
 * declares it: an inner `sequence` of `NombreRazon` plus the same `NIF`/`IDOtro` choice every
 * other party uses.
 */
export type SistemaInformatico = PersonaFisicaJuridica & {
  readonly NombreSistemaInformatico: string;
  /** Two characters, `[A-Z0-9]` except `Ñ` (docs/spec-notes.md §10, D-3). */
  readonly IdSistemaInformatico: string;
  readonly Version: string;
  readonly NumeroInstalacion: string;
  /** `S` if the system can only operate in VERI*FACTU mode. */
  readonly TipoUsoPosibleSoloVerifactu: SiNo;
  /** `S` if the system can serve several obligated parties. */
  readonly TipoUsoPosibleMultiOT: SiNo;
  /** `S` if it is currently serving more than one. */
  readonly IndicadorMultiplesOT: SiNo;
};

/** Fields of a `RegistroAlta` that are **not** part of the hash. */
export interface DatosAlta {
  /** Caller's own reference. Echoed back in the response. */
  readonly RefExterna?: string;
  readonly NombreRazonEmisor: string;
  /** `S` when this record corrects one previously sent. */
  readonly Subsanacion?: SiNo;
  /** `S`/`N`/`X` — see docs/spec-notes.md §10, D-13: the anulación uses a different domain. */
  readonly RechazoPrevio?: 'S' | 'N' | 'X';
  /** `S` sustitutiva, `I` por diferencias. Required by the AEAT for types R1-R5. */
  readonly TipoRectificativa?: TipoRectificativa;
  /** 1 to 1000 entries. */
  readonly FacturasRectificadas?: readonly IDFacturaAR[];
  /** 1 to 1000 entries. */
  readonly FacturasSustituidas?: readonly IDFacturaAR[];
  readonly ImporteRectificacion?: ImporteRectificacion;
  /** `dd-mm-yyyy`, when the operation date differs from the issue date. */
  readonly FechaOperacion?: string;
  readonly DescripcionOperacion: string;
  readonly FacturaSimplificadaArt7273?: SiNo;
  readonly FacturaSinIdentifDestinatarioArt61d?: SiNo;
  /** `S` when `|ImporteTotal|` reaches 100 000 000,00 (F3 §3.1.3.10). */
  readonly Macrodato?: SiNo;
  /** `D` destinatario, `T` tercero. */
  readonly EmitidaPorTerceroODestinatario?: 'D' | 'T';
  readonly Tercero?: PersonaFisicaJuridica;
  /** 1 to 1000 entries. Absent for a simplified invoice. */
  readonly Destinatarios?: readonly PersonaFisicaJuridica[];
  readonly Cupon?: SiNo;
  /** 1 to 12 lines. */
  readonly Desglose: readonly DetalleDesglose[];
  readonly SistemaInformatico: SistemaInformatico;
  readonly NumRegistroAcuerdoFacturacion?: string;
  readonly IdAcuerdoSistemaInformatico?: string;
}

/** Fields of a `RegistroAnulacion` that are **not** part of the hash. */
export interface DatosAnulacion {
  readonly RefExterna?: string;
  /** `S` when cancelling an invoice that was never registered. */
  readonly SinRegistroPrevio?: SiNo;
  /** Only `S`/`N` here — `X` exists for the alta alone (docs/spec-notes.md §10, D-13). */
  readonly RechazoPrevio?: SiNo;
  /** `E` expedidor, `D` destinatario, `T` tercero. */
  readonly GeneradoPor?: 'E' | 'D' | 'T';
  readonly Generador?: PersonaFisicaJuridica;
  readonly SistemaInformatico: SistemaInformatico;
}

/**
 * Circumstances of a **voluntary** VERI*FACTU submission.
 *
 * Only for systems that issue verifiable invoices (F3 §3.1.1).
 */
export interface RemisionVoluntaria {
  /** Last date the system will act as VERI*FACTU. `dd-mm-yyyy`. */
  readonly FechaFinVeriFactu?: string;
  /** `S` when the submission was affected by a technical incident. Defaults to `N` if omitted. */
  readonly Incidencia?: SiNo;
}

/**
 * Circumstances of a submission answering an AEAT **requirement**.
 *
 * Only for systems that issue non-verifiable invoices, where it is mandatory (F3 §3.1.1).
 */
export interface RemisionRequerimiento {
  /** The AEAT's requirement reference, up to 18 characters. */
  readonly RefRequerimiento: string;
  /** `S` on the last submission of a multi-part answer. Defaults to `N` if omitted. */
  readonly FinRequerimiento?: SiNo;
}

/** `CabeceraType`. */
export interface Cabecera {
  /** The party obliged to issue the invoices. Every record in the batch must carry this NIF. */
  readonly ObligadoEmision: PersonaES;
  /** Only when the records were generated by an adviser or representative. */
  readonly Representante?: PersonaES;
  /** Mutually exclusive with {@link Cabecera.RemisionRequerimiento} — docs/spec-notes.md D-16. */
  readonly RemisionVoluntaria?: RemisionVoluntaria;
  /** Mutually exclusive with {@link Cabecera.RemisionVoluntaria}. */
  readonly RemisionRequerimiento?: RemisionRequerimiento;
}
