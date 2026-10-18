// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDialog, createPopover, createTooltip, createTabs, createAccordion, createMenu, createCombobox, createPortal, computePosition } from '../src';
afterEach(() => { document.body.replaceChildren(); vi.useRealTimers(); });
function root(html: string) { const el = document.createElement('div'); el.innerHTML = html; document.body.append(el); return el; }
function key(el: HTMLElement, key: string) { el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); }
describe('headless controllers own their effects and markup', () => {
  it('nests sibling dialogs, closes only the top on Escape and returns focus', () => {
    const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus();
    const a = root('<h2 zen-dialog-title>A</h2><button>A</button>'), b = root('<h2 zen-dialog-title>B</h2><button>B</button>');
    const first = createDialog(a), second = createDialog(b); first.open(); second.open(); expect(b.inert).not.toBe(true); expect(a.getAttribute('aria-hidden')).toBe('true');
    key(b.querySelector('button')!, 'Escape'); expect(second.state.get()).toBe(false); expect(first.state.get()).toBe(true); expect(document.activeElement).toBe(a.querySelector('button'));
    first.close(); expect(document.activeElement).toBe(trigger); expect(document.body.style.overflow).not.toBe('hidden'); first.dispose(); second.dispose(); expect(a.hasAttribute('role')).toBe(false);
  });
  it('does not duplicate generated accessibility IDs across controllers', () => {
    const a = root('<h2 zen-dialog-title>A</h2>'), b = root('<h2 zen-dialog-title>B</h2>'); const first = createDialog(a), second = createDialog(b);
    expect(a.getAttribute('aria-labelledby')).not.toBe(b.getAttribute('aria-labelledby')); first.dispose(); second.dispose();
  });
  it('closes popovers on outside click and restores trigger ARIA and styles', () => {
    const trigger = document.createElement('button'); document.body.append(trigger); const el = root('surface'); const popover = createPopover(el, { trigger }); trigger.click(); expect(popover.state.get()).toBe(true);
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); expect(popover.state.get()).toBe(false); popover.dispose(); expect(trigger.hasAttribute('aria-expanded')).toBe(false); expect(el.hasAttribute('style')).toBe(false);
  });
  it('owns tooltip timers and does not restore focus on hide', () => {
    vi.useFakeTimers(); const trigger = document.createElement('button'); document.body.append(trigger); const el = root('help'); const tooltip = createTooltip(el, { trigger, delay: 50 });
    trigger.dispatchEvent(new MouseEvent('mouseenter')); vi.advanceTimersByTime(49); expect(tooltip.state.get()).toBe(false); vi.advanceTimersByTime(1); expect(tooltip.state.get()).toBe(true);
    tooltip.dispose(); vi.runOnlyPendingTimers(); expect(trigger.hasAttribute('aria-describedby')).toBe(false);
  });
  it('implements RTL tab navigation and manual activation without selecting on focus', () => {
    const el = root('<div zen-tablist dir="rtl"><button zen-tab>A</button><button zen-tab disabled>B</button><button zen-tab>C</button></div><div zen-tabpanel>A</div><div zen-tabpanel>B</div><div zen-tabpanel>C</div>');
    const tabs = createTabs(el, { activation: 'manual' }); const buttons = el.querySelectorAll('button'); buttons[0]!.focus(); key(buttons[0]!, 'ArrowLeft'); expect(document.activeElement).toBe(buttons[2]); expect(tabs.state.get()).toBe(0);
    key(buttons[2]!, 'Enter'); expect(tabs.state.get()).toBe(2); expect(el.querySelectorAll('[zen-tabpanel]')[2]!.hasAttribute('hidden')).toBe(false); tabs.dispose();
  });
  it('supports disclosure collections and restores authored panel attributes', () => {
    const el = root('<section zen-accordion-item><button zen-accordion-trigger>A</button><div zen-accordion-panel>one</div></section><section zen-accordion-item><button zen-accordion-trigger>B</button><div zen-accordion-panel>two</div></section>');
    const accordion = createAccordion(el); accordion.toggle(0); accordion.toggle(1); expect(accordion.state.get()).toEqual([1]); accordion.dispose(); expect(el.querySelector('[zen-accordion-panel]')!.hasAttribute('hidden')).toBe(false);
  });
  it('selects menu checks while skipping disabled entries', () => {
    const trigger = document.createElement('button'); document.body.append(trigger); const el = root('<button zen-menu-item zen-menu-checkbox>A</button><button zen-menu-item zen-menu-item-disabled>B</button>');
    const menu = createMenu(el, { trigger, closeOnSelect: false }); menu.open(); el.querySelector('button')!.click(); expect(el.querySelector('button')!.getAttribute('aria-checked')).toBe('true'); expect(menu.state.get()).toBe(true); menu.dispose();
  });
  it('prevents stale async combo results and restores original children on disposal', async () => {
    const el = root('<input><div zen-combobox-list><span>original</span></div>'); const resolvers = new Map<string, (value: Array<{ value: string; label: string }>) => void>();
    const combo = createCombobox(el, { options: query => new Promise(resolve => { resolvers.set(query, resolve); }) });
    const first = combo.search('a'), second = combo.search('b'); resolvers.get('b')!([{ value: 'b', label: 'B' }]); await second; resolvers.get('a')!([{ value: 'a', label: 'A' }]); await first;
    expect(el.querySelector('[role="option"]')!.textContent).toBe('B'); combo.select('b'); expect(combo.state.get()).toEqual(['b']); combo.dispose(); expect(el.querySelector('span')!.textContent).toBe('original');
  });
  it('restores portals to their exact original sibling position', () => {
    const el = root('<span>before</span><button>move</button><span>after</span>'); const button = el.querySelector('button')!; const restore = createPortal(button, { target: document.body }); expect(button.parentElement).toBe(document.body); restore(); restore(); expect(el.children[1]).toBe(button);
    expect(() => createPortal(button, { target: '[' })).toThrow();
  });
  it('flips on overflow and uses the reference owner viewport', () => {
    const reference = root(''), floating = root(''); reference.getBoundingClientRect = () => ({ left: 10, right: 30, top: 750, bottom: 770, width: 20, height: 20, x: 10, y: 750, toJSON() {} });
    floating.getBoundingClientRect = () => ({ left: 0, right: 100, top: 0, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON() {} }); expect(computePosition(reference, floating).placement).toBe('top');
  });
  it('releases active dialog leases after DOM removal', async () => {
    const el = root('<h2 zen-dialog-title>Title</h2><button>ok</button>'); const dialog = createDialog(el); dialog.open(); el.remove(); await Promise.resolve(); expect(document.body.style.overflow).not.toBe('hidden'); dialog.dispose();
  });
});

it('exposes immutable array observations rather than leaking mutable controller state', () => {
  const el = root('<section zen-accordion-item><button zen-accordion-trigger>A</button><div zen-accordion-panel>one</div></section>');
  const accordion = createAccordion(el); accordion.toggle(0); const value = accordion.state.get(); expect(Object.isFrozen(value)).toBe(true); expect(accordion.state.peek()).toBe(value); accordion.dispose();
});
