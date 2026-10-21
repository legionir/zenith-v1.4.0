// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createDialog, createPopover, createTooltip, createMenu, type Placement } from '../src';
import { ownership } from '../src/internal';
const releases: Array<() => void> = [];
function root(html = '') { const el = document.createElement('section'); el.innerHTML = html; document.body.append(el); return el; }
function button(text = 'Trigger') { return root(`<button>${text}</button>`).querySelector('button')!; }
function key(el: HTMLElement, value: string) { el.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })); }
afterEach(() => { for (const release of releases.splice(0).reverse()) release(); document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks(); });

it('reconfigures open modal leases without a false state or duplicate open/close event', () => {
  const before = button(), el = root('<h2 zen-dialog-title>Title</h2><button>A</button><button>B</button>'), modal = signal(true), scrollLock = signal(true), role = signal<'dialog' | 'alertdialog'>('dialog'); before.focus();
  const controller = createDialog(el, { modal, scrollLock, role }), open = vi.fn(), close = vi.fn(); releases.push(controller.dispose); el.addEventListener('zen-dialog-open', open); el.addEventListener('zen-dialog-close', close);
  controller.open(); el.querySelectorAll('button')[1]!.focus(); scrollLock.set(false); role.set('alertdialog'); flushSync(); expect(document.body.style.overflow).not.toBe('hidden'); expect(document.activeElement).toBe(el.querySelectorAll('button')[1]); expect(el.getAttribute('role')).toBe('alertdialog'); expect(controller.state.peek()).toBe(true);
  modal.set(false); flushSync(); expect(el.hasAttribute('aria-modal')).toBe(false); expect(before.closest('[aria-hidden="true"]')).toBeNull(); expect(open).toHaveBeenCalledTimes(1); expect(close).not.toHaveBeenCalled(); controller.close(); expect(document.activeElement).toBe(before); expect(close).toHaveBeenCalledTimes(1);
});
it('uses live Escape/backdrop/returnFocus options without rebuilding a dialog', () => {
  const before = button(), el = root('<h2 zen-dialog-title>Title</h2><button>Inside</button><span zen-dialog-backdrop>Backdrop</span>'), closeOnEsc = signal(false), closeOnBackdrop = signal(false), returnFocus = signal(true); before.focus();
  const controller = createDialog(el, { closeOnEsc, closeOnBackdrop, returnFocus }); releases.push(controller.dispose); controller.open(); key(el.querySelector('button')!, 'Escape'); el.querySelector<HTMLElement>('span')!.click(); expect(controller.state.peek()).toBe(true);
  closeOnEsc.set(true); returnFocus.set(false); flushSync(); key(el.querySelector('button')!, 'Escape'); expect(controller.state.peek()).toBe(false); expect(document.activeElement).not.toBe(before);
});
it('reacts to initialOpen, initialFocus and portal target while preserving the authored position', () => {
  const source = root('<div id="dialog"><h2 zen-dialog-title>Title</h2><button id="a">A</button><button id="b">B</button></div><i>After</i>'), el = source.querySelector<HTMLElement>('#dialog')!, next = el.nextSibling, a = root(), b = root();
  const portal = signal<string | HTMLElement | false>(a), initialOpen = signal(false), initialFocus = signal('#a');
  const controller = createDialog(el, { portal, initialOpen, initialFocus }); releases.push(controller.dispose); expect(el.parentElement).toBe(a); initialOpen.set(true); flushSync(); expect(document.activeElement?.id).toBe('a'); initialFocus.set('#b'); portal.set(b); flushSync(); expect(el.parentElement).toBe(b); expect(document.activeElement?.id).toBe('b');
  initialOpen.set(false); flushSync(); expect(controller.state.peek()).toBe(false); controller.dispose(); expect(el.parentElement).toBe(source); expect(el.nextSibling).toBe(next); const html = source.outerHTML; initialOpen.set(true); flushSync(); expect(source.outerHTML).toBe(html);
});
it('changes floating geometry and anchors without leaking old trigger listeners or ARIA', async () => {
  const a = button('A'), b = button('B'), el = root('Surface'), trigger = signal<HTMLElement>(a), placement = signal<Placement>('bottom'), offset = signal(8), mode = signal<'click' | 'manual'>('click');
  a.setAttribute('aria-expanded', 'authored'); const controller = createPopover(el, { trigger, placement, offset, triggerOn: mode }), opened = vi.fn(), closed = vi.fn(); releases.push(controller.dispose); el.addEventListener('zen-popover-open', opened); el.addEventListener('zen-popover-close', closed); a.click(); expect(controller.state.peek()).toBe(true);
  trigger.set(b); placement.set('right'); offset.set(20); mode.set('manual'); flushSync(); expect(a.getAttribute('aria-expanded')).toBe('authored'); expect(a.hasAttribute('aria-controls')).toBe(false); expect(b.getAttribute('aria-expanded')).toBe('true'); expect(el.getAttribute('data-placement')).toMatch(/^right/); expect(opened).toHaveBeenCalledTimes(1); expect(closed).not.toHaveBeenCalled(); a.remove(); await Promise.resolve(); expect(controller.state.peek()).toBe(true); b.click(); expect(controller.state.peek()).toBe(true); controller.close(); controller.dispose(); expect(b.hasAttribute('aria-expanded')).toBe(false);
});
it('restores a replaced arrow immediately and never writes it after disposal in geometry', () => {
  const trigger = button(), el = root('<span id="first" style="color:red"></span><span id="second" style="color:blue"></span>'), first = el.querySelector<HTMLElement>('#first')!, second = el.querySelector<HTMLElement>('#second')!, arrow = signal<HTMLElement | undefined>(first), firstStyle = first.getAttribute('style'), secondStyle = second.getAttribute('style');
  const controller = createPopover(el, { trigger, arrow }); releases.push(controller.dispose); controller.open(); arrow.set(second); flushSync(); expect(first.getAttribute('style')).toBe(firstStyle);
  vi.spyOn(trigger, 'getBoundingClientRect').mockImplementation(() => { controller.dispose(); return new DOMRect(0, 0, 10, 10); }); window.dispatchEvent(new Event('resize')); expect(second.getAttribute('style')).toBe(secondStyle);
});
it('moves tooltip description/input ownership to the new trigger and obeys reactive disabled/delay', async () => {
  vi.useFakeTimers(); const a = button('A'), b = button('B'), el = root('Help'), trigger = signal<HTMLElement>(a), disabled = signal(false), delay = signal(50), controller = createTooltip(el, { trigger, disabled, delay }); releases.push(controller.dispose);
  a.focus(); vi.advanceTimersByTime(20); delay.set(0); flushSync(); vi.advanceTimersByTime(0); expect(controller.state.peek()).toBe(true); disabled.set(true); flushSync(); expect(controller.state.peek()).toBe(false);
  trigger.set(b); flushSync(); expect(a.hasAttribute('aria-describedby')).toBe(false); expect(b.getAttribute('aria-describedby')).toBe(el.id); a.remove(); await Promise.resolve(); disabled.set(false); flushSync(); b.focus(); vi.advanceTimersByTime(0); expect(controller.state.peek()).toBe(true);
});
it('uses reactive menu loop/typeahead/closeOnSelect and the current trigger', async () => {
  const a = button('A'), b = button('B'), el = root('<button zen-menu-item data-value="a">Alpha</button><button zen-menu-item data-value="b">Beta</button>'), trigger = signal<HTMLElement>(a), loop = signal(false), typeahead = signal(false), closeOnSelect = signal(false);
  const controller = createMenu(el, { trigger, loop, typeahead, closeOnSelect }); releases.push(controller.dispose); controller.open(); const items = el.querySelectorAll('button'); items[1]!.focus(); key(items[1]!, 'ArrowDown'); expect(document.activeElement).toBe(items[1]); typeahead.set(true); loop.set(true); trigger.set(b); flushSync(); expect(a.hasAttribute('aria-haspopup')).toBe(false); a.remove(); await Promise.resolve(); key(items[1]!, 'ArrowDown'); expect(document.activeElement).toBe(items[0]); items[0]!.click(); expect(controller.state.peek()).toBe(true); closeOnSelect.set(true); flushSync(); items[1]!.click(); expect(controller.state.peek()).toBe(false); expect(document.activeElement).toBe(b);
});
it('refcounts watched nodes so releasing one lease cannot forget another removal owner', async () => {
  const el = root(), watched = button(), owner = ownership(el), released = vi.fn(); releases.push(owner.dispose); owner.add(released); const a = owner.watch(watched), b = owner.watch(watched); a(); watched.remove(); await Promise.resolve(); expect(released).toHaveBeenCalledTimes(1); b();
});

it('restores each replaced menu anchor without resurrecting another owner’s ARIA snapshot', () => {
  const a = document.createElement('button'), b = document.createElement('button'); a.setAttribute('aria-haspopup', 'dialog'); a.setAttribute('aria-controls', 'authored'); const el = root('<button zen-menu-item>A</button>'); document.body.prepend(a, b);
  const trigger = signal(a), controller = createMenu(el, { trigger }); releases.push(controller.dispose); expect(a.getAttribute('aria-haspopup')).toBe('menu'); trigger.set(b); flushSync(); expect(a.getAttribute('aria-haspopup')).toBe('dialog'); expect(a.getAttribute('aria-controls')).toBe('authored'); expect(a.hasAttribute('aria-expanded')).toBe(false); controller.dispose(); expect(b.hasAttribute('aria-haspopup')).toBe(false); expect(b.hasAttribute('aria-controls')).toBe(false); expect(b.hasAttribute('aria-expanded')).toBe(false);
});
