// packages/runtime/src/directives/optimistic.ts
//
// FEATURE (v1.2.0): zen-optimistic — Optimistic update directive.
//
// Applies an optimistic update on click, awaits a registered action, and
// either keeps the optimistic state on success or rolls back on error. Both
// the optimistic and rollback expressions are compiled with compileExpression
// so they can perform arbitrary state mutations.
//
// Usage:
//   <button zen-optimistic="$count.set($count.get() + 1)"
//            data-rollback="$count.set($count.get() - 1)"
//            data-action="increment">+1</button>
//
// Implementation notes:
//   - On click, `optimisticExpr` is evaluated (this should mutate state).
//   - The named action (read from `data-action`) is then awaited with the
//     proper ActionContext: { state, event, element }.
//   - On success: nothing else happens — the optimistic state is kept.
//   - On error: `rollbackExpr` is evaluated to revert the state.
//
// SSR safety:
//   - All work is done in event handlers, so the directive itself is safe to
//     import on the server. `compileExpression` and `getAction` are also SSR
//     safe.

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
export function processOptimistic(
  el: HTMLElement,
  optimisticExpr: string,
  rollbackExpr: string | null,
  context: Record<string, any>,
  state: Record<string, any>,
): () => void {
  const optimisticFn = compileExpression(optimisticExpr);
  const rollbackFn = rollbackExpr ? compileExpression(rollbackExpr) : null;

  el.removeAttribute('zen-optimistic');
  if (rollbackExpr) {
    el.removeAttribute('data-rollback');
  }

  // The action name is read from `data-action` at click time (not at bind
  // time) so that dynamically-registered actions work too.
  const onClick = async (event: Event): Promise<void> => {
    // 1) Apply the optimistic update.
    try {
      optimisticFn(context);
    } catch (err) {
      reportError(err as Error, 'expression', {
        expression: optimisticExpr,
        element: el,
      });
      return;
    }

    // 2) Resolve the action by name.
    const actionName = el.getAttribute('data-action');
    if (!actionName) {
      // No action to await — treat as success.
      return;
    }
    const action = getAction(actionName);
    if (!action) {
      reportError(
        new Error(`[zen-optimistic] Action "${actionName}" is not registered.`),
        'directive',
        { element: el },
      );
      // Rollback since the action cannot run.
      if (rollbackFn) {
        try { rollbackFn(context); } catch (err) {
          reportError(err as Error, 'expression', {
            expression: rollbackExpr || '',
            element: el,
          });
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
    const ACTION_TIMEOUT_MS = 10_000;
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(
          `[zen-optimistic] Action "${actionName}" timed out after ` +
          `${ACTION_TIMEOUT_MS / 1000}s. Rolling back optimistic state.`,
        ));
      }, ACTION_TIMEOUT_MS);
    });
    try {
      await Promise.race([
        Promise.resolve(action({ state, event, element: el })),
        timeoutPromise,
      ]);
      // Success: keep the optimistic state.
    } catch (err) {
      reportError(err as Error, 'action', { element: el });
      // 4) Rollback on error (covers both action rejection AND timeout).
      if (rollbackFn) {
        try { rollbackFn(context); } catch (e2) {
          reportError(e2 as Error, 'expression', {
            expression: rollbackExpr || '',
            element: el,
          });
        }
      }
    } finally {
      // Always clear the timeout so the timer doesn't keep running if the
      // action resolved quickly. (If the timeout already fired, this is a
      // no-op.)
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
