/**
 * What a rule is, and what it reports.
 *
 * ## Every rule carries the version of the document it was read from
 *
 * The AEAT's validation document changes, and not only by adding rules. Its own revision history
 * shows one that was introduced in v1.1.3, removed in v1.1.4, and kept for a single field
 * (docs/spec-notes.md §18.2.1). A citation without a version cannot tell you what to re-read when
 * the next revision lands; a citation with one turns "review everything" into a diff.
 *
 * So {@link Regla.fuente} records **the version whose text was actually read** when the rule was
 * written. When a new F3 appears, compare the sections listed by {@link reglas} against it and
 * bump `version` per rule as each is re-checked.
 */

/** Documents these rules come from, at the versions they were read at. */
export const DOCUMENTOS = {
  /** «Validaciones y errores» — the business validations. */
  F3: {
    titulo: 'Validaciones y Errores. Sistemas Informáticos de Facturación y Sistemas VERI*FACTU',
    version: '1.2.2',
    fecha: '2026-02-23',
  },
} as const;

/** Which document, version and section a rule comes from. */
export interface Fuente {
  readonly documento: keyof typeof DOCUMENTOS;
  /** Version of that document whose text was read when writing the rule. */
  readonly version: string;
  /** Section number inside it, e.g. `3.1.3.3`. */
  readonly seccion: string;
}

/**
 * How the AEAT treats a breach.
 *
 * - `rechazo` — the record is rejected and not stored. F3 §3 (p. 6) sets this for business
 *   validations at record level: «provocarán el rechazo del registro, pero se seguirán procesando
 *   el resto de registros».
 * - `aviso` — the record **is stored**, flagged «Aceptado con errores». Some rules say so
 *   explicitly, and those are the dangerous ones: nothing fails loudly
 *   (docs/spec-notes.md §8.7).
 */
export type Severidad = 'rechazo' | 'aviso';

/** One finding. */
export interface Problema {
  /** Stable identifier, e.g. `F3-3.1.3.3`. Safe to branch on. */
  readonly regla: string;
  /** Field or group the finding is about. */
  readonly campo: string;
  /** What is wrong, in Spanish. */
  readonly mensaje: string;
  /** Verbatim text of the rule, so the caller can judge without opening the PDF. */
  readonly cita: string;
  readonly fuente: Fuente;
  readonly severidad: Severidad;
  /** Index into `Desglose` when the finding is about one breakdown line. */
  readonly linea?: number;
}

/** A rule: its identity and citation, plus the check itself. */
export interface Regla<T> {
  readonly id: string;
  readonly campo: string;
  readonly fuente: Fuente;
  readonly cita: string;
  readonly severidad: Severidad;
  /** Returns a message when the rule is broken, or `undefined` when it holds. */
  readonly comprobar: (sujeto: T) => string | readonly string[] | undefined;
}

/** Builds a rule, defaulting the severity to rejection — which is what F3 §3 sets by default. */
export function regla<T>(definicion: {
  seccion: string;
  campo: string;
  cita: string;
  severidad?: Severidad;
  comprobar: (sujeto: T) => string | readonly string[] | undefined;
}): Regla<T> {
  return {
    id: `F3-${definicion.seccion}`,
    campo: definicion.campo,
    fuente: { documento: 'F3', version: DOCUMENTOS.F3.version, seccion: definicion.seccion },
    cita: definicion.cita,
    severidad: definicion.severidad ?? 'rechazo',
    comprobar: definicion.comprobar,
  };
}

/** Runs a set of rules over a subject and collects the findings. */
export function aplicar<T>(reglas: readonly Regla<T>[], sujeto: T, linea?: number): Problema[] {
  const problemas: Problema[] = [];

  for (const r of reglas) {
    const resultado = r.comprobar(sujeto);
    if (resultado === undefined) continue;

    for (const mensaje of typeof resultado === 'string' ? [resultado] : resultado) {
      problemas.push({
        regla: r.id,
        campo: r.campo,
        mensaje,
        cita: r.cita,
        fuente: r.fuente,
        severidad: r.severidad,
        ...(linea === undefined ? {} : { linea }),
      });
    }
  }

  return problemas;
}
