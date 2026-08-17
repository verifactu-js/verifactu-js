/**
 * The entry point: run every rule over a record and collect the findings.
 *
 * ## It never throws, and it never stops at the first problem
 *
 * A validator that throws makes the caller fix one thing per run. The AEAT returns every problem
 * it found in one response, and so does this: the point is to see the whole list before sending,
 * not to play twenty questions.
 *
 * ## It is not run for you when you serialise
 *
 * `@verifactu-js/xml` does **not** call this. Business rules change with each revision of the
 * AEAT's document — its own history has one that was added, removed and then kept for a single
 * field — while serialisation is structural and stable. A rule that fires when it should not
 * would block an invoice the AEAT would have accepted, and that is a worse failure than a
 * rejection you can read. Validate before sending, and decide what to do with what comes back.
 */

import { aplicar, type Problema } from './problemas.js';
import { type Linea, REGLAS_LINEA, REGLAS_TOTALES } from './reglas-desglose.js';
import {
  type Contexto,
  REGLAS_REGISTRO,
  type RegistroAltaValidable,
  reglasConReloj,
} from './reglas-registro.js';

export type { Contexto, RegistroAltaValidable } from './reglas-registro.js';

/**
 * Validates a `RegistroAlta` against the AEAT's business rules.
 *
 * @param registro - The hashed fields plus everything else. Works before or after hashing: the
 *   `Canonical<>` brand is not required, because nothing here writes a document.
 * @param contexto - Optional. Only the date rules use it.
 * @returns Every problem found, in rule order. Empty means nothing this library can check is
 *   wrong — see the README for what it cannot check.
 *
 * @example
 * ```ts
 * const problemas = validarRegistroAlta({ fields: eslabon.fields, datos });
 * const bloqueantes = problemas.filter((p) => p.severidad === 'rechazo');
 * if (bloqueantes.length > 0) throw new Error(bloqueantes[0].mensaje);
 * ```
 */
export function validarRegistroAlta(
  registro: RegistroAltaValidable,
  contexto: Contexto = {},
): Problema[] {
  const problemas = [
    ...aplicar(REGLAS_REGISTRO, registro),
    ...aplicar(reglasConReloj(contexto.ahora ?? new Date()), registro),
    ...aplicar(REGLAS_TOTALES, registro),
  ];

  for (const [indice, detalle] of registro.datos.Desglose.entries()) {
    const linea: Linea = { detalle, registro };
    problemas.push(...aplicar(REGLAS_LINEA, linea, indice));
  }

  return problemas;
}

/** True when nothing found would make the AEAT reject the record. */
export function esAceptable(problemas: readonly Problema[]): boolean {
  return !problemas.some((p) => p.severidad === 'rechazo');
}

/**
 * Every rule this package implements, with its citation and the document version it was read at.
 *
 * Exported so that a new revision of the AEAT's document can be reviewed section by section
 * instead of from scratch, and so a consumer can show the user *why* something was rejected.
 */
export function reglas(): ReadonlyArray<{
  readonly id: string;
  readonly campo: string;
  readonly seccion: string;
  readonly version: string;
  readonly severidad: string;
  readonly cita: string;
}> {
  return [
    ...REGLAS_REGISTRO,
    ...reglasConReloj(new Date()),
    ...REGLAS_TOTALES,
    ...REGLAS_LINEA,
  ].map((r) => ({
    id: r.id,
    campo: r.campo,
    seccion: r.fuente.seccion,
    version: r.fuente.version,
    severidad: r.severidad,
    cita: r.cita,
  }));
}
