/**
 * Todo lo que el CLI necesita del mundo exterior, en un solo objeto.
 *
 * Ni `console.log`, ni `node:fs`, ni `fetch` aparecen en la lógica de los comandos: se reciben
 * aquí. Eso es lo que permite probar un comando entero —código de salida incluido— sin lanzar un
 * proceso hijo, sin escribir en disco y sin pedirle nada a la AEAT.
 */

/** Lo que hace falta saber de una respuesta HTTP para comprobar el reloj. */
export interface CabezaHttp {
  readonly estado: number;
  /**
   * La cabecera `Date` tal y como vino, o `null` si no vino.
   *
   * Es la hora del servidor de la AEAT, y llega en **cualquier** respuesta HTTP suya. Por eso el
   * reloj se puede comprobar sin certificado y sin enviar un solo registro.
   */
  readonly fecha: string | null;
}

/** La costura entre el CLI y la máquina donde corre. */
export interface Entorno {
  readonly escribir: (linea: string) => void;
  readonly escribirError: (linea: string) => void;
  readonly leerFichero: (ruta: string) => Promise<string>;
  /** Una petición sin cuerpo, solo para leer estado y cabeceras. */
  readonly cabezaHttp: (url: string) => Promise<CabezaHttp>;
  readonly ahora: () => Date;
  /** Lo que dice `process.version`, con su `v` delante. */
  readonly versionNode: string;
}

/** El entorno de verdad: disco, red y consola. */
export function entornoNode(): Entorno {
  return {
    escribir: (linea) => process.stdout.write(`${linea}\n`),
    escribirError: (linea) => process.stderr.write(`${linea}\n`),
    async leerFichero(ruta) {
      const { readFile } = await import('node:fs/promises');
      return readFile(ruta, 'utf8');
    },
    async cabezaHttp(url) {
      // `HEAD` en vez de `GET`: solo interesan el estado y la cabecera `Date`, y no hay motivo
      // para descargarle un cuerpo entero a la AEAT por comprobar la hora.
      const respuesta = await fetch(url, { method: 'HEAD' });
      return { estado: respuesta.status, fecha: respuesta.headers.get('date') };
    },
    ahora: () => new Date(),
    versionNode: process.version,
  };
}
