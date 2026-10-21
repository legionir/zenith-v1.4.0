// packages/cli/src/check-findings.ts
//
// یافته‌ها و داده‌های مشترک دستور `zenith check` — استخراج مکانیکی از
// check.ts بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).


/**
 * شدت یافته‌های تحلیل.
 */
export type Severity = 'error' | 'warning' | 'info';

/**
 * یک یافته‌ی تحلیل.
 */
export interface Finding {
  file: string;
  line: number;
  column: number;
  severity: Severity;
  rule: string;
  message: string;
}

/**
 * 所有 directives معتبر Zenith.
 *
 * BUG-20 FIX (v1.2.2): لیست کامل دایرکتیوها اضافه شد. قبلاً بسیاری از
 * دایرکتیوهای معتبر (مثل zen-optimistic، zen-track، zen-date-picker،
 * zen-virtual، zen-island، zen-memo، zen-portal، zen-intersection، zen-cloak،
 * zen-else، zen-else-if، zen-action-button، zen-auth-view، zen-resource-view،
 * zen-suspense، zen-router، zen-route، zen-html-slot، zen-outlet، zen-form،
 * zen-field، zen-submit، zen-store، zen-auth، zen-login، zen-logout،
 * zen-validate، zen-transition، zen-animate، zen-props، zen-key، zen-static،
 * immutable، loading-text، hydrate، zen-virtual-list، zen-item-height،
 * zen-buffer، zen-dynamic-heights) وجود نداشتند و false positive تولید
 * می‌کردند.
 */
export const VALID_DIRECTIVES = new Set([
  // Core directives
  'zen-text',
  'zen-if',
  'zen-show',
  'zen-for',
  'zen-bind',
  'zen-model',
  'zen-html',
  'zen-html-trusted',
  'zen-fetch',
  'zen-resource',
  'zen-action',
  'zen-link',
  'zen-validate',
  'zen-permission',
  'zen-role',
  'zen-error',
  'zen-suspense',
  'zen-virtual-list',
  'zen-key',
  'zen-item-height',
  'zen-buffer',
  'zen-dynamic-heights',
  'zen-transition',
  'zen-cloak',
  'zen-ref',
  'zen-html-slot',
  'zen-props',
  'zen-static',
  'zen-animate',
  'zen-portal',
  'zen-intersection',
  'zen-error-text',
  // BUG-20 FIX (v1.2.2): directives جدید اضافه شدند.
  'zen-optimistic',
  'zen-track',
  'zen-date-picker',
  'zen-virtual',
  'zen-island',
  'zen-memo',
  'zen-else',
  'zen-else-if',
  'zen-action-button',
  'zen-auth-view',
  'zen-resource-view',
  // Router element directives (tags)
  'zen-route',
  'zen-outlet',
  'zen-router',
  // Form-related
  'zen-form',
  'zen-field',
  'zen-submit',
  // Store
  'zen-store',
  // Auth
  'zen-auth',
  'zen-login',
  'zen-logout',
  // Misc attribute directives
  'immutable',
  'loading-text',
  'hydrate',
]);

/**
 * دستورالعمل‌های deprecated.
 */
export const DEPRECATED_DIRECTIVES: Record<string, string> = {
  'zen-compile':
    'Use zen-text or zen-html with proper expressions instead. compileAndRender was removed for security.',
};