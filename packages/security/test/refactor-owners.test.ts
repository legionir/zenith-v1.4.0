// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import * as api from '../src';
import * as facade from '../src/sanitizer';
import * as html from '../src/html';
import * as css from '../src/css';
import * as csp from '../src/csp';
import * as trusted from '../src/trusted-types';
import { sanitizeHTMLTrusted } from '../src/trusted-html';
import { resetDeprecationWarnings } from '@zenith/errors';
import { setHostPrinter } from '@zenith/errors/internal';
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const stop of cleanups.splice(0).reverse()) stop();
  api.resetTrustedTypesPolicyCache(); resetDeprecationWarnings(); vi.unstubAllGlobals();
});
function installFactory(createPolicy: api.TrustedTypePolicyFactory['createPolicy']): void {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'trustedTypes');
  cleanups.push(() => { if (descriptor) Object.defineProperty(window, 'trustedTypes', descriptor); else Reflect.deleteProperty(window, 'trustedTypes'); });
  Object.defineProperty(window, 'trustedTypes', { configurable: true, writable: true, value: { createPolicy } });
}
it('preserves all established sanitizer facade identities and one cache owner', () => {
  for (const [key, fn] of Object.entries({ sanitizeHTML: html.sanitizeHTML, sanitizeHTMLWithOptions: html.sanitizeHTMLWithOptions, sanitizeHTMLInDocument: html.sanitizeHTMLInDocument, sanitizeHTMLTrusted, sanitizeCSS: css.sanitizeCSS, generateCSP: csp.generateCSP, createTrustedTypesPolicy: trusted.createTrustedTypesPolicy, resetTrustedTypesPolicyCache: trusted.resetTrustedTypesPolicyCache, setSafeInnerHTML: trusted.setSafeInnerHTML })) {
    expect(Reflect.get(api, key)).toBe(fn); expect(Reflect.get(facade, key)).toBe(fn);
  }
  const create = vi.fn(() => ({ createHTML: (value: string) => value, createScriptURL: (value: string) => value })); installFactory(create);
  const first = api.createTrustedTypesPolicy(); expect(facade.createTrustedTypesPolicy()).toBe(first); expect(trusted.createTrustedTypesPolicy()).toBe(first);
  expect(create).toHaveBeenCalledTimes(1);
  facade.resetTrustedTypesPolicyCache(); expect(trusted.createTrustedTypesPolicy()).not.toBe(first); expect(create).toHaveBeenCalledTimes(2);
});
it('retains default denylist and customized allowlist behavior without mutating the default policy', () => {
  const input = '<x-card onclick="evil()"><p>safe</p></x-card><script>evil()</script>';
  expect(api.sanitizeHTML(input)).toBe('<x-card><p>safe</p></x-card>');
  expect(api.sanitizeHTMLWithOptions(input)).toBe('');
  expect(api.sanitizeHTMLWithOptions(input, { allowTags: ['X-CARD'] })).toBe('<x-card><p>safe</p></x-card>');
  expect(api.sanitizeHTMLWithOptions('<p>x</p><b>y</b>', { forbidTags: ['p'] })).toBe('<b>y</b>');
  expect(api.sanitizeHTMLWithOptions(input)).toBe('');
  expect(api.sanitizeHTML(input)).toBe('<x-card><p>safe</p></x-card>');
});
it('retains protocol/control-character, srcset, style, template and image handling', () => {
  const dirty = '<a href="java\tscript:evil()" onclick="x()">a</a><img src="data:image/png;base64,AAAA" srcset="/ok.jpg 1x, javascript:evil() 2x"><p style="behavior:url(x)">x</p><template><script>evil()</script></template>';
  const result = api.sanitizeHTML(dirty);
  expect(result).not.toContain('href='); expect(result).not.toContain('onclick'); expect(result).not.toContain('srcset'); expect(result).not.toContain('style='); expect(result).not.toContain('template');
  expect(result).toContain('src="data:image/png;base64,AAAA"');
  const owned = document.implementation.createHTMLDocument('owned');
  expect(api.sanitizeHTMLInDocument('<p onclick="evil()">owned</p>', owned)).toBe('<p>owned</p>');
});
it('retains the historical non-DOM fallback without asserting DOM-equivalent safety', () => {
  vi.stubGlobal('DOMParser', undefined);
  const input = '<script>bad()</script><p>ok</p><template><p>hidden</p></template>';
  expect(api.sanitizeHTML(input)).toBe('<p>ok</p>');
  expect(api.sanitizeHTMLWithOptions(input, { forbidTags: ['p'] })).toBe('<p>ok</p>');
});
it('keeps CSS/CSP ordering and nonce/Trusted Types header behavior', () => {
  expect(api.sanitizeCSS('@import "evil"; .x { behavior:url(x); color:red; }')).not.toContain('@import');
  expect(api.generateCSP({ nonce: 'abc', strictDynamic: true, requireTrustedTypes: true })).toBe("default-src 'self'; script-src 'self' 'nonce-abc' 'strict-dynamic'; style-src 'self' 'nonce-abc'; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; base-uri 'self'; require-trusted-types-for 'script'; trusted-types zenith");
});
it('passes native opaque policy output to the sink without stringifying or claiming a string type', () => {
  const opaque = Object.freeze({ nativeHTML: true }); let valueAtSink: unknown; let policyInput = '';
  installFactory((_name, rules) => ({ createHTML(input) { policyInput = rules.createHTML?.(input) ?? input; return opaque; }, createScriptURL: () => ({ nativeURL: true }) }));
  const element = document.createElement('div'); Object.defineProperty(element, 'innerHTML', { configurable: true, set(value: unknown) { valueAtSink = value; } });
  api.setSafeInnerHTML(element, { html: '<p onclick="evil()">ok</p>' });
  expect(valueAtSink).toBe(opaque); expect(policyInput).toBe('<p>ok</p>');
});
it('validates canonical sink configuration and retains once-only legacy warnings/defaults', () => {
  const messages: string[] = []; cleanups.push(setHostPrinter((_severity, title) => messages.push(title)));
  const element = document.createElement('div');
  api.setSafeInnerHTML(element, { html: '<p onclick="x()">ok</p>' }); expect(element.innerHTML).toBe('<p>ok</p>');
  expect(messages.some(message => message.includes('ZEN-DEPR-092'))).toBe(false);
  api.setSafeInnerHTML(element, '<b>legacy</b>'); expect(element.innerHTML).toBe('<b>legacy</b>');
  api.setSafeInnerHTML(element, '<p>trusted</p>', true);
  api.setSafeInnerHTML(element, undefined as unknown as string, undefined); expect(element.innerHTML).toBe('');
  expect(messages.filter(message => message.includes('ZEN-DEPR-092'))).toHaveLength(1);
  // @ts-expect-error Canonical sink contents are strings.
  expect(() => api.setSafeInnerHTML(element, { html: 1 })).toThrow();
  // @ts-expect-error Canonical trust flags are boolean.
  expect(() => api.setSafeInnerHTML(element, { html: '', trusted: 'yes' })).toThrow();
});
it('does not bypass an installed sanitizing policy for the trusted marker and retains URL policy behavior', () => {
  installFactory((_name, rules) => ({ createHTML: input => rules.createHTML?.(input) ?? input, createScriptURL: input => rules.createScriptURL?.(input) ?? input }));
  const element = document.createElement('div'); api.setSafeInnerHTML(element, { html: '<p onclick="evil()">ok</p>', trusted: true });
  expect(element.innerHTML).toBe('<p>ok</p>');
  const policy = api.createTrustedTypesPolicy()!;
  expect(policy.createScriptURL('/local.js')).toBe('/local.js');
  expect(policy.createScriptURL('https://outside.example/script.js')).toBe('');
});
it('preserves cache behavior when policy creation throws and returns null without a browser', () => {
  installFactory(() => { throw new Error('duplicate policy'); }); expect(api.createTrustedTypesPolicy()).toBeNull();
  vi.stubGlobal('window', undefined); expect(api.createTrustedTypesPolicy()).toBeNull();
});
