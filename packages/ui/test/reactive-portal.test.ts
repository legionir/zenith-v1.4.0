// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createPortal } from '../src';
import { floatingRoots } from '../src/internal';
const releases: Array<() => void> = [];
function root(html = '') { const el = document.createElement('section'); el.innerHTML = html; document.body.append(el); return el; }
afterEach(() => { for (const release of releases.splice(0).reverse()) release(); Reflect.deleteProperty(document, '__zenithSSR__'); document.body.replaceChildren(); vi.restoreAllMocks(); });
it('moves between readable targets but retains one original marker/position and logical branch', () => {
  const source = root('<i>Before</i><aside>Content</aside><i>After</i>'), child = source.querySelector('aside')!, next = child.nextSibling, a = root(), b = root(), target = signal<HTMLElement>(a);
  const release = createPortal(child, { target }); releases.push(release); const marker = source.childNodes[1]; target.set(b); flushSync(); expect(child.parentElement).toBe(b); expect(source.childNodes[1]).toBe(marker); expect(floatingRoots(source)).toEqual([source, child]); target.set(a); flushSync(); release(); expect(child.parentElement).toBe(source); expect(child.nextSibling).toBe(next); expect(floatingRoots(source)).toEqual([source]); target.set(b); flushSync(); expect(child.parentElement).toBe(source);
});
it('shares one source with borrowers, and rejects a different reactive source instead of ignoring it', () => {
  const source = root('<aside>Content</aside>'), child = source.querySelector('aside')!, a = root(), b = root(), target = signal<HTMLElement>(a);
  const first = createPortal(child, { target }), second = createPortal(child, { target }), third = createPortal(child, { target: a }); releases.push(first, second, third);
  expect(() => createPortal(child, { target: signal(a) })).toThrowError(expect.objectContaining({ code: 'ZEN-1604' })); first(); target.set(b); flushSync(); expect(child.parentElement).toBe(b); second(); expect(child.parentElement).toBe(b); third(); expect(child.parentElement).toBe(source);
});
it('does not reclaim an externally moved element even before its removal observer runs', () => {
  const source = root('<aside>Content</aside>'), child = source.querySelector('aside')!, a = root(), b = root(), external = root(), target = signal<HTMLElement>(a), release = createPortal(child, { target }); releases.push(release);
  external.append(child); target.set(b); flushSync(); expect(child.parentElement).toBe(external); expect(floatingRoots(source)).toEqual([source]); release(); expect(child.parentElement).toBe(external);
});
it('restores once and stops the readable when the latest destination disappears', async () => {
  const source = root('<aside>Content</aside>'), child = source.querySelector('aside')!, a = root(), b = root(), target = signal<HTMLElement>(a), release = createPortal(child, { target }); releases.push(release);
  target.set(b); flushSync(); a.remove(); await Promise.resolve(); expect(child.parentElement).toBe(b); b.remove(); await Promise.resolve(); expect(child.parentElement).toBe(source); target.set(document.body); flushSync(); expect(child.parentElement).toBe(source);
});
it('releases during a reconnect without resurrecting the new target or its cache entry', () => {
  let release: (() => void) | undefined;
  class PortalFixture extends HTMLElement { connectedCallback() { if (this.parentElement?.id === 'release-portal-target') release?.(); } }
  if (!customElements.get('zen-reactive-portal-release')) customElements.define('zen-reactive-portal-release', PortalFixture);
  const source = root(), a = root(), b = root(); b.id = 'release-portal-target'; const child = document.createElement('zen-reactive-portal-release'); source.append(child); const target = signal<HTMLElement>(a); release = createPortal(child, { target }); releases.push(release); target.set(b); flushSync(); expect(child.parentElement).toBe(source); expect(floatingRoots(source)).toEqual([source]); const newer = createPortal(child, { target: a }); releases.push(newer); release(); expect(child.parentElement).toBe(a);
});
it('does not move or subscribe in an explicitly server-owned document', () => {
  Object.defineProperty(document, '__zenithSSR__', { configurable: true, value: true }); const source = root('<aside>Content</aside>'), child = source.querySelector('aside')!, a = root(), target = signal<HTMLElement>(a), before = source.innerHTML, release = createPortal(child, { target }); releases.push(release); target.set(document.body); flushSync(); expect(source.innerHTML).toBe(before); expect(child.parentElement).toBe(source); expect(floatingRoots(source)).toEqual([source]);
});
it('observes a destination removed inside a shadow root', async () => {
  const source = root('<aside>Content</aside>'), child = source.querySelector('aside')!, host = root(), shadow = host.attachShadow({ mode: 'open' }), target = document.createElement('div'); shadow.append(target); releases.push(createPortal(child, { target })); target.remove(); await Promise.resolve(); expect(child.parentElement).toBe(source); expect(floatingRoots(source)).toEqual([source]);
});
it('restores if the source is removed synchronously during a destination reconnect', () => {
  let source: HTMLElement;
  class RemovingFixture extends HTMLElement { connectedCallback() { if (this.parentElement?.id === 'remove-origin-target') source.remove(); } }
  if (!customElements.get('zen-reactive-portal-origin-removal')) customElements.define('zen-reactive-portal-origin-removal', RemovingFixture);
  source = root(); const a = root(), b = root(); b.id = 'remove-origin-target'; const child = document.createElement('zen-reactive-portal-origin-removal'); source.append(child); const target = signal<HTMLElement>(a); releases.push(createPortal(child, { target })); target.set(b); flushSync(); expect(child.parentElement).toBe(source); expect(child.isConnected).toBe(false); expect(floatingRoots(source)).toEqual([source]);
});
it('retains composed ancestry when the origin is nested inside a shadow tree', () => {
  const outer = root(), host = document.createElement('div'); outer.append(host); const shadow = host.attachShadow({ mode: 'open' }), source = document.createElement('section'), child = document.createElement('aside'); source.append(child); shadow.append(source); const release = createPortal(child, { target: document.body }); releases.push(release); expect(floatingRoots(source)).toContain(child); expect(floatingRoots(host)).toContain(child); expect(floatingRoots(outer)).toContain(child); release(); expect(child.parentElement).toBe(source); expect(floatingRoots(outer)).toEqual([outer]);
});
it('rejects moving a shadow host into its own composed descendants before inserting a marker', () => {
  const source = root(), host = document.createElement('div'); source.append(host); const shadow = host.attachShadow({ mode: 'open' }), target = document.createElement('section'); shadow.append(target); const before = source.innerHTML; expect(() => createPortal(host, { target })).toThrowError(expect.objectContaining({ code: 'ZEN-1604' })); expect(source.innerHTML).toBe(before); expect(host.parentElement).toBe(source);
});
