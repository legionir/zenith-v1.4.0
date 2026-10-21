// packages/events/src/timing-modifiers.ts
//
// FEATURE (v1.2.0): Timing Modifiers (.debounce.NNN / .throttle.NNN).
//
// Wraps an event handler so that it is debounced or throttled according to
// a modifier in the binding string. The walker / event delegation layer
// calls `applyTimingModifiers` after parsing the binding to obtain a wrapped
// handler.
//
// Modifier syntax (in the `zen-action:click.<modifier>.NNN` attribute):
//   .debounce.300   — wait 300ms of inactivity before invoking the handler.
//   .throttle.300   — invoke at most once per 300ms (leading edge).
//
// If neither modifier is present, the original handler is returned unchanged.
//
// SSR safety:
//   - `setTimeout` / `clearTimeout` are universally available; this module
//     is safe to import on the server (it does not touch `document`).

/**
 * The signature of a Zenith event handler. Mirrors the ActionFn shape but
 * without the ActionContext wrapper, so it can wrap any callback.
 */
export type TimedHandler = (event: Event) => void;

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
export function applyTimingModifiers(
  handler: TimedHandler,
  modifiers: string[],
): TimedHandler & { cancel: () => void } {
  const debIdx = modifiers.indexOf('debounce');
  const thIdx = modifiers.indexOf('throttle');

  // Neither modifier present — return the handler with a no-op cancel.
  if (debIdx === -1 && thIdx === -1) {
    const direct = ((event: Event) => handler(event)) as TimedHandler & { cancel: () => void };
    direct.cancel = () => {};
    return direct;
  }

  // Parse the wait time. The modifier list looks like
  //   ['debounce', '300', 'prevent']   (wait = 300)
  //   ['debounce', 'prevent', '300']   (wait = 300)
  // so we look for the first numeric token after the modifier name.
  const wait = parseWait(modifiers, debIdx >= 0 ? debIdx : thIdx);

  if (debIdx >= 0) {
    // Debounce: trailing-edge. Wait `wait` ms of inactivity, then invoke.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const wrapped = ((event: Event) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        handler(event);
      }, wait);
    }) as TimedHandler & { cancel: () => void };
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
  let timer: ReturnType<typeof setTimeout> | null = null;
  const wrapped = ((event: Event) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      last = now;
      handler(event);
    } else if (!timer) {
      // Schedule a trailing call so the last event in a burst is honored.
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        handler(event);
      }, remaining);
    }
  }) as TimedHandler & { cancel: () => void };
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
 * Falls back to 0 if no numeric token is found (which makes the modifier
 * a no-op).
 */
function parseWait(modifiers: string[], startIdx: number): number {
  for (let i = startIdx + 1; i < modifiers.length; i++) {
    const n = parseInt(modifiers[i]!, 10);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return 0;
}
