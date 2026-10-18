import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { createOptionsObjectRule, optionsObjectRule } from '../src/rules/options-object.js';

RuleTester.describe = describe;
RuleTester.it = it;
const tester = new RuleTester({ languageOptions: { parser: tseslint.parser, ecmaVersion: 2022, sourceType: 'module' } });

tester.run('zenith/options-object', optionsObjectRule, {
  valid: [
    'export function read(value: string): void {}',
    'export const read = (value: string, options?: ReadOptions) => value;',
    'export function read(value: string, options: { locale?: string } = {}): void {}',
    'function internal(a: string, b: string, c: string): void {}',
    '/** @deprecated Use the options overload. */ export function old(a: string, b: string, c: string): void {}',
    '/** @deprecated */ export function make(v: string, locale: string, opts: Options): void; export function make(v: string, opts: Options): void; export function make(v: string, arg: string | Options, opts?: Options): void {}',
  ],
  invalid: [
    { code: 'export function make(host: string, width: number, height: number): void {}', errors: [{ messageId: 'optionsObject' }] },
    { code: 'export const make = (host: string, width: number, height: number) => host;', errors: [{ messageId: 'optionsObject' }] },
    { code: 'export const make = function(host: string, width: number, height: number) {};', errors: [{ messageId: 'optionsObject' }] },
    { code: 'export function make(value: string, locale: string, options: Options): void {}', errors: [{ messageId: 'optionsObject' }] },
    { code: 'export declare function make(a: string, b: string, c: string): void;', errors: [{ messageId: 'optionsObject' }] },
    { code: 'export function make(v: string, options: Options): void; export function make(v: string, locale: string, options: Options): void; export function make(v: string, arg: string | Options, options?: Options): void {}', errors: [{ messageId: 'optionsObject' }] },
  ],
});

tester.run('zenith/options-object signature-bound legacy lease', createOptionsObjectRule({ allowlist: [{ pkg: 'fixture', name: 'legacy', params: ['a: string', 'b: string', 'c: string'] }] }), {
  valid: [{ filename: '/packages/fixture/src/index.ts', code: 'export function legacy(a: string, b: string, c: string): void {}' }],
  invalid: [{ filename: '/packages/fixture/src/index.ts', code: 'export function legacy(a: string, b: string, c: number): void {}', errors: [{ messageId: 'optionsObject' }] }],
});

tester.run('zenith/options-object public members', optionsObjectRule, {
  valid: [
    'export class API { run(host: string, options: Options): void {} private helper(a: string,b: string,c: string) {} }',
    'export interface API { run(host: string, options: Options): void; }',
    'export const api = { run(host: string, options: Options) {} };',
    '/** @deprecated */ export interface Old { run(a: string,b: string,c: string): void }',
    'export class API { run(host: string, options: Options): void; /** @deprecated */ run(host: string,width: number,height: number): void; run(host: string, value: Options | number, height?: number): void {} }',
  ],
  invalid: [
    { code: 'export class API { run(host: string,width: number,height: number) {} }', errors: [{ messageId: 'optionsObject' }] },
    { code: 'export interface API { run(host: string,width: number,height: number): void; }', errors: [{ messageId: 'optionsObject' }] },
    { code: 'export const api = { run(host: string,width: number,height: number) {} };', errors: [{ messageId: 'optionsObject' }] },
    { code: 'export type API = { run: (host: string,width: number,height: number) => void };', errors: [{ messageId: 'optionsObject' }] },
    { code: 'export class API { constructor(host: string,width: number,height: number) {} }', errors: [{ messageId: 'optionsObject' }] },
    { code: 'export const API = class { run = (host: string,width: number,height: number) => {}; };', errors: [{ messageId: 'optionsObject' }] },
  ],
});

tester.run('zenith/options-object direct rest tuple variants', optionsObjectRule, {
  valid: [
    'export function read(...args: [value: string,options?: Options]): void {}',
    '/** @deprecated Use options. */ export function legacy(...args: [host: string,width: number,height: number]): void {}',
    'export interface API { run(...args: [host: string,options: Options] | [host: string]): void; }',
    'function internal(...args: [string,number,number]): void {}',
    'export type Read = (...args: [string,Options]) => void;',
  ],
  invalid: [
    { code: 'export function make(...args: [host: string,width: number,height: number]): void {}', errors: [{ messageId: 'optionsObject' }] },
    { code: 'export interface API { run(...args: [host: string,width?: number,height?: number]): void; }', errors: [{ messageId: 'optionsObject' }] },
    { code: 'export type Factory = (...args: [string,number,number]) => void;', errors: [{ messageId: 'optionsObject' }] },
    { code: 'export const make = (...args: [string,Options] | [string,number,number]) => {};', errors: [{ messageId: 'optionsObject' }] },
    { code: 'export class API { run(...args: [...[string,number],number]): void {} }', errors: [{ messageId: 'optionsObject' }] },
  ],
});
