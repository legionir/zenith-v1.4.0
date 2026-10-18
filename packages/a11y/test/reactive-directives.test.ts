// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '@zenith/runtime-core';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { a11yPlugin } from '../src';
const releases: Array<() => void> = [];
function mount(html: string, state: Record<string, unknown> = {}) { const root = document.createElement('main'); root.innerHTML = html; document.body.append(root); const app = createApp({ state, plugins: [a11yPlugin()] }); releases.push(() => app.dispose()); app.mount(root); return { root, app }; }
afterEach(() => { for (const release of releases.splice(0).reverse()) release(); document.body.replaceChildren(); document.body.removeAttribute('style'); vi.useRealTimers(); vi.restoreAllMocks(); });
it('acquires and releases inert only when the boolean expression changes', () => {
  const enabled = signal(false), { root, app } = mount('<section zen-inert="$enabled" aria-hidden="false"><button>Inside</button></section>', { enabled }); const el = root.querySelector('section')!; expect(el.hasAttribute('inert')).toBe(false); enabled.set(true); flushSync(); expect(el.hasAttribute('inert')).toBe(true); expect(el.getAttribute('aria-hidden')).toBe('true'); enabled.set(false); flushSync(); expect(el.hasAttribute('inert')).toBe(false); expect(el.getAttribute('aria-hidden')).toBe('false'); app.dispose(); enabled.set(true); flushSync(); expect(el.hasAttribute('inert')).toBe(false);
});
it('counts independent reactive scroll-lock owners and releases connected-root removal', async () => {
  const a = signal(true), b = signal(true); document.body.style.setProperty('overflow', 'scroll', 'important'); const { root } = mount('<section id="a" zen-scroll-lock="$a"></section><section id="b" zen-scroll-lock="$b"></section>', { a, b }); a.set(false); flushSync(); expect(document.body.style.overflow).toBe('hidden'); root.querySelector('#b')!.remove(); await Promise.resolve(); await Promise.resolve(); expect(document.body.style.overflow).toBe('scroll'); expect(document.body.style.getPropertyPriority('overflow')).toBe('important'); b.set(false); flushSync(); expect(document.body.style.overflow).toBe('scroll');
});
it('activates and deactivates focus trapping from a writable condition', () => {
  const active = signal(false), { root } = mount('<button id="before">Before</button><section zen-focus-trap="$active" zen-focus-trap-initial="#last"><button>First</button><button id="last">Last</button></section>', { active }); const before = root.querySelector<HTMLButtonElement>('#before')!; before.focus(); active.set(true); flushSync(); expect(document.activeElement?.id).toBe('last'); active.set(false); flushSync(); expect(document.activeElement).toBe(before); active.set(true); flushSync(); expect(document.activeElement?.id).toBe('last');
});
it('focuses on a false-to-true transition rather than treating the attribute as unconditional', () => {
  const enabled = signal(false), { root } = mount('<button id="first">First</button><button id="auto" zen-autofocus="$enabled">Auto</button>', { enabled }); root.querySelector<HTMLButtonElement>('#first')!.focus(); expect(document.activeElement?.id).toBe('first'); enabled.set(true); flushSync(); expect(document.activeElement?.id).toBe('auto'); enabled.set(false); flushSync(); root.querySelector<HTMLButtonElement>('#first')!.focus(); expect(document.activeElement?.id).toBe('first');
});
it('restores complete live-region attributes and rejects malformed ARIA settings', () => {
  const { root, app } = mount('<span zen-live="assertive" role="log" aria-live="off" aria-atomic="false"></span>'); const el = root.querySelector('span')!; expect(el.getAttribute('role')).toBe('alert'); expect(el.getAttribute('aria-atomic')).toBe('true'); app.dispose(); expect(el.getAttribute('role')).toBe('log'); expect(el.getAttribute('aria-live')).toBe('off'); expect(el.getAttribute('aria-atomic')).toBe('false'); expect(() => mount('<span zen-live="loud"></span>')).toThrow();
});
it('parses shared duration units and replaces announcements without retaining old timers', () => {
  vi.useFakeTimers(); const text = signal('<script>literal</script>'), { app } = mount('<span zen-announce="$text" zen-announce-clear="5s" zen-announce-politeness="assertive"></span>', { text }); let live = document.querySelector('[role="alert"]')!; expect(live.textContent).toBe('<script>literal</script>'); expect(live.querySelector('script')).toBeNull(); vi.advanceTimersByTime(4000); text.set('Next'); flushSync(); expect(live.isConnected).toBe(false); live = document.querySelector('[role="alert"]')!; vi.advanceTimersByTime(1001); expect(live.textContent).toBe('Next'); app.dispose(); expect(live.isConnected).toBe(false); expect(vi.getTimerCount()).toBe(0);
});
it('rejects invalid boolean/configuration before acquiring browser leases', () => {
  expect(() => mount('<section zen-scroll-lock="\'not-boolean\'"></section>')).toThrow(); expect(document.body.style.overflow).not.toBe('hidden'); expect(() => mount('<span zen-announce="\'Tip\'" zen-announce-clear="never"></span>')).toThrow(); expect(document.querySelector('[role="status"]')).toBeNull(); expect(() => mount('<section zen-focus-trap zen-focus-trap-return="perhaps"><button>A</button></section>')).toThrow();
});
it('suppresses effects and browser leases for explicit SSR documents', () => {
  Object.defineProperty(document, '__zenithSSR__', { configurable: true, value: true }); const getter = vi.fn(() => true); try { const { root } = mount('<section zen-inert="getter()" zen-scroll-lock="getter()"><button zen-autofocus="getter()">A</button></section>', { getter }); expect(getter).not.toHaveBeenCalled(); expect(root.querySelector('section')!.hasAttribute('inert')).toBe(false); expect(document.body.style.overflow).not.toBe('hidden'); } finally { Reflect.deleteProperty(document, '__zenithSSR__'); }
});
