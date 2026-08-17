/**
 * The `Cabecera` block: who is sending, on whose behalf, and under what circumstances.
 *
 * It travels in **every** submission and it is the block with the fewest examples in the official
 * documentation, so it is audited element by element in docs/spec-notes.md §19.
 *
 * Two things developers coming from the SII look for and will not find here:
 *
 * - **`IDVersion`** is not in the header. It is the first element of each `RegistroAlta` /
 *   `RegistroAnulacion`, one per record.
 * - **`TipoComunicacion`** does not exist in VERI*FACTU at all — zero occurrences across the
 *   schemas, the WSDL and the published documents. Its closest equivalent lives per record:
 *   `Subsanacion` and `RechazoPrevio`.
 */

import type { Cabecera, RemisionVoluntaria } from '@verifactu-js/validation';

import { VerifactuXmlError } from './errors.js';
import { PREFIX } from './namespaces.js';
import type { XmlWriter } from './writer.js';

const { sf, sfLR } = PREFIX;

/** True when the block carries no information at all, and is therefore not worth emitting. */
function vacio(bloque: RemisionVoluntaria): boolean {
  return bloque.FechaFinVeriFactu === undefined && bloque.Incidencia === undefined;
}

/**
 * Writes the `Cabecera`.
 *
 * @throws {VerifactuXmlError} `CABECERA_INCOHERENTE` when both submission-circumstance blocks are
 *   present. The XSD allows it; the AEAT's own rules do not (docs/spec-notes.md §19.3, D-16).
 */
export function writeCabecera(w: XmlWriter, cabecera: Cabecera): void {
  if (cabecera.RemisionVoluntaria !== undefined && cabecera.RemisionRequerimiento !== undefined) {
    throw new VerifactuXmlError({
      code: 'CABECERA_INCOHERENTE',
      message:
        'La cabecera lleva RemisionVoluntaria y RemisionRequerimiento a la vez, y son excluyentes.',
      causaProbable:
        'F3 §3.1.1 reserva RemisionVoluntaria (FechaFinVeriFactu, Incidencia) a los sistemas que ' +
        'emiten facturas verificables, y RefRequerimiento a los que emiten facturas no ' +
        'verificables, donde además es obligatorio. Un envío no puede ser las dos cosas. El XSD ' +
        'no lo impide porque declara los dos bloques como opcionales independientes.',
      accionSugerida:
        'Deja solo uno. Si el envío es VERI*FACTU voluntario, quita RemisionRequerimiento; si ' +
        'responde a un requerimiento de la AEAT, quita RemisionVoluntaria.',
      referencia: 'docs/spec-notes.md §19.3 y §10 (D-16)',
    });
  }

  // `sfLR`, not `sf`. The element `Cabecera` is *declared* in SuministroLR.xsd (with
  // elementFormDefault="qualified", so it takes that schema's namespace) but its **type** is
  // `sf:CabeceraType`, declared in SuministroInformacion.xsd — which is where its children get
  // their namespace from. Name and contents therefore live in different namespaces, and the
  // schema error for getting it wrong points at "Cabecera is not expected" without saying why.
  // The very same type is echoed back in the response as `sfR:Cabecera`.
  w.open(`${sfLR}:Cabecera`);

  w.open(`${sf}:ObligadoEmision`);
  w.element(`${sf}:NombreRazon`, cabecera.ObligadoEmision.NombreRazon);
  w.element(`${sf}:NIF`, cabecera.ObligadoEmision.NIF);
  w.close();

  if (cabecera.Representante !== undefined) {
    w.open(`${sf}:Representante`);
    w.element(`${sf}:NombreRazon`, cabecera.Representante.NombreRazon);
    w.element(`${sf}:NIF`, cabecera.Representante.NIF);
    w.close();
  }

  // An empty `<RemisionVoluntaria/>` validates and says nothing (D-17). Omit it instead.
  if (cabecera.RemisionVoluntaria !== undefined && !vacio(cabecera.RemisionVoluntaria)) {
    w.open(`${sf}:RemisionVoluntaria`);
    w.optional(`${sf}:FechaFinVeriFactu`, cabecera.RemisionVoluntaria.FechaFinVeriFactu);
    w.optional(`${sf}:Incidencia`, cabecera.RemisionVoluntaria.Incidencia);
    w.close();
  }

  if (cabecera.RemisionRequerimiento !== undefined) {
    w.open(`${sf}:RemisionRequerimiento`);
    w.element(`${sf}:RefRequerimiento`, cabecera.RemisionRequerimiento.RefRequerimiento);
    w.optional(`${sf}:FinRequerimiento`, cabecera.RemisionRequerimiento.FinRequerimiento);
    w.close();
  }

  w.close();
}
