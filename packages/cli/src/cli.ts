#!/usr/bin/env node
/**
 * El binario. Tres líneas a propósito.
 *
 * Todo lo que decide algo está en `ejecutar()`, que recibe su entorno, no lanza nunca y devuelve
 * un número. Aquí solo se ata a `process`, y por eso este fichero es el único que la suite no
 * cubre.
 *
 * Sin `await` de nivel superior: la salida CJS del bundler no lo admite, y no hace falta.
 */

import { ejecutar, entornoNode } from './index.js';

ejecutar(process.argv.slice(2), entornoNode()).then((codigo) => {
  process.exitCode = codigo;
});
