import { defineConfig } from 'tsup';

export default defineConfig({
  // Dos entradas con destinos distintos: `index` es la API programable —lo que se importa— y
  // `cli` es el binario. El binario no se puede exponer en `exports` ni el índice llevar shebang,
  // así que separarlos aquí es más simple que un solo bundle con dos caras.
  //
  // El shebang va escrito en `src/cli.ts`, no en el `banner` de tsup: el banner se aplica a TODAS
  // las entradas y le pondría un `#!` al índice de la librería, que no es un ejecutable.
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm', 'cjs'],
  outExtension: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.js' }),
  // Declarations come from `tsc`, not from tsup: its `dts` step depends on `rollup-plugin-dts`,
  // which bundles TypeScript 5.7 and crashes against the TypeScript 7 compiler used here.
  dts: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  // A diferencia del resto del monorepo, esto NO es isomórfico y no pretende serlo: un CLI lee
  // ficheros y escribe en la consola. `node` es la plataforma correcta y la única.
  platform: 'node',
  splitting: false,
});
