// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDialog, createPopover, createTooltip, createTabs, createCombobox, createAccordion, createPortal, autoUpdate, computePosition, uiPlugin, type UIAppHost } from '../src';
import { ownership, cleanupScope, modalLease } from '../src/internal';
function root(html = '') { const el = document.createElement('div'); el.innerHTML = html; document.body.append(el); return el; }
function key(el: HTMLElement, value: string) { el.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })); }
afterEach(async () => { document.body.replaceChildren(); await Promise.resolve(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('closed UI owners and late acquisitions', () => {
  it('releases late cleanup immediately without restoring or adding new attributes/listeners', () => {
    const el = root(), owner = ownership(el), callback = vi.fn(), late = vi.fn();
    owner.attr(el, 'role', 'dialog'); owner.dispose(); owner.add(late); owner.on(el, 'click', callback); owner.attr(el, 'role', 'menu'); el.click();
    expect(late).toHaveBeenCalledTimes(1); expect(callback).not.toHaveBeenCalled(); expect(el.hasAttribute('role')).toBe(false);
  });
  it('continues all cleanup and runs finalizers after exact attribute restoration', () => {
    const el = root(); el.setAttribute('data-before', 'original'); const owner = ownership(el), releases: string[] = [];
    owner.attr(el, 'data-before', 'changed'); owner.add(() => { releases.push('first'); }); owner.add(() => { throw new Error('release failure'); });
    owner.afterDispose(() => { releases.push(el.getAttribute('data-before')!); });
    expect(() => owner.dispose()).toThrow('release failure'); expect(releases).toEqual(['first', 'original']); owner.dispose();
  });
  it('closes local activation scopes before invoking a reentrant cleanup', () => {
    const scope = cleanupScope(), late = vi.fn(); scope.add(() => { scope.add(late); }); scope.dispose(); scope.dispose(); expect(late).toHaveBeenCalledTimes(1);
  });
});

describe('dialog and floating activation ownership', () => {
  it('can dispose a dialog during initial focus without leaking locks or throwing a stale focus error', () => {
    const before = root('<button>before</button>').querySelector('button')!; before.focus();
    const el = root('<h2 zen-dialog-title>Title</h2><button>inside</button>'), dialog = createDialog(el), opened = vi.fn(); el.addEventListener('zen-dialog-open', opened);
    el.querySelector('button')!.addEventListener('focus', () => dialog.dispose(), { once: true });
    expect(() => dialog.open()).not.toThrow(); expect(opened).not.toHaveBeenCalled(); expect(document.body.style.overflow).not.toBe('hidden'); expect(el.hasAttribute('role')).toBe(false); expect(before.closest('[aria-hidden="true"]')).toBeNull();
  });
  it('does not hide a new opening triggered while returning focus from the previous one', () => {
    const before = root('<button>before</button>').querySelector('button')!; before.focus();
    const el = root('<h2 zen-dialog-title>Title</h2><button>inside</button>'), dialog = createDialog(el);
    try {
      dialog.open(); before.addEventListener('focus', () => dialog.open(), { once: true }); dialog.close();
      expect(dialog.state.peek()).toBe(true); expect(el.hidden).toBe(false); expect(document.body.style.overflow).toBe('hidden');
    } finally { dialog.dispose(); }
    expect(document.body.style.overflow).not.toBe('hidden');
  });
  it('reports close reasons without a stale open event after focus closes the dialog', () => {
    const el = root('<h2 zen-dialog-title>Title</h2><button>inside</button>'), dialog = createDialog(el), reasons: string[] = [], opened = vi.fn();
    el.addEventListener('zen-dialog-open', opened); el.addEventListener('zen-dialog-close', e => reasons.push((e as CustomEvent<{ reason: string }>).detail.reason));
    try { el.querySelector('button')!.addEventListener('focus', () => dialog.close(), { once: true }); dialog.open(); expect(dialog.state.peek()).toBe(false); expect(opened).not.toHaveBeenCalled(); expect(reasons).toEqual(['api']); }
    finally { dialog.dispose(); }
  });
  it('immediately releases geometry acquired after a reentrant close', () => {
    const trigger = root('<button>trigger</button>').querySelector('button')!, el = root('<button>content</button>');
    const popover = createPopover(el, { trigger }); const opened = vi.fn(); el.addEventListener('zen-popover-open', opened);
    const original = trigger.getBoundingClientRect.bind(trigger); let once = true;
    vi.spyOn(trigger, 'getBoundingClientRect').mockImplementation(() => { if (once) { once = false; popover.close(); } return original(); });
    try { popover.open(); expect(popover.state.peek()).toBe(false); expect(el.hidden).toBe(true); expect(opened).not.toHaveBeenCalled(); window.dispatchEvent(new Event('resize')); expect(el.style.left).toBe(''); }
    finally { popover.dispose(); }
  });
  it('observes trigger removal even when the floating surface remains connected', async () => {
    const trigger = root('<button>trigger</button>').querySelector('button')!, el = root('<button>content</button>'), popover = createPopover(el, { trigger });
    popover.open(); trigger.remove(); await Promise.resolve(); expect(el.isConnected).toBe(true); expect(el.hasAttribute('data-state')).toBe(false); popover.open(); expect(el.hasAttribute('data-state')).toBe(false); popover.dispose();
  });
  it('invalidates queued ResizeObserver callbacks after cleanup', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'ResizeObserver'); let queued = () => {}; const disconnect = vi.fn();
    class Observer { constructor(callback: () => void) { queued = callback; } observe() {} disconnect = disconnect; }
    Object.defineProperty(window, 'ResizeObserver', { configurable: true, value: Observer });
    try { const update = vi.fn(), reference = root(), floating = root(), stop = autoUpdate(reference, floating, update); expect(update).toHaveBeenCalledTimes(1); stop(); queued(); window.dispatchEvent(new Event('resize')); expect(update).toHaveBeenCalledTimes(1); expect(disconnect).toHaveBeenCalledTimes(1); }
    finally { if (descriptor) Object.defineProperty(window, 'ResizeObserver', descriptor); else Reflect.deleteProperty(window, 'ResizeObserver'); }
  });
});

describe('tooltip IDREF and timer leases', () => {
  it('retains another tooltip description when leases release out of order', () => {
    const trigger = root('<button aria-describedby="authored">trigger</button>').querySelector('button')!, a = root('A'), b = root('B');
    const first = createTooltip(a, { trigger }), second = createTooltip(b, { trigger }); const secondId = b.id;
    first.dispose(); expect(trigger.getAttribute('aria-describedby')?.split(' ')).toEqual(['authored', secondId]); expect(trigger.hasAttribute('aria-expanded')).toBe(false);
    second.dispose(); expect(trigger.getAttribute('aria-describedby')).toBe('authored'); expect(a.id).toBe(''); expect(b.id).toBe('');
  });
  it('cancels pending show on Escape, respects disabled API calls and clears timers on removal', async () => {
    vi.useFakeTimers(); const trigger = root('<button>trigger</button>').querySelector('button')!, el = root('tooltip'), tooltip = createTooltip(el, { trigger, delay: 50 });
    trigger.dispatchEvent(new Event('mouseenter')); key(trigger, 'Escape'); vi.advanceTimersByTime(100); expect(tooltip.state.peek()).toBe(false);
    trigger.dispatchEvent(new Event('mouseenter')); trigger.remove(); await Promise.resolve(); vi.runAllTimers(); expect(el.hasAttribute('role')).toBe(false); tooltip.dispose();
    const other = root('<button>other</button>').querySelector('button')!, disabled = createTooltip(root('disabled'), { trigger: other, disabled: true }); disabled.open(); expect(disabled.state.peek()).toBe(false); disabled.dispose();
  });
});

describe('lazy panels and combobox cancellation', () => {
  function tabsRoot() { return root('<div zen-tablist><button zen-tab>A</button><button zen-tab>B</button></div><section zen-tabpanel>A</section><section zen-tabpanel>B</section>'); }
  it('immediately releases a lazy child returned after its parent disposed reentrantly', () => {
    const el = tabsRoot(), late = vi.fn(); let tabs!: ReturnType<typeof createTabs>;
    tabs = createTabs(el, { lazy: true, mountPanel: (_panel, index) => { if (index === 1) { tabs.dispose(); return late; } } });
    tabs.select(1); expect(late).toHaveBeenCalledTimes(1); expect(el.querySelector('[role="tablist"]')).toBeNull(); tabs.dispose();
  });
  it('mounts a reentrant lazy panel once and lets the most recent selection win', () => {
    const el = tabsRoot(), mounted: number[] = []; let tabs!: ReturnType<typeof createTabs>;
    tabs = createTabs(el, { lazy: true, mountPanel: (_panel, index) => { mounted.push(index); if (index === 1) tabs.select(0); } });
    try { tabs.select(1); expect(tabs.state.peek()).toBe(0); expect(mounted).toEqual([0, 1]); tabs.select(1); expect(mounted).toEqual([0, 1]); }
    finally { tabs.dispose(); }
  });
  it('keeps retained generated options inert after replacement and disposal', async () => {
    const el = root('<input><div zen-combobox-list><b>original</b></div>'), combo = createCombobox(el, { options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }] });
    await combo.search('A'); const stale = el.querySelector<HTMLElement>('[role="option"]')!; await combo.search('B'); stale.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); expect(combo.state.peek()).toEqual([]);
    const last = el.querySelector<HTMLElement>('[role="option"]')!; combo.dispose(); last.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); combo.select('a'); await combo.search('A'); expect(el.querySelector('b')?.textContent).toBe('original'); expect(el.querySelector('[role="option"]')).toBeNull();
  });
  it('close aborts an in-flight loader and does not reopen for a late response', async () => {
    let finish!: (value: Array<{ label: string; value: string }>) => void; let signal!: AbortSignal;
    const el = root('<input><div zen-combobox-list></div>'), combo = createCombobox(el, { options: (_query, request) => { signal = request; return new Promise(resolve => { finish = resolve; }); } });
    const pending = combo.search('a'); combo.close(); expect(signal.aborted).toBe(true); finish([{ label: 'A', value: 'a' }]); await pending;
    expect(combo.loading.peek()).toBe(false); expect(el.querySelector('input')!.getAttribute('aria-expanded')).toBe('false'); combo.dispose();
  });
  it('starts ArrowUp at the last enabled option and prevents stale debounce after direct search', async () => {
    vi.useFakeTimers(); const loader = vi.fn(async () => [{ label: 'A', value: 'a' }, { label: 'B', value: 'b', disabled: true }, { label: 'C', value: 'c' }]);
    const el = root('<input><div zen-combobox-list></div>'), input = el.querySelector('input')!, combo = createCombobox(el, { options: loader, debounce: 50 });
    input.dispatchEvent(new Event('input', { bubbles: true })); await combo.search(''); vi.runAllTimers(); expect(loader).toHaveBeenCalledTimes(1);
    key(input, 'ArrowUp'); expect(input.getAttribute('aria-activedescendant')).toMatch(/-option-2$/); key(input, 'Enter'); expect(combo.state.peek()).toEqual(['c']); combo.dispose();
  });
});

it('isolates nested accordions, snapshots initial values, and rejects invalid selections', () => {
  const el = root('<section zen-accordion-item><button zen-accordion-trigger>Outer</button><div zen-accordion-panel><div zen-accordion><section zen-accordion-item><button zen-accordion-trigger>Inner</button><div zen-accordion-panel>inside</div></section></div></div></section>');
  const initial = [0], outer = createAccordion(el, { value: initial }), nested = el.querySelector<HTMLElement>('[zen-accordion]')!, inner = createAccordion(nested);
  try { initial.length = 0; expect(outer.state.peek()).toEqual([0]); nested.querySelector('button')!.click(); expect(inner.state.peek()).toEqual([0]); expect(outer.state.peek()).toEqual([0]); expect(() => outer.toggle(1)).toThrow(); }
  finally { inner.dispose(); outer.dispose(); }
});

it('shares same-target portal acquisitions but never steals an externally moved element', () => {
  const el = root('<span>before</span><button>move</button><span>after</span>'), button = el.querySelector('button')!, originalNext = button.nextSibling;
  const first = createPortal(button, { target: document.body }), second = createPortal(button, { target: document.body }); first(); expect(button.parentElement).toBe(document.body); second(); expect(button.nextSibling).toBe(originalNext);
  const restore = createPortal(button, { target: document.body }), external = root(); external.append(button); restore(); expect(button.parentElement).toBe(external);
  expect(() => createPortal(button, { target: document.implementation.createHTMLDocument().body })).toThrow();
});

it('aligns floating start/end logically in RTL while preserving the physical side', () => {
  const anchor = root(), floating = root(); anchor.dir = 'rtl';
  vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({ x: 100, y: 100, left: 100, right: 140, top: 100, bottom: 120, width: 40, height: 20, toJSON() {} });
  vi.spyOn(floating, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, right: 20, top: 0, bottom: 10, width: 20, height: 10, toJSON() {} });
  expect(computePosition(anchor, floating, { placement: 'bottom-start', flip: false, shift: false })).toMatchObject({ x: 120, y: 128, placement: 'bottom-start' });
  expect(computePosition(anchor, floating, { placement: 'bottom-end', flip: false, shift: false }).x).toBe(100);
});

it('disposes a binding created while its plugin was synchronously uninstalled', () => {
  const bindings = new Map<string, Parameters<UIAppHost['directive']>[0]>();
  const host: UIAppHost = { directive(definition) { bindings.set(definition.name, definition); return () => { bindings.delete(definition.name); }; } };
  const stop = uiPlugin().install(host), el = root('<h2 zen-dialog-title>Title</h2><button>focus</button>');
  const binding = bindings.get('dialog')!; el.querySelector('button')!.addEventListener('focus', stop, { once: true });
  const release = binding.bind(el, { expr: 'true', context: {}, state: {} });
  expect(el.hasAttribute('role')).toBe(false); expect(document.body.style.overflow).not.toBe('hidden'); release(); stop(); expect(bindings.size).toBe(0);
});

it('releases every modal background lease even when one release throws', () => {
  const first = root('first'), second = root('second'), dialog = root('dialog');
  const active = new Set<HTMLElement>(); let failed = false;
  const release = modalLease(dialog, element => {
    active.add(element);
    return () => { active.delete(element); if (element === first && !failed) { failed = true; throw new Error('inert release failure'); } };
  });
  expect(active.has(first)).toBe(true); expect(active.has(second)).toBe(true);
  expect(() => release()).toThrow('inert release failure'); expect(active.size).toBe(0); release();
});

it('does not mutate an arrow after a geometry read disposes its popover', () => {
  const trigger = root('<button>trigger</button>').querySelector('button')!, el = root('<span data-arrow style="color:red"></span>'), arrow = el.querySelector<HTMLElement>('[data-arrow]')!;
  el.style.left = '12px'; const before = arrow.getAttribute('style'), beforeSurface = el.getAttribute('style');
  const popover = createPopover(el, { trigger, arrow });
  vi.spyOn(el, 'getBoundingClientRect').mockImplementation(() => { popover.dispose(); return new DOMRect(0, 0, 10, 10); });
  expect(() => popover.open()).not.toThrow(); expect(arrow.getAttribute('style')).toBe(before); expect(el.getAttribute('style')).toBe(beforeSurface); expect(el.hasAttribute('role')).toBe(false);
});
