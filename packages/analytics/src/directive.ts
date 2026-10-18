import { evaluateExpression, createBindingContext } from '@zenith/expressions';
import { createReservedError } from '@zenith/errors';
import { logger } from '@zenith/logger';
import type { Analytics } from './types';

/** @public */
export interface TrackBindingOptions {
  analytics: Pick<Analytics, 'track'>;
  context?: Record<string, unknown>;
  expression?: string;
  /** Owner notification, including automatic DOM-removal cleanup. */
  onDispose?(reason?: 'manual' | 'once' | 'removed'): void;
}
const bindings = new WeakMap<HTMLElement, () => void>();

/** One binding engine for click/submit/change/visible, including old `trigger:event`. @public */
export function bindTrack(el: HTMLElement, options: TrackBindingOptions): () => void {
  if (typeof window === 'undefined' || (el.ownerDocument as Document & { __zenithSSR__?: boolean }).__zenithSSR__) return () => {};
  bindings.get(el)?.();
  const evaluationContext = createBindingContext(options.context ?? {});
  let name = options.expression ?? el.getAttribute('zen-track') ?? '';
  const split = /^(click|submit|change|visible):(.+)$/.exec(name);
  if (split) name = split[2]!;
  const trigger = el.getAttribute('zen-track-on') ?? split?.[1] ?? 'click';
  const debounce = Number(el.getAttribute('zen-track-debounce') ?? 0);
  if (!['click', 'submit', 'change', 'visible'].includes(trigger) || !Number.isFinite(debounce) || debounce < 0 || debounce > 2_147_483_647) throw createReservedError('ZEN-1001', { details: { expected: 'track trigger and nonnegative debounce' } });
  const once = el.hasAttribute('zen-track-once') && !['false', '0'].includes(el.getAttribute('zen-track-once') ?? '');
  let active = true, fired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let observer: IntersectionObserver | undefined;
  let removalObserver: MutationObserver | undefined;
  const reportFailure = () => { try { logger.error(createReservedError('ZEN-1901')); } catch { /* diagnostics isolation */ } };
  const dispatch = () => {
    timer = undefined;
    if (!active || (once && fired)) return;
    fired = true;
    try {
      const expression = el.getAttribute('zen-track-props');
      const value = expression ? evaluateExpression(expression, evaluationContext) : undefined;
      const props = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
      const label = el.getAttribute('zen-track-label') ?? el.getAttribute('data-label');
      let payload = props;
      if (label !== null) {
        payload = {};
        for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(props))) {
          if (key !== 'label') Object.defineProperty(payload, key, descriptor);
        }
        Object.defineProperty(payload, 'label', { value: label, enumerable: true });
      }
      void Promise.resolve(options.analytics.track(name, payload)).catch(reportFailure);
    } catch { reportFailure(); }
    finally { if (once) cleanup('once'); }
  };
  const handle = () => { if (!active) return; if (timer !== undefined) clearTimeout(timer); if (debounce > 0) timer = setTimeout(dispatch, debounce); else dispatch(); };
  if (trigger === 'visible') {
    if (typeof IntersectionObserver !== 'undefined') { observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.target === el && entry.isIntersecting)) handle(); }); observer.observe(el); }
  } else el.addEventListener(trigger, handle);
  function cleanup(reason: 'manual' | 'once' | 'removed' = 'manual'): void {
    if (!active) return;
    active = false;
    if (timer !== undefined) clearTimeout(timer);
    observer?.disconnect(); removalObserver?.disconnect(); el.removeEventListener(trigger, handle);
    if (bindings.get(el) === cleanup) bindings.delete(el);
    options.onDispose?.(reason);
  }
  const Observer = el.ownerDocument.defaultView?.MutationObserver;
  if (Observer && el.ownerDocument.documentElement) {
    let connected = el.isConnected;
    removalObserver = new Observer(() => {
      if (el.isConnected) connected = true;
      else if (connected) cleanup('removed');
    });
    removalObserver.observe(el.ownerDocument.documentElement, { childList: true, subtree: true });
  }
  bindings.set(el, cleanup);
  return cleanup;
}
