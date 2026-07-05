// packages/transition/src/index.ts
export {
  enterTransition,
  leaveTransition,
  isTransitioning,
  cancelTransition,
  TRANSITION_NAMES,
  validateEasing,
  animateGroup,
  type TransitionDirection,
  type TransitionOptions,
} from './transition';

// FEATURE (v0.5.0): zen-animate — Web Animations API.
// این ماژول به‌جای کلاس‌های CSS از Element.animate() استفاده می‌کند و
// keyframes را مستقیماً از JS می‌گیرد. برای ثبت دایرکتیو `zen-animate` در
// runtime walker، processAnimate را export می‌کنیم.
export {
  zenAnimate,
  ANIMATE_PRESETS,
  parseAnimateAttr,
  processAnimate,
  type ParsedAnimateAttr,
} from './animate';
