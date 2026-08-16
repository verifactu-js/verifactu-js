/**
 * Chaining: generating linked records, verifying a whole chain, and the minimum check the
 * regulation demands before generating a new record.
 *
 * Analysis and citations: docs/spec-notes.md §4.
 */

import { formatFechaHoraHusoGenRegistro } from './datetime.js';
import { VerifactuError } from './errors.js';
import { type HashOptions, hashRegistroAlta, hashRegistroAnulacion } from './hash.js';
import type { RegistroAltaHashInput, RegistroAnulacionHashInput } from './hash-input.js';

/**
 * Identity of the invoice a record chains to, plus its hash — the contents of
 * `Encadenamiento/RegistroAnterior`.
 *
 * Note that `IDEmisorFactura` is part of it. The record design says so explicitly, because the
 * issuer's NIF **can change mid-chain** after a merger or takeover. Nothing here may assume a
 * constant NIF (docs/spec-notes.md §4.3).
 */
export interface RegistroAnteriorRef {
  /** NIF of the party obliged to issue the *previous* invoice. May differ from the current one. */
  readonly IDEmisorFactura: string;
  /** Series + number of the previous invoice. */
  readonly NumSerieFactura: string;
  /** Issue date of the previous invoice, `dd-mm-yyyy`. */
  readonly FechaExpedicionFactura: string;
  /** Hash of the previous record. */
  readonly Huella: string;
}

/** A stored `RegistroAlta` as one link of a chain. */
export interface EslabonAlta {
  readonly tipo: 'alta';
  /** Canonicalised literals — the ones written to the XML. See docs/spec-notes.md §1.3.1. */
  readonly fields: RegistroAltaHashInput;
  /** This record's own hash, as stored in `RegistroAlta/Huella`. */
  readonly huella: string;
  /** `null` when `Encadenamiento/PrimerRegistro` is `"S"`. */
  readonly registroAnterior: RegistroAnteriorRef | null;
}

/** A stored `RegistroAnulacion` as one link of a chain. */
export interface EslabonAnulacion {
  readonly tipo: 'anulacion';
  /** Canonicalised literals — the ones written to the XML. */
  readonly fields: RegistroAnulacionHashInput;
  /** This record's own hash, as stored in `RegistroAnulacion/Huella`. */
  readonly huella: string;
  /** `null` when `Encadenamiento/PrimerRegistro` is `"S"`. */
  readonly registroAnterior: RegistroAnteriorRef | null;
}

/** One link of a chain: an alta or an anulación. */
export type Eslabon = EslabonAlta | EslabonAnulacion;

/** What can go wrong in a chain. */
export type ChainIssueCode =
  /** No records were supplied. */
  | 'CADENA_VACIA'
  /** Recomputing the record's own hash does not reproduce the stored one: it was altered. */
  | 'HUELLA_NO_COINCIDE'
  /** The record chains to a hash that is not the previous record's: a break or a gap. */
  | 'ENCADENAMIENTO_ROTO'
  /** `RegistroAnterior` identifies an invoice that is not the previous record's. */
  | 'ANTERIOR_NO_COINCIDE'
  /** A first record declaring a predecessor, or a later record declaring itself first. */
  | 'PRIMER_REGISTRO_INCOHERENTE'
  /** `fields.Huella` and `registroAnterior.Huella` disagree inside the same record. */
  | 'HUELLA_PREVIA_INCOHERENTE'
  /** The last record is dated more than a minute ahead of now (art. 7.i.2º). */
  | 'RELOJ_DESFASADO';

/** A single finding, with enough context to act on it. */
export interface ChainIssue {
  /** Index within the supplied array. */
  readonly index: number;
  /** Stable, machine-readable code. */
  readonly code: ChainIssueCode;
  /** Explanation in Spanish. */
  readonly message: string;
  /** What was expected, when it makes sense to show it. */
  readonly esperado?: string;
  /** What was actually found. */
  readonly encontrado?: string;
}

/** Outcome of a chain check. */
export interface ChainVerification {
  /** `true` when nothing was found. */
  readonly ok: boolean;
  /** Index of the first faulty link, or `null` when `ok`. */
  readonly brokenAt: number | null;
  /** Everything found, in order. */
  readonly issues: readonly ChainIssue[];
}

/** Tolerance of art. 7.i.2º: the previous record may not be more than a minute in the future. */
const TOLERANCIA_RELOJ_MS = 60_000;

function sameInvoice(ref: RegistroAnteriorRef, link: Eslabon): boolean {
  const [emisor, serie, fecha] =
    link.tipo === 'alta'
      ? [
          link.fields.IDEmisorFactura,
          link.fields.NumSerieFactura,
          link.fields.FechaExpedicionFactura,
        ]
      : [
          link.fields.IDEmisorFacturaAnulada,
          link.fields.NumSerieFacturaAnulada,
          link.fields.FechaExpedicionFacturaAnulada,
        ];

  return (
    ref.IDEmisorFactura === emisor &&
    ref.NumSerieFactura === serie &&
    ref.FechaExpedicionFactura === fecha
  );
}

async function recomputeHuella(link: Eslabon, options: HashOptions): Promise<string> {
  return link.tipo === 'alta'
    ? hashRegistroAlta(link.fields, options)
    : hashRegistroAnulacion(link.fields, options);
}

/** Checks one link in isolation: its own hash, and its internal coherence. */
async function inspectLink(
  link: Eslabon,
  index: number,
  options: HashOptions,
): Promise<ChainIssue[]> {
  const issues: ChainIssue[] = [];

  const recomputed = await recomputeHuella(link, options);
  if (recomputed !== link.huella) {
    issues.push({
      index,
      code: 'HUELLA_NO_COINCIDE',
      message:
        `El registro ${index} no reproduce su propia huella: alguno de los campos que entran ` +
        'en el cálculo ha cambiado desde que se generó.',
      esperado: link.huella,
      encontrado: recomputed,
    });
  }

  const declarada = link.registroAnterior?.Huella ?? null;
  if (link.fields.Huella !== declarada) {
    issues.push({
      index,
      code: 'HUELLA_PREVIA_INCOHERENTE',
      message:
        `En el registro ${index}, la huella anterior usada para el cálculo no coincide con la ` +
        'del bloque Encadenamiento/RegistroAnterior del propio registro.',
      esperado: declarada ?? '(vacía)',
      encontrado: link.fields.Huella ?? '(vacía)',
    });
  }

  return issues;
}

/**
 * Verifies a complete chain of records, in order.
 *
 * Detects the three failure modes that matter: **alteration** (a record no longer reproduces
 * its own hash), **break** (a record chains to something that is not its predecessor) and
 * **gap** (a record was removed).
 *
 * Does not assume a constant NIF between links: the previous invoice's issuer is taken from
 * `registroAnterior`, exactly as the record design intends (docs/spec-notes.md §4.3).
 *
 * @param eslabones - The chain, oldest first.
 * @param options - Optionally injects a digest implementation.
 */
export async function verifyChain(
  eslabones: readonly Eslabon[],
  options: HashOptions = {},
): Promise<ChainVerification> {
  if (eslabones.length === 0) {
    return {
      ok: false,
      brokenAt: null,
      issues: [
        {
          index: -1,
          code: 'CADENA_VACIA',
          message: 'No se ha proporcionado ningún registro que verificar.',
        },
      ],
    };
  }

  const issues: ChainIssue[] = [];

  for (let index = 0; index < eslabones.length; index += 1) {
    const link = eslabones[index] as Eslabon;
    const previous = index === 0 ? null : (eslabones[index - 1] as Eslabon);

    issues.push(...(await inspectLink(link, index, options)));

    if (previous === null) {
      if (link.registroAnterior !== null) {
        issues.push({
          index,
          code: 'PRIMER_REGISTRO_INCOHERENTE',
          message:
            'El primer registro de la cadena declara un registro anterior. O falta el eslabón ' +
            'previo, o debería llevar PrimerRegistro="S".',
          encontrado: link.registroAnterior.Huella,
        });
      }
      continue;
    }

    if (link.registroAnterior === null) {
      issues.push({
        index,
        code: 'PRIMER_REGISTRO_INCOHERENTE',
        message:
          `El registro ${index} se declara primero de la cadena (PrimerRegistro="S") pero tiene ` +
          'un registro anterior delante.',
      });
      continue;
    }

    if (link.registroAnterior.Huella !== previous.huella) {
      issues.push({
        index,
        code: 'ENCADENAMIENTO_ROTO',
        message:
          `El registro ${index} encadena con una huella que no es la del registro ${index - 1}. ` +
          'Falta un registro por medio, o se han reordenado.',
        esperado: previous.huella,
        encontrado: link.registroAnterior.Huella,
      });
    }

    if (!sameInvoice(link.registroAnterior, previous)) {
      issues.push({
        index,
        code: 'ANTERIOR_NO_COINCIDE',
        message:
          `El bloque RegistroAnterior del registro ${index} identifica una factura distinta de ` +
          `la del registro ${index - 1}.`,
      });
    }
  }

  const brokenAt = issues.length === 0 ? null : Math.max(0, issues[0]?.index ?? 0);
  return { ok: issues.length === 0, brokenAt, issues };
}

/** Options for {@link verificarEncadenamientoPrevio}. */
export interface EncadenamientoPrevioOptions extends HashOptions {
  /** The instant that will be used to date the record about to be generated. */
  readonly ahora: Date;
}

/**
 * The check the regulation actually demands before generating a new record — a **two-link
 * window**, not a full chain walk.
 *
 * Article 7.i) of Orden HAC/1177/2024, quoted in the AEAT developer FAQ v1.3 §15:
 *
 * > «Salvo cuando se trate del primer registro de facturación, cada vez que el sistema
 * > informático vaya a generar un nuevo registro de facturación, de alta o de anulación, antes
 * > deberá comprobar que se cumplen los siguientes requisitos:
 * > 1.º El último registro de facturación generado está correctamente encadenado.
 * > 2.º La fecha y hora de generación del último registro de facturación generado no es
 * > superior en más de un minuto a la fecha y hora actuales…»
 *
 * So: verify that record `n-1` is correctly chained to record `n-2`, and that `n-1` is not
 * dated more than a minute into the future. That is all. {@link verifyChain} is a superset and
 * is the right tool for auditing, but this is the one with a legal basis for the generation
 * path — and it is O(1) rather than O(n), which matters when generating each invoice.
 *
 * @param ultimo - Record `n-1`, the last one generated.
 * @param penultimo - Record `n-2`, or `null` if `ultimo` is the first of the chain.
 */
export async function verificarEncadenamientoPrevio(
  ultimo: Eslabon,
  penultimo: Eslabon | null,
  options: EncadenamientoPrevioOptions,
): Promise<ChainVerification> {
  const issues: ChainIssue[] = [];

  issues.push(...(await inspectLink(ultimo, 0, options)));

  if (penultimo === null) {
    if (ultimo.registroAnterior !== null) {
      issues.push({
        index: 0,
        code: 'PRIMER_REGISTRO_INCOHERENTE',
        message:
          'Se ha indicado que no hay registro anterior, pero el último registro generado ' +
          'declara uno.',
      });
    }
  } else if (ultimo.registroAnterior === null) {
    issues.push({
      index: 0,
      code: 'PRIMER_REGISTRO_INCOHERENTE',
      message:
        'El último registro generado se declara primero de la cadena, pero se ha proporcionado ' +
        'un registro anterior.',
    });
  } else {
    if (ultimo.registroAnterior.Huella !== penultimo.huella) {
      issues.push({
        index: 0,
        code: 'ENCADENAMIENTO_ROTO',
        message: 'El último registro generado no encadena con el anterior.',
        esperado: penultimo.huella,
        encontrado: ultimo.registroAnterior.Huella,
      });
    }
    if (!sameInvoice(ultimo.registroAnterior, penultimo)) {
      issues.push({
        index: 0,
        code: 'ANTERIOR_NO_COINCIDE',
        message:
          'El bloque RegistroAnterior del último registro identifica una factura distinta de la ' +
          'del registro que se ha proporcionado como anterior.',
      });
    }
  }

  const generado = Date.parse(ultimo.fields.FechaHoraHusoGenRegistro);
  if (!Number.isNaN(generado) && generado - options.ahora.getTime() > TOLERANCIA_RELOJ_MS) {
    issues.push({
      index: 0,
      code: 'RELOJ_DESFASADO',
      message:
        'El último registro generado está fechado más de un minuto por delante de la hora ' +
        'actual. El artículo 7.i).2º lo prohíbe.',
      esperado: `<= ${new Date(options.ahora.getTime() + TOLERANCIA_RELOJ_MS).toISOString()}`,
      encontrado: ultimo.fields.FechaHoraHusoGenRegistro,
    });
  }

  return { ok: issues.length === 0, brokenAt: issues.length === 0 ? null : 0, issues };
}

/** Configuration of a chain. */
export interface SifChainConfig extends HashOptions {
  /**
   * IANA time zone of the system generating the records. Mandatory: no default, ever.
   * See docs/spec-notes.md §5.4.
   */
  readonly timeZone: string;
  /** Injectable clock, so generation is deterministic under test. Defaults to `Date.now`. */
  readonly now?: () => Date;
}

/** Invoice data for an alta. The chain supplies `Huella` and `FechaHoraHusoGenRegistro`. */
export interface AltaRequest {
  readonly IDEmisorFactura: string;
  readonly NumSerieFactura: string;
  readonly FechaExpedicionFactura: string;
  readonly TipoFactura: string;
  readonly CuotaTotal: string;
  readonly ImporteTotal: string;
  /** The last record generated in this chain, or `null` if this is the first. */
  readonly previous: Eslabon | null;
}

/** Invoice data for an anulación. */
export interface AnulacionRequest {
  readonly IDEmisorFacturaAnulada: string;
  readonly NumSerieFacturaAnulada: string;
  readonly FechaExpedicionFacturaAnulada: string;
  /** The last record generated in this chain, or `null` if this is the first. */
  readonly previous: Eslabon | null;
}

/** A chain: turns invoice data plus the previous record into the next record. */
export interface SifChain {
  /** Builds the next `RegistroAlta`. */
  alta(request: AltaRequest): Promise<EslabonAlta>;
  /** Builds the next `RegistroAnulacion`. */
  anulacion(request: AnulacionRequest): Promise<EslabonAnulacion>;
}

function referenciaA(link: Eslabon): RegistroAnteriorRef {
  return link.tipo === 'alta'
    ? {
        IDEmisorFactura: link.fields.IDEmisorFactura,
        NumSerieFactura: link.fields.NumSerieFactura,
        FechaExpedicionFactura: link.fields.FechaExpedicionFactura,
        Huella: link.huella,
      }
    : {
        IDEmisorFactura: link.fields.IDEmisorFacturaAnulada,
        NumSerieFactura: link.fields.NumSerieFacturaAnulada,
        FechaExpedicionFactura: link.fields.FechaExpedicionFacturaAnulada,
        Huella: link.huella,
      };
}

/**
 * Creates a chain.
 *
 * The chain holds no state and touches no storage: every call receives the previous record and
 * returns the next one. Where those records live is the caller's business
 * (VERIFACTU-BRIEF.md §2, principle 1).
 *
 * **What you must persist is the returned link**, `fields` included — not the request you sent
 * in. `fields` carries the canonicalised literals the hash was computed over; storing your own
 * input and reconstructing later will produce different hashes. See docs/spec-notes.md §1.3.1.
 *
 * @example
 * ```ts
 * const chain = createSifChain({ timeZone: 'Atlantic/Canary' });
 * const registro = await chain.alta({ ...datosFactura, previous: ultimoGuardado });
 * await db.save(registro); // the whole link, fields included
 * ```
 */
export function createSifChain(config: SifChainConfig): SifChain {
  if (typeof config?.timeZone !== 'string' || config.timeZone === '') {
    throw new VerifactuError({
      code: 'ZONA_HORARIA_DESCONOCIDA',
      message: 'Falta la zona horaria: «timeZone» es obligatorio al crear la cadena.',
      causaProbable:
        'No se ha indicado zona horaria. La librería no asume ninguna por defecto a propósito: ' +
        'un sistema en Canarias usa un huso distinto al peninsular durante todo el año.',
      accionSugerida: "Pasa la zona IANA, por ejemplo { timeZone: 'Atlantic/Canary' }.",
      referencia: 'docs/spec-notes.md §5.4',
    });
  }

  const { timeZone, now = () => new Date(), sha256 } = config;
  const hashOptions: HashOptions = sha256 ? { sha256 } : {};

  return {
    async alta(request: AltaRequest): Promise<EslabonAlta> {
      const registroAnterior = request.previous ? referenciaA(request.previous) : null;
      const fields: RegistroAltaHashInput = {
        IDEmisorFactura: request.IDEmisorFactura,
        NumSerieFactura: request.NumSerieFactura,
        FechaExpedicionFactura: request.FechaExpedicionFactura,
        TipoFactura: request.TipoFactura,
        CuotaTotal: request.CuotaTotal,
        ImporteTotal: request.ImporteTotal,
        Huella: registroAnterior?.Huella ?? null,
        FechaHoraHusoGenRegistro: formatFechaHoraHusoGenRegistro(now(), { timeZone }),
      };

      return {
        tipo: 'alta',
        fields,
        huella: await hashRegistroAlta(fields, hashOptions),
        registroAnterior,
      };
    },

    async anulacion(request: AnulacionRequest): Promise<EslabonAnulacion> {
      const registroAnterior = request.previous ? referenciaA(request.previous) : null;
      const fields: RegistroAnulacionHashInput = {
        IDEmisorFacturaAnulada: request.IDEmisorFacturaAnulada,
        NumSerieFacturaAnulada: request.NumSerieFacturaAnulada,
        FechaExpedicionFacturaAnulada: request.FechaExpedicionFacturaAnulada,
        Huella: registroAnterior?.Huella ?? null,
        FechaHoraHusoGenRegistro: formatFechaHoraHusoGenRegistro(now(), { timeZone }),
      };

      return {
        tipo: 'anulacion',
        fields,
        huella: await hashRegistroAnulacion(fields, hashOptions),
        registroAnterior,
      };
    },
  };
}
