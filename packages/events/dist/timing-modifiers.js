// packages/events/src/timing-modifiers.ts
//
// FEATURE (v1.2.0): Timing Modifiers (.debounce.NNN / .throttle.NNN).
//
// Wraps an event handler so that it is debounced or throttled according to
// a modifier in the binding string.
/**
 * Wrap a handler with debounce or throttle behavior based on the modifier
 * list. Returns the original handler if no timing modifier is present.
 *
 * @param handler   The underlying event handler.
 * @param modifiers The modifier list (e.g. ['debounce', '300', 'prevent']).
 * @returns The wrapped handler. The returned function also carries a
 *          `.cancel()` method so callers can flush pending timers during
 *          teardown.
 */
export function applyTimingModifiers(handler, modifiers) {
    const debIdx = modifiers.indexOf('debounce');
    const thIdx = modifiers.indexOf('throttle');
    // Neither modifier present — return the handler with a no-op cancel.
    if (debIdx === -1 && thIdx === -1) {
        const direct = ((event) => handler(event));
        direct.cancel = () => { };
        return direct;
    }
    // Parse the wait time.
    const wait = parseWait(modifiers, debIdx >= 0 ? debIdx : thIdx);
    if (debIdx >= 0) {
        // Debounce: trailing-edge. Wait `wait` ms of inactivity, then invoke.
        let timer = null;
        const wrapped = ((event) => {
            if (timer)
                clearTimeout(timer);
            timer = setTimeout(() => {
                timer = null;
                handler(event);
            }, wait);
        });
        wrapped.cancel = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        };
        return wrapped;
    }
    // Throttle: leading-edge. Invoke immediately, then ignore for `wait` ms.
    let last = 0;
    let timer = null;
    const wrapped = ((event) => {
        const now = Date.now();
        const remaining = wait - (now - last);
        if (remaining <= 0) {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            last = now;
            handler(event);
        }
        else if (!timer) {
            timer = setTimeout(() => {
                last = Date.now();
                timer = null;
                handler(event);
            }, remaining);
        }
    });
    wrapped.cancel = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };
    return wrapped;
}
/**
 * Find the first numeric token in `modifiers` starting from `startIdx + 1`.
 */
function parseWait(modifiers, startIdx) {
    for (let i = startIdx + 1; i < modifiers.length; i++) {
        const n = parseInt(modifiers[i], 10);
        if (Number.isFinite(n) && n >= 0)
            return n;
    }
    return 0;
}
//# sourceMappingURL=timing-modifiers.js.map
