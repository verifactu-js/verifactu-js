#!/usr/bin/env node
/**
 * Fails if an unsubstituted template placeholder survived into the repository.
 *
 * This exists because `@verifactu-js/core@0.1.0` shipped to npm with
 * `"repository": "git+https://github.com/OWNER/verifactu-js.git"`, so the package page linked
 * to a repository that does not exist. For a package whose entire argument is "you can audit
 * how I compute the hash", a broken link to the source is about the worst possible defect on
 * that page — and npm versions are immutable, so it could not be fixed in place.
 *
 * Scans files tracked by git. Vendored AEAT documentation is skipped: it is not ours to edit,
 * and it legitimately contains the AEAT's own unfilled placeholders ("la Orden XXXXXXX").
 *
 * Usage:  node scripts/check-placeholders.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const repoRoot = process.cwd();

/** Patterns that must never appear in a released repository. */
const PLACEHOLDERS = [
  { name: 'OWNER', regex: /\bOWNER\b/ },
  { name: 'YOUR_*', regex: /\bYOUR_(ORG|USER|USERNAME|REPO|NAME|TOKEN)\b/ },
  { name: '<owner>/<repo>', regex: /<(owner|repo|your-[a-z-]+)>/i },
  { name: 'github.com/<placeholder>', regex: /github\.com\/(OWNER|USER|ORG|CHANGEME)\b/ },
  { name: 'example.com URL', regex: /https?:\/\/(www\.)?example\.com/ },
];

/** Paths excluded from the scan, as prefixes relative to the repo root. */
const SKIP_PREFIXES = [
  'docs/reference/', // vendored AEAT documents, not ours to edit
  'node_modules/',
  'dist/',
  'coverage/',
];

/** Files excluded by exact path. */
const SKIP_FILES = new Set([
  'pnpm-lock.yaml',
  // This file necessarily contains the very strings it looks for.
  'scripts/check-placeholders.mjs',
]);

/** Extensions worth reading as text. */
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.jsonc',
  '.md', '.yml', '.yaml', '.toml', '.xml', '.xsd', '.wsdl',
  '.html', '.css', '.txt', '.sh', '',
]);

function trackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8' });
  return out.split('\0').filter(Boolean);
}

function isScannable(path) {
  const normalised = path.split(sep).join('/');
  if (SKIP_FILES.has(normalised)) return false;
  if (SKIP_PREFIXES.some((prefix) => normalised.startsWith(prefix))) return false;

  const dot = normalised.lastIndexOf('.');
  const slash = normalised.lastIndexOf('/');
  const extension = dot > slash ? normalised.slice(dot) : '';
  if (!TEXT_EXTENSIONS.has(extension)) return false;

  try {
    // Skip anything implausibly large for a text file.
    return statSync(join(repoRoot, path)).size < 2_000_000;
  } catch {
    return false;
  }
}

const findings = [];

for (const path of trackedFiles()) {
  if (!isScannable(path)) continue;

  let content;
  try {
    content = readFileSync(join(repoRoot, path), 'utf8');
  } catch {
    continue;
  }

  const lines = content.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    for (const { name, regex } of PLACEHOLDERS) {
      if (regex.test(line)) {
        findings.push({
          file: relative(repoRoot, join(repoRoot, path)).split(sep).join('/'),
          line: index + 1,
          placeholder: name,
          text: line.trim().slice(0, 160),
        });
      }
    }
  }
}

if (findings.length === 0) {
  console.log('[placeholders] Sin placeholders sin sustituir.');
  process.exit(0);
}

console.error(`\n[placeholders] ${findings.length} placeholder(s) sin sustituir:\n`);
for (const f of findings) {
  console.error(`  ${f.file}:${f.line}  [${f.placeholder}]`);
  console.error(`    ${f.text}\n`);
}
console.error(
  'Sustitúyelos antes de publicar. Un package.json con un repositorio inexistente rompe\n' +
    'el enlace "Repository" de la página de npm, y las versiones de npm son inmutables.\n',
);
process.exit(1);
