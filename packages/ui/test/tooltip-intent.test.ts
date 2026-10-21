// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createTooltip } from '../src';

const releases: Array<() => void> = [];
function setup(options: { delay?: number; hideDelay?: number; disabled?: boolean } = {}) {
  vi.useFakeTimers();
  const trigger = document.createElement('button'), el = document.createElement('div');
  trigger.textContent = 'Help'; el.textContent = 'Description'; document.body.append(trigger, el);
  const tooltip = createTooltip(el, { trigger, delay: 20, hideDelay: 10, ...options }); releases.push(tooltip.dispose);
  return { trigger, el, tooltip };
}
function mouse(el: HTMLElement, type: 'mouseenter' | 'mouseleave', relatedTarget: HTMLElement | null = null) {
  el.dispatchEvent(new MouseEvent(type, { relatedTarget }));
}
afterEach(() => { for (const release of releases.splice(0)) release(); document.body.replaceChildren(); vi.useRealTimers(); });

it('does not hide on mouseleave while focus still holds the trigger', () => {
  const { trigger, tooltip } = setup(); trigger.focus(); mouse(trigger, 'mouseenter'); vi.advanceTimersByTime(20);
  expect(tooltip.state.peek()).toBe(true); mouse(trigger, 'mouseleave'); vi.advanceTimersByTime(100); expect(tooltip.state.peek()).toBe(true);
  trigger.blur(); vi.advanceTimersByTime(10); expect(tooltip.state.peek()).toBe(false);
});
it('does not hide on blur while hover still holds the trigger', () => {
  const { trigger, tooltip } = setup(); mouse(trigger, 'mouseenter'); trigger.focus(); vi.advanceTimersByTime(20);
  trigger.blur(); vi.advanceTimersByTime(100); expect(tooltip.state.peek()).toBe(true);
  mouse(trigger, 'mouseleave'); vi.advanceTimersByTime(10); expect(tooltip.state.peek()).toBe(false);
});
it('keeps the original opening deadline when focus joins hover', () => {
  const { trigger, tooltip } = setup(); mouse(trigger, 'mouseenter'); vi.advanceTimersByTime(15); trigger.focus(); vi.advanceTimersByTime(5);
  expect(tooltip.state.peek()).toBe(true);
});
it('preserves a continuous hover path from trigger to surface and back', () => {
  const { trigger, el, tooltip } = setup(); mouse(trigger, 'mouseenter'); vi.advanceTimersByTime(20);
  mouse(trigger, 'mouseleave', el); mouse(el, 'mouseenter', trigger); vi.advanceTimersByTime(100); expect(tooltip.state.peek()).toBe(true);
  mouse(el, 'mouseleave', trigger); mouse(trigger, 'mouseenter', el); vi.advanceTimersByTime(100); expect(tooltip.state.peek()).toBe(true);
  mouse(trigger, 'mouseleave'); vi.advanceTimersByTime(10); expect(tooltip.state.peek()).toBe(false);
});
it('cancels delayed closure when focus arrives during the gap', () => {
  const { trigger, tooltip } = setup(); mouse(trigger, 'mouseenter'); vi.advanceTimersByTime(20); mouse(trigger, 'mouseleave');
  vi.advanceTimersByTime(5); trigger.focus(); vi.advanceTimersByTime(100); expect(tooltip.state.peek()).toBe(true);
});
it('does not reopen after Escape until both focus and hover disengage', () => {
  const { trigger, tooltip } = setup(); trigger.focus(); mouse(trigger, 'mouseenter'); vi.advanceTimersByTime(20);
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); expect(tooltip.state.peek()).toBe(false);
  mouse(trigger, 'mouseleave'); mouse(trigger, 'mouseenter'); vi.advanceTimersByTime(100); expect(tooltip.state.peek()).toBe(false);
  trigger.blur(); mouse(trigger, 'mouseleave'); mouse(trigger, 'mouseenter'); vi.advanceTimersByTime(20); expect(tooltip.state.peek()).toBe(true);
});
it('cancels a pending opening and prevents resurrection after disposal', () => {
  const { trigger, tooltip } = setup(); mouse(trigger, 'mouseenter'); trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  vi.advanceTimersByTime(100); expect(tooltip.state.peek()).toBe(false); mouse(trigger, 'mouseleave'); mouse(trigger, 'mouseenter'); tooltip.dispose();
  vi.advanceTimersByTime(100); expect(trigger.hasAttribute('aria-describedby')).toBe(false);
});
it('keeps disabled tooltips closed for both interaction and imperative opening', () => {
  const { trigger, tooltip } = setup({ disabled: true }); trigger.focus(); mouse(trigger, 'mouseenter'); tooltip.open(); vi.advanceTimersByTime(100); expect(tooltip.state.peek()).toBe(false);
});
it('does not treat focus moving between descendants as leaving a composite trigger', () => {
  const { trigger, tooltip } = setup(); const child = document.createElement('span'); child.tabIndex = 0; trigger.append(child);
  trigger.focus(); vi.advanceTimersByTime(20); child.focus(); vi.advanceTimersByTime(100); expect(tooltip.state.peek()).toBe(true);
});
