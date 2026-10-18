import { createRoot, effect } from '@zenith/state';
import { createDisposer, type Cleanup, type Disposable } from '@zenith/shared';
/** Internal closed owner: acquires effect cleanup before synchronous evaluation. */
export function bindingScope(el: HTMLElement) {
  const disposer = createDisposer(), attrs = new Set<string>(); let disposed = false;
  const add = (value: Cleanup | Disposable) => { if (!disposed) disposer.add(value); else if (typeof value === 'function') value(); else value.dispose(); };
  const dispose = () => { if (disposed) return; disposed = true; disposer.dispose(); };
  const Observer = el.ownerDocument.defaultView?.MutationObserver; let connected = el.isConnected;
  if (Observer) {
    const observer = new Observer(() => { if (el.isConnected) connected = true; else if (connected) dispose(); });
    observer.observe(el.ownerDocument, { childList: true, subtree: true }); add(() => observer.disconnect());
  }
  return { add, dispose, get disposed() { return disposed; },
    attr(name: string, value: string | null) {
      if (disposed) return;
      if (!attrs.has(name)) { attrs.add(name); const before = el.getAttribute(name); add(() => { if (before === null) el.removeAttribute(name); else el.setAttribute(name, before); }); }
      if (value === null) el.removeAttribute(name); else el.setAttribute(name, value);
    },
    effect(run: () => void) { if (!disposed) createRoot(release => { add(release); add(effect(() => { if (!disposed) run(); })); }); },
  };
}
