// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createFocusTrap, getFocusable, inert, createLiveRegion, installRouteAnnouncer, prefersReducedMotion, type RouteAnnouncerOptions } from '../src';
const releases: Array<() => void> = [];
function root(html = '') { const el = document.createElement('main'); el.innerHTML = html; document.body.append(el); return el; }
afterEach(() => { for (const release of releases.splice(0).reverse()) release(); Reflect.deleteProperty(document, '__zenithSSR__'); document.body.replaceChildren(); document.title = ''; vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('evaluates callback initialFocus on each activation and rejects foreign callback targets', () => {
  const el = root('<button id="a">A</button><button id="b">B</button>'); let target = el.querySelector<HTMLButtonElement>('#b')!; const trap = createFocusTrap(el, { initialFocus: () => target }); releases.push(() => trap.dispose()); trap.activate(); expect(document.activeElement).toBe(target); trap.deactivate(); target = el.querySelector<HTMLButtonElement>('#a')!; trap.activate(); expect(document.activeElement).toBe(target); trap.deactivate(); const foreign = document.implementation.createHTMLDocument().createElement('button'); target = foreign; expect(() => trap.activate()).toThrowError(expect.objectContaining({ code: 'ZEN-1401' })); expect(trap.isActive()).toBe(false);
});
it('includes hidden focus candidates on request but not disabled or inert candidates', () => {
  const el = root('<button id="shown">Shown</button><div hidden><button id="hidden">Hidden</button></div><button style="display:none" id="css">CSS</button><button disabled>Disabled</button><div inert><button>Inert</button></div>'); expect(getFocusable(el).map(node => node.id)).toEqual(['shown']); expect(getFocusable(el, { includeHidden: true }).map(node => node.id)).toEqual(['shown', 'hidden', 'css']);
});
it('does not let inert(false) release another consumer or strip authored inert attributes', () => {
  const el = root(); el.setAttribute('inert', 'authored'); el.setAttribute('aria-hidden', 'false'); const release = inert(el); releases.push(release); inert(el, false)(); expect(el.getAttribute('aria-hidden')).toBe('true'); release(); expect(el.getAttribute('inert')).toBe('authored'); expect(el.getAttribute('aria-hidden')).toBe('false');
});
it.each([NaN, Infinity, -1, 2147483648])('rejects invalid live-region clearAfter %s without DOM mutation', clearAfter => { const before = document.body.innerHTML; expect(() => createLiveRegion({ clearAfter })).toThrowError(expect.objectContaining({ code: 'ZEN-1403' })); expect(document.body.innerHTML).toBe(before); });
it('uses document title and data-zen-main, preserving authored tabindex on release', () => {
  document.title = 'Current title'; const main = root('Main'); main.setAttribute('data-zen-main', ''); main.setAttribute('tabindex', '3'); let callback!: Parameters<RouteAnnouncerOptions['router']['afterEach']>[0]; const off = vi.fn(); const release = installRouteAnnouncer({ router: { afterEach(fn) { callback = fn; return off; } }, clearAfter: 0 }); releases.push(release); callback('/next'); expect(document.querySelector('[role="status"]')!.textContent).toBe('رفتید به Current title'); expect(document.activeElement).toBe(main); expect(main.getAttribute('tabindex')).toBe('3'); release(); release(); expect(off).toHaveBeenCalledTimes(1); callback('/late'); expect(document.querySelector('[role="status"]')).toBeNull();
});
it('unwinds a live region when router subscription throws and validates selectors before subscribing', () => {
  const subscribe = vi.fn(() => { throw new Error('hook failed'); }); expect(() => installRouteAnnouncer({ router: { afterEach: subscribe } })).toThrow('hook failed'); expect(document.querySelector('[aria-live]')).toBeNull(); subscribe.mockClear(); expect(() => installRouteAnnouncer({ router: { afterEach: subscribe }, mainSelector: '[' })).toThrowError(expect.objectContaining({ code: 'ZEN-1401' })); expect(subscribe).not.toHaveBeenCalled();
});
it('keeps SSR announcement/focus/motion entirely inert', () => {
  Object.defineProperty(document, '__zenithSSR__', { configurable: true, value: true }); const subscribe = vi.fn(() => () => {}), media = vi.fn(); vi.stubGlobal('matchMedia', media); const main = root('<button>A</button>'); const focus = vi.spyOn(main, 'focus'); const release = installRouteAnnouncer({ router: { afterEach: subscribe } }); releases.push(release); const preference = prefersReducedMotion(document); releases.push(() => preference.dispose()); expect(subscribe).not.toHaveBeenCalled(); expect(focus).not.toHaveBeenCalled(); expect(media).not.toHaveBeenCalled(); expect(preference.get()).toBe(false); expect(document.querySelector('[aria-live]')).toBeNull();
});
it('does not focus the main element when a title callback releases its own route owner', () => {
  const main = root(), focus = vi.spyOn(main, 'focus'); let callback!: Parameters<RouteAnnouncerOptions['router']['afterEach']>[0], release = () => {}; release = installRouteAnnouncer({ router: { afterEach(fn) { callback = fn; return () => {}; } }, title: () => { release(); return 'Late'; } }); releases.push(release); callback('/late'); expect(focus).not.toHaveBeenCalled(); expect(document.querySelector('[aria-live]')).toBeNull();
});
