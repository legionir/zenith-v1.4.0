// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createTabs, createAccordion, createCombobox } from '../src';
const releases: Array<() => void> = [];
function root(html: string) { const el = document.createElement('section'); el.innerHTML = html; document.body.append(el); return el; }
afterEach(() => { for (const release of releases.splice(0).reverse()) release(); document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks(); });
it('animates visited tabs without leaving old content keyboard-accessible', async () => {
  vi.useFakeTimers(); const el = root('<div zen-tablist><button zen-tab>A</button><button zen-tab>B</button></div><div zen-tabpanel><button>Content A</button></div><div zen-tabpanel><button>Content B</button></div>'), controller = createTabs(el, { transition: 'fade', transitionDuration: 20 }); releases.push(controller.dispose); const panels = el.querySelectorAll<HTMLElement>('[zen-tabpanel]');
  controller.select(1); expect(panels[0]!.hidden).toBe(false); expect(panels[0]!.hasAttribute('inert')).toBe(true); expect(panels[1]!.hasAttribute('inert')).toBe(false); controller.select(0); vi.advanceTimersByTime(100); await Promise.resolve(); expect(panels[0]!.hidden).toBe(false); expect(panels[1]!.hidden).toBe(true);
});
it('cancels an accordion leave when the same disclosure is reopened', async () => {
  vi.useFakeTimers(); const el = root('<article zen-accordion-item><button zen-accordion-trigger>Question</button><div zen-accordion-panel>Answer</div></article>'), controller = createAccordion(el, { transition: 'fade', transitionDuration: 20 }); releases.push(controller.dispose); const panel = el.querySelector<HTMLElement>('[zen-accordion-panel]')!;
  controller.toggle(0); controller.toggle(0); expect(panel.hidden).toBe(false); expect(panel.hasAttribute('inert')).toBe(true); controller.toggle(0); vi.advanceTimersByTime(100); await Promise.resolve(); expect(panel.hidden).toBe(false); expect(panel.hasAttribute('inert')).toBe(false);
});
it('ignores an exiting combobox row and does not restart enter on active-descendant keys', async () => {
  vi.useFakeTimers(); const el = root('<input aria-label="Choice"><div zen-combobox-list></div>'), controller = createCombobox(el, { options: [{ label: 'A', value: 'a' }], transition: 'fade', transitionDuration: 20 }); releases.push(controller.dispose); await controller.search('');
  const input = el.querySelector('input')!, list = el.querySelector<HTMLElement>('[zen-combobox-list]')!, additions = vi.spyOn(list.classList, 'add'); input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); expect(additions).not.toHaveBeenCalled(); controller.close(); list.querySelector('[role="option"]')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })); expect(controller.state.peek()).toEqual([]); vi.advanceTimersByTime(100); await Promise.resolve(); expect(list.hidden).toBe(true);
});
it('unhides a formerly inactive SSR tab panel on its first client selection', () => {
  const el = root('<div zen-tablist><button zen-tab>A</button><button zen-tab>B</button></div><div zen-tabpanel>A</div><div zen-tabpanel hidden inert aria-hidden="true">B</div>'), controller = createTabs(el); releases.push(controller.dispose); controller.select(1); const panel = el.querySelectorAll<HTMLElement>('[zen-tabpanel]')[1]!; expect(panel.hidden).toBe(false); expect(panel.hasAttribute('inert')).toBe(false); expect(panel.hasAttribute('aria-hidden')).toBe(false);
});
