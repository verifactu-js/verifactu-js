#!/usr/bin/env node
/**
 * Fails if a source file contains a raw invisible or space-like character.
 *
 *   node scripts/check-invisibles.mjs
 *
 * ## Por qué este proyecto necesita esto y otros no
 *
 * Aquí un espacio de más no es un detalle de estilo: **cambia una huella**. La cadena canónica se
 * hashea byte a byte, y `A-1` seguido de un NBSP produce un SHA-256 distinto de `A-1` seguido de un
 * espacio normal. Los dos se leen exactamente igual en un editor, en un diff y en una revisión de
 * código.
 *
 * Ya nos pasó dos veces mientras se escribían las sondas: un NBSP se coló en un comentario, y un
 * test de `core` verificaba el rechazo del NBSP usando un NBSP crudo e indistinguible. Ese segundo
 * caso es el peligroso — si alguien "normaliza los espacios" del fichero, el test sigue pasando y
 * deja de probar lo que dice probar.
 *
 * **La regla es absoluta: se escriben con escape.** `'\\u00a0'` es autoexplicativo, sobrevive a
 * cualquier editor y se puede revisar. No hay lista de excepciones a propósito: una excepción es
 * un sitio donde el problema vuelve a ser invisible.
 */
import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

/** Lo que no se puede escribir en crudo, y cómo se llama al reportarlo. */
const PROHIBIDOS = new Map([
  [0x00a0, 'NBSP (espacio duro)'],
  [0x0301, 'acento combinante'],
  [0x200b, 'espacio de ancho cero'],
  [0x200c, 'no-juntador de ancho cero'],
  [0x200d, 'juntador de ancho cero'],
  [0x202f, 'espacio duro estrecho'],
  [0x2028, 'separador de línea'],
  [0x2029, 'separador de párrafo'],
  [0x3000, 'espacio ideográfico'],
  [0xfeff, 'marca de orden de bytes'],
]);
for (let punto = 0x2000; punto <= 0x200a; punto += 1) {
  PROHIBIDOS.set(punto, 'espacio tipográfico');
}

const EXTENSIONES = new Set(['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs', '.json']);
const IGNORAR = new Set(['node_modules', '.git', 'dist', 'coverage', 'probe-results', 'reference']);

/** @returns {string[]} */
function ficheros(dir) {
  const salida = [];
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR.has(entrada.name)) continue;
    const ruta = join(dir, entrada.name);
    if (entrada.isDirectory()) salida.push(...ficheros(ruta));
    else if (EXTENSIONES.has(extname(entrada.name))) salida.push(ruta);
  }
  return salida;
}

const hallazgos = [];

for (const ruta of ficheros('.')) {
  const lineas = readFileSync(ruta, 'utf8').split(/\r?\n/);

  lineas.forEach((linea, indice) => {
    [...linea].forEach((caracter, columna) => {
      const nombre = PROHIBIDOS.get(caracter.codePointAt(0) ?? 0);
      if (nombre === undefined) return;

      const punto = `U+${(caracter.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0')}`;
      hallazgos.push({
        ruta: ruta.replaceAll('\\', '/'),
        linea: indice + 1,
        columna: columna + 1,
        nombre,
        punto,
        escape: `\\u${(caracter.codePointAt(0) ?? 0).toString(16).padStart(4, '0')}`,
      });
    });
  });
}

if (hallazgos.length > 0) {
  console.error(
    `[invisibles] ${hallazgos.length} carácter(es) invisible(s) en crudo:\n`,
  );
  for (const h of hallazgos) {
    console.error(`  ${h.ruta}:${h.linea}:${h.columna}  ${h.punto} ${h.nombre}  →  ${h.escape}`);
  }
  console.error(
    '\nEn este proyecto un espacio de más cambia una huella, y estos caracteres son\n' +
      'indistinguibles de un espacio normal en un editor y en un diff. Escríbelos con escape:\n' +
      "  const NBSP = '\\u00a0';   en vez de pegarlo tal cual\n\n" +
      'No hay lista de excepciones a propósito: una excepción es un sitio donde el problema\n' +
      'vuelve a ser invisible.',
  );
  process.exit(1);
}

console.log('[invisibles] Sin caracteres invisibles en crudo.');
