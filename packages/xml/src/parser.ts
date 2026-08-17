/**
 * A small, namespace-aware, **non-normalising** XML reader.
 *
 * ## Why not a library
 *
 * The same reason the writer is hand-made, only sharper. Most parsers hand back values that have
 * been through some form of normalisation — collapsed whitespace, a `dateTime` re-rendered in its
 * canonical form, a trimmed string. Any of those breaks this package's only real promise: that
 * `FechaHoraHusoGenRegistro` read out of a document is **byte for byte** the literal that was
 * hashed. `2024-01-01T19:20:30+01:00` and `2024-01-01T18:20:30Z` are the same instant and the
 * same `xs:dateTime`; they are not the same string, and only one of them reproduces the digest.
 *
 * So: this reader resolves entity references and nothing else. There is a test that feeds it
 * every offset shape and checks the literal comes back unchanged.
 *
 * ## What it does normalise, because XML 1.0 requires it
 *
 * - **Line endings** (§2.11): a literal CRLF or CR in the source becomes LF. This is not
 *   optional — every conforming parser does it, which is exactly why {@link escapeText} writes a
 *   carriage return as `&#13;`. An escaped CR survives; a literal one would not.
 * - **Attribute values** (§3.3.3): tab, LF and CR become spaces. Same defence, same reason
 *   {@link escapeAttribute} escapes them.
 *
 * ## What it does not support
 *
 * Internal DTD subsets, external entities and entity declarations. The AEAT's responses use none
 * of them, and supporting external entities in a library that parses network responses would be
 * an XXE vulnerability delivered as a feature. A `<!DOCTYPE` is rejected outright.
 */

import { VerifactuXmlError } from './errors.js';

/** A parsed element. */
export interface XmlElement {
  /** Namespace URI, or the empty string when the element is not in a namespace. */
  readonly ns: string;
  /** Local name, without prefix. */
  readonly nombre: string;
  /** Attributes, keyed by local name. Namespace declarations are not included. */
  readonly atributos: ReadonlyMap<string, string>;
  /** Child elements, in document order. */
  readonly hijos: readonly XmlElement[];
  /** Character data, with entity references resolved and nothing else done to it. */
  readonly texto: string;
}

const NS_XML = 'http://www.w3.org/XML/1998/namespace';

function malFormado(mensaje: string, posicion: number, fuente: string): VerifactuXmlError {
  const desde = Math.max(0, posicion - 40);
  return new VerifactuXmlError({
    code: 'XML_MAL_FORMADO',
    message: `${mensaje} (posición ${posicion})`,
    causaProbable:
      'El documento no es XML bien formado. Contexto:\n  …' +
      fuente.slice(desde, posicion + 40).replace(/\n/g, ' ') +
      '…',
    accionSugerida:
      'Si viene de la AEAT, guarda el cuerpo de la respuesta tal cual y revísalo: puede ser una ' +
      'página de error HTML devuelta con código 200, que es lo más frecuente cuando el ' +
      'certificado no es válido para el endpoint.',
  });
}

/** Resolves the five predefined entities plus numeric character references. */
function decodificar(texto: string, posicion: number, fuente: string): string {
  if (!texto.includes('&')) return texto;

  return texto.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (coincidencia, cuerpo: string) => {
    switch (cuerpo) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
      default:
        break;
    }

    if (cuerpo.startsWith('#x')) return String.fromCodePoint(Number.parseInt(cuerpo.slice(2), 16));
    if (cuerpo.startsWith('#')) return String.fromCodePoint(Number.parseInt(cuerpo.slice(1), 10));

    throw malFormado(`Entidad desconocida «${coincidencia}»`, posicion, fuente);
  });
}

interface Marco {
  readonly prefijos: Map<string, string>;
  readonly predeterminado: string;
}

/** Reads one XML document and returns its root element. */
export function parsearXml(fuente: string): XmlElement {
  // XML 1.0 §2.11: line endings are normalised before anything else looks at the text.
  const texto = fuente.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  let i = 0;

  const error = (mensaje: string): VerifactuXmlError => malFormado(mensaje, i, texto);

  function saltarEspacios(): void {
    while (i < texto.length && /\s/.test(texto.charAt(i))) i += 1;
  }

  /** Skips comments, processing instructions and the declaration. Rejects DOCTYPE. */
  function saltarMisc(): boolean {
    if (texto.startsWith('<!--', i)) {
      const fin = texto.indexOf('-->', i);
      if (fin === -1) throw error('Comentario sin cerrar');
      i = fin + 3;
      return true;
    }
    if (texto.startsWith('<?', i)) {
      const fin = texto.indexOf('?>', i);
      if (fin === -1) throw error('Instrucción de procesamiento sin cerrar');
      i = fin + 2;
      return true;
    }
    if (texto.startsWith('<!DOCTYPE', i)) {
      throw error(
        'El documento declara un DOCTYPE. No se procesa: una DTD puede declarar entidades ' +
          'externas y este parser nunca las resolverá',
      );
    }
    return false;
  }

  function leerNombre(): string {
    const inicio = i;
    while (i < texto.length && !/[\s/>=]/.test(texto.charAt(i))) i += 1;
    if (i === inicio) throw error('Se esperaba un nombre');
    return texto.slice(inicio, i);
  }

  function resolver(
    marco: Marco,
    nombreCualificado: string,
    esAtributo: boolean,
  ): [string, string] {
    const dosPuntos = nombreCualificado.indexOf(':');
    if (dosPuntos === -1) {
      // An unprefixed attribute is in no namespace at all; an unprefixed element takes the default.
      return [esAtributo ? '' : marco.predeterminado, nombreCualificado];
    }

    const prefijo = nombreCualificado.slice(0, dosPuntos);
    const local = nombreCualificado.slice(dosPuntos + 1);
    if (prefijo === 'xml') return [NS_XML, local];

    const uri = marco.prefijos.get(prefijo);
    if (uri === undefined) throw error(`Prefijo «${prefijo}» sin declarar`);
    return [uri, local];
  }

  function leerElemento(padre: Marco): XmlElement {
    i += 1; // '<'
    const nombreCualificado = leerNombre();

    const prefijos = new Map(padre.prefijos);
    let predeterminado = padre.predeterminado;
    const atributosCrudos: Array<readonly [string, string]> = [];

    for (;;) {
      saltarEspacios();
      const caracter = texto.charAt(i);
      if (caracter === '>' || caracter === '/' || caracter === '') break;

      const nombreAtributo = leerNombre();
      saltarEspacios();
      if (texto.charAt(i) !== '=') throw error(`Atributo «${nombreAtributo}» sin valor`);
      i += 1;
      saltarEspacios();

      const comilla = texto.charAt(i);
      if (comilla !== '"' && comilla !== "'") throw error('Valor de atributo sin comillas');
      i += 1;
      const finValor = texto.indexOf(comilla, i);
      if (finValor === -1) throw error('Valor de atributo sin cerrar');
      // XML 1.0 §3.3.3: a *literal* tab or newline in an attribute value becomes a space, but a
      // character reference does not — `&#9;` stays a tab. Hence the order: normalise the literal
      // characters first, resolve references afterwards.
      const valor = decodificar(texto.slice(i, finValor).replace(/[\t\n]/g, ' '), i, texto);
      i = finValor + 1;

      if (nombreAtributo === 'xmlns') predeterminado = valor;
      else if (nombreAtributo.startsWith('xmlns:')) prefijos.set(nombreAtributo.slice(6), valor);
      else atributosCrudos.push([nombreAtributo, valor]);
    }

    const marco: Marco = { prefijos, predeterminado };
    const [ns, nombre] = resolver(marco, nombreCualificado, false);

    const atributos = new Map<string, string>();
    for (const [nombreAtributo, valor] of atributosCrudos) {
      atributos.set(resolver(marco, nombreAtributo, true)[1], valor);
    }

    if (texto.startsWith('/>', i)) {
      i += 2;
      return { ns, nombre, atributos, hijos: [], texto: '' };
    }
    if (texto.charAt(i) !== '>') throw error(`Elemento «${nombreCualificado}» sin cerrar`);
    i += 1;

    const hijos: XmlElement[] = [];
    let contenido = '';

    for (;;) {
      if (i >= texto.length) throw error(`Falta la etiqueta de cierre de «${nombreCualificado}»`);

      if (texto.startsWith('</', i)) {
        i += 2;
        const cierre = leerNombre();
        if (cierre !== nombreCualificado) {
          throw error(`Se cierra «${cierre}» y estaba abierto «${nombreCualificado}»`);
        }
        saltarEspacios();
        if (texto.charAt(i) !== '>') throw error('Etiqueta de cierre mal formada');
        i += 1;
        break;
      }

      if (texto.startsWith('<![CDATA[', i)) {
        const fin = texto.indexOf(']]>', i);
        if (fin === -1) throw error('Sección CDATA sin cerrar');
        contenido += texto.slice(i + 9, fin);
        i = fin + 3;
        continue;
      }

      if (texto.startsWith('<', i)) {
        if (saltarMisc()) continue;
        hijos.push(leerElemento(marco));
        continue;
      }

      const siguiente = texto.indexOf('<', i);
      const hasta = siguiente === -1 ? texto.length : siguiente;
      contenido += decodificar(texto.slice(i, hasta), i, texto);
      i = hasta;
    }

    return { ns, nombre, atributos, hijos, texto: contenido };
  }

  const raiz: Marco = { prefijos: new Map(), predeterminado: '' };

  for (;;) {
    saltarEspacios();
    if (i >= texto.length) throw error('El documento no contiene ningún elemento');
    if (!saltarMisc()) break;
  }

  const elemento = leerElemento(raiz);

  for (;;) {
    saltarEspacios();
    if (i >= texto.length) break;
    if (!saltarMisc()) throw error('Hay contenido después del elemento raíz');
  }

  return elemento;
}

/** First child with the given namespace and local name, or `undefined`. */
export function hijo(elemento: XmlElement, ns: string, nombre: string): XmlElement | undefined {
  return elemento.hijos.find((h) => h.ns === ns && h.nombre === nombre);
}

/** Every child with the given namespace and local name, in document order. */
export function hijos(elemento: XmlElement, ns: string, nombre: string): XmlElement[] {
  return elemento.hijos.filter((h) => h.ns === ns && h.nombre === nombre);
}

/** Text of the first matching child, or `undefined` when the child is absent. */
export function textoDeHijo(elemento: XmlElement, ns: string, nombre: string): string | undefined {
  return hijo(elemento, ns, nombre)?.texto;
}
