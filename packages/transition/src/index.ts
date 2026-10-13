// packages/transition/src/index.ts
export {
  enterTransition,
  leaveTransition,
  isTransitioning,
  cancelTransition,
  TRANSITION_NAMES,
  validateEasing,
  animateGroup,
  createTransition,
  animate,
  animateEnter,
  animateLeave,
  type TransitionDirection,
  type TransitionClasses,
  type TransitionOptions,
  type TransitionRun,
  type TransitionController,
  type AnimateCallOptions,
  type AnimateDirectionOptions,
} from './transition';

// FEATURE (v0.5.0): zen-animate — Web Animations API.
// این ماژول به‌جای کلاس‌های CSS از Element.animate() استفاده می‌کند و
// keyframes را مستقیماً از JS می‌گیرد. برای ثبت دایرکتیو `zen-animate` در
// runtime walker، processAnimate را export می‌کنیم.
export {
  zenAnimate,
  prefersReducedMotion,
  ANIMATE_PRESETS,
  parseAnimateAttr,
  processAnimate,
  type ParsedAnimateAttr,
  type ZenAnimateConfig,
} from './animate';

/**
 * #53: پیش‌فرض‌های منجمد برای `@zenith/transition` (`TransitionOptions`).
 * @default { duration: 300, easing: 'ease', delay: 0 }
 * @unit ms (duration, delay)
 * @since 1.4.0
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  duration: 300,
  easing: 'ease',
  delay: 0,
});

