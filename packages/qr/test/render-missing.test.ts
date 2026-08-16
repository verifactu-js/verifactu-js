/**
 * Behaviour when the optional `qrcode` dependency is absent.
 *
 * This is the path a real consumer hits by default — the package declares `qrcode` as an
 * *optional* peer dependency, so most installs will not have it. It has to fail loudly and say
 * what to do, which means it has to be tested even though `qrcode` is installed here.
 *
 * `vi.resetModules()` matters: the module caches its handle to `qrcode`, so each case needs a
 * fresh instance.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock('qrcode');
});

describe('qrcode cannot be imported', () => {
  beforeEach(() => {
    vi.doMock('qrcode', () => {
      throw new Error("Cannot find package 'qrcode'");
    });
  });

  it('renderSvg rejects with QrRenderDependencyError', async () => {
    const { renderSvg, QrRenderDependencyError } = await import('../src/render.js');
    await expect(renderSvg('https://example.invalid/x')).rejects.toBeInstanceOf(
      QrRenderDependencyError,
    );
  });

  it('renderPngDataUrl rejects the same way', async () => {
    const { renderPngDataUrl, QrRenderDependencyError } = await import('../src/render.js');
    await expect(renderPngDataUrl('https://example.invalid/x')).rejects.toBeInstanceOf(
      QrRenderDependencyError,
    );
  });

  it('the error explains how to fix it and what still works', async () => {
    const { renderSvg } = await import('../src/render.js');
    try {
      await renderSvg('https://example.invalid/x');
      expect.unreachable('should have rejected');
    } catch (error) {
      const e = error as Error & { code: string; accionSugerida: string };
      expect(e.code).toBe('QRCODE_NO_INSTALADO');
      expect(e.accionSugerida).toContain('npm i qrcode');
      expect(e.accionSugerida).toContain('buildQrUrl');
      expect(e.cause).toBeInstanceOf(Error);
    }
  });

  it('isRenderAvailable reports false instead of throwing', async () => {
    const { isRenderAvailable } = await import('../src/render.js');
    await expect(isRenderAvailable()).resolves.toBe(false);
  });

  it('building the URL still works — rendering is the only thing lost', async () => {
    const { buildQrUrl, validarParametrosQR, textosFactura } = await import('../src/index.js');
    const params = {
      nif: '89890001K',
      numserie: '12345678-G33',
      fecha: '01-09-2024',
      importe: '241.40',
    };
    expect(validarParametrosQR(params)).toEqual([]);
    expect(buildQrUrl(params, { entorno: 'produccion', modo: 'verificable' })).toContain(
      'ValidarQR?nif=89890001K',
    );
    expect(textosFactura('verificable').debajo).toBe(
      'Factura verificable en la sede electrónica de la AEAT',
    );
  });
});

describe('qrcode imports but is not what we expect', () => {
  beforeEach(() => {
    // A stub, a broken install, or a major version that moved the API.
    vi.doMock('qrcode', () => ({ default: { nope: true } }));
  });

  it('is rejected rather than used blindly', async () => {
    const { renderSvg, QrRenderDependencyError } = await import('../src/render.js');
    await expect(renderSvg('https://example.invalid/x')).rejects.toBeInstanceOf(
      QrRenderDependencyError,
    );
  });

  it('says the module loaded but lacks the expected functions', async () => {
    const { renderSvg } = await import('../src/render.js');
    try {
      await renderSvg('https://example.invalid/x');
      expect.unreachable('should have rejected');
    } catch (error) {
      expect((error as { cause?: Error }).cause?.message).toContain('toString/toDataURL');
    }
  });
});
