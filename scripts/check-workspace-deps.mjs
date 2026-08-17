#!/usr/bin/env node
/**
 * Fails if a workspace package depends on a sibling with a range its local version does not
 * satisfy.
 *
 * With `link-workspace-packages=true` pnpm links the sibling from this repository **only while the
 * local version satisfies the range**. The moment it does not, pnpm quietly installs the published
 * copy instead, and the whole suite starts testing against whatever is on npm rather than against
 * the code being edited. Nothing fails; it just stops meaning anything.
 *
 *   node scripts/check-workspace-deps.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'packages';

const paquetes = new Map();
for (const entrada of readdirSync(DIR, { withFileTypes: true })) {
  if (!entrada.isDirectory()) continue;
  const manifiesto = JSON.parse(readFileSync(join(DIR, entrada.name, 'package.json'), 'utf8'));
  paquetes.set(manifiesto.name, manifiesto);
}

/** Minimal `^x.y.z` / `~x.y.z` / exact check. Enough for the ranges this repository uses. */
function satisface(version, rango) {
  const partes = (v) => v.split('.').map(Number);

  if (rango.startsWith('workspace:')) {
    return { ok: false, motivo: 'usa el protocolo workspace:, que npm publish no traduce' };
  }
  if (rango === version || rango === '*') return { ok: true };

  const operador = rango.startsWith('^') ? '^' : rango.startsWith('~') ? '~' : '';
  if (operador === '') {
    return { ok: false, motivo: `rango exacto «${rango}» distinto de la versión local` };
  }

  const [mayorR, menorR, parcheR] = partes(rango.slice(1));
  const [mayor, menor, parche] = partes(version);

  // 0.x is special in semver: `^0.2.0` does NOT accept 0.3.0.
  const mismaBase =
    operador === '~' || mayorR === 0 ? mayor === mayorR && menor === menorR : mayor === mayorR;
  if (!mismaBase) return { ok: false, motivo: `la versión local ${version} sale del rango` };

  const posterior =
    menor > menorR || (menor === menorR && parche >= parcheR) || (mayorR !== 0 && menor > menorR);
  return posterior ? { ok: true } : { ok: false, motivo: `la versión local ${version} es anterior` };
}

const problemas = [];
for (const [nombre, manifiesto] of paquetes) {
  for (const [dependencia, rango] of Object.entries(manifiesto.dependencies ?? {})) {
    const hermano = paquetes.get(dependencia);
    if (hermano === undefined) continue;

    const { ok, motivo } = satisface(hermano.version, rango);
    if (!ok) {
      problemas.push(
        `  ${nombre} depende de ${dependencia}@${rango}, pero aquí ${dependencia} es ${hermano.version}: ${motivo}`,
      );
    }
  }
}

if (problemas.length > 0) {
  console.error(
    '[workspace] Alguna dependencia entre paquetes no enlaza con la copia local:\n' +
      `${problemas.join('\n')}\n\n` +
      'pnpm instalaría la versión publicada en npm en su lugar, así que los tests dejarían de\n' +
      'probar este código. Sube la versión del paquete dependiente o ajusta el rango.',
  );
  process.exit(1);
}

console.log(`[workspace] ${paquetes.size} paquetes; dependencias internas enlazadas correctamente.`);
