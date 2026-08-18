/**
 * Types for `properties.mjs`.
 *
 * El script es `.mjs` porque vive en `scripts/`, que no se compila: se ejecuta con `node` a pelo,
 * antes y fuera del build. Pero `packages/client` lo importa desde sus tests para comprobar que la
 * tabla compilada sigue coincidiendo con el fichero de la AEAT, y ahí sí hay `tsc`. Estas firmas
 * son ese puente, y duplican lo que ya dice el JSDoc del `.mjs`.
 */

/** Decodes the bytes of a `.properties` file: ISO-8859-1, `\uXXXX` escapes, double-encoding fix. */
export function decodificarProperties(bytes: Uint8Array): {
  /** El texto ya legible. */
  texto: string;
  /** Cuántos escapes `\uXXXX` se resolvieron. */
  escapes: number;
  /** Cuántas secuencias doble-codificadas se repararon. */
  reparadas: number;
};

/** Splits decoded text into the AEAT's banner-delimited sections and their code/message pairs. */
export function parsearProperties(texto: string): Array<{
  /** El texto del banner `********* … *********`. */
  titulo: string;
  entradas: Array<{ codigo: string; texto: string }>;
}>;
