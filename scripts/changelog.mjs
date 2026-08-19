#!/usr/bin/env node
/**
 * Extrae de un `CHANGELOG.md` la sección de una versión concreta.
 *
 * Sirve para dos cosas, y por eso existe en vez de un `sed` dentro del workflow:
 *
 * 1. **Comprobar antes de publicar** que la versión que se va a subir está descrita. Una versión
 *    de npm es inmutable: si sale sin changelog, sale sin changelog para siempre. Es el mismo
 *    razonamiento que `check-first-publish.mjs` — todo lo que se pueda detectar antes de la
 *    llamada al registro, se detecta antes.
 * 2. **Rellenar el cuerpo de la Release de GitHub**, que es lo que hace que un tag deje de ser
 *    un tag pelado y pase a contar qué lleva dentro.
 *
 * Formato esperado, al estilo «Keep a Changelog»:
 *
 *     ## 0.2.1 — 2026-08-19
 *
 *     Lo que sea.
 *
 *     ## 0.2.0 — 2026-08-17
 *
 * El separador entre versión y fecha puede ser una raya (—), un guion o nada.
 *
 * Uso:
 *   node scripts/changelog.mjs <directorio-del-paquete> [version]   # imprime la sección
 *   node scripts/changelog.mjs --check                              # todos los paquetes
 *
 * Sin `version`, usa la del `package.json` de ese directorio.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Una cabecera de versión: `## 1.2.3`, con o sin fecha detrás. */
const CABECERA = /^##\s+\[?(\d+\.\d+\.\d+[^\]\s]*)\]?/;

/**
 * Devuelve el cuerpo de la sección de `version`, o `null` si no está.
 *
 * Se corta en la siguiente cabecera de versión, no en el siguiente `##`: así una sección puede
 * llevar subtítulos sin que se trunque.
 */
export function extraer(changelog, version) {
  const lineas = changelog.split(/\r?\n/);
  const inicio = lineas.findIndex((l) => CABECERA.exec(l)?.[1] === version);
  if (inicio === -1) return null;

  const resto = lineas.slice(inicio + 1);
  const fin = resto.findIndex((l) => CABECERA.test(l));
  const cuerpo = (fin === -1 ? resto : resto.slice(0, fin)).join('\n').trim();

  return cuerpo === '' ? null : cuerpo;
}

function leer(dir) {
  const manifiesto = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  let changelog;
  try {
    changelog = readFileSync(join(dir, 'CHANGELOG.md'), 'utf8');
  } catch {
    return { manifiesto, changelog: null };
  }
  return { manifiesto, changelog };
}

function comprobarTodos() {
  const problemas = [];

  for (const entrada of readdirSync('packages', { withFileTypes: true })) {
    if (!entrada.isDirectory()) continue;
    const dir = join('packages', entrada.name);
    const { manifiesto, changelog } = leer(dir);

    if (changelog === null) {
      problemas.push(`${manifiesto.name}: no tiene CHANGELOG.md`);
      continue;
    }

    if (extraer(changelog, manifiesto.version) === null) {
      problemas.push(
        `${manifiesto.name}: el CHANGELOG.md no describe la versión ${manifiesto.version}. ` +
          `Añade una sección «## ${manifiesto.version} — AAAA-MM-DD» antes de publicarla.`,
      );
      continue;
    }

    if (!(manifiesto.files ?? []).includes('CHANGELOG.md')) {
      problemas.push(`${manifiesto.name}: CHANGELOG.md no está en «files», así que no se publica`);
    }
  }

  if (problemas.length > 0) {
    for (const p of problemas) console.error(`  ${p}`);
    console.error(`\n[changelog] ${problemas.length} problema(s).`);
    process.exit(1);
  }

  console.log('[changelog] Todos los paquetes describen su versión actual.');
}

const [primero, segundo] = process.argv.slice(2);

if (primero === '--check' || primero === undefined) {
  comprobarTodos();
} else {
  const { manifiesto, changelog } = leer(primero);
  if (changelog === null) {
    console.error(`${primero} no tiene CHANGELOG.md`);
    process.exit(1);
  }

  const version = segundo ?? manifiesto.version;
  const cuerpo = extraer(changelog, version);
  if (cuerpo === null) {
    console.error(`${manifiesto.name}: el CHANGELOG.md no describe la versión ${version}.`);
    process.exit(1);
  }

  process.stdout.write(`${cuerpo}\n`);
}
