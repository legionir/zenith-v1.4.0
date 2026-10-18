import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { inspectPublishedCallables } from '../lib/published-callables.mjs';
const temporary = [];
afterEach(() => { for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true }); });
function inspect(files, options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'zenith-callables-')); temporary.push(root);
  for (const [file, text] of Object.entries({ 'package.json': '{"type":"module"}', ...files })) { const path = join(root, file); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); }
  return inspectPublishedCallables([{ packageName: '@zenith/demo', directory: 'demo', subpath: '.', releaseLevel: 'public', file: join(root, 'index.d.ts') }], { root, includeDirectories: [root], ...options });
}
it('follows real aliases/factory returns and excludes unrelated exported implementation leaves', () => {
  const result = inspect({ 'index.d.ts': 'export { create as make } from "./owner.js";', 'owner.d.ts': 'interface API { run(host: string, width: number, height: number): void; } export declare function create(): API; export declare function hidden(a: string,b: string,c: string): void;' });
  expect(result.violations.map(row => row.name)).toEqual(['API.run']); expect(result.violations[0].exposedAs).toContain('make().run'); expect(result.signatures.some(row => row.name === 'hidden')).toBe(false);
});
it('checks public/static class members and callable interfaces, excluding private/protected members', () => {
  const result = inspect({ 'index.d.ts': 'export declare class Controller { constructor(host: string,width: number,height: number); static build(host: string,width: number,height: number): Controller; private hidden; protected secret(a: string,b: string,c: string): void; run(host: string,width: number,height: number): void; } export interface Factory { (host: string,width: number,height: number): Controller; }' });
  expect(new Set(result.violations.map(row => row.name))).toEqual(new Set(['Controller.constructor', 'Controller.build', 'Controller.run', 'Factory.[call]']));
});
it('finds callbacks and APIs inside native container type arguments', () => {
  const result = inspect({ 'index.d.ts': 'interface API { run(a: string,b: string,c: string): void; } export declare function create(cb: (a: string,b: string,c: string) => void): Promise<API>;' });
  expect(result.violations.some(row => row.name === 'API.run')).toBe(true); expect(result.violations.some(row => row.kind === 'callback')).toBe(true);
});
it('expands concrete rest tuples rather than treating three configuration values as one rest parameter', () => {
  const result = inspect({ 'index.d.ts': 'export declare function create(...args: [host: string,width: number,height: number]): void;' });
  expect(result.violations).toHaveLength(1); expect(result.violations[0].params).toHaveLength(3);
});
it('terminates namespace/return cycles while retaining the live callable signature', () => {
  const result = inspect({ 'index.d.ts': 'export * as self from "./index.js"; export interface API { next(): API; run(a: string,b: string,c: string): void; }' });
  expect(result.violations.some(row => row.name === 'API.run')).toBe(true);
});
it('does not let one deprecated overload exempt the live overload or a same-named function', () => {
  const result = inspect({ 'index.d.ts': 'export interface API { run(host: string,options: Options): void; /** @deprecated Legacy */ run(host: string,width: number,height: number): void; run(host: string,width: string,options: Options): void; } interface Options { label?: string }' });
  expect(result.violations).toHaveLength(1); expect(result.violations[0].params[1]).toBe('width: string');
});
it('fails closed for missing declarations and unresolved public references', () => {
  expect(() => inspectPublishedCallables([{ file: '/not-present/zenith-fixture.d.ts' }])).toThrow('Missing declaration');
  expect(() => inspect({ 'index.d.ts': 'export type { Missing } from "not-installed-callable-fixture";' })).toThrow();
});
it('keeps a live root overload visible when only its sibling overload is deprecated', () => {
  const result = inspect({ 'index.d.ts': '/** @public */ export declare function create(host: string,width: string,options: object): void; /** @public @deprecated Legacy */ export declare function create(host: string,width: number,height: number): void;' });
  expect(result.violations).toHaveLength(1); expect(result.violations[0].params[1]).toBe('width: string');
});
it('rejects unresolved named public types instead of silently losing their methods', () => {
  expect(() => inspect({ 'index.d.ts': 'export declare function create(): MissingAPI;' })).toThrow();
});
it('does not use the first deprecated method overload to exempt a later supported overload', () => {
  const result = inspect({ 'index.d.ts': 'export interface API { /** @deprecated Legacy */ run(a: string,b: number,c: number): void; run(a: string,b: string,c: string): void; }' });
  expect(result.violations).toHaveLength(1); expect(result.violations[0].params[1]).toBe('b: string');
});
it('does not inventory callback parameters of a private constructor as publicly callable API', () => {
  const result = inspect({ 'index.d.ts': 'export declare class Private { private constructor(cb: (a: string,b: string,c: string) => void); read(): string; }' });
  expect(result.violations).toEqual([]);
});
it('retains legacy-only return-path deprecation without suppressing another live path to the same API', () => {
  const result = inspect({ 'index.d.ts': 'interface Legacy { run(a: string,b: string,c: string): void; } /** @deprecated Legacy factory */ export declare function legacy(): Legacy; export declare function live(): Legacy;' });
  expect(result.violations).toHaveLength(1); expect(result.violations[0].exposedAs).toEqual(['legacy().run', 'live().run']);
});
it('finds the violating branch in unions and aliases of rest tuples', () => {
  const result = inspect({ 'index.d.ts': 'type Options = { width?: number }; type Args = [host: string,options: Options] | [host: string,width: number,height: number]; export declare function create(...args: Args): void;' });
  expect(result.signatures.map(row => row.params.length).sort()).toEqual([2, 3]); expect(result.violations).toHaveLength(1);
});
it('expands nested variadic tuple aliases rather than counting their spread as one input', () => {
  const result = inspect({ 'index.d.ts': 'type Prefix = [host: string,width: number]; export declare function create(...args: [...Prefix,height: number]): void;' });
  expect(result.violations).toHaveLength(1); expect(result.violations[0].params).toHaveLength(3);
});
