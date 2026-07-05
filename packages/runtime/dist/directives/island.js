// packages/runtime/src/directives/island.ts
//
// FEATURE (v1.2.0): zen-island — Islands Architecture hydration control.
//
// This directive defers processing of an element's children until a certain
// hydration condition is met. It supports three modes:
//
//   zen-island="visible" — children are processed when the element enters the
//                          viewport (via IntersectionObserver). Falls back to
//                          `idle` if IntersectionObserver is unavailable.
//   zen-island="idle"    — children are processed when the browser is idle
//                          (via requestIdleCallback). Falls back to
//                          setTimeout(50) if rIC is unavailable.
//   zen-island="load"    — children are processed immediately (synchronously).
/**
 * Process the `zen-island` directive.
 *
 * @param el             Element carrying `zen-island`.
 * @param hydrateMode    One of "visible" | "idle" | "load". Defaults to "load".
 * @param context        The current reactive context.
 * @param processChildren Walker-supplied callback for binding the subtree.
 * @returns Dispose function — cancels pending timers / observers and disposes
 *          any children that were already processed.
 */
export function processIsland(el, hydrateMode, context, processChildren) {
    // Normalize the mode. Empty/unknown modes fall back to "load" (immediate).
    const mode = (hydrateMode || '').trim().toLowerCase();
    // FIX (v1.2.4): Validate hydrate mode explicitly. Previously, any value
    // other than "visible"/"idle" silently became "load" — including typos
    // like "visibe" or "idll". Now we warn the developer so they can fix the
    // attribute, then default to "load" (safe, immediate hydration).
    const VALID_ISLAND_MODES = new Set(['visible', 'idle', 'load']);
    let effectiveMode;
    if (!VALID_ISLAND_MODES.has(mode)) {
        if (mode && typeof console !== 'undefined' && console.warn) {
            console.warn(`[Zenith zen-island] Invalid hydrate mode "${hydrateMode}". ` +
                `Must be one of: visible, idle, load. Defaulting to "load".`);
        }
        effectiveMode = 'load';
    }
    else {
        effectiveMode = mode;
    }
    el.removeAttribute('zen-island');
    // ── Placeholder extraction ──
    // Look for a <template slot="placeholder"> among the element's children.
    // We clone its content into the element so the user sees something while
    // waiting for hydration. The clone is wrapped in a tagged <span> so we
    // can remove it deterministically on hydrate.
    let placeholderHost = null;
    if (typeof HTMLTemplateElement !== 'undefined' && typeof document !== 'undefined') {
        for (const child of Array.from(el.children)) {
            if (child.tagName.toLowerCase() === 'template' &&
                child.getAttribute('slot') === 'placeholder') {
                const tpl = child;
                // Remove the template definition itself so it does not interfere
                // with the eventual real-children processing.
                el.removeChild(child);
                // Wrap the clone in a tagged host span for easy removal on hydrate.
                placeholderHost = document.createElement('span');
                placeholderHost.setAttribute('data-zenith-island-placeholder', '');
                placeholderHost.appendChild(tpl.content.cloneNode(true));
                el.appendChild(placeholderHost);
                break;
            }
        }
    }
    let childDisposes = [];
    let hydrated = false;
    let observer = null;
    let idleHandle = null;
    let timeoutHandle = null;
    /**
     * Run the actual hydration: remove the placeholder host (if any) and
     * process the real children. Idempotent — calling more than once is safe.
     */
    const hydrate = () => {
        if (hydrated)
            return;
        hydrated = true;
        // Cancel any other pending triggers.
        if (observer) {
            try { observer.disconnect(); } catch { /* noop */ }
            observer = null;
        }
        if (idleHandle !== null && typeof globalThis.cancelIdleCallback !== 'undefined') {
            try { globalThis.cancelIdleCallback(idleHandle); } catch { /* noop */ }
        }
        idleHandle = null;
        if (timeoutHandle !== null) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
        }
        // Remove the placeholder host from the DOM if it is still attached.
        if (placeholderHost && placeholderHost.parentNode) {
            placeholderHost.parentNode.removeChild(placeholderHost);
        }
        placeholderHost = null;
        try {
            processChildren(el, context, childDisposes);
        }
        catch (err) {
            if (typeof console !== 'undefined' && console.error) {
                console.error('[Zenith zen-island] hydrate failed:', err);
            }
        }
    };
    // ── Schedule hydration based on mode ──
    if (effectiveMode === 'load') {
        // Immediate. Process children synchronously.
        hydrate();
    }
    else if (effectiveMode === 'idle') {
        if (typeof globalThis.requestIdleCallback !== 'undefined') {
            idleHandle = globalThis.requestIdleCallback(() => hydrate());
        }
        else {
            // Fallback: setTimeout(50) mimics idle for environments without rIC.
            timeoutHandle = setTimeout(() => hydrate(), 50);
        }
    }
    else {
        // effectiveMode === 'visible'
        if (typeof IntersectionObserver !== 'undefined') {
            observer = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        hydrate();
                        break;
                    }
                }
            }, { threshold: 0.1 });
            observer.observe(el);
        }
        else if (typeof globalThis.requestIdleCallback !== 'undefined') {
            // Fallback chain: visible → idle → setTimeout.
            idleHandle = globalThis.requestIdleCallback(() => hydrate());
        }
        else {
            // Fallback chain: visible → idle → setTimeout(100).
            timeoutHandle = setTimeout(() => hydrate(), 100);
        }
    }
    return () => {
        if (observer) {
            try { observer.disconnect(); } catch { /* noop */ }
            observer = null;
        }
        if (idleHandle !== null && typeof globalThis.cancelIdleCallback !== 'undefined') {
            try { globalThis.cancelIdleCallback(idleHandle); } catch { /* noop */ }
        }
        idleHandle = null;
        if (timeoutHandle !== null) {
            clearTimeout(timeoutHandle);
            timeoutHandle = null;
        }
        for (const d of childDisposes) {
            try { d(); } catch { /* noop */ }
        }
        childDisposes = [];
    };
}
//# sourceMappingURL=island.js.map
