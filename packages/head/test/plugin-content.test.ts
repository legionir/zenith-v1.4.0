// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { createApp } from '@zenith/runtime-core';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { headPlugin } from '../src';
const releases: Array<() => void> = [];
function fixture(html: string, state: Record<string, unknown> = {}) { const root = document.createElement('main'); root.innerHTML = html; document.body.append(root); const app = createApp({ state, plugins: [headPlugin({ document })] }); releases.push(() => app.dispose()); return { root, app, start: () => app.mount(root) }; }
afterEach(() => { for (const release of releases.splice(0).reverse()) release(); document.head.replaceChildren(); document.body.replaceChildren(); });
it('projects custom-tag content and dedupes authored zen-head-key values, restoring original children', () => {
  const f = fixture('<zen-head><title>Authored title</title><meta name="description" content="first" zen-head-key="description"><meta name="description" content="last" zen-head-key="description"><link rel="canonical" href="/about"></zen-head>'); const source = f.root.querySelector('zen-head')!, nodes = Array.from(source.childNodes); f.start(); expect(source.childNodes).toHaveLength(0); expect(document.title).toBe('Authored title'); expect(document.head.querySelectorAll('meta')).toHaveLength(1); expect(document.head.querySelector('meta')!.content).toBe('last'); f.app.dispose(); expect(Array.from(source.childNodes)).toEqual(nodes); expect(document.head.querySelector('[data-zen-head]')).toBeNull();
});
it('shares one binder when both custom tag and explicit attribute are present', () => {
  const f = fixture('<zen-head zen-head><meta name="description" content="once"></zen-head>'); f.start(); expect(document.head.querySelectorAll('meta')).toHaveLength(1);
});
it('rejects unsupported/executable authored content without consuming its source children', () => {
  for (const html of ['<zen-head><div>Invalid</div></zen-head>', '<zen-head><script>bad()</script></zen-head>', '<zen-head><script type="application/ld+json" src="/bad"></script></zen-head>']) { const f = fixture(html), source = f.root.querySelector('zen-head')!, before = source.innerHTML; expect(() => f.start()).toThrowError(expect.objectContaining({ code: 'ZEN-1501' })); expect(source.innerHTML).toBe(before); expect(document.head.querySelector('[data-zen-head]')).toBeNull(); }
});
it('binds reactive field expressions to the same manager and releases the entry on element removal', async () => {
  const title = signal('First'), f = fixture('<span zen-head-title="$title"></span><span zen-head-description="\'Description\'" zen-head-key="summary"></span>', { title }); f.start(); expect(document.title).toBe('First'); title.set('Next'); flushSync(); expect(document.title).toBe('Next'); expect(document.querySelector('[data-zen-head="meta:summary"]')).not.toBeNull(); f.root.querySelector('[zen-head-title]')!.remove(); await Promise.resolve(); await Promise.resolve(); flushSync(); expect(document.querySelector('[data-zen-head="title"]')).toBeNull();
});
it('does not bind nested directives in authored head content', () => {
  const f = fixture('<zen-head><title zen-text="missingCall()">Literal title</title></zen-head>'); f.start(); expect(document.title).toBe('Literal title');
});
