/**
 * Reads a Java `.properties` file the way the specification says it must be read.
 *
 * ## Por qué existe este fichero
 *
 * `errores.properties` de la AEAT es un `.properties` de Java, y esos son **ISO-8859-1 por
 * especificación**, no UTF-8: lo fija el javadoc de `java.util.Properties#load(InputStream)`
 * («the input stream is encoded in ISO 8859-1 character encoding»). Leerlo como UTF-8 no da un
 * fichero feo: da un fichero **destruido**. Cada byte acentuado es una secuencia UTF-8 inválida,
 * el decodificador lo sustituye por U+FFFD y de un U+FFFD ya no se recupera si era `ó`, `í` o `á`.
 *
 * Nos pasó: la primera descarga de S-1 usó `body.text()` de undici y guardó 184 U+FFFD sobre 186
 * bytes altos. El fichero de errores es la fuente del mapa de códigos en castellano, así que
 * decodificarlo mal corrompe el diferenciador entero — justo lo que hace legibles las demás sondas.
 *
 * ## Y además el fichero de la AEAT no es latin1 puro
 *
 * El código 1214 («debe ser numérico positivo») trae la `ú` codificada en UTF-8 (bytes `C3 BA`)
 * dentro de un fichero por lo demás ISO-8859-1. Decodificar en latin1 estricto da `nÃºmerico`.
 * Es un defecto del origen, no nuestro, y se repara aquí con una regla deliberadamente estrecha:
 * solo se toca la secuencia `Ã` + continuación que vuelve a ser **una** letra Latin-1. No puede
 * dispararse sobre castellano legítimo, porque ninguna palabra castellana contiene `Ã`.
 */

/**
 * Decodes the bytes of a `.properties` file into a string.
 *
 * Three steps, in this order and no other:
 *
 * 1. **ISO-8859-1**, per the `java.util.Properties` contract.
 * 2. `\\uXXXX` escapes, which the same contract allows for anything outside Latin-1. Today the
 *    AEAT file has none, and the step stays because the next revision may add one and a silently
 *    unresolved `\\u00f3` would read as literal text.
 * 3. The narrow double-encoding repair described above.
 *
 * @param {Buffer | Uint8Array} bytes - The file, exactly as it came off the wire.
 * @returns {{ texto: string, escapes: number, reparadas: number }} Decoded text plus what each
 *   step had to do, so a caller can report it instead of guessing.
 */
export function decodificarProperties(bytes) {
  const crudo = Buffer.from(bytes).toString('latin1');

  let escapes = 0;
  const conEscapes = crudo.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
    escapes += 1;
    return String.fromCharCode(Number.parseInt(hex, 16));
  });

  let reparadas = 0;
  // \u00c3 es la «A con tilde»; \u0080-\u00bf son los bytes de continuación de UTF-8
  // leídos como Latin-1. Van con escapes a propósito: como literales serían invisibles.
  const texto = conEscapes.replace(/\u00c3[\u0080-\u00bf]/g, (par) => {
    const reinterpretado = Buffer.from(par, 'latin1').toString('utf8');
    if (reinterpretado.length === 1 && reinterpretado.charCodeAt(0) < 0x100) {
      reparadas += 1;
      return reinterpretado;
    }
    return par;
  });

  return { texto, escapes, reparadas };
}

/**
 * Splits decoded text into the AEAT's three sections and their code/message pairs.
 *
 * The file separates them with `********* … *********` banner lines whose wording states what the
 * codes in the section do to the submission. That wording is the only thing that says whether a
 * code rejects everything, rejects one record, or lets the record through — so it is parsed, not
 * assumed.
 *
 * @param {string} texto - Output of {@link decodificarProperties}.
 * @returns {{ titulo: string, entradas: Array<{ codigo: string, texto: string }> }[]}
 */
export function parsearProperties(texto) {
  /** @type {{ titulo: string, entradas: Array<{ codigo: string, texto: string }> }[]} */
  const secciones = [];

  for (const linea of texto.split(/\r\n|\n|\r/)) {
    const banner = linea.match(/^\*{3,}\s*(.*?)\s*\*{3,}\s*$/);
    if (banner?.[1] !== undefined) {
      secciones.push({ titulo: banner[1], entradas: [] });
      continue;
    }

    // `%s` aparece en 1287: la AEAT interpola ahí el nombre del campo infractor.
    const par = linea.match(/^\s*(\d{3,4})\s*=\s*(.*?)\s*$/);
    if (par?.[1] === undefined || par[2] === undefined) continue;
    if (secciones.length === 0) secciones.push({ titulo: '(sin sección)', entradas: [] });

    secciones[secciones.length - 1]?.entradas.push({ codigo: par[1], texto: par[2] });
  }

  return secciones;
}
