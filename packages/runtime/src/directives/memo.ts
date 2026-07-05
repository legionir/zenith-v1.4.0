// packages/runtime/src/directives/memo.ts
//
// FEATURE (v1.2.0): zen-memo — Memoization directive.
//
// This directive wraps the element's children in an effect that only re-runs
// when the value of `memoExpr` changes (using an `Object.is` equality check).
// If the value is referentially equal to the previous run, the children are
// NOT re-processed, saving work for expensive subtrees.
//
// Usage:
//   <div zen-memo="$filterKey">
//     <!-- heavy subtree that should not re-render on every state change -->
//     <li zen-for="$items($filterKey)">...</li>
//   </div>
//
// Implementation notes:
//   - The memo expression is compiled once with `compileExpression`.
//   - Inside an `effect`, we read the memo value. The effect re-runs whenever
//     the memo value (or any signal it reads) changes.
//   - On each effect run, we compare the new memo value to the previous one
//     with `Object.is`. If they are equal, we skip re-processing the children.
//   - When they differ, we dispose the previous children's effects (via the
//     captured disposes array) and re-run `processChildren` to bind the new
//     subtree state.
//   - `zen-memo` attribute is removed after binding so the walker does not
//     re-process it on a re-walk.
//
// SSR safety:
//   - `effect` and `compileExpression` come from `@zenith/state` and
//     `@zenith/expressions` respectively; both are safe to import on the
//     server (the directive itself only runs in a walker context).

import { effect } from '@zenith/state';
import { compileExpression } from '@zenith/expressions';
import { reportError } from '@zenith/error-boundary';

/**
 * Signature of the `processChildren` callback supplied by the walker.
 *
 * It is responsible for walking the element's children (and the element's own
 * node directives) with the given context, pushing dispose functions into the
 * supplied `itemDisposes` array.
 */
export type MemoProcessChildren = (
  el: HTMLElement,
  context: Record<string, any>,
  itemDisposes: (() => void)[],
) => void;

/**
 * Process the `zen-memo` directive.
 *
 * @param el            The element carrying `zen-memo`.
 * @param memoExpr      Expression whose value is tracked for changes.
 * @param context       The current reactive context.
 * @param processChildren Walker-supplied callback for binding the subtree.
 * @returns Dispose function — disposes both the effect and any children.
 */
export function processMemo(
  el: HTMLElement,
  memoExpr: string,
  context: Record<string, any>,
  processChildren: MemoProcessChildren,
): () => void {
  // FEATURE (v1.0.0): compile-once — memoExpr is parsed only once.
  const evalFn = compileExpression(memoExpr);

  // Remove the attribute so a re-walk does not re-enter this directive.
  el.removeAttribute('zen-memo');

  // Track the most recently seen memo value. Initialize with a sentinel
  // that is guaranteed to be unique so the first run always processes.
  let lastValue: any = ZenithMemoSentinel;
  let childDisposes: (() => void)[] = [];

  const dispose = effect(() => {
    // Read the memo value inside the effect so we subscribe to it.
    let value: any;
    try {
      value = evalFn(context);
    } catch (err) {
      reportError(err as Error, 'expression', {
        expression: memoExpr,
        element: el,
      });
      return;
    }

    // Object.is equality check (handles NaN, +0/-0, referential equality).
    if (Object.is(value, lastValue)) {
      // No change — skip re-processing.
      return;
    }

    // Value changed: dispose old children and re-process.
    for (const d of childDisposes) {
      try {
        d();
      } catch (e) {
        if (typeof console !== 'undefined' && console.error) {
          console.error('[Zenith zen-memo] child dispose failed:', e);
        }
      }
    }
    childDisposes = [];

    // FIX (v1.2.8): P1-6 — Move `lastValue = value` to AFTER processChildren
    // succeeds. Previously lastValue was set BEFORE processChildren, so if
    // processChildren threw, the next effect run would see the new value
    // already in lastValue, compare it as equal, and SKIP re-processing —
    // leaving the subtree in a broken half-rendered state forever. By
    // updating lastValue only after processChildren succeeds, the next run
    // will retry the (now-failing) re-process until it succeeds.

    // Re-process the element's subtree with the same context.
    try {
      processChildren(el, context, childDisposes);
      // FIX (v1.2.8): P1-6 — only commit lastValue after processChildren
      // has returned without throwing. This ensures that a failed
      // processChildren call will be retried on the next effect run
      // (since lastValue still holds the previous successful value and
      // Object.is(value, lastValue) will be false).
      lastValue = value;
    } catch (err) {
      // FIX (v1.2.4): Clear childDisposes on throw. If `processChildren`
      // threw partway through, the array may contain a partial set of
      // dispose functions for children that were only half-set-up. Calling
      // them later (on next effect run or on directive dispose) could
      // itself throw or operate on a DOM subtree in an inconsistent state.
      // Clearing here means the next successful run starts clean, and the
      // outer dispose only invokes disposes from a fully-successful
      // processChildren call. (The DOM mutations already made by the
      // partial processChildren remain — they will be repaired on the next
      // successful re-process, or stay as-is if no re-process happens.)
      //
      // FIX (v1.2.8): P1-6 — Do NOT update lastValue here. The next effect
      // run will see Object.is(value, lastValue) === false and retry
      // processChildren. Without this, a transient failure (e.g. a Signal
      // that briefly returned undefined) would permanently corrupt the
      // subtree.
      childDisposes = [];
      reportError(err as Error, 'directive', {
        expression: memoExpr,
        element: el,
      });
    }
  });

  return () => {
    for (const d of childDisposes) {
      try {
        d();
      } catch {
        // best-effort
      }
    }
    childDisposes = [];
    dispose();
  };
}

// Unique sentinel for "no previous value seen yet". Using a private symbol
// guarantees Object.is equality never matches a real value.
const ZenithMemoSentinel: unique symbol = Symbol('zenith-memo-sentinel');
