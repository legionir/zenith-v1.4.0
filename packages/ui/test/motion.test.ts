// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createDialog, createPopover } from '../src';
const releases: Array<() => void> = [];
function root(html = '') { const el = document.createElement('section'); el.innerHTML = html; document.body.append(el); return el; }
function media(initial = false) {
  let reduced = initial; const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced; }, media: '(prefers-reduced-motion: reduce)', onchange: null, addEventListener: (_type: string, callback: EventListenerOrEventListenerObject) => { listeners.add(callback as () => void); }, removeEventListener: (_type: string, callback: EventListenerOrEventListenerObject) => { listeners.delete(callback as () => void); }, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => true }));
  return { set(value: boolean) { reduced = value; for (const callback of listeners) callback(); }, get count() { return listeners.size; } };
}
afterEach(() => { for (const release of releases.splice(0).reverse()) release(); document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('runs class-based enter/leave, makes closing content inert immediately and hides after completion', async () => {
  vi.useFakeTimers(); const el = root('<h2 zen-dialog-title>Title</h2><button>Inside</button>'), controller = createDialog(el, { transition: 'fade', transitionDuration: 20 }); releases.push(controller.dispose); controller.open(); expect(el.classList.contains('zen-enter-active')).toBe(true); controller.close(); expect(controller.state.peek()).toBe(false); expect(el.hidden).toBe(false); expect(el.getAttribute('aria-hidden')).toBe('true'); expect(el.hasAttribute('inert')).toBe(true); expect(document.body.style.overflow).not.toBe('hidden'); vi.advanceTimersByTime(100); await Promise.resolve(); expect(el.hidden).toBe(true); expect(el.className).toBe('');
});
it('does not allow a stale leave to hide a new opening and preserves authored transition classes', async () => {
  vi.useFakeTimers(); const trigger = root('<button>Open</button>').querySelector('button')!, el = root('Surface'); el.className = 'authored fade';
  const controller = createPopover(el, { trigger, transition: 'fade', transitionDuration: 20 }); releases.push(controller.dispose); controller.open(); controller.close(); controller.open(); vi.advanceTimersByTime(100); await Promise.resolve(); expect(el.hidden).toBe(false); expect(controller.state.peek()).toBe(true); expect(el.className).toBe('authored fade');
});
it('cancels in-flight leave when the owner is removed and releases motion listeners', async () => {
  vi.useFakeTimers(); const preference = media(), el = root('<h2 zen-dialog-title>Title</h2><button>Inside</button>'), before = el.outerHTML, controller = createDialog(el, { transition: 'fade', transitionDuration: 500 }); releases.push(controller.dispose); controller.open(); controller.close(); el.remove(); await Promise.resolve(); expect(preference.count).toBe(0); vi.advanceTimersByTime(1000); await Promise.resolve(); expect(el.outerHTML).toBe(before);
});
it('skips motion for reduced preference and finishes a running leave when preference changes', async () => {
  vi.useFakeTimers(); const preference = media(true), el = root('<h2 zen-dialog-title>Title</h2>'), controller = createDialog(el, { transition: 'fade', transitionDuration: 500 }); releases.push(controller.dispose); controller.open(); expect(el.className).toBe(''); controller.close(); expect(el.hidden).toBe(true); preference.set(false); controller.open(); controller.close(); expect(el.hidden).toBe(false); preference.set(true); await Promise.resolve(); expect(el.hidden).toBe(true); expect(el.className).toBe('');
});
it('reacts to motion config changes without emitting a new user state transition', () => {
  vi.useFakeTimers(); const el = root('<h2 zen-dialog-title>Title</h2>'), transition = signal<string | false>('fade'), controller = createDialog(el, { transition }); releases.push(controller.dispose); const close = vi.fn(); el.addEventListener('zen-dialog-close', close); controller.open(); controller.close(); transition.set(false); flushSync(); expect(el.hidden).toBe(true); expect(close).toHaveBeenCalledTimes(1);
});
it('never accesses animation or media APIs for explicit SSR rendering', () => {
  const doc = document.implementation.createHTMLDocument(); Object.defineProperty(doc, '__zenithSSR__', { value: true }); doc.body.innerHTML = '<section><h2 zen-dialog-title>Title</h2></section>'; const el = doc.body.firstElementChild as HTMLElement;
  const controller = createDialog(el, { initialOpen: true, transition: 'fade' }); releases.push(controller.dispose); expect(el.hidden).toBe(false); expect(el.className).toBe(''); controller.close(); expect(el.hidden).toBe(true);
});

it('reveals server-closed content rather than preserving server-owned inert/aria-hidden on open', () => {
  const el = root('<h2 zen-dialog-title>Hydrated</h2><button>Inside</button>'); el.setAttribute('aria-hidden', 'true'); el.setAttribute('inert', ''); el.hidden = true;
  const controller = createDialog(el); releases.push(controller.dispose); controller.open(); expect(el.hidden).toBe(false); expect(el.hasAttribute('inert')).toBe(false); expect(el.hasAttribute('aria-hidden')).toBe(false); expect(document.activeElement).toBe(el.querySelector('button'));
});
