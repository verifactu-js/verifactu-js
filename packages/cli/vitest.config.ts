import { fileURLToPath } from 'node:url';

import { coverageConfigDefaults, defineConfig } from 'vitest/config';

/** `<paquete>/src`, absoluto y con barras normales, que es lo que entiende el glob de cobertura. */
const SRC = fileURLToPath(new URL('src', import.meta.url)).replace(/\\/g, '/');

export default defineConfig({
  // Contra el `src` del hermano, no contra su `dist`. En CI el typecheck y la suite corren ANTES
  // del build, así que ese `dist` todavía no existe; y aunque existiera, se estaría probando
  // contra una compilación vieja en lugar de contra el código que se está editando.
  //
  // `xml` y `validation` están aquí aunque este paquete no los importe: los importa `client`, y
  // al resolverlo por `src` hay que poder seguirle la pista a lo que él importa.
  resolve: {
    alias: {
      '@verifactu-js/client': fileURLToPath(new URL('../client/src/index.ts', import.meta.url)),
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
      // Absoluto, y no `'src/**/*.ts'`, por culpa del alias de arriba: los ficheros de
      // `client/src` se ejecutan de verdad y quedan FUERA de este directorio, donde un patrón
      // relativo no los alcanza ni para incluirlos ni para excluirlos. Se colaban en el informe y
      // hundían el porcentaje del 100 % al 37 %. Con la ruta absoluta el filtro es inequívoco.
      include: [`${SRC}/**/*.ts`],
      // `exclude` SUSTITUYE la lista por defecto de vitest en vez de sumarse a ella, así que hay
      // que extenderla a mano o se pierden `node_modules`, `dist` y compañía.
      //
      // `src/cli.ts` es lo único que no se prueba, y a propósito: son tres líneas cuyo trabajo
      // entero es leer `process.argv`, construir el entorno real y poner el código de salida.
      // Todo lo que decide algo vive en `ejecutar()`, que sí se prueba con un entorno inyectado.
      exclude: [...coverageConfigDefaults.exclude, 'src/cli.ts'],
      reporter: ['text', 'json-summary', 'html', 'lcov'],
      skipFull: false,
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
    },
  },
});
