/**
 * Namespaces — the silent failure this package exists to prevent.
 *
 * The schemas are downloaded from paths containing `tikeV1.0`, but declare `tike` inside. Using
 * the download URL as the namespace produces a document that looks right, parses fine, and is
 * rejected by the AEAT with an error that points at the element rather than the namespace.
 *
 * These tests do not assert on string constants. They build documents and run them through the
 * official XSDs, so a wrong namespace fails the way it would fail in production.
 *
 * See docs/spec-notes.md §8.3.
 */
import { describe, expect, it } from 'vitest';

import {
  NAMESPACES,
  NS_RESPUESTA_SUMINISTRO,
  NS_SUMINISTRO_INFORMACION,
  NS_SUMINISTRO_LR,
  PREFIX,
} from '../src/index.js';
import { registroAltaMinimo, remision } from './helpers/documentos.js';
import { esperarInvalido, esperarValido, validarContraXsd } from './helpers/xsd.js';

describe('the declared namespaces, not the download URLs', () => {
  it('use "tike" without a version', () => {
    for (const ns of [NS_SUMINISTRO_LR, NS_SUMINISTRO_INFORMACION, NS_RESPUESTA_SUMINISTRO]) {
      expect(ns).toContain('/aeat/tike/cont/ws/');
      expect(ns).not.toContain('tikeV1.0');
    }
  });

  it('use www2.agenciatributaria.gob.es, not the prewww2 host they are served from', () => {
    for (const ns of [NS_SUMINISTRO_LR, NS_SUMINISTRO_INFORMACION, NS_RESPUESTA_SUMINISTRO]) {
      expect(ns.startsWith('https://www2.agenciatributaria.gob.es/')).toBe(true);
      expect(ns).not.toContain('prewww');
    }
  });

  it('match the targetNamespace each schema declares', async () => {
    const { readFileSync } = await import('node:fs');
    const { dirname, join } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const schemas = join(dirname(dirname(fileURLToPath(import.meta.url))), 'schemas');

    const declared = (file: string): string => {
      const xsd = readFileSync(join(schemas, file), 'utf8');
      return /targetNamespace="([^"]+)"/.exec(xsd)?.[1] ?? '';
    };

    expect(declared('SuministroLR.xsd')).toBe(NS_SUMINISTRO_LR);
    expect(declared('SuministroInformacion.xsd')).toBe(NS_SUMINISTRO_INFORMACION);
    expect(declared('RespuestaSuministro.xsd')).toBe(NS_RESPUESTA_SUMINISTRO);
  });

  it('are exposed keyed by prefix', () => {
    expect(NAMESPACES[PREFIX.sfLR]).toBe(NS_SUMINISTRO_LR);
    expect(NAMESPACES[PREFIX.sf]).toBe(NS_SUMINISTRO_INFORMACION);
    expect(NAMESPACES[PREFIX.sfR]).toBe(NS_RESPUESTA_SUMINISTRO);
  });
});

describe('a document with the correct namespaces validates', () => {
  it('validates against SuministroLR.xsd', async () => {
    await esperarValido(remision([registroAltaMinimo()]));
  });
});

describe('the tikeV1.0 trap', () => {
  it('a document using the download URL as namespace is REJECTED', async () => {
    const roto = remision([registroAltaMinimo()])
      .split('/aeat/tike/cont/ws/')
      .join('/aeat/tikeV1.0/cont/ws/');

    const errores = await esperarInvalido(roto);
    expect(errores.join(' ')).toMatch(/tikeV1\.0|not expected|No matching global declaration/i);
  });

  it('swapping only the child namespace is also rejected', async () => {
    // A half-migration: the root keeps the right namespace, the children do not.
    const roto = remision([registroAltaMinimo()]).replace(
      `xmlns:${PREFIX.sf}="${NS_SUMINISTRO_INFORMACION}"`,
      `xmlns:${PREFIX.sf}="${NS_SUMINISTRO_INFORMACION.replace('/tike/', '/tikeV1.0/')}"`,
    );
    await esperarInvalido(roto);
  });

  it('using the prewww2 host as namespace is rejected', async () => {
    const roto = remision([registroAltaMinimo()])
      .split('https://www2.agenciatributaria.gob.es/')
      .join('https://prewww2.aeat.es/');
    await esperarInvalido(roto);
  });
});

describe('elementFormDefault="qualified": every child carries a prefix', () => {
  it('an unqualified child is rejected', async () => {
    const roto = remision([registroAltaMinimo()])
      .replace(`<${PREFIX.sf}:IDVersion>`, '<IDVersion>')
      .replace(`</${PREFIX.sf}:IDVersion>`, '</IDVersion>');

    const errores = await esperarInvalido(roto);
    expect(errores.join(' ')).toContain('IDVersion');
  });

  it('an unqualified grandchild is rejected', async () => {
    const roto = remision([registroAltaMinimo()])
      .replace(`<${PREFIX.sf}:IDEmisorFactura>`, '<IDEmisorFactura>')
      .replace(`</${PREFIX.sf}:IDEmisorFactura>`, '</IDEmisorFactura>');

    await esperarInvalido(roto);
  });

  it('the correct document has no unprefixed element at all', () => {
    const xml = remision([registroAltaMinimo()]);
    // Every start tag must carry one of our prefixes.
    for (const [, name] of xml.matchAll(/<([A-Za-z][\w.-]*)[\s>]/g)) {
      expect(name).toMatch(/^(sfLR|sf|sfR|soapenv):/);
    }
  });
});

describe('the harness itself is trustworthy', () => {
  it('reports errors instead of throwing on invalid input', async () => {
    const { valido, errores } = await validarContraXsd('<a/>');
    expect(valido).toBe(false);
    expect(errores.length).toBeGreaterThan(0);
  });

  it('catches a value outside an enumeration', async () => {
    const roto = remision([registroAltaMinimo({ TipoFactura: 'ZZ' })]);
    const errores = await esperarInvalido(roto);
    expect(errores.join(' ')).toContain('TipoFactura');
  });

  it('catches elements emitted out of order', async () => {
    const xml = remision([registroAltaMinimo()]);
    const roto = xml.replace(
      `<${PREFIX.sf}:CuotaTotal>12.35</${PREFIX.sf}:CuotaTotal><${PREFIX.sf}:ImporteTotal>123.45</${PREFIX.sf}:ImporteTotal>`,
      `<${PREFIX.sf}:ImporteTotal>123.45</${PREFIX.sf}:ImporteTotal><${PREFIX.sf}:CuotaTotal>12.35</${PREFIX.sf}:CuotaTotal>`,
    );
    expect(roto).not.toBe(xml);
    await esperarInvalido(roto);
  });

  it('catches a Huella that is one character too long', async () => {
    const xml = remision([registroAltaMinimo()]);
    const roto = xml.replace(/([0-9A-F]{64})<\/sf:Huella>/, '$10</sf:Huella>');
    expect(roto).not.toBe(xml);
    await esperarInvalido(roto);
  });
});
