/**
 * Round trip: generate → serialise → parse → hash again.
 *
 * The hash is computed over the literals, and the literals travel as XML text. Anything that
 * happens to a value on its way through the document — an escape that is not undone, a parser
 * that "helpfully" canonicalises a `xs:dateTime`, a trim — silently breaks the digest. And the
 * AEAT does not reject a record whose hash is wrong: it stores it and flags it
 * (docs/spec-notes.md §8.7). This file is the check that would catch it.
 *
 * `FechaHoraHusoGenRegistro` is compared **byte for byte**, not merely as an equal string, and
 * not as an equal instant. `2024-01-01T19:20:30+01:00` and `2024-01-01T18:20:30Z` are the same
 * moment in time and the same `xs:dateTime` value; only one of them reproduces the digest.
 */
import { createSifChain, hashRegistroAlta } from '@verifactu-js/core';
import { describe, expect, it } from 'vitest';

import {
  parsearXml,
  NS_SUMINISTRO_INFORMACION as SF,
  textoDeHijo,
  type XmlElement,
} from '../src/index.js';
import { altaMinima, documento } from './helpers/documentos.js';
import { esperarValido } from './helpers/xsd.js';

const bytes = (texto: string): Uint8Array => new TextEncoder().encode(texto);

/** Finds the first descendant with the given local name in the SuministroInformacion namespace. */
function buscar(elemento: XmlElement, nombre: string): XmlElement | undefined {
  if (elemento.ns === SF && elemento.nombre === nombre) return elemento;
  for (const h of elemento.hijos) {
    const encontrado = buscar(h, nombre);
    if (encontrado !== undefined) return encontrado;
  }
  return undefined;
}

const texto = (xml: string, nombre: string): string => {
  const encontrado = buscar(parsearXml(xml), nombre);
  if (encontrado === undefined) throw new Error(`No aparece «${nombre}» en el documento`);
  return encontrado.texto;
};

/** The record's own digest is the last `Huella` in the document. */
function huellaDelRegistro(xml: string): string {
  const registro = buscar(parsearXml(xml), 'RegistroAlta');
  if (registro === undefined) throw new Error('No hay RegistroAlta');
  return textoDeHijo(registro, SF, 'Huella') ?? '';
}

describe('FechaHoraHusoGenRegistro survives the round trip byte for byte', () => {
  it.each([
    ['Europe/Madrid, invierno', 'Europe/Madrid', '2024-01-01T18:20:30Z', '+01:00'],
    ['Europe/Madrid, verano', 'Europe/Madrid', '2024-07-01T17:20:30Z', '+02:00'],
    ['Atlantic/Canary, invierno', 'Atlantic/Canary', '2024-01-01T19:20:30Z', '+00:00'],
    ['Atlantic/Canary, verano', 'Atlantic/Canary', '2024-07-01T18:20:30Z', '+01:00'],
    ['UTC', 'UTC', '2024-01-01T19:20:30Z', '+00:00'],
  ])('%s', async (_etiqueta, timeZone, instante, offset) => {
    const eslabon = await createSifChain({ timeZone, now: () => new Date(instante) }).alta({
      IDEmisorFactura: '89890001K',
      NumSerieFactura: '12345678/G33',
      FechaExpedicionFactura: '01-01-2024',
      TipoFactura: 'F1',
      CuotaTotal: '12.35',
      ImporteTotal: '123.45',
      previous: null,
    });

    const original = eslabon.fields.FechaHoraHusoGenRegistro;
    expect(original.endsWith(offset)).toBe(true);

    const xml = documento([{ eslabon, datos: (await altaMinima()).datos }]);
    const recuperado = texto(xml, 'FechaHoraHusoGenRegistro');

    expect(recuperado).toBe(original);
    expect(bytes(recuperado)).toEqual(bytes(original));
    // Never the `Z` form: an offset was chosen deliberately and must not be rewritten.
    expect(recuperado).not.toContain('Z');
  });

  it('and the recovered literal still reproduces the digest', async () => {
    const eslabon = await createSifChain({
      timeZone: 'Atlantic/Canary',
      now: () => new Date('2024-07-01T18:20:30Z'),
    }).alta({
      IDEmisorFactura: '89890001K',
      NumSerieFactura: '12345678/G33',
      FechaExpedicionFactura: '01-01-2024',
      TipoFactura: 'F1',
      CuotaTotal: '12.35',
      ImporteTotal: '123.45',
      previous: null,
    });

    const xml = documento([{ eslabon, datos: (await altaMinima()).datos }]);

    const recalculada = await hashRegistroAlta({
      IDEmisorFactura: texto(xml, 'IDEmisorFactura'),
      NumSerieFactura: texto(xml, 'NumSerieFactura'),
      FechaExpedicionFactura: texto(xml, 'FechaExpedicionFactura'),
      TipoFactura: texto(xml, 'TipoFactura'),
      CuotaTotal: texto(xml, 'CuotaTotal'),
      ImporteTotal: texto(xml, 'ImporteTotal'),
      Huella: null,
      FechaHoraHusoGenRegistro: texto(xml, 'FechaHoraHusoGenRegistro'),
    });

    expect(recalculada).toBe(eslabon.huella);
    expect(recalculada).toBe(huellaDelRegistro(xml));
  });
});

describe('what a normalising parser would have cost', () => {
  it('canonicalising the dateTime changes the digest', async () => {
    // This is the failure this module exists to prevent, written down as a test rather than as a
    // warning in a comment. A parser that turned the offset form into the `Z` form — same
    // instant, same xs:dateTime value — would produce a different hash and the AEAT would accept
    // the record and flag it, days later.
    const original = '2024-01-01T19:20:30+01:00';
    const canonicalizado = new Date(original).toISOString().replace('.000', '');

    expect(canonicalizado).toBe('2024-01-01T18:20:30Z');
    expect(new Date(canonicalizado).getTime()).toBe(new Date(original).getTime());

    const campos = {
      IDEmisorFactura: '89890001K',
      NumSerieFactura: '12345678/G33',
      FechaExpedicionFactura: '01-01-2024',
      TipoFactura: 'F1',
      CuotaTotal: '12.35',
      ImporteTotal: '123.45',
      Huella: null,
    };

    const conOriginal = await hashRegistroAlta({
      ...campos,
      FechaHoraHusoGenRegistro: original,
    });
    const conCanonico = await hashRegistroAlta({
      ...campos,
      FechaHoraHusoGenRegistro: canonicalizado,
    });

    expect(conOriginal).not.toBe(conCanonico);
  });
});

describe('every hashed literal survives the round trip', () => {
  it('including one that had to be escaped on the way out', async () => {
    // `&` is legal in a series and goes unescaped into the hash, but the XML must carry `&amp;`.
    // `<` and `>` are *not* legal there — core rejects them (I-28) — so the markup characters are
    // exercised on a free-text field the AEAT does not restrict.
    const registro = await altaMinima(
      { NumSerieFactura: 'A&B/2024' },
      { NombreRazonEmisor: 'GARCIA & HIJOS <SL>' },
    );
    const xml = documento([registro]);

    expect(xml).toContain('<sf:NumSerieFactura>A&amp;B/2024</sf:NumSerieFactura>');
    expect(xml).toContain(
      '<sf:NombreRazonEmisor>GARCIA &amp; HIJOS &lt;SL&gt;</sf:NombreRazonEmisor>',
    );
    expect(texto(xml, 'NombreRazonEmisor')).toBe('GARCIA & HIJOS <SL>');

    const recuperado = {
      IDEmisorFactura: texto(xml, 'IDEmisorFactura'),
      NumSerieFactura: texto(xml, 'NumSerieFactura'),
      FechaExpedicionFactura: texto(xml, 'FechaExpedicionFactura'),
      TipoFactura: texto(xml, 'TipoFactura'),
      CuotaTotal: texto(xml, 'CuotaTotal'),
      ImporteTotal: texto(xml, 'ImporteTotal'),
      Huella: null,
      FechaHoraHusoGenRegistro: texto(xml, 'FechaHoraHusoGenRegistro'),
    };

    expect(recuperado.NumSerieFactura).toBe('A&B/2024');
    expect(recuperado).toEqual({ ...registro.eslabon.fields });
    expect(await hashRegistroAlta(recuperado)).toBe(registro.eslabon.huella);
    await esperarValido(xml);
  });

  it('including the previous record inside Encadenamiento', async () => {
    const chain = createSifChain({
      timeZone: 'Europe/Madrid',
      now: () => new Date('2024-01-01T18:20:30Z'),
    });
    const primero = await chain.alta({
      IDEmisorFactura: '89890001K',
      NumSerieFactura: 'A&1',
      FechaExpedicionFactura: '01-01-2024',
      TipoFactura: 'F1',
      CuotaTotal: '12.35',
      ImporteTotal: '123.45',
      previous: null,
    });
    const segundo = await chain.alta({
      IDEmisorFactura: '89890001K',
      NumSerieFactura: 'A&2',
      FechaExpedicionFactura: '01-01-2024',
      TipoFactura: 'F1',
      CuotaTotal: '12.35',
      ImporteTotal: '123.45',
      previous: primero,
    });

    const datos = (await altaMinima()).datos;
    const xml = documento([
      { eslabon: primero, datos },
      { eslabon: segundo, datos },
    ]);
    await esperarValido(xml);

    const raiz = parsearXml(xml);
    const anterior = buscar(raiz, 'RegistroAnterior');
    expect(anterior).toBeDefined();
    expect(textoDeHijo(anterior as XmlElement, SF, 'NumSerieFactura')).toBe('A&1');
    expect(textoDeHijo(anterior as XmlElement, SF, 'Huella')).toBe(primero.huella);
    expect(segundo.fields.Huella).toBe(primero.huella);
  });

  it('and the digest can be recomputed for every record of a batch', async () => {
    const chain = createSifChain({
      timeZone: 'Atlantic/Canary',
      now: () => new Date('2024-01-01T19:20:30Z'),
    });
    const datos = (await altaMinima()).datos;

    let previous = null as Awaited<ReturnType<typeof chain.alta>> | null;
    const eslabones = [];
    for (let i = 0; i < 3; i += 1) {
      const eslabon = await chain.alta({
        IDEmisorFactura: '89890001K',
        NumSerieFactura: `SERIE & ${i}`,
        FechaExpedicionFactura: '01-01-2024',
        TipoFactura: 'F1',
        CuotaTotal: '12.35',
        ImporteTotal: '123.45',
        previous,
      });
      previous = eslabon;
      eslabones.push(eslabon);
    }

    const xml = documento(eslabones.map((eslabon) => ({ eslabon, datos })));
    await esperarValido(xml);

    const registros = parsearXml(xml).hijos.flatMap((rf) =>
      rf.hijos.filter((h) => h.ns === SF && h.nombre === 'RegistroAlta'),
    );
    expect(registros).toHaveLength(3);

    for (const [indice, registro] of registros.entries()) {
      const encadenamiento = buscar(registro, 'Encadenamiento');
      const anterior =
        encadenamiento === undefined ? undefined : buscar(encadenamiento, 'RegistroAnterior');
      const idFactura = buscar(registro, 'IDFactura') as XmlElement;

      const recalculada = await hashRegistroAlta({
        IDEmisorFactura: textoDeHijo(idFactura, SF, 'IDEmisorFactura') ?? '',
        NumSerieFactura: textoDeHijo(idFactura, SF, 'NumSerieFactura') ?? '',
        FechaExpedicionFactura: textoDeHijo(idFactura, SF, 'FechaExpedicionFactura') ?? '',
        TipoFactura: textoDeHijo(registro, SF, 'TipoFactura') ?? '',
        CuotaTotal: textoDeHijo(registro, SF, 'CuotaTotal') ?? '',
        ImporteTotal: textoDeHijo(registro, SF, 'ImporteTotal') ?? '',
        Huella: anterior === undefined ? null : (textoDeHijo(anterior, SF, 'Huella') ?? ''),
        FechaHoraHusoGenRegistro: textoDeHijo(registro, SF, 'FechaHoraHusoGenRegistro') ?? '',
      });

      expect(recalculada).toBe(textoDeHijo(registro, SF, 'Huella'));
      expect(recalculada).toBe(eslabones[indice]?.huella);
    }
  });
});
