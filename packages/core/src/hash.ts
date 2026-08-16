/**
 * SHA-256 over the canonical string, via Web Crypto.
 *
 * Uses `globalThis.crypto.subtle` rather than `node:crypto` so the package runs unchanged on
 * Node, Bun, Deno, Cloudflare Workers and the browser (VERIFACTU-BRIEF.md §2, principle 3).
 *
 * Specification: AEAT hash spec v0.1.2 (2024-08-27) §2 (algorithm) and §5 (output format).
 * Analysis and citations: docs/spec-notes.md §1.4, §1.5, §1.6.
 */

import { assertHuellaFormat, VerifactuError } from './errors.js';
import {
  buildRegistroAltaHashInput,
  buildRegistroAnulacionHashInput,
  type RegistroAltaHashInput,
  type RegistroAnulacionHashInput,
} from './hash-input.js';

/** Value of `TipoHuella` for SHA-256. List L12; currently the only permitted algorithm. */
export const TIPO_HUELLA_SHA256 = '01';

/** Byte-to-uppercase-hex lookup table. */
const HEX_UPPER: readonly string[] = Array.from({ length: 256 }, (_unused, byte) =>
  byte.toString(16).padStart(2, '0').toUpperCase(),
);

/**
 * A SHA-256 implementation returning lowercase or uppercase hex.
 *
 * Injectable so callers on runtimes without Web Crypto, or who need a synchronous digest, can
 * supply their own. The result is upper-cased by this package regardless.
 */
export type Sha256HexFunction = (input: string) => string | Promise<string>;

/** Options accepted by every hashing entry point. */
export interface HashOptions {
  /** Overrides the built-in Web Crypto digest. */
  readonly sha256?: Sha256HexFunction;
}

function requireSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new VerifactuError({
      code: 'WEBCRYPTO_NO_DISPONIBLE',
      message: 'No hay una implementación de Web Crypto disponible en este entorno.',
      causaProbable:
        'globalThis.crypto.subtle no existe. Ocurre en Node anterior a la v19 sin polyfill, ' +
        'o en un contexto de navegador no seguro (http:// en un host distinto de localhost), ' +
        'donde crypto.subtle no se expone.',
      accionSugerida:
        'Usa Node 20 o superior, sirve la página por HTTPS, o inyecta tu propia función de ' +
        'hash mediante la opción { sha256 }.',
    });
  }
  return subtle;
}

/**
 * Computes SHA-256 over the UTF-8 bytes of `input` and returns 64 uppercase hex characters.
 *
 * The input string is encoded as-is: no BOM, no trailing newline, no padding. Appending so
 * much as a `"\n"` changes the digest.
 *
 * The result is validated against `/^[0-9A-F]{64}$/` before being returned. An injected
 * {@link HashOptions.sha256} is the only way a malformed digest could enter the package, and
 * the AEAT would not reject the resulting record — it would store it flagged as "Aceptado con
 * errores" (docs/spec-notes.md §8.7) — so the check happens here rather than downstream.
 *
 * @throws {VerifactuError} `HUELLA_FORMATO_INVALIDO` if the digest is not well formed.
 * @throws {VerifactuError} `WEBCRYPTO_NO_DISPONIBLE` if no digest is available.
 */
export async function sha256HexUpper(input: string, options: HashOptions = {}): Promise<string> {
  if (options.sha256) {
    const injected = (await options.sha256(input)).toUpperCase();
    assertHuellaFormat(injected, 'inyectada');
    return injected;
  }

  const bytes = new TextEncoder().encode(input);
  const digest = await requireSubtleCrypto().digest('SHA-256', bytes);

  const view = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < view.length; i += 1) {
    hex += HEX_UPPER[view[i] as number];
  }

  assertHuellaFormat(hex, 'webcrypto');
  return hex;
}

/**
 * Computes the `Huella` of a `RegistroAlta`.
 *
 * The value goes into `RegistroAlta/Huella`, and must be present even when the record is the
 * first of the chain (docs/spec-notes.md §4.2).
 */
export async function hashRegistroAlta(
  input: RegistroAltaHashInput,
  options: HashOptions = {},
): Promise<string> {
  return sha256HexUpper(buildRegistroAltaHashInput(input), options);
}

/** Computes the `Huella` of a `RegistroAnulacion`. Goes into `RegistroAnulacion/Huella`. */
export async function hashRegistroAnulacion(
  input: RegistroAnulacionHashInput,
  options: HashOptions = {},
): Promise<string> {
  return sha256HexUpper(buildRegistroAnulacionHashInput(input), options);
}
