import type { Cleanup } from '@zenith/shared';
interface Layer { handle: (event: KeyboardEvent) => boolean | void; active: boolean }
interface EscapeScope { layers: Layer[]; listener: (event: KeyboardEvent) => void }
const scopes = new WeakMap<Document, EscapeScope>();
/**
 * One document listener arbitrates modal, floating and notification Escape
 * ownership. A handler returning false declines without consuming the event.
 * @public
 */
export function registerEscapeLayer(doc: Document, handle: (event: KeyboardEvent) => boolean | void): Cleanup {
  let scope = scopes.get(doc);
  if (!scope) {
    const layers: Layer[] = [];
    const listener = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
      // Snapshot: closing one layer must not also close its newly exposed parent.
      for (const layer of [...layers].reverse()) {
        if (!layer.active) continue;
        let consumed = true;
        try { consumed = layer.handle(event) !== false; } finally { if (consumed) { event.preventDefault(); event.stopImmediatePropagation(); } }
        if (consumed) return;
      }
    };
    scope = { layers, listener };
    doc.addEventListener('keydown', listener, true); scopes.set(doc, scope);
  }
  const owned = scope; const layer: Layer = { handle, active: true }; owned.layers.push(layer);
  return () => {
    if (!layer.active) return; layer.active = false;
    const index = owned.layers.indexOf(layer); if (index >= 0) owned.layers.splice(index, 1);
    if (!owned.layers.length) { doc.removeEventListener('keydown', owned.listener, true); if (scopes.get(doc) === owned) scopes.delete(doc); }
  };
}
