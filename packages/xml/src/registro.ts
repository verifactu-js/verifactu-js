/**
 * Serialisation of `RegistroAlta` and `RegistroAnulacion`.
 *
 * ## The hashed literals are not parameters
 *
 * Neither function takes `TipoFactura`, `CuotaTotal`, `ImporteTotal`, the `IDFactura` block,
 * `FechaHoraHusoGenRegistro` or `Huella`. Those are read from the canonicalised link produced by
 * `createSifChain()` in `@verifactu-js/core`, whose `fields` carry the `Canonical<>` brand. It is
 * therefore not possible to write one literal into the XML and hash a different one: the type
 * system rejects a raw object, and the values come from a single place
 * (docs/spec-notes.md §1.3.1).
 *
 * ## Element order
 *
 * The order below is the `sequence` declared by `SuministroInformacion.xsd`
 * (`RegistroFacturacionAltaType`, `RegistroFacturacionAnulacionType`), not a convenient one.
 * XML Schema sequences are ordered, so a reordering is a validation error — which is why there is
 * a test that swaps two elements and expects the XSD to reject it.
 *
 * ## What this module deliberately does NOT do
 *
 * - **`ds:Signature`** (`minOccurs="0"`) is not emitted. XAdES belongs to a later phase, and a
 *   half-signature is worse than none.
 * - **Business validations** (AEAT Validaciones §3.1.3: `TipoRectificativa` required for R1-R5,
 *   `Macrodato` above 100 000 000, the `Desglose` rules) are **not** checked here. The XSD is
 *   checked in CI, and the structural invariants the XSD cannot express are checked below; the
 *   rest belongs to a validation module of its own. It is not silently assumed to be someone
 *   else's problem — it is listed here so the gap is visible.
 */

import type {
  Canonical,
  EslabonAltaCanonico,
  EslabonAnulacionCanonico,
  RegistroAltaHashInput,
  RegistroAnulacionHashInput,
} from '@verifactu-js/core';

import { assertCardinalidad, VerifactuXmlError } from './errors.js';
import { PREFIX } from './namespaces.js';
import type { XmlWriter } from './writer.js';

const sf = PREFIX.sf;

/** `SiNoType`: the AEAT's boolean. */
export type SiNo = 'S' | 'N';

/** Party identified by something other than a Spanish NIF (`IDOtroType`). */
export interface IDOtro {
  /** ISO 3166-1 alpha-2. Omitted for `IDType` 07 (not registered). */
  readonly CodigoPais?: string;
  /** `PersonaFisicaJuridicaIDTypeType`: 02 NIF-IVA, 03 pasaporte, 04 documento oficial, 05 certificado de residencia, 06 otro, 07 no censado. */
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

/**
 * `DetalleType`: one line of the tax breakdown.
 *
 * Every amount is a **string**, serialised once by the caller — the same rule as `CuotaTotal` and
 * `ImporteTotal` in `core`, for the same reason.
 */
export interface DetalleDesglose {
  /** `01` IVA, `02` IPSI, `03` IGIC, `05` otros. Omitted means IVA. */
  readonly Impuesto?: string;
  /** Régimen key (list L8A/L8B). Required for IVA and IGIC. */
  readonly ClaveRegimen?: string;
  /** `S1` sujeta no exenta sin inversión, `S2` con inversión del sujeto pasivo, `N1`/`N2` no sujeta. Mutually exclusive with `OperacionExenta`. */
  readonly CalificacionOperacion?: string;
  /** `E1`…`E6`, the exemption cause. Mutually exclusive with `CalificacionOperacion`. */
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
 * The identification half is a {@link PersonaFisicaJuridica} because that is literally how the
 * schema declares it: an inner `sequence` of `NombreRazon` plus the same `NIF`/`IDOtro` choice
 * every other party uses. Reusing the type keeps "exactly one of the two" enforced here too.
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
  readonly TipoRectificativa?: 'S' | 'I';
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
  /** `S` when the invoice exceeds the amount the AEAT considers a macrodato. */
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

/** A `RegistroAlta` ready to serialise: the canonical link plus everything outside the hash. */
export interface RegistroAlta {
  /** From `createSifChain().alta()`. Supplies every hashed literal and the record's own digest. */
  readonly eslabon: EslabonAltaCanonico;
  readonly datos: DatosAlta;
}

/** A `RegistroAnulacion` ready to serialise. */
export interface RegistroAnulacion {
  /** From `createSifChain().anulacion()`. */
  readonly eslabon: EslabonAnulacionCanonico;
  readonly datos: DatosAnulacion;
}

/**
 * `TipoHuella`, fixed at `01` (SHA-256).
 *
 * The XSD enumerates exactly one value, so this is not configurable — the same reasoning that
 * keeps the QR error-correction level fixed. A caller who could change it could only get it
 * wrong.
 */
const TIPO_HUELLA = '01';

/** `IDVersion`, fixed at `1.0`: the only value `VersionType` enumerates. */
const ID_VERSION = '1.0';

/** `Desglose/DetalleDesglose` — `maxOccurs="12"`, and a sequence cannot be empty. */
const MAX_DETALLE = 12;

/** `IDFacturaRectificada`, `IDFacturaSustituida` and `IDDestinatario` — `maxOccurs="1000"`. */
const MAX_LISTA = 1000;

/**
 * Writes the `Encadenamiento` block, deriving the choice from the record's own hashed `Huella`.
 *
 * The caller does not get to state "this is the first record" independently of the value that was
 * hashed. `Huella` empty and no predecessor means first record; `Huella` present means the
 * predecessor must be identified, and with *that* digest. Any other combination is a record whose
 * chaining block contradicts what was hashed — accepted by the XSD, accepted by the AEAT, and
 * flagged as "Aceptado con errores" long after the fact (docs/spec-notes.md §4, §8.7).
 */
function writeEncadenamiento(
  w: XmlWriter,
  huellaHasheada: string | null,
  anterior: EslabonAltaCanonico['registroAnterior'],
): void {
  w.open(`${sf}:Encadenamiento`);

  if (huellaHasheada === null && anterior === null) {
    w.element(`${sf}:PrimerRegistro`, 'S');
    w.close();
    return;
  }

  if (huellaHasheada === null || anterior === null) {
    throw new VerifactuXmlError({
      code: 'ENCADENAMIENTO_INCOHERENTE',
      message:
        huellaHasheada === null
          ? 'El registro se hasheó como primero de la cadena (Huella vacía) pero declara un registro anterior.'
          : 'El registro se hasheó con la huella de un registro anterior, pero no se ha identificado cuál.',
      causaProbable:
        'La huella se calcula sobre «Huella=<huella anterior>», así que el bloque Encadenamiento ' +
        'y el valor hasheado tienen que contar la misma historia. Aquí no coinciden.',
      accionSugerida:
        'Serializa el eslabón tal y como lo devolvió createSifChain(): ese objeto ya trae ' +
        'coherentes la huella hasheada y la referencia al registro anterior.',
      referencia: 'docs/spec-notes.md §4',
    });
  }

  if (anterior.Huella !== huellaHasheada) {
    throw new VerifactuXmlError({
      code: 'ENCADENAMIENTO_INCOHERENTE',
      message:
        'La huella del registro anterior no coincide con la que entró en el cálculo de esta huella: ' +
        `se hasheó «${huellaHasheada}» y el bloque Encadenamiento declara «${anterior.Huella}».`,
      causaProbable:
        'El eslabón se ha construido a mano, o se ha mezclado la referencia de un registro con la ' +
        'huella de otro. La AEAT no rechaza este registro: lo acepta y lo marca con errores.',
      accionSugerida:
        'Usa el eslabón que devuelve createSifChain() sin modificarlo, o iguala ambos valores.',
      referencia: 'docs/spec-notes.md §4 y §8.7',
    });
  }

  w.open(`${sf}:RegistroAnterior`);
  w.element(`${sf}:IDEmisorFactura`, anterior.IDEmisorFactura);
  w.element(`${sf}:NumSerieFactura`, anterior.NumSerieFactura);
  w.element(`${sf}:FechaExpedicionFactura`, anterior.FechaExpedicionFactura);
  w.element(`${sf}:Huella`, anterior.Huella);
  w.close();
  w.close();
}

/** Writes the `NIF` / `IDOtro` choice shared by every party block. */
function writeIdentificacion(w: XmlWriter, parte: { NIF?: string; IDOtro?: IDOtro }): void {
  if (parte.NIF !== undefined) {
    w.element(`${sf}:NIF`, parte.NIF);
    return;
  }
  if (parte.IDOtro === undefined) {
    throw new VerifactuXmlError({
      code: 'CARDINALIDAD_INVALIDA',
      message: 'Hay que informar «NIF» o «IDOtro»; no se ha recibido ninguno de los dos.',
      causaProbable:
        'El esquema declara los dos como una elección obligatoria, no como opcionales.',
      accionSugerida:
        'Informa «NIF» para un obligado español, o «IDOtro» (CodigoPais, IDType, ID) para uno ' +
        'extranjero. IDOtro con CodigoPais=ES e IDType=01 no está permitido: usa NIF.',
      referencia: 'SuministroInformacion.xsd, IDOtroType',
    });
  }

  w.open(`${sf}:IDOtro`);
  w.optional(`${sf}:CodigoPais`, parte.IDOtro.CodigoPais);
  w.element(`${sf}:IDType`, parte.IDOtro.IDType);
  w.element(`${sf}:ID`, parte.IDOtro.ID);
  w.close();
}

/** Writes a `PersonaFisicaJuridicaType` under the given element name. */
function writePersona(w: XmlWriter, nombreElemento: string, persona: PersonaFisicaJuridica): void {
  w.open(nombreElemento);
  w.element(`${sf}:NombreRazon`, persona.NombreRazon);
  writeIdentificacion(w, persona);
  w.close();
}

/** Writes an `IDFacturaARType` under the given element name. */
function writeIDFacturaAR(w: XmlWriter, nombreElemento: string, factura: IDFacturaAR): void {
  w.open(nombreElemento);
  w.element(`${sf}:IDEmisorFactura`, factura.IDEmisorFactura);
  w.element(`${sf}:NumSerieFactura`, factura.NumSerieFactura);
  w.element(`${sf}:FechaExpedicionFactura`, factura.FechaExpedicionFactura);
  w.close();
}

/** Writes the `SistemaInformatico` block. */
function writeSistemaInformatico(w: XmlWriter, sistema: SistemaInformatico): void {
  w.open(`${sf}:SistemaInformatico`);
  w.element(`${sf}:NombreRazon`, sistema.NombreRazon);
  writeIdentificacion(w, sistema);
  w.element(`${sf}:NombreSistemaInformatico`, sistema.NombreSistemaInformatico);
  w.element(`${sf}:IdSistemaInformatico`, sistema.IdSistemaInformatico);
  w.element(`${sf}:Version`, sistema.Version);
  w.element(`${sf}:NumeroInstalacion`, sistema.NumeroInstalacion);
  w.element(`${sf}:TipoUsoPosibleSoloVerifactu`, sistema.TipoUsoPosibleSoloVerifactu);
  w.element(`${sf}:TipoUsoPosibleMultiOT`, sistema.TipoUsoPosibleMultiOT);
  w.element(`${sf}:IndicadorMultiplesOT`, sistema.IndicadorMultiplesOT);
  w.close();
}

/** Writes one `DetalleDesglose`. */
function writeDetalle(w: XmlWriter, detalle: DetalleDesglose): void {
  w.open(`${sf}:DetalleDesglose`);
  w.optional(`${sf}:Impuesto`, detalle.Impuesto);
  w.optional(`${sf}:ClaveRegimen`, detalle.ClaveRegimen);
  w.optional(`${sf}:CalificacionOperacion`, detalle.CalificacionOperacion);
  w.optional(`${sf}:OperacionExenta`, detalle.OperacionExenta);
  w.optional(`${sf}:TipoImpositivo`, detalle.TipoImpositivo);
  w.element(`${sf}:BaseImponibleOimporteNoSujeto`, detalle.BaseImponibleOimporteNoSujeto);
  w.optional(`${sf}:BaseImponibleACoste`, detalle.BaseImponibleACoste);
  w.optional(`${sf}:CuotaRepercutida`, detalle.CuotaRepercutida);
  w.optional(`${sf}:TipoRecargoEquivalencia`, detalle.TipoRecargoEquivalencia);
  w.optional(`${sf}:CuotaRecargoEquivalencia`, detalle.CuotaRecargoEquivalencia);
  w.close();
}

/** Writes a list of invoices under a container element, checking its cardinality first. */
function writeListaFacturas(
  w: XmlWriter,
  contenedor: string,
  hijo: string,
  facturas: readonly IDFacturaAR[] | undefined,
): void {
  if (facturas === undefined) return;
  assertCardinalidad(contenedor, facturas.length, MAX_LISTA);

  w.open(`${sf}:${contenedor}`);
  for (const factura of facturas) writeIDFacturaAR(w, `${sf}:${hijo}`, factura);
  w.close();
}

/**
 * Writes a complete `sf:RegistroAlta` element into `w`.
 *
 * @param w - Writer positioned inside the parent element.
 * @param registro - The canonical link plus the fields that are not hashed.
 * @throws {VerifactuXmlError} `ENCADENAMIENTO_INCOHERENTE` if the chaining block and the hashed
 *   `Huella` disagree; `CARDINALIDAD_INVALIDA` for an empty or oversized list.
 */
export function writeRegistroAlta(w: XmlWriter, registro: RegistroAlta): void {
  const { eslabon, datos } = registro;
  const fields: Canonical<RegistroAltaHashInput> = eslabon.fields;

  w.open(`${sf}:RegistroAlta`);
  w.element(`${sf}:IDVersion`, ID_VERSION);

  w.open(`${sf}:IDFactura`);
  w.element(`${sf}:IDEmisorFactura`, fields.IDEmisorFactura);
  w.element(`${sf}:NumSerieFactura`, fields.NumSerieFactura);
  w.element(`${sf}:FechaExpedicionFactura`, fields.FechaExpedicionFactura);
  w.close();

  w.optional(`${sf}:RefExterna`, datos.RefExterna);
  w.element(`${sf}:NombreRazonEmisor`, datos.NombreRazonEmisor);
  w.optional(`${sf}:Subsanacion`, datos.Subsanacion);
  w.optional(`${sf}:RechazoPrevio`, datos.RechazoPrevio);
  w.element(`${sf}:TipoFactura`, fields.TipoFactura);
  w.optional(`${sf}:TipoRectificativa`, datos.TipoRectificativa);

  writeListaFacturas(w, 'FacturasRectificadas', 'IDFacturaRectificada', datos.FacturasRectificadas);
  writeListaFacturas(w, 'FacturasSustituidas', 'IDFacturaSustituida', datos.FacturasSustituidas);

  if (datos.ImporteRectificacion !== undefined) {
    w.open(`${sf}:ImporteRectificacion`);
    w.element(`${sf}:BaseRectificada`, datos.ImporteRectificacion.BaseRectificada);
    w.element(`${sf}:CuotaRectificada`, datos.ImporteRectificacion.CuotaRectificada);
    w.optional(`${sf}:CuotaRecargoRectificado`, datos.ImporteRectificacion.CuotaRecargoRectificado);
    w.close();
  }

  w.optional(`${sf}:FechaOperacion`, datos.FechaOperacion);
  w.element(`${sf}:DescripcionOperacion`, datos.DescripcionOperacion);
  w.optional(`${sf}:FacturaSimplificadaArt7273`, datos.FacturaSimplificadaArt7273);
  w.optional(
    `${sf}:FacturaSinIdentifDestinatarioArt61d`,
    datos.FacturaSinIdentifDestinatarioArt61d,
  );
  w.optional(`${sf}:Macrodato`, datos.Macrodato);
  w.optional(`${sf}:EmitidaPorTerceroODestinatario`, datos.EmitidaPorTerceroODestinatario);

  if (datos.Tercero !== undefined) writePersona(w, `${sf}:Tercero`, datos.Tercero);

  if (datos.Destinatarios !== undefined) {
    assertCardinalidad('Destinatarios', datos.Destinatarios.length, MAX_LISTA);
    w.open(`${sf}:Destinatarios`);
    for (const destinatario of datos.Destinatarios) {
      writePersona(w, `${sf}:IDDestinatario`, destinatario);
    }
    w.close();
  }

  w.optional(`${sf}:Cupon`, datos.Cupon);

  assertCardinalidad('Desglose', datos.Desglose.length, MAX_DETALLE);
  w.open(`${sf}:Desglose`);
  for (const detalle of datos.Desglose) writeDetalle(w, detalle);
  w.close();

  w.element(`${sf}:CuotaTotal`, fields.CuotaTotal);
  w.element(`${sf}:ImporteTotal`, fields.ImporteTotal);

  writeEncadenamiento(w, fields.Huella, eslabon.registroAnterior);
  writeSistemaInformatico(w, datos.SistemaInformatico);

  w.element(`${sf}:FechaHoraHusoGenRegistro`, fields.FechaHoraHusoGenRegistro);
  w.optional(`${sf}:NumRegistroAcuerdoFacturacion`, datos.NumRegistroAcuerdoFacturacion);
  w.optional(`${sf}:IdAcuerdoSistemaInformatico`, datos.IdAcuerdoSistemaInformatico);
  w.element(`${sf}:TipoHuella`, TIPO_HUELLA);
  w.element(`${sf}:Huella`, eslabon.huella);
  w.close();
}

/**
 * Writes a complete `sf:RegistroAnulacion` element into `w`.
 *
 * Note the `Anulada` suffixes inside `IDFactura`: they are different element names from the
 * alta's, and different literals inside the hashed string too (docs/spec-notes.md §2.1).
 *
 * @throws {VerifactuXmlError} Same conditions as {@link writeRegistroAlta}.
 */
export function writeRegistroAnulacion(w: XmlWriter, registro: RegistroAnulacion): void {
  const { eslabon, datos } = registro;
  const fields: Canonical<RegistroAnulacionHashInput> = eslabon.fields;

  w.open(`${sf}:RegistroAnulacion`);
  w.element(`${sf}:IDVersion`, ID_VERSION);

  w.open(`${sf}:IDFactura`);
  w.element(`${sf}:IDEmisorFacturaAnulada`, fields.IDEmisorFacturaAnulada);
  w.element(`${sf}:NumSerieFacturaAnulada`, fields.NumSerieFacturaAnulada);
  w.element(`${sf}:FechaExpedicionFacturaAnulada`, fields.FechaExpedicionFacturaAnulada);
  w.close();

  w.optional(`${sf}:RefExterna`, datos.RefExterna);
  w.optional(`${sf}:SinRegistroPrevio`, datos.SinRegistroPrevio);
  w.optional(`${sf}:RechazoPrevio`, datos.RechazoPrevio);
  w.optional(`${sf}:GeneradoPor`, datos.GeneradoPor);

  if (datos.Generador !== undefined) writePersona(w, `${sf}:Generador`, datos.Generador);

  writeEncadenamiento(w, fields.Huella, eslabon.registroAnterior);
  writeSistemaInformatico(w, datos.SistemaInformatico);

  w.element(`${sf}:FechaHoraHusoGenRegistro`, fields.FechaHoraHusoGenRegistro);
  w.element(`${sf}:TipoHuella`, TIPO_HUELLA);
  w.element(`${sf}:Huella`, eslabon.huella);
  w.close();
}
