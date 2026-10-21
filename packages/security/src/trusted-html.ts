import { logger } from '@zenith/logger';
/** @public */
export function sanitizeHTMLTrusted(html: string): string {
  // Explicit development-marker diagnostic through the central logger only.
  // The logger's configured level controls output; this does not enable a sink
  // or override the framework's silent default. An explicit false dev flag
  // suppresses this marker entirely.
  if (typeof globalThis !== 'undefined' && Reflect.get(globalThis, '__ZENITH_DEV__') !== false) {
    logger.debug(
      '⚠️ [Zenith] zen-html-trusted: rendering unsanitized HTML. Ensure this content is trusted (e.g. from your own server, sanitized upstream).',
    );
  }
  // نکته: همیشه ورودی را به‌صورت رشته برمی‌گردانیم. null/undefined به '' تبدیل
  // می‌شوند تا رفتار innerHTML قابل پیش‌بینی بماند.
  if (html === null || html === undefined) return '';
  if (typeof html !== 'string') return String(html);
  return html;
}
