/**
 * `@verifactu-js/qr` — the cotejo URL that goes inside the tax QR code, and the presentation
 * rules that surround it.
 *
 * Sources, all consulted 2026-08-16 (see `docs/spec-notes.md` §7 and §17):
 *  - AEAT, "Detalle de las especificaciones técnicas del código «QR» de la factura y de la
 *    «URL» del servicio de cotejo…", v0.5.0 (2025-12-10).
 *  - Orden HAC/1177/2024, arts. 20 and 21.
 *  - Measured behaviour of the live cotejo service (`scripts/probe-qr-encoding.mjs`).
 *
 * Zero runtime dependencies. This package builds and validates the URL; it does not rasterise
 * the QR symbol.
 */

// ---------------------------------------------------------------------------------------------
// Environments and modes
// ---------------------------------------------------------------------------------------------

/** Which AEAT environment the URL points at. */
export type EntornoQR = 'produccion' | 'pruebas';

/**
 * Whether the issuing system emits verifiable invoices.
 *
 * The AEAT publishes two different endpoints, `ValidarQR` and `ValidarQRNoVerifactu`, and the
 * invoice must carry different text depending on which applies.
 */
export type ModoSif = 'verificable' | 'no-verificable';

/** Base URLs, verbatim from §5 of the QR specification. */
export const URL_BASE = {
  verificable: {
    pruebas: 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR',
    produccion: 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR',
  },
  'no-verificable': {
    pruebas: 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu',
    produccion: 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu',
  },
} as const satisfies Record<ModoSif, Record<EntornoQR, string>>;

// ---------------------------------------------------------------------------------------------
// Physical specification (art. 21 of the Orden, §2 and §3 of the technical document)
// ---------------------------------------------------------------------------------------------

/** Permitted symbol size, in millimetres. «entre 30x30 y 40x40 milímetros». */
export const TAMANO_MM = { minimo: 30, maximo: 40 } as const;

/** Error-correction level. «se empleará el nivel M (medio) de corrección de errores». */
export const NIVEL_CORRECCION = 'M' as const;

/** Standard the symbol must follow. */
export const NORMA = 'ISO/IEC 18004:2015' as const;

/** Quiet zone: «como mínimo 2 milímetros […] recomendándose que sean 6 milímetros». */
export const MARGEN_MM = { minimo: 2, recomendado: 6 } as const;

/** Text that must always precede the symbol, immediately above it. */
export const TEXTO_PRECEDE = 'QR tributario:' as const;

/** Long form of the phrase that goes below the symbol for verifiable invoices. */
export const TEXTO_VERIFICABLE_LARGO =
  'Factura verificable en la sede electrónica de la AEAT' as const;

/** Short form of that same phrase. */
export const TEXTO_VERIFICABLE_CORTO = 'VERI*FACTU' as const;

/** The literals that must accompany the symbol on the invoice. */
export interface TextosFactura {
  /** Always shown, immediately above the symbol. */
  readonly encima: string;
  /** Shown immediately below the symbol; `null` for systems emitting non-verifiable invoices. */
  readonly debajo: string | null;
}

/**
 * Returns the literals that must accompany the QR on the invoice.
 *
 * @param modo - Whether the system emits verifiable invoices.
 * @param forma - Which wording to use below the symbol. Both are admissible.
 */
export function textosFactura(modo: ModoSif, forma: 'larga' | 'corta' = 'larga'): TextosFactura {
  if (modo === 'no-verificable') return { encima: TEXTO_PRECEDE, debajo: null };
  return {
    encima: TEXTO_PRECEDE,
    debajo: forma === 'corta' ? TEXTO_VERIFICABLE_CORTO : TEXTO_VERIFICABLE_LARGO,
  };
}

// ---------------------------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------------------------

/**
 * The four mandatory parameters, in the order the specification lists them.
 *
 * Every value is a string already in its final form. `importe` in particular is **not** a
 * number, for the same reason it is not one in `@verifactu-js/core`: the caller serialises it
 * once and that same string travels to the XML, to the hash and to the QR.
 */
export interface ParametrosQR {
  /** NIF of the party obliged to issue the invoice. Nine characters. */
  readonly nif: string;
  /** Series + invoice number. ASCII 32-126, at most 60 characters. */
  readonly numserie: string;
  /** Issue date, `DD-MM-AAAA`. */
  readonly fecha: string;
  /** Invoice total. `.` as decimal separator, at most 12 integer digits and 2 decimals. */
  readonly importe: string;
}

/** Languages the cotejo service accepts for its HTML response. */
export type IdiomaCotejo = 'gl' | 'ca' | 'eu' | 'es' | 'va' | 'en';

/** Options for {@link buildQrUrl}. */
export interface BuildQrUrlOptions {
  readonly entorno: EntornoQR;
  readonly modo: ModoSif;
}

/** Options for {@link buildCotejoUrl}. */
export interface BuildCotejoUrlOptions extends BuildQrUrlOptions {
  /** Language of the HTML response. Defaults to Spanish when omitted. */
  readonly idioma?: IdiomaCotejo;
  /** Ask for a machine-readable answer. **Never valid inside a QR code.** */
  readonly formato?: 'json';
}

// ---------------------------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------------------------

/** Validation codes, aligned with the AEAT's own list in §10 of the QR specification. */
export type CodigoErrorQR =
  | '1001'
  | '1002'
  | '1003'
  | '1004'
  | '2001'
  | '2002'
  | '2003'
  | '2004'
  | '2005'
  | '2006';

/** A problem found in the parameters, before anything is sent anywhere. */
export interface ProblemaQR {
  readonly codigo: CodigoErrorQR;
  readonly parametro: keyof ParametrosQR;
  /** The AEAT's own wording for this code. */
  readonly mensaje: string;
}

const RE_FECHA = /^\d{2}-\d{2}-\d{4}$/;
const RE_IMPORTE = /^-?\d{1,12}(\.\d{1,2})?$/;

/** ASCII 32-126: «las cadenas de texto solo pueden contener caracteres ASCII […] imprimibles». */
function esAsciiImprimible(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 32 || code > 126) return false;
  }
  return true;
}

/**
 * Checks the four parameters against the rules the cotejo service applies, so the failure
 * happens on your machine instead of on a printed invoice.
 *
 * Returns findings; never throws.
 */
export function validarParametrosQR(params: ParametrosQR): ProblemaQR[] {
  const problemas: ProblemaQR[] = [];
  const { nif, numserie, fecha, importe } = params ?? ({} as ParametrosQR);

  if (!nif) {
    problemas.push({
      codigo: '1001',
      parametro: 'nif',
      mensaje:
        'No se ha remitido el parámetro: nif (El parámetro "nif" es el número de identificación fiscal (NIF) del obligado a expedir la factura)',
    });
  } else if (nif.length !== 9) {
    problemas.push({
      codigo: '2001',
      parametro: 'nif',
      mensaje: 'El NIF tiene un formato erróneo o no es válido',
    });
  }

  if (!numserie) {
    problemas.push({
      codigo: '1002',
      parametro: 'numserie',
      mensaje:
        'No se ha remitido el parámetro: numserie (El parámetro "numserie" es el número de serie y número de factura que identifica a la factura emitida)',
    });
  } else {
    if (numserie.length > 60) {
      problemas.push({
        codigo: '2002',
        parametro: 'numserie',
        mensaje: 'El número de serie excede el número máximo de caracteres',
      });
    }
    if (!esAsciiImprimible(numserie)) {
      problemas.push({
        codigo: '2003',
        parametro: 'numserie',
        mensaje: 'El número de serie contiene caracteres no permitidos',
      });
    }
  }

  if (!fecha) {
    problemas.push({
      codigo: '1003',
      parametro: 'fecha',
      mensaje:
        'No se ha remitido el parámetro: fecha (El parámetro "fecha" es la fecha de expedición de la factura)',
    });
  } else if (!RE_FECHA.test(fecha)) {
    problemas.push({
      codigo: '2004',
      parametro: 'fecha',
      mensaje: 'La fecha de expedición tiene formato inválido y debe tener el formato DD-MM-AAAA',
    });
  }

  if (!importe) {
    problemas.push({
      codigo: '1004',
      parametro: 'importe',
      mensaje:
        'No se ha remitido el parámetro: importe (El parámetro "importe" es el importe total de la factura)',
    });
  } else if (!RE_IMPORTE.test(importe)) {
    const parteEntera = (importe.replace(/^[+-]/, '').split('.')[0] ?? '').length;
    const excedeLongitud = parteEntera > 12;

    problemas.push({
      codigo: excedeLongitud ? '2006' : '2005',
      parametro: 'importe',
      mensaje: excedeLongitud
        ? 'El importe excede el número máximo de caracteres'
        : 'El importe tiene un formato incorrecto',
    });
  }

  return problemas;
}

// ---------------------------------------------------------------------------------------------
// URL construction
// ---------------------------------------------------------------------------------------------

/**
 * Percent-encodes one parameter value.
 *
 * `encodeURIComponent` is correct here, and that is a measured fact rather than an assumption.
 * The cotejo service decodes `application/x-www-form-urlencoded`: a raw `+` comes out the other
 * side as a space. `encodeURIComponent('+')` is `'%2B'`, so the character survives; `' '`
 * becomes `'%20'`, which the service also decodes to a space; and `~ ! * ' ( )`, which
 * `encodeURIComponent` leaves alone, pass through unchanged.
 *
 * See `docs/spec-notes.md` §17 for the measurements.
 */
function encodeParam(value: string): string {
  return encodeURIComponent(value);
}

function assertSinProblemas(params: ParametrosQR): void {
  const problemas = validarParametrosQR(params);
  if (problemas.length === 0) return;

  const detalle = problemas.map((p) => `${p.codigo} (${p.parametro}): ${p.mensaje}`).join('\n  ');
  throw new Error(
    `Los parámetros del QR no son válidos y la AEAT los rechazaría:\n  ${detalle}\n` +
      'Corrígelos antes de imprimir la factura: el QR no lleva la huella, así que un error ' +
      'aquí solo se manifiesta como «Factura no encontrada» al cotejar.',
  );
}

/**
 * Builds the URL that goes **inside the QR code printed on the invoice**.
 *
 * Carries exactly the four mandatory parameters, in specification order. It deliberately does
 * not accept `formato`: «este parámetro nunca podrá incorporarse en la «URL» que va en el
 * código «QR» de la factura».
 *
 * @throws {Error} if the parameters would be rejected by the service.
 *
 * @example
 * ```ts
 * buildQrUrl(
 *   { nif: '89890001K', numserie: '12345678-G33', fecha: '01-09-2024', importe: '241.40' },
 *   { entorno: 'produccion', modo: 'verificable' },
 * );
 * // https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=89890001K&numserie=…
 * ```
 */
export function buildQrUrl(params: ParametrosQR, options: BuildQrUrlOptions): string {
  assertSinProblemas(params);

  const base = URL_BASE[options.modo][options.entorno];
  return (
    `${base}?nif=${encodeParam(params.nif)}` +
    `&numserie=${encodeParam(params.numserie)}` +
    `&fecha=${encodeParam(params.fecha)}` +
    `&importe=${encodeParam(params.importe)}`
  );
}

/**
 * Builds a URL for querying the cotejo service directly, optionally asking for JSON.
 *
 * This is the form to use when a receiving system checks an invoice it was sent — the case
 * art. 20.2 of the Orden contemplates for electronic invoices. **It is not the URL to print.**
 * Use {@link buildQrUrl} for that.
 */
export function buildCotejoUrl(params: ParametrosQR, options: BuildCotejoUrlOptions): string {
  let url = buildQrUrl(params, options);
  if (options.idioma) url += `&idioma=${encodeParam(options.idioma)}`;
  if (options.formato) url += `&formato=${encodeParam(options.formato)}`;
  return url;
}

// ---------------------------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------------------------

/** `resultado` values of the cotejo service, §9 of the QR specification. */
export const RESULTADO_COTEJO = {
  '00': 'Encontrada',
  '01': 'No encontrada',
  '02': 'No contrastable',
} as const;

/** Shape of the JSON answer, for callers that use `formato=json`. */
export interface RespuestaCotejo {
  readonly status: 'OK' | 'KO';
  readonly mensaje: string;
  readonly codigo_error?: string;
  readonly respuesta?: {
    readonly resultado: keyof typeof RESULTADO_COTEJO;
    readonly nif: string;
    readonly numserie: string;
    readonly fecha: string;
    readonly importe: string;
  };
}
