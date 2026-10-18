/** @public */
export interface CSPOptions {
  /** آیا اسکریپت‌های inline مجاز باشند؟ (پیش‌فرض: false) */
  allowInlineScript?: boolean;
  /** آیا استایل‌های inline مجاز باشند؟ (پیش‌فرض: false) */
  allowInlineStyle?: boolean;
  /** Nonce value برای script-src (و style-src در صورت عدم allowInlineStyle). */
  nonce?: string;
  /** #63: افزودن `'strict-dynamic'` به `script-src`. */
  strictDynamic?: boolean;
  /** #63: افزودن `require-trusted-types-for 'script'; trusted-types zenith`. */
  requireTrustedTypes?: boolean;
  /** دامنه‌های اضافی برای script-src. */
  extraScriptSrc?: string[];
  /** دامنه‌های اضافی برای style-src. */
  extraStyleSrc?: string[];
  /** دامنه‌های اضافی برای img-src. */
  extraImgSrc?: string[];
  /** آیا WebSocket connections مجاز باشد؟ (پیش‌فرض: false) */
  allowWebSockets?: boolean;
}

/** @public */
export function generateCSP(options?: CSPOptions): string {
  const scriptParts = [
    `'self'`,
    options?.allowInlineScript ? `'unsafe-inline'` : '',
    options?.nonce ? `'nonce-${options.nonce}'` : '',
    options?.strictDynamic ? `'strict-dynamic'` : '',
    ...(options?.extraScriptSrc ?? []),
  ].filter(Boolean);

  const styleParts = [
    `'self'`,
    options?.allowInlineStyle ? `'unsafe-inline'` : '',
    !options?.allowInlineStyle && options?.nonce ? `'nonce-${options.nonce}'` : '',
    ...(options?.extraStyleSrc ?? []),
  ].filter(Boolean);

  const directives = [
    `default-src 'self'`,
    `script-src ${scriptParts.join(' ')}`,
    `style-src ${styleParts.join(' ')}`,
    `img-src 'self' data: https:${options?.extraImgSrc ? ' ' + options.extraImgSrc.join(' ') : ''}`,
    options?.allowWebSockets ? `connect-src 'self' ws: wss:` : `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    options?.requireTrustedTypes ? `require-trusted-types-for 'script'` : '',
    options?.requireTrustedTypes ? `trusted-types zenith` : '',
  ].filter(Boolean);

  return directives.join('; ');
}
