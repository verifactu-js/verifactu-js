#!/usr/bin/env node
/**
 * Structural checks on the READMEs that get published to npm.
 *
 * npm renders a package README with a different pipeline from GitHub's, and two things break
 * there in practice: relative links (npm has no reliable notion of the file's directory inside
 * a monorepo) and malformed tables. Neither shows up until the version is live, and npm
 * versions are immutable.
 *
 * Usage:  node scripts/check-readmes.mjs
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

const READMES = globSync('packages/*/README.md');
const problems = [];

function report(file, line, message) {
  problems.push({ file, line, message });
}

for (const file of READMES) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);

  // 1. Fenced code blocks must balance, or everything after the stray fence renders as code.
  let fences = 0;
  for (const line of lines) if (/^\s*```/.test(line)) fences += 1;
  if (fences % 2 !== 0) report(file, 0, `Bloques de código sin cerrar: ${fences} vallas \`\`\``);

  lines.forEach((line, index) => {
    const number = index + 1;

    // 2. Relative links. On npm these resolve inconsistently from a monorepo subdirectory.
    for (const match of line.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1] ?? '';
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      report(file, number, `Enlace relativo «${target}»: usa una URL absoluta de GitHub`);
    }

    // 3. Code fences nested inside a blockquote: valid GFM, rough edge in other renderers.
    if (/^\s*>\s*```/.test(line)) {
      report(file, number, 'Bloque de código dentro de un blockquote: sácalo fuera');
    }

    // 4. GitHub-only alert syntax renders as literal text everywhere else.
    if (/^\s*>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/.test(line)) {
      report(file, number, 'Sintaxis de alerta exclusiva de GitHub: en npm sale como texto');
    }
  });

  // 5. Tables: every row of a block must have the same number of cells as its header.
  let header = null;
  let headerLine = 0;
  lines.forEach((line, index) => {
    const isRow = /^\s*\|.*\|\s*$/.test(line);
    if (!isRow) {
      header = null;
      return;
    }
    const cells = line.trim().slice(1, -1).split('|').length;
    if (header === null) {
      header = cells;
      headerLine = index + 1;
      return;
    }
    // The delimiter row is allowed to differ in spacing but not in cell count.
    if (cells !== header) {
      report(
        file,
        index + 1,
        `Fila de tabla con ${cells} celdas; la cabecera (línea ${headerLine}) tiene ${header}`,
      );
    }
  });
}

if (READMES.length === 0) {
  console.error('[readmes] No se ha encontrado ningún README de paquete.');
  process.exit(1);
}

if (problems.length === 0) {
  console.log(`[readmes] ${READMES.length} README(s) sin problemas estructurales.`);
  process.exit(0);
}

console.error(`\n[readmes] ${problems.length} problema(s):\n`);
for (const p of problems) {
  console.error(`  ${p.file.split('\\').join('/')}:${p.line}  ${p.message}`);
}
console.error('');
process.exit(1);
