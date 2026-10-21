// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createTabs, tabsOptions, createAccordion, accordionOptions } from '../src';
const releases: Array<() => void> = [];
function root(html: string) { const el = document.createElement('section'); el.innerHTML = html; document.body.append(el); return el; }
function tabsRoot() { return root('<div zen-tablist><button zen-tab>A</button><button zen-tab>B</button><button zen-tab disabled>C</button></div><section zen-tabpanel>A panel</section><section zen-tabpanel>B panel</section><section zen-tabpanel>C panel</section>'); }
function accordionRoot() { return root('<article zen-accordion-item><button zen-accordion-trigger>A</button><section zen-accordion-panel>A panel</section></article><article zen-accordion-item><button zen-accordion-trigger>B</button><section zen-accordion-panel>B panel</section></article>'); }
function key(el: HTMLElement, value: string) { el.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })); }
afterEach(() => { for (const release of releases.splice(0)) release(); document.body.replaceChildren(); vi.restoreAllMocks(); });

it('updates tabs orientation, activation and controlled value without feedback events', () => {
  const el = tabsRoot(), orientation = signal<'horizontal' | 'vertical'>('horizontal'), activation = signal<'auto' | 'manual'>('auto'), value = signal(0);
  const controller = createTabs(el, { orientation, activation, value }), changed = vi.fn(); releases.push(controller.dispose); el.addEventListener('zen-tabs-change', changed);
  const tabs = el.querySelectorAll<HTMLButtonElement>('[zen-tab]'); orientation.set('vertical'); activation.set('manual'); value.set(1); flushSync();
  expect(controller.state.peek()).toBe(1); expect(el.querySelector('[zen-tablist]')!.getAttribute('aria-orientation')).toBe('vertical'); expect(el.getAttribute('data-orientation')).toBe('vertical'); expect(changed).not.toHaveBeenCalled();
  tabs[0]!.focus(); key(tabs[0]!, 'ArrowDown'); expect(document.activeElement).toBe(tabs[1]); expect(controller.state.peek()).toBe(1);
  key(tabs[1]!, 'ArrowUp'); expect(document.activeElement).toBe(tabs[0]); expect(controller.state.peek()).toBe(1); key(tabs[0]!, 'Enter'); expect(controller.state.peek()).toBe(0); expect(changed).toHaveBeenCalledTimes(1);
  controller.dispose(); const restored = el.outerHTML; orientation.set('horizontal'); value.set(1); flushSync(); expect(el.outerHTML).toBe(restored);
});
it('preserves lazy node identity when laziness changes and invokes each visited mount only once', () => {
  const el = tabsRoot(), lazy = signal(true), mount = vi.fn((_panel: HTMLElement, _index: number) => {}), panels = el.querySelectorAll<HTMLElement>('[zen-tabpanel]'), original = panels[1]!.firstChild;
  const controller = createTabs(el, { lazy, mountPanel: mount }); releases.push(controller.dispose); expect(panels[1]!.childNodes).toHaveLength(0);
  lazy.set(false); flushSync(); expect(panels[1]!.firstChild).toBe(original); lazy.set(true); flushSync(); expect(panels[1]!.childNodes).toHaveLength(0);
  controller.select(1); expect(panels[1]!.firstChild).toBe(original); controller.select(0); controller.select(1); expect(mount.mock.calls.map(call => call[1])).toEqual([0, 1]);
});
it('restores mutations when tabs setup fails while generating IDs', () => {
  const el = tabsRoot(), before = el.outerHTML; const original = el.querySelectorAll<HTMLElement>('[zen-tabpanel]')[1]!;
  vi.spyOn(original, 'setAttribute').mockImplementationOnce(() => { throw new Error('attribute failure'); }); expect(() => createTabs(el, { lazy: true })).toThrow('attribute failure'); expect(el.outerHTML).toBe(before);
});
it('strict collection resolvers reject unknown options, invalid modes and malformed arrays', () => {
  expect(() => tabsOptions.resolve({ orientation: 'diagonal' })).toThrow(); expect(() => tabsOptions.resolve({ typo: true })).toThrow(); expect(() => accordionOptions.resolve({ value: ['bad'] })).toThrow();
  expect(() => createTabs(tabsRoot(), { value: 2 })).toThrow(); expect(() => createAccordion(accordionRoot(), { value: [0, 0] })).toThrow();
});
it('reacts to accordion selection/constraints without echoing programmatic updates', () => {
  const el = accordionRoot(), value = signal<readonly number[]>([0]), multiple = signal(true), collapsible = signal(true), change = vi.fn();
  const controller = createAccordion(el, { value, multiple, collapsible }); releases.push(controller.dispose); el.addEventListener('zen-accordion-change', change);
  value.set([0, 1]); flushSync(); expect(controller.state.peek()).toEqual([0, 1]); expect(change).not.toHaveBeenCalled();
  value.set([1]); multiple.set(false); collapsible.set(false); flushSync(); controller.toggle(1); expect(controller.state.peek()).toEqual([1]);
  controller.toggle(0); expect(controller.state.peek()).toEqual([0]); expect(change).toHaveBeenCalledTimes(1); expect(() => controller.setValue([])).toThrow();
});
it('does not reset uncontrolled selection on an unrelated option update', () => {
  const el = accordionRoot(), multiple = signal(true), collapsible = signal(true), controller = createAccordion(el, { multiple, collapsible }); releases.push(controller.dispose);
  controller.toggle(0); controller.toggle(1); multiple.set(false); flushSync(); expect(controller.state.peek()).toEqual([0]); controller.toggle(0); expect(controller.state.peek()).toEqual([]);
  collapsible.set(false); flushSync(); expect(controller.state.peek()).toEqual([0]);
});
it('does not reapply a schema-cloned initial array on unrelated reactive changes', () => {
  const collapsible = signal(true), controller = createAccordion(accordionRoot(), { value: [0], multiple: true, collapsible }); releases.push(controller.dispose); controller.toggle(1);
  collapsible.set(false); flushSync(); expect(controller.state.peek()).toEqual([0, 1]);
});
