// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createCombobox, comboboxOptions, dialogOptions, popoverOptions, tooltipOptions, menuOptions, createDialog } from '../src';
const releases: Array<() => void> = [];
function root() { const el = document.createElement('div'); el.innerHTML = '<input aria-label="Choice" value="Authored"><div zen-combobox-list><b>Original</b></div>'; document.body.append(el); return el; }
afterEach(() => { for (const release of releases.splice(0)) release(); document.body.replaceChildren(); vi.restoreAllMocks(); });
it('strictly validates shared UI configurations before mutating DOM', () => {
  expect(() => dialogOptions.resolve({ role: 'menu' })).toThrow(); expect(() => popoverOptions.resolve({ placement: 'diagonal' })).toThrow(); expect(() => tooltipOptions.resolve({ delay: 'never' })).toThrow(); expect(() => menuOptions.resolve({ loop: 'wat' })).toThrow(); expect(() => comboboxOptions.resolve({ options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'a' }] })).toThrow();
  expect(tooltipOptions.resolve().placement).toBe('top'); expect(dialogOptions.resolve().modal).toBe(true);
  const el = root(), before = el.outerHTML; expect(() => createDialog(el, Object.assign({ role: 'dialog' as const }, { typo: true }))).toThrow(); expect(el.outerHTML).toBe(before);
});
it('reacts to source/value changes without echoing selection changes and restores the input value', async () => {
  const el = root(), options = signal([{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }]), value = signal<readonly string[]>(['a']), controller = createCombobox(el, { options, value }), change = vi.fn(); releases.push(controller.dispose); el.addEventListener('zen-combobox-change', change);
  expect(el.querySelector('input')!.value).toBe('A'); options.set([{ label: 'C', value: 'c' }]); value.set(['c']); flushSync(); expect(controller.state.peek()).toEqual(['c']); expect(el.querySelector('input')!.value).toBe('C'); expect(change).not.toHaveBeenCalled();
  await controller.search(''); controller.select('c'); controller.setValue([]); expect(change).not.toHaveBeenCalled(); controller.dispose(); expect(el.querySelector('input')!.value).toBe('Authored'); expect(el.querySelector('b')!.textContent).toBe('Original');
});
it('aborts an obsolete loader when its source option changes, rejecting its late results', async () => {
  const el = root(); let firstSignal: AbortSignal | undefined, complete!: (value: Array<{ label: string; value: string }>) => void;
  const options = signal<import('../src').ComboboxSource>((_query, signal) => { firstSignal = signal; return new Promise(resolve => { complete = resolve; }); });
  const controller = createCombobox(el, { options }); releases.push(controller.dispose); const pending = controller.search(''); options.set([{ label: 'New', value: 'new' }]); flushSync(); expect(firstSignal!.aborted).toBe(true); complete([{ label: 'Old', value: 'old' }]); await pending; expect(el.querySelector('[role="option"]')).toBeNull(); await controller.search(''); expect(el.querySelector('[role="option"]')!.textContent).toBe('New');
});
it('does not retain generated-row actions or filter callbacks after reentrant disposal', async () => {
  const el = root(); let count = 0; let controller!: ReturnType<typeof createCombobox>; controller = createCombobox(el, { options: [{ label: 'A', value: 'a' }, { label: 'B', value: 'b' }], filter: () => { count++; controller.dispose(); return true; } }); releases.push(controller.dispose);
  await controller.search(''); expect(count).toBe(1); expect(el.querySelector('[role="option"]')).toBeNull(); expect(el.querySelector('b')!.textContent).toBe('Original');
});
it('ignores composition keys and does not submit stale rows for a changed query', async () => {
  const el = root(), controller = createCombobox(el, { options: [{ label: 'A', value: 'a' }] }); releases.push(controller.dispose); await controller.search(''); const input = el.querySelector('input')!;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', isComposing: true, bubbles: true })); expect(input.getAttribute('aria-activedescendant')).toBeNull(); input.value = 'missing'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })); await Promise.resolve(); expect(el.querySelector('[role="option"]')).toBeNull();
});
