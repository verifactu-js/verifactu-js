/**
 * `@verifactu/core` — domain types, canonicalisation, hash and chaining for Spanish
 * VERI*FACTU billing records.
 *
 * Zero runtime dependencies. Isomorphic: Node, Bun, Deno, Cloudflare Workers, browser.
 *
 * The specification this implements, with a citation per claim, lives in `docs/spec-notes.md`.
 */

export {
  canonicalizeValue,
  hasAmbiguousEdgeWhitespace,
  joinFields,
  renderField,
  trimJava,
} from './canonicalize.js';
export type {
  AltaRequest,
  AnulacionRequest,
  ChainIssue,
  ChainIssueCode,
  ChainVerification,
  EncadenamientoPrevioOptions,
  Eslabon,
  EslabonAlta,
  EslabonAnulacion,
  RegistroAnteriorRef,
  SifChain,
  SifChainConfig,
} from './chain.js';
export {
  createSifChain,
  verificarEncadenamientoPrevio,
  verifyChain,
} from './chain.js';
export type {
  FechaHoraHuso,
  FechaHoraHusoInspection,
  FechaHoraHusoWarning,
  FormatFechaHoraHusoOptions,
} from './datetime.js';
export {
  formatFechaHoraHusoGenRegistro,
  inspectFechaHoraHuso,
  offsetForInstant,
} from './datetime.js';
export type { VerifactuErrorCode } from './errors.js';
export {
  assertHuellaFormat,
  assertNoAmbiguousEdgeWhitespace,
  assertSerialisedString,
  VerifactuError,
} from './errors.js';
export type { HashOptions, Sha256HexFunction } from './hash.js';
export {
  hashRegistroAlta,
  hashRegistroAnulacion,
  sha256HexUpper,
  TIPO_HUELLA_SHA256,
} from './hash.js';
export type {
  CanonicalRegistroAlta,
  CanonicalRegistroAnulacion,
  RegistroAltaHashInput,
  RegistroAnulacionHashInput,
} from './hash-input.js';
export {
  buildRegistroAltaHashInput,
  buildRegistroAnulacionHashInput,
  canonicalizeRegistroAlta,
  canonicalizeRegistroAnulacion,
} from './hash-input.js';
export type { NifSeveridad, NifValidacion, TipoIdentificacion } from './nif.js';
export { validateNif } from './nif.js';
