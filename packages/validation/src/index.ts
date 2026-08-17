/**
 * `@verifactu-js/validation` — the AEAT's business rules for VERI*FACTU records, each one quoted
 * and versioned.
 *
 * It owns the record model too (`DatosAlta`, `DetalleDesglose`, `SistemaInformatico`…), because
 * those rules *are* the semantics of that model: which combinations of its fields are legal.
 * `@verifactu-js/xml` imports the types from here with `import type`, so it pays nothing at
 * runtime for the dependency.
 *
 * The specification, with a citation per claim, is in `docs/spec-notes.md` §20.
 */

export {
  aCentesimas,
  aCentimos,
  aFecha,
  deCentimos,
  dentroDelMargen,
  MARGEN,
} from './importes.js';
export type {
  Cabecera,
  DatosAlta,
  DatosAnulacion,
  DetalleDesglose,
  IDFacturaAR,
  IDOtro,
  ImporteRectificacion,
  PersonaES,
  PersonaFisicaJuridica,
  RemisionRequerimiento,
  RemisionVoluntaria,
  SiNo,
  SistemaInformatico,
  TipoFactura,
  TipoRectificativa,
} from './modelo.js';
export type { Fuente, Problema, Regla, Severidad } from './problemas.js';
export { DOCUMENTOS } from './problemas.js';
export type { Linea } from './reglas-desglose.js';
export { REGLAS_LINEA, REGLAS_TOTALES } from './reglas-desglose.js';
export type { Contexto, RegistroAltaValidable } from './reglas-registro.js';
export { REGLAS_REGISTRO } from './reglas-registro.js';
export { esAceptable, reglas, validarRegistroAlta } from './validar.js';
