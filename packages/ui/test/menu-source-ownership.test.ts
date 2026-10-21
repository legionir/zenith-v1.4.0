// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createApp } from '@zenith/runtime-core';
import { createMenu, uiPlugin, type MenuOptions } from '../src';
const releases: Array<() => void> = [];
function root(html = '') { const el = document.createElement('section'); el.innerHTML = html; document.body.append(el); return el; }
function fixture(input: Omit<MenuOptions, 'trigger'> = {}) { const trigger = root('<button>Open</button>').querySelector('button')!, el = root('<button zen-menu-item>Alpha</button><button zen-menu-item>Beta</button>'), menu = createMenu(el, { trigger, ...input }); releases.push(menu.dispose); return { el, trigger, menu }; }
afterEach(() => { for (const release of releases.splice(0).reverse()) release(); document.body.replaceChildren(); vi.restoreAllMocks(); });
it('keeps the original live sources after the first lease is released', () => {
  const loop = signal(false), closeOnSelect = signal(false), { el, trigger, menu } = fixture({ loop, closeOnSelect }); const borrowed = createMenu(el, { trigger, loop, closeOnSelect }); releases.push(borrowed.dispose); menu.dispose(); borrowed.open(); const items = el.querySelectorAll('button'); items[1]!.focus(); items[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); expect(document.activeElement).toBe(items[1]); loop.set(true); flushSync(); items[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); expect(document.activeElement).toBe(items[0]); items[0]!.click(); expect(borrowed.state.peek()).toBe(true); closeOnSelect.set(true); flushSync(); items[0]!.click(); expect(borrowed.state.peek()).toBe(false);
});
it('rejects different readable sources even when their values initially agree', () => {
  const loop = signal(true), other = signal(true), { el, menu } = fixture({ loop }); const before = el.outerHTML; expect(() => createMenu(el, { loop: other })).toThrowError(expect.objectContaining({ code: 'ZEN-1603' })); expect(el.outerHTML).toBe(before); menu.open(); expect(menu.state.peek()).toBe(true); other.set(false); flushSync(); expect(menu.state.peek()).toBe(true);
});
it.each(['loop', 'typeahead', 'closeOnSelect'] as const)('rejects conflicting concrete %s without altering the current controller', key => {
  const { el, menu } = fixture(); const before = el.outerHTML; expect(() => createMenu(el, { [key]: false })).toThrowError(expect.objectContaining({ code: 'ZEN-1603' })); expect(el.outerHTML).toBe(before); menu.open(); expect(menu.state.peek()).toBe(true);
});
it('compares only supplied fields and the current configuration, not stale initial values', () => {
  const loop = signal(false), { el, menu } = fixture({ loop }); loop.set(true); flushSync(); const omitted = createMenu(el), concrete = createMenu(el, { loop: true }); releases.push(omitted.dispose, concrete.dispose); menu.dispose(); omitted.dispose(); concrete.open(); expect(concrete.state.peek()).toBe(true); expect(() => createMenu(el, { loop: false })).toThrowError(expect.objectContaining({ code: 'ZEN-1603' }));
});
it('normalizes same-trigger selectors and translates malformed selectors to the reserved target error', () => {
  const { el, trigger, menu } = fixture(); trigger.id = 'shared-menu-trigger'; const borrowed = createMenu(el, { trigger: '#shared-menu-trigger' }); releases.push(borrowed.dispose); expect(() => createMenu(el, { trigger: '[' })).toThrowError(expect.objectContaining({ code: 'ZEN-1601' })); borrowed.dispose(); menu.open(); expect(menu.state.peek()).toBe(true);
});
it('rejects a competing floating source rather than silently dropping its future geometry changes', () => {
  const placement = signal<'bottom' | 'right'>('bottom'), { el } = fixture({ placement }); expect(() => createMenu(el, { placement: signal('bottom' as const) })).toThrowError(expect.objectContaining({ code: 'ZEN-1603' })); expect(() => createMenu(el, { offset: 99 })).toThrowError(expect.objectContaining({ code: 'ZEN-1603' }));
});
it('attaches to a preconfigured child without overwriting its own sources with parent defaults', () => {
  const trigger = root('<button>Parent</button>').querySelector('button')!, parent = root('<button zen-menu-item zen-menu-submenu="#owned-child">More</button>'), item = parent.querySelector('button')!, child = root('<button zen-menu-item>Child</button>'); child.id = 'owned-child'; const closeOnSelect = signal(false); const own = createMenu(child, { trigger: item, triggerOn: 'manual', closeOnSelect, placement: 'bottom' }); releases.push(own.dispose); const outer = createMenu(parent, { trigger }); releases.push(outer.dispose); outer.open(); item.click(); child.querySelector('button')!.click(); expect(own.state.peek()).toBe(true); expect(outer.state.peek()).toBe(true); outer.dispose(); closeOnSelect.set(true); flushSync(); own.open(); child.querySelector('button')!.click(); expect(own.state.peek()).toBe(false);
});
it('does not manufacture competing defaults when the walker reaches an inherited submenu', () => {
  const el = root('<button id="directive-menu-trigger">Open</button><section zen-menu zen-menu-trigger="#directive-menu-trigger" zen-menu-close-on-select="false"><button zen-menu-item zen-menu-submenu="#directive-child">More</button><section zen-menu id="directive-child"><button zen-menu-item>Child</button></section></section>'); const app = createApp({ plugins: [uiPlugin()] }); releases.push(() => app.dispose()); app.mount(el); el.querySelector<HTMLButtonElement>('#directive-menu-trigger')!.click(); el.querySelector<HTMLButtonElement>('[zen-menu-submenu]')!.click(); expect(el.querySelector<HTMLElement>('#directive-child')!.hidden).toBe(false); el.querySelector<HTMLButtonElement>('#directive-child button')!.click(); expect(el.querySelector<HTMLElement>('#directive-child')!.hidden).toBe(false);
});
it('fully restores the authored tree only on final release and permits a new source afterward', () => {
  const { el, trigger, menu } = fixture(), borrowed = createMenu(el); releases.push(borrowed.dispose); menu.dispose(); borrowed.dispose(); const next = createMenu(el, { trigger, loop: signal(false) }); releases.push(next.dispose); next.open(); expect(next.state.peek()).toBe(true); menu.close(); expect(next.state.peek()).toBe(true);
});

it('can acquire the identical source before its queued update is applied', () => {
  const loop = signal(false), { el, menu } = fixture({ loop }); loop.set(true); const borrowed = createMenu(el, { loop }); releases.push(borrowed.dispose); flushSync(); menu.dispose(); borrowed.open(); const items = el.querySelectorAll('button'); items[1]!.focus(); items[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); expect(document.activeElement).toBe(items[0]);
});
