/** Legacy mode detection; evaluated on demand. @internal */
export function isDevMode(): boolean {
  // SSR-safe: if globalThis is undefined, we're not in a browser
  if (typeof globalThis === 'undefined') return false;

  // 1. Explicit global flag (highest priority)
  // #38: فلگ ambient با cast ساخت‌یافته (به‌جای any) — طبق الگوی runtime-core.
  const explicitFlag = (globalThis as { __ZENITH_DEV__?: boolean }).__ZENITH_DEV__;
  if (explicitFlag === false) return false;
  if (explicitFlag === true) return true;

  // 2. Build-time flag (if injected by bundler)
  // Vite sets import.meta.env.DEV, webpack sets process.env.NODE_ENV
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - import.meta may not exist in all environments
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV === true) {
      return true;
    }
  } catch {
    // ignore
  }

  // 3. Check NODE_ENV (webpack/other bundlers)
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - process may not exist in browser
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
      return true;
    }
  } catch {
    // ignore
  }

  // 4. URL parameter fallback
  try {
    if (typeof window !== 'undefined' && window.location?.search?.includes('zenith_dev=1')) {
      return true;
    }
  } catch {
    // ignore
  }

  // 5. Hostname fallback (localhost, 127.0.0.1, etc.)
  try {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const hostname = window.location.hostname;
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname.endsWith('.local')
      ) {
        return true;
      }
    }
  } catch {
    // ignore
  }

  // Default: true (dev mode enabled by default for DX)
  return true;
}
