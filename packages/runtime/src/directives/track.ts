// packages/runtime/src/directives/track.ts
//
// FEATURE (v1.2.0): zen-track — Analytics tracking directive.
//
// Wires up an element to fire an analytics event in response to either a
// user click or the element entering the viewport. The tracking handler is
// configurable via `configureAnalytics`.
//
// Attribute format:
//   zen-track="click:purchase"
//   zen-track="visible:product-impression"
//
// The first token (before the colon) is the trigger type ("click" or
// "visible"), and the second token is the event name to send to the
// analytics handler. If no colon is present, the entire value is treated
// as the event name and the trigger defaults to "click".
//
// SSR safety:
//   - All DOM access is guarded. The directive is a no-op when `document`
//     is unavailable. IntersectionObserver is feature-detected.

/**
 * The analytics handler signature. Receives the event name and the source
 * element. Override via `configureAnalytics`.
 */
export type AnalyticsHandler = (eventName: string, el: HTMLElement) => void;

let analyticsHandler: AnalyticsHandler | null = null;

// FIX (v1.2.4): Module-level WeakSet to de-duplicate visible-tracking
// firings for the same element. If `processTrack` is re-invoked on the same
// element (e.g. during re-hydration or a walker re-pass), we skip firing a
// second time. Entries are dropped in the dispose path so a re-attached
// element can fire again.
const seenVisibleElements = new WeakSet<HTMLElement>();

/**
 * Configure the global analytics handler. Pass `null` to disable.
 *
 * @example
 *   import { configureAnalytics } from '@zenith/runtime';
 *   configureAnalytics((name, el) => {
 *     gtag('event', name, { label: el.dataset.label });
 *   });
 */
export function configureAnalytics(handler: AnalyticsHandler | null): void {
  analyticsHandler = handler;
}

/**
 * Process the `zen-track` directive.
 *
 * @param el        Element carrying `zen-track`.
 * @param trackAttr The raw attribute value, e.g. "click:purchase".
 * @param context   The current reactive context (unused but kept for API
 *                  symmetry with other directive processors).
 * @returns Dispose function — removes listeners / observers.
 */
export function processTrack(
  el: HTMLElement,
  trackAttr: string,
  // Part of the directive signature; tracking payload comes from attributes.
  _context: Record<string, any>,
): () => void {
  // Parse the attribute: "<trigger>:<eventName>" or just "<eventName>".
  let trigger = 'click';
  let eventName = trackAttr;
  const colonIdx = trackAttr.indexOf(':');
  if (colonIdx > 0) {
    const t = trackAttr.slice(0, colonIdx).trim().toLowerCase();
    if (t === 'click' || t === 'visible') {
      trigger = t;
      eventName = trackAttr.slice(colonIdx + 1).trim();
    }
  }

  el.removeAttribute('zen-track');

  const fire = (): void => {
    if (!analyticsHandler) return;
    try {
      analyticsHandler(eventName, el);
    } catch (err) {
      if (typeof console !== 'undefined' && console.error) {
        console.error('[Zenith zen-track] analytics handler threw:', err);
      }
    }
  };

  if (trigger === 'click') {
    // FIX (v1.2.4): Defer the actual `fire()` call to the next macrotask.
    // Click handlers that synchronously invoke analytics (which may do
    // network/XHR work) can interfere with the browser's natural click
    // handling — e.g. navigating away before the event finishes propagating,
    // or causing input/checkbox state changes to be visually delayed.
    // Wrapping in setTimeout(..., 0) lets the click event finish dispatching
    // first.
    const onClick = (): void => {
      setTimeout(() => fire(), 0);
    };
    el.addEventListener('click', onClick);
    return () => {
      el.removeEventListener('click', onClick);
    };
  }

  // trigger === 'visible'
  if (typeof IntersectionObserver === 'undefined') {
    // SSR or unsupported — fire once on the next tick (best-effort).
    return () => {};
  }
  let observer: IntersectionObserver | null = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          // FIX (v1.2.4): Skip if this element has already fired a visible
          // event (de-duplication across re-hydration passes).
          if (!seenVisibleElements.has(el)) {
            seenVisibleElements.add(el);
            fire();
          }
          if (observer) {
            observer.disconnect();
            observer = null;
          }
          break;
        }
      }
    },
    { threshold: 0.5 },
  );
  observer.observe(el);

  return () => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    // FIX (v1.2.4): Clear the entry so the element can fire again if it is
    // re-attached to the DOM later.
    seenVisibleElements.delete(el);
  };
}
