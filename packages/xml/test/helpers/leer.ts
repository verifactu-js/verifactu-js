/**
 * A deliberately tiny reader, for tests only.
 *
 * The real parser is a later step of the work order. This is just enough to pull an element's
 * text back out of a document and undo the escaping, so a test can check that what ended up in
 * the XML is what was hashed. Production code must never parse XML with a regular expression;
 * a test that only needs one element out of a document it built itself may.
 */

const ENTIDADES: ReadonlyArray<readonly [RegExp, string]> = [
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&apos;/g, "'"],
  [/&#13;/g, '\r'],
  [/&#10;/g, '\n'],
  [/&#9;/g, '\t'],
  // `&amp;` last: undoing it first would let `&amp;lt;` decode to `<`.
  [/&amp;/g, '&'],
];

/** Undoes the escaping `escapeText` / `escapeAttribute` applied. */
export function desescapar(texto: string): string {
  let out = texto;
  for (const [patron, caracter] of ENTIDADES) out = out.replace(patron, caracter);
  return out;
}

/**
 * Returns the text of the first `<prefijo:nombre>` element, unescaped.
 *
 * @throws if the element is not present, so a typo in a test fails loudly instead of silently
 *   comparing `undefined` against `undefined`.
 */
export function textoDe(xml: string, nombreCualificado: string): string {
  const patron = new RegExp(`<${nombreCualificado}>([^<]*)</${nombreCualificado}>`);
  const encontrado = patron.exec(xml);
  if (encontrado?.[1] === undefined) {
    throw new Error(`No se ha encontrado el elemento «${nombreCualificado}» en el documento.`);
  }
  return desescapar(encontrado[1]);
}

/** Returns the text of every occurrence of an element, unescaped and in document order. */
export function todosLosTextosDe(xml: string, nombreCualificado: string): string[] {
  const patron = new RegExp(`<${nombreCualificado}>([^<]*)</${nombreCualificado}>`, 'g');
  return [...xml.matchAll(patron)].map((m) => desescapar(m[1] ?? ''));
}

/** Returns the qualified names of every start tag, in document order. */
export function ordenDeElementos(xml: string): string[] {
  return [...xml.matchAll(/<([A-Za-z][\w.:-]*)[\s>]/g)].map((m) => m[1] ?? '');
}
