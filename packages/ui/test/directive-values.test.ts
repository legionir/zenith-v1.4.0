// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createApp } from '@zenith/runtime-core';
import { signal, computed } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { uiPlugin } from '../src';
const releases: Array<() => void> = [];
function mount(html: string, state: Record<string, unknown> = {}) {
  const root = document.createElement('main'); root.innerHTML = html; document.body.append(root); const app = createApp({ state }); releases.push(() => app.dispose()); app.use(uiPlugin()); app.mount(root); return { root, app };
}
function key(el: HTMLElement, value: string) { el.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })); }
afterEach(() => { for (const release of releases.splice(0).reverse()) release(); document.body.replaceChildren(); vi.useRealTimers(); });
it('writes dialog Escape/backdrop closures to a writable open expression and owns its portal', () => {
  const open = signal(false), { root, app } = mount('<section id="original"><div zen-dialog="$open"><h2 zen-dialog-title>Title</h2><button>Inside</button><span zen-dialog-backdrop>Backdrop</span></div></section>', { open });
  const dialog = document.querySelector<HTMLElement>('[zen-dialog]')!; expect(dialog.parentElement).toBe(document.body); open.set(true); flushSync(); expect(dialog.hidden).toBe(false);
  key(dialog.querySelector('button')!, 'Escape'); expect(open.peek()).toBe(false); open.set(true); flushSync(); dialog.querySelector<HTMLElement>('[zen-dialog-backdrop]')!.click(); expect(open.peek()).toBe(false);
  app.dispose(); expect(dialog.parentElement).toBe(root.querySelector('#original')); const markup = root.outerHTML; open.set(true); flushSync(); expect(root.outerHTML).toBe(markup);
});
it('updates writable popover values in both directions and does not write computed values', () => {
  const open = signal(false), { root } = mount('<button id="trigger">Open</button><div zen-popover="$open" zen-popover-trigger="#trigger">Contents</div>', { open });
  const trigger = root.querySelector('button')!, surface = root.querySelector<HTMLElement>('[zen-popover]')!; trigger.click(); expect(open.peek()).toBe(true); open.set(false); flushSync(); expect(surface.hidden).toBe(true);
  const base = signal(false), derived = computed(() => base.get()); const other = mount('<button id="other">Other</button><div zen-popover="$derived" zen-popover-trigger="#other">Read only</div>', { derived });
  other.root.querySelector('button')!.click(); expect(derived.get()).toBe(false); expect(base.peek()).toBe(false);
});
it('controls tabs from signals and writes only user selections without an echo change event', () => {
  const selected = signal(1), { root } = mount('<section zen-tabs="$selected"><div zen-tablist><button zen-tab>A</button><button zen-tab>B</button></div><div zen-tabpanel>A</div><div zen-tabpanel>B</div></section>', { selected });
  const tabs = root.querySelectorAll<HTMLButtonElement>('[zen-tab]'), changed = vi.fn(); root.addEventListener('zen-tabs-change', changed); expect(tabs[1]!.getAttribute('aria-selected')).toBe('true');
  selected.set(0); flushSync(); expect(tabs[0]!.getAttribute('aria-selected')).toBe('true'); expect(changed).not.toHaveBeenCalled(); tabs[1]!.click(); expect(selected.peek()).toBe(1); expect(changed).toHaveBeenCalledTimes(1);
});
it('controls accordion arrays and writes disclosures back to the same writable', () => {
  const value = signal<readonly number[]>([1]), { root } = mount('<div zen-accordion="$value" zen-accordion-multiple="true"><section zen-accordion-item><button zen-accordion-trigger>A</button><div zen-accordion-panel>A</div></section><section zen-accordion-item><button zen-accordion-trigger>B</button><div zen-accordion-panel>B</div></section></div>', { value });
  const triggers = root.querySelectorAll<HTMLButtonElement>('[zen-accordion-trigger]'); triggers[0]!.click(); expect(value.peek()).toEqual([1, 0]); value.set([0]); flushSync(); expect(triggers[1]!.getAttribute('aria-expanded')).toBe('false');
});
it('separates combobox value/options expressions, projects fields and refreshes reactive lists', async () => {
  vi.useFakeTimers(); const value = signal('a'), rows = signal([{ id: 'a', title: 'Alpha' }, { id: 'b', title: 'Beta' }]);
  const { root } = mount('<div zen-combobox="$value" zen-combobox-options="$rows" zen-combobox-option-label="title" zen-combobox-option-value="id" zen-combobox-filter="none" zen-combobox-debounce="0"><input aria-label="Choice"><div zen-combobox-list></div></div>', { value, rows });
  const input = root.querySelector('input')!; expect(input.value).toBe('Alpha'); input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); vi.advanceTimersByTime(0); await Promise.resolve();
  expect(root.querySelectorAll('[role="option"]')).toHaveLength(2); root.querySelectorAll<HTMLElement>('[role="option"]')[1]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); expect(value.peek()).toBe('b');
  rows.set([{ id: 'c', title: 'Gamma' }]); value.set('c'); flushSync(); expect(input.value).toBe('Gamma');
});
it('resolves async loader names without evaluating dynamic code and aborts them on unmount', async () => {
  const signals: AbortSignal[] = [], load = vi.fn((_query: string, signal: AbortSignal) => { signals.push(signal); return new Promise<unknown[]>(() => {}); });
  const { root, app } = mount('<div zen-combobox-async="$load" zen-combobox="" zen-combobox-debounce="0"><input aria-label="Choice"><div zen-combobox-list></div></div>', { load });
  key(root.querySelector('input')!, 'ArrowDown'); await Promise.resolve(); expect(load).toHaveBeenCalledTimes(1); app.dispose(); expect(signals[0]!.aborted).toBe(true);
});
it('updates tooltip text through a tracked expression and restores authored nodes on cleanup', () => {
  const text = signal('First'), { root, app } = mount('<button id="tip-trigger">Help</button><div zen-tooltip="$text" zen-tooltip-trigger="#tip-trigger"><em>Authored</em></div>', { text });
  const tooltip = root.querySelector('[zen-tooltip]')!; expect(tooltip.textContent).toBe('First'); text.set('<script>not markup</script>'); flushSync(); expect(tooltip.textContent).toBe('<script>not markup</script>'); expect(tooltip.querySelector('script')).toBeNull();
  app.dispose(); expect(tooltip.querySelector('em')!.textContent).toBe('Authored');
});
it('rejects malformed enums/booleans instead of silently choosing a different contract', () => {
  const root = document.createElement('main'); root.innerHTML = '<section zen-tabs zen-tabs-activation="surprise"><div zen-tablist><button zen-tab>A</button></div><div zen-tabpanel>A</div></section>'; document.body.append(root);
  const app = createApp(); releases.push(() => app.dispose()); app.use(uiPlugin()); expect(() => app.mount(root)).toThrow();
});

it('tracks colon-prefixed floating attributes and releases ARIA on the previous anchor', () => {
  const trigger = signal('#configured-a'), placement = signal<'bottom' | 'right'>('bottom'), offset = signal(8), open = signal(false);
  const { root } = mount('<button id="configured-a">A</button><button id="configured-b">B</button><section zen-popover="$open" zen-popover-trigger=":$trigger" zen-popover-placement=":$placement" zen-popover-offset=":$offset" zen-popover-flip="false" zen-popover-role="dialog" aria-label="Details"><button>Inside</button></section>', { trigger, placement, offset, open });
  const a = root.querySelector('#configured-a')!, b = root.querySelector('#configured-b')!, surface = root.querySelector<HTMLElement>('[zen-popover]')!; open.set(true); flushSync(); expect(a.getAttribute('aria-expanded')).toBe('true'); trigger.set('#configured-b'); placement.set('right'); offset.set(24); flushSync(); expect(surface.getAttribute('data-placement')).toBe('right'); expect(surface.style.left).toBe('24px'); expect(a.hasAttribute('aria-expanded')).toBe(false); expect(a.hasAttribute('aria-controls')).toBe(false); expect(b.getAttribute('aria-haspopup')).toBe('dialog'); expect(b.getAttribute('aria-expanded')).toBe('true');
});
it('owns reactive dialog portal targets and accepts literal false without treating it as a selector', () => {
  const destination = signal<string | false>(false), open = signal(true);
  const { root, app } = mount('<aside id="configured-target"></aside><section zen-dialog="$open" zen-dialog-portal=":$destination"><h2 zen-dialog-title>Portal</h2><button>Inside</button></section>', { destination, open });
  const dialog = root.querySelector<HTMLElement>('[zen-dialog]')!, closed = vi.fn(); dialog.addEventListener('zen-dialog-close', closed); expect(dialog.parentElement).toBe(root); destination.set('#configured-target'); flushSync(); expect(dialog.parentElement).toBe(root.querySelector('#configured-target')); expect(open.peek()).toBe(true); destination.set(false); flushSync(); expect(dialog.parentElement).toBe(root); expect(closed).not.toHaveBeenCalled(); app.dispose();
  const other = mount('<section zen-dialog zen-dialog-portal="false"><button>Inside</button></section>'); expect(other.root.querySelector('[zen-dialog]')!.parentElement).toBe(other.root);
});
it('binds previously parked tab children when a readable lazy attribute is disabled', () => {
  const lazy = signal(true), title = signal('Bound later');
  const { root } = mount('<section zen-tabs zen-tabs-lazy=":$lazy"><div zen-tablist><button zen-tab>A</button><button zen-tab>B</button></div><section zen-tabpanel>A</section><section zen-tabpanel><span zen-text="$title">Fallback</span></section></section>', { lazy, title });
  const panel = root.querySelectorAll<HTMLElement>('[zen-tabpanel]')[1]!; expect(panel.childNodes).toHaveLength(0); lazy.set(false); flushSync(); expect(panel.textContent).toBe('Bound later'); title.set('Still tracked'); flushSync(); expect(panel.textContent).toBe('Still tracked');
});
it('applies readable combobox filter/projection/multiple flags rather than truth-testing their containers', async () => {
  vi.useFakeTimers(); const mode = signal<'contains' | 'none'>('contains'), multiple = signal(false), labelKey = signal('title'), selected = signal<string | readonly string[]>(''); const rows = [{ id: 'a', title: 'Alpha', name: 'First' }, { id: 'b', title: 'Beta', name: 'Second' }];
  const { root } = mount('<section zen-combobox="$selected" zen-combobox-options="$rows" zen-combobox-option-label=":$labelKey" zen-combobox-option-value="id" zen-combobox-filter=":$mode" zen-combobox-multiple=":$multiple" zen-combobox-debounce="0ms"><input aria-label="Choice"><div zen-combobox-list></div></section>', { mode, multiple, labelKey, selected, rows });
  const input = root.querySelector('input')!; input.value = 'Al'; input.dispatchEvent(new Event('input', { bubbles: true })); vi.advanceTimersByTime(0); await Promise.resolve(); expect(root.querySelectorAll('[role="option"]')).toHaveLength(1); root.querySelector<HTMLElement>('[role="option"]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); expect(selected.peek()).toBe('a');
  multiple.set(true); mode.set('none'); labelKey.set('name'); flushSync(); input.value = ''; key(input, 'ArrowDown'); await Promise.resolve(); expect(root.querySelector('[role="option"]')!.textContent).toBe('First'); root.querySelectorAll<HTMLElement>('[role="option"]')[1]!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); expect(selected.peek()).toEqual(['a', 'b']);
});
