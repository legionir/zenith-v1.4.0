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
//     <li zen-for="$items($filterKey)">...</li>
//   </div>
import { effect } from '@zenith/state';
import { compileExpression } from '@zenith/expressions';
import { reportError } from '@zenith/error-boundary';
// Unique sentinel for "no previous value seen yet". Using a private symbol
// guarantees Object.is equality never matches a real value.
const ZenithMemoSentinel = Symbol('zenith-memo-sentinel');
/**
 * Process the `zen-memo` directive.
 *
 * @param el            The element carrying `zen-memo`.
 * @param memoExpr      Expression whose value is tracked for changes.
 * @param context       The current reactive context.
 * @param processChildren Walker-supplied callback for binding the subtree.
 * @returns Dispose function — disposes both the effect and any children.
 */
export function processMemo(el, memoExpr, context, processChildren) {
    // FEATURE (v1.0.0): compile-once — memoExpr is parsed only once.
    const evalFn = compileExpression(memoExpr);
    // Remove the attribute so a re-walk does not re-enter this directive.
    el.removeAttribute('zen-memo');
    // Track the most recently seen memo value. Initialize with a sentinel
    // that is guaranteed to be unique so the first run always processes.
    let lastValue = ZenithMemoSentinel;
    let childDisposes = [];
    const dispose = effect(() => {
        // Read the memo value inside the effect so we subscribe to it.
        let value;
        try {
            value = evalFn(context);
        }
        catch (err) {
            reportError(err, 'expression', { expression: memoExpr, element: el });
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
            }
            catch (e) {
                if (typeof console !== 'undefined' && console.error) {
                    console.error('[Zenith zen-memo] child dispose failed:', e);
                }
            }
        }
        childDisposes = [];
        // FIX (v1.2.8): P1-6 — Move `lastValue = value` to AFTER processChildren
        // succeeds. Previously lastValue was set BEFORE processChildren, so if
        // processChildren threw, the next effect run would see the new value
        // already in lastValue, compare as equal, and SKIP re-processing —
        // leaving the subtree in a broken half-rendered state forever.
        try {
            processChildren(el, context, childDisposes);
            // FIX (v1.2.8): P1-6 — only commit lastValue after processChildren
            // has returned without throwing. A failed run will be retried on
            // the next effect (Object.is(value, lastValue) === false).
            lastValue = value;
        }
        catch (err) {
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
            reportError(err, 'directive', { expression: memoExpr, element: el });
        }
    });
    return () => {
        for (const d of childDisposes) {
            try {
                d();
            }
            catch {
                // best-effort
            }
        }
        childDisposes = [];
        dispose();
    };
}
//# sourceMappingURL=memo.js.map
