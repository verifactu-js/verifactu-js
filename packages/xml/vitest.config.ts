import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Run the tests against `core`'s source, for the same reason `tsconfig.json` typechecks against
  // it: otherwise the suite silently depends on someone having run `pnpm build` first, and on a
  // clean checkout it fails. It also means a change in `core` is exercised here immediately,
  // instead of after a rebuild that is easy to forget.
  //
  // The built artifact is not left untested: the `runtimes` job in CI imports the published
  // bundle on Node 20/22/24, Bun and Deno.
  resolve: {
    alias: {
      '@verifactu-js/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
      '@verifactu-js/validation': fileURLToPath(
        new URL('../validation/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // `text` omits per-file rows once everything is at 100%, so `json-summary` is kept as
      // the machine-readable source of truth for the per-file table.
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      // Report every source file, including those already at 100%: a table that hides the
      // healthy files makes it impossible to notice a file that was never imported at all.
      // `include` above is what pulls in untested files; `coverage.all` no longer exists.
      skipFull: false,
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
    },
  },
});
