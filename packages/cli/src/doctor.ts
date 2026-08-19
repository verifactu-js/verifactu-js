/**
 * `doctor`: si esta máquina puede facturar bien.
 *
 * El comando existe por una sola comprobación: **el reloj**. La AEAT compara
 * `FechaHoraHusoGenRegistro` contra el suyo con un margen de 240 s —medido, no publicado— y
 * pasarse no rechaza el registro: lo acepta con el código 2004, lo almacena, cuenta a efectos del
 * RD 1007/2023 y hay que subsanarlo uno a uno. Un reloj desviado no rompe nada visible; estropea
 * en silencio todo lo que se emita.
 *
 * Y sale gratis. Cualquier respuesta HTTP de la AEAT trae su hora en la cabecera `Date`, así que
 * esto no envía ningún registro, no necesita certificado y no consume nada.
 */

import { desfaseDeReloj, MARGEN_RELOJ_AEAT_SEGUNDOS } from '@verifactu-js/client';

import type { Entorno } from './entorno.js';
import { HAY_HALLAZGOS, TODO_BIEN } from './salida.js';

/**
 * Un fichero estático del entorno de pruebas de la AEAT.
 *
 * Se pide con `HEAD` y solo por su cabecera `Date`: da igual lo que haya dentro. Es el de
 * pruebas a propósito — comprobar la hora no debería depender de tocar producción.
 */
export const URL_HORA_AEAT =
  'https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/errores.properties';

/** La versión mínima de Node que declaran los paquetes de este monorepo. */
const NODE_MINIMO = 20;

/** El resultado de una comprobación. */
export interface Comprobacion {
  readonly nombre: string;
  /** `aviso` es «no se ha podido determinar», que no es lo mismo que «está bien». */
  readonly estado: 'ok' | 'aviso' | 'fallo';
  readonly detalle: string;
}

/** Lo que `--json` escribe. Es contrato: si cambia, rompe a quien lo esté leyendo. */
export interface InformeDoctor {
  readonly ok: boolean;
  readonly comprobaciones: readonly Comprobacion[];
}

function comprobarNode(versionNode: string): Comprobacion {
  const mayor = Number.parseInt(versionNode.replace(/^v/, ''), 10);

  if (!Number.isInteger(mayor)) {
    return {
      nombre: 'node',
      estado: 'aviso',
      detalle: `No se ha podido interpretar la versión «${versionNode}», así que no se sabe.`,
    };
  }

  return mayor >= NODE_MINIMO
    ? { nombre: 'node', estado: 'ok', detalle: `${versionNode}` }
    : {
        nombre: 'node',
        estado: 'fallo',
        detalle: `${versionNode}. Los paquetes declaran Node >= ${NODE_MINIMO}.`,
      };
}

/** Pide la hora a la AEAT y compara. Devuelve las dos comprobaciones que salen de esa petición. */
async function comprobarServicioYReloj(entorno: Entorno): Promise<Comprobacion[]> {
  let cabeza: Awaited<ReturnType<Entorno['cabezaHttp']>>;
  try {
    cabeza = await entorno.cabezaHttp(URL_HORA_AEAT);
  } catch (error) {
    const detalle = `no se ha podido contactar con la AEAT (${String(error)})`;
    return [
      { nombre: 'servicio', estado: 'aviso', detalle },
      {
        nombre: 'reloj',
        estado: 'aviso',
        detalle:
          'no se sabe: sin respuesta de la AEAT no hay contra qué comparar. No es que el reloj ' +
          'esté bien, es que no se ha comprobado.',
      },
    ];
  }

  const servicio: Comprobacion =
    cabeza.estado >= 200 && cabeza.estado < 400
      ? { nombre: 'servicio', estado: 'ok', detalle: `preproducción responde ${cabeza.estado}` }
      : {
          nombre: 'servicio',
          estado: 'aviso',
          detalle: `preproducción responde ${cabeza.estado}, que no es lo esperado`,
        };

  if (cabeza.fecha === null) {
    return [
      servicio,
      {
        nombre: 'reloj',
        estado: 'aviso',
        detalle:
          'no se sabe: la respuesta no trae cabecera «Date», así que no hay hora de la AEAT ' +
          'con la que comparar.',
      },
    ];
  }

  const desfase = desfaseDeReloj(cabeza.fecha, entorno.ahora());

  if (Number.isNaN(desfase.segundos)) {
    return [
      servicio,
      {
        nombre: 'reloj',
        estado: 'aviso',
        detalle: `no se sabe: «${cabeza.fecha}» no se ha podido interpretar como una fecha.`,
      },
    ];
  }

  if (desfase.dentroDelMargen) {
    return [
      servicio,
      {
        nombre: 'reloj',
        estado: 'ok',
        detalle:
          `${desfase.segundos > 0 ? '+' : ''}${desfase.segundos} s respecto a la AEAT ` +
          `(margen medido: ${MARGEN_RELOJ_AEAT_SEGUNDOS} s)`,
      },
    ];
  }

  // El `?? ''` no llega a ejecutarse nunca: `desfaseDeReloj` siempre pone un aviso cuando el
  // desfase se sale del margen. Está porque el tipo dice `string | null` y quitarlo obligaría
  // a un aserto. Es la única rama del paquete que la suite no cubre, y no se puede provocar.
  return [servicio, { nombre: 'reloj', estado: 'fallo', detalle: desfase.aviso ?? '' }];
}

const SIMBOLO: Readonly<Record<Comprobacion['estado'], string>> = {
  ok: 'OK   ',
  aviso: 'AVISO',
  fallo: 'FALLO',
};

/**
 * Comprueba el entorno y devuelve el código de salida.
 *
 * Un `aviso` cuenta como hallazgo igual que un `fallo`: no haber podido comprobar el reloj deja
 * exactamente el mismo riesgo que tenerlo mal, porque en ninguno de los dos casos se sabe.
 */
export async function doctor(json: boolean, entorno: Entorno): Promise<number> {
  const comprobaciones: Comprobacion[] = [
    comprobarNode(entorno.versionNode),
    ...(await comprobarServicioYReloj(entorno)),
  ];

  const ok = comprobaciones.every((c) => c.estado === 'ok');
  const informe: InformeDoctor = { ok, comprobaciones };

  if (json) {
    entorno.escribir(JSON.stringify(informe));
    return ok ? TODO_BIEN : HAY_HALLAZGOS;
  }

  for (const c of comprobaciones) {
    entorno.escribir(`${SIMBOLO[c.estado]}  ${c.nombre.padEnd(9)} ${c.detalle}`);
  }

  if (!ok) {
    entorno.escribir('');
    entorno.escribir(
      'Nada de esto rompe un envío en el momento, que es justo lo que lo hace peligroso: un ' +
        'reloj desviado produce facturas que la AEAT ACEPTA y almacena marcadas con error.',
    );
  }

  return ok ? TODO_BIEN : HAY_HALLAZGOS;
}
