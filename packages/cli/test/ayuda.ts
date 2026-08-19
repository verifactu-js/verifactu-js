/**
 * El entorno de mentira que usan todas las suites.
 *
 * El CLI no llama a `console.log`, ni a `fs`, ni a `fetch`: recibe un {@link Entorno} y usa lo que
 * le den. Eso es lo que permite probar el comando entero —códigos de salida incluidos— sin lanzar
 * un proceso hijo ni tocar la red.
 */
import type { Entorno } from '../src/index.js';

/** Lo que el entorno falso ha ido apuntando. */
export interface EntornoFalso {
  readonly entorno: Entorno;
  /** Todo lo escrito en la salida estándar, unido por saltos de línea. */
  salida(): string;
  /** Todo lo escrito en la salida de error. */
  errores(): string;
  /** Las URL que se han pedido, en orden. */
  readonly pedidas: string[];
}

/** Qué debe contestar el entorno falso. */
export interface OpcionesEntorno {
  /** Respuesta a cualquier petición HTTP. Por defecto, un 200 con la hora que se le diga. */
  readonly respuesta?: () => Promise<{ estado: number; fecha: string | null }>;
  /** El reloj de esta máquina. */
  readonly ahora?: () => Date;
  /** Lo que dice `process.version`. */
  readonly versionNode?: string;
}

export function entornoFalso(
  ficheros: Readonly<Record<string, string>>,
  opciones: OpcionesEntorno = {},
): EntornoFalso {
  const salida: string[] = [];
  const errores: string[] = [];
  const pedidas: string[] = [];

  const entorno: Entorno = {
    escribir: (linea) => salida.push(linea),
    escribirError: (linea) => errores.push(linea),
    async leerFichero(ruta) {
      const contenido = ficheros[ruta];
      if (contenido === undefined) throw new Error(`ENOENT: no existe ${ruta}`);
      return contenido;
    },
    async cabezaHttp(url) {
      pedidas.push(url);
      const respuesta = await (opciones.respuesta?.() ??
        Promise.resolve({ estado: 200, fecha: '2026-08-19T10:00:00Z' }));
      return respuesta;
    },
    ahora: opciones.ahora ?? (() => new Date('2026-08-19T10:00:00Z')),
    versionNode: opciones.versionNode ?? 'v24.3.0',
  };

  return {
    entorno,
    salida: () => salida.join('\n'),
    errores: () => errores.join('\n'),
    pedidas,
  };
}
