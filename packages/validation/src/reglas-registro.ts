/**
 * Record-level business rules: AEAT «Validaciones y Errores» §3.1.3, items 1 to 14.
 *
 * Each rule quotes its own text and records the document version it was read at. See
 * {@link Regla} for why the version travels with the rule and not just with the package.
 *
 * ## What is deliberately not here
 *
 * Rules of the form «el NIF debe estar identificado (en la AEAT)» — §3.1.3.4, §3.1.3.12,
 * §3.1.3.13 and the header's §3.1.1 — are **not** implemented and cannot be: they are a query
 * against the AEAT's census, not a property of the document. They are listed in the README so the
 * gap is visible rather than assumed.
 */

import type { RegistroAltaHashInput } from '@verifactu-js/core';

import { aCentimos, aFecha } from './importes.js';
import type { DatosAlta, IDOtro, PersonaFisicaJuridica } from './modelo.js';
import { type Regla, regla } from './problemas.js';

/** A record ready to validate. Unbranded on purpose: you can check it before hashing it. */
export interface RegistroAltaValidable {
  /** The eight fields that feed the hash. From `core`, or built by hand before hashing. */
  readonly fields: RegistroAltaHashInput;
  /** Everything else. */
  readonly datos: DatosAlta;
}

/** Invoice types that are corrective (list L2). */
const RECTIFICATIVAS: ReadonlySet<string> = new Set(['R1', 'R2', 'R3', 'R4', 'R5']);

/** Types that must carry at least one recipient (F3 §3.1.3.13). */
const CON_DESTINATARIO: ReadonlySet<string> = new Set(['F1', 'F3', 'R1', 'R2', 'R3', 'R4']);

/** Types that must not carry recipients (F3 §3.1.3.13). */
const SIN_DESTINATARIO: ReadonlySet<string> = new Set(['F2', 'R5']);

/** `|ImporteTotal|` from which `Macrodato` becomes mandatory, in cents (F3 §3.1.3.10). */
const UMBRAL_MACRODATO = 100_000_000_00;

/** Entry into force of the Orden, and the earliest issue date the AEAT accepts (F3 §3.1.3.1). */
const ENTRADA_EN_VIGOR = Date.UTC(2024, 9, 28);

/** Context a few rules need beyond the record itself. */
export interface Contexto {
  /** Clock, injectable so the date rules are testable. Defaults to the system clock. */
  readonly ahora?: Date;
}

const identificacion = (parte: PersonaFisicaJuridica): IDOtro | undefined => parte.IDOtro;

/** Rules that need nothing but the record. */
export const REGLAS_REGISTRO: readonly Regla<RegistroAltaValidable>[] = [
  regla({
    seccion: '3.1.3.1',
    campo: 'FechaExpedicionFactura',
    cita: 'La FechaExpedicionFactura no debe ser inferior a 28/10/2024 (fecha de entrada en vigor de la Orden Ministerial de VERI*FACTU).',
    comprobar: ({ fields }) => {
      const fecha = aFecha(fields.FechaExpedicionFactura);
      if (fecha === null || fecha >= ENTRADA_EN_VIGOR) return undefined;
      return `La fecha de expedición ${fields.FechaExpedicionFactura} es anterior al 28-10-2024.`;
    },
  }),

  regla({
    seccion: '3.1.3.2',
    campo: 'RechazoPrevio',
    cita: 'Solo podrá incluirse el campo RechazoPrevio con valor “X” si se ha informado el campo Subsanacion y tiene el valor “S”. No podrá informarse el campo RechazoPrevio con valor “S” si no se informa el campo Subsanación o éste tiene el valor “N”.',
    comprobar: ({ datos }) => {
      const { RechazoPrevio, Subsanacion } = datos;
      if (RechazoPrevio === 'X' && Subsanacion !== 'S') {
        return 'RechazoPrevio = "X" exige Subsanacion = "S".';
      }
      if (RechazoPrevio === 'S' && Subsanacion !== 'S') {
        return 'RechazoPrevio = "S" no puede informarse sin Subsanacion = "S".';
      }
      return undefined;
    },
  }),

  regla({
    seccion: '3.1.3.3',
    campo: 'TipoRectificativa',
    cita: 'Solo podrá incluirse este campo si el valor del campo TipoFactura es igual a “R1”, “R2”, “R3”, “R4” o “R5”. Campo obligatorio si TipoFactura es igual a “R1”, “R2”, “R3”, “R4” o “R5”.',
    comprobar: ({ fields, datos }) => {
      const esRectificativa = RECTIFICATIVAS.has(fields.TipoFactura);
      if (esRectificativa && datos.TipoRectificativa === undefined) {
        return `TipoFactura ${fields.TipoFactura} exige TipoRectificativa, y no se ha informado.`;
      }
      if (!esRectificativa && datos.TipoRectificativa !== undefined) {
        return `TipoRectificativa solo cabe en una factura rectificativa, y TipoFactura es ${fields.TipoFactura}.`;
      }
      return undefined;
    },
  }),

  regla({
    seccion: '3.1.3.4',
    campo: 'FacturasRectificadas',
    cita: 'Sólo podrá incluirse esta agrupación (no es obligatoria) si TipoFactura es igual a “R1”, “R2”, “R3”, “R4” o “R5”.',
    comprobar: ({ fields, datos }) =>
      datos.FacturasRectificadas !== undefined && !RECTIFICATIVAS.has(fields.TipoFactura)
        ? `FacturasRectificadas solo cabe en una rectificativa, y TipoFactura es ${fields.TipoFactura}.`
        : undefined,
  }),

  regla({
    seccion: '3.1.3.5',
    campo: 'FacturasSustituidas',
    cita: 'Sólo podrá incluirse esta agrupación (no es obligatoria) cuando el campo TipoFactura="F3".',
    comprobar: ({ fields, datos }) =>
      datos.FacturasSustituidas !== undefined && fields.TipoFactura !== 'F3'
        ? `FacturasSustituidas exige TipoFactura = "F3", y es ${fields.TipoFactura}.`
        : undefined,
  }),

  regla({
    seccion: '3.1.3.6',
    campo: 'ImporteRectificacion',
    cita: 'Sólo deberá incluirse esta agrupación si el campo TipoRectificativa = "S". Obligatorio si TipoRectificativa = “S”.',
    comprobar: ({ datos }) => {
      const sustitutiva = datos.TipoRectificativa === 'S';
      if (sustitutiva && datos.ImporteRectificacion === undefined) {
        return 'TipoRectificativa = "S" exige ImporteRectificacion, y no se ha informado.';
      }
      if (!sustitutiva && datos.ImporteRectificacion !== undefined) {
        return 'ImporteRectificacion solo cabe con TipoRectificativa = "S".';
      }
      return undefined;
    },
  }),

  regla({
    seccion: '3.1.3.8',
    campo: 'FacturaSimplificadaArt7273',
    cita: 'Sólo se podrá rellenar con “S” si TipoFactura=“F1” o “F3” o “R1” o “R2” o “R3” o “R4”.',
    comprobar: ({ fields, datos }) =>
      datos.FacturaSimplificadaArt7273 === 'S' && !CON_DESTINATARIO.has(fields.TipoFactura)
        ? `FacturaSimplificadaArt7273 = "S" no cabe con TipoFactura ${fields.TipoFactura}.`
        : undefined,
  }),

  regla({
    seccion: '3.1.3.9',
    campo: 'FacturaSinIdentifDestinatarioArt61d',
    cita: 'Sólo se podrá rellenar con “S” si TipoFactura=”F2” o “R5”.',
    comprobar: ({ fields, datos }) =>
      datos.FacturaSinIdentifDestinatarioArt61d === 'S' && !SIN_DESTINATARIO.has(fields.TipoFactura)
        ? `FacturaSinIdentifDestinatarioArt61d = "S" no cabe con TipoFactura ${fields.TipoFactura}.`
        : undefined,
  }),

  regla({
    seccion: '3.1.3.10',
    campo: 'Macrodato',
    cita: 'Campo obligatorio si ImporteTotal >= |100.000.000,00| (valor absoluto).',
    comprobar: ({ fields, datos }) => {
      const total = aCentimos(fields.ImporteTotal);
      if (total === null) return undefined;
      return Math.abs(total) >= UMBRAL_MACRODATO && datos.Macrodato === undefined
        ? `ImporteTotal ${fields.ImporteTotal} alcanza el umbral de macrodato y falta el campo Macrodato.`
        : undefined;
    },
  }),

  regla({
    seccion: '3.1.3.11',
    campo: 'EmitidaPorTerceroODestinatario',
    cita: 'Si es igual a “T”, el bloque Tercero será de cumplimentación obligatoria. Si es igual a “D”, el bloque Destinatarios será de cumplimentación obligatoria.',
    comprobar: ({ datos }) => {
      if (datos.EmitidaPorTerceroODestinatario === 'T' && datos.Tercero === undefined) {
        return 'EmitidaPorTerceroODestinatario = "T" exige el bloque Tercero.';
      }
      if (datos.EmitidaPorTerceroODestinatario === 'D' && datos.Destinatarios === undefined) {
        return 'EmitidaPorTerceroODestinatario = "D" exige el bloque Destinatarios.';
      }
      return undefined;
    },
  }),

  regla({
    seccion: '3.1.3.12',
    campo: 'Tercero',
    cita: 'Solo podrá cumplimentarse si EmitidaPorTerceroODestinatario es “T”. Si se identifica mediante NIF, el NIF debe estar identificado y ser distinto del NIF del campo IDEmisorFactura. Si se identifica a través de la agrupación IDOtro y CodigoPais sea "ES", se validará que el campo IDType sea “03”. No se admite el tipo de identificación IDType “07” (No censado).',
    comprobar: ({ fields, datos }) => {
      const tercero = datos.Tercero;
      if (tercero === undefined) return undefined;

      const problemas: string[] = [];
      if (datos.EmitidaPorTerceroODestinatario !== 'T') {
        problemas.push('El bloque Tercero solo cabe con EmitidaPorTerceroODestinatario = "T".');
      }
      if (tercero.NIF !== undefined && tercero.NIF === fields.IDEmisorFactura) {
        problemas.push(`El NIF del tercero coincide con el del emisor (${tercero.NIF}).`);
      }

      const otro = identificacion(tercero);
      if (otro !== undefined) {
        if (otro.IDType === '07') problemas.push('El tercero no admite IDType "07" (no censado).');
        if (otro.CodigoPais === 'ES' && otro.IDType !== '03') {
          problemas.push(
            `Un tercero con CodigoPais "ES" exige IDType "03", y es "${otro.IDType}".`,
          );
        }
      }

      return problemas.length > 0 ? problemas : undefined;
    },
  }),

  regla({
    seccion: '3.1.3.13',
    campo: 'Destinatarios',
    cita: 'Si TipoFactura es “F1”, “F3”, “R1”, “R2”, “R3” o “R4”, la agrupación Destinatarios tiene que estar cumplimentada, con al menos un destinatario. Si TipoFactura es “F2” o “R5”, la agrupación Destinatarios no puede estar cumplimentada. Si el campo IDType = “07” (No censado), el campo CodigoPais debe ser “ES”. Cuando uno o varios destinatarios se identifiquen a través de la agrupación IDOtro y CodigoPais sea "ES", se validará que el campo IDType sea “03” o “07”. Cuando se identifique a través del bloque “IDOtro” y IDType sea “02”, se validará que TipoFactura sea “F1”, “F3”, “R1”, “R2”, “R3” ó “R4”.',
    comprobar: ({ fields, datos }) => {
      const problemas: string[] = [];
      const destinatarios = datos.Destinatarios;

      if (CON_DESTINATARIO.has(fields.TipoFactura) && (destinatarios ?? []).length === 0) {
        problemas.push(
          `TipoFactura ${fields.TipoFactura} exige al menos un destinatario, y no hay ninguno.`,
        );
      }
      if (SIN_DESTINATARIO.has(fields.TipoFactura) && destinatarios !== undefined) {
        problemas.push(
          `TipoFactura ${fields.TipoFactura} no admite destinatarios, y se han informado ${destinatarios.length}.`,
        );
      }

      for (const [indice, destinatario] of (destinatarios ?? []).entries()) {
        const otro = identificacion(destinatario);
        if (otro === undefined) continue;

        if (otro.IDType === '07' && otro.CodigoPais !== 'ES') {
          problemas.push(`Destinatario ${indice}: IDType "07" exige CodigoPais "ES".`);
        }
        if (otro.CodigoPais === 'ES' && otro.IDType !== '03' && otro.IDType !== '07') {
          problemas.push(
            `Destinatario ${indice}: con CodigoPais "ES" el IDType debe ser "03" o "07", y es "${otro.IDType}".`,
          );
        }
        if (otro.IDType === '02' && !CON_DESTINATARIO.has(fields.TipoFactura)) {
          problemas.push(
            `Destinatario ${indice}: IDType "02" (NIF-IVA) no cabe con TipoFactura ${fields.TipoFactura}.`,
          );
        }
      }

      return problemas.length > 0 ? problemas : undefined;
    },
  }),

  regla({
    seccion: '3.1.3.14',
    campo: 'Cupon',
    cita: 'Sólo se podrá rellenar con “S” (no es obligatorio) si TipoFactura = ”R5” o “R1”.',
    comprobar: ({ fields, datos }) =>
      datos.Cupon === 'S' && fields.TipoFactura !== 'R5' && fields.TipoFactura !== 'R1'
        ? `Cupon = "S" solo cabe con TipoFactura "R1" o "R5", y es ${fields.TipoFactura}.`
        : undefined,
  }),
];

/** Rules that need to know what day it is. */
export function reglasConReloj(ahora: Date): readonly Regla<RegistroAltaValidable>[] {
  const hoy = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate());
  const haceVeinteAnios = Date.UTC(
    ahora.getUTCFullYear() - 20,
    ahora.getUTCMonth(),
    ahora.getUTCDate(),
  );
  const finDelAnioSiguiente = Date.UTC(ahora.getUTCFullYear() + 1, 11, 31);

  return [
    regla({
      seccion: '3.1.3.1',
      campo: 'FechaExpedicionFactura',
      cita: 'La FechaExpedicionFactura no podrá ser superior a la fecha actual.',
      comprobar: ({ fields }) => {
        const fecha = aFecha(fields.FechaExpedicionFactura);
        return fecha !== null && fecha > hoy
          ? `La fecha de expedición ${fields.FechaExpedicionFactura} está en el futuro.`
          : undefined;
      },
    }),

    regla({
      seccion: '3.1.3.7',
      campo: 'FechaOperacion',
      cita: 'La FechaOperacion no debe ser inferior a la fecha actual menos veinte años y no debe ser superior al año siguiente de la fecha actual.',
      comprobar: ({ datos }) => {
        const fecha = aFecha(datos.FechaOperacion);
        if (fecha === null) return undefined;
        if (fecha < haceVeinteAnios) {
          return `La fecha de operación ${datos.FechaOperacion} es de hace más de veinte años.`;
        }
        return fecha > finDelAnioSiguiente
          ? `La fecha de operación ${datos.FechaOperacion} va más allá del año siguiente al actual.`
          : undefined;
      },
    }),
  ];
}
