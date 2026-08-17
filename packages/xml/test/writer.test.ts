/**
 * The XML writer.
 *
 * Escaping is not cosmetic here: a value that does not survive a parse/serialise round trip
 * cannot reproduce its hash, because the hash was computed over the literal.
 */
import { describe, expect, it } from 'vitest';

import { escapeAttribute, escapeText, VerifactuXmlError, XmlWriter } from '../src/index.js';

describe('escapeText', () => {
  it.each([
    ['ampersand', 'A&B', 'A&amp;B'],
    ['less than', 'A<B', 'A&lt;B'],
    ['greater than', 'A>B', 'A&gt;B'],
    ['all three', '<&>', '&lt;&amp;&gt;'],
  ])('escapes %s', (_label, input, expected) => {
    expect(escapeText(input)).toBe(expected);
  });

  it('escapes the ampersand first, so it does not double-escape', () => {
    expect(escapeText('&lt;')).toBe('&amp;lt;');
  });

  it('escapes CR as a character reference, because a parser would turn it into LF', () => {
    // XML 1.0 §2.11: a literal CR is normalised to LF on parse. Without the reference the
    // value would come back different and stop reproducing its hash.
    expect(escapeText('A\rB')).toBe('A&#13;B');
  });

  it('leaves quotes alone in text: they are only special inside attributes', () => {
    expect(escapeText(`he said "hi" and 'bye'`)).toBe(`he said "hi" and 'bye'`);
  });

  it('leaves everything else untouched, including non-ASCII', () => {
    expect(escapeText('Añó — 21% · 1/2')).toBe('Añó — 21% · 1/2');
  });

  it('handles the empty string', () => {
    expect(escapeText('')).toBe('');
  });
});

describe('escapeAttribute', () => {
  it('escapes the double quote', () => {
    expect(escapeAttribute('say "hi"')).toBe('say &quot;hi&quot;');
  });

  it.each([
    ['tab', '\t', '&#9;'],
    ['line feed', '\n', '&#10;'],
    ['carriage return', '\r', '&#13;'],
  ])('escapes %s, which a parser would collapse to a space', (_label, input, expected) => {
    // XML 1.0 §3.3.3: attribute-value normalisation replaces these with spaces.
    expect(escapeAttribute(`A${input}B`)).toBe(`A${expected}B`);
  });

  it('escapes the same markup characters as text', () => {
    expect(escapeAttribute('<&>')).toBe('&lt;&amp;&gt;');
  });
});

describe('XmlWriter', () => {
  it('writes a declaration and a single element', () => {
    const w = new XmlWriter();
    w.declaration().element('a:root', 'value');
    expect(w.toString()).toBe('<?xml version="1.0" encoding="UTF-8"?><a:root>value</a:root>');
  });

  it('emits no whitespace between elements', () => {
    const w = new XmlWriter();
    w.open('r').element('a', '1').element('b', '2').close();
    expect(w.toString()).toBe('<r><a>1</a><b>2</b></r>');
  });

  it('emits attributes verbatim and in order', () => {
    const w = new XmlWriter();
    w.element('r', 'x', [
      { name: 'z', value: '1' },
      { name: 'a', value: '2' },
    ]);
    expect(w.toString()).toBe('<r z="1" a="2">x</r>');
  });

  it('escapes text and attribute values', () => {
    const w = new XmlWriter();
    w.element('r', 'A&B', [{ name: 'q', value: 'say "hi"' }]);
    expect(w.toString()).toBe('<r q="say &quot;hi&quot;">A&amp;B</r>');
  });

  it('nests', () => {
    const w = new XmlWriter();
    w.open('a').open('b').element('c', '1').close().close();
    expect(w.toString()).toBe('<a><b><c>1</c></b></a>');
  });

  it('tracks depth', () => {
    const w = new XmlWriter();
    expect(w.depth).toBe(0);
    w.open('a');
    expect(w.depth).toBe(1);
    w.open('b');
    expect(w.depth).toBe(2);
    w.close().close();
    expect(w.depth).toBe(0);
  });

  it('omits an optional element when the value is absent', () => {
    const w = new XmlWriter();
    w.open('r').optional('a', null).optional('b', undefined).optional('c', 'x').close();
    expect(w.toString()).toBe('<r><c>x</c></r>');
  });

  it('writes an optional element when the value is an empty string', () => {
    // Empty is a value, not an absence: the schema distinguishes them.
    const w = new XmlWriter();
    w.open('r').optional('a', '').close();
    expect(w.toString()).toBe('<r><a></a></r>');
  });

  it('refuses to return an unbalanced document', () => {
    const w = new XmlWriter();
    w.open('a').open('b');
    expect(() => w.toString()).toThrow(/sin cerrar.*a > b/s);
  });

  it('refuses to close more elements than are open', () => {
    const w = new XmlWriter();
    expect(() => w.close()).toThrow(/No hay ningún elemento abierto/);
  });

  it('refuses to write text outside an element', () => {
    const w = new XmlWriter();
    expect(() => w.text('x')).toThrow(/fuera de un elemento/);
  });

  it('refuses a declaration that is not the first thing emitted', () => {
    const w = new XmlWriter();
    w.element('a', '1');
    expect(() => w.declaration()).toThrow(/lo primero/);
  });

  it('refuses to keep writing after toString()', () => {
    const w = new XmlWriter();
    w.element('a', '1');
    w.toString();
    expect(() => w.element('b', '2')).toThrow(/ya se ha cerrado/);
  });

  it('refuses anything that is not already a string', () => {
    // A template literal would have coerced these silently, and the coerced form would then be
    // the literal in the document. `String(131.40)` is `"131.4"`.
    const casos: ReadonlyArray<readonly [string, unknown, string]> = [
      ['number', 131.4, 'number (131.4)'],
      ['bigint', 10n, 'bigint (10)'],
      ['null', null, 'null'],
      ['undefined', undefined, 'undefined'],
      ['object', { toString: () => '1' }, 'object'],
    ];

    for (const [etiqueta, valor, esperado] of casos) {
      const w = new XmlWriter();
      try {
        w.element('sf:CuotaTotal', valor as string);
        expect.unreachable(`should have rejected a ${etiqueta}`);
      } catch (error) {
        const e = error as VerifactuXmlError;
        expect(e).toBeInstanceOf(VerifactuXmlError);
        expect(e.code).toBe('VALOR_NO_SERIALIZADO');
        expect(e.message).toContain(esperado);
        expect(e.message).toContain('sf:CuotaTotal');
      }
    }
  });

  it('reports structural misuse with a code, not just a message', () => {
    const w = new XmlWriter();
    try {
      w.close();
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as VerifactuXmlError).code).toBe('DOCUMENTO_MAL_FORMADO');
    }
  });

  it('has no raw-append escape hatch', () => {
    // Splicing pre-serialised text in would bypass escaping, which is exactly the bug this
    // package exists to avoid. Fragments compose by writing into the same writer.
    expect('raw' in new XmlWriter()).toBe(false);
  });
});
