/**
 * `@verifactu-js/cli` — comprobar el entorno antes de facturar, y verificar cadenas ya emitidas.
 *
 * Dos comandos, y ninguno de los dos envía nada a la AEAT:
 *
 * - `doctor` mira si esta máquina puede facturar bien. Lo importante es el **reloj**: la AEAT
 *   compara `FechaHoraHusoGenRegistro` contra el suyo con un margen de 240 s, y pasarse no
 *   rechaza el registro — lo acepta, lo almacena y lo marca con error. Se comprueba gratis,
 *   porque cualquier respuesta HTTP de la AEAT trae su hora en la cabecera `Date`.
 * - `verify` coge una cadena en JSON, de la procedencia que sea, y dice si las huellas cuadran.
 *
 * Todo lo que decide algo vive en {@link ejecutar}, que recibe un {@link Entorno}. `src/cli.ts`
 * es solo el envoltorio que lo ata a `process`.
 */

import { doctor } from './doctor.js';
import type { Entorno } from './entorno.js';
import { ERROR_DE_USO, TODO_BIEN } from './salida.js';
import { verificar } from './verificar.js';

export type { Comprobacion, InformeDoctor } from './doctor.js';
export type { CabezaHttp, Entorno } from './entorno.js';
export { entornoNode } from './entorno.js';
export { ERROR_DE_USO, HAY_HALLAZGOS, TODO_BIEN } from './salida.js';
export type { InformeVerificacion } from './verificar.js';

const AYUDA = `verifactu-js — utilidades de línea de comandos para VERI*FACTU

  verifactu-js doctor [--json]
      Comprueba que esta máquina puede facturar bien: versión de Node, reloj contra el
      de la AEAT y alcance del servicio. No envía ningún registro ni necesita certificado.

  verifactu-js verify <cadena.json> [--json]
      Verifica una cadena de registros ya emitidos: que cada huella reproduzca su registro
      y que cada uno encadene con el anterior. Sirve para cadenas de cualquier sistema.

Códigos de salida
  0   comprobado y correcto
  1   comprobado, y hay algo que mirar
  2   no se ha podido comprobar (falta un argumento, el fichero no está…)`;

/**
 * Ejecuta un comando y devuelve el código de salida.
 *
 * @param argv - Los argumentos, ya sin `node` ni la ruta del script.
 * @param entorno - Consola, disco, red y reloj. En producción, {@link entornoNode}.
 */
export async function ejecutar(argv: readonly string[], entorno: Entorno): Promise<number> {
  try {
    return await despachar(argv, entorno);
  } catch (error) {
    // Un fallo aquí es un bug nuestro o una tubería cerrada —`stdout` lanza EPIPE en cuanto
    // canalizas a `head`—. En los dos casos lo único inaceptable es salir con 0.
    try {
      entorno.escribirError(`Error inesperado: ${String(error)}`);
    } catch {
      // Si ni siquiera se puede escribir el error, queda el código de salida, que es lo que un
      // script mira de todos modos.
    }
    return ERROR_DE_USO;
  }
}

async function despachar(argv: readonly string[], entorno: Entorno): Promise<number> {
  const banderas = new Set(argv.filter((a) => a.startsWith('--')));
  const posicionales = argv.filter((a) => !a.startsWith('--'));
  const [comando, primero] = posicionales;
  const json = banderas.has('--json');

  if (comando === undefined || banderas.has('--help') || banderas.has('--version')) {
    entorno.escribir(AYUDA);
    return TODO_BIEN;
  }

  if (comando === 'doctor') return doctor(json, entorno);
  if (comando === 'verify') return verificar(primero, json, entorno);

  entorno.escribirError(`No conozco el comando «${comando}». Prueba con «doctor» o «verify».`);
  return ERROR_DE_USO;
}
