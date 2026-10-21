import { expect, it } from 'vitest';
import { consumerTargetsOf } from '../install-import-check.mjs';
const dual = { import: { types: './dist/index.d.ts', default: './dist/index.js' }, require: { types: './dist/index.d.cts', default: './dist/index.cjs' } };
const esm = { types: './dist/index.d.ts', import: './dist/index.js', default: './dist/index.js' };
it('still selects genuine root and native CJS entries without require(esm)', () => {
  const targets = consumerTargetsOf({ name: '@zenith/router', exports: { '.': dual, './node': dual, './package.json': './package.json' } }, false);
  expect(targets).toEqual([{ spec: '@zenith/router', cjs: true }, { spec: '@zenith/router/node', cjs: true }]);
});
it('omits only ESM-only entries from old-runtime CommonJS checks', () => {
  expect(consumerTargetsOf({ name: '@zenith/example', exports: { '.': dual, './esm': esm } }, false)).toEqual([
    { spec: '@zenith/example', cjs: true }, { spec: '@zenith/example/esm', cjs: false },
  ]);
});
it('checks require(esm) for ESM-only entries where the runtime supports it', () => {
  expect(consumerTargetsOf({ name: '@zenith/example', exports: { '.': esm } }, true)).toEqual([{ spec: '@zenith/example', cjs: true }]);
});
it('does not import executable root entries but retains their library subpaths', () => {
  expect(consumerTargetsOf({ name: '@zenith/example', bin: './dist/index.js', exports: { '.': esm, './library': dual } }, false)).toEqual([{ spec: '@zenith/example/library', cjs: true }]);
});
