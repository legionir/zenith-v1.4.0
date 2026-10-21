import { deprecate } from '@zenith/errors';
import { defineOptions, s } from '@zenith/schema';
import { sanitizeHTML } from './html';
import { sanitizeHTMLTrusted } from './trusted-html';

/** Browser policy capability; outputs may be opaque native TrustedHTML/TrustedScriptURL. @public */
export interface TrustedTypePolicy {
  createHTML(input: string): unknown;
  createScriptURL(input: string): unknown;
}

/** Trusted Types factory capability consumed by the optional window integration. @public */
export interface TrustedTypePolicyFactory {
  createPolicy(
    name: string,
    rules: {
      createHTML?: (input: string) => string;
      createScriptURL?: (input: string) => string;
    },
  ): TrustedTypePolicy;
}

declare global {
  interface Window {
    trustedTypes?: TrustedTypePolicyFactory;
  }
}

let cachedTrustedTypesPolicy: TrustedTypePolicy | null = null;

/** @public */
export function createTrustedTypesPolicy(): TrustedTypePolicy | null {
  if (typeof window === 'undefined' || !window.trustedTypes || !window.trustedTypes.createPolicy) {
    return null;
  }
  if (cachedTrustedTypesPolicy) {
    return cachedTrustedTypesPolicy;
  }

  try {
    cachedTrustedTypesPolicy = window.trustedTypes.createPolicy('zenith', {
      createHTML: (html: string) => sanitizeHTML(html),
      createScriptURL: (url: string) => {
        // Only allow same-origin URLs for scripts
        if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
          return url;
        }
        try {
          const parsed = new URL(url, window.location.origin);
          if (parsed.origin === window.location.origin) {
            return url;
          }
        } catch {
          // Invalid URL - reject
        }
        return '';
      },
    });
    return cachedTrustedTypesPolicy;
  } catch {
    return cachedTrustedTypesPolicy;
  }
}

/** @public */
export function resetTrustedTypesPolicyCache(): void {
  cachedTrustedTypesPolicy = null;
}

/** HTML sink configuration, separate from the Element operand. @public */
export interface SafeInnerHTMLOptions { html: string; trusted?: boolean; }
const safeInnerHTMLOptions = /* @__PURE__ */ defineOptions<SafeInnerHTMLOptions>('SafeInnerHTMLOptions', s.object({ html: s.string(), trusted: s.optional(s.boolean()) }));
/** @public */
export function setSafeInnerHTML(el: Element, options: SafeInnerHTMLOptions): void;
/** @public @deprecated Use setSafeInnerHTML(el, { html, trusted }) (ZEN-DEPR-092; removal in 2.0). */
export function setSafeInnerHTML(el: Element, html: string, trusted?: boolean): void;
export function setSafeInnerHTML(el: Element, optionsOrHTML: SafeInnerHTMLOptions | string, legacyTrusted: boolean = false): void {
  let html: string;
  let trusted: boolean | undefined;
  if (typeof optionsOrHTML !== 'object' || optionsOrHTML === null || arguments.length > 2) {
    deprecate('ZEN-DEPR-092', 'setSafeInnerHTML(el, html, trusted)', 'setSafeInnerHTML(el, { html, trusted })');
    html = optionsOrHTML as string;
    trusted = legacyTrusted;
  } else {
    ({ html, trusted } = safeInnerHTMLOptions.resolve(optionsOrHTML));
  }
  const sanitized = trusted ? sanitizeHTMLTrusted(html) : sanitizeHTML(html);
  const policy = createTrustedTypesPolicy();
  if (policy && typeof policy.createHTML === 'function') {
    if (!Reflect.set(el, 'innerHTML', policy.createHTML(sanitized))) {
      throw new TypeError('Cannot set innerHTML');
    }
  } else {
    el.innerHTML = sanitized;
  }
}
