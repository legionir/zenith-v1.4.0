// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createHydrator, hydrateTextExpr, hydrateShowExpr, hydrateModel, hasHydrationMarkers, countHydrationMarkers } from '../src/hydrate';
import { createHydrator as Create } from '../src/hydration-root';
import { hydrateTextExpr as Text } from '../src/hydration-values';
import { buildContext } from '../src/hydration-context';
const releases: Array<() => void> = [];
afterEach(() => { for (const release of releases.splice(0).reverse()) release(); document.body.innerHTML = ''; });
it('preserves factory and directive identity through the hydration facade', () => { expect(createHydrator).toBe(Create); expect(hydrateTextExpr).toBe(Text); });
it('retains raw bare keys, lazy get-only unwrapping and current-value getters', () => {
  let current = 'one'; const get = vi.fn(() => current), value = { get };
  const context = buildContext({ value }); expect(context.value).toBe(value); expect(get).not.toHaveBeenCalled();
  expect(context.$value).toBe('one'); current = 'two'; expect(context.$value).toBe('two'); expect(get).toHaveBeenCalledTimes(2);
});
it('retains precompiled evaluation identity and leaves SSR nodes mounted when showing/hiding', () => {
  const element = document.createElement('div'); element.innerHTML = '<b>server</b>'; const child = element.firstChild;
  const visible = signal(false); releases.push(hydrateShowExpr(element, () => visible.get(), {}));
  expect(element.style.display).toBe('none'); expect(element.firstChild).toBe(child);
  visible.set(true); flushSync(); expect(element.style.display).toBe(''); expect(element.firstChild).toBe(child); visible.dispose();
});
it('hydrates descendants without applying root attributes or replacing the state object', () => {
  const root = document.createElement('div'); root.setAttribute('zen-bind:data-root', '$value'); root.innerHTML = '<span zen-text="$value">server</span>';
  const state = { value: signal('client') }, hydrator = createHydrator(root, state); releases.push(() => hydrator.dispose());
  expect(hydrator.root).toBe(root); expect(hydrator.state).toBe(state); const child = root.firstChild;
  const stop = hydrator.hydrateAll(); expect(root.firstChild).toBe(child); expect(root.textContent).toBe('client'); expect(root.hasAttribute('data-root')).toBe(false);
  stop(); state.value.set('late'); flushSync(); expect(root.textContent).toBe('client'); state.value.dispose();
});
it('keeps expression failures from erasing previously hydrated text', () => {
  const element = document.createElement('span'); element.textContent = 'server';
  releases.push(hydrateTextExpr(element, () => { throw new Error('expression'); }, {})); expect(element.textContent).toBe('server');
});
it('keeps two-way model writes, receiver binding and listener cleanup', () => {
  const input = document.createElement('input'), value = signal('one');
  const stop = hydrateModel(input, '$value', {}, { value }); releases.push(stop);
  expect(input.value).toBe('one'); input.value = 'two'; input.dispatchEvent(new Event('input')); expect(value.get()).toBe('two');
  stop(); input.value = 'ignored'; input.dispatchEvent(new Event('input')); expect(value.get()).toBe('two'); value.dispose();
});
it('retains comment marker detection, including whitespace and descendant comments', () => {
  const root = document.createElement('div'); root.innerHTML = '<!-- zenith-ssr:start --><span><!--zenith-ssr:text--></span><!--not-a-marker-->';
  expect(hasHydrationMarkers(root)).toBe(true); expect(countHydrationMarkers(root)).toBe(2);
});
