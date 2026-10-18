import { registerEscapeLayer } from './escape';
import { createReservedError } from '@zenith/errors';
import type { Cleanup, Disposable } from '@zenith/shared';

/** @public */
export interface FocusTrapOptions {
  initialFocus?: string | HTMLElement | (() => HTMLElement | null) | null;
  /** Logical floating descendants, resolved live; all must belong to this document. */
  containers?: () => readonly HTMLElement[];
  fallbackFocus?: string | HTMLElement;
  returnFocus?: boolean;
  escapeDeactivates?: boolean;
  clickOutsideDeactivates?: boolean;
  allowOutsideClick?: boolean | ((event: MouseEvent) => boolean);
  onDeactivate?: () => void;
  onEscape?: () => void;
  doc?: Document;
}
/** @public */
export interface FocusTrap extends Disposable {
  activate(): void; deactivate(): void; pause(): void; unpause(): void; isActive(): boolean;
}
const stacks = new WeakMap<Document, FocusTrap[]>();
const containers = new WeakMap<FocusTrap, HTMLElement>();
const selector = 'a[href],area[href],button,input:not([type="hidden"]),select,textarea,summary,[contenteditable="true"],[tabindex]';
function visible(el: HTMLElement, includeHidden = false): boolean {
  if (el.closest('[inert]') || (!includeHidden && el.closest('[hidden],[aria-hidden="true"]')) || el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true') return false;
  if (includeHidden) return true;
  for (let node: HTMLElement | null = el; node; node = node.parentElement) {
    const css = node.ownerDocument.defaultView?.getComputedStyle(node);
    if (css?.display === 'none' || css?.visibility === 'hidden') return false;
  }
  return true;
}
/** @public */
export interface FocusableOptions { includeHidden?: boolean; }
/** Dynamically inspect tabbable descendants; disabled/inert nodes are never included. @public */
export function getFocusable(container: HTMLElement, options: FocusableOptions = {}): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(el => el.tabIndex >= 0 && visible(el, options.includeHidden))
    .sort((a, b) => (a.tabIndex > 0 ? a.tabIndex : Infinity) - (b.tabIndex > 0 ? b.tabIndex : Infinity));
}
/** @public */
export function focusFirst(container: HTMLElement): boolean { const el = getFocusable(container)[0]; el?.focus(); return !!el; }
/** @public */
export function focusLast(container: HTMLElement): boolean { const items = getFocusable(container); const el = items[items.length - 1]; el?.focus(); return !!el; }
/** Capture a target now and return an idempotent restoration cleanup. @public */
export function restoreFocus(target?: HTMLElement | null): Cleanup {
  const el = target ?? (typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null);
  let restored = false;
  return () => { if (restored) return; restored = true; if (el?.isConnected) el.focus(); };
}
/** Nested traps suspend their predecessors; every document owns a separate stack. @public */
export function createFocusTrap(container: HTMLElement, options: FocusTrapOptions = {}): FocusTrap {
  const doc = options.doc ?? container.ownerDocument;
  if (doc !== container.ownerDocument) throw createReservedError('ZEN-1402');
  let active = false, paused = false, disposed = false;
  let previous: HTMLElement | null = null;
  let observer: MutationObserver | undefined;
  let temporaryTabindex = false;
  let releaseEscape: Cleanup = () => {};
  const stack = stacks.get(doc) ?? []; stacks.set(doc, stack);
  const top = () => active && !paused && stack[stack.length - 1] === trap;
  const roots = () => { const values = [...new Set([container, ...(options.containers?.() ?? [])])]; if (values.some(root => root.ownerDocument !== doc)) throw createReservedError('ZEN-1402'); return values; };
  const contains = (node: Node | null) => !!node && roots().some(root => root.contains(node));
  const items = () => [...new Set(roots().flatMap(root => getFocusable(root)))].sort((a, b) => (a.tabIndex > 0 ? a.tabIndex : Infinity) - (b.tabIndex > 0 ? b.tabIndex : Infinity));
  const target = (value?: string | HTMLElement | null) => {
    let node: HTMLElement | null | undefined;
    try { node = typeof value === 'string' ? container.querySelector<HTMLElement>(value) : value; } catch { throw createReservedError('ZEN-1401'); }
    if (node && (typeof node !== 'object' || node.nodeType !== 1 || node.ownerDocument !== doc || node !== container && !contains(node))) throw createReservedError('ZEN-1401');
    return node;
  };
  const fallback = () => {
    const el = target(options.fallbackFocus) ?? container;
    if (!el.hasAttribute('tabindex') && el === container) { temporaryTabindex = true; el.tabIndex = -1; }
    return el;
  };
  const initial = () => { const requested = typeof options.initialFocus === 'function' ? options.initialFocus() : options.initialFocus; if (!active || disposed) return; const node = target(requested) ?? items()[0] ?? fallback(); node.focus(); if (!active || disposed) return; if (doc.activeElement !== node && !node.contains(doc.activeElement)) throw createReservedError('ZEN-1401'); };
  const onFocus = (event: FocusEvent) => { if (top() && !contains(event.target as Node)) initial(); };
  const onKey = (event: KeyboardEvent) => {
    if (!top() || event.isComposing || event.defaultPrevented) return;
    if (event.key !== 'Tab') return;
    const focusable = items(); const first = focusable[0]; const last = focusable[focusable.length - 1];
    const current = doc.activeElement;
    if (!first || !last) { event.preventDefault(); fallback().focus(); }
    else if (!contains(current) || (event.shiftKey && (current === first || current === container))) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
    else if (!event.shiftKey && current === last) { event.preventDefault(); first.focus(); }
  };
  const onClick = (event: MouseEvent) => {
    if (!top() || contains(event.target as Node)) return;
    if (options.clickOutsideDeactivates) { deactivate(); return; }
    const allowed = typeof options.allowOutsideClick === 'function' ? options.allowOutsideClick(event) : options.allowOutsideClick;
    if (!allowed) { event.preventDefault(); event.stopPropagation(); }
  };
  function deactivate() {
    if (!active) return; active = false; releaseEscape(); releaseEscape = () => {};
    const index = stack.indexOf(trap); if (index !== -1) stack.splice(index, 1);
    doc.removeEventListener('keydown', onKey, true); doc.removeEventListener('focusin', onFocus, true); doc.removeEventListener('mousedown', onClick, true); doc.removeEventListener('click', onClick, true);
    observer?.disconnect(); observer = undefined;
    if (temporaryTabindex) { container.removeAttribute('tabindex'); temporaryTabindex = false; }
    const former = previous; previous = null;
    if (options.returnFocus !== false && former?.isConnected) former.focus();
    options.onDeactivate?.();
  }
  const trap: FocusTrap = {
    activate() {
      if (disposed || active || (doc as Document & { __zenithSSR__?: boolean }).__zenithSSR__) return;
      if (stack.some(parent => { const root = containers.get(parent); return root && container.contains(root); })) throw createReservedError('ZEN-1402');
      active = true; paused = false;
      previous = doc.activeElement as HTMLElement | null; stack.push(trap);
      releaseEscape = registerEscapeLayer(doc, () => {
        if (!top() || (!options.onEscape && options.escapeDeactivates === false)) return false;
        try { options.onEscape?.(); } finally { if (options.escapeDeactivates !== false) deactivate(); }
        return true;
      });
      doc.addEventListener('keydown', onKey, true); doc.addEventListener('focusin', onFocus, true); doc.addEventListener('mousedown', onClick, true); doc.addEventListener('click', onClick, true);
      const Observer = doc.defaultView?.MutationObserver;
      if (Observer && container.isConnected) { observer = new Observer(() => { if (!container.isConnected) trap.dispose(); }); observer.observe(doc, { childList: true, subtree: true }); }
      try { initial(); } catch (error) { try { deactivate(); } catch { /* Preserve the activation error after detaching listeners. */ } throw error; }
    },
    deactivate, pause() { paused = true; }, unpause() { paused = false; if (top() && !contains(doc.activeElement)) initial(); },
    isActive: () => active,
    dispose() { if (disposed) return; disposed = true; deactivate(); },
  };
  containers.set(trap, container);
  return trap;
}

/** @public */
export interface RovingOptions { orientation?: 'horizontal' | 'vertical' | 'both'; loop?: boolean; selector?: string; home?: boolean; end?: boolean; filter?: (element: HTMLElement) => boolean; }
/** Keyboard roving that restores exact prior attributes on cleanup. @public */
export function createRovingTabindex(container: HTMLElement, options: RovingOptions = {}): Cleanup {
  const originals = new Map<HTMLElement, string | null>();
  const items = () => Array.from(container.querySelectorAll<HTMLElement>(options.selector ?? '[role="tab"],[role="menuitem"],button')).filter(el => visible(el) && (options.filter?.(el) ?? true));
  const remember = (el: HTMLElement) => { if (!originals.has(el)) originals.set(el, el.getAttribute('tabindex')); };
  const activate = (el: HTMLElement) => { for (const item of items()) { remember(item); item.tabIndex = item === el ? 0 : -1; } };
  const first = items().find(el => el.getAttribute('aria-selected') === 'true') ?? items()[0]; if (first) activate(first);
  const onFocus = (event: FocusEvent) => { const el = items().find(item => item === event.target || item.contains(event.target as Node)); if (el) activate(el); };
  const onKey = (event: KeyboardEvent) => {
    const all = items(); const index = all.findIndex(el => el === event.target || el.contains(event.target as Node)); if (index < 0) return;
    const orientation = options.orientation ?? 'horizontal';
    const rtl = container.ownerDocument.defaultView?.getComputedStyle(container).direction === 'rtl' || container.closest('[dir]')?.getAttribute('dir') === 'rtl';
    let next = index;
    if (event.key === 'Home' && options.home !== false) next = 0;
    else if (event.key === 'End' && options.end !== false) next = all.length - 1;
    else if (orientation !== 'vertical' && event.key === 'ArrowRight') next += rtl ? -1 : 1;
    else if (orientation !== 'vertical' && event.key === 'ArrowLeft') next += rtl ? 1 : -1;
    else if (orientation !== 'horizontal' && event.key === 'ArrowDown') next++;
    else if (orientation !== 'horizontal' && event.key === 'ArrowUp') next--;
    else return;
    event.preventDefault(); next = options.loop !== false ? (next + all.length) % all.length : Math.max(0, Math.min(all.length - 1, next));
    const el = all[next]; if (el) { activate(el); el.focus(); }
  };
  container.addEventListener('keydown', onKey); container.addEventListener('focusin', onFocus);
  let disposed = false;
  return () => { if (disposed) return; disposed = true; container.removeEventListener('keydown', onKey); container.removeEventListener('focusin', onFocus); for (const [el, value] of originals) { if (value === null) el.removeAttribute('tabindex'); else el.setAttribute('tabindex', value); } };
}
