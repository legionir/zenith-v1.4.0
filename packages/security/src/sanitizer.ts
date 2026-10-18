/** Stable sanitizer facade: single policy cache and original entry identities. */
export { sanitizeHTML, sanitizeHTMLInDocument, sanitizeHTMLWithOptions, type SanitizeOptions } from './html';
export { sanitizeHTMLTrusted } from './trusted-html';
export { sanitizeCSS } from './css';
export { generateCSP, type CSPOptions } from './csp';
export { createTrustedTypesPolicy, resetTrustedTypesPolicyCache, setSafeInnerHTML, type SafeInnerHTMLOptions, type TrustedTypePolicy, type TrustedTypePolicyFactory } from './trusted-types';
