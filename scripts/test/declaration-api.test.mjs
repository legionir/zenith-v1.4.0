import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { declarationEntries, inspectDeclarationApi } from '../lib/declaration-api.mjs';
import { extractorConfig } from '../api-report.mjs';

const temporary = [];
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }); });
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), 'zenith-declarations-'));
  temporary.push(root);
  for (const [name, body] of Object.entries(files)) {
    const path = join(root, name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
  }
  return root;
}
function analyze(files) {
  const root = fixture({ 'package.json': '{"type":"module"}', ...files });
  return inspectDeclarationApi([{ packageName: '@zenith/fixture', subpath: '.', file: join(root, 'index.d.ts') }], { includeDirectories: [root] });
}

describe('declaration-based public API bootstrap (#38/#56/#57)', () => {
  it('follows aliased re-exports and nested generic callback types', () => {
    const result = analyze({
      'index.d.ts': 'export { consume as publicConsume } from "./hidden.js";',
      'hidden.d.ts': 'interface Box<T = any> { value: T } export declare function consume(cb: (value: Box) => void): void;',
    });
    expect(result.any).toHaveLength(1);
    expect(result.any[0].exposedBy).toEqual(['@zenith/fixture.:publicConsume']);
  });
  it('finds method, return and callback anys, not the string literal "any"', () => {
    const result = analyze({ 'index.d.ts': 'export interface Service { run(cb: (x: any) => void): any; label: "any"; }' });
    expect(result.any).toHaveLength(2);
    expect(result.any.every(f => f.line === 1 && f.column > 0)).toBe(true);
  });
  it('does not audit unrelated private declarations or private fields', () => {
    expect(analyze({ 'index.d.ts': 'interface Unused { x: any } export declare class Service { private secret: any; value: unknown; }' }).any).toEqual([]);
  });
  it('still audits constructor argument types even when stored in a private field', () => {
    expect(analyze({ 'index.d.ts': 'export declare class Service { private value; constructor(value: any); }' }).any).toHaveLength(1);
  });
  it('resolves cycles and a namespace re-export without infinite recursion', () => {
    const result = analyze({ 'index.d.ts': 'export * as self from "./index.js"; export interface Node { next?: Node; value: unknown; }' });
    expect(result.any).toEqual([]);
    expect(result.surface.map(s => s.tag)).toEqual(['unclassified', 'unclassified']);
  });
  it('signature snapshots change for parameter types and removed members without export-name changes', () => {
    const a = analyze({ 'index.d.ts': '/** @public */ export interface API { run(value: string): void; close(): void; }' });
    const b = analyze({ 'index.d.ts': '/** @public */ export interface API { run(value: number): void; }' });
    expect(a.surface[0].entry).toBe(b.surface[0].entry);
    expect(a.surface[0].signatures).not.toEqual(b.surface[0].signatures);
    expect(a.surface[0].tag).toBe('public');
  });
  it('records internal classification rather than silently calling it public', () => {
    expect(analyze({ 'index.d.ts': '/** @internal */ export declare function unsafe(): void;' }).surface[0].tag).toBe('internal');
  });
  it('rejects unresolved imported types instead of mistaking them for a clean API', () => {
    expect(() => analyze({ 'index.d.ts': 'export type { Missing } from "not-installed-fixture";' })).toThrow();
  });
  it('discovers ESM/CJS types and subpaths, excludes private tools', () => {
    const root = fixture({
      'packages/lib/package.json': JSON.stringify({ name: '@zenith/lib', exports: { '.': { import: { types: './dist/index.d.ts' }, require: { types: './dist/index.d.cts' } }, './extra': { types: './dist/extra.d.ts' }, './package.json': './package.json' } }),
      'packages/private/package.json': JSON.stringify({ name: 'private', private: true }),
    });
    expect(declarationEntries(root).map(e => e.subpath)).toEqual(['.', '.', './extra']);
  });
  it('rejects declaration targets escaping a package', () => {
    const root = fixture({ 'packages/lib/package.json': JSON.stringify({ name: '@zenith/lib', exports: { '.': { types: '../outside.d.ts' } } }) });
    expect(() => declarationEntries(root)).toThrow('Invalid declaration target');
  });
  it('uses API Extractor reports per real subpath and per declaration format', () => {
    const config = extractorConfig({ directory: 'schema', file: '/repo/packages/schema/dist/zod.d.cts', subpath: './zod' }, '/repo');
    expect(config.apiReport.reportFileName).toBe('schema--zod--cjs.api.md');
    expect(config.mainEntryPointFilePath).toBe('/repo/packages/schema/dist/zod.d.cts');
    expect(config.apiReport.enabled).toBe(true);
    expect(config.messages.extractorMessageReporting['ae-missing-release-tag'].logLevel).not.toBe('none');
  });
});

it('treats deprecation as orthogonal to visibility, and rejects ambiguous levels', () => {
  const result = analyze({ 'index.d.ts': '/** @public @deprecated Use next. */ export declare function old(): void; /** @public @internal */ export declare const conflicting: string;' });
  expect(result.surface.find(s => s.entry.endsWith(':old'))).toMatchObject({ tag: 'public', deprecated: true });
  expect(result.surface.find(s => s.entry.endsWith(':conflicting')).tag).toBe('conflicting');
});
it('finds inferred any behind a built-in utility and an unannotated parameter', () => {
  const result = analyze({ 'index.d.ts': '/** @public */ export type Parsed = ReturnType<typeof JSON.parse>; /** @public */ export declare function consume(value): void;' });
  expect(result.any.some(f => f.kind === 'inferred' && f.exposedBy.some(e => e.endsWith(':Parsed')))).toBe(true);
  expect(result.any.some(f => f.exposedBy.some(e => e.endsWith(':consume')))).toBe(true);
});
it('retains explicit release metadata on a renamed re-export', () => {
  const result = analyze({ 'index.d.ts': 'export { owned as alias } from "./owned.js";', 'owned.d.ts': '/** @beta @deprecated Preview replacement. */ export declare function owned(): unknown;' });
  expect(result.surface[0]).toMatchObject({ entry: '@zenith/fixture.:alias', tag: 'beta', deprecated: true });
});
it('does not let an alias advertise an internal implementation as public', () => {
  const result = analyze({ 'index.d.ts': '/** @public */ export { owned as alias } from "./owned.js";', 'owned.d.ts': '/** @internal */ export declare function owned(): unknown;' });
  expect(result.surface[0].tag).toBe('conflicting');
});
it('fails closed when any declared condition has not been built', () => {
  const root = fixture({ 'index.d.ts': 'export declare const ready: unknown;' });
  expect(() => inspectDeclarationApi([{ file: join(root, 'missing.d.cts') }])).toThrow('Missing declaration');
});
it('declares non-public levels only on explicit subpaths, never the package root', () => {
  const root = fixture({ 'packages/lib/package.json': JSON.stringify({ name: '@zenith/lib', zenith: { entryLevels: { '.': 'internal' } }, exports: { '.': { types: './dist/index.d.ts' } } }) });
  expect(() => declarationEntries(root)).toThrow('invalid release level');
});
it('carries a declared preview subpath level through all declaration conditions', () => {
  const root = fixture({ 'packages/lib/package.json': JSON.stringify({ name: '@zenith/lib', zenith: { entryLevels: { './preview': 'beta' } }, exports: { './preview': { import: { types: './dist/preview.d.ts' }, require: { types: './dist/preview.d.cts' } } } }) });
  expect(declarationEntries(root).map(entry => entry.releaseLevel)).toEqual(['beta', 'beta']);
});
it('follows module-shaped import types but not their unrelated private declarations', () => {
  const result = analyze({ 'index.d.ts': '/** @public */ export type ModuleAPI = typeof import("./leaf.js");', 'leaf.d.ts': 'interface Private { hidden: any } export declare const visible: any;' });
  expect(result.any).toHaveLength(1); expect(result.any[0].exposedBy).toContain('@zenith/fixture.:ModuleAPI');
});
it('does not mistake a namespace re-export for access to private module members', () => {
  const result = analyze({ 'index.d.ts': '/** @public */ export * as api from "./leaf.js";', 'leaf.d.ts': 'interface Private { hidden: any } export declare const visible: unknown;' });
  expect(result.any).toEqual([]);
});
it('keeps canonical overload metadata live when only the positional bridge is deprecated', () => {
  const result = analyze({ 'index.d.ts': '/** @public */ export declare function create(host: string,options: object): void; /** @public @deprecated Use options. */ export declare function create(host: string,width: number,height: number): void;' });
  expect(result.surface[0]).toMatchObject({ tag: 'public', deprecated: false });
});
