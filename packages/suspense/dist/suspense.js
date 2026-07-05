// packages/suspense/src/suspense.ts
//
// @zenith/suspense — Suspense-like Loading State (v1.0.0 — complete rewrite).
import { signal, effect } from '@zenith/state';
import { reportError } from '@zenith/error-boundary';

export class SuspenseState {
}
export function createSuspenseContext(timeoutMs = 0) {
    const loadingSet = new Set();
    const sig = signal({
        loading: false,
        pendingCount: 0,
        timedOut: false,
        error: null,
    });
    let timeoutHandle = null;
    function armTimeout() {
        if (timeoutMs > 0 && timeoutHandle === null) {
            timeoutHandle = setTimeout(() => {
                timeoutHandle = null;
                sig.set({
                    loading: false,
                    pendingCount: loadingSet.size,
                    timedOut: true,
                    error: null,
                });
            }, timeoutMs);
        }
    }
    function clearTimeoutHandle() {
        if (timeoutHandle !== null) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
        }
    }
    function updateState() {
        const pendingCount = loadingSet.size;
        const isLoading = pendingCount > 0;
        const current = sig.get();
        if (isLoading && !current.timedOut && !current.error && timeoutMs > 0 && timeoutHandle === null) {
            armTimeout();
        }
        if (!isLoading && timeoutHandle !== null) {
            clearTimeoutHandle();
        }
        // FIX (v1.2.7): Reset timedOut to false when all children finish
        // loading. Previously once timedOut was true, it would persist even
        // after loading completed, leaving the boundary stuck on the timeout
        // fallback forever. (Recovery path.)
        const effectiveTimedOut = !isLoading ? false : current.timedOut;
        if (current.loading !== isLoading ||
            current.pendingCount !== pendingCount ||
            current.timedOut !== effectiveTimedOut) {
            sig.set({
                loading: isLoading,
                pendingCount,
                timedOut: effectiveTimedOut,
                error: current.error,
            });
        }
    }
    return {
        signal: sig,
        startLoading(id) {
            loadingSet.add(id);
            // FIX (v1.2.7): Re-arm timeout when new loading starts after a
            // timeout. Previously the `!current.timedOut` guard in updateState
            // prevented re-arming, so once timed out, the boundary was stuck.
            const current = sig.get();
            if (current.timedOut) {
                sig.set({ ...current, timedOut: false, loading: true });
                clearTimeoutHandle();
                armTimeout();
            }
            updateState();
        },
        stopLoading(id) { loadingSet.delete(id); updateState(); },
        reportError(err) {
            clearTimeoutHandle();
            sig.set({ loading: false, pendingCount: 0, timedOut: false, error: err });
        },
        reportTimeout() {
            clearTimeoutHandle();
            sig.set({ loading: false, pendingCount: loadingSet.size, timedOut: true, error: null });
        },
        // FIX (v1.2.7): public reset() method to manually recover from a
        // timeout or error state.
        reset() {
            clearTimeoutHandle();
            loadingSet.clear();
            sig.set({ loading: false, pendingCount: 0, timedOut: false, error: null });
        },
    };
}
export function processSuspense(el, processChildren, context, disposes) {
    if (typeof document === 'undefined') return;
    const timeoutAttr = el.getAttribute('timeout');
    const timeoutMs = timeoutAttr ? parseInt(timeoutAttr, 10) || 0 : 0;
    const fallbackTemplate = el.querySelector(':scope > template[zen-fallback]');
    const timeoutTemplate = el.querySelector(':scope > template[zen-timeout]');
    const errorTemplate = el.querySelector(':scope > template[zen-error]');
    let fallbackEl = null;
    let timeoutEl = null;
    let errorEl = null;
    if (fallbackTemplate) {
        fallbackEl = document.createElement('div');
        fallbackEl.className = 'zen-suspense-fallback';
        fallbackEl.style.display = 'none';
        fallbackEl.innerHTML = fallbackTemplate.innerHTML;
        el.appendChild(fallbackEl);
        fallbackTemplate.remove();
    }
    if (timeoutTemplate) {
        timeoutEl = document.createElement('div');
        timeoutEl.className = 'zen-suspense-timeout';
        timeoutEl.style.display = 'none';
        timeoutEl.innerHTML = timeoutTemplate.innerHTML;
        el.appendChild(timeoutEl);
        timeoutTemplate.remove();
    }
    if (errorTemplate) {
        errorEl = document.createElement('div');
        errorEl.className = 'zen-suspense-error';
        errorEl.style.display = 'none';
        errorEl.innerHTML = errorTemplate.innerHTML;
        el.appendChild(errorEl);
        errorTemplate.remove();
    }
    const contentEl = document.createElement('div');
    contentEl.className = 'zen-suspense-content';
    const childrenToMove = [];
    for (const child of Array.from(el.children)) {
        if (child !== fallbackEl && child !== timeoutEl && child !== errorEl) {
            childrenToMove.push(child);
        }
    }
    for (const child of childrenToMove) {
        contentEl.appendChild(child);
    }
    el.appendChild(contentEl);
    const suspenseCtx = createSuspenseContext(timeoutMs);
    const childContext = Object.create(context);
    Object.defineProperty(childContext, '$suspense', {
        get: () => suspenseCtx.signal.get(),
        enumerable: true,
        configurable: true,
    });
    Object.defineProperty(childContext, '__zenith_suspense__', {
        value: suspenseCtx,
        enumerable: false,
        configurable: true,
        writable: false,
    });
    // FIX (v1.2.7): Nested zen-suspense propagation — register this inner
    // boundary with the outer SuspenseContext (if any) so the outer boundary
    // also knows it is waiting on the inner one. Without this, the outer
    // could finish loading (its direct children are processed) and dispose
    // the inner boundary before the inner's fetches complete.
    const outerCtx = context.__zenith_suspense__;
    let innerId = null;
    if (outerCtx) {
        innerId = `zen-suspense-${Math.random().toString(36).slice(2, 10)}`;
        outerCtx.startLoading(innerId);
    }
    const childDisposes = [];
    for (const child of Array.from(contentEl.children)) {
        processChildren(child, childContext, childDisposes);
    }
    // FIX (v1.2.7): Watch the inner boundary's state — when it settles
    // (not loading, no error, not timed out), notify the outer so it can
    // stop tracking this inner. If the inner re-enters loading (e.g. a
    // refetch), re-register with the outer.
    let innerSettled = false;
    const innerWatchDispose = effect(() => {
        const state = suspenseCtx.signal.get();
        const settled = !state.loading && !state.error && !state.timedOut;
        if (settled && !innerSettled) {
            innerSettled = true;
            if (outerCtx && innerId) {
                outerCtx.stopLoading(innerId);
            }
        }
        else if (!settled && innerSettled) {
            innerSettled = false;
            if (outerCtx && innerId) {
                outerCtx.startLoading(innerId);
            }
        }
    });
    const disposeEffect = effect(() => {
        const state = suspenseCtx.signal.get();
        if (fallbackEl) fallbackEl.style.display = 'none';
        if (timeoutEl) timeoutEl.style.display = 'none';
        if (errorEl) errorEl.style.display = 'none';
        if (state.error) {
            contentEl.style.display = 'none';
            if (errorEl) { errorEl.style.display = ''; }
            else if (fallbackEl) { fallbackEl.style.display = ''; fallbackEl.textContent = `Error: ${state.error}`; }
        } else if (state.timedOut) {
            contentEl.style.display = 'none';
            if (timeoutEl) { timeoutEl.style.display = ''; }
            else if (fallbackEl) { fallbackEl.style.display = ''; fallbackEl.textContent = 'Timeout: operation took too long.'; }
        } else if (state.loading) {
            contentEl.style.display = 'none';
            if (fallbackEl) fallbackEl.style.display = '';
        } else {
            contentEl.style.display = '';
        }
    });
    disposes.push(() => {
        disposeEffect();
        // FIX (v1.2.7): dispose the inner-state watcher.
        innerWatchDispose();
        // FIX (v1.2.7): notify the outer boundary that this inner is gone
        // so it does not keep waiting on a stale id.
        if (outerCtx && innerId) {
            outerCtx.stopLoading(innerId);
        }
        for (const d of childDisposes) {
            try { d(); } catch (e) { reportError(e, 'directive', { element: el }); }
        }
        childDisposes.length = 0;
    });
}
//# sourceMappingURL=suspense.js.map
