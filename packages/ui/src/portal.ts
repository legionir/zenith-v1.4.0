import { createReservedError } from '@zenith/errors';
import { effect, untrack } from '@zenith/state';
import { s } from '@zenith/schema';
import type { Cleanup, MaybeReactive } from '@zenith/shared';
import { cleanupScope, floatingBranch, refreshFloating } from './internal';
import { resolveUIOptions, strictUIOptions } from './options';
/** @public */
export interface PortalConfig { target: string | HTMLElement; }
/** @public */
export interface PortalOptions { target: MaybeReactive<PortalConfig['target']>; }
/** @public */
export const portalOptions = /* @__PURE__ */ strictUIOptions<PortalConfig>('PortalOptions', s.object({
  target: s.custom<PortalConfig['target']>(value => typeof value === 'string' ? value.trim().length > 0 : !!value && typeof value === 'object' && Reflect.get(value, 'nodeType') === 1 && typeof Reflect.get(value, 'append') === 'function', 'portal selector or element'),
}));
interface PortalEntry {
  target: HTMLElement;
  source: PortalOptions['target'];
  references: number;
  phase: 'moving' | 'active' | 'restoring' | 'closed';
  restore: Cleanup;
}
const portals = new WeakMap<HTMLElement, PortalEntry>();
function composedContains(root: Node, target: Node): boolean {
  for (let node: Node | null = target; node; node = node.parentNode ?? (node.nodeType === 11 && 'host' in node ? (node as ShadowRoot).host : null)) if (node === root) return true;
  return false;
}
const readable = (value: PortalOptions['target']) => !!value && typeof value === 'object' && typeof Reflect.get(value, 'get') === 'function';
/**
 * One origin/logical branch and one target source per element. Concrete same-target
 * borrowers follow the owner; another readable must be the identical source.
 * Final release restores the original position, not the last intermediate target.
 * @public
 */
export function createPortal(el: HTMLElement, input: PortalOptions): Cleanup {
  const doc = el.ownerDocument;
  const resolveTarget = (config: PortalConfig): HTMLElement => {
    let target: HTMLElement | null;
    try { target = typeof config.target === 'string' ? doc.querySelector<HTMLElement>(config.target) : config.target; } catch { throw createReservedError('ZEN-1604'); }
    if (!target || target.ownerDocument !== doc || composedContains(el, target)) throw createReservedError('ZEN-1604');
    return target;
  };
  const target = untrack(() => resolveTarget(resolveUIOptions(input, portalOptions.resolve)));
  // SSR keeps the authored location and installs no effect/observer or marker.
  if ((doc as Document & { __zenithSSR__?: boolean }).__zenithSSR__) return () => {};
  let entry = portals.get(el);
  if (entry && (entry.phase !== 'active' || entry.target !== target || el.parentNode !== target || (readable(input.target) && input.target !== entry.source))) throw createReservedError('ZEN-1604');
  if (!entry) {
    const parent = el.parentNode; if (!parent) return () => {};
    const next = el.nextSibling, marker = doc.createComment('zen-portal'); parent.insertBefore(marker, el);
    const current: PortalEntry = { target, source: input.target, references: 0, phase: 'moving', restore: () => {} };
    entry = current; portals.set(el, current);
    const phase = () => current.phase;
    let releaseBranch: Cleanup = () => {}, stop: Cleanup = () => {}, observer: MutationObserver | undefined, anchored = marker.isConnected;
    current.restore = () => {
      if (phase() === 'restoring' || phase() === 'closed') return;
      // Occupy the cache through reconnect callbacks so a stale lease or a nested
      // acquisition cannot steal a half-restored element.
      current.phase = 'restoring'; const errors: unknown[] = [];
      try { observer?.disconnect(); } catch (error) { errors.push(error); }
      try { stop(); } catch (error) { errors.push(error); }
      try { if (el.parentNode === current.target) { if (marker.parentNode) marker.replaceWith(el); else parent.insertBefore(el, next?.parentNode === parent ? next : null); } } catch (error) { errors.push(error); }
      try { marker.remove(); } catch (error) { errors.push(error); }
      try { releaseBranch(); } catch (error) { errors.push(error); }
      current.phase = 'closed'; if (portals.get(el) === current) portals.delete(el);
      if (errors.length === 1) throw errors[0]; if (errors.length > 1) throw new AggregateError(errors, 'Portal cleanup failed.');
    };
    const observe = () => {
      if (!observer || phase() !== 'active') return;
      observer.disconnect();
      const roots = new Set<Node>([doc, parent, parent.getRootNode(), current.target.getRootNode()]);
      for (const root of roots) observer.observe(root, { childList: true, subtree: true });
    };
    const move = (destination: HTMLElement) => {
      if (phase() !== 'active') return;
      if (el.parentNode !== current.target || (anchored && !marker.isConnected)) { current.restore(); return; }
      if (destination === current.target) return;
      const previous = current.target; current.phase = 'moving'; current.target = destination;
      try {
        destination.append(el);
        // append/reconnect can synchronously release the final lease.
        if (phase() !== 'moving') return;
        if (el.parentNode !== destination || (anchored && (!marker.isConnected || !destination.isConnected))) { current.restore(); return; }
        current.phase = 'active'; observe(); refreshFloating(doc);
      } catch (error) {
        if (phase() === 'moving' || phase() === 'active') {
          // Roll back only our move, never an external reparent/removal.
          if (el.parentNode === destination) {
            current.target = previous;
            try { previous.append(el); } catch {
              current.target = el.parentNode === destination ? destination : previous;
              try { current.restore(); } catch { /* preserve the move error */ }
            }
          } else current.target = previous;
          if (phase() !== 'closed' && phase() !== 'restoring') {
            if (el.parentNode !== previous) { try { current.restore(); } catch {} }
            else { current.phase = 'active'; try { observe(); refreshFloating(doc); } catch { try { current.restore(); } catch {} } }
          }
        }
        throw error;
      }
    };
    try {
      const branches = cleanupScope(); releaseBranch = branches.dispose;
      const parents = new Set<HTMLElement>(); if (el.parentElement) parents.add(el.parentElement);
      let originRoot = parent.getRootNode();
      while (originRoot.nodeType === 11 && 'host' in originRoot) { const host = (originRoot as ShadowRoot).host as HTMLElement; parents.add(host); originRoot = host.getRootNode(); }
      for (const logicalParent of parents) branches.add(floatingBranch(logicalParent, el));
      target.append(el);
      if (el.parentNode !== target || (anchored && (!marker.isConnected || !target.isConnected))) { current.restore(); return () => {}; }
      current.phase = 'active'; refreshFloating(doc);
      const Observer = doc.defaultView?.MutationObserver;
      if (Observer) {
        observer = new Observer(() => {
          if (phase() !== 'active') return;
          if (marker.isConnected) anchored = true;
          if (el.parentNode !== current.target || (anchored && (!marker.isConnected || !current.target.isConnected))) current.restore();
        }); observe();
      }
      if (readable(input.target)) {
        const release = effect(() => {
          const destination = resolveTarget(resolveUIOptions(input, portalOptions.resolve));
          untrack(() => move(destination));
        });
        stop = release;
        if (phase() === 'closed' || phase() === 'restoring') release();
      }
    } catch (error) { try { current.restore(); } catch {} throw error; }
  }
  const lease = entry; lease.references++; let active = true;
  return () => { if (!active) return; active = false; if (--lease.references === 0) lease.restore(); };
}
/** @deprecated Use createPortal(el, {target}). @public */
export function processPortal(el: HTMLElement, targetSelector: string, _context: Record<string, unknown> = {}): Cleanup {
  const doc = el.ownerDocument; let target: HTMLElement | null = null;
  try { target = doc.querySelector<HTMLElement>(targetSelector || 'body'); } catch {}
  return createPortal(el, { target: target ?? doc.body });
}
