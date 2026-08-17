/**
 * Parsing of `RespuestaRegFactuSistemaFacturacion`.
 *
 * Audited field by field against `RespuestaSuministro.xsd` and `SuministroInformacion.xsd` on
 * 16/08/2026 (incógnita I-16, now closed). Five things the schema says and the written
 * documentation does not — they are why this module does not simply trust F4:
 *
 * - `CodigoErrorRegistro` is an **integer** with no facets, not «alfanumérico(5)» (D-9).
 * - `DescripcionErrorRegistro` allows 1500 characters here and 500 inside `RegistroDuplicado`:
 *   same element name, two limits (D-10).
 * - `TiempoEsperaEnvio` is a **string** with pattern `\d{0,4}`, so it can be empty (D-11).
 * - `EstadoRegistroDuplicado` uses feminine forms and a different value set from `EstadoRegistro`
 *   (D-12).
 * - The response carries **no `IdPeticion`** — only `IdPeticionRegistroDuplicado`, inside a block
 *   that appears only for duplicates (I-17).
 *
 * The `Cabecera` echoed back is the same `CabeceraType` that goes out, but declared inside
 * `RespuestaSuministro.xsd`, so it comes back as `sfR:Cabecera` — a third namespace for the same
 * type (docs/spec-notes.md §19.1).
 */

import { VerifactuXmlError } from './errors.js';
import {
  NS_RESPUESTA_SUMINISTRO,
  NS_SOAP_ENVELOPE,
  NS_SUMINISTRO_INFORMACION,
} from './namespaces.js';
import type { XmlElement } from './parser.js';
import { hijo, hijos, parsearXml, textoDeHijo } from './parser.js';

const sfR = NS_RESPUESTA_SUMINISTRO;
const sf = NS_SUMINISTRO_INFORMACION;

/** Overall state of the submission (list L18). */
export type EstadoEnvio = 'Correcto' | 'ParcialmenteCorrecto' | 'Incorrecto';

/**
 * State of one record (list L19).
 *
 * `AceptadoConErrores` **is stored by the AEAT**. Resending it creates a duplicate; it is not a
 * retryable failure (docs/spec-notes.md §8.6).
 */
export type EstadoRegistro = 'Correcto' | 'AceptadoConErrores' | 'Incorrecto';

/** State of a previously stored record that made this one a duplicate (list L21). */
export type EstadoRegistroDuplicado = 'Correcta' | 'AceptadaConErrores' | 'Anulada';

/** Who presented the submission, and when the AEAT recorded it. */
export interface DatosPresentacion {
  readonly NIFPresentador: string;
  /** `xs:dateTime`, exactly as received. */
  readonly TimestampPresentacion: string;
}

/** Identification of the invoice a response line refers to. */
export interface IDFacturaRespuesta {
  readonly IDEmisorFactura: string;
  readonly NumSerieFactura: string;
  readonly FechaExpedicionFactura: string;
}

/** `OperacionType`: which operation the line answers, and under what circumstances. */
export interface OperacionRespuesta {
  /** `Alta` or `Anulacion` (list L22). */
  readonly TipoOperacion: string;
  readonly Subsanacion?: string;
  readonly RechazoPrevio?: string;
  readonly SinRegistroPrevio?: string;
}

/** The record already stored that caused a duplicate rejection. */
export interface RegistroDuplicado {
  readonly IdPeticionRegistroDuplicado: string;
  readonly EstadoRegistroDuplicado: EstadoRegistroDuplicado;
  /** Integer, as a string: see D-9. */
  readonly CodigoErrorRegistro?: string;
  readonly DescripcionErrorRegistro?: string;
}

/** One `RespuestaLinea`. */
export interface RespuestaLinea {
  readonly IDFactura: IDFacturaRespuesta;
  readonly Operacion: OperacionRespuesta;
  readonly RefExterna?: string;
  readonly EstadoRegistro: EstadoRegistro;
  /**
   * Error code, kept as the literal string received.
   *
   * The schema types it as `integer` with no facets (D-9), so it is neither five characters nor
   * necessarily zero-padded. Parsing it to a number would lose whatever padding the AEAT used;
   * `Number(codigo)` is available to whoever wants it.
   */
  readonly CodigoErrorRegistro?: string;
  readonly DescripcionErrorRegistro?: string;
  readonly RegistroDuplicado?: RegistroDuplicado;
}

/** A parsed `RespuestaRegFactuSistemaFacturacion`. */
export interface RespuestaRemision {
  /** Secure verification code. Only present when the submission was not rejected outright. */
  readonly CSV?: string;
  readonly DatosPresentacion?: DatosPresentacion;
  /** The header that was sent, echoed back. */
  readonly ObligadoEmision: { readonly NombreRazon: string; readonly NIF: string };
  /**
   * Seconds to wait before the next submission.
   *
   * A **string**, because the schema says `\d{0,4}` on a string type and therefore admits the
   * empty one (D-11). `undefined` here means "the element was empty", not "zero".
   */
  readonly TiempoEsperaEnvio?: string;
  readonly EstadoEnvio: EstadoEnvio;
  readonly RespuestaLinea: readonly RespuestaLinea[];
}

function inesperada(mensaje: string, accionSugerida: string): VerifactuXmlError {
  return new VerifactuXmlError({
    code: 'RESPUESTA_INESPERADA',
    message: mensaje,
    causaProbable:
      'El documento es XML bien formado pero no tiene la forma que declara ' +
      'RespuestaSuministro.xsd.',
    accionSugerida,
    referencia: 'docs/spec-notes.md §8.6 y §19',
  });
}

/** Requires a child element's text, failing with a pointed message when it is missing. */
function exigir(elemento: XmlElement, ns: string, nombre: string): string {
  const valor = textoDeHijo(elemento, ns, nombre);
  if (valor === undefined) {
    throw inesperada(
      `Falta el elemento «${nombre}» dentro de «${elemento.nombre}».`,
      'El esquema lo declara obligatorio. Guarda la respuesta completa y compárala con ' +
        'RespuestaSuministro.xsd antes de dar por buena la lectura.',
    );
  }
  return valor;
}

/** Drops an optional value when the element was absent **or** carried no text. */
function opcional(elemento: XmlElement, ns: string, nombre: string): string | undefined {
  const valor = textoDeHijo(elemento, ns, nombre);
  return valor === undefined || valor === '' ? undefined : valor;
}

/** Adds a key only when there is something to add, so `exactOptionalPropertyTypes` stays happy. */
function conOpcional<T extends object>(base: T, clave: string, valor: string | undefined): T {
  return valor === undefined ? base : { ...base, [clave]: valor };
}

function leerOperacion(elemento: XmlElement): OperacionRespuesta {
  let operacion: OperacionRespuesta = { TipoOperacion: exigir(elemento, sf, 'TipoOperacion') };
  operacion = conOpcional(operacion, 'Subsanacion', opcional(elemento, sf, 'Subsanacion'));
  operacion = conOpcional(operacion, 'RechazoPrevio', opcional(elemento, sf, 'RechazoPrevio'));
  return conOpcional(operacion, 'SinRegistroPrevio', opcional(elemento, sf, 'SinRegistroPrevio'));
}

function leerDuplicado(elemento: XmlElement): RegistroDuplicado {
  let duplicado: RegistroDuplicado = {
    IdPeticionRegistroDuplicado: exigir(elemento, sf, 'IdPeticionRegistroDuplicado'),
    EstadoRegistroDuplicado: exigir(
      elemento,
      sf,
      'EstadoRegistroDuplicado',
    ) as EstadoRegistroDuplicado,
  };
  duplicado = conOpcional(
    duplicado,
    'CodigoErrorRegistro',
    opcional(elemento, sf, 'CodigoErrorRegistro'),
  );
  return conOpcional(
    duplicado,
    'DescripcionErrorRegistro',
    opcional(elemento, sf, 'DescripcionErrorRegistro'),
  );
}

function leerLinea(elemento: XmlElement): RespuestaLinea {
  const idFactura = hijo(elemento, sfR, 'IDFactura');
  const operacion = hijo(elemento, sfR, 'Operacion');
  if (idFactura === undefined || operacion === undefined) {
    throw inesperada(
      'Una RespuestaLinea no trae IDFactura u Operacion.',
      'Ambos son obligatorios en el esquema. Revisa si la respuesta viene truncada.',
    );
  }

  let linea: RespuestaLinea = {
    IDFactura: {
      IDEmisorFactura: exigir(idFactura, sf, 'IDEmisorFactura'),
      NumSerieFactura: exigir(idFactura, sf, 'NumSerieFactura'),
      FechaExpedicionFactura: exigir(idFactura, sf, 'FechaExpedicionFactura'),
    },
    Operacion: leerOperacion(operacion),
    EstadoRegistro: exigir(elemento, sfR, 'EstadoRegistro') as EstadoRegistro,
  };

  linea = conOpcional(linea, 'RefExterna', opcional(elemento, sfR, 'RefExterna'));
  linea = conOpcional(linea, 'CodigoErrorRegistro', opcional(elemento, sfR, 'CodigoErrorRegistro'));
  linea = conOpcional(
    linea,
    'DescripcionErrorRegistro',
    opcional(elemento, sfR, 'DescripcionErrorRegistro'),
  );

  const duplicado = hijo(elemento, sfR, 'RegistroDuplicado');
  return duplicado === undefined
    ? linea
    : { ...linea, RegistroDuplicado: leerDuplicado(duplicado) };
}

/**
 * Finds the response element, whether it arrives bare or inside a SOAP envelope.
 *
 * A SOAP fault is reported as such rather than as a missing element: a fault is the single most
 * likely thing to come back, and "falta EstadoEnvio" would be a terrible way to learn about it.
 */
function localizarRespuesta(raiz: XmlElement): XmlElement {
  if (raiz.ns === sfR && raiz.nombre === 'RespuestaRegFactuSistemaFacturacion') return raiz;

  if (raiz.ns === NS_SOAP_ENVELOPE && raiz.nombre === 'Envelope') {
    const cuerpo = hijo(raiz, NS_SOAP_ENVELOPE, 'Body');
    const fault = cuerpo === undefined ? undefined : hijo(cuerpo, NS_SOAP_ENVELOPE, 'Fault');

    if (fault !== undefined) {
      const codigo = textoDeHijo(fault, '', 'faultcode') ?? '(sin faultcode)';
      const motivo = textoDeHijo(fault, '', 'faultstring') ?? '(sin faultstring)';
      throw inesperada(
        `El servicio ha devuelto un SOAP Fault: ${codigo} — ${motivo}`,
        'No es un problema de formato del lote. Suele ser el certificado, el endpoint o una ' +
          'incidencia del servicio. Reintentar el mismo envío sin cambiar nada repetirá el fallo.',
      );
    }

    const respuesta =
      cuerpo === undefined ? undefined : hijo(cuerpo, sfR, 'RespuestaRegFactuSistemaFacturacion');
    if (respuesta !== undefined) return respuesta;
  }

  throw inesperada(
    `La raíz del documento es «${raiz.nombre}» y se esperaba RespuestaRegFactuSistemaFacturacion.`,
    'Comprueba que estás pasando el cuerpo de la respuesta y no, por ejemplo, una página de ' +
      'error HTML servida con código 200.',
  );
}

/**
 * Parses a response, with or without its SOAP envelope.
 *
 * @throws {VerifactuXmlError} `XML_MAL_FORMADO` if it is not XML; `RESPUESTA_INESPERADA` if it is
 *   XML but not this response — including when it is a SOAP Fault, which is reported with the
 *   fault's own code and reason.
 */
export function parsearRespuesta(xml: string): RespuestaRemision {
  const respuesta = localizarRespuesta(parsearXml(xml));

  // Declared inside RespuestaSuministro.xsd, so it comes back in *that* namespace even though its
  // type is the one we sent (docs/spec-notes.md §19.1).
  const cabecera = hijo(respuesta, sfR, 'Cabecera');
  const obligado = cabecera === undefined ? undefined : hijo(cabecera, sf, 'ObligadoEmision');
  if (obligado === undefined) {
    throw inesperada(
      'La respuesta no trae Cabecera/ObligadoEmision.',
      'El esquema declara la cabecera obligatoria: la AEAT devuelve la que se le envió.',
    );
  }

  let resultado: RespuestaRemision = {
    ObligadoEmision: {
      NombreRazon: exigir(obligado, sf, 'NombreRazon'),
      NIF: exigir(obligado, sf, 'NIF'),
    },
    EstadoEnvio: exigir(respuesta, sfR, 'EstadoEnvio') as EstadoEnvio,
    RespuestaLinea: hijos(respuesta, sfR, 'RespuestaLinea').map(leerLinea),
  };

  resultado = conOpcional(resultado, 'CSV', opcional(respuesta, sfR, 'CSV'));
  resultado = conOpcional(
    resultado,
    'TiempoEsperaEnvio',
    opcional(respuesta, sfR, 'TiempoEsperaEnvio'),
  );

  const presentacion = hijo(respuesta, sfR, 'DatosPresentacion');
  return presentacion === undefined
    ? resultado
    : {
        ...resultado,
        DatosPresentacion: {
          NIFPresentador: exigir(presentacion, sf, 'NIFPresentador'),
          TimestampPresentacion: exigir(presentacion, sf, 'TimestampPresentacion'),
        },
      };
}
