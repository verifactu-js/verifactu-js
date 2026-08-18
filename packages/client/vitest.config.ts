import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@verifactu-js/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
      '@verifactu-js/validation': fileURLToPath(
        new URL('../validation/src/index.ts', import.meta.url),
      ),
      '@verifactu-js/xml': fileURLToPath(new URL('../xml/src/index.ts', import.meta.url)),
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
