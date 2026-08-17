/**
 * Optional rasterisation of the QR symbol.
 *
 * This package has no required runtime dependencies. Rendering needs one, so `qrcode` is an
 * **optional peer dependency**: install it and {@link renderSvg} / {@link renderPngDataUrl}
 * work; leave it out and everything else in the package still does.
 *
 * We do not implement a QR encoder ourselves. Reed-Solomon and mask selection are subtle, and
 * a symbol that scans on one reader but not another is a bad failure to own. There is nothing
 * to differentiate here: the value this package adds is in the URL, which is measured against
 * the live AEAT service, not in re-encoding a thirty-year-old standard.
 */

/** Raised when rendering is attempted without the optional dependency installed. */
export class QrRenderDependencyError extends Error {
  readonly code = 'QRCODE_NO_INSTALADO' as const;
  readonly accionSugerida: string;

  constructor(cause?: unknown) {
    super(
      'Para rasterizar el código QR hace falta el paquete «qrcode», que es una dependencia ' +
        'opcional de @verifactu-js/qr y no está instalada.',
    );
    this.name = 'QrRenderDependencyError';
    this.accionSugerida =
      'Instálalo:  npm i qrcode\n' +
      'Si solo necesitas la URL de cotejo, la validación o los literales de la factura, no ' +
      'hace falta: buildQrUrl, validarParametrosQR y textosFactura funcionan sin ella.';
    if (cause !== undefined) this.cause = cause;
  }
}

/** Options accepted by the renderers. */
export interface RenderOptions {
  /**
   * Quiet zone, in modules. Defaults to 4, the minimum the standard requires.
   *
   * Note that the Orden states the quiet zone in **millimetres** — «como mínimo 2 milímetros
   * […] recomendándose que sean 6 milímetros» — which is a property of the printed result, not
   * of the bitmap. At the mandated 30–40 mm symbol size, 4 modules lands around 2–3 mm. For the
   * recommended 6 mm, add the extra whitespace in your invoice layout rather than inflating the
   * symbol.
   */
  readonly margin?: number;
  /** Width in pixels. Only meaningful for PNG. */
  readonly width?: number;
  /** Module and background colours, as `#rrggbb` or `#rrggbbaa`. */
  readonly color?: {
    readonly dark?: string;
    readonly light?: string;
  };
}

/**
 * Error-correction level, fixed at M.
 *
 * Article 21.1 of the Orden: «Para la generación del código «QR» se empleará el nivel M (medio)
 * de corrección de errores». It is deliberately not configurable — a caller who raises it to Q
 * or H produces a non-compliant invoice, and there is no legitimate reason to want that.
 */
const ERROR_CORRECTION_LEVEL = 'M';

interface QrCodeModule {
  toString(text: string, options: Record<string, unknown>): Promise<string>;
  toDataURL(text: string, options: Record<string, unknown>): Promise<string>;
}

let cached: QrCodeModule | null = null;

/**
 * Reports whether a value exposes the two functions we call.
 *
 * `toDataURL` is what actually discriminates: every object inherits a `toString` from
 * `Object.prototype`, so checking that alone would accept anything.
 */
function esModuloQr(value: unknown): value is QrCodeModule {
  const m = value as Partial<QrCodeModule> | null | undefined;
  return typeof m?.toString === 'function' && typeof m?.toDataURL === 'function';
}

async function loadQrCode(): Promise<QrCodeModule> {
  if (cached) return cached;

  let imported: unknown;
  try {
    imported = await import('qrcode');
  } catch (error) {
    throw new QrRenderDependencyError(error);
  }

  // `qrcode` v1 is CommonJS, so Node's interop hands it over under `default`. A build exposing
  // named exports instead arrives as the namespace object itself. Which one it is, is decided by
  // whether `default` is declared — not by whether reading it yields something: probing an
  // export a module does not declare is undefined behaviour worth avoiding, and under a mocked
  // module it throws outright.
  const ns = imported as { default?: unknown };
  const resolved = 'default' in ns ? ns.default : imported;

  if (!esModuloQr(resolved)) {
    throw new QrRenderDependencyError(
      new Error('El módulo «qrcode» se ha cargado pero no expone toString/toDataURL.'),
    );
  }

  cached = resolved;
  return resolved;
}

function baseOptions(options: RenderOptions): Record<string, unknown> {
  const result: Record<string, unknown> = {
    errorCorrectionLevel: ERROR_CORRECTION_LEVEL,
    margin: options.margin ?? 4,
  };
  if (options.color) result['color'] = options.color;
  return result;
}

/**
 * Renders the QR symbol as an SVG string.
 *
 * SVG is the right choice for an invoice: the symbol is printed at a physical size between
 * 30x30 and 40x40 mm, and vector output survives whatever DPI the PDF pipeline uses.
 *
 * @param url - The cotejo URL, normally from `buildQrUrl`.
 * @throws {QrRenderDependencyError} if the optional `qrcode` dependency is not installed.
 */
export async function renderSvg(url: string, options: RenderOptions = {}): Promise<string> {
  const qrcode = await loadQrCode();
  return qrcode.toString(url, { ...baseOptions(options), type: 'svg' });
}

/**
 * Renders the QR symbol as a PNG `data:` URL.
 *
 * @param url - The cotejo URL, normally from `buildQrUrl`.
 * @throws {QrRenderDependencyError} if the optional `qrcode` dependency is not installed.
 */
export async function renderPngDataUrl(url: string, options: RenderOptions = {}): Promise<string> {
  const qrcode = await loadQrCode();
  const opts = baseOptions(options);
  if (options.width !== undefined) opts['width'] = options.width;
  return qrcode.toDataURL(url, { ...opts, type: 'image/png' });
}

/** Reports whether rasterisation is available, without throwing. */
export async function isRenderAvailable(): Promise<boolean> {
  try {
    await loadQrCode();
    return true;
  } catch {
    return false;
  }
}
