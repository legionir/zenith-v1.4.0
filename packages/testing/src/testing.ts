/**
 * Zenith Testing Utilities
 *
 * Provides a standard toolkit for testing Zenith applications,
 * components, signals and effects in isolation or integration.
 *
 * Compatible with Vitest, Jest, Bun test and other modern test runners.
 */

import { signal, effect, computed, createRoot, onCleanup } from '@zenith/state';
import type { Signal, ReadonlySignal } from '@zenith/state';
import { flushSync, nextTick } from '@zenith/scheduler';

// ============================================================
// Test Harness - isolated reactivity environment
// ============================================================

export interface TestHarness {
  /** Root dispose function - cleans up all effects/signals created inside */
  dispose: () => void;
  /** Flush all pending effects synchronously */
  flush: () => void;
  /** Wait for next tick / effect cycle */
  tick: () => Promise<void>;
  /** Create a signal inside the test root */
  signal: typeof signal;
  /** Create an effect inside the test root */
  effect: typeof effect;
  /** Create a computed inside the test root */
  computed: typeof computed;
}

/**
 * Create an isolated test environment with automatic cleanup.
 * All signals/effects created inside are owned by this root and disposed together.
 *
 * @example
 * it('reacts to changes', () => {
 *   using test = createTestHarness();
 *   const count = test.signal(0);
 *   let rendered = 0;
 *   test.effect(() => { count.get(); rendered++; });
 *   count.set(1);
 *   test.flush();
 *   expect(rendered).toBe(2);
 * });
 */
export function createTestHarness(): TestHarness & Disposable {
  let disposeFn: (() => void) | null = null;

  const result = createRoot<TestHarness>((dispose) => {
    disposeFn = dispose;
    return {
      dispose,
      flush: flushSync,
      tick: () => new Promise<void>(resolve => nextTick(resolve)),
      signal,
      effect,
      computed
    };
  });

  // Support explicit resource management `using` keyword
  return {
    ...result,
    [Symbol.dispose]() {
      disposeFn?.();
    }
  } as TestHarness & Disposable;
}

// ============================================================
// Effect tracking & assertions
// ============================================================

export interface TrackedEffect {
  runCount: number;
  lastValue: any;
  values: any[];
}

/**
 * Track an effect's execution for assertion.
 * Returns an object with run count and captured values.
 */
export function trackEffect(fn: () => any): TrackedEffect & { dispose: () => void } {
  const tracked: TrackedEffect & { dispose: () => void } = {
    runCount: 0,
    lastValue: undefined,
    values: [],
    dispose: () => {}
  };

  const dispose = effect(() => {
    const value = fn();
    tracked.runCount++;
    tracked.lastValue = value;
    tracked.values.push(value);
  });

  tracked.dispose = dispose;
  return tracked;
}

/**
 * Wait until a condition becomes true (polling effect values).
 * Useful for async effects or batched updates.
 */
export async function waitFor(
  condition: () => boolean,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 1000, interval = 10 } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    flushSync();
    if (condition()) return;
    await new Promise(r => setTimeout(r, interval));
  }

  throw new Error(`waitFor timed out after ${timeout}ms`);
}

// ============================================================
// Signal helpers
// ============================================================

/**
 * Create a signal with a spy that records all value changes.
 */
export function createMockSignal<T>(initial: T): {
  signal: Signal<T>;
  history: T[];
  setCount: number;
  reset: () => void;
} {
  const history: T[] = [initial];
  let setCount = 0;

  const base = signal(initial);

  // Wrap set to track history
  const originalSet = base.set.bind(base);
  base.set = (value: T) => {
    originalSet(value);
    history.push(base.get());
    setCount++;
  };

  return {
    signal: base,
    history,
    get setCount() { return setCount; },
    reset: () => {
      history.length = 0;
      history.push(initial);
      setCount = 0;
    }
  };
}

/**
 * Assert that a signal's value eventually matches expectation.
 */
export async function expectSignal<T>(
  sig: Signal<T> | ReadonlySignal<T>,
  matcher: (value: T) => boolean,
  options?: { timeout?: number }
): Promise<void> {
  await waitFor(() => matcher(sig.get()), options);
}

// ============================================================
// Resource / Fetch mocking
// ============================================================

export interface MockResource<T> {
  data: Signal<T | null>;
  loading: Signal<boolean>;
  error: Signal<Error | null>;
  /** Resolve the pending request with data */
  resolve: (data: T) => void;
  /** Reject the pending request with an error */
  reject: (err: Error) => void;
  /** Reset to initial state */
  reset: () => void;
  /** Number of times this resource was requested */
  requestCount: number;
}

/**
 * Create a mock resource for testing data-loading scenarios.
 * Simulates zen-fetch / zen-resource behavior in tests.
 */
export function createMockResource<T = any>(initialData?: T): MockResource<T> {
  const data = signal<T | null>(initialData ?? null);
  const loading = signal(false);
  const error = signal<Error | null>(null);
  let requestCount = 0;

  return {
    data,
    loading,
    error,
    resolve(value: T) {
      loading.set(true);
      requestCount++;
      flushSync();
      data.set(value);
      error.set(null);
      loading.set(false);
      flushSync();
    },
    reject(err: Error) {
      loading.set(true);
      requestCount++;
      flushSync();
      error.set(err);
      data.set(null);
      loading.set(false);
      flushSync();
    },
    reset() {
      data.set(initialData ?? null);
      loading.set(false);
      error.set(null);
      requestCount = 0;
    },
    get requestCount() { return requestCount; }
  };
}

// ============================================================
// Component rendering (jsdom-compatible)
// ============================================================

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
 *   const { query, unmount } = render('<div zen-text="name"></div>', { name: 'Ali' });
 *   expect(query('div')?.textContent).toBe('Ali');
 *   unmount();
 * });
 */
export function render(
  template: string,
  state: Record<string, any> = {},
  options: { attachToBody?: boolean } = {}
): RenderResult {
  const container = document.createElement('div');
  container.innerHTML = template;

  if (options.attachToBody && document.body) {
    document.body.appendChild(container);
  }

  let dispose: (() => void) | null = null;

  createRoot((rootDispose) => {
    dispose = rootDispose;
    // Initialize runtime on container (delegates to actual runtime)
    if ((window as any).Zen?.start) {
      (window as any).Zen.start(container, state);
    }
  });

  return {
    container,
    unmount: () => {
      dispose?.();
      container.remove();
    },
    flush: flushSync,
    query: <T extends HTMLElement>(selector: string) => container.querySelector(selector) as T | null,
    queryAll: <T extends HTMLElement>(selector: string) => Array.from(container.querySelectorAll(selector)) as T[],
    text: () => container.textContent ?? ''
  };
}

// ============================================================
// Vitest / Jest matchers extension (optional)
// ============================================================

/**
 * Custom matchers for test runners.
 * Register with: expect.extend(zenithMatchers)
 */
export const zenithMatchers = {
  toHaveValue(received: Signal<any>, expected: any) {
    const actual = received.get();
    const pass = Object.is(actual, expected);
    return {
      pass,
      message: () => pass
        ? `Expected signal NOT to have value ${JSON.stringify(expected)}`
        : `Expected signal to have value ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    };
  },
  toBeReadonly(received: any) {
    const pass = received && typeof received.set === 'undefined';
    return {
      pass,
      message: () => pass
        ? 'Expected signal NOT to be readonly'
        : 'Expected signal to be readonly (no .set method)'
    };
  }
};
