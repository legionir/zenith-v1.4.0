import { s } from '@zenith/schema';
import { createTransition, type TransitionController } from '@zenith/transition';
import { refreshFloating, type ownership } from './internal';
/** Optional CSS-class motion; omitted names inherit the element's zen-transition. @public */
export interface UITransitionConfig { transition?: string | false; transitionDuration?: number; }
export const UI_MOTION_SHAPE = { transition: s.optional(s.union([s.enum([false]), s.string({ min: 1, max: 256 })])), transitionDuration: s.default(s.duration({ min: 0, max: 2147483647 }), 300) };
/** Visibility and motion have separate lifetimes from focus/modal/geometry leases. */
export function createUIMotion(el: HTMLElement, owner: ReturnType<typeof ownership>, options: () => UITransitionConfig) {
  const doc = el.ownerDocument, ssr = Boolean((doc as Document & { __zenithSSR__?: boolean }).__zenithSSR__);
  let epoch = 0, controller: TransitionController | undefined, desiredOpen = false, media: MediaQueryList | undefined;
  const cancel = () => { epoch++; const old = controller; controller = undefined; old?.dispose(); };
  const hideNow = () => { if (!owner.disposed) { owner.attr(el, 'hidden', ''); refreshFloating(doc); } };
  const finish = () => { cancel(); if (!desiredOpen) hideNow(); };
  owner.add(cancel);
  if (!ssr) {
    try { media = doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)'); } catch { /* A partial DOM has no media-query capability. */ }
    const changed = () => { if (media?.matches) finish(); };
    if (media?.addEventListener) { media.addEventListener('change', changed); owner.add(() => media?.removeEventListener('change', changed)); }
    else if (media?.addListener) { media.addListener(changed); owner.add(() => media?.removeListener(changed)); }
  }
  const animate = (direction: 'enter' | 'leave') => {
    const config = options(), name = config.transition === false ? '' : config.transition ?? el.getAttribute('zen-transition') ?? '';
    if (ssr || !doc.defaultView || media?.matches || !name || config.transitionDuration === 0) { if (direction === 'leave') hideNow(); return; }
    const version = epoch, motion = createTransition(name, { duration: config.transitionDuration ?? 300 }); controller = motion;
    try {
      const run = direction === 'enter' ? motion.enter(el) : motion.leave(el);
      if (owner.disposed || version !== epoch) { motion.dispose(); return; }
      void run.finished.then(() => { if (owner.disposed || version !== epoch) return; controller = undefined; motion.dispose(); if (direction === 'leave' && !desiredOpen) hideNow(); });
    } catch (error) { motion.dispose(); if (controller === motion) controller = undefined; if (direction === 'leave') hideNow(); throw error; }
  };
  return {
    show() { if (owner.disposed) return; cancel(); desiredOpen = true; owner.attr(el, 'hidden', null); owner.attr(el, 'aria-hidden', null); owner.attr(el, 'inert', null); },
    enter() { if (!owner.disposed && desiredOpen) { cancel(); animate('enter'); } },
    hide(animateLeave = true) { if (owner.disposed) return; const wasOpen = desiredOpen; cancel(); desiredOpen = false; owner.attr(el, 'aria-hidden', 'true'); owner.attr(el, 'inert', ''); if (animateLeave && wasOpen) animate('leave'); else hideNow(); },
    finish,
  };
}
