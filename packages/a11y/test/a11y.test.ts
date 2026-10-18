// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest';
import { createFocusTrap, createRovingTabindex, getFocusable, lockScroll, inert, createIdScope, useId, createLiveRegion, prefersReducedMotion } from '../src';
afterEach(() => { document.body.innerHTML = ''; vi.useRealTimers(); vi.restoreAllMocks(); });
function root(html: string) { const el = document.createElement('div'); el.innerHTML = html; document.body.append(el); return el; }
function key(el: HTMLElement, value: string, shiftKey = false) { el.dispatchEvent(new KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true })); }
describe('focus and environment leases', () => {
  it('wraps dynamically added focusables, ignores hidden/disabled nodes, and restores the opener', () => {
    const opener = document.createElement('button'); document.body.append(opener); opener.focus();
    const el = root('<button id="a">a</button><div hidden><button>hidden</button></div><button disabled>no</button><button id="b">b</button>');
    const trap = createFocusTrap(el); trap.activate(); expect(document.activeElement?.id).toBe('a'); expect(getFocusable(el)).toHaveLength(2);
    el.querySelector<HTMLElement>('#b')!.focus(); key(document.activeElement as HTMLElement, 'Tab'); expect(document.activeElement?.id).toBe('a');
    key(document.activeElement as HTMLElement, 'Tab', true); expect(document.activeElement?.id).toBe('b');
    const extra = document.createElement('button'); extra.id = 'c'; el.append(extra); extra.focus(); key(extra, 'Tab'); expect(document.activeElement?.id).toBe('a');
    trap.dispose(); trap.dispose(); expect(document.activeElement).toBe(opener);
  });
  it('suspends the outer trap until the inner is disposed; Escape affects only the top', () => {
    const outer = root('<button id="outer">outer</button>'); const inner = root('<button id="inner">inner</button>');
    const a = createFocusTrap(outer); const b = createFocusTrap(inner); a.activate(); b.activate(); key(inner.querySelector('button')!, 'Escape');
    expect(b.isActive()).toBe(false); expect(a.isActive()).toBe(true); expect(document.activeElement?.id).toBe('outer'); a.dispose(); b.dispose();
  });
  it('handles pause/unpause, an empty fallback, outside click and DOM removal', async () => {
    const el = root('empty'); const trap = createFocusTrap(el); trap.activate(); expect(document.activeElement).toBe(el); trap.pause(); trap.unpause();
    el.remove(); await Promise.resolve(); expect(trap.isActive()).toBe(false); expect(el.hasAttribute('tabindex')).toBe(false); trap.dispose();
    const other = root('<button>inside</button>'); const trap2 = createFocusTrap(other, { clickOutsideDeactivates: true }); trap2.activate(); document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); expect(trap2.isActive()).toBe(false); trap2.dispose();
  });
  it('counts independent scroll/inert leases and restores the original values exactly', () => {
    document.body.style.setProperty('overflow', 'scroll', 'important'); const a = lockScroll(document), b = lockScroll(document); a(); a(); expect(document.body.style.overflow).toBe('hidden'); b(); expect(document.body.style.overflow).toBe('scroll'); expect(document.body.style.getPropertyPriority('overflow')).toBe('important');
    const el = root(''); el.setAttribute('aria-hidden', 'false'); const c = inert(el), d = inert(el); c(); expect(el.inert).toBe(true); d(); expect(el.getAttribute('aria-hidden')).toBe('false');
  });
  it('supports RTL roving, disabled skip and exact tabindex restoration', () => {
    const el = root('<button tabindex="3">one</button><button disabled>no</button><button>two</button>'); el.dir = 'rtl'; const items = el.querySelectorAll('button'); const dispose = createRovingTabindex(el);
    items[0]!.focus(); key(items[0]!, 'ArrowLeft'); expect(document.activeElement).toBe(items[2]); key(items[2]!, 'Home'); expect(document.activeElement).toBe(items[0]); dispose(); expect(items[0]!.getAttribute('tabindex')).toBe('3'); expect(items[2]!.hasAttribute('tabindex')).toBe(false);
  });
  it('produces deterministic independent request ID sequences', () => {
    const a = createIdScope(), b = createIdScope(); expect(useId({ scope: a })).toBe(useId({ scope: b })); expect(useId({ scope: a, prefix: 'dialog' })).toBe(useId({ scope: b, prefix: 'dialog' }));
  });
  it('owns matchMedia listeners and changes reactively', () => {
    let changed: (() => void) | undefined; const media = { matches: false, addEventListener: vi.fn((_name: string, handler: () => void) => { changed = handler; }), removeEventListener: vi.fn() };
    vi.stubGlobal('matchMedia', () => media); const pref = prefersReducedMotion(document); expect(pref.get()).toBe(false); media.matches = true; changed?.(); expect(pref.get()).toBe(true); pref.dispose(); pref.dispose(); expect(media.removeEventListener).toHaveBeenCalledTimes(1); vi.unstubAllGlobals();
  });
  it('announces text rather than interpreting markup and removes owned live regions', () => {
    const live = createLiveRegion({ doc: document }); live.announce('<img onerror=bad()>'); expect(document.body.querySelector('img')).toBeNull(); live.dispose(); expect(document.body.children).toHaveLength(0);
  });
});

it('rejects a trap bound to a different document and invalid live ARIA values', () => {
  const el = root('<button>ok</button>'); const other = document.implementation.createHTMLDocument();
  expect(() => createFocusTrap(el, { doc: other })).toThrow();
  expect(() => createLiveRegion({ politeness: 'invalid' as 'polite' })).toThrow();
});
