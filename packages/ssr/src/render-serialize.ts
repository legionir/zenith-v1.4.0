// packages/ssr/src/render-serialize.ts
//
// سریالایز state و helperهای hydration — استخراج مکانیکی از render.ts،
// بدون تغییر رفتار (#40).


/**
 * Serialize state for server-to-client transfer.
 * Strips functions and other non-serializable values.
 */
export function serializeState(state: Record<string, unknown>): string {
  return JSON.stringify(state, (_key: string, value: unknown) => {
    if (typeof value === 'function') return undefined;
    return value;
  });
}

/**
 * Inject serialized state into HTML output.
 */
export function injectState(html: string, state: string): string {
  const script = `<script id="zenith-state" type="application/json">${state}</script>`;
  return html.replace('</head>', `${script}</head>`);
}

/**
 * Validate hydration consistency between client and server state.
 */
export function validateHydration(clientState: unknown, serverState: unknown): boolean {
  return JSON.stringify(clientState) === JSON.stringify(serverState);
}

export interface SSRHeadInput {
  title?: string;
  meta?: Array<Record<string, string>>;
  link?: Array<Record<string, string>>;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  htmlAttrs?: Record<string, string>;
  bodyAttrs?: Record<string, string>;
}

export interface SSRI18nInput {
  locale: string;
  dir?: 'rtl' | 'ltr';
  messages?: Record<string, unknown>;
}

export interface SSRResult {
  html: string;
  state: string;
  route?: string;
  /** #174: تگ‌های رندرشدهٔ `<head>` */
  headTags?: string;
  /** #174: صفت‌های تگ `<html>` (مانند `lang` و `dir`) */
  htmlAttrs?: string;
  /** #174: صفت‌های تگ `<body>` */
  bodyAttrs?: string;
  /** #174: دادهٔ سریال‌شدهٔ چندزبانگی برای `__ZENITH_I18N__` */
  i18n?: string;
}

// SEC FIX (v1.2.6): SEC-A1 — safeScriptValue helper.
// Escapes characters that are dangerous when JSON is embedded in <script>:
//   `<` → `\u003c` (prevents `</script>` injection that closes the tag)
//   `>` → `\u003e` (defense-in-depth for `<!--`-style sequences)
//   U+2028 / U+2029 → line/paragraph separators (valid in JSON, fatal in JS string literals)
// Applied to BOTH state AND route before emitting them inside <script>...</script>.
export function safeScriptValue(jsonString: string): string {
  return jsonString
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

// SEC FIX (v1.2.6): SEC-A1 — validate that a route string cannot break out of
// the surrounding <script> tag. We reject any route containing `</` (which is
// the only sequence that can terminate a script element from inside a JS string
// literal after JSON.stringify has done its job). Returning false here lets the
// caller drop the route entirely rather than emit an unsafe value.
export function isRouteSafe(route: string | undefined | null): boolean {
  if (route == null) return true;
  return !route.includes('</');
}

/**
 * Calculate a simple checksum for hydration validation.
 * Used to verify server output matches client DOM before hydration.
 */
export function calculateChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Validate hydration using checksum comparison.
 * More reliable than simple JSON comparison of state alone.
 */
export function validateHydrationChecksum(serverHtml: string, clientRoot: HTMLElement): boolean {
  const serverChecksum = calculateChecksum(serverHtml);
  const clientChecksum = calculateChecksum(clientRoot.innerHTML);
  return serverChecksum === clientChecksum;
}

// ── Isomorphic utilities — work identically on server and client ──

/**
 * Get current environment (server or client).
 */
export function getEnvironment(): 'server' | 'client' {
  return typeof window === 'undefined' ? 'server' : 'client';
}

/**
 * Check if running on server.
 */
export function isServer(): boolean {
  return getEnvironment() === 'server';
}

/**
 * Check if running on client/browser.
 */
export function isClient(): boolean {
  return getEnvironment() === 'client';
}

/**
 * Run code only on server.
 */
export function runOnServer<T>(fn: () => T): T | undefined {
  if (isServer()) return fn();
  return undefined;
}

/**
 * Run code only on client.
 */
export function runOnClient<T>(fn: () => T): T | undefined {
  if (isClient()) return fn();
  return undefined;
}
