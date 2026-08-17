/**
 * `RegFactuSistemaFacturacion`: the whole submission — one header and 1 to 1000 records.
 *
 * ## A batch is a segment of a chain, not a set
 *
 * Every record's hash was computed over the previous record's hash, so the order of the batch is
 * not a presentation choice: it is the only way the AEAT can recompute the chain. This module
 * therefore refuses a batch that is not a **contiguous, ordered segment of one chain**, and says
 * at which index it broke.
 *
 * The cost of not checking is paid late. If a record in the middle is rejected, the AEAT sees a
 * gap and every later record hangs off a digest that, as far as they are concerned, never
 * existed. Detecting that before sending is local arithmetic; detecting it afterwards means
 * reconciling a chain against a remote state that no longer matches
 * (docs/spec-notes.md §19.6).
 *
 * What cannot be checked here: whether the **first** record of the batch chains correctly onto
 * the last record of the *previous* batch. That record is not in the message. `verifyChain` in
 * `@verifactu-js/core` is the tool for that.
 */

import type { Cabecera } from '@verifactu-js/validation';

import { writeCabecera } from './cabecera.js';
import { assertCardinalidad, VerifactuXmlError } from './errors.js';
import { NS_SUMINISTRO_INFORMACION, NS_SUMINISTRO_LR, PREFIX } from './namespaces.js';
import type { RegistroAlta, RegistroAnulacion } from './registro.js';
import { writeRegistroAlta, writeRegistroAnulacion } from './registro.js';
import { XmlWriter } from './writer.js';

const { sf, sfLR } = PREFIX;

/**
 * One occurrence of `RegistroFactura`: an alta **or** an anulación, never both.
 *
 * F3 §3.1.2 allows a single submission to mix them freely; what it forbids — and the XSD's
 * `choice` already prevents — is putting both inside the same occurrence.
 */
export type RegistroFactura = RegistroAlta | RegistroAnulacion;

/** `maxOccurs="1000"` on `RegistroFactura`, and a `sequence` cannot be empty. */
const MAX_REGISTROS = 1000;

/** Narrows a record by the discriminant its link already carries. */
function esAlta(registro: RegistroFactura): registro is RegistroAlta {
  return registro.eslabon.tipo === 'alta';
}

/** How a record is referred to by the one that follows it in the chain. */
interface Identidad {
  readonly IDEmisorFactura: string;
  readonly NumSerieFactura: string;
  readonly FechaExpedicionFactura: string;
}

/**
 * The identity of a record, as the *next* record must spell it.
 *
 * Note the asymmetry: an anulación is identified by its `…Anulada` fields, but the record that
 * chains onto it writes them under the plain names inside `RegistroAnterior`
 * (docs/spec-notes.md §2.1, §4).
 */
function identidadDe(registro: RegistroFactura): Identidad {
  if (esAlta(registro)) {
    const { IDEmisorFactura, NumSerieFactura, FechaExpedicionFactura } = registro.eslabon.fields;
    return { IDEmisorFactura, NumSerieFactura, FechaExpedicionFactura };
  }

  const { IDEmisorFacturaAnulada, NumSerieFacturaAnulada, FechaExpedicionFacturaAnulada } =
    registro.eslabon.fields;
  return {
    IDEmisorFactura: IDEmisorFacturaAnulada,
    NumSerieFactura: NumSerieFacturaAnulada,
    FechaExpedicionFactura: FechaExpedicionFacturaAnulada,
  };
}

/** The digest the record was hashed against: its predecessor's, or `null` if first in the chain. */
function huellaPrevia(registro: RegistroFactura): string | null {
  return registro.eslabon.fields.Huella;
}

function errorContiguidad(
  indice: number,
  message: string,
  causaProbable: string,
  accionSugerida: string,
): VerifactuXmlError {
  return new VerifactuXmlError({
    code: 'LOTE_NO_CONTIGUO',
    message: `Registro ${indice} del lote: ${message}`,
    causaProbable,
    accionSugerida,
    referencia: 'docs/spec-notes.md §19.6',
  });
}

/**
 * Checks that every record carries the NIF the header declares.
 *
 * F3 §3.1.3.1 and §3.1.4.1, one citation per record type: «El NIF del campo IDEmisorFactura
 * [Anulada] debe ser el mismo que el del campo NIF de la agrupación ObligadoEmision del bloque
 * Cabecera.»
 *
 * This is what reconciles "a chain may change NIF" (§4.3) with "a batch has one obligado": a
 * chain that changes NIF splits into two batches at that point.
 */
function assertMismoObligado(registros: readonly RegistroFactura[], nifObligado: string): void {
  for (const [indice, registro] of registros.entries()) {
    const emisor = identidadDe(registro).IDEmisorFactura;
    if (emisor === nifObligado) continue;

    throw new VerifactuXmlError({
      code: 'EMISOR_DISTINTO_DEL_OBLIGADO',
      message:
        `Registro ${indice} del lote: lo emite «${emisor}» y la cabecera declara obligado a ` +
        `«${nifObligado}».`,
      causaProbable:
        'La AEAT exige que el NIF emisor de cada registro coincida con el ObligadoEmision de la ' +
        'cabecera. Una cadena sí puede cambiar de NIF a lo largo del tiempo, pero un lote no: ' +
        'hay que partirlo justo donde cambia.',
      accionSugerida:
        `Envía en este lote solo los registros de «${nifObligado}», y los de «${emisor}» en otro ` +
        'con su propia cabecera.',
      referencia: 'docs/spec-notes.md §19.4; AEAT Validaciones v1.2.2 §3.1.3.1 y §3.1.4.1',
    });
  }
}

/**
 * Checks that the records form a contiguous, ordered segment of a single chain.
 *
 * @throws {VerifactuXmlError} `LOTE_NO_CONTIGUO`, naming the index where the segment breaks.
 */
function assertLoteContiguo(registros: readonly RegistroFactura[]): void {
  for (let i = 1; i < registros.length; i += 1) {
    // Guarded by the loop bounds; `noUncheckedIndexedAccess` still wants the reads narrowed.
    const registro = registros[i] as RegistroFactura;
    const anterior = registros[i - 1] as RegistroFactura;

    const esperada = anterior.eslabon.huella;
    const declarada = huellaPrevia(registro);

    if (declarada === null) {
      throw errorContiguidad(
        i,
        'se hasheó como primer registro de la cadena, pero no es el primero del lote.',
        'Solo el registro en la posición 0 puede ser PrimerRegistro. En medio del lote significa ' +
          'que la cadena se reinicia, y la AEAT recalcularía a partir de ahí una cadena distinta.',
        'Comprueba que no has mezclado registros de dos cadenas, o que no has vuelto a arrancar ' +
          'la cadena por haber perdido el último eslabón guardado.',
      );
    }

    if (declarada !== esperada) {
      throw errorContiguidad(
        i,
        `se hasheó contra la huella «${declarada}», pero el registro ${i - 1} tiene «${esperada}».`,
        'El lote no es un tramo contiguo de la cadena: falta algún registro entre esos dos, o el ' +
          'orden no es el de generación.',
        'Ordena los registros tal y como los devolvió createSifChain() y no te saltes ninguno. ' +
          'Si falta uno, va en este lote o el tramo se corta antes.',
      );
    }

    const referencia = registro.eslabon.registroAnterior;
    if (referencia === null) {
      throw errorContiguidad(
        i,
        'lleva la huella del anterior pero no identifica de qué registro es.',
        'El bloque RegistroAnterior necesita emisor, serie y fecha además de la huella.',
        'Serializa el eslabón tal y como lo devolvió createSifChain(), sin vaciarle campos.',
      );
    }

    const identidad = identidadDe(anterior);
    const campos = ['IDEmisorFactura', 'NumSerieFactura', 'FechaExpedicionFactura'] as const;
    for (const campo of campos) {
      if (referencia[campo] === identidad[campo]) continue;

      throw errorContiguidad(
        i,
        `apunta a un ${campo} «${referencia[campo]}» y el registro ${i - 1} tiene ` +
          `«${identidad[campo]}».`,
        'La huella encaja pero la identificación del registro anterior no. Dos registros con la ' +
          'misma huella y distinta identidad no pueden ser el mismo.',
        'Revisa cómo se ha construido el eslabón: la referencia y la huella tienen que salir del ' +
          'mismo registro anterior.',
      );
    }
  }
}

/** A complete submission. */
export interface Remision {
  readonly cabecera: Cabecera;
  /** 1 to 1000 records, in chain order. Altas and anulaciones may be mixed freely. */
  readonly registros: readonly RegistroFactura[];
}

/**
 * Writes `RegFactuSistemaFacturacion` into `w`, namespace declarations included.
 *
 * Validates the batch before emitting anything, so a rejected batch never leaves a half-written
 * document behind.
 *
 * @throws {VerifactuXmlError} `CARDINALIDAD_INVALIDA` outside 1..1000;
 *   `EMISOR_DISTINTO_DEL_OBLIGADO` when a record's issuer is not the declared obliged party;
 *   `LOTE_NO_CONTIGUO` when the records are not one ordered chain segment;
 *   `CABECERA_INCOHERENTE` for mutually exclusive header blocks.
 */
export function writeRemision(w: XmlWriter, remision: Remision): void {
  const { cabecera, registros } = remision;

  assertCardinalidad('RegistroFactura', registros.length, MAX_REGISTROS);
  assertMismoObligado(registros, cabecera.ObligadoEmision.NIF);
  assertLoteContiguo(registros);

  w.open(`${sfLR}:RegFactuSistemaFacturacion`, [
    { name: `xmlns:${sfLR}`, value: NS_SUMINISTRO_LR },
    { name: `xmlns:${sf}`, value: NS_SUMINISTRO_INFORMACION },
  ]);

  writeCabecera(w, cabecera);

  for (const registro of registros) {
    w.open(`${sfLR}:RegistroFactura`);
    if (esAlta(registro)) writeRegistroAlta(w, registro);
    else writeRegistroAnulacion(w, registro);
    w.close();
  }

  w.close();
}

/**
 * Serialises a submission as a standalone XML document, declaration included.
 *
 * For the SOAP envelope the service actually expects, see `serializarSobreSoap`. This exists for
 * validating against the XSD, for archiving, and for reading with your own eyes.
 */
export function serializarRemision(remision: Remision): string {
  const w = new XmlWriter();
  w.declaration();
  writeRemision(w, remision);
  return w.toString();
}
