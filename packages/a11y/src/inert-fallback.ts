import type { Cleanup } from '@zenith/shared';
const selector = 'a[href],area[href],button,input,select,textarea,summary,[contenteditable],[tabindex]';
const stops = new WeakMap<HTMLElement, { count: number; original: string | null }>();
function hold(node: HTMLElement): Cleanup {
  let value = stops.get(node);
  if (!value) { value = { count: 0, original: node.getAttribute('tabindex') }; stops.set(node, value); }
  const entry = value; entry.count++; node.tabIndex = -1; let active = true;
  return () => {
    if (!active) return; active = false;
    if (--entry.count === 0) { stops.delete(node); if (entry.original === null) node.removeAttribute('tabindex'); else node.setAttribute('tabindex', entry.original); }
  };
}
/** Unsupported inert needs actual tab-stop masking, not only an ARIA assertion. */
export function inertFallback(root: HTMLElement): Cleanup {
  const owned = new Map<HTMLElement, Cleanup>(); let active = true;
  const refresh = () => {
    if (!active) return;
    for (const [node, release] of owned) if (node !== root && !root.contains(node)) { owned.delete(node); release(); }
    for (const node of [root, ...Array.from(root.querySelectorAll<HTMLElement>(selector))]) {
      if (!node.matches(selector)) continue;
      if (!owned.has(node)) owned.set(node, hold(node));
      if (node.tabIndex !== -1) node.tabIndex = -1;
    }
  };
  const Observer = root.ownerDocument.defaultView?.MutationObserver;
  let observer: MutationObserver | undefined;
  const dispose = () => {
    if (!active) return; active = false; observer?.disconnect(); const errors: unknown[] = [];
    for (const release of owned.values()) { try { release(); } catch (error) { errors.push(error); } }
    owned.clear(); if (errors.length === 1) throw errors[0]; if (errors.length) throw new AggregateError(errors, 'Inert tab-stop restoration failed.');
  };
  try {
    refresh();
    if (Observer) { observer = new Observer(refresh); observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['tabindex', 'href', 'contenteditable'] }); }
    return dispose;
  } catch (error) { try { dispose(); } catch {} throw error; }
}
