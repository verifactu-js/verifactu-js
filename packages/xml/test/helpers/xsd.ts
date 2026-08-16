/**
 * XSD validation harness.
 *
 * Lives in the test tree on purpose: `xmllint-wasm` is a devDependency and never ships. The
 * published package keeps zero runtime dependencies; validating against the official schemas is
 * something the suite does, not something a consumer pays for.
 *
 * Why `xmllint-wasm` and not the alternatives:
 *
 * | | why not |
 * |---|---|
 * | `libxmljs2`, `node-libxml` | `node-gyp` + prebuilds. Native compilation in CI, and no chance of running under Bun, Deno or Workers |
 * | `xsd-schema-validator` | needs a JVM on the runner |
 * | `validate-with-xmllint` | needs the system `xmllint` binary; last published 2022 |
 *
 * `xmllint-wasm` is libxml2 compiled to WebAssembly: same validator, zero dependencies, no
 * toolchain.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateXML } from 'xmllint-wasm';

const SCHEMAS = join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), 'schemas');

const read = (name: string): string => readFileSync(join(SCHEMAS, name), 'utf8');

/**
 * Schemas made available to the validator, keyed by the name the importing schema uses.
 *
 * `SuministroInformacion.xsd` imports the W3C XMLDSig schema **by remote URL**:
 *
 * ```xml
 * <import namespace="http://www.w3.org/2000/09/xmldsig#"
 *         schemaLocation="http://www.w3.org/TR/xmldsig-core/xmldsig-core-schema.xsd"/>
 * ```
 *
 * The WASM sandbox has no network, so without this the schema fails to compile and every
 * validation errors out with a misleading message about `ds:Signature` not resolving. Preloading
 * it under that exact URL fixes it without touching the official schema, which must stay
 * byte-identical (see `docs/reference/MANIFEST.md`).
 */
const PRELOAD = [
  {
    fileName: 'http://www.w3.org/TR/xmldsig-core/xmldsig-core-schema.xsd',
    contents: read('xmldsig-core-schema.xsd'),
  },
  { fileName: 'SuministroInformacion.xsd', contents: read('SuministroInformacion.xsd') },
  { fileName: 'SuministroLR.xsd', contents: read('SuministroLR.xsd') },
  { fileName: 'RespuestaSuministro.xsd', contents: read('RespuestaSuministro.xsd') },
];

/** Which official schema to validate against. */
export type Esquema = 'SuministroLR.xsd' | 'RespuestaSuministro.xsd';

/** Outcome of a validation. */
export interface ResultadoXsd {
  readonly valido: boolean;
  /** Human-readable messages from libxml2, one per problem. */
  readonly errores: readonly string[];
}

/** Validates a document against one of the official schemas. Never throws for invalid input. */
export async function validarContraXsd(
  xml: string,
  esquema: Esquema = 'SuministroLR.xsd',
): Promise<ResultadoXsd> {
  const result = await validateXML({
    xml: [{ fileName: 'documento.xml', contents: xml }],
    schema: [read(esquema)],
    preload: PRELOAD,
  });

  return {
    valido: result.valid,
    errores: result.valid
      ? []
      : result.errors.map((e) =>
          String((e as { message?: string })?.message ?? e)
            .replace(/\s+/g, ' ')
            .trim(),
        ),
  };
}

/**
 * Asserts a document validates, and fails with the schema errors rather than a bare `false`.
 *
 * Every helper that builds a document in this suite goes through here, so it is impossible to
 * add a case whose XML is never checked against the schema.
 */
export async function esperarValido(
  xml: string,
  esquema: Esquema = 'SuministroLR.xsd',
): Promise<void> {
  const { valido, errores } = await validarContraXsd(xml, esquema);
  if (valido) return;

  throw new Error(
    `El XML no valida contra ${esquema}:\n  ${errores.join('\n  ')}\n\nDocumento:\n${xml}`,
  );
}

/** Asserts a document does **not** validate, and returns the errors for further assertions. */
export async function esperarInvalido(
  xml: string,
  esquema: Esquema = 'SuministroLR.xsd',
): Promise<readonly string[]> {
  const { valido, errores } = await validarContraXsd(xml, esquema);
  if (!valido) return errores;

  throw new Error(`Se esperaba que el XML NO validara contra ${esquema}, pero validó:\n${xml}`);
}
