// packages/runtime/src/directives/track.ts
//
// FEATURE (v1.2.0): zen-track — Analytics tracking directive.
//
// Wires up an element to fire an analytics event in response to either a
// user click or the element entering the viewport.
let analyticsHandler = null;
// FIX (v1.2.4): Module-level WeakSet to de-duplicate visible-tracking
// firings for the same element. If `processTrack` is re-invoked on the same
// element (e.g. during re-hydration or a walker re-pass), we skip firing a
// second time. Entries are dropped in the dispose path so a re-attached
// element can fire again.
const seenVisibleElements = new WeakSet();
/**
 * Configure the global analytics handler. Pass `null` to disable.
 */
export function configureAnalytics(handler) {
    analyticsHandler = handler;
}
/**
 * Process the `zen-track` directive.
 *
 * @param el        Element carrying `zen-track`.
 * @param trackAttr The raw attribute value, e.g. "click:purchase".
 * @param context   The current reactive context.
 * @returns Dispose function — removes listeners / observers.
 */
export function processTrack(el, trackAttr, context) {
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
    const fire = () => {
        if (!analyticsHandler)
            return;
        try {
            analyticsHandler(eventName, el);
        }
        catch (err) {
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
        const onClick = () => setTimeout(() => fire(), 0);
        el.addEventListener('click', onClick);
        return () => {
            el.removeEventListener('click', onClick);
        };
    }
    // trigger === 'visible'
    if (typeof IntersectionObserver === 'undefined') {
        return () => { };
    }
    let observer = new IntersectionObserver((entries) => {
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
    }, { threshold: 0.5 });
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
//# sourceMappingURL=track.js.map
