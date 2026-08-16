import { defineConfig } from 'vitest/config';

export default defineConfig({
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
