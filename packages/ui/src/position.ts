import type { Cleanup } from '@zenith/shared';
import { createReservedError } from '@zenith/errors';
/** Physical side with logical start/end alignment (RTL aware). @public */
export type Placement = 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end' | 'left-start' | 'left-end' | 'right-start' | 'right-end';
/** @public */
export interface ComputePositionOptions { placement?: Placement; offset?: number; flip?: boolean; shift?: boolean; arrow?: HTMLElement; }
/** Geometry comes from the reference's realm, with logical alignment and safe bounds. @public */
export function computePosition(reference: HTMLElement, floating: HTMLElement, options: ComputePositionOptions = {}): { x: number; y: number; placement: Placement } {
  if (reference.ownerDocument !== floating.ownerDocument || (options.arrow && (options.arrow.ownerDocument !== floating.ownerDocument || !floating.contains(options.arrow)))) throw createReservedError('ZEN-1601');
  const requested = options.placement ?? 'bottom', offset = options.offset ?? 8;
  if (!/^(?:top|bottom|left|right)(?:-(?:start|end))?$/.test(requested) || !Number.isFinite(offset)) throw createReservedError('ZEN-1001');
  const anchor = reference.getBoundingClientRect(), box = floating.getBoundingClientRect(), view = reference.ownerDocument.defaultView;
  const width = view?.innerWidth ?? 1024, height = view?.innerHeight ?? 768;
  const [base, alignment] = requested.split('-'); let side = base as 'top' | 'bottom' | 'left' | 'right';
  const opposite = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' } as const;
  const space = { top: anchor.top, bottom: height - anchor.bottom, left: anchor.left, right: width - anchor.right };
  const size = side === 'top' || side === 'bottom' ? box.height : box.width;
  if (options.flip !== false && space[side] < size + offset && space[opposite[side]] > space[side]) side = opposite[side];
  const vertical = side === 'top' || side === 'bottom';
  const rtl = (view?.getComputedStyle(reference).direction || reference.closest('[dir]')?.getAttribute('dir')) === 'rtl';
  let x = anchor.left + (anchor.width - box.width) / 2, y = anchor.top + (anchor.height - box.height) / 2;
  if (vertical) { y = side === 'top' ? anchor.top - box.height - offset : anchor.bottom + offset; if (alignment) x = (alignment === 'start') !== rtl ? anchor.left : anchor.right - box.width; }
  else { x = side === 'left' ? anchor.left - box.width - offset : anchor.right + offset; if (alignment) y = alignment === 'start' ? anchor.top : anchor.bottom - box.height; }
  if (options.shift !== false) { x = Math.max(0, Math.min(width - box.width, x)); y = Math.max(0, Math.min(height - box.height, y)); }
  if (options.arrow) { options.arrow.style.setProperty('--zen-ui-arrow-x', `${anchor.left + anchor.width / 2 - x}px`); options.arrow.style.setProperty('--zen-ui-arrow-y', `${anchor.top + anchor.height / 2 - y}px`); }
  return { x, y, placement: `${side}${alignment ? `-${alignment}` : ''}` as Placement };
}
/** Queued observer callbacks become inert after idempotent cleanup. @public */
export function autoUpdate(reference: HTMLElement, floating: HTMLElement, update: () => void): Cleanup {
  const view = reference.ownerDocument.defaultView; let active = true, observer: ResizeObserver | undefined;
  const run = () => { if (active) update(); };
  const cleanup = () => { if (!active) return; active = false; view?.removeEventListener('resize', run); view?.removeEventListener('scroll', run, true); observer?.disconnect(); };
  try {
    view?.addEventListener('resize', run); view?.addEventListener('scroll', run, true);
    const Observer = view?.ResizeObserver; observer = Observer ? new Observer(run) : undefined;
    observer?.observe(reference); observer?.observe(floating); run();
  } catch (error) { cleanup(); throw error; }
  return cleanup;
}
