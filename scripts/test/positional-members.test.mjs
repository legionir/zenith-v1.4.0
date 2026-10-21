import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { collectSourceSignatures, signatureAllowed } from '../lib/positional-signatures.mjs';
const inventory = text => collectSourceSignatures('/fixture.ts', text);
it('inventories qualified public class/interface/object/type members, not private/protected methods', () => {
  const rows = inventory(`export class Controller { constructor(a: string, b: string, c: string) {} start(a: string, b: string, c: string) {} private hidden(a: string,b: string,c: string) {} protected secret(a: string,b: string,c: string) {} #internal(a: string,b: string,c: string) {} }
    export interface API { configure(a: string,b: string,c: string): void; nested: { run(a: string,b: string,c: string): void }; }
    export const api = { nested: { run(a: string,b: string,c: string) {} } } as const;
    export type Factory = (a: string,b: string,c: string) => void;`);
  expect(rows.map(row => row.name)).toEqual(['Controller.constructor','Controller.start','API.configure','API.nested.run','api.nested.run','Factory']);
});
it('checks each method overload without treating its implementation as a callable signature', () => {
  const rows = inventory(`export class Controller {
    start(host: string, options: Options): void;
    /** @deprecated Use options. */ start(host: string, width: number, height: number): void;
    start(host: string, value: Options | number, height?: number): void {}
  }`);
  expect(rows).toHaveLength(2); expect(rows[0]).toMatchObject({ name: 'Controller.start', deprecated: false, optionsParam: true }); expect(rows[1].deprecated).toBe(true);
});
it('excludes this parameters, supports callable interfaces and inherited deprecation', () => {
  const rows = inventory(`export type Call = (this: object, a: string,b: string,c: string) => void;
  /** @deprecated Legacy owner. */ export interface Old { (a: string,b: string,c: string): void; }`);
  expect(rows[0].params).toHaveLength(3); expect(rows[1]).toMatchObject({ name: 'Old.[call]', deprecated: true });
});
it('keeps a same-named function lease from exempting a method or changed parameter type', () => {
  const entries = [{ pkg: 'demo', name: 'Controller.start', file: 'packages/demo/src/api.ts', params: ['host: string', 'width: number', 'height: number'] }];
  const row = { pkg: 'demo', name: 'Controller.start', file: 'packages/demo/src/api.ts', params: ['host: string', 'width:  number', 'height: number'] };
  expect(signatureAllowed(row, entries)).toBe(true); expect(signatureAllowed({ ...row, name: 'start' }, entries)).toBe(false);
  expect(signatureAllowed({ ...row, params: ['host: string', 'width: string', 'height: number'] }, entries)).toBe(false);
  expect(signatureAllowed({ ...row, file: 'packages/demo/src/other.ts' }, entries)).toBe(false);
});
it('does not let the presence of an options bag excuse another positional configuration parameter', () => {
  const [row] = inventory('export function create(host: string, width: number, options: Options): void {}');
  expect(row.params).toHaveLength(3); expect(row.optionsParam).toBe(true); expect(signatureAllowed({ pkg: 'demo', ...row }, [])).toBe(false);
});
it('includes exported class expressions and callable properties', () => {
  expect(inventory('export const Controller = class { run = (a: string,b: string,c: string) => {}; }; export interface API { run: (a: string,b: string,c: string) => void; }').map(row => row.name)).toEqual(['Controller.run', 'API.run']);
});
it('expands literal/readonly/nested rest tuples, including callable member types', () => {
  const rows = inventory(`export function create(...args: [host: string,width: number,height?: number]): void {}
    export interface API { run(...args: readonly [string, number, number]): void; }
    export type Nested = (...args: [...[string, number], number]) => void;`);
  expect(rows.map(row => row.params.length)).toEqual([3, 3, 3]);
  expect(rows[0].params).toEqual(['rest0: string', 'rest1: number', 'rest2?: number']);
});
it('retains each rest-union branch without combining its unrelated call shapes', () => {
  const rows = inventory('export function create(...args: [host: string,options: Options] | [host: string,width: number,height: number]): void {}');
  expect(rows.map(row => row.params.length)).toEqual([2, 3]); expect(rows[0].optionsParam).toBe(true);
});
it('does not pretend an unresolved rest alias was expanded by the syntax-only inventory', () => {
  const [row] = inventory('type Operands = [string,number,number]; export function create(...args: Operands): void {}');
  expect(row.params).toEqual(['...args: Operands']);
  // The declaration/checker graph, not this syntax inventory, resolves aliases.
});
it('rebases nested tuple labels after a preceding data operand', () => {
  const [row] = inventory('export function create(...args: [string,...[number,number]]): void {}');
  expect(row.params).toEqual(['rest0: string', 'rest1: number', 'rest2: number']);
});
it('binds the reviewed State/Form callback protocols to exact owner signatures, never a whole package', () => {
  const entries = JSON.parse(readFileSync(new URL('../positional-config.allowlist.json', import.meta.url), 'utf8')).categories.find(group => group.id === 'typed-data-operand-protocols').entries;
  const rows = inventory('export type WatchCallback<V,OV> = (newValue: V,oldValue: OV,onCleanup: WatchCleanupRegistrar) => void; export interface SignalObserver { onChange<T>(sig: Signal<T>,oldValue: T,newValue: T): void; }');
  expect(rows.every(row => signatureAllowed({ pkg: 'state', ...row }, entries))).toBe(true);
  expect(signatureAllowed({ pkg: 'form', ...rows[0] }, entries)).toBe(false);
  expect(signatureAllowed({ pkg: 'state', ...rows[0], params: ['newValue: V', 'oldValue: OV', 'options: OtherOptions'] }, entries)).toBe(false);
});
it('fails closed instead of allocating an unbounded Cartesian rest-tuple inventory', () => {
  const branches = Array.from({ length: 17 }, (_, i) => `[value: ${i}]`).join(' | ');
  expect(() => inventory(`export function create(...args: [...(${branches}),...(${branches})]): void {}`)).toThrow(/256 variants/);
});

it('narrows the existing Devtools change-event lease to its real readable capability and operands', () => {
  const categories = JSON.parse(readFileSync(new URL('../positional-config.allowlist.json', import.meta.url), 'utf8')).categories;
  const entries = categories.flatMap(group => group.entries);
  const [row] = inventory('export function recordStateChange<T>(sig: UntypedSignal<T>,oldValue: unknown,newValue: unknown): void {}');
  expect(signatureAllowed({ pkg: 'devtools-core', ...row }, entries)).toBe(true);
  expect(signatureAllowed({ pkg: 'devtools-core', ...row, params: ['sig: UntypedSignal<T>', 'oldValue: unknown', 'options: CaptureOptions'] }, entries)).toBe(false);
  expect(entries.filter(entry => entry.pkg === 'devtools-core' && entry.name === 'recordStateChange')).toHaveLength(1);
});

it('inventories real graph/hook options overloads without a broad positional waiver', () => {
  const entries = JSON.parse(readFileSync(new URL('../positional-config.allowlist.json', import.meta.url), 'utf8')).categories.flatMap(group => group.entries);
  for (const [pkg, file] of [
    ['devtools-core', 'packages/devtools-core/src/graph.ts'], ['devtools', 'packages/devtools/src/hook.ts'], ['devtools', 'packages/devtools/src/api.ts'],
  ]) {
    const rows = collectSourceSignatures(file, readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8'));
    const relevant = rows.filter(row => /(?:addSignal|addDirective|addStaticFor|recordResourceDestroy|recordPanelStateChange)$/.test(row.name));
    expect(relevant.length, file).toBeGreaterThan(0);
    for (const row of relevant) if (!row.deprecated) expect(row.params.length, `${file}:${row.name}`).toBeLessThanOrEqual(2);
    expect(entries.some(entry => entry.pkg === pkg && entry.name === 'recordPanelStateChange')).toBe(false);
  }
});
