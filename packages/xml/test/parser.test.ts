/**
 * The XML reader.
 *
 * Its whole reason to exist is *not* normalising values. Everything else it does is in service of
 * that: resolve namespaces so matching does not depend on the prefixes the AEAT happens to use,
 * resolve entity references so a value comes back as it was written, and refuse anything it
 * cannot handle rather than guessing.
 */
import { describe, expect, it } from 'vitest';

import {
  hijo,
  hijos,
  parsearXml,
  textoDeHijo,
  VerifactuXmlError,
  XmlWriter,
} from '../src/index.js';

const NS_A = 'urn:ejemplo:a';
const NS_B = 'urn:ejemplo:b';

function codigoDe(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(VerifactuXmlError);
    return (error as VerifactuXmlError).code;
  }
  return 'NO_LANZO';
}

describe('values come back exactly as written', () => {
  it('does not trim, pad or collapse anything', () => {
    const raiz = parsearXml('<r>  dos  espacios  dentro  </r>');
    expect(raiz.texto).toBe('  dos  espacios  dentro  ');
  });

  it('leaves a dateTime alone instead of canonicalising it', () => {
    // The literal is what was hashed. `2024-01-01T19:20:30+01:00` and `2024-01-01T18:20:30Z` are
    // the same instant and the same xs:dateTime, and only one of them reproduces the digest.
    for (const literal of [
      '2024-01-01T19:20:30+01:00',
      '2024-01-01T18:20:30Z',
      '2024-06-01T00:00:00-00:00',
      '2024-06-01T12:00:00+14:00',
      '2024-01-01T19:20:30.000+01:00',
    ]) {
      expect(parsearXml(`<r>${literal}</r>`).texto).toBe(literal);
    }
  });

  it('resolves the five predefined entities', () => {
    expect(parsearXml('<r>&amp;&lt;&gt;&quot;&apos;</r>').texto).toBe('&<>"\'');
  });

  it('resolves numeric character references, decimal and hex', () => {
    expect(parsearXml('<r>&#65;&#x42;&#x1F600;</r>').texto).toBe('AB\u{1F600}');
  });

  it('rejects an entity it does not know instead of passing it through', () => {
    // Passing `&nbsp;` through unchanged would silently corrupt a value that has to hash.
    expect(codigoDe(() => parsearXml('<r>&nbsp;</r>'))).toBe('XML_MAL_FORMADO');
  });

  it('reads CDATA as plain text', () => {
    expect(parsearXml('<r><![CDATA[a & b < c]]></r>').texto).toBe('a & b < c');
  });

  it('joins text split by a child element', () => {
    expect(parsearXml('<r>a<x/>b</r>').texto).toBe('ab');
  });
});

describe('the normalisation XML 1.0 does require', () => {
  it('turns a literal CR into LF, which is why the writer escapes it', () => {
    // §2.11. An escaped `&#13;` survives; a literal one would come back as `\n`.
    expect(parsearXml('<r>a\rb</r>').texto).toBe('a\nb');
    expect(parsearXml('<r>a\r\nb</r>').texto).toBe('a\nb');
    expect(parsearXml('<r>a&#13;b</r>').texto).toBe('a\rb');
  });

  it('turns tab and newline in an attribute into spaces, likewise', () => {
    // §3.3.3.
    expect(parsearXml('<r a="x\ty"/>').atributos.get('a')).toBe('x y');
    expect(parsearXml('<r a="x&#9;y"/>').atributos.get('a')).toBe('x\ty');
  });

  it('round-trips a carriage return through writer and reader', () => {
    const w = new XmlWriter();
    w.element('r', 'antes\rdespues');
    expect(parsearXml(w.toString()).texto).toBe('antes\rdespues');
  });
});

describe('namespaces, not prefixes', () => {
  it('matches on the namespace URI whatever prefix was used', () => {
    const conA = parsearXml(`<a:r xmlns:a="${NS_A}"><a:x>1</a:x></a:r>`);
    const conZ = parsearXml(`<z:r xmlns:z="${NS_A}"><z:x>1</z:x></z:r>`);

    expect(textoDeHijo(conA, NS_A, 'x')).toBe('1');
    expect(textoDeHijo(conZ, NS_A, 'x')).toBe('1');
    expect(conA.ns).toBe(conZ.ns);
  });

  it('honours the default namespace for elements', () => {
    const raiz = parsearXml(`<r xmlns="${NS_A}"><x>1</x></r>`);
    expect(raiz.ns).toBe(NS_A);
    expect(textoDeHijo(raiz, NS_A, 'x')).toBe('1');
  });

  it('puts an unprefixed attribute in no namespace, as the spec says', () => {
    const raiz = parsearXml(`<r xmlns="${NS_A}" a="1"/>`);
    expect(raiz.ns).toBe(NS_A);
    expect(raiz.atributos.get('a')).toBe('1');
  });

  it('scopes a declaration to its subtree', () => {
    const raiz = parsearXml(`<r xmlns:p="${NS_A}"><c xmlns:p="${NS_B}"><p:x/></c><p:y/></r>`);
    const c = hijo(raiz, '', 'c');

    expect(c && hijo(c, NS_B, 'x')).toBeDefined();
    expect(hijo(raiz, NS_A, 'y')).toBeDefined();
  });

  it('rejects an undeclared prefix', () => {
    expect(codigoDe(() => parsearXml('<p:r/>'))).toBe('XML_MAL_FORMADO');
  });

  it('knows the built-in xml prefix', () => {
    const raiz = parsearXml('<r xml:lang="es"/>');
    expect(raiz.atributos.get('lang')).toBe('es');
  });

  it('finds repeated children in document order', () => {
    const raiz = parsearXml(`<r xmlns="${NS_A}"><x>1</x><y/><x>2</x></r>`);
    expect(hijos(raiz, NS_A, 'x').map((e) => e.texto)).toEqual(['1', '2']);
  });
});

describe('shapes it accepts', () => {
  it('skips the declaration, comments and processing instructions', () => {
    const raiz = parsearXml('<?xml version="1.0"?><!-- hola --><?pi algo?><r>x</r><!-- adios -->');
    expect(raiz.texto).toBe('x');
  });

  it('accepts self-closing elements and single-quoted attributes', () => {
    const raiz = parsearXml("<r><x a='1'/></r>");
    expect(hijo(raiz, '', 'x')?.atributos.get('a')).toBe('1');
  });

  it('accepts whitespace inside a tag', () => {
    expect(parsearXml('<r   a = "1"   />').atributos.get('a')).toBe('1');
  });

  it('accepts an empty element', () => {
    expect(parsearXml('<r></r>').texto).toBe('');
  });

  it('accepts a comment inside an element without swallowing the text around it', () => {
    expect(parsearXml('<r>antes<!-- nota -->despues</r>').texto).toBe('antesdespues');
  });

  it('accepts a processing instruction inside an element', () => {
    expect(parsearXml('<r>a<?pi algo?>b</r>').texto).toBe('ab');
  });
});

describe('what it refuses', () => {
  it.each([
    ['sin elemento', '   '],
    ['etiqueta sin cerrar', '<r>'],
    ['cierre que no corresponde', '<r><a></b></r>'],
    ['atributo sin valor', '<r a/>'],
    ['atributo sin comillas', '<r a=1/>'],
    ['comentario sin cerrar', '<!-- hola'],
    ['CDATA sin cerrar', '<r><![CDATA[x</r>'],
    ['dos raíces', '<a/><b/>'],
    ['una página HTML', '<html><body>Error 500</body></html><trailing/>'],
    ['instrucción de procesamiento sin cerrar', '<?pi algo'],
    ['etiqueta sin nombre', '< >'],
    ['valor de atributo sin cerrar', '<r a="x/>'],
    ['apertura truncada', '<r'],
    ['barra que no cierra', '<r/x>'],
    ['cierre mal formado', '<r></r x>'],
    ['texto que llega al final sin cierre', '<r>abc'],
  ])('rejects %s', (_etiqueta, entrada) => {
    expect(codigoDe(() => parsearXml(entrada))).toBe('XML_MAL_FORMADO');
  });

  it('refuses a DOCTYPE rather than risk an external entity', () => {
    const xxe = '<!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><r>&x;</r>';
    expect(codigoDe(() => parsearXml(xxe))).toBe('XML_MAL_FORMADO');
  });

  it('explains where it broke and shows the surrounding text', () => {
    try {
      parsearXml('<r><a>1</b></r>');
      expect.unreachable('should have thrown');
    } catch (error) {
      const e = error as VerifactuXmlError;
      expect(e.message).toContain('posición');
      expect(e.causaProbable).toContain('<a>1</b>');
    }
  });

  it('suggests the most likely cause when the body is not XML at all', () => {
    try {
      parsearXml('<html>Service Unavailable</html>x');
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as VerifactuXmlError).accionSugerida).toContain('certificado');
    }
  });
});
