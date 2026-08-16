import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  outExtension: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.js' }),
  // Declarations come from `tsc`, not from tsup: its `dts` step depends on `rollup-plugin-dts`,
  // which bundles TypeScript 5.7 and crashes against the TypeScript 7 compiler used here.
  // See the `build` script in package.json.
  dts: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  platform: 'neutral',
  // `platform: 'neutral'` keeps the bundle free of Node built-ins. If anything ever pulls in
  // `node:crypto` this build fails, which is exactly what should happen: the package is
  // isomorphic on purpose and uses Web Crypto.
  splitting: false,
});
