// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createTransition } from '../src';
const releases: Array<() => void> = [];
afterEach(() => { for (const release of releases.splice(0)) release(); document.body.replaceChildren(); vi.useRealTimers(); vi.restoreAllMocks(); });
it('uses the element realm RAF/style APIs and keeps authored class tokens', async () => {
  const iframe = document.createElement('iframe'); document.body.append(iframe); const doc = iframe.contentDocument!, view = iframe.contentWindow!, el = doc.createElement('div'); el.className = 'fade authored'; doc.body.append(el);
  const frame = vi.fn((_callback: FrameRequestCallback) => 1), cancel = vi.fn(); Object.defineProperty(view, 'requestAnimationFrame', { configurable: true, value: frame }); Object.defineProperty(view, 'cancelAnimationFrame', { configurable: true, value: cancel });
  const controller = createTransition('fade'); releases.push(controller.dispose); const run = controller.enter(el); expect(frame).toHaveBeenCalledTimes(1); run.cancel(); await run.finished; expect(cancel).toHaveBeenCalledWith(1); expect(el.className).toBe('fade authored');
});
it('does not start a run after disposal inside a before hook', async () => {
  const el = document.createElement('div'); let controller!: ReturnType<typeof createTransition>; controller = createTransition('fade', { onBeforeEnter: () => controller.dispose() }); releases.push(controller.dispose); await controller.enter(el).finished; expect(el.className).toBe('');
});
it('keeps a reentrant newer run authoritative on the same element', async () => {
  vi.useFakeTimers(); let first = true; const el = document.createElement('div'); document.body.append(el);
  const controller = createTransition('fade', { duration: 20, onBeforeEnter: () => { if (first) { first = false; controller.leave(el); } } }); releases.push(controller.dispose); await controller.enter(el).finished; expect(el.classList.contains('zen-leave-active')).toBe(true); vi.advanceTimersByTime(100); expect(el.className).toBe('');
});
it('does not write destination classes after a style read disposes the owner', async () => {
  vi.useFakeTimers(); const el = document.createElement('div'); document.body.append(el); const controller = createTransition('fade'); releases.push(controller.dispose); const original = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation(node => { controller.dispose(); return original(node); }); const run = controller.enter(el); vi.advanceTimersByTime(100); await run.finished; expect(el.className).toBe('');
});
