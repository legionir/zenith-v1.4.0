// packages/runtime/src/directives/optimistic.ts
//
// FEATURE (v1.2.0): zen-optimistic — Optimistic update directive.
//
// Applies an optimistic update on click, awaits a registered action, and
// either keeps the optimistic state on success or rolls back on error.
import { compileExpression } from '@zenith/expressions';
import { getAction } from '@zenith/actions';
import { reportError } from '@zenith/error-boundary';
/**
 * Process the `zen-optimistic` directive.
 *
 * @param el             Element carrying `zen-optimistic`.
 * @param optimisticExpr Expression to apply optimistically on click.
 * @param rollbackExpr   Expression to apply on action failure.
 * @param context        The current reactive context.
 * @param state          The original state object (passed to the action).
 * @returns Dispose function — removes the click listener.
 */
export function processOptimistic(el, optimisticExpr, rollbackExpr, context, state) {
    const optimisticFn = compileExpression(optimisticExpr);
    const rollbackFn = rollbackExpr ? compileExpression(rollbackExpr) : null;
    el.removeAttribute('zen-optimistic');
    if (rollbackExpr) {
        el.removeAttribute('data-rollback');
    }
    const onClick = async (event) => {
        // 1) Apply the optimistic update.
        try {
            optimisticFn(context);
        }
        catch (err) {
            reportError(err, 'expression', { expression: optimisticExpr, element: el });
            return;
        }
        // 2) Resolve the action by name.
        const actionName = el.getAttribute('data-action');
        if (!actionName) {
            return;
        }
        const action = getAction(actionName);
        if (!action) {
            reportError(new Error(`[zen-optimistic] Action "${actionName}" is not registered.`), 'directive', { element: el });
            if (rollbackFn) {
                try { rollbackFn(context); } catch (err) {
                    reportError(err, 'expression', { expression: rollbackExpr || '', element: el });
                }
            }
            return;
        }
        // 3) Await the action with the proper ActionContext.
        // FIX (v1.2.8): P1-7 — Race the action against a 10-second timeout.
        // Previously, a hung action (network stall, deadlock, never-resolving
        // promise) would leave the optimistic state applied forever and the
        // button stuck in "loading". Now we wrap the action in Promise.race
        // against a 10s timeout — on timeout we treat it as an error: rollback
        // the optimistic state and report a TimeoutError so the developer sees
        // the failure in the error boundary.
        const ACTION_TIMEOUT_MS = 10000;
        let timeoutHandle = null;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => {
                reject(new Error(`[zen-optimistic] Action "${actionName}" timed out after ` +
                    `${ACTION_TIMEOUT_MS / 1000}s. Rolling back optimistic state.`));
            }, ACTION_TIMEOUT_MS);
        });
        try {
            await Promise.race([
                Promise.resolve(action({ state, event, element: el })),
                timeoutPromise,
            ]);
        }
        catch (err) {
            reportError(err, 'action', { element: el });
            // 4) Rollback on error (covers both action rejection AND timeout).
            if (rollbackFn) {
                try { rollbackFn(context); } catch (e2) {
                    reportError(e2, 'expression', { expression: rollbackExpr || '', element: el });
                }
            }
        }
        finally {
            // Always clear the timeout so the timer doesn't keep running if
            // the action resolved quickly. (If the timeout already fired,
            // this is a no-op.)
            if (timeoutHandle !== null) {
                clearTimeout(timeoutHandle);
                timeoutHandle = null;
            }
        }
    };
    el.addEventListener('click', onClick);
    return () => {
        el.removeEventListener('click', onClick);
    };
}
//# sourceMappingURL=optimistic.js.map
