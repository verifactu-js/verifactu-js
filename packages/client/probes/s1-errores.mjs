/**
 * S-1 · `errores.properties` (I-15) — **cero envíos**.
 *
 * Descarga autenticada contra `prewww2.aeat.es`, el mismo host de donde salieron los XSD y el
 * WSDL. No envía ningún registro: es un GET con certificado.
 *
 * Va primero porque es gratis y porque **es lo que hace interpretables a las demás**. Sin la tabla
 * código → mensaje, un rechazo es un número; con ella, es una frase. S-4 en particular no se puede
 * leer sin esto.
 *
 * ## Se guardan los bytes antes de decodificar nada
 *
 * La primera ejecución de esta sonda usó `body.text()` de undici, que decodifica como UTF-8, y
 * destruyó el fichero: `.properties` de Java es **ISO-8859-1 por especificación**, y cada byte
 * acentuado acabó convertido en U+FFFD, que es irreversible. Se descargó bien y se guardó mal.
 *
 * Por eso ahora se escribe primero `.bin` con lo que llegó por el cable y solo después se
 * decodifica a texto. Es la misma regla que ya seguían S-2 a S-4 al guardar petición y respuesta
 * en crudo, aplicada donde faltaba.
 *
 *   node packages/client/probes/s1-errores.mjs
 *
 * Requiere `pnpm build` antes, y las variables de entorno de `comun.mjs`.
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Agent, request } from 'undici';

import { decodificarProperties, parsearProperties } from '../../../scripts/properties.mjs';
import { entorno, RAIZ, RESULTADOS } from './comun.mjs';

const RUTAS = [
  'https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/errores.properties',
  'https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/errores.properties',
];

/** La copia verificada que vive en el repositorio, con su SHA-256 en docs/reference/MANIFEST.md. */
const REFERENCIA = join(RAIZ, 'docs', 'reference', 'AEAT_errores.properties');

const { credenciales } = await entorno();

// Un GET, no un envío. El transporte del cliente solo sabe hacer POST porque es lo único que
// necesita, así que aquí se usa undici directamente con las mismas opciones TLS.
const agent = new Agent({
  connections: 1,
  connect:
    credenciales.tipo === 'p12'
      ? { pfx: credenciales.pfx, passphrase: credenciales.passphrase }
      : { cert: credenciales.cert, key: credenciales.key },
});

await mkdir(RESULTADOS, { recursive: true });

let encontrado = false;

for (const url of RUTAS) {
  console.log(`\n[S-1] GET ${url}`);

  let estado;
  let bytes;
  try {
    const respuesta = await request(url, {
      method: 'GET',
      dispatcher: agent,
      headersTimeout: 30_000,
      bodyTimeout: 30_000,
    });
    estado = respuesta.statusCode;
    // arrayBuffer, no text: text() decodificaría como UTF-8 y esto es ISO-8859-1.
    bytes = Buffer.from(await respuesta.body.arrayBuffer());
  } catch (error) {
    console.error(`   sin respuesta: ${error.message}`);
    continue;
  }

  console.log(`   HTTP ${estado} · ${bytes.length} bytes`);

  if (estado !== 200 || bytes.length === 0) continue;

  const sha256 = createHash('sha256').update(bytes).digest('hex');
  await writeFile(join(RESULTADOS, 's1-errores.bin'), bytes);

  const { texto, escapes, reparadas } = decodificarProperties(bytes);
  await writeFile(join(RESULTADOS, 's1-errores.properties'), texto, 'utf8');
  encontrado = true;

  console.log(`   sha256 ${sha256}`);
  console.log(`   escapes uXXXX resueltos: ${escapes} · dobles codificaciones reparadas: ${reparadas}`);

  const residuales = (texto.match(/�/gu) ?? []).length;
  if (residuales > 0) {
    console.error(
      `\n   ⚠ ${residuales} caracteres U+FFFD en el texto decodificado. Algo se ha perdido:\n` +
        '     no des el fichero por bueno y avisa antes de usarlo como tabla de referencia.',
    );
    process.exitCode = 1;
  }

  // Contraste con la copia del repositorio. Si la AEAT ha cambiado la tabla, esto lo dice aquí y
  // no tres sondas más tarde, cuando un código nuevo salga sin explicación.
  try {
    const guardada = await readFile(REFERENCIA);
    const shaGuardada = createHash('sha256').update(guardada).digest('hex');
    console.log(
      shaGuardada === sha256
        ? '   ✔ idéntica a docs/reference/AEAT_errores.properties'
        : `   ⚠ DISTINTA de docs/reference/AEAT_errores.properties (${shaGuardada}).\n` +
          '     La AEAT ha publicado una tabla nueva. Actualiza la copia, regenera el mapa con\n' +
          '     node scripts/generar-codigos-aeat.mjs y revisa los códigos que aparezcan.',
    );
  } catch {
    console.log('   (no hay copia previa en docs/reference/ con la que comparar)');
  }

  const secciones = parsearProperties(texto);
  const total = secciones.reduce((n, s) => n + s.entradas.length, 0);
  console.log(`\n   ${total} códigos en ${secciones.length} secciones:\n`);
  for (const seccion of secciones) {
    console.log(`     ${String(seccion.entradas.length).padStart(3)} · ${seccion.titulo}`);
  }

  break;
}

console.log(`\n${'='.repeat(78)}`);
if (encontrado) {
  console.log(
    'S-1 hecha. PARA AQUÍ.\n\n' +
      'La tabla está en docs/probe-results/s1-errores.properties (texto) y .bin (crudo).\n' +
      'Con ella delante, S-2, S-3 y S-4 se leen; sin ella, S-4 no se puede interpretar.',
  );
} else {
  console.log(
    'S-1 no ha podido descargar el fichero.\n\n' +
      'Eso no bloquea S-2 ni S-3, que se leen por el estado del registro. Sí deja a S-4 sin\n' +
      'forma de distinguir «bloques incompatibles» de «referencia de requerimiento inexistente»,\n' +
      'así que S-4 quedará como NO CONCLUYENTE y así se anotará. No la fuerces.',
  );
}
console.log('='.repeat(78));
