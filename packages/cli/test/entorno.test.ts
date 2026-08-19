/**
 * El entorno de verdad: disco, consola y red.
 *
 * Es la única parte del paquete que toca el mundo, y por eso el resto se prueba con uno de
 * mentira. Aquí se comprueba el adaptador real, con la misma regla que sigue `client`: nada sale
 * de esta máquina — el disco es un fichero temporal y la red, un puerto cerrado de localhost.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { entornoNode } from '../src/index.js';

let carpeta: string;

beforeAll(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'verifactu-cli-'));
});

afterAll(async () => {
  await rm(carpeta, { recursive: true, force: true });
});

describe('entornoNode', () => {
  it('lee un fichero del disco tal cual', async () => {
    const ruta = join(carpeta, 'cadena.json');
    await writeFile(ruta, '[]', 'utf8');

    expect(await entornoNode().leerFichero(ruta)).toBe('[]');
  });

  it('propaga el fallo cuando el fichero no existe, en vez de devolver vacío', async () => {
    await expect(entornoNode().leerFichero(join(carpeta, 'no-esta.json'))).rejects.toThrow();
  });

  it('escribe en la salida estándar y en la de error, con salto de línea', () => {
    const salida = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const error = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    try {
      entornoNode().escribir('hola');
      entornoNode().escribirError('ay');

      expect(salida).toHaveBeenCalledWith('hola\n');
      expect(error).toHaveBeenCalledWith('ay\n');
    } finally {
      salida.mockRestore();
      error.mockRestore();
    }
  });

  it('da la hora del sistema', () => {
    const antes = Date.now();
    const ahora = entornoNode().ahora().getTime();

    expect(ahora).toBeGreaterThanOrEqual(antes);
    expect(entornoNode().versionNode).toBe(process.version);
  });

  it('lee estado y cabecera Date de una respuesta real', async () => {
    const { createServer } = await import('node:http');
    const servidor = createServer((_peticion, respuesta) => {
      respuesta.writeHead(200, { Date: 'Wed, 19 Aug 2026 10:00:00 GMT' });
      respuesta.end();
    });
    await new Promise<void>((listo) => servidor.listen(0, '127.0.0.1', listo));
    const puerto = (servidor.address() as { port: number }).port;

    try {
      const cabeza = await entornoNode().cabezaHttp(`http://127.0.0.1:${puerto}/lo-que-sea`);

      expect(cabeza.estado).toBe(200);
      expect(cabeza.fecha).toBe('Wed, 19 Aug 2026 10:00:00 GMT');
    } finally {
      await new Promise<void>((listo) => servidor.close(() => listo()));
    }
  });

  it('falla al pedir una cabecera a un puerto cerrado, y no se lo inventa', async () => {
    // El puerto 9 (discard) no escucha en una máquina normal. Lo que importa es que el fallo
    // SUBA: si `doctor` recibiera un silencio en vez de una excepción, daría el reloj por bueno.
    await expect(entornoNode().cabezaHttp('http://127.0.0.1:9/nada')).rejects.toThrow();
  });
});
