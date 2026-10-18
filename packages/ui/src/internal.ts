import { createReservedError } from '@zenith/errors';
import { createDisposer, type Cleanup } from '@zenith/shared';
/** A closed local scope immediately releases late acquisitions. */
export function cleanupScope() {
  const cleanup = createDisposer(); let closed = false;
  return {
    add(value: Cleanup | { dispose(): void }) {
      if (!closed) cleanup.add(value);
      else if (typeof value === 'function') value(); else value.dispose();
    },
    dispose() { if (closed) return; closed = true; cleanup.dispose(); },
    get disposed() { return closed; },
  };
}
/** Listeners, removal observation and exact attributes have one closed owner. */
export function ownership(root: HTMLElement) {
  const cleanup = cleanupScope(), finalizers = cleanupScope(); const watched = new Map<HTMLElement, { connected: boolean; references: number }>([[root, { connected: root.isConnected, references: 1 }]]); let finished = false; const values = new Map<HTMLElement, Map<string, string | null>>(); let disposed = false;
  const attr = (el: HTMLElement, name: string, value: string | null) => {
    if (disposed) return;
    let saved = values.get(el); if (!saved) { saved = new Map(); values.set(el, saved); }
    if (!saved.has(name)) saved.set(name, el.getAttribute(name));
    if (value === null) el.removeAttribute(name); else el.setAttribute(name, value);
  };
  const on = <K extends keyof HTMLElementEventMap>(el: HTMLElement | Document, name: K, callback: (event: HTMLElementEventMap[K]) => void) => {
    if (disposed) return;
    const handler: EventListener = event => { if (!disposed) callback(event as HTMLElementEventMap[K]); };
    el.addEventListener(name, handler); cleanup.add(() => el.removeEventListener(name, handler));
  };
  const dispose = () => {
    if (disposed) return; disposed = true; const errors: unknown[] = [];
    try { cleanup.dispose(); } catch (error) { errors.push(error); }
    for (const [el, attrs] of values) for (const [name, value] of attrs) {
      try { if (value === null) el.removeAttribute(name); else el.setAttribute(name, value); } catch (error) { errors.push(error); }
    }
    values.clear(); watched.clear(); finished = true;
    try { finalizers.dispose(); } catch (error) { errors.push(error); }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'UI owner cleanup failed.');
  };
  const Observer = root.ownerDocument.defaultView?.MutationObserver;
  if (Observer) {
    const observer = new Observer(() => { for (const [node, entry] of watched) { if (node.isConnected) entry.connected = true; else if (entry.connected) { dispose(); return; } } });
    observer.observe(root.ownerDocument, { childList: true, subtree: true }); cleanup.add(() => observer.disconnect());
  }
  return {
    attr, on, add: cleanup.add, dispose,
    watch(node: HTMLElement): Cleanup {
      if (disposed) return () => {};
      let entry = watched.get(node); if (!entry) { entry = { connected: node.isConnected, references: 0 }; watched.set(node, entry); }
      const lease = entry; lease.references++; let active = true;
      return () => { if (!active) return; active = false; if (--lease.references === 0 && watched.get(node) === lease) watched.delete(node); };
    },
    afterDispose(fn: Cleanup) { if (finished) fn(); else finalizers.add(fn); },
    get disposed() { return disposed; },
  };
}
/** Synthetic events may target text nodes; never assume EventTarget.closest. */
export function eventTarget(event: Event): Element | null {
  const node = event.target as Node | null;
  return node?.nodeType === 1 ? node as Element : node?.parentElement ?? null;
}
export function event(el: HTMLElement, name: string, detail?: unknown): void {
  const Ctor = el.ownerDocument.defaultView?.CustomEvent;
  if (Ctor) el.dispatchEvent(new Ctor(name, { detail, bubbles: true }));
}

const scopes = new WeakMap<object, import('@zenith/a11y').IdScope>();
/** One document/request scope; hydrated IDs are skipped rather than reused accidentally. */
export function idScopeFor(el: HTMLElement): import('@zenith/a11y').IdScope {
  const doc = el.ownerDocument; const key = (doc as Document & { __zenithSSRRequest__?: object }).__zenithSSRRequest__ ?? doc; let scope = scopes.get(key);
  if (!scope) { let count = 0; scope = { get count() { return count; }, next(prefix = 'zen-ui') { let id: string; do { id = `${prefix}-${++count}`; } while (doc.getElementById(id)); return id; } }; scopes.set(key, scope); }
  return scope;
}

const modals = new WeakMap<Document, { stack: Array<{ el: HTMLElement }>; releases: Cleanup[]; refresh?: () => void; refreshing?: boolean; pending?: boolean }>();
/** Only the top modal owns background inertness; opening a sibling must not inherit an older lock. */
export function modalLease(el: HTMLElement, makeInert: (node: HTMLElement) => Cleanup): Cleanup {
  const doc = el.ownerDocument; let scope = modals.get(doc);
  if (!scope) { scope = { stack: [], releases: [] }; modals.set(doc, scope); }
  const refresh = () => {
    if (scope.refreshing) { scope.pending = true; return; }
    scope.refreshing = true; const errors: unknown[] = [];
    try {
      do {
        scope.pending = false;
        for (const release of scope.releases.splice(0)) { try { release(); } catch (error) { errors.push(error); } }
        const top = scope.stack[scope.stack.length - 1]?.el;
        if (!top) { if (modals.get(doc) === scope) modals.delete(doc); continue; }
        const roots = floatingRoots(top).filter(node => node === top || (node.isConnected && !node.closest('[hidden],[inert],[aria-hidden="true"]')));
        const paths = new Set<HTMLElement>(), parents = new Set<HTMLElement>();
        for (const root of roots) for (let current: HTMLElement | null = root; current && current !== doc.body && current !== doc.documentElement; current = current.parentElement) { paths.add(current); if (current.parentElement) parents.add(current.parentElement); }
        for (const parent of parents) {
          if (roots.some(root => root === parent || root.contains(parent))) continue;
          for (const sibling of Array.from(parent.children)) if (!paths.has(sibling as HTMLElement) && !sibling.matches('[aria-live],[role="status"],[role="alert"]') && sibling.namespaceURI === 'http://www.w3.org/1999/xhtml') {
            try { scope.releases.push(makeInert(sibling as HTMLElement)); } catch (error) { errors.push(error); }
          }
        }
      } while (scope.pending);
    } finally { scope.refreshing = false; }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'Modal lease refresh failed.');
  };
  const entry = { el }; scope.refresh = refresh; scope.stack.push(entry);
  try { refresh(); } catch (error) { const index = scope.stack.indexOf(entry); if (index >= 0) scope.stack.splice(index, 1); try { refresh(); } catch {} throw error; }
  let active = true;
  return () => { if (!active) return; active = false; const index = scope.stack.indexOf(entry); if (index >= 0) scope.stack.splice(index, 1); refresh(); };
}
/** Expose observation without exposing the controller's mutation/disposal capability. */
export function readonlyState<T>(value: { get(): T; peek(): T }): { get(): Readonly<T>; peek(): Readonly<T> } {
  let previous: T; let snapshot: Readonly<T>;
  const read = (next: T): Readonly<T> => {
    if (!Array.isArray(next)) return next as Readonly<T>;
    if (previous !== next) { previous = next; snapshot = Object.freeze([...next]) as Readonly<T>; }
    return snapshot;
  };
  return { get: () => read(value.get()), peek: () => read(value.peek()) };
}

type FloatingEntry = { parent: HTMLElement; child: HTMLElement };
const floatingBranches = new WeakMap<Document, Set<FloatingEntry>>();
/** Live logical descendants, including portals registered under physical descendants. */
export function floatingRoots(root: HTMLElement): HTMLElement[] {
  const roots = [root]; const seen = new Set(roots);
  for (let i = 0; i < roots.length; i++) for (const entry of floatingBranches.get(root.ownerDocument) ?? []) {
    if ((roots[i] === entry.parent || roots[i]!.contains(entry.parent)) && !seen.has(entry.child)) { seen.add(entry.child); roots.push(entry.child); }
  }
  return roots;
}
export function refreshFloating(doc: Document): void { modals.get(doc)?.refresh?.(); }
/** Registration owns one token; borrowed registrations never remove another token. */
export function floatingBranch(parent: HTMLElement, child: HTMLElement): Cleanup {
  const doc = parent.ownerDocument;
  if (child.ownerDocument !== doc || child === parent || child.contains(parent) || floatingRoots(child).some(root => root === parent || root.contains(parent))) throw createReservedError('ZEN-1601');
  let branches = floatingBranches.get(doc); if (!branches) { branches = new Set(); floatingBranches.set(doc, branches); }
  const entry = { parent, child }; branches.add(entry);
  try { refreshFloating(doc); } catch (error) { branches.delete(entry); if (!branches.size) floatingBranches.delete(doc); try { refreshFloating(doc); } catch {} throw error; }
  let active = true;
  return () => { if (!active) return; active = false; branches.delete(entry); if (!branches.size) floatingBranches.delete(doc); refreshFloating(doc); };
}
/** Cycle-safe outside-click containment across the live portal tree. */
export function containsFloatingTarget(root: HTMLElement, target: Node): boolean { return floatingRoots(root).some(node => node.contains(target)); }

const attributeTokens = new WeakMap<HTMLElement, Map<string, { original: string | null; tokens: Map<symbol, string> }>>();
/** Independent IDREF leases, e.g. two tooltips describing the same trigger. */
export function attributeToken(el: HTMLElement, name: string, value: string): Cleanup {
  let attrs = attributeTokens.get(el); if (!attrs) { attrs = new Map(); attributeTokens.set(el, attrs); }
  let entry = attrs.get(name); if (!entry) { entry = { original: el.getAttribute(name), tokens: new Map() }; attrs.set(name, entry); }
  const token = Symbol(name); entry.tokens.set(token, value);
  const update = () => { const values = [...(entry.original?.split(/\s+/).filter(Boolean) ?? []), ...entry.tokens.values()]; el.setAttribute(name, [...new Set(values)].join(' ')); };
  update(); let active = true;
  return () => {
    if (!active) return; active = false; entry.tokens.delete(token);
    if (entry.tokens.size) update();
    else { if (entry.original === null) el.removeAttribute(name); else el.setAttribute(name, entry.original); attrs.delete(name); if (!attrs.size) attributeTokens.delete(el); }
  };
}
