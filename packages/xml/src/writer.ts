/**
 * A deliberately small XML writer.
 *
 * No general-purpose XML library. Every one of them makes its own decisions about namespace
 * prefixes, attribute order, self-closing tags and whitespace, and any of those changes the
 * bytes. This package has to control the bytes: the same document is what the AEAT validates
 * against an XSD and what a signature would later cover.
 *
 * The writer knows nothing about VERI*FACTU. It opens elements, closes them, and escapes text.
 */

/** An attribute to emit, in the order given. */
export interface XmlAttribute {
  readonly name: string;
  readonly value: string;
}

/**
 * Escapes text content.
 *
 * `&` and `<` are mandatory. `>` is escaped too: it is only strictly required after `]]`, but
 * escaping it always is what every serialiser does and it keeps the output diffable against
 * other implementations.
 *
 * `\r` becomes `&#13;` because an XML parser normalises a literal CR to LF on the way back in
 * (XML 1.0 §2.11). Without this the value would not survive a round trip, and a value that does
 * not survive a round trip cannot reproduce its hash.
 */
export function escapeText(value: string): string {
  let out = '';
  for (const character of value) {
    switch (character) {
      case '&':
        out += '&amp;';
        break;
      case '<':
        out += '&lt;';
        break;
      case '>':
        out += '&gt;';
        break;
      case '\r':
        out += '&#13;';
        break;
      default:
        out += character;
    }
  }
  return out;
}

/**
 * Escapes an attribute value.
 *
 * Adds `"` on top of the text rules because attributes are emitted with double quotes, and
 * escapes tab and newline, which a parser would otherwise normalise to a space (XML 1.0 §3.3.3).
 */
export function escapeAttribute(value: string): string {
  let out = '';
  for (const character of value) {
    switch (character) {
      case '&':
        out += '&amp;';
        break;
      case '<':
        out += '&lt;';
        break;
      case '>':
        out += '&gt;';
        break;
      case '"':
        out += '&quot;';
        break;
      case '\r':
        out += '&#13;';
        break;
      case '\n':
        out += '&#10;';
        break;
      case '\t':
        out += '&#9;';
        break;
      default:
        out += character;
    }
  }
  return out;
}

/**
 * Builds an XML document as a string.
 *
 * Output has no insignificant whitespace: no indentation, no newlines between elements. That is
 * on purpose. Whitespace inside an element with simple content is part of its value, and this
 * package cannot afford to introduce any that the caller did not ask for.
 */
export class XmlWriter {
  #parts: string[] = [];
  #open: string[] = [];
  #closed = false;

  /** Emits the XML declaration. Call first, or not at all. */
  declaration(): this {
    this.#assertOpen();
    if (this.#parts.length > 0) {
      throw new Error('La declaración XML debe ser lo primero que se emite.');
    }
    this.#parts.push('<?xml version="1.0" encoding="UTF-8"?>');
    return this;
  }

  /** Opens an element. `attributes` are emitted verbatim, in order. */
  open(qualifiedName: string, attributes: readonly XmlAttribute[] = []): this {
    this.#assertOpen();
    this.#parts.push(`<${qualifiedName}`);
    for (const { name, value } of attributes) {
      this.#parts.push(` ${name}="${escapeAttribute(value)}"`);
    }
    this.#parts.push('>');
    this.#open.push(qualifiedName);
    return this;
  }

  /** Closes the innermost open element. */
  close(): this {
    this.#assertOpen();
    const name = this.#open.pop();
    if (name === undefined) throw new Error('No hay ningún elemento abierto que cerrar.');
    this.#parts.push(`</${name}>`);
    return this;
  }

  /** Writes escaped text into the current element. */
  text(value: string): this {
    this.#assertOpen();
    if (this.#open.length === 0) {
      throw new Error('No se puede escribir texto fuera de un elemento.');
    }
    this.#parts.push(escapeText(value));
    return this;
  }

  /**
   * Writes a complete element with simple text content.
   *
   * The common case by far, and the one where getting whitespace wrong is easiest.
   */
  element(qualifiedName: string, value: string, attributes: readonly XmlAttribute[] = []): this {
    return this.open(qualifiedName, attributes).text(value).close();
  }

  /** Writes the element only when `value` is neither `null` nor `undefined`. */
  optional(
    qualifiedName: string,
    value: string | null | undefined,
    attributes: readonly XmlAttribute[] = [],
  ): this {
    if (value === null || value === undefined) return this;
    return this.element(qualifiedName, value, attributes);
  }

  /** Number of elements currently open. Zero means the document is balanced. */
  get depth(): number {
    return this.#open.length;
  }

  /**
   * Finishes the document and returns it.
   *
   * Throws if any element is still open: an unbalanced document is a bug that must not reach a
   * validator, where it would surface as a confusing schema error.
   */
  toString(): string {
    if (this.#open.length > 0) {
      throw new Error(
        `El documento XML tiene ${this.#open.length} elemento(s) sin cerrar: ` +
          `${this.#open.join(' > ')}`,
      );
    }
    this.#closed = true;
    return this.#parts.join('');
  }

  #assertOpen(): void {
    if (this.#closed) {
      throw new Error('El documento ya se ha cerrado con toString(); crea un XmlWriter nuevo.');
    }
  }
}
