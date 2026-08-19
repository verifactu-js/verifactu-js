import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // `src/cli.ts` es la única cosa que no se prueba, y a propósito: son cinco líneas cuyo
      // trabajo entero es leer `process.argv`, construir el entorno real y poner el código de
      // salida. Todo lo que decide algo vive en `ejecutar()`, que sí se prueba con un entorno
      // inyectado. Cubrirlo obligaría a lanzar un proceso hijo por caso para no ganar nada.
      exclude: ['src/cli.ts'],
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      skipFull: false,
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
    },
  },
});
