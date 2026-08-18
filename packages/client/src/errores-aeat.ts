/**
 * Turns an AEAT error code into something you can act on.
 *
 * `CodigoErrorRegistro` llega como un número de cuatro cifras y nada más. La tabla oficial
 * (`codigos-aeat.ts`, generada) le pone el texto y la categoría; este fichero le pone lo único
 * que la AEAT no dice y es lo que de verdad hace falta saber: **qué hago ahora**.
 *
 * ## La pregunta que contesta la categoría
 *
 * No es «qué he hecho mal». Es **¿quedó el registro almacenado?**, porque de eso depende todo lo
 * demás:
 *
 * | Categoría | ¿Almacenado? | Qué procede |
 * |---|:--:|---|
 * | `envio` | no | Se corrige el lote entero y se reenvía. La cadena no ha avanzado |
 * | `registro` | no | Se corrige ese registro y se reenvía con la misma huella anterior |
 * | `aceptado` | **sí** | **No se reenvía.** Se corrige con un registro de subsanación |
 *
 * Confundir la tercera fila con las otras dos es el error caro: reenviar un registro que la AEAT
 * ya almacenó produce un duplicado (código 3000), y el original sigue mal.
 *
 * ## Reintentar
 *
 * Ninguno de estos códigos es un fallo de red. Llegan en una respuesta HTTP 200 bien formada, y
 * volver a mandar lo mismo da exactamente lo mismo. La única excepción son los fallos técnicos
 * del lado de la AEAT, marcados con {@link ExplicacionCodigo.reenviable}. El backoff automático
 * es para la ausencia de respuesta y para los 5xx, no para esto.
 */

import type { CategoriaError, CodigoAeat } from './codigos-aeat.js';
import { CODIGOS_AEAT } from './codigos-aeat.js';

export type { CategoriaError, CodigoAeat } from './codigos-aeat.js';
export { CODIGOS_AEAT, FUENTE_CODIGOS } from './codigos-aeat.js';

/** An AEAT code, with what it means and what to do about it. */
export interface ExplicacionCodigo extends CodigoAeat {
  /**
   * Whether the record ended up stored in the AEAT's systems.
   *
   * Es la consecuencia práctica de {@link CodigoAeat.categoria} y se expone aparte porque es la
   * condición que hay que ramificar: si es `true`, reenviar está mal.
   */
  readonly almacenado: boolean;
  /** Qué hacer, en castellano. Esto es nuestro, no de la AEAT. */
  readonly accion: string;
  /**
   * Whether re-sending the identical payload could ever succeed.
   *
   * `true` solo en los fallos técnicos de la AEAT (base de datos, gestor de tablas, obtención del
   * certificado). En un error de datos siempre es `false`: reenviar lo mismo da lo mismo.
   */
  readonly reenviable: boolean;
}

/** Lo que procede cuando el código no dice nada más específico. */
const POR_CATEGORIA: Readonly<Record<CategoriaError, string>> = {
  envio:
    'La AEAT ha rechazado el envío completo: no se ha registrado ninguna factura del lote y la ' +
    'cadena no ha avanzado. Corrige lo que señala el mensaje y reenvía el mismo lote.',
  registro:
    'La AEAT ha rechazado este registro: no se ha almacenado y la cadena no ha avanzado. Corrige ' +
    'el registro y reenvíalo encadenado a la misma huella anterior que llevaba.',
  aceptado:
    'El registro SÍ ha quedado almacenado y cuenta a efectos del RD 1007/2023. No lo reenvíes: ' +
    'se corrige enviando un registro de subsanación (Subsanacion = "S"), no un alta nueva.',
};

/**
 * Codes that are the AEAT's own machinery failing, not your data.
 *
 * Son los únicos donde reenviar lo mismo más tarde tiene sentido. Se listan uno a uno en vez de
 * detectarlos por la palabra «técnico» del mensaje: una tabla que cambia de significado porque la
 * AEAT reescriba una frase no sirve para decidir si se reenvía una factura.
 */
const TECNICOS: ReadonlySet<string> = new Set([
  '1129',
  '1241',
  '1243',
  '1256',
  '1288',
  '3500',
  '3501',
  '4103',
  '4108',
  '4110',
  '4111',
  '4118',
  '4128',
]);

const ACCION_TECNICA =
  'Fallo del lado de la AEAT, no de tus datos. Es de los pocos casos en que reenviar el mismo ' +
  'lote sin tocar nada puede funcionar: espera y vuelve a intentarlo. Si persiste, es una ' +
  'incidencia del servicio y no hay nada que corregir en el registro.';

/**
 * Actions for the codes where the generic one is not enough.
 *
 * No están los 247. Están los que aparecen de verdad al integrar, los que se confunden entre sí,
 * y aquellos en los que la acción correcta no se deduce del mensaje oficial. Para el resto, la
 * acción por categoría dice lo único que se puede decir con honestidad, que es si el registro
 * quedó almacenado y si hay que reenviar.
 */
const ACCIONES: Readonly<Record<string, string>> = {
  // ── Cabecera y certificado ──────────────────────────────────────────────────────────────────
  '4102':
    'El XML no cumple el esquema. Esto no debería llegar a la AEAT: valida contra los XSD con ' +
    '`validarContraXsd` de @verifactu-js/xml antes de enviar y mira qué campo falta.',
  '4104':
    'La AEAT no reconoce el NIF de ObligadoEmision. Comprueba que NIF y NombreRazon son los ' +
    'reales del obligado y que se corresponden entre sí: el censo valida la pareja, no el NIF ' +
    'suelto, y un nombre que no cuadra da este mismo error. Distinto de 4107, que es el NIF que ' +
    'presenta el certificado.',
  '4107':
    'El NIF no consta en el censo de la AEAT. Si el envío es en preproducción, recuerda que el ' +
    'NIF de ejemplo de la documentación (89890001K) no sirve: F4 §4.1 obliga a validar todos los ' +
    'NIF contra la base de datos centralizada, también en pruebas.',
  '4109': 'El NIF está mal formado (letra de control, longitud o formato). No llega ni al censo.',
  '4112':
    'El certificado es válido, pero su titular no está habilitado para ese ObligadoEmision. Con ' +
    'certificado de persona física solo puedes enviar por ti mismo; para enviar por un tercero ' +
    'hace falta apoderamiento, colaboración social o sucesión dados de alta en la Sede.',
  '4113':
    'Has superado el límite de registros del bloque. El máximo son 1000 RegistroFactura por ' +
    'envío, contando altas y anulaciones juntas. Parte el lote.',
  '4114':
    'Has superado el máximo de facturas a registrar. Mismo remedio que 4113: menos registros por ' +
    'envío.',
  '4119':
    'Hay caracteres que no están en UTF-8. El sobre debe ir en UTF-8 de principio a fin; ' +
    '@verifactu-js/xml siempre lo emite así, de modo que esto suele venir de un dato inyectado ' +
    'después de serializar o de un transporte que recodifica.',
  '4120':
    'FechaFinVeriFactu solo admite 31-12-20XX del año actual o el anterior. No es una fecha ' +
    'libre.',
  '4125': 'Si contestas a un requerimiento, RefRequerimiento es obligatorio en la cabecera.',
  '4126':
    'RefRequerimiento solo vale en el endpoint de contestación a requerimientos. Estás enviando ' +
    'un bloque de requerimiento al servicio equivocado: o quitas el bloque, o cambias de URL.',
  '4127':
    'RemisionVoluntaria solo vale para sistemas VERI*FACTU. Si el sistema no lo es, ese bloque ' +
    'sobra.',
  '4135':
    'Esa URL no admite GET. El servicio es SOAP sobre POST; un GET suele significar que has ' +
    'puesto la URL del WSDL o del XSD donde va la del endpoint.',
  '4138': 'La petición ha llegado vacía o mal codificada. Revisa el cuerpo y el Content-Type.',
  '4139': 'El servicio no está habilitado en producción. Comprueba el entorno y el calendario.',
  '4141':
    'Tu acceso a VERI*FACTU está suspendido temporalmente. NO reintentes: no se arregla ' +
    'reenviando. Escribe a verifactu@correo.aeat.es, que es lo que indica el propio mensaje.',

  // ── Registro: caracteres, fechas, encadenamiento ────────────────────────────────────────────
  '1104':
    'NumSerieFactura no es válido. Revisa longitud (máx. 60) y caracteres: ver también 1130 y ' +
    '1287.',
  '1108':
    'El NIF de IDEmisorFactura tiene que ser el mismo que el de ObligadoEmision. Si facturas por ' +
    'un tercero, lo que cambia es la cabecera, no el emisor de la factura.',
  '1130':
    'NumSerieFactura tiene caracteres no permitidos. La lista concreta la da el código 1287: ' +
    '< > " \' y =. El & sí está permitido, y viaja sin escapar a la huella.',
  '1145': 'Fecha mal formada. En los campos de fecha el formato es dd-mm-aaaa, con guiones.',
  '1174': 'La FechaExpedicionFactura del bloque RegistroAnterior no cuadra. Revisa el eslabón.',
  '1175': 'El NumSerieFactura del bloque RegistroAnterior no cuadra. Revisa el eslabón.',
  '1180':
    'Error en el bloque Encadenamiento. O falta PrimerRegistro, o falta RegistroAnterior, o van ' +
    'los dos: son excluyentes y exactamente uno tiene que estar.',
  '1210':
    'ImporteTotal no cuadra con la suma de BaseImponibleOimporteNoSujeto, CuotaRepercutida y ' +
    'CuotaRecargoEquivalencia. @verifactu-js/validation lo comprueba antes de enviar, con el ' +
    'margen de ±10,00 € que admite F3.',
  '1216':
    'CuotaTotal no cuadra con la suma de CuotaRepercutida y CuotaRecargoEquivalencia. Mismo ' +
    'comentario que 1210.',
  '1244':
    'FechaHoraHusoGenRegistro tiene el formato mal. Debe ser un xs:dateTime con huso explícito, ' +
    'de la forma aaaa-mm-ddThh:mm:ss±hh:mm.',
  '1262': 'La huella no mide lo que debe: SHA-256 en hexadecimal, 64 caracteres en mayúsculas.',
  '1268':
    'La longitud de FechaHoraHusoGenRegistro no cumple. Es distinto de 1244: aquí lo que sobra o ' +
    'falta son caracteres, típicamente fracciones de segundo o un offset escrito de otra forma.',
  '1269': 'El bloque RegistroAnterior está incompleto. Van los cuatro campos o no va el bloque.',
  '1287':
    'Un campo lleva caracteres prohibidos. La AEAT sustituye %s por el nombre del campo, así que ' +
    'el mensaje te dice cuál. La lista es literalmente < > " \' y =. El & no está en ella.',
  '1291': 'La huella del registro anterior tiene que ser alfanumérica: hexadecimal en mayúsculas.',
  '1292': 'La huella tiene que ser alfanumérica: hexadecimal en mayúsculas, 64 caracteres.',

  // ── Estado del registro ─────────────────────────────────────────────────────────────────────
  '3000':
    'Ese registro ya estaba dado de alta. No lo reenvíes: la factura ya consta. Suele ser un ' +
    'reintento después de una respuesta que se perdió — la primera sí llegó.',
  '3001': 'Ya estaba anulado. La anulación anterior sigue siendo válida; no hay nada que rehacer.',
  '3002':
    'No existe el registro que intentas anular. Si de verdad no se llegó a dar de alta, la ' +
    'anulación va con SinRegistroPrevio = "S".',
  '3003': 'El presentador no tiene permisos sobre ese registro. Mismo asunto que 4112.',

  // ── Aceptado con errores: el registro quedó almacenado ──────────────────────────────────────
  '2000':
    'La AEAT ha calculado una huella distinta de la tuya. El registro queda almacenado, pero la ' +
    'cadena no vale: hay que subsanarlo. Es el síntoma de un desacuerdo sobre la cadena canónica ' +
    '— campo de más o de menos, orden distinto, o un valor normalizado por un lado y no por el ' +
    'otro. Compara la cadena que generas con F1 §3 campo a campo antes de tocar nada más.',
  '2001':
    'El NIF del destinatario no consta en el censo. El registro se almacena igual, pero hay que ' +
    'subsanarlo. Revisa el NIF del cliente; si es extranjero, va por IDOtro y no por NIF.',
  '2002': 'La huella del registro anterior no mide 64 caracteres. Se subsana.',
  '2003': 'La huella del registro anterior no tiene el contenido esperado. Se subsana.',
  '2004':
    'FechaHoraHusoGenRegistro se aparta demasiado de la hora del sistema de la AEAT. El mensaje ' +
    'oficial termina en dos puntos porque la AEAT interpola ahí el margen que aplica en ese ' +
    'momento: léelo en DescripcionErrorRegistro, no lo supongas. Causa habitual: un registro que ' +
    'se generó hace rato y se ha quedado esperando en una cola.',
  '2005':
    'ImporteTotal no cuadra, pero el registro se ha almacenado. Se subsana. ' +
    '@verifactu-js/validation lo detecta antes de enviar.',
  '2006':
    'CuotaTotal no cuadra, pero el registro se ha almacenado. Se subsana. ' +
    '@verifactu-js/validation lo detecta antes de enviar.',
  '2007':
    'Has marcado PrimerRegistro = "S" y la AEAT ya tiene facturas de ese obligado con ese mismo ' +
    'sistema informático. Solo el primero de la cadena lleva esa marca; a partir de ahí va ' +
    'RegistroAnterior. Si de verdad empiezas una cadena nueva, lo que cambia es el sistema ' +
    'informático (IdSistemaInformatico o NumeroInstalacion), no la marca.',
  '2008':
    'La huella del registro anterior es igual que la del actual, y eso es imposible en una cadena ' +
    'bien formada. Casi siempre es haber encadenado un registro consigo mismo.',
};

/**
 * Explains an AEAT error code.
 *
 * @param codigo - `CodigoErrorRegistro` de la respuesta. Se aceptan `null` y `undefined` porque
 *   el XSD declara el campo opcional y una respuesta correcta no lo trae.
 * @returns La explicación, o `undefined` si el código no está en la tabla — que es lo que pasa
 *   cuando la AEAT añade uno. Devolver `undefined` y no un texto inventado es deliberado: quien
 *   llama tiene entonces `DescripcionErrorRegistro`, que sigue siendo la fuente autorizada.
 *
 * @example
 * ```ts
 * const e = explicarCodigo(linea.CodigoErrorRegistro);
 * if (e?.almacenado) console.log('La factura consta. Hay que subsanarla:', e.accion);
 * ```
 */
export function explicarCodigo(codigo: string | null | undefined): ExplicacionCodigo | undefined {
  if (codigo === null || codigo === undefined) return undefined;

  const fila = CODIGOS_AEAT[codigo];
  if (fila === undefined) return undefined;

  const reenviable = TECNICOS.has(codigo);

  return {
    ...fila,
    almacenado: fila.categoria === 'aceptado',
    reenviable,
    accion: ACCIONES[codigo] ?? (reenviable ? ACCION_TECNICA : POR_CATEGORIA[fila.categoria]),
  };
}
