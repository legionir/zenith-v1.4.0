/** Stable testing facade; all implementation owners are package-private. */
export * from './reactivity';
export * from './render';
export * from './accessibility';
export * from './reset';
export * from './timers';
export * from './fetch';
export * from './router';
export * from './directive';

/**
 * #53: پیش‌فرض‌های منجمد برای `@zenith/testing` (`A11yAuditOptions`).
 * @default { maxViolations: 0, includeWarnings: false, level: 'AA' }
 * @since 1.4.0
 * @public
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  maxViolations: 0,
  includeWarnings: false,
  level: 'AA' as const,
});

