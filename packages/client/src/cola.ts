/**
 * La cola de envío.
 *
 * El contrato que implementa está en `docs/diseno-cola-3d.md`, escrito **antes** que este fichero
 * y con la medición de la que sale cada restricción.
 */

import type {
  AltaRequest,
  AnulacionRequest,
  Eslabon,
  EslabonCanonico,
  SifChain,
} from '@verifactu-js/core';
import type { Cabecera, DatosAlta, DatosAnulacion } from '@verifactu-js/validation';
import type { RegistroFactura, RespuestaRemision } from '@verifactu-js/xml';

import type { Cliente, ResultadoEnvio } from './cliente.js';
import { explicarCodigo } from './errores-aeat.js';
import { VerifactuClientError } from './errors.js';
import {
  type DesfaseReloj,
  desfaseDeReloj,
  MARGEN_RELOJ_AEAT_SEGUNDOS,
  TIEMPO_ESPERA_ENVIO_INICIAL_SEGUNDOS,
} from './medido.js';

/** `TiempoEsperaEnvio` es `\d{0,4}` en el XSD: cuatro dígitos, luego 9999 s es el techo. */
const MAX_ESPERA_SEGUNDOS = 9999;

/**
 * Qué espera aplicar después de una respuesta (R-4).
 *
 * `TiempoEsperaEnvio` es `\d{0,4}` en el XSD, así que **puede venir vacío**, y una cadena vacía no
 * es cero: es «no hay dato». Convertirla con `Number('')` da `0` y convierte la cola en un fuzzer
 * contra la AEAT.
 */
export function esperaTrasRespuesta(
  respuesta: Pick<RespuestaRemision, 'TiempoEsperaEnvio'>,
  actual: number,
): number {
  const bruto = respuesta.TiempoEsperaEnvio;
  if (bruto === undefined || bruto.trim() === '') return actual;

  const segundos = Number(bruto);
  // Fuera del dominio del XSD no hay lectura buena: un negativo no es una espera y un valor por
  // encima del máximo no lo puede haber escrito el servicio. Quedarse con lo que ya se tenía es
  // lo único conservador; tomarlo al pie de la letra sería acelerar por un dato corrupto.
  if (!Number.isInteger(segundos) || segundos < 0 || segundos > MAX_ESPERA_SEGUNDOS) return actual;

  return segundos;
}

/** Lo que ha impedido que el envío saliera bien, en la forma en que se puede razonar sobre ello. */
export type Incidencia =
  /** No llegó respuesta: DNS, TLS, timeout, conexión cortada. */
  | { readonly tipo: 'sin-respuesta' }
  /** Llegó una respuesta HTTP que no era una respuesta de VERI*FACTU. */
  | { readonly tipo: 'http'; readonly estado: number }
  /** Llegó un código de la AEAT, sea en `RespuestaLinea` o en un SOAP Fault. */
  | { readonly tipo: 'codigo'; readonly codigo: string };

/** Si reintentar el mismo lote sin tocarlo puede terminar bien, y por qué. */
export interface DecisionReintento {
  readonly reintentar: boolean;
  /** En castellano, para poder registrarlo tal cual en un log. */
  readonly motivo: string;
}

/**
 * Si procede reintentar **el mismo lote sin tocar nada** (R-5).
 *
 * La pregunta no es «¿ha fallado?» sino **«¿puede el mismo lote terminar bien?»**. Casi nunca:
 * los errores de la AEAT llegan en un HTTP 200 bien formado y volver a mandar lo mismo da lo
 * mismo. Reintentar de verdad solo tiene sentido cuando el envío **no llegó a registrarse**, o
 * cuando el fallo es del servicio y no del contenido.
 *
 * Y un reintento no sale gratis: cada espera consume ventana contra los 240 s de R-3.
 */
export function procedeReintentar(incidencia: Incidencia): DecisionReintento {
  if (incidencia.tipo === 'sin-respuesta') {
    return {
      reintentar: true,
      motivo:
        'No llegó respuesta, así que el envío no consta como registrado y el lote sigue siendo ' +
        'válido tal cual. Es el único caso en que reintentar es claramente correcto.',
    };
  }

  if (incidencia.tipo === 'http') {
    if (incidencia.estado >= 500) {
      return {
        reintentar: true,
        motivo: `HTTP ${incidencia.estado}: el fallo es del servicio, no del lote.`,
      };
    }
    return {
      reintentar: false,
      motivo:
        `HTTP ${incidencia.estado}. No es un fallo transitorio del servicio: reenviar lo mismo ` +
        'daría lo mismo. Con certificado cliente, un 401 o un 403 casi siempre es el certificado.',
    };
  }

  const explicacion = explicarCodigo(incidencia.codigo);

  if (explicacion === undefined) {
    return {
      reintentar: false,
      motivo:
        `El código ${incidencia.codigo} no está en la tabla de la AEAT que tenemos. Sin saber si ` +
        'el registro quedó almacenado, reintentar puede duplicarlo: no se reintenta a ciegas.',
    };
  }

  if (explicacion.almacenado) {
    return {
      reintentar: false,
      motivo:
        `El código ${incidencia.codigo} es «${explicacion.categoria}»: el registro YA está ` +
        'almacenado y cuenta a efectos del RD 1007/2023. Reenviarlo lo duplicaría. Se subsana.',
    };
  }

  if (explicacion.reenviable) {
    return {
      reintentar: true,
      motivo:
        `El código ${incidencia.codigo} es un fallo técnico del lado de la AEAT, no de tus ` +
        'datos. Es de los pocos en que el mismo lote sin tocar puede terminar bien.',
    };
  }

  return {
    reintentar: false,
    motivo:
      `El código ${incidencia.codigo} es un error de datos: «${explicacion.texto}». Hay que ` +
      'corregir el registro, y eso ya no es un reintento sino un envío distinto.',
  };
}

/** `maxOccurs="1000"` sobre `RegistroFactura`, y la AEAT lo valida también en destino (R-6). */
const MAX_REGISTROS_POR_ENVIO = 1000;

/** Un alta esperando su turno: datos de factura, **sin** eslabón. */
export interface AltaEnCola {
  readonly tipo: 'alta';
  /** Los seis campos que entran en la huella. `previous` no está, y es a propósito (R-1). */
  readonly factura: Omit<AltaRequest, 'previous'>;
  /** Todo lo que va al XML y no entra en la huella. */
  readonly datos: DatosAlta;
}

/** Una anulación esperando su turno. */
export interface AnulacionEnCola {
  readonly tipo: 'anulacion';
  readonly factura: Omit<AnulacionRequest, 'previous'>;
  readonly datos: DatosAnulacion;
}

/** Lo que se encola. Nunca un eslabón. */
export type EntradaCola = AltaEnCola | AnulacionEnCola;

/** Cómo se comporta la cola. */
export interface ConfiguracionCola {
  readonly cliente: Cliente;
  /** La cadena, con su zona horaria y su reloj. El sello sale de aquí, en el momento del envío. */
  readonly cadena: SifChain;
  readonly cabecera: Cabecera;
  /** El último eslabón que la AEAT aceptó de verdad, si la cadena viene de antes. */
  readonly ultimoEslabon?: Eslabon | null;
  /** Registros por envío. Entre 1 y 1000 (R-6). Por defecto, 1000. */
  readonly tamanoLote?: number;
  /** Cómo dormir. Inyectable para que una suite no tarde minutos en probar la espera. */
  readonly esperar?: (ms: number) => Promise<void>;
  /** Reloj local, para medir la antigüedad del sello. Por defecto, `Date`. */
  readonly ahora?: () => Date;
  /**
   * Cuántas veces reintentar un lote que no llegó a registrarse. Por defecto, 3.
   *
   * El techo de verdad no es este número sino {@link ConfiguracionCola.margenSegundos}: cada
   * espera consume ventana, y con 60 s de espera cuatro reintentos agotan los 240 s.
   */
  readonly reintentos?: number;
  /** Antigüedad máxima del sello al enviar. Por defecto, los 240 s medidos. */
  readonly margenSegundos?: number;
}

/** Un envío que llegó a salir, con lo que costó. */
export interface EnvioRealizado {
  readonly resultado: ResultadoEnvio;
  /** Cuántos registros llevaba. */
  readonly registros: number;
  /** Cuántos intentos costó llegar a tener respuesta. `1` cuando salió a la primera. */
  readonly intentos: number;
  /**
   * Segundos que llevaba encima el sello cuando la AEAT lo recibió.
   *
   * Es cuánta ventana de los 240 s se había gastado ya. Con un envío limpio son 0; sube con cada
   * reintento, porque el lote **no se vuelve a sellar** (R-1 y R-5).
   */
  readonly antiguedadSelloSegundos: number;
  /**
   * Cómo iba el reloj de esta máquina respecto al de la AEAT, si la respuesta trajo su hora.
   *
   * Sale gratis: `DatosPresentacion.TimestampPresentacion` viene en cada respuesta aceptada, así
   * que comprobar el reloj no cuesta ni un registro extra. `undefined` cuando la respuesta no lo
   * trajo, que no es lo mismo que «va bien».
   */
  readonly desfaseReloj?: DesfaseReloj;
}

/** Por qué se dejó de enviar antes de vaciar la cola. */
export type MotivoParada =
  /** La AEAT rechazó el envío completo. No se registró nada y la cadena no avanzó. */
  | 'ENVIO_RECHAZADO'
  /** Un registro del lote volvió `Incorrecto`. Los de detrás cuelgan de una huella que no existe. */
  | 'REGISTRO_RECHAZADO'
  /** No llegó respuesta y ya no procede insistir. */
  | 'SIN_RESPUESTA'
  /** Llegó algo que no era una respuesta de VERI*FACTU. */
  | 'ERROR_HTTP'
  /** El sello del lote se saldría del margen: enviarlo ahora es pedir un 2004. */
  | 'SELLO_CADUCADO';

/** Dónde y por qué se paró. */
export interface Parada {
  readonly motivo: MotivoParada;
  /** En castellano, listo para un log o para enseñárselo a quien opere el sistema. */
  readonly explicacion: string;
  /** El código de la AEAT, cuando lo hubo. Pásalo por `explicarCodigo()`. */
  readonly codigo?: string;
}

/** Lo que pasó al procesar. */
export interface ResultadoCola {
  readonly envios: readonly EnvioRealizado[];
  /** Registros que la AEAT dio por almacenados, sean `Correcto` o `AceptadoConErrores`. */
  readonly aceptados: number;
  /** Los que siguen en la cola al terminar. */
  readonly pendientes: number;
  /** El último eslabón que la AEAT aceptó. Es el que hay que guardar. */
  readonly ultimoEslabon: Eslabon | null;
  /** Por qué se paró antes de tiempo, o `null` si se vació la cola. */
  readonly parada: Parada | null;
  /**
   * Lo que hay que mirar aunque todo haya salido «bien».
   *
   * Aquí acaba el desfase de reloj: no rompe nada en el momento y estropea todos los registros
   * que se generen después.
   */
  readonly avisos: readonly string[];
}

/** Una cola atada a **una** cadena. */
export interface Cola {
  /**
   * Añade facturas al final. Devuelve cuántas quedan pendientes.
   *
   * @throws {VerifactuClientError} `ESLABON_EN_LA_COLA` si la entrada trae un eslabón ya firmado.
   */
  encolar(...entradas: readonly EntradaCola[]): number;
  readonly pendientes: number;
  readonly ultimoEslabon: Eslabon | null;
  /** Los segundos que la AEAT pidió esperar en su última respuesta. */
  readonly esperaSegundos: number;
  /**
   * Envía lo que haya, en lotes y en orden, respetando la espera.
   *
   * @throws {VerifactuClientError} `COLA_EN_CURSO` si ya hay un `procesar()` en marcha.
   */
  procesar(): Promise<ResultadoCola>;
}

/** Traduce lo que levantó el cliente a algo sobre lo que R-5 sepa decidir. */
function incidenciaDe(error: unknown): Incidencia {
  const codigo = (error as { codigoAeat?: unknown } | null)?.codigoAeat;
  if (typeof codigo === 'string') return { tipo: 'codigo', codigo };

  const estado = (error as { estado?: unknown } | null)?.estado;
  if (typeof estado === 'number') return { tipo: 'http', estado };

  return { tipo: 'sin-respuesta' };
}

/** Los estados en que la AEAT **ha almacenado** el registro y la cadena avanza. */
function almacenado(estado: string): boolean {
  return estado === 'Correcto' || estado === 'AceptadoConErrores';
}

/**
 * Crea una cola sobre una cadena.
 *
 * No guarda nada en disco ni elige almacenamiento: al terminar devuelve el último eslabón
 * aceptado y lo que quedó pendiente, y dónde vivan eso es de quien la usa
 * (VERIFACTU-BRIEF.md §2, principio 1).
 */
export function crearCola(configuracion: ConfiguracionCola): Cola {
  const {
    cliente,
    cadena,
    cabecera,
    tamanoLote = MAX_REGISTROS_POR_ENVIO,
    esperar = (ms: number) => new Promise<void>((listo) => setTimeout(listo, ms)),
    ahora = () => new Date(),
    reintentos = 3,
    margenSegundos = MARGEN_RELOJ_AEAT_SEGUNDOS,
  } = configuracion;

  if (!Number.isInteger(tamanoLote) || tamanoLote < 1 || tamanoLote > MAX_REGISTROS_POR_ENVIO) {
    throw new VerifactuClientError({
      code: 'TAMANO_DE_LOTE_INVALIDO',
      message: `El tamaño de lote «${tamanoLote}» está fuera de 1..${MAX_REGISTROS_POR_ENVIO}.`,
      causaProbable:
        'El esquema declara `maxOccurs="1000"` sobre RegistroFactura, y la AEAT lo comprueba ' +
        'también en destino con los códigos 4113 y 4114.',
      accionSugerida: `Usa un entero entre 1 y ${MAX_REGISTROS_POR_ENVIO}. Ver docs/diseno-cola-3d.md R-6.`,
    });
  }

  const espera: EntradaCola[] = [];
  let ultimoEslabon: Eslabon | null = configuracion.ultimoEslabon ?? null;
  let esperaSegundos = TIEMPO_ESPERA_ENVIO_INICIAL_SEGUNDOS;
  let ultimoEnvioMs: number | null = null;
  let enCurso = false;

  /** Sella y encadena una entrada. Se llama **justo antes** de abrir el socket, nunca al encolar. */
  async function sellar(entrada: EntradaCola, previo: Eslabon | null): Promise<EslabonCanonico> {
    return entrada.tipo === 'alta'
      ? cadena.alta({ ...entrada.factura, previous: previo })
      : cadena.anulacion({ ...entrada.factura, previous: previo });
  }

  /** Espera lo que le falte a la ventana que pidió la AEAT. Antes del primer envío no espera. */
  async function esperarTurno(): Promise<void> {
    if (ultimoEnvioMs === null) return;
    const restanteMs = esperaSegundos * 1000 - (ahora().getTime() - ultimoEnvioMs);
    if (restanteMs > 0) await esperar(restanteMs);
  }

  return {
    encolar(...entradas: readonly EntradaCola[]): number {
      for (const entrada of entradas) {
        if ('previous' in entrada.factura) {
          throw new VerifactuClientError({
            code: 'ESLABON_EN_LA_COLA',
            message:
              'Una entrada de la cola trae «previous»: un eslabón ya encadenado. La cola no ' +
              'acepta eslabones, solo datos de factura.',
            causaProbable:
              'FechaHoraHusoGenRegistro entra en la huella, así que un registro encadenado al ' +
              'encolarlo lleva el sello de ESE momento. Cuando salga de la cola, ese sello ya ' +
              'será viejo, y re-sellarlo cambia su huella e invalida toda la cadena que cuelgue ' +
              'detrás. Por eso la cadena se construye al enviar.',
            accionSugerida:
              'Encola solo los datos de la factura. La cola llama a la cadena por ti, en el ' +
              'momento del envío y sobre el eslabón que la AEAT aceptó de verdad. Ver ' +
              'docs/diseno-cola-3d.md R-1.',
          });
        }
        espera.push(entrada);
      }
      return espera.length;
    },

    get pendientes() {
      return espera.length;
    },

    get ultimoEslabon() {
      return ultimoEslabon;
    },

    get esperaSegundos() {
      return esperaSegundos;
    },

    async procesar(): Promise<ResultadoCola> {
      if (enCurso) {
        throw new VerifactuClientError({
          code: 'COLA_EN_CURSO',
          message: 'Ya hay un procesar() en marcha sobre esta cadena.',
          causaProbable:
            'No se puede preparar el registro n+1 sin la huella del n, y esa huella no se conoce ' +
            'hasta haberlo enviado. Dentro de una cadena no hay paralelismo posible.',
          accionSugerida:
            'Espera a que termine el procesar() en curso. Si quieres paralelismo de verdad, ' +
            'son cadenas distintas: otro NumeroInstalacion, otra cola. Ver ' +
            'docs/diseno-cola-3d.md R-2.',
        });
      }
      enCurso = true;

      const envios: EnvioRealizado[] = [];
      let aceptados = 0;
      let parada: Parada | null = null;
      const avisos: string[] = [];

      try {
        while (espera.length > 0 && parada === null) {
          const lote = espera.slice(0, tamanoLote);

          await esperarTurno();

          // R-1: el sello, la huella y el eslabón salen de aquí, no de cuando se encoló. Se sella
          // UNA vez por lote: los reintentos reenvían esto mismo sin tocarlo (R-5).
          const enlaces: EslabonCanonico[] = [];
          let previo = ultimoEslabon;
          for (const entrada of lote) {
            const eslabon = await sellar(entrada, previo);
            enlaces.push(eslabon);
            previo = eslabon;
          }

          const registros = lote.map((entrada, i) => {
            const eslabon = enlaces[i] as EslabonCanonico;
            return { eslabon, datos: entrada.datos } as RegistroFactura;
          });

          const selloMs = Date.parse(
            (enlaces[0] as EslabonCanonico).fields.FechaHoraHusoGenRegistro,
          );

          let resultado: ResultadoEnvio | null = null;
          let intentos = 0;
          let antiguedad = 0;

          while (resultado === null && parada === null) {
            antiguedad = Math.round((ahora().getTime() - selloMs) / 1000);

            // R-3: el sello no se refresca, así que la ventana se agota sola. Enviar pasado el
            // margen no falla: la AEAT lo ACEPTA con el código 2004 y lo almacena con error.
            if (antiguedad > margenSegundos) {
              parada = {
                motivo: 'SELLO_CADUCADO',
                explicacion:
                  `El sello de este lote lleva ${antiguedad} s y el margen medido son ` +
                  `${margenSegundos} s. Enviarlo ahora devolvería el código 2004: la AEAT lo ` +
                  'ACEPTA, lo almacena y lo marca con error, y luego hay que subsanarlo uno a ' +
                  'uno. Re-sellarlo no es la salida: cambiaría su huella e invalidaría la cadena ' +
                  'que cuelgue detrás. Decide tú entre enviarlo así a sabiendas o rehacer la ' +
                  'cadena desde aquí.',
              };
              break;
            }

            intentos += 1;
            try {
              resultado = await cliente.enviar({ cabecera, registros });
            } catch (error) {
              ultimoEnvioMs = ahora().getTime();
              const incidencia = incidenciaDe(error);
              const decision = procedeReintentar(incidencia);

              if (!decision.reintentar || intentos > reintentos) {
                parada = {
                  motivo: incidencia.tipo === 'sin-respuesta' ? 'SIN_RESPUESTA' : 'ERROR_HTTP',
                  explicacion: decision.reintentar
                    ? `Agotados los ${reintentos} reintentos. ${decision.motivo}`
                    : decision.motivo,
                  ...(incidencia.tipo === 'codigo' ? { codigo: incidencia.codigo } : {}),
                };
                break;
              }

              await esperarTurno();
              continue;
            }

            ultimoEnvioMs = ahora().getTime();
          }

          if (resultado === null) break;

          // R-3.3: la AEAT manda su propia hora en cada respuesta aceptada. Un reloj
          // desincronizado no rompe este envío — estropea en silencio todos los siguientes.
          const instanteAeat = resultado.respuesta.DatosPresentacion?.TimestampPresentacion;
          const desfase =
            instanteAeat === undefined
              ? undefined
              : desfaseDeReloj(instanteAeat, ahora(), margenSegundos);
          if (desfase?.aviso != null) avisos.push(desfase.aviso);

          envios.push({
            resultado,
            registros: registros.length,
            intentos,
            antiguedadSelloSegundos: antiguedad,
            ...(desfase === undefined ? {} : { desfaseReloj: desfase }),
          });
          esperaSegundos = esperaTrasRespuesta(resultado.respuesta, esperaSegundos);

          // La cadena avanza hasta donde la AEAT dijo que había almacenado, y ni un eslabón más.
          // `RespuestaLinea` no es opcional: `parsearRespuesta` siempre la construye con un
          // `.map()`, así que un lote sin líneas llega como array vacío, no como ausencia.
          const lineas = resultado.respuesta.RespuestaLinea;
          let avanzados = 0;
          for (let i = 0; i < enlaces.length; i += 1) {
            const linea = lineas[i];
            if (linea === undefined || !almacenado(linea.EstadoRegistro)) break;
            ultimoEslabon = enlaces[i] as EslabonCanonico;
            avanzados += 1;
          }

          aceptados += avanzados;
          espera.splice(0, avanzados);

          // Lo que no avanzó sigue en la cola, y seguir enviando encadenaría sobre una huella que
          // la AEAT no tiene almacenada. Parar aquí es lo único que no rompe la cadena.
          if (avanzados < lote.length) {
            const fallida = lineas[avanzados];
            const rechazoTotal = resultado.respuesta.EstadoEnvio === 'Incorrecto';
            parada = {
              motivo: rechazoTotal ? 'ENVIO_RECHAZADO' : 'REGISTRO_RECHAZADO',
              explicacion: rechazoTotal
                ? 'La AEAT ha rechazado el envío completo: no se ha registrado ninguna factura ' +
                  'del lote y la cadena no ha avanzado. Corrige lo que señala el mensaje y ' +
                  'vuelve a procesar.'
                : `La AEAT ha rechazado el registro ${avanzados + 1} del lote. Los que iban ` +
                  'detrás se habían encadenado a una huella que la AEAT no tiene almacenada, ' +
                  'así que siguen en la cola sin enviar: cuando se procesen se sellarán de ' +
                  'nuevo sobre el último eslabón que sí aceptó.',
              ...(fallida?.CodigoErrorRegistro !== undefined
                ? { codigo: fallida.CodigoErrorRegistro }
                : {}),
            };
          }
        }
      } finally {
        enCurso = false;
      }

      return { envios, aceptados, pendientes: espera.length, ultimoEslabon, parada, avisos };
    },
  };
}
