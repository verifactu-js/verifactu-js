/**
 * Optional rasterisation.
 *
 * `qrcode` is installed as a devDependency here so the happy path is actually exercised; in a
 * consumer it is an optional peerDependency and its absence must fail loudly and legibly.
 */
import { describe, expect, it } from 'vitest';

import {
  buildQrUrl,
  isRenderAvailable,
  NIVEL_CORRECCION,
  type ParametrosQR,
  QrRenderDependencyError,
  renderPngDataUrl,
  renderSvg,
} from '../src/index.js';

const EJEMPLO: ParametrosQR = {
  nif: '89890001K',
  numserie: '12345678-G33',
  fecha: '01-09-2024',
  importe: '241.40',
};

const URL_EJEMPLO = buildQrUrl(EJEMPLO, { entorno: 'produccion', modo: 'verificable' });

describe('renderSvg', () => {
  it('produces an SVG document', async () => {
    const svg = await renderSvg(URL_EJEMPLO);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('viewBox');
  });

  it('encodes the whole payload, not a truncation of it', async () => {
    // There is no decoder to round-trip against here, so assert the next best thing: a longer
    // URL must yield a larger symbol. If the payload were being truncated or ignored, the two
    // would come out the same size.
    const box = (svg: string) => Number(/viewBox="0 0 (\d+)/.exec(svg)?.[1] ?? 0);

    const corta = await renderSvg(
      buildQrUrl({ ...EJEMPLO, numserie: 'A' }, { entorno: 'produccion', modo: 'verificable' }),
    );
    const larga = await renderSvg(
      buildQrUrl(
        { ...EJEMPLO, numserie: 'B'.repeat(60) },
        { entorno: 'produccion', modo: 'verificable' },
      ),
    );

    expect(box(larga)).toBeGreaterThan(box(corta));
  });

  it('honours a custom quiet zone', async () => {
    const tight = await renderSvg(URL_EJEMPLO, { margin: 0 });
    const wide = await renderSvg(URL_EJEMPLO, { margin: 10 });
    // A larger quiet zone means a larger viewBox for the same payload.
    const box = (svg: string) => Number(/viewBox="0 0 (\d+)/.exec(svg)?.[1] ?? 0);
    expect(box(wide)).toBeGreaterThan(box(tight));
  });

  it('defaults to a quiet zone of 4 modules, the standard minimum', async () => {
    const byDefault = await renderSvg(URL_EJEMPLO);
    const explicit = await renderSvg(URL_EJEMPLO, { margin: 4 });
    expect(byDefault).toBe(explicit);
  });

  it('accepts custom colours', async () => {
    const svg = await renderSvg(URL_EJEMPLO, { color: { dark: '#101010', light: '#ffffff' } });
    expect(svg.toLowerCase()).toContain('#101010');
  });
});

describe('renderPngDataUrl', () => {
  it('produces a PNG data URL', async () => {
    const dataUrl = await renderPngDataUrl(URL_EJEMPLO);
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(dataUrl.length).toBeGreaterThan(1000);
  });

  it('honours the requested width', async () => {
    const small = await renderPngDataUrl(URL_EJEMPLO, { width: 128 });
    const large = await renderPngDataUrl(URL_EJEMPLO, { width: 512 });
    expect(large.length).toBeGreaterThan(small.length);
  });
});

describe('the error-correction level is not negotiable', () => {
  it('is fixed at M, as article 21.1 requires', () => {
    expect(NIVEL_CORRECCION).toBe('M');
  });

  it('offers no way to override it', async () => {
    // Passing an unknown option must not change the level: RenderOptions has no such field,
    // and the implementation sets it after spreading.
    const normal = await renderSvg(URL_EJEMPLO);
    const attempted = await renderSvg(URL_EJEMPLO, {
      errorCorrectionLevel: 'H',
    } as unknown as Record<string, never>);
    expect(attempted).toBe(normal);
  });
});

describe('isRenderAvailable', () => {
  it('reports true here, because qrcode is a devDependency of this package', async () => {
    await expect(isRenderAvailable()).resolves.toBe(true);
  });
});

describe('QrRenderDependencyError', () => {
  it('carries a stable code and an actionable message', () => {
    const error = new QrRenderDependencyError();
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('QRCODE_NO_INSTALADO');
    expect(error.name).toBe('QrRenderDependencyError');
    expect(error.message).toContain('qrcode');
    expect(error.accionSugerida).toContain('npm i qrcode');
  });

  it('says which parts of the package still work without it', () => {
    const error = new QrRenderDependencyError();
    expect(error.accionSugerida).toContain('buildQrUrl');
    expect(error.accionSugerida).toContain('validarParametrosQR');
  });

  it('preserves the underlying cause when there is one', () => {
    const cause = new Error('Cannot find module');
    expect(new QrRenderDependencyError(cause).cause).toBe(cause);
  });

  it('omits cause when none is given', () => {
    expect(new QrRenderDependencyError().cause).toBeUndefined();
  });
});

describe('the rest of the package works without rasterisation', () => {
  it('URL, validation and invoice literals need no dependency at all', async () => {
    const { validarParametrosQR, textosFactura } = await import('../src/index.js');
    expect(validarParametrosQR(EJEMPLO)).toEqual([]);
    expect(textosFactura('verificable').encima).toBe('QR tributario:');
    expect(URL_EJEMPLO).toContain('ValidarQR?nif=89890001K');
  });
});
