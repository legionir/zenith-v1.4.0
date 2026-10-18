// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createHead, renderHead, headOptions } from '../src';
const releases: Array<() => void> = [];
function head() { const manager = createHead({ document }); releases.push(() => manager.dispose()); return manager; }
afterEach(() => { for (const release of releases.splice(0).reverse()) release(); document.head.replaceChildren(); document.body.replaceChildren(); document.documentElement.removeAttribute('lang'); document.documentElement.removeAttribute('dir'); vi.restoreAllMocks(); });
it('restores the exact borrowed SSR node, attributes and original text-node identity', () => {
  document.head.innerHTML = '<title data-zen-head="title" data-authored="yes">Server</title>'; const title = document.querySelector('title')!, text = title.firstChild, before = title.outerHTML; const manager = head(); manager.push({ title: 'Client' }); expect(document.querySelector('title')).toBe(title); expect(title.textContent).toBe('Client'); manager.dispose(); expect(title.outerHTML).toBe(before); expect(title.firstChild).toBe(text);
});
it('adopts an unmarked singleton title without adding a duplicate and restores it on final release', () => {
  document.head.innerHTML = '<title>Original</title>'; const title = document.querySelector('title')!; const manager = head(), entry = manager.push({ title: 'Managed' }); expect(document.title).toBe('Managed'); expect(document.querySelectorAll('title')).toHaveLength(1); entry.dispose(); flushSync(); expect(document.querySelector('title')).toBe(title); expect(document.title).toBe('Original'); expect(title.hasAttribute('data-zen-head')).toBe(false);
});
it('shares overlapping tags between managers and reveals the lower owner after upper disposal', () => {
  document.head.innerHTML = '<meta data-zen-head="meta:description" name="description" content="Original">'; const meta = document.querySelector('meta')!, before = meta.outerHTML; const a = head(), b = head(); a.push({ meta: [{ name: 'description', content: 'A' }] }); b.push({ meta: [{ name: 'description', content: 'B' }] }); expect(meta.content).toBe('B'); a.push({ meta: [{ name: 'description', content: 'A2' }] }); flushSync(); expect(meta.content).toBe('B'); b.dispose(); expect(meta.content).toBe('A2'); a.dispose(); expect(meta.outerHTML).toBe(before);
});
it('does not delete the remaining owner when the lower-priority manager is disposed first', () => {
  const a = head(), b = head(); a.push({ title: 'A' }); b.push({ title: 'B' }); a.dispose(); expect(document.title).toBe('B'); expect(document.querySelectorAll('title')).toHaveLength(1); b.dispose(); expect(document.querySelector('title')).toBeNull();
});
it('layers root attributes and restores the baseline rather than another manager snapshot', () => {
  document.documentElement.lang = 'en'; document.documentElement.dir = 'ltr'; const a = head(), b = head(); a.push({ htmlAttrs: { lang: 'fa', dir: 'rtl' }, bodyAttrs: { 'data-view': 'A' } }); b.push({ htmlAttrs: { lang: 'lt' }, bodyAttrs: { 'data-view': 'B' } }); expect(document.documentElement.lang).toBe('lt'); expect(document.documentElement.dir).toBe('rtl'); a.dispose(); expect(document.documentElement.lang).toBe('lt'); expect(document.documentElement.dir).toBe('ltr'); b.dispose(); expect(document.documentElement.lang).toBe('en'); expect(document.body.hasAttribute('data-view')).toBe(false);
});
it('keeps dedupe=false duplicates in both live DOM and SSR instead of collapsing them during reconciliation', () => {
  const manager = createHead({ document, dedupe: false }); releases.push(() => manager.dispose()); manager.push({ meta: [{ name: 'description', content: 'A' }, { name: 'description', content: 'B' }] }); expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(2); const template = document.createElement('template'); template.innerHTML = renderHead(manager).headTags; expect(template.content.querySelectorAll('meta[name="description"]')).toHaveLength(2);
});
it('accepts selective dedupe rules and callback title templates without evaluating titles as replacement syntax', () => {
  const manager = createHead({ titleTemplate: title => `${title} | Site`, dedupe: ['key'] }); releases.push(() => manager.dispose()); manager.push({ title: '$&', meta: [{ name: 'description', content: 'A' }, { name: 'description', content: 'B' }, { key: 'shared', content: 'C' }, { key: 'shared', content: 'D' }] }); expect(manager.resolve().title).toBe('$& | Site'); expect(manager.resolve().meta).toHaveLength(3); expect(manager.resolve().meta.at(-1)?.content).toBe('D');
});
it('rejects uppercase/control-obfuscated dangerous href and honors an empty script allowlist', () => {
  const manager = head(); expect(() => manager.push({ link: [{ rel: 'canonical', HREF: 'java\nscript:bad()' }] })).toThrowError(expect.objectContaining({ code: 'ZEN-1501' })); const noScripts = createHead({ allowScript: [] }); releases.push(() => noScripts.dispose()); expect(() => noScripts.push({ jsonLd: { name: 'No' } })).toThrowError(expect.objectContaining({ code: 'ZEN-1501' })); expect(document.querySelector('[data-zen-head]')).toBeNull(); expect(() => headOptions.resolve({ dedupe: ['bogus'] })).toThrow();
});
it('rolls back a failed initial insertion without removing a borrowed title and allows a later valid push', () => {
  document.head.innerHTML = '<title>Original</title>'; const manager = head(), append = document.head.append.bind(document.head); const spy = vi.spyOn(document.head, 'append').mockImplementationOnce(() => { throw new Error('insert failed'); }).mockImplementation((...nodes) => append(...nodes)); expect(() => manager.push({ title: 'Partial', meta: [{ name: 'description', content: 'No' }] })).toThrow('insert failed'); expect(document.title).toBe('Original'); expect(document.querySelector('meta')).toBeNull(); manager.push({ title: 'Valid' }); expect(document.title).toBe('Valid'); spy.mockRestore();
});
it('does not reclaim a tag moved by an outside owner during final disposal', () => {
  const manager = head(); manager.push({ title: 'Owned' }); const title = document.querySelector('title')!; document.body.append(title); manager.dispose(); expect(title.parentNode).toBe(document.body);
});
it('does not resurrect a newly inserted node after reentrant manager disposal', () => {
  const manager = head(), append = document.head.append.bind(document.head); vi.spyOn(document.head, 'append').mockImplementation((...nodes) => { manager.dispose(); append(...nodes); }); manager.push({ meta: [{ name: 'description', content: 'Late' }] }); expect(document.querySelector('[data-zen-head]')).toBeNull();
});
it('does not write reactive entries to a different document manager or after disposal', () => {
  const doc = document.implementation.createHTMLDocument('Foreign'), title = signal('A'), a = head(), b = createHead({ document: doc }); releases.push(() => b.dispose()); a.push({ title }); b.push({ title: 'B' }); title.set('Changed'); flushSync(); expect(document.title).toBe('Changed'); expect(doc.title).toBe('B'); a.dispose(); title.set('Late'); flushSync(); expect(document.querySelector('[data-zen-head]')).toBeNull(); expect(doc.title).toBe('B');
});
it('attempts independent node and root-attribute restoration even if one owned node cannot be removed', () => {
  document.documentElement.lang = 'en'; const manager = head(); manager.push({ meta: [{ name: 'description', content: 'A' }, { property: 'og:title', content: 'B' }], htmlAttrs: { lang: 'fa' }, bodyAttrs: { 'data-owned': 'yes' } }); const first = document.querySelector('meta[name="description"]')!, second = document.querySelector('meta[property="og:title"]')!; const spy = vi.spyOn(first, 'remove').mockImplementation(() => { throw new Error('remove failed'); }); expect(() => manager.dispose()).toThrow('remove failed'); expect(second.isConnected).toBe(false); expect(document.documentElement.lang).toBe('en'); expect(document.body.hasAttribute('data-owned')).toBe(false); spy.mockRestore(); const next = head(); next.push({ title: 'New owner' }); expect(first.isConnected).toBe(false);
});
