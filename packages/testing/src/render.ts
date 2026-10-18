import { deprecate } from '@zenith/errors';
import { renderOptions } from './options';
import { createRoot } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';

/** @public */
export interface RenderResult {
  /** Root container element */
  container: HTMLElement;
  /** Dispose function to clean up */
  unmount: () => void;
  /** Flush pending effects */
  flush: () => void;
  /** Query selector inside container */
  query: <T extends HTMLElement = HTMLElement>(selector: string) => T | null;
  /** Query selector all inside container */
  queryAll: <T extends HTMLElement = HTMLElement>(selector: string) => T[];
  /** Get text content of container */
  text: () => string;
}

/**
 * Render a component / template string into an isolated test container.
 * Requires a DOM environment (jsdom, happy-dom, or browser).
 *
 * @example
 * it('renders name', () => {
 *   const { query, unmount } = render({ template: '<div zen-text="name"></div>', state: { name: 'Ali' } });
 *   expect(query('div')?.textContent).toBe('Ali');
 *   unmount();
 * });
 * @public
 */
export interface RenderOptions { template: string; state?: Record<string, unknown>; attachToBody?: boolean; }
/** @public */
export function render(options: RenderOptions): RenderResult;
/** @public @deprecated Use render({ template, state, attachToBody }) (ZEN-DEPR-093; removal in 2.0). */
export function render(template: string, state?: Record<string, unknown>, options?: { attachToBody?: boolean }): RenderResult;
export function render(optionsOrTemplate: RenderOptions | string, legacyState: Record<string, unknown> = {}, legacyOptions: { attachToBody?: boolean } = {}): RenderResult {
  let template: string, state: Record<string, unknown>, options: { attachToBody?: boolean };
  if (typeof optionsOrTemplate === 'string' || arguments.length > 1) {
    deprecate('ZEN-DEPR-093', 'render(template, state, options)', 'render({ template, state, attachToBody })');
    template = optionsOrTemplate as string; state = legacyState; options = legacyOptions;
  } else {
    const resolved = renderOptions.resolve(optionsOrTemplate);
    template = resolved.template; state = resolved.state ?? {}; options = resolved;
  }
  const container = document.createElement('div');
  container.innerHTML = template;

  if (options.attachToBody && document.body) {
    document.body.appendChild(container);
  }

  let dispose: (() => void) | null = null;

  createRoot((rootDispose) => {
    dispose = rootDispose;
    // Initialize runtime on container (delegates to actual runtime)
    const candidate: unknown = Reflect.get(window, 'Zen');
    if (candidate != null && Reflect.get(Object(candidate), 'start')) {
      // Keep the second lookup and the receiver of Zen.start (including getters).
      const receiver: unknown = Reflect.get(window, 'Zen');
      const start: unknown = receiver == null ? undefined : Reflect.get(Object(receiver), 'start');
      if (typeof start !== 'function') throw new TypeError('Zen.start is not callable');
      Reflect.apply(start, receiver, [container, state]);
    }
  });

  return {
    container,
    unmount: () => {
      dispose?.();
      container.remove();
    },
    flush: flushSync,
    query: <T extends HTMLElement>(selector: string) =>
      container.querySelector(selector) as T | null,
    queryAll: <T extends HTMLElement>(selector: string) =>
      Array.from(container.querySelectorAll(selector)) as T[],
    text: () => container.textContent ?? '',
  };
}

// ============================================================
// Vitest / Jest matchers extension (optional)
// ============================================================

/**
 * Custom matchers for test runners.
 * Register with: expect.extend(zenithMatchers)
 * @public
 */
export const zenithMatchers = {
  toHaveValue(received: { get(): unknown }, expected: unknown) {
    const actual = received.get();
    const pass = Object.is(actual, expected);
    return {
      pass,
      message: () =>
        pass
          ? `Expected signal NOT to have value ${JSON.stringify(expected)}`
          : `Expected signal to have value ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    };
  },
  toBeReadonly(received: unknown) {
    const pass = !!received && typeof received === 'object' && typeof Reflect.get(received, 'set') !== 'function';
    return {
      pass,
      message: () =>
        pass
          ? 'Expected signal NOT to be readonly'
          : 'Expected signal to be readonly (no .set method)',
    };
  },
};

// ============================================================
// #99 / #137: Automated WCAG 2.2 AA / axe-core style DOM Auditor
// ============================================================
