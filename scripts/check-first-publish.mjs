#!/usr/bin/env node
/**
 * Pre-flight for the release workflow: is this publish going to be accepted at all?
 *
 * npm answers `404 Not Found` to two completely different situations, and the message names
 * neither of them:
 *
 * 1. **The package does not exist yet.** Trusted publishing (OIDC) cannot create it: the trusted
 *    publisher is configured on the package's own settings page, which does not exist until the
 *    package does. Open since 2025-09-01 as npm/cli#8544, «Allow publishing initial version with
 *    OIDC». PyPI solved this with pending publishers; npm has not. The first version has to be
 *    published by hand.
 * 2. **The credentials are not authorised for that name** — a revoked token, a trusted publisher
 *    whose repository / workflow / environment does not match exactly, or an account without
 *    rights over the scope. npm returns 404 rather than 401 so as not to leak which names exist.
 *
 * And republishing a version that is already up returns a third thing, a 403 about publishing
 * over a previous version, which is at least legible but arrives after a full build.
 *
 * This turns all three into a message that says what happened.
 *
 *   node scripts/check-first-publish.mjs packages/validation
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Returns the exit code. Kept separate so nothing calls `process.exit()` while a socket is open. */
async function comprobar(directorio) {
  const manifiesto = JSON.parse(readFileSync(join(directorio, 'package.json'), 'utf8'));
  const { name, version } = manifiesto;
  const url = `https://registry.npmjs.org/${name.replace('/', '%2F')}`;

  let respuesta;
  try {
    respuesta = await fetch(url, { headers: { accept: 'application/json' } });
  } catch (error) {
    console.error(
      `[publish] No se ha podido consultar el registro para ${name}: ${String(error)}\n` +
        'La comprobación previa no ha podido ejecutarse, así que no se publica. Reintenta.',
    );
    return 1;
  }

  if (respuesta.status === 404) {
    console.error(
      `[publish] ${name} todavía no existe en el registro.\n\n` +
        'La primera versión de un paquete NO se puede publicar con OIDC: el publicador de\n' +
        'confianza se configura en la página de ajustes del propio paquete, y esa página no\n' +
        'existe hasta que el paquete existe. npm devolvería un 404 que no explica nada de esto\n' +
        '(npm/cli#8544, abierto desde 2025-09-01).\n\n' +
        'Publica la primera versión a mano, con tu cuenta:\n\n' +
        `    cd ${directorio}\n` +
        '    npm publish --access public\n\n' +
        'Sin --provenance: fuera de CI npm falla con «provider: null».\n\n' +
        'Después, en npmjs.com, en los ajustes del paquete, añade el publicador de confianza con\n' +
        'el repositorio, el fichero de workflow y el environment EXACTOS del job de release. El\n' +
        'nombre del environment es lo que más se falla, y devuelve este mismo 404.\n\n' +
        'A partir de ahí, cada tag publica desde CI con provenance.',
    );
    return 1;
  }

  if (!respuesta.ok) {
    console.error(
      `[publish] El registro ha respondido ${respuesta.status} al consultar ${name}. No se publica.`,
    );
    return 1;
  }

  const datos = await respuesta.json();

  if (datos.versions?.[version] !== undefined) {
    console.error(
      `[publish] ${name}@${version} ya está publicado.\n\n` +
        'npm rechazaría el envío con un 403 después de construirlo todo, y las versiones de npm\n' +
        'son inmutables: no se puede sobrescribir.\n\n' +
        'Si esto es un relanzamiento de un job que ya publicó, no hay nada que hacer. Si querías\n' +
        'publicar código nuevo, sube la versión en package.json y crea el tag correspondiente.',
    );
    return 1;
  }

  const ultima = datos['dist-tags']?.latest ?? '(sin dist-tag latest)';
  console.log(`[publish] ${name}: en el registro está ${ultima}; se va a publicar ${version}.`);
  return 0;
}

const directorio = process.argv[2];
if (directorio === undefined) {
  console.error('Uso: node scripts/check-first-publish.mjs <directorio-del-paquete>');
  process.exitCode = 2;
} else {
  // `process.exitCode` and a natural exit, not `process.exit()`: killing the process while
  // undici still holds a keep-alive socket aborts with a libuv assertion on Windows, and the
  // shell sees 127 instead of the code this script meant to return.
  process.exitCode = await comprobar(directorio);
}
