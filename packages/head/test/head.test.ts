// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createHead, renderHead, useHead, titleFromRoute } from '../src';
afterEach(() => { document.head.innerHTML = ''; document.body.innerHTML = ''; });
describe('explicit head ownership and secure SSR', () => {
  it('isolates interleaved managers, dedupes last entry, and restores on disposal', () => {
    const a = createHead({ titleTemplate: '%s | A' }); const b = createHead();
    a.push({ title: 'one', meta: [{ name: 'description', content: 'first' }] }); b.push({ title: 'other' });
    const entry = useHead({ title: 'two', meta: [{ name: 'description', content: 'last' }] }, { head: a });
    expect(a.resolve().meta).toEqual([{ name: 'description', content: 'last' }]); expect(a.resolve().title).toBe('two | A'); expect(b.resolve().title).toBe('other');
    entry.patch({ title: 'three' }); expect(a.resolve().title).toBe('three | A'); entry.dispose(); entry.dispose(); expect(a.resolve().title).toBe('one | A'); a.dispose(); b.dispose();
  });
  it('tracks getters/field signals, reuses hydrated markers, restores root attrs', () => {
    document.head.innerHTML = '<title data-zen-head="title">server</title><meta data-zen-head="meta:description" name="description" content="server">';
    document.documentElement.setAttribute('dir', 'ltr'); const original = document.head.querySelector('title');
    const title = signal('server'); const description = signal('server'); const head = createHead({ document });
    const entry = head.push(() => ({ title, meta: [{ name: 'description', content: description.get() }], htmlAttrs: { dir: 'rtl' } })); flushSync();
    expect(document.head.querySelector('title')).toBe(original); expect(document.head.querySelectorAll('title')).toHaveLength(1);
    title.set('client'); description.set('changed'); flushSync(); expect(document.title).toBe('client'); expect(document.head.querySelector('meta')?.content).toBe('changed');
    entry.dispose(); flushSync(); expect(document.documentElement.dir).toBe('ltr'); head.dispose(); title.dispose(); description.dispose();
  });
  it('escapes title, attributes, JSON-LD closing tags and nonce values', () => {
    const head = createHead({ nonce: 'a"<b' }); head.push({ title: '<script>x</script>', meta: [{ name: 'description', content: '"<x>', onclick: 'bad()' }], jsonLd: { text: '</script><script>bad()</script>\u2028' }, htmlAttrs: { lang: 'fa', onload: 'bad()' } });
    const output = renderHead(head); expect(output.headTags).toContain('&lt;script&gt;'); expect(output.headTags).toContain('\\u003c/script\\u003e'); expect(output.headTags).not.toContain('onclick'); expect(output.htmlAttrs).not.toContain('onload'); expect(output.headTags).toContain('nonce="a&quot;&lt;b"'); head.dispose();
  });
  it('rejects executable scripts, control-obfuscated javascript URLs, invalid/cyclic JSON and excess tags', () => {
    const head = createHead({ maxTags: 1 }); expect(() => head.push({ script: [{ type: 'text/javascript', innerHTML: 'bad()' }] })).toThrow();
    expect(() => head.push({ link: [{ rel: 'canonical', href: 'java\nscript:bad()' }] })).toThrow();
    const circular: Record<string, unknown> = {}; circular.self = circular; expect(() => head.push({ jsonLd: circular })).toThrow();
    expect(() => head.push({ title: 'x', meta: [{ name: 'description', content: 'y' }] })).toThrow(); expect(head.resolve().title).toBeUndefined(); head.dispose();
  });
  it('supports route titles without requiring a router singleton', () => { expect(titleFromRoute({ path: '/about', meta: { title: 'About' } }, '%s | site')).toBe('About | site'); });
});

it('treats replacement-pattern titles literally and dedupes keyed JSON-LD', () => {
  const head = createHead({ titleTemplate: '%s | Site' }); head.push({ title: '$&', script: [{ key: 'site', json: { name: 'first' } }] }); head.push({ script: [{ key: 'site', json: { name: 'last' } }] });
  expect(head.resolve().title).toBe('$& | Site'); expect(head.resolve().jsonLd).toEqual([{ name: 'last' }]); head.dispose();
});
