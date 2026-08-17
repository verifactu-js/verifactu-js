/**
 * QR cotejo URL.
 *
 * The official examples of §8 of the QR specification are used as golden vectors, and the
 * encoding assertions encode what was *measured* against the live service on 2026-08-16
 * (docs/spec-notes.md §17), not what the documentation left ambiguous.
 */
import { describe, expect, it } from 'vitest';

import {
  buildCotejoUrl,
  buildQrUrl,
  MARGEN_MM,
  NIVEL_CORRECCION,
  NORMA,
  type ParametrosQR,
  TAMANO_MM,
  TEXTO_PRECEDE,
  TEXTO_VERIFICABLE_CORTO,
  TEXTO_VERIFICABLE_LARGO,
  textosFactura,
  URL_BASE,
  validarParametrosQR,
} from '../src/index.js';

/** The example invoice used in §8 of the specification. */
const EJEMPLO: ParametrosQR = {
  nif: '89890001K',
  numserie: '12345678-G33',
  fecha: '01-09-2024',
  importe: '241.4',
};

describe('official example URLs (QR spec v0.5.0 §8)', () => {
  it('8.1 — pruebas, verifiable', () => {
    expect(buildQrUrl(EJEMPLO, { entorno: 'pruebas', modo: 'verificable' })).toBe(
      'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=12345678-G33&fecha=01-09-2024&importe=241.4',
    );
  });

  it('8.2 — pruebas, non-verifiable', () => {
    expect(buildQrUrl(EJEMPLO, { entorno: 'pruebas', modo: 'no-verificable' })).toBe(
      'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu?nif=89890001K&numserie=12345678-G33&fecha=01-09-2024&importe=241.4',
    );
  });

  it('8.3 — producción, verifiable', () => {
    expect(buildQrUrl(EJEMPLO, { entorno: 'produccion', modo: 'verificable' })).toBe(
      'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=12345678-G33&fecha=01-09-2024&importe=241.4',
    );
  });

  it('8.4 — producción, non-verifiable', () => {
    expect(buildQrUrl(EJEMPLO, { entorno: 'produccion', modo: 'no-verificable' })).toBe(
      'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu?nif=89890001K&numserie=12345678-G33&fecha=01-09-2024&importe=241.4',
    );
  });

  it('the four base URLs are distinct', () => {
    const all = [
      URL_BASE.verificable.pruebas,
      URL_BASE.verificable.produccion,
      URL_BASE['no-verificable'].pruebas,
      URL_BASE['no-verificable'].produccion,
    ];
    expect(new Set(all).size).toBe(4);
  });
});

describe('encoding — measured behaviour, not assumed (spec-notes §17)', () => {
  it('encodes the "&" of the specification example as %26', () => {
    // §4 of the spec: numserie "12345678&G33" must travel as "12345678%26G33".
    const url = buildQrUrl(
      { ...EJEMPLO, numserie: '12345678&G33' },
      { entorno: 'pruebas', modo: 'verificable' },
    );
    expect(url).toContain('numserie=12345678%26G33');
    // Exactly one parameter separator per parameter: the "&" inside the value must not create
    // a fifth parameter.
    expect(url.split('&')).toHaveLength(4);
  });

  it('encodes a literal "+" as %2B — the service would read a raw "+" as a space', () => {
    const url = buildQrUrl(
      { ...EJEMPLO, numserie: 'A+B' },
      { entorno: 'pruebas', modo: 'verificable' },
    );
    expect(url).toContain('numserie=A%2BB');
    expect(url).not.toContain('numserie=A+B');
  });

  it('encodes a space as %20, which the service decodes back to a space', () => {
    const url = buildQrUrl(
      { ...EJEMPLO, numserie: 'A B' },
      { entorno: 'pruebas', modo: 'verificable' },
    );
    expect(url).toContain('numserie=A%20B');
  });

  it("leaves ~ ! * ' ( ) alone — measured to pass through unchanged", () => {
    const url = buildQrUrl(
      { ...EJEMPLO, numserie: "A~B!C*D'E(F)G" },
      { entorno: 'pruebas', modo: 'verificable' },
    );
    expect(url).toContain("numserie=A~B!C*D'E(F)G");
  });

  it('encodes characters that would otherwise break the query string', () => {
    const url = buildQrUrl(
      { ...EJEMPLO, numserie: 'A#B=C%D' },
      { entorno: 'pruebas', modo: 'verificable' },
    );
    expect(url).toContain('numserie=A%23B%3DC%25D');
  });

  it('keeps the four parameters in specification order', () => {
    const url = buildQrUrl(EJEMPLO, { entorno: 'produccion', modo: 'verificable' });
    const names = [...url.matchAll(/[?&]([a-z]+)=/g)].map((m) => m[1]);
    expect(names).toEqual(['nif', 'numserie', 'fecha', 'importe']);
  });

  it('produces a URL the platform parses back to the original values', () => {
    const params: ParametrosQR = {
      ...EJEMPLO,
      numserie: "SERIE 2024/A+B&C#D'E~F",
    };
    const url = buildQrUrl(params, { entorno: 'produccion', modo: 'verificable' });
    const parsed = new URL(url).searchParams;

    expect(parsed.get('nif')).toBe(params.nif);
    expect(parsed.get('numserie')).toBe(params.numserie);
    expect(parsed.get('fecha')).toBe(params.fecha);
    expect(parsed.get('importe')).toBe(params.importe);
  });
});

describe('buildQrUrl refuses to build a QR that cannot be cotejada', () => {
  it.each([
    ['nif vacío', { ...EJEMPLO, nif: '' }],
    ['nif corto', { ...EJEMPLO, nif: '891K' }],
    ['fecha ISO en vez de DD-MM-AAAA', { ...EJEMPLO, fecha: '2024-09-01' }],
    ['importe con coma decimal', { ...EJEMPLO, importe: '7,2' }],
    ['numserie vacío', { ...EJEMPLO, numserie: '' }],
    ['numserie de 61 caracteres', { ...EJEMPLO, numserie: 'A'.repeat(61) }],
  ])('rejects %s', (_label, params) => {
    expect(() =>
      buildQrUrl(params as ParametrosQR, { entorno: 'pruebas', modo: 'verificable' }),
    ).toThrow();
  });

  it('explains why it matters', () => {
    try {
      buildQrUrl({ ...EJEMPLO, importe: '7,2' }, { entorno: 'pruebas', modo: 'verificable' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as Error).message).toContain('no lleva la huella');
    }
  });
});

describe('validarParametrosQR — AEAT error codes (QR spec §10)', () => {
  it('returns no findings for the official example', () => {
    expect(validarParametrosQR(EJEMPLO)).toEqual([]);
  });

  it.each([
    ['1001', { ...EJEMPLO, nif: '' }],
    ['1002', { ...EJEMPLO, numserie: '' }],
    ['1003', { ...EJEMPLO, fecha: '' }],
    ['1004', { ...EJEMPLO, importe: '' }],
    ['2001', { ...EJEMPLO, nif: '891K' }],
    ['2002', { ...EJEMPLO, numserie: 'A'.repeat(61) }],
    ['2004', { ...EJEMPLO, fecha: '1-9-2024' }],
    ['2005', { ...EJEMPLO, importe: '7,2' }],
  ])('reports code %s', (codigo, params) => {
    const problemas = validarParametrosQR(params as ParametrosQR);
    expect(problemas.map((p) => p.codigo)).toContain(codigo);
  });

  it('reports 2003 for a character outside ASCII 32-126', () => {
    const problemas = validarParametrosQR({ ...EJEMPLO, numserie: 'SERIE-Ñ' });
    expect(problemas.map((p) => p.codigo)).toContain('2003');
  });

  it('accepts an amount at the documented limits', () => {
    expect(validarParametrosQR({ ...EJEMPLO, importe: '999999999999.99' })).toEqual([]);
    expect(validarParametrosQR({ ...EJEMPLO, importe: '0' })).toEqual([]);
    expect(validarParametrosQR({ ...EJEMPLO, importe: '241.4' })).toEqual([]);
  });

  it.each([
    ['con decimales', '1234567890123.00'],
    ['sin decimales', '1234567890123'],
    ['con signo', '-1234567890123.00'],
  ])('reports 2006, not 2005, for thirteen integer digits (%s)', (_label, importe) => {
    // 2005 is «formato incorrecto» and 2006 is «excede el número máximo de caracteres». Telling
    // them apart is the whole point of counting the integer part, and the count has to work
    // whether or not there is a decimal separator to stop at.
    const problemas = validarParametrosQR({ ...EJEMPLO, importe });
    expect(problemas.map((p) => p.codigo)).toEqual(['2006']);
  });

  it('reports 2005 for twelve integer digits with too many decimals', () => {
    const problemas = validarParametrosQR({ ...EJEMPLO, importe: '999999999999.999' });
    expect(problemas.map((p) => p.codigo)).toEqual(['2005']);
  });

  it('never throws, whatever it is handed', () => {
    expect(() => validarParametrosQR(undefined as unknown as ParametrosQR)).not.toThrow();
    expect(validarParametrosQR(undefined as unknown as ParametrosQR).length).toBeGreaterThan(0);
  });
});

describe('buildCotejoUrl — the query form, never the printed form', () => {
  it('appends idioma and formato', () => {
    const url = buildCotejoUrl(EJEMPLO, {
      entorno: 'pruebas',
      modo: 'verificable',
      idioma: 'en',
      formato: 'json',
    });
    expect(url).toContain('&idioma=en');
    expect(url).toContain('&formato=json');
  });

  it('omits them when not asked for', () => {
    const url = buildCotejoUrl(EJEMPLO, { entorno: 'pruebas', modo: 'verificable' });
    expect(url).not.toContain('idioma');
    expect(url).not.toContain('formato');
    expect(url).toBe(buildQrUrl(EJEMPLO, { entorno: 'pruebas', modo: 'verificable' }));
  });

  it('buildQrUrl has no way to add formato — the spec forbids it inside the QR', () => {
    const url = buildQrUrl(EJEMPLO, { entorno: 'produccion', modo: 'verificable' });
    expect(url).not.toContain('formato');
  });
});

describe('invoice presentation (art. 20 and 21)', () => {
  it('verifiable invoices carry both texts, long form by default', () => {
    expect(textosFactura('verificable')).toEqual({
      encima: TEXTO_PRECEDE,
      debajo: TEXTO_VERIFICABLE_LARGO,
    });
  });

  it('the short form is admissible', () => {
    expect(textosFactura('verificable', 'corta').debajo).toBe(TEXTO_VERIFICABLE_CORTO);
  });

  it('non-verifiable invoices carry only the preceding text', () => {
    expect(textosFactura('no-verificable')).toEqual({ encima: TEXTO_PRECEDE, debajo: null });
  });

  it('the literals are exactly as published', () => {
    expect(TEXTO_PRECEDE).toBe('QR tributario:');
    expect(TEXTO_VERIFICABLE_LARGO).toBe('Factura verificable en la sede electrónica de la AEAT');
    expect(TEXTO_VERIFICABLE_CORTO).toBe('VERI*FACTU');
  });

  it('exposes the physical constraints of art. 21', () => {
    expect(TAMANO_MM).toEqual({ minimo: 30, maximo: 40 });
    expect(NIVEL_CORRECCION).toBe('M');
    expect(NORMA).toBe('ISO/IEC 18004:2015');
    expect(MARGEN_MM).toEqual({ minimo: 2, recomendado: 6 });
  });
});
