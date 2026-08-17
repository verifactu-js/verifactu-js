import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Run against `core`'s source for the same reason `tsconfig.json` typechecks against it: so the
  // suite does not silently depend on someone having run `pnpm build` first.
  resolve: {
    alias: {
      '@verifactu-js/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      skipFull: false,
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
    },
  },
});
