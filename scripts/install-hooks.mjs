#!/usr/bin/env node
/**
 * Points git at `.githooks/`, so hooks live in the repository and need no extra dependency.
 *
 * No-ops outside a git checkout (a consumer installing the package, a CI job that only
 * downloads a tarball), because `prepare` runs there too and must not fail.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));

if (!existsSync(join(repoRoot, '.git'))) {
  console.log('[hooks] No es un checkout de git; no se instalan hooks.');
  process.exit(0);
}

try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  console.log('[hooks] core.hooksPath -> .githooks');
} catch (error) {
  console.warn(`[hooks] No se han podido instalar: ${error.message}`);
}
