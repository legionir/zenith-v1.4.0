/**
 * Zenith Testing Utilities
 *
 * Provides a standard toolkit for testing Zenith applications,
 * components, signals and effects in isolation or integration.
 *
 * Compatible with Vitest, Jest, Bun test and other modern test runners.
 */

import { signal, effect, computed, createRoot } from '@zenith/state';
import type { Signal, ReadonlySignal } from '@zenith/state';
import { flushSync, nextTick } from '@zenith/scheduler';
import { developerError, ErrorCode, ZenithError, resetDeprecationWarnings, clearErrorHistory } from '@zenith/errors';

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
      tick: () => new Promise<void>((resolve) => nextTick(resolve)),
      signal,
      effect,
      computed,
    };
  });

  // Support explicit resource management `using` keyword
  return {
    ...result,
    [Symbol.dispose]() {
      disposeFn?.();
    },
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
    dispose: () => {},
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
  options: { timeout?: number; interval?: number } = {},
): Promise<void> {
  const { timeout = 1000, interval = 10 } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    flushSync();
    if (condition()) return;
    await new Promise((r) => setTimeout(r, interval));
  }

  throw developerError(`waitFor timed out after ${timeout}ms`, ErrorCode.INTERNAL_UNKNOWN, {
    category: 'Internal',
    suggestion: 'مهلت را زیاد کنید یا شرط را بررسی کنید.',
  });
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
    get setCount() {
      return setCount;
    },
    reset: () => {
      history.length = 0;
      history.push(initial);
      setCount = 0;
    },
  };
}

/**
 * Assert that a signal's value eventually matches expectation.
 */
export async function expectSignal<T>(
  sig: Signal<T> | ReadonlySignal<T>,
  matcher: (value: T) => boolean,
  options?: { timeout?: number },
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
    get requestCount() {
      return requestCount;
    },
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
  options: { attachToBody?: boolean } = {},
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
 */
export const zenithMatchers = {
  toHaveValue(received: Signal<any>, expected: any) {
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
    toBeReadonly(received: any) {
    const pass = received && typeof received.set === 'undefined';
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

export type A11yImpact = 'minor' | 'moderate' | 'serious' | 'critical';

export interface A11yViolation {
  id: string;
  impact: A11yImpact;
  description: string;
  selector: string;
}

export interface A11yAuditOptions {
  /** Minimum impact level to fail on (default: 'serious') */
  minImpact?: A11yImpact;
  /** Rule IDs to allowlist / ignore */
  allowlist?: readonly string[];
}

export interface A11yAuditResult {
  passes: number;
  violations: A11yViolation[];
}

const IMPACT_RANK: Record<A11yImpact, number> = {
  minor: 1,
  moderate: 2,
  serious: 3,
  critical: 4,
};

function hasAccessibleName(el: Element, root: ParentNode): boolean {
  if ((el.textContent ?? '').trim().length > 0) return true;
  if ((el.getAttribute('aria-label') ?? '').trim().length > 0) return true;
  if ((el.getAttribute('title') ?? '').trim().length > 0) return true;
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy && typeof root.querySelector === 'function') {
    for (const id of labelledBy.split(/\s+/).filter(Boolean)) {
      const ref = root.querySelector(`#${CSS.escape ? CSS.escape(id) : id}`);
      if (ref && (ref.textContent ?? '').trim().length > 0) return true;
    }
  }
  return false;
}

/**
 * #99: Run automated WCAG 2.2 AA accessibility rules against a DOM subtree.
 */
export function auditAccessibility(
  root: ParentNode,
  options: A11yAuditOptions = {},
): A11yAuditResult {
  const allow = new Set(options.allowlist ?? []);
  const minRank = IMPACT_RANK[options.minImpact ?? 'serious'];
  const violations: A11yViolation[] = [];
  let passes = 0;

  const pushViolation = (v: A11yViolation) => {
    if (allow.has(v.id)) return;
    if (IMPACT_RANK[v.impact] >= minRank) {
      violations.push(v);
    }
  };

  // 1. image-alt (critical)
  for (const img of Array.from(root.querySelectorAll('img'))) {
    if (
      img.getAttribute('aria-hidden') === 'true' ||
      img.getAttribute('role') === 'presentation' ||
      img.hasAttribute('alt') ||
      hasAccessibleName(img, root)
    ) {
      passes++;
    } else {
      pushViolation({
        id: 'image-alt',
        impact: 'critical',
        description: 'Images must have alternate text (alt attribute or aria-label).',
        selector: img.id ? `img#${img.id}` : 'img',
      });
    }
  }

  // 2. button-name (critical)
  for (const btn of Array.from(root.querySelectorAll('button, [role="button"]'))) {
    if (btn.getAttribute('aria-hidden') === 'true' || hasAccessibleName(btn, root)) {
      passes++;
    } else {
      pushViolation({
        id: 'button-name',
        impact: 'critical',
        description: 'Buttons must have discernible text or aria-label.',
        selector: btn.id ? `#${btn.id}` : btn.tagName.toLowerCase(),
      });
    }
  }

  // 3. label (critical)
  for (const ctrl of Array.from(root.querySelectorAll('input, select, textarea'))) {
    const type = (ctrl.getAttribute('type') ?? 'text').toLowerCase();
    if (['hidden', 'submit', 'reset', 'button', 'image'].includes(type)) continue;
    if (ctrl.getAttribute('aria-hidden') === 'true') continue;
    const id = ctrl.getAttribute('id');
    const hasForLabel = id ? Boolean(root.querySelector(`label[for="${id}"]`)) : false;
    const hasWrapLabel = Boolean(ctrl.closest('label'));
    if (
      hasForLabel ||
      hasWrapLabel ||
      hasAccessibleName(ctrl, root) ||
      (ctrl.getAttribute('placeholder') ?? '').trim().length > 0
    ) {
      passes++;
    } else {
      pushViolation({
        id: 'label',
        impact: 'critical',
        description: 'Form controls must have an associated label or aria-label.',
        selector: id ? `#${id}` : ctrl.tagName.toLowerCase(),
      });
    }
  }

  // 4. link-name (serious)
  for (const link of Array.from(root.querySelectorAll('a[href]'))) {
    if (link.getAttribute('aria-hidden') === 'true' || hasAccessibleName(link, root)) {
      passes++;
    } else {
      pushViolation({
        id: 'link-name',
        impact: 'serious',
        description: 'Links must have discernible text or aria-label.',
        selector: link.id ? `a#${link.id}` : 'a[href]',
      });
    }
  }

  // 5. aria-dialog-name (serious)
  for (const dlg of Array.from(root.querySelectorAll('[role="dialog"], [role="alertdialog"]'))) {
    if (hasAccessibleName(dlg, root)) {
      passes++;
    } else {
      pushViolation({
        id: 'aria-dialog-name',
        impact: 'serious',
        description: 'Dialogs and alertdialogs must have an accessible name (aria-label or aria-labelledby).',
        selector: dlg.id ? `#${dlg.id}` : '[role="dialog"]',
      });
    }
  }

  // 6. duplicate-id-aria (critical)
  const seenIds = new Set<string>();
  for (const el of Array.from(root.querySelectorAll('[id]'))) {
    const id = el.getAttribute('id')!;
    if (!id) continue;
    if (seenIds.has(id)) {
      pushViolation({
        id: 'duplicate-id-aria',
        impact: 'critical',
        description: `Duplicate id attribute "#${id}" found in DOM.`,
        selector: `#${id}`,
      });
    } else {
      seenIds.add(id);
      passes++;
    }
  }

  return { passes, violations };
}

/**
 * #99 / #137: Assert that a DOM container has zero serious/critical accessibility violations.
 */
export function expectAccessible(
  root: ParentNode,
  options: A11yAuditOptions = {},
): A11yAuditResult {
  const result = auditAccessibility(root, options);
  if (result.violations.length > 0) {
    const details = result.violations
      .map((v) => `[${v.impact}] ${v.id} (${v.selector}): ${v.description}`)
      .join('; ');
    throw new ZenithError({
      code: 'ZEN-1403',
      category: 'Validation',
      message: `Accessibility audit failed with ${result.violations.length} violation(s): ${details}`,
      suggestion: 'خطاهای ARIA/برچسب عناصر را برطرف کنید یا در صورت موجه بودن به allowlist اضافه نمایید.',
      context: { violations: result.violations },
    });
  }
  return result;
}

const _testingResetHooks = new Set<() => void>();

/**
 * #118: ثبت یک هوک پاکسازی سراسری برای فراخوانی در `resetForTesting()`.
 */
export function registerTestingReset(fn: () => void): () => void {
  _testingResetHooks.add(fn);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    _testingResetHooks.delete(fn);
  };
}

/**
 * #118 / #137: بازنشانی یکپارچه رجیستری‌ها، هشدارهای منسوخ‌شده و تاریخچه خطاها برای تست‌ها.
 */
export function resetForTesting(): void {
  resetDeprecationWarnings();
  clearErrorHistory();
  for (const hook of Array.from(_testingResetHooks)) {
    try {
      hook();
    } catch {
      // ignore teardown errors
    }
  }
}

