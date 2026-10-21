import { inertFallback } from './inert-fallback';
import { signal } from '@zenith/state';
import { prefersReducedMotion as matchesReducedMotion, type Cleanup, type Disposable, type Readable } from '@zenith/shared';
export { matchesReducedMotion as reducedMotionMatches };

const locks = new WeakMap<HTMLElement, { count: number; overflow: string; priority: string }>();
/** Per-document reference-counted lock; unrelated documents cannot unlock each other. @public */
export function lockScroll(doc: Document | undefined = typeof document === 'undefined' ? undefined : document): Cleanup {
  if ((doc as (Document & { __zenithSSR__?: boolean }) | undefined)?.__zenithSSR__) return () => {};
  const body = doc?.body; if (!body) return () => {};
  let record = locks.get(body);
  if (!record) { record = { count: 0, overflow: body.style.getPropertyValue('overflow'), priority: body.style.getPropertyPriority('overflow') }; locks.set(body, record); }
  record.count++; body.style.setProperty('overflow', 'hidden'); let active = true;
  return () => { if (!active) return; active = false; if (--record.count === 0) { if (record.overflow) body.style.setProperty('overflow', record.overflow, record.priority); else body.style.removeProperty('overflow'); locks.delete(body); } };
}
const inertOwners = new WeakMap<HTMLElement, { count: number; value: boolean; aria: string | null; attr: string | null; supported: boolean; own: PropertyDescriptor | undefined; fallback?: Cleanup }>();
/** Reference-counted inert/ARIA state with exact restoration. @public */
export function inert(el: HTMLElement, on = true): Cleanup {
  if (!on || (el.ownerDocument as Document & { __zenithSSR__?: boolean }).__zenithSSR__) return () => {};
  let record = inertOwners.get(el);
  if (!record) { record = { count: 0, value: el.inert, aria: el.getAttribute('aria-hidden'), attr: el.getAttribute('inert'), supported: 'inert' in el, own: Object.getOwnPropertyDescriptor(el, 'inert') }; inertOwners.set(el, record); }
  const current = record; current.count++; let active = true;
  const release = () => {
    if (!active) return; active = false; if (--current.count !== 0) return;
    inertOwners.delete(el); const errors: unknown[] = [];
    const attempt = (run: () => void) => { try { run(); } catch (error) { errors.push(error); } };
    attempt(() => current.fallback?.());
    attempt(() => { el.inert = current.value; });
    attempt(() => { if (current.attr === null) el.removeAttribute('inert'); else el.setAttribute('inert', current.attr); });
    attempt(() => { if (!current.supported) { if (current.own) Object.defineProperty(el, 'inert', current.own); else Reflect.deleteProperty(el, 'inert'); } });
    attempt(() => { if (current.aria === null) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', current.aria); });
    if (errors.length === 1) throw errors[0]; if (errors.length) throw new AggregateError(errors, 'Inert restoration failed.');
  };
  try {
    el.inert = true; el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true');
    if (!current.supported && !current.fallback) current.fallback = inertFallback(el);
    return release;
  } catch (error) { try { release(); } catch {} throw error; }
}
/** @public */
export interface MotionPreference extends Readable<boolean>, Disposable { peek(): boolean; }
/** A live preference belongs to its caller; no matchMedia access at import time. @public */
export function prefersReducedMotion(doc?: Document): MotionPreference {
  const candidate = doc ?? (typeof document === 'undefined' ? undefined : document);
  const ssr = !!(candidate as (Document & { __zenithSSR__?: boolean }) | undefined)?.__zenithSSR__;
  const view = doc ? doc.defaultView : (typeof window === 'undefined' ? undefined : window);
  const media = ssr ? undefined : view?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const value = signal(media?.matches ?? false); const changed = () => value.set(media?.matches ?? false);
  if (media?.addEventListener) media.addEventListener('change', changed); else media?.addListener?.(changed); let active = true;
  return { get: () => value.get(), peek: () => value.peek(), dispose() { if (!active) return; active = false; if (media?.removeEventListener) media.removeEventListener('change', changed); else media?.removeListener?.(changed); value.dispose(); } };
}
/** Explicit scope is serialized by its seed/count, never by an ambient request singleton. @public */
export interface IdScope { next(prefix?: string): string; readonly count: number; }
/** @public */
export function createIdScope(prefix = 'zen-id', seed = 0): IdScope {
  let count = seed;
  return { next: (name = prefix) => `${name}-${++count}`, get count() { return count; } };
}
const fallbackIds = createIdScope();
/** Use the same explicit scope seed/order in SSR and hydration. @public */
export function useId(options: { prefix?: string; scope?: IdScope } = {}): string { return (options.scope ?? fallbackIds).next(options.prefix); }
