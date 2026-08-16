#!/usr/bin/env node
/**
 * Mirrors the emitted `.d.ts` tree as `.d.cts`, rewriting relative specifiers from `.js` to
 * `.cjs`.
 *
 * Why: the package ships both ESM and CJS. Under `moduleResolution: node16`/`nodenext`, a CJS
 * consumer resolving `require('@verifactu-js/core')` looks for `.d.cts`; handing it the ESM
 * `.d.ts` of a `"type": "module"` package makes TypeScript complain. Emitting both keeps the
 * `types` condition honest in each branch of the exports map.
 *
 * tsup would normally do this, but its `dts` step depends on `rollup-plugin-dts`, which bundles
 * TypeScript 5.7 and breaks against the TypeScript 7 compiler this repo uses.
 *
 * Usage:  node scripts/emit-cts-types.mjs <distDir>
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const distDir = resolve(process.argv[2] ?? 'dist');

/** Rewrites `from './x.js'`, `import('./x.js')` and `/// <reference path="./x.js" />`. */
function rewriteSpecifiers(source) {
  return source.replace(/(['"])(\.{1,2}\/[^'"]*?)\.js\1/g, '$1$2.cjs$1');
}

let written = 0;

for (const entry of readdirSync(distDir, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  if (!entry.name.endsWith('.d.ts')) continue;

  const source = readFileSync(join(distDir, entry.name), 'utf8');
  const target = entry.name.replace(/\.d\.ts$/, '.d.cts');
  writeFileSync(join(distDir, target), rewriteSpecifiers(source), 'utf8');
  written += 1;
}

if (written === 0) {
  console.error(`[types] No se ha encontrado ningún .d.ts en ${distDir}`);
  process.exit(1);
}

// Declaration maps point at sources that the .d.cts copies do not have; drop the reference
// rather than ship a broken link.
for (const entry of readdirSync(distDir)) {
  if (extname(entry) !== '.cts') continue;
  const path = join(distDir, entry);
  const cleaned = readFileSync(path, 'utf8').replace(/^\/\/# sourceMappingURL=.*$/gm, '');
  writeFileSync(path, cleaned, 'utf8');
}

console.log(`[types] ${written} ficheros .d.cts generados en ${distDir}`);
