export { createFocusTrap, getFocusable, focusFirst, focusLast, restoreFocus, createRovingTabindex, type FocusTrap, type FocusTrapOptions, type FocusableOptions, type RovingOptions } from './focus';
export { lockScroll, inert, prefersReducedMotion, reducedMotionMatches, createIdScope, useId, type MotionPreference, type IdScope } from './environment';
export { announce, createLiveRegion, installRouteAnnouncer, type LiveRegion, type LiveRegionOptions, type RouteAnnouncerOptions } from './announce';
export { a11yPlugin, type A11yAppHost, type A11yBindContext } from './plugin';

export { registerEscapeLayer } from './escape';
