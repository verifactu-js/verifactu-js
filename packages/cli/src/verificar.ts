/**
 * `verify`: coge una cadena que ya existe y dice si las huellas cuadran.
 *
 * Es el comando que justifica el proyecto entero. Una huella mal calculada **no produce rechazo**:
 * la AEAT acepta el registro, lo almacena y lo marca como «Aceptado con errores». El sistema
 * parece funcionar. Esto es lo que mira de verdad, y funciona sobre cadenas de cualquier
 * procedencia: no hace falta que las haya generado esta librería.
 */

import { type ChainIssue, type Eslabon, verifyChain } from '@verifactu-js/core';

import type { Entorno } from './entorno.js';
import { ERROR_DE_USO, HAY_HALLAZGOS, TODO_BIEN } from './salida.js';

/** Lo que `--json` escribe. Es contrato: si cambia, rompe a quien lo esté leyendo. */
export interface InformeVerificacion {
  readonly ok: boolean;
  readonly registros: number;
  readonly incidencias: readonly ChainIssue[];
}

/** Lee el fichero y devuelve la lista de eslabones, o explica por qué no ha podido. */
async function leerCadena(
  ruta: string,
  entorno: Entorno,
): Promise<{ eslabones: readonly Eslabon[] } | { error: string }> {
  let crudo: string;
  try {
    crudo = await entorno.leerFichero(ruta);
  } catch {
    return {
      error:
        `No se ha podido leer «${ruta}». Comprueba la ruta: se interpreta desde el directorio ` +
        'donde estás, no desde donde esté el fichero.',
    };
  }

  let datos: unknown;
  try {
    datos = JSON.parse(crudo);
  } catch (error) {
    return { error: `«${ruta}» no es JSON válido: ${String(error)}` };
  }

  if (!Array.isArray(datos)) {
    return {
      error:
        `«${ruta}» tiene que ser una lista de registros, y trae ${typeof datos === 'object' ? 'un objeto' : `un ${typeof datos}`}. ` +
        'Se espera exactamente lo que devuelven alta() y anulacion(): un array con los eslabones ' +
        'en orden, del más antiguo al más reciente.',
    };
  }

  return { eslabones: datos as readonly Eslabon[] };
}

function pintarIncidencia(incidencia: ChainIssue): string[] {
  const lineas = [
    '',
    `  registro ${incidencia.index} · ${incidencia.code}`,
    `    ${incidencia.message}`,
  ];
  if (incidencia.esperado !== undefined) lineas.push(`    esperado    ${incidencia.esperado}`);
  if (incidencia.encontrado !== undefined) lineas.push(`    encontrado  ${incidencia.encontrado}`);
  return lineas;
}

/**
 * Verifica la cadena de un fichero JSON.
 *
 * @returns El código de salida: 0 íntegra, 1 con hallazgos, 2 no se ha podido ni intentar.
 */
export async function verificar(
  ruta: string | undefined,
  json: boolean,
  entorno: Entorno,
): Promise<number> {
  if (ruta === undefined) {
    entorno.escribirError('Falta el fichero que verificar. Uso: verifactu-js verify <cadena.json>');
    return ERROR_DE_USO;
  }

  const leido = await leerCadena(ruta, entorno);
  if ('error' in leido) {
    entorno.escribirError(leido.error);
    return ERROR_DE_USO;
  }

  const resultado = await verifyChain(leido.eslabones);
  const informe: InformeVerificacion = {
    ok: resultado.ok,
    registros: leido.eslabones.length,
    incidencias: resultado.issues,
  };

  if (json) {
    entorno.escribir(JSON.stringify(informe));
    return resultado.ok ? TODO_BIEN : HAY_HALLAZGOS;
  }

  if (resultado.ok) {
    entorno.escribir(`OK  ${informe.registros} registros · cadena íntegra`);
    return TODO_BIEN;
  }

  entorno.escribir(
    `FALLO  ${informe.registros} registros · la cadena se rompe en el registro ${resultado.brokenAt}`,
  );
  for (const incidencia of resultado.issues) {
    for (const linea of pintarIncidencia(incidencia)) entorno.escribir(linea);
  }
  entorno.escribir('');
  entorno.escribir(
    'Una huella que no cuadra no se arregla recalculándola: cambiaría la de todos los registros ' +
      'que cuelgan detrás. Lo que hay que averiguar es qué se alteró.',
  );
  return HAY_HALLAZGOS;
}
